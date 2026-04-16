/**
 * AppShell — top-level UI orchestrator.
 *
 * Responsibilities:
 *   - Create the shell DOM: top bar (tabs + profile/settings icons), route-announcement region,
 *     page container with 5 panels (profile has no tab), toast region.
 *   - Instantiate and wire all core services:
 *       RouterService, NavigationService, ModalService,
 *       NotificationService, AnalyticsService.
 *   - Expose a service bag that controllers receive via injection.
 *   - Register all application routes.
 *   - Start the router after everything is wired.
 *   - Provide an `aria-live` announcement region for route changes.
 *
 * Architecture decisions:
 *   - AppShell is a class (not a singleton module) so it can be unit-tested
 *     by constructing a fresh instance with a test container.
 *   - Top tab bar (PLAY, CHARACTER, GARAGE, TRACKS) centered; profile + settings as icons on the right.
 *     Tab panels are persistent — show/hide via CSS, never destroyed on switch.
 *   - RouterService still handles overlay routes (Pause, Results) but tab
 *     navigation bypasses it entirely via switchTab().
 *   - Z-index layers match COMPONENT_SPEC.md global conventions:
 *       base=0, panel=10, tabbar=50, topnav=100, modal=500, toast=600.
 *
 * Shell DOM structure:
 *
 *   <div id="kk-app-shell">
 *     <div aria-live="polite" aria-atomic="true" class="kk-sr-announcer"></div>
 *     <main class="kk-page-container" id="kk-page-container">
 *       <div class="kk-panel kk-panel--active" data-panel="race"></div>
 *       <div class="kk-panel" data-panel="character"></div>
 *       <div class="kk-panel" data-panel="garage"></div>
 *       <div class="kk-panel" data-panel="tracks"></div>
 *       <div class="kk-panel" data-panel="profile"></div>
 *     </main>
 *     <div class="kk-shell-chrome">
 *       <div class="kk-shell-topbar">
 *         <nav class="kk-tab-bar" role="tablist" aria-label="Main navigation">...</nav>
 *         <div class="kk-shell-utility">...</div>
 *       </div>
 *     </div>
 *     <div class="kk-toast-region" role="region"
 *          aria-label="Notifications" aria-live="polite"
 *          aria-atomic="false" aria-relevant="additions"></div>
 *     <!-- modal overlays appended here by ModalService -->
 *   </div>
 */

import { RouterService }      from './RouterService.js';
import { NavigationService }  from './NavigationService.js';
import { ModalService }       from './ModalService.js';
import { NotificationService } from './NotificationService.js';
import { AnalyticsService }   from './AnalyticsService.js';
import { RouteIds }           from '../enums/RouteIds.js';
import { createGameEngine }   from '../../GameEngine.js';
import { getTrackById }       from '../../TrackRegistry.js';
import { GaragePreview }      from '../GaragePreview.js';
import { LobbyScene }         from '../LobbyScene.js';
import { PartyLobbyScene }    from '../PartyLobbyScene.js';
import { MenuMusicPlayer }    from '../audio/MenuMusicPlayer.js';
import { Settings }           from '../../Settings.js';
import { MarginalMusicCard }  from '../components/MarginalMusicCard.js';
import { LoadingOverlay }     from '../components/LoadingOverlay.js';
import { showNameEntryModal } from '../components/NameEntryModal.js';
import { RacePanel }         from '../panels/RacePanel.js';
import { CharacterPanel }    from '../panels/CharacterPanel.js';
import { ProfilePanel }      from '../panels/ProfilePanel.js';
import { GaragePanel }       from '../panels/GaragePanel.js';
import { TracksPanel }       from '../panels/TracksPanel.js';
import { ResultsOverlay }    from '../overlays/ResultsOverlay.js';

// Tab definitions — order matches the tab bar left-to-right.
const TAB_DEFS = [
	{ id: 'race',    label: 'PLAY' },
	{ id: 'character', label: 'CHARACTER' },
	{ id: 'garage',  label: 'GARAGE' },
	{ id: 'tracks',  label: 'TRACKS' },
];

// Render mode per tab — lobby for most tabs, idle for opaque TRACKS page.
const TAB_RENDER_MODES = {
	race:    'lobby',
	character: 'lobby',
	garage:  'lobby',
	tracks:  'idle',
	profile: 'lobby',
};
const TAB_MENU_PREVIEW_PRESETS = {
	race: 'play',
	character: 'character-body',
	garage: 'garage-kart',
	tracks: 'play',
	profile: 'play',
};
const RENDER_MODE_TARGET_FPS = Object.freeze( {
	idle: 0,
	lobby: 45,
	garage: 45,
	'party-lobby': 60,
	race: 0,
} );
const BACKGROUND_TAB_TARGET_FPS = 4;

function getRenderIntervalMs( mode ) {

	const isHidden = typeof document !== 'undefined' && document.hidden;
	const targetFps = isHidden
		? ( mode === 'race' ? 0 : BACKGROUND_TAB_TARGET_FPS )
		: ( RENDER_MODE_TARGET_FPS[ mode ] ?? 0 );

	return targetFps > 0 ? ( 1000 / targetFps ) : 0;

}

function shouldExposeKartDebug() {

	if ( typeof window === 'undefined' || ! window.location ) return false;
	if ( window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ) return true;
	return window.location.search.includes( 'debug=' );

}

export class AppShell {

	/**
	 * @param {HTMLElement}    mountEl   Element in the host document to render into.
	 * @param {AppShellConfig} [config]
	 */
	constructor( mountEl, config = {} ) {

		/** @type {HTMLElement} */
		this._mountEl = mountEl;

		/** @type {AppShellConfig} */
		this._config = config;

		// -----------------------------------------------------------------------
		// Service instances
		// -----------------------------------------------------------------------

		this._router       = new RouterService();
		this._modal        = new ModalService();
		this._notification = new NotificationService();
		this._analytics    = new AnalyticsService();

		// NavigationService is a module-level singleton exported as named functions.
		// Expose it through the service bag as a reference to the namespace object.
		this._navigation   = NavigationService;

		/** @type {Services} */
		this._services = {
			router:         this._router,
			navigation:     this._navigation,
			modal:          this._modal,
			notification:   this._notification,
			analytics:      this._analytics,
			startRace:      ( raceConfig ) => this.startRace( raceConfig ),
			endRace:        ( results ) => this.endRace( results ),
			openSettings:   ( options ) => this._openSettingsRoute( options ),
			closeSettings:  () => this._closeSettingsRoute(),
			setRenderMode:  ( mode ) => this.setRenderMode( mode ),
			getRenderMode:  () => this.getRenderMode(),
			setSettingsRouteActive: ( active ) => this._setSettingsRouteActive( active ),
			setMenuPreviewFocus: ( presetId, options ) => this.setMenuPreviewFocus( presetId, options ),
			setMenuPreviewTuning: ( tuning, options ) => this.setMenuPreviewTuning( tuning, options ),
			resetMenuPreviewTuning: ( options ) => this.resetMenuPreviewTuning( options ),
			getMenuPreviewTuning: () => this.getMenuPreviewTuning(),
			getMenuPreviewPose: () => this.getMenuPreviewPose(),
			showPartyLobby: () => this.showPartyLobby(),
			hidePartyLobby: () => this.hidePartyLobby(),
			openDebugConsole: () => this.openDebugConsole(),
			isDebugConsoleAvailable: () => this.isDebugConsoleAvailable(),
			garagePreview:  null,  // populated in bootstrap() after engine creation
			menuMusic:      null,
			selectedMode:   'solo',
			switchTab:      ( name ) => this.switchTab( name ),
			shell:          null,
		};

		// -----------------------------------------------------------------------
		// GameEngine (created during bootstrap)
		// -----------------------------------------------------------------------

		/** @type {object | null} */
		this._engine = null;

		// -----------------------------------------------------------------------
		// Render loop state
		// -----------------------------------------------------------------------

		/**
		 * Current render mode.
		 * 'idle'    — no active rendering (menu browsing, no ambient scene yet)
		 * 'race'    — GameEngine.update() called each frame
		 * 'garage'  — GaragePreview.update() called each frame
		 * 'lobby'   — LobbyScene.update() called with menu frame pacing
		 * 'party-lobby' — fullscreen party scene render
		 * @type {'idle' | 'race' | 'garage' | 'lobby' | 'party-lobby'}
		 */
		this._renderMode = 'idle';

		/** @type {number | null} rAF handle for cancellation */
		this._rafId = null;

		/** @type {number} previous frame timestamp for dt calculation */
		this._lastFrameTime = 0;

		/** @type {object | null} garage preview renderer (Unit 5 placeholder) */
		this._garagePreview = null;

		/** @type {import('../LobbyScene.js').LobbyScene | null} */
		this._lobbyScene = null;

		/** @type {import('../PartyLobbyScene.js').PartyLobbyScene | null} */
		this._partyLobbyScene = null;

		/** @type {import('../audio/MenuMusicPlayer.js').MenuMusicPlayer | null} */
		this._menuMusic = null;

		// -----------------------------------------------------------------------
		// DOM elements (populated by _buildShell())
		// -----------------------------------------------------------------------

		/** @type {HTMLElement | null} */
		this._shell = null;

		/** @type {HTMLElement | null} */
		this._announcer = null;

		/** @type {HTMLElement | null} */
		this._tabBarEl = null;

		/** @type {HTMLElement | null} */
		this._pageContainer = null;

		/** @type {HTMLElement | null} */
		this._toastRegion = null;

		/** @type {import('../components/MarginalMusicCard.js').MarginalMusicCard | null} */
		this._menuMusicCard = null;

		/** @type {HTMLElement | null} */
		this._debugHostEl = null;

		/** @type {HTMLButtonElement | null} */
		this._profileShellBtn = null;

		/** @type {HTMLButtonElement | null} */
		this._debugShellBtn = null;

		/** @type {HTMLButtonElement | null} */
		this._debugToggleBtn = null;

		/** @type {HTMLElement | null} */
		this._debugPanelEl = null;

		// -----------------------------------------------------------------------
		// Tab panel state
		// -----------------------------------------------------------------------

		/** @type {Map<string, HTMLElement>} tab id → panel div */
		this._panels = new Map();

		/** @type {Map<string, HTMLElement>} tab id → tab button */
		this._tabButtons = new Map();

		/** @type {string} currently active tab id */
		this._activeTab = 'race';

		/** @type {string} menu tab to restore after route-based pages close */
		this._routeFallbackTab = 'race';

		/** @type {boolean} */
		this._settingsRouteActive = false;

		// -----------------------------------------------------------------------
		// Tab panel controllers (created in bootstrap)
		// -----------------------------------------------------------------------

		/** @type {import('../panels/RacePanel.js').RacePanel | null} */
		this._racePanel = null;

		/** @type {import('../panels/ProfilePanel.js').ProfilePanel | null} */
		this._profilePanel = null;

		/** @type {import('../panels/CharacterPanel.js').CharacterPanel | null} */
		this._characterPanel = null;

		/** @type {import('../panels/GaragePanel.js').GaragePanel | null} */
		this._garagePanel = null;

		/** @type {import('../panels/TracksPanel.js').TracksPanel | null} */
		this._tracksPanel = null;

		/** @type {import('../overlays/ResultsOverlay.js').ResultsOverlay | null} */
		this._resultsOverlay = null;

		/** @type {import('../components/LoadingOverlay.js').LoadingOverlay | null} */
		this._raceLoadingOverlay = null;

	}

	// ---------------------------------------------------------------------------
	// Bootstrap
	// ---------------------------------------------------------------------------

	/**
	 * Build the shell DOM, initialize services, register routes, and start routing.
	 * This is the single entry point called by main.js / the game page.
	 */
	bootstrap( options = {} ) {

		const reportBootstrap = this._createBootstrapProgressReporter( options.onProgress );
		reportBootstrap( {
			phase: 'Booting',
			message: 'Launching menu',
			detail: 'Building interface shell',
			progress: 0.08,
			determinate: true,
		} );

		this._buildShell();
		this._initServices();
		reportBootstrap( {
			phase: 'Booting',
			message: 'Launching menu',
			detail: 'Wiring menu systems',
			progress: 0.18,
			determinate: true,
		} );

		const settings = new Settings();
		this._menuMusic = new MenuMusicPlayer();
		this._menuMusic.setVolume( ( settings.get( 'musicVolume' ) ?? 100 ) / 100 );
		this._services.menuMusic = this._menuMusic;
		this._menuMusicCard = new MarginalMusicCard( {
			player: this._menuMusic,
		} );
		reportBootstrap( {
			phase: 'Booting',
			message: 'Launching menu',
			detail: 'Mounting panels',
			progress: 0.32,
			determinate: true,
		} );

		// Mount RacePanel into the RACE tab container.
		const raceContainer = this._panels.get( 'race' );
		if ( raceContainer ) {

			this._racePanel = new RacePanel( raceContainer, this._services );
			this._racePanel.attachMenuMusicCard?.( this._menuMusicCard.el );

		}

		// Mount CharacterPanel into the CHARACTER tab container.
		const characterContainer = this._panels.get( 'character' );
		if ( characterContainer ) {

			this._characterPanel = new CharacterPanel( characterContainer, this._services );

		}

		// Mount GaragePanel into the GARAGE tab container.
		const garageContainer = this._panels.get( 'garage' );
		if ( garageContainer ) {

			this._garagePanel = new GaragePanel( garageContainer, this._services );

		}

		// Mount TracksPanel into the TRACKS tab container.
		const tracksContainer = this._panels.get( 'tracks' );
		if ( tracksContainer ) {

			this._tracksPanel = new TracksPanel( tracksContainer, this._services );

		}

		// Mount ProfilePanel into the PROFILE tab container.
		const profileContainer = this._panels.get( 'profile' );
		if ( profileContainer ) {

			this._profilePanel = new ProfilePanel( profileContainer, this._services );

		}

		// Create GameEngine — renderer canvas lives inside #canvas-container (z-index 0).
		const canvasContainer = this._config.canvasContainer || document.getElementById( 'canvas-container' );
		if ( canvasContainer ) {

			this._engine = createGameEngine( canvasContainer );
			this._services.engine = this._engine;
			if ( shouldExposeKartDebug() ) {

				const debugSettings = new Settings();
				window.__kartDebug = {
					app: this,
					engine: this._engine,
					getState: () => ( {
						activeTab: this._activeTab,
						renderMode: this._renderMode,
						shellVisible: this._shell ? this._shell.style.display !== 'none' : false,
						tabBarVisible: this._tabBarEl ? this._tabBarEl.style.display !== 'none' : false,
						engine: this._engine?.getDebugState?.() ?? null,
					} ),
					getAIState: () => this._engine?.getDebugAIState?.() ?? [],
					setAICount: ( count ) => {

						const nextCount = Math.max( 0, Math.min( 8, Math.round( Number( count ) || 0 ) ) );
						debugSettings.set( 'aiCount', nextCount );
						return nextCount;

					},
					setCameraMode: ( mode ) => {

						debugSettings.set( 'cameraMode', mode );
						return mode;

					},
					switchTab: ( tab ) => this.switchTab( tab ),
					startSoloRace: ( config = {} ) => this.startDebugSoloRace( config ),
				};

			}

			// Create GaragePreview sharing the renderer from GameEngine.
			const renderer = this._engine.getRenderer();
			this._garagePreview = new GaragePreview( renderer );
			this._services.garagePreview = this._garagePreview;
			reportBootstrap( {
				phase: 'Loading Menu',
				message: 'Preparing menu scene',
				detail: 'Starting lobby renderer',
				progress: 0.54,
				determinate: true,
			} );

			// Create LobbyScene — 3D environment behind all menu tabs.
			this._lobbyScene = new LobbyScene( renderer );
			this._services.lobbyScene = this._lobbyScene;
			this._mountDebugToggle( this._lobbyScene._debugToggleBtn, this._lobbyScene._debugPanel );
			this._lobbyScene.setLoadingProgressReporter( ( previewState ) => {

				reportBootstrap( {
					phase: 'Loading Menu',
					message: 'Loading menu preview',
					detail: previewState.detail || 'Preparing first reveal',
					progress: 0.60 + ( ( previewState.progress ?? 0 ) * 0.34 ),
					determinate: true,
				} );

			} );

			window.addEventListener( 'settings-changed', ( e ) => {

				if ( e.detail.key === 'musicVolume' ) {

					this._menuMusic?.setVolume( ( Number( e.detail.value ) || 0 ) / 100 );

				}

				if ( ! this._lobbyScene ) return;

				if ( e.detail.key === 'vehicleColor' ||
					e.detail.key === 'characterColor' ||
					e.detail.key === 'charSkinColor' ||
					e.detail.key === 'charAccessories' ||
					e.detail.key === 'maskTintMainColor' ||
					e.detail.key === 'maskTintSecondaryColor' ||
					e.detail.key === 'selectedBalaclavaId' ) {

					const nextSettings = new Settings();
					this._lobbyScene.setAppearance( nextSettings.getPlayerAppearance() );

				}

			} );

		}

		this._registerRoutes();
		reportBootstrap( {
			phase: 'Loading Menu',
			message: 'Preparing menu scene',
			detail: 'Starting navigation',
			progress: 0.60,
			determinate: true,
		} );

		// RouterService render target — used for overlay routes (Pause, Results).
		this._router.setContainer( this._pageContainer );

		// Start the persistent render loop coordinator.
		this._startRenderLoop();

		// Title skip for returning players: skip router dispatch, go straight
		// to RACE tab. First-run players see NameEntryModal then RACE tab.

		// Auto-start race if URL contains track data (#track=v4:...)
		const trackHash = window.location.hash.slice( 1 );
		if ( trackHash.startsWith( 'track=v4:' ) ) {

			this._lobbyScene?.setLoadingProgressReporter?.( null );
			reportBootstrap( {
				phase: 'Launching Race',
				message: 'Starting race',
				detail: 'Handing off to the race loader',
				progress: 1,
				determinate: true,
			} );
			this._router.start();
			void this.startRace( { mode: 'solo' } );
			return Promise.resolve();

		} else if ( settings.isFirstRun() ) {

			// First run: show name modal, then land on RACE tab.
			// Handle first-run BEFORE router.start() to avoid the fallback
			// firing switchTab('race') before the name modal shows.
			this._lobbyScene?.setLoadingProgressReporter?.( null );
			reportBootstrap( {
				phase: 'Ready',
				message: 'Menu Ready',
				detail: 'Opening pilot profile entry',
				progress: 1,
				determinate: true,
			} );
			void this._handleFirstRun( settings );
			this._router.start();
			return Promise.resolve();

		} else {

			// Returning player: skip title, go straight to RACE tab.
			// Start the router but suppress initial dispatch by starting
			// after we've already switched to the RACE tab.
			this.switchTab( 'race' );
			this._router.start();
			void this._activateMenuMusic();
			reportBootstrap( {
				phase: 'Loading Menu',
				message: 'Loading menu preview',
				detail: 'Waiting for the first full reveal',
				progress: 0.72,
				determinate: true,
			} );
			return this._waitForInitialMenuPreview()
				.then( () => {

					reportBootstrap( {
						phase: 'Ready',
						message: 'Menu Ready',
						detail: 'First menu scene is ready',
						progress: 1,
						determinate: true,
					} );

				} )
				.finally( () => {

					this._lobbyScene?.setLoadingProgressReporter?.( null );

				} );

		}

	}

	// ---------------------------------------------------------------------------
	// First-run handling
	// ---------------------------------------------------------------------------

	/**
	 * First visit flow: show NameEntryModal, then land on RACE tab.
	 *
	 * @param {Settings} settings
	 */
	async _handleFirstRun( settings ) {

		await showNameEntryModal( this._modal, settings );
		this.switchTab( 'race' );
		void this._activateMenuMusic();

	}

	_createBootstrapProgressReporter( onProgress ) {

		if ( typeof onProgress !== 'function' ) return () => {};

		return ( nextState = {} ) => {

			const numericProgress = Number( nextState.progress );
			const progress = Number.isFinite( numericProgress )
				? Math.max( 0, Math.min( 1, numericProgress ) )
				: null;
			const determinate = nextState.determinate !== undefined
				? !! nextState.determinate
				: progress !== null;
			onProgress( {
				phase: nextState.phase || 'Booting',
				message: nextState.message || 'Launching menu',
				detail: nextState.detail || '',
				progress,
				determinate,
				progressText: nextState.progressText ||
					( determinate && progress !== null ? `${ Math.round( progress * 100 ) }%` : '...' ),
			} );

		};

	}

	_waitForInitialMenuPreview( timeoutMs = 2500 ) {

		if ( ! this._lobbyScene?.whenInitialRevealReady ) return Promise.resolve();

		return Promise.race( [
			this._lobbyScene.whenInitialRevealReady(),
			new Promise( ( resolve ) => setTimeout( resolve, timeoutMs ) ),
		] ).catch( () => {} );

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {Services} */
	get services() { return this._services; }

	/** @returns {RouterService} */
	get router() { return this._router; }

	// ---------------------------------------------------------------------------
	// Shell DOM construction
	// ---------------------------------------------------------------------------

	_buildShell() {

		const shell = document.createElement( 'div' );
		shell.id = 'kk-app-shell';
		shell.className = 'kk-app-shell';

		// Screen-reader live announcement region (route changes, card selections).
		const announcer = document.createElement( 'div' );
		announcer.className = 'kk-sr-announcer';
		announcer.setAttribute( 'aria-live', 'polite' );
		announcer.setAttribute( 'aria-atomic', 'true' );
		// Visually hidden but in the DOM for screen readers.
		Object.assign( announcer.style, {
			position: 'absolute',
			width:    '1px',
			height:   '1px',
			padding:  '0',
			margin:   '-1px',
			overflow: 'hidden',
			clip:     'rect(0,0,0,0)',
			border:   '0',
		} );
		shell.appendChild( announcer );
		this._announcer = announcer;

		// Primary page render target — holds tab panels.
		const pageContainer = document.createElement( 'main' );
		pageContainer.className = 'kk-page-container';
		pageContainer.id = 'kk-page-container';
		shell.appendChild( pageContainer );
		this._pageContainer = pageContainer;

		// Create the tab panels inside the page container.
		this._createTabPanels( pageContainer );

		// Bottom tab bar.
		const chromeEl = this._createTabBar();
		shell.appendChild( chromeEl );
		this._tabBarEl = chromeEl;

		// Toast notification region — singleton, lives above tab bar, below modal.
		const toastRegion = document.createElement( 'div' );
		toastRegion.className = 'kk-toast-region';
		toastRegion.setAttribute( 'role', 'region' );
		toastRegion.setAttribute( 'aria-label', 'Notifications' );
		toastRegion.setAttribute( 'aria-live', 'polite' );
		toastRegion.setAttribute( 'aria-atomic', 'false' );
		toastRegion.setAttribute( 'aria-relevant', 'additions' );
		shell.appendChild( toastRegion );
		this._toastRegion = toastRegion;

		this._mountEl.appendChild( shell );
		this._shell = shell;
		this._services.shell = shell;

	}

	// ---------------------------------------------------------------------------
	// Tab bar
	// ---------------------------------------------------------------------------

	/**
	 * Create the top bar: centered PLAY/CHARACTER/GARAGE/TRACKS tabs; profile + settings icons on the right.
	 *
	 * @returns {HTMLElement}
	 */
	_createTabBar() {

		const chrome = document.createElement( 'div' );
		chrome.className = 'kk-shell-chrome';

		const nav = document.createElement( 'nav' );
		nav.className = 'kk-tab-bar';
		nav.setAttribute( 'role', 'tablist' );
		nav.setAttribute( 'aria-label', 'Main navigation' );

		const tabsWrap = document.createElement( 'div' );
		tabsWrap.className = 'kk-tab-bar__tabs';
		nav.appendChild( tabsWrap );

		const utility = document.createElement( 'div' );
		utility.className = 'kk-shell-utility';

		const profileBtn = document.createElement( 'button' );
		profileBtn.type = 'button';
		profileBtn.className = 'kk-shell-utility__icon-btn kk-shell-utility__profile-btn';
		profileBtn.setAttribute( 'aria-label', 'Profile' );
		profileBtn.setAttribute( 'aria-current', 'false' );
		profileBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
		profileBtn.addEventListener( 'click', () => this.switchTab( 'profile' ) );
		utility.appendChild( profileBtn );
		this._profileShellBtn = profileBtn;

		const debugBtn = document.createElement( 'button' );
		debugBtn.type = 'button';
		debugBtn.className = 'kk-shell-utility__debug-btn';
		debugBtn.textContent = 'Debug';
		debugBtn.setAttribute( 'aria-label', 'Open debug controls' );
		debugBtn.addEventListener( 'click', () => {

			if ( ! this.openDebugConsole() ) {

				this._notification?.show( {
					message: 'Debug controls are not available on this screen yet.',
					variant: 'info',
				} );

			}

		} );
		utility.appendChild( debugBtn );
		this._debugShellBtn = debugBtn;

		const gearBtn = document.createElement( 'button' );
		gearBtn.type = 'button';
		gearBtn.className = 'kk-tab-bar__gear kk-tab-bar__gear--icon-only';
		gearBtn.setAttribute( 'aria-label', 'Open settings' );
		gearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
		gearBtn.addEventListener( 'click', () => this._openSettingsRoute() );
		utility.appendChild( gearBtn );

		const debugHost = document.createElement( 'div' );
		debugHost.className = 'kk-shell-utility__debug-host';
		utility.appendChild( debugHost );
		this._debugHostEl = debugHost;
		this._syncDebugShellButtonState();

		for ( const tab of TAB_DEFS ) {

			const btn = document.createElement( 'button' );
			btn.className = 'kk-tab-bar__btn';
			btn.type = 'button';
			btn.setAttribute( 'role', 'tab' );
			btn.setAttribute( 'aria-selected', tab.id === this._activeTab ? 'true' : 'false' );
			btn.setAttribute( 'aria-controls', `kk-panel-${tab.id}` );
			btn.setAttribute( 'tabindex', tab.id === this._activeTab ? '0' : '-1' );
			btn.id = `kk-tab-${tab.id}`;
			btn.dataset.tab = tab.id;

			if ( tab.id === this._activeTab ) {

				btn.classList.add( 'kk-tab-bar__btn--active' );

			}

			const label = document.createElement( 'span' );
			label.className = 'kk-tab-bar__label';
			label.textContent = tab.label;
			btn.appendChild( label );

			btn.addEventListener( 'click', () => {

				this.switchTab( tab.id );

			} );

			tabsWrap.appendChild( btn );
			this._tabButtons.set( tab.id, btn );

		}

		// Arrow key navigation within the tab bar.
		nav.addEventListener( 'keydown', ( e ) => {

			const btns = Array.from( nav.querySelectorAll( '.kk-tab-bar__btn' ) );
			const idx  = btns.indexOf( document.activeElement );
			if ( idx === - 1 ) return;

			let nextIdx = - 1;

			if ( e.key === 'ArrowRight' ) {

				e.preventDefault();
				nextIdx = ( idx + 1 ) % btns.length;

			} else if ( e.key === 'ArrowLeft' ) {

				e.preventDefault();
				nextIdx = ( idx - 1 + btns.length ) % btns.length;

			} else if ( e.key === 'Home' ) {

				e.preventDefault();
				nextIdx = 0;

			} else if ( e.key === 'End' ) {

				e.preventDefault();
				nextIdx = btns.length - 1;

			}

			if ( nextIdx !== - 1 ) {

				btns[ nextIdx ].focus();
				this.switchTab( btns[ nextIdx ].dataset.tab );

			}

		} );

		const topSpacer = document.createElement( 'div' );
		topSpacer.className = 'kk-shell-topbar__spacer';
		topSpacer.setAttribute( 'aria-hidden', 'true' );

		const topbar = document.createElement( 'div' );
		topbar.className = 'kk-shell-topbar';
		topbar.appendChild( topSpacer );
		topbar.appendChild( nav );
		topbar.appendChild( utility );
		chrome.appendChild( topbar );

		return chrome;

	}

	_mountDebugToggle( toggleBtn, debugPanel ) {

		if ( ! toggleBtn ) return;

		this._debugToggleBtn = toggleBtn;
		this._debugPanelEl = debugPanel ?? null;
		toggleBtn.style.display = 'none';
		if ( this._debugHostEl ) this._debugHostEl.replaceChildren();
		this._syncDebugShellButtonState();

		if ( debugPanel ) {

			debugPanel.style.top = 'calc(env(safe-area-inset-top, 0px) + 5rem)';
			debugPanel.style.right = '16px';

		}

	}

	_syncDebugShellButtonState() {

		if ( ! this._debugShellBtn ) return;

		const available = this.isDebugConsoleAvailable();
		this._debugShellBtn.disabled = ! available;
		this._debugShellBtn.setAttribute( 'aria-disabled', available ? 'false' : 'true' );
		this._debugShellBtn.title = available ? 'Open debug controls' : 'Debug controls unavailable';

	}

	// ---------------------------------------------------------------------------
	// Tab panels
	// ---------------------------------------------------------------------------

	/**
	 * Create tab panel container divs inside the page container.
	 *
	 * @param {HTMLElement} container
	 */
	_createTabPanels( container ) {

		for ( const tab of TAB_DEFS ) {

			const panel = document.createElement( 'div' );
			panel.className = 'kk-panel';
			panel.id = `kk-panel-${tab.id}`;
			panel.setAttribute( 'role', 'tabpanel' );
			panel.setAttribute( 'aria-labelledby', `kk-tab-${tab.id}` );
			panel.setAttribute( 'tabindex', '0' );
			panel.dataset.panel = tab.id;

			if ( tab.id === this._activeTab ) {

				panel.classList.add( 'kk-panel--active' );

			}

			container.appendChild( panel );
			this._panels.set( tab.id, panel );

		}

		const profilePanel = document.createElement( 'div' );
		profilePanel.className = 'kk-panel';
		profilePanel.id = 'kk-panel-profile';
		profilePanel.setAttribute( 'role', 'region' );
		profilePanel.setAttribute( 'aria-label', 'Profile' );
		profilePanel.setAttribute( 'tabindex', '0' );
		profilePanel.dataset.panel = 'profile';
		container.appendChild( profilePanel );
		this._panels.set( 'profile', profilePanel );

	}

	// ---------------------------------------------------------------------------
	// Tab switching
	// ---------------------------------------------------------------------------

	/**
	 * Switch to a tab by id. Hides all panels, shows the target, updates
	 * tab bar active state, render mode, and analytics.
	 *
	 * @param {string} name  Panel id: 'race' | 'character' | 'garage' | 'tracks' | 'profile' (profile has no tab)
	 */
	switchTab( name ) {

		if ( ! this._panels.has( name ) ) return;

		this._restoreTabPanels();
		this._setSettingsRouteActive( false );
		this._activeTab = name;
		this._routeFallbackTab = name;

		// Update panels: hide all, show target.
		for ( const [ id, panel ] of this._panels ) {

			if ( id === name ) {

				panel.classList.add( 'kk-panel--active' );

			} else {

				panel.classList.remove( 'kk-panel--active' );

			}

		}

		// Update tab bar buttons (profile uses the shell icon, not a tab).
		for ( const [ id, btn ] of this._tabButtons ) {

			const isActive = id === name;
			btn.setAttribute( 'aria-selected', isActive ? 'true' : 'false' );
			btn.setAttribute( 'tabindex', isActive ? '0' : '-1' );
			btn.classList.toggle( 'kk-tab-bar__btn--active', isActive );

		}

		if ( this._profileShellBtn ) {

			const onProfile = name === 'profile';
			this._profileShellBtn.classList.toggle( 'kk-shell-utility__icon-btn--active', onProfile );
			this._profileShellBtn.setAttribute( 'aria-current', onProfile ? 'page' : 'false' );

		}
		this._syncDebugShellButtonState();

		// Notify panel controllers of show/hide.
		if ( this._racePanel ) {

			if ( name === 'race' ) {

				this._racePanel.show();

			} else {

				this._racePanel.hide();

			}

		}

		if ( this._characterPanel ) {

			if ( name === 'character' ) {

				this._characterPanel.show();

			} else {

				this._characterPanel.hide();

			}

		}

		if ( this._garagePanel ) {

			if ( name === 'garage' ) {

				this._garagePanel.show();

			} else {

				this._garagePanel.hide();

			}

		}

		if ( this._tracksPanel ) {

			if ( name === 'tracks' ) {

				this._tracksPanel.show();

			} else {

				this._tracksPanel.hide();

			}

		}

		if ( this._profilePanel ) {

			if ( name === 'profile' ) {

				this._profilePanel.show();

			} else {

				this._profilePanel.hide();

			}

		}

		// Update render mode based on tab.
		const renderMode = TAB_RENDER_MODES[ name ] || 'lobby';
		this.setRenderMode( renderMode );

		// Sync garage preview kart when switching to RACE tab (legacy fallback).
		if ( name === 'race' && this._garagePreview ) {

			const settings = new Settings();
			this._garagePreview.setKart( settings.getSelectedKartId() );

		}

		// Sync selected vehicle into the lobby scene.
		if ( this._lobbyScene ) {

			const settings = new Settings();
			this._lobbyScene.setKart( settings.getSelectedKartId() );
			this._lobbyScene.setAppearance( settings.getPlayerAppearance() );
			this._lobbyScene.setPreviewPreset( TAB_MENU_PREVIEW_PRESETS[ name ] || 'play' );

		}

		// Analytics.
		this._analytics.trackPageView( name );

		// Screen reader announcement.
		this._announce( name === 'profile' ? 'Switched to profile' : `Switched to ${ name } tab` );

	}

	// ---------------------------------------------------------------------------
	// Service initialization
	// ---------------------------------------------------------------------------

	_initServices() {

		// ModalService and NotificationService need DOM refs.
		this._modal.initialize( this._shell );
		this._notification.initialize( this._toastRegion );

		// Analytics defaults (debug=true in non-production).
		this._analytics.initialize( {
			debug: this._config.analyticsDebug ?? true,
		} );

		// NavigationService root fallback — Title is the entry route.
		NavigationService.setRoot( RouteIds.TITLE );

		// RouterService render target.
		this._router.setContainer( this._pageContainer );

		// Catch-all fallback: unknown hashes land on RACE tab.
		this._router.setFallback( ( path ) => this._handleRouteFallback( path ) );

	}

	// ---------------------------------------------------------------------------
	// Route registration
	// ---------------------------------------------------------------------------

	/**
	 * Register all application routes.
	 * Each route maps a path to a factory function that returns a controller.
	 *
	 * Factories are lazy-imported so controller modules are only loaded when
	 * their route is first visited. The factory pattern also makes it easy for
	 * other agents to register additional routes by calling router.register()
	 * before AppShell.bootstrap().
	 *
	 * At this stage controllers are stubs (placeholder factories). Each will be
	 * replaced when the corresponding page agent delivers its controller/view pair.
	 */
	_registerRoutes() {

		const r = this._router;
		const s = this._services;

		// Helper: builds a placeholder controller until the real one is delivered.
		const placeholder = ( label ) => () => _makePlaceholderController( label, s );

		// ── ABSORBED into tabs/overlays (tab bar overhaul) ───────────────
		// TITLE → Tab bar handles initial load (switchTab('race') in bootstrap).
		// HOME → RacePanel, QUICK_PLAY → RacePanel, PLAY → RacePanel
		// LOBBY → LobbyOverlay, RESULTS → ResultsOverlay
		// CHARACTER → CharacterPanel, PROFILE → ProfilePanel, GARAGE → GaragePanel, KARTS → GaragePanel
		// TRACKS → TracksPanel
		// Page controllers remain in repo for reference.

		r.register( RouteIds.CHARACTERS, () => _makeTabAliasController( 'character', s ) );
		r.register( RouteIds.GARAGE, () => _makeTabAliasController( 'garage', s ) );
		r.register( RouteIds.KARTS, () => _makeTabAliasController( 'garage', s ) );

		r.register( RouteIds.PAUSE, async () => {

			const { Page22PauseController } = await import( '../pages/page22-pause/Page22PauseController.js' );
			return new Page22PauseController( {}, s );

		} );

		r.register( RouteIds.SETTINGS, async ( params ) => {

			const { Page21SettingsController } = await import( '../pages/page21-settings/Page21SettingsController.js' );
			return new Page21SettingsController( params, s );

		} );

		// ── CUT v1: Routes removed ───────────────────────────────────────
		// Party (06), Events (07), Ranked (08),
		// Challenges (13), Season (14), Shop (15), Editor (17),
		// Discover (18), Inbox (20), Tutorial (23)
		// Code remains in repo for future re-enablement.

	}

	// ---------------------------------------------------------------------------
	// Screen-reader announcer
	// ---------------------------------------------------------------------------

	/**
	 * Push a message to the aria-live announcer region.
	 * Screen readers will read this text on the next cycle.
	 *
	 * @param {string} message
	 */
	_announce( message ) {

		if ( ! this._announcer ) return;

		// Clear and re-set to force screen readers to re-announce even if the
		// message is the same as last time (e.g., navigating to same route).
		this._announcer.textContent = '';
		requestAnimationFrame( () => {

			this._announcer.textContent = message;

		} );

	}

	/**
	 * Expose the announce method to page controllers via the service bag.
	 * Called by controllers when selection state changes (e.g., card grid).
	 *
	 * @param {string} message
	 */
	announce( message ) {

		this._announce( message );

	}

	// ---------------------------------------------------------------------------
	// Settings route
	// ---------------------------------------------------------------------------

	/**
	 * Open settings as a fullscreen route while preserving the current tab.
	 *
	 * @param {{ fragment?: string, returnTab?: string } | string} [options]
	 */
	_openSettingsRoute( options = {} ) {

		const normalizedOptions = typeof options === 'string'
			? { fragment: options }
			: ( options || {} );
		const fragment = typeof normalizedOptions.fragment === 'string'
			? normalizedOptions.fragment.replace( /^#/, '' ).trim()
			: '';
		const returnTab = typeof normalizedOptions.returnTab === 'string' && normalizedOptions.returnTab
			? normalizedOptions.returnTab
			: this._activeTab;
		const targetRoute = fragment
			? `${RouteIds.SETTINGS}#${fragment}`
			: RouteIds.SETTINGS;

		this._routeFallbackTab = this._panels.has( returnTab ) ? returnTab : this._activeTab;
		this._router.navigate( targetRoute, {
			returnTab: this._routeFallbackTab,
			origin: 'menu-tab',
		} );

	}

	_closeSettingsRoute() {

		const nextState = this._navigation?.peekState?.() ?? null;
		if ( typeof nextState?.returnTab === 'string' && this._panels.has( nextState.returnTab ) ) {

			this._routeFallbackTab = nextState.returnTab;

		}

		if ( this._navigation?.canGoBack?.() ) {

			this._navigation.back();
			return;

		}

		this._router.replace( RouteIds.TITLE );

	}

	_setSettingsRouteActive( active ) {

		this._settingsRouteActive = !! active;
		this._shell?.classList.toggle( 'kk-app-shell--settings-route', this._settingsRouteActive );

	}

	_restoreTabPanels() {

		if ( ! this._pageContainer ) return;

		for ( const panel of this._panels.values() ) {

			if ( panel.parentNode !== this._pageContainer ) {

				this._pageContainer.appendChild( panel );

			}

		}

	}

	_handleRouteFallback( _path = RouteIds.TITLE ) {

		this._restoreTabPanels();
		this._setSettingsRouteActive( false );
		void _path;
		this.switchTab( this._routeFallbackTab || 'race' );

	}

	openDebugConsole() {

		if ( this._engine?.isRunning?.() && this._engine.openDebugMenu ) {

			this._engine.openDebugMenu();
			return true;

		}

		if ( this._debugPanelEl ) {

			this._debugPanelEl.style.display = 'flex';
			if ( this._debugToggleBtn ) this._debugToggleBtn.style.display = 'none';
			this._syncDebugShellButtonState();
			return true;

		}

		return false;

	}

	isDebugConsoleAvailable() {

		return !! ( this._debugPanelEl || this._engine?.isRunning?.() );

	}

	_setDebugVisibility( visible ) {

		if ( ! this._lobbyScene ) return;

		if ( ! visible && this._lobbyScene._debugPanel ) {

			this._lobbyScene._debugPanel.style.display = 'none';

		}

		if ( this._lobbyScene._debugToggleBtn ) this._lobbyScene._debugToggleBtn.style.display = 'none';
		this._syncDebugShellButtonState();

	}

	// ---------------------------------------------------------------------------
	// Render loop coordinator
	// ---------------------------------------------------------------------------

	/**
	 * Start the persistent rAF loop. This loop runs for the lifetime of the app.
	 * Menu-oriented modes are frame-paced so the background scene does not render
	 * as fast as the monitor can refresh.
	 * Depending on _renderMode, it delegates to the appropriate subsystem:
	 *   - 'race'  → engine.update()
	 *   - 'garage' → garagePreview.update()
	 *   - 'lobby' → lobbyScene.update()
	 *   - 'idle'  → no rendering (loop still ticks for mode transitions)
	 */
	_startRenderLoop() {

		this._lastFrameTime = performance.now();

		const tick = ( now ) => {

			this._rafId = requestAnimationFrame( tick );
			const intervalMs = getRenderIntervalMs( this._renderMode );

			if ( intervalMs > 0 && ( now - this._lastFrameTime ) < intervalMs ) {

				return;

			}

			const dt = Math.min( Math.max( ( now - this._lastFrameTime ) / 1000, 0 ), 0.25 );
			this._lastFrameTime = now;

			if ( this._renderMode === 'race' && this._engine ) {

				this._engine.update();

			} else if ( this._renderMode === 'garage' && this._garagePreview ) {

				this._garagePreview.update( dt );

			} else if ( this._renderMode === 'party-lobby' && this._partyLobbyScene ) {

				this._partyLobbyScene.update( dt );

			} else if ( this._renderMode === 'lobby' && this._lobbyScene ) {

				// Fall back to garage preview while lobby is loading.
				if ( this._lobbyScene.ready ) {

					this._lobbyScene.update( dt );

				} else if ( this._garagePreview ) {

					this._garagePreview.update( dt );

				}

			}

		};

		this._rafId = requestAnimationFrame( tick );

	}

	// ---------------------------------------------------------------------------
	// Render mode control
	// ---------------------------------------------------------------------------

	/**
	 * Switch the render loop to a different mode.
	 * Used by page controllers (e.g., Garage) to activate/deactivate 3D previews.
	 *
	 * @param {'idle' | 'race' | 'garage' | 'lobby' | 'party-lobby'} mode
	 */
	setRenderMode( mode ) {

		this._renderMode = mode;
		this._lastFrameTime = 0;

	}

	getRenderMode() {

		return this._renderMode;

	}

	setMenuPreviewFocus( presetId, options = {} ) {

		this._lobbyScene?.setPreviewPreset( presetId, options );

	}

	setMenuPreviewTuning( tuning, options = {} ) {

		this._lobbyScene?.setPreviewTuning( tuning, options );

	}

	resetMenuPreviewTuning( options = {} ) {

		this._lobbyScene?.resetPreviewTuning( options );

	}

	getMenuPreviewTuning() {

		return this._lobbyScene?.getPreviewTuning?.() ?? null;

	}

	getMenuPreviewPose() {

		return this._lobbyScene?.getResolvedPreviewPose?.() ?? null;

	}

	startDebugSoloRace( config = {} ) {

		const nextConfig = { ...config, mode: 'solo' };
		if ( typeof config.trackId === 'string' && config.trackId ) {

			const track = getTrackById( config.trackId );
			if ( track ) {

				nextConfig.trackData = track.cells;
				nextConfig.decoCells = track.decoCells;
				nextConfig.trackId = track.id;

			}

		}

		return this.startRace( nextConfig );

	}

	// ---------------------------------------------------------------------------
	// Party lobby 3D scene
	// ---------------------------------------------------------------------------

	/**
	 * Create and activate the 3D party lobby scene.
	 * @returns {import('../PartyLobbyScene.js').PartyLobbyScene}
	 */
	showPartyLobby() {

		if ( this._partyLobbyScene ) {

			this._partyLobbyScene.dispose();

		}

		const renderer = this._engine?.getRenderer();
		if ( ! renderer ) return null;

		this._partyLobbyScene = new PartyLobbyScene( renderer );
		this._renderMode = 'party-lobby';

		// Hide panels and tab bar so the 3D scene is fullscreen.
		// Keep the shell itself visible — LobbyOverlay mounts into it.
		if ( this._pageContainer ) this._pageContainer.style.display = 'none';
		if ( this._tabBarEl ) this._tabBarEl.style.display = 'none';

		return this._partyLobbyScene;

	}

	/**
	 * Dispose the 3D party lobby scene and restore menu UI.
	 */
	hidePartyLobby() {

		if ( this._partyLobbyScene ) {

			this._partyLobbyScene.dispose();
			this._partyLobbyScene = null;

		}

		if ( this._renderMode === 'party-lobby' ) {

			this._renderMode = 'lobby';

		}

		// Restore panels and tab bar
		if ( this._pageContainer ) this._pageContainer.style.display = '';
		if ( this._tabBarEl ) this._tabBarEl.style.display = '';

	}

	// ---------------------------------------------------------------------------
	// Race lifecycle
	// ---------------------------------------------------------------------------

	_getOrCreateRaceLoadingOverlay() {

		if ( this._raceLoadingOverlay ) return this._raceLoadingOverlay;

		this._raceLoadingOverlay = new LoadingOverlay( {
			message: 'Preparing race',
			detail: 'Staging the next grid',
			phase: 'Initializing',
		} );

		return this._raceLoadingOverlay;

	}

	_showRaceLoadingOverlay( initialState = {} ) {

		const overlay = this._getOrCreateRaceLoadingOverlay();
		overlay.setState( {
			phase: 'Initializing',
			message: 'Preparing race',
			detail: 'Staging the next grid',
			progress: 0.02,
			determinate: false,
			progressText: '...',
			...initialState,
		} );
		overlay.show();
		return overlay;

	}

	/**
	 * Start a race. Hides the menu UI, starts the GameEngine.
	 *
	 * @param {object} config - Race configuration passed to engine.start()
	 * @returns {Promise<void>}
	 */
	async startRace( config ) {

		if ( ! this._engine ) {

			this._notification.show( { message: 'Game engine not available.', variant: 'error' } );
			return;

		}

		const loadingOverlay = this._showRaceLoadingOverlay();

		try {

			this._deactivateMenuMusic();

			// Hide the menu shell so the 3D canvas is fullscreen.
			if ( this._shell ) {

				this._shell.style.display = 'none';

			}

			// Hide tab bar independently (restored in endRace).
			if ( this._tabBarEl ) {

				this._tabBarEl.style.display = 'none';

			}

			this._setDebugVisibility( false );

			await this._engine.start( {
				...config,
				onLoadingProgress: ( nextState ) => {

					loadingOverlay.setState( nextState );

				},
			} );
			loadingOverlay.setState( {
				phase: 'Ready',
				message: 'Race Ready',
				detail: 'Dropping into the track',
				progress: 1,
				determinate: true,
				progressText: '100%',
			} );
			loadingOverlay.hide();
			this._renderMode = 'race';

		} catch ( err ) {

			console.error( '[AppShell] startRace failed:', err );

			// Restore menu UI on failure.
			if ( this._shell ) {

				this._shell.style.display = '';

			}

			if ( this._tabBarEl ) {

				this._tabBarEl.style.display = '';

			}

			this._setDebugVisibility( true );
			this._renderMode = 'idle';
			loadingOverlay.hide();
			void this._activateMenuMusic();
			this._notification.show( {
				message: 'Failed to start race: ' + ( err.message || 'Unknown error' ),
				variant: 'error',
			} );

		}

	}

	/**
	 * End the current race. Stops the GameEngine, restores the menu shell,
	 * and shows the ResultsOverlay. Tab bar stays hidden during results (R17b).
	 *
	 * @param {object} [results] - Race results data (position, times, mode).
	 */
	endRace( results ) {

		if ( this._engine ) {

			this._engine.stop();

		}

		this._renderMode = 'idle';

		// Restore the menu shell (but NOT the tab bar -- R17b keeps it hidden).
		if ( this._shell ) {

			this._shell.style.display = '';

		}

		// Clean up any prior results overlay.
		if ( this._resultsOverlay ) {

			this._resultsOverlay.dispose();
			this._resultsOverlay = null;

		}

		// Create and show ResultsOverlay.
		const overlay = new ResultsOverlay( this._shell, this._services, results || {} );

		overlay.onQuit = () => {

			overlay.dispose();
			this._resultsOverlay = null;

			// Restore tab bar and switch to RACE tab.
			if ( this._tabBarEl ) {

				this._tabBarEl.style.display = '';

			}

			this._setDebugVisibility( true );
			this.switchTab( 'race' );

		};

		overlay.onRaceAgainPrivate = () => {

			overlay.dispose();
			this._resultsOverlay = null;

			// Restore tab bar for lobby overlay (R17c: tab bar clickable under lobby).
			if ( this._tabBarEl ) {

				this._tabBarEl.style.display = '';

			}

			this._setDebugVisibility( true );
			// Return to RACE tab and trigger private lobby flow via RacePanel.
			this.switchTab( 'race' );

		};

		this._resultsOverlay = overlay;
		overlay.show();
		void this._activateMenuMusic();

	}

	async _activateMenuMusic() {

		if ( ! this._menuMusic ) return false;
		return this._menuMusic.activate();

	}

	_deactivateMenuMusic() {

		this._menuMusic?.deactivate();

	}

}

// ---------------------------------------------------------------------------
// Placeholder controller factory
// ---------------------------------------------------------------------------

/**
 * Returns a minimal PageControllerBase-compatible object that renders a
 * labelled placeholder tile. This is swapped out when the real controller
 * is delivered by the page agent.
 *
 * It does NOT extend PageControllerBase to avoid a circular import chain;
 * it satisfies the duck-typed interface RouterService requires.
 *
 * @param {string}   label
 * @param {Services} services
 * @returns {object}
 */
function _makePlaceholderController( label, services ) {

	return {

		initialize() {},

		bindEvents() {},

		loadData() { return Promise.resolve(); },

		render( container ) {

			container.innerHTML = '';

			const el = document.createElement( 'div' );
			el.className = 'kk-page kk-page--placeholder kk-ui-placeholder kk-ui-placeholder--muted';
			el.setAttribute( 'role', 'main' );

			const inner = document.createElement( 'div' );
			inner.className = 'kk-ui-placeholder__inner';

			const title = document.createElement( 'p' );
			title.className = 'kk-ui-placeholder__title';
			title.textContent = label.toUpperCase();
			inner.appendChild( title );

			const sub = document.createElement( 'p' );
			sub.className = 'kk-ui-placeholder__copy';
			sub.textContent = 'Page controller not yet registered.';
			inner.appendChild( sub );

			el.appendChild( inner );
			container.appendChild( el );

		},

		dispose() {},

	};

}

function _makeTabAliasController( tabId, services ) {

	return {

		initialize() {},

		bindEvents() {},

		loadData() { return Promise.resolve(); },

		render() {

			services.switchTab?.( tabId );

		},

		dispose() {},

	};

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} AppShellConfig
 * @property {boolean}     [analyticsDebug]    Log analytics events to console. Default true.
 * @property {HTMLElement} [canvasContainer]    DOM element for the 3D canvas (defaults to #canvas-container).
 */

/**
 * @typedef {object} Services
 * @property {RouterService}            router
 * @property {typeof NavigationService} navigation
 * @property {ModalService}             modal
 * @property {NotificationService}      notification
 * @property {AnalyticsService}         analytics
 * @property {object}                   [engine]      GameEngine instance (after bootstrap).
 * @property {MenuMusicPlayer | null}   [menuMusic]   Shared menu music service instance (after bootstrap).
 * @property {Function}                 startRace     Start a race — hides menu, calls engine.start(config).
 * @property {Function}                 endRace       End the race — calls engine.stop(), restores menu, navigates to Results.
 * @property {Function}                 [openSettings]
 * @property {Function}                 [closeSettings]
 * @property {Function}                 [getRenderMode]
 * @property {Function}                 [setSettingsRouteActive]
 */
