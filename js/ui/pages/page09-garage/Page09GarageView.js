/**
 * Page09GarageView — Garage / Customization Hub.
 *
 * Route: RouteIds.GARAGE ("/garage")
 *
 * Layout: full-screen dark scene with:
 *   - top row: brand wordmark + "GARAGE" title + tab strip
 *   - center: large HeroPreviewPanel (turntable pedestal)
 *   - left panel: KART STATS with ProgressBars
 *   - right panel: SAVE PRESET with preset slots
 *   - bottom bar: ROTATE, INSPECT, LOADOUT, SAVE buttons
 *
 * Public API consumed by Page09GarageController:
 *   setKartStats({ speed, accel, handling, boost })
 *   setPresets(presets[])
 *   setPreviewCaption(text)
 *   setActiveTab(tabId)
 *   setRotating(active)
 *   get backBtn()
 *   get tabBtns()
 *   get rotateBtn()
 *   get inspectBtn()
 *   get loadoutBtn()
 *   get saveBtn()
 *   get presetBtns()
 */

import { PageViewBase }      from '../../core/PageViewBase.js';
import { CTAButton }         from '../../components/CTAButton.js';
import { ProgressBar }       from '../../components/ProgressBar.js';
import { HeroPreviewPanel }  from '../../components/HeroPreviewPanel.js';
import { ButtonIds }         from '../../enums/ButtonIds.js';

/** Tab definitions in display order. */
const TABS = [
	{ id: ButtonIds.GARAGE_TAB_CHARACTERS,  label: 'CHARACTERS' },
	{ id: ButtonIds.GARAGE_TAB_KARTS,       label: 'KARTS' },
	{ id: ButtonIds.GARAGE_TAB_PAINT,       label: 'PAINT' },
	{ id: ButtonIds.GARAGE_TAB_WHEELS,      label: 'WHEELS' },
	{ id: ButtonIds.GARAGE_TAB_ACCESSORIES, label: 'ACCESSORIES' },
	{ id: ButtonIds.GARAGE_TAB_EMOTES,      label: 'EMOTES' },
];

/** Stat bar definitions. */
const STAT_DEFS = [
	{ key: 'speed',    label: 'Speed' },
	{ key: 'accel',    label: 'Acceleration' },
	{ key: 'handling', label: 'Handling' },
	{ key: 'boost',    label: 'Drift Power' },
];

export class Page09GarageView extends PageViewBase {

	constructor() {

		super( 'page-garage' );

		/** @type {HTMLButtonElement} */
		this._backBtn = null;

		/** @type {HTMLButtonElement[]} */
		this._tabBtns = [];

		/** @type {CTAButton} */
		this._rotateBtn = null;

		/** @type {CTAButton} */
		this._inspectBtn = null;

		/** @type {CTAButton} */
		this._loadoutBtn = null;

		/** @type {CTAButton} */
		this._saveBtn = null;

		/** @type {HTMLButtonElement[]} */
		this._presetBtns = [];

		/** @type {Map<string, ProgressBar>} key = stat key */
		this._statBars = new Map();

		/** @type {HeroPreviewPanel} */
		this._heroPanel = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page09GarageView._cssInjected ) return;
		Page09GarageView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* ===================================================
			   Page root
			   =================================================== */

			.page-garage {
				display: grid;
				grid-template-rows: auto auto 1fr auto;
				grid-template-areas:
					"topbar"
					"tabs"
					"content"
					"bottombar";
				min-height: 100vh;
				background: var(--color-bg-base, #0a0a0a);
				box-sizing: border-box;
				overflow: hidden;
			}

			/* ===================================================
			   Top bar — brand + back
			   =================================================== */

			.page-garage__topbar {
				grid-area: topbar;
				display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				padding: var(--space-4) var(--space-6);
				background: rgba(0, 0, 0, 0.6);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
			}

			.page-garage__back-btn {
				position: absolute;
				left: var(--space-6);
				top: 50%;
				transform: translateY(-50%);
				background: transparent;
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.15));
				border-radius: var(--radius-sm, 4px);
				color: var(--color-ink-300, #aaa);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				padding: var(--space-2) var(--space-4);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: var(--space-2);
				transition: border-color var(--duration-fast) var(--ease-standard),
				            color var(--duration-fast) var(--ease-standard);
				min-height: var(--hit-target-min, 44px);
			}

			.page-garage__back-btn:hover {
				border-color: var(--color-ink-200, #ccc);
				color: var(--color-white, #fff);
			}

			.page-garage__back-btn:focus-visible {
				outline: 2px solid var(--color-accent-orange, #f97316);
				outline-offset: 2px;
			}

			.page-garage__brand {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0;
			}

			.page-garage__brand-wordmark {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.2em);
				color: var(--color-ink-400, #666);
				line-height: 1;
			}

			.page-garage__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-4xl, 2.5rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
				color: var(--color-white, #fff);
				margin: 0;
				line-height: 1;
				/* Embossed plate treatment */
				background: linear-gradient(180deg, #fff 60%, #aaa 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}

			/* ===================================================
			   Tab strip
			   =================================================== */

			.page-garage__tabs {
				grid-area: tabs;
				display: flex;
				align-items: stretch;
				justify-content: center;
				gap: 0;
				background: rgba(0, 0, 0, 0.5);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding: 0 var(--space-4);
			}

			.page-garage__tab {
				padding: var(--space-3) var(--space-5);
				background: transparent;
				border: none;
				border-bottom: 3px solid transparent;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				cursor: pointer;
				transition:
					color var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard);
				white-space: nowrap;
				min-height: var(--hit-target-min, 44px);
			}

			.page-garage__tab:hover {
				color: var(--color-ink-100, #eee);
			}

			.page-garage__tab:focus-visible {
				outline: 2px solid var(--color-accent-orange, #f97316);
				outline-offset: -2px;
			}

			.page-garage__tab--active {
				color: var(--color-white, #fff);
				border-bottom-color: var(--color-accent-orange, #f97316);
			}

			/* ===================================================
			   Content area — 3-column
			   =================================================== */

			.page-garage__content {
				grid-area: content;
				display: grid;
				grid-template-columns: 220px 1fr 220px;
				grid-template-areas: "stats hero presets";
				gap: var(--space-4);
				padding: var(--space-4) var(--space-6);
				align-items: start;
			}

			/* ===================================================
			   Left — KART STATS panel
			   =================================================== */

			.page-garage__stats-panel {
				grid-area: stats;
				background: var(--color-panel-bg, rgba(0,0,0,0.55));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.12));
				border-radius: var(--radius-md, 8px);
				padding: var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				backdrop-filter: blur(8px);
			}

			.page-garage__panel-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding-bottom: var(--space-2);
			}

			.page-garage__stat-row {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-garage__stat-name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.08em);
				color: var(--color-ink-200, #ddd);
			}

			/* ===================================================
			   Center — Hero preview + pedestal
			   =================================================== */

			.page-garage__hero-wrap {
				grid-area: hero;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: var(--space-3);
				position: relative;
			}

			.page-garage__hero-panel {
				width: 100%;
				max-width: 520px;
			}

			/* Rotating modifier — visual feedback via CSS animation on inner */
			.page-garage__hero-wrap--rotating .kk-hero-preview-panel__inner {
				/* Subtle glow to indicate turntable is active */
				box-shadow: 0 0 32px rgba(249, 115, 22, 0.25);
			}

			.page-garage__brand-plate {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--space-2) var(--space-6);
				background: var(--color-panel-bg, rgba(0,0,0,0.7));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.15));
				border-radius: var(--radius-sm, 4px);
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.2em);
				color: var(--color-white, #fff);
			}

			/* ===================================================
			   Right — SAVE PRESET panel
			   =================================================== */

			.page-garage__presets-panel {
				grid-area: presets;
				background: var(--color-panel-bg, rgba(0,0,0,0.55));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.12));
				border-radius: var(--radius-md, 8px);
				padding: var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				backdrop-filter: blur(8px);
			}

			.page-garage__preset-list {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-garage__preset-btn {
				width: 100%;
				padding: var(--space-2) var(--space-3);
				background: var(--color-ink-800, #1a1a1a);
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				border-radius: var(--radius-sm, 4px);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.08em);
				color: var(--color-ink-200, #ddd);
				cursor: pointer;
				text-align: left;
				transition: border-color var(--duration-fast) var(--ease-standard),
				            color var(--duration-fast) var(--ease-standard),
				            background var(--duration-fast) var(--ease-standard);
				min-height: var(--hit-target-min, 44px);
				display: flex;
				align-items: center;
				gap: var(--space-2);
			}

			.page-garage__preset-btn::before {
				content: '';
				display: inline-block;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--color-ink-600, #444);
				flex-shrink: 0;
				transition: background var(--duration-fast) var(--ease-standard);
			}

			.page-garage__preset-btn:hover {
				border-color: var(--color-accent-orange, #f97316);
				color: var(--color-white, #fff);
				background: rgba(249, 115, 22, 0.08);
			}

			.page-garage__preset-btn:hover::before {
				background: var(--color-accent-orange, #f97316);
			}

			.page-garage__preset-btn:focus-visible {
				outline: 2px solid var(--color-accent-orange, #f97316);
				outline-offset: 2px;
			}

			/* ===================================================
			   Bottom action bar
			   =================================================== */

			.page-garage__bottombar {
				grid-area: bottombar;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: var(--space-3);
				padding: var(--space-3) var(--space-6);
				background: rgba(0, 0, 0, 0.7);
				border-top: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
			}

			.page-garage__bottombar .kk-cta-button {
				min-width: 120px;
			}

			/* ===================================================
			   Responsive
			   =================================================== */

			@media (max-width: 1024px) {
				.page-garage__content {
					grid-template-columns: 200px 1fr;
					grid-template-areas:
						"stats hero"
						"presets hero";
					align-items: start;
				}
			}

			@media (max-width: 640px) {
				.page-garage__content {
					grid-template-columns: 1fr;
					grid-template-areas:
						"hero"
						"stats"
						"presets";
				}

				.page-garage__tabs {
					overflow-x: auto;
					justify-content: flex-start;
				}

				.page-garage__tab {
					padding: var(--space-3) var(--space-3);
					font-size: var(--text-xs, 0.75rem);
				}

				.page-garage__bottombar {
					flex-wrap: wrap;
					gap: var(--space-2);
				}
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.setAttribute( 'aria-label', 'Garage — Customization Hub' );

		// --- Top bar ---
		const topbar = document.createElement( 'div' );
		topbar.className = 'page-garage__topbar';

		// Back button
		this._backBtn = document.createElement( 'button' );
		this._backBtn.type = 'button';
		this._backBtn.className = 'page-garage__back-btn';
		this._backBtn.setAttribute( 'data-action', ButtonIds.GLOBAL_BACK );
		this._backBtn.setAttribute( 'aria-label', 'Back to Home' );
		this._backBtn.innerHTML = `
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
			     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			<span>BACK</span>
		`;
		topbar.appendChild( this._backBtn );

		const brand = document.createElement( 'div' );
		brand.className = 'page-garage__brand';

		const wordmark = document.createElement( 'div' );
		wordmark.className = 'page-garage__brand-wordmark';
		wordmark.textContent = 'BEASTSIDE';
		brand.appendChild( wordmark );

		const title = document.createElement( 'h1' );
		title.className = 'page-garage__title';
		title.textContent = 'GARAGE';
		brand.appendChild( title );

		topbar.appendChild( brand );
		root.appendChild( topbar );

		// --- Tab strip ---
		const tabStrip = document.createElement( 'nav' );
		tabStrip.className = 'page-garage__tabs';
		tabStrip.setAttribute( 'role', 'tablist' );
		tabStrip.setAttribute( 'aria-label', 'Garage categories' );

		this._tabBtns = [];

		for ( const tab of TABS ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.role = 'tab';
			btn.className = 'page-garage__tab';
			btn.dataset.action = tab.id;
			btn.textContent = tab.label;
			btn.setAttribute( 'aria-selected', 'false' );
			tabStrip.appendChild( btn );
			this._tabBtns.push( btn );

		}

		root.appendChild( tabStrip );

		// --- Content area ---
		const content = document.createElement( 'div' );
		content.className = 'page-garage__content';

		// Left: KART STATS
		const statsPanel = document.createElement( 'section' );
		statsPanel.className = 'page-garage__stats-panel';
		statsPanel.setAttribute( 'aria-label', 'Kart statistics' );

		const statsLabel = document.createElement( 'div' );
		statsLabel.className = 'page-garage__panel-label';
		statsLabel.textContent = 'KART STATS';
		statsPanel.appendChild( statsLabel );

		for ( const def of STAT_DEFS ) {

			const row = document.createElement( 'div' );
			row.className = 'page-garage__stat-row';

			const name = document.createElement( 'div' );
			name.className = 'page-garage__stat-name';
			name.textContent = def.label;
			row.appendChild( name );

			const bar = new ProgressBar( {
				label:   def.label,
				value:   0,
				min:     0,
				max:     10,
				variant: 'stat',
				animated: true,
				showEndLabel: false,
			} );
			row.appendChild( bar.el );
			this._statBars.set( def.key, bar );

			statsPanel.appendChild( row );

		}

		content.appendChild( statsPanel );

		// Center: hero preview
		const heroWrap = document.createElement( 'div' );
		heroWrap.className = 'page-garage__hero-wrap';

		this._heroPanel = new HeroPreviewPanel( {
			sceneId:     'garage_preview',
			ariaLabel:   'Current character and kart preview on turntable',
			aspectRatio: '4/3',
			loading:     true,
		} );

		const heroInner = document.createElement( 'div' );
		heroInner.className = 'page-garage__hero-panel';
		heroInner.appendChild( this._heroPanel.el );
		heroWrap.appendChild( heroInner );

		const brandPlate = document.createElement( 'div' );
		brandPlate.className = 'page-garage__brand-plate';
		brandPlate.textContent = 'KART KIDS';
		heroWrap.appendChild( brandPlate );

		content.appendChild( heroWrap );
		this._registerSection( 'heroWrap', heroWrap );

		// Right: SAVE PRESET
		const presetsPanel = document.createElement( 'section' );
		presetsPanel.className = 'page-garage__presets-panel';
		presetsPanel.setAttribute( 'aria-label', 'Save preset slots' );

		const presetsLabel = document.createElement( 'div' );
		presetsLabel.className = 'page-garage__panel-label';
		presetsLabel.textContent = 'SAVE PRESET';
		presetsPanel.appendChild( presetsLabel );

		const presetList = document.createElement( 'div' );
		presetList.className = 'page-garage__preset-list';
		presetList.setAttribute( 'role', 'list' );
		presetsPanel.appendChild( presetList );
		this._registerSection( 'presetList', presetList );

		content.appendChild( presetsPanel );
		root.appendChild( content );

		// --- Bottom bar ---
		const bottombar = document.createElement( 'div' );
		bottombar.className = 'page-garage__bottombar';
		bottombar.setAttribute( 'role', 'toolbar' );
		bottombar.setAttribute( 'aria-label', 'Garage actions' );

		this._rotateBtn = new CTAButton( {
			label:       'ROTATE',
			variant:     'secondary',
			actionId:    ButtonIds.GARAGE_VIEW_ROTATE,
			ariaPressed: false,
		} );
		bottombar.appendChild( this._rotateBtn.el );

		this._inspectBtn = new CTAButton( {
			label:    'INSPECT',
			variant:  'secondary',
			actionId: ButtonIds.GARAGE_VIEW_INSPECT,
		} );
		bottombar.appendChild( this._inspectBtn.el );

		this._loadoutBtn = new CTAButton( {
			label:    'LOADOUT',
			variant:  'secondary',
			actionId: ButtonIds.GARAGE_LOADOUT,
		} );
		bottombar.appendChild( this._loadoutBtn.el );

		this._saveBtn = new CTAButton( {
			label:    'SAVE',
			variant:  'primary',
			actionId: ButtonIds.GARAGE_SAVE_PRESET,
		} );
		bottombar.appendChild( this._saveBtn.el );

		root.appendChild( bottombar );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the first tab on mount.
		this._tabBtns[ 0 ]?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API — called by controller
	// ---------------------------------------------------------------------------

	/**
	 * Populate the Kart Stats progress bars.
	 *
	 * @param {{ speed: number, accel: number, handling: number, boost: number }} stats
	 *   Values expected in [0, 10] range.
	 */
	setKartStats( stats ) {

		for ( const [ key, bar ] of this._statBars ) {

			const val = stats[ key ] ?? 0;
			bar.setValue( val, `${val} out of 10` );

		}

	}

	/**
	 * Populate the preset slot list.
	 *
	 * @param {Array<{id:string, label:string}>} presets
	 */
	setPresets( presets ) {

		const list = this.getSection( 'presetList' );
		if ( ! list ) return;

		list.innerHTML = '';
		this._presetBtns = [];

		for ( const preset of presets ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.role = 'listitem';
			btn.className = 'page-garage__preset-btn';
			btn.dataset.presetId = preset.id;
			btn.textContent = preset.label;
			btn.setAttribute( 'aria-label', `Load preset: ${preset.label}` );
			list.appendChild( btn );
			this._presetBtns.push( btn );

		}

	}

	/**
	 * Update the preview panel caption (character / kart names).
	 *
	 * @param {string} text
	 */
	setPreviewCaption( text ) {

		this._heroPanel?.setCaption( text );

	}

	/**
	 * Set the active tab by ButtonId; updates visual state.
	 *
	 * @param {string} tabId
	 */
	setActiveTab( tabId ) {

		for ( const btn of this._tabBtns ) {

			const isActive = btn.dataset.action === tabId;
			btn.classList.toggle( 'page-garage__tab--active', isActive );
			btn.setAttribute( 'aria-selected', String( isActive ) );

		}

	}

	/**
	 * Toggle the rotating state visual on the hero wrap.
	 *
	 * @param {boolean} active
	 */
	setRotating( active ) {

		const wrap = this.getSection( 'heroWrap' );
		if ( wrap ) {

			wrap.classList.toggle( 'page-garage__hero-wrap--rotating', active );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {HTMLButtonElement} */
	get backBtn() { return this._backBtn; }

	/** @returns {HTMLButtonElement[]} */
	get tabBtns() { return this._tabBtns; }

	/** @returns {CTAButton} */
	get rotateBtn() { return this._rotateBtn; }

	/** @returns {CTAButton} */
	get inspectBtn() { return this._inspectBtn; }

	/** @returns {CTAButton} */
	get loadoutBtn() { return this._loadoutBtn; }

	/** @returns {CTAButton} */
	get saveBtn() { return this._saveBtn; }

	/** @returns {HTMLButtonElement[]} */
	get presetBtns() { return this._presetBtns; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._heroPanel?.dispose();
		this._heroPanel = null;

		for ( const bar of this._statBars.values() ) {

			bar.dispose();

		}

		this._statBars.clear();

		this._rotateBtn  = null;
		this._inspectBtn = null;
		this._loadoutBtn = null;
		this._saveBtn    = null;
		this._tabBtns    = [];
		this._presetBtns = [];

		super.dispose();

	}

}

Page09GarageView._cssInjected = false;
