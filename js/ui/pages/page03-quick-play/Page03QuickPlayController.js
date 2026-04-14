/**
 * Page03QuickPlayController — Quick Play.
 *
 * Route: RouteIds.QUICK_PLAY ("/quick-play")
 *
 * Responsibilities:
 *   - Create and configure Page03QuickPlayView.
 *   - Populate character, kart, and track data from real registries.
 *   - Wire back button → RouteIds.HOME.
 *   - Wire character card → CHARACTER tab / RouteIds.CHARACTERS.
 *   - Wire kart card → GARAGE tab / RouteIds.KARTS.
 *   - Wire track thumbnail clicks → open track picker modal (stubbed with toast).
 *   - Wire race rules panel → open rules config modal (stubbed with toast).
 *   - Wire match type tab change → update internal state.
 *   - Wire bot fill slider → update internal state and label.
 *   - Wire START RACE → loading state then RouteIds.LOBBY.
 *   - Emit analytics page view on mount.
 *
 * Data: Settings (selected kart), VehicleRegistry (kart info), TrackRegistry (tracks),
 *       PLAYER_CHARACTERS (single character).
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page03QuickPlayView }   from './Page03QuickPlayView.js';
import { RouteIds }              from '../../enums/RouteIds.js';
import { ButtonIds }             from '../../enums/ButtonIds.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';
import { Settings }              from '../../../Settings.js';
import { getVehicleById, PLAYER_CHARACTERS } from '../../../VehicleRegistry.js';
import { getTracks }             from '../../../TrackRegistry.js';
import { NetworkClient }         from '../../../Network.js';

export class Page03QuickPlayController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page03QuickPlayView} */
		this._view = null;

		/** @type {string} Current match type: 'race' | 'time_trial' | 'battle' */
		this._matchType = 'race';

		/** @type {number} Current bot fill count 0-11 */
		this._botFill = 0;

		/** @type {NetworkClient|null} */
		this._network = services.network ?? null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page03QuickPlayView();

	}

	bindEvents() {

		const view = this._view;

		// TopNav navigation
		this._addListener( view.root, 'kk:topnav:navigate', ( e ) => {

			const { route } = e.detail;
			if ( route ) {
				this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { route } );
				this.navigate( route );
			}

		} );

		// PageHeader back button
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.QUICK_PLAY } );
			this.navigate( RouteIds.HOME );

		} );

		// Selected Character card
		this._addListener( view.characterCardEl, 'click', () => {

			this._analytics?.track( EventIds.CHARACTER_SELECTED, { source: ButtonIds.QUICK_PLAY_SELECTED_CHARACTER } );
			if ( this._services.switchTab ) {

				this._services.switchTab( 'character' );
				return;

			}

			this.navigate( RouteIds.CHARACTERS );

		} );

		this._addListener( view.characterCardEl, 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				view.characterCardEl.click();
			}

		} );

		// Selected Kart card
		this._addListener( view.kartCardEl, 'click', () => {

			this._analytics?.track( EventIds.KART_SELECTED, { source: ButtonIds.QUICK_PLAY_SELECTED_KART } );
			if ( this._services.switchTab ) {

				this._services.switchTab( 'garage' );
				return;

			}
			this.navigate( RouteIds.KARTS );

		} );

		this._addListener( view.kartCardEl, 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				view.kartCardEl.click();
			}

		} );

		// Track thumbnails — delegate by data-action on the panel body
		this._addListener( view.root, 'click', ( e ) => {

			const thumb = e.target.closest( '[data-action="quick_play_track_select"]' );
			if ( thumb ) {
				const trackId = thumb.dataset.trackId;
				this._analytics?.track( EventIds.TRACK_SELECTED, { trackId } );
				this.showToast( {
					message:  'TRACK PICKER COMING SOON',
					variant:  'info',
					duration: 2000,
				} );
			}

		} );

		// Race Rules panel click
		this._addListener( view.raceRulesPanelEl, 'click', () => {

			this.showToast( {
				message:  'RULES CONFIG COMING SOON',
				variant:  'info',
				duration: 2000,
			} );

		} );

		this._addListener( view.raceRulesPanelEl, 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				view.raceRulesPanelEl.click();
			}

		} );

		// Match Type tabs
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			this._matchType = e.detail.tabId;

		} );

		// Bot Fill slider
		this._addListener( view.botFillSliderEl, 'input', ( e ) => {

			this._botFill = parseInt( e.target.value, 10 );
			view.setBotFillLabel( this._botFill );

		} );

		// ActionBar BACK
		this._addListener( view.actionBar.secondaryButtons[ 0 ].el, 'click', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.QUICK_PLAY } );
			this.navigateBack();

		} );

		// ActionBar START RACE
		this._addListener( view.actionBar.primaryButton.el, 'click', () => {

			this._handleStartRace();

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view     = this._view;
		const settings = new Settings();
		const kartId   = settings.getSelectedKartId();
		const kartEntry = getVehicleById( kartId );
		const charEntry = PLAYER_CHARACTERS[ 0 ] ?? null;
		const tracks   = getTracks().slice( 0, 2 );

		// Map registry entries to the shape the view expects
		const character = charEntry ? { id: charEntry.id, name: charEntry.label } : null;
		const kart      = kartEntry ? { id: kartEntry.id, name: kartEntry.label, owned: true, ...kartEntry.stats } : null;

		view.setCharacter( character );
		view.setKart( kart );
		view.setTracks( tracks.map( ( t ) => ( { id: t.id, name: t.name } ) ) );

		// Hero aria-label reflects current loadout
		const charName = character?.name ?? 'Unknown Character';
		const kartName = kart?.name ?? 'Unknown Kart';
		view.setHeroAriaLabel( `${charName} on ${kartName}` );

		view.mount( container );

		this._analytics?.trackPageView( PageIds.QUICK_PLAY );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	async _handleStartRace() {

		this._analytics?.track( EventIds.QUICK_PLAY_STARTED, {
			matchType: this._matchType,
			botFill:   this._botFill,
		} );

		// Enter loading state while connecting
		this._view.actionBar.setPrimaryLoading( true );

		const settings = new Settings();
		const vehicleId = settings.get( 'vehicleModel' ) ?? 'kart-1';

		// Attempt multiplayer matchmaking
		if ( this._network ) {

			try {

				if ( ! this._network.connected ) {

					await this._network.connect();

				}

				this._network.setDisplayName( settings.getDisplayName() || '' );
				const result = await this._network.findRoom( vehicleId );

				this.navigate( RouteIds.LOBBY, {
					roomCode: result.roomCode,
					members:  result.members ?? [],
					hostId:   result.hostId ?? null,
				} );
				return;

			} catch ( err ) {

				console.warn( '[QuickPlay] Matchmaking failed:', err.message );
				this._view.actionBar.setPrimaryLoading( false );

				this.showToast( {
					message:  'COULD NOT FIND A MATCH — TRY AGAIN OR PLAY SOLO',
					variant:  'warning',
					duration: 3000,
				} );
				return;

			}

		}

		// Fallback: no network service — navigate to lobby in solo mode
		setTimeout( () => {

			this.navigate( RouteIds.LOBBY );

		}, 400 );

	}

}
