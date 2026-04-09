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
		this._trackCarousel = null;

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

			/* ── Track carousel — mini horizontal scroll-snap ──────────── */

			.kk-race-panel__track-carousel-wrap {
				width: 100%;
				max-width: 440px;
			}

			.kk-race-panel__track-carousel {
				display: flex;
				gap: var(--space-3, 0.75rem);
				overflow-x: auto;
				overflow-y: hidden;
				scroll-snap-type: x mandatory;
				-webkit-overflow-scrolling: touch;
				padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
				scrollbar-width: none;
			}

			.kk-race-panel__track-carousel::-webkit-scrollbar {
				display: none;
			}

			/* ── Track card — compact angular glass ────────────────────── */

			.kk-race-panel__track-card {
				flex: 0 0 140px;
				min-width: 140px;
				height: 64px;
				scroll-snap-align: center;
				position: relative;
				background: rgba( 20, 20, 30, 0.75 );
				border: var(--border-base, 2px) solid rgba( 255, 255, 255, 0.1 );
				backdrop-filter: blur( 8px );
				clip-path: polygon(
					0 8px, 8px 0, 100% 0,
					100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%
				);
				padding: var(--space-2, 0.5rem);
				box-sizing: border-box;
				display: flex;
				flex-direction: column;
				justify-content: space-between;
				cursor: pointer;
				transition:
					border-color var(--duration-normal, 200ms) var(--ease-standard, ease),
					box-shadow var(--duration-normal, 200ms) var(--ease-standard, ease),
					transform var(--duration-normal, 200ms) var(--ease-standard, ease);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-race-panel__track-card:hover {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 14px rgba( 249, 115, 22, 0.3 );
				transform: scale( 1.04 );
			}

			/* Selected state — cyan glow */

			.kk-race-panel__track-card--selected {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 16px rgba( 0, 212, 232, 0.4 ),
					inset 0 0 16px rgba( 0, 212, 232, 0.06 );
			}

			.kk-race-panel__track-card--selected:hover {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 20px rgba( 0, 212, 232, 0.5 ),
					inset 0 0 16px rgba( 0, 212, 232, 0.08 );
			}

			.kk-race-panel__track-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.kk-race-panel__track-badge {
				display: inline-block;
				font-family: var(--font-ui, sans-serif);
				font-size: 0.6rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				padding: 1px var(--space-2, 0.5rem);
				border-radius: var(--radius-sm, 2px);
				align-self: flex-start;
				line-height: 1;
			}

			.kk-race-panel__track-badge--easy {
				background: rgba( 52, 211, 153, 0.2 );
				color: #34d399;
				border: 1px solid rgba( 52, 211, 153, 0.3 );
			}

			.kk-race-panel__track-badge--medium {
				background: rgba( 255, 214, 0, 0.2 );
				color: #ffd600;
				border: 1px solid rgba( 255, 214, 0, 0.3 );
			}

			.kk-race-panel__track-badge--hard {
				background: rgba( 255, 58, 140, 0.2 );
				color: #ff3a8c;
				border: 1px solid rgba( 255, 58, 140, 0.3 );
			}

			.kk-race-panel__track-badge--custom {
				color: var(--color-accent-blue, #4fc3f7);
				background: rgba( 79, 195, 247, 0.15 );
				border: 1px solid rgba( 79, 195, 247, 0.3 );
			}

			@media ( max-width: 480px ) {

				.kk-race-panel__track-card {
					flex: 0 0 120px;
					min-width: 120px;
					height: 56px;
				}

			}

			@media ( prefers-reduced-motion: reduce ) {

				.kk-race-panel__track-card {
					transition: none;
				}

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

		// Track carousel — mini horizontal strip
		const trackCarouselWrap = document.createElement( 'div' );
		trackCarouselWrap.className = 'kk-race-panel__track-carousel-wrap';

		this._trackCarousel = document.createElement( 'div' );
		this._trackCarousel.className = 'kk-race-panel__track-carousel';
		trackCarouselWrap.appendChild( this._trackCarousel );

		root.appendChild( trackCarouselWrap );

		this._renderTrackCarousel();

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
	 * Build the track carousel with all available tracks.
	 */
	_renderTrackCarousel() {

		if ( ! this._trackCarousel ) return;
		this._trackCarousel.innerHTML = '';

		const settings = new Settings();
		const selectedId = settings.getSelectedTrackId();

		// Official tracks
		const officialTracks = getTracks();

		for ( const track of officialTracks ) {

			const isSelected = track.id === selectedId;
			const card = this._buildTrackCard( track.name, track.difficulty, isSelected, () => {

				settings.setSelectedTrackId( track.id );
				this._renderTrackCarousel();

				this._services.notification?.show( {
					message:  'Track selected',
					variant:  'success',
					duration: 1500,
				} );

			} );

			this._trackCarousel.appendChild( card );

		}

		// User tracks
		const userTracks = getSavedTracks();

		for ( const track of userTracks ) {

			const trackId = 'user:' + track.name;
			const isSelected = trackId === selectedId;
			const card = this._buildTrackCard( track.name, 'custom', isSelected, () => {

				settings.setSelectedTrackId( trackId );
				this._renderTrackCarousel();

				this._services.notification?.show( {
					message:  'Track selected',
					variant:  'success',
					duration: 1500,
				} );

			} );

			this._trackCarousel.appendChild( card );

		}

		// Scroll selected card into view.
		requestAnimationFrame( () => {

			const selected = this._trackCarousel.querySelector( '.kk-race-panel__track-card--selected' );
			if ( selected ) {

				selected.scrollIntoView( { behavior: 'smooth', block: 'nearest', inline: 'center' } );

			}

		} );

	}

	/**
	 * Build a single track card for the carousel.
	 *
	 * @param {string}   name        Track display name.
	 * @param {string}   difficulty  'easy' | 'medium' | 'hard' | 'custom'.
	 * @param {boolean}  isSelected  Whether this track is currently selected.
	 * @param {Function} onClick     Callback when card is tapped.
	 * @returns {HTMLElement}
	 */
	_buildTrackCard( name, difficulty, isSelected, onClick ) {

		const card = document.createElement( 'div' );
		card.className = 'kk-race-panel__track-card';
		if ( isSelected ) card.classList.add( 'kk-race-panel__track-card--selected' );

		const nameEl = document.createElement( 'div' );
		nameEl.className = 'kk-race-panel__track-name';
		nameEl.textContent = name;
		card.appendChild( nameEl );

		const badge = document.createElement( 'span' );
		badge.className = `kk-race-panel__track-badge kk-race-panel__track-badge--${ difficulty }`;
		badge.textContent = difficulty.toUpperCase();
		card.appendChild( badge );

		card.addEventListener( 'click', onClick );

		return card;

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

		// Refresh track carousel (track may have changed in TRACKS tab)
		this._renderTrackCarousel();

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
		this._trackCarousel = null;
		this._chips.clear();

	}

}
