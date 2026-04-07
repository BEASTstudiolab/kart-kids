/**
 * Page07EventsView — Tournaments / Events Hub.
 *
 * Route: RouteIds.EVENTS ("/events")
 *
 * Layout:
 *   Row 1 — PageHeader: "KART KIDS EVENTS HUB"
 *   Row 2 — Wide Season Tour banner + Rewards panel (right)
 *   Row 3 — Tabs strip
 *   Row 4 — 4-column event grid (Tournaments | Live | Daily | Weekly) + Leaderboard sidebar
 *
 * Public API consumed by Page07EventsController:
 *   setFeaturedEvent(event)
 *   setRewards(rewards[])
 *   setLeaderboard(entries[])
 *   setEventList(events[])
 *   setActiveTab(tab)
 *   get featuredEnterBtn()
 *   get seasonTourBtn()
 *   get rewardsBtn()
 *   get leaderboardBtn()
 *   get tabTournaments()
 *   get tabLive()
 *   get tabDaily()
 *   get tabWeekly()
 *   get eventEnterBtns()
 */

import { PageViewBase } from '../../core/PageViewBase.js';
import { CTAButton }    from '../../components/CTAButton.js';
import { ButtonIds }    from '../../enums/ButtonIds.js';

export class Page07EventsView extends PageViewBase {

	constructor() {

		super( 'page-events' );

		/** @type {CTAButton} */
		this._featuredEnterBtn = null;

		/** @type {CTAButton} */
		this._seasonTourBtn = null;

		/** @type {CTAButton} */
		this._rewardsBtn = null;

		/** @type {CTAButton} */
		this._leaderboardBtn = null;

		/** @type {CTAButton} */
		this._tabTournaments = null;

		/** @type {CTAButton} */
		this._tabLive = null;

		/** @type {CTAButton} */
		this._tabDaily = null;

		/** @type {CTAButton} */
		this._tabWeekly = null;

		/** @type {CTAButton[]} */
		this._eventEnterBtns = [];

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page07EventsView._cssInjected ) return;
		Page07EventsView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root
			   ================================================================ */

			.page-events {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				padding: var(--space-4);
				min-height: calc(100vh - var(--topnav-height, 64px));
				box-sizing: border-box;
				background: var(--color-bg-base);
			}

			/* ================================================================
			   Header
			   ================================================================ */

			.page-events__header {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding-bottom: var(--space-3);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
			}

			.page-events__title {
				margin: 0;
				font-family: var(--font-display);
				font-size: var(--text-hero, 3rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-white);
				flex: 1;
			}

			.page-events__brand {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-black);
				color: var(--color-white);
				letter-spacing: var(--tracking-widest);
				padding: 6px 14px;
				background: var(--color-ink-800, #1a1a1a);
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-sm);
			}

			/* ================================================================
			   Season Tour banner + Rewards — top content row
			   ================================================================ */

			.page-events__top-row {
				display: grid;
				grid-template-columns: 1fr 220px;
				gap: var(--space-3);
			}

			.page-events__season-banner {
				display: grid;
				grid-template-columns: 260px 1fr auto;
				min-height: 160px;
				background: var(--color-ink-900, #111);
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				overflow: hidden;
				position: relative;
			}

			.page-events__season-info {
				display: flex;
				flex-direction: column;
				justify-content: flex-end;
				padding: var(--space-4);
				gap: var(--space-2);
				background: linear-gradient(to right, rgba(0,0,0,0.95) 60%, transparent);
				position: relative;
				z-index: 1;
			}

			.page-events__season-tag {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
			}

			.page-events__season-name {
				font-family: var(--font-display);
				font-size: var(--text-3xl, 2rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-white);
				line-height: 1.1;
				margin: 0;
			}

			.page-events__season-hero {
				position: relative;
				overflow: hidden;
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
			}

			.page-events__season-hero-placeholder {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-xs);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-600);
			}

			.page-events__season-timer {
				display: flex;
				flex-direction: column;
				align-items: flex-end;
				justify-content: flex-end;
				padding: var(--space-4);
				gap: var(--space-1);
			}

			.page-events__timer-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
			}

			.page-events__timer-value {
				font-family: var(--font-display);
				font-size: var(--text-2xl, 1.5rem);
				font-weight: var(--weight-black, 900);
				color: var(--color-cta-primary);
				letter-spacing: var(--tracking-wider);
				line-height: 1;
			}

			/* ================================================================
			   Rewards panel (right of banner)
			   ================================================================ */

			.page-events__rewards-panel {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-events__panel-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: var(--space-2);
			}

			.page-events__rewards-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-2);
				flex: 1;
			}

			.page-events__reward-item {
				aspect-ratio: 1;
				background: var(--color-ink-800, #1a1a1a);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-xs);
				color: var(--color-ink-500);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				text-align: center;
				padding: var(--space-1);
			}

			/* ================================================================
			   Tab strip
			   ================================================================ */

			.page-events__tabs {
				display: flex;
				gap: var(--space-1);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: 0;
			}

			.page-events__tab-btn {
				background: transparent;
				border: none;
				border-bottom: 3px solid transparent;
				padding: var(--space-2) var(--space-4);
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				cursor: pointer;
				transition:
					color var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard);
				margin-bottom: -1px;
			}

			.page-events__tab-btn:hover {
				color: var(--color-ink-200);
			}

			.page-events__tab-btn--active {
				color: var(--color-white);
				border-bottom-color: var(--color-cta-primary);
			}

			/* ================================================================
			   Main content row — event list + leaderboard
			   ================================================================ */

			.page-events__content-row {
				display: grid;
				grid-template-columns: 1fr 180px;
				gap: var(--space-3);
				flex: 1;
			}

			/* ================================================================
			   Event list — single column of event cards for the active tab
			   ================================================================ */

			.page-events__event-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-events__event-card {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.page-events__event-card:hover {
				border-color: var(--color-panel-border-strong);
			}

			.page-events__event-card--live {
				border-color: var(--color-error, #ef4444);
			}

			.page-events__event-card-content {
				flex: 1;
			}

			.page-events__event-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-events__event-timer {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				margin-top: 2px;
			}

			.page-events__event-live-badge {
				font-family: var(--font-ui);
				font-size: 10px;
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-error, #ef4444);
				background: rgba(239, 68, 68, 0.15);
				border: var(--border-thin) solid var(--color-error, #ef4444);
				border-radius: var(--radius-sm);
				padding: 2px 8px;
			}

			.page-events__event-reward {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-cta-primary);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				min-width: 80px;
				text-align: right;
			}

			.page-events__event-card .kk-cta-button {
				min-height: 36px;
				font-size: var(--text-xs);
				flex-shrink: 0;
			}

			/* ================================================================
			   Leaderboard sidebar
			   ================================================================ */

			.page-events__leaderboard {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				align-self: start;
			}

			.page-events__lb-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-events__lb-row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-1) 0;
			}

			.page-events__lb-rank {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-cta-primary);
				width: 20px;
				flex-shrink: 0;
				text-align: center;
			}

			.page-events__lb-avatar {
				width: 28px;
				height: 28px;
				border-radius: 50%;
				background: var(--color-ink-700, #2a2a2a);
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				color: var(--color-ink-400);
			}

			.page-events__lb-avatar svg {
				width: 16px;
				height: 16px;
			}

			.page-events__lb-name {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.page-events__leaderboard .kk-cta-button {
				width: 100%;
				min-height: 36px;
				font-size: var(--text-xs);
				margin-top: var(--space-1);
			}

			/* ================================================================
			   Responsive
			   ================================================================ */

			@media (max-width: 1100px) {
				.page-events__top-row {
					grid-template-columns: 1fr;
				}
				.page-events__season-banner {
					grid-template-columns: 200px 1fr auto;
				}
			}

			@media (max-width: 768px) {
				.page-events__content-row {
					grid-template-columns: 1fr;
				}
				.page-events__season-banner {
					grid-template-columns: 1fr;
					grid-template-rows: auto 120px auto;
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
		root.setAttribute( 'aria-label', 'Events Hub' );

		// --- Header ---
		const header = document.createElement( 'div' );
		header.className = 'page-events__header';

		const title = document.createElement( 'h1' );
		title.className = 'page-events__title';
		title.textContent = 'KART KIDS EVENTS HUB';
		header.appendChild( title );

		const brand = document.createElement( 'div' );
		brand.className = 'page-events__brand';
		brand.setAttribute( 'aria-hidden', 'true' );
		brand.textContent = 'BEASTSIDE';
		header.appendChild( brand );

		root.appendChild( header );

		// --- Top row: Season banner + Rewards ---
		const topRow = document.createElement( 'div' );
		topRow.className = 'page-events__top-row';

		// Season Tour banner
		const banner = document.createElement( 'div' );
		banner.className = 'page-events__season-banner';
		banner.setAttribute( 'aria-label', 'Season Tour featured event' );

		const seasonInfo = document.createElement( 'div' );
		seasonInfo.className = 'page-events__season-info';

		const seasonTag = document.createElement( 'div' );
		seasonTag.className = 'page-events__season-tag';
		seasonTag.textContent = 'SEASON TOUR';
		seasonInfo.appendChild( seasonTag );

		const seasonName = document.createElement( 'h2' );
		seasonName.className = 'page-events__season-name';
		seasonName.textContent = '—';
		seasonInfo.appendChild( seasonName );
		this._registerSection( 'seasonName', seasonName );

		this._featuredEnterBtn = new CTAButton( {
			label:    'ENTER EVENT',
			variant:  'primary',
			actionId: ButtonIds.EVENTS_ENTER_EVENT,
		} );
		seasonInfo.appendChild( this._featuredEnterBtn.el );
		banner.appendChild( seasonInfo );

		const heroArea = document.createElement( 'div' );
		heroArea.className = 'page-events__season-hero';
		heroArea.setAttribute( 'aria-hidden', 'true' );
		const heroPlaceholder = document.createElement( 'div' );
		heroPlaceholder.className = 'page-events__season-hero-placeholder';
		heroPlaceholder.textContent = 'SEASON ART';
		heroArea.appendChild( heroPlaceholder );
		banner.appendChild( heroArea );

		const timerArea = document.createElement( 'div' );
		timerArea.className = 'page-events__season-timer';
		const timerLabel = document.createElement( 'div' );
		timerLabel.className = 'page-events__timer-label';
		timerLabel.textContent = 'TIME REMAINING';
		timerArea.appendChild( timerLabel );
		const timerValue = document.createElement( 'div' );
		timerValue.className = 'page-events__timer-value';
		timerValue.textContent = '—';
		timerValue.setAttribute( 'aria-live', 'off' );
		timerArea.appendChild( timerValue );
		this._registerSection( 'timerValue', timerValue );

		this._seasonTourBtn = new CTAButton( {
			label:    'SEASON TOUR',
			variant:  'ghost',
			actionId: ButtonIds.EVENTS_SEASON_TOUR,
		} );
		timerArea.appendChild( this._seasonTourBtn.el );
		banner.appendChild( timerArea );
		topRow.appendChild( banner );

		// Rewards panel
		const rewardsPanel = document.createElement( 'div' );
		rewardsPanel.className = 'page-events__rewards-panel';

		const rewardsLabel = document.createElement( 'div' );
		rewardsLabel.className = 'page-events__panel-label';
		rewardsLabel.textContent = 'REWARDS';
		rewardsPanel.appendChild( rewardsLabel );

		const rewardsGrid = document.createElement( 'div' );
		rewardsGrid.className = 'page-events__rewards-grid';
		rewardsGrid.setAttribute( 'aria-label', 'Reward items' );
		rewardsPanel.appendChild( rewardsGrid );
		this._registerSection( 'rewardsGrid', rewardsGrid );

		this._rewardsBtn = new CTAButton( {
			label:    'VIEW REWARDS',
			variant:  'ghost',
			actionId: ButtonIds.EVENTS_REWARDS,
		} );
		rewardsPanel.appendChild( this._rewardsBtn.el );
		topRow.appendChild( rewardsPanel );
		root.appendChild( topRow );

		// --- Tabs strip ---
		const tabs = document.createElement( 'div' );
		tabs.className = 'page-events__tabs';
		tabs.setAttribute( 'role', 'tablist' );
		tabs.setAttribute( 'aria-label', 'Event categories' );

		const tabDefs = [
			{ key: 'tournaments', label: 'TOURNAMENTS', actionId: ButtonIds.EVENTS_TAB_LIVE },
			{ key: 'live',        label: 'LIVE EVENTS', actionId: ButtonIds.EVENTS_TAB_LIVE },
			{ key: 'daily',       label: 'DAILY EVENTS', actionId: ButtonIds.EVENTS_TAB_DAILY },
			{ key: 'weekly',      label: 'WEEKLY EVENTS', actionId: ButtonIds.EVENTS_TAB_WEEKLY },
		];

		const tabBtns = {};
		for ( const def of tabDefs ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'page-events__tab-btn';
			btn.dataset.action = def.actionId;
			btn.dataset.tab = def.key;
			btn.textContent = def.label;
			btn.setAttribute( 'role', 'tab' );
			btn.setAttribute( 'aria-selected', 'false' );
			tabs.appendChild( btn );
			tabBtns[ def.key ] = btn;

		}

		// Wrap tab buttons as CTAButton-compatible objects with .el getter.
		this._tabTournaments = { el: tabBtns.tournaments };
		this._tabLive        = { el: tabBtns.live };
		this._tabDaily       = { el: tabBtns.daily };
		this._tabWeekly      = { el: tabBtns.weekly };

		root.appendChild( tabs );
		this._registerSection( 'tabs', tabs );

		// --- Content row: event list + leaderboard ---
		const contentRow = document.createElement( 'div' );
		contentRow.className = 'page-events__content-row';

		const eventList = document.createElement( 'ul' );
		eventList.className = 'page-events__event-list';
		eventList.setAttribute( 'role', 'list' );
		eventList.setAttribute( 'aria-label', 'Events' );
		contentRow.appendChild( eventList );
		this._registerSection( 'eventList', eventList );

		// Leaderboard sidebar
		const leaderboard = document.createElement( 'div' );
		leaderboard.className = 'page-events__leaderboard';
		leaderboard.setAttribute( 'aria-label', 'Event leaderboard' );

		const lbLabel = document.createElement( 'div' );
		lbLabel.className = 'page-events__panel-label';
		lbLabel.textContent = 'LEADERBOARD';
		leaderboard.appendChild( lbLabel );

		const lbList = document.createElement( 'ul' );
		lbList.className = 'page-events__lb-list';
		lbList.setAttribute( 'role', 'list' );
		lbList.setAttribute( 'aria-label', 'Top players' );
		leaderboard.appendChild( lbList );
		this._registerSection( 'lbList', lbList );

		this._leaderboardBtn = new CTAButton( {
			label:    'FULL BOARD',
			variant:  'ghost',
			actionId: ButtonIds.EVENTS_LEADERBOARD,
		} );
		leaderboard.appendChild( this._leaderboardBtn.el );
		contentRow.appendChild( leaderboard );
		root.appendChild( contentRow );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		this._featuredEnterBtn?.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API — called by controller
	// ---------------------------------------------------------------------------

	/**
	 * @param {{id:string, name:string, season:number, timeRemaining:string, description:string}} event
	 */
	setFeaturedEvent( event ) {

		const nameEl = this.getSection( 'seasonName' );
		if ( nameEl ) nameEl.textContent = event.description ?? event.name;

		const timer = this.getSection( 'timerValue' );
		if ( timer ) timer.textContent = event.timeRemaining;

	}

	/**
	 * @param {Array<{label:string, icon:string}>} rewards
	 */
	setRewards( rewards ) {

		const grid = this.getSection( 'rewardsGrid' );
		if ( ! grid ) return;

		grid.innerHTML = '';

		for ( const r of rewards ) {

			const item = document.createElement( 'div' );
			item.className = 'page-events__reward-item';
			item.setAttribute( 'aria-label', r.label );
			item.textContent = r.label;
			grid.appendChild( item );

		}

	}

	/**
	 * @param {Array<{rank:number, name:string}>} entries
	 */
	setLeaderboard( entries ) {

		const list = this.getSection( 'lbList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const entry of entries ) {

			const li = document.createElement( 'li' );
			li.className = 'page-events__lb-row';
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `Rank ${entry.rank}: ${entry.name}` );

			const rank = document.createElement( 'div' );
			rank.className = 'page-events__lb-rank';
			rank.textContent = entry.rank;
			rank.setAttribute( 'aria-hidden', 'true' );
			li.appendChild( rank );

			const avatar = document.createElement( 'div' );
			avatar.className = 'page-events__lb-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
			li.appendChild( avatar );

			const name = document.createElement( 'div' );
			name.className = 'page-events__lb-name';
			name.textContent = entry.name;
			li.appendChild( name );

			list.appendChild( li );

		}

	}

	/**
	 * Render the active tab's event cards.
	 *
	 * @param {Array<{id:string, name:string, timeRemaining:string, reward:string, live?:boolean}>} events
	 */
	setEventList( events ) {

		const list = this.getSection( 'eventList' );
		if ( ! list ) return;

		list.innerHTML = '';
		this._eventEnterBtns = [];

		for ( const ev of events ) {

			const li = document.createElement( 'li' );
			li.className = `page-events__event-card${ev.live ? ' page-events__event-card--live' : ''}`;
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `Event: ${ev.name}` );

			const content = document.createElement( 'div' );
			content.className = 'page-events__event-card-content';

			const evName = document.createElement( 'div' );
			evName.className = 'page-events__event-name';
			evName.textContent = ev.name;
			content.appendChild( evName );

			const evTimer = document.createElement( 'div' );
			evTimer.className = 'page-events__event-timer';
			evTimer.textContent = `TIME REMAINING: ${ev.timeRemaining}`;
			content.appendChild( evTimer );
			li.appendChild( content );

			if ( ev.live ) {

				const liveBadge = document.createElement( 'div' );
				liveBadge.className = 'page-events__event-live-badge';
				liveBadge.textContent = 'STREAMING NOW';
				li.appendChild( liveBadge );

			}

			const reward = document.createElement( 'div' );
			reward.className = 'page-events__event-reward';
			reward.textContent = ev.reward;
			li.appendChild( reward );

			const enterBtn = new CTAButton( {
				label:     'ENTER EVENT',
				variant:   'secondary',
				actionId:  ButtonIds.EVENTS_ENTER_EVENT,
				ariaLabel: `Enter event: ${ev.name}`,
			} );
			enterBtn.el.dataset.eventId = ev.id;
			this._eventEnterBtns.push( enterBtn );
			li.appendChild( enterBtn.el );

			list.appendChild( li );

		}

	}

	/**
	 * Highlight the active tab button.
	 *
	 * @param {'tournaments'|'live'|'daily'|'weekly'} tab
	 */
	setActiveTab( tab ) {

		const tabsEl = this.getSection( 'tabs' );
		if ( ! tabsEl ) return;

		for ( const btn of tabsEl.querySelectorAll( '.page-events__tab-btn' ) ) {

			const isActive = btn.dataset.tab === tab;
			btn.classList.toggle( 'page-events__tab-btn--active', isActive );
			btn.setAttribute( 'aria-selected', String( isActive ) );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get featuredEnterBtn() { return this._featuredEnterBtn; }

	/** @returns {CTAButton} */
	get seasonTourBtn() { return this._seasonTourBtn; }

	/** @returns {CTAButton} */
	get rewardsBtn() { return this._rewardsBtn; }

	/** @returns {CTAButton} */
	get leaderboardBtn() { return this._leaderboardBtn; }

	/** @returns {{el: HTMLElement}} */
	get tabTournaments() { return this._tabTournaments; }

	/** @returns {{el: HTMLElement}} */
	get tabLive() { return this._tabLive; }

	/** @returns {{el: HTMLElement}} */
	get tabDaily() { return this._tabDaily; }

	/** @returns {{el: HTMLElement}} */
	get tabWeekly() { return this._tabWeekly; }

	/** @returns {CTAButton[]} */
	get eventEnterBtns() { return this._eventEnterBtns; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._featuredEnterBtn  = null;
		this._seasonTourBtn     = null;
		this._rewardsBtn        = null;
		this._leaderboardBtn    = null;
		this._tabTournaments    = null;
		this._tabLive           = null;
		this._tabDaily          = null;
		this._tabWeekly         = null;
		this._eventEnterBtns    = [];

		super.dispose();

	}

}

Page07EventsView._cssInjected = false;
