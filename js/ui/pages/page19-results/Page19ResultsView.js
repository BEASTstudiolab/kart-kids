/**
 * Page19ResultsView — Results / Post-Race Screen.
 *
 * Route: RouteIds.RESULTS ("/results")
 *
 * Layout: full-viewport, no scroll, no TopNav (TOPNAV_HIDDEN_ROUTES).
 * Background: hero cinematic image (placeholder gradient).
 *
 * Zones:
 *   header       — "RACE RESULTS" title + final position banner
 *   podium       — three-slot podium (1st centre/raised, 2nd left, 3rd right) + XP Gain panel
 *   left-panel   — Race Stats table
 *   right-panel  — Challenge Progress list + Rewards Earned panel
 *   action-bar   — REMATCH / NEXT RACE / RETURN TO LOBBY buttons
 *
 * Public API consumed by Page19ResultsController:
 *   setFinalPosition(position)
 *   setPodium(entries[])
 *   setXpGain(xp, fromLevel, toLevel, leveledUp)
 *   setRaceStats(stats)
 *   setRewardsEarned(rewards[])
 *   setChallengeProgress(challenges[])
 *   get rematchBtn()
 *   get nextRaceBtn()
 *   get returnToLobbyBtn()
 */

import { PageViewBase } from '../../core/PageViewBase.js';
import { CTAButton }    from '../../components/CTAButton.js';
import { ButtonIds }    from '../../enums/ButtonIds.js';

export class Page19ResultsView extends PageViewBase {

	constructor() {

		super( 'page-results' );

		/** @type {CTAButton} */
		this._rematchBtn = null;

		/** @type {CTAButton} */
		this._nextRaceBtn = null;

		/** @type {CTAButton} */
		this._returnToLobbyBtn = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page19ResultsView._cssInjected ) return;
		Page19ResultsView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.page-results {
				position: fixed;
				inset: 0;
				display: grid;
				grid-template-rows: auto 1fr auto auto;
				grid-template-columns: 280px 1fr 280px;
				grid-template-areas:
					"header  header  header"
					"stats   podium  challenges"
					"stats   rewards challenges"
					"actions actions actions";
				gap: var(--space-4);
				padding: var(--space-4);
				box-sizing: border-box;
				background: linear-gradient(
					160deg,
					rgba(10, 10, 20, 0.92) 0%,
					rgba(20, 10, 40, 0.88) 50%,
					rgba(10, 15, 30, 0.92) 100%
				);
				overflow: hidden;
			}

			/* -------------------------------------------------------
			   Header
			   ------------------------------------------------------- */

			.page-results__header {
				grid-area: header;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				padding-bottom: var(--space-2);
			}

			.page-results__title {
				margin: 0;
				font-family: var(--font-display);
				font-size: var(--text-hero-xl, 4rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-white);
				text-shadow: 0 2px 24px rgba(0, 0, 0, 0.6);
				line-height: 1;
			}

			.page-results__position-banner {
				font-family: var(--font-display);
				font-size: var(--text-3xl, 2.25rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-accent-yellow, #ffd600);
				text-shadow: 0 0 24px rgba(255, 214, 0, 0.4);
			}

			/* -------------------------------------------------------
			   Podium
			   ------------------------------------------------------- */

			.page-results__podium {
				grid-area: podium;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
			}

			.page-results__podium-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: var(--space-1);
				width: 100%;
				text-align: center;
			}

			.page-results__podium-slots {
				display: flex;
				align-items: flex-end;
				justify-content: center;
				gap: var(--space-4);
				width: 100%;
			}

			.page-results__podium-slot {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
			}

			/* 1st place slot is larger */
			.page-results__podium-slot--1st {
				order: 2;
			}

			.page-results__podium-slot--2nd {
				order: 1;
			}

			.page-results__podium-slot--3rd {
				order: 3;
			}

			.page-results__podium-avatar {
				border-radius: 50%;
				background: var(--color-ink-700, #333);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-400);
				flex-shrink: 0;
			}

			.page-results__podium-slot--1st .page-results__podium-avatar {
				width: 80px;
				height: 80px;
			}

			.page-results__podium-slot--2nd .page-results__podium-avatar,
			.page-results__podium-slot--3rd .page-results__podium-avatar {
				width: 56px;
				height: 56px;
			}

			.page-results__podium-avatar svg {
				opacity: 0.6;
			}

			.page-results__podium-slot--1st .page-results__podium-avatar svg {
				width: 40px;
				height: 40px;
			}

			.page-results__podium-slot--2nd .page-results__podium-avatar svg,
			.page-results__podium-slot--3rd .page-results__podium-avatar svg {
				width: 28px;
				height: 28px;
			}

			.page-results__podium-name {
				font-family: var(--font-display);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-white);
				text-align: center;
			}

			.page-results__podium-slot--1st .page-results__podium-name {
				font-size: var(--text-md);
			}

			.page-results__podium-slot--2nd .page-results__podium-name,
			.page-results__podium-slot--3rd .page-results__podium-name {
				font-size: var(--text-sm);
				opacity: 0.75;
			}

			.page-results__podium-place {
				font-family: var(--font-display);
				font-size: var(--text-hero, 2.5rem);
				font-weight: var(--weight-black, 900);
				line-height: 1;
			}

			.page-results__podium-slot--1st .page-results__podium-place {
				color: var(--color-cta-primary);
				font-size: var(--text-hero-xl, 4rem);
			}

			.page-results__podium-slot--2nd .page-results__podium-place {
				color: var(--color-ink-300, #c0c0c0);
			}

			.page-results__podium-slot--3rd .page-results__podium-place {
				color: var(--color-ink-400, #a0700a);
			}

			.page-results__podium-block {
				background: var(--color-panel-bg, rgba(255,255,255,0.06));
				border: var(--border-base) solid var(--color-panel-border);
				border-top-left-radius: var(--radius-sm);
				border-top-right-radius: var(--radius-sm);
				width: 80px;
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-400);
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
			}

			.page-results__podium-slot--1st .page-results__podium-block {
				width: 100px;
				height: 60px;
			}

			.page-results__podium-slot--2nd .page-results__podium-block {
				width: 80px;
				height: 40px;
			}

			.page-results__podium-slot--3rd .page-results__podium-block {
				width: 80px;
				height: 28px;
			}

			/* XP Gain panel inside podium column */

			.page-results__xp-panel {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				width: 100%;
				text-align: center;
			}

			.page-results__xp-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				margin-bottom: var(--space-1);
			}

			.page-results__xp-total {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				color: var(--color-cta-primary);
			}

			.page-results__xp-level {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
				margin-top: var(--space-1);
			}

			.page-results__xp-levelup {
				margin-top: var(--space-1);
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-cta-primary);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			/* -------------------------------------------------------
			   Left — Race Stats
			   ------------------------------------------------------- */

			.page-results__stats {
				grid-area: stats;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				align-self: start;
			}

			.page-results__panel-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: var(--space-2);
				margin-bottom: var(--space-1);
			}

			.page-results__stats-table {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-results__stat-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: var(--space-4);
			}

			.page-results__stat-key {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-400);
			}

			.page-results__stat-value {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			/* -------------------------------------------------------
			   Right — Challenges + Rewards
			   ------------------------------------------------------- */

			.page-results__challenges {
				grid-area: challenges;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				align-self: start;
			}

			.page-results__challenge-list {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				list-style: none;
				margin: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-results__challenge-item {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-results__challenge-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}

			.page-results__challenge-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-results__challenge-progress-text {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
			}

			.page-results__challenge-bar {
				height: 4px;
				background: var(--color-ink-700, #333);
				border-radius: 2px;
				overflow: hidden;
			}

			.page-results__challenge-bar-fill {
				height: 100%;
				background: var(--color-cta-primary);
				border-radius: 2px;
				transition: width var(--duration-slow) var(--ease-standard);
			}

			.page-results__challenge-bar-fill--complete {
				background: var(--color-success, #22c55e);
			}

			/* Rewards panel */

			.page-results__rewards {
				grid-area: rewards;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				align-self: start;
			}

			.page-results__rewards-panel {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-results__reward-item {
				display: flex;
				align-items: flex-start;
				gap: var(--space-3);
			}

			.page-results__reward-icon {
				width: 36px;
				height: 36px;
				flex-shrink: 0;
				background: var(--color-ink-700, #333);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-lg);
				color: var(--color-ink-400);
			}

			.page-results__reward-text {
				flex: 1;
			}

			.page-results__reward-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			.page-results__reward-desc {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				margin-top: 2px;
			}

			/* -------------------------------------------------------
			   Action bar
			   ------------------------------------------------------- */

			.page-results__actions {
				grid-area: actions;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: var(--space-4);
				padding-top: var(--space-2);
			}

			/* -------------------------------------------------------
			   Responsive
			   ------------------------------------------------------- */

			@media (max-width: 1024px) {
				.page-results {
					position: static;
					grid-template-columns: 1fr 1fr;
					grid-template-rows: auto auto auto auto auto;
					grid-template-areas:
						"header  header"
						"podium  podium"
						"stats   challenges"
						"rewards rewards"
						"actions actions";
					overflow-y: auto;
					min-height: 100vh;
				}
			}

			@media (max-width: 640px) {
				.page-results {
					grid-template-columns: 1fr;
					grid-template-areas:
						"header"
						"podium"
						"stats"
						"challenges"
						"rewards"
						"actions";
				}

				.page-results__title {
					font-size: var(--text-hero, 2.5rem);
				}

				.page-results__actions {
					flex-direction: column;
					gap: var(--space-2);
				}

				.page-results__actions .kk-cta-button {
					width: 100%;
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
		root.setAttribute( 'aria-label', 'Race Results' );

		// --- Header ---
		const header = document.createElement( 'div' );
		header.className = 'page-results__header';

		const title = document.createElement( 'h1' );
		title.className = 'page-results__title';
		title.textContent = 'RACE RESULTS';
		header.appendChild( title );

		const positionBanner = document.createElement( 'div' );
		positionBanner.className = 'page-results__position-banner';
		positionBanner.setAttribute( 'aria-live', 'polite' );
		positionBanner.textContent = 'FINAL POSITION: —';
		header.appendChild( positionBanner );
		root.appendChild( header );
		this._registerSection( 'positionBanner', positionBanner );

		// --- Podium ---
		const podiumWrap = document.createElement( 'div' );
		podiumWrap.className = 'page-results__podium';

		const podiumLabel = document.createElement( 'div' );
		podiumLabel.className = 'page-results__podium-label';
		podiumLabel.textContent = 'PODIUM';
		podiumWrap.appendChild( podiumLabel );

		const podiumSlots = document.createElement( 'div' );
		podiumSlots.className = 'page-results__podium-slots';
		podiumSlots.setAttribute( 'role', 'list' );
		podiumSlots.setAttribute( 'aria-label', 'Podium standings' );
		podiumWrap.appendChild( podiumSlots );
		this._registerSection( 'podiumSlots', podiumSlots );

		const xpPanel = document.createElement( 'div' );
		xpPanel.className = 'page-results__xp-panel';
		xpPanel.setAttribute( 'aria-live', 'polite' );
		xpPanel.setAttribute( 'aria-atomic', 'true' );

		const xpLabel = document.createElement( 'div' );
		xpLabel.className = 'page-results__xp-label';
		xpLabel.textContent = 'XP GAIN';
		xpPanel.appendChild( xpLabel );

		const xpTotal = document.createElement( 'div' );
		xpTotal.className = 'page-results__xp-total';
		xpTotal.textContent = '+0';
		xpPanel.appendChild( xpTotal );

		const xpLevel = document.createElement( 'div' );
		xpLevel.className = 'page-results__xp-level';
		xpLevel.textContent = '';
		xpPanel.appendChild( xpLevel );

		const xpLevelUp = document.createElement( 'div' );
		xpLevelUp.className = 'page-results__xp-levelup';
		xpLevelUp.hidden = true;
		xpLevelUp.textContent = 'LEVEL UP!';
		xpPanel.appendChild( xpLevelUp );
		podiumWrap.appendChild( xpPanel );
		root.appendChild( podiumWrap );
		this._registerSection( 'xpTotal', xpTotal );
		this._registerSection( 'xpLevel', xpLevel );
		this._registerSection( 'xpLevelUp', xpLevelUp );

		// --- Race Stats (left panel) ---
		const statsWrap = document.createElement( 'div' );
		statsWrap.className = 'page-results__stats';

		const statsLabel = document.createElement( 'div' );
		statsLabel.className = 'page-results__panel-label';
		statsLabel.textContent = 'RACE STATS';
		statsWrap.appendChild( statsLabel );

		const statsTable = document.createElement( 'div' );
		statsTable.className = 'page-results__stats-table';
		statsTable.setAttribute( 'aria-label', 'Race statistics' );
		statsWrap.appendChild( statsTable );
		root.appendChild( statsWrap );
		this._registerSection( 'statsTable', statsTable );

		// --- Challenge Progress (right panel, top) ---
		const challengesWrap = document.createElement( 'div' );
		challengesWrap.className = 'page-results__challenges';

		const challengesLabel = document.createElement( 'div' );
		challengesLabel.className = 'page-results__panel-label';
		challengesLabel.textContent = 'CHALLENGE PROGRESS';
		challengesWrap.appendChild( challengesLabel );

		const challengeList = document.createElement( 'ul' );
		challengeList.className = 'page-results__challenge-list';
		challengeList.setAttribute( 'role', 'list' );
		challengeList.setAttribute( 'aria-label', 'Challenge progress' );
		challengesWrap.appendChild( challengeList );
		root.appendChild( challengesWrap );
		this._registerSection( 'challengeList', challengeList );

		// --- Rewards Earned (right panel, bottom) ---
		const rewardsWrap = document.createElement( 'div' );
		rewardsWrap.className = 'page-results__rewards';

		const rewardsLabel = document.createElement( 'div' );
		rewardsLabel.className = 'page-results__panel-label';
		rewardsLabel.textContent = 'REWARDS EARNED';
		rewardsWrap.appendChild( rewardsLabel );

		const rewardsPanel = document.createElement( 'div' );
		rewardsPanel.className = 'page-results__rewards-panel';
		rewardsPanel.setAttribute( 'aria-label', 'Rewards earned this race' );
		rewardsWrap.appendChild( rewardsPanel );
		root.appendChild( rewardsWrap );
		this._registerSection( 'rewardsPanel', rewardsPanel );

		// --- Action bar ---
		const actions = document.createElement( 'div' );
		actions.className = 'page-results__actions';
		actions.setAttribute( 'role', 'group' );
		actions.setAttribute( 'aria-label', 'Post-race actions' );

		this._rematchBtn = new CTAButton( {
			label:    'REMATCH',
			variant:  'secondary',
			actionId: ButtonIds.RESULTS_REMATCH,
		} );

		this._nextRaceBtn = new CTAButton( {
			label:    'NEXT RACE',
			variant:  'primary',
			actionId: ButtonIds.RESULTS_NEXT_RACE,
		} );

		this._returnToLobbyBtn = new CTAButton( {
			label:    'RETURN TO LOBBY',
			variant:  'ghost',
			actionId: ButtonIds.RESULTS_RETURN_TO_LOBBY,
		} );

		actions.appendChild( this._rematchBtn.el );
		actions.appendChild( this._nextRaceBtn.el );
		actions.appendChild( this._returnToLobbyBtn.el );
		root.appendChild( actions );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus NEXT RACE as the primary forward action.
		this._nextRaceBtn?.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Set the final position banner text.
	 *
	 * @param {number} position  Finishing position (1, 2, 3, …).
	 */
	setFinalPosition( position ) {

		const el = this.getSection( 'positionBanner' );
		if ( ! el ) return;

		const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
		el.textContent = `FINAL POSITION: ${position}${suffix} PLACE!`;
		el.setAttribute( 'aria-label', `Final position: ${position}${suffix} place` );

	}

	/**
	 * Render the three podium slots.
	 *
	 * @param {Array<{position:number, name:string}>} entries  Sorted 1st → 3rd.
	 */
	setPodium( entries ) {

		const container = this.getSection( 'podiumSlots' );
		if ( ! container ) return;

		container.innerHTML = '';

		const placeLabels = { 1: '1st', 2: '2nd', 3: '3rd' };
		const heights     = { 1: 60, 2: 40, 3: 28 };

		for ( const entry of entries ) {

			const slot = document.createElement( 'div' );
			slot.className = `page-results__podium-slot page-results__podium-slot--${placeLabels[ entry.position ]}`;
			slot.setAttribute( 'role', 'listitem' );
			slot.setAttribute( 'aria-label', `${placeLabels[ entry.position ]} place: ${entry.name}` );

			const avatar = document.createElement( 'div' );
			avatar.className = 'page-results__podium-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			const sz = entry.position === 1 ? 40 : 28;
			avatar.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
			slot.appendChild( avatar );

			const name = document.createElement( 'div' );
			name.className = 'page-results__podium-name';
			name.textContent = entry.name;
			slot.appendChild( name );

			const placeEl = document.createElement( 'div' );
			placeEl.className = 'page-results__podium-place';
			placeEl.setAttribute( 'aria-hidden', 'true' );
			placeEl.textContent = entry.position;
			slot.appendChild( placeEl );

			const block = document.createElement( 'div' );
			block.className = 'page-results__podium-block';
			block.style.height = `${heights[ entry.position ] ?? 28}px`;
			block.setAttribute( 'aria-hidden', 'true' );
			slot.appendChild( block );

			container.appendChild( slot );

		}

	}

	/**
	 * Set XP gain panel content.
	 *
	 * @param {number}  xp          XP earned this race.
	 * @param {number}  fromLevel   Level before the race.
	 * @param {number}  toLevel     Level after the race.
	 * @param {boolean} leveledUp   Whether the player leveled up.
	 */
	setXpGain( xp, fromLevel, toLevel, leveledUp ) {

		const totalEl   = this.getSection( 'xpTotal' );
		const levelEl   = this.getSection( 'xpLevel' );
		const levelUpEl = this.getSection( 'xpLevelUp' );

		if ( totalEl )   totalEl.textContent   = `Total XP: +${xp}`;
		if ( levelEl )   levelEl.textContent   = `Level ${fromLevel} → Level ${toLevel}`;
		if ( levelUpEl ) levelUpEl.hidden       = ! leveledUp;

	}

	/**
	 * Render the race stats table.
	 *
	 * @param {Array<{label:string, value:string}>} stats
	 */
	setRaceStats( stats ) {

		const table = this.getSection( 'statsTable' );
		if ( ! table ) return;

		table.innerHTML = '';

		for ( const s of stats ) {

			const row = document.createElement( 'div' );
			row.className = 'page-results__stat-row';

			const key = document.createElement( 'span' );
			key.className = 'page-results__stat-key';
			key.textContent = s.label;
			row.appendChild( key );

			const val = document.createElement( 'span' );
			val.className = 'page-results__stat-value';
			val.textContent = s.value;
			row.appendChild( val );

			table.appendChild( row );

		}

	}

	/**
	 * Render the rewards earned panel.
	 *
	 * @param {Array<{name:string, desc:string}>} rewards
	 */
	setRewardsEarned( rewards ) {

		const panel = this.getSection( 'rewardsPanel' );
		if ( ! panel ) return;

		panel.innerHTML = '';

		for ( const reward of rewards ) {

			const item = document.createElement( 'div' );
			item.className = 'page-results__reward-item';

			const icon = document.createElement( 'div' );
			icon.className = 'page-results__reward-icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.textContent = '';
			item.appendChild( icon );

			const text = document.createElement( 'div' );
			text.className = 'page-results__reward-text';

			const name = document.createElement( 'div' );
			name.className = 'page-results__reward-name';
			name.textContent = reward.name;
			text.appendChild( name );

			if ( reward.desc ) {

				const desc = document.createElement( 'div' );
				desc.className = 'page-results__reward-desc';
				desc.textContent = reward.desc;
				text.appendChild( desc );

			}

			item.appendChild( text );
			panel.appendChild( item );

		}

	}

	/**
	 * Render the challenge progress list.
	 *
	 * @param {Array<{title:string, progress:number, target:number, claimed:boolean}>} challenges
	 */
	setChallengeProgress( challenges ) {

		const list = this.getSection( 'challengeList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const ch of challenges ) {

			const pct      = Math.min( 1, ch.progress / ch.target );
			const complete = ch.progress >= ch.target;

			const li = document.createElement( 'li' );
			li.className = 'page-results__challenge-item';
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `${ch.title}: ${ch.progress} of ${ch.target}${complete ? ' — complete' : ''}` );

			const hdr = document.createElement( 'div' );
			hdr.className = 'page-results__challenge-header';

			const nameEl = document.createElement( 'span' );
			nameEl.className = 'page-results__challenge-name';
			nameEl.textContent = ch.title;
			hdr.appendChild( nameEl );

			const progressText = document.createElement( 'span' );
			progressText.className = 'page-results__challenge-progress-text';
			progressText.textContent = complete ? 'COMPLETE' : `${ch.progress}/${ch.target}`;
			hdr.appendChild( progressText );
			li.appendChild( hdr );

			const bar = document.createElement( 'div' );
			bar.className = 'page-results__challenge-bar';
			bar.setAttribute( 'role', 'progressbar' );
			bar.setAttribute( 'aria-valuenow', String( ch.progress ) );
			bar.setAttribute( 'aria-valuemin', '0' );
			bar.setAttribute( 'aria-valuemax', String( ch.target ) );
			bar.setAttribute( 'aria-label', `${ch.title} progress` );

			const fill = document.createElement( 'div' );
			fill.className = `page-results__challenge-bar-fill${complete ? ' page-results__challenge-bar-fill--complete' : ''}`;
			fill.style.width = `${Math.round( pct * 100 )}%`;
			bar.appendChild( fill );
			li.appendChild( bar );

			list.appendChild( li );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get rematchBtn() { return this._rematchBtn; }

	/** @returns {CTAButton} */
	get nextRaceBtn() { return this._nextRaceBtn; }

	/** @returns {CTAButton} */
	get returnToLobbyBtn() { return this._returnToLobbyBtn; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._rematchBtn       = null;
		this._nextRaceBtn      = null;
		this._returnToLobbyBtn = null;

		super.dispose();

	}

}

Page19ResultsView._cssInjected = false;
