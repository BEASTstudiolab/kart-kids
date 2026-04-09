/**
 * AppShell — top-level UI orchestrator.
 *
 * Responsibilities:
 *   - Create the shell DOM: bottom tab bar, route-announcement region,
 *     page container with 4 tab panels, toast region.
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
 *   - Bottom tab bar (RACE, GARAGE, CREATE, PROFILE) replaces the old TopNav.
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
 *       <div class="kk-panel" data-panel="garage"></div>
 *       <div class="kk-panel" data-panel="create"></div>
 *       <div class="kk-panel" data-panel="profile"></div>
 *     </main>
 *     <nav class="kk-tab-bar" role="tablist" aria-label="Main navigation">
 *       <button role="tab" ...>RACE</button>
 *       ...
 *     </nav>
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
import { GaragePreview }      from '../GaragePreview.js';
import { Settings }           from '../../Settings.js';
import { showNameEntryModal } from '../components/NameEntryModal.js';
import { RacePanel }         from '../panels/RacePanel.js';
import { ProfilePanel }      from '../panels/ProfilePanel.js';
import { GaragePanel }       from '../panels/GaragePanel.js';
import { ResultsOverlay }    from '../overlays/ResultsOverlay.js';

// Tab definitions — order matches the tab bar left-to-right.
const TAB_DEFS = [
	{ id: 'race',    label: 'RACE' },
	{ id: 'garage',  label: 'GARAGE' },
	{ id: 'create',  label: 'CREATE' },
	{ id: 'profile', label: 'PROFILE' },
];

// Render mode per tab — RACE and GARAGE show the kart turntable.
const TAB_RENDER_MODES = {
	race:    'garage',
	garage:  'garage',
	create:  'idle',
	profile: 'idle',
};

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
			setRenderMode:  ( mode ) => this.setRenderMode( mode ),
			garagePreview:  null,  // populated in bootstrap() after engine creation
			selectedMode:   'solo',
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
		 * 'garage'  — GaragePreview.update() called each frame (Unit 5)
		 * @type {'idle' | 'race' | 'garage'}
		 */
		this._renderMode = 'idle';

		/** @type {number | null} rAF handle for cancellation */
		this._rafId = null;

		/** @type {number} previous frame timestamp for dt calculation */
		this._lastFrameTime = 0;

		/** @type {object | null} garage preview renderer (Unit 5 placeholder) */
		this._garagePreview = null;

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

		// -----------------------------------------------------------------------
		// Tab panel state
		// -----------------------------------------------------------------------

		/** @type {Map<string, HTMLElement>} tab id → panel div */
		this._panels = new Map();

		/** @type {Map<string, HTMLElement>} tab id → tab button */
		this._tabButtons = new Map();

		/** @type {string} currently active tab id */
		this._activeTab = 'race';

		// -----------------------------------------------------------------------
		// Tab panel controllers (created in bootstrap)
		// -----------------------------------------------------------------------

		/** @type {import('../panels/RacePanel.js').RacePanel | null} */
		this._racePanel = null;

		/** @type {import('../panels/ProfilePanel.js').ProfilePanel | null} */
		this._profilePanel = null;

		/** @type {import('../panels/GaragePanel.js').GaragePanel | null} */
		this._garagePanel = null;

		/** @type {import('../overlays/ResultsOverlay.js').ResultsOverlay | null} */
		this._resultsOverlay = null;

	}

	// ---------------------------------------------------------------------------
	// Bootstrap
	// ---------------------------------------------------------------------------

	/**
	 * Build the shell DOM, initialize services, register routes, and start routing.
	 * This is the single entry point called by main.js / the game page.
	 */
	bootstrap() {

		this._buildShell();
		this._initServices();

		// Mount RacePanel into the RACE tab container.
		const raceContainer = this._panels.get( 'race' );
		if ( raceContainer ) {

			this._racePanel = new RacePanel( raceContainer, this._services );

		}

		// Mount GaragePanel into the GARAGE tab container.
		const garageContainer = this._panels.get( 'garage' );
		if ( garageContainer ) {

			this._garagePanel = new GaragePanel( garageContainer, this._services );

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

			// Create GaragePreview sharing the renderer from GameEngine.
			const renderer = this._engine.getRenderer();
			this._garagePreview = new GaragePreview( renderer );
			this._services.garagePreview = this._garagePreview;

		}

		this._registerRoutes();

		// RouterService render target — used for overlay routes (Pause, Results).
		this._router.setContainer( this._pageContainer );

		// Start the persistent render loop coordinator.
		this._startRenderLoop();

		// Title skip for returning players: skip router dispatch, go straight
		// to RACE tab. First-run players see NameEntryModal then RACE tab.
		const settings = new Settings();

		if ( settings.isFirstRun() ) {

			// First run: show name modal, then land on RACE tab.
			this._router.start();
			this._handleFirstRun( settings );

		} else {

			// Returning player: skip title, go straight to RACE tab.
			// Start the router but suppress initial dispatch by starting
			// after we've already switched to the RACE tab.
			this.switchTab( 'race' );
			this._router.start();

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

		// Create the 4 tab panels inside the page container.
		this._createTabPanels( pageContainer );

		// Bottom tab bar.
		const tabBarEl = this._createTabBar();
		shell.appendChild( tabBarEl );
		this._tabBarEl = tabBarEl;

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

	}

	// ---------------------------------------------------------------------------
	// Tab bar
	// ---------------------------------------------------------------------------

	/**
	 * Create the bottom tab bar with RACE, GARAGE, CREATE, PROFILE buttons.
	 *
	 * @returns {HTMLElement}
	 */
	_createTabBar() {

		const nav = document.createElement( 'nav' );
		nav.className = 'kk-tab-bar';
		nav.setAttribute( 'role', 'tablist' );
		nav.setAttribute( 'aria-label', 'Main navigation' );

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

			nav.appendChild( btn );
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

		return nav;

	}

	// ---------------------------------------------------------------------------
	// Tab panels
	// ---------------------------------------------------------------------------

	/**
	 * Create 4 panel container divs inside the page container.
	 * CreatePanel content is built inline — a static card with an editor link.
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

		// Build CreatePanel content inline — editor launch card.
		this._buildCreatePanelContent();

	}

	/**
	 * Build the CREATE panel content inline: a card with description and
	 * LAUNCH EDITOR button that opens editor.html in a new tab.
	 */
	_buildCreatePanelContent() {

		const panel = this._panels.get( 'create' );
		if ( ! panel ) return;

		const card = document.createElement( 'div' );
		card.className = 'kk-page';
		card.style.cssText = 'max-width:32rem;margin:2rem auto;padding:2rem;text-align:center;border-radius:var(--radius-md);';

		const title = document.createElement( 'h2' );
		title.className = 'kk-text-display';
		title.style.cssText = 'font-size:var(--text-2xl);margin-bottom:var(--space-4);';
		title.textContent = 'TRACK EDITOR';
		card.appendChild( title );

		const desc = document.createElement( 'p' );
		desc.style.cssText = 'color:var(--color-ink-300);margin-bottom:var(--space-6);line-height:var(--leading-relaxed);';
		desc.textContent = 'Design custom tracks with the drag-and-drop editor. Place straights, corners, ramps, and more to build your dream circuit.';
		card.appendChild( desc );

		const btn = document.createElement( 'a' );
		btn.href = 'editor.html';
		btn.target = '_blank';
		btn.rel = 'noopener';
		btn.className = 'kk-tab-bar__editor-btn';
		btn.style.cssText = [
			'display:inline-block',
			'padding:var(--space-3) var(--space-8)',
			'background:var(--color-cta-primary)',
			'color:var(--color-cta-primary-text)',
			'font-family:var(--font-ui)',
			'font-weight:var(--weight-bold)',
			'font-size:var(--text-md)',
			'text-transform:uppercase',
			'letter-spacing:var(--tracking-wider)',
			'text-decoration:none',
			'border-radius:var(--radius-md)',
			'cursor:pointer',
			'transition:background var(--duration-normal) var(--ease-standard)',
		].join( ';' );
		btn.textContent = 'LAUNCH EDITOR';
		card.appendChild( btn );

		panel.appendChild( card );

	}

	// ---------------------------------------------------------------------------
	// Tab switching
	// ---------------------------------------------------------------------------

	/**
	 * Switch to a tab by id. Hides all panels, shows the target, updates
	 * tab bar active state, render mode, and analytics.
	 *
	 * @param {string} name  Tab id: 'race' | 'garage' | 'create' | 'profile'
	 */
	switchTab( name ) {

		if ( ! this._panels.has( name ) ) return;

		this._activeTab = name;

		// Update panels: hide all, show target.
		for ( const [ id, panel ] of this._panels ) {

			if ( id === name ) {

				panel.classList.add( 'kk-panel--active' );

			} else {

				panel.classList.remove( 'kk-panel--active' );

			}

		}

		// Update tab bar buttons.
		for ( const [ id, btn ] of this._tabButtons ) {

			const isActive = id === name;
			btn.setAttribute( 'aria-selected', isActive ? 'true' : 'false' );
			btn.setAttribute( 'tabindex', isActive ? '0' : '-1' );
			btn.classList.toggle( 'kk-tab-bar__btn--active', isActive );

		}

		// Notify panel controllers of show/hide.
		if ( this._racePanel ) {

			if ( name === 'race' ) {

				this._racePanel.show();

			} else {

				this._racePanel.hide();

			}

		}

		if ( this._garagePanel ) {

			if ( name === 'garage' ) {

				this._garagePanel.show();

			} else {

				this._garagePanel.hide();

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
		const renderMode = TAB_RENDER_MODES[ name ] || 'idle';
		this.setRenderMode( renderMode );

		// Sync garage preview kart when switching to RACE tab.
		if ( name === 'race' && this._garagePreview ) {

			const settings = new Settings();
			this._garagePreview.setKart( settings.getSelectedKartId() );

		}

		// Analytics.
		this._analytics.trackPageView( name );

		// Screen reader announcement.
		this._announce( `Switched to ${name} tab` );

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
		this._router.setFallback( () => this.switchTab( 'race' ) );

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

		// ── M2: Race Flow (real controllers, lazy-imported) ──────────────

		r.register( RouteIds.TITLE, async () => {

			const { Page01TitleController } = await import( '../pages/page01-title/Page01TitleController.js' );
			return new Page01TitleController( s );

		} );

		// ── ABSORBED into tabs/overlays (tab bar overhaul) ───────────────
		// HOME → RacePanel, QUICK_PLAY → RacePanel, PLAY → RacePanel
		// LOBBY → LobbyOverlay, RESULTS → ResultsOverlay
		// PROFILE → ProfilePanel, GARAGE → GaragePanel, KARTS → GaragePanel
		// CREATE → CreatePanel (inline in AppShell)
		// Page controllers remain in repo for reference.

		r.register( RouteIds.PAUSE, async () => {

			const { Page22PauseController } = await import( '../pages/page22-pause/Page22PauseController.js' );
			return new Page22PauseController( s );

		} );

		r.register( RouteIds.SETTINGS, async () => {

			const { Page21SettingsController } = await import( '../pages/page21-settings/Page21SettingsController.js' );
			return new Page21SettingsController( s );

		} );

		// ── CUT v1: Routes removed ───────────────────────────────────────
		// Party (06), Events (07), Ranked (08), Characters (10),
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
	// Render loop coordinator
	// ---------------------------------------------------------------------------

	/**
	 * Start the persistent rAF loop. This loop runs for the lifetime of the app.
	 * Depending on _renderMode, it delegates to the appropriate subsystem:
	 *   - 'race'  → engine.update()
	 *   - 'garage' → garagePreview.update() (Unit 5)
	 *   - 'idle'  → no rendering (loop still ticks for mode transitions)
	 */
	_startRenderLoop() {

		this._lastFrameTime = performance.now();

		const tick = ( now ) => {

			this._rafId = requestAnimationFrame( tick );

			if ( this._renderMode === 'race' && this._engine ) {

				this._engine.update();

			} else if ( this._renderMode === 'garage' && this._garagePreview ) {

				const dt = ( now - this._lastFrameTime ) / 1000;
				this._garagePreview.update( dt );

			}

			this._lastFrameTime = now;

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
	 * @param {'idle' | 'race' | 'garage'} mode
	 */
	setRenderMode( mode ) {

		this._renderMode = mode;

	}

	// ---------------------------------------------------------------------------
	// Race lifecycle
	// ---------------------------------------------------------------------------

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

		try {

			// Hide the menu shell so the 3D canvas is fullscreen.
			if ( this._shell ) {

				this._shell.style.display = 'none';

			}

			// Hide tab bar independently (restored in endRace).
			if ( this._tabBarEl ) {

				this._tabBarEl.style.display = 'none';

			}

			await this._engine.start( config );
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

			this._renderMode = 'idle';
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

			this.switchTab( 'race' );

		};

		overlay.onRaceAgainPrivate = () => {

			overlay.dispose();
			this._resultsOverlay = null;

			// Restore tab bar for lobby overlay (R17c: tab bar clickable under lobby).
			if ( this._tabBarEl ) {

				this._tabBarEl.style.display = '';

			}

			// Return to RACE tab and trigger private lobby flow via RacePanel.
			this.switchTab( 'race' );

		};

		this._resultsOverlay = overlay;
		overlay.show();

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
			el.className = 'kk-page kk-page--placeholder';
			el.setAttribute( 'role', 'main' );
			el.style.cssText = [
				'display:flex',
				'align-items:center',
				'justify-content:center',
				'min-height:60vh',
				'padding:2rem',
			].join( ';' );

			const inner = document.createElement( 'div' );
			inner.style.cssText = 'text-align:center;opacity:0.5;';

			const title = document.createElement( 'p' );
			title.style.cssText = 'font-size:1.5rem;font-weight:700;letter-spacing:0.1em;';
			title.textContent = label.toUpperCase();
			inner.appendChild( title );

			const sub = document.createElement( 'p' );
			sub.style.cssText = 'font-size:0.85rem;margin-top:0.5rem;';
			sub.textContent = 'Page controller not yet registered.';
			inner.appendChild( sub );

			el.appendChild( inner );
			container.appendChild( el );

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
 * @property {Function}                 startRace     Start a race — hides menu, calls engine.start(config).
 * @property {Function}                 endRace       End the race — calls engine.stop(), restores menu, navigates to Results.
 */
