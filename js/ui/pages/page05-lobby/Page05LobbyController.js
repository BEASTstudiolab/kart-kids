/**
 * Page05LobbyController — Lobby / Pre-Race Room.
 *
 * Route: RouteIds.LOBBY ("/lobby")
 *
 * Responsibilities:
 *   - Create and configure Page05LobbyView.
 *   - Populate member list, track vote options, and race rules.
 *   - Bind READY UP toggle, track vote buttons, INVITE FRIENDS, and START MATCH.
 *   - Simulate countdown timer via setInterval.
 *   - Host status: local player is always host in solo/offline mode.
 *
 * Data: Settings (player name, selected kart), VehicleRegistry, TrackRegistry.
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page05LobbyView }    from './Page05LobbyView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ModalIds }           from '../../enums/ModalIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { Settings }           from '../../../Settings.js';
import { getVehicleById, PLAYER_CHARACTERS } from '../../../VehicleRegistry.js';
import { getTracks }          from '../../../TrackRegistry.js';

// Default countdown in seconds shown while waiting for all players to ready.
const COUNTDOWN_SECONDS = 180;

// Mock race rules displayed in the panel.
const MOCK_RACE_RULES = [
	'Karts Only',
	'3 Laps',
	'No Boost Items (Ranked Mode)',
	'Team Drift Off',
];

export class Page05LobbyController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page05LobbyView} */
		this._view = null;

		/** @type {boolean} */
		this._isReady = false;

		/** @type {boolean} */
		this._isHost = false;

		/** @type {number | null} */
		this._countdownInterval = null;

		/** @type {number} */
		this._countdownSeconds = COUNTDOWN_SECONDS;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page05LobbyView();

		// In solo/offline mode the local player is always the host.
		// NetworkClient-based lobbies will override this via room events.
		this._isHost = true;

	}

	bindEvents() {

		const view = this._view;

		// READY UP / NOT READY toggle
		this._addListener( view.readyBtn.el, 'click', () => {

			this._toggleReady();

		} );

		// INVITE FRIENDS
		this._addListener( view.inviteFriendsBtn.el, 'click', () => {

			this._analytics?.track( EventIds.LOBBY_INVITE_SENT );
			// ModalIds.MEMBER_ACTIONS is the closest social modal available until
			// a dedicated INVITE_FRIENDS modal is spec'd and delivered.
			this.openModal( { id: ModalIds.MEMBER_ACTIONS } );

		} );

		// START MATCH (host only)
		this._addListener( view.startMatchBtn.el, 'click', () => {

			this._handleStartMatch();

		} );

		// Track vote buttons are populated dynamically in render().
		// They are re-bound after setTrackVotes() via _bindTrackVoteBtns().

	}

	loadData() {

		// All data comes from synchronous sources (Settings, registries).
		return Promise.resolve();

	}

	render( container ) {

		const view     = this._view;
		const settings = new Settings();
		const displayName = settings.getDisplayName() ?? 'Player';
		const kartId   = settings.getSelectedKartId();
		const kartEntry = getVehicleById( kartId );
		const charEntry = PLAYER_CHARACTERS[ 0 ];

		// Populate member list — local player only until NetworkClient events arrive.
		view.setMembers( [
			{ id: 'local', name: `@${displayName.toUpperCase()}`, role: 'HOST', ready: false, online: true },
		] );

		// Track vote options from TrackRegistry.
		const tracks = getTracks();
		const trackVoteData = tracks.slice( 0, 2 ).map( ( t, i ) => ( {
			id:    t.id,
			name:  t.name,
			votes: i === 0 ? 1 : 0,
		} ) );
		view.setTrackVotes( trackVoteData );
		this._bindTrackVoteBtns();

		// Race rules.
		view.setRaceRules( MOCK_RACE_RULES );

		// Loadout from real registries.
		const kartStats = kartEntry?.stats;
		view.setLoadout( {
			kartName:      kartEntry?.label ?? 'Unknown Kart',
			characterName: charEntry?.label ?? 'Racer',
			kart:          kartStats ? { speed: kartStats.speed, accel: kartStats.acceleration, handling: kartStats.handling } : null,
		} );

		// Host controls.
		view.setHostControls( this._isHost );

		// Initial ready state.
		view.setReadyState( this._isReady );

		// Countdown timer.
		view.setCountdownLabel( 'WAITING FOR PLAYERS' );
		this._startCountdown();

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.LOBBY );

	}

	dispose() {

		this._stopCountdown();
		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	_toggleReady() {

		this._isReady = ! this._isReady;
		this._view.setReadyState( this._isReady );

		this._analytics?.track( EventIds.LOBBY_READY_TOGGLED, { ready: this._isReady } );

		// When all members are ready, count down from 3:00.
		if ( this._isReady ) {

			this._view.setCountdownLabel( 'STARTING IN' );

		} else {

			this._view.setCountdownLabel( 'WAITING FOR PLAYERS' );
			this._countdownSeconds = COUNTDOWN_SECONDS;
			this._view.setCountdown( this._formatSeconds( this._countdownSeconds ) );

		}

	}

	/**
	 * @param {string} trackId
	 */
	_handleTrackVote( trackId ) {

		this._analytics?.track( EventIds.TRACK_VOTED, { trackId } );

		// Show brief toast confirmation.
		this.showToast( {
			message:  'VOTE CAST!',
			variant:  'success',
			duration: 2000,
		} );

	}

	_handleStartMatch() {

		this._analytics?.track( EventIds.MATCH_STARTED );
		this._stopCountdown();

		// For now, navigate to results as a proxy for "race complete".
		this.navigate( RouteIds.RESULTS );

	}

	// ---------------------------------------------------------------------------
	// Track vote button binding
	// ---------------------------------------------------------------------------

	/**
	 * Bind click handlers on dynamically-created track vote buttons.
	 * Called after setTrackVotes() populates the DOM.
	 */
	_bindTrackVoteBtns() {

		for ( const btn of this._view.trackVoteBtns ) {

			this._addListener( btn.el, 'click', () => {

				this._handleTrackVote( btn.el.dataset.trackId );

			} );

		}

	}

	// ---------------------------------------------------------------------------
	// Countdown timer
	// ---------------------------------------------------------------------------

	_startCountdown() {

		this._countdownSeconds = COUNTDOWN_SECONDS;
		this._view.setCountdown( this._formatSeconds( this._countdownSeconds ) );

		this._countdownInterval = setInterval( () => {

			this._countdownSeconds -= 1;

			if ( this._countdownSeconds <= 0 ) {

				this._countdownSeconds = 0;
				this._view.setCountdown( '0:00' );
				this._stopCountdown();
				return;

			}

			this._view.setCountdown( this._formatSeconds( this._countdownSeconds ) );

		}, 1000 );

	}

	_stopCountdown() {

		if ( this._countdownInterval !== null ) {

			clearInterval( this._countdownInterval );
			this._countdownInterval = null;

		}

	}

	/**
	 * @param {number} totalSeconds
	 * @returns {string}  e.g. "3:00"
	 */
	_formatSeconds( totalSeconds ) {

		const m = Math.floor( totalSeconds / 60 );
		const s = totalSeconds % 60;
		return `${m}:${String( s ).padStart( 2, '0' )}`;

	}

}
