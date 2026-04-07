/**
 * Page04PlayModesController — Play Modes.
 *
 * Route: RouteIds.PLAY ("/play")
 *
 * Responsibilities:
 *   - Create and configure Page04PlayModesView.
 *   - Populate mode card grid from MockData.modes.
 *   - Wire back button → RouteIds.HOME.
 *   - Wire CardGrid selection → enable SELECT button with correct label.
 *   - Wire CardGrid activate (double-click / Enter) → navigate immediately.
 *   - Wire ActionBar BACK → navigateBack().
 *   - Wire ActionBar SELECT → navigate to mode-specific route.
 *   - Update SELECT button label for special modes (tournaments, ranked).
 *   - Emit analytics page view on mount.
 *
 * Navigation map:
 *   grand_prix   → RouteIds.LOBBY   (mode='grand_prix')
 *   single_race  → RouteIds.LOBBY   (mode='single_race')
 *   time_trial   → RouteIds.LOBBY   (mode='time_trial')
 *   battle_mode  → RouteIds.LOBBY   (mode='battle_mode')
 *   team_race    → RouteIds.LOBBY   (mode='team_race')
 *   elimination  → RouteIds.LOBBY   (mode='elimination')
 *   custom_game  → RouteIds.LOBBY   (mode='custom_game')
 *   tournaments  → RouteIds.EVENTS
 *   ranked       → RouteIds.RANKED
 *
 * Data: MockData.modes, MockData.loadout, MockData.characters.
 */

import { PageControllerBase }      from '../../core/PageControllerBase.js';
import { Page04PlayModesView }     from './Page04PlayModesView.js';
import { RouteIds }                from '../../enums/RouteIds.js';
import { ButtonIds }               from '../../enums/ButtonIds.js';
import { PageIds }                 from '../../enums/PageIds.js';
import { EventIds }                from '../../enums/EventIds.js';
import { MockData }                from '../../repositories/mocks/MockData.js';

// Maps mode IDs that navigate to something other than LOBBY
const MODE_ROUTE_OVERRIDES = {
	tournaments: RouteIds.EVENTS,
	ranked:      RouteIds.RANKED,
};

// Label overrides for SELECT button when a special mode is selected
const SELECT_LABEL_OVERRIDES = {
	tournaments: 'VIEW EVENTS',
	ranked:      'VIEW RANKED',
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

		const view      = this._view;
		const loadout   = MockData.loadout;
		const character = MockData.characters.find( ( c ) => c.id === loadout.characterId ) ?? null;

		view.setModes( MockData.modes );
		view.setCharacterPreview( character );

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

		const mode = MockData.modes.find( ( m ) => m.id === modeId );
		const selectLabel = SELECT_LABEL_OVERRIDES[ modeId ] ?? 'SELECT';
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
