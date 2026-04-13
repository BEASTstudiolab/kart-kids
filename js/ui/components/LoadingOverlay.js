/**
 * LoadingOverlay — Full-screen overlay shown between "Start Race" and game loop start.
 * Component for Unit 12 — Menu Production Ready plan.
 *
 * DOM structure:
 *   div.kk-loading-overlay[aria-hidden]
 *     div.kk-loading-overlay__content
 *       div.kk-loading-overlay__spinner[aria-hidden="true"]
 *       p.kk-loading-overlay__message
 *       button.kk-loading-overlay__cancel  (normal state)
 *       p.kk-loading-overlay__error        (error state)
 *       button.kk-loading-overlay__return   (error state)
 *
 * Usage:
 *   const overlay = new LoadingOverlay({ onCancel: () => router.navigate('/lobby') });
 *   overlay.show();
 *   // on error:
 *   overlay.showError('Track failed to load');
 *   // on success:
 *   overlay.hide();
 *
 * CSS injection: static guard, one <style> tag per class.
 */

export class LoadingOverlay {

	static _cssInjected = false;

	/**
	 * @param {object}   [config]
	 * @param {string}   [config.message]    Loading message (default 'Loading track...')
	 * @param {Function} [config.onCancel]   Called when Cancel button is clicked
	 */
	constructor( config = {} ) {

		this._config = {
			message:  'Loading track...',
			onCancel: null,
			...config,
		};

		this._el        = null;
		this._messageEl = null;
		this._cancelBtn = null;
		this._errorEl   = null;
		this._returnBtn = null;
		this._visible   = false;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( LoadingOverlay._cssInjected ) return;
		LoadingOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-loading-overlay {
				position: fixed;
				inset: 0;
				z-index: var(--z-modal);
				display: flex;
				align-items: center;
				justify-content: center;
				background: var(--color-panel-overlay);
				backdrop-filter: blur(6px);
				opacity: 0;
				pointer-events: none;
				transition: opacity var(--duration-moderate) var(--ease-standard);
			}

			.kk-loading-overlay--visible {
				opacity: 1;
				pointer-events: auto;
			}

			.kk-loading-overlay__content {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-5);
				padding: var(--space-8);
				max-width: 24rem;
				text-align: center;
			}

			/* Spinner */
			@keyframes kk-loading-spin {
				0%   { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}

			.kk-loading-overlay__spinner {
				width: 48px;
				height: 48px;
				border: 3px solid var(--color-ink-600);
				border-top-color: var(--color-accent-orange);
				border-radius: 50%;
				animation: kk-loading-spin 0.8s linear infinite;
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-loading-overlay__spinner {
					animation: none;
					border-top-color: var(--color-accent-orange);
					opacity: 0.7;
				}

				.kk-loading-overlay {
					transition: none;
				}
			}

			.kk-loading-overlay__message {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-white);
				margin: 0;
			}

			.kk-loading-overlay__cancel,
			.kk-loading-overlay__return {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-semibold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-ink-200);
				background: var(--color-ink-700);
				border: var(--border-thin) solid var(--color-panel-border-strong);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-6);
				cursor: pointer;
				min-height: var(--hit-target-min);
				transition:
					color var(--duration-normal) var(--ease-standard),
					background var(--duration-normal) var(--ease-standard);
			}

			.kk-loading-overlay__cancel:hover,
			.kk-loading-overlay__return:hover {
				color: var(--color-white);
				background: var(--color-ink-600);
			}

			.kk-loading-overlay__error {
				font-family: var(--font-ui);
				font-size: var(--text-base);
				color: var(--color-error);
				margin: 0;
				line-height: var(--leading-relaxed);
			}

			.kk-loading-overlay__return {
				color: var(--color-white);
				background: var(--color-error);
				border-color: var(--color-error);
			}

			.kk-loading-overlay__return:hover {
				background: #dc2626;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-loading-overlay';
		overlay.setAttribute( 'aria-hidden', 'true' );
		overlay.setAttribute( 'role', 'alert' );
		overlay.setAttribute( 'aria-live', 'assertive' );

		const content = document.createElement( 'div' );
		content.className = 'kk-loading-overlay__content';

		// Spinner
		const spinner = document.createElement( 'div' );
		spinner.className = 'kk-loading-overlay__spinner';
		spinner.setAttribute( 'aria-hidden', 'true' );
		content.appendChild( spinner );
		this._spinnerEl = spinner;

		// Message
		const message = document.createElement( 'p' );
		message.className = 'kk-loading-overlay__message';
		message.textContent = this._config.message;
		content.appendChild( message );
		this._messageEl = message;

		// Cancel button
		const cancelBtn = document.createElement( 'button' );
		cancelBtn.type = 'button';
		cancelBtn.className = 'kk-loading-overlay__cancel';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.setAttribute( 'aria-label', 'Cancel loading and return to lobby' );
		cancelBtn.addEventListener( 'click', () => {

			if ( this._config.onCancel ) this._config.onCancel();

		} );
		content.appendChild( cancelBtn );
		this._cancelBtn = cancelBtn;

		// Error message (hidden by default)
		const errorEl = document.createElement( 'p' );
		errorEl.className = 'kk-loading-overlay__error';
		errorEl.hidden = true;
		content.appendChild( errorEl );
		this._errorEl = errorEl;

		// Return to Menu button (hidden by default)
		const returnBtn = document.createElement( 'button' );
		returnBtn.type = 'button';
		returnBtn.className = 'kk-loading-overlay__return';
		returnBtn.textContent = 'Return to Menu';
		returnBtn.setAttribute( 'aria-label', 'Return to main menu' );
		returnBtn.hidden = true;
		returnBtn.addEventListener( 'click', () => {

			if ( this._config.onCancel ) this._config.onCancel();

		} );
		content.appendChild( returnBtn );
		this._returnBtn = returnBtn;

		overlay.appendChild( content );
		this._el = overlay;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} */
	get el() {

		return this._el;

	}

	/**
	 * Show the loading overlay with spinner and message.
	 * Mounts to document.body if not already in DOM.
	 */
	show() {

		if ( this._visible ) return;
		this._visible = true;

		// Reset to loading state
		this._spinnerEl.hidden = false;
		this._messageEl.textContent = this._config.message;
		this._cancelBtn.hidden = false;
		this._errorEl.hidden = true;
		this._returnBtn.hidden = true;

		if ( ! this._el.parentNode ) {
			document.body.appendChild( this._el );
		}

		this._el.setAttribute( 'aria-hidden', 'false' );

		requestAnimationFrame( () => {

			this._el.classList.add( 'kk-loading-overlay--visible' );

		} );

	}

	/**
	 * Hide the loading overlay.
	 */
	hide() {

		if ( ! this._visible ) return;
		this._visible = false;
		if ( ! this._el ) return;

		const overlayEl = this._el;
		overlayEl.classList.remove( 'kk-loading-overlay--visible' );
		overlayEl.setAttribute( 'aria-hidden', 'true' );

		let settled = false;
		let timeoutId = null;

		const onEnd = () => {

			if ( settled ) return;
			settled = true;
			if ( timeoutId !== null ) clearTimeout( timeoutId );
			overlayEl.removeEventListener( 'transitionend', onEnd );
			if ( overlayEl.parentNode ) overlayEl.parentNode.removeChild( overlayEl );

		};

		overlayEl.addEventListener( 'transitionend', onEnd );
		timeoutId = setTimeout( onEnd, 400 );

	}

	/**
	 * Switch to error state: hide spinner, show error message and return button.
	 *
	 * @param {string} message  Error message to display
	 */
	showError( message ) {

		this._spinnerEl.hidden = true;
		this._messageEl.textContent = 'Loading Failed';
		this._cancelBtn.hidden = true;
		this._errorEl.textContent = message;
		this._errorEl.hidden = false;
		this._returnBtn.hidden = false;

		// Focus the return button for keyboard users
		requestAnimationFrame( () => {

			this._returnBtn.focus();

		} );

	}

	/**
	 * Clean up DOM and references.
	 */
	dispose() {

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._el        = null;
		this._messageEl = null;
		this._cancelBtn = null;
		this._errorEl   = null;
		this._returnBtn = null;
		this._spinnerEl = null;

	}

}
