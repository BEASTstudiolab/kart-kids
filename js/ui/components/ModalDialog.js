/**
 * ModalDialog — Centered overlay modal; base class for ConfirmationDialog.
 * Component #10 per COMPONENT_SPEC.md
 *
 * Architecture:
 *   - Self-contained: manages its own overlay, focus trap, and scroll lock.
 *   - Does NOT require ModalService; it can be used standalone or via ModalService.
 *   - ModalService may also create overlays directly; this class is for
 *     code that instantiates a modal and opens it imperatively.
 *
 * DOM structure:
 *   div.kk-modal-overlay[aria-hidden]
 *     div.kk-modal[role="dialog"][aria-modal][aria-labelledby][aria-describedby][tabindex="-1"]
 *       div.kk-modal__header
 *         h2.kk-modal__title
 *         button.kk-modal__close  (omitted when dismissible:false)
 *       div.kk-modal__body
 *       div.kk-modal__footer  (omitted when no footer)
 *
 * Events emitted:
 *   kk:modal:open   →  detail: { uid }
 *   kk:modal:close  →  detail: { uid, reason }
 *
 * CSS injection: static guard, one <style> tag per class.
 */

let _modalUid = 0;

const FOCUSABLE_SELECTORS = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join( ', ' );

export class ModalDialog {

	static _cssInjected = false;

	/**
	 * @param {object} config
	 * @param {string}                  [config.uid]
	 * @param {string}                   config.title
	 * @param {HTMLElement|string}      [config.body]
	 * @param {HTMLElement|null}        [config.footer]
	 * @param {boolean}                 [config.dismissible]  default true
	 * @param {boolean}                 [config.loading]      default false
	 * @param {Function}                [config.onClose]      called after close animation
	 */
	constructor( config = {} ) {

		this._config = {
			uid:         null,
			title:       '',
			body:        null,
			footer:      null,
			dismissible: true,
			loading:     false,
			onClose:     null,
			...config,
		};

		this._uid        = this._config.uid ?? `modal-${++ _modalUid}`;
		this._el         = null;
		this._dialogEl   = null;
		this._bodyEl     = null;
		this._footerEl   = null;
		this._closeBtnEl = null;
		this._triggerEl  = null;
		this._open       = false;
		this._closed     = false;

		this._onKeyDown  = this._handleKeyDown.bind( this );

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( ModalDialog._cssInjected ) return;
		ModalDialog._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-modal-overlay {
				position: fixed;
				inset: 0;
				z-index: var(--z-modal);
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--space-4);
				background: var(--color-panel-overlay);
				backdrop-filter: blur(4px);
				opacity: 0;
				pointer-events: none;
				transition:
					opacity var(--duration-moderate) var(--ease-standard);
			}

			.kk-modal-overlay--open {
				opacity: 1;
				pointer-events: auto;
			}

			.kk-modal {
				position: relative;
				width: 100%;
				max-width: 32rem;
				max-height: calc(100dvh - var(--space-8));
				display: flex;
				flex-direction: column;
				background: var(--color-panel-raised);
				border: var(--border-thin) solid var(--color-panel-border-strong);
				border-radius: var(--radius-lg);
				box-shadow: var(--shadow-xl);
				overflow: hidden;
				transform: translateY(var(--space-4)) scale(0.97);
				transition:
					transform var(--duration-moderate) var(--ease-spring);
			}

			.kk-modal-overlay--open .kk-modal {
				transform: translateY(0) scale(1);
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-modal-overlay,
				.kk-modal {
					transition: none;
				}
			}

			.kk-modal__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--space-4);
				padding: var(--space-4) var(--space-5);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				flex-shrink: 0;
			}

			.kk-modal__title {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-white);
				line-height: var(--leading-tight);
				margin: 0;
			}

			.kk-modal__close {
				display: flex;
				align-items: center;
				justify-content: center;
				width: var(--hit-target-min);
				height: var(--hit-target-min);
				flex-shrink: 0;
				background: none;
				border: none;
				border-radius: var(--radius-md);
				color: var(--color-ink-300);
				cursor: pointer;
				transition: color var(--duration-normal) var(--ease-standard);
				-webkit-tap-highlight-color: transparent;
			}

			.kk-modal__close:hover {
				color: var(--color-white);
			}

			.kk-modal__body {
				flex: 1 1 auto;
				overflow-y: auto;
				padding: var(--space-5);
				font-family: var(--font-ui);
				font-size: var(--text-base);
				color: var(--color-ink-200);
				line-height: var(--leading-relaxed);
			}

			/* Skeleton shimmer over body while loading */
			.kk-modal__body--loading {
				position: relative;
				min-height: 6rem;
				pointer-events: none;
			}

			.kk-modal__body--loading::after {
				content: '';
				position: absolute;
				inset: 0;
				background: linear-gradient(
					90deg,
					var(--color-ink-800) 25%,
					var(--color-ink-700) 50%,
					var(--color-ink-800) 75%
				);
				background-size: 200% 100%;
				animation: kk-shimmer 1.4s ease-in-out infinite;
				border-radius: var(--radius-md);
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-modal__body--loading::after {
					animation: none;
					background: var(--color-ink-800);
				}
			}

			.kk-modal__footer {
				padding: var(--space-4) var(--space-5);
				border-top: var(--border-thin) solid var(--color-panel-border);
				flex-shrink: 0;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const { title, body, footer, dismissible, loading } = this._config;
		const uid = this._uid;

		// Overlay
		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-modal-overlay';
		overlay.setAttribute( 'aria-hidden', 'true' );

		// Dismiss on backdrop click
		if ( dismissible ) {

			overlay.addEventListener( 'click', ( e ) => {

				if ( e.target === overlay ) this.close( 'backdrop' );

			} );

		}

		// Dialog
		const dialog = document.createElement( 'div' );
		dialog.className = 'kk-modal';
		dialog.setAttribute( 'role', 'dialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.setAttribute( 'aria-labelledby', `${uid}-title` );
		dialog.setAttribute( 'aria-describedby', `${uid}-desc` );
		dialog.setAttribute( 'tabindex', '-1' );

		// Header
		const header = document.createElement( 'div' );
		header.className = 'kk-modal__header';

		const titleEl = document.createElement( 'h2' );
		titleEl.className = 'kk-modal__title';
		titleEl.id        = `${uid}-title`;
		titleEl.textContent = title;
		header.appendChild( titleEl );

		let closeBtn = null;

		if ( dismissible ) {

			closeBtn = document.createElement( 'button' );
			closeBtn.type = 'button';
			closeBtn.className = 'kk-modal__close';
			closeBtn.setAttribute( 'aria-label', 'Close dialog' );
			closeBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
			closeBtn.addEventListener( 'click', () => this.close( 'close-button' ) );
			header.appendChild( closeBtn );
			this._closeBtnEl = closeBtn;

		}

		dialog.appendChild( header );

		// Body
		const bodyEl = document.createElement( 'div' );
		bodyEl.className = 'kk-modal__body';
		bodyEl.id        = `${uid}-desc`;

		if ( loading ) {
			bodyEl.classList.add( 'kk-modal__body--loading' );
			bodyEl.setAttribute( 'aria-busy', 'true' );
		}

		if ( body instanceof HTMLElement ) {
			bodyEl.appendChild( body );
		} else if ( typeof body === 'string' ) {
			bodyEl.innerHTML = body;
		}

		dialog.appendChild( bodyEl );
		this._bodyEl = bodyEl;

		// Footer — omit from DOM when no footer
		if ( footer ) {

			const footerEl = document.createElement( 'div' );
			footerEl.className = 'kk-modal__footer';
			footerEl.appendChild( footer );
			dialog.appendChild( footerEl );
			this._footerEl = footerEl;

		}

		overlay.appendChild( dialog );

		this._el       = overlay;
		this._dialogEl = dialog;

	}

	// ---------------------------------------------------------------------------
	// Open / Close
	// ---------------------------------------------------------------------------

	/**
	 * Mount the overlay to document.body and animate it open.
	 */
	open() {

		if ( this._open || this._closed ) return;
		this._open = true;

		// Capture focus source
		this._triggerEl = document.activeElement;

		document.body.appendChild( this._el );
		document.body.style.overflow = 'hidden';
		document.addEventListener( 'keydown', this._onKeyDown, true );

		requestAnimationFrame( () => {

			this._el.classList.add( 'kk-modal-overlay--open' );
			this._el.setAttribute( 'aria-hidden', 'false' );

			this._dialogEl.focus();

			requestAnimationFrame( () => {

				const first = this._firstFocusable();
				if ( first ) first.focus();

			} );

		} );

		this._el.dispatchEvent( new CustomEvent( 'kk:modal:open', {
			bubbles:  true,
			composed: true,
			detail:   { uid: this._uid },
		} ) );

	}

	/**
	 * Animate the overlay closed, then remove from DOM.
	 *
	 * @param {'escape'|'close-button'|'backdrop'|'programmatic'} [reason]
	 */
	close( reason = 'programmatic' ) {

		if ( ! this._open ) return;
		this._open = false;

		this._el.classList.remove( 'kk-modal-overlay--open' );
		this._el.setAttribute( 'aria-hidden', 'true' );

		this._el.dispatchEvent( new CustomEvent( 'kk:modal:close', {
			bubbles:  true,
			composed: true,
			detail:   { uid: this._uid, reason },
		} ) );

		document.removeEventListener( 'keydown', this._onKeyDown, true );

		// Restore scroll lock
		document.body.style.overflow = '';

		// Restore focus to trigger element
		if ( this._triggerEl && typeof this._triggerEl.focus === 'function' ) {
			this._triggerEl.focus();
		}

		const onEnd = () => {

			this._el.removeEventListener( 'transitionend', onEnd );
			if ( this._el.parentNode ) this._el.parentNode.removeChild( this._el );
			if ( this._config.onClose ) this._config.onClose();

		};

		this._el.addEventListener( 'transitionend', onEnd );
		// Fallback if CSS transitions are absent or reduced-motion zeros duration
		setTimeout( onEnd, 400 );

	}

	// ---------------------------------------------------------------------------
	// Keyboard
	// ---------------------------------------------------------------------------

	_handleKeyDown( event ) {

		if ( event.key === 'Escape' ) {

			event.preventDefault();
			event.stopPropagation();

			if ( this._config.dismissible ) {
				this.close( 'escape' );
			}

			return;

		}

		if ( event.key === 'Tab' ) {
			this._trapFocus( event );
		}

	}

	_trapFocus( event ) {

		const focusable = Array.from(
			this._dialogEl.querySelectorAll( FOCUSABLE_SELECTORS )
		).filter( ( el ) => ! el.closest( '[aria-disabled="true"]' ) && el.offsetParent !== null );

		if ( focusable.length === 0 ) {
			event.preventDefault();
			return;
		}

		const first = focusable[ 0 ];
		const last  = focusable[ focusable.length - 1 ];

		if ( event.shiftKey ) {

			if ( document.activeElement === first || document.activeElement === this._dialogEl ) {
				event.preventDefault();
				last.focus();
			}

		} else {

			if ( document.activeElement === last || document.activeElement === this._dialogEl ) {
				event.preventDefault();
				first.focus();
			}

		}

	}

	_firstFocusable() {

		const candidates = Array.from(
			this._dialogEl.querySelectorAll( FOCUSABLE_SELECTORS )
		).filter( ( el ) => ! el.closest( '[aria-disabled="true"]' ) && el.offsetParent !== null );

		return candidates[ 0 ] ?? null;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} The overlay element. */
	get el() {

		return this._el;

	}

	/** @returns {string} */
	get uid() {

		return this._uid;

	}

	/**
	 * Show or hide skeleton shimmer over the modal body.
	 *
	 * @param {boolean} loading
	 */
	setLoading( loading ) {

		if ( loading ) {
			this._bodyEl.classList.add( 'kk-modal__body--loading' );
			this._bodyEl.setAttribute( 'aria-busy', 'true' );
		} else {
			this._bodyEl.classList.remove( 'kk-modal__body--loading' );
			this._bodyEl.removeAttribute( 'aria-busy' );
		}

	}

	/**
	 * Replace the body content.
	 *
	 * @param {HTMLElement|string} content
	 */
	setBody( content ) {

		this._bodyEl.innerHTML = '';

		if ( content instanceof HTMLElement ) {
			this._bodyEl.appendChild( content );
		} else {
			this._bodyEl.innerHTML = content;
		}

	}

	/**
	 * Replace the footer content.
	 *
	 * @param {HTMLElement} content
	 */
	setFooter( content ) {

		if ( ! this._footerEl ) {
			const footerEl = document.createElement( 'div' );
			footerEl.className = 'kk-modal__footer';
			this._dialogEl.appendChild( footerEl );
			this._footerEl = footerEl;
		}

		this._footerEl.innerHTML = '';
		this._footerEl.appendChild( content );

	}

	dispose() {

		if ( this._open ) this.close( 'programmatic' );

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		document.removeEventListener( 'keydown', this._onKeyDown, true );

		this._el       = null;
		this._dialogEl = null;
		this._bodyEl   = null;
		this._footerEl = null;

	}

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ModalDialogConfig
 * @property {string}             [uid]
 * @property {string}              title
 * @property {HTMLElement|string} [body]
 * @property {HTMLElement|null}   [footer]
 * @property {boolean}            [dismissible]
 * @property {boolean}            [loading]
 * @property {Function}           [onClose]
 */
