/**
 * GaragePanel — GARAGE tab content panel.
 *
 * Persistent panel (never destroyed on tab switch). Mounted once by AppShell
 * into #kk-panel-garage. Shows a kart thumbnail grid (all 8 karts),
 * stat bars for the highlighted kart, an EQUIP button, and a secondary
 * RACE button that mirrors RacePanel behavior.
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

		/** @type {string} Currently highlighted kart id (not necessarily equipped). */
		this._highlightedId = this._settings.getSelectedKartId();

		/** @type {Map<string, ProgressBar>} stat key → ProgressBar instance */
		this._statBars = new Map();

		/** @type {HTMLElement|null} */
		this._thumbGrid = null;

		/** @type {HTMLElement|null} */
		this._kartNameEl = null;

		/** @type {CTAButton|null} */
		this._equipBtn = null;

		/** @type {CTAButton|null} */
		this._raceBtn = null;

		/** @type {HTMLElement|null} */
		this._root = null;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

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
			   Garage panel root
			   =================================================== */

			.kk-garage {
				display: flex;
				flex-direction: column;
				gap: var(--space-4, 1rem);
				padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
				max-width: 40rem;
				margin: 0 auto;
				box-sizing: border-box;
			}

			/* ===================================================
			   Section title
			   =================================================== */

			.kk-garage__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-2xl, 1.5rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
				color: var(--color-white, #fff);
				margin: 0;
				background: linear-gradient(180deg, #fff 55%, #aaa 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}

			/* ===================================================
			   Kart name (highlighted)
			   =================================================== */

			.kk-garage__kart-name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-accent-orange, #f97316);
			}

			/* ===================================================
			   Thumbnail grid
			   =================================================== */

			.kk-garage__grid {
				display: grid;
				grid-template-columns: repeat(4, 1fr);
				gap: var(--space-2, 0.5rem);
			}

			.kk-garage__thumb {
				aspect-ratio: 1.2;
				background: var(--color-ink-800, #1a1a1a);
				border: 2px solid var(--color-panel-border, rgba(255,255,255,0.1));
				border-radius: var(--radius-sm, 4px);
				cursor: pointer;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 2px;
				padding: var(--space-1, 0.25rem);
				transition: border-color var(--duration-fast, 150ms) var(--ease-standard, ease),
				            transform var(--duration-fast, 150ms) var(--ease-standard, ease),
				            box-shadow var(--duration-fast, 150ms) var(--ease-standard, ease);
				position: relative;
				overflow: hidden;
			}

			.kk-garage__thumb:hover {
				border-color: var(--color-ink-300, #aaa);
				transform: translateY(-2px);
			}

			.kk-garage__thumb:focus-visible {
				outline: 2px solid var(--color-accent-orange, #f97316);
				outline-offset: 2px;
			}

			.kk-garage__thumb--highlighted {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 12px rgba(249, 115, 22, 0.35);
			}

			.kk-garage__thumb--equipped {
				border-color: var(--color-accent-cyan, #06b6d4);
				box-shadow: 0 0 8px rgba(6, 182, 212, 0.3);
			}

			.kk-garage__thumb--equipped.kk-garage__thumb--highlighted {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 12px rgba(249, 115, 22, 0.35),
				            0 0 6px rgba(6, 182, 212, 0.2);
			}

			.kk-garage__thumb-icon {
				color: var(--color-ink-500, #555);
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.kk-garage__thumb-name {
				font-family: var(--font-ui, sans-serif);
				font-size: 0.6rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				color: var(--color-ink-300, #aaa);
				text-align: center;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				width: 100%;
				padding: 0 2px;
				line-height: 1.2;
			}

			.kk-garage__thumb-badge {
				position: absolute;
				top: 3px;
				right: 3px;
				font-family: var(--font-ui, sans-serif);
				font-size: 0.5rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				color: var(--color-accent-cyan, #06b6d4);
				letter-spacing: 0.05em;
			}

			/* ===================================================
			   Stats panel
			   =================================================== */

			.kk-garage__stats {
				background: var(--color-panel-bg, rgba(0,0,0,0.65));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.12));
				border-radius: var(--radius-md, 8px);
				padding: var(--space-4, 1rem);
				display: flex;
				flex-direction: column;
				gap: var(--space-3, 0.75rem);
				backdrop-filter: blur(8px);
			}

			.kk-garage__stats-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding-bottom: var(--space-2, 0.5rem);
			}

			.kk-garage__stat-row {
				display: flex;
				flex-direction: column;
				gap: var(--space-1, 0.25rem);
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
			   Action buttons
			   =================================================== */

			.kk-garage__actions {
				display: flex;
				gap: var(--space-3, 0.75rem);
				justify-content: flex-end;
			}

			.kk-garage__actions .kk-cta-button {
				flex: 1;
				min-width: 0;
			}

			/* ===================================================
			   Stat bar glow effects — per-stat accent colors
			   =================================================== */

			.kk-garage__stat-row--speed .kk-progress-bar__fill {
				background: linear-gradient(90deg, var(--color-accent-orange-dim), var(--color-accent-orange));
				box-shadow: 0 0 8px var(--color-accent-orange);
			}

			.kk-garage__stat-row--handling .kk-progress-bar__fill {
				background: linear-gradient(90deg, var(--color-accent-cyan-dim), var(--color-accent-cyan));
				box-shadow: 0 0 8px var(--color-accent-cyan);
			}

			.kk-garage__stat-row--acceleration .kk-progress-bar__fill {
				background: linear-gradient(90deg, var(--color-accent-yellow-dim), var(--color-accent-yellow));
				box-shadow: 0 0 8px var(--color-accent-yellow);
			}

			.kk-garage__stat-row--weight .kk-progress-bar__fill {
				background: linear-gradient(90deg, var(--color-accent-pink-dim), var(--color-accent-pink));
				box-shadow: 0 0 8px var(--color-accent-pink);
			}

			.kk-garage__stat-row--boost .kk-progress-bar__fill {
				background: linear-gradient(90deg, var(--color-accent-orange-dim), var(--color-accent-orange));
				box-shadow: 0 0 8px var(--color-accent-orange);
			}

			/* ===================================================
			   Responsive: small screens get 2-column thumbs
			   =================================================== */

			@media (max-width: 400px) {
				.kk-garage__grid {
					grid-template-columns: repeat(2, 1fr);
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

		// Title
		const title = document.createElement( 'h2' );
		title.className = 'kk-garage__title';
		title.textContent = 'GARAGE';
		root.appendChild( title );

		// Kart name
		this._kartNameEl = document.createElement( 'div' );
		this._kartNameEl.className = 'kk-garage__kart-name';
		root.appendChild( this._kartNameEl );

		// Thumbnail grid
		this._thumbGrid = document.createElement( 'div' );
		this._thumbGrid.className = 'kk-garage__grid';
		this._thumbGrid.setAttribute( 'role', 'listbox' );
		this._thumbGrid.setAttribute( 'aria-label', 'Kart selection' );
		root.appendChild( this._thumbGrid );

		this._buildThumbnails();

		// Stats panel
		const statsPanel = document.createElement( 'section' );
		statsPanel.className = 'kk-garage__stats';
		statsPanel.setAttribute( 'aria-label', 'Kart statistics' );

		const statsLabel = document.createElement( 'div' );
		statsLabel.className = 'kk-garage__stats-label';
		statsLabel.textContent = 'KART STATS';
		statsPanel.appendChild( statsLabel );

		for ( const def of STAT_DEFS ) {

			const row = document.createElement( 'div' );
			row.className = `kk-garage__stat-row kk-garage__stat-row--${def.key}`;

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

		// Action buttons
		const actions = document.createElement( 'div' );
		actions.className = 'kk-garage__actions';

		this._equipBtn = new CTAButton( {
			label:     'EQUIP',
			variant:   'primary',
			ariaLabel: 'Equip selected kart',
			onClick:   () => this._handleEquip(),
		} );
		actions.appendChild( this._equipBtn.el );

		this._raceBtn = new CTAButton( {
			label:     'RACE',
			variant:   'secondary',
			ariaLabel: 'Start race with selected mode',
			onClick:   () => this._handleRace(),
		} );
		actions.appendChild( this._raceBtn.el );

		root.appendChild( actions );

		this._root = root;

		// Set initial state
		this._syncToHighlighted();

	}

	// ---------------------------------------------------------------------------
	// Thumbnail grid
	// ---------------------------------------------------------------------------

	_buildThumbnails() {

		const grid = this._thumbGrid;
		grid.innerHTML = '';

		const equippedId = this._settings.getSelectedKartId();
		const vehicles = getAllVehicles();

		for ( const v of vehicles ) {

			const thumb = document.createElement( 'button' );
			thumb.type = 'button';
			thumb.role = 'option';
			thumb.className = 'kk-garage__thumb';
			thumb.dataset.kartId = v.id;
			thumb.setAttribute( 'aria-label', v.label );
			thumb.setAttribute( 'aria-selected', String( v.id === this._highlightedId ) );

			if ( v.id === this._highlightedId ) {

				thumb.classList.add( 'kk-garage__thumb--highlighted' );

			}

			if ( v.id === equippedId ) {

				thumb.classList.add( 'kk-garage__thumb--equipped' );

				const badge = document.createElement( 'div' );
				badge.className = 'kk-garage__thumb-badge';
				badge.textContent = 'EQ';
				badge.setAttribute( 'aria-hidden', 'true' );
				thumb.appendChild( badge );

			}

			// Kart icon placeholder
			const icon = document.createElement( 'div' );
			icon.className = 'kk-garage__thumb-icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.innerHTML = `<svg width="32" height="20" viewBox="0 0 48 28" fill="none"
				stroke="currentColor" stroke-width="2" aria-hidden="true">
				<rect x="6" y="12" width="36" height="10" rx="3"/>
				<ellipse cx="14" cy="24" rx="4" ry="3"/>
				<ellipse cx="34" cy="24" rx="4" ry="3"/>
				<path d="M18 12 L22 4 H30 L34 12"/>
			</svg>`;
			thumb.appendChild( icon );

			const nameEl = document.createElement( 'div' );
			nameEl.className = 'kk-garage__thumb-name';
			nameEl.textContent = v.label;
			thumb.appendChild( nameEl );

			thumb.addEventListener( 'click', () => {

				this._selectKart( v.id );

			} );

			grid.appendChild( thumb );

		}

	}

	// ---------------------------------------------------------------------------
	// Selection
	// ---------------------------------------------------------------------------

	/**
	 * Highlight a kart in the grid and update stats + 3D preview.
	 *
	 * @param {string} kartId
	 */
	_selectKart( kartId ) {

		this._highlightedId = kartId;

		// Update thumbnail highlights
		for ( const thumb of this._thumbGrid.querySelectorAll( '.kk-garage__thumb' ) ) {

			const isHighlighted = thumb.dataset.kartId === kartId;
			thumb.classList.toggle( 'kk-garage__thumb--highlighted', isHighlighted );
			thumb.setAttribute( 'aria-selected', String( isHighlighted ) );

		}

		this._syncToHighlighted();

		// Update 3D preview
		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( kartId );

		}

	}

	/**
	 * Sync kart name, stat bars, and equip button to the currently highlighted kart.
	 */
	_syncToHighlighted() {

		const vehicle = getVehicleById( this._highlightedId );
		if ( ! vehicle ) return;

		const stats = vehicle.stats;
		const equippedId = this._settings.getSelectedKartId();

		// Kart name
		if ( this._kartNameEl ) {

			this._kartNameEl.textContent = vehicle.label;

		}

		// Stat bars
		for ( const def of STAT_DEFS ) {

			const val = stats[ def.statKey ] ?? 0;
			const bar = this._statBars.get( def.key );

			if ( bar ) {

				bar.setValue( val, `${val} out of 10` );

			}

			const scoreEl = this._root.querySelector( `[data-stat-key="${def.key}"]` );
			if ( scoreEl ) {

				scoreEl.textContent = `${val} / 10`;

			}

		}

		// Equip button label
		if ( this._equipBtn ) {

			if ( this._highlightedId === equippedId ) {

				this._equipBtn.setLabel( 'EQUIPPED' );

			} else {

				this._equipBtn.setLabel( 'EQUIP' );

			}

		}

	}

	// ---------------------------------------------------------------------------
	// Handlers
	// ---------------------------------------------------------------------------

	_handleEquip() {

		const equippedId = this._settings.getSelectedKartId();

		if ( this._highlightedId === equippedId ) {

			// Already equipped — no-op with feedback.
			this._services.notification?.show( {
				message:  'Already equipped!',
				variant:  'info',
				duration: 1500,
			} );
			return;

		}

		// Persist selection.
		this._settings.setSelectedKartId( this._highlightedId );

		const vehicle = getVehicleById( this._highlightedId );

		// Update equipped badge on thumbnails.
		this._rebuildEquippedBadges();

		// Update equip button label.
		if ( this._equipBtn ) {

			this._equipBtn.setLabel( 'EQUIPPED' );

		}

		// Toast confirmation.
		this._services.notification?.show( {
			message:  `${vehicle.label} EQUIPPED`,
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
				message:  `${mode.toUpperCase()} mode — coming soon`,
				variant:  'info',
				duration: 2500,
			} );

		}

	}

	// ---------------------------------------------------------------------------
	// Equipped badge management
	// ---------------------------------------------------------------------------

	/**
	 * Remove all equipped badges, then re-add to the currently equipped kart.
	 */
	_rebuildEquippedBadges() {

		const equippedId = this._settings.getSelectedKartId();

		for ( const thumb of this._thumbGrid.querySelectorAll( '.kk-garage__thumb' ) ) {

			const isEquipped = thumb.dataset.kartId === equippedId;

			thumb.classList.toggle( 'kk-garage__thumb--equipped', isEquipped );

			// Remove existing badge
			const existing = thumb.querySelector( '.kk-garage__thumb-badge' );
			if ( existing ) existing.remove();

			// Add badge if equipped
			if ( isEquipped ) {

				const badge = document.createElement( 'div' );
				badge.className = 'kk-garage__thumb-badge';
				badge.textContent = 'EQ';
				badge.setAttribute( 'aria-hidden', 'true' );
				thumb.insertBefore( badge, thumb.firstChild );

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
		const equippedId = this._settings.getSelectedKartId();

		// If the highlighted kart is no longer valid, reset to equipped.
		const allIds = getAllVehicles().map( v => v.id );
		if ( ! allIds.includes( this._highlightedId ) ) {

			this._highlightedId = equippedId;

		}

		this._rebuildEquippedBadges();
		this._syncToHighlighted();

		// Sync 3D preview to highlighted kart.
		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._highlightedId );

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

		for ( const bar of this._statBars.values() ) {

			bar.dispose();

		}

		this._statBars.clear();
		this._equipBtn = null;
		this._raceBtn = null;
		this._kartNameEl = null;
		this._thumbGrid = null;

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}

GaragePanel._cssInjected = false;
