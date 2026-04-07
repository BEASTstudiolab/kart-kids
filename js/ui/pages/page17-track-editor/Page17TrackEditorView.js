/**
 * Page17TrackEditorView — Track Editor.
 *
 * Layout: fixed-height viewport, no scroll.
 *
 * Grid rows:  header | body (1fr) | bottom bar
 * Body cols:  200px left palette | 1fr center viewport | 280px right metadata+validation
 *
 * Zones:
 *   header         — PageHeader ("BEASTSIDE presents TRACK EDITOR") + back to /create
 *   left           — Track Library: category tab bar + piece grid + PROPS section
 *   center         — 3D Viewport placeholder (HeroPreviewPanel-style dark area)
 *                    data-preview-target="editor-viewport" for js/editor/ canvas injection
 *   right          — Track Metadata fields + Validation panel
 *   bottom         — QUICK-EDIT color strip + UNDO/REDO + action buttons
 *
 * Toolbar buttons: SAVE (blue), TEST DRIVE (green), VALIDATE (orange), PUBLISH (red)
 *
 * The PROPS section below the palette grid lists prop category chips:
 * Tires, Barriers, Speed Boosts, City Props, Signage.
 *
 * Deviations from spec:
 *   - PageHeader title is "TRACK EDITOR" (simple). The "BEASTSIDE presents" prefix
 *     is rendered as a separate eyebrow span next to the PageHeader to match
 *     the mockup's header layout without overloading the PageHeader title slot.
 *   - The 3D viewport is a placeholder element — the actual Three.js canvas is
 *     injected by existing js/editor/ code when kk:editor:ready fires.
 *   - Metadata fields use native <input> and <select> elements styled to match
 *     the design system; a future FormComponent can wrap these.
 *   - Validation panel uses setValidation() for live updates driven by editor events.
 */

import { PageViewBase }   from '../../core/PageViewBase.js';
import { PageHeader }     from '../../components/PageHeader.js';
import { Tabs }           from '../../components/Tabs.js';
import { CTAButton }      from '../../components/CTAButton.js';
import { ButtonIds }      from '../../enums/ButtonIds.js';

/** Palette piece categories shown in the left panel. */
const PALETTE_TABS = [
	{ id: ButtonIds.EDITOR_TAB_ROAD_PIECES, label: 'ROAD PIECES' },
	{ id: ButtonIds.EDITOR_TAB_TURNS,       label: 'TURNS' },
	{ id: ButtonIds.EDITOR_TAB_RAMPS,       label: 'RAMPS' },
	{ id: ButtonIds.EDITOR_TAB_BRIDGES,     label: 'BRIDGES' },
	{ id: ButtonIds.EDITOR_TAB_TUNNELS,     label: 'TUNNELS' },
	{ id: ButtonIds.EDITOR_TAB_JUMPS,       label: 'JUMPS' },
];

/** Prop chips shown below the palette grid. */
const PROP_LABELS = [
	'Tires', 'Barriers', 'Speed Boosts', 'City Props', 'Signage',
];

/** Palette piece thumbnails per category (placeholder labels). */
const PALETTE_PIECES = {
	[ ButtonIds.EDITOR_TAB_ROAD_PIECES ]: [ 'Straight', 'Wide', 'Narrow' ],
	[ ButtonIds.EDITOR_TAB_TURNS ]:       [ '90° Turn', 'S-Curve', 'Hairpin' ],
	[ ButtonIds.EDITOR_TAB_RAMPS ]:       [ 'Up Ramp', 'Down Ramp', 'Loop' ],
	[ ButtonIds.EDITOR_TAB_BRIDGES ]:     [ 'Flat', 'Arched', 'Suspended' ],
	[ ButtonIds.EDITOR_TAB_TUNNELS ]:     [ 'Linear', 'Curved', 'Wide' ],
	[ ButtonIds.EDITOR_TAB_JUMPS ]:       [ 'Small', 'Medium', 'Mega Jump' ],
};

/** Quick-edit color swatches shown in the bottom bar. */
const QUICK_EDIT_COLORS = [
	'#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
	'#a855f7', '#06b6d4',
];

export class Page17TrackEditorView extends PageViewBase {

	constructor() {

		super( 'page-track-editor' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {Tabs} */
		this._paletteTabs = null;

		/** @type {HTMLElement} */
		this._viewportEl = null;

		/** @type {HTMLElement} */
		this._metadataPanelEl = null;

		/** @type {HTMLElement} */
		this._validationPanelEl = null;

		/** @type {HTMLElement} */
		this._validationStatusEl = null;

		/** @type {HTMLElement} */
		this._validationCheckpointsEl = null;

		/** @type {HTMLElement} */
		this._palettePiecesEl = null;

		/** @type {CTAButton[]} */
		this._toolbarBtns = [];

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page17TrackEditorView._cssInjected ) return;
		Page17TrackEditorView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root
			================================================================ */

			.page-track-editor {
				display: grid;
				grid-template-rows: auto 1fr auto;
				grid-template-columns: 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-bg-base);
			}

			/* ================================================================
			   Header
			================================================================ */

			.page-track-editor__header {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-2) var(--space-5);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-track-editor__header-eyebrow {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				white-space: nowrap;
				flex-shrink: 0;
			}

			.page-track-editor__header-eyebrow strong {
				color: var(--color-ink-200);
			}

			/* ================================================================
			   Body — 3-column grid
			================================================================ */

			.page-track-editor__body {
				display: grid;
				grid-template-columns: 200px 1fr 280px;
				overflow: hidden;
			}

			/* ================================================================
			   Left — Track Library palette
			================================================================ */

			.page-track-editor__palette {
				display: flex;
				flex-direction: column;
				background: var(--color-panel-base);
				border-right: 1px solid var(--color-panel-border);
				overflow: hidden;
			}

			.page-track-editor__palette-header {
				padding: var(--space-2) var(--space-3);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-track-editor__palette-title {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* Palette category tabs */
			.page-track-editor__palette-tabs .kk-tabs {
				background: transparent;
				border-bottom: 1px solid var(--color-panel-border);
				flex-wrap: wrap;
				gap: 0;
			}

			.page-track-editor__palette-tabs .kk-tabs__tab {
				padding: var(--space-2) var(--space-3);
				min-height: 40px;
				font-size: 10px;
				font-family: var(--font-ui);
				font-weight: var(--weight-bold);
				letter-spacing: var(--tracking-wider);
				border-bottom: 2px solid transparent;
				flex: 1;
				justify-content: center;
				min-width: unset;
			}

			.page-track-editor__palette-tabs .kk-tabs__tab[aria-selected="true"] {
				color: var(--color-accent-orange);
				border-bottom-color: var(--color-accent-orange);
				background: rgba(255, 107, 0, 0.06);
			}

			/* Piece thumbnail grid */
			.page-track-editor__pieces {
				flex: 1;
				overflow-y: auto;
				padding: var(--space-3);
				scrollbar-width: thin;
			}

			.page-track-editor__pieces-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-2);
			}

			.page-track-editor__piece-thumb {
				aspect-ratio: 1;
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: grab;
				transition:
					border-color var(--duration-fast) var(--ease-standard),
					background var(--duration-fast) var(--ease-standard);
				user-select: none;
			}

			.page-track-editor__piece-thumb:hover {
				border-color: var(--color-accent-orange);
				background: rgba(255, 107, 0, 0.06);
			}

			.page-track-editor__piece-thumb:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.page-track-editor__piece-thumb-label {
				font-family: var(--font-ui);
				font-size: 9px;
				font-weight: var(--weight-bold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				text-align: center;
				padding: var(--space-1);
			}

			/* PROPS section */
			.page-track-editor__props {
				border-top: 1px solid var(--color-panel-border);
				padding: var(--space-3);
			}

			.page-track-editor__props-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				margin-bottom: var(--space-2);
				display: block;
			}

			.page-track-editor__props-chips {
				display: flex;
				flex-wrap: wrap;
				gap: var(--space-1);
			}

			.page-track-editor__prop-chip {
				padding: 4px var(--space-2);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				font-family: var(--font-ui);
				font-size: 10px;
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				cursor: pointer;
				transition:
					background var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard),
					color var(--duration-fast) var(--ease-standard);
			}

			.page-track-editor__prop-chip:hover,
			.page-track-editor__prop-chip:focus-visible {
				background: rgba(255, 107, 0, 0.08);
				border-color: var(--color-accent-orange);
				color: var(--color-accent-orange);
				outline: none;
			}

			/* ================================================================
			   Center — 3D viewport
			================================================================ */

			.page-track-editor__viewport-wrap {
				display: flex;
				flex-direction: column;
				overflow: hidden;
				background: #1a1a1e;
				position: relative;
			}

			.page-track-editor__viewport-label {
				position: absolute;
				top: var(--space-3);
				left: var(--space-4);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				z-index: 1;
				pointer-events: none;
			}

			.page-track-editor__viewport {
				flex: 1;
				width: 100%;
				height: 100%;
				position: relative;
				overflow: hidden;
				background: #1a1a1e;
			}

			/* Canvas injected by js/editor/ */
			.page-track-editor__viewport canvas {
				position: absolute;
				inset: 0;
				width: 100% !important;
				height: 100% !important;
			}

			/* Placeholder state — shown until kk:editor:ready fires */
			.page-track-editor__viewport-placeholder {
				position: absolute;
				inset: 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: var(--space-3);
				color: var(--color-ink-600);
				pointer-events: none;
			}

			.page-track-editor__viewport-placeholder-icon {
				font-size: 4rem;
				opacity: 0.2;
			}

			.page-track-editor__viewport-placeholder-text {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-black);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-500);
			}

			/* Ready state — hides placeholder */
			.page-track-editor__viewport--ready .page-track-editor__viewport-placeholder {
				display: none;
			}

			/* ================================================================
			   Right — metadata + validation
			================================================================ */

			.page-track-editor__right {
				display: flex;
				flex-direction: column;
				background: var(--color-panel-base);
				border-left: 1px solid var(--color-panel-border);
				overflow-y: auto;
				scrollbar-width: thin;
			}

			.page-track-editor__right-section {
				padding: var(--space-4);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-track-editor__right-section:last-child {
				border-bottom: none;
			}

			.page-track-editor__right-section-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				margin-bottom: var(--space-3);
				display: block;
			}

			/* Metadata fields */
			.page-track-editor__meta-field {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				margin-bottom: var(--space-3);
			}

			.page-track-editor__meta-field:last-child {
				margin-bottom: 0;
			}

			.page-track-editor__meta-field-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-semibold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-track-editor__meta-input,
			.page-track-editor__meta-select {
				width: 100%;
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				padding: var(--space-2) var(--space-3);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
				outline: none;
				transition:
					border-color var(--duration-fast) var(--ease-standard);
				-webkit-appearance: none;
				appearance: none;
				box-sizing: border-box;
			}

			.page-track-editor__meta-input:hover,
			.page-track-editor__meta-select:hover {
				border-color: var(--color-ink-500);
			}

			.page-track-editor__meta-input:focus,
			.page-track-editor__meta-select:focus {
				border-color: var(--color-accent-orange);
				box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.2);
			}

			.page-track-editor__meta-value {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
				padding: var(--space-1) 0;
			}

			/* Validation panel */
			.page-track-editor__validation-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: var(--space-2);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
			}

			.page-track-editor__validation-row:last-child {
				margin-bottom: 0;
			}

			.page-track-editor__validation-key {
				color: var(--color-ink-400);
				font-weight: var(--weight-semibold);
				text-transform: uppercase;
				font-size: var(--text-xs);
				letter-spacing: var(--tracking-wider);
			}

			.page-track-editor__validation-val {
				color: var(--color-ink-200);
				font-weight: var(--weight-bold);
			}

			.page-track-editor__validation-val--valid {
				color: #22c55e;
			}

			.page-track-editor__validation-val--warning {
				color: var(--color-accent-orange);
			}

			.page-track-editor__validation-val--error {
				color: var(--color-cta-danger);
			}

			/* Action buttons */
			.page-track-editor__action-btns {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				padding: var(--space-4);
			}

			.page-track-editor__action-btns .kk-cta-button {
				width: 100%;
				justify-content: center;
				font-size: var(--text-sm);
				font-weight: var(--weight-black);
				letter-spacing: var(--tracking-wider);
			}

			/* Variant overrides for editor action buttons */
			.page-track-editor__btn-save {
				background: #2563eb !important;
				color: #ffffff !important;
			}
			.page-track-editor__btn-save:hover:not([aria-disabled="true"]) {
				background: #3b82f6 !important;
				box-shadow: 0 2px 14px rgba(37, 99, 235, 0.5) !important;
			}

			.page-track-editor__btn-test-drive {
				background: #16a34a !important;
				color: #ffffff !important;
			}
			.page-track-editor__btn-test-drive:hover:not([aria-disabled="true"]) {
				background: #22c55e !important;
				box-shadow: 0 2px 14px rgba(22, 163, 74, 0.5) !important;
			}

			.page-track-editor__btn-validate {
				background: #d97706 !important;
				color: #ffffff !important;
			}
			.page-track-editor__btn-validate:hover:not([aria-disabled="true"]) {
				background: #f59e0b !important;
				box-shadow: 0 2px 14px rgba(217, 119, 6, 0.5) !important;
			}

			.page-track-editor__btn-publish {
				background: var(--color-cta-danger) !important;
				color: #ffffff !important;
			}
			.page-track-editor__btn-publish:hover:not([aria-disabled="true"]) {
				filter: brightness(1.15);
				box-shadow: 0 2px 14px rgba(220, 38, 38, 0.5) !important;
			}

			/* ================================================================
			   Bottom bar
			================================================================ */

			.page-track-editor__bottom {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--space-2) var(--space-4);
				background: var(--color-panel-base);
				border-top: 1px solid var(--color-panel-border);
				gap: var(--space-4);
			}

			.page-track-editor__bottom-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				flex-shrink: 0;
			}

			/* Quick-edit color swatches */
			.page-track-editor__quick-edit {
				display: flex;
				align-items: center;
				gap: var(--space-1);
				flex: 1;
			}

			.page-track-editor__swatch {
				width: 24px;
				height: 24px;
				border-radius: var(--radius-sm);
				border: 2px solid transparent;
				cursor: pointer;
				transition: border-color var(--duration-fast) var(--ease-standard);
				flex-shrink: 0;
			}

			.page-track-editor__swatch:hover,
			.page-track-editor__swatch:focus-visible {
				border-color: var(--color-white);
				outline: none;
			}

			/* UNDO / REDO pair */
			.page-track-editor__undo-redo {
				display: flex;
				gap: var(--space-2);
				flex-shrink: 0;
			}

			.page-track-editor__undo-redo .kk-cta-button {
				min-height: 36px;
				padding: 0 var(--space-4);
				font-size: var(--text-xs);
				border-radius: var(--radius-sm);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				color: var(--color-ink-200);
			}

			.page-track-editor__undo-redo .kk-cta-button:hover:not([aria-disabled="true"]) {
				background: rgba(255, 255, 255, 0.07);
				border-color: var(--color-ink-400);
				color: var(--color-white);
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

		// ----- Header -----
		root.appendChild( this._buildHeader() );

		// ----- Body -----
		root.appendChild( this._buildBody() );

		// ----- Bottom bar -----
		root.appendChild( this._buildBottomBar() );

	}

	/**
	 * Build the top header row.
	 *
	 * @returns {HTMLElement}
	 */
	_buildHeader() {

		const header = document.createElement( 'div' );
		header.className = 'page-track-editor__header';

		this._header = new PageHeader( {
			title:    'TRACK EDITOR',
			showBack: true,
		} );
		header.appendChild( this._header.el );

		// Eyebrow text "BEASTSIDE presents"
		const eyebrow = document.createElement( 'span' );
		eyebrow.className = 'page-track-editor__header-eyebrow';
		eyebrow.innerHTML = '<strong>BEASTSIDE</strong> presents';
		eyebrow.setAttribute( 'aria-hidden', 'true' );
		// Insert eyebrow before the title by prepending into header
		header.insertBefore( eyebrow, header.firstChild );

		this._registerSection( 'header', header );
		return header;

	}

	/**
	 * Build the 3-column body.
	 *
	 * @returns {HTMLElement}
	 */
	_buildBody() {

		const body = document.createElement( 'div' );
		body.className = 'page-track-editor__body';

		body.appendChild( this._buildPalette() );
		body.appendChild( this._buildViewport() );
		body.appendChild( this._buildRightPanel() );

		this._registerSection( 'body', body );
		return body;

	}

	/**
	 * Build the left palette panel.
	 *
	 * @returns {HTMLElement}
	 */
	_buildPalette() {

		const panel = document.createElement( 'aside' );
		panel.className = 'page-track-editor__palette';
		panel.setAttribute( 'aria-label', 'Track Library' );

		// Header label
		const paletteHeader = document.createElement( 'div' );
		paletteHeader.className = 'page-track-editor__palette-header';
		const paletteTitle = document.createElement( 'span' );
		paletteTitle.className = 'page-track-editor__palette-title';
		paletteTitle.textContent = 'TRACK LIBRARY';
		paletteHeader.appendChild( paletteTitle );
		panel.appendChild( paletteHeader );

		// Category tab bar (2-row grid style)
		const tabsWrapper = document.createElement( 'div' );
		tabsWrapper.className = 'page-track-editor__palette-tabs';

		this._paletteTabs = new Tabs( {
			ariaLabel: 'Track piece categories',
			activeId:  ButtonIds.EDITOR_TAB_ROAD_PIECES,
			tabs:      PALETTE_TABS,
		} );
		tabsWrapper.appendChild( this._paletteTabs.el );
		panel.appendChild( tabsWrapper );

		// Piece thumbnail grid — one panel per tab
		const piecesArea = document.createElement( 'div' );
		piecesArea.className = 'page-track-editor__pieces';
		this._palettePiecesEl = piecesArea;

		// Each tab panel lives inside piecesArea; only active one is visible
		PALETTE_TABS.forEach( ( tabDef ) => {

			const panel_tab = this._paletteTabs.getPanel( tabDef.id );
			panel_tab.style.cssText = 'display:block;';

			const grid = document.createElement( 'div' );
			grid.className = 'page-track-editor__pieces-grid';
			grid.setAttribute( 'role', 'list' );
			grid.setAttribute( 'aria-label', `${tabDef.label} pieces` );

			const pieces = PALETTE_PIECES[ tabDef.id ] ?? [];
			pieces.forEach( ( label ) => {

				const thumb = document.createElement( 'div' );
				thumb.className = 'page-track-editor__piece-thumb';
				thumb.setAttribute( 'role', 'listitem' );
				thumb.setAttribute( 'tabindex', '0' );
				thumb.setAttribute( 'aria-label', label );
				thumb.setAttribute( 'draggable', 'true' );

				const thumbLabel = document.createElement( 'span' );
				thumbLabel.className = 'page-track-editor__piece-thumb-label';
				thumbLabel.textContent = label;
				thumb.appendChild( thumbLabel );
				grid.appendChild( thumb );

			} );

			panel_tab.appendChild( grid );
			piecesArea.appendChild( panel_tab );

		} );

		panel.appendChild( piecesArea );

		// PROPS section
		const propsSection = document.createElement( 'div' );
		propsSection.className = 'page-track-editor__props';

		const propsLabel = document.createElement( 'span' );
		propsLabel.className = 'page-track-editor__props-label';
		propsLabel.textContent = 'PROPS';
		propsSection.appendChild( propsLabel );

		const propsChips = document.createElement( 'div' );
		propsChips.className = 'page-track-editor__props-chips';
		propsChips.setAttribute( 'role', 'list' );

		PROP_LABELS.forEach( ( label ) => {

			const chip = document.createElement( 'button' );
			chip.type = 'button';
			chip.className = 'page-track-editor__prop-chip';
			chip.textContent = label;
			chip.setAttribute( 'role', 'listitem' );
			chip.dataset.prop = label.toLowerCase().replace( /\s+/g, '_' );
			propsChips.appendChild( chip );

		} );

		propsSection.appendChild( propsChips );
		panel.appendChild( propsSection );

		this._registerSection( 'palette', panel );
		return panel;

	}

	/**
	 * Build the center 3D viewport placeholder.
	 *
	 * @returns {HTMLElement}
	 */
	_buildViewport() {

		const wrap = document.createElement( 'div' );
		wrap.className = 'page-track-editor__viewport-wrap';

		// Label overlay
		const label = document.createElement( 'span' );
		label.className = 'page-track-editor__viewport-label';
		label.textContent = '3D VIEWPORT';
		label.setAttribute( 'aria-hidden', 'true' );
		wrap.appendChild( label );

		// The actual injection point for js/editor/ canvas
		const viewport = document.createElement( 'div' );
		viewport.className = 'page-track-editor__viewport';
		viewport.setAttribute( 'role', 'application' );
		viewport.setAttribute( 'aria-label', '3D Track Editor Viewport' );
		viewport.setAttribute( 'data-preview-target', 'editor-viewport' );
		this._viewportEl = viewport;

		// Placeholder shown until editor is ready
		const placeholder = document.createElement( 'div' );
		placeholder.className = 'page-track-editor__viewport-placeholder';
		placeholder.setAttribute( 'aria-hidden', 'true' );

		const placeholderIcon = document.createElement( 'div' );
		placeholderIcon.className = 'page-track-editor__viewport-placeholder-icon';
		placeholderIcon.textContent = '?';
		placeholder.appendChild( placeholderIcon );

		const placeholderText = document.createElement( 'p' );
		placeholderText.className = 'page-track-editor__viewport-placeholder-text';
		placeholderText.textContent = 'LOADING TRACK EDITOR...';
		placeholder.appendChild( placeholderText );

		viewport.appendChild( placeholder );
		wrap.appendChild( viewport );

		this._registerSection( 'viewport', wrap );
		return wrap;

	}

	/**
	 * Build the right metadata + validation panel with action buttons.
	 *
	 * @returns {HTMLElement}
	 */
	_buildRightPanel() {

		const panel = document.createElement( 'aside' );
		panel.className = 'page-track-editor__right';
		panel.setAttribute( 'aria-label', 'Track details and actions' );

		// --- Track Metadata ---
		const metaSection = document.createElement( 'div' );
		metaSection.className = 'page-track-editor__right-section';
		metaSection.setAttribute( 'role', 'form' );
		metaSection.setAttribute( 'aria-label', 'Track Metadata' );
		this._metadataPanelEl = metaSection;

		const metaLabel = document.createElement( 'span' );
		metaLabel.className = 'page-track-editor__right-section-label';
		metaLabel.textContent = 'TRACK METADATA';
		metaSection.appendChild( metaLabel );

		// Name field
		metaSection.appendChild( this._buildMetaField( {
			label:   'Name',
			field:   'name',
			type:    'input',
			placeholder: '[New Track]',
		} ) );

		// Creator (read-only display)
		metaSection.appendChild( this._buildMetaField( {
			label:    'Creator',
			field:    'creator',
			type:     'display',
		} ) );

		// Style select
		metaSection.appendChild( this._buildMetaField( {
			label:   'Style',
			field:   'style',
			type:    'select',
			options: [ 'Standard', 'Sci-Fi Urban', 'Neon City', 'Desert', 'Mountain', 'Forest' ],
		} ) );

		// Difficulty select
		metaSection.appendChild( this._buildMetaField( {
			label:   'Difficulty',
			field:   'difficulty',
			type:    'select',
			options: [ 'Easy', 'Medium', 'Hard', 'Expert' ],
		} ) );

		panel.appendChild( metaSection );

		// --- Validation ---
		const valSection = document.createElement( 'div' );
		valSection.className = 'page-track-editor__right-section';
		valSection.setAttribute( 'role', 'region' );
		valSection.setAttribute( 'aria-label', 'Track Validation' );
		valSection.setAttribute( 'tabindex', '-1' );
		this._validationPanelEl = valSection;

		const valLabel = document.createElement( 'span' );
		valLabel.className = 'page-track-editor__right-section-label';
		valLabel.textContent = 'VALIDATION';
		valSection.appendChild( valLabel );

		const valCheckpointRow = document.createElement( 'div' );
		valCheckpointRow.className = 'page-track-editor__validation-row';

		const valCheckpointKey = document.createElement( 'span' );
		valCheckpointKey.className = 'page-track-editor__validation-key';
		valCheckpointKey.textContent = 'Checkpoint Count';

		this._validationCheckpointsEl = document.createElement( 'span' );
		this._validationCheckpointsEl.className = 'page-track-editor__validation-val';
		this._validationCheckpointsEl.setAttribute( 'aria-live', 'polite' );
		this._validationCheckpointsEl.textContent = '0/4';

		valCheckpointRow.appendChild( valCheckpointKey );
		valCheckpointRow.appendChild( this._validationCheckpointsEl );
		valSection.appendChild( valCheckpointRow );

		const valStatusRow = document.createElement( 'div' );
		valStatusRow.className = 'page-track-editor__validation-row';

		const valStatusKey = document.createElement( 'span' );
		valStatusKey.className = 'page-track-editor__validation-key';
		valStatusKey.textContent = 'Status';

		this._validationStatusEl = document.createElement( 'span' );
		this._validationStatusEl.className = 'page-track-editor__validation-val';
		this._validationStatusEl.setAttribute( 'aria-live', 'polite' );
		this._validationStatusEl.textContent = 'Not validated';

		valStatusRow.appendChild( valStatusKey );
		valStatusRow.appendChild( this._validationStatusEl );
		valSection.appendChild( valStatusRow );

		panel.appendChild( valSection );

		// --- Action buttons ---
		const actionBtns = document.createElement( 'div' );
		actionBtns.className = 'page-track-editor__action-btns';

		const actionDefs = [
			{ label: 'SAVE',       actionId: ButtonIds.EDITOR_SAVE,       extraClass: 'page-track-editor__btn-save' },
			{ label: 'TEST DRIVE', actionId: ButtonIds.EDITOR_TEST_DRIVE, extraClass: 'page-track-editor__btn-test-drive' },
			{ label: 'VALIDATE',   actionId: ButtonIds.EDITOR_VALIDATION, extraClass: 'page-track-editor__btn-validate' },
			{ label: 'PUBLISH',    actionId: ButtonIds.EDITOR_PUBLISH,    extraClass: 'page-track-editor__btn-publish' },
		];

		actionDefs.forEach( ( def ) => {

			const btn = new CTAButton( {
				label:   def.label,
				variant: 'primary',
				actionId: def.actionId,
			} );
			btn.el.classList.add( def.extraClass );
			this._toolbarBtns.push( btn );
			actionBtns.appendChild( btn.el );

		} );

		panel.appendChild( actionBtns );

		this._registerSection( 'rightPanel', panel );
		return panel;

	}

	/**
	 * Build a single metadata field row.
	 *
	 * @param {{ label: string, field: string, type: 'input'|'select'|'display', placeholder?: string, options?: string[] }} config
	 * @returns {HTMLElement}
	 */
	_buildMetaField( { label, field, type, placeholder, options } ) {

		const row = document.createElement( 'div' );
		row.className = 'page-track-editor__meta-field';

		const fieldLabel = document.createElement( 'label' );
		fieldLabel.className = 'page-track-editor__meta-field-label';
		fieldLabel.textContent = label;
		const fieldId = `editor-meta-${field}`;
		if ( type !== 'display' ) fieldLabel.htmlFor = fieldId;
		row.appendChild( fieldLabel );

		if ( type === 'input' ) {

			const input = document.createElement( 'input' );
			input.className = 'page-track-editor__meta-input';
			input.type = 'text';
			input.id = fieldId;
			input.dataset.field = field;
			if ( placeholder ) input.placeholder = placeholder;
			row.appendChild( input );

		} else if ( type === 'select' ) {

			const select = document.createElement( 'select' );
			select.className = 'page-track-editor__meta-select';
			select.id = fieldId;
			select.dataset.field = field;

			( options ?? [] ).forEach( ( opt ) => {

				const option = document.createElement( 'option' );
				option.value = opt;
				option.textContent = opt;
				select.appendChild( option );

			} );

			row.appendChild( select );

		} else if ( type === 'display' ) {

			const val = document.createElement( 'span' );
			val.className = 'page-track-editor__meta-value';
			val.id = fieldId;
			val.dataset.field = field;
			val.setAttribute( 'aria-live', 'polite' );
			row.appendChild( val );

		}

		return row;

	}

	/**
	 * Build the bottom toolbar bar.
	 *
	 * @returns {HTMLElement}
	 */
	_buildBottomBar() {

		const bar = document.createElement( 'div' );
		bar.className = 'page-track-editor__bottom';
		bar.setAttribute( 'role', 'toolbar' );
		bar.setAttribute( 'aria-label', 'Editor quick controls' );

		// Label
		const qeLabel = document.createElement( 'span' );
		qeLabel.className = 'page-track-editor__bottom-label';
		qeLabel.textContent = 'QUICK-EDIT';
		bar.appendChild( qeLabel );

		// Color swatches
		const swatchRow = document.createElement( 'div' );
		swatchRow.className = 'page-track-editor__quick-edit';
		swatchRow.setAttribute( 'aria-label', 'Quick paint colors' );

		QUICK_EDIT_COLORS.forEach( ( color ) => {

			const swatch = document.createElement( 'button' );
			swatch.type = 'button';
			swatch.className = 'page-track-editor__swatch';
			swatch.style.background = color;
			swatch.setAttribute( 'aria-label', `Paint color ${color}` );
			swatch.dataset.color = color;
			swatchRow.appendChild( swatch );

		} );

		bar.appendChild( swatchRow );

		// UNDO / REDO
		const undoRedo = document.createElement( 'div' );
		undoRedo.className = 'page-track-editor__undo-redo';

		const undoBtn = new CTAButton( {
			label:    'UNDO',
			variant:  'ghost',
			actionId: ButtonIds.EDITOR_UNDO,
			ariaLabel: 'Undo last action',
		} );
		undoBtn.el.classList.add( 'page-track-editor__undo-redo' );
		this._toolbarBtns.push( undoBtn );

		const redoBtn = new CTAButton( {
			label:    'REDO',
			variant:  'ghost',
			actionId: ButtonIds.EDITOR_REDO,
			ariaLabel: 'Redo last action',
		} );
		this._toolbarBtns.push( redoBtn );

		undoRedo.appendChild( undoBtn.el );
		undoRedo.appendChild( redoBtn.el );
		bar.appendChild( undoRedo );

		this._registerSection( 'bottomBar', bar );
		return bar;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the viewport region (accessible region for the 3D canvas)
		this._viewportEl?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} Metadata form panel element. */
	get metadataPanelEl() { return this._metadataPanelEl; }

	/** @returns {HTMLElement} Validation panel element. */
	get validationPanelEl() { return this._validationPanelEl; }

	/**
	 * Populate metadata fields with initial values.
	 *
	 * @param {{ name: string, creator: string, style: string, difficulty: string }} data
	 */
	setMetadata( { name, creator, style, difficulty } ) {

		const panel = this._metadataPanelEl;
		if ( ! panel ) return;

		const nameInput = panel.querySelector( '[data-field="name"]' );
		if ( nameInput ) nameInput.value = name;

		const creatorDisplay = panel.querySelector( '[data-field="creator"]' );
		if ( creatorDisplay ) creatorDisplay.textContent = creator;

		const styleSelect = panel.querySelector( '[data-field="style"]' );
		if ( styleSelect ) styleSelect.value = style;

		const diffSelect = panel.querySelector( '[data-field="difficulty"]' );
		if ( diffSelect ) diffSelect.value = difficulty;

	}

	/**
	 * Update the validation panel with live data from the editor.
	 *
	 * @param {{ checkpointCount: string, status: string }} data
	 */
	setValidation( { checkpointCount, status } ) {

		if ( this._validationCheckpointsEl ) {
			this._validationCheckpointsEl.textContent = checkpointCount;
		}

		if ( this._validationStatusEl ) {

			this._validationStatusEl.textContent = status;

			const isValid   = status.toLowerCase().includes( 'valid' );
			const isWarning = status.toLowerCase().includes( 'warn' );
			const isError   = status.toLowerCase().includes( 'error' ) || status.toLowerCase().includes( 'invalid' );

			this._validationStatusEl.classList.toggle( 'page-track-editor__validation-val--valid',   isValid && ! isWarning && ! isError );
			this._validationStatusEl.classList.toggle( 'page-track-editor__validation-val--warning', isWarning );
			this._validationStatusEl.classList.toggle( 'page-track-editor__validation-val--error',   isError );

		}

	}

	/**
	 * Mark the viewport as ready (removes placeholder overlay).
	 *
	 * @param {boolean} ready
	 */
	setViewportReady( ready ) {

		this._viewportEl?.classList.toggle( 'page-track-editor__viewport--ready', ready );

	}

	/**
	 * Update the active palette category and refresh the piece grid.
	 * Called by the controller after kk:tabs:change.
	 *
	 * @param {string} tabId
	 */
	setActivePaletteCategory( tabId ) {

		// Tabs component manages panel visibility; no additional work needed here
		// since each panel is a child of _palettePiecesEl.
		// This hook is available for future piece-fetching or animation.

		void tabId;

	}

	/**
	 * Focus the validation panel (called by VALIDATE toolbar button).
	 */
	focusValidationPanel() {

		this._validationPanelEl?.focus( { preventScroll: false } );

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._header?.dispose();
		this._header = null;

		this._paletteTabs?.dispose();
		this._paletteTabs = null;

		this._toolbarBtns = [];
		this._viewportEl = null;
		this._metadataPanelEl = null;
		this._validationPanelEl = null;
		this._validationStatusEl = null;
		this._validationCheckpointsEl = null;
		this._palettePiecesEl = null;

		super.dispose();

	}

}

Page17TrackEditorView._cssInjected = false;
