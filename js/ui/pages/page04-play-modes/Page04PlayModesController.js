/**
 * Page04PlayModesController — Play Modes.
 *
 * Route: RouteIds.PLAY ("/play")
 *
 * Responsibilities:
 *   - Create and configure Page04PlayModesView.
 *   - Populate mode card grid from hardcoded PLAY_MODES list.
 *   - Wire back button → RouteIds.HOME.
 *   - Wire CardGrid selection → enable SELECT button with correct label.
 *   - Wire CardGrid activate (double-click / Enter) → navigate immediately.
 *   - Wire ActionBar BACK → navigateBack().
 *   - Wire ActionBar SELECT → navigate to mode-specific route.
 *   - Emit analytics page view on mount.
 *
 * Navigation map:
 *   solo_race    → RouteIds.LOBBY   (mode='solo_race')
 *   quick_play   → RouteIds.QUICK_PLAY
 *   private_lobby → RouteIds.LOBBY  (mode='private_lobby')
 *
 * Data: Static — hardcoded mode list.
 */

import { PageControllerBase }      from '../../core/PageControllerBase.js';
import { Page04PlayModesView }     from './Page04PlayModesView.js';
import { RouteIds }                from '../../enums/RouteIds.js';
import { PageIds }                 from '../../enums/PageIds.js';
import { EventIds }                from '../../enums/EventIds.js';

// Hardcoded play modes — replaces MockData.modes
const PLAY_MODES = Object.freeze( [
	{ id: 'solo_race',     name: 'Solo Race',     desc: 'Race against AI opponents', icon: 'flag',   playerCount: '1', online: false },
	{ id: 'quick_play',    name: 'Quick Play',    desc: 'Find an online match fast', icon: 'clock',  playerCount: '2-8', online: true },
	{ id: 'private_lobby', name: 'Private Lobby', desc: 'Create or join a room',     icon: 'users',  playerCount: '2-8', online: true },
] );

// Maps mode IDs that navigate to something other than LOBBY
const MODE_ROUTE_OVERRIDES = {
	quick_play: RouteIds.QUICK_PLAY,
};

export class Page04PlayModesController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page04PlayModesView} */
		this._view = null;

		/** @type {string | null} Currently selected mode ID */
		this._selectedModeId = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page04PlayModesView();

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

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.PLAY_MODES } );
			this.navigate( RouteIds.HOME );

		} );

		// CardGrid selection (single click — select only)
		this._addListener( view.root, 'kk:cardgrid:select', ( e ) => {

			this._handleModeSelected( e.detail.id );

		} );

		// CardGrid activate (double-click or Enter/Space — select + navigate)
		this._addListener( view.root, 'kk:cardgrid:activate', ( e ) => {

			this._handleModeSelected( e.detail.id );
			this._navigateToMode( e.detail.id );

		} );

		// ActionBar BACK
		this._addListener( view.actionBar.secondaryButtons[ 0 ].el, 'click', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.PLAY_MODES } );
			this.navigateBack();

		} );

		// ActionBar SELECT
		this._addListener( view.actionBar.primaryButton.el, 'click', () => {

			if ( this._selectedModeId ) {
				this._navigateToMode( this._selectedModeId );
			}

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		view.setModes( PLAY_MODES );
		view.setCharacterPreview( null );

		view.mount( container );

		this._analytics?.trackPageView( PageIds.PLAY_MODES );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * Update UI state when a mode card is selected.
	 *
	 * @param {string} modeId
	 */
	_handleModeSelected( modeId ) {

		this._selectedModeId = modeId;

		this._analytics?.track( EventIds.MODE_SELECTED, { modeId } );

		const mode = PLAY_MODES.find( ( m ) => m.id === modeId );
		const selectLabel = 'SELECT';
		const sublabel    = mode?.name ?? '';

		this._view.setSelectState( {
			enabled:   true,
			label:     selectLabel,
			sublabel,
		} );

	}

	/**
	 * Navigate to the destination for a given mode ID.
	 *
	 * @param {string} modeId
	 */
	_navigateToMode( modeId ) {

		const override = MODE_ROUTE_OVERRIDES[ modeId ];

		if ( override ) {

			this.navigate( override );

		} else {

			this.navigate( RouteIds.LOBBY, { mode: modeId } );

		}

	}

}
