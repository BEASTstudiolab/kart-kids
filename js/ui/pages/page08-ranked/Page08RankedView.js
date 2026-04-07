/**
 * Page08RankedView — Ranked / Competitive.
 *
 * Route: RouteIds.RANKED ("/ranked")
 *
 * Layout: 3-column grid.
 *   Left   — "KART KIDS RANKED" title + character preview + rank badge +
 *             prestige points bar + QUEUE RANKED CTA + Season Progress
 *   Center — Leaderboard table (5 rows) + Arena label
 *   Right  — Tier Rewards panel + Match History panel + Rank Rules panel
 *
 * Public API consumed by Page08RankedController:
 *   setCurrentRank({tier, division, points, pointsMax, playerName})
 *   setSeasonProgress({seasonName, progress, milestones[]})
 *   setLeaderboard(entries[])
 *   setTierRewards(rewards[])
 *   setMatchHistory(matches[])
 *   setRankRules(rules[])
 *   get queueBtn()
 *   get matchHistoryBtn()
 *   get tierRewardsBtn()
 *   get leaderboardBtn()
 *   get rankRulesBtn()
 */

import { PageViewBase } from '../../core/PageViewBase.js';
import { CTAButton }    from '../../components/CTAButton.js';
import { ButtonIds }    from '../../enums/ButtonIds.js';

export class Page08RankedView extends PageViewBase {

	constructor() {

		super( 'page-ranked' );

		/** @type {CTAButton} */
		this._queueBtn = null;

		/** @type {CTAButton} */
		this._matchHistoryBtn = null;

		/** @type {CTAButton} */
		this._tierRewardsBtn = null;

		/** @type {CTAButton} */
		this._leaderboardBtn = null;

		/** @type {CTAButton} */
		this._rankRulesBtn = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page08RankedView._cssInjected ) return;
		Page08RankedView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root — 3-column grid
			   ================================================================ */

			.page-ranked {
				display: grid;
				grid-template-columns: 260px 1fr 260px;
				gap: var(--space-4);
				padding: var(--space-4);
				min-height: calc(100vh - var(--topnav-height, 64px));
				box-sizing: border-box;
				background: var(--color-bg-base);
				/* subtle radial glow from top-left to match mockup */
				background-image: radial-gradient(
					ellipse 600px 500px at -100px 60%,
					rgba(0, 140, 255, 0.08) 0%,
					transparent 70%
				);
			}

			/* ================================================================
			   Shared panel primitives
			   ================================================================ */

			.page-ranked__panel {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-ranked__panel-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: var(--space-2);
			}

			/* ================================================================
			   Left column
			   ================================================================ */

			.page-ranked__left {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* Title block */
			.page-ranked__title-block {
				display: flex;
				flex-direction: column;
				gap: 0;
			}

			.page-ranked__brand {
				font-family: var(--font-display);
				font-size: var(--text-2xl, 1.5rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-white);
				line-height: 1;
				margin: 0;
			}

			.page-ranked__title {
				font-family: var(--font-display);
				font-size: var(--text-hero, 3rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-white);
				line-height: 1;
				margin: 0;
			}

			/* Rank block */
			.page-ranked__rank-block {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
			}

			.page-ranked__char-preview {
				width: 100%;
				aspect-ratio: 3 / 4;
				background: var(--color-ink-800, #1a1a1a);
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				display: flex;
				align-items: center;
				justify-content: center;
				overflow: hidden;
				position: relative;
			}

			.page-ranked__char-preview-placeholder {
				color: var(--color-ink-500);
				font-size: var(--text-xs);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				position: absolute;
			}

			/* Rank badge */
			.page-ranked__rank-badge {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-1);
				padding: var(--space-2) var(--space-4);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				width: 100%;
				box-sizing: border-box;
			}

			.page-ranked__rank-tier {
				font-family: var(--font-display);
				font-size: var(--text-xl, 1.25rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-cta-primary);
			}

			.page-ranked__rank-division {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* Points / prestige bar */
			.page-ranked__prestige {
				width: 100%;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-ranked__prestige-row {
				display: flex;
				justify-content: space-between;
				align-items: baseline;
			}

			.page-ranked__prestige-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
			}

			.page-ranked__prestige-value {
				font-family: var(--font-display);
				font-size: var(--text-md);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			.page-ranked__prestige-bar-track {
				height: 6px;
				background: var(--color-ink-700, #2a2a2a);
				border-radius: 3px;
				overflow: hidden;
			}

			.page-ranked__prestige-bar-fill {
				height: 100%;
				background: var(--color-cta-primary);
				border-radius: 3px;
				transition: width var(--duration-base) var(--ease-standard);
			}

			.page-ranked__prestige-scale {
				display: flex;
				justify-content: space-between;
				font-family: var(--font-ui);
				font-size: 10px;
				color: var(--color-ink-500);
			}

			/* CTA */
			.page-ranked__queue-wrap .kk-cta-button {
				width: 100%;
				min-height: 52px;
				font-size: var(--text-md);
				letter-spacing: var(--tracking-widest);
			}

			/* ================================================================
			   Season progress
			   ================================================================ */

			.page-ranked__season-progress {
				width: 100%;
			}

			.page-ranked__season-name {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				margin-bottom: var(--space-2);
			}

			.page-ranked__season-bar-track {
				height: 20px;
				background: var(--color-ink-800, #1a1a1a);
				border-radius: var(--radius-sm);
				overflow: hidden;
				position: relative;
			}

			.page-ranked__season-bar-fill {
				height: 100%;
				background: linear-gradient(90deg, var(--color-cta-primary) 0%, #ffcc00 100%);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: flex-end;
				padding-right: var(--space-2);
				transition: width var(--duration-slow) var(--ease-standard);
			}

			.page-ranked__season-pct {
				font-family: var(--font-display);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			.page-ranked__season-milestones {
				display: flex;
				justify-content: space-between;
				margin-top: var(--space-1);
			}

			.page-ranked__season-milestone {
				font-family: var(--font-ui);
				font-size: 10px;
				color: var(--color-ink-500);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			/* ================================================================
			   Center column
			   ================================================================ */

			.page-ranked__center {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* Leaderboard table */
			.page-ranked__lb-table {
				width: 100%;
				border-collapse: collapse;
				font-family: var(--font-ui);
			}

			.page-ranked__lb-table th {
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				text-align: left;
				padding: var(--space-1) var(--space-2);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
			}

			.page-ranked__lb-table td {
				font-size: var(--text-xs);
				color: var(--color-ink-200);
				padding: var(--space-2);
				border-bottom: var(--border-thin) solid rgba(255,255,255,0.04);
				vertical-align: middle;
			}

			.page-ranked__lb-table tr:last-child td {
				border-bottom: none;
			}

			.page-ranked__lb-pos {
				font-family: var(--font-display);
				font-weight: var(--weight-bold);
				color: var(--color-cta-primary);
				width: 28px;
			}

			.page-ranked__lb-player {
				display: flex;
				align-items: center;
				gap: var(--space-2);
			}

			.page-ranked__lb-avatar {
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

			.page-ranked__lb-avatar svg {
				width: 16px;
				height: 16px;
			}

			.page-ranked__lb-pts {
				font-family: var(--font-display);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			/* Arena label */
			.page-ranked__arena-label {
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-ink-400);
				text-align: center;
				padding: var(--space-2) 0;
			}

			/* ================================================================
			   Right column
			   ================================================================ */

			.page-ranked__right {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* Tier rewards */
			.page-ranked__tier-rewards {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-ranked__tier-reward-row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-2);
				background: var(--color-ink-800, #1a1a1a);
				border-radius: var(--radius-sm);
			}

			.page-ranked__tier-reward-icon {
				width: 36px;
				height: 36px;
				background: var(--color-ink-700, #2a2a2a);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				font-size: var(--text-xs);
				color: var(--color-ink-500);
			}

			.page-ranked__tier-reward-info {
				flex: 1;
			}

			.page-ranked__tier-reward-tier {
				font-family: var(--font-ui);
				font-size: 10px;
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-cta-primary);
			}

			.page-ranked__tier-reward-item {
				font-family: var(--font-display);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-ranked__tier-reward-locked {
				font-size: var(--text-xs);
				color: var(--color-ink-500);
			}

			/* Match history */
			.page-ranked__match-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-ranked__match-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				padding: var(--space-1) 0;
				border-bottom: var(--border-thin) solid rgba(255,255,255,0.04);
			}

			.page-ranked__match-row:last-child {
				border-bottom: none;
			}

			.page-ranked__match-date {
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-ranked__match-result {
				color: var(--color-ink-200);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
			}

			.page-ranked__match-prestige {
				color: var(--color-success, #22c55e);
				font-weight: var(--weight-bold);
			}

			.page-ranked__match-prestige--negative {
				color: var(--color-error, #ef4444);
			}

			/* Rank rules */
			.page-ranked__rules-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-ranked__rules-list li {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				line-height: 1.5;
				display: flex;
				gap: var(--space-2);
			}

			.page-ranked__rules-list li::before {
				content: '';
				display: inline-block;
				width: 5px;
				height: 5px;
				border-radius: 50%;
				background: var(--color-cta-primary);
				flex-shrink: 0;
				margin-top: 5px;
			}

			/* ================================================================
			   Responsive
			   ================================================================ */

			@media (max-width: 1100px) {
				.page-ranked {
					grid-template-columns: 220px 1fr 220px;
				}
			}

			@media (max-width: 800px) {
				.page-ranked {
					grid-template-columns: 1fr 1fr;
					grid-template-areas:
						"left center"
						"right right";
				}
				.page-ranked__left  { grid-area: left; }
				.page-ranked__center { grid-area: center; }
				.page-ranked__right { grid-area: right; }
			}

			@media (max-width: 560px) {
				.page-ranked {
					grid-template-columns: 1fr;
					grid-template-areas:
						"left"
						"center"
						"right";
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
		root.setAttribute( 'aria-label', 'Ranked Competitive' );

		// ── Left column ──────────────────────────────────────────────────────────
		const left = document.createElement( 'div' );
		left.className = 'page-ranked__left';

		// Title
		const titleBlock = document.createElement( 'div' );
		titleBlock.className = 'page-ranked__title-block';

		const brand = document.createElement( 'p' );
		brand.className = 'page-ranked__brand';
		brand.textContent = 'KART KIDS';
		titleBlock.appendChild( brand );

		const title = document.createElement( 'h1' );
		title.className = 'page-ranked__title';
		title.textContent = 'RANKED';
		titleBlock.appendChild( title );
		left.appendChild( titleBlock );

		// Rank block
		const rankBlock = document.createElement( 'div' );
		rankBlock.className = 'page-ranked__rank-block';

		const charPreview = document.createElement( 'div' );
		charPreview.className = 'page-ranked__char-preview';
		charPreview.setAttribute( 'aria-hidden', 'true' );
		const charPlaceholder = document.createElement( 'div' );
		charPlaceholder.className = 'page-ranked__char-preview-placeholder';
		charPlaceholder.textContent = 'CHARACTER';
		charPreview.appendChild( charPlaceholder );
		rankBlock.appendChild( charPreview );

		const rankBadge = document.createElement( 'div' );
		rankBadge.className = 'page-ranked__rank-badge';
		rankBadge.setAttribute( 'aria-label', 'Current rank' );

		const tierLabel = document.createElement( 'div' );
		tierLabel.className = 'page-ranked__rank-tier';
		tierLabel.textContent = '—';
		rankBadge.appendChild( tierLabel );
		this._registerSection( 'rankTier', tierLabel );

		const divisionLabel = document.createElement( 'div' );
		divisionLabel.className = 'page-ranked__rank-division';
		divisionLabel.textContent = 'DIVISION: —';
		rankBadge.appendChild( divisionLabel );
		this._registerSection( 'rankDivision', divisionLabel );
		rankBlock.appendChild( rankBadge );

		// Prestige bar
		const prestige = document.createElement( 'div' );
		prestige.className = 'page-ranked__prestige';

		const prestigeRow = document.createElement( 'div' );
		prestigeRow.className = 'page-ranked__prestige-row';

		const prestigeLabel = document.createElement( 'div' );
		prestigeLabel.className = 'page-ranked__prestige-label';
		prestigeLabel.textContent = 'PRESTIGE POINTS';
		prestigeRow.appendChild( prestigeLabel );

		const prestigeValue = document.createElement( 'div' );
		prestigeValue.className = 'page-ranked__prestige-value';
		prestigeValue.textContent = '—';
		prestigeRow.appendChild( prestigeValue );
		this._registerSection( 'prestigeValue', prestigeValue );
		prestige.appendChild( prestigeRow );

		const barTrack = document.createElement( 'div' );
		barTrack.className = 'page-ranked__prestige-bar-track';
		const barFill = document.createElement( 'div' );
		barFill.className = 'page-ranked__prestige-bar-fill';
		barFill.style.width = '0%';
		barTrack.appendChild( barFill );
		prestige.appendChild( barTrack );
		this._registerSection( 'prestigeBarFill', barFill );

		const scale = document.createElement( 'div' );
		scale.className = 'page-ranked__prestige-scale';
		for ( const v of [ '0', '15', '30', '50', '100' ] ) {

			const s = document.createElement( 'span' );
			s.textContent = v;
			scale.appendChild( s );

		}
		prestige.appendChild( scale );
		rankBlock.appendChild( prestige );
		left.appendChild( rankBlock );

		// QUEUE RANKED CTA
		const queueWrap = document.createElement( 'div' );
		queueWrap.className = 'page-ranked__queue-wrap';
		this._queueBtn = new CTAButton( {
			label:    'QUEUE RANKED',
			variant:  'primary',
			actionId: ButtonIds.RANKED_QUEUE,
		} );
		queueWrap.appendChild( this._queueBtn.el );
		left.appendChild( queueWrap );

		// Season Progress (inside left column per mockup layout)
		const seasonSection = document.createElement( 'div' );
		seasonSection.className = 'page-ranked__panel page-ranked__season-progress';

		const seasonPanelLabel = document.createElement( 'div' );
		seasonPanelLabel.className = 'page-ranked__panel-label';
		seasonPanelLabel.textContent = 'SEASON PROGRESS';
		seasonSection.appendChild( seasonPanelLabel );

		const seasonName = document.createElement( 'div' );
		seasonName.className = 'page-ranked__season-name';
		seasonName.textContent = '—';
		seasonSection.appendChild( seasonName );
		this._registerSection( 'seasonName', seasonName );

		const seasonBarTrack = document.createElement( 'div' );
		seasonBarTrack.className = 'page-ranked__season-bar-track';
		const seasonBarFill = document.createElement( 'div' );
		seasonBarFill.className = 'page-ranked__season-bar-fill';
		seasonBarFill.style.width = '0%';
		const seasonPct = document.createElement( 'span' );
		seasonPct.className = 'page-ranked__season-pct';
		seasonPct.textContent = '0%';
		seasonBarFill.appendChild( seasonPct );
		seasonBarTrack.appendChild( seasonBarFill );
		seasonSection.appendChild( seasonBarTrack );
		this._registerSection( 'seasonBarFill', seasonBarFill );
		this._registerSection( 'seasonPct', seasonPct );

		const milestones = document.createElement( 'div' );
		milestones.className = 'page-ranked__season-milestones';
		milestones.setAttribute( 'aria-hidden', 'true' );
		seasonSection.appendChild( milestones );
		this._registerSection( 'seasonMilestones', milestones );
		left.appendChild( seasonSection );
		root.appendChild( left );

		// ── Center column ─────────────────────────────────────────────────────────
		const center = document.createElement( 'div' );
		center.className = 'page-ranked__center';

		const lbPanel = document.createElement( 'div' );
		lbPanel.className = 'page-ranked__panel';
		lbPanel.setAttribute( 'aria-label', 'Ranked leaderboard' );

		const lbPanelLabel = document.createElement( 'div' );
		lbPanelLabel.className = 'page-ranked__panel-label';
		lbPanelLabel.style.display = 'flex';
		lbPanelLabel.style.justifyContent = 'space-between';
		lbPanelLabel.style.alignItems = 'center';

		const lbTitle = document.createElement( 'span' );
		lbTitle.textContent = 'LEADERBOARD';
		lbPanelLabel.appendChild( lbTitle );

		this._leaderboardBtn = new CTAButton( {
			label:    'FULL BOARD',
			variant:  'ghost',
			actionId: ButtonIds.RANKED_LEADERBOARD,
		} );
		lbPanelLabel.appendChild( this._leaderboardBtn.el );
		lbPanel.appendChild( lbPanelLabel );

		const lbTable = document.createElement( 'table' );
		lbTable.className = 'page-ranked__lb-table';
		lbTable.setAttribute( 'aria-label', 'Top ranked players' );

		const thead = document.createElement( 'thead' );
		const headerRow = document.createElement( 'tr' );
		for ( const col of [ 'POS', 'NAME', 'STATS', 'SPD', 'PNTS' ] ) {

			const th = document.createElement( 'th' );
			th.scope = 'col';
			th.textContent = col;
			headerRow.appendChild( th );

		}
		thead.appendChild( headerRow );
		lbTable.appendChild( thead );

		const tbody = document.createElement( 'tbody' );
		lbPanel.appendChild( lbTable );
		lbTable.appendChild( tbody );
		this._registerSection( 'lbTbody', tbody );

		center.appendChild( lbPanel );

		const arenaLabel = document.createElement( 'div' );
		arenaLabel.className = 'page-ranked__arena-label';
		arenaLabel.textContent = 'ARENA';
		center.appendChild( arenaLabel );
		root.appendChild( center );

		// ── Right column ──────────────────────────────────────────────────────────
		const right = document.createElement( 'div' );
		right.className = 'page-ranked__right';

		// Tier Rewards
		const tierPanel = document.createElement( 'div' );
		tierPanel.className = 'page-ranked__panel';
		tierPanel.setAttribute( 'aria-label', 'Tier rewards' );

		const tierPanelLabel = document.createElement( 'div' );
		tierPanelLabel.className = 'page-ranked__panel-label';
		tierPanelLabel.style.display = 'flex';
		tierPanelLabel.style.justifyContent = 'space-between';
		tierPanelLabel.style.alignItems = 'center';

		const tierTitle = document.createElement( 'span' );
		tierTitle.textContent = 'TIER REWARDS';
		tierPanelLabel.appendChild( tierTitle );

		this._tierRewardsBtn = new CTAButton( {
			label:    'CLAIM',
			variant:  'ghost',
			actionId: ButtonIds.RANKED_TIER_REWARDS,
		} );
		tierPanelLabel.appendChild( this._tierRewardsBtn.el );
		tierPanel.appendChild( tierPanelLabel );

		const tierList = document.createElement( 'div' );
		tierList.className = 'page-ranked__tier-rewards';
		tierList.setAttribute( 'aria-label', 'Tier reward items' );
		tierPanel.appendChild( tierList );
		this._registerSection( 'tierList', tierList );
		right.appendChild( tierPanel );

		// Match History
		const historyPanel = document.createElement( 'div' );
		historyPanel.className = 'page-ranked__panel';
		historyPanel.setAttribute( 'aria-label', 'Match history' );

		const historyPanelLabel = document.createElement( 'div' );
		historyPanelLabel.className = 'page-ranked__panel-label';
		historyPanelLabel.style.display = 'flex';
		historyPanelLabel.style.justifyContent = 'space-between';
		historyPanelLabel.style.alignItems = 'center';

		const historyTitle = document.createElement( 'span' );
		historyTitle.textContent = 'MATCH HISTORY';
		historyPanelLabel.appendChild( historyTitle );

		this._matchHistoryBtn = new CTAButton( {
			label:    'ALL',
			variant:  'ghost',
			actionId: ButtonIds.RANKED_MATCH_HISTORY,
		} );
		historyPanelLabel.appendChild( this._matchHistoryBtn.el );
		historyPanel.appendChild( historyPanelLabel );

		const matchList = document.createElement( 'ul' );
		matchList.className = 'page-ranked__match-list';
		matchList.setAttribute( 'role', 'list' );
		matchList.setAttribute( 'aria-label', 'Recent matches' );
		historyPanel.appendChild( matchList );
		this._registerSection( 'matchList', matchList );
		right.appendChild( historyPanel );

		// Rank Rules
		const rulesPanel = document.createElement( 'div' );
		rulesPanel.className = 'page-ranked__panel';
		rulesPanel.setAttribute( 'aria-label', 'Rank rules' );

		const rulesPanelLabel = document.createElement( 'div' );
		rulesPanelLabel.className = 'page-ranked__panel-label';
		rulesPanelLabel.style.display = 'flex';
		rulesPanelLabel.style.justifyContent = 'space-between';
		rulesPanelLabel.style.alignItems = 'center';

		const rulesTitle = document.createElement( 'span' );
		rulesTitle.textContent = 'RANK RULES';
		rulesPanelLabel.appendChild( rulesTitle );

		this._rankRulesBtn = new CTAButton( {
			label:    'INFO',
			variant:  'ghost',
			actionId: ButtonIds.RANKED_RULES,
		} );
		rulesPanelLabel.appendChild( this._rankRulesBtn.el );
		rulesPanel.appendChild( rulesPanelLabel );

		const rulesList = document.createElement( 'ul' );
		rulesList.className = 'page-ranked__rules-list';
		rulesList.setAttribute( 'role', 'list' );
		rulesList.setAttribute( 'aria-label', 'Rank rules' );
		rulesPanel.appendChild( rulesList );
		this._registerSection( 'rulesList', rulesList );
		right.appendChild( rulesPanel );
		root.appendChild( right );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		this._queueBtn?.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API — called by controller
	// ---------------------------------------------------------------------------

	/**
	 * @param {{tier:string, division:string, points:number, pointsMax:number, playerName:string}} rank
	 */
	setCurrentRank( rank ) {

		const tierEl = this.getSection( 'rankTier' );
		if ( tierEl ) tierEl.textContent = `TIER: ${rank.tier}`;

		const divEl = this.getSection( 'rankDivision' );
		if ( divEl ) divEl.textContent = `DIVISION: ${rank.division}`;

		const ptEl = this.getSection( 'prestigeValue' );
		if ( ptEl ) ptEl.textContent = `${rank.points}/${rank.pointsMax}P`;

		const fillEl = this.getSection( 'prestigeBarFill' );
		if ( fillEl ) {

			const pct = Math.min( 100, ( rank.points / rank.pointsMax ) * 100 );
			fillEl.style.width = `${pct.toFixed( 1 )}%`;

		}

	}

	/**
	 * @param {{seasonName:string, progress:number, milestones:Array<{pct:number,label:string}>}} data
	 */
	setSeasonProgress( data ) {

		const nameEl = this.getSection( 'seasonName' );
		if ( nameEl ) nameEl.textContent = `SEASON 3: ${data.seasonName.split( ':' ).pop()?.trim() ?? data.seasonName}`;

		const fillEl = this.getSection( 'seasonBarFill' );
		if ( fillEl ) fillEl.style.width = `${data.progress}%`;

		const pctEl = this.getSection( 'seasonPct' );
		if ( pctEl ) pctEl.textContent = `${data.progress}% COMPLETE`;

		const milestonesEl = this.getSection( 'seasonMilestones' );
		if ( milestonesEl && data.milestones ) {

			milestonesEl.innerHTML = '';
			for ( const m of data.milestones ) {

				const span = document.createElement( 'span' );
				span.className = 'page-ranked__season-milestone';
				span.textContent = m.label;
				milestonesEl.appendChild( span );

			}

		}

	}

	/**
	 * @param {Array<{pos:number, name:string, stats:number, speed:number, pts:number}>} entries
	 */
	setLeaderboard( entries ) {

		const tbody = this.getSection( 'lbTbody' );
		if ( ! tbody ) return;

		tbody.innerHTML = '';

		for ( const entry of entries ) {

			const tr = document.createElement( 'tr' );
			tr.setAttribute( 'aria-label', `Rank ${entry.pos}: ${entry.name}, ${entry.pts} points` );

			const tdPos = document.createElement( 'td' );
			tdPos.className = 'page-ranked__lb-pos';
			tdPos.textContent = entry.pos;
			tr.appendChild( tdPos );

			const tdName = document.createElement( 'td' );
			const playerDiv = document.createElement( 'div' );
			playerDiv.className = 'page-ranked__lb-player';

			const avatar = document.createElement( 'div' );
			avatar.className = 'page-ranked__lb-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
			playerDiv.appendChild( avatar );

			const nameSpan = document.createElement( 'span' );
			nameSpan.textContent = entry.name;
			playerDiv.appendChild( nameSpan );
			tdName.appendChild( playerDiv );
			tr.appendChild( tdName );

			const tdStats = document.createElement( 'td' );
			tdStats.textContent = entry.stats;
			tr.appendChild( tdStats );

			const tdSpeed = document.createElement( 'td' );
			tdSpeed.textContent = entry.speed;
			tr.appendChild( tdSpeed );

			const tdPts = document.createElement( 'td' );
			tdPts.className = 'page-ranked__lb-pts';
			tdPts.textContent = entry.pts;
			tr.appendChild( tdPts );

			tbody.appendChild( tr );

		}

	}

	/**
	 * @param {Array<{tier:string, item:string, unlocked:boolean}>} rewards
	 */
	setTierRewards( rewards ) {

		const list = this.getSection( 'tierList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const r of rewards ) {

			const row = document.createElement( 'div' );
			row.className = 'page-ranked__tier-reward-row';
			row.setAttribute( 'aria-label', `${r.tier}: ${r.item}${r.unlocked ? '' : ' (locked)'}` );

			const icon = document.createElement( 'div' );
			icon.className = 'page-ranked__tier-reward-icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.textContent = r.unlocked ? '' : '';
			row.appendChild( icon );

			const info = document.createElement( 'div' );
			info.className = 'page-ranked__tier-reward-info';

			const tierSpan = document.createElement( 'div' );
			tierSpan.className = 'page-ranked__tier-reward-tier';
			tierSpan.textContent = r.tier;
			info.appendChild( tierSpan );

			const itemSpan = document.createElement( 'div' );
			itemSpan.className = 'page-ranked__tier-reward-item';
			itemSpan.textContent = r.item;
			info.appendChild( itemSpan );
			row.appendChild( info );

			if ( ! r.unlocked ) {

				const locked = document.createElement( 'div' );
				locked.className = 'page-ranked__tier-reward-locked';
				locked.setAttribute( 'aria-hidden', 'true' );
				locked.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
				row.appendChild( locked );

			}

			list.appendChild( row );

		}

	}

	/**
	 * @param {Array<{date:string, result:string, prestige:string}>} matches
	 */
	setMatchHistory( matches ) {

		const list = this.getSection( 'matchList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const m of matches ) {

			const li = document.createElement( 'li' );
			li.className = 'page-ranked__match-row';
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `${m.date} — ${m.result} — ${m.prestige}` );

			const date = document.createElement( 'span' );
			date.className = 'page-ranked__match-date';
			date.textContent = m.date;
			li.appendChild( date );

			const result = document.createElement( 'span' );
			result.className = 'page-ranked__match-result';
			result.textContent = m.result;
			li.appendChild( result );

			const isNegative = m.prestige.startsWith( '-' );
			const prestige = document.createElement( 'span' );
			prestige.className = `page-ranked__match-prestige${isNegative ? ' page-ranked__match-prestige--negative' : ''}`;
			prestige.textContent = m.prestige;
			li.appendChild( prestige );

			list.appendChild( li );

		}

	}

	/**
	 * @param {string[]} rules
	 */
	setRankRules( rules ) {

		const list = this.getSection( 'rulesList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const rule of rules ) {

			const li = document.createElement( 'li' );
			li.textContent = rule;
			list.appendChild( li );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get queueBtn() { return this._queueBtn; }

	/** @returns {CTAButton} */
	get matchHistoryBtn() { return this._matchHistoryBtn; }

	/** @returns {CTAButton} */
	get tierRewardsBtn() { return this._tierRewardsBtn; }

	/** @returns {CTAButton} */
	get leaderboardBtn() { return this._leaderboardBtn; }

	/** @returns {CTAButton} */
	get rankRulesBtn() { return this._rankRulesBtn; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._queueBtn        = null;
		this._matchHistoryBtn = null;
		this._tierRewardsBtn  = null;
		this._leaderboardBtn  = null;
		this._rankRulesBtn    = null;

		super.dispose();

	}

}

Page08RankedView._cssInjected = false;
