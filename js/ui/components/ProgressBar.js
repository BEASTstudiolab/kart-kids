/**
 * ProgressBar — Horizontal fill bar communicating numeric progress within a known range.
 * Component #13 per COMPONENT_SPEC.md
 *
 * DOM structure:
 *   div.kk-progress-bar[role="meter"][aria-label][aria-valuenow][aria-valuemin][aria-valuemax][aria-valuetext]
 *     div.kk-progress-bar__track
 *       div.kk-progress-bar__fill[style="--kk-progress: 85%;"]
 *     span.kk-progress-bar__label-end[aria-hidden]  (optional)
 *
 * Fill width is driven by CSS custom property --kk-progress on __fill.
 * CSS handles the width transition.
 *
 * The bar is not focusable; role="meter" exposes value to screen readers.
 *
 * Variant modifiers on root: --xp, --challenge, --stat
 * Behavior modifiers on root: --animated, --striped
 *
 * CSS injection: static guard, one <style> tag per class.
 */

export class ProgressBar {

	static _cssInjected = false;

	/**
	 * @param {object} config
	 * @param {string}  config.label
	 * @param {number}  config.value
	 * @param {number}  [config.min]           default 0
	 * @param {number}  [config.max]           default 100
	 * @param {string|null} [config.valueText] human-readable; auto-generated if null
	 * @param {boolean} [config.showEndLabel]  renders __label-end; default false
	 * @param {boolean} [config.animated]      entrance fill animation; default true
	 * @param {'default'|'xp'|'challenge'|'stat'} [config.variant]
	 */
	constructor( config = {} ) {

		this._config = {
			label:        '',
			value:        0,
			min:          0,
			max:          100,
			valueText:    null,
			showEndLabel: false,
			animated:     true,
			variant:      'default',
			...config,
		};

		this._el      = null;
		this._fillEl  = null;
		this._labelEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( ProgressBar._cssInjected ) return;
		ProgressBar._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-progress-bar {
				display: flex;
				flex-direction: row;
				align-items: center;
				gap: var(--space-3);
				width: 100%;
			}

			.kk-progress-bar__track {
				flex: 1 1 auto;
				height: 0.375rem;  /* 6px */
				background: var(--color-ink-700);
				border-radius: var(--radius-pill);
				overflow: hidden;
				position: relative;
			}

			.kk-progress-bar__fill {
				height: 100%;
				width: var(--kk-progress, 0%);
				background: var(--color-accent-orange);
				border-radius: var(--radius-pill);
				transition: width var(--duration-slow) var(--ease-standard);
				transform-origin: left center;
			}

			/* --animated: fill starts at 0% and transitions to value on mount */
			.kk-progress-bar--animated .kk-progress-bar__fill {
				/* Width transitions handle animation; no keyframes needed */
			}

			/* --striped: moving diagonal stripe for indeterminate loading */
			.kk-progress-bar--striped .kk-progress-bar__fill {
				background-image: repeating-linear-gradient(
					-45deg,
					transparent,
					transparent 0.25rem,
					rgba(255, 255, 255, 0.15) 0.25rem,
					rgba(255, 255, 255, 0.15) 0.5rem
				);
				background-size: 1rem 1rem;
				animation: kk-progress-stripe 0.8s linear infinite;
			}

			@keyframes kk-progress-stripe {
				0%   { background-position: 0 0; }
				100% { background-position: 1rem 0; }
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-progress-bar__fill {
					transition: none;
				}
				.kk-progress-bar--striped .kk-progress-bar__fill {
					animation: none;
				}
			}

			/* Variant: XP — cyan accent */
			.kk-progress-bar--xp .kk-progress-bar__fill {
				background: var(--color-accent-cyan);
			}

			/* Variant: challenge — pink accent */
			.kk-progress-bar--challenge .kk-progress-bar__fill {
				background: var(--color-accent-pink);
			}

			/* Variant: stat — yellow accent */
			.kk-progress-bar--stat .kk-progress-bar__fill {
				background: var(--color-accent-yellow);
			}

			.kk-progress-bar__label-end {
				flex-shrink: 0;
				font-family: var(--font-mono);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				white-space: nowrap;
				min-width: 3rem;
				text-align: right;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const { label, value, min, max, valueText, showEndLabel, animated, variant } = this._config;

		const clamped   = this._clamp( value, min, max );
		const pct       = this._toPct( clamped, min, max );
		const autoText  = valueText ?? `${clamped} out of ${max}`;

		// Root
		const root = document.createElement( 'div' );
		root.className = 'kk-progress-bar';
		root.setAttribute( 'role', 'meter' );
		root.setAttribute( 'aria-label', label );
		root.setAttribute( 'aria-valuenow', String( clamped ) );
		root.setAttribute( 'aria-valuemin', String( min ) );
		root.setAttribute( 'aria-valuemax', String( max ) );
		root.setAttribute( 'aria-valuetext', autoText );

		if ( variant !== 'default' ) root.classList.add( `kk-progress-bar--${variant}` );
		if ( animated ) root.classList.add( 'kk-progress-bar--animated' );

		// Track
		const track = document.createElement( 'div' );
		track.className = 'kk-progress-bar__track';

		// Fill
		const fill = document.createElement( 'div' );
		fill.className = 'kk-progress-bar__fill';

		if ( animated ) {
			// Start at 0% and transition to value after mount via rAF
			fill.style.setProperty( '--kk-progress', '0%' );
		} else {
			fill.style.setProperty( '--kk-progress', pct );
		}

		track.appendChild( fill );
		root.appendChild( track );
		this._fillEl = fill;

		// Optional end label
		if ( showEndLabel ) {
			const labelEl = document.createElement( 'span' );
			labelEl.className = 'kk-progress-bar__label-end';
			labelEl.setAttribute( 'aria-hidden', 'true' );
			labelEl.textContent = `${clamped}/${max}`;
			root.appendChild( labelEl );
			this._labelEl = labelEl;
		}

		this._el = root;

		// Trigger entrance animation
		if ( animated ) {
			requestAnimationFrame( () => {
				fill.style.setProperty( '--kk-progress', pct );
			} );
		}

	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	_clamp( value, min, max ) {

		return Math.max( min, Math.min( max, value ) );

	}

	_toPct( value, min, max ) {

		if ( max === min ) return '0%';
		return `${( ( value - min ) / ( max - min ) ) * 100}%`;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} */
	get el() {

		return this._el;

	}

	/**
	 * Update the bar value.
	 * Triggers CSS width transition.
	 *
	 * @param {number} value
	 * @param {string|null} [valueText]  Override auto-generated aria-valuetext.
	 */
	setValue( value, valueText = null ) {

		const { min, max } = this._config;
		const clamped = this._clamp( value, min, max );
		const pct     = this._toPct( clamped, min, max );
		const autoText = valueText ?? `${clamped} out of ${max}`;

		this._config.value = clamped;

		this._el.setAttribute( 'aria-valuenow', String( clamped ) );
		this._el.setAttribute( 'aria-valuetext', autoText );
		this._fillEl.style.setProperty( '--kk-progress', pct );

		if ( this._labelEl ) {
			this._labelEl.textContent = `${clamped}/${max}`;
		}

	}

	/**
	 * Toggle the --striped modifier for an in-progress/indeterminate appearance.
	 *
	 * @param {boolean} striped
	 */
	setStriped( striped ) {

		this._el.classList.toggle( 'kk-progress-bar--striped', striped );

	}

	dispose() {

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._el      = null;
		this._fillEl  = null;
		this._labelEl = null;

	}

}
