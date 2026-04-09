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

		/** @type {CTAButton|null} */
		this._equipBtn = null;

		/** @type {CTAButton|null} */
		this._raceBtn = null;

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
			   Nav arrows — large chevrons on left / right edges
			   =================================================== */

			.kk-garage__arrow {
				position: absolute;
				top: 50%;
				transform: translateY( -50% );
				width: 3.5rem;
				height: 3.5rem;
				border-radius: 50%;
				background: rgba( 255, 255, 255, 0.08 );
				border: var(--border-thin, 1px) solid rgba( 255, 255, 255, 0.12 );
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				transition:
					background var(--duration-fast, 100ms) var(--ease-standard, ease),
					transform var(--duration-fast, 100ms) var(--ease-spring, ease);
				z-index: 2;
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-garage__arrow:hover {
				background: rgba( 255, 255, 255, 0.16 );
				transform: translateY( -50% ) scale( 1.1 );
			}

			.kk-garage__arrow:active {
				transform: translateY( -50% ) scale( 0.95 );
			}

			.kk-garage__arrow--left {
				left: var(--space-4, 1rem);
			}

			.kk-garage__arrow--right {
				right: var(--space-4, 1rem);
			}

			.kk-garage__arrow-chevron {
				width: 1.5rem;
				height: 1.5rem;
				border-top: 3px solid var(--color-white, #fff);
				border-right: 3px solid var(--color-white, #fff);
			}

			.kk-garage__arrow--left .kk-garage__arrow-chevron {
				transform: rotate( -135deg );
				margin-left: 4px;
			}

			.kk-garage__arrow--right .kk-garage__arrow-chevron {
				transform: rotate( 45deg );
				margin-right: 4px;
			}

			/* ===================================================
			   Kart name — centered below 3D preview area
			   =================================================== */

			.kk-garage__kart-name {
				position: absolute;
				bottom: 16rem;
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
			   EQUIP button — centered below kart name
			   =================================================== */

			.kk-garage__equip-wrap {
				position: absolute;
				bottom: 11.5rem;
				left: 50%;
				transform: translateX( -50% );
				z-index: 1;
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
			   Stat bar glow effects — per-stat accent colors
			   =================================================== */

			.kk-garage__stat-row--speed .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-orange-dim), var(--color-accent-orange) );
				box-shadow: 0 0 8px var(--color-accent-orange);
			}

			.kk-garage__stat-row--handling .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-cyan-dim), var(--color-accent-cyan) );
				box-shadow: 0 0 8px var(--color-accent-cyan);
			}

			.kk-garage__stat-row--acceleration .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-yellow-dim), var(--color-accent-yellow) );
				box-shadow: 0 0 8px var(--color-accent-yellow);
			}

			.kk-garage__stat-row--weight .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-pink-dim), var(--color-accent-pink) );
				box-shadow: 0 0 8px var(--color-accent-pink);
			}

			.kk-garage__stat-row--boost .kk-progress-bar__fill {
				background: linear-gradient( 90deg, var(--color-accent-orange-dim), var(--color-accent-orange) );
				box-shadow: 0 0 8px var(--color-accent-orange);
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
					bottom: 14rem;
				}

				.kk-garage__equip-wrap {
					bottom: 10rem;
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

				.kk-garage__arrow {
					width: 2.75rem;
					height: 2.75rem;
				}

				.kk-garage__arrow-chevron {
					width: 1.1rem;
					height: 1.1rem;
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

		// Left arrow
		const leftArrow = document.createElement( 'button' );
		leftArrow.type = 'button';
		leftArrow.className = 'kk-garage__arrow kk-garage__arrow--left';
		leftArrow.setAttribute( 'aria-label', 'Previous kart' );

		const leftChevron = document.createElement( 'div' );
		leftChevron.className = 'kk-garage__arrow-chevron';
		leftChevron.setAttribute( 'aria-hidden', 'true' );
		leftArrow.appendChild( leftChevron );

		leftArrow.addEventListener( 'click', () => this._cycleKart( - 1 ) );
		root.appendChild( leftArrow );

		// Right arrow
		const rightArrow = document.createElement( 'button' );
		rightArrow.type = 'button';
		rightArrow.className = 'kk-garage__arrow kk-garage__arrow--right';
		rightArrow.setAttribute( 'aria-label', 'Next kart' );

		const rightChevron = document.createElement( 'div' );
		rightChevron.className = 'kk-garage__arrow-chevron';
		rightChevron.setAttribute( 'aria-hidden', 'true' );
		rightArrow.appendChild( rightChevron );

		rightArrow.addEventListener( 'click', () => this._cycleKart( 1 ) );
		root.appendChild( rightArrow );

		// Kart name
		this._kartNameEl = document.createElement( 'div' );
		this._kartNameEl.className = 'kk-garage__kart-name';
		this._kartNameEl.setAttribute( 'aria-live', 'polite' );
		root.appendChild( this._kartNameEl );

		// EQUIP button wrapper
		this._equipWrap = document.createElement( 'div' );
		this._equipWrap.className = 'kk-garage__equip-wrap';

		this._equipBtn = new CTAButton( {
			label:     'EQUIP',
			variant:   'primary',
			ariaLabel: 'Equip selected kart',
			onClick:   () => this._handleEquip(),
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

		// Kart name
		if ( this._kartNameEl ) {

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

				this._equipBtn.setLabel( 'EQUIPPED' );
				this._equipWrap.classList.add( 'kk-garage__equip-wrap--equipped' );

			} else {

				this._equipBtn.setLabel( 'EQUIP' );
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
		this._equipBtn.setLabel( 'EQUIPPED' );
		this._equipWrap.classList.add( 'kk-garage__equip-wrap--equipped' );

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

		// Sync 3D preview to current kart.
		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._currentVehicle().id );

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
		this._equipBtn = null;
		this._raceBtn = null;
		this._kartNameEl = null;
		this._equipWrap = null;

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}

GaragePanel._cssInjected = false;
