/**
 * RacePanel — RACE tab content panel.
 *
 * Renders:
 *   - Transparent content area (3D kart preview shows through from behind)
 *   - Player name display
 *   - Mode chip strip: RACE | FREE PLAY | PARTY
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

		/** @type {Map<string, HTMLButtonElement>} */
		this._chips = new Map();

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

			/* ── Mode chip strip ───────────────────────────────────────── */

			.kk-race-panel__chips {
				display: flex;
				flex-direction: row;
				gap: var(--space-1, 4px);
				background: rgba( 0, 0, 0, 0.45 );
				backdrop-filter: blur( 8px );
				-webkit-backdrop-filter: blur( 8px );
				border-radius: var(--radius-md, 4px);
				padding: var(--space-1, 4px);
				width: 100%;
				box-sizing: border-box;
			}

			.kk-race-panel__chip {
				flex: 1;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.08em);
				color: var(--color-ink-300, #999);
				background: transparent;
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				border-radius: var(--radius-sm, 2px);
				padding: var(--space-2) var(--space-1);
				cursor: pointer;
				text-align: center;
				min-height: var(--hit-target-min, 48px);
				box-sizing: border-box;
				transition:
					color 0.2s ease,
					background 0.2s ease,
					border-color 0.2s ease,
					box-shadow 0.2s ease;
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-race-panel__chip:hover:not( .kk-race-panel__chip--active ) {
				color: var(--color-ink-100, #ddd);
				background: rgba( 255, 255, 255, 0.06 );
				border-color: rgba( 255, 255, 255, 0.15 );
			}

			.kk-race-panel__chip--active {
				color: var(--color-white, #fff);
				background: rgba( 255, 160, 40, 0.15 );
				border-color: rgba( 255, 160, 40, 0.6 );
				box-shadow: 0 0 8px rgba( 255, 140, 0, 0.25 );
			}

			.kk-race-panel__chip:active {
				transform: scale( 0.97 );
			}

			/* ── PLAY button ───────────────────────────────────────────── */

			.kk-race-panel__cta {
				width: 100%;
			}

			.kk-race-panel__cta .kk-hud-button {
				width: 100%;
			}

			/* ── JOIN button (PARTY mode only) ─────────────────────── */

			.kk-race-panel__join-btn {
				width: 100%;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-semibold, 600);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.08em);
				color: var(--color-ink-100, #ddd);
				background: rgba( 255, 255, 255, 0.06 );
				backdrop-filter: blur( 8px );
				-webkit-backdrop-filter: blur( 8px );
				border: 1px solid rgba( 255, 255, 255, 0.12 );
				border-radius: var(--radius-md, 4px);
				padding: var(--space-3) var(--space-4);
				cursor: pointer;
				min-height: var(--hit-target-min, 48px);
				box-sizing: border-box;
				transition:
					color 0.2s ease,
					background 0.2s ease,
					border-color 0.2s ease;
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-race-panel__join-btn:hover {
				color: var(--color-white, #fff);
				background: rgba( 255, 255, 255, 0.10 );
				border-color: rgba( 255, 255, 255, 0.20 );
			}

			.kk-race-panel__join-btn:active {
				transform: scale( 0.97 );
			}

			@media ( prefers-reduced-motion: reduce ) {

				.kk-race-panel__chip {
					transition: none;
				}

				.kk-race-panel__join-btn {
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

		// Mode chip strip
		const chipStrip = document.createElement( 'div' );
		chipStrip.className = 'kk-race-panel__chips';

		const modeIds = [ 'online', 'solo', 'private' ];

		for ( const id of modeIds ) {

			const chip = document.createElement( 'button' );
			chip.type = 'button';
			chip.className = 'kk-race-panel__chip';
			chip.textContent = RacePanel.MODE_LABELS[ id ];
			chip.setAttribute( 'aria-pressed', 'false' );
			chip.addEventListener( 'click', () => this._setMode( id ) );

			chipStrip.appendChild( chip );
			this._chips.set( id, chip );

		}

		root.appendChild( chipStrip );
		this._chipStrip = chipStrip;

		// PLAY button
		const ctaWrap = document.createElement( 'div' );
		ctaWrap.className = 'kk-race-panel__cta';

		this._raceBtn = new HudButton( {
			text:    'PLAY!',
			color:   '--color-accent-orange',
			onClick: () => this._handleRace(),
		} );

		ctaWrap.appendChild( this._raceBtn.el );
		root.appendChild( ctaWrap );

		// JOIN button (visible only in PARTY mode)
		const joinBtn = document.createElement( 'button' );
		joinBtn.type = 'button';
		joinBtn.className = 'kk-race-panel__join-btn';
		joinBtn.textContent = 'JOIN ROOM';
		joinBtn.style.display = 'none';
		joinBtn.addEventListener( 'click', () => this._handleJoinRoom() );
		root.appendChild( joinBtn );
		this._joinBtn = joinBtn;

		this._updateChipStrip();
		this._updateJoinVisibility();

		this._container.appendChild( root );
		this._root = root;

	}

	// ---------------------------------------------------------------------------
	// Mode selection
	// ---------------------------------------------------------------------------

	/** @type {Object<string, string>} */
	static MODE_LABELS = { solo: 'FREE PLAY', online: 'RACE', private: 'PARTY' };

	/**
	 * Set the active game mode and update chip visuals.
	 * @param {string} modeId  One of 'solo', 'online', 'private'
	 */
	_setMode( modeId ) {

		this._services.selectedMode = modeId;
		this._updateChipStrip();
		this._updateJoinVisibility();

	}

	/**
	 * Show JOIN button only in PARTY mode.
	 */
	_updateJoinVisibility() {

		if ( this._joinBtn ) {

			const mode = this._services.selectedMode || 'solo';
			this._joinBtn.style.display = mode === 'private' ? '' : 'none';

		}

	}

	/**
	 * Sync chip active states with the current services.selectedMode.
	 */
	_updateChipStrip() {

		if ( ! this._chips || this._chips.size === 0 ) return;

		const active = this._services.selectedMode || 'solo';

		for ( const [ id, chip ] of this._chips ) {

			const isActive = id === active;
			chip.classList.toggle( 'kk-race-panel__chip--active', isActive );
			chip.setAttribute( 'aria-pressed', isActive ? 'true' : 'false' );

		}

	}


	// ---------------------------------------------------------------------------
	// RACE button handler
	// ---------------------------------------------------------------------------

	async _handleRace() {

		const mode = this._services.selectedMode || 'solo';

		switch ( mode ) {

			case 'solo':
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
				break;

			case 'online':
				await this._startOnlineMatchmaking();
				break;

			case 'private':
				this._openTrackSelect( async ( track ) => {

					await this._startPrivateLobby( track );

				} );
				break;

		}

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
			const result = await this._network.findRoom( vehicleId );

			// Hide and dispose overlay, then start the race
			this._matchmakingOverlay.hide();
			this._matchmakingOverlay.dispose();
			this._matchmakingOverlay = null;

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

			// Show error toast with fallback hint (R19)
			this._services.notification.show( {
				message:  'No match found \u2014 try again or play Free Play',
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

		this._lobbyOverlay.show( this._network, { trackData: track, isHost: true } );

	}

	// ---------------------------------------------------------------------------
	// PRIVATE join (guest)
	// ---------------------------------------------------------------------------

	_handleJoinRoom() {

		const bodyEl = document.createElement( 'div' );

		const input = document.createElement( 'input' );
		input.type = 'text';
		input.placeholder = 'Enter room code';
		input.autocomplete = 'off';
		input.style.cssText = 'width:100%;box-sizing:border-box;font-family:var(--font-mono,monospace);font-size:var(--text-lg,1.25rem);letter-spacing:0.15em;text-align:center;padding:var(--space-3,12px);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:var(--radius-md,8px);color:var(--color-white,#fff);outline:none;';
		bodyEl.appendChild( input );

		const footer = document.createElement( 'div' );
		footer.style.cssText = 'display:flex;gap:var(--space-3,12px);';

		const cancelBtn = document.createElement( 'button' );
		cancelBtn.className = 'kk-cta-button kk-cta-button--ghost';
		cancelBtn.type = 'button';
		cancelBtn.innerHTML = '<span class="kk-cta-button__label">CANCEL</span>';

		const joinBtn = document.createElement( 'button' );
		joinBtn.className = 'kk-cta-button kk-cta-button--primary';
		joinBtn.type = 'button';
		joinBtn.innerHTML = '<span class="kk-cta-button__label">JOIN</span>';

		footer.appendChild( cancelBtn );
		footer.appendChild( joinBtn );

		const handle = this._services.modal.open( {
			title: 'Join Room',
			body: bodyEl,
			footer: footer,
			dismissible: true,
		} );

		cancelBtn.addEventListener( 'click', () => handle.close() );

		let joining = false;

		const doJoin = async () => {

			if ( joining ) return;

			const code = input.value.trim();

			if ( ! code ) {

				input.focus();
				return;

			}

			joining = true;
			handle.close();

			try {

				// Create NetworkClient on demand
				if ( ! this._network ) {

					this._network = new NetworkClient();

				}

				if ( ! this._network.connected ) {

					await this._network.connect();

				}

				const settings = new Settings();
				const vehicleId = settings.getSelectedKartId();

				await this._network.joinRoom( code, vehicleId );

				// Create LobbyOverlay if needed
				if ( ! this._lobbyOverlay ) {

					const shell = this._container.closest( '#kk-app-shell' ) || document.body;
					this._lobbyOverlay = new LobbyOverlay( shell, this._services );

				}

				this._lobbyOverlay.show( this._network, { isHost: false } );

			} catch ( err ) {

				console.warn( '[RacePanel] Join room failed:', err.message );
				this._services.notification.show( {
					message:  'Failed to join room: ' + ( err.message || 'Invalid code' ),
					variant:  'error',
					duration: 3000,
				} );

			}

		};

		joinBtn.addEventListener( 'click', doJoin );

		input.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) doJoin();

		} );

	}

	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Called when the RACE tab becomes active.
	 */
	show() {

		// Sync chip strip and JOIN button with services bag
		this._updateChipStrip();
		this._updateJoinVisibility();

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

		if ( this._trackSelectOverlay ) {

			this._trackSelectOverlay.dispose();
			this._trackSelectOverlay = null;

		}

		this._root = null;
		this._chips.clear();
		this._chipStrip = null;
		this._joinBtn = null;

	}

}
