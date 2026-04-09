/**
 * Page19ResultsController — Results / Post-Race Screen.
 *
 * Route: RouteIds.RESULTS ("/results")
 *
 * Responsibilities:
 *   - Create and configure Page19ResultsView.
 *   - Show "Race Complete" placeholder until game integration provides
 *     real race-result payloads (Unit 4).
 *   - Bind REMATCH → navigate to LOBBY.
 *   - Bind NEXT RACE → navigate to PLAY.
 *   - Bind RETURN TO LOBBY → navigate to LOBBY.
 *   - Track analytics events for all three action buttons.
 *
 * Data: Settings (display name for podium placeholder).
 */

import { PageControllerBase }   from '../../core/PageControllerBase.js';
import { Page19ResultsView }    from './Page19ResultsView.js';
import { RouteIds }             from '../../enums/RouteIds.js';
import { PageIds }              from '../../enums/PageIds.js';
import { EventIds }             from '../../enums/EventIds.js';
import { Settings }             from '../../../Settings.js';

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

		// Race result data will come from endRace() payload in Unit 4.
		// For now, placeholder data is rendered synchronously.
		return Promise.resolve();

	}

	render( container ) {

		const view     = this._view;
		const settings = new Settings();
		const displayName = settings.getDisplayName() ?? 'Player';

		// Final position — placeholder until real race results.
		view.setFinalPosition( 1 );

		// Podium — local player only until multiplayer integration.
		view.setPodium( [
			{ position: 1, name: displayName },
		] );

		// XP gain — placeholder values.
		view.setXpGain( 0, 1, 1, false );

		// Race stats — placeholder.
		view.setRaceStats( [
			{ label: '- Total Time', value: '--:--' },
			{ label: '- Best Lap',   value: '--:--' },
		] );

		// Rewards — none until game integration.
		view.setRewardsEarned( [] );

		// Challenge progress — empty until challenges system exists.
		view.setChallengeProgress( [] );

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.RESULTS );

	}

	dispose() {

		super.dispose();

	}

}
