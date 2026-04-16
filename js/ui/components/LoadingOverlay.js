/**
 * LoadingOverlay — Full-screen overlay used for startup, race loading, and
 * other blocking async transitions.
 *
 * DOM structure:
 *   div.kk-loading-overlay[aria-hidden]
 *     div.kk-loading-overlay__content
 *       div.kk-loading-overlay__spinner[aria-hidden="true"]
 *       p.kk-loading-overlay__brand
 *       p.kk-loading-overlay__phase
 *       p.kk-loading-overlay__message
 *       p.kk-loading-overlay__detail
 *       div.kk-loading-overlay__progress[role="progressbar"]
 *       button.kk-loading-overlay__cancel  (optional in loading state)
 *       p.kk-loading-overlay__error        (error state)
 *       button.kk-loading-overlay__return  (error state)
 *
 * Usage:
 *   const overlay = new LoadingOverlay( { variant: 'brand-bar' } );
 *   overlay.show();
 *   overlay.setState( {
 *     phase: 'Loading Models',
 *     message: 'Preparing race',
 *     detail: 'Fetching track assets',
 *     progress: 0.4,
 *     determinate: true,
 *     progressText: '40%',
 *   } );
 *   overlay.showError( 'Track failed to load' );
 *   overlay.hide();
 *
 * Variants:
 *   - 'brand-bar' (default): visible UI is just the game brand plus the bar
 *   - 'verbose': shows contextual loading copy and optional cancel control
 */

export class LoadingOverlay {

	static _cssInjected = false;

	/**
	 * @param {object}   [config]
	 * @param {string}   [config.message]    Loading message (default 'Loading track...')
	 * @param {string}   [config.detail]     Supporting detail line
	 * @param {string}   [config.phase]      Small monospace phase label
	 * @param {string}   [config.brandText]  Visible brand title for minimal mode
	 * @param {'brand-bar'|'verbose'} [config.variant] Presentation style
	 * @param {Function} [config.onCancel]   Called when Cancel/Return is clicked
	 */
	constructor( config = {} ) {

		this._config = {
			message: 'Loading track...',
			detail: '',
			phase: '',
			brandText: 'KART KIDS',
			variant: 'brand-bar',
			onCancel: null,
			...config,
		};

		this._el = null;
		this._spinnerEl = null;
		this._brandEl = null;
		this._phaseEl = null;
		this._messageEl = null;
		this._detailEl = null;
		this._progressEl = null;
		this._progressFillEl = null;
		this._progressValueEl = null;
		this._cancelBtn = null;
		this._errorEl = null;
		this._returnBtn = null;
		this._visible = false;
		this._isErrorState = false;
		this._state = {
			message: this._config.message,
			detail: this._config.detail,
			phase: this._config.phase,
			progress: null,
			determinate: false,
			progressText: '',
		};

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
				padding: 24px;
				background:
					radial-gradient(circle at 22% 18%, rgba(216,44,44,0.18) 0%, rgba(216,44,44,0) 34%),
					linear-gradient(180deg, rgba(7,8,10,0.9) 0%, rgba(7,8,10,0.96) 100%);
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
				align-items: flex-start;
				gap: var(--space-4);
				padding: 1rem;
				width: min(28rem, 100%);
				text-align: left;
				background: rgba(247,243,233,0.96);
				color: #0f1115;
				border: 1px solid rgba(247,243,233,0.96);
				box-shadow: 0 28px 80px rgba(0,0,0,0.42);
				clip-path: polygon(0 0, 100% 0, 100% 92%, 96% 100%, 0 100%);
			}

			@keyframes kk-loading-spin {
				0%   { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}

			.kk-loading-overlay__spinner {
				width: 48px;
				height: 48px;
				border: 3px solid rgba(15,17,21,0.16);
				border-top-color: #d82c2c;
				animation: kk-loading-spin 0.8s linear infinite;
			}

			.kk-loading-overlay__brand {
				display: none;
				margin: 0;
				font-family: var(--font-display);
				font-size: clamp(3rem, 10vw, 5.8rem);
				font-weight: 900;
				line-height: 0.86;
				letter-spacing: -0.08em;
				text-transform: uppercase;
				color: #f7f3e9;
			}

			.kk-loading-overlay__phase,
			.kk-loading-overlay__detail,
			.kk-loading-overlay__progress-value,
			.kk-loading-overlay__error,
			.kk-loading-overlay__cancel,
			.kk-loading-overlay__return {
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				text-transform: uppercase;
				letter-spacing: 0.16em;
			}

			.kk-loading-overlay__phase {
				font-size: 0.68rem;
				font-weight: 700;
				color: rgba(15, 17, 21, 0.52);
				margin: 0;
			}

			.kk-loading-overlay__message {
				font-family: var(--font-display);
				font-size: clamp(2rem, 6vw, 3.4rem);
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: -0.08em;
				color: #0f1115;
				margin: 0;
			}

			.kk-loading-overlay__detail {
				font-size: 0.68rem;
				line-height: 1.7;
				color: rgba(15, 17, 21, 0.72);
				margin: 0;
			}

			.kk-loading-overlay__progress {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 0.85rem;
				align-items: center;
				width: 100%;
			}

			.kk-loading-overlay__progress-track {
				position: relative;
				height: 0.45rem;
				overflow: hidden;
				background: rgba(15,17,21,0.12);
			}

			.kk-loading-overlay__progress-fill {
				height: 100%;
				width: 0%;
				background: linear-gradient(90deg, #0f1115 0%, #d82c2c 100%);
				transition: width var(--duration-slow) var(--ease-standard);
			}

			.kk-loading-overlay__progress-fill--indeterminate {
				background-image:
					repeating-linear-gradient(
						-45deg,
						rgba(247,243,233,0.00) 0,
						rgba(247,243,233,0.00) 10px,
						rgba(247,243,233,0.20) 10px,
						rgba(247,243,233,0.20) 20px
					),
					linear-gradient(90deg, #0f1115 0%, #d82c2c 100%);
				background-size: 22px 22px, 100% 100%;
				animation: kk-loading-stripes 0.9s linear infinite;
			}

			@keyframes kk-loading-stripes {
				0% { background-position: 0 0, 0 0; }
				100% { background-position: 22px 0, 0 0; }
			}

			.kk-loading-overlay__progress-value {
				font-size: 0.72rem;
				font-weight: 700;
				color: rgba(15, 17, 21, 0.82);
				white-space: nowrap;
			}

			.kk-loading-overlay__cancel,
			.kk-loading-overlay__return {
				font-size: 0.72rem;
				font-weight: 700;
				color: #f7f3e9;
				background: #0f1115;
				border: 1px solid #0f1115;
				padding: 0.8rem 1.2rem;
				cursor: pointer;
				min-height: var(--hit-target-min);
				transition:
					color var(--duration-normal) var(--ease-standard),
					background var(--duration-normal) var(--ease-standard),
					border-color var(--duration-normal) var(--ease-standard);
			}

			.kk-loading-overlay__cancel:hover,
			.kk-loading-overlay__return:hover {
				background: #d82c2c;
				border-color: #d82c2c;
			}

			.kk-loading-overlay__error {
				font-size: 0.68rem;
				color: #d82c2c;
				margin: 0;
				line-height: 1.7;
			}

			.kk-loading-overlay__return {
				background: #d82c2c;
				border-color: #d82c2c;
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__content {
				align-items: center;
				gap: 1rem;
				width: min(24rem, calc(100vw - 48px));
				padding: 0;
				text-align: center;
				background: none;
				border: 0;
				box-shadow: none;
				clip-path: none;
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__brand {
				display: block;
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__spinner {
				display: none;
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__phase,
			.kk-loading-overlay--brand-bar .kk-loading-overlay__message,
			.kk-loading-overlay--brand-bar .kk-loading-overlay__detail,
			.kk-loading-overlay--brand-bar .kk-loading-overlay__progress-value {
				position: absolute;
				width: 1px;
				height: 1px;
				padding: 0;
				margin: -1px;
				overflow: hidden;
				clip: rect( 0, 0, 0, 0 );
				white-space: nowrap;
				border: 0;
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__progress {
				grid-template-columns: minmax( 0, 1fr );
				gap: 0;
				width: min(24rem, calc(100vw - 48px));
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__progress-track {
				height: 0.625rem;
				background: rgba( 247, 243, 233, 0.14 );
				border: 1px solid rgba( 247, 243, 233, 0.18 );
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__progress-fill {
				background: linear-gradient( 90deg, #f7f3e9 0%, #d82c2c 100% );
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__cancel,
			.kk-loading-overlay--brand-bar .kk-loading-overlay__return {
				align-self: center;
			}

			.kk-loading-overlay--brand-bar .kk-loading-overlay__error {
				align-self: center;
				max-width: min(24rem, calc(100vw - 48px));
				text-align: center;
				color: #f7f3e9;
			}

			.kk-loading-overlay--brand-bar.kk-loading-overlay--error .kk-loading-overlay__progress {
				display: none;
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-loading-overlay__spinner {
					animation: none;
					border-top-color: var(--color-accent-orange);
					opacity: 0.7;
				}

				.kk-loading-overlay__progress-fill {
					transition: none;
				}

				.kk-loading-overlay__progress-fill--indeterminate {
					animation: none;
				}

				.kk-loading-overlay {
					transition: none;
				}
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
		overlay.classList.add( `kk-loading-overlay--${ this._config.variant }` );
		overlay.setAttribute( 'aria-hidden', 'true' );
		overlay.setAttribute( 'role', 'alert' );
		overlay.setAttribute( 'aria-live', 'assertive' );

		const content = document.createElement( 'div' );
		content.className = 'kk-loading-overlay__content';

		const spinner = document.createElement( 'div' );
		spinner.className = 'kk-loading-overlay__spinner';
		spinner.setAttribute( 'aria-hidden', 'true' );
		content.appendChild( spinner );
		this._spinnerEl = spinner;

		const brand = document.createElement( 'p' );
		brand.className = 'kk-loading-overlay__brand';
		brand.textContent = this._config.brandText;
		content.appendChild( brand );
		this._brandEl = brand;

		const phase = document.createElement( 'p' );
		phase.className = 'kk-loading-overlay__phase';
		content.appendChild( phase );
		this._phaseEl = phase;

		const message = document.createElement( 'p' );
		message.className = 'kk-loading-overlay__message';
		content.appendChild( message );
		this._messageEl = message;

		const detail = document.createElement( 'p' );
		detail.className = 'kk-loading-overlay__detail';
		content.appendChild( detail );
		this._detailEl = detail;

		const progress = document.createElement( 'div' );
		progress.className = 'kk-loading-overlay__progress';
		progress.setAttribute( 'role', 'progressbar' );
		progress.setAttribute( 'aria-label', 'Loading progress' );
		content.appendChild( progress );
		this._progressEl = progress;

		const progressTrack = document.createElement( 'div' );
		progressTrack.className = 'kk-loading-overlay__progress-track';
		progress.appendChild( progressTrack );

		const progressFill = document.createElement( 'div' );
		progressFill.className = 'kk-loading-overlay__progress-fill';
		progressTrack.appendChild( progressFill );
		this._progressFillEl = progressFill;

		const progressValue = document.createElement( 'span' );
		progressValue.className = 'kk-loading-overlay__progress-value';
		progressValue.setAttribute( 'aria-hidden', 'true' );
		progress.appendChild( progressValue );
		this._progressValueEl = progressValue;

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

		const errorEl = document.createElement( 'p' );
		errorEl.className = 'kk-loading-overlay__error';
		errorEl.hidden = true;
		content.appendChild( errorEl );
		this._errorEl = errorEl;

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
		this._renderState();

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
		this._isErrorState = false;

		this._spinnerEl.hidden = this._config.variant === 'brand-bar';
		this._cancelBtn.hidden = typeof this._config.onCancel !== 'function';
		this._errorEl.hidden = true;
		this._returnBtn.hidden = true;
		this._renderState();

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
	 * Update the current loading copy and progress state.
	 *
	 * @param {object} [nextState]
	 * @param {string} [nextState.message]
	 * @param {string} [nextState.detail]
	 * @param {string} [nextState.phase]
	 * @param {number|null} [nextState.progress]  Normalized 0..1 progress
	 * @param {boolean} [nextState.determinate]
	 * @param {string} [nextState.progressText]
	 */
	setState( nextState = {} ) {

		this._isErrorState = false;

		if ( nextState.message !== undefined ) {

			this._state.message = String( nextState.message || this._config.message );

		}

		if ( nextState.detail !== undefined ) {

			this._state.detail = String( nextState.detail || '' );

		}

		if ( nextState.phase !== undefined ) {

			this._state.phase = String( nextState.phase || '' );

		}

		if ( nextState.progress !== undefined ) {

			const numericProgress = Number( nextState.progress );
			this._state.progress = Number.isFinite( numericProgress )
				? Math.max( 0, Math.min( 1, numericProgress ) )
				: null;

		}

		if ( nextState.determinate !== undefined ) {

			this._state.determinate = !! nextState.determinate;

		}

		if ( nextState.progressText !== undefined ) {

			this._state.progressText = String( nextState.progressText || '' );

		}

		this._renderState();

	}

	/**
	 * Switch to error state: hide spinner, show error message and return button.
	 *
	 * @param {string} message  Error message to display
	 */
	showError( message ) {

		this.setState( {
			phase: 'Error',
			message: 'Loading Failed',
			detail: '',
			progress: null,
			determinate: false,
			progressText: '',
		} );
		this._isErrorState = true;
		this._spinnerEl.hidden = true;
		this._cancelBtn.hidden = true;
		this._errorEl.textContent = message;
		this._errorEl.hidden = false;
		this._returnBtn.hidden = typeof this._config.onCancel !== 'function';
		this._renderState();

		if ( ! this._returnBtn.hidden ) requestAnimationFrame( () => {

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

		this._el = null;
		this._spinnerEl = null;
		this._brandEl = null;
		this._phaseEl = null;
		this._messageEl = null;
		this._detailEl = null;
		this._progressEl = null;
		this._progressFillEl = null;
		this._progressValueEl = null;
		this._cancelBtn = null;
		this._errorEl = null;
		this._returnBtn = null;

	}

	_renderState() {

		if ( ! this._el ) return;

		this._el.classList?.toggle?.( 'kk-loading-overlay--error', this._isErrorState );

		if ( this._brandEl ) this._brandEl.textContent = this._config.brandText;

		if ( this._messageEl ) this._messageEl.textContent = this._state.message || this._config.message;

		if ( this._phaseEl ) {

			this._phaseEl.textContent = this._state.phase;
			this._phaseEl.hidden = ! this._state.phase;

		}

		if ( this._detailEl ) {

			this._detailEl.textContent = this._state.detail;
			this._detailEl.hidden = ! this._state.detail;

		}

		this._renderProgress();

	}

	_renderProgress() {

		if ( ! this._progressEl || ! this._progressFillEl || ! this._progressValueEl ) return;

		const hasProgress = Number.isFinite( this._state.progress );
		const visualProgress = hasProgress ? this._state.progress : 0.28;
		const progressPercent = Math.round( visualProgress * 100 );
		const displayText = this._state.progressText ||
			( hasProgress
				? `${ progressPercent }%`
				: ( this._state.determinate ? '0%' : '...' ) );

		this._progressFillEl.style.width = `${ progressPercent }%`;
		this._progressFillEl.classList?.toggle?.(
			'kk-loading-overlay__progress-fill--indeterminate',
			! this._state.determinate
		);

		this._progressEl.setAttribute( 'aria-valuemin', '0' );
		this._progressEl.setAttribute( 'aria-valuemax', '100' );

		if ( hasProgress ) {

			this._progressEl.setAttribute( 'aria-valuenow', String( progressPercent ) );

		} else if ( this._progressEl.removeAttribute ) {

			this._progressEl.removeAttribute( 'aria-valuenow' );

		} else {

			this._progressEl.setAttribute( 'aria-valuenow', '' );

		}

		this._progressEl.setAttribute( 'aria-valuetext', displayText );
		this._progressValueEl.textContent = displayText;

	}

}
