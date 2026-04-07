/**
 * Page12ProfileView — Player Profile / Career.
 *
 * Layout: full-height viewport, no outer scroll.
 *
 * Grid rows: PageHeader zone | body (1fr)
 * Body cols: left column (profile card + lifetime stats + loadout) (320px) | right column (1fr, tabs + tab content)
 *
 * Left column:
 *   - Profile card: avatar placeholder, name, title, level badge, XP bar, wins/races
 *   - Lifetime stats panel: 6-stat grid
 *   - Favorite loadout preview with EDIT PROFILE and FAVORITE LOADOUT buttons
 *
 * Right column:
 *   - Tab strip: ACHIEVEMENTS, BADGES, MATCH HISTORY
 *   - Tab content panel (rendered by controller via setTabContent)
 *
 * Public API consumed by Page12ProfileController:
 *   setProfileCard({ name, title, level, xp, xpToNext, totalWins, totalRaces })
 *   setLifetimeStats(stats[])
 *   setFavoriteLoadout({ characterName, kartName })
 *   setActiveTab('achievements'|'badges'|'history')
 *   setTabContent('achievements'|'badges'|'history', data)
 *   get editProfileBtn     — CTAButton
 *   get favoriteLoadoutBtn — CTAButton
 *   get tabAchievements    — CTAButton
 *   get tabBadges          — CTAButton
 *   get tabHistory         — CTAButton
 *
 * Deviations from spec:
 *   - Tabs are custom CTAButton instances (secondary variant) rather than the
 *     Tabs component, because the profile tab content is rendered directly into
 *     a single shared panel rather than using Tabs' panel management model.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { ProgressBar }   from '../../components/ProgressBar.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

export class Page12ProfileView extends PageViewBase {

	constructor() {

		super( 'page-profile' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {CTAButton} */
		this._editProfileBtn = null;

		/** @type {CTAButton} */
		this._favoriteLoadoutBtn = null;

		/** @type {CTAButton} */
		this._tabAchievements = null;

		/** @type {CTAButton} */
		this._tabBadges = null;

		/** @type {CTAButton} */
		this._tabHistory = null;

		/** @type {ProgressBar} */
		this._xpBar = null;

		/** @type {ProgressBar[]} */
		this._progressBars = [];

		/** @type {HTMLElement} */
		this._profileCardEl = null;

		/** @type {HTMLElement} */
		this._statsGridEl = null;

		/** @type {HTMLElement} */
		this._loadoutPreviewEl = null;

		/** @type {HTMLElement} */
		this._tabContentEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( Page12ProfileView._cssInjected ) return;
		Page12ProfileView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-profile {
				display: grid;
				grid-template-rows: auto 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-surface);
			}

			/* ------------------------------------------------------------------ */
			/* Header zone                                                         */
			/* ------------------------------------------------------------------ */

			.page-profile__header-zone {
				display: flex;
				align-items: center;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* ------------------------------------------------------------------ */
			/* Body — two-column layout                                            */
			/* ------------------------------------------------------------------ */

			.page-profile__body {
				display: grid;
				grid-template-columns: 320px 1fr;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Left column                                                         */
			/* ------------------------------------------------------------------ */

			.page-profile__left {
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
				padding: var(--space-5) var(--space-4);
				overflow-y: auto;
				border-right: 1px solid var(--color-panel-border);
				background: var(--color-panel-base);
			}

			/* ---- Profile card ---- */

			.kk-profile-card {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				padding: var(--space-4);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
			}

			.kk-profile-card__top {
				display: flex;
				align-items: center;
				gap: var(--space-3);
			}

			.kk-profile-card__avatar {
				width: 72px;
				height: 72px;
				border-radius: 50%;
				background: var(--color-panel-base);
				border: 2px solid var(--color-accent-orange);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-400);
				font-size: var(--text-2xl);
				font-weight: var(--weight-black);
				font-family: var(--font-display);
				flex-shrink: 0;
			}

			.kk-profile-card__info {
				flex: 1 1 auto;
				min-width: 0;
			}

			.kk-profile-card__name {
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.kk-profile-card__title {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				font-weight: var(--weight-bold);
			}

			.kk-profile-card__level {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: var(--space-1) var(--space-2);
				background: var(--color-accent-orange);
				color: var(--color-white);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-black);
				border-radius: var(--radius-sm);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				margin-top: var(--space-1);
				align-self: flex-start;
			}

			.kk-profile-card__xp-row {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-profile-card__xp-label {
				display: flex;
				justify-content: space-between;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				letter-spacing: var(--tracking-wider);
			}

			.kk-profile-card__xp-label strong {
				color: var(--color-accent-cyan);
			}

			.kk-profile-card__record {
				display: flex;
				gap: var(--space-4);
			}

			.kk-profile-card__record-item {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-1);
			}

			.kk-profile-card__record-value {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				color: var(--color-white);
			}

			.kk-profile-card__record-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* ---- Panel label shared ---- */

			.page-profile__panel-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				border-bottom: 1px solid var(--color-panel-border);
				padding-bottom: var(--space-2);
				margin-bottom: var(--space-2);
			}

			/* ---- Lifetime stats ---- */

			.kk-lifetime-stats {
				padding: var(--space-4);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
			}

			.kk-lifetime-stats__grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-3);
			}

			.kk-lifetime-stats__item {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-lifetime-stats__value {
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-black);
				color: var(--color-white);
			}

			.kk-lifetime-stats__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* ---- Loadout preview ---- */

			.kk-loadout-preview {
				padding: var(--space-4);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.kk-loadout-preview__row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
			}

			.kk-loadout-preview__icon {
				width: 40px;
				height: 40px;
				background: var(--color-panel-base);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-400);
				flex-shrink: 0;
			}

			.kk-loadout-preview__details {
				flex: 1 1 auto;
			}

			.kk-loadout-preview__sub {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-loadout-preview__name {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-loadout-preview__actions {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.kk-loadout-preview__actions .kk-cta-button {
				width: 100%;
				justify-content: center;
			}

			/* ------------------------------------------------------------------ */
			/* Right column                                                        */
			/* ------------------------------------------------------------------ */

			.page-profile__right {
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}

			/* ---- Tab strip ---- */

			.page-profile__tabs-row {
				display: flex;
				align-items: stretch;
				gap: 0;
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
				padding: 0 var(--space-4);
				flex-shrink: 0;
			}

			.page-profile__tab {
				padding: var(--space-3) var(--space-5);
				background: transparent;
				border: none;
				border-bottom: 3px solid transparent;
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				cursor: pointer;
				transition:
					color var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard);
				white-space: nowrap;
				min-height: var(--hit-target-min);
			}

			.page-profile__tab:hover {
				color: var(--color-ink-100);
			}

			.page-profile__tab:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: -2px;
			}

			.page-profile__tab--active {
				color: var(--color-white);
				border-bottom-color: var(--color-accent-orange);
			}

			/* ---- Tab content ---- */

			.page-profile__tab-content {
				flex: 1 1 auto;
				overflow-y: auto;
				padding: var(--space-5) var(--space-6);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* ---- Achievement row ---- */

			.kk-achievement-row {
				display: grid;
				grid-template-columns: 56px 1fr auto;
				column-gap: var(--space-4);
				row-gap: var(--space-1);
				padding: var(--space-4);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				align-items: start;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-achievement-row:focus-within {
				border-color: var(--color-accent-orange);
			}

			.kk-achievement-row--unlocked {
				border-color: var(--color-accent-orange);
			}

			.kk-achievement-row__icon {
				grid-row: 1 / 4;
				grid-column: 1;
				width: 56px;
				height: 56px;
				border-radius: var(--radius-sm);
				background: var(--color-panel-raised);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-2xl);
				color: var(--color-accent-orange);
			}

			.kk-achievement-row__icon--locked {
				color: var(--color-ink-600);
			}

			.kk-achievement-row__title {
				grid-column: 2;
				font-family: var(--font-ui);
				font-size: var(--text-base);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-achievement-row__desc {
				grid-column: 2;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				line-height: var(--leading-relaxed);
			}

			.kk-achievement-row__progress-row {
				grid-column: 2;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-achievement-row__progress-text {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				letter-spacing: var(--tracking-wider);
			}

			.kk-achievement-row__progress-text strong {
				color: var(--color-ink-100);
			}

			.kk-achievement-row__badge-col {
				grid-row: 1 / 4;
				grid-column: 3;
				display: flex;
				align-items: center;
				padding-left: var(--space-4);
			}

			.kk-achievement-row__unlocked-badge {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				padding: var(--space-1) var(--space-3);
				border: 1px solid var(--color-accent-orange);
				border-radius: var(--radius-sm);
			}

			/* ---- Badge grid ---- */

			.kk-badges-grid {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: var(--space-3);
			}

			.kk-badge-item {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-4);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				text-align: center;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-badge-item--unlocked {
				border-color: var(--color-accent-orange);
			}

			.kk-badge-item__icon {
				width: 52px;
				height: 52px;
				border-radius: 50%;
				background: var(--color-panel-raised);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-2xl);
				color: var(--color-ink-500);
			}

			.kk-badge-item--unlocked .kk-badge-item__icon {
				background: rgba(249, 115, 22, 0.12);
				color: var(--color-accent-orange);
			}

			.kk-badge-item__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-badge-item--unlocked .kk-badge-item__label {
				color: var(--color-white);
			}

			/* ---- Match history ---- */

			.kk-match-row {
				display: grid;
				grid-template-columns: auto 1fr auto auto;
				align-items: center;
				gap: var(--space-4);
				padding: var(--space-3) var(--space-4);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
			}

			.kk-match-row__position {
				width: 40px;
				height: 40px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-black);
				color: var(--color-white);
				background: var(--color-panel-raised);
				border: 2px solid var(--color-panel-border);
				flex-shrink: 0;
			}

			.kk-match-row__position--first {
				background: rgba(234, 179, 8, 0.2);
				border-color: var(--color-accent-yellow);
				color: var(--color-accent-yellow);
			}

			.kk-match-row__position--second {
				background: rgba(148, 163, 184, 0.2);
				border-color: #94a3b8;
				color: #94a3b8;
			}

			.kk-match-row__position--third {
				background: rgba(180, 83, 9, 0.2);
				border-color: #b45309;
				color: #b45309;
			}

			.kk-match-row__track {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-match-row__date {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-match-row__xp {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-accent-cyan);
				letter-spacing: var(--tracking-wider);
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
		root.setAttribute( 'aria-label', 'Player Profile' );

		// ----- Header zone -----
		this._header = new PageHeader( {
			title:    'PROFILE',
			showBack: true,
		} );

		const headerZone = document.createElement( 'div' );
		headerZone.className = 'page-profile__header-zone';
		headerZone.appendChild( this._header.el );
		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-profile__body';
		this._registerSection( 'body', body );

		// ----- Left column -----
		const left = document.createElement( 'div' );
		left.className = 'page-profile__left';
		left.setAttribute( 'aria-label', 'Profile details' );

		// Profile card placeholder (populated by setProfileCard)
		this._profileCardEl = document.createElement( 'div' );
		this._profileCardEl.className = 'kk-profile-card';
		this._profileCardEl.setAttribute( 'aria-label', 'Player card' );
		left.appendChild( this._profileCardEl );
		this._registerSection( 'profileCard', this._profileCardEl );

		// Lifetime stats placeholder (populated by setLifetimeStats)
		this._statsGridEl = document.createElement( 'div' );
		this._statsGridEl.className = 'kk-lifetime-stats';
		this._statsGridEl.setAttribute( 'aria-label', 'Lifetime statistics' );
		left.appendChild( this._statsGridEl );
		this._registerSection( 'statsGrid', this._statsGridEl );

		// Favorite loadout placeholder (populated by setFavoriteLoadout)
		this._loadoutPreviewEl = document.createElement( 'div' );
		this._loadoutPreviewEl.className = 'kk-loadout-preview';
		this._loadoutPreviewEl.setAttribute( 'aria-label', 'Favorite loadout' );
		left.appendChild( this._loadoutPreviewEl );
		this._registerSection( 'loadoutPreview', this._loadoutPreviewEl );

		body.appendChild( left );

		// ----- Right column -----
		const right = document.createElement( 'div' );
		right.className = 'page-profile__right';

		// Tab strip
		const tabsRow = document.createElement( 'nav' );
		tabsRow.className = 'page-profile__tabs-row';
		tabsRow.setAttribute( 'role', 'tablist' );
		tabsRow.setAttribute( 'aria-label', 'Profile sections' );

		const makeTabBtn = ( label, actionId ) => {
			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'page-profile__tab';
			btn.setAttribute( 'role', 'tab' );
			btn.setAttribute( 'aria-selected', 'false' );
			btn.setAttribute( 'data-action', actionId );
			btn.textContent = label;
			// Wrap in a CTAButton-like object so controller can use .el
			return { el: btn };
		};

		this._tabAchievements = makeTabBtn( 'ACHIEVEMENTS', ButtonIds.PROFILE_TAB_ACHIEVEMENTS );
		this._tabBadges       = makeTabBtn( 'BADGES',       ButtonIds.PROFILE_TAB_BADGES );
		this._tabHistory      = makeTabBtn( 'MATCH HISTORY', ButtonIds.PROFILE_TAB_HISTORY );

		tabsRow.appendChild( this._tabAchievements.el );
		tabsRow.appendChild( this._tabBadges.el );
		tabsRow.appendChild( this._tabHistory.el );
		right.appendChild( tabsRow );

		// Tab content
		this._tabContentEl = document.createElement( 'div' );
		this._tabContentEl.className = 'page-profile__tab-content';
		this._tabContentEl.setAttribute( 'role', 'tabpanel' );
		this._tabContentEl.setAttribute( 'aria-label', 'Tab content' );
		this._registerSection( 'tabContent', this._tabContentEl );
		right.appendChild( this._tabContentEl );

		body.appendChild( right );
		root.appendChild( body );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		const backBtn = this._root.querySelector( '.kk-page-header__back' );
		backBtn?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Populate the profile card with player data.
	 *
	 * @param {{ name: string, title: string, level: number, xp: number, xpToNext: number, totalWins: number, totalRaces: number }} data
	 */
	setProfileCard( { name, title, level, xp, xpToNext, totalWins, totalRaces } ) {

		const card = this._profileCardEl;
		card.innerHTML = '';

		// Dispose old XP bar if any
		if ( this._xpBar ) {
			this._progressBars = this._progressBars.filter( ( b ) => b !== this._xpBar );
			this._xpBar.dispose();
			this._xpBar = null;
		}

		// Top row: avatar + info
		const top = document.createElement( 'div' );
		top.className = 'kk-profile-card__top';

		const avatar = document.createElement( 'div' );
		avatar.className = 'kk-profile-card__avatar';
		avatar.setAttribute( 'aria-hidden', 'true' );
		avatar.textContent = name.charAt( 0 ).toUpperCase();
		top.appendChild( avatar );

		const info = document.createElement( 'div' );
		info.className = 'kk-profile-card__info';

		const nameEl = document.createElement( 'div' );
		nameEl.className = 'kk-profile-card__name';
		nameEl.textContent = name;
		info.appendChild( nameEl );

		const titleEl = document.createElement( 'div' );
		titleEl.className = 'kk-profile-card__title';
		titleEl.textContent = title;
		info.appendChild( titleEl );

		const levelEl = document.createElement( 'div' );
		levelEl.className = 'kk-profile-card__level';
		levelEl.textContent = `LVL ${level}`;
		info.appendChild( levelEl );

		top.appendChild( info );
		card.appendChild( top );

		// XP bar row
		const xpRow = document.createElement( 'div' );
		xpRow.className = 'kk-profile-card__xp-row';

		const xpLabel = document.createElement( 'div' );
		xpLabel.className = 'kk-profile-card__xp-label';
		xpLabel.innerHTML = `<span>XP</span><strong>${xp.toLocaleString()} / ${xpToNext.toLocaleString()}</strong>`;
		xpRow.appendChild( xpLabel );

		this._xpBar = new ProgressBar( {
			label:    'Experience points',
			value:    xp,
			min:      0,
			max:      xpToNext,
			variant:  'xp',
			animated: true,
		} );
		this._progressBars.push( this._xpBar );
		xpRow.appendChild( this._xpBar.el );
		card.appendChild( xpRow );

		// Wins / races record
		const record = document.createElement( 'div' );
		record.className = 'kk-profile-card__record';

		const makeRecordItem = ( value, label ) => {
			const item = document.createElement( 'div' );
			item.className = 'kk-profile-card__record-item';
			const valEl = document.createElement( 'div' );
			valEl.className = 'kk-profile-card__record-value';
			valEl.textContent = String( value );
			const labelEl = document.createElement( 'div' );
			labelEl.className = 'kk-profile-card__record-label';
			labelEl.textContent = label;
			item.appendChild( valEl );
			item.appendChild( labelEl );
			return item;
		};

		record.appendChild( makeRecordItem( totalWins, 'WINS' ) );
		record.appendChild( makeRecordItem( totalRaces, 'RACES' ) );
		card.appendChild( record );

	}

	/**
	 * Populate the lifetime stats grid.
	 *
	 * @param {Array<{ label: string, value: string }>} stats
	 */
	setLifetimeStats( stats ) {

		const container = this._statsGridEl;
		container.innerHTML = '';

		const label = document.createElement( 'div' );
		label.className = 'page-profile__panel-label';
		label.textContent = 'LIFETIME STATS';
		container.appendChild( label );

		const grid = document.createElement( 'div' );
		grid.className = 'kk-lifetime-stats__grid';

		stats.forEach( ( s ) => {
			const item = document.createElement( 'div' );
			item.className = 'kk-lifetime-stats__item';

			const valEl = document.createElement( 'div' );
			valEl.className = 'kk-lifetime-stats__value';
			valEl.textContent = s.value;
			item.appendChild( valEl );

			const labelEl = document.createElement( 'div' );
			labelEl.className = 'kk-lifetime-stats__label';
			labelEl.textContent = s.label;
			item.appendChild( labelEl );

			grid.appendChild( item );
		} );

		container.appendChild( grid );

	}

	/**
	 * Populate the favorite loadout preview.
	 *
	 * @param {{ characterName: string, kartName: string }} data
	 */
	setFavoriteLoadout( { characterName, kartName } ) {

		const container = this._loadoutPreviewEl;
		container.innerHTML = '';

		const label = document.createElement( 'div' );
		label.className = 'page-profile__panel-label';
		label.textContent = 'FAVORITE LOADOUT';
		container.appendChild( label );

		const makeRow = ( sub, name ) => {
			const row = document.createElement( 'div' );
			row.className = 'kk-loadout-preview__row';

			const icon = document.createElement( 'div' );
			icon.className = 'kk-loadout-preview__icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

			const details = document.createElement( 'div' );
			details.className = 'kk-loadout-preview__details';

			const subEl = document.createElement( 'div' );
			subEl.className = 'kk-loadout-preview__sub';
			subEl.textContent = sub;
			details.appendChild( subEl );

			const nameEl = document.createElement( 'div' );
			nameEl.className = 'kk-loadout-preview__name';
			nameEl.textContent = name;
			details.appendChild( nameEl );

			row.appendChild( icon );
			row.appendChild( details );
			return row;
		};

		container.appendChild( makeRow( 'CHARACTER', characterName ) );
		container.appendChild( makeRow( 'KART', kartName ) );

		const actions = document.createElement( 'div' );
		actions.className = 'kk-loadout-preview__actions';

		this._editProfileBtn = new CTAButton( {
			label:    'EDIT PROFILE',
			variant:  'secondary',
			actionId: ButtonIds.PROFILE_EDIT,
		} );
		actions.appendChild( this._editProfileBtn.el );

		this._favoriteLoadoutBtn = new CTAButton( {
			label:    'FAVORITE LOADOUT',
			variant:  'primary',
			actionId: ButtonIds.PROFILE_FAVORITE_LOADOUT,
		} );
		actions.appendChild( this._favoriteLoadoutBtn.el );

		container.appendChild( actions );

	}

	/**
	 * Set which tab is visually active.
	 *
	 * @param {'achievements'|'badges'|'history'} tab
	 */
	setActiveTab( tab ) {

		const map = {
			achievements: this._tabAchievements,
			badges:       this._tabBadges,
			history:      this._tabHistory,
		};

		for ( const [ key, btnObj ] of Object.entries( map ) ) {
			const isActive = key === tab;
			btnObj.el.classList.toggle( 'page-profile__tab--active', isActive );
			btnObj.el.setAttribute( 'aria-selected', String( isActive ) );
		}

	}

	/**
	 * Render the content for the active tab.
	 *
	 * @param {'achievements'|'badges'|'history'} tab
	 * @param {Array<object>} data
	 */
	setTabContent( tab, data ) {

		// Dispose any progress bars from previous render
		this._progressBars = this._progressBars.filter( ( b ) => {
			if ( b !== this._xpBar ) { b.dispose(); return false; }
			return true;
		} );

		const container = this._tabContentEl;
		container.innerHTML = '';

		if ( tab === 'achievements' ) {
			this._renderAchievements( data, container );
		} else if ( tab === 'badges' ) {
			this._renderBadges( data, container );
		} else {
			this._renderMatchHistory( data, container );
		}

	}

	// ---------------------------------------------------------------------------
	// Internal render helpers
	// ---------------------------------------------------------------------------

	_renderAchievements( achievements, container ) {

		if ( ! achievements || achievements.length === 0 ) {
			container.appendChild( this.buildEmptyState( { label: 'No achievements', heading: 'NO ACHIEVEMENTS', subtext: 'Keep playing to unlock achievements.' } ) );
			return;
		}

		achievements.forEach( ( a ) => {
			const row = document.createElement( 'div' );
			row.className = 'kk-achievement-row';
			row.setAttribute( 'role', 'listitem' );
			if ( a.unlocked ) row.classList.add( 'kk-achievement-row--unlocked' );

			// Icon
			const icon = document.createElement( 'div' );
			icon.className = `kk-achievement-row__icon${a.unlocked ? '' : ' kk-achievement-row__icon--locked'}`;
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.innerHTML = a.unlocked
				? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
				: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
			row.appendChild( icon );

			// Title
			const title = document.createElement( 'span' );
			title.className = 'kk-achievement-row__title';
			title.textContent = a.title;
			row.appendChild( title );

			// Desc
			const desc = document.createElement( 'span' );
			desc.className = 'kk-achievement-row__desc';
			desc.textContent = a.desc;
			row.appendChild( desc );

			// Progress row
			const progressRow = document.createElement( 'div' );
			progressRow.className = 'kk-achievement-row__progress-row';

			const progressText = document.createElement( 'span' );
			progressText.className = 'kk-achievement-row__progress-text';
			progressText.innerHTML = `<strong>${a.progress}</strong> / ${a.target}`;
			progressRow.appendChild( progressText );

			const bar = new ProgressBar( {
				label:    `${a.title} progress`,
				value:    a.progress,
				min:      0,
				max:      a.target,
				variant:  'challenge',
				animated: true,
			} );
			this._progressBars.push( bar );
			progressRow.appendChild( bar.el );
			row.appendChild( progressRow );

			// Badge col
			const badgeCol = document.createElement( 'div' );
			badgeCol.className = 'kk-achievement-row__badge-col';
			if ( a.unlocked ) {
				const badge = document.createElement( 'span' );
				badge.className = 'kk-achievement-row__unlocked-badge';
				badge.textContent = 'UNLOCKED';
				badgeCol.appendChild( badge );
			}
			row.appendChild( badgeCol );

			container.appendChild( row );
		} );

	}

	_renderBadges( badges, container ) {

		if ( ! badges || badges.length === 0 ) {
			container.appendChild( this.buildEmptyState( { label: 'No badges', heading: 'NO BADGES', subtext: 'Complete challenges to earn badges.' } ) );
			return;
		}

		const grid = document.createElement( 'div' );
		grid.className = 'kk-badges-grid';
		grid.setAttribute( 'role', 'list' );

		badges.forEach( ( b ) => {
			const item = document.createElement( 'div' );
			item.className = `kk-badge-item${b.unlocked ? ' kk-badge-item--unlocked' : ''}`;
			item.setAttribute( 'role', 'listitem' );

			const icon = document.createElement( 'div' );
			icon.className = 'kk-badge-item__icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.innerHTML = b.unlocked
				? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>'
				: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';

			const label = document.createElement( 'div' );
			label.className = 'kk-badge-item__label';
			label.textContent = b.label;

			item.appendChild( icon );
			item.appendChild( label );
			grid.appendChild( item );
		} );

		container.appendChild( grid );

	}

	_renderMatchHistory( history, container ) {

		if ( ! history || history.length === 0 ) {
			container.appendChild( this.buildEmptyState( { label: 'No match history', heading: 'NO RACES YET', subtext: 'Your match history will appear here.' } ) );
			return;
		}

		history.forEach( ( m ) => {
			const row = document.createElement( 'div' );
			row.className = 'kk-match-row';
			row.setAttribute( 'role', 'listitem' );

			const posMod = m.position === 1 ? ' kk-match-row__position--first'
				: m.position === 2 ? ' kk-match-row__position--second'
				: m.position === 3 ? ' kk-match-row__position--third'
				: '';

			const pos = document.createElement( 'div' );
			pos.className = `kk-match-row__position${posMod}`;
			pos.setAttribute( 'aria-label', `Position ${m.position}` );
			pos.textContent = `#${m.position}`;
			row.appendChild( pos );

			const details = document.createElement( 'div' );

			const track = document.createElement( 'div' );
			track.className = 'kk-match-row__track';
			track.textContent = m.track;
			details.appendChild( track );

			const date = document.createElement( 'div' );
			date.className = 'kk-match-row__date';
			date.textContent = m.date;
			details.appendChild( date );

			row.appendChild( details );

			const xp = document.createElement( 'div' );
			xp.className = 'kk-match-row__xp';
			xp.textContent = m.xp;
			row.appendChild( xp );

			container.appendChild( row );
		} );

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {{ el: HTMLButtonElement }} */
	get editProfileBtn() { return this._editProfileBtn; }

	/** @returns {{ el: HTMLButtonElement }} */
	get favoriteLoadoutBtn() { return this._favoriteLoadoutBtn; }

	/** @returns {{ el: HTMLButtonElement }} */
	get tabAchievements() { return this._tabAchievements; }

	/** @returns {{ el: HTMLButtonElement }} */
	get tabBadges() { return this._tabBadges; }

	/** @returns {{ el: HTMLButtonElement }} */
	get tabHistory() { return this._tabHistory; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._progressBars.forEach( ( b ) => b.dispose() );
		this._progressBars = [];
		this._xpBar = null;

		this._header?.dispose();
		this._header = null;

		this._editProfileBtn    = null;
		this._favoriteLoadoutBtn = null;
		this._tabAchievements   = null;
		this._tabBadges         = null;
		this._tabHistory        = null;
		this._profileCardEl     = null;
		this._statsGridEl       = null;
		this._loadoutPreviewEl  = null;
		this._tabContentEl      = null;

		super.dispose();

	}

}
