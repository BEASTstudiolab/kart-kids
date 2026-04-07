/**
 * Toast — Individual auto-dismissing notification chip.
 * Component #12 per COMPONENT_SPEC.md
 *
 * This class represents a SINGLE toast element.
 * Stacking and container management is handled by NotificationService.
 *
 * DOM structure:
 *   div.kk-toast.kk-toast--[variant][.kk-toast--entering|--exiting]
 *     [role="status"][aria-live="polite"][aria-atomic="true"]
 *     span.kk-toast__icon[aria-hidden="true"]
 *     span.kk-toast__message
 *     button.kk-toast__dismiss[aria-label="Dismiss notification"]  (when dismissible)
 *
 * Variant modifiers: --success, --error, --warning, --info
 * Animation modifiers: --entering (removed after first rAF), --exiting (on dismiss)
 *
 * Usage:
 *   const toast = new Toast({ message: 'Saved!', variant: 'success' });
 *   container.appendChild(toast.el);
 *   toast.show();  // starts timer and enter animation
 *   toast.on('dismiss', (reason) => { ... });
 *
 * Events emitted on el:
 *   kk:toast:shown     →  detail: { id, message, variant }
 *   kk:toast:dismissed →  detail: { id, reason }
 *
 * CSS injection: static guard, one <style> tag per class.
 */

let _toastUid = 0;

const VARIANT_ICONS = {
	success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
	error:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>',
	warning: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4m0 4h.01"/></svg>',
	info:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>',
};

export class Toast {

	static _cssInjected = false;

	/**
	 * @param {object} config
	 * @param {string}  config.message
	 * @param {'success'|'error'|'warning'|'info'} [config.variant]   default 'info'
	 * @param {number}  [config.duration]       ms; 0 = no auto-dismiss; default 4000
	 * @param {boolean} [config.dismissible]    shows X button; default true
	 * @param {boolean} [config.pauseOnHover]   pauses timer on hover; default true
	 * @param {string}  [config.id]             stable id for programmatic control
	 */
	constructor( config = {} ) {

		this._config = {
			message:      '',
			variant:      'info',
			duration:     4000,
			dismissible:  true,
			pauseOnHover: true,
			id:           null,
			...config,
		};

		this._id          = this._config.id ?? `toast-${++ _toastUid}`;
		this._el          = null;
		this._timerId     = null;
		this._remaining   = this._config.duration;
		this._startedAt   = null;
		this._dismissed   = false;
		this._listeners   = [];   // { event, fn }

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Toast._cssInjected ) return;
		Toast._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/*
			 * Toast region styles are also here so Toast.js is self-contained.
			 * NotificationService uses .kk-toast-region; these rules support it.
			 */
			.kk-toast-region {
				position: fixed;
				bottom: calc(var(--actionbar-height) + var(--space-4));
				left: 50%;
				transform: translateX(-50%);
				z-index: var(--z-toast);
				display: flex;
				flex-direction: column-reverse;
				align-items: center;
				gap: var(--space-2);
				pointer-events: none;
				width: max-content;
				max-width: calc(100vw - var(--space-8));
			}

			.kk-toast {
				display: flex;
				flex-direction: row;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-3) var(--space-4);
				background: var(--color-panel-raised);
				border: var(--border-thin) solid var(--color-panel-border-strong);
				border-radius: var(--radius-pill);
				box-shadow: var(--shadow-md);
				color: var(--color-white);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-medium);
				pointer-events: auto;
				max-width: 22rem;
				width: max-content;

				/* Enter/exit animation */
				transform: translateY(var(--space-3));
				opacity: 0;
				transition:
					transform var(--duration-moderate) var(--ease-spring),
					opacity var(--duration-moderate) var(--ease-standard);
			}

			/* --entering: initial state before rAF removes it (animation trigger) */
			.kk-toast--entering {
				transform: translateY(var(--space-3));
				opacity: 0;
			}

			/* Settled state (--entering removed) */
			.kk-toast:not(.kk-toast--entering):not(.kk-toast--exiting) {
				transform: translateY(0);
				opacity: 1;
			}

			/* --exiting: triggered on dismiss */
			.kk-toast--exiting {
				transform: translateY(var(--space-3));
				opacity: 0;
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-toast {
					transition: none;
				}
			}

			/* Variant: left border accent */
			.kk-toast--success { border-left: var(--border-thick) solid var(--color-success); }
			.kk-toast--error   { border-left: var(--border-thick) solid var(--color-error);   }
			.kk-toast--warning { border-left: var(--border-thick) solid var(--color-warning); }
			.kk-toast--info    { border-left: var(--border-thick) solid var(--color-info);    }

			/* Variant icon colors */
			.kk-toast--success .kk-toast__icon { color: var(--color-success); }
			.kk-toast--error   .kk-toast__icon { color: var(--color-error);   }
			.kk-toast--warning .kk-toast__icon { color: var(--color-warning); }
			.kk-toast--info    .kk-toast__icon { color: var(--color-info);    }

			.kk-toast__icon {
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
			}

			.kk-toast__message {
				flex: 1 1 auto;
				line-height: var(--leading-snug);
			}

			.kk-toast__dismiss {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				flex-shrink: 0;
				background: none;
				border: none;
				border-radius: var(--radius-pill);
				color: var(--color-ink-300);
				cursor: pointer;
				padding: 0;
				transition: color var(--duration-normal) var(--ease-standard);
				-webkit-tap-highlight-color: transparent;
				margin-right: calc(-1 * var(--space-2));
			}

			.kk-toast__dismiss:hover {
				color: var(--color-white);
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const { message, variant, dismissible } = this._config;

		const el = document.createElement( 'div' );
		el.className = `kk-toast kk-toast--${variant} kk-toast--entering`;
		el.setAttribute( 'role', 'status' );
		el.setAttribute( 'aria-live', 'polite' );
		el.setAttribute( 'aria-atomic', 'true' );
		el.dataset.toastId = this._id;

		// Icon
		const iconEl = document.createElement( 'span' );
		iconEl.className = 'kk-toast__icon';
		iconEl.setAttribute( 'aria-hidden', 'true' );
		iconEl.innerHTML = VARIANT_ICONS[ variant ] ?? VARIANT_ICONS.info;
		el.appendChild( iconEl );

		// Message
		const msgEl = document.createElement( 'span' );
		msgEl.className = 'kk-toast__message';
		msgEl.textContent = message;
		el.appendChild( msgEl );

		// Dismiss button
		if ( dismissible ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'kk-toast__dismiss';
			btn.setAttribute( 'aria-label', 'Dismiss notification' );
			btn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
			btn.addEventListener( 'click', () => this.dismiss( 'user' ) );
			el.appendChild( btn );

		}

		// Hover pause
		if ( this._config.pauseOnHover ) {

			el.addEventListener( 'mouseenter', () => this._pause() );
			el.addEventListener( 'mouseleave', () => this._resume() );

		}

		this._el = el;

	}

	// ---------------------------------------------------------------------------
	// Timer
	// ---------------------------------------------------------------------------

	_startTimer( duration ) {

		this._remaining = duration;
		this._startedAt = Date.now();
		this._timerId   = setTimeout( () => this.dismiss( 'auto' ), duration );

	}

	_pause() {

		if ( this._timerId === null ) return;
		clearTimeout( this._timerId );
		this._timerId    = null;
		this._remaining -= Date.now() - ( this._startedAt ?? Date.now() );

	}

	_resume() {

		if ( this._dismissed ) return;
		if ( this._remaining <= 0 ) { this.dismiss( 'auto' ); return; }

		this._startedAt = Date.now();
		this._timerId   = setTimeout( () => this.dismiss( 'auto' ), this._remaining );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {string} */
	get id() {

		return this._id;

	}

	/** @returns {HTMLElement} */
	get el() {

		return this._el;

	}

	/**
	 * Trigger enter animation and start the auto-dismiss timer.
	 * Call this after appending el to the DOM.
	 */
	show() {

		// Kick enter animation
		requestAnimationFrame( () => {

			this._el.classList.remove( 'kk-toast--entering' );

		} );

		if ( this._config.duration > 0 ) {
			this._startTimer( this._config.duration );
		}

		this._el.dispatchEvent( new CustomEvent( 'kk:toast:shown', {
			bubbles:  true,
			composed: true,
			detail:   {
				id:      this._id,
				message: this._config.message,
				variant: this._config.variant,
			},
		} ) );

	}

	/**
	 * Dismiss this toast with an exit animation.
	 *
	 * @param {'auto'|'user'|'programmatic'} [reason]
	 */
	dismiss( reason = 'programmatic' ) {

		if ( this._dismissed ) return;
		this._dismissed = true;

		if ( this._timerId !== null ) {
			clearTimeout( this._timerId );
			this._timerId = null;
		}

		const el = this._el;
		const focusedInToast = el.contains( document.activeElement );

		el.classList.add( 'kk-toast--exiting' );

		el.dispatchEvent( new CustomEvent( 'kk:toast:dismissed', {
			bubbles:  true,
			composed: true,
			detail:   { id: this._id, reason },
		} ) );

		// Notify registered listeners
		for ( const { event, fn } of this._listeners ) {
			if ( event === 'dismiss' ) fn( reason );
		}

		const onEnd = () => {

			el.removeEventListener( 'transitionend', onEnd );
			if ( el.parentNode ) el.parentNode.removeChild( el );

			// Move focus to remaining toasts if focus was in this one
			if ( focusedInToast ) {

				const region     = el.closest?.( '.kk-toast-region' );
				const remaining  = region
					? Array.from( region.querySelectorAll( '.kk-toast__dismiss' ) )
					: [];

				if ( remaining.length > 0 ) {
					remaining[ remaining.length - 1 ].focus();
				}

			}

		};

		el.addEventListener( 'transitionend', onEnd );
		setTimeout( onEnd, 500 );

	}

	/**
	 * Register a callback for a named event.
	 * Supported events: 'dismiss'
	 *
	 * @param {'dismiss'} event
	 * @param {Function} fn
	 */
	on( event, fn ) {

		this._listeners.push( { event, fn } );
		return this;

	}

	dispose() {

		if ( this._timerId !== null ) clearTimeout( this._timerId );

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._el        = null;
		this._listeners = [];

	}

}
