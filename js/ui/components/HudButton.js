/**
 * HudButton — Sci-fi cockpit-style button with diagonal cut corners.
 *
 * SVG frame with clipped angular corners, gradient fill, corner dot
 * decorations, glow hover, and HyperText scramble on the label.
 *
 * Interface:
 *   new HudButton({ text, color, onClick })
 *   .el        — root DOM element
 *   .setText() — update text (triggers scramble)
 *   .dispose() — cleanup
 */

import { HyperText } from '../effects/HyperText.js';

export class HudButton {

	static _cssInjected = false;

	/**
	 * @param {object}   config
	 * @param {string}   config.text     Button label text.
	 * @param {string}   [config.color]  CSS custom property name (default: '--color-accent-orange').
	 * @param {Function} [config.onClick] Click handler.
	 */
	constructor( config = {} ) {

		this._text = config.text || '';
		this._color = config.color || '--color-accent-orange';
		this._onClick = config.onClick || null;

		/** @type {HTMLElement|null} */
		this._el = null;

		/** @type {HTMLElement|null} */
		this._labelEl = null;

		/** @type {HyperText|null} */
		this._hyperText = null;

		this._injectCSS();
		this._build();
		this._bindEvents();

	}

	// ---------------------------------------------------------------------------
	// CSS injection
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( HudButton._cssInjected ) return;
		HudButton._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			.kk-hud-button {
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				background: none;
				border: none;
				padding: 0;
				cursor: pointer;
				user-select: none;
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
				transition:
					transform var(--duration-fast, 100ms) var(--ease-standard, ease),
					filter var(--duration-fast, 100ms) var(--ease-standard, ease);
			}

			.kk-hud-button:hover {
				transform: scale( 1.02 );
			}

			.kk-hud-button:active {
				transform: scale( 0.98 );
			}

			/* SVG frame */

			.kk-hud-button__svg {
				display: block;
				width: 100%;
				height: 100%;
				filter: drop-shadow( 0 0 8px var(--hud-glow-color, rgba( 255, 107, 0, 0.4 )) );
				transition: filter var(--duration-fast, 100ms) var(--ease-standard, ease);
			}

			.kk-hud-button:hover .kk-hud-button__svg {
				filter:
					drop-shadow( 0 0 12px var(--hud-glow-color, rgba( 255, 107, 0, 0.5 )) )
					drop-shadow( 0 0 24px var(--hud-glow-color, rgba( 255, 107, 0, 0.3 )) );
			}

			/* Label overlay */

			.kk-hud-button__label {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xl, 1.25rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.14em);
				color: var(--color-white, #fff);
				pointer-events: none;
				z-index: 1;
			}

			/* Shimmer sweep on hover */

			.kk-hud-button__shimmer {
				position: absolute;
				inset: 0;
				overflow: hidden;
				pointer-events: none;
				z-index: 2;
			}

			.kk-hud-button__shimmer::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				width: 50%;
				height: 100%;
				background: linear-gradient(
					90deg,
					transparent,
					rgba( 255, 255, 255, 0.2 ),
					transparent
				);
				transform: translateX( -100% ) skewX( -20deg );
				pointer-events: none;
			}

			.kk-hud-button:hover .kk-hud-button__shimmer::before {
				animation: kk-shimmer-sweep 0.6s ease-out;
			}

			/* Glow pulse idle */

			.kk-hud-button__svg {
				animation: kk-hud-glow-pulse 2s ease-in-out infinite;
			}

			@keyframes kk-hud-glow-pulse {
				0%, 100% {
					filter: drop-shadow( 0 0 8px var(--hud-glow-color, rgba( 255, 107, 0, 0.35 )) );
				}
				50% {
					filter: drop-shadow( 0 0 14px var(--hud-glow-color, rgba( 255, 107, 0, 0.5 )) );
				}
			}

			/* Dimmed state (e.g. EQUIPPED) */

			.kk-hud-button--dimmed {
				opacity: 0.6;
			}

			.kk-hud-button--dimmed .kk-hud-button__svg {
				animation: none;
				filter: drop-shadow( 0 0 4px var(--hud-glow-color, rgba( 255, 107, 0, 0.2 )) );
			}

			.kk-hud-button--dimmed:hover .kk-hud-button__svg {
				filter: drop-shadow( 0 0 6px var(--hud-glow-color, rgba( 255, 107, 0, 0.3 )) );
			}

			/* Reduced motion */

			@media ( prefers-reduced-motion: reduce ) {

				.kk-hud-button__svg {
					animation: none;
				}

				.kk-hud-button:hover .kk-hud-button__shimmer::before {
					animation: none;
				}

				.kk-hud-button:hover {
					transform: none;
				}

				.kk-hud-button:active {
					transform: none;
				}

			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'kk-hud-button';

		// Resolve the CSS color for the gradient.
		const colorVar = `var(${ this._color })`;

		// Set glow color as a CSS variable on the element.
		// Derive a glow RGBA from the accent name.
		const glowMap = {
			'--color-accent-orange': 'rgba( 255, 107, 0, 0.45 )',
			'--color-accent-cyan':   'rgba( 0, 212, 232, 0.45 )',
			'--color-accent-yellow': 'rgba( 255, 214, 0, 0.45 )',
			'--color-accent-pink':   'rgba( 255, 58, 140, 0.45 )',
		};
		btn.style.setProperty( '--hud-glow-color', glowMap[ this._color ] || glowMap[ '--color-accent-orange' ] );

		// SVG hexagonal / angular button shape.
		// Dimensions: 220 x 60, with diagonal cuts on top-right and bottom-left.
		const CUT = 12;
		const W = 220;
		const H = 60;

		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS( svgNS, 'svg' );
		svg.setAttribute( 'class', 'kk-hud-button__svg' );
		svg.setAttribute( 'viewBox', `0 0 ${ W } ${ H }` );
		svg.setAttribute( 'width', '220' );
		svg.setAttribute( 'height', '60' );
		svg.setAttribute( 'aria-hidden', 'true' );

		// Gradient definition.
		const defs = document.createElementNS( svgNS, 'defs' );

		const grad = document.createElementNS( svgNS, 'linearGradient' );
		grad.setAttribute( 'id', 'hud-grad' );
		grad.setAttribute( 'x1', '0%' );
		grad.setAttribute( 'y1', '0%' );
		grad.setAttribute( 'x2', '100%' );
		grad.setAttribute( 'y2', '100%' );

		const stop1 = document.createElementNS( svgNS, 'stop' );
		stop1.setAttribute( 'offset', '0%' );
		stop1.setAttribute( 'style', `stop-color: ${ colorVar }; stop-opacity: 0.9` );

		const stop2 = document.createElementNS( svgNS, 'stop' );
		stop2.setAttribute( 'offset', '100%' );
		stop2.setAttribute( 'style', `stop-color: ${ colorVar }; stop-opacity: 0.6` );

		grad.appendChild( stop1 );
		grad.appendChild( stop2 );
		defs.appendChild( grad );
		svg.appendChild( defs );

		// Main path — angular shape with diagonal cuts.
		//
		//   (CUT, 0) ---- (W - CUT, 0)
		//  /                            \
		// (0, CUT)                  (W, CUT)
		// |                              |
		// (0, H - CUT)              (W, H - CUT)
		//  \                            /
		//   (CUT, H) ---- (W - CUT, H)
		//
		const pathD = [
			`M ${ CUT } 0`,
			`L ${ W - CUT } 0`,
			`L ${ W } ${ CUT }`,
			`L ${ W } ${ H - CUT }`,
			`L ${ W - CUT } ${ H }`,
			`L ${ CUT } ${ H }`,
			`L 0 ${ H - CUT }`,
			`L 0 ${ CUT }`,
			'Z',
		].join( ' ' );

		const path = document.createElementNS( svgNS, 'path' );
		path.setAttribute( 'd', pathD );
		path.setAttribute( 'fill', 'url(#hud-grad)' );
		path.setAttribute( 'stroke', colorVar );
		path.setAttribute( 'stroke-width', '1.5' );
		path.setAttribute( 'stroke-opacity', '0.7' );
		svg.appendChild( path );

		// Corner dot decorations — top-right cluster (4 dots).
		const dotR = 1.4;
		const dots = [
			// Top-right cluster.
			{ cx: W - 18, cy: 10 },
			{ cx: W - 12, cy: 10 },
			{ cx: W - 18, cy: 16 },
			{ cx: W - 12, cy: 16 },
			// Left-side pair.
			{ cx: 10, cy: H - 16 },
			{ cx: 10, cy: H - 10 },
		];

		for ( const d of dots ) {

			const circle = document.createElementNS( svgNS, 'circle' );
			circle.setAttribute( 'cx', String( d.cx ) );
			circle.setAttribute( 'cy', String( d.cy ) );
			circle.setAttribute( 'r', String( dotR ) );
			circle.setAttribute( 'fill', colorVar );
			circle.setAttribute( 'opacity', '0.5' );
			svg.appendChild( circle );

		}

		btn.appendChild( svg );

		// Text label.
		const label = document.createElement( 'span' );
		label.className = 'kk-hud-button__label';
		label.textContent = this._text;
		btn.appendChild( label );
		this._labelEl = label;

		// HyperText effect on the label.
		this._hyperText = new HyperText( label );

		// Shimmer overlay.
		const shimmer = document.createElement( 'span' );
		shimmer.className = 'kk-hud-button__shimmer';
		btn.appendChild( shimmer );

		this._el = btn;

	}

	// ---------------------------------------------------------------------------
	// Events
	// ---------------------------------------------------------------------------

	_bindEvents() {

		const btn = this._el;

		// Scramble on hover.
		btn.addEventListener( 'mouseenter', () => {

			if ( this._hyperText ) {

				this._hyperText.scrambleTo( this._text, 600 );

			}

		} );

		// Click handler.
		btn.addEventListener( 'click', ( e ) => {

			if ( typeof this._onClick === 'function' ) {

				this._onClick( e );

			}

		} );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLButtonElement} */
	get el() {

		return this._el;

	}

	/**
	 * Update button text. Triggers a scramble animation.
	 *
	 * @param {string} text  New label text.
	 */
	setText( text ) {

		this._text = text;

		if ( this._hyperText ) {

			this._hyperText.scrambleTo( text, 800 );

		}

	}

	/**
	 * Toggle dimmed appearance (e.g. for EQUIPPED state).
	 *
	 * @param {boolean} dimmed
	 */
	setDimmed( dimmed ) {

		if ( this._el ) {

			this._el.classList.toggle( 'kk-hud-button--dimmed', dimmed );

		}

	}

	/**
	 * Cleanup.
	 */
	dispose() {

		if ( this._hyperText ) {

			this._hyperText.dispose();
			this._hyperText = null;

		}

		if ( this._el && this._el.parentNode ) {

			this._el.parentNode.removeChild( this._el );

		}

		this._el = null;
		this._labelEl = null;

	}

}
