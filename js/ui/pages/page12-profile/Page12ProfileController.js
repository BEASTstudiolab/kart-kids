/**
 * Page12ProfileController — Player Profile / Career.
 *
 * Route: RouteIds.PROFILE ("/profile")
 *
 * Responsibilities:
 *   - Create and configure Page12ProfileView.
 *   - Populate profile card (avatar, name, title, level, XP bar) from MockData.player.
 *   - Populate lifetime stats panel.
 *   - Populate favorite loadout preview from MockData.loadout.
 *   - Render Achievements, Badges, Match History tabs.
 *   - Bind EDIT PROFILE → modal, FAVORITE LOADOUT → /garage, tab switching.
 *
 * Data: MockData.player, MockData.loadout, MockData.challenges (no async required).
 */

import { PageControllerBase }  from '../../core/PageControllerBase.js';
import { Page12ProfileView }   from './Page12ProfileView.js';
import { RouteIds }            from '../../enums/RouteIds.js';
import { ModalIds }            from '../../enums/ModalIds.js';
import { ButtonIds }           from '../../enums/ButtonIds.js';
import { PageIds }             from '../../enums/PageIds.js';
import { EventIds }            from '../../enums/EventIds.js';
import { MockData }            from '../../repositories/mocks/MockData.js';

// Mock lifetime stats displayed in the stats panel.
const MOCK_LIFETIME_STATS = [
	{ label: 'RACES',       value: '126' },
	{ label: 'WINS',        value: '88'  },
	{ label: 'WIN RATE',    value: '70%' },
	{ label: 'TOTAL DRIFTS', value: '4.2K' },
	{ label: 'BEST LAP',    value: '1:12.3' },
	{ label: 'TOP SPEED',   value: '247 KPH' },
];

// Mock achievements list.
const MOCK_ACHIEVEMENTS = [
	{ id: 'ach_drift_master',   title: 'Drift Master',   desc: 'Complete 1,000 perfect drifts.',         progress: 820,  target: 1000, unlocked: false },
	{ id: 'ach_win_streak',     title: 'Win Streak',     desc: 'Win 10 races in a row.',                  progress: 10,   target: 10,   unlocked: true  },
	{ id: 'ach_speed_demon',    title: 'Speed Demon',    desc: 'Reach max speed 50 times.',               progress: 50,   target: 50,   unlocked: true  },
	{ id: 'ach_grand_tour',     title: 'Grand Tour',     desc: 'Complete all Grand Prix cups.',           progress: 3,    target: 6,    unlocked: false },
	{ id: 'ach_social_racer',   title: 'Social Racer',   desc: 'Play with 20 different friends.',        progress: 14,   target: 20,   unlocked: false },
];

// Mock badges.
const MOCK_BADGES = [
	{ id: 'badge_s1',     label: 'Season 1 Veteran', unlocked: true  },
	{ id: 'badge_drift',  label: 'Drift King',        unlocked: true  },
	{ id: 'badge_ace',    label: 'Ace Ranked',        unlocked: true  },
	{ id: 'badge_tour',   label: 'Tour Champion',     unlocked: false },
	{ id: 'badge_create', label: 'Track Creator',     unlocked: false },
	{ id: 'badge_social', label: 'Party Animal',      unlocked: false },
];

// Mock match history entries.
const MOCK_MATCH_HISTORY = [
	{ track: 'Neon Tokyo',        position: 1,  date: 'YESTERDAY',   xp: '+250 XP' },
	{ track: 'Mega Mall Grand Prix', position: 3, date: '2 DAYS AGO',  xp: '+120 XP' },
	{ track: 'Beastside Arena',   position: 2,  date: '3 DAYS AGO',  xp: '+180 XP' },
	{ track: 'Neon Tokyo',        position: 1,  date: '4 DAYS AGO',  xp: '+250 XP' },
	{ track: 'Beastside Arena',   position: 5,  date: '5 DAYS AGO',  xp: '+60 XP'  },
];

export class Page12ProfileController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page12ProfileView} */
		this._view = null;

		/** @type {'achievements'|'badges'|'history'} */
		this._activeTab = 'achievements';

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page12ProfileView();

	}

	bindEvents() {

		const view = this._view;

		// EDIT PROFILE
		this._addListener( view.editProfileBtn.el, 'click', () => {

			this._analytics?.track( EventIds.PROFILE_EDITED );
			this.openModal( { id: ModalIds.EDIT_PROFILE } );

		} );

		// FAVORITE LOADOUT → garage
		this._addListener( view.favoriteLoadoutBtn.el, 'click', () => {

			this.navigate( RouteIds.GARAGE );

		} );

		// Tabs
		this._addListener( view.tabAchievements.el, 'click', () => this._switchTab( 'achievements' ) );
		this._addListener( view.tabBadges.el,        'click', () => this._switchTab( 'badges' ) );
		this._addListener( view.tabHistory.el,       'click', () => this._switchTab( 'history' ) );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;
		const player = MockData.player;

		// Profile card.
		view.setProfileCard( {
			name:       player.name,
			title:      player.title,
			level:      player.level,
			xp:         player.xp,
			xpToNext:   player.xpToNext,
			totalWins:  player.totalWins,
			totalRaces: player.totalRaces,
		} );

		// Lifetime stats.
		view.setLifetimeStats( MOCK_LIFETIME_STATS );

		// Favorite loadout.
		view.setFavoriteLoadout( {
			characterName: MockData.loadout.characterName,
			kartName:      MockData.loadout.kartName,
		} );

		// Initial tab.
		this._renderTab( this._activeTab );
		view.setActiveTab( this._activeTab );

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.PROFILE );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * @param {'achievements'|'badges'|'history'} tab
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

		if ( tab === 'achievements' ) {

			this._analytics?.track( EventIds.ACHIEVEMENT_VIEWED );
			this._view.setTabContent( 'achievements', MOCK_ACHIEVEMENTS );

		} else if ( tab === 'badges' ) {

			this._view.setTabContent( 'badges', MOCK_BADGES );

		} else {

			this._view.setTabContent( 'history', MOCK_MATCH_HISTORY );

		}

	}

}
