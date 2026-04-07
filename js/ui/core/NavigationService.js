/**
 * NavigationService — back-stack and hash-navigation layer.
 *
 * Responsibilities:
 *   - Own the explicit back stack (separate from browser history).
 *   - Push, replace, and pop routes in a deterministic, auditable way.
 *   - Support caller-return context (state object) per history entry.
 *   - Expose a back() method that pops to the previous route or a declared
 *     root fallback when the stack is empty.
 *
 * Architecture notes:
 *   - This is a singleton module (not a class) because there is exactly one
 *     navigation state for the entire application.
 *   - The browser's history.pushState / history.replaceState are NOT used;
 *     we drive navigation exclusively through the URL hash so RouterService's
 *     hashchange listener remains the single source of truth.
 *   - Callers must not manipulate window.location.hash directly; always route
 *     through this service so the back stack stays consistent.
 */

/** @typedef {{ path: string, state: object | null }} HistoryEntry */

/** @type {HistoryEntry[]} */
const _stack = [];

/** Route that back() falls through to when the stack is empty. */
let _rootRoute = '/home';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Set the route that back() navigates to when the stack has no prior entry.
 * Typically called by AppShell during bootstrap.
 *
 * @param {string} route  e.g. '/home'
 */
export function setRoot( route ) {

	_rootRoute = route;

}

// ---------------------------------------------------------------------------
// Core navigation
// ---------------------------------------------------------------------------

/**
 * Navigate forward to `path`, pushing the current path onto the back stack.
 *
 * @param {string}         path    Target route, e.g. '/garage'
 * @param {object | null}  [state] Caller-return context persisted in the entry.
 */
export function push( path, state = null ) {

	const current = _currentHashPath();

	if ( current !== path ) {

		_stack.push( { path: current, state } );
		_setHash( path );

	}

}

/**
 * Replace the current history entry without pushing to the back stack.
 * Use for redirects, fallback navigation, and flow steps where back() should
 * skip the replaced entry.
 *
 * @param {string} path
 */
export function replace( path ) {

	_setHash( path );

}

/**
 * Navigate back to the previous route.
 * If the stack is empty, navigates to the root route via replace() so that
 * pressing back again does not loop.
 *
 * @returns {string}  The path that was navigated to.
 */
export function back() {

	const entry = _stack.pop();

	if ( entry ) {

		_setHash( entry.path );
		return entry.path;

	}

	_setHash( _rootRoute );
	return _rootRoute;

}

/**
 * Read the caller-return state stored when the most recent push() was made.
 * Returns null when the stack is empty or no state was stored.
 *
 * @returns {object | null}
 */
export function peekState() {

	if ( _stack.length === 0 ) return null;
	return _stack[ _stack.length - 1 ].state;

}

/**
 * Clear the entire back stack.
 * Call when resetting to a known root state, e.g. after signing out.
 */
export function clearStack() {

	_stack.length = 0;

}

/**
 * Return a shallow copy of the current stack for debugging or serialization.
 *
 * @returns {HistoryEntry[]}
 */
export function getStack() {

	return _stack.slice();

}

/**
 * Return whether there is a previous route to go back to.
 *
 * @returns {boolean}
 */
export function canGoBack() {

	return _stack.length > 0;

}

// ---------------------------------------------------------------------------
// Default export — namespace object for consumers that prefer dot-access.
// ---------------------------------------------------------------------------

export const NavigationService = Object.freeze( {
	setRoot,
	push,
	replace,
	back,
	peekState,
	clearStack,
	getStack,
	canGoBack,
} );

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _setHash( path ) {

	// Avoid a spurious hashchange event when already at that path.
	if ( _currentHashPath() !== path ) {

		window.location.hash = path;

	}

}

function _currentHashPath() {

	const hash = window.location.hash;
	if ( ! hash || hash === '#' ) return '/';
	return hash.slice( 1 ) || '/';

}
