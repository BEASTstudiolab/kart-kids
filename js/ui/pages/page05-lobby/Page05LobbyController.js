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
 *   - Wire NetworkClient room events for multiplayer lobbies.
 *   - Host status: local player is host in solo/offline mode, or set by server.
 *
 * Data: Settings (player name, selected kart), VehicleRegistry, TrackRegistry,
 *       NetworkClient (room events).
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

// Default race rules displayed in the panel.
const DEFAULT_RACE_RULES = [
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

		/** @type {import('../../../Network.js').NetworkClient|null} */
		this._network = services.network ?? null;

		/** @type {string|null} Room code from navigation state or server. */
		this._roomCode = null;

		/** @type {string|null} Host player ID from server. */
		this._hostId = null;

		/** @type {Array<{id:string, name:string, role:string, ready:boolean, online:boolean}>} */
		this._members = [];

		/** @type {string|null} Selected track ID for host Start Race. */
		this._selectedTrackId = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page05LobbyView();

		// Pull room context from navigation state (set by QuickPlay or join flow).
		const state = params ?? {};
		this._roomCode = state.roomCode ?? null;
		this._hostId = state.hostId ?? null;

		if ( state.members && state.members.length ) {

			this._members = state.members;

		}

		// Determine initial host status.
		if ( this._network && this._network.connected && this._hostId ) {

			this._isHost = this._network.localPlayerId === this._hostId;

		} else {

			// Solo/offline — local player is always host.
			this._isHost = true;

		}

		// Wire network callbacks.
		this._wireNetworkEvents();

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

			// Copy room code to clipboard if available.
			if ( this._roomCode ) {

				navigator.clipboard?.writeText( this._roomCode ).then( () => {

					this.showToast( {
						message:  `ROOM CODE COPIED: ${this._roomCode}`,
						variant:  'success',
						duration: 2000,
					} );

				} ).catch( () => {

					this.showToast( {
						message:  `ROOM CODE: ${this._roomCode}`,
						variant:  'info',
						duration: 3000,
					} );

				} );

			} else {

				this.openModal( { id: ModalIds.MEMBER_ACTIONS } );

			}

		} );

		// START MATCH (host only)
		this._addListener( view.startMatchBtn.el, 'click', () => {

			this._handleStartMatch();

		} );

		// Room code join input
		if ( view.roomCodeJoinBtn ) {

			this._addListener( view.roomCodeJoinBtn.el, 'click', () => {

				this._handleJoinByCode();

			} );

		}

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

		// Room code display.
		if ( this._roomCode ) {

			view.setRoomCode( this._roomCode );

		}

		// Populate member list — local player only until NetworkClient events arrive.
		if ( this._members.length === 0 ) {

			this._members = [
				{ id: 'local', name: `@${displayName.toUpperCase()}`, role: 'HOST', ready: false, online: true },
			];

		}

		view.setMembers( this._members );

		// Track vote options from TrackRegistry.
		const tracks = getTracks();
		const trackVoteData = tracks.slice( 0, 2 ).map( ( t, i ) => ( {
			id:    t.id,
			name:  t.name,
			votes: i === 0 ? 1 : 0,
		} ) );
		view.setTrackVotes( trackVoteData );
		this._bindTrackVoteBtns();

		// Default selected track for Start Race.
		if ( tracks.length > 0 && ! this._selectedTrackId ) {

			this._selectedTrackId = tracks[ 0 ].id;

		}

		// Race rules.
		view.setRaceRules( DEFAULT_RACE_RULES );

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
		this._unwireNetworkEvents();
		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Network event wiring
	// ---------------------------------------------------------------------------

	_wireNetworkEvents() {

		if ( ! this._network ) return;

		this._onPlayerJoinBound = ( msg ) => this._handleNetPlayerJoin( msg );
		this._onPlayerLeaveBound = ( msg ) => this._handleNetPlayerLeave( msg );
		this._onHostChangeBound = ( msg ) => this._handleNetHostChange( msg );
		this._onRaceCountdownBound = ( msg ) => this._handleNetRaceCountdown( msg );
		this._onRaceStartBound = ( msg ) => this._handleNetRaceStart( msg );
		this._onDisconnectBound = () => this._handleNetDisconnect();

		this._network.onPlayerJoin = this._onPlayerJoinBound;
		this._network.onPlayerLeave = this._onPlayerLeaveBound;
		this._network.onHostChange = this._onHostChangeBound;
		this._network.onRaceCountdown = this._onRaceCountdownBound;
		this._network.onRaceStart = this._onRaceStartBound;
		this._network.onDisconnect = this._onDisconnectBound;

	}

	_unwireNetworkEvents() {

		if ( ! this._network ) return;

		// Only clear callbacks we own.
		if ( this._network.onPlayerJoin === this._onPlayerJoinBound ) this._network.onPlayerJoin = null;
		if ( this._network.onPlayerLeave === this._onPlayerLeaveBound ) this._network.onPlayerLeave = null;
		if ( this._network.onHostChange === this._onHostChangeBound ) this._network.onHostChange = null;
		if ( this._network.onRaceCountdown === this._onRaceCountdownBound ) this._network.onRaceCountdown = null;
		if ( this._network.onRaceStart === this._onRaceStartBound ) this._network.onRaceStart = null;
		if ( this._network.onDisconnect === this._onDisconnectBound ) this._network.onDisconnect = null;

	}

	// ---------------------------------------------------------------------------
	// Network event handlers
	// ---------------------------------------------------------------------------

	_handleNetPlayerJoin( msg ) {

		const pid = msg.id ?? msg.playerId;
		const existing = this._members.find( ( m ) => m.id === pid );
		if ( ! existing ) {

			this._members.push( {
				id:     pid,
				name:   msg.name || `Player ${this._members.length + 1}`,
				role:   'MEMBER',
				ready:  false,
				online: true,
			} );

		}

		this._view?.setMembers( this._members );

	}

	_handleNetPlayerLeave( msg ) {

		const pid = msg.id ?? msg.playerId;
		this._members = this._members.filter( ( m ) => m.id !== pid );
		this._view?.setMembers( this._members );

	}

	_handleNetHostChange( msg ) {

		this._hostId = msg.hostId;
		this._isHost = this._network?.localPlayerId === msg.hostId;

		// Update roles in member list.
		for ( const m of this._members ) {

			m.role = m.id === msg.hostId ? 'HOST' : 'MEMBER';

		}

		this._view?.setMembers( this._members );
		this._view?.setHostControls( this._isHost );

	}

	_handleNetRaceCountdown( msg ) {

		this._view?.setCountdownLabel( 'STARTING IN' );
		if ( typeof msg.seconds === 'number' ) {

			this._countdownSeconds = msg.seconds;
			this._view?.setCountdown( this._formatSeconds( msg.seconds ) );

		}

	}

	_handleNetRaceStart( msg ) {

		this._stopCountdown();

		// Trigger game start via services if available.
		if ( this._services.startRace ) {

			this._services.startRace( msg.trackId ?? this._selectedTrackId );

		}

	}

	_handleNetDisconnect() {

		this.showToast( {
			message:  'DISCONNECTED FROM SERVER',
			variant:  'error',
			duration: 3000,
		} );

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

		this._selectedTrackId = trackId;
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

		// If networked, tell the server to start the race.
		if ( this._network && this._network.connected && this._selectedTrackId ) {

			this._network.startRace( this._selectedTrackId );
			return;

		}

		// Solo/offline fallback: navigate to results as a proxy for "race complete".
		this.navigate( RouteIds.RESULTS );

	}

	_handleJoinByCode() {

		const input = this._view?.roomCodeInputEl;
		if ( ! input ) return;

		const code = input.value.trim().toUpperCase();
		if ( ! code ) {

			this.showToast( {
				message:  'ENTER A ROOM CODE',
				variant:  'warning',
				duration: 2000,
			} );
			return;

		}

		if ( ! this._network ) {

			this.showToast( {
				message:  'NOT CONNECTED TO SERVER',
				variant:  'error',
				duration: 2000,
			} );
			return;

		}

		const settings = new Settings();
		const vehicleId = settings.get( 'vehicleModel' ) ?? 'kart-1';
		this._network.setDisplayName( settings.getDisplayName() || '' );

		this._network.joinRoom( code, vehicleId ).then( ( result ) => {

			this._roomCode = result.roomCode ?? code;
			this._hostId = result.host ?? null;
			this._isHost = this._network.localPlayerId === this._hostId;

			// Populate member list from existingPlayers in welcome message
			if ( result.existingPlayers ) {

				for ( const p of result.existingPlayers ) {

					const existing = this._members.find( ( m ) => m.id === p.id );
					if ( ! existing ) {

						this._members.push( {
							id:     p.id,
							name:   p.name || `Player ${ this._members.length + 1 }`,
							role:   'MEMBER',
							ready:  false,
							online: true,
						} );

					}

				}

			}

			this._view?.setRoomCode( this._roomCode );
			this._view?.setMembers( this._members );
			this._view?.setHostControls( this._isHost );

			this.showToast( {
				message:  `JOINED ROOM ${this._roomCode}`,
				variant:  'success',
				duration: 2000,
			} );

		} ).catch( ( err ) => {

			this.showToast( {
				message:  err.message?.toUpperCase() ?? 'FAILED TO JOIN ROOM',
				variant:  'error',
				duration: 3000,
			} );

		} );

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
