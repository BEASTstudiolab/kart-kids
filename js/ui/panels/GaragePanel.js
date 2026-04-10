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
 *   - VehicleRegistry  — getAllVehicles(), getVehicleById()
 *   - Settings         — getSelectedKartId(), setSelectedKartId()
 *   - services.garagePreview.setKart()  — 3D turntable sync
 *   - services.selectedMode             — mode for RACE shortcut
 *   - services.startRace()              — launch race
 *   - services.notification.show()      — toast feedback
 */

import { getAllVehicles, getVehicleById } from '../../VehicleRegistry.js';
import { Settings }                      from '../../Settings.js';
import { ProgressBar }                   from '../components/ProgressBar.js';
import { CTAButton }                     from '../components/CTAButton.js';
import { HudButton }                     from '../components/HudButton.js';
import { HyperText }                     from '../effects/HyperText.js';

/** Stat definitions — order matches the stats panel top-to-bottom. */
const STAT_DEFS = [
	{ key: 'speed',        label: 'SPEED',        statKey: 'speed' },
	{ key: 'handling',     label: 'HANDLING',      statKey: 'handling' },
	{ key: 'acceleration', label: 'ACCELERATION',  statKey: 'acceleration' },
	{ key: 'weight',       label: 'WEIGHT',        statKey: 'weight' },
	{ key: 'boost',        label: 'BOOST',         statKey: 'boost' },
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
		this._kartNameEl = null;

		/** @type {HudButton|null} */
		this._equipBtn = null;

		/** @type {HyperText|null} */
		this._kartNameHyper = null;

		/** @type {CTAButton|null} */
		this._raceBtn = null;

		/** @type {HTMLElement|null} */
		this._carousel = null;

		/** @type {HTMLElement|null} */
		this._root = null;

		/** @type {Function|null} Bound keyboard handler for cleanup. */
		this._keyHandler = null;

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
				pointer-events: none;
			}

			.kk-garage > * {
				pointer-events: auto;
			}

			/* ===================================================
			   Kart carousel — horizontal scroll-snap strip
			   =================================================== */

			.kk-garage__carousel-wrap {
				position: absolute;
				bottom: 5.5rem;
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
				background: rgba( 20, 20, 30, 0.75 );
				border: var(--border-base, 2px) solid rgba( 255, 255, 255, 0.1 );
				backdrop-filter: blur( 8px );
				clip-path: polygon(
					0 8px, 8px 0, 100% 0,
					100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%
				);
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
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 14px rgba( 249, 115, 22, 0.3 );
				transform: scale( 1.04 );
			}

			/* Previewing state — orange glow */

			.kk-garage__card--previewing {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow:
					0 0 14px rgba( 249, 115, 22, 0.4 ),
					inset 0 0 14px rgba( 249, 115, 22, 0.06 );
			}

			/* Equipped state — cyan glow */

			.kk-garage__card--equipped {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 16px rgba( 0, 212, 232, 0.4 ),
					inset 0 0 16px rgba( 0, 212, 232, 0.06 );
			}

			.kk-garage__card--equipped:hover {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 20px rgba( 0, 212, 232, 0.5 ),
					inset 0 0 16px rgba( 0, 212, 232, 0.08 );
			}

			/* ===================================================
			   Kart card content
			   =================================================== */

			.kk-garage__card-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.kk-garage__card-stat {
				font-family: var(--font-mono, monospace);
				font-size: 0.6rem;
				font-weight: var(--weight-bold, 700);
				color: var(--color-accent-orange, #f97316);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
			}

			/* ===================================================
			   Kart name — centered above carousel
			   =================================================== */

			.kk-garage__kart-name {
				position: absolute;
				bottom: 13.5rem;
				left: 50%;
				transform: translateX( -50% );
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-3xl, 2.25rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.14em);
				color: var(--color-white, #fff);
				text-align: center;
				white-space: nowrap;
				background: linear-gradient( 180deg, #fff 55%, #aaa 100% );
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
				text-shadow: none;
				z-index: 1;
			}

			/* ===================================================
			   EQUIP button — centered above carousel
			   =================================================== */

			.kk-garage__equip-wrap {
				position: absolute;
				bottom: 10rem;
				left: 50%;
				transform: translateX( -50% );
				z-index: 3;
			}

			.kk-garage__equip-wrap .kk-cta-button--primary {
				animation: kk-glow-pulse 2s ease-in-out infinite;
			}

			.kk-garage__equip-wrap--equipped .kk-cta-button--primary {
				animation: none;
				background: var(--color-ink-600, #333);
				opacity: 0.7;
			}

			.kk-garage__equip-wrap--equipped .kk-cta-button--primary:hover {
				box-shadow: none;
			}

			/* HudButton variant in equip wrap */
			.kk-garage__equip-wrap--equipped .kk-hud-button {
				opacity: 0.6;
			}

			/* ===================================================
			   Stats panel — bottom-right corner
			   =================================================== */

			.kk-garage__stats {
				position: absolute;
				bottom: var(--space-6, 1.5rem);
				right: var(--space-6, 1.5rem);
				width: 14rem;
				background: rgba( 0, 0, 0, 0.65 );
				border: var(--border-base, 2px) solid var(--color-panel-border, rgba( 255, 255, 255, 0.12 ));
				border-radius: var(--radius-md, 4px);
				padding: var(--space-3, 0.75rem);
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 0.5rem);
				backdrop-filter: blur( 8px );
				z-index: 1;
			}

			.kk-garage__stats-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba( 255, 255, 255, 0.1 ));
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
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-200, #ddd);
			}

			.kk-garage__stat-score {
				font-family: var(--font-mono, monospace);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-accent-orange, #f97316);
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
			   Secondary RACE button — bottom-left corner
			   =================================================== */

			.kk-garage__race-wrap {
				position: absolute;
				bottom: var(--space-6, 1.5rem);
				left: var(--space-6, 1.5rem);
				z-index: 1;
			}

			.kk-garage__race-wrap .kk-cta-button {
				font-size: var(--text-sm, 0.75rem);
				min-height: 2.5rem;
				padding: 0 var(--space-4, 1rem);
			}

			/* ===================================================
			   Responsive adjustments
			   =================================================== */

			@media ( max-width: 480px ) {

				.kk-garage__kart-name {
					font-size: var(--text-2xl, 1.75rem);
					bottom: 12.5rem;
				}

				.kk-garage__equip-wrap {
					bottom: 9rem;
				}

				.kk-garage__carousel-wrap {
					bottom: 5rem;
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
					width: 11rem;
					padding: var(--space-2, 0.5rem);
					bottom: var(--space-4, 1rem);
					right: var(--space-4, 1rem);
				}

				.kk-garage__race-wrap {
					bottom: var(--space-4, 1rem);
					left: var(--space-4, 1rem);
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

		// Kart name
		this._kartNameEl = document.createElement( 'div' );
		this._kartNameEl.className = 'kk-garage__kart-name';
		this._kartNameEl.setAttribute( 'aria-live', 'polite' );
		root.appendChild( this._kartNameEl );

		// HyperText scramble on kart name changes.
		this._kartNameHyper = new HyperText( this._kartNameEl );

		// EQUIP button wrapper — HudButton with scramble effect
		this._equipWrap = document.createElement( 'div' );
		this._equipWrap.className = 'kk-garage__equip-wrap';

		this._equipBtn = new HudButton( {
			text:    'EQUIP',
			color:   '--color-accent-cyan',
			onClick: () => this._handleEquip(),
		} );
		this._equipWrap.appendChild( this._equipBtn.el );
		root.appendChild( this._equipWrap );

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

		root.appendChild( statsPanel );

		// Kart carousel — horizontal card strip
		const carouselWrap = document.createElement( 'div' );
		carouselWrap.className = 'kk-garage__carousel-wrap';

		this._carousel = document.createElement( 'div' );
		this._carousel.className = 'kk-garage__carousel';
		carouselWrap.appendChild( this._carousel );
		root.appendChild( carouselWrap );

		this._renderCarousel();

		// Secondary RACE button — bottom-left
		const raceWrap = document.createElement( 'div' );
		raceWrap.className = 'kk-garage__race-wrap';

		this._raceBtn = new CTAButton( {
			label:     'RACE',
			variant:   'secondary',
			ariaLabel: 'Start race with selected mode',
			onClick:   () => this._handleRace(),
		} );
		raceWrap.appendChild( this._raceBtn.el );
		root.appendChild( raceWrap );

		this._root = root;

		// Keyboard navigation
		this._keyHandler = ( e ) => this._onKeyDown( e );
		document.addEventListener( 'keydown', this._keyHandler );

		// Set initial state
		this._syncToCurrentKart();

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
	 * Sync kart name, stat bars, and equip button to the currently viewed kart.
	 */
	_syncToCurrentKart() {

		const vehicle = this._currentVehicle();
		if ( ! vehicle ) return;

		const stats = vehicle.stats;
		const equippedId = this._settings.getSelectedKartId();
		const isEquipped = vehicle.id === equippedId;

		// Kart name — scramble to new name.
		if ( this._kartNameHyper ) {

			this._kartNameHyper.scrambleTo( vehicle.label, 800 );

		} else if ( this._kartNameEl ) {

			this._kartNameEl.textContent = vehicle.label;

		}

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

		// Equip button state
		if ( this._equipBtn ) {

			if ( isEquipped ) {

				this._equipBtn.setText( 'EQUIPPED' );
				this._equipBtn.setDimmed( true );
				this._equipWrap.classList.add( 'kk-garage__equip-wrap--equipped' );

			} else {

				this._equipBtn.setText( 'EQUIP' );
				this._equipBtn.setDimmed( false );
				this._equipWrap.classList.remove( 'kk-garage__equip-wrap--equipped' );

			}

		}

	}

	// ---------------------------------------------------------------------------
	// Handlers
	// ---------------------------------------------------------------------------

	_handleEquip() {

		const vehicle = this._currentVehicle();
		const equippedId = this._settings.getSelectedKartId();

		if ( vehicle.id === equippedId ) {

			// Already equipped — no-op with feedback.
			this._services.notification?.show( {
				message:  'Already equipped!',
				variant:  'info',
				duration: 1500,
			} );
			return;

		}

		// Persist selection.
		this._settings.setSelectedKartId( vehicle.id );

		// Update equip button label.
		this._equipBtn.setText( 'EQUIPPED' );
		this._equipBtn.setDimmed( true );
		this._equipWrap.classList.add( 'kk-garage__equip-wrap--equipped' );

		// Re-render carousel to update glow states.
		this._renderCarousel();

		// Toast confirmation.
		this._services.notification?.show( {
			message:  `${ vehicle.label } EQUIPPED`,
			variant:  'success',
			duration: 2000,
		} );

	}

	_handleRace() {

		const mode = this._services.selectedMode || 'solo';

		if ( mode === 'solo' ) {

			this._services.startRace( { mode: 'solo' } );

		} else {

			// For non-solo modes, toast that it's not yet wired.
			this._services.notification?.show( {
				message:  `${ mode.toUpperCase() } mode — coming soon`,
				variant:  'info',
				duration: 2500,
			} );

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
		this._renderCarousel();

		// Sync 3D preview to current kart.
		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._currentVehicle().id );

		}

		if ( this._services.lobbyScene ) {

			this._services.lobbyScene.setKart( this._currentVehicle().id );

		}

	}

	/**
	 * Called when the GARAGE tab becomes inactive.
	 */
	hide() {

		// No teardown needed — panel persists.

	}

	/**
	 * Full teardown. Called only if AppShell itself is destroyed.
	 */
	dispose() {

		if ( this._keyHandler ) {

			document.removeEventListener( 'keydown', this._keyHandler );
			this._keyHandler = null;

		}

		for ( const bar of this._statBars.values() ) {

			bar.dispose();

		}

		this._statBars.clear();

		if ( this._equipBtn ) {

			this._equipBtn.dispose();
			this._equipBtn = null;

		}

		if ( this._kartNameHyper ) {

			this._kartNameHyper.dispose();
			this._kartNameHyper = null;

		}

		this._raceBtn = null;
		this._kartNameEl = null;
		this._equipWrap = null;
		this._carousel = null;

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}

GaragePanel._cssInjected = false;
