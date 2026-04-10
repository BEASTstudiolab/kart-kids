/**
 * LobbyOverlay -- non-modal slide-up panel for PRIVATE mode lobbies.
 *
 * Positioned fixed at the bottom, z-index 40 (below tab bar at 50) so
 * the tab bar remains clickable underneath (R17c). Does NOT use ModalService
 * because focus trap and scroll lock would block tab bar interaction.
 *
 * Includes an inline "join existing room" option so guests can enter
 * a room code without leaving the overlay.
 *
 * Lifecycle:
 *   constructor(container, services)
 *   show(networkClient)   -- connect, create room, display overlay
 *   hide()                -- dismiss overlay, leave room
 *   dispose()             -- full cleanup
 */

import { sanitizePlayerName }  from '../utils/sanitize.js';
import { Settings }            from '../../Settings.js';
import { getRandomTrack }      from '../../TrackRegistry.js';
import { NetworkClient }       from '../../Network.js';
import { TrackSelectOverlay }  from './TrackSelectOverlay.js';

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
				top: var(--space-6, 24px);
				right: var(--space-6, 24px);
				z-index: 40;
				background: var(--color-bg-surface, #1a1a2e);
				border-radius: var(--radius-lg, 16px);
				padding: var(--space-6, 24px);
				width: 320px;
				max-height: calc(100vh - 48px);
				overflow-y: auto;
				box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
				opacity: 0;
				transform: translateX(20px);
				transition:
					opacity var(--duration-normal, 300ms) var(--ease-standard, ease),
					transform var(--duration-normal, 300ms) var(--ease-standard, ease);
				pointer-events: none;
			}

			.kk-lobby-overlay--visible {
				opacity: 1;
				transform: translateX(0);
				pointer-events: auto;
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
				transition: background var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-lobby-overlay__track-info--host {
				cursor: pointer;
			}

			.kk-lobby-overlay__track-info--host:hover {
				background: rgba(255, 255, 255, 0.10);
			}

			.kk-lobby-overlay__track-info--host:active {
				opacity: 0.7;
			}

			.kk-lobby-overlay__track-name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-md, 1rem);
				font-weight: var(--weight-semibold, 600);
				color: var(--color-white, #fff);
				flex: 1;
			}

			.kk-lobby-overlay__track-change {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-300, #aaa);
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

			/* ── Join existing room link ───────────────────────────── */

			.kk-lobby-overlay__join-link {
				display: block;
				width: 100%;
				margin-top: var(--space-3, 12px);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-semibold, 600);
				color: var(--color-ink-300, #aaa);
				background: none;
				border: none;
				cursor: pointer;
				text-align: center;
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				padding: var(--space-2, 8px);
				transition: color var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-lobby-overlay__join-link:hover {
				color: var(--color-white, #fff);
			}

			/* ── Join input row (hidden by default) ────────────────── */

			.kk-lobby-overlay__join-row {
				display: flex;
				gap: var(--space-2, 8px);
				margin-top: var(--space-3, 12px);
			}

			.kk-lobby-overlay__join-input {
				flex: 1;
				font-family: var(--font-mono, monospace);
				font-size: var(--text-lg, 1.25rem);
				letter-spacing: 0.15em;
				text-align: center;
				padding: var(--space-3, 12px);
				background: rgba(255, 255, 255, 0.06);
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: var(--radius-md, 8px);
				color: var(--color-white, #fff);
				outline: none;
				box-sizing: border-box;
			}

			.kk-lobby-overlay__join-input:focus {
				border-color: rgba(255, 160, 40, 0.6);
			}

			.kk-lobby-overlay__join-go {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-cta-primary-text, #fff);
				background: var(--color-cta-primary, #4a6cf7);
				border: none;
				border-radius: var(--radius-md, 8px);
				padding: var(--space-3, 12px) var(--space-4, 16px);
				cursor: pointer;
				min-height: var(--hit-target-min, 44px);
			}

			.kk-lobby-overlay__join-go:active {
				opacity: 0.7;
			}

			/* ── 3D scene mode — transparent background ────────────── */

			.kk-lobby-overlay--3d {
				background: rgba(26, 26, 46, 0.65);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
			}

			.kk-lobby-overlay--3d .kk-lobby-overlay__title,
			.kk-lobby-overlay--3d .kk-lobby-overlay__code-value,
			.kk-lobby-overlay--3d .kk-lobby-overlay__member {
				text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
			}

			/* ── Fade overlay for race transition ──────────────────── */

			.kk-lobby-fade {
				position: fixed;
				inset: 0;
				z-index: 50;
				background: #000;
				opacity: 0;
				transition: opacity 300ms ease;
				pointer-events: none;
			}

			.kk-lobby-fade--active {
				opacity: 1;
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

		// Track info card (compact, tappable for hosts)
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

		const trackChange = document.createElement( 'span' );
		trackChange.className = 'kk-lobby-overlay__track-change';
		trackChange.textContent = 'CHANGE';
		trackInfo.appendChild( trackChange );
		this._trackChangeEl = trackChange;

		trackInfo.addEventListener( 'click', () => this._handleTrackChange() );

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

		// "Join existing room" link — toggles an inline code input
		const joinLink = document.createElement( 'button' );
		joinLink.type = 'button';
		joinLink.className = 'kk-lobby-overlay__join-link';
		joinLink.textContent = 'or join an existing room';
		el.appendChild( joinLink );
		this._joinLink = joinLink;

		// Join input row (hidden until link is clicked)
		const joinRow = document.createElement( 'div' );
		joinRow.className = 'kk-lobby-overlay__join-row';
		joinRow.style.display = 'none';

		const joinInput = document.createElement( 'input' );
		joinInput.type = 'text';
		joinInput.className = 'kk-lobby-overlay__join-input';
		joinInput.placeholder = 'Room code';
		joinInput.autocomplete = 'off';
		joinRow.appendChild( joinInput );
		this._joinInput = joinInput;

		const joinGoBtn = document.createElement( 'button' );
		joinGoBtn.type = 'button';
		joinGoBtn.className = 'kk-lobby-overlay__join-go';
		joinGoBtn.textContent = 'JOIN';
		joinRow.appendChild( joinGoBtn );

		el.appendChild( joinRow );
		this._joinRow = joinRow;

		// Toggle join input visibility
		joinLink.addEventListener( 'click', () => {

			joinRow.style.display = '';
			joinLink.style.display = 'none';
			joinInput.focus();

		} );

		// Join action
		const doJoin = () => this._handleJoinExisting( joinInput.value.trim() );
		joinGoBtn.addEventListener( 'click', doJoin );
		joinInput.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) doJoin();

		} );

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
	 * @param {import('../PartyLobbyScene.js').PartyLobbyScene} [opts.partyLobbyScene]  3D lobby scene for kart display
	 */
	async show( networkClient, opts = {} ) {

		this._network = networkClient;
		this._visible = true;
		this._partyLobbyScene = opts.partyLobbyScene || null;

		// Reset state
		this._members = [];
		this._roomCode = null;
		this._isHost = opts.isHost !== false;
		this._trackData = opts.trackData || null;

		// Mount into container if not already there
		if ( this._el && ! this._el.parentNode ) {

			this._container.appendChild( this._el );

		}

		// Show host-only controls
		if ( this._startBtn ) this._startBtn.style.display = this._isHost ? '' : 'none';
		if ( this._joinLink ) this._joinLink.style.display = this._isHost ? '' : 'none';
		if ( this._joinRow ) this._joinRow.style.display = 'none';
		if ( this._joinInput ) this._joinInput.value = '';

		// Add local player to member list
		const settings = new Settings();
		const displayName = settings.getDisplayName() || 'Player';
		this._members.push( {
			id:   'local',
			name: displayName,
		} );
		this._renderMembers();

		// Apply 3D mode class if party lobby scene is active
		if ( this._el ) {

			this._el.classList.toggle( 'kk-lobby-overlay--3d', !! this._partyLobbyScene );

		}

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

		// Dispose 3D party lobby scene
		this._services.hidePartyLobby?.();
		this._partyLobbyScene = null;

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
		this._trackChangeEl = null;
		this._trackData = null;

		if ( this._trackSelectOverlay ) {

			this._trackSelectOverlay.dispose();
			this._trackSelectOverlay = null;

		}

		this._joinLink = null;
		this._joinRow = null;
		this._joinInput = null;

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

		// Add remote kart to the 3D party lobby scene
		this._partyLobbyScene?.addRemoteKart( msg.playerId );

	}

	_handlePlayerLeave( msg ) {

		this._members = this._members.filter( ( m ) => m.id !== msg.playerId );
		this._renderMembers();

		// Remove kart from the 3D party lobby scene
		this._partyLobbyScene?.removeKart( msg.playerId );

	}

	_handleRaceStart( msg ) {

		// Race triggered by server or host -- start game
		this._visible = false;
		this._unwireNetworkEvents();

		// Build race config before fade (capture references while still valid)
		const settings = new Settings();
		const vehicleId = settings.getSelectedKartId();
		const fallbackTrack = getRandomTrack();

		const trackCells = msg.trackData
			?? ( this._trackData ? this._trackData.cells : null )
			?? fallbackTrack.cells;

		const decoCells = msg.decoCells
			?? ( this._trackData ? this._trackData.decoCells : null )
			?? fallbackTrack.decoCells;

		const raceConfig = {
			mode:      'private',
			trackData: trackCells,
			decoCells: decoCells,
			vehicleId,
			roomCode:  this._roomCode,
			network:   this._network,
		};

		// Fade to black, then start race
		const fade = document.createElement( 'div' );
		fade.className = 'kk-lobby-fade';
		document.body.appendChild( fade );

		// Trigger the fade animation
		requestAnimationFrame( () => {

			fade.classList.add( 'kk-lobby-fade--active' );

		} );

		// After fade completes, clean up and start race
		setTimeout( () => {

			// Dispose 3D party lobby scene
			this._services.hidePartyLobby?.();
			this._partyLobbyScene = null;

			// Hide and remove overlay
			if ( this._el ) {

				this._el.classList.remove( 'kk-lobby-overlay--visible' );
				this._el.classList.remove( 'kk-lobby-overlay--3d' );

			}

			if ( this._el && this._el.parentNode ) {

				this._el.parentNode.removeChild( this._el );

			}

			// Start the race
			this._services.startRace( raceConfig );

			// Fade out the black overlay after a brief hold
			setTimeout( () => {

				fade.classList.remove( 'kk-lobby-fade--active' );
				setTimeout( () => fade.remove(), 350 );

			}, 200 );

		}, 350 );

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

	/**
	 * Open TrackSelectOverlay to let the host change the track.
	 */
	_handleTrackChange() {

		if ( ! this._isHost ) return;

		if ( ! this._trackSelectOverlay ) {

			this._trackSelectOverlay = new TrackSelectOverlay( this._container, this._services );

		}

		this._trackSelectOverlay.show( ( track ) => {

			this._trackData = track;
			this._updateTrackInfo();

		} );

	}

	/**
	 * Join an existing room by code (triggered from inline input).
	 *
	 * @param {string} code  Room code entered by the user.
	 */
	async _handleJoinExisting( code ) {

		if ( ! code ) {

			if ( this._joinInput ) this._joinInput.focus();
			return;

		}

		try {

			// Create or reuse network client
			if ( ! this._network ) {

				this._network = new NetworkClient();

			}

			if ( ! this._network.connected ) {

				await this._network.connect();

			}

			// Leave current room if hosting
			if ( this._roomCode ) {

				this._network.leaveRoom();

			}

			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();

			await this._network.joinRoom( code, vehicleId );

			// Switch to guest mode
			this._isHost = false;
			this._roomCode = code;
			this._trackData = null;

			if ( this._roomCodeEl ) this._roomCodeEl.textContent = code;
			if ( this._startBtn ) this._startBtn.style.display = 'none';
			if ( this._joinRow ) this._joinRow.style.display = 'none';
			if ( this._joinLink ) this._joinLink.style.display = 'none';

			// Track card becomes read-only (no CHANGE, not interactive)
			if ( this._trackInfoEl ) {

				this._trackInfoEl.classList.remove( 'kk-lobby-overlay__track-info--host' );

			}

			if ( this._trackChangeEl ) this._trackChangeEl.style.display = 'none';

		} catch ( err ) {

			console.warn( '[LobbyOverlay] Join room failed:', err.message );
			this._services.notification.show( {
				message:  'Failed to join room: ' + ( err.message || 'Invalid code' ),
				variant:  'error',
				duration: 3000,
			} );

		}

	}

	_updateTrackInfo() {

		if ( ! this._trackInfoEl || ! this._trackNameEl ) return;

		if ( this._trackData && this._trackData.name ) {

			this._trackNameEl.textContent = this._trackData.name;
			this._trackInfoEl.style.display = '';

			// Host gets interactive card with CHANGE indicator
			this._trackInfoEl.classList.toggle( 'kk-lobby-overlay__track-info--host', this._isHost );
			if ( this._trackChangeEl ) this._trackChangeEl.style.display = this._isHost ? '' : 'none';

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
