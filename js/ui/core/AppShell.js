/**
 * AppShell — top-level UI orchestrator.
 *
 * Responsibilities:
 *   - Create the shell DOM: top-nav placeholder, route-announcement region,
 *     page container, toast region.
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
 *   - TopNav is wired as a placeholder `<nav>` element. When the TopNav
 *     component is delivered by another agent, replace _createTopNav() with
 *     the real component constructor.
 *   - Pages that do NOT show the TopNav (Title Screen `/` and Pause `/pause`)
 *     are listed in TOPNAV_HIDDEN_ROUTES.
 *   - Z-index layers match COMPONENT_SPEC.md global conventions:
 *       base=0, panel=10, topnav=100, modal=500, toast=600.
 *
 * Shell DOM structure:
 *
 *   <div id="kk-app-shell">
 *     <div aria-live="polite" aria-atomic="true" class="kk-sr-announcer"></div>
 *     <nav class="kk-top-nav kk-top-nav--placeholder">  <!-- placeholder --></nav>
 *     <main class="kk-page-container" id="kk-page-container"></main>
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

// Routes where the TopNav is hidden (Title Screen, Pause overlay, and Results).
// Results is a post-race cinematic screen that occupies the full viewport.
const TOPNAV_HIDDEN_ROUTES = new Set( [ RouteIds.TITLE, RouteIds.PAUSE, RouteIds.RESULTS ] );

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
		this._topNavEl = null;

		/** @type {HTMLElement | null} */
		this._pageContainer = null;

		/** @type {HTMLElement | null} */
		this._toastRegion = null;

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
		this._router.start();

		// Announce the initial route load for screen readers.
		this._router.setContainer( this._pageContainer );

		// Track initial page view.
		const initialRoute = window.location.hash.slice( 1 ) || RouteIds.TITLE;
		this._analytics.trackPageView( initialRoute );

		// Keep TopNav visibility in sync with route changes.
		window.addEventListener( 'hashchange', () => this._syncTopNavVisibility() );
		this._syncTopNavVisibility();

		// Start the persistent render loop coordinator.
		this._startRenderLoop();

		// First-run name entry modal — show before user navigates.
		this._checkFirstRun();

	}

	// ---------------------------------------------------------------------------
	// First-run check
	// ---------------------------------------------------------------------------

	/**
	 * If this is the user's first visit (no display name saved), show the
	 * NameEntryModal via ModalService. The modal is non-dismissible and
	 * saves the name + avatar choice to Settings on confirmation.
	 */
	async _checkFirstRun() {

		const settings = new Settings();

		if ( ! settings.isFirstRun() ) return;

		await showNameEntryModal( this._modal, settings );

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

		// Top navigation placeholder.
		// TODO: Replace _createTopNav() with real TopNav component when available.
		const topNavEl = this._createTopNav();
		shell.appendChild( topNavEl );
		this._topNavEl = topNavEl;

		// Primary page render target.
		const pageContainer = document.createElement( 'main' );
		pageContainer.className = 'kk-page-container';
		pageContainer.id = 'kk-page-container';
		// Accessible: main landmark so screen readers can skip to content.
		shell.appendChild( pageContainer );
		this._pageContainer = pageContainer;

		// Toast notification region — singleton, lives above ActionBar, below modal.
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
	// Top-nav placeholder
	// ---------------------------------------------------------------------------

	/**
	 * Create a minimal placeholder <nav> element.
	 * This is replaced when the TopNav component is delivered by another agent.
	 *
	 * The placeholder uses the same class names and aria attributes so CSS
	 * and acceptance tests can target it without modification when the real
	 * TopNav is wired in.
	 *
	 * @returns {HTMLElement}
	 */
	_createTopNav() {

		const nav = document.createElement( 'nav' );
		nav.className = 'kk-top-nav kk-top-nav--placeholder';
		nav.setAttribute( 'role', 'navigation' );
		nav.setAttribute( 'aria-label', 'Main navigation' );

		const brand = document.createElement( 'div' );
		brand.className = 'kk-top-nav__brand';

		const wordmark = document.createElement( 'span' );
		wordmark.className = 'kk-top-nav__wordmark';
		wordmark.setAttribute( 'aria-hidden', 'true' );
		wordmark.textContent = 'KART KIDS';
		brand.appendChild( wordmark );
		nav.appendChild( brand );

		// Primary nav links — wired to routes.
		const navItems = [
			{ label: 'PLAY MODES', route: RouteIds.PLAY },
			{ label: 'GARAGE',     route: RouteIds.GARAGE },
			{ label: 'CREATE',     route: RouteIds.CREATE },
			{ label: 'PROFILE',    route: RouteIds.PROFILE },
		];

		const list = document.createElement( 'ul' );
		list.className = 'kk-top-nav__list';
		list.setAttribute( 'role', 'list' );

		for ( const item of navItems ) {

			const li = document.createElement( 'li' );
			li.className = 'kk-top-nav__item';
			li.setAttribute( 'role', 'listitem' );

			const btn = document.createElement( 'button' );
			btn.className = 'kk-top-nav__link';
			btn.type = 'button';
			btn.setAttribute( 'data-route', item.route );
			btn.setAttribute( 'aria-current', 'false' );

			const label = document.createElement( 'span' );
			label.className = 'kk-top-nav__link-label';
			label.textContent = item.label;
			btn.appendChild( label );

			btn.addEventListener( 'click', () => {

				this._navigation.push( item.route );

			} );

			li.appendChild( btn );
			list.appendChild( li );

		}

		// Arrow key navigation within the nav list (per COMPONENT_SPEC.md §1).
		list.addEventListener( 'keydown', ( e ) => {

			const btns = Array.from( list.querySelectorAll( '.kk-top-nav__link:not([aria-disabled="true"])' ) );
			const idx  = btns.indexOf( document.activeElement );
			if ( idx === - 1 ) return;

			if ( e.key === 'ArrowRight' ) {

				e.preventDefault();
				btns[ ( idx + 1 ) % btns.length ].focus();

			} else if ( e.key === 'ArrowLeft' ) {

				e.preventDefault();
				btns[ ( idx - 1 + btns.length ) % btns.length ].focus();

			}

		} );

		nav.appendChild( list );

		// Utility zone placeholder.
		const utility = document.createElement( 'div' );
		utility.className = 'kk-top-nav__utility';
		nav.appendChild( utility );

		// Update active route indicator on hash change.
		window.addEventListener( 'hashchange', () => this._updateTopNavActiveRoute( list ) );

		return nav;

	}

	/**
	 * Update aria-current on nav links to reflect the current route.
	 *
	 * @param {HTMLElement} list
	 */
	_updateTopNavActiveRoute( list ) {

		const current = window.location.hash.slice( 1 ) || RouteIds.TITLE;

		list.querySelectorAll( '.kk-top-nav__link' ).forEach( btn => {

			const isActive = btn.dataset.route === current;
			btn.setAttribute( 'aria-current', isActive ? 'page' : 'false' );
			btn.classList.toggle( 'kk-top-nav__link--selected', isActive );

		} );

	}

	/**
	 * Show or hide the top nav depending on the current route.
	 * Title Screen and Pause have no top nav.
	 */
	_syncTopNavVisibility() {

		if ( ! this._topNavEl ) return;

		const current = window.location.hash.slice( 1 ) || RouteIds.TITLE;
		const hidden  = TOPNAV_HIDDEN_ROUTES.has( current );

		this._topNavEl.hidden = hidden;
		this._topNavEl.setAttribute( 'aria-hidden', String( hidden ) );

		// Announce route changes to screen readers.
		this._announce( `Navigated to ${current}` );

		// Track page view.
		this._analytics.trackPageView( current );

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

		// NavigationService root fallback.
		NavigationService.setRoot( RouteIds.HOME );

		// RouterService render target.
		this._router.setContainer( this._pageContainer );
		this._router.setFallback( RouteIds.TITLE );

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

		r.register( RouteIds.HOME, async () => {

			const { Page02HomeController } = await import( '../pages/page02-home/Page02HomeController.js' );
			return new Page02HomeController( s );

		} );

		r.register( RouteIds.QUICK_PLAY, async () => {

			const { Page03QuickPlayController } = await import( '../pages/page03-quick-play/Page03QuickPlayController.js' );
			return new Page03QuickPlayController( s );

		} );

		r.register( RouteIds.PLAY, async () => {

			const { Page04PlayModesController } = await import( '../pages/page04-play-modes/Page04PlayModesController.js' );
			return new Page04PlayModesController( s );

		} );

		r.register( RouteIds.LOBBY, async () => {

			const { Page05LobbyController } = await import( '../pages/page05-lobby/Page05LobbyController.js' );
			return new Page05LobbyController( s );

		} );

		r.register( RouteIds.RESULTS, async () => {

			const { Page19ResultsController } = await import( '../pages/page19-results/Page19ResultsController.js' );
			return new Page19ResultsController( s );

		} );

		r.register( RouteIds.PAUSE, async () => {

			const { Page22PauseController } = await import( '../pages/page22-pause/Page22PauseController.js' );
			return new Page22PauseController( s );

		} );

		// ── M3: Profile ─────────────────────────────────────────────────

		r.register( RouteIds.PROFILE, async () => {

			const { Page12ProfileController } = await import( '../pages/page12-profile/Page12ProfileController.js' );
			return new Page12ProfileController( s );

		} );

		// ── M4: Customization ────────────────────────────────────────────

		r.register( RouteIds.GARAGE, async () => {

			const { Page09GarageController } = await import( '../pages/page09-garage/Page09GarageController.js' );
			return new Page09GarageController( {}, s );

		} );

		r.register( RouteIds.KARTS, async () => {

			const { Page11KartSelectController } = await import( '../pages/page11-kart-select/Page11KartSelectController.js' );
			return new Page11KartSelectController( {}, s );

		} );

		// ── M5: Creation ─────────────────────────────────────────────────

		r.register( RouteIds.CREATE, async () => {

			const { Page16CreateHubController } = await import( '../pages/page16-create-hub/Page16CreateHubController.js' );
			return new Page16CreateHubController( s );

		} );

		// ── M6: Support ──────────────────────────────────────────────────

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

			await this._engine.start( config );
			this._renderMode = 'race';

		} catch ( err ) {

			console.error( '[AppShell] startRace failed:', err );

			// Restore menu UI on failure.
			if ( this._shell ) {

				this._shell.style.display = '';

			}

			this._renderMode = 'idle';
			this._notification.show( {
				message: 'Failed to start race: ' + ( err.message || 'Unknown error' ),
				variant: 'error',
			} );

		}

	}

	/**
	 * End the current race. Stops the GameEngine, restores the menu UI,
	 * and navigates to the Results page with race data.
	 *
	 * @param {object} [results] - Race results data to pass to the Results page.
	 */
	endRace( results ) {

		if ( this._engine ) {

			this._engine.stop();

		}

		this._renderMode = 'idle';

		// Restore the menu shell.
		if ( this._shell ) {

			this._shell.style.display = '';

		}

		// Navigate to Results with race data (stash in a shared location for the controller).
		this._services._lastRaceResults = results || {};
		this._navigation.push( RouteIds.RESULTS );

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
