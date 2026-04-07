/**
 * RouterService — hash-based client-side router.
 *
 * Responsibilities:
 *   - Register named routes with their controller factories.
 *   - Parse the current URL hash and dispatch to the matching route.
 *   - Drive the controller lifecycle in sequence:
 *       initialize(params) → bindEvents() → loadData().then(() => render())
 *   - Call dispose() on the outgoing controller before mounting the incoming one.
 *   - Provide a setContainer(el) hook so AppShell can hand over the render target.
 *
 * Architecture decisions:
 *   - Hash-based (#/path) so no server rewrite rules are required.
 *   - Route params are extracted from the hash path and passed as a plain object.
 *   - The router does NOT own the DOM container; AppShell calls setContainer() after
 *     it has created the shell DOM.
 *   - Controllers are created fresh on every navigation (no singleton page caches),
 *     which keeps state clean at the cost of re-instantiation. For this game menu
 *     use-case that is the correct trade-off.
 */

import { NavigationService } from './NavigationService.js';

/** @typedef {{ pattern: RegExp, keys: string[], factory: (params: object) => import('./PageControllerBase.js').PageControllerBase }} RouteEntry */

export class RouterService {

	constructor() {

		/** @type {RouteEntry[]} */
		this._routes = [];

		/** @type {HTMLElement | null} */
		this._container = null;

		/** @type {import('./PageControllerBase.js').PageControllerBase | null} */
		this._activeController = null;

		/** @type {string} */
		this._fallbackRoute = '/';

		this._onHashChange = this._onHashChange.bind( this );

	}

	// ---------------------------------------------------------------------------
	// Configuration
	// ---------------------------------------------------------------------------

	/**
	 * Set the DOM element into which page controllers will render.
	 * Called by AppShell once the shell DOM has been created.
	 *
	 * @param {HTMLElement} el
	 */
	setContainer( el ) {

		this._container = el;

	}

	/**
	 * Set the route to navigate to when no registered route matches.
	 *
	 * @param {string} route  e.g. '/'
	 */
	setFallback( route ) {

		this._fallbackRoute = route;

	}

	// ---------------------------------------------------------------------------
	// Route registration
	// ---------------------------------------------------------------------------

	/**
	 * Register a route.
	 *
	 * @param {string}   path     Route pattern, e.g. '/garage' or '/lobby/:id'
	 * @param {Function} factory  () => PageControllerBase instance
	 *
	 * @example
	 *   router.register('/garage', () => new GarageController(services));
	 *   router.register('/lobby/:id', (params) => new LobbyController(params, services));
	 */
	register( path, factory ) {

		const { pattern, keys } = _compilePattern( path );
		this._routes.push( { pattern, keys, factory } );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Attach the hashchange listener and dispatch the current URL.
	 * Call once after all routes are registered and setContainer() has been called.
	 */
	start() {

		window.addEventListener( 'hashchange', this._onHashChange );
		this._dispatch( _currentPath() );

	}

	/**
	 * Remove the hashchange listener and dispose the active controller.
	 */
	stop() {

		window.removeEventListener( 'hashchange', this._onHashChange );
		this._disposeActive();

	}

	// ---------------------------------------------------------------------------
	// Programmatic navigation (delegates to NavigationService)
	// ---------------------------------------------------------------------------

	/**
	 * Navigate to a route. Pushes onto the back stack via NavigationService.
	 *
	 * @param {string}  path    e.g. '/garage'
	 * @param {object}  [state] Optional caller-return context stored in history entry.
	 */
	navigate( path, state ) {

		NavigationService.push( path, state );

	}

	/**
	 * Replace the current history entry without pushing to the back stack.
	 *
	 * @param {string} path
	 */
	replace( path ) {

		NavigationService.replace( path );

	}

	// ---------------------------------------------------------------------------
	// Internal
	// ---------------------------------------------------------------------------

	_onHashChange() {

		this._dispatch( _currentPath() );

	}

	/**
	 * Match path → route entry → run controller lifecycle.
	 *
	 * @param {string} path
	 */
	async _dispatch( path ) {

		// Strip fragment (#section) from path for matching; keep the raw fragment
		// so controllers can read it if needed.
		const [ pathOnly, fragment ] = path.split( '#' );

		let matched = null;
		let params = {};

		for ( const route of this._routes ) {

			const m = pathOnly.match( route.pattern );

			if ( m ) {

				route.keys.forEach( ( key, i ) => { params[ key ] = decodeURIComponent( m[ i + 1 ] ?? '' ); } );
				if ( fragment ) params._fragment = fragment;
				matched = route;
				break;

			}

		}

		if ( ! matched ) {

			// Unknown route — redirect to fallback without a back-stack entry.
			console.warn( `[RouterService] No route matched "${path}" — redirecting to fallback "${this._fallbackRoute}"` );
			NavigationService.replace( this._fallbackRoute );
			return;

		}

		await this._mountController( matched.factory, params );

	}

	/**
	 * Dispose the outgoing controller and mount the incoming one.
	 *
	 * @param {Function} factory  (params) => PageControllerBase
	 * @param {object}   params
	 */
	async _mountController( factory, params ) {

		this._disposeActive();

		if ( ! this._container ) {

			console.error( '[RouterService] No container set. Call setContainer() before start().' );
			return;

		}

		let controller;

		try {

			const result = factory( params );
			controller = ( result && typeof result.then === 'function' ) ? await result : result;

		} catch ( err ) {

			console.error( '[RouterService] Controller factory threw:', err );
			return;

		}

		this._activeController = controller;

		try {

			controller.initialize( params );
			controller.bindEvents();

			await controller.loadData();

			// Guard: controller may have been replaced during async loadData()
			if ( this._activeController !== controller ) return;

			controller.render( this._container );

		} catch ( err ) {

			console.error( '[RouterService] Controller lifecycle error:', err );

			if ( this._activeController === controller ) {

				this._disposeActive();

			}

		}

	}

	_disposeActive() {

		if ( this._activeController ) {

			try {

				this._activeController.dispose();

			} catch ( err ) {

				console.warn( '[RouterService] Error during controller dispose:', err );

			}

			this._activeController = null;

		}

	}

}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a route pattern string into a RegExp and an ordered list of param keys.
 *
 * Supports:
 *   - Static segments  /lobby
 *   - Named params     /lobby/:id
 *   - Wildcard         /lobby/*
 *
 * @param {string} pattern
 * @returns {{ pattern: RegExp, keys: string[] }}
 */
function _compilePattern( pattern ) {

	const keys = [];

	const regexStr = pattern
		.replace( /[.*+?^${}()|[\]\\]/g, ( c ) => ( c === '*' ? '.*' : c === '.' ? '\\.' : `\\${c}` ) )
		.replace( /:([a-zA-Z_][a-zA-Z0-9_]*)/g, ( _, key ) => {

			keys.push( key );
			return '([^/]+)';

		} );

	return { pattern: new RegExp( `^${regexStr}$` ), keys };

}

/**
 * Read the current hash path, stripping the leading '#'.
 * Falls back to '/' when the hash is empty.
 *
 * @returns {string}
 */
function _currentPath() {

	const hash = window.location.hash;
	if ( ! hash || hash === '#' ) return '/';
	// Remove the '#' prefix; keep any sub-fragment after a second '#'
	return hash.slice( 1 ) || '/';

}
