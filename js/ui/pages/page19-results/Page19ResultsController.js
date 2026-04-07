/**
 * Page19ResultsController — Results / Post-Race Screen.
 *
 * Route: RouteIds.RESULTS ("/results")
 *
 * Responsibilities:
 *   - Create and configure Page19ResultsView.
 *   - Populate podium, XP gain, race stats, rewards, and challenge progress
 *     from MockData. In production this data arrives from a race-result payload
 *     passed as route params or fetched from the race session service.
 *   - Bind REMATCH → navigate to LOBBY.
 *   - Bind NEXT RACE → navigate to PLAY.
 *   - Bind RETURN TO LOBBY → navigate to LOBBY.
 *   - Track analytics events for all three action buttons.
 *
 * Data: MockData.player, MockData.challenges (no async required).
 */

import { PageControllerBase }   from '../../core/PageControllerBase.js';
import { Page19ResultsView }    from './Page19ResultsView.js';
import { RouteIds }             from '../../enums/RouteIds.js';
import { PageIds }              from '../../enums/PageIds.js';
import { EventIds }             from '../../enums/EventIds.js';
import { MockData }             from '../../repositories/mocks/MockData.js';

// Mock race stats for the post-race summary panel.
const MOCK_RACE_STATS = [
	{ label: '- Total Time',  value: '2:45.12' },
	{ label: '- Best Lap',    value: '0:51.34'  },
	{ label: '- Top Speed',   value: '188 KM/H'  },
	{ label: '- Drifts',      value: '11'         },
];

// Mock rewards earned this race.
const MOCK_REWARDS = [
	{ name: '+500 Coins',                          desc: null },
	{ name: 'A new special gold-rimmed wheel set', desc: '3D icon unlocked'  },
	{ name: '1 rare \'Drift Boost\' consumable',   desc: null },
];

// Mock podium entries. In production, derived from the race result payload.
const MOCK_PODIUM = [
	{ position: 1, name: MockData.player.name },
	{ position: 2, name: '@KARTMASTER'         },
	{ position: 3, name: '@DRIFTDEVIL'         },
];

export class Page19ResultsController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page19ResultsView} */
		this._view = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page19ResultsView();

	}

	bindEvents() {

		const view = this._view;

		// REMATCH — re-enter same lobby/race setup.
		this._addListener( view.rematchBtn.el, 'click', () => {

			this._analytics?.track( EventIds.REMATCH_CLICKED );
			this.navigate( RouteIds.LOBBY );

		} );

		// NEXT RACE — go to play modes to pick the next race.
		this._addListener( view.nextRaceBtn.el, 'click', () => {

			this._analytics?.track( EventIds.NEXT_RACE_CLICKED );
			this.navigate( RouteIds.PLAY );

		} );

		// RETURN TO LOBBY — go back to the pre-race lobby.
		this._addListener( view.returnToLobbyBtn.el, 'click', () => {

			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { destination: RouteIds.LOBBY } );
			this.navigate( RouteIds.LOBBY );

		} );

	}

	loadData() {

		// All data is synchronous MockData — nothing to fetch.
		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Final position — player always 1st in mock.
		view.setFinalPosition( 1 );

		// Podium.
		view.setPodium( MOCK_PODIUM );

		// XP gain — mock values based on MockData.player.
		const { level, xp, xpToNext } = MockData.player;
		const xpEarned  = 2500;
		const newXp     = xp + xpEarned;
		const leveledUp = newXp >= xpToNext;
		const toLevel   = leveledUp ? level + 1 : level;
		view.setXpGain( xpEarned, level, toLevel, leveledUp );

		// Race stats.
		view.setRaceStats( MOCK_RACE_STATS );

		// Rewards.
		view.setRewardsEarned( MOCK_REWARDS );

		// Challenge progress — show the daily challenges with mock progress bumps.
		const challengeProgress = MockData.challenges.slice( 0, 3 ).map( ch => ( {
			title:    ch.title,
			progress: Math.min( ch.target, ch.progress + ( ch.claimed ? 0 : 2 ) ),
			target:   ch.target,
			claimed:  ch.claimed,
		} ) );
		view.setChallengeProgress( challengeProgress );

		// Track reward_claimed analytics for any auto-granted rewards.
		this._analytics?.track( EventIds.REWARD_CLAIMED, { count: MOCK_REWARDS.length } );

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.RESULTS );

	}

	dispose() {

		super.dispose();

	}

}
