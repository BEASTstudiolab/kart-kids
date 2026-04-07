/**
 * Page06PartyController — Party / Friends.
 *
 * Route: RouteIds.PARTY ("/party")
 *
 * Responsibilities:
 *   - Create and configure Page06PartyView.
 *   - Populate party members, friends list, recent players, and joinable sessions.
 *   - Bind INVITE, JOIN SESSION, PARTY PRIVACY, and MEMBER ACTIONS buttons.
 *   - Simulate voice status and party privacy state.
 *
 * Data: MockData.lobbyMembers, MockData.friends (no async required).
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page06PartyView }    from './Page06PartyView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ModalIds }           from '../../enums/ModalIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { MockData }           from '../../repositories/mocks/MockData.js';

// Mock joinable sessions shown in the right panel.
const MOCK_SESSIONS = [
	{ id: 'session_tokyo',    name: 'Tokyo Drift',        host: 'DriftKing',  players: 3, maxPlayers: 8, track: 'Neon Tokyo' },
	{ id: 'session_megamall', name: 'Mega Mall Grand Prix', host: 'Sparky',    players: 5, maxPlayers: 8, track: 'Mega Mall' },
];

// Mock recent players list.
const MOCK_RECENT_PLAYERS = [
	{ id: 'rp1', name: 'Drift King', commonFriend: 'Sparky' },
	{ id: 'rp2', name: 'Grip Master', commonFriend: 'Sparky' },
];

export class Page06PartyController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page06PartyView} */
		this._view = null;

		/** @type {'open'|'friends'|'invite'} */
		this._privacy = 'friends';

		/** @type {boolean} */
		this._voiceActive = true;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page06PartyView();

	}

	bindEvents() {

		const view = this._view;

		// INVITE button
		this._addListener( view.inviteBtn.el, 'click', () => {

			this._handleInvite();

		} );

		// PARTY PRIVACY toggle
		this._addListener( view.privacyBtn.el, 'click', () => {

			this._handlePrivacyToggle();

		} );

		// JOIN SESSION buttons are bound after setJoinableSessions().
		// Re-bound via _bindJoinBtns() in render().

	}

	loadData() {

		// All data is synchronous MockData — nothing to fetch.
		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Party members — reuse lobbyMembers shape.
		view.setPartyMembers( MockData.lobbyMembers );

		// Voice status.
		view.setVoiceStatus( this._voiceActive, 'Active / All Speakers On' );

		// Party privacy.
		view.setPrivacy( this._privacy );

		// Joinable sessions.
		view.setJoinableSessions( MOCK_SESSIONS );
		this._bindJoinBtns();

		// Recent players.
		view.setRecentPlayers( MOCK_RECENT_PLAYERS );

		// Friends list.
		view.setFriends( MockData.friends );

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.PARTY );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	_handleInvite() {

		this._analytics?.track( EventIds.FRIEND_INVITED );
		this.openModal( { id: ModalIds.MEMBER_ACTIONS } );

		this.showToast( {
			message:  'INVITE SENT!',
			variant:  'success',
			duration: 2500,
		} );

	}

	_handlePrivacyToggle() {

		const order = [ 'open', 'friends', 'invite' ];
		const idx = order.indexOf( this._privacy );
		this._privacy = order[ ( idx + 1 ) % order.length ];

		this._view.setPrivacy( this._privacy );
		this._analytics?.track( EventIds.PARTY_PRIVACY_CHANGED, { privacy: this._privacy } );

	}

	/**
	 * @param {string} sessionId
	 */
	_handleJoinSession( sessionId ) {

		this._analytics?.track( EventIds.SESSION_JOINED, { sessionId } );
		this.navigate( RouteIds.LOBBY );

	}

	// ---------------------------------------------------------------------------
	// Join button binding (dynamic)
	// ---------------------------------------------------------------------------

	_bindJoinBtns() {

		for ( const btn of this._view.joinSessionBtns ) {

			this._addListener( btn.el, 'click', () => {

				this._handleJoinSession( btn.el.dataset.sessionId );

			} );

		}

	}

}
