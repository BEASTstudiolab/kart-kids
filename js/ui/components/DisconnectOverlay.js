/**
 * DisconnectOverlay — Full-screen overlay shown on mid-race WebSocket disconnect.
 * Component for Unit 12 — Menu Production Ready plan.
 *
 * Shows a "Connection Lost" message with a countdown timer matching the server's
 * reconnect grace period. On reconnect the overlay dismisses; on timeout it
 * navigates to Home with an error toast.
 *
 * DOM structure:
 *   div.kk-disconnect-overlay[aria-hidden]
 *     div.kk-disconnect-overlay__content
 *       div.kk-disconnect-overlay__icon[aria-hidden="true"]
 *       h2.kk-disconnect-overlay__title
 *       p.kk-disconnect-overlay__message
 *       div.kk-disconnect-overlay__countdown
 *         span.kk-disconnect-overlay__countdown-value
 *
 * Usage:
 *   const overlay = new DisconnectOverlay();
 *   overlay.onTimeout(() => router.navigate('/home'));
 *   overlay.show(30);
 *   // on reconnect:
 *   overlay.onReconnect();
 *
 * CSS injection: static guard, one <style> tag per class.
 */

export class DisconnectOverlay {

	static _cssInjected = false;

	constructor() {

		this._el              = null;
		this._countdownEl     = null;
		this._timerId         = null;
		this._remaining       = 0;
		this._visible         = false;
		this._timeoutCallback = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( DisconnectOverlay._cssInjected ) return;
		DisconnectOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-disconnect-overlay {
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

			.kk-disconnect-overlay--visible {
				opacity: 1;
				pointer-events: auto;
			}

			.kk-disconnect-overlay__content {
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

			.kk-disconnect-overlay__icon {
				width: 48px;
				height: 48px;
				color: #d82c2c;
			}

			.kk-disconnect-overlay__icon svg {
				width: 100%;
				height: 100%;
			}

			.kk-disconnect-overlay__title {
				font-family: var(--font-display);
				font-size: clamp(2rem, 6vw, 3.4rem);
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: -0.08em;
				color: #0f1115;
				margin: 0;
			}

			.kk-disconnect-overlay__message {
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: 0.7rem;
				color: rgba(15,17,21,0.78);
				margin: 0;
				line-height: 1.7;
				text-transform: uppercase;
				letter-spacing: 0.14em;
			}

			.kk-disconnect-overlay__countdown {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: var(--space-1);
				margin-top: var(--space-2);
			}

			.kk-disconnect-overlay__countdown-label {
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: 0.62rem;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.18em;
				color: rgba(15,17,21,0.62);
			}

			.kk-disconnect-overlay__countdown-value {
				font-family: var(--font-display);
				font-size: clamp(3rem, 8vw, 4.8rem);
				font-weight: 900;
				color: #d82c2c;
				line-height: 1;
				letter-spacing: -0.08em;
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-disconnect-overlay {
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
		overlay.className = 'kk-disconnect-overlay';
		overlay.setAttribute( 'aria-hidden', 'true' );
		overlay.setAttribute( 'role', 'alert' );
		overlay.setAttribute( 'aria-live', 'assertive' );

		const content = document.createElement( 'div' );
		content.className = 'kk-disconnect-overlay__content';

		// Disconnect icon (wifi-off style)
		const icon = document.createElement( 'div' );
		icon.className = 'kk-disconnect-overlay__icon';
		icon.setAttribute( 'aria-hidden', 'true' );
		icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
		content.appendChild( icon );

		// Title
		const title = document.createElement( 'h2' );
		title.className = 'kk-disconnect-overlay__title';
		title.textContent = 'Connection Lost';
		content.appendChild( title );

		// Message
		const message = document.createElement( 'p' );
		message.className = 'kk-disconnect-overlay__message';
		message.textContent = 'Attempting to reconnect...';
		content.appendChild( message );

		// Countdown
		const countdown = document.createElement( 'div' );
		countdown.className = 'kk-disconnect-overlay__countdown';

		const countdownLabel = document.createElement( 'span' );
		countdownLabel.className = 'kk-disconnect-overlay__countdown-label';
		countdownLabel.textContent = 'TIMEOUT IN';
		countdown.appendChild( countdownLabel );

		const countdownValue = document.createElement( 'span' );
		countdownValue.className = 'kk-disconnect-overlay__countdown-value';
		countdownValue.textContent = '30';
		countdown.appendChild( countdownValue );
		this._countdownEl = countdownValue;

		content.appendChild( countdown );
		overlay.appendChild( content );
		this._el = overlay;

	}

	// ---------------------------------------------------------------------------
	// Timer
	// ---------------------------------------------------------------------------

	_startCountdown( seconds ) {

		this._remaining = seconds;
		this._updateCountdownDisplay();

		this._timerId = setInterval( () => {

			this._remaining -= 1;
			this._updateCountdownDisplay();

			if ( this._remaining <= 0 ) {

				this._stopCountdown();

				if ( this._timeoutCallback ) {
					this._timeoutCallback();
				}

			}

		}, 1000 );

	}

	_stopCountdown() {

		if ( this._timerId !== null ) {
			clearInterval( this._timerId );
			this._timerId = null;
		}

	}

	_updateCountdownDisplay() {

		if ( this._countdownEl ) {
			this._countdownEl.textContent = String( Math.max( 0, this._remaining ) );
		}

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} */
	get el() {

		return this._el;

	}

	/**
	 * Show the disconnect overlay and start the countdown timer.
	 *
	 * @param {number} [countdownSeconds]  Countdown duration (default 30)
	 */
	show( countdownSeconds = 30 ) {

		if ( this._visible ) return;
		this._visible = true;

		this._stopCountdown();

		if ( ! this._el.parentNode ) {
			document.body.appendChild( this._el );
		}

		this._el.setAttribute( 'aria-hidden', 'false' );

		requestAnimationFrame( () => {

			this._el.classList.add( 'kk-disconnect-overlay--visible' );

		} );

		this._startCountdown( countdownSeconds );

	}

	/**
	 * Hide the disconnect overlay (e.g. on successful reconnect).
	 */
	hide() {

		if ( ! this._visible ) return;
		this._visible = false;

		this._stopCountdown();
		this._el.classList.remove( 'kk-disconnect-overlay--visible' );
		this._el.setAttribute( 'aria-hidden', 'true' );

		const onEnd = () => {

			this._el.removeEventListener( 'transitionend', onEnd );
			if ( this._el.parentNode ) this._el.parentNode.removeChild( this._el );

		};

		this._el.addEventListener( 'transitionend', onEnd );
		setTimeout( onEnd, 400 );

	}

	/**
	 * Called when WebSocket reconnects successfully. Dismisses the overlay.
	 */
	onReconnect() {

		this.hide();

	}

	/**
	 * Register a callback for when the countdown reaches zero.
	 *
	 * @param {Function} callback
	 */
	onTimeout( callback ) {

		this._timeoutCallback = callback;

	}

	/**
	 * Clean up DOM, timer, and references.
	 */
	dispose() {

		this._stopCountdown();

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._el              = null;
		this._countdownEl     = null;
		this._timeoutCallback = null;

	}

}
