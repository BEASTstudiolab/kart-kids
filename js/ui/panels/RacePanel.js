/**
 * RacePanel — RACE tab content panel.
 *
 * Renders:
 *   - Transparent content area (3D kart preview shows through from behind)
 *   - Player name display
 *   - Mode chip strip: SOLO | ONLINE | PRIVATE
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

import { CTAButton }      from '../components/CTAButton.js';
import { LoadingOverlay }  from '../components/LoadingOverlay.js';
import { LobbyOverlay }   from '../overlays/LobbyOverlay.js';
import { Settings }        from '../../Settings.js';
import { getRandomTrack }  from '../../TrackRegistry.js';
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

		/** @type {CTAButton | null} */
		this._raceBtn = null;

		/** @type {HTMLElement | null} */
		this._nameEl = null;

		/** @type {Map<string, HTMLButtonElement>} mode id -> chip button */
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

			.kk-race-panel {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: flex-end;
				height: 100%;
				padding: var(--space-6);
				padding-bottom: var(--space-8);
				pointer-events: none;
				gap: var(--space-4);
			}

			.kk-race-panel > * {
				pointer-events: auto;
			}

			/* ── Player name ────────────────────────────────────────────── */

			.kk-race-panel__name {
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
			}

			/* ── Mode chip strip ────────────────────────────────────────── */

			.kk-race-panel__chips {
				display: flex;
				gap: var(--space-2);
				border-radius: var(--radius-md);
				padding: var(--space-1);
				background: rgba(0, 0, 0, 0.4);
				backdrop-filter: blur(4px);
			}

			.kk-race-panel__chip {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-semibold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-ink-200);
				background: transparent;
				border: var(--border-thin) solid transparent;
				border-radius: var(--radius-sm);
				padding: var(--space-2) var(--space-5);
				cursor: pointer;
				min-height: var(--hit-target-min);
				transition:
					color var(--duration-fast) var(--ease-standard),
					background var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-race-panel__chip:hover:not(.kk-race-panel__chip--active) {
				color: var(--color-white);
				background: rgba(255, 255, 255, 0.06);
			}

			.kk-race-panel__chip--active {
				color: var(--color-cta-primary-text);
				background: var(--color-cta-primary);
				border-color: var(--color-cta-primary);
			}

			/* ── Race button wrapper ────────────────────────────────────── */

			.kk-race-panel__cta {
				margin-top: var(--space-2);
			}

			.kk-race-panel__cta .kk-cta-button {
				font-size: var(--text-xl);
				padding: var(--space-4) var(--space-12);
				min-width: 12rem;
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

		// Player name
		const nameEl = document.createElement( 'div' );
		nameEl.className = 'kk-race-panel__name';
		nameEl.textContent = new Settings().getDisplayName() || 'PLAYER';
		root.appendChild( nameEl );
		this._nameEl = nameEl;

		// Mode chip strip
		const chipStrip = document.createElement( 'div' );
		chipStrip.className = 'kk-race-panel__chips';
		chipStrip.setAttribute( 'role', 'group' );
		chipStrip.setAttribute( 'aria-label', 'Race mode' );

		const modes = [
			{ id: 'solo',    label: 'SOLO' },
			{ id: 'online',  label: 'ONLINE' },
			{ id: 'private', label: 'PRIVATE' },
		];

		for ( const mode of modes ) {

			const chip = document.createElement( 'button' );
			chip.type = 'button';
			chip.className = 'kk-race-panel__chip';
			chip.textContent = mode.label;
			chip.dataset.mode = mode.id;
			chip.setAttribute( 'aria-pressed', mode.id === this._services.selectedMode ? 'true' : 'false' );

			if ( mode.id === this._services.selectedMode ) {

				chip.classList.add( 'kk-race-panel__chip--active' );

			}

			chip.addEventListener( 'click', () => this._selectMode( mode.id ) );

			chipStrip.appendChild( chip );
			this._chips.set( mode.id, chip );

		}

		root.appendChild( chipStrip );

		// RACE button
		const ctaWrap = document.createElement( 'div' );
		ctaWrap.className = 'kk-race-panel__cta';

		this._raceBtn = new CTAButton( {
			label:    'RACE',
			variant:  'primary',
			actionId: 'start-race',
			onClick:  () => this._handleRace(),
		} );

		ctaWrap.appendChild( this._raceBtn.el );
		root.appendChild( ctaWrap );

		this._container.appendChild( root );
		this._root = root;

	}

	// ---------------------------------------------------------------------------
	// Mode chip selection
	// ---------------------------------------------------------------------------

	/**
	 * @param {string} modeId  'solo' | 'online' | 'private'
	 */
	_selectMode( modeId ) {

		for ( const [ id, chip ] of this._chips ) {

			const isActive = id === modeId;
			chip.classList.toggle( 'kk-race-panel__chip--active', isActive );
			chip.setAttribute( 'aria-pressed', isActive ? 'true' : 'false' );

		}

		this._services.selectedMode = modeId;

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
	// SOLO race
	// ---------------------------------------------------------------------------

	_startSoloRace() {

		const settings = new Settings();
		const track = getRandomTrack();
		const vehicleId = settings.getSelectedKartId();

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

		// Refresh player name (may have changed in Settings)
		const settings = new Settings();

		if ( this._nameEl ) {

			this._nameEl.textContent = settings.getDisplayName() || 'PLAYER';

		}

		// Sync chip selection with services bag (may have been changed externally)
		const currentMode = this._services.selectedMode || 'solo';

		for ( const [ id, chip ] of this._chips ) {

			const isActive = id === currentMode;
			chip.classList.toggle( 'kk-race-panel__chip--active', isActive );
			chip.setAttribute( 'aria-pressed', isActive ? 'true' : 'false' );

		}

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
		this._nameEl = null;
		this._chips.clear();

	}

}
