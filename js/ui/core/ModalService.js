/**
 * ModalService — manages the modal layer in the AppShell.
 *
 * Responsibilities:
 *   - Create, open, and close ModalDialog and ConfirmationDialog instances.
 *   - Enforce focus trap inside the open modal.
 *   - Restore focus to the trigger element on close.
 *   - Apply/remove scroll lock on <body>.
 *   - Manage a queue so at most one modal is visible at a time.
 *
 * Architecture decisions:
 *   - Two-phase init: constructor takes no args; initialize(containerEl) wires DOM.
 *   - Focus trap: real Tab-cycle sentinel approach (no library dependency).
 *   - Escape is blocked from propagating while a non-dismissible modal is open.
 *   - UID auto-generation ensures unique aria IDs across concurrent modals.
 *
 * DOM structure produced (per COMPONENT_SPEC.md §10):
 *
 *   <div class="kk-modal-overlay" aria-hidden="true">
 *     <div class="kk-modal" role="dialog" aria-modal="true"
 *          aria-labelledby="modal-N-title" aria-describedby="modal-N-desc"
 *          tabindex="-1">
 *       <div class="kk-modal__header">
 *         <h2 class="kk-modal__title" id="modal-N-title">TITLE</h2>
 *         <button class="kk-modal__close" type="button" aria-label="Close dialog">...</button>
 *       </div>
 *       <div class="kk-modal__body" id="modal-N-desc">...</div>
 *       <div class="kk-modal__footer">...</div>
 *     </div>
 *   </div>
 */

let _uidCounter = 0;

const FOCUSABLE_SELECTORS = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join( ', ' );

export class ModalService {

	constructor() {

		/** @type {HTMLElement | null} */
		this._container = null;

		/** @type {_ModalHandle | null} */
		this._active = null;

		/** @type {_ModalHandle[]} */
		this._queue = [];

		this._onKeyDown = this._onKeyDown.bind( this );

	}

	// ---------------------------------------------------------------------------
	// Init
	// ---------------------------------------------------------------------------

	/**
	 * Wire up the DOM container. Called by AppShell after shell DOM is created.
	 *
	 * @param {HTMLElement} containerEl  The element that will receive modal overlays.
	 */
	initialize( containerEl ) {

		this._container = containerEl;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Open a modal dialog.
	 *
	 * @param {ModalConfig} config
	 * @returns {_ModalHandle}  Handle with .close() and .setLoading() methods.
	 */
	open( config ) {

		const handle = this._build( config );

		if ( this._active ) {

			this._queue.push( handle );

		} else {

			this._mount( handle );

		}

		return handle;

	}

	/**
	 * Open a two-button confirmation dialog.
	 *
	 * @param {ConfirmationConfig} config
	 * @returns {_ModalHandle}
	 */
	confirm( config ) {

		const footerEl = _buildConfirmFooter( config );

		return this.open( {
			uid:        config.uid,
			title:      config.title,
			body:       config.body,
			footer:     footerEl,
			dismissible: config.dismissible ?? true,
			loading:    false,
			onClose:    config.onCancel,
			_isConfirm: true,
			_config:    config,
			_footerEl:  footerEl,
		} );

	}

	/**
	 * Programmatically close the active modal.
	 *
	 * @param {'programmatic'} [reason]
	 */
	closeActive( reason = 'programmatic' ) {

		if ( this._active ) this._close( this._active, reason );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	/**
	 * @param {ModalConfig} config
	 * @returns {_ModalHandle}
	 */
	_build( config ) {

		const uid = config.uid ?? `modal-${++ _uidCounter}`;

		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-modal-overlay';
		overlay.setAttribute( 'aria-hidden', 'true' );

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
		titleEl.id = `${uid}-title`;
		titleEl.textContent = config.title;
		header.appendChild( titleEl );

		let closeBtn = null;

		if ( config.dismissible !== false ) {

			closeBtn = document.createElement( 'button' );
			closeBtn.className = 'kk-modal__close';
			closeBtn.type = 'button';
			closeBtn.setAttribute( 'aria-label', 'Close dialog' );
			closeBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
			header.appendChild( closeBtn );

		}

		dialog.appendChild( header );

		// Body
		const body = document.createElement( 'div' );
		body.className = 'kk-modal__body';
		body.id = `${uid}-desc`;

		if ( config.loading ) {

			body.classList.add( 'kk-modal__body--loading' );
			body.setAttribute( 'aria-busy', 'true' );

		}

		if ( config.body instanceof HTMLElement ) {

			body.appendChild( config.body );

		} else if ( typeof config.body === 'string' ) {

			body.innerHTML = config.body;

		}

		dialog.appendChild( body );

		// Footer
		let footer = null;

		if ( config.footer ) {

			footer = document.createElement( 'div' );
			footer.className = 'kk-modal__footer';
			footer.appendChild( config.footer );
			dialog.appendChild( footer );

		}

		overlay.appendChild( dialog );

		const handle = new _ModalHandle( {
			uid, overlay, dialog, body, closeBtn, footer,
			dismissible: config.dismissible !== false,
			onClose: config.onClose ?? null,
			service: this,
		} );

		// Wire close button
		if ( closeBtn ) {

			closeBtn.addEventListener( 'click', () => this._close( handle, 'close-button' ) );

		}

		// Wire confirm/cancel buttons if this is a confirmation dialog
		if ( config._isConfirm && config._config ) {

			const cfg = config._config;
			const footerEl = config._footerEl;

			footerEl.querySelector( '[data-action="confirm-cancel"]' )
				?.addEventListener( 'click', () => {

					if ( cfg.onCancel ) cfg.onCancel();
					this._close( handle, 'programmatic' );
					overlay.dispatchEvent( new CustomEvent( 'kk:confirm-dialog:cancel', {
						bubbles: true, composed: true,
						detail: { uid, cancelActionId: cfg.cancelActionId },
					} ) );

				} );

			footerEl.querySelector( '[data-action="confirm-proceed"]' )
				?.addEventListener( 'click', () => {

					if ( cfg.onConfirm ) cfg.onConfirm();
					this._close( handle, 'programmatic' );
					overlay.dispatchEvent( new CustomEvent( 'kk:confirm-dialog:confirm', {
						bubbles: true, composed: true,
						detail: { uid, confirmActionId: cfg.confirmActionId },
					} ) );

				} );

		}

		return handle;

	}

	// ---------------------------------------------------------------------------
	// Mount / unmount
	// ---------------------------------------------------------------------------

	_mount( handle ) {

		if ( ! this._container ) {

			console.error( '[ModalService] Not initialized. Call initialize(containerEl) first.' );
			return;

		}

		this._active = handle;
		this._container.appendChild( handle.overlay );

		// Scroll lock
		document.body.style.overflow = 'hidden';

		// Capture trigger focus
		handle._triggerEl = document.activeElement;

		// Show overlay
		requestAnimationFrame( () => {

			handle.overlay.classList.add( 'kk-modal-overlay--open' );
			handle.overlay.setAttribute( 'aria-hidden', 'false' );

			// Move focus into dialog, then first focusable child
			handle.dialog.focus();
			requestAnimationFrame( () => {

				const first = _firstFocusable( handle.dialog );
				if ( first ) first.focus();

			} );

		} );

		// Global keyboard handler
		document.addEventListener( 'keydown', this._onKeyDown, true );

		handle.overlay.dispatchEvent( new CustomEvent( 'kk:modal:open', {
			bubbles: true, composed: true,
			detail: { uid: handle.uid },
		} ) );

	}

	_close( handle, reason ) {

		if ( ! handle || handle._closed ) return;
		handle._closed = true;

		handle.overlay.classList.remove( 'kk-modal-overlay--open' );
		handle.overlay.setAttribute( 'aria-hidden', 'true' );

		handle.overlay.dispatchEvent( new CustomEvent( 'kk:modal:close', {
			bubbles: true, composed: true,
			detail: { uid: handle.uid, reason },
		} ) );

		const onTransitionEnd = () => {

			handle.overlay.removeEventListener( 'transitionend', onTransitionEnd );
			handle.overlay.remove();
			if ( handle.onClose ) handle.onClose();

		};

		handle.overlay.addEventListener( 'transitionend', onTransitionEnd );

		// Fallback if no CSS transition is defined
		setTimeout( onTransitionEnd, 400 );

		document.removeEventListener( 'keydown', this._onKeyDown, true );

		// Restore focus
		if ( handle._triggerEl && typeof handle._triggerEl.focus === 'function' ) {

			handle._triggerEl.focus();

		}

		// Scroll lock
		document.body.style.overflow = '';

		this._active = null;

		// Drain queue
		if ( this._queue.length > 0 ) {

			this._mount( this._queue.shift() );

		}

	}

	// ---------------------------------------------------------------------------
	// Focus trap
	// ---------------------------------------------------------------------------

	_onKeyDown( event ) {

		if ( ! this._active ) return;

		if ( event.key === 'Escape' ) {

			if ( this._active.dismissible ) {

				event.preventDefault();
				event.stopPropagation();
				this._close( this._active, 'escape' );

			} else {

				event.preventDefault();
				event.stopPropagation();

			}

			return;

		}

		if ( event.key === 'Tab' ) {

			_trapFocus( event, this._active.dialog );

		}

	}

}

// ---------------------------------------------------------------------------
// Modal handle
// ---------------------------------------------------------------------------

class _ModalHandle {

	constructor( { uid, overlay, dialog, body, closeBtn, footer, dismissible, onClose, service } ) {

		this.uid = uid;
		this.overlay = overlay;
		this.dialog = dialog;
		this._body = body;
		this._closeBtn = closeBtn;
		this._footer = footer;
		this.dismissible = dismissible;
		this.onClose = onClose;
		this._service = service;

		/** @type {Element | null} */
		this._triggerEl = null;

		this._closed = false;

	}

	close() {

		this._service._close( this, 'programmatic' );

	}

	setLoading( bool ) {

		if ( bool ) {

			this._body.classList.add( 'kk-modal__body--loading' );
			this._body.setAttribute( 'aria-busy', 'true' );

		} else {

			this._body.classList.remove( 'kk-modal__body--loading' );
			this._body.removeAttribute( 'aria-busy' );

		}

	}

	setBody( content ) {

		this._body.innerHTML = '';

		if ( content instanceof HTMLElement ) {

			this._body.appendChild( content );

		} else {

			this._body.innerHTML = content;

		}

	}

}

// ---------------------------------------------------------------------------
// Focus-trap helper
// ---------------------------------------------------------------------------

/**
 * Cycle Tab and Shift+Tab within `container`.
 *
 * @param {KeyboardEvent} event
 * @param {HTMLElement}   container
 */
function _trapFocus( event, container ) {

	const focusable = Array.from( container.querySelectorAll( FOCUSABLE_SELECTORS ) )
		.filter( el => ! el.closest( '[aria-disabled="true"]' ) && el.offsetParent !== null );

	if ( focusable.length === 0 ) {

		event.preventDefault();
		return;

	}

	const first = focusable[ 0 ];
	const last  = focusable[ focusable.length - 1 ];

	if ( event.shiftKey ) {

		if ( document.activeElement === first || document.activeElement === container ) {

			event.preventDefault();
			last.focus();

		}

	} else {

		if ( document.activeElement === last || document.activeElement === container ) {

			event.preventDefault();
			first.focus();

		}

	}

}

/**
 * Return the first keyboard-focusable descendant of `container`.
 *
 * @param {HTMLElement} container
 * @returns {HTMLElement | null}
 */
function _firstFocusable( container ) {

	return container.querySelector( FOCUSABLE_SELECTORS ) ?? null;

}

// ---------------------------------------------------------------------------
// Confirmation footer builder
// ---------------------------------------------------------------------------

/**
 * @param {ConfirmationConfig} cfg
 * @returns {HTMLElement}
 */
function _buildConfirmFooter( cfg ) {

	const actions = document.createElement( 'div' );
	actions.className = 'kk-confirm-dialog__actions';
	actions.setAttribute( 'role', 'group' );
	actions.setAttribute( 'aria-label', 'Confirm or cancel' );

	const cancelBtn = document.createElement( 'button' );
	cancelBtn.className = 'kk-cta-button kk-cta-button--ghost';
	cancelBtn.type = 'button';
	cancelBtn.setAttribute( 'data-action', 'confirm-cancel' );
	cancelBtn.innerHTML = `<span class="kk-cta-button__label">${cfg.cancelLabel ?? 'CANCEL'}</span>`;

	const confirmVariant = cfg.confirmVariant === 'primary' ? 'primary' : 'danger';
	const confirmBtn = document.createElement( 'button' );
	confirmBtn.className = `kk-cta-button kk-cta-button--${confirmVariant}`;
	confirmBtn.type = 'button';
	confirmBtn.setAttribute( 'data-action', 'confirm-proceed' );
	confirmBtn.innerHTML = `<span class="kk-cta-button__label">${cfg.confirmLabel ?? 'CONFIRM'}</span>`;

	actions.appendChild( cancelBtn );
	actions.appendChild( confirmBtn );

	return actions;

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ModalConfig
 * @property {string}                    [uid]
 * @property {string}                    title
 * @property {HTMLElement | string}      [body]
 * @property {HTMLElement | null}        [footer]
 * @property {boolean}                   [dismissible]
 * @property {boolean}                   [loading]
 * @property {Function}                  [onClose]
 */

/**
 * @typedef {object} ConfirmationConfig
 * @property {string}   [uid]
 * @property {string}   title
 * @property {string}   [body]
 * @property {string}   [confirmLabel]
 * @property {string}   [cancelLabel]
 * @property {'primary'|'danger'} [confirmVariant]
 * @property {string}   [confirmActionId]
 * @property {string}   [cancelActionId]
 * @property {Function} [onConfirm]
 * @property {Function} [onCancel]
 * @property {boolean}  [dismissible]
 */
