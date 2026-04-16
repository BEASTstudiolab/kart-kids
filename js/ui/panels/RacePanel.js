/**
 * RacePanel — PLAY tab content panel.
 *
 * Visual direction:
 *   - Editorial telemetry UI language adapted into the actual menu
 *   - Existing lobby scene remains behind the menu; no separate showcase route required
 *
 * Mode behaviour:
 *   ONLINE RACE — matchmaking via NetworkClient.findRoom()
 *   SOLO        — opens track select, starts free play
 *   PRIVATE     — opens track select, starts party lobby
 *   TRACKS      — switches to the TRACKS tab
 */

import { LoadingOverlay } from '../components/LoadingOverlay.js';
import { MarginalActionCard } from '../components/MarginalActionCard.js';
import { LobbyOverlay } from '../overlays/LobbyOverlay.js';
import { TrackSelectOverlay } from '../overlays/TrackSelectOverlay.js';
import { Settings } from '../../Settings.js';
import { NetworkClient } from '../../Network.js';

const ACTION_META = Object.freeze( {
	race: {
		tag: '[MATCH]',
		label: 'Queue State',
		value: 'Race',
		copy: 'Drop into online matchmaking and launch directly into a live grid when a room is ready.',
		centerTitle: 'Play',
		centerStatus: 'Online',
	},
	'free-play': {
		tag: '[SOLO]',
		label: 'Run State',
		value: 'Free Play',
		copy: 'Run custom tracks, test builds, or warm up solo without waiting on a lobby.',
		centerTitle: 'Solo',
		centerStatus: 'Ready',
	},
	party: {
		tag: '[PARTY]',
		label: 'Lobby State',
		value: 'Party',
		copy: 'Open a private room, invite friends, and roll into the party grid with your selected setup.',
		centerTitle: 'Party',
		centerStatus: 'Staged',
	},
} );


export class RacePanel {

	static _cssInjected = false;

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._network = null;
		this._matchmakingOverlay = null;
		this._lobbyOverlay = null;
		this._trackSelectOverlay = null;
		this._root = null;
		this._actionButtons = new Map();
		this._activeAction = 'race';

		this._menuMusicHostEl = null;

		this._handleActionClick = this._handleActionClick.bind( this );

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	_injectCSS() {

		if ( RacePanel._cssInjected ) return;
		RacePanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-race-panel {
				--mv-cream: #F7F3E9;
				--mv-red: #D82C2C;
				--mv-dark: #0F1115;
				--mv-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
				--mv-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
				position: relative;
				width: 100%;
				height: 100%;
				overflow: hidden;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
				background: unset;
				background-color: unset;
				background-image: none;
			}

			.kk-race-panel,
			.kk-race-panel * {
				cursor: crosshair;
			}

			.kk-race-panel__scanlines,
			.kk-race-panel__vignette {
				display: none;
				position: absolute;
				inset: 0;
				pointer-events: none;
			}

			.kk-race-panel__scanlines {
				z-index: 1;
				opacity: 0.26;
				background:
					linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
					linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
				background-size: 100% 3px, 3px 100%;
			}

			.kk-race-panel__vignette {
				z-index: 2;
				box-shadow: inset 0 0 140px rgba(0, 0, 0, 0.6);
			}

			.kk-race-panel__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(240px, 320px) 1fr;
				grid-template-rows: 1fr;
				width: 100%;
				height: 100%;
				padding: 0 24px;
				gap: 20px;
			}

			.kk-race-panel__sidebar {
				grid-column: 1;
				display: flex;
				flex-direction: column;
				gap: 14px;
				justify-content: flex-start;
				align-self: stretch;
				min-height: 0;
				padding-top: 18px;
				padding-bottom: 0;
			}

			.kk-race-panel__launch-dock {
				position: absolute;
				right: 24px;
				bottom: calc(var(--kk-shell-nav-clearance, 6.75rem) + 10px);
				z-index: 4;
				width: min(320px, calc(100% - 48px));
				pointer-events: auto;
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.kk-race-panel__music-dock {
				position: absolute;
				left: 24px;
				bottom: calc(var(--kk-shell-nav-clearance, 6.75rem) + 10px);
				z-index: 4;
				width: min(320px, calc(100% - 48px));
				pointer-events: auto;
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.kk-race-panel__center {
				grid-column: 2;
				position: relative;
				min-height: 0;
				display: flex;
				align-items: stretch;
				justify-content: center;
				padding: 12px 0 0;
			}

			.kk-race-panel__field {
				flex: 1 1 auto;
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 100%;
				border-top: 0.5px solid rgba(247, 243, 233, 0.12);
				border-bottom: 0.5px solid rgba(247, 243, 233, 0.12);
				background: linear-gradient(180deg, rgba(247, 243, 233, 0.03), rgba(247, 243, 233, 0));
			}

			.kk-race-panel__field::before,
			.kk-race-panel__field::after {
				content: '';
				position: absolute;
				top: 12%;
				bottom: 12%;
				width: 1px;
				background: linear-gradient(180deg, transparent, rgba(247, 243, 233, 0.24), transparent);
			}

			.kk-race-panel__field::before {
				left: 12%;
			}

			.kk-race-panel__field::after {
				right: 12%;
			}

			.kk-race-panel__field-mark {
				position: relative;
				font-family: var(--mv-font-display);
				font-size: clamp(7.5rem, 18vw, 13rem);
				font-weight: 900;
				line-height: 0.82;
				letter-spacing: -0.08em;
				color: rgba(247, 243, 233, 0.06);
				user-select: none;
			}

			.kk-race-panel__field-mark::after {
				content: '';
				position: absolute;
				left: 50%;
				top: 50%;
				width: 22px;
				height: 22px;
				transform: translate(-50%, -50%);
				background: var(--mv-red);
				clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
				opacity: 0.85;
				box-shadow: 0 0 24px rgba(216, 44, 44, 0.45);
			}

			.kk-race-panel__manifest-line {
				font-size: 10px;
				margin-bottom: 8px;
			}

			.kk-race-panel__manifest-box {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 100%;
				height: 82px;
				border: 0.5px dashed rgba(247, 243, 233, 0.7);
				background: linear-gradient(135deg, rgba(247, 243, 233, 0.03), rgba(216, 44, 44, 0.04));
				font-size: 8px;
				letter-spacing: 0.18em;
			}

			.kk-race-panel__music-host {
				display: block;
				width: 100%;
			}

			.kk-race-panel__launch-rail {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.kk-race-panel__launch-heading {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				padding: 0 2px;
				font-size: 8px;
				font-weight: 700;
				letter-spacing: 0.18em;
			}

			.kk-race-panel__launch-heading::after {
				content: '';
				flex: 1 1 auto;
				height: 1px;
				background: rgba(247, 243, 233, 0.2);
			}

			.kk-race-panel__launch-grid {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.kk-race-panel__launch-dock .kk-mv-card {
				padding: 12px;
			}

			.kk-race-panel__launch-grid .kk-mv-action-card {
				min-height: 112px;
				gap: 0.35rem;
				padding: 0.75rem 0.7rem;
			}

			.kk-race-panel__launch-grid .kk-mv-action-card__header {
				gap: 0.35rem;
				font-size: calc(var(--text-editorial-label) - 0.02rem);
			}

			.kk-race-panel__launch-grid .kk-mv-action-card__header span:last-child {
				display: none;
			}

			.kk-race-panel__launch-grid .kk-mv-action-card__value {
				font-size: clamp(1.2rem, 1.8vw, 1.6rem);
				line-height: 0.92;
			}

			.kk-race-panel__launch-grid .kk-mv-action-card__copy {
				display: none;
			}

			.kk-race-panel__launch-grid .kk-mv-action-card--active {
				box-shadow: 0 22px 34px rgba(216, 44, 44, 0.24);
			}

			@media (max-width: 980px) {
				.kk-race-panel {
					overflow-y: auto;
				}

				.kk-race-panel__interface {
					height: auto;
					min-height: 100%;
					grid-template-columns: 1fr;
					grid-template-rows: auto auto auto;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 16px;
				}

				.kk-race-panel__sidebar,
				.kk-race-panel__music-dock,
				.kk-race-panel__launch-dock {
					grid-column: auto;
				}

				.kk-race-panel__center {
					min-height: 220px;
					padding: 0;
				}

				.kk-race-panel__music-dock,
				.kk-race-panel__launch-dock {
					position: static;
					width: auto;
				}

				.kk-race-panel__launch-grid .kk-mv-action-card {
					min-height: 0;
				}

				.kk-race-panel__launch-grid .kk-mv-action-card__header span:last-child,
				.kk-race-panel__launch-grid .kk-mv-action-card__copy {
					display: block;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const root = document.createElement( 'div' );
		root.className = 'kk-race-panel';

		const scanlines = document.createElement( 'div' );
		scanlines.className = 'kk-race-panel__scanlines';
		root.appendChild( scanlines );

		const vignette = document.createElement( 'div' );
		vignette.className = 'kk-race-panel__vignette';
		root.appendChild( vignette );

		const frame = document.createElement( 'div' );
		frame.className = 'kk-race-panel__interface';
		root.appendChild( frame );

		frame.appendChild( this._buildLeftSidebar() );
		frame.appendChild( this._buildLaunchDock() );
		frame.appendChild( this._buildMusicDock() );

		root.addEventListener( 'kk:mv:mode-change', this._handleActionClick );
		this._root = root;

	}

	_buildLeftSidebar() {

		const sidebar = document.createElement( 'aside' );
		sidebar.className = 'kk-race-panel__sidebar';

		return sidebar;

	}

	_buildMusicDock() {

		const dock = document.createElement( 'div' );
		dock.className = 'kk-race-panel__music-dock';

		const musicHost = document.createElement( 'div' );
		musicHost.className = 'kk-race-panel__music-host';
		dock.appendChild( musicHost );
		this._menuMusicHostEl = musicHost;

		return dock;

	}

	_buildLaunchDock() {

		const dock = document.createElement( 'div' );
		dock.className = 'kk-race-panel__launch-dock';

		const actionRail = document.createElement( 'section' );
		actionRail.className = 'kk-race-panel__launch-rail';

		const actionHeading = document.createElement( 'div' );
		actionHeading.className = 'kk-race-panel__launch-heading';
		actionHeading.textContent = 'Launch Modes';
		actionRail.appendChild( actionHeading );

		const actionGrid = document.createElement( 'div' );
		actionGrid.className = 'kk-race-panel__launch-grid';

		for ( const [ actionId, label ] of [
			[ 'race', 'Online' ],
			[ 'free-play', 'Solo' ],
			[ 'party', 'Private' ],
		] ) {

			const meta = ACTION_META[ actionId ];
			const card = new MarginalActionCard( {
				actionId,
				label,
				tag: meta.tag,
				value: meta.value,
				copy: meta.copy,
				active: actionId === this._activeAction,
			} );
			this._actionButtons.set( actionId, card );
			actionGrid.appendChild( card.el );

		}

		actionRail.appendChild( actionGrid );
		dock.appendChild( actionRail );

		return dock;

	}

	attachMenuMusicCard( cardEl ) {

		if ( ! this._menuMusicHostEl || ! cardEl ) return;
		this._menuMusicHostEl.replaceChildren( cardEl );

	}

	attachMenuMusicDock( dockEl ) {

		this.attachMenuMusicCard( dockEl );

	}

	_handleActionClick( e ) {

		const actionId = e.detail?.modeId;
		if ( ! actionId ) return;

		this._setActiveAction( actionId );

		switch ( actionId ) {

			case 'race':
				void this._handleOnlineRace();
				break;

			case 'free-play':
				this._handleFreePlay();
				break;

			case 'party':
				void this._handleParty();
				break;

		}

	}

	_setActiveAction( actionId ) {

		if ( ! ACTION_META[ actionId ] ) return;

		this._activeAction = actionId;
		this._actionButtons.forEach( ( button, id ) => button.setActive( id === actionId ) );

	}


	async _handleOnlineRace() {

		await this._startOnlineMatchmaking();

	}

	_handleFreePlay() {

		this._openTrackSelect( ( track ) => {

			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();

			this._services.startRace( {
				mode: 'solo',
				trackData: track.trackData || track.cells,
				decoCells: track.decoCells,
				vehicleId,
			} );

		} );

	}

	async _handleParty() {

		this._openTrackSelect( async ( track ) => {

			this._partyScene = this._services.showPartyLobby?.() || null;
			if ( this._partyScene ) {

				const settings = new Settings();
				this._partyScene.setLocalKart( settings.getSelectedKartId(), settings.getPlayerAppearance() );

			}

			await this._startPrivateLobby( track );

		} );

	}

	_openTrackSelect( onConfirm ) {

		if ( ! this._trackSelectOverlay ) {

			const shell = this._container.closest( '#kk-app-shell' ) || document.body;
			this._trackSelectOverlay = new TrackSelectOverlay( shell, this._services );

		}

		this._trackSelectOverlay.show( onConfirm );

	}

	async _startOnlineMatchmaking() {

		this._matchmakingOverlay = new LoadingOverlay( {
			message: 'Finding match...',
			variant: 'verbose',
			onCancel: () => this._cancelMatchmaking(),
		} );
		this._matchmakingOverlay.show();

		try {

			if ( ! this._network ) {

				this._network = new NetworkClient();

			}

			if ( ! this._network.connected ) {

				await this._network.connect();

			}

			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();
			this._network.setDisplayName( settings.getDisplayName() || '' );
			const result = await this._network.findRoom( vehicleId, settings.getPlayerAppearance() );

			this._matchmakingOverlay.hide();
			this._matchmakingOverlay.dispose();
			this._matchmakingOverlay = null;

			this._services.startRace( {
				mode: 'online',
				trackData: result.trackData ?? null,
				vehicleId,
				playerCount: result.playerCount || 1,
				roomCode: result.roomCode,
				network: this._network,
			} );

		} catch ( err ) {

			console.warn( '[RacePanel] Matchmaking failed:', err.message );

			if ( this._matchmakingOverlay ) {

				this._matchmakingOverlay.hide();
				this._matchmakingOverlay.dispose();
				this._matchmakingOverlay = null;

			}

			const settings = new Settings();
			const vehicleId = settings.getSelectedKartId();

			this._services.startRace( {
				mode: 'online',
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

		if ( this._network ) {

			this._network.disconnect();
			this._network = null;

		}

	}

	async _startPrivateLobby( track ) {

		if ( ! this._network ) {

			this._network = new NetworkClient();

		}

		if ( ! this._lobbyOverlay ) {

			const shell = this._container.closest( '#kk-app-shell' ) || document.body;
			this._lobbyOverlay = new LobbyOverlay( shell, this._services );

		}

		this._lobbyOverlay.show( this._network, {
			trackData: track,
			isHost: true,
			partyLobbyScene: this._partyScene || null,
		} );

	}

	show() {

	}

	hide() {

	}

	dispose() {

		this._root?.removeEventListener( 'kk:mv:mode-change', this._handleActionClick );

		this._actionButtons.forEach( ( button ) => button.dispose?.() );
		this._actionButtons.clear();

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

		if ( this._trackSelectOverlay ) {

			this._trackSelectOverlay.dispose();
			this._trackSelectOverlay = null;

		}

		if ( this._root?.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}
