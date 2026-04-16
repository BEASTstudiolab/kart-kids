/**
 * GaragePanel — GARAGE tab content panel.
 *
 * Sub-tabs: KARTS (grid selection) and PAINT (color customizer).
 * Layout mirrors the Character panel — cream/outline design system.
 *
 * Lifecycle: constructor(container, services), show(), hide(), dispose().
 *
 * Data sources:
 *   - VehicleRegistry  — getAllVehicles()
 *   - Settings         — getSelectedKartId(), setSelectedKartId(), get/set('vehicleColor')
 *   - services.garagePreview.setKart()  — 3D turntable sync
 *   - services.lobbyScene.setKart()     — lobby-scene preview sync
 */

import { getAllVehicles }     from '../../VehicleRegistry.js';
import { Settings }           from '../../Settings.js';
import { ProgressBar }        from '../components/ProgressBar.js';
import { MarginalPanelHeader } from '../components/MarginalPanelHeader.js';
import { getKartThumbnail }   from '../garage/KartThumbnailRenderer.js';

const STAT_DEFS = [
	{ key: 'speed',        label: 'SPEED',         statKey: 'speed' },
	{ key: 'handling',     label: 'HANDLING',      statKey: 'handling' },
	{ key: 'acceleration', label: 'ACCELERATION',  statKey: 'acceleration' },
	{ key: 'weight',       label: 'WEIGHT',        statKey: 'weight' },
	{ key: 'boost',        label: 'BOOST',         statKey: 'boost' },
];

const TAB_DEFS = [
	{ id: 'karts', label: 'Karts' },
	{ id: 'paint', label: 'Paint' },
];

const COLOR_FALLBACK = '#f97316';

export class GaragePanel {

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._settings = new Settings();
		this._vehicles = getAllVehicles();

		this._currentIndex = this._vehicles.findIndex( v => v.id === this._settings.getSelectedKartId() );
		if ( this._currentIndex < 0 ) this._currentIndex = 0;

		this._activeTabId = 'karts';
		this._statBars = new Map();
		this._tabButtons = new Map();
		this._kartGridEl = null;
		this._paintInputEl = null;
		this._paintRowEl = null;
		this._kartsPaneEl = null;
		this._paintPaneEl = null;
		this._activeKartLabelEl = null;
		this._root = null;

		this._keyHandler = null;
		this._settingsChangedHandler = null;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	_currentVehicle() {

		return this._vehicles[ this._currentIndex ];

	}

	_injectCSS() {

		if ( GaragePanel._cssInjected ) return;
		GaragePanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-garage {
				position: relative;
				width: 100%;
				height: 100%;
				overflow: hidden;
				--mv-cream: #F7F3E9;
				--mv-red: #D82C2C;
				--mv-dark: #0F1115;
				--mv-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
				--mv-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
				background: unset;
			}

			.kk-garage,
			.kk-garage * {
				cursor: crosshair;
			}

			.kk-garage__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(0, 1fr);
				grid-template-rows: auto auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 16px;
			}

			.kk-garage__interface > * {
				pointer-events: auto;
			}

			.kk-garage__header.kk-mv-header {
				padding-top: 57px;
			}

			/* ---------- Sub-tab strip ---------- */

			.kk-garage__tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				padding: 4px 0;
			}

			.kk-garage__tab {
				flex: 0 0 9rem;
				padding: 0.7rem 1.1rem;
				border: 1px solid rgba(247, 243, 233, 0.42);
				background: rgba(15, 17, 21, 0.45);
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-action, 0.64rem);
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				cursor: pointer;
				transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
				clip-path: polygon(0 0, 100% 0, 100% 86%, 94% 100%, 0 100%);
			}

			.kk-garage__tab:hover {
				background: rgba(15, 17, 21, 0.65);
				border-color: rgba(247, 243, 233, 0.78);
				transform: translateY(-1px);
			}

			.kk-garage__tab--active {
				background: var(--mv-cream);
				color: var(--mv-dark);
				border-color: var(--mv-cream);
			}

			/* ---------- Stage (3D preview behind, panels overlaid) ---------- */

			.kk-garage__stage {
				position: relative;
				min-height: 0;
				pointer-events: none;
			}

			.kk-garage__stage > * {
				pointer-events: auto;
			}

			/* Dark transparent sidebar (content area) */
			.kk-garage__panel {
				position: absolute;
				top: 0;
				left: 0;
				width: min(var(--kk-customizer-builder-width, 52rem), calc(100vw - 3rem));
				max-height: min(38rem, calc(100% - 1rem));
				background: rgba(15, 17, 21, 0.78);
				color: var(--mv-cream);
				border: 1px solid rgba(247, 243, 233, 0.18);
				border-radius: 0;
				clip-path: polygon(0 0, 100% 0, 100% 97%, 98% 100%, 0 100%);
				box-shadow: 0 28px 46px rgba(0, 0, 0, 0.32);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				padding: 1.1rem 1.25rem 1.4rem;
				display: flex;
				flex-direction: column;
				gap: 0.85rem;
				overflow-y: auto;
				z-index: 4;
			}

			.kk-garage__panel-eyebrow {
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-eyebrow, 0.625rem);
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				color: var(--mv-red);
			}

			.kk-garage__panel-title {
				font-family: var(--mv-font-display);
				font-size: var(--text-customizer-title, clamp(1.85rem, 3.4vw, 2.6rem));
				font-weight: 900;
				line-height: 0.92;
				letter-spacing: -0.04em;
				text-transform: uppercase;
				color: var(--mv-cream);
				margin: 0;
			}

			.kk-garage__panel-copy {
				margin: 0;
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-copy, 0.78rem);
				line-height: 1.5;
				letter-spacing: 0.06em;
				color: rgba(247, 243, 233, 0.72);
			}

			/* Pane visibility controlled by tab */
			.kk-garage__pane[hidden] { display: none; }

			/* ---------- Karts grid (4 columns) ---------- */

			.kk-garage__kart-grid {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 0.5rem;
			}

			.kk-garage__kart-card {
				display: flex;
				flex-direction: column;
				align-items: stretch;
				justify-content: flex-start;
				gap: 0.45rem;
				min-height: 8.4rem;
				padding: 0.7rem 0.75rem;
				border: 1px solid rgba(247, 243, 233, 0.18);
				background: transparent;
				color: var(--mv-cream);
				border-radius: 0;
				font-family: var(--mv-font-mono);
				text-align: left;
				cursor: pointer;
				transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
				position: relative;
			}

			.kk-garage__kart-card-thumb {
				display: block;
				width: 100%;
				aspect-ratio: 1 / 1;
				background: transparent;
				overflow: hidden;
			}

			.kk-garage__kart-card-thumb img {
				display: block;
				width: 100%;
				height: 100%;
				object-fit: contain;
				object-position: center;
				filter: drop-shadow(0 6px 10px rgba(0,0,0,0.35));
			}

			.kk-garage__kart-card-thumb-fallback {
				display: grid;
				place-items: center;
				width: 100%;
				height: 100%;
				font-family: var(--mv-font-display);
				font-size: 0.9rem;
				color: rgba(247, 243, 233, 0.48);
				letter-spacing: 0.12em;
			}

			.kk-garage__kart-card:hover {
				transform: translateY(-1px);
				border-color: rgba(247, 243, 233, 0.42);
				background: rgba(247, 243, 233, 0.08);
				box-shadow: 0 14px 24px rgba(0, 0, 0, 0.18);
			}

			.kk-garage__kart-card--active {
				background: rgba(216, 44, 44, 0.18);
				border-color: rgba(216, 44, 44, 0.78);
			}

			.kk-garage__kart-card-name {
				font-family: var(--mv-font-display);
				font-size: 0.9rem;
				font-weight: 900;
				line-height: 1;
				letter-spacing: -0.02em;
				text-transform: uppercase;
				color: var(--mv-cream);
			}

			.kk-garage__kart-card-stat {
				font-family: var(--mv-font-mono);
				font-size: 0.58rem;
				font-weight: 700;
				letter-spacing: 0.14em;
				color: rgba(247, 243, 233, 0.62);
			}

			.kk-garage__kart-card-status {
				align-self: flex-end;
				font-size: 0.48rem;
				font-weight: 700;
				letter-spacing: 0.18em;
				color: var(--mv-red);
			}

			/* ---------- Paint tab ---------- */

			.kk-garage__paint-row {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				align-items: center;
				gap: 0.6rem;
				padding: 0.7rem 0.85rem;
				background: rgba(247, 243, 233, 0.04);
				border: 1px solid rgba(247, 243, 233, 0.18);
			}

			.kk-garage__paint-row--custom {
				border-color: rgba(216, 44, 44, 0.7);
				background: rgba(216, 44, 44, 0.12);
			}

			.kk-garage__paint-label {
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-control, 0.875rem);
				font-weight: 700;
				letter-spacing: 0.14em;
				color: var(--mv-cream);
			}

			.kk-garage__paint-input {
				width: 2.6rem;
				height: 2.6rem;
				border: 1px solid rgba(247, 243, 233, 0.28);
				border-radius: 999px;
				background: transparent;
				cursor: pointer;
				padding: 0;
			}

			.kk-garage__paint-input::-webkit-color-swatch-wrapper {
				padding: 0;
			}

			.kk-garage__paint-input::-webkit-color-swatch {
				border: none;
				border-radius: 999px;
			}

			/* ---------- Stats panel (dark transparent, top-right) ---------- */

			.kk-garage__stats {
				position: absolute;
				right: 0;
				top: 0;
				width: min(20rem, calc(100vw - 3rem));
				background: rgba(15, 17, 21, 0.78);
				color: var(--mv-cream);
				border: 1px solid rgba(247, 243, 233, 0.18);
				padding: 0.9rem 1rem;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				clip-path: polygon(0 0, 100% 0, 100% 92%, 93% 100%, 0 100%);
				box-shadow: 0 28px 46px rgba(0, 0, 0, 0.32);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				z-index: 4;
			}

			.kk-garage__stats-label {
				font-family: var(--mv-font-mono);
				font-size: 0.66rem;
				font-weight: 700;
				letter-spacing: 0.22em;
				color: rgba(247, 243, 233, 0.7);
				border-bottom: 1px solid rgba(247, 243, 233, 0.18);
				padding-bottom: 0.35rem;
				display: flex;
				justify-content: space-between;
				align-items: baseline;
				gap: 0.5rem;
			}

			.kk-garage__stats-active {
				font-family: var(--mv-font-display);
				font-size: var(--text-customizer-summary, 1rem);
				font-weight: 900;
				letter-spacing: -0.02em;
				color: var(--mv-cream);
				text-transform: uppercase;
			}

			.kk-garage__stat-row {
				display: flex;
				flex-direction: column;
				gap: 3px;
			}

			.kk-garage__stat-header {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.kk-garage__stat-name {
				font-family: var(--mv-font-mono);
				font-size: 0.66rem;
				font-weight: 700;
				letter-spacing: 0.14em;
				color: rgba(247, 243, 233, 0.78);
			}

			.kk-garage__stat-score {
				font-family: var(--mv-font-mono);
				font-size: 0.66rem;
				font-weight: 700;
				color: var(--mv-cream);
				white-space: nowrap;
			}

			.kk-garage__stat-row .kk-progress-bar {
				background: rgba(247, 243, 233, 0.1);
				height: 8px;
				border-radius: 0;
			}

			.kk-garage__stat-row .kk-progress-bar__fill {
				background: var(--mv-cream);
				border-radius: 0;
				transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-garage__stat-row .kk-progress-bar__fill { transition: none; }
			}

			@media (max-width: 980px) {
				.kk-garage {
					overflow-y: auto;
				}

				.kk-garage__interface {
					grid-template-rows: auto auto auto;
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 14px;
				}

				.kk-garage__panel,
				.kk-garage__stats {
					position: relative;
					top: auto;
					left: auto;
					right: auto;
					bottom: auto;
					width: 100%;
					max-height: none;
				}

				.kk-garage__stage {
					display: flex;
					flex-direction: column;
					gap: 14px;
				}
			}

			@media (max-width: 480px) {
				.kk-garage__panel { padding: 0.85rem; }
				.kk-garage__stats { padding: 0.85rem; }
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const root = document.createElement( 'div' );
		root.className = 'kk-garage';
		root.setAttribute( 'role', 'region' );
		root.setAttribute( 'aria-label', 'Garage — kart selection and paint' );

		const frame = document.createElement( 'div' );
		frame.className = 'kk-garage__interface';
		root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Garage',
			subtitle: 'Vehicle Index // Selection, Paint, Performance',
			badge: '',
			className: 'kk-garage__header',
		} ).el );

		// Sub-tab strip
		const tabs = document.createElement( 'nav' );
		tabs.className = 'kk-garage__tabs';
		tabs.setAttribute( 'aria-label', 'Garage categories' );
		for ( const def of TAB_DEFS ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'kk-garage__tab';
			btn.dataset.tabId = def.id;
			btn.textContent = def.label;
			btn.addEventListener( 'click', () => this._setActiveTab( def.id ) );
			tabs.appendChild( btn );
			this._tabButtons.set( def.id, btn );

		}
		frame.appendChild( tabs );

		// Stage with cream content panel + stats
		const stage = document.createElement( 'div' );
		stage.className = 'kk-garage__stage';
		frame.appendChild( stage );

		const panel = document.createElement( 'section' );
		panel.className = 'kk-garage__panel';
		panel.setAttribute( 'aria-label', 'Garage customizer' );
		stage.appendChild( panel );

		const eyebrow = document.createElement( 'div' );
		eyebrow.className = 'kk-garage__panel-eyebrow';
		eyebrow.textContent = 'Customizer';
		panel.appendChild( eyebrow );

		const title = document.createElement( 'h2' );
		title.className = 'kk-garage__panel-title';
		title.textContent = 'Garage';
		panel.appendChild( title );

		// Karts pane
		this._kartsPaneEl = document.createElement( 'div' );
		this._kartsPaneEl.className = 'kk-garage__pane';
		this._kartsPaneEl.dataset.paneId = 'karts';
		panel.appendChild( this._kartsPaneEl );

		const kartsCopy = document.createElement( 'p' );
		kartsCopy.className = 'kk-garage__panel-copy';
		kartsCopy.textContent = 'Pick a kart. Stats update live in the panel below.';
		this._kartsPaneEl.appendChild( kartsCopy );

		this._kartGridEl = document.createElement( 'div' );
		this._kartGridEl.className = 'kk-garage__kart-grid';
		this._kartsPaneEl.appendChild( this._kartGridEl );

		// Paint pane
		this._paintPaneEl = document.createElement( 'div' );
		this._paintPaneEl.className = 'kk-garage__pane';
		this._paintPaneEl.dataset.paneId = 'paint';
		panel.appendChild( this._paintPaneEl );

		const paintCopy = document.createElement( 'p' );
		paintCopy.className = 'kk-garage__panel-copy';
		paintCopy.textContent = 'Dial in your kart finish here.';
		this._paintPaneEl.appendChild( paintCopy );

		this._paintRowEl = document.createElement( 'div' );
		this._paintRowEl.className = 'kk-garage__paint-row';

		const paintLabel = document.createElement( 'span' );
		paintLabel.className = 'kk-garage__paint-label';
		paintLabel.textContent = 'Kart Paint';
		this._paintRowEl.appendChild( paintLabel );

		this._paintInputEl = document.createElement( 'input' );
		this._paintInputEl.type = 'color';
		this._paintInputEl.className = 'kk-garage__paint-input';
		this._paintInputEl.value = COLOR_FALLBACK;
		this._paintInputEl.setAttribute( 'aria-label', 'Kart paint color' );
		this._paintInputEl.addEventListener( 'focus', () => {

			this._services.setMenuPreviewFocus?.( 'garage-kart' );

		} );
		this._paintInputEl.addEventListener( 'input', () => {

			this._services.setMenuPreviewFocus?.( 'garage-kart' );
			this._settings.set( 'vehicleColor', this._paintInputEl.value );
			this._syncPaint();

		} );
		this._paintRowEl.appendChild( this._paintInputEl );
		this._paintPaneEl.appendChild( this._paintRowEl );

		// Stats panel
		const statsPanel = document.createElement( 'section' );
		statsPanel.className = 'kk-garage__stats';
		statsPanel.setAttribute( 'aria-label', 'Kart statistics' );

		const statsLabel = document.createElement( 'div' );
		statsLabel.className = 'kk-garage__stats-label';

		const statsLabelText = document.createElement( 'span' );
		statsLabelText.textContent = 'Stats';
		statsLabel.appendChild( statsLabelText );

		this._activeKartLabelEl = document.createElement( 'span' );
		this._activeKartLabelEl.className = 'kk-garage__stats-active';
		this._activeKartLabelEl.textContent = '—';
		statsLabel.appendChild( this._activeKartLabelEl );

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
				label: def.label,
				value: 0,
				min: 0,
				max: 10,
				variant: 'stat',
				animated: true,
				showEndLabel: false,
			} );
			row.appendChild( bar.el );
			this._statBars.set( def.key, bar );

			statsPanel.appendChild( row );

		}

		stage.appendChild( statsPanel );

		this._root = root;

		this._keyHandler = ( e ) => this._onKeyDown( e );
		document.addEventListener( 'keydown', this._keyHandler );

		this._settingsChangedHandler = ( e ) => {

			if ( e.detail.key === 'vehicleColor' ) {

				this._settings = new Settings();
				this._syncPaint();

			}

		};
		window.addEventListener( 'settings-changed', this._settingsChangedHandler );

		this._setActiveTab( this._activeTabId );
		this._renderKartGrid();
		this._syncToCurrentKart();
		this._syncPaint();

	}

	_setActiveTab( tabId ) {

		this._activeTabId = tabId;
		for ( const [ id, btn ] of this._tabButtons ) {

			const active = id === tabId;
			btn.classList.toggle( 'kk-garage__tab--active', active );
			btn.setAttribute( 'aria-pressed', String( active ) );

		}
		if ( this._kartsPaneEl ) this._kartsPaneEl.hidden = tabId !== 'karts';
		if ( this._paintPaneEl ) this._paintPaneEl.hidden = tabId !== 'paint';

	}

	_selectKart( index ) {

		this._currentIndex = index;
		this._syncToCurrentKart();

		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._currentVehicle().id );

		}

		if ( this._services.lobbyScene ) {

			this._services.lobbyScene.setKart( this._currentVehicle().id );

		}

		this._settings.setSelectedKartId( this._currentVehicle().id );
		this._renderKartGrid();

	}

	_onKeyDown( e ) {

		if ( ! this._root || this._root.offsetParent === null ) return;
		if ( this._activeTabId !== 'karts' ) return;

		const count = this._vehicles.length;
		if ( e.key === 'ArrowLeft' ) {

			e.preventDefault();
			this._selectKart( ( this._currentIndex - 1 + count ) % count );

		} else if ( e.key === 'ArrowRight' ) {

			e.preventDefault();
			this._selectKart( ( this._currentIndex + 1 ) % count );

		}

	}

	_renderKartGrid() {

		if ( ! this._kartGridEl ) return;
		this._kartGridEl.innerHTML = '';

		const equippedId = this._settings.getSelectedKartId();

		this._vehicles.forEach( ( vehicle, index ) => {

			const card = document.createElement( 'button' );
			card.type = 'button';
			card.className = 'kk-garage__kart-card';
			card.dataset.kartId = vehicle.id;

			const isActive = index === this._currentIndex;
			const isEquipped = vehicle.id === equippedId;
			if ( isActive ) card.classList.add( 'kk-garage__kart-card--active' );

			const status = document.createElement( 'span' );
			status.className = 'kk-garage__kart-card-status';
			status.textContent = isEquipped ? 'Live' : '';
			card.appendChild( status );

			const thumb = document.createElement( 'div' );
			thumb.className = 'kk-garage__kart-card-thumb';
			card.appendChild( thumb );

			getKartThumbnail( vehicle.id ).then( ( entry ) => {

				if ( entry?.src ) {

					thumb.innerHTML = '';
					const img = document.createElement( 'img' );
					img.src = entry.src;
					img.alt = '';
					img.decoding = 'async';
					img.loading = 'lazy';
					thumb.appendChild( img );

				} else {

					const fallback = document.createElement( 'div' );
					fallback.className = 'kk-garage__kart-card-thumb-fallback';
					fallback.textContent = vehicle.label;
					thumb.innerHTML = '';
					thumb.appendChild( fallback );

				}

			} ).catch( () => {} );

			const name = document.createElement( 'span' );
			name.className = 'kk-garage__kart-card-name';
			name.textContent = vehicle.label;
			card.appendChild( name );

			const stat = document.createElement( 'span' );
			stat.className = 'kk-garage__kart-card-stat';
			stat.textContent = `SPD ${ vehicle.stats.speed } / 10`;
			card.appendChild( stat );

			card.addEventListener( 'click', () => this._selectKart( index ) );
			this._kartGridEl.appendChild( card );

		} );

	}

	_syncPaint() {

		const value = this._settings.get( 'vehicleColor' ) || '';
		if ( this._paintInputEl ) this._paintInputEl.value = value || COLOR_FALLBACK;
		if ( this._paintRowEl ) this._paintRowEl.classList.toggle( 'kk-garage__paint-row--custom', !! value );

	}

	_syncToCurrentKart() {

		const vehicle = this._currentVehicle();
		if ( ! vehicle ) return;

		if ( this._activeKartLabelEl ) this._activeKartLabelEl.textContent = vehicle.label;

		const stats = vehicle.stats;
		for ( const def of STAT_DEFS ) {

			const val = stats[ def.statKey ] ?? 0;
			const bar = this._statBars.get( def.key );
			if ( bar ) bar.setValue( val, `${ val } out of 10` );

			const scoreEl = this._root.querySelector( `[data-stat-key="${ def.key }"]` );
			if ( scoreEl ) scoreEl.textContent = `${ val } / 10`;

		}

	}

	show() {

		this._settings = new Settings();
		this._vehicles = getAllVehicles();

		if ( this._currentIndex < 0 || this._currentIndex >= this._vehicles.length ) {

			const equippedId = this._settings.getSelectedKartId();
			this._currentIndex = this._vehicles.findIndex( v => v.id === equippedId );
			if ( this._currentIndex < 0 ) this._currentIndex = 0;

		}

		this._renderKartGrid();
		this._syncToCurrentKart();
		this._syncPaint();

		if ( this._services.garagePreview ) {

			this._services.garagePreview.setKart( this._currentVehicle().id );

		}

		if ( this._services.lobbyScene ) {

			this._services.lobbyScene.setKart( this._currentVehicle().id );
			this._services.lobbyScene.setAppearance( this._settings.getPlayerAppearance() );

		}

		this._services.setMenuPreviewFocus?.( 'garage-kart' );

	}

	hide() {}

	dispose() {

		if ( this._keyHandler ) {

			document.removeEventListener( 'keydown', this._keyHandler );
			this._keyHandler = null;

		}

		if ( this._settingsChangedHandler ) {

			window.removeEventListener( 'settings-changed', this._settingsChangedHandler );
			this._settingsChangedHandler = null;

		}

		for ( const bar of this._statBars.values() ) bar.dispose();
		this._statBars.clear();
		this._tabButtons.clear();

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}

GaragePanel._cssInjected = false;
