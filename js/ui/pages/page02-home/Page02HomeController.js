/**
 * Page02HomeController — Home / Main Menu.
 *
 * Route: RouteIds.HOME ("/home")
 *
 * Responsibilities:
 *   - Create and configure Page02HomeView.
 *   - Wire TopNav navigation events to NavigationService.
 *   - Wire QUICK PLAY CTA → RouteIds.QUICK_PLAY.
 *   - Wire navigation rail buttons to their respective routes.
 *   - Wire Current Loadout link → RouteIds.GARAGE.
 *   - Populate player data from Settings.
 *   - Emit analytics page view on mount.
 *
 * Data: Settings (profile + stats), VehicleRegistry (selected kart label).
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page02HomeView }     from './Page02HomeView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ButtonIds }          from '../../enums/ButtonIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { Settings }           from '../../../Settings.js';
import { getVehicleById }     from '../../../VehicleRegistry.js';
import { PLAYER_CHARACTERS }  from '../../../VehicleRegistry.js';

export class Page02HomeController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page02HomeView} */
		this._view = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page02HomeView();

	}

	bindEvents() {

		const view = this._view;

		// TopNav navigation — delegated via custom event bubbling from TopNav component
		this._addListener( view.root, 'kk:topnav:navigate', ( e ) => {

			const { route } = e.detail;
			if ( route ) {
				this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { route } );
				this.navigate( route );
			}

		} );

		// QUICK PLAY CTA
		this._addListener( view.quickPlayBtn.el, 'click', () => {

			this._analytics?.track( EventIds.QUICK_PLAY_STARTED );
			this.navigate( RouteIds.QUICK_PLAY );

		} );

		// Navigation rail — delegate by actionId
		this._addListener( view.root, 'kk:cta-button:click', ( e ) => {

			this._handleRailAction( e.detail.actionId );

		} );

		// Current Loadout link → Garage
		this._addListener( view.loadoutLinkEl, 'click', () => {

			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { route: RouteIds.GARAGE } );
			this.navigate( RouteIds.GARAGE );

		} );

		// Keyboard activate on loadout link (Enter / Space)
		this._addListener( view.loadoutLinkEl, 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				view.loadoutLinkEl.click();
			}

		} );

		// Featured Event card
		this._addListener( view.featuredEventEl, 'click', () => {

			this._analytics?.track( EventIds.EVENT_OPENED, { source: ButtonIds.HOME_FEATURED_EVENT } );
			this.navigate( RouteIds.EVENTS );

		} );

		// Keyboard activate on event card
		this._addListener( view.featuredEventEl, 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				view.featuredEventEl.click();
			}

		} );

		// Daily Challenges heading button
		this._addListener( view.dailyChallengesHeadingBtn, 'click', () => {

			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { route: RouteIds.CHALLENGES } );
			this.navigate( RouteIds.CHALLENGES );

		} );

	}

	loadData() {

		// All data comes from synchronous sources (Settings, VehicleRegistry).
		return Promise.resolve();

	}

	render( container ) {

		const view     = this._view;
		const settings = new Settings();
		const stats    = settings.getStats();
		const kartId   = settings.getSelectedKartId();
		const kart     = getVehicleById( kartId );
		const charName = PLAYER_CHARACTERS[ 0 ]?.label ?? 'Racer';
		const kartName = kart.label;
		const displayName = settings.getDisplayName() ?? 'Player';

		// Populate all data before mounting so first paint is complete
		view.setPlayerSummary( {
			rank:       0,
			totalWins:  stats.wins,
			totalRaces: stats.totalRaces,
		} );

		view.setLoadout( {
			characterName: charName,
			kartName:      kartName,
		} );

		view.setFeaturedEvent( {
			name:        'Kart Kids Racing',
			description: 'Hit the track!',
		} );

		view.setDailyChallenges( [] );

		view.setWallet( {
			coins: 0,
			gems:  0,
		} );

		view.setHeroAriaLabel( `${charName} on ${kartName}` );
		view.setHeroCaption( displayName );

		view.mount( container );

		this._analytics?.trackPageView( PageIds.HOME );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * Route each navigation rail button to the correct destination.
	 *
	 * @param {string} actionId
	 */
	_handleRailAction( actionId ) {

		const map = {
			[ ButtonIds.HOME_PLAY_MODES ]: RouteIds.PLAY,
			[ ButtonIds.HOME_PARTY ]:      RouteIds.PARTY,
			[ ButtonIds.HOME_GARAGE ]:     RouteIds.GARAGE,
			[ ButtonIds.HOME_CREATE ]:     RouteIds.CREATE,
			[ ButtonIds.HOME_PROFILE ]:    RouteIds.PROFILE,
			[ ButtonIds.HOME_SHOP ]:       RouteIds.SHOP,
			[ ButtonIds.HOME_SETTINGS ]:   RouteIds.SETTINGS,
		};

		const route = map[ actionId ];
		if ( route ) {

			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { route } );
			this.navigate( route );

		}

	}

}
