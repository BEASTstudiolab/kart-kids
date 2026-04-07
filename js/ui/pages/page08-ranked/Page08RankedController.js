/**
 * Page08RankedController — Ranked / Competitive.
 *
 * Route: RouteIds.RANKED ("/ranked")
 *
 * Responsibilities:
 *   - Create and configure Page08RankedView.
 *   - Populate current rank, season progress, leaderboard, match history,
 *     tier rewards, and rank rules from MockData.ranked.
 *   - Bind QUEUE RANKED → /lobby, MATCH HISTORY, TIER REWARDS, LEADERBOARD,
 *     and RANK RULES modal triggers.
 *
 * Data: MockData.ranked, MockData.player (no async required).
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page08RankedView }   from './Page08RankedView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ModalIds }           from '../../enums/ModalIds.js';
import { ButtonIds }          from '../../enums/ButtonIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { MockData }           from '../../repositories/mocks/MockData.js';

// Mock leaderboard entries.
const MOCK_LEADERBOARD = [
	{ pos: 1, name: 'ABIM.3',    stats: 38, speed: 18, pts: 3785, avatar: null },
	{ pos: 2, name: 'KANACOKER', stats: 36, speed: 13, pts: 3725, avatar: null },
	{ pos: 3, name: 'ATER.II',   stats: 37, speed: 16, pts: 3670, avatar: null },
	{ pos: 4, name: 'BETON.3',   stats: 25, speed: 13, pts: 3778, avatar: null },
	{ pos: 5, name: 'KARRIP01',  stats: 26, speed: 13, pts: 3724, avatar: null },
];

// Mock match history.
const MOCK_MATCH_HISTORY = [
	{ date: 'MATCH 01/1/20', result: 'RESULT', prestige: '+2.1P' },
	{ date: 'MATCH 02/1/21', result: 'FINAL',  prestige: '+2.1P' },
	{ date: 'MATCH 11/1/21', result: 'FINAL',  prestige: '+2.1P' },
	{ date: 'MATCH 3/1/21',  result: 'RESULT', prestige: '+1.19' },
];

// Mock tier rewards.
const MOCK_TIER_REWARDS = [
	{ tier: 'ACE DRIVER',  item: 'KART SKIN',    unlocked: true },
	{ tier: 'ACE DRIVER',  item: 'GOLD EFFECT',  unlocked: true },
	{ tier: 'ACE DRIVER',  item: 'GOLD TRIM',    unlocked: false },
];

// Season progress milestones for the progress bar.
const SEASON_MILESTONES = [
	{ pct: 10, label: '10%' },
	{ pct: 20, label: '20%' },
	{ pct: 30, label: '30%' },
];

// Rank rules text.
const RANK_RULES = [
	'The rank rules will hide the part 30 degrees of prestige points before ranked match selected Tokyo results.',
	'The rank rules drives and sea training edge will drive themselves a prestige points from Drinker Bases.',
];

export class Page08RankedController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page08RankedView} */
		this._view = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page08RankedView();

	}

	bindEvents() {

		const view = this._view;

		// QUEUE RANKED
		this._addListener( view.queueBtn.el, 'click', () => {

			this._analytics?.track( EventIds.RANKED_QUEUE_STARTED );
			this.navigate( RouteIds.LOBBY );

		} );

		// MATCH HISTORY
		this._addListener( view.matchHistoryBtn.el, 'click', () => {

			this.openModal( { id: ModalIds.LEADERBOARD } );

		} );

		// TIER REWARDS
		this._addListener( view.tierRewardsBtn.el, 'click', () => {

			this.openModal( { id: ModalIds.CLAIM_REWARD } );

		} );

		// LEADERBOARD
		this._addListener( view.leaderboardBtn.el, 'click', () => {

			this._analytics?.track( EventIds.LEADERBOARD_VIEWED );
			this.openModal( { id: ModalIds.LEADERBOARD } );

		} );

		// RANK RULES
		this._addListener( view.rankRulesBtn.el, 'click', () => {

			this.openModal( { id: ModalIds.RANK_RULES } );

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;
		const ranked = MockData.ranked;

		// Current rank visual.
		view.setCurrentRank( {
			tier:         ranked.tier,
			division:     ranked.division,
			points:       ranked.points,
			pointsMax:    ranked.pointsMax,
			playerName:   MockData.player.name,
		} );

		// Season progress.
		view.setSeasonProgress( {
			seasonName:  ranked.seasonName,
			progress:    ranked.seasonProgress,
			milestones:  SEASON_MILESTONES,
		} );

		// Leaderboard.
		view.setLeaderboard( MOCK_LEADERBOARD );

		// Tier rewards.
		view.setTierRewards( MOCK_TIER_REWARDS );

		// Match history.
		view.setMatchHistory( MOCK_MATCH_HISTORY );

		// Rank rules.
		view.setRankRules( RANK_RULES );

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.RANKED );

	}

	dispose() {

		super.dispose();

	}

}
