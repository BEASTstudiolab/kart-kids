/**
 * ConfirmationDialog — Two-button Yes/No modal for destructive or high-stakes actions.
 * Component #11 per COMPONENT_SPEC.md
 *
 * Extends ModalDialog. Footer is always rendered with exactly two CTAButtons.
 * Default focused button on open: Cancel (safer default).
 *
 * DOM added to footer:
 *   div.kk-confirm-dialog__actions[role="group"][aria-label="Confirm or cancel"]
 *     button.kk-cta-button.kk-cta-button--ghost[data-action="confirm-cancel"]
 *     button.kk-cta-button.kk-cta-button--danger|primary[data-action="confirm-proceed"]
 *
 * Events emitted (own):
 *   kk:confirm-dialog:confirm  →  detail: { uid, confirmActionId }
 *   kk:confirm-dialog:cancel   →  detail: { uid, cancelActionId }
 *
 * Also inherits:
 *   kk:modal:open   →  detail: { uid }
 *   kk:modal:close  →  detail: { uid, reason }
 *
 * CSS injection: calls super._injectCSS() for base styles, then injects own styles
 * with its own static guard.
 */

import { ModalDialog } from './ModalDialog.js';

export class ConfirmationDialog extends ModalDialog {

	static _confirmCssInjected = false;

	/**
	 * @param {object} config
	 * @param {string}                    [config.uid]
	 * @param {string}                     config.title
	 * @param {string}                    [config.body]
	 * @param {string}                    [config.confirmLabel]    default 'CONFIRM'
	 * @param {string}                    [config.cancelLabel]     default 'CANCEL'
	 * @param {'primary'|'danger'}        [config.confirmVariant]  default 'danger'
	 * @param {string}                    [config.confirmActionId]
	 * @param {string}                    [config.cancelActionId]
	 * @param {Function}                  [config.onConfirm]
	 * @param {Function}                  [config.onCancel]
	 * @param {boolean}                   [config.dismissible]     default true
	 */
	constructor( config = {} ) {

		const fullConfig = {
			confirmLabel:    'CONFIRM',
			cancelLabel:     'CANCEL',
			confirmVariant:  'danger',
			confirmActionId: '',
			cancelActionId:  '',
			onConfirm:       null,
			onCancel:        null,
			...config,
			// Build the footer element before calling super so it lands in the DOM
			footer: null,
		};

		// Build the actions footer element
		const actionsEl = ConfirmationDialog._buildActions( fullConfig );
		fullConfig.footer = actionsEl;

		super( fullConfig );

		this._actionsEl    = actionsEl;
		this._cancelBtn    = actionsEl.querySelector( '[data-action="confirm-cancel"]' );
		this._confirmBtn   = actionsEl.querySelector( '[data-action="confirm-proceed"]' );
		this._confirmConfig = fullConfig;

		this._injectConfirmCSS();
		this._bindConfirmEvents();

	}

	// ---------------------------------------------------------------------------
	// CSS (own styles — base styles come from ModalDialog._injectCSS via super)
	// ---------------------------------------------------------------------------

	_injectConfirmCSS() {

		if ( ConfirmationDialog._confirmCssInjected ) return;
		ConfirmationDialog._confirmCssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-confirm-dialog__actions {
				display: flex;
				flex-direction: row;
				align-items: center;
				justify-content: flex-end;
				gap: var(--space-3);
			}

			/* Arrow key navigation hint: lateral layout on mobile */
			@media (max-width: 480px) {
				.kk-confirm-dialog__actions {
					flex-direction: column-reverse;
					gap: var(--space-2);
				}

				.kk-confirm-dialog__actions .kk-cta-button {
					width: 100%;
					justify-content: center;
				}
			}

			/* Confirm button --loading modifier */
			.kk-confirm-dialog__actions [data-action="confirm-proceed"].kk-cta-button--loading
			.kk-cta-button__spinner {
				display: inline-block;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build actions footer
	// ---------------------------------------------------------------------------

	static _buildActions( config ) {

		const actions = document.createElement( 'div' );
		actions.className = 'kk-confirm-dialog__actions';
		actions.setAttribute( 'role', 'group' );
		actions.setAttribute( 'aria-label', 'Confirm or cancel' );

		// Cancel button
		const cancelBtn = document.createElement( 'button' );
		cancelBtn.type = 'button';
		cancelBtn.className = 'kk-cta-button kk-cta-button--ghost';
		cancelBtn.dataset.action = 'confirm-cancel';
		cancelBtn.innerHTML = `<span class="kk-cta-button__label">${config.cancelLabel ?? 'CANCEL'}</span>`;

		// Confirm button
		const variant    = config.confirmVariant === 'primary' ? 'primary' : 'danger';
		const confirmBtn = document.createElement( 'button' );
		confirmBtn.type  = 'button';
		confirmBtn.className = `kk-cta-button kk-cta-button--${variant}`;
		confirmBtn.dataset.action = 'confirm-proceed';
		// Spinner always in DOM, hidden via CSS until --loading class
		confirmBtn.innerHTML = `<span class="kk-cta-button__label">${config.confirmLabel ?? 'CONFIRM'}</span><span class="kk-cta-button__spinner" aria-hidden="true"></span>`;

		actions.appendChild( cancelBtn );
		actions.appendChild( confirmBtn );

		return actions;

	}

	// ---------------------------------------------------------------------------
	// Event wiring
	// ---------------------------------------------------------------------------

	_bindConfirmEvents() {

		const uid = this._uid;
		const cfg = this._confirmConfig;

		// Pressed states
		[ this._cancelBtn, this._confirmBtn ].forEach( ( btn ) => {

			btn.addEventListener( 'pointerdown', () => btn.classList.add( 'kk-cta-button--pressed' ) );

			const clearPressed = () => btn.classList.remove( 'kk-cta-button--pressed' );
			btn.addEventListener( 'pointerup', clearPressed );
			btn.addEventListener( 'pointercancel', clearPressed );

		} );

		// Cancel
		this._cancelBtn.addEventListener( 'click', () => {

			if ( cfg.onCancel ) cfg.onCancel();

			this._el.dispatchEvent( new CustomEvent( 'kk:confirm-dialog:cancel', {
				bubbles:  true,
				composed: true,
				detail:   { uid, cancelActionId: cfg.cancelActionId },
			} ) );

			this.close( 'programmatic' );

		} );

		// Confirm
		this._confirmBtn.addEventListener( 'click', () => {

			if ( cfg.onConfirm ) cfg.onConfirm();

			this._el.dispatchEvent( new CustomEvent( 'kk:confirm-dialog:confirm', {
				bubbles:  true,
				composed: true,
				detail:   { uid, confirmActionId: cfg.confirmActionId },
			} ) );

			this.close( 'programmatic' );

		} );

		// Arrow key lateral navigation between Cancel and Confirm
		this._actionsEl.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'ArrowLeft' || e.key === 'ArrowRight' ) {

				e.preventDefault();

				if ( document.activeElement === this._cancelBtn ) {
					this._confirmBtn.focus();
				} else {
					this._cancelBtn.focus();
				}

			}

		} );

	}

	// ---------------------------------------------------------------------------
	// Override open() to focus Cancel by default
	// ---------------------------------------------------------------------------

	open() {

		super.open();

		// Re-focus Cancel after ModalDialog focuses first focusable (which may be Cancel anyway,
		// but we ensure it explicitly in case layout changes).
		// Use double rAF to land after ModalDialog's double rAF.
		requestAnimationFrame( () => {

			requestAnimationFrame( () => {

				this._cancelBtn?.focus();

			} );

		} );

	}

	// ---------------------------------------------------------------------------
	// Public API extensions
	// ---------------------------------------------------------------------------

	/**
	 * Set the confirm button into a loading state while an async operation is in flight.
	 *
	 * @param {boolean} loading
	 */
	setConfirmLoading( loading ) {

		if ( loading ) {
			this._confirmBtn.classList.add( 'kk-cta-button--loading' );
			this._confirmBtn.setAttribute( 'aria-busy', 'true' );
			this._confirmBtn.setAttribute( 'aria-disabled', 'true' );
		} else {
			this._confirmBtn.classList.remove( 'kk-cta-button--loading' );
			this._confirmBtn.removeAttribute( 'aria-busy' );
			this._confirmBtn.removeAttribute( 'aria-disabled' );
		}

	}

	/**
	 * Update the confirm button label after construction.
	 *
	 * @param {string} label
	 */
	setConfirmLabel( label ) {

		const labelEl = this._confirmBtn.querySelector( '.kk-cta-button__label' );
		if ( labelEl ) labelEl.textContent = label;

	}

	/**
	 * Update the cancel button label after construction.
	 *
	 * @param {string} label
	 */
	setCancelLabel( label ) {

		const labelEl = this._cancelBtn.querySelector( '.kk-cta-button__label' );
		if ( labelEl ) labelEl.textContent = label;

	}

}
