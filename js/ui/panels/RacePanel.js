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

import { CTAButton }      from '../components/CTAButton.js';
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
		this._nameEl = null;

		/** @type {Map<string, HTMLButtonElement>} mode id -> chip button */
		this._chips = new Map();

		/** @type {HTMLElement | null} */
		this._trackCard = null;

		/** @type {HTMLElement | null} */
		this._trackNameEl = null;

		/** @type {HTMLElement | null} */
		this._trackBadgeEl = null;

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
				background: rgba(255, 255, 255, 0.06);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: var(--radius-sm);
				padding: var(--space-2) var(--space-5);
				cursor: pointer;
				min-height: var(--hit-target-min);
				transition:
					color 0.25s ease,
					background 0.25s ease,
					border-color 0.25s ease,
					box-shadow 0.25s ease;
			}

			.kk-race-panel__chip:hover:not(.kk-race-panel__chip--active) {
				color: var(--color-white);
				background: rgba(255, 255, 255, 0.10);
				border-color: rgba(255, 255, 255, 0.18);
			}

			.kk-race-panel__chip--active {
				color: var(--color-cta-primary-text);
				background: rgba(255, 107, 0, 0.15);
				border-color: var(--color-accent-orange);
				box-shadow: 0 0 12px var(--color-accent-orange-glow), inset 0 0 12px rgba(255, 107, 0, 0.1);
			}

			/* ── Track preview card ─────────────────────────────────────── */

			.kk-race-panel__track-card {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-2) var(--space-4);
				border-radius: var(--radius-md);
				background: rgba(0, 0, 0, 0.4);
				backdrop-filter: blur(4px);
				border: 1px solid rgba(255, 255, 255, 0.12);
				cursor: pointer;
				transition:
					border-color 0.25s ease,
					box-shadow 0.25s ease;
			}

			.kk-race-panel__track-card:hover {
				border-color: var(--color-accent-orange);
				box-shadow: 0 0 10px var(--color-accent-orange-glow);
			}

			.kk-race-panel__track-name {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-semibold);
				color: var(--color-white);
				letter-spacing: var(--tracking-wide);
			}

			.kk-race-panel__track-badge {
				font-family: var(--font-ui);
				font-size: 0.625rem;
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: 0.05em;
				padding: 2px 6px;
				border-radius: var(--radius-sm);
				line-height: 1;
			}

			.kk-race-panel__track-badge--official {
				color: var(--color-cta-primary-text);
				background: rgba(255, 107, 0, 0.25);
				border: 1px solid rgba(255, 107, 0, 0.4);
			}

			.kk-race-panel__track-badge--custom {
				color: var(--color-accent-blue, #4fc3f7);
				background: rgba(79, 195, 247, 0.15);
				border: 1px solid rgba(79, 195, 247, 0.3);
			}

			/* ── Race button wrapper ────────────────────────────────────── */

			.kk-race-panel__cta {
				margin-top: var(--space-2);
			}

			.kk-race-panel__cta .kk-cta-button {
				font-size: var(--text-xl);
				padding: var(--space-4) var(--space-12);
				min-width: 12rem;
				animation: kk-glow-pulse 1.5s ease-in-out infinite;
				transition:
					background var(--duration-fast) var(--ease-standard),
					box-shadow var(--duration-fast) var(--ease-standard),
					transform var(--duration-fast) var(--ease-standard);
			}

			.kk-race-panel__cta .kk-cta-button:hover:not([aria-disabled="true"]):not([aria-busy="true"]) {
				transform: scale(1.05);
			}

			.kk-race-panel__cta .kk-cta-button:active:not([aria-disabled="true"]):not([aria-busy="true"]) {
				transform: scale(0.97);
			}

			/* Shimmer sweep pseudo-element */
			.kk-race-panel__cta .kk-cta-button::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				width: 50%;
				height: 100%;
				background: linear-gradient(
					90deg,
					transparent,
					rgba(255, 255, 255, 0.15),
					transparent
				);
				transform: translateX(-100%) skewX(-20deg);
				pointer-events: none;
			}

			.kk-race-panel__cta .kk-cta-button:hover::before {
				animation: kk-shimmer-sweep 0.6s ease-out;
			}

			/* HudButton in the CTA slot */
			.kk-race-panel__cta .kk-hud-button {
				min-width: 12rem;
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-race-panel__cta .kk-cta-button {
					animation: none;
				}
				.kk-race-panel__cta .kk-cta-button:hover::before {
					animation: none;
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

		// Track preview card
		const trackCard = document.createElement( 'div' );
		trackCard.className = 'kk-race-panel__track-card';
		trackCard.setAttribute( 'role', 'button' );
		trackCard.setAttribute( 'aria-label', 'Change track' );

		const trackName = document.createElement( 'span' );
		trackName.className = 'kk-race-panel__track-name';

		const trackBadge = document.createElement( 'span' );
		trackBadge.className = 'kk-race-panel__track-badge';

		trackCard.appendChild( trackName );
		trackCard.appendChild( trackBadge );
		trackCard.addEventListener( 'click', () => this._services.switchTab( 'tracks' ) );

		root.appendChild( trackCard );

		this._trackCard = trackCard;
		this._trackNameEl = trackName;
		this._trackBadgeEl = trackBadge;

		this._refreshTrackCard();

		// RACE button — HudButton with scramble effect
		const ctaWrap = document.createElement( 'div' );
		ctaWrap.className = 'kk-race-panel__cta';

		this._raceBtn = new HudButton( {
			text:    'RACE',
			color:   '--color-accent-orange',
			onClick: () => this._handleRace(),
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

	/**
	 * Re-read Settings and update the track card's display.
	 */
	_refreshTrackCard() {

		if ( ! this._trackNameEl || ! this._trackBadgeEl ) return;

		const track = this._resolveSelectedTrack();

		this._trackNameEl.textContent = track.name;

		const isOfficial = track.source === 'official';
		this._trackBadgeEl.textContent = isOfficial ? 'OFFICIAL' : 'CUSTOM';
		this._trackBadgeEl.className = 'kk-race-panel__track-badge '
			+ ( isOfficial ? 'kk-race-panel__track-badge--official' : 'kk-race-panel__track-badge--custom' );

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

		// Refresh player name (may have changed in Settings)
		const settings = new Settings();

		if ( this._nameEl ) {

			this._nameEl.textContent = settings.getDisplayName() || 'PLAYER';

		}

		// Refresh track card (track may have changed in TRACKS tab)
		this._refreshTrackCard();

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
		this._trackCard = null;
		this._trackNameEl = null;
		this._trackBadgeEl = null;
		this._chips.clear();

	}

}
