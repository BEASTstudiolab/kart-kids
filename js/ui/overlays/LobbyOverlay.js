/**
 * LobbyOverlay -- non-modal slide-up panel for PRIVATE mode lobbies.
 *
 * Positioned fixed at the bottom, z-index 40 (below tab bar at 50) so
 * the tab bar remains clickable underneath (R17c). Does NOT use ModalService
 * because focus trap and scroll lock would block tab bar interaction.
 *
 * Lifecycle:
 *   constructor(container, services)
 *   show(networkClient)   -- connect, create room, display overlay
 *   hide()                -- dismiss overlay, leave room
 *   dispose()             -- full cleanup
 *
 * Extracts room management logic from Page05LobbyController/View.
 */

import { sanitizePlayerName } from '../utils/sanitize.js';
import { Settings }           from '../../Settings.js';
import { getRandomTrack }     from '../../TrackRegistry.js';

export class LobbyOverlay {

	static _cssInjected = false;

	/**
	 * @param {HTMLElement} container  Shell element to append overlay into
	 * @param {object}      services   AppShell service bag
	 */
	constructor( container, services ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {import('../../Network.js').NetworkClient | null} */
		this._network = null;

		/** @type {string | null} */
		this._roomCode = null;

		/** @type {boolean} */
		this._isHost = true;

		/** @type {Array<{id:string, name:string}>} */
		this._members = [];

		/** @type {HTMLElement | null} */
		this._el = null;

		/** @type {HTMLElement | null} */
		this._roomCodeEl = null;

		/** @type {HTMLElement | null} */
		this._memberListEl = null;

		/** @type {HTMLButtonElement | null} */
		this._startBtn = null;

		/** @type {HTMLButtonElement | null} */
		this._cancelBtn = null;

		/** @type {HTMLButtonElement | null} */
		this._copyBtn = null;

		/** @type {boolean} */
		this._visible = false;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS injection
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( LobbyOverlay._cssInjected ) return;
		LobbyOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			.kk-lobby-overlay {
				position: fixed;
				bottom: 0;
				left: 0;
				right: 0;
				z-index: 40;
				background: var(--color-bg-surface, #1a1a2e);
				border-top-left-radius: var(--radius-lg, 16px);
				border-top-right-radius: var(--radius-lg, 16px);
				padding: var(--space-6, 24px);
				transform: translateY(100%);
				transition: transform var(--duration-normal, 300ms) var(--ease-standard, ease);
				max-height: 60vh;
				overflow-y: auto;
				box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
			}

			.kk-lobby-overlay--visible {
				transform: translateY(0);
			}

			.kk-lobby-overlay__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--space-4, 16px);
			}

			.kk-lobby-overlay__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.25rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-white, #fff);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
				margin: 0;
			}

			.kk-lobby-overlay__room-code {
				display: flex;
				align-items: center;
				gap: var(--space-3, 12px);
				margin-bottom: var(--space-4, 16px);
				padding: var(--space-3, 12px);
				background: rgba(255, 255, 255, 0.06);
				border-radius: var(--radius-md, 8px);
			}

			.kk-lobby-overlay__code-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-300, #aaa);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
			}

			.kk-lobby-overlay__code-value {
				font-family: var(--font-mono, monospace);
				font-size: var(--text-xl, 1.5rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-white, #fff);
				letter-spacing: 0.15em;
				flex: 1;
			}

			.kk-lobby-overlay__copy-btn {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-cta-primary-text, #fff);
				background: var(--color-cta-primary, #4a6cf7);
				border: none;
				border-radius: var(--radius-sm, 4px);
				padding: var(--space-2, 8px) var(--space-3, 12px);
				cursor: pointer;
				min-height: var(--hit-target-min, 44px);
				transition: opacity var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-lobby-overlay__copy-btn:active {
				opacity: 0.7;
			}

			.kk-lobby-overlay__track-info {
				display: flex;
				align-items: center;
				gap: var(--space-3, 12px);
				margin-bottom: var(--space-4, 16px);
				padding: var(--space-3, 12px);
				background: rgba(255, 255, 255, 0.06);
				border-radius: var(--radius-md, 8px);
			}

			.kk-lobby-overlay__track-name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-md, 1rem);
				font-weight: var(--weight-semibold, 600);
				color: var(--color-white, #fff);
				flex: 1;
			}

			.kk-lobby-overlay__members {
				margin-bottom: var(--space-4, 16px);
			}

			.kk-lobby-overlay__members-title {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-300, #aaa);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				margin-bottom: var(--space-2, 8px);
			}

			.kk-lobby-overlay__member-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 8px);
			}

			.kk-lobby-overlay__member {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-md, 1rem);
				color: var(--color-white, #fff);
				padding: var(--space-2, 8px) var(--space-3, 12px);
				background: rgba(255, 255, 255, 0.04);
				border-radius: var(--radius-sm, 4px);
			}

			.kk-lobby-overlay__actions {
				display: flex;
				gap: var(--space-3, 12px);
				margin-top: var(--space-4, 16px);
			}

			.kk-lobby-overlay__btn {
				flex: 1;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-md, 1rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				border: none;
				border-radius: var(--radius-md, 8px);
				padding: var(--space-3, 12px) var(--space-4, 16px);
				cursor: pointer;
				min-height: var(--hit-target-min, 44px);
				transition: opacity var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-lobby-overlay__btn:active {
				opacity: 0.7;
			}

			.kk-lobby-overlay__btn--start {
				color: var(--color-cta-primary-text, #fff);
				background: var(--color-cta-primary, #4a6cf7);
			}

			.kk-lobby-overlay__btn--cancel {
				color: var(--color-ink-200, #ccc);
				background: rgba(255, 255, 255, 0.08);
			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// DOM construction
	// ---------------------------------------------------------------------------

	_build() {

		const el = document.createElement( 'div' );
		el.className = 'kk-lobby-overlay';
		el.setAttribute( 'role', 'region' );
		el.setAttribute( 'aria-label', 'Private lobby' );

		// Header
		const header = document.createElement( 'div' );
		header.className = 'kk-lobby-overlay__header';

		const title = document.createElement( 'h2' );
		title.className = 'kk-lobby-overlay__title';
		title.textContent = 'PRIVATE LOBBY';
		header.appendChild( title );

		el.appendChild( header );

		// Room code row
		const roomCodeRow = document.createElement( 'div' );
		roomCodeRow.className = 'kk-lobby-overlay__room-code';

		const codeLabel = document.createElement( 'span' );
		codeLabel.className = 'kk-lobby-overlay__code-label';
		codeLabel.textContent = 'Room Code';
		roomCodeRow.appendChild( codeLabel );

		const codeValue = document.createElement( 'span' );
		codeValue.className = 'kk-lobby-overlay__code-value';
		codeValue.textContent = '----';
		roomCodeRow.appendChild( codeValue );
		this._roomCodeEl = codeValue;

		const copyBtn = document.createElement( 'button' );
		copyBtn.type = 'button';
		copyBtn.className = 'kk-lobby-overlay__copy-btn';
		copyBtn.textContent = 'COPY';
		copyBtn.setAttribute( 'aria-label', 'Copy room code to clipboard' );
		copyBtn.addEventListener( 'click', () => this._copyRoomCode() );
		roomCodeRow.appendChild( copyBtn );
		this._copyBtn = copyBtn;

		el.appendChild( roomCodeRow );

		// Track info section (shows track name to all lobby members)
		const trackInfo = document.createElement( 'div' );
		trackInfo.className = 'kk-lobby-overlay__track-info';
		trackInfo.style.display = 'none';

		const trackLabel = document.createElement( 'span' );
		trackLabel.className = 'kk-lobby-overlay__code-label';
		trackLabel.textContent = 'Track';
		trackInfo.appendChild( trackLabel );

		const trackName = document.createElement( 'span' );
		trackName.className = 'kk-lobby-overlay__track-name';
		trackName.textContent = '';
		trackInfo.appendChild( trackName );

		el.appendChild( trackInfo );
		this._trackInfoEl = trackInfo;
		this._trackNameEl = trackName;

		// Members section
		const membersSection = document.createElement( 'div' );
		membersSection.className = 'kk-lobby-overlay__members';

		const membersTitle = document.createElement( 'div' );
		membersTitle.className = 'kk-lobby-overlay__members-title';
		membersTitle.textContent = 'Players';
		membersSection.appendChild( membersTitle );

		const memberList = document.createElement( 'ul' );
		memberList.className = 'kk-lobby-overlay__member-list';
		membersSection.appendChild( memberList );
		this._memberListEl = memberList;

		el.appendChild( membersSection );

		// Action buttons
		const actions = document.createElement( 'div' );
		actions.className = 'kk-lobby-overlay__actions';

		const cancelBtn = document.createElement( 'button' );
		cancelBtn.type = 'button';
		cancelBtn.className = 'kk-lobby-overlay__btn kk-lobby-overlay__btn--cancel';
		cancelBtn.textContent = 'CANCEL';
		cancelBtn.addEventListener( 'click', () => this.hide() );
		actions.appendChild( cancelBtn );
		this._cancelBtn = cancelBtn;

		const startBtn = document.createElement( 'button' );
		startBtn.type = 'button';
		startBtn.className = 'kk-lobby-overlay__btn kk-lobby-overlay__btn--start';
		startBtn.textContent = 'START';
		startBtn.style.display = 'none';
		startBtn.addEventListener( 'click', () => this._handleStart() );
		actions.appendChild( startBtn );
		this._startBtn = startBtn;

		el.appendChild( actions );

		this._el = el;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Show the lobby overlay. Connects network, creates room (host) or waits (guest).
	 *
	 * @param {import('../../Network.js').NetworkClient} networkClient
	 * @param {object}  [opts]
	 * @param {object}  [opts.trackData]  Resolved track data { name, cells, decoCells, source }
	 * @param {boolean} [opts.isHost]     True for host (default), false for guest
	 */
	async show( networkClient, opts = {} ) {

		this._network = networkClient;
		this._visible = true;

		// Reset state
		this._members = [];
		this._roomCode = null;
		this._isHost = opts.isHost !== false;
		this._trackData = opts.trackData || null;

		// Mount into container if not already there
		if ( this._el && ! this._el.parentNode ) {

			this._container.appendChild( this._el );

		}

		// Show host START button
		if ( this._startBtn ) {

			this._startBtn.style.display = this._isHost ? '' : 'none';

		}

		// Add local player to member list
		const settings = new Settings();
		const displayName = settings.getDisplayName() || 'Player';
		this._members.push( {
			id:   'local',
			name: displayName,
		} );
		this._renderMembers();

		// Slide up
		requestAnimationFrame( () => {

			if ( this._el ) {

				this._el.classList.add( 'kk-lobby-overlay--visible' );

			}

		} );

		// Update track info display
		this._updateTrackInfo();

		// Wire network callbacks
		this._wireNetworkEvents();

		if ( this._isHost ) {

			// Host path: create room
			try {

				if ( ! this._network.connected ) {

					await this._network.connect();

				}

				const roomCode = await this._network.createRoom();
				this._roomCode = roomCode;

				if ( this._roomCodeEl ) {

					this._roomCodeEl.textContent = roomCode;

				}

			} catch ( err ) {

				console.warn( '[LobbyOverlay] Failed to create room:', err.message );
				this._services.notification.show( {
					message:  'Failed to create room: ' + ( err.message || 'Unknown error' ),
					variant:  'error',
					duration: 3000,
				} );
				this.hide();

			}

		} else {

			// Guest path: joinRoom was already called by RacePanel before show()
			// Show waiting state — room code will be updated if server provides it
			if ( this._roomCodeEl ) {

				this._roomCodeEl.textContent = 'JOINED';

			}

		}

	}

	/**
	 * Hide the overlay and leave the room.
	 */
	hide() {

		if ( ! this._visible ) return;
		this._visible = false;

		// Leave room
		if ( this._network ) {

			this._network.leaveRoom();

		}

		this._unwireNetworkEvents();

		// Slide down
		if ( this._el ) {

			this._el.classList.remove( 'kk-lobby-overlay--visible' );

		}

		// Remove from DOM after transition
		setTimeout( () => {

			if ( this._el && this._el.parentNode ) {

				this._el.parentNode.removeChild( this._el );

			}

		}, 350 );

	}

	/**
	 * Full cleanup.
	 */
	dispose() {

		this.hide();

		if ( this._network ) {

			this._network.disconnect();
			this._network = null;

		}

		if ( this._el && this._el.parentNode ) {

			this._el.parentNode.removeChild( this._el );

		}

		this._el = null;
		this._roomCodeEl = null;
		this._memberListEl = null;
		this._startBtn = null;
		this._cancelBtn = null;
		this._copyBtn = null;
		this._trackInfoEl = null;
		this._trackNameEl = null;
		this._trackData = null;

	}

	// ---------------------------------------------------------------------------
	// Network event wiring
	// ---------------------------------------------------------------------------

	_wireNetworkEvents() {

		if ( ! this._network ) return;

		this._onPlayerJoinBound = ( msg ) => this._handlePlayerJoin( msg );
		this._onPlayerLeaveBound = ( msg ) => this._handlePlayerLeave( msg );
		this._onRaceStartBound = ( msg ) => this._handleRaceStart( msg );
		this._onDisconnectBound = () => this._handleDisconnect();

		this._network.onPlayerJoin = this._onPlayerJoinBound;
		this._network.onPlayerLeave = this._onPlayerLeaveBound;
		this._network.onRaceStart = this._onRaceStartBound;
		this._network.onDisconnect = this._onDisconnectBound;

	}

	_unwireNetworkEvents() {

		if ( ! this._network ) return;

		if ( this._network.onPlayerJoin === this._onPlayerJoinBound ) this._network.onPlayerJoin = null;
		if ( this._network.onPlayerLeave === this._onPlayerLeaveBound ) this._network.onPlayerLeave = null;
		if ( this._network.onRaceStart === this._onRaceStartBound ) this._network.onRaceStart = null;
		if ( this._network.onDisconnect === this._onDisconnectBound ) this._network.onDisconnect = null;

	}

	// ---------------------------------------------------------------------------
	// Network event handlers
	// ---------------------------------------------------------------------------

	_handlePlayerJoin( msg ) {

		const existing = this._members.find( ( m ) => m.id === msg.playerId );
		if ( ! existing ) {

			this._members.push( {
				id:   msg.playerId,
				name: msg.name ?? `Player ${this._members.length + 1}`,
			} );

		}

		this._renderMembers();

	}

	_handlePlayerLeave( msg ) {

		this._members = this._members.filter( ( m ) => m.id !== msg.playerId );
		this._renderMembers();

	}

	_handleRaceStart( msg ) {

		// Race triggered by server or host -- start game
		this._visible = false;
		this._unwireNetworkEvents();

		if ( this._el ) {

			this._el.classList.remove( 'kk-lobby-overlay--visible' );

		}

		setTimeout( () => {

			if ( this._el && this._el.parentNode ) {

				this._el.parentNode.removeChild( this._el );

			}

		}, 350 );

		const settings = new Settings();
		const vehicleId = settings.getSelectedKartId();
		const fallbackTrack = getRandomTrack();

		// Prefer server-provided track data, then host's local track data, then random fallback
		const trackCells = msg.trackData
			?? ( this._trackData ? this._trackData.cells : null )
			?? fallbackTrack.cells;

		const decoCells = msg.decoCells
			?? ( this._trackData ? this._trackData.decoCells : null )
			?? fallbackTrack.decoCells;

		this._services.startRace( {
			mode:      'private',
			trackData: trackCells,
			decoCells: decoCells,
			vehicleId,
			roomCode:  this._roomCode,
			network:   this._network,
		} );

	}

	_handleDisconnect() {

		this._services.notification.show( {
			message:  'Disconnected from server',
			variant:  'error',
			duration: 3000,
		} );
		this.hide();

	}

	// ---------------------------------------------------------------------------
	// Internal methods
	// ---------------------------------------------------------------------------

	_handleStart() {

		if ( ! this._network || ! this._network.connected ) {

			this._services.notification.show( {
				message:  'Not connected to server',
				variant:  'error',
				duration: 2000,
			} );
			return;

		}

		// Host starts the race on the server — send track cell data
		const trackCells = this._trackData ? this._trackData.cells : null;
		this._network.startRace( trackCells );

	}

	_copyRoomCode() {

		if ( ! this._roomCode ) return;

		navigator.clipboard?.writeText( this._roomCode ).then( () => {

			this._services.notification.show( {
				message:  `Room code copied: ${this._roomCode}`,
				variant:  'success',
				duration: 2000,
			} );

		} ).catch( () => {

			this._services.notification.show( {
				message:  `Room code: ${this._roomCode}`,
				variant:  'info',
				duration: 3000,
			} );

		} );

	}

	_updateTrackInfo() {

		if ( ! this._trackInfoEl || ! this._trackNameEl ) return;

		if ( this._trackData && this._trackData.name ) {

			this._trackNameEl.textContent = this._trackData.name;
			this._trackInfoEl.style.display = '';

		} else {

			this._trackInfoEl.style.display = 'none';

		}

	}

	_renderMembers() {

		if ( ! this._memberListEl ) return;

		this._memberListEl.innerHTML = '';

		for ( const member of this._members ) {

			const li = document.createElement( 'li' );
			li.className = 'kk-lobby-overlay__member';
			li.textContent = sanitizePlayerName( member.name );
			this._memberListEl.appendChild( li );

		}

	}

}
