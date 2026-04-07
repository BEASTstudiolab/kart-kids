/**
 * NotificationService — toast notification system.
 *
 * Responsibilities:
 *   - Create and append toast elements to the kk-toast-region in AppShell.
 *   - Auto-dismiss after a configurable duration.
 *   - Pause the timer on mouseenter, resume on mouseleave.
 *   - Stack multiple toasts; newest appears on top (appended last in DOM).
 *   - Dismiss individual toasts by id or all at once.
 *   - Dispatch kk:toast:shown and kk:toast:dismissed events.
 *
 * Architecture decisions:
 *   - Two-phase init: constructor takes no args; initialize(containerEl) wires DOM.
 *   - The toast region element is a singleton singleton injected by AppShell.
 *   - Timers are stored per-toast so hover-pause works independently per item.
 *   - CSS drives enter/exit animation via --entering and --exiting class modifiers.
 *     JS removes --entering after first rAF and --exiting after transitionend.
 *
 * DOM structure produced (per COMPONENT_SPEC.md §12):
 *
 *   <div class="kk-toast-region" role="region" aria-label="Notifications"
 *        aria-live="polite" aria-atomic="false" aria-relevant="additions">
 *
 *     <div class="kk-toast kk-toast--success --entering" role="status"
 *          aria-live="polite" aria-atomic="true">
 *       <span class="kk-toast__icon" aria-hidden="true">...</span>
 *       <span class="kk-toast__message">Reward claimed!</span>
 *       <button class="kk-toast__dismiss" type="button"
 *               aria-label="Dismiss notification">...</button>
 *     </div>
 *
 *   </div>
 */

let _uidCounter = 0;

/** @type {Map<string, _ToastEntry>} */
const _toasts = new Map();

export class NotificationService {

	constructor() {

		/** @type {HTMLElement | null} */
		this._region = null;

	}

	// ---------------------------------------------------------------------------
	// Init
	// ---------------------------------------------------------------------------

	/**
	 * Wire up the toast region element. Called by AppShell after shell DOM is created.
	 *
	 * @param {HTMLElement} regionEl  The `kk-toast-region` element.
	 */
	initialize( regionEl ) {

		this._region = regionEl;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Show a toast notification.
	 *
	 * @param {ToastConfig} config
	 * @returns {string}  The toast id (use with dismiss()).
	 */
	show( config ) {

		if ( ! this._region ) {

			console.error( '[NotificationService] Not initialized. Call initialize(regionEl) first.' );
			return '';

		}

		const id = config.id ?? `toast-${++ _uidCounter}`;
		const variant    = config.variant    ?? 'info';
		const duration   = config.duration   ?? 4000;
		const dismissible  = config.dismissible  !== false;
		const pauseOnHover = config.pauseOnHover !== false;

		const el = _buildToastEl( id, config.message, variant, dismissible );
		this._region.appendChild( el );

		// Kick off enter animation
		requestAnimationFrame( () => {

			el.classList.remove( 'kk-toast--entering' );

		} );

		const entry = new _ToastEntry( {
			id, el, duration, pauseOnHover, service: this,
		} );

		_toasts.set( id, entry );

		if ( dismissible ) {

			el.querySelector( '.kk-toast__dismiss' )?.addEventListener( 'click', () => {

				this.dismiss( id, 'user' );

			} );

		}

		el.dispatchEvent( new CustomEvent( 'kk:toast:shown', {
			bubbles: true, composed: true,
			detail: { id, message: config.message, variant },
		} ) );

		if ( duration > 0 ) entry.startTimer( duration );

		return id;

	}

	/**
	 * Dismiss a specific toast by id.
	 *
	 * @param {string}  id
	 * @param {'auto' | 'user' | 'programmatic'} [reason]
	 */
	dismiss( id, reason = 'programmatic' ) {

		const entry = _toasts.get( id );
		if ( ! entry || entry._dismissed ) return;
		entry._dismissed = true;

		entry.cancelTimer();

		const el = entry.el;
		const focusedInToast = el.contains( document.activeElement );

		el.classList.add( 'kk-toast--exiting' );

		el.dispatchEvent( new CustomEvent( 'kk:toast:dismissed', {
			bubbles: true, composed: true,
			detail: { id, reason },
		} ) );

		const onEnd = () => {

			el.removeEventListener( 'transitionend', onEnd );
			el.remove();
			_toasts.delete( id );

			// Restore focus if the user was on the dismiss button
			if ( focusedInToast ) {

				const remaining = this._region ? Array.from( this._region.querySelectorAll( '.kk-toast__dismiss' ) ) : [];
				if ( remaining.length > 0 ) {

					remaining[ remaining.length - 1 ].focus();

				}

			}

		};

		el.addEventListener( 'transitionend', onEnd );
		setTimeout( onEnd, 500 ); // fallback if no CSS transition

	}

	/**
	 * Dismiss all active toasts.
	 */
	dismissAll() {

		for ( const id of Array.from( _toasts.keys() ) ) {

			this.dismiss( id, 'programmatic' );

		}

	}

}

// ---------------------------------------------------------------------------
// Toast entry — holds timer state
// ---------------------------------------------------------------------------

class _ToastEntry {

	constructor( { id, el, duration, pauseOnHover, service } ) {

		this.id      = id;
		this.el      = el;
		this._service = service;
		this._dismissed = false;

		/** @type {number | null} */
		this._timerId = null;

		/** @type {number} */
		this._remaining = duration;

		/** @type {number | null} */
		this._startedAt = null;

		if ( pauseOnHover ) {

			el.addEventListener( 'mouseenter', () => this._pause() );
			el.addEventListener( 'mouseleave', () => this._resume() );

		}

	}

	startTimer( duration ) {

		this._remaining = duration;
		this._startedAt = Date.now();
		this._timerId   = setTimeout( () => {

			this._service.dismiss( this.id, 'auto' );

		}, duration );

	}

	cancelTimer() {

		if ( this._timerId !== null ) {

			clearTimeout( this._timerId );
			this._timerId = null;

		}

	}

	_pause() {

		if ( this._timerId === null ) return;
		this.cancelTimer();
		this._remaining -= Date.now() - ( this._startedAt ?? Date.now() );

	}

	_resume() {

		if ( this._dismissed ) return;
		if ( this._remaining <= 0 ) {

			this._service.dismiss( this.id, 'auto' );
			return;

		}

		this._startedAt = Date.now();
		this._timerId = setTimeout( () => {

			this._service.dismiss( this.id, 'auto' );

		}, this._remaining );

	}

}

// ---------------------------------------------------------------------------
// DOM builder
// ---------------------------------------------------------------------------

/**
 * @param {string}  id
 * @param {string}  message
 * @param {string}  variant
 * @param {boolean} dismissible
 * @returns {HTMLElement}
 */
function _buildToastEl( id, message, variant, dismissible ) {

	const el = document.createElement( 'div' );
	el.className = `kk-toast kk-toast--${variant} kk-toast--entering`;
	el.setAttribute( 'role', 'status' );
	el.setAttribute( 'aria-live', 'polite' );
	el.setAttribute( 'aria-atomic', 'true' );
	el.dataset.toastId = id;

	const iconEl = document.createElement( 'span' );
	iconEl.className = 'kk-toast__icon';
	iconEl.setAttribute( 'aria-hidden', 'true' );
	iconEl.innerHTML = _variantIcon( variant );
	el.appendChild( iconEl );

	const msgEl = document.createElement( 'span' );
	msgEl.className = 'kk-toast__message';
	msgEl.textContent = message;
	el.appendChild( msgEl );

	if ( dismissible ) {

		const btn = document.createElement( 'button' );
		btn.className = 'kk-toast__dismiss';
		btn.type = 'button';
		btn.setAttribute( 'aria-label', 'Dismiss notification' );
		btn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
		el.appendChild( btn );

	}

	return el;

}

/**
 * Inline SVG icon per variant.
 *
 * @param {string} variant
 * @returns {string}
 */
function _variantIcon( variant ) {

	const icons = {
		success: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
		error:   '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
		warning: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
		info:    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 16v-4m0-4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
	};

	return icons[ variant ] ?? icons.info;

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ToastConfig
 * @property {string}  message
 * @property {'success'|'error'|'warning'|'info'} [variant]
 * @property {number}  [duration]      ms before auto-dismiss; 0 = persistent
 * @property {boolean} [dismissible]
 * @property {boolean} [pauseOnHover]
 * @property {string}  [id]
 */
