/**
 * Page04PlayModesView — Play Modes.
 *
 * Route: RouteIds.PLAY ("/play")
 *
 * Layout: fixed-height viewport, no scroll (1080p+).
 *
 * Grid rows: TopNav | PageHeader | body (1fr) | ActionBar
 * Body cols: 1fr mode-grid | 200px character-preview
 *
 * Zones:
 *   topNav      — TopNav with brand, nav items
 *   pageHeader  — "PLAY MODES" + back chevron
 *   body        — two-column area
 *     modeGrid  — CardGrid of 9 mode cards (5 cols, two rows)
 *     charCol   — HeroPreviewPanel (non-interactive)
 *   actionBar   — BACK (ghost) + SELECT (primary, initially disabled)
 *
 * Mode card inner structure:
 *   .kk-mode-card
 *     .kk-mode-card__image   — 16/9 placeholder
 *     .kk-mode-card__body
 *       .kk-mode-card__name
 *       .kk-mode-card__desc
 *       .kk-mode-card__meta
 *         .kk-mode-card__players
 *
 * Public API consumed by Page04PlayModesController:
 *   setModes(modes[])
 *   setCharacterPreview(character)
 *   setSelectState({ enabled, label, sublabel })
 *   get actionBar()
 */

import { PageViewBase }     from '../../core/PageViewBase.js';
import { TopNav }           from '../../components/TopNav.js';
import { PageHeader }       from '../../components/PageHeader.js';
import { HeroPreviewPanel } from '../../components/HeroPreviewPanel.js';
import { CardGrid }         from '../../components/CardGrid.js';
import { ActionBar }        from '../../components/ActionBar.js';
import { ButtonIds }        from '../../enums/ButtonIds.js';
import { RouteIds }         from '../../enums/RouteIds.js';

export class Page04PlayModesView extends PageViewBase {

	constructor() {

		super( 'page-play-modes' );

		/** @type {TopNav} */
		this._topNav = null;

		/** @type {PageHeader} */
		this._pageHeader = null;

		/** @type {HeroPreviewPanel} */
		this._hero = null;

		/** @type {CardGrid} */
		this._cardGrid = null;

		/** @type {ActionBar} */
		this._actionBar = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page04PlayModesView._cssInjected ) return;
		Page04PlayModesView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-play-modes {
				display: grid;
				grid-template-rows: var(--topnav-height) auto 1fr auto;
				grid-template-columns: 1fr;
				height: 100vh;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* PageHeader padding                                                  */
			/* ------------------------------------------------------------------ */

			.page-play-modes .kk-page-header {
				padding-left: var(--page-padding-x);
				padding-right: var(--page-padding-x);
			}

			/* ------------------------------------------------------------------ */
			/* Body — two-column                                                   */
			/* ------------------------------------------------------------------ */

			.page-play-modes__body {
				display: grid;
				grid-template-columns: 1fr 200px;
				gap: var(--space-6);
				padding: 0 var(--page-padding-x);
				overflow: hidden;
				align-items: start;
			}

			/* ------------------------------------------------------------------ */
			/* Mode grid column                                                    */
			/* ------------------------------------------------------------------ */

			.page-play-modes__grid-col {
				overflow: auto;
				padding: var(--space-3) 0;
			}

			/* Override CardGrid to 5 columns */
			.page-play-modes__grid-col .kk-card-grid {
				--kk-card-grid-cols: 5;
			}

			/* ------------------------------------------------------------------ */
			/* Character preview column                                            */
			/* ------------------------------------------------------------------ */

			.page-play-modes__char-col {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-3) 0;
			}

			.page-play-modes__char-col .kk-hero-preview-panel {
				width: 100%;
			}

			/* ------------------------------------------------------------------ */
			/* Mode card inner structure                                           */
			/* ------------------------------------------------------------------ */

			.kk-mode-card {
				display: flex;
				flex-direction: column;
				height: 100%;
			}

			.kk-mode-card__image {
				width: 100%;
				aspect-ratio: 16 / 9;
				background: var(--color-ink-800, #1a1a1a);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-2xl);
				color: var(--color-ink-500);
				flex-shrink: 0;
				overflow: hidden;
			}

			.kk-mode-card__body {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				padding: var(--space-2) var(--space-3);
				flex: 1;
			}

			.kk-mode-card__name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				line-height: 1.2;
			}

			.kk-mode-card__desc {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				line-height: 1.3;
			}

			.kk-mode-card__meta {
				display: flex;
				align-items: center;
				gap: var(--space-1);
				margin-top: auto;
				padding-top: var(--space-1);
			}

			.kk-mode-card__players {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-accent-orange);
				font-weight: var(--weight-bold);
			}

			/* Online badge */
			.kk-mode-card__online-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 8px;
				height: 8px;
				background: var(--color-success, #22c55e);
				border-radius: 50%;
				flex-shrink: 0;
			}

			/* ------------------------------------------------------------------ */
			/* Character preview label strip                                       */
			/* ------------------------------------------------------------------ */

			.page-play-modes__char-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				text-align: center;
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
		root.setAttribute( 'aria-label', 'Play Modes selection' );

		// ----- TopNav -----
		this._topNav = new TopNav( {
			items: [
				{ label: 'QUICK PLAY', route: RouteIds.QUICK_PLAY },
				{ label: 'PLAY',       route: RouteIds.PLAY },
				{ label: 'PARTY',      route: RouteIds.PARTY },
				{ label: 'GARAGE',     route: RouteIds.GARAGE },
				{ label: 'CREATE',     route: RouteIds.CREATE },
				{ label: 'PROFILE',    route: RouteIds.PROFILE },
				{ label: 'SHOP',       route: RouteIds.SHOP },
			],
			activeRoute: RouteIds.PLAY,
			showBrand:   true,
			showUtility: false,
		} );
		root.appendChild( this._topNav.el );

		// ----- PageHeader -----
		this._pageHeader = new PageHeader( {
			title:    'PLAY MODES',
			showBack: true,
		} );
		root.appendChild( this._pageHeader.el );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-play-modes__body';
		this._registerSection( 'body', body );

		// Mode grid column
		const gridCol = document.createElement( 'div' );
		gridCol.className = 'page-play-modes__grid-col';

		// CardGrid placeholder — will be rebuilt in setModes()
		this._cardGridContainer = gridCol;
		body.appendChild( gridCol );
		this._registerSection( 'gridCol', gridCol );

		// Character preview column
		const charCol = document.createElement( 'div' );
		charCol.className = 'page-play-modes__char-col';

		this._hero = new HeroPreviewPanel( {
			sceneId:     'play-modes-char',
			ariaLabel:   'Selected character preview',
			caption:     null,
			aspectRatio: '3/4',
			loading:     true,
		} );
		charCol.appendChild( this._hero.el );

		this._charLabelEl = document.createElement( 'span' );
		this._charLabelEl.className = 'page-play-modes__char-label';
		this._charLabelEl.textContent = '—';
		charCol.appendChild( this._charLabelEl );

		body.appendChild( charCol );
		this._registerSection( 'charCol', charCol );

		root.appendChild( body );

		// ----- ActionBar -----
		this._actionBar = new ActionBar( {
			primary: {
				label:    'SELECT',
				variant:  'primary',
				actionId: ButtonIds.PLAY_MODES_GRAND_PRIX, // overridden per selection
				disabled: true,
				sublabel: 'Choose a mode',
			},
			secondary: [
				{
					label:    'BACK',
					variant:  'ghost',
					actionId: ButtonIds.GLOBAL_BACK,
				},
			],
		} );
		root.appendChild( this._actionBar.el );
		this._registerSection( 'actionBar', this._actionBar.el );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the first card in the grid per spec keyboard flow §6 step 3
		const firstCell = this._root.querySelector( '.kk-card-grid__cell' );
		if ( firstCell ) {

			firstCell.focus( { preventScroll: true } );

		}

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {ActionBar} */
	get actionBar() { return this._actionBar; }

	/**
	 * Build and render the CardGrid from modes data.
	 *
	 * @param {Array<{ id:string, name:string, desc:string, icon:string, playerCount:string, online:boolean }>} modes
	 */
	setModes( modes ) {

		// Dispose previous grid if re-called
		if ( this._cardGrid ) {

			if ( this._cardGrid.el.parentNode ) {
				this._cardGrid.el.parentNode.removeChild( this._cardGrid.el );
			}
			this._cardGrid = null;

		}

		this._cardGrid = new CardGrid( {
			items:         modes.map( ( m ) => ( { id: m.id, data: m } ) ),
			columns:       5,
			selectedId:    null,
			selectionMode: 'single',
			ariaLabel:     'Play modes',
			renderCard:    ( item ) => this._buildModeCard( item.data ),
		} );

		this._cardGridContainer.appendChild( this._cardGrid.el );

	}

	/**
	 * Update the character preview column.
	 *
	 * @param {{ name:string } | null} character
	 */
	setCharacterPreview( character ) {

		if ( this._charLabelEl ) {
			this._charLabelEl.textContent = character?.name ?? '—';
		}

		if ( this._hero ) {
			this._hero.setAriaLabel( character ? `${character.name} character preview` : 'Character preview' );
		}

	}

	/**
	 * Update the SELECT button state.
	 *
	 * @param {{ enabled:boolean, label:string, sublabel?:string }} state
	 */
	setSelectState( { enabled, label, sublabel } ) {

		const btn = this._actionBar?.primaryButton;
		if ( ! btn ) return;

		btn.setDisabled( ! enabled );
		btn.setLabel( label );

		// Update sublabel span if present, or inject one
		let subEl = btn.el.querySelector( '.kk-cta-button__sublabel' );

		if ( sublabel ) {

			if ( ! subEl ) {

				subEl = document.createElement( 'span' );
				subEl.className = 'kk-cta-button__sublabel';
				subEl.setAttribute( 'aria-hidden', 'true' );
				// Insert before spinner
				const spinner = btn.el.querySelector( '.kk-cta-button__spinner' );
				if ( spinner ) {
					btn.el.insertBefore( subEl, spinner );
				} else {
					btn.el.appendChild( subEl );
				}

			}

			subEl.textContent = sublabel;

		} else if ( subEl ) {

			subEl.remove();

		}

	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build the inner DOM for a mode card.
	 *
	 * @param {{ id:string, name:string, desc:string, icon:string, playerCount:string, online:boolean }} mode
	 * @returns {HTMLElement}
	 */
	_buildModeCard( mode ) {

		const card = document.createElement( 'div' );
		card.className = 'kk-mode-card';

		const imgEl = document.createElement( 'div' );
		imgEl.className = 'kk-mode-card__image';
		imgEl.setAttribute( 'aria-hidden', 'true' );
		// Icon placeholder — will be replaced by actual artwork in later milestone
		imgEl.textContent = this._iconFor( mode.icon );
		card.appendChild( imgEl );

		const bodyEl = document.createElement( 'div' );
		bodyEl.className = 'kk-mode-card__body';

		const nameEl = document.createElement( 'span' );
		nameEl.className = 'kk-mode-card__name';
		nameEl.textContent = mode.name;
		bodyEl.appendChild( nameEl );

		const descEl = document.createElement( 'span' );
		descEl.className = 'kk-mode-card__desc';
		descEl.textContent = mode.desc;
		bodyEl.appendChild( descEl );

		const metaEl = document.createElement( 'div' );
		metaEl.className = 'kk-mode-card__meta';

		if ( mode.online ) {

			const onlineDot = document.createElement( 'span' );
			onlineDot.className = 'kk-mode-card__online-badge';
			onlineDot.setAttribute( 'aria-label', 'Online mode' );
			metaEl.appendChild( onlineDot );

		}

		const playersEl = document.createElement( 'span' );
		playersEl.className = 'kk-mode-card__players';
		playersEl.textContent = mode.playerCount;
		playersEl.setAttribute( 'aria-label', `${mode.playerCount} players` );
		metaEl.appendChild( playersEl );

		bodyEl.appendChild( metaEl );
		card.appendChild( bodyEl );

		return card;

	}

	/**
	 * Map mode icon ID to a display character.
	 * Will be replaced by actual SVG icons in a later milestone.
	 *
	 * @param {string} iconId
	 * @returns {string}
	 */
	_iconFor( iconId ) {

		const map = {
			trophy: '🏆',
			clock:  '⏱',
			flag:   '🏁',
			swords: '⚔',
			users:  '👥',
			skull:  '💀',
			medal:  '🥇',
			ladder: '📊',
			wrench: '🔧',
		};
		return map[ iconId ] ?? '?';

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._topNav?.dispose();
		this._topNav = null;

		this._pageHeader?.dispose();
		this._pageHeader = null;

		this._hero?.dispose();
		this._hero = null;

		if ( this._cardGrid ) {

			if ( this._cardGrid.el?.parentNode ) {
				this._cardGrid.el.parentNode.removeChild( this._cardGrid.el );
			}
			this._cardGrid = null;

		}

		this._actionBar?.dispose();
		this._actionBar = null;

		this._charLabelEl        = null;
		this._cardGridContainer  = null;

		super.dispose();

	}

}

Page04PlayModesView._cssInjected = false;
