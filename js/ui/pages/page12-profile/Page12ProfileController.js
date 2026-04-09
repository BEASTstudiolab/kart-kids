/**
 * Page12ProfileController — Player Profile / Career.
 *
 * Route: RouteIds.PROFILE ("/profile")
 *
 * Responsibilities:
 *   - Create and configure Page12ProfileView.
 *   - Populate profile card from Settings (display name, race stats).
 *   - Populate lifetime stats panel from Settings.getStats().
 *   - Populate favorite loadout preview from Settings + VehicleRegistry.
 *   - Render Achievements, Badges, Match History tabs (placeholder data).
 *   - Bind EDIT PROFILE → modal, FAVORITE LOADOUT → /garage, tab switching.
 *
 * Data: Settings (profile + stats), VehicleRegistry (kart label).
 */

import { PageControllerBase }  from '../../core/PageControllerBase.js';
import { Page12ProfileView }   from './Page12ProfileView.js';
import { RouteIds }            from '../../enums/RouteIds.js';
import { ModalIds }            from '../../enums/ModalIds.js';
import { PageIds }             from '../../enums/PageIds.js';
import { EventIds }            from '../../enums/EventIds.js';
import { Settings }            from '../../../Settings.js';
import { getVehicleById, PLAYER_CHARACTERS } from '../../../VehicleRegistry.js';

// Placeholder tab data — achievements, badges, and match history are not yet
// tracked in Settings. These empty arrays ensure the view renders cleanly.
const PLACEHOLDER_ACHIEVEMENTS = [];
const PLACEHOLDER_BADGES = [];
const PLACEHOLDER_MATCH_HISTORY = [];

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

		// Tabs — these buttons are created in _build() and are available now.
		this._addListener( view.tabAchievements.el, 'click', () => this._switchTab( 'achievements' ) );
		this._addListener( view.tabBadges.el,        'click', () => this._switchTab( 'badges' ) );
		this._addListener( view.tabHistory.el,       'click', () => this._switchTab( 'history' ) );

		// NOTE: editProfileBtn and favoriteLoadoutBtn are created inside
		// setFavoriteLoadout(), which runs during render(). Their event
		// bindings are deferred to _bindDeferredEvents() called at the end
		// of render().

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view     = this._view;
		const settings = new Settings();
		const stats    = settings.getStats();
		const displayName = settings.getDisplayName() ?? 'Player';
		const kartId   = settings.getSelectedKartId();
		const kart     = getVehicleById( kartId );
		const charName = PLAYER_CHARACTERS[ 0 ]?.label ?? 'Racer';
		const kartName = kart.label;
		const winRate  = stats.totalRaces > 0
			? Math.round( ( stats.wins / stats.totalRaces ) * 100 )
			: 0;

		// Profile card.
		view.setProfileCard( {
			name:       displayName,
			title:      'Racer',
			level:      1,
			xp:         0,
			xpToNext:   1000,
			totalWins:  stats.wins,
			totalRaces: stats.totalRaces,
		} );

		// Lifetime stats from Settings.
		view.setLifetimeStats( [
			{ label: 'RACES',    value: String( stats.totalRaces ) },
			{ label: 'WINS',     value: String( stats.wins ) },
			{ label: 'WIN RATE', value: `${winRate}%` },
		] );

		// Favorite loadout.
		view.setFavoriteLoadout( {
			characterName: charName,
			kartName:      kartName,
		} );

		// Initial tab.
		this._renderTab( this._activeTab );
		view.setActiveTab( this._activeTab );

		// Mount.
		view.mount( container );

		// Bind events for buttons that are created during render (after
		// setFavoriteLoadout populates editProfileBtn and favoriteLoadoutBtn).
		this._bindDeferredEvents();

		this._analytics?.trackPageView( PageIds.PROFILE );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Deferred event bindings
	// ---------------------------------------------------------------------------

	/**
	 * Bind click handlers for buttons that are created during render()
	 * by setFavoriteLoadout(), rather than during _build().
	 */
	_bindDeferredEvents() {

		const view = this._view;

		if ( view.editProfileBtn ) {

			this._addListener( view.editProfileBtn.el, 'click', () => {

				this._analytics?.track( EventIds.PROFILE_EDITED );
				this.openModal( { id: ModalIds.EDIT_PROFILE } );

			} );

		}

		if ( view.favoriteLoadoutBtn ) {

			this._addListener( view.favoriteLoadoutBtn.el, 'click', () => {

				this.navigate( RouteIds.GARAGE );

			} );

		}

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
			this._view.setTabContent( 'achievements', PLACEHOLDER_ACHIEVEMENTS );

		} else if ( tab === 'badges' ) {

			this._view.setTabContent( 'badges', PLACEHOLDER_BADGES );

		} else {

			this._view.setTabContent( 'history', PLACEHOLDER_MATCH_HISTORY );

		}

	}

}
