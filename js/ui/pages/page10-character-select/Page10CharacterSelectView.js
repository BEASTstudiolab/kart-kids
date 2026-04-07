/**
 * Page10CharacterSelectView — Character Select.
 *
 * Route: RouteIds.CHARACTERS ("/characters")
 *
 * Layout: 3-column — card grid left, large preview center, stats/ability right.
 *
 * Columns:
 *   col-1 (left)   — "CHARACTER SKINS" label + 2-column CardGrid (6 characters)
 *   col-2 (center) — Large HeroPreviewPanel + STATUS badge
 *   col-3 (right)  — CHARACTER STATS ProgressBars + SPECIAL ABILITY panel
 *   bottom          — SELECT CTA
 *
 * Card events:
 *   Cards dispatch a custom 'kk:character:select' event (bubbles) on click
 *   so the controller can delegate from a single listener on the grid root.
 *
 * Public API consumed by Page10CharacterSelectController:
 *   setCharacters(characters[], equippedId)
 *   setSelectedCharacter(character, equippedId)
 *   setCardSelected(characterId)
 *   get backBtn()
 *   get cardGrid()
 *   get selectBtn()
 */

import { PageViewBase }      from '../../core/PageViewBase.js';
import { CTAButton }         from '../../components/CTAButton.js';
import { ProgressBar }       from '../../components/ProgressBar.js';
import { HeroPreviewPanel }  from '../../components/HeroPreviewPanel.js';
import { ButtonIds }         from '../../enums/ButtonIds.js';

/** Stat definitions shown in the right panel. */
const STAT_DEFS = [
	{ key: 'speed',    label: 'Speed' },
	{ key: 'drift',    label: 'Drift' },
	{ key: 'handling', label: 'Handling' },
	{ key: 'accel',    label: 'Accel' },
];

export class Page10CharacterSelectView extends PageViewBase {

	constructor() {

		super( 'page-character-select' );

		/** @type {HTMLButtonElement} */
		this._backBtn = null;

		/** @type {HTMLElement} — the card grid container, used for event delegation */
		this._cardGrid = null;

		/** @type {CTAButton} */
		this._selectBtn = null;

		/** @type {HeroPreviewPanel} */
		this._heroPanel = null;

		/** @type {Map<string, ProgressBar>} */
		this._statBars = new Map();

		/** @type {string | null} Currently selected card id */
		this._selectedCardId = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page10CharacterSelectView._cssInjected ) return;
		Page10CharacterSelectView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* ===================================================
			   Page root
			   =================================================== */

			.page-character-select {
				display: grid;
				grid-template-rows: auto 1fr auto;
				grid-template-areas:
					"header"
					"content"
					"footer";
				min-height: 100vh;
				background: var(--color-bg-base, #0a0a0a);
				box-sizing: border-box;
			}

			/* ===================================================
			   Header
			   =================================================== */

			.page-character-select__header {
				grid-area: header;
				display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				padding: var(--space-4) var(--space-6);
				background: rgba(0, 0, 0, 0.5);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
			}

			.page-character-select__back-btn {
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

			.page-character-select__back-btn:hover {
				border-color: var(--color-ink-200, #ccc);
				color: var(--color-white, #fff);
			}

			.page-character-select__back-btn:focus-visible {
				outline: 2px solid var(--color-accent-cyan, #22d3ee);
				outline-offset: 2px;
			}

			.page-character-select__brand {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0;
				text-align: center;
			}

			.page-character-select__brand-sub {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.2em);
				color: var(--color-ink-300, #aaa);
				line-height: 1;
			}

			.page-character-select__title {
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

			/* ===================================================
			   Content — 3-column
			   =================================================== */

			.page-character-select__content {
				grid-area: content;
				display: grid;
				grid-template-columns: 260px 1fr 280px;
				grid-template-areas: "grid preview stats";
				gap: var(--space-4);
				padding: var(--space-4) var(--space-6);
				align-items: start;
			}

			/* ===================================================
			   Left — Character grid
			   =================================================== */

			.page-character-select__grid-col {
				grid-area: grid;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-character-select__col-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding-bottom: var(--space-2);
			}

			.page-character-select__card-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-2);
			}

			/* Character card */

			.page-character-select__card {
				position: relative;
				aspect-ratio: 3/4;
				background: var(--color-ink-800, #1a1a1a);
				border: 2px solid var(--color-panel-border, rgba(255,255,255,0.1));
				border-radius: var(--radius-md, 8px);
				cursor: pointer;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: flex-end;
				padding: var(--space-2);
				transition: border-color var(--duration-fast) var(--ease-standard),
				            transform var(--duration-fast) var(--ease-standard),
				            box-shadow var(--duration-fast) var(--ease-standard);
			}

			.page-character-select__card:hover {
				border-color: var(--color-ink-300, #aaa);
				transform: translateY(-2px);
			}

			.page-character-select__card:focus-visible {
				outline: 2px solid var(--color-accent-cyan, #22d3ee);
				outline-offset: 2px;
			}

			.page-character-select__card--selected {
				border-color: var(--color-accent-cyan, #22d3ee);
				box-shadow: 0 0 18px rgba(34, 211, 238, 0.35);
			}

			.page-character-select__card--locked {
				opacity: 0.65;
			}

			.page-character-select__card-avatar {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 3rem;
				color: var(--color-ink-600, #444);
				user-select: none;
			}

			.page-character-select__card-name {
				position: relative;
				z-index: 1;
				font-family: var(--font-ui, sans-serif);
				font-size: 0.65rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.08em);
				color: var(--color-ink-200, #ddd);
				text-align: center;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				width: 100%;
			}

			.page-character-select__card-badge {
				position: absolute;
				top: var(--space-1);
				right: var(--space-1);
				z-index: 2;
				padding: 2px 6px;
				border-radius: var(--radius-sm, 4px);
				font-family: var(--font-ui, sans-serif);
				font-size: 0.625rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				line-height: 1.4;
			}

			.page-character-select__card-badge--owned {
				background: rgba(34, 197, 94, 0.2);
				color: var(--color-success, #22c55e);
				border: 1px solid rgba(34, 197, 94, 0.4);
			}

			.page-character-select__card-badge--locked {
				background: rgba(239, 68, 68, 0.15);
				color: var(--color-error, #ef4444);
				border: 1px solid rgba(239, 68, 68, 0.35);
				display: flex;
				align-items: center;
				gap: 3px;
			}

			/* ===================================================
			   Center — Preview + status
			   =================================================== */

			.page-character-select__preview-col {
				grid-area: preview;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
			}

			.page-character-select__preview-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				align-self: flex-start;
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding-bottom: var(--space-2);
				width: 100%;
			}

			.page-character-select__preview-wrap {
				width: 100%;
				max-width: 380px;
			}

			.page-character-select__status-bar {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				width: 100%;
				max-width: 380px;
			}

			.page-character-select__status-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				flex-shrink: 0;
			}

			.page-character-select__status-badge {
				padding: var(--space-1) var(--space-3);
				border-radius: var(--radius-sm, 4px);
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
			}

			.page-character-select__status-badge--owned {
				background: rgba(34, 197, 94, 0.2);
				color: var(--color-success, #22c55e);
				border: 1px solid rgba(34, 197, 94, 0.4);
			}

			.page-character-select__status-badge--locked {
				background: rgba(239, 68, 68, 0.15);
				color: var(--color-error, #ef4444);
				border: 1px solid rgba(239, 68, 68, 0.35);
			}

			/* ===================================================
			   Right — Stats + Special Ability
			   =================================================== */

			.page-character-select__stats-col {
				grid-area: stats;
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
			}

			.page-character-select__stats-panel {
				background: var(--color-panel-bg, rgba(0,0,0,0.55));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.12));
				border-radius: var(--radius-md, 8px);
				padding: var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				backdrop-filter: blur(8px);
			}

			.page-character-select__panel-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-400, #666);
				border-bottom: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				padding-bottom: var(--space-2);
			}

			.page-character-select__stat-row {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-character-select__stat-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			.page-character-select__stat-name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-200, #ddd);
			}

			.page-character-select__stat-value {
				font-family: var(--font-mono, monospace);
				font-size: var(--text-xs, 0.75rem);
				color: var(--color-accent-orange, #f97316);
				font-weight: var(--weight-bold, 700);
			}

			/* Special ability panel */

			.page-character-select__ability-panel {
				background: var(--color-panel-bg, rgba(0,0,0,0.55));
				border: var(--border-base, 1px) solid var(--color-panel-border, rgba(255,255,255,0.12));
				border-radius: var(--radius-md, 8px);
				padding: var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				backdrop-filter: blur(8px);
			}

			.page-character-select__ability-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-md, 1rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-accent-orange, #f97316);
				line-height: 1.2;
			}

			.page-character-select__ability-desc {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-200, #ddd);
				line-height: 1.5;
			}

			/* ===================================================
			   Footer — SELECT button
			   =================================================== */

			.page-character-select__footer {
				grid-area: footer;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--space-4) var(--space-6);
				background: rgba(0, 0, 0, 0.6);
				border-top: var(--border-thin, 1px) solid var(--color-panel-border, rgba(255,255,255,0.1));
				gap: var(--space-4);
			}

			.page-character-select__footer .kk-cta-button {
				min-width: 240px;
				font-size: var(--text-lg, 1.125rem);
				letter-spacing: var(--tracking-widest, 0.2em);
			}

			/* ===================================================
			   Responsive
			   =================================================== */

			@media (max-width: 1024px) {
				.page-character-select__content {
					grid-template-columns: 220px 1fr;
					grid-template-areas:
						"grid preview"
						"grid stats";
				}
			}

			@media (max-width: 640px) {
				.page-character-select__content {
					grid-template-columns: 1fr;
					grid-template-areas:
						"preview"
						"grid"
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
		root.setAttribute( 'aria-label', 'Character Select' );

		// --- Header ---
		const header = document.createElement( 'div' );
		header.className = 'page-character-select__header';

		this._backBtn = document.createElement( 'button' );
		this._backBtn.type = 'button';
		this._backBtn.className = 'page-character-select__back-btn';
		this._backBtn.setAttribute( 'data-action', ButtonIds.GLOBAL_BACK );
		this._backBtn.setAttribute( 'aria-label', 'Back' );
		this._backBtn.innerHTML = `
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
			     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			<span>BACK</span>
		`;
		header.appendChild( this._backBtn );

		const brand = document.createElement( 'div' );
		brand.className = 'page-character-select__brand';

		const brandSub = document.createElement( 'div' );
		brandSub.className = 'page-character-select__brand-sub';
		brandSub.textContent = 'KART KIDS';
		brand.appendChild( brandSub );

		const title = document.createElement( 'h1' );
		title.className = 'page-character-select__title';
		title.textContent = 'CHARACTER SELECT';
		brand.appendChild( title );

		header.appendChild( brand );
		root.appendChild( header );

		// --- Content ---
		const content = document.createElement( 'div' );
		content.className = 'page-character-select__content';

		// Left: card grid
		const gridCol = document.createElement( 'div' );
		gridCol.className = 'page-character-select__grid-col';

		const gridLabel = document.createElement( 'div' );
		gridLabel.className = 'page-character-select__col-label';
		gridLabel.textContent = 'CHARACTER SKINS';
		gridCol.appendChild( gridLabel );

		this._cardGrid = document.createElement( 'div' );
		this._cardGrid.className = 'page-character-select__card-grid';
		this._cardGrid.setAttribute( 'role', 'grid' );
		this._cardGrid.setAttribute( 'aria-label', 'Character selection' );
		gridCol.appendChild( this._cardGrid );
		this._registerSection( 'cardGrid', this._cardGrid );

		content.appendChild( gridCol );

		// Center: preview
		const previewCol = document.createElement( 'div' );
		previewCol.className = 'page-character-select__preview-col';

		const previewLabel = document.createElement( 'div' );
		previewLabel.className = 'page-character-select__preview-label';
		previewLabel.textContent = 'SELECTED CHARACTER';
		previewCol.appendChild( previewLabel );

		this._heroPanel = new HeroPreviewPanel( {
			sceneId:     'character_preview',
			ariaLabel:   'Selected character preview',
			aspectRatio: '3/4',
			loading:     true,
		} );

		const previewWrap = document.createElement( 'div' );
		previewWrap.className = 'page-character-select__preview-wrap';
		previewWrap.appendChild( this._heroPanel.el );
		previewCol.appendChild( previewWrap );

		// Status bar
		const statusBar = document.createElement( 'div' );
		statusBar.className = 'page-character-select__status-bar';
		statusBar.setAttribute( 'aria-live', 'polite' );
		statusBar.setAttribute( 'aria-atomic', 'true' );

		const statusLabel = document.createElement( 'div' );
		statusLabel.className = 'page-character-select__status-label';
		statusLabel.textContent = 'STATUS';
		statusBar.appendChild( statusLabel );

		const statusBadge = document.createElement( 'div' );
		statusBadge.className = 'page-character-select__status-badge page-character-select__status-badge--owned';
		statusBadge.textContent = 'OWNED';
		statusBar.appendChild( statusBadge );
		this._registerSection( 'statusBadge', statusBadge );

		previewCol.appendChild( statusBar );
		content.appendChild( previewCol );

		// Right: stats + ability
		const statsCol = document.createElement( 'div' );
		statsCol.className = 'page-character-select__stats-col';

		// CHARACTER STATS panel
		const statsPanel = document.createElement( 'section' );
		statsPanel.className = 'page-character-select__stats-panel';
		statsPanel.setAttribute( 'aria-label', 'Character statistics' );

		const statsLabel = document.createElement( 'div' );
		statsLabel.className = 'page-character-select__panel-label';
		statsLabel.textContent = 'CHARACTER STATS';
		statsPanel.appendChild( statsLabel );

		for ( const def of STAT_DEFS ) {

			const row = document.createElement( 'div' );
			row.className = 'page-character-select__stat-row';

			const statHeader = document.createElement( 'div' );
			statHeader.className = 'page-character-select__stat-header';

			const statName = document.createElement( 'div' );
			statName.className = 'page-character-select__stat-name';
			statName.textContent = def.label.toUpperCase();
			statHeader.appendChild( statName );

			const statVal = document.createElement( 'div' );
			statVal.className = 'page-character-select__stat-value';
			statVal.textContent = '—';
			statVal.dataset.statKey = def.key;
			statHeader.appendChild( statVal );

			row.appendChild( statHeader );

			const bar = new ProgressBar( {
				label:   def.label,
				value:   0,
				min:     0,
				max:     100,
				variant: 'stat',
				animated: true,
				showEndLabel: false,
			} );
			row.appendChild( bar.el );
			this._statBars.set( def.key, bar );

			statsPanel.appendChild( row );

		}

		statsCol.appendChild( statsPanel );

		// SPECIAL ABILITY panel
		const abilityPanel = document.createElement( 'section' );
		abilityPanel.className = 'page-character-select__ability-panel';
		abilityPanel.setAttribute( 'aria-label', 'Special ability' );

		const abilityPanelLabel = document.createElement( 'div' );
		abilityPanelLabel.className = 'page-character-select__panel-label';
		abilityPanelLabel.textContent = 'SPECIAL ABILITY';
		abilityPanel.appendChild( abilityPanelLabel );

		const abilityName = document.createElement( 'div' );
		abilityName.className = 'page-character-select__ability-name';
		abilityName.textContent = '—';
		abilityPanel.appendChild( abilityName );
		this._registerSection( 'abilityName', abilityName );

		const abilityDesc = document.createElement( 'div' );
		abilityDesc.className = 'page-character-select__ability-desc';
		abilityDesc.textContent = '—';
		abilityPanel.appendChild( abilityDesc );
		this._registerSection( 'abilityDesc', abilityDesc );

		statsCol.appendChild( abilityPanel );
		content.appendChild( statsCol );
		root.appendChild( content );

		// --- Footer ---
		const footer = document.createElement( 'div' );
		footer.className = 'page-character-select__footer';

		this._selectBtn = new CTAButton( {
			label:    'SELECT',
			variant:  'primary',
			actionId: ButtonIds.CHARACTER_SELECT_CONFIRM,
			ariaLabel: 'Equip selected character',
		} );
		footer.appendChild( this._selectBtn.el );

		root.appendChild( footer );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the first card so keyboard navigation starts there.
		const firstCard = this._cardGrid?.querySelector( '.page-character-select__card' );
		firstCard?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Render the full character card grid.
	 *
	 * @param {Array<{id:string, name:string, owned:boolean}>} characters
	 * @param {string} equippedId  Currently equipped character id.
	 */
	setCharacters( characters, equippedId ) {

		const grid = this._cardGrid;
		if ( ! grid ) return;

		grid.innerHTML = '';

		for ( const char of characters ) {

			const card = document.createElement( 'button' );
			card.type = 'button';
			card.role = 'gridcell';
			card.className = 'page-character-select__card';
			if ( ! char.owned ) card.classList.add( 'page-character-select__card--locked' );
			card.dataset.characterId = char.id;
			card.setAttribute( 'aria-label', `${char.name} — ${char.owned ? 'Owned' : 'Locked'}` );
			card.setAttribute( 'aria-pressed', String( char.id === equippedId ) );

			// Placeholder avatar
			const avatar = document.createElement( 'div' );
			avatar.className = 'page-character-select__card-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			avatar.innerHTML = `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true">
				<circle cx="12" cy="8" r="4"/>
				<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
			</svg>`;
			card.appendChild( avatar );

			// Name
			const name = document.createElement( 'div' );
			name.className = 'page-character-select__card-name';
			name.textContent = char.name;
			card.appendChild( name );

			// Owned / locked badge
			const badge = document.createElement( 'div' );
			if ( char.owned ) {

				badge.className = 'page-character-select__card-badge page-character-select__card-badge--owned';
				badge.textContent = 'OWNED';

			} else {

				badge.className = 'page-character-select__card-badge page-character-select__card-badge--locked';
				badge.setAttribute( 'data-action', ButtonIds.CHARACTER_SELECT_LOCKED );
				badge.innerHTML = `
					<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
					     aria-hidden="true">
						<rect x="3" y="11" width="18" height="11" rx="2"/>
						<path d="M7 11V7a5 5 0 0110 0v4" stroke-linecap="round"/>
					</svg>
					LOCKED
				`;

			}

			card.appendChild( badge );

			// Click fires a delegated custom event
			card.addEventListener( 'click', () => {

				grid.dispatchEvent( new CustomEvent( 'kk:character:select', {
					bubbles:  true,
					composed: true,
					detail:   { characterId: char.id },
				} ) );

			} );

			grid.appendChild( card );

		}

	}

	/**
	 * Update the hero preview, stats bars, ability panel, and status badge
	 * to reflect the newly selected character.
	 *
	 * @param {{ id:string, name:string, owned:boolean, speed:number, drift:number,
	 *           handling:number, accel:number, ability:string, abilityDesc:string }} character
	 * @param {string} equippedId  The currently equipped character id.
	 */
	setSelectedCharacter( character, equippedId ) {

		// Hero caption
		this._heroPanel?.setCaption( character.name.toUpperCase() );
		this._heroPanel?.setAriaLabel( `${character.name} character preview` );

		// Status badge
		const badge = this.getSection( 'statusBadge' );
		if ( badge ) {

			const isOwned = character.owned;
			badge.textContent = isOwned ? 'OWNED' : 'LOCKED';
			badge.className = `page-character-select__status-badge page-character-select__status-badge--${isOwned ? 'owned' : 'locked'}`;

		}

		// Stat bars
		const statKeys = [ 'speed', 'drift', 'handling', 'accel' ];
		for ( const key of statKeys ) {

			const bar = this._statBars.get( key );
			const val = character[ key ] ?? 0;
			bar?.setValue( val, `${val}%` );

			// Also update the numeric label
			const valEl = this._root.querySelector( `[data-stat-key="${key}"]` );
			if ( valEl ) valEl.textContent = `${val}%`;

		}

		// Ability panel
		const abilityName = this.getSection( 'abilityName' );
		if ( abilityName ) abilityName.textContent = character.ability ?? '—';

		const abilityDesc = this.getSection( 'abilityDesc' );
		if ( abilityDesc ) abilityDesc.textContent = character.abilityDesc ?? '—';

		// Update select button label
		if ( character.id === equippedId ) {

			this._selectBtn?.setLabel( 'EQUIPPED' );
			this._selectBtn?.setDisabled( false );

		} else if ( ! character.owned ) {

			this._selectBtn?.setLabel( 'LOCKED' );
			this._selectBtn?.setDisabled( true );

		} else {

			this._selectBtn?.setLabel( 'SELECT' );
			this._selectBtn?.setDisabled( false );

		}

	}

	/**
	 * Update visual selected state on the card grid.
	 *
	 * @param {string} characterId
	 */
	setCardSelected( characterId ) {

		this._selectedCardId = characterId;

		for ( const card of this._cardGrid.querySelectorAll( '.page-character-select__card' ) ) {

			const isSelected = card.dataset.characterId === characterId;
			card.classList.toggle( 'page-character-select__card--selected', isSelected );
			card.setAttribute( 'aria-pressed', String( isSelected ) );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {HTMLButtonElement} */
	get backBtn() { return this._backBtn; }

	/** @returns {HTMLElement} */
	get cardGrid() { return this._cardGrid; }

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

		this._selectBtn = null;
		this._backBtn   = null;
		this._cardGrid  = null;

		super.dispose();

	}

}

Page10CharacterSelectView._cssInjected = false;
