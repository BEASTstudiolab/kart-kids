/**
 * Page05LobbyController — Lobby / Pre-Race Room.
 *
 * Route: RouteIds.LOBBY ("/lobby")
 *
 * Responsibilities:
 *   - Create and configure Page05LobbyView.
 *   - Populate member list, track vote options, and race rules from MockData.
 *   - Bind READY UP toggle, track vote buttons, INVITE FRIENDS, and START MATCH.
 *   - Simulate countdown timer via setInterval.
 *   - Determine host status from MockData (first member with role 'HOST' matching
 *     MockData.player.name) and show/hide host-only controls accordingly.
 *
 * Data: MockData.lobbyMembers, MockData.tracks, MockData.loadout (no async required).
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page05LobbyView }    from './Page05LobbyView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ModalIds }           from '../../enums/ModalIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { MockData }           from '../../repositories/mocks/MockData.js';

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

		// Determine host status: player is host if they appear as HOST in the lobby.
		const playerName = MockData.player.name.toUpperCase();
		this._isHost = MockData.lobbyMembers.some(
			m => m.role === 'HOST' && m.name.replace( '@', '' ).toUpperCase() === playerName.replace( '@', '' ).toUpperCase()
		);

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

		// All data is synchronous MockData — nothing to fetch.
		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Populate member list.
		view.setMembers( MockData.lobbyMembers );

		// Track vote options — use first two tracks from MockData.
		const trackVoteData = MockData.tracks.slice( 0, 2 ).map( ( t, i ) => ( {
			id:    t.id,
			name:  t.name,
			votes: i === 0 ? 3 : 1,   // Mock vote counts.
		} ) );
		view.setTrackVotes( trackVoteData );
		this._bindTrackVoteBtns();

		// Race rules.
		view.setRaceRules( MOCK_RACE_RULES );

		// Loadout — match kart data from MockData.
		const kart = MockData.karts.find( k => k.id === MockData.loadout.kartId );
		view.setLoadout( {
			kartName:      MockData.loadout.kartName,
			characterName: MockData.loadout.characterName,
			kart:          kart ? { speed: kart.speed, accel: kart.accel, handling: kart.handling } : null,
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
