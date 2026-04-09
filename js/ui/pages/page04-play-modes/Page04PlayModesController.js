/**
 * Page04PlayModesController — Play Modes.
 *
 * Route: RouteIds.PLAY ("/play")
 *
 * Responsibilities:
 *   - Create and configure Page04PlayModesView.
 *   - Show two primary options: Solo Race and Multiplayer.
 *   - Solo Race: show inline track picker, then start race via services.startRace().
 *   - Multiplayer: show sub-options — Quick Play and Private Lobby.
 *   - Wire back button → RouteIds.HOME.
 *   - Emit analytics page view on mount.
 *
 * Navigation map:
 *   solo_race    → inline track selection → services.startRace({ mode: 'solo', trackData, vehicleId })
 *   multiplayer  → sub-view with:
 *     quick_play    → RouteIds.QUICK_PLAY
 *     private_lobby → RouteIds.LOBBY
 *
 * Data: TrackRegistry for track list, Settings for vehicleId.
 */

import { PageControllerBase }      from '../../core/PageControllerBase.js';
import { Page04PlayModesView }     from './Page04PlayModesView.js';
import { RouteIds }                from '../../enums/RouteIds.js';
import { PageIds }                 from '../../enums/PageIds.js';
import { EventIds }                from '../../enums/EventIds.js';
import { Settings }                from '../../../Settings.js';
import { getTracks }               from '../../../TrackRegistry.js';

export class Page04PlayModesController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page04PlayModesView} */
		this._view = null;

		/** @type {Settings} */
		this._settings = new Settings();

		/** @type {ReadonlyArray<import('../../../TrackRegistry.js').Track>} */
		this._tracks = [];

		/** @type {string | null} Selected track ID for solo race */
		this._selectedTrackId = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page04PlayModesView();

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back button
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.PLAY_MODES } );
			this.navigate( RouteIds.HOME );

		} );

		// Delegated click handler on root for all action buttons.
		// Handles both statically and dynamically created buttons.
		this._addListener( view.root, 'click', ( e ) => {

			const actionEl = e.target.closest( '[data-action]' );
			if ( ! actionEl ) return;

			const action = actionEl.dataset.action;

			switch ( action ) {

				case 'mode-solo':
					this._handleSoloSelected();
					break;

				case 'mode-multiplayer':
					this._handleMultiplayerSelected();
					break;

				case 'mp-quick-play':
					this._analytics?.track( EventIds.MODE_SELECTED, { modeId: 'quick_play' } );
					this.navigate( RouteIds.QUICK_PLAY );
					break;

				case 'mp-private-lobby':
					this._analytics?.track( EventIds.MODE_SELECTED, { modeId: 'private_lobby' } );
					this.navigate( RouteIds.LOBBY );
					break;

				case 'back-to-modes':
					view.showModeSelection();
					break;

				case 'start-solo-race':
					this._handleStartSoloRace();
					break;

			}

		} );

		// Track selection in solo view (custom event from view)
		this._addListener( view.root, 'kk:track-selected', ( e ) => {

			this._selectedTrackId = e.detail.trackId;

		} );

	}

	loadData() {

		this._tracks = getTracks();
		return Promise.resolve();

	}

	render( container ) {

		this._view.mount( container );
		this._analytics?.trackPageView( PageIds.PLAY_MODES );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	_handleSoloSelected() {

		this._analytics?.track( EventIds.MODE_SELECTED, { modeId: 'solo_race' } );
		this._view.showSoloTrackPicker( this._tracks );

		// Auto-select first track if available
		if ( this._tracks.length > 0 && ! this._selectedTrackId ) {

			this._selectedTrackId = this._tracks[ 0 ].id;

		}

	}

	_handleMultiplayerSelected() {

		this._analytics?.track( EventIds.MODE_SELECTED, { modeId: 'multiplayer' } );
		this._view.showMultiplayerOptions();

	}

	_handleStartSoloRace() {

		if ( ! this._selectedTrackId ) {

			this._notification?.show( { message: 'Please select a track.', variant: 'warning' } );
			return;

		}

		const track = this._tracks.find( ( t ) => t.id === this._selectedTrackId );

		if ( ! track ) {

			this._notification?.show( { message: 'Track not found.', variant: 'error' } );
			return;

		}

		const vehicleId = this._settings.getSelectedKartId();

		this._analytics?.track( EventIds.QUICK_PLAY_STARTED, {
			matchType: 'solo',
			trackId:   track.id,
			vehicleId,
		} );

		this._services.startRace( {
			mode:      'solo',
			trackData: track.cells,
			decoCells: track.decoCells,
			vehicleId,
		} );

	}

}
