/**
 * RacePanel — RACE tab content panel.
 *
 * Renders:
 *   - Transparent content area (3D kart preview shows through from behind)
 *   - Player name display
 *   - Mode chip strip: SOLO | ONLINE | PRIVATE
 *   - Track preview card (tapping navigates to TRACKS tab)
 *   - Large RACE CTA button
 *
 * Mode behaviour:
 *   SOLO    — starts race immediately via services.startRace()
 *   ONLINE  — shows matchmaking overlay, connects via NetworkClient.findRoom()
 *   PRIVATE — placeholder toast (LobbyOverlay deferred to Unit 5)
 *
 * Lifecycle:
 *   constructor(container, services) — builds DOM into the panel container
 *   show()    — called when tab switches to RACE
 *   hide()    — called when tab switches away
 *   dispose() — cleanup
 */

import { HudButton }      from '../components/HudButton.js';
import { LoadingOverlay }  from '../components/LoadingOverlay.js';
import { LobbyOverlay }   from '../overlays/LobbyOverlay.js';
import { Settings }        from '../../Settings.js';
import { getRandomTrack, getTrackById, getTracks } from '../../TrackRegistry.js';
import { decodeCells }     from '../../TrackCodec.js';
import { getSavedTracks }  from '../../editor/Persistence.js';
import { NetworkClient }   from '../../Network.js';

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

		/** @type {HTMLElement | null} */
		this._trackNameEl = null;

		/** @type {HTMLButtonElement | null} */
		this._modeToggle = null;

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

			/* ── Right-side overlay panel (Fortnite-style) ─────────────── */

			.kk-race-panel {
				position: absolute;
				right: 0;
				top: 0;
				width: 260px;
				height: 100%;
				display: flex;
				flex-direction: column;
				justify-content: flex-end;
				padding: var(--space-6);
				padding-bottom: var(--space-8);
				box-sizing: border-box;
				pointer-events: none;
				gap: var(--space-4);
				background: rgba( 0, 0, 0, 0.35 );
				backdrop-filter: blur( 8px );
				-webkit-backdrop-filter: blur( 8px );
				border-left: 1px solid rgba( 255, 255, 255, 0.08 );
			}

			.kk-race-panel > * {
				pointer-events: auto;
			}

			/* ── Track info card ────────────────────────────────────────── */

			.kk-race-panel__track-info {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-race-panel__track-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.14em);
				color: var(--color-ink-400, #777);
			}

			.kk-race-panel__track-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
			}

			.kk-race-panel__track-change {
				background: none;
				border: none;
				color: var(--color-accent-cyan, #00d4e8);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				cursor: pointer;
				padding: 0;
				align-self: flex-start;
				transition: color var(--duration-fast, 100ms) var(--ease-standard, ease);
			}

			.kk-race-panel__track-change:hover {
				color: var(--color-white, #fff);
			}

			/* ── Mode cycling toggle ───────────────────────────────────── */

			.kk-race-panel__mode-toggle {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.08em);
				color: var(--color-ink-200, #ccc);
				background: rgba( 255, 255, 255, 0.06 );
				backdrop-filter: blur( 8px );
				-webkit-backdrop-filter: blur( 8px );
				border: 1px solid rgba( 255, 255, 255, 0.12 );
				border-radius: var(--radius-sm, 2px);
				padding: var(--space-3) var(--space-4);
				cursor: pointer;
				width: 100%;
				text-align: center;
				min-height: var(--hit-target-min, 48px);
				transition:
					color 0.2s ease,
					background 0.2s ease,
					border-color 0.2s ease,
					box-shadow 0.2s ease;
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-race-panel__mode-toggle:hover {
				color: var(--color-white, #fff);
				background: rgba( 255, 255, 255, 0.10 );
				border-color: rgba( 255, 255, 255, 0.18 );
			}

			.kk-race-panel__mode-toggle:active {
				transform: scale( 0.97 );
			}

			/* ── PLAY button wrapper ───────────────────────────────────── */

			.kk-race-panel__cta {
				margin-top: var(--space-2);
			}

			.kk-race-panel__cta .kk-hud-button {
				width: 100%;
			}

			@media ( prefers-reduced-motion: reduce ) {

				.kk-race-panel__mode-toggle {
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

		// Track info card
		const trackInfo = document.createElement( 'div' );
		trackInfo.className = 'kk-race-panel__track-info';

		const trackLabel = document.createElement( 'div' );
		trackLabel.className = 'kk-race-panel__track-label';
		trackLabel.textContent = 'TRACK';
		trackInfo.appendChild( trackLabel );

		this._trackNameEl = document.createElement( 'div' );
		this._trackNameEl.className = 'kk-race-panel__track-name';
		trackInfo.appendChild( this._trackNameEl );

		const changeBtn = document.createElement( 'button' );
		changeBtn.type = 'button';
		changeBtn.className = 'kk-race-panel__track-change';
		changeBtn.textContent = 'CHANGE';
		changeBtn.addEventListener( 'click', () => {

			this._services.switchTab( 'tracks' );

		} );
		trackInfo.appendChild( changeBtn );

		root.appendChild( trackInfo );

		// Mode cycling toggle button
		this._modeToggle = document.createElement( 'button' );
		this._modeToggle.type = 'button';
		this._modeToggle.className = 'kk-race-panel__mode-toggle';
		this._modeToggle.setAttribute( 'aria-label', 'Cycle game mode' );
		this._modeToggle.addEventListener( 'click', () => this._cycleMode() );
		root.appendChild( this._modeToggle );

		this._updateModeToggle();
		this._updateTrackInfo();

		// PLAY button — HudButton with scramble effect
		const ctaWrap = document.createElement( 'div' );
		ctaWrap.className = 'kk-race-panel__cta';

		this._raceBtn = new HudButton( {
			text:    'PLAY!',
			color:   '--color-accent-orange',
			onClick: () => this._handleRace(),
		} );

		ctaWrap.appendChild( this._raceBtn.el );
		root.appendChild( ctaWrap );

		this._container.appendChild( root );
		this._root = root;

	}

	// ---------------------------------------------------------------------------
	// Mode cycling
	// ---------------------------------------------------------------------------

	/** @type {string[]} */
	static MODES = [ 'solo', 'online', 'private' ];

	/** @type {Object<string, string>} */
	static MODE_LABELS = { solo: 'SOLO', online: 'ONLINE', private: 'PRIVATE' };

	/**
	 * Cycle through game modes: SOLO → ONLINE → PRIVATE → SOLO.
	 */
	_cycleMode() {

		const modes = RacePanel.MODES;
		const current = this._services.selectedMode || 'solo';
		const idx = modes.indexOf( current );
		const next = modes[ ( idx + 1 ) % modes.length ];

		this._services.selectedMode = next;
		this._updateModeToggle();

	}

	/**
	 * Update the mode toggle button text to reflect current mode.
	 */
	_updateModeToggle() {

		if ( ! this._modeToggle ) return;

		const mode = this._services.selectedMode || 'solo';
		this._modeToggle.textContent = RacePanel.MODE_LABELS[ mode ] || mode.toUpperCase();

	}

	/**
	 * Update the track info card with the currently selected track name.
	 */
	_updateTrackInfo() {

		if ( ! this._trackNameEl ) return;

		const track = this._resolveSelectedTrack();
		this._trackNameEl.textContent = track.name;

	}

	// ---------------------------------------------------------------------------
	// RACE button handler
	// ---------------------------------------------------------------------------

	async _handleRace() {

		const mode = this._services.selectedMode || 'solo';

		switch ( mode ) {

			case 'solo':
				this._startSoloRace();
				break;

			case 'online':
				await this._startOnlineMatchmaking();
				break;

			case 'private':
				await this._startPrivateLobby();
				break;

		}

	}

	// ---------------------------------------------------------------------------
	// Track card helpers
	// ---------------------------------------------------------------------------

	/**
	 * Resolve the selected track from Settings. Returns { name, cells, decoCells, source }.
	 * Falls back to the first built-in track if the selected track is missing.
	 */
	_resolveSelectedTrack() {

		const settings = new Settings();
		const trackId = settings.getSelectedTrackId();

		// User-created track
		if ( trackId && trackId.startsWith( 'user:' ) ) {

			const trackName = trackId.slice( 5 );
			const saved = getSavedTracks().find( ( t ) => t.name === trackName );

			if ( saved ) {

				return {
					name:     saved.name,
					cells:    decodeCells( saved.cells ),
					decoCells: undefined,
					source:   'custom',
				};

			}

			// Deleted track — fall through to default

		}

		// Built-in track
		const builtIn = getTrackById( trackId );

		if ( builtIn ) {

			return {
				name:     builtIn.name,
				cells:    builtIn.cells,
				decoCells: builtIn.decoCells,
				source:   'official',
			};

		}

		// Fallback
		const fallback = getTracks()[ 0 ];

		return {
			name:     fallback.name,
			cells:    fallback.cells,
			decoCells: fallback.decoCells,
			source:   'official',
		};

	}


	// ---------------------------------------------------------------------------
	// SOLO race
	// ---------------------------------------------------------------------------

	_startSoloRace() {

		const settings = new Settings();
		const vehicleId = settings.getSelectedKartId();
		const track = this._resolveSelectedTrack();

		this._services.startRace( {
			mode:      'solo',
			trackData: track.cells,
			decoCells: track.decoCells,
			vehicleId,
		} );

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
			const result = await this._network.findRoom( vehicleId );

			// Hide overlay and start the race
			this._matchmakingOverlay.hide();

			this._services.startRace( {
				mode:      'online',
				trackData: result.trackData ?? getRandomTrack().cells,
				vehicleId,
				roomCode:  result.roomCode,
				network:   this._network,
			} );

		} catch ( err ) {

			console.warn( '[RacePanel] Matchmaking failed:', err.message );

			if ( this._matchmakingOverlay ) {

				this._matchmakingOverlay.hide();

			}

			// Show error toast with retry hint
			this._services.notification.show( {
				message:  'Could not find a match \u2014 try again or play solo',
				variant:  'warning',
				duration: 4000,
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

	async _startPrivateLobby() {

		// Create a NetworkClient on demand (same pattern as online matchmaking).
		if ( ! this._network ) {

			this._network = new NetworkClient();

		}

		// Create LobbyOverlay if needed.
		if ( ! this._lobbyOverlay ) {

			// Mount into the shell element (parent of our container).
			const shell = this._container.closest( '#kk-app-shell' ) || document.body;
			this._lobbyOverlay = new LobbyOverlay( shell, this._services );

		}

		this._lobbyOverlay.show( this._network );

	}

	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Called when the RACE tab becomes active.
	 */
	show() {

		// Refresh track info (track may have changed in TRACKS tab)
		this._updateTrackInfo();

		// Sync mode toggle with services bag
		this._updateModeToggle();

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

		if ( this._raceBtn ) {

			this._raceBtn.dispose();
			this._raceBtn = null;

		}

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

		this._root = null;
		this._trackNameEl = null;
		this._modeToggle = null;

	}

}
