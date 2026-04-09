/**
 * HyperText — Cipher-decode text scramble effect.
 *
 * Wraps an existing DOM element and animates its text content
 * through random characters before resolving to the target string.
 *
 * Respects prefers-reduced-motion: if enabled, text is set instantly.
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class HyperText {

	/**
	 * @param {HTMLElement} element  The DOM element whose textContent to animate.
	 */
	constructor( element ) {

		/** @type {HTMLElement} */
		this._el = element;

		/** @type {number|null} */
		this._intervalId = null;

		/** @type {boolean} */
		this._reducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	}

	/**
	 * Animate from random characters to the target text.
	 *
	 * @param {string} text      Target text to resolve to.
	 * @param {number} duration  Total animation duration in ms (default 800).
	 */
	scrambleTo( text, duration = 800 ) {

		if ( ! this._el ) return;

		// Cancel any running animation.
		this._stop();

		// Reduced motion — set immediately.
		if ( this._reducedMotion ) {

			this._el.textContent = text;
			return;

		}

		const chars = text.split( '' );
		const len = chars.length;
		const tickInterval = 30;
		const totalTicks = Math.max( 1, Math.floor( duration / tickInterval ) );
		const lockStep = totalTicks / len;

		let tick = 0;

		this._intervalId = setInterval( () => {

			tick ++;

			const lockedCount = Math.min( len, Math.floor( tick / lockStep ) );
			let display = '';

			for ( let i = 0; i < len; i ++ ) {

				if ( i < lockedCount ) {

					display += chars[ i ];

				} else if ( chars[ i ] === ' ' ) {

					display += ' ';

				} else {

					display += CHARSET[ Math.floor( Math.random() * CHARSET.length ) ];

				}

			}

			this._el.textContent = display;

			if ( lockedCount >= len ) {

				this._stop();
				this._el.textContent = text;

			}

		}, tickInterval );

	}

	/**
	 * Stop any running scramble animation.
	 */
	_stop() {

		if ( this._intervalId !== null ) {

			clearInterval( this._intervalId );
			this._intervalId = null;

		}

	}

	/**
	 * Cleanup.
	 */
	dispose() {

		this._stop();
		this._el = null;

	}

}
