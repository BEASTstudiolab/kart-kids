/**
 * Page11KartSelectView — Kart Select.
 *
 * Route: RouteIds.KARTS ("/karts")
 *
 * Layout: 2-column — large hero preview left, stats panel + thumbnail strip right.
 *
 * Regions:
 *   left   — "KART SELECT / SELECTED KART" header + large HeroPreviewPanel
 *   right  — KART STATS panel with 5 stat bars (x/10 format) + small thumbnail strip
 *   bottom — TEST DRIVE (secondary) + SELECT (primary)
 *
 * Thumbnail events:
 *   Thumbnails dispatch a custom 'kk:kart:select' event (bubbles) on click
 *   so the controller can delegate from a single listener on the strip root.
 *
 * Public API consumed by Page11KartSelectController:
 *   setKarts(karts[], equippedId)
 *   setSelectedKart(kart, equippedId)
 *   setThumbSelected(kartId)
 *   get backBtn()
 *   get thumbStrip()
 *   get testDriveBtn()
 *   get selectBtn()
 */

import { PageViewBase }      from '../../core/PageViewBase.js';
import { CTAButton }         from '../../components/CTAButton.js';
import { ProgressBar }       from '../../components/ProgressBar.js';
import { HeroPreviewPanel }  from '../../components/HeroPreviewPanel.js';
import { ButtonIds }         from '../../enums/ButtonIds.js';

/** Kart stat definitions. All values in [0, 10]. */
const STAT_DEFS = [
	{ key: 'speed',    label: 'Speed',        sub: 'MAX SPEED' },
	{ key: 'accel',    label: 'Acceleration', sub: '0-100 KPH' },
	{ key: 'handling', label: 'Handling',     sub: 'CORNERING RADIUS' },
	{ key: 'traction', label: 'Traction',     sub: 'TIRE GRIP' },
	{ key: 'boost',    label: 'Boost',        sub: 'DURATION' },
];

export class Page11KartSelectView extends PageViewBase {

	constructor() {

		super( 'page-kart-select' );

		/** @type {HTMLButtonElement} */
		this._backBtn = null;

		/** @type {HTMLElement} — thumbnail strip, used for event delegation */
		this._thumbStrip = null;

		/** @type {CTAButton} */
		this._testDriveBtn = null;

		/** @type {CTAButton} */
		this._selectBtn = null;

		/** @type {HeroPreviewPanel} */
		this._heroPanel = null;

		/** @type {Map<string, ProgressBar>} */
		this._statBars = new Map();

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page11KartSelectView._cssInjected ) return;
		Page11KartSelectView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* ===================================================
			   Page root
			   =================================================== */

			.page-kart-select {
				display: grid;
				grid-template-rows: auto 1fr auto;
				grid-template-areas:
					"topbar"
					"content"
					"footer";
				min-height: 100vh;
				background: var(--color-bg-base, #0a0a0a);
				box-sizing: border-box;
			}

			/* ===================================================
			   Top bar
			   =================================================== */

			.page-kart-select__topbar {
				grid-area: topbar;
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--space-4) var(--space-6);
				background: rgba(0, 0, 0, 0.5);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
			}

			.page-kart-select__back-btn {
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

			.page-kart-select__back-btn:hover {
				border-color: var(--color-ink-200, #ccc);
				color: var(--color-white, #fff);
			}

			.page-kart-select__back-btn:focus-visible {
				outline: 2px solid var(--color-accent-orange, #f97316);
				outline-offset: 2px;
			}

			.page-kart-select__topbar-titles {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
			}

			.page-kart-select__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-4xl, 2.5rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
				color: var(--color-white, #fff);
				margin: 0;
				line-height: 1;
				background: linear-gradient(180deg, #fff 55%, #aaa 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}

			.page-kart-select__subtitle {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.2em);
				color: var(--color-ink-400, #666);
				line-height: 1;
			}

			.page-kart-select__topbar-brand {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.2em);
				color: var(--color-ink-400, #666);
			}

			/* ===================================================
			   Content — 2-column
			   =================================================== */

			.page-kart-select__content {
				grid-area: content;
				display: grid;
				grid-template-columns: 1fr 340px;
				grid-template-areas: "preview stats";
				gap: var(--space-4);
				padding: var(--space-4) var(--space-6);
				align-items: start;
			}

			/* ===================================================
			   Left — Hero preview
			   =================================================== */

			.page-kart-select__preview-col {
				grid-area: preview;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* ===================================================
			   Right — Stats panel + thumbnails
			   =================================================== */

			.page-kart-select__stats-col {
				grid-area: stats;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-kart-select__stats-panel {
				background: var(--color-panel-bg, rgba(0,0,0,0.65));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.12));
				border-radius: var(--radius-md, 8px);
				padding: var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				backdrop-filter: blur(8px);
			}

			.page-kart-select__panel-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding-bottom: var(--space-2);
				display: flex;
				align-items: center;
				gap: var(--space-2);
			}

			.page-kart-select__panel-label-icon {
				width: 16px;
				height: 16px;
				opacity: 0.6;
				flex-shrink: 0;
			}

			/* Stat row */

			.page-kart-select__stat-row {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-kart-select__stat-header {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: var(--space-2);
			}

			.page-kart-select__stat-name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-200, #ddd);
			}

			.page-kart-select__stat-score {
				font-family: var(--font-mono, monospace);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-accent-orange, #f97316);
				white-space: nowrap;
				flex-shrink: 0;
			}

			.page-kart-select__stat-sub {
				font-family: var(--font-ui, sans-serif);
				font-size: 0.625rem;
				color: var(--color-ink-500, #555);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			/* ===================================================
			   Kart thumbnail strip
			   =================================================== */

			.page-kart-select__thumb-strip-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
			}

			.page-kart-select__thumb-strip {
				display: flex;
				flex-wrap: wrap;
				gap: var(--space-2);
			}

			.page-kart-select__thumb {
				flex: 0 0 auto;
				width: 72px;
				height: 60px;
				background: var(--color-ink-800, #1a1a1a);
				border: 2px solid var(--color-panel-border, rgba(255,255,255,0.1));
				border-radius: var(--radius-sm, 4px);
				cursor: pointer;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 2px;
				padding: var(--space-1);
				transition: border-color var(--duration-fast) var(--ease-standard),
				            transform var(--duration-fast) var(--ease-standard),
				            box-shadow var(--duration-fast) var(--ease-standard);
				position: relative;
				overflow: hidden;
			}

			.page-kart-select__thumb:hover {
				border-color: var(--color-ink-300, #aaa);
				transform: translateY(-2px);
			}

			.page-kart-select__thumb:focus-visible {
				outline: 2px solid var(--color-accent-orange, #f97316);
				outline-offset: 2px;
			}

			.page-kart-select__thumb--selected {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 16px rgba(249, 115, 22, 0.4);
			}

			.page-kart-select__thumb--locked {
				opacity: 0.55;
			}

			.page-kart-select__thumb-icon {
				color: var(--color-ink-500, #555);
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.page-kart-select__thumb-name {
				font-family: var(--font-ui, sans-serif);
				font-size: 0.55rem;
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

			.page-kart-select__thumb-lock {
				position: absolute;
				top: 2px;
				right: 2px;
				color: var(--color-error, #ef4444);
				opacity: 0.8;
			}

			/* ===================================================
			   Footer
			   =================================================== */

			.page-kart-select__footer {
				grid-area: footer;
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: var(--space-3);
				padding: var(--space-4) var(--space-6);
				background: rgba(0, 0, 0, 0.65);
				border-top: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
			}

			.page-kart-select__footer .kk-cta-button {
				min-width: 160px;
			}

			/* ===================================================
			   Responsive
			   =================================================== */

			@media (max-width: 900px) {
				.page-kart-select__content {
					grid-template-columns: 1fr;
					grid-template-areas:
						"preview"
						"stats";
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
		root.setAttribute( 'aria-label', 'Kart Select' );

		// --- Top bar ---
		const topbar = document.createElement( 'div' );
		topbar.className = 'page-kart-select__topbar';

		const titles = document.createElement( 'div' );
		titles.className = 'page-kart-select__topbar-titles';

		const title = document.createElement( 'h1' );
		title.className = 'page-kart-select__title';
		title.textContent = 'KART SELECT';
		titles.appendChild( title );

		const subtitle = document.createElement( 'div' );
		subtitle.className = 'page-kart-select__subtitle';
		subtitle.textContent = 'SELECTED KART';
		titles.appendChild( subtitle );

		topbar.appendChild( titles );

		this._backBtn = document.createElement( 'button' );
		this._backBtn.type = 'button';
		this._backBtn.className = 'page-kart-select__back-btn';
		this._backBtn.setAttribute( 'data-action', ButtonIds.GLOBAL_BACK );
		this._backBtn.setAttribute( 'aria-label', 'Back' );
		this._backBtn.innerHTML = `
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
			     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			<span>BACK</span>
		`;

		const brandTag = document.createElement( 'div' );
		brandTag.className = 'page-kart-select__topbar-brand';
		brandTag.textContent = 'KART KIDS';

		topbar.appendChild( this._backBtn );
		topbar.appendChild( brandTag );

		root.appendChild( topbar );

		// --- Content ---
		const content = document.createElement( 'div' );
		content.className = 'page-kart-select__content';

		// Left: hero preview
		const previewCol = document.createElement( 'div' );
		previewCol.className = 'page-kart-select__preview-col';

		this._heroPanel = new HeroPreviewPanel( {
			sceneId:     'kart_preview',
			ariaLabel:   'Selected kart preview',
			aspectRatio: '4/3',
			loading:     true,
		} );

		previewCol.appendChild( this._heroPanel.el );
		content.appendChild( previewCol );

		// Right: stats + thumbnail strip
		const statsCol = document.createElement( 'div' );
		statsCol.className = 'page-kart-select__stats-col';

		// KART STATS panel
		const statsPanel = document.createElement( 'section' );
		statsPanel.className = 'page-kart-select__stats-panel';
		statsPanel.setAttribute( 'aria-label', 'Kart statistics' );

		const panelLabel = document.createElement( 'div' );
		panelLabel.className = 'page-kart-select__panel-label';
		panelLabel.innerHTML = `
			<svg class="page-kart-select__panel-label-icon" viewBox="0 0 24 24" fill="none"
			     stroke="currentColor" stroke-width="2" aria-hidden="true">
				<circle cx="12" cy="12" r="10"/>
				<polyline points="12 6 12 12 16 14"/>
			</svg>
			KART STATS
		`;
		statsPanel.appendChild( panelLabel );

		for ( const def of STAT_DEFS ) {

			const row = document.createElement( 'div' );
			row.className = 'page-kart-select__stat-row';

			const statHeader = document.createElement( 'div' );
			statHeader.className = 'page-kart-select__stat-header';

			const nameWrap = document.createElement( 'div' );

			const statName = document.createElement( 'div' );
			statName.className = 'page-kart-select__stat-name';
			statName.textContent = def.label.toUpperCase();
			nameWrap.appendChild( statName );

			const statSub = document.createElement( 'div' );
			statSub.className = 'page-kart-select__stat-sub';
			statSub.textContent = def.sub;
			nameWrap.appendChild( statSub );

			statHeader.appendChild( nameWrap );

			const statScore = document.createElement( 'div' );
			statScore.className = 'page-kart-select__stat-score';
			statScore.textContent = '— / 10';
			statScore.dataset.statKey = def.key;
			statHeader.appendChild( statScore );

			row.appendChild( statHeader );

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

		statsCol.appendChild( statsPanel );

		// Thumbnail strip
		const thumbLabel = document.createElement( 'div' );
		thumbLabel.className = 'page-kart-select__thumb-strip-label';
		thumbLabel.textContent = 'ALL KARTS';
		statsCol.appendChild( thumbLabel );

		this._thumbStrip = document.createElement( 'div' );
		this._thumbStrip.className = 'page-kart-select__thumb-strip';
		this._thumbStrip.setAttribute( 'role', 'listbox' );
		this._thumbStrip.setAttribute( 'aria-label', 'Kart selection' );
		this._registerSection( 'thumbStrip', this._thumbStrip );
		statsCol.appendChild( this._thumbStrip );

		content.appendChild( statsCol );
		root.appendChild( content );

		// --- Footer ---
		const footer = document.createElement( 'div' );
		footer.className = 'page-kart-select__footer';

		this._testDriveBtn = new CTAButton( {
			label:    'TEST DRIVE',
			variant:  'secondary',
			actionId: ButtonIds.KART_SELECT_TEST_DRIVE,
		} );
		footer.appendChild( this._testDriveBtn.el );

		this._selectBtn = new CTAButton( {
			label:    'SELECT',
			variant:  'primary',
			actionId: ButtonIds.KART_SELECT_CONFIRM,
			ariaLabel: 'Equip selected kart',
		} );
		footer.appendChild( this._selectBtn.el );

		root.appendChild( footer );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the first thumbnail so keyboard navigation starts there.
		const firstThumb = this._thumbStrip?.querySelector( '.page-kart-select__thumb' );
		firstThumb?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Populate the thumbnail strip.
	 *
	 * @param {Array<{id:string, name:string, owned:boolean}>} karts
	 * @param {string} equippedId
	 */
	setKarts( karts, equippedId ) {

		const strip = this._thumbStrip;
		if ( ! strip ) return;

		strip.innerHTML = '';

		for ( const kart of karts ) {

			const thumb = document.createElement( 'button' );
			thumb.type = 'button';
			thumb.role = 'option';
			thumb.className = 'page-kart-select__thumb';
			if ( ! kart.owned ) thumb.classList.add( 'page-kart-select__thumb--locked' );
			if ( kart.id === equippedId ) thumb.classList.add( 'page-kart-select__thumb--selected' );
			thumb.dataset.kartId = kart.id;
			thumb.setAttribute( 'aria-label', `${kart.name} — ${kart.owned ? 'Owned' : 'Locked'}` );
			thumb.setAttribute( 'aria-selected', String( kart.id === equippedId ) );

			// Kart icon placeholder
			const icon = document.createElement( 'div' );
			icon.className = 'page-kart-select__thumb-icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.innerHTML = `<svg width="32" height="20" viewBox="0 0 48 28" fill="none"
			     stroke="currentColor" stroke-width="2" aria-hidden="true">
				<rect x="6" y="12" width="36" height="10" rx="3"/>
				<ellipse cx="14" cy="24" rx="4" ry="3"/>
				<ellipse cx="34" cy="24" rx="4" ry="3"/>
				<path d="M18 12 L22 4 H30 L34 12"/>
			</svg>`;
			thumb.appendChild( icon );

			const name = document.createElement( 'div' );
			name.className = 'page-kart-select__thumb-name';
			name.textContent = kart.name;
			thumb.appendChild( name );

			if ( ! kart.owned ) {

				const lock = document.createElement( 'div' );
				lock.className = 'page-kart-select__thumb-lock';
				lock.setAttribute( 'aria-hidden', 'true' );
				lock.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none"
				     stroke="currentColor" stroke-width="3" aria-hidden="true">
					<rect x="3" y="11" width="18" height="11" rx="2"/>
					<path d="M7 11V7a5 5 0 0110 0v4" stroke-linecap="round"/>
				</svg>`;
				thumb.appendChild( lock );

			}

			// Click fires delegated custom event
			thumb.addEventListener( 'click', () => {

				strip.dispatchEvent( new CustomEvent( 'kk:kart:select', {
					bubbles:  true,
					composed: true,
					detail:   { kartId: kart.id },
				} ) );

			} );

			strip.appendChild( thumb );

		}

	}

	/**
	 * Update the hero preview, stat bars, and footer buttons
	 * to reflect the newly selected kart.
	 *
	 * @param {{ id:string, name:string, owned:boolean, speed:number, accel:number,
	 *           handling:number, traction:number, boost:number }} kart
	 * @param {string} equippedId
	 */
	setSelectedKart( kart, equippedId ) {

		// Hero caption
		this._heroPanel?.setCaption( kart.name.toUpperCase() );
		this._heroPanel?.setAriaLabel( `${kart.name} kart preview` );

		// Stat bars + score labels
		for ( const [ key, bar ] of this._statBars ) {

			const val = kart[ key ] ?? 0;
			bar.setValue( val, `${val} out of 10` );

			const scoreEl = this._root.querySelector( `[data-stat-key="${key}"]` );
			if ( scoreEl ) scoreEl.textContent = `${val} / 10`;

		}

		// Footer button states
		if ( kart.id === equippedId ) {

			this._selectBtn?.setLabel( 'EQUIPPED' );
			this._selectBtn?.setDisabled( false );

		} else if ( ! kart.owned ) {

			this._selectBtn?.setLabel( 'LOCKED' );
			this._selectBtn?.setDisabled( true );

		} else {

			this._selectBtn?.setLabel( 'SELECT' );
			this._selectBtn?.setDisabled( false );

		}

		this._testDriveBtn?.setDisabled( ! kart.owned );

	}

	/**
	 * Update selected state on thumbnail strip.
	 *
	 * @param {string} kartId
	 */
	setThumbSelected( kartId ) {

		for ( const thumb of this._thumbStrip.querySelectorAll( '.page-kart-select__thumb' ) ) {

			const isSelected = thumb.dataset.kartId === kartId;
			thumb.classList.toggle( 'page-kart-select__thumb--selected', isSelected );
			thumb.setAttribute( 'aria-selected', String( isSelected ) );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {HTMLButtonElement} */
	get backBtn() { return this._backBtn; }

	/** @returns {HTMLElement} */
	get thumbStrip() { return this._thumbStrip; }

	/** @returns {CTAButton} */
	get testDriveBtn() { return this._testDriveBtn; }

	/** @returns {CTAButton} */
	get selectBtn() { return this._selectBtn; }

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

		this._testDriveBtn = null;
		this._selectBtn    = null;
		this._backBtn      = null;
		this._thumbStrip   = null;

		super.dispose();

	}

}

Page11KartSelectView._cssInjected = false;
