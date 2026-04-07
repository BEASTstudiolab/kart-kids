/**
 * PageControllerBase — abstract base class for all page controllers.
 *
 * Responsibilities:
 *   - Declare the page controller lifecycle contract.
 *   - Provide shared service access (router, navigation, modal, notification, analytics).
 *   - Own a PageViewBase instance and delegate render/dispose to it.
 *   - Provide a typed event binding helper that auto-cleans up on dispose().
 *
 * Lifecycle (called by RouterService in sequence):
 *
 *   1. constructor(params, services)  — synchronous; set initial state
 *   2. initialize(params)            — synchronous; set params, prepare view
 *   3. bindEvents()                  — synchronous; wire view event listeners
 *   4. loadData()                    — async; fetch/mock data; resolves before render
 *   5. render(container)             — synchronous; mount view into container
 *   6. dispose()                     — synchronous; clean up listeners, timers, refs
 *
 * Subclass contract:
 *   - Override initialize(), bindEvents(), loadData(), render(), dispose().
 *   - Call super.dispose() at the end of overriding dispose() implementations.
 *   - Do NOT call render() manually; RouterService calls it after loadData() resolves.
 *   - Do NOT store references to DOM nodes across dispose().
 *
 * Architecture decisions:
 *   - Abstract base via runtime guard — JS has no compile-time abstract classes.
 *   - Services are injected via the constructor, not imported as singletons,
 *     so controllers remain unit-testable without DOM setup.
 *   - _listeners array is managed by _addListener() helper so dispose()
 *     can remove all of them in one sweep.
 */

export class PageControllerBase {

	/**
	 * @param {object}   [params]    Route params passed by RouterService.
	 * @param {Services} [services]  Injected service bag from AppShell.
	 */
	constructor( params = {}, services = {} ) {

		if ( new.target === PageControllerBase ) {

			throw new Error( 'PageControllerBase is abstract and cannot be instantiated directly.' );

		}

		/** @type {object} */
		this._params = params;

		/** @type {Services} */
		this._services = services;

		/** @type {import('./RouterService.js').RouterService | null} */
		this._router = services.router ?? null;

		/** @type {import('./NavigationService.js').NavigationService | null} */
		this._navigation = services.navigation ?? null;

		/** @type {import('./ModalService.js').ModalService | null} */
		this._modal = services.modal ?? null;

		/** @type {import('./NotificationService.js').NotificationService | null} */
		this._notification = services.notification ?? null;

		/** @type {import('./AnalyticsService.js').AnalyticsService | null} */
		this._analytics = services.analytics ?? null;

		/** @type {import('./PageViewBase.js').PageViewBase | null} */
		this._view = null;

		/** @type {Array<{ target: EventTarget, type: string, handler: Function, options?: object }>} */
		this._listeners = [];

		/** @type {boolean} */
		this._disposed = false;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle — subclasses must override
	// ---------------------------------------------------------------------------

	/**
	 * Synchronous setup called before bindEvents() and loadData().
	 * Create the view instance here; do NOT render it yet.
	 *
	 * @param {object} params  Route params from RouterService.
	 */
	initialize( params ) { // eslint-disable-line no-unused-vars

		throw new Error( `${this.constructor.name} must implement initialize()` );

	}

	/**
	 * Wire all event listeners to the view and services.
	 * Called immediately after initialize().
	 */
	bindEvents() {

		throw new Error( `${this.constructor.name} must implement bindEvents()` );

	}

	/**
	 * Load async data required for the first render.
	 * RouterService awaits this before calling render().
	 *
	 * @returns {Promise<void>}
	 */
	loadData() {

		throw new Error( `${this.constructor.name} must implement loadData()` );

	}

	/**
	 * Mount the view into the container element provided by RouterService.
	 * Called by RouterService after loadData() resolves.
	 *
	 * @param {HTMLElement} container
	 */
	render( container ) { // eslint-disable-line no-unused-vars

		throw new Error( `${this.constructor.name} must implement render()` );

	}

	/**
	 * Validate that state is consistent before rendering.
	 * Return false to prevent render; log a warning.
	 * Override in subclasses for page-specific guards.
	 *
	 * @returns {boolean}
	 */
	validateState() {

		return true;

	}

	/**
	 * Tear down all listeners and release references.
	 * RouterService calls this before mounting the next controller.
	 * Subclasses must call super.dispose() if they override.
	 */
	dispose() {

		if ( this._disposed ) return;
		this._disposed = true;

		// Remove all registered listeners
		for ( const { target, type, handler, options } of this._listeners ) {

			target.removeEventListener( type, handler, options );

		}

		this._listeners.length = 0;

		// Dispose the view
		if ( this._view ) {

			this._view.dispose();
			this._view = null;

		}

	}

	// ---------------------------------------------------------------------------
	// Navigation helpers
	// ---------------------------------------------------------------------------

	/**
	 * Push a new route onto the back stack.
	 *
	 * @param {string}       route
	 * @param {object | null} [state]
	 */
	navigate( route, state ) {

		if ( this._navigation ) {

			this._navigation.push( route, state );

		} else {

			window.location.hash = route;

		}

	}

	/**
	 * Navigate to the previous route.
	 */
	navigateBack() {

		if ( this._navigation ) {

			this._navigation.back();

		} else {

			window.history.back();

		}

	}

	// ---------------------------------------------------------------------------
	// Modal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Open a modal dialog via ModalService.
	 *
	 * @param {import('./ModalService.js').ModalConfig} config
	 * @returns {object | null}  Modal handle, or null if ModalService is not wired.
	 */
	openModal( config ) {

		return this._modal?.open( config ) ?? null;

	}

	/**
	 * Open a confirmation dialog via ModalService.
	 *
	 * @param {import('./ModalService.js').ConfirmationConfig} config
	 * @returns {object | null}
	 */
	openConfirm( config ) {

		return this._modal?.confirm( config ) ?? null;

	}

	// ---------------------------------------------------------------------------
	// Notification helpers
	// ---------------------------------------------------------------------------

	/**
	 * Show a toast notification.
	 *
	 * @param {import('./NotificationService.js').ToastConfig} config
	 * @returns {string}  Toast id.
	 */
	showToast( config ) {

		return this._notification?.show( config ) ?? '';

	}

	// ---------------------------------------------------------------------------
	// Managed listener registration
	// ---------------------------------------------------------------------------

	/**
	 * Register an event listener that will be automatically removed on dispose().
	 *
	 * @param {EventTarget} target
	 * @param {string}      type
	 * @param {Function}    handler
	 * @param {object}      [options]
	 */
	_addListener( target, type, handler, options ) {

		target.addEventListener( type, handler, options );
		this._listeners.push( { target, type, handler, options } );

	}

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Services
 * @property {import('./RouterService.js').RouterService}           [router]
 * @property {import('./NavigationService.js').NavigationService}   [navigation]
 * @property {import('./ModalService.js').ModalService}             [modal]
 * @property {import('./NotificationService.js').NotificationService} [notification]
 * @property {import('./AnalyticsService.js').AnalyticsService}     [analytics]
 */
