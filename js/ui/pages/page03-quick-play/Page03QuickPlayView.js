/**
 * Page03QuickPlayView — Quick Play.
 *
 * Route: RouteIds.QUICK_PLAY ("/quick-play")
 *
 * Layout: fixed-height viewport, no scroll.
 *
 * Grid rows: TopNav | PageHeader | body (1fr) | options | ActionBar
 * Body cols: 220px char-card | 1fr hero | 220px kart-card
 * Options cols: 2fr track-select | 1fr match-type | 1fr race-rules | 1fr bot-fill
 *
 * Zones:
 *   topNav        — TopNav with brand, nav items
 *   pageHeader    — "QUICK PLAY" + back chevron
 *   body          — three-column panel area
 *     charCard    — clickable SectionPanel: selected character stats
 *     hero        — HeroPreviewPanel (center)
 *     kartCard    — clickable SectionPanel: selected kart stats
 *   options       — four-column strip
 *     trackSelect — SectionPanel with 2 track thumbnail buttons
 *     matchType   — SectionPanel with Tabs (Race / Time Trial / Battle)
 *     raceRules   — clickable SectionPanel with icon-badge row
 *     botFill     — SectionPanel with range slider
 *   actionBar     — BACK (ghost) + START RACE (primary)
 *
 * Public API consumed by Page03QuickPlayController:
 *   setCharacter(character)
 *   setKart(kart)
 *   setTracks(tracks[])
 *   setHeroAriaLabel(label)
 *   setBotFillLabel(count)
 *   get characterCardEl()
 *   get kartCardEl()
 *   get raceRulesPanelEl()
 *   get botFillSliderEl()
 *   get actionBar()
 */

import { PageViewBase }     from '../../core/PageViewBase.js';
import { TopNav }           from '../../components/TopNav.js';
import { PageHeader }       from '../../components/PageHeader.js';
import { HeroPreviewPanel } from '../../components/HeroPreviewPanel.js';
import { SectionPanel }     from '../../components/SectionPanel.js';
import { Tabs }             from '../../components/Tabs.js';
import { ActionBar }        from '../../components/ActionBar.js';
import { ButtonIds }        from '../../enums/ButtonIds.js';
import { RouteIds }         from '../../enums/RouteIds.js';

export class Page03QuickPlayView extends PageViewBase {

	constructor() {

		super( 'page-quick-play' );

		/** @type {TopNav} */
		this._topNav = null;

		/** @type {PageHeader} */
		this._pageHeader = null;

		/** @type {HeroPreviewPanel} */
		this._hero = null;

		/** @type {ActionBar} */
		this._actionBar = null;

		/** @type {HTMLElement} The character card section element (clickable). */
		this._characterCardEl = null;

		/** @type {HTMLElement} The kart card section element (clickable). */
		this._kartCardEl = null;

		/** @type {HTMLElement} The race rules section element (clickable). */
		this._raceRulesPanelEl = null;

		/** @type {HTMLInputElement} The bot fill range slider. */
		this._botFillSliderEl = null;

		/** @type {HTMLElement} The bot fill numeric label beside the slider. */
		this._botFillLabelEl = null;

		// Character stat elements (populated in setCharacter)
		this._charNameEl  = null;
		this._charTagEl   = null;
		this._charBarsEl  = null;

		// Kart stat elements (populated in setKart)
		this._kartNameEl  = null;
		this._kartTagEl   = null;
		this._kartBarsEl  = null;

		// Track thumbnails container
		this._trackGridEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page03QuickPlayView._cssInjected ) return;
		Page03QuickPlayView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-quick-play {
				display: grid;
				grid-template-rows: var(--topnav-height) auto 1fr auto auto;
				grid-template-columns: 1fr;
				height: 100vh;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* PageHeader padding                                                  */
			/* ------------------------------------------------------------------ */

			.page-quick-play .kk-page-header {
				padding-left: var(--page-padding-x);
				padding-right: var(--page-padding-x);
			}

			/* ------------------------------------------------------------------ */
			/* Body — three-column                                                 */
			/* ------------------------------------------------------------------ */

			.page-quick-play__body {
				display: grid;
				grid-template-columns: 220px 1fr 220px;
				gap: var(--space-4);
				padding: 0 var(--page-padding-x);
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Character / Kart cards                                              */
			/* ------------------------------------------------------------------ */

			.page-quick-play__card {
				cursor: pointer;
				border-radius: var(--radius-md);
				transition:
					border-color var(--duration-fast) var(--ease-standard),
					background   var(--duration-fast) var(--ease-standard);
				height: 100%;
			}

			.page-quick-play__card:hover,
			.page-quick-play__card:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.page-quick-play__card .kk-section-panel {
				height: 100%;
			}

			.page-quick-play__card .kk-section-panel__body {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				padding: var(--space-3);
			}

			/* Character / kart name inside card */
			.page-quick-play__card-name {
				font-family: var(--font-display);
				font-size: var(--text-base);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-quick-play__card-tag {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* Stat bars */
			.page-quick-play__stat-bars {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				margin-top: var(--space-1);
			}

			.page-quick-play__stat-row {
				display: grid;
				grid-template-columns: 6ch 1fr;
				align-items: center;
				gap: var(--space-2);
			}

			.page-quick-play__stat-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-quick-play__stat-bar-track {
				height: 4px;
				background: var(--color-panel-border);
				border-radius: var(--radius-pill);
				overflow: hidden;
			}

			.page-quick-play__stat-bar-fill {
				height: 100%;
				background: var(--color-accent-orange);
				border-radius: var(--radius-pill);
				transition: width var(--duration-base) var(--ease-standard);
			}

			/* ------------------------------------------------------------------ */
			/* Center hero column                                                  */
			/* ------------------------------------------------------------------ */

			.page-quick-play__hero-col {
				overflow: hidden;
				display: flex;
				align-items: stretch;
			}

			.page-quick-play__hero-col .kk-hero-preview-panel {
				height: 100%;
				width: 100%;
				border-radius: 0;
				border: none;
			}

			.page-quick-play__hero-col .kk-hero-preview-panel__inner {
				aspect-ratio: auto;
				height: 100%;
			}

			/* ------------------------------------------------------------------ */
			/* Options strip — four columns                                        */
			/* ------------------------------------------------------------------ */

			.page-quick-play__options {
				display: grid;
				grid-template-columns: 2fr 1fr 1fr 1fr;
				gap: var(--space-4);
				padding: var(--space-3) var(--page-padding-x);
				align-items: start;
			}

			/* ---- Track Select ---- */

			.page-quick-play__track-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-2);
			}

			.page-quick-play__track-thumb {
				background: none;
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				cursor: pointer;
				padding: 0;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				transition:
					border-color var(--duration-fast) var(--ease-standard),
					background   var(--duration-fast) var(--ease-standard);
			}

			.page-quick-play__track-thumb:hover,
			.page-quick-play__track-thumb:focus-visible {
				border-color: var(--color-accent-orange);
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.page-quick-play__track-thumb-img {
				width: 100%;
				aspect-ratio: 16 / 9;
				background: var(--color-ink-800, #1a1a1a);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-xs);
				color: var(--color-ink-500);
				font-family: var(--font-ui);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-quick-play__track-thumb-footer {
				padding: var(--space-1) var(--space-2);
				display: flex;
				align-items: center;
				justify-content: space-between;
				background: var(--color-panel-base);
			}

			.page-quick-play__track-thumb-name {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-overflow: ellipsis;
				overflow: hidden;
				white-space: nowrap;
			}

			.page-quick-play__track-thumb-diff {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				flex-shrink: 0;
				margin-left: var(--space-1);
			}

			/* ---- Match Type ---- */

			.page-quick-play__match-type .kk-section-panel__body {
				padding: 0;
			}

			/* ---- Race Rules ---- */

			.page-quick-play__race-rules {
				cursor: pointer;
			}

			.page-quick-play__race-rules:hover,
			.page-quick-play__race-rules:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.page-quick-play__rules-badges {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-quick-play__rule-badge {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
			}

			.page-quick-play__rule-icon {
				width: 20px;
				height: 20px;
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				flex-shrink: 0;
			}

			/* ---- Bot Fill ---- */

			.page-quick-play__bot-fill-inner {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-quick-play__bot-fill-row {
				display: flex;
				align-items: center;
				gap: var(--space-3);
			}

			.page-quick-play__bot-fill-slider {
				flex: 1;
				accent-color: var(--color-accent-orange);
				cursor: pointer;
				height: var(--hit-target-min);
			}

			.page-quick-play__bot-fill-count {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				color: var(--color-white);
				min-width: 2ch;
				text-align: center;
			}

			.page-quick-play__bot-fill-desc {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
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
		root.setAttribute( 'aria-label', 'Quick Play setup' );

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
			activeRoute: RouteIds.QUICK_PLAY,
			showBrand:   true,
			showUtility: false,
		} );
		root.appendChild( this._topNav.el );

		// ----- PageHeader -----
		this._pageHeader = new PageHeader( {
			title:    'QUICK PLAY',
			showBack: true,
		} );
		root.appendChild( this._pageHeader.el );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-quick-play__body';
		this._registerSection( 'body', body );

		// Left: character card
		const charWrap = document.createElement( 'div' );
		charWrap.className = 'page-quick-play__card';
		charWrap.setAttribute( 'role', 'button' );
		charWrap.setAttribute( 'tabindex', '0' );
		charWrap.setAttribute( 'aria-label', 'Change character' );
		charWrap.dataset.action = ButtonIds.QUICK_PLAY_SELECTED_CHARACTER;

		const charPanel = new SectionPanel( { title: 'SELECTED CHARACTER', headingLevel: 2 } );

		this._charNameEl = document.createElement( 'span' );
		this._charNameEl.className = 'page-quick-play__card-name';
		this._charNameEl.textContent = '—';

		this._charTagEl = document.createElement( 'span' );
		this._charTagEl.className = 'page-quick-play__card-tag';
		this._charTagEl.textContent = '';

		this._charBarsEl = document.createElement( 'div' );
		this._charBarsEl.className = 'page-quick-play__stat-bars';

		charPanel.append( this._charNameEl, this._charTagEl, this._charBarsEl );
		charWrap.appendChild( charPanel.el );
		body.appendChild( charWrap );
		this._characterCardEl = charWrap;
		this._registerSection( 'characterCard', charWrap );

		// Center: hero
		const heroCol = document.createElement( 'div' );
		heroCol.className = 'page-quick-play__hero-col';
		this._hero = new HeroPreviewPanel( {
			sceneId:     'quick-play-hero',
			ariaLabel:   'Character on kart preview',
			caption:     null,
			aspectRatio: '4/3',
			loading:     true,
		} );
		heroCol.appendChild( this._hero.el );
		body.appendChild( heroCol );
		this._registerSection( 'hero', heroCol );

		// Right: kart card
		const kartWrap = document.createElement( 'div' );
		kartWrap.className = 'page-quick-play__card';
		kartWrap.setAttribute( 'role', 'button' );
		kartWrap.setAttribute( 'tabindex', '0' );
		kartWrap.setAttribute( 'aria-label', 'Change kart' );
		kartWrap.dataset.action = ButtonIds.QUICK_PLAY_SELECTED_KART;

		const kartPanel = new SectionPanel( { title: 'SELECTED KART', headingLevel: 2 } );

		this._kartNameEl = document.createElement( 'span' );
		this._kartNameEl.className = 'page-quick-play__card-name';
		this._kartNameEl.textContent = '—';

		this._kartTagEl = document.createElement( 'span' );
		this._kartTagEl.className = 'page-quick-play__card-tag';
		this._kartTagEl.textContent = '';

		this._kartBarsEl = document.createElement( 'div' );
		this._kartBarsEl.className = 'page-quick-play__stat-bars';

		kartPanel.append( this._kartNameEl, this._kartTagEl, this._kartBarsEl );
		kartWrap.appendChild( kartPanel.el );
		body.appendChild( kartWrap );
		this._kartCardEl = kartWrap;
		this._registerSection( 'kartCard', kartWrap );

		root.appendChild( body );

		// ----- Options strip -----
		const options = document.createElement( 'div' );
		options.className = 'page-quick-play__options';
		this._registerSection( 'options', options );

		// Track Select
		const trackPanel = new SectionPanel( { title: 'TRACK SELECT', headingLevel: 2 } );
		this._trackGridEl = document.createElement( 'div' );
		this._trackGridEl.className = 'page-quick-play__track-grid';
		this._trackGridEl.setAttribute( 'role', 'group' );
		this._trackGridEl.setAttribute( 'aria-label', 'Track options' );
		trackPanel.append( this._trackGridEl );
		options.appendChild( trackPanel.el );
		this._registerSection( 'trackGrid', this._trackGridEl );

		// Match Type (Tabs inside SectionPanel)
		const matchPanel = new SectionPanel( { title: 'MATCH TYPE', headingLevel: 2 } );
		matchPanel.el.classList.add( 'page-quick-play__match-type' );
		const matchTabs = new Tabs( {
			tabs: [
				{ id: 'race',       label: 'Race' },
				{ id: 'time_trial', label: 'Time Trial' },
				{ id: 'battle',     label: 'Battle' },
			],
			activeId:  'race',
			ariaLabel: 'Match type',
		} );
		matchPanel.append( matchTabs.el );
		options.appendChild( matchPanel.el );
		this._registerSection( 'matchTabs', matchTabs.el );

		// Race Rules (clickable panel)
		const rulesPanel = new SectionPanel( { title: 'RACE RULES', headingLevel: 2 } );
		rulesPanel.el.classList.add( 'page-quick-play__race-rules' );
		rulesPanel.el.setAttribute( 'tabindex', '0' );
		rulesPanel.el.setAttribute( 'role', 'button' );
		rulesPanel.el.setAttribute( 'aria-label', 'Race rules — click to configure' );
		rulesPanel.el.dataset.action = ButtonIds.QUICK_PLAY_RACE_RULES;

		const badgesEl = document.createElement( 'div' );
		badgesEl.className = 'page-quick-play__rules-badges';

		const defaultRules = [
			{ icon: '3', label: 'Laps: 3' },
			{ icon: '*', label: 'Items: All' },
			{ icon: '»', label: 'Speed: Fast' },
		];

		defaultRules.forEach( ( rule ) => {

			const badge = document.createElement( 'div' );
			badge.className = 'page-quick-play__rule-badge';

			const iconEl = document.createElement( 'span' );
			iconEl.className = 'page-quick-play__rule-icon';
			iconEl.setAttribute( 'aria-hidden', 'true' );
			iconEl.textContent = rule.icon;
			badge.appendChild( iconEl );

			const labelEl = document.createElement( 'span' );
			labelEl.textContent = rule.label;
			badge.appendChild( labelEl );

			badgesEl.appendChild( badge );

		} );

		rulesPanel.append( badgesEl );
		options.appendChild( rulesPanel.el );
		this._raceRulesPanelEl = rulesPanel.el;
		this._registerSection( 'raceRules', rulesPanel.el );

		// Bot Fill (range slider)
		const botPanel = new SectionPanel( { title: 'BOT FILL', headingLevel: 2 } );
		botPanel.el.dataset.action = ButtonIds.QUICK_PLAY_BOT_FILL;

		const botInner = document.createElement( 'div' );
		botInner.className = 'page-quick-play__bot-fill-inner';

		const botRow = document.createElement( 'div' );
		botRow.className = 'page-quick-play__bot-fill-row';

		const slider = document.createElement( 'input' );
		slider.type = 'range';
		slider.min = '0';
		slider.max = '11';
		slider.value = '0';
		slider.step = '1';
		slider.className = 'page-quick-play__bot-fill-slider';
		slider.setAttribute( 'aria-label', 'Bot fill count' );
		slider.setAttribute( 'aria-valuemin', '0' );
		slider.setAttribute( 'aria-valuemax', '11' );
		slider.setAttribute( 'aria-valuenow', '0' );
		this._botFillSliderEl = slider;
		botRow.appendChild( slider );

		this._botFillLabelEl = document.createElement( 'span' );
		this._botFillLabelEl.className = 'page-quick-play__bot-fill-count';
		this._botFillLabelEl.textContent = '0';
		this._botFillLabelEl.setAttribute( 'aria-live', 'polite' );
		this._botFillLabelEl.setAttribute( 'aria-atomic', 'true' );
		botRow.appendChild( this._botFillLabelEl );

		const botDesc = document.createElement( 'span' );
		botDesc.className = 'page-quick-play__bot-fill-desc';
		botDesc.textContent = '0 = no bots, 11 = full grid';

		botInner.appendChild( botRow );
		botInner.appendChild( botDesc );
		botPanel.append( botInner );
		options.appendChild( botPanel.el );

		root.appendChild( options );

		// ----- ActionBar -----
		this._actionBar = new ActionBar( {
			primary: {
				label:    'START RACE',
				variant:  'primary',
				actionId: ButtonIds.QUICK_PLAY_START_RACE,
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

		// Focus character card first — per spec keyboard flow §6 step 3
		this._characterCardEl?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} */
	get characterCardEl() { return this._characterCardEl; }

	/** @returns {HTMLElement} */
	get kartCardEl() { return this._kartCardEl; }

	/** @returns {HTMLElement} */
	get raceRulesPanelEl() { return this._raceRulesPanelEl; }

	/** @returns {HTMLInputElement} */
	get botFillSliderEl() { return this._botFillSliderEl; }

	/** @returns {ActionBar} */
	get actionBar() { return this._actionBar; }

	/**
	 * Populate the HeroPreviewPanel aria-label.
	 *
	 * @param {string} label
	 */
	setHeroAriaLabel( label ) {

		this._hero?.setAriaLabel( label );

	}

	/**
	 * Update bot fill count label and slider aria-valuenow.
	 *
	 * @param {number} count
	 */
	setBotFillLabel( count ) {

		if ( this._botFillLabelEl ) this._botFillLabelEl.textContent = String( count );
		if ( this._botFillSliderEl ) this._botFillSliderEl.setAttribute( 'aria-valuenow', String( count ) );

	}

	/**
	 * Populate the Selected Character card.
	 *
	 * @param {{ id:string, name:string, speed:number, drift:number, handling:number, accel:number } | null} character
	 */
	setCharacter( character ) {

		if ( ! character ) {

			if ( this._charNameEl ) this._charNameEl.textContent = '—';
			if ( this._charTagEl  ) this._charTagEl.textContent  = '';
			if ( this._charBarsEl ) this._charBarsEl.innerHTML   = '';
			if ( this._characterCardEl ) {
				this._characterCardEl.setAttribute( 'aria-label', 'Choose a character' );
			}
			return;

		}

		if ( this._charNameEl ) this._charNameEl.textContent = character.name;
		if ( this._charTagEl  ) this._charTagEl.textContent  = 'BEASTSIDE';

		if ( this._charBarsEl ) {

			this._charBarsEl.innerHTML = '';
			const stats = [
				{ label: 'SPD',  value: character.speed    },
				{ label: 'DFT',  value: character.drift    },
				{ label: 'HND',  value: character.handling },
				{ label: 'ACC',  value: character.accel    },
			];
			stats.forEach( ( s ) => {

				this._charBarsEl.appendChild( this._buildStatBar( s.label, s.value, 100 ) );

			} );

		}

		if ( this._characterCardEl ) {
			this._characterCardEl.setAttribute( 'aria-label', `Change character — currently ${character.name}` );
		}

	}

	/**
	 * Populate the Selected Kart card.
	 *
	 * @param {{ id:string, name:string, speed:number, accel:number, handling:number, traction:number, boost:number } | null} kart
	 */
	setKart( kart ) {

		if ( ! kart ) {

			if ( this._kartNameEl ) this._kartNameEl.textContent = '—';
			if ( this._kartTagEl  ) this._kartTagEl.textContent  = '';
			if ( this._kartBarsEl ) this._kartBarsEl.innerHTML   = '';
			if ( this._kartCardEl ) {
				this._kartCardEl.setAttribute( 'aria-label', 'Choose a kart' );
			}
			return;

		}

		if ( this._kartNameEl ) this._kartNameEl.textContent = kart.name;
		if ( this._kartTagEl  ) this._kartTagEl.textContent  = 'BEASTSIDE';

		if ( this._kartBarsEl ) {

			this._kartBarsEl.innerHTML = '';
			const stats = [
				{ label: 'SPD',  value: kart.speed    },
				{ label: 'ACC',  value: kart.accel    },
				{ label: 'HND',  value: kart.handling },
				{ label: 'TRC',  value: kart.traction },
				{ label: 'BST',  value: kart.boost    },
			];
			stats.forEach( ( s ) => {

				this._kartBarsEl.appendChild( this._buildStatBar( s.label, s.value, 10 ) );

			} );

		}

		if ( this._kartCardEl ) {
			this._kartCardEl.setAttribute( 'aria-label', `Change kart — currently ${kart.name}` );
		}

	}

	/**
	 * Render track thumbnail buttons.
	 *
	 * @param {Array<{ id:string, name:string, difficulty:string }>} tracks
	 */
	setTracks( tracks ) {

		const container = this._trackGridEl;
		if ( ! container ) return;
		container.innerHTML = '';

		tracks.forEach( ( track ) => {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'page-quick-play__track-thumb';
			btn.dataset.action = ButtonIds.QUICK_PLAY_TRACK_SELECT;
			btn.dataset.trackId = track.id;
			btn.setAttribute( 'aria-label', `Select track: ${track.name} (${track.difficulty})` );

			const imgEl = document.createElement( 'div' );
			imgEl.className = 'page-quick-play__track-thumb-img';
			imgEl.setAttribute( 'aria-hidden', 'true' );
			imgEl.textContent = 'TRACK';
			btn.appendChild( imgEl );

			const footer = document.createElement( 'div' );
			footer.className = 'page-quick-play__track-thumb-footer';

			const nameEl = document.createElement( 'span' );
			nameEl.className = 'page-quick-play__track-thumb-name';
			nameEl.textContent = track.name;
			footer.appendChild( nameEl );

			const diffEl = document.createElement( 'span' );
			diffEl.className = 'page-quick-play__track-thumb-diff';
			diffEl.textContent = track.difficulty;
			footer.appendChild( diffEl );

			btn.appendChild( footer );
			container.appendChild( btn );

		} );

	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a single stat bar row.
	 *
	 * @param {string} label
	 * @param {number} value   Raw stat value
	 * @param {number} max     Max value (100 for characters, 10 for karts)
	 * @returns {HTMLElement}
	 */
	_buildStatBar( label, value, max ) {

		const pct = Math.round( ( value / max ) * 100 );

		const row = document.createElement( 'div' );
		row.className = 'page-quick-play__stat-row';

		const labelEl = document.createElement( 'span' );
		labelEl.className = 'page-quick-play__stat-label';
		labelEl.textContent = label;
		labelEl.setAttribute( 'aria-hidden', 'true' );
		row.appendChild( labelEl );

		const track = document.createElement( 'div' );
		track.className = 'page-quick-play__stat-bar-track';
		track.setAttribute( 'role', 'img' );
		track.setAttribute( 'aria-label', `${label}: ${value} out of ${max}` );

		const fill = document.createElement( 'div' );
		fill.className = 'page-quick-play__stat-bar-fill';
		fill.style.width = `${pct}%`;
		track.appendChild( fill );

		row.appendChild( track );
		return row;

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

		this._actionBar?.dispose();
		this._actionBar = null;

		this._characterCardEl  = null;
		this._kartCardEl       = null;
		this._raceRulesPanelEl = null;
		this._botFillSliderEl  = null;
		this._botFillLabelEl   = null;
		this._charNameEl       = null;
		this._charTagEl        = null;
		this._charBarsEl       = null;
		this._kartNameEl       = null;
		this._kartTagEl        = null;
		this._kartBarsEl       = null;
		this._trackGridEl      = null;

		super.dispose();

	}

}

Page03QuickPlayView._cssInjected = false;
