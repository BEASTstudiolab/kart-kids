/**
 * RacePanel — RACE tab content panel.
 *
 * Renders:
 *   - Transparent content area (3D kart preview shows through from behind)
 *   - Three stacked mode buttons: RACE, FREE PLAY, PARTY
 *
 * Mode behaviour:
 *   RACE      — online matchmaking via NetworkClient.findRoom()
 *   FREE PLAY — opens track select, starts solo race
 *   PARTY     — opens track select, starts private lobby
 *
 * Lifecycle:
 *   constructor(container, services) — builds DOM into the panel container
 *   show()    — called when tab switches to RACE
 *   hide()    — called when tab switches away
 *   dispose() — cleanup
 */

import { HudButton }            from '../components/HudButton.js';
import { LoadingOverlay }       from '../components/LoadingOverlay.js';
import { LobbyOverlay }        from '../overlays/LobbyOverlay.js';
import { TrackSelectOverlay }   from '../overlays/TrackSelectOverlay.js';
import { Settings }             from '../../Settings.js';
import { getRandomTrack }       from '../../TrackRegistry.js';
import { NetworkClient }        from '../../Network.js';

export class RacePanel {

	static _cssInjected = false;

	/**
	 * @param {HTMLElement} container  The panel div (id="kk-panel-race")
	 * @param {object}      services   AppShell service bag
	 */
	constructor( container, services ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {NetworkClient | null} */
		this._network = null;

		/** @type {LoadingOverlay | null} */
		this._matchmakingOverlay = null;

		/** @type {LobbyOverlay | null} */
		this._lobbyOverlay = null;

		/** @type {HudButton | null} */
		this._raceBtn = null;

		/** @type {TrackSelectOverlay | null} */
		this._trackSelectOverlay = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS injection
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( RacePanel._cssInjected ) return;
		RacePanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* ── PLAY screen — minimal controls, bottom-right ─────────── */

			.kk-race-panel {
				position: absolute;
				bottom: 0;
				right: 0;
				display: flex;
				flex-direction: column;
				justify-content: flex-end;
				gap: var(--space-3);
				padding: var(--space-6);
				padding-bottom: var(--space-8);
				box-sizing: border-box;
				pointer-events: none;
				width: 240px;
			}

			.kk-race-panel > * {
				pointer-events: auto;
			}

			/* ── Mode buttons (stacked) ────────────────────────────────── */

			.kk-race-panel__mode-btn {
				width: 100%;
			}

			.kk-race-panel__mode-btn .kk-hud-button {
				width: 100%;
			}

			@media ( prefers-reduced-motion: reduce ) {

				.kk-race-panel__mode-btn .kk-hud-button {
					transition: none;
				}

			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// DOM construction
	// ---------------------------------------------------------------------------

	_build() {

		const root = document.createElement( 'div' );
		root.className = 'kk-race-panel';

		// RACE button (online matchmaking)
		const raceWrap = document.createElement( 'div' );
		raceWrap.className = 'kk-race-panel__mode-btn';
		this._raceBtn = new HudButton( {
			text:    'RACE',
			color:   '--color-accent-orange',
			onClick: () => this._handleOnlineRace(),
		} );
		raceWrap.appendChild( this._raceBtn.el );
		root.appendChild( raceWrap );

		// FREE PLAY button (solo)
		const freeWrap = document.createElement( 'div' );
		freeWrap.className = 'kk-race-panel__mode-btn';
		this._freePlayBtn = new HudButton( {
			text:    'FREE PLAY',
			color:   '--color-accent-orange',
			onClick: () => this._handleFreePlay(),
		} );
		freeWrap.appendChild( this._freePlayBtn.el );
		root.appendChild( freeWrap );

		// PARTY button (private lobby)
		const partyWrap = document.createElement( 'div' );
		partyWrap.className = 'kk-race-panel__mode-btn';
		this._partyBtn = new HudButton( {
			text:    'PARTY',
			color:   '--color-accent-orange',
			onClick: () => this._handleParty(),
		} );
		partyWrap.appendChild( this._partyBtn.el );
		root.appendChild( partyWrap );

		this._container.appendChild( root );
		this._root = root;

	}

	// ---------------------------------------------------------------------------
	// Mode button handlers
	// ---------------------------------------------------------------------------

	/**
	 * RACE — online matchmaking.
	 */
	async _handleOnlineRace() {

		await this._startOnlineMatchmaking();

	}

	/**
	 * FREE PLAY — solo race with track selection.
	 */
	_handleFreePlay() {

		this._openTrackSelect( ( track ) => {

			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();

			this._services.startRace( {
				mode:      'solo',
				trackData: track.cells,
				decoCells: track.decoCells,
				vehicleId,
			} );

		} );

	}

	/**
	 * PARTY — lobby first with 3D starting grid scene.
	 */
	async _handleParty() {

		const track = getRandomTrack();

		// Create the 3D party lobby scene with the local player's kart
		this._partyScene = this._services.showPartyLobby?.() || null;
		if ( this._partyScene ) {

			const settings = new Settings();
			this._partyScene.setLocalKart( settings.getSelectedKartId() );

		}

		await this._startPrivateLobby( track );

	}

	/**
	 * Open the track selection overlay. Calls onConfirm(trackData) when the user picks a track.
	 *
	 * @param {Function} onConfirm  Callback with resolved track data.
	 */
	_openTrackSelect( onConfirm ) {

		if ( ! this._trackSelectOverlay ) {

			const shell = this._container.closest( '#kk-app-shell' ) || document.body;
			this._trackSelectOverlay = new TrackSelectOverlay( shell, this._services );

		}

		this._trackSelectOverlay.show( onConfirm );

	}

	// ---------------------------------------------------------------------------
	// ONLINE matchmaking
	// ---------------------------------------------------------------------------

	async _startOnlineMatchmaking() {

		// Show matchmaking overlay
		this._matchmakingOverlay = new LoadingOverlay( {
			message:  'Finding match...',
			onCancel: () => this._cancelMatchmaking(),
		} );
		this._matchmakingOverlay.show();

		try {

			// Create NetworkClient on demand (same pattern as Page03QuickPlayController)
			if ( ! this._network ) {

				this._network = new NetworkClient();

			}

			if ( ! this._network.connected ) {

				await this._network.connect();

			}

			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();
			this._network.setDisplayName( settings.getDisplayName() || '' );
			const result = await this._network.findRoom( vehicleId );

			// Hide and dispose overlay, then start the race
			this._matchmakingOverlay.hide();
			this._matchmakingOverlay.dispose();
			this._matchmakingOverlay = null;

			this._services.startRace( {
				mode:        'online',
				trackData:   result.trackData ?? getRandomTrack().cells,
				vehicleId,
				playerCount: result.playerCount || 1,
				roomCode:    result.roomCode,
				network:     this._network,
			} );

		} catch ( err ) {

			console.warn( '[RacePanel] Matchmaking failed:', err.message );

			if ( this._matchmakingOverlay ) {

				this._matchmakingOverlay.hide();
				this._matchmakingOverlay.dispose();
				this._matchmakingOverlay = null;

			}

			// Fallback: start a solo race with AI fill on the default track.
			// Don't pass trackData — let GameEngine use the built-in TRACK_CELLS
			// so TrackIntel gets the full unmodified cell data (custom cells path
			// runs deriveRampCells which can break connectivity).
			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();

			this._services.startRace( {
				mode:        'online',
				vehicleId,
				playerCount: 1,
			} );

		}

	}

	_cancelMatchmaking() {

		if ( this._matchmakingOverlay ) {

			this._matchmakingOverlay.hide();
			this._matchmakingOverlay.dispose();
			this._matchmakingOverlay = null;

		}

		// Disconnect the network client if we created one
		if ( this._network ) {

			this._network.disconnect();
			this._network = null;

		}

	}

	// ---------------------------------------------------------------------------
	// PRIVATE lobby
	// ---------------------------------------------------------------------------

	/**
	 * @param {object} track  Resolved track data from TrackSelectOverlay.
	 */
	async _startPrivateLobby( track ) {

		// Create a NetworkClient on demand.
		if ( ! this._network ) {

			this._network = new NetworkClient();

		}

		// Create LobbyOverlay if needed.
		if ( ! this._lobbyOverlay ) {

			const shell = this._container.closest( '#kk-app-shell' ) || document.body;
			this._lobbyOverlay = new LobbyOverlay( shell, this._services );

		}

		this._lobbyOverlay.show( this._network, {
			trackData:        track,
			isHost:           true,
			partyLobbyScene:  this._partyScene || null,
		} );

	}


	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Called when the RACE tab becomes active.
	 */
	show() {

		// Nothing to sync — buttons are always visible.

	}

	/**
	 * Called when the RACE tab is hidden.
	 */
	hide() {

		// Nothing to pause — 3D preview is managed by AppShell render loop.

	}

	/**
	 * Full cleanup.
	 */
	dispose() {

		if ( this._raceBtn ) { this._raceBtn.dispose(); this._raceBtn = null; }
		if ( this._freePlayBtn ) { this._freePlayBtn.dispose(); this._freePlayBtn = null; }
		if ( this._partyBtn ) { this._partyBtn.dispose(); this._partyBtn = null; }

		if ( this._matchmakingOverlay ) {

			this._matchmakingOverlay.dispose();
			this._matchmakingOverlay = null;

		}

		if ( this._lobbyOverlay ) {

			this._lobbyOverlay.dispose();
			this._lobbyOverlay = null;

		}

		if ( this._network ) {

			this._network.disconnect();
			this._network = null;

		}

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		if ( this._trackSelectOverlay ) {

			this._trackSelectOverlay.dispose();
			this._trackSelectOverlay = null;

		}

		this._root = null;

	}

}
