/**
 * Page07EventsController — Tournaments / Events Hub.
 *
 * Route: RouteIds.EVENTS ("/events")
 *
 * Responsibilities:
 *   - Create and configure Page07EventsView.
 *   - Populate the featured Season Tour banner from MockData.featuredEvent.
 *   - Populate tab-filtered event lists (Tournaments, Live, Daily, Weekly).
 *   - Populate the Rewards preview panel and Leaderboard sidebar.
 *   - Bind ENTER EVENT CTAs → /lobby, tab switching, REWARDS, LEADERBOARD.
 *   - Simulate countdown timer display.
 *
 * Data: MockData.featuredEvent (no async required).
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page07EventsView }   from './Page07EventsView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ModalIds }           from '../../enums/ModalIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { MockData }           from '../../repositories/mocks/MockData.js';

// Mock tournament events list.
const MOCK_TOURNAMENTS = [
	{ id: 'trn_premier_gp',   name: 'PREMIER GRAND PRIX', timeRemaining: '14D : 04H', reward: '5000 XP' },
	{ id: 'trn_premier_gp2',  name: 'PREMIER GRAND PRIX', timeRemaining: '14D : 02H', reward: '3000 XP' },
	{ id: 'trn_beastside_cup', name: 'BEASTSIDE CUP',     timeRemaining: '14D : 06H', reward: 'Exclusive Kart' },
];

// Mock live events.
const MOCK_LIVE = [
	{ id: 'live_1', name: 'STREAMING NOW', timeRemaining: 'LIVE', reward: '100 XP', live: true },
	{ id: 'live_2', name: 'STREAMING NOW', timeRemaining: 'LIVE', reward: '100 XP', live: true },
	{ id: 'live_3', name: 'STREAMING NOW', timeRemaining: 'LIVE', reward: '50 XP',  live: true },
];

// Mock daily events.
const MOCK_DAILY = [
	{ id: 'daily_1', name: 'DAILY EVENTS',  timeRemaining: '23H', reward: '10 XP' },
	{ id: 'daily_2', name: 'DAILY EVENTS',  timeRemaining: '20H', reward: '10 XP' },
	{ id: 'daily_3', name: 'DAILY EVENTS',  timeRemaining: '18H', reward: '10 XP' },
];

// Mock weekly events.
const MOCK_WEEKLY = [
	{ id: 'wk_1', name: 'CHALLENGES',    timeRemaining: '6D',  reward: '500 XP' },
	{ id: 'wk_2', name: 'WEEKLY EVENTS', timeRemaining: '5D',  reward: '250 XP' },
	{ id: 'wk_3', name: 'WEEKLY EVENTS', timeRemaining: '4D',  reward: '100 XP' },
];

// Mock leaderboard.
const MOCK_LEADERBOARD = [
	{ rank: 1, name: 'OKISHOV',    avatar: null },
	{ rank: 2, name: 'KENNATIRY',  avatar: null },
	{ rank: 3, name: 'NAGANDRIAN', avatar: null },
	{ rank: 4, name: 'SURMUSTIN',  avatar: null },
	{ rank: 5, name: 'SHANTTRY',   avatar: null },
];

// Tab data map.
const TAB_EVENTS = {
	tournaments: MOCK_TOURNAMENTS,
	live:        MOCK_LIVE,
	daily:       MOCK_DAILY,
	weekly:      MOCK_WEEKLY,
};

export class Page07EventsController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page07EventsView} */
		this._view = null;

		/** @type {'tournaments'|'live'|'daily'|'weekly'} */
		this._activeTab = 'tournaments';

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page07EventsView();

	}

	bindEvents() {

		const view = this._view;

		// Featured event ENTER CTA
		this._addListener( view.featuredEnterBtn.el, 'click', () => {

			this._handleEnterEvent( MockData.featuredEvent.id );

		} );

		// Season Tour link
		this._addListener( view.seasonTourBtn.el, 'click', () => {

			this.navigate( RouteIds.SEASON );

		} );

		// Rewards panel button
		this._addListener( view.rewardsBtn.el, 'click', () => {

			this.openModal( { id: ModalIds.CLAIM_REWARD } );

		} );

		// Leaderboard button
		this._addListener( view.leaderboardBtn.el, 'click', () => {

			this._analytics?.track( EventIds.LEADERBOARD_VIEWED );
			this.openModal( { id: ModalIds.LEADERBOARD } );

		} );

		// Tab buttons
		this._addListener( view.tabTournaments.el, 'click', () => this._switchTab( 'tournaments' ) );
		this._addListener( view.tabLive.el,        'click', () => this._switchTab( 'live' ) );
		this._addListener( view.tabDaily.el,       'click', () => this._switchTab( 'daily' ) );
		this._addListener( view.tabWeekly.el,      'click', () => this._switchTab( 'weekly' ) );

		// Event enter buttons are bound after setEventList().
		// Re-bound via _bindEventEnterBtns() whenever tab switches.

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Featured Season Tour banner.
		view.setFeaturedEvent( MockData.featuredEvent );

		// Rewards panel.
		view.setRewards( [
			{ label: 'RARE SKIN',     icon: 'skin' },
			{ label: 'GOLD CHAIN',    icon: 'chain' },
			{ label: 'GOLDEN KART',   icon: 'kart' },
			{ label: 'BOOST PACK',    icon: 'boost' },
		] );

		// Leaderboard sidebar.
		view.setLeaderboard( MOCK_LEADERBOARD );

		// Initial tab content.
		this._renderTab( this._activeTab );
		view.setActiveTab( this._activeTab );

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.EVENTS );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * @param {string} eventId
	 */
	_handleEnterEvent( eventId ) {

		this._analytics?.track( EventIds.EVENT_ENTERED, { eventId } );
		this.navigate( RouteIds.LOBBY );

	}

	/**
	 * @param {'tournaments'|'live'|'daily'|'weekly'} tab
	 */
	_switchTab( tab ) {

		if ( tab === this._activeTab ) return;
		this._activeTab = tab;
		this._view.setActiveTab( tab );
		this._renderTab( tab );

	}

	/**
	 * @param {string} tab
	 */
	_renderTab( tab ) {

		const events = TAB_EVENTS[ tab ] ?? [];
		this._view.setEventList( events );
		this._bindEventEnterBtns();

	}

	// ---------------------------------------------------------------------------
	// Dynamic button binding
	// ---------------------------------------------------------------------------

	_bindEventEnterBtns() {

		for ( const btn of this._view.eventEnterBtns ) {

			this._addListener( btn.el, 'click', () => {

				this._handleEnterEvent( btn.el.dataset.eventId );

			} );

		}

	}

}
