/**
 * GaragePanel — GARAGE tab content panel.
 *
 * Redesigned as a transparent overlay for the 3D kart turntable.
 * Left/right chevron arrows cycle through karts (replacing thumbnail grid).
 * Kart name, EQUIP button, stats panel, and secondary RACE button overlay
 * on top of the 3D canvas.
 *
 * Lifecycle: constructor(container, services), show(), hide(), dispose().
 *
 * Data sources:
 *   - VehicleRegistry  — getAllVehicles()
 *   - Settings         — getSelectedKartId(), setSelectedKartId()
 *   - services.garagePreview.setKart()  — 3D turntable sync
 *   - services.selectedMode             — mode for RACE shortcut
 *   - services.startRace()              — launch race
 *   - services.notification.show()      — toast feedback
 */

import { getAllVehicles }               from '../../VehicleRegistry.js';
import { Settings }                      from '../../Settings.js';
import { ProgressBar }                   from '../components/ProgressBar.js';
import { MarginalPanelHeader }           from '../components/MarginalPanelHeader.js';

/** Stat definitions — order matches the stats panel top-to-bottom. */
const STAT_DEFS = [
	{ key: 'speed',        label: 'SPEED',        statKey: 'speed' },
	{ key: 'handling',     label: 'HANDLING',      statKey: 'handling' },
	{ key: 'acceleration', label: 'ACCELERATION',  statKey: 'acceleration' },
	{ key: 'weight',       label: 'WEIGHT',        statKey: 'weight' },
	{ key: 'boost',        label: 'BOOST',         statKey: 'boost' },
];

const COLOR_CONTROL_DEFS = [
	{ key: 'vehicleColor', label: 'KART PAINT', fallback: '#f97316' },
];

export class GaragePanel {

	/**
	 * @param {HTMLElement} container  The #kk-panel-garage div created by AppShell.
	 * @param {object}      services   AppShell service bag.
	 */
	constructor( container, services ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {Settings} */
		this._settings = new Settings();

		/** @type {Array} All vehicles from registry. */
		this._vehicles = getAllVehicles();

		/** @type {number} Index into _vehicles for the currently viewed kart. */
		this._currentIndex = this._vehicles.findIndex(
			v => v.id === this._settings.getSelectedKartId()
		);
		if ( this._currentIndex < 0 ) this._currentIndex = 0;

		/** @type {Map<string, ProgressBar>} stat key -> ProgressBar instance */
		this._statBars = new Map();

		/** @type {HTMLElement|null} */
		this._carousel = null;

		/** @type {HTMLElement|null} */
		this._root = null;

		/** @type {Map<string, { input: HTMLInputElement, row: HTMLElement }>} */
		this._colorControls = new Map();

		/** @type {HTMLElement|null} */
		this._styleSummaryEl = null;

		/** @type {HTMLElement|null} */
		this._stylePanel = null;

		/** @type {Function|null} Bound keyboard handler for cleanup. */
		this._keyHandler = null;

		/** @type {Function|null} */
		this._settingsChangedHandler = null;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/** @returns {object} Currently viewed vehicle definition. */
	_currentVehicle() {

		return this._vehicles[ this._currentIndex ];

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( GaragePanel._cssInjected ) return;
		GaragePanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* ===================================================
			   Garage panel root — transparent overlay
			   =================================================== */

			.kk-garage {
				position: relative;
				width: 100%;
				height: 100%;
				overflow: hidden;
				pointer-events: none;
				--mv-cream: #F7F3E9;
				--mv-red: #D82C2C;
				--mv-dark: #0F1115;
				--mv-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
				--mv-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
				background: unset;
				background-color: unset;
				background-image: none;
			}

			.kk-garage,
			.kk-garage * {
				cursor: crosshair;
			}

			.kk-garage__scanlines,
			.kk-garage__vignette {
				display: none;
				position: absolute;
				inset: 0;
				pointer-events: none;
			}

			.kk-garage__scanlines {
				z-index: 1;
				opacity: 0.24;
				background:
					linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
					linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
				background-size: 100% 3px, 3px 100%;
			}

			.kk-garage__vignette {
				z-index: 2;
				box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.64);
			}

			.kk-garage__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(280px, var(--kk-customizer-deck-width, 20rem));
				grid-template-rows: auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 20px;
			}

			.kk-garage__interface > * {
				pointer-events: auto;
			}

			.kk-garage__header {
				grid-column: 1 / span 2;
			}

			.kk-garage__header.kk-mv-header {
				padding-top: 57px;
			}

			.kk-garage__stage {
				grid-column: 1 / span 2;
				grid-row: 2;
				min-height: 0;
				position: relative;
				pointer-events: none;
			}

			.kk-garage__stage > * {
				pointer-events: auto;
			}

			.kk-garage__deck {
				grid-column: 2;
				grid-row: 2;
				align-self: start;
				display: flex;
				flex-direction: column;
				gap: 20px;
				z-index: 4;
			}

			/* ===================================================
			   Kart carousel — horizontal scroll-snap strip
			   =================================================== */

			.kk-garage__carousel-wrap {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				z-index: 2;
			}

			.kk-garage__carousel {
				display: flex;
				gap: var(--space-3, 0.75rem);
				overflow-x: auto;
				overflow-y: hidden;
				scroll-snap-type: x mandatory;
				-webkit-overflow-scrolling: touch;
				padding: var(--space-2, 0.5rem) var(--space-6, 1.5rem);
				scrollbar-width: none;
			}

			.kk-garage__carousel::-webkit-scrollbar {
				display: none;
			}

			/* ===================================================
			   Kart card — dark glass with angular cuts
			   =================================================== */

			.kk-garage__card {
				flex: 0 0 120px;
				min-width: 120px;
				height: 72px;
				scroll-snap-align: center;
				position: relative;
				background: rgba( 15, 17, 21, 0.82 );
				border: 1px solid rgba( 247, 243, 233, 0.34 );
				backdrop-filter: blur( 8px );
				clip-path: polygon( 0 0, 100% 0, 100% 88%, 94% 100%, 0 100% );
				padding: var(--space-2, 0.5rem);
				box-sizing: border-box;
				display: flex;
				flex-direction: column;
				justify-content: space-between;
				cursor: pointer;
				transition:
					border-color var(--duration-normal, 200ms) var(--ease-standard, ease),
					box-shadow var(--duration-normal, 200ms) var(--ease-standard, ease),
					transform var(--duration-normal, 200ms) var(--ease-standard, ease);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-garage__card:hover {
				border-color: var(--mv-red );
				box-shadow: 0 0 18px rgba( 216, 44, 44, 0.2 );
				transform: scale( 1.04 );
			}

			/* Previewing state — orange glow */

			.kk-garage__card--previewing {
				border-color: var(--mv-red );
				box-shadow:
					0 0 16px rgba( 216, 44, 44, 0.24 ),
					inset 0 0 14px rgba( 216, 44, 44, 0.08 );
			}

			/* Equipped state — cyan glow */

			.kk-garage__card--equipped {
				border-color: var(--mv-cream );
				box-shadow:
					0 0 18px rgba( 247, 243, 233, 0.18 ),
					inset 0 0 12px rgba( 247, 243, 233, 0.08 );
			}

			.kk-garage__card--equipped:hover {
				border-color: var(--mv-cream );
				box-shadow:
					0 0 20px rgba( 247, 243, 233, 0.24 ),
					inset 0 0 16px rgba( 247, 243, 233, 0.1 );
			}

			/* ===================================================
			   Kart card content
			   =================================================== */

			.kk-garage__card-name {
				font-family: var(--mv-font-mono );
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: 0.14em;
				color: var(--mv-cream );
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.kk-garage__card-stat {
				font-family: var(--mv-font-mono );
				font-size: 0.6rem;
				font-weight: var(--weight-bold, 700);
				color: rgba( 247, 243, 233, 0.68 );
				text-transform: uppercase;
				letter-spacing: 0.14em;
			}

			/* ===================================================
			   Style panel — top-left character builder
			   =================================================== */

			.kk-garage__style {
				position: absolute;
				top: 0;
				left: 0;
				width: min( var(--kk-customizer-builder-width, 18rem), calc( 100vw - 3rem ) );
				background: var(--mv-cream );
				color: var(--mv-dark );
				border: none;
				border-radius: 0;
				padding: var(--space-4, 1rem);
				display: flex;
				flex-direction: column;
				gap: var(--space-3, 0.75rem);
				clip-path: polygon( 0 0, 100% 0, 100% 95%, 95% 100%, 0 100% );
				box-shadow: 0 24px 46px rgba( 0, 0, 0, 0.28 );
				overflow-y: auto;
				overscroll-behavior: contain;
				z-index: 3;
			}

			.kk-garage__style-eyebrow {
				font-family: var(--mv-font-mono );
				font-size: var(--text-customizer-eyebrow, var(--text-editorial-label, 0.625rem));
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: 0.18em;
				color: var(--mv-red );
			}

			.kk-garage__style-title {
				font-family: var(--mv-font-display );
				font-size: var(--text-customizer-title, var(--text-editorial-panel-title, clamp( 2.35rem, 4.2vw, 3.4rem )));
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: -0.04em;
				line-height: 0.9;
				color: var(--mv-dark );
			}

			.kk-garage__style-copy {
				font-family: var(--mv-font-mono );
				font-size: var(--text-customizer-copy, 0.78rem);
				line-height: 1.55;
				color: rgba( 15, 17, 21, 0.78 );
			}

			.kk-garage__character-page-btn {
				border: 1px solid rgba( 0, 212, 232, 0.45 );
				border-radius: 999px;
				background: linear-gradient( 135deg, rgba( 0, 212, 232, 0.16 ), rgba( 249, 115, 22, 0.18 ) );
				color: var(--color-white, #fff );
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-black, 900);
				letter-spacing: var(--tracking-wider, 0.12em);
				text-transform: uppercase;
				padding: 0.9rem 1rem;
				cursor: pointer;
				transition: transform var(--duration-fast, 150ms) var(--ease-standard, ease),
					box-shadow var(--duration-fast, 150ms) var(--ease-standard, ease),
					border-color var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-garage__character-page-btn:hover {
				transform: translateY( -1px );
				border-color: rgba( 255, 255, 255, 0.36 );
				box-shadow: 0 14px 28px rgba( 0, 212, 232, 0.16 );
			}

			.kk-garage__style-group {
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 0.5rem);
			}

			.kk-garage__style-label {
				font-family: var(--mv-font-mono );
				font-size: var(--text-customizer-eyebrow, var(--text-editorial-label, 0.625rem));
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: 0.14em;
				color: rgba( 15, 17, 21, 0.56 );
			}

			.kk-garage__color-row,
			.kk-garage__accessory-row {
				display: grid;
				grid-template-columns: minmax( 0, 1fr ) auto auto;
				align-items: center;
				gap: var(--space-2, 0.5rem);
				padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
				background: rgba( 15, 17, 21, 0.04 );
				border: 1px solid rgba( 15, 17, 21, 0.1 );
				border-radius: 0;
			}

			.kk-garage__accessory-row--off {
				opacity: 0.55;
			}

			.kk-garage__color-row--custom {
				border-color: rgba( 249, 115, 22, 0.36 );
				background: rgba( 249, 115, 22, 0.08 );
				box-shadow: inset 0 0 0 1px rgba( 249, 115, 22, 0.08 );
			}

			.kk-garage__color-label,
			.kk-garage__accessory-label {
				font-family: var(--mv-font-mono );
				font-size: var(--text-customizer-control, var(--text-sm, 0.875rem));
				font-weight: var(--weight-semibold, 600);
				color: var(--mv-dark );
			}

			.kk-garage__color-input {
				width: 2.5rem;
				height: 2.25rem;
				padding: 0;
				border: 1px solid rgba( 255, 255, 255, 0.16 );
				border-radius: 999px;
				background: transparent;
				cursor: pointer;
			}

			.kk-garage__color-input::-webkit-color-swatch-wrapper {
				padding: 0;
			}

			.kk-garage__color-input::-webkit-color-swatch {
				border: none;
				border-radius: 999px;
			}

			.kk-garage__mini-btn,
			.kk-garage__accessory-toggle {
				border: 1px solid rgba( 15, 17, 21, 0.14 );
				border-radius: 0;
				background: transparent;
				color: var(--mv-dark );
				font-family: var(--mv-font-mono );
				font-size: var(--text-customizer-action, 0.64rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.08em);
				padding: 0.55rem 0.8rem;
				cursor: pointer;
				transition: transform var(--duration-fast, 150ms) var(--ease-standard, ease),
					border-color var(--duration-fast, 150ms) var(--ease-standard, ease),
					background var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-garage__accessory-toggle--active {
				border-color: var(--mv-dark );
				background: var(--mv-dark );
				color: var(--mv-cream );
			}

			.kk-garage__mini-btn:hover,
			.kk-garage__accessory-toggle:hover {
				transform: translateY( -1px );
			}

			.kk-garage__style-summary {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				padding: var(--space-3, 0.75rem);
				border-radius: 0;
				background: rgba( 216, 44, 44, 0.08 );
				border: 1px solid rgba( 216, 44, 44, 0.22 );
			}

			.kk-garage__style-summary strong {
				font-family: var(--mv-font-mono );
				font-size: var(--text-customizer-eyebrow, var(--text-editorial-label, 0.625rem));
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				color: var(--mv-red );
			}

			.kk-garage__style-summary span {
				font-family: var(--mv-font-display );
				font-size: var(--text-customizer-summary, 1rem);
				font-weight: 900;
				line-height: 1.1;
				color: var(--mv-dark );
			}

			/* ===================================================
			   Stats panel — bottom-right corner
			   =================================================== */

			.kk-garage__stats {
				background: var(--mv-red );
				border: none;
				border-radius: 0;
				padding: var(--space-3, 0.75rem);
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 0.5rem);
				clip-path: polygon( 0 0, 100% 0, 100% 92%, 93% 100%, 0 100% );
				box-shadow: 0 24px 44px rgba( 0, 0, 0, 0.28 );
			}

			.kk-garage__stats-label {
				font-family: var(--mv-font-mono );
				font-size: 0.72rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: 0.18em;
				color: rgba( 247, 243, 233, 0.9 );
				border-bottom: 1px solid rgba( 247, 243, 233, 0.82 );
				padding-bottom: var(--space-1, 0.25rem);
			}

			.kk-garage__stat-row {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.kk-garage__stat-header {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: var(--space-2, 0.5rem);
			}

			.kk-garage__stat-name {
				font-family: var(--mv-font-mono );
				font-size: 0.72rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: 0.14em;
				color: rgba( 247, 243, 233, 0.84 );
			}

			.kk-garage__stat-score {
				font-family: var(--mv-font-mono );
				font-size: 0.72rem;
				font-weight: var(--weight-bold, 700);
				color: var(--mv-cream );
				white-space: nowrap;
				flex-shrink: 0;
			}

			/* ===================================================
			   Stat bar — animated fill transition
			   =================================================== */

			.kk-garage__stat-row .kk-progress-bar__fill {
				transition: width 0.6s cubic-bezier( 0.4, 0, 0.2, 1 );
				position: relative;
				overflow: hidden;
			}

			/* ===================================================
			   Stat bar — diagonal racing stripes inside fill
			   =================================================== */

			.kk-garage__stat-row .kk-progress-bar__fill::before {
				content: '';
				position: absolute;
				inset: 0;
				background-image: repeating-linear-gradient(
					-45deg,
					transparent,
					transparent 4px,
					rgba( 255, 255, 255, 0.08 ) 4px,
					rgba( 255, 255, 255, 0.08 ) 8px
				);
				border-radius: inherit;
				pointer-events: none;
			}

			/* ===================================================
			   Stat bar — shimmer sweep on render (staggered)
			   =================================================== */

			.kk-garage__stat-row .kk-progress-bar__fill::after {
				content: '';
				position: absolute;
				inset: 0;
				background: linear-gradient(
					90deg,
					transparent 0%,
					rgba( 255, 255, 255, 0.25 ) 50%,
					transparent 100%
				);
				border-radius: inherit;
				pointer-events: none;
				animation: kk-shimmer-sweep 0.6s ease-out forwards;
				animation-delay: 0s;
			}

			.kk-garage__stat-row:nth-child( 2 ) .kk-progress-bar__fill::after { animation-delay: 0s; }
			.kk-garage__stat-row:nth-child( 3 ) .kk-progress-bar__fill::after { animation-delay: 0.1s; }
			.kk-garage__stat-row:nth-child( 4 ) .kk-progress-bar__fill::after { animation-delay: 0.2s; }
			.kk-garage__stat-row:nth-child( 5 ) .kk-progress-bar__fill::after { animation-delay: 0.3s; }
			.kk-garage__stat-row:nth-child( 6 ) .kk-progress-bar__fill::after { animation-delay: 0.4s; }

			/* ===================================================
			   Stat bar — per-stat accent colors + edge glow
			   =================================================== */

			.kk-garage__stat-row--speed .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-orange-dim), var(--color-accent-orange) );
				box-shadow:
					0 0 8px var(--color-accent-orange),
					inset -4px 0 8px rgba( 255, 107, 0, 0.4 );
			}

			.kk-garage__stat-row--handling .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-cyan-dim), var(--color-accent-cyan) );
				box-shadow:
					0 0 8px var(--color-accent-cyan),
					inset -4px 0 8px rgba( 0, 212, 232, 0.4 );
			}

			.kk-garage__stat-row--acceleration .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-yellow-dim), var(--color-accent-yellow) );
				box-shadow:
					0 0 8px var(--color-accent-yellow),
					inset -4px 0 8px rgba( 255, 214, 0, 0.4 );
			}

			.kk-garage__stat-row--weight .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-pink-dim), var(--color-accent-pink) );
				box-shadow:
					0 0 8px var(--color-accent-pink),
					inset -4px 0 8px rgba( 255, 58, 140, 0.4 );
			}

			.kk-garage__stat-row--boost .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-orange-dim), var(--color-accent-orange) );
				box-shadow:
					0 0 8px var(--color-accent-orange),
					inset -4px 0 8px rgba( 255, 107, 0, 0.4 );
			}

			/* ===================================================
			   Stat score — mono font + per-stat glow
			   =================================================== */

			.kk-garage__stat-row--speed .kk-garage__stat-score {
				color: var(--color-accent-orange, #f97316);
				text-shadow: 0 0 6px rgba( 255, 107, 0, 0.5 );
			}

			.kk-garage__stat-row--handling .kk-garage__stat-score {
				color: var(--color-accent-cyan, #00d4e8);
				text-shadow: 0 0 6px rgba( 0, 212, 232, 0.5 );
			}

			.kk-garage__stat-row--acceleration .kk-garage__stat-score {
				color: var(--color-accent-yellow, #ffd600);
				text-shadow: 0 0 6px rgba( 255, 214, 0, 0.5 );
			}

			.kk-garage__stat-row--weight .kk-garage__stat-score {
				color: var(--color-accent-pink, #ff3a8c);
				text-shadow: 0 0 6px rgba( 255, 58, 140, 0.5 );
			}

			.kk-garage__stat-row--boost .kk-garage__stat-score {
				color: var(--color-accent-orange, #f97316);
				text-shadow: 0 0 6px rgba( 255, 107, 0, 0.5 );
			}

			/* ===================================================
			   Reduced motion — disable stat bar animations
			   =================================================== */

			@media ( prefers-reduced-motion: reduce ) {

				.kk-garage__stat-row .kk-progress-bar__fill {
					transition: none;
				}

				.kk-garage__stat-row .kk-progress-bar__fill::after {
					animation: none;
				}

			}

			/* ===================================================
			   Responsive adjustments
			   =================================================== */

			@media ( max-width: 480px ) {

				.kk-garage__style {
					padding: var(--space-3, 0.75rem);
				}

				.kk-garage__style-title {
					font-size: var(--text-lg, 1.125rem);
				}

				.kk-garage__color-row,
				.kk-garage__accessory-row {
					grid-template-columns: minmax( 0, 1fr ) auto auto;
					padding: var(--space-2, 0.5rem);
				}

				.kk-garage__carousel {
					padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
				}

				.kk-garage__card {
					flex: 0 0 100px;
					min-width: 100px;
					height: 64px;
				}

				.kk-garage__stats {
					padding: var(--space-2, 0.5rem);
				}
			}

			/* ===================================================
			   Reduced motion — disable card transitions
			   =================================================== */

			@media ( prefers-reduced-motion: reduce ) {

				.kk-garage__card {
					transition: none;
				}

			}

			/* ===================================================
			   Editorial rebalance
			   =================================================== */

			.kk-garage__style {
				max-height: 14.75rem;
				padding: 0.9rem;
				gap: 0.72rem;
			}

			.kk-garage__style-title {
				font-size: var(--text-customizer-title, var(--text-editorial-panel-title, clamp(2.35rem, 4.2vw, 3.4rem)));
				line-height: 0.92;
			}

			.kk-garage__style-copy {
				font-size: var(--text-customizer-copy, 0.78rem);
				line-height: var(--leading-relaxed, 1.6);
			}

			.kk-garage__header .kk-mv-header__title {
				font-size: var(--text-editorial-panel-title, clamp(2.35rem, 4.2vw, 3.4rem));
				opacity: 0.94;
			}

			.kk-garage__header .kk-mv-header__subtitle {
				font-size: var(--text-editorial-label, 0.625rem);
				opacity: 0.72;
			}

			.kk-garage__character-page-btn {
				border: 1px solid rgba(15,17,21,0.14);
				background: transparent;
				color: var(--mv-dark);
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-action, 0.64rem);
				font-weight: 700;
				letter-spacing: 0.16em;
				text-transform: uppercase;
				padding: 0.75rem 0.9rem;
				cursor: pointer;
				clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
			}

			.kk-garage__character-page-btn:hover {
				background: rgba(15,17,21,0.08);
				border-color: rgba(15,17,21,0.24);
				box-shadow: none;
				transform: translateY(-1px);
			}

			.kk-garage__carousel-wrap {
				left: 0;
				right: 0;
				bottom: 0;
				display: grid;
				grid-template-columns: auto minmax(0, 1fr) auto;
				align-items: center;
				gap: 0.8rem;
				z-index: 4;
			}

			.kk-garage__carousel {
				padding: 0.3rem 0;
			}

			.kk-garage__carousel-arrow {
				width: 2.8rem;
				height: 3.6rem;
				border: 1px solid rgba(247,243,233,0.32);
				background: rgba(15,17,21,0.8);
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 1.1rem;
				cursor: pointer;
				clip-path: polygon(0 0, 100% 0, 100% 88%, 94% 100%, 0 100%);
			}

			.kk-garage__carousel-arrow:hover {
				background: rgba(216,44,44,0.18);
				border-color: rgba(247,243,233,0.72);
			}

			.kk-garage__card {
				flex: 0 0 11rem;
				min-width: 11rem;
				height: 5.8rem;
				padding: 0.7rem;
			}

			.kk-garage__card-status {
				position: absolute;
				top: 0.55rem;
				right: 0.55rem;
				font-size: 0.48rem;
				font-weight: 700;
				letter-spacing: 0.18em;
				opacity: 0.76;
			}

			.kk-garage__card--previewing .kk-garage__card-status,
			.kk-garage__card--equipped .kk-garage__card-status {
				color: var(--mv-red);
			}

			.kk-garage__card--equipped .kk-garage__card-status {
				color: var(--mv-cream);
			}

			@media (max-width: 980px) {
				.kk-garage__interface {
					grid-template-columns: 1fr;
					grid-template-rows: auto auto auto;
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 16px;
				}

				.kk-garage__header,
				.kk-garage__stage,
				.kk-garage__deck {
					grid-column: auto;
					grid-row: auto;
				}

				.kk-garage__deck {
					padding-bottom: 8px;
				}

				.kk-garage__carousel-wrap {
					position: relative;
					bottom: auto;
					left: auto;
					right: auto;
				}
			}

			@media (max-width: 720px) {
				.kk-garage__style {
					max-height: 15.5rem;
				}

				.kk-garage__carousel-wrap {
					gap: 0.45rem;
				}

				.kk-garage__carousel-arrow {
					width: 2.2rem;
					height: 3.1rem;
				}
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = document.createElement( 'div' );
		root.className = 'kk-garage';
		root.setAttribute( 'role', 'region' );
		root.setAttribute( 'aria-label', 'Garage — kart selection' );

		const scanlines = document.createElement( 'div' );
		scanlines.className = 'kk-garage__scanlines';
		root.appendChild( scanlines );

		const vignette = document.createElement( 'div' );
		vignette.className = 'kk-garage__vignette';
		root.appendChild( vignette );

		const frame = document.createElement( 'div' );
		frame.className = 'kk-garage__interface';
		root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Garage',
			subtitle: 'Vehicle Index // Paint, Selection, Performance',
			badge: '',
			className: 'kk-garage__header',
		} ).el );

		const stage = document.createElement( 'div' );
		stage.className = 'kk-garage__stage';
		frame.appendChild( stage );

		const deck = document.createElement( 'aside' );
		deck.className = 'kk-garage__deck';
		frame.appendChild( deck );

		// Kart builder panel
		const stylePanel = document.createElement( 'section' );
		stylePanel.className = 'kk-garage__style';
		stylePanel.setAttribute( 'aria-label', 'Kart builder' );

		const styleEyebrow = document.createElement( 'div' );
		styleEyebrow.className = 'kk-garage__style-eyebrow';
		styleEyebrow.textContent = 'Customizer';
		stylePanel.appendChild( styleEyebrow );

		const styleTitle = document.createElement( 'div' );
		styleTitle.className = 'kk-garage__style-title';
		styleTitle.textContent = 'Kart Paint';
		stylePanel.appendChild( styleTitle );

		const styleCopy = document.createElement( 'div' );
		styleCopy.className = 'kk-garage__style-copy';
		styleCopy.textContent = 'Dial in your kart finish here. Driver customization now lives in the CHARACTER tab.';
		stylePanel.appendChild( styleCopy );

		const paletteGroup = document.createElement( 'div' );
		paletteGroup.className = 'kk-garage__style-group';

		const paletteLabel = document.createElement( 'div' );
		paletteLabel.className = 'kk-garage__style-label';
		paletteLabel.textContent = 'Palette';
		paletteGroup.appendChild( paletteLabel );

		for ( const def of COLOR_CONTROL_DEFS ) {

			paletteGroup.appendChild( this._buildColorControl( def ) );

		}

		stylePanel.appendChild( paletteGroup );

		const summary = document.createElement( 'div' );
		summary.className = 'kk-garage__style-summary';

		const summaryTitle = document.createElement( 'strong' );
		summaryTitle.textContent = 'Current Finish';
		summary.appendChild( summaryTitle );

		const summaryText = document.createElement( 'span' );
		summary.appendChild( summaryText );
		this._styleSummaryEl = summaryText;

		stylePanel.appendChild( summary );

		const characterLinkBtn = document.createElement( 'button' );
		characterLinkBtn.type = 'button';
		characterLinkBtn.className = 'kk-garage__character-page-btn';
		characterLinkBtn.textContent = 'Open Character Lab';
		characterLinkBtn.addEventListener( 'click', () => {

			this._services.switchTab?.( 'character' );

		} );
		stylePanel.appendChild( characterLinkBtn );

		stage.appendChild( stylePanel );
		this._stylePanel = stylePanel;

		// Stats panel
		const statsPanel = document.createElement( 'section' );
		statsPanel.className = 'kk-garage__stats';
		statsPanel.setAttribute( 'aria-label', 'Kart statistics' );

		const statsLabel = document.createElement( 'div' );
		statsLabel.className = 'kk-garage__stats-label';
		statsLabel.textContent = 'STATS';
		statsPanel.appendChild( statsLabel );

		for ( const def of STAT_DEFS ) {

			const row = document.createElement( 'div' );
			row.className = `kk-garage__stat-row kk-garage__stat-row--${ def.key }`;

			const header = document.createElement( 'div' );
			header.className = 'kk-garage__stat-header';

			const name = document.createElement( 'div' );
			name.className = 'kk-garage__stat-name';
			name.textContent = def.label;
			header.appendChild( name );

			const score = document.createElement( 'div' );
			score.className = 'kk-garage__stat-score';
			score.dataset.statKey = def.key;
			score.textContent = '— / 10';
			header.appendChild( score );

			row.appendChild( header );

			const bar = new ProgressBar( {
				label:        def.label,
				value:        0,
				min:          0,
				max:          10,
				variant:      'stat',
				animated:     true,
				showEndLabel: false,
			} );
			row.appendChild( bar.el );
			this._statBars.set( def.key, bar );

			statsPanel.appendChild( row );

		}

		deck.appendChild( statsPanel );

		// Kart carousel — horizontal card strip
		const carouselWrap = document.createElement( 'div' );
		carouselWrap.className = 'kk-garage__carousel-wrap';
		carouselWrap.setAttribute( 'aria-label', 'Kart selector rail' );

		const prevBtn = document.createElement( 'button' );
		prevBtn.type = 'button';
		prevBtn.className = 'kk-garage__carousel-arrow kk-garage__carousel-arrow--prev';
		prevBtn.setAttribute( 'aria-label', 'Preview previous kart' );
		prevBtn.textContent = '<';
		prevBtn.addEventListener( 'click', () => this._cycleKart( - 1 ) );
		carouselWrap.appendChild( prevBtn );

		this._carousel = document.createElement( 'div' );
		this._carousel.className = 'kk-garage__carousel';
		carouselWrap.appendChild( this._carousel );

		const nextBtn = document.createElement( 'button' );
		nextBtn.type = 'button';
		nextBtn.className = 'kk-garage__carousel-arrow kk-garage__carousel-arrow--next';
		nextBtn.setAttribute( 'aria-label', 'Preview next kart' );
		nextBtn.textContent = '>';
		nextBtn.addEventListener( 'click', () => this._cycleKart( 1 ) );
		carouselWrap.appendChild( nextBtn );

		stage.appendChild( carouselWrap );

		this._renderCarousel();

		this._root = root;

		// Keyboard navigation
		this._keyHandler = ( e ) => this._onKeyDown( e );
		document.addEventListener( 'keydown', this._keyHandler );

		this._settingsChangedHandler = ( e ) => {

			if ( e.detail.key === 'vehicleColor' ) {

				this._settings = new Settings();
				this._syncStyleControls();

			}

		};
		window.addEventListener( 'settings-changed', this._settingsChangedHandler );

		// Set initial state
		this._syncToCurrentKart();
		this._syncStyleControls();

	}

	_buildColorControl( def ) {

		const row = document.createElement( 'div' );
		row.className = 'kk-garage__color-row';

		const label = document.createElement( 'span' );
		label.className = 'kk-garage__color-label';
		label.textContent = def.label;
		row.appendChild( label );

		const input = document.createElement( 'input' );
		input.type = 'color';
		input.className = 'kk-garage__color-input';
		input.value = def.fallback;
		input.setAttribute( 'aria-label', `${def.label} color` );
		input.addEventListener( 'focus', () => {

			this._services.setMenuPreviewFocus?.( 'garage-kart' );

		} );
		input.addEventListener( 'input', () => {

			this._services.setMenuPreviewFocus?.( 'garage-kart' );
			this._settings.set( def.key, input.value );
			this._syncStyleControls();

		} );
		row.appendChild( input );

		const reset = document.createElement( 'button' );
		reset.type = 'button';
		reset.className = 'kk-garage__mini-btn';
		reset.textContent = 'RESET';
		reset.addEventListener( 'click', () => {

			this._settings.set( def.key, '' );
			input.value = def.fallback;
			this._syncStyleControls();

		} );
		row.appendChild( reset );

		this._colorControls.set( def.key, { input, row } );
		return row;

	}

	_syncStyleControls() {

		for ( const def of COLOR_CONTROL_DEFS ) {

			const control = this._colorControls.get( def.key );
			if ( ! control ) continue;

			const value = this._settings.get( def.key ) || '';
			control.input.value = value || def.fallback;
			control.row.classList.toggle( 'kk-garage__color-row--custom', !! value );

		}

		this._updateStyleSummary();

	}

	_updateStyleSummary() {

		if ( ! this._styleSummaryEl ) return;

		const kartState = this._settings.get( 'vehicleColor' ) ? 'custom paint' : 'factory paint';
		const kartLabel = this._currentVehicle()?.label || 'Kart';

		this._styleSummaryEl.textContent = `${ kartLabel } with ${ kartState }, synced to the current garage loadout.`;

	}

	// ---------------------------------------------------------------------------
	// Kart cycling
	// ---------------------------------------------------------------------------

	/**
	 * Cycle to the next or previous kart.
	 *
	 * @param {number} direction  -1 for previous, +1 for next.
	 */
	_cycleKart( direction ) {

		const count = this._vehicles.length;
		this._currentIndex = ( this._currentIndex + direction + count ) % count;

		this._syncToCurrentKart();

		// Update 3D preview
		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._currentVehicle().id );

		}

		if ( this._services.lobbyScene ) {

			this._services.lobbyScene.setKart( this._currentVehicle().id );

		}

		// Re-render carousel to update glow states and scroll into view.
		this._renderCarousel();

	}

	/**
	 * Keyboard handler for arrow key navigation.
	 *
	 * @param {KeyboardEvent} e
	 */
	_onKeyDown( e ) {

		// Only respond when the garage panel is visible.
		if ( ! this._root || this._root.offsetParent === null ) return;

		if ( e.key === 'ArrowLeft' ) {

			e.preventDefault();
			this._cycleKart( - 1 );

		} else if ( e.key === 'ArrowRight' ) {

			e.preventDefault();
			this._cycleKart( 1 );

		}

	}

	// ---------------------------------------------------------------------------
	// Carousel rendering
	// ---------------------------------------------------------------------------

	/**
	 * Build all kart cards in the carousel strip.
	 */
	_renderCarousel() {

		if ( ! this._carousel ) return;
		this._carousel.innerHTML = '';

		const equippedId = this._settings.getSelectedKartId();

		for ( let i = 0; i < this._vehicles.length; i ++ ) {

			const vehicle = this._vehicles[ i ];
			const card = this._buildKartCard( vehicle, i, equippedId );
			this._carousel.appendChild( card );

		}

		// Scroll the currently viewed card into view.
		this._scrollToCard( this._currentIndex );

	}

	/**
	 * Build a single kart card element.
	 *
	 * @param {object} vehicle     Vehicle definition from registry.
	 * @param {number} index       Index in _vehicles array.
	 * @param {string} equippedId  Currently equipped kart id.
	 * @returns {HTMLElement}
	 */
	_buildKartCard( vehicle, index, equippedId ) {

		const isPreviewing = index === this._currentIndex;
		const isEquipped = vehicle.id === equippedId;

		const card = document.createElement( 'div' );
		card.className = 'kk-garage__card';
		card.dataset.index = index;

		if ( isEquipped ) card.classList.add( 'kk-garage__card--equipped' );
		if ( isPreviewing && ! isEquipped ) card.classList.add( 'kk-garage__card--previewing' );

		const statusEl = document.createElement( 'div' );
		statusEl.className = 'kk-garage__card-status';
		statusEl.textContent = isEquipped ? 'Live' : ( isPreviewing ? 'View' : '' );
		card.appendChild( statusEl );

		// Card name
		const nameEl = document.createElement( 'div' );
		nameEl.className = 'kk-garage__card-name';
		nameEl.textContent = vehicle.label;
		card.appendChild( nameEl );

		// Top stat preview (speed)
		const statEl = document.createElement( 'div' );
		statEl.className = 'kk-garage__card-stat';
		statEl.textContent = `SPD ${ vehicle.stats.speed }/10`;
		card.appendChild( statEl );

		// Tap to preview this kart
		card.addEventListener( 'click', () => {

			this._currentIndex = index;
			this._syncToCurrentKart();

			// Update 3D preview
			if ( this._services.garagePreview ) {

				this._services.garagePreview.setKart( vehicle.id );

			}

			if ( this._services.lobbyScene ) {

				this._services.lobbyScene.setKart( vehicle.id );

			}

			// Re-render carousel to update glow states.
			this._renderCarousel();

		} );

		return card;

	}

	/**
	 * Scroll the carousel so the card at the given index is visible.
	 *
	 * @param {number} index
	 */
	_scrollToCard( index ) {

		if ( ! this._carousel ) return;

		const card = this._carousel.children[ index ];
		if ( ! card ) return;

		// Use scrollIntoView with inline center for smooth snap.
		card.scrollIntoView( { behavior: 'smooth', block: 'nearest', inline: 'center' } );

	}

	// ---------------------------------------------------------------------------
	// Sync UI to current kart
	// ---------------------------------------------------------------------------

	/**
	 * Sync stat bars to the currently viewed kart.
	 */
	_syncToCurrentKart() {

		const vehicle = this._currentVehicle();
		if ( ! vehicle ) return;

		const stats = vehicle.stats;

		// Stat bars
		for ( const def of STAT_DEFS ) {

			const val = stats[ def.statKey ] ?? 0;
			const bar = this._statBars.get( def.key );

			if ( bar ) {

				bar.setValue( val, `${ val } out of 10` );

			}

			const scoreEl = this._root.querySelector( `[data-stat-key="${ def.key }"]` );
			if ( scoreEl ) {

				scoreEl.textContent = `${ val } / 10`;

			}

		}

	}

	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Called when the GARAGE tab becomes active.
	 * Refreshes equipped state in case it changed while on another tab.
	 */
	show() {

		// Re-read settings — equipped kart may have changed externally.
		this._settings = new Settings();
		this._vehicles = getAllVehicles();

		// Validate current index.
		if ( this._currentIndex < 0 || this._currentIndex >= this._vehicles.length ) {

			const equippedId = this._settings.getSelectedKartId();
			this._currentIndex = this._vehicles.findIndex( v => v.id === equippedId );
			if ( this._currentIndex < 0 ) this._currentIndex = 0;

		}

		this._syncToCurrentKart();
		this._syncStyleControls();
		this._renderCarousel();

		// Sync 3D preview to current kart.
		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._currentVehicle().id );

		}

		if ( this._services.lobbyScene ) {

			this._services.lobbyScene.setKart( this._currentVehicle().id );
			this._services.lobbyScene.setAppearance( this._settings.getPlayerAppearance() );

		}

		this._services.setMenuPreviewFocus?.( 'garage-kart' );

	}

	/**
	 * Called when the GARAGE tab becomes inactive.
	 */
	hide() {

	}

	/**
	 * Full teardown. Called only if AppShell itself is destroyed.
	 */
	dispose() {

		if ( this._keyHandler ) {

			document.removeEventListener( 'keydown', this._keyHandler );
			this._keyHandler = null;

		}

		if ( this._settingsChangedHandler ) {

			window.removeEventListener( 'settings-changed', this._settingsChangedHandler );
			this._settingsChangedHandler = null;

		}

		for ( const bar of this._statBars.values() ) {

			bar.dispose();

		}

		this._statBars.clear();

		this._carousel = null;

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}

GaragePanel._cssInjected = false;
