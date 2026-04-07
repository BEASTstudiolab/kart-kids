/**
 * Page09GarageController — Garage / Customization Hub.
 *
 * Route: RouteIds.GARAGE ("/garage")
 *
 * Responsibilities:
 *   - Create and configure Page09GarageView.
 *   - Populate kart stats, loadout preset slots from MockData.
 *   - Handle tab navigation: CHARACTERS and KARTS tabs navigate out;
 *     PAINT, WHEELS, ACCESSORIES, EMOTES, LOADOUT show stubs.
 *   - Handle bottom ButtonBar: ROTATE, INSPECT, LOADOUT (toast), SAVE (toast).
 *   - Handle SAVE PRESET action.
 *
 * Data: MockData.karts, MockData.loadout — no async required.
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page09GarageView }   from './Page09GarageView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ButtonIds }          from '../../enums/ButtonIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { MockData }           from '../../repositories/mocks/MockData.js';

/** Tabs that navigate to a dedicated route. */
const NAVIGATING_TABS = new Set( [
	ButtonIds.GARAGE_TAB_CHARACTERS,
	ButtonIds.GARAGE_TAB_KARTS,
] );

/** Stub label shown in preview caption for in-page tabs. */
const TAB_STUBS = {
	[ ButtonIds.GARAGE_TAB_PAINT ]:       'PAINT',
	[ ButtonIds.GARAGE_TAB_WHEELS ]:      'WHEELS',
	[ ButtonIds.GARAGE_TAB_ACCESSORIES ]: 'ACCESSORIES',
	[ ButtonIds.GARAGE_TAB_EMOTES ]:      'EMOTES',
};

export class Page09GarageController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page09GarageView} */
		this._view = null;

		/** @type {string} Currently active tab ButtonId. */
		this._activeTab = ButtonIds.GARAGE_TAB_KARTS;

		/** @type {boolean} Turntable rotation active. */
		this._rotating = false;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page09GarageView();

	}

	bindEvents() {

		const view = this._view;

		// Back button
		this._addListener( view.backBtn, 'click', () => {

			this._analytics?.track( EventIds.BACK_CLICKED );
			this.navigate( RouteIds.HOME );

		} );

		// Tab bar
		for ( const btn of view.tabBtns ) {

			this._addListener( btn, 'click', () => {

				const tabId = btn.dataset.action;
				this._handleTabClick( tabId );

			} );

		}

		// Bottom bar: ROTATE
		this._addListener( view.rotateBtn.el, 'click', () => {

			this._rotating = ! this._rotating;
			view.setRotating( this._rotating );
			view.rotateBtn.setPressed( this._rotating );

		} );

		// Bottom bar: INSPECT
		this._addListener( view.inspectBtn.el, 'click', () => {

			this.showToast( { message: 'INSPECT MODE — coming soon', variant: 'info', duration: 2000 } );

		} );

		// Bottom bar: LOADOUT
		this._addListener( view.loadoutBtn.el, 'click', () => {

			this.showToast( { message: 'LOADOUT saved', variant: 'success', duration: 2000 } );
			this._analytics?.track( EventIds.GARAGE_ITEM_EQUIPPED );

		} );

		// Bottom bar: SAVE
		this._addListener( view.saveBtn.el, 'click', () => {

			this._handleSave();

		} );

		// Preset slot buttons (dynamically created)
		for ( const btn of view.presetBtns ) {

			this._addListener( btn, 'click', () => {

				const presetId = btn.dataset.presetId;
				this._handlePresetSelect( presetId );

			} );

		}

	}

	loadData() {

		// All data is synchronous MockData — nothing to fetch.
		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Kart stats from current loadout kart.
		const kart = MockData.karts.find( k => k.id === MockData.loadout.kartId )
			?? MockData.karts[ 0 ];

		view.setKartStats( {
			speed:      kart.speed,
			accel:      kart.accel,
			handling:   kart.handling,
			boost:      kart.boost,
		} );

		// Preset slots
		view.setPresets( [
			{ id: 'preset_1', label: 'PRESET 1' },
			{ id: 'loadout_2', label: 'LOADOUT 2' },
		] );

		// Current loadout caption
		view.setPreviewCaption( `${MockData.loadout.characterName}  /  ${MockData.loadout.kartName}` );

		// Set initial active tab
		view.setActiveTab( this._activeTab );

		// Mount
		view.mount( container );

		this._analytics?.trackPageView( PageIds.GARAGE );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * @param {string} tabId  ButtonIds constant for the clicked tab.
	 */
	_handleTabClick( tabId ) {

		this._analytics?.track( EventIds.GARAGE_TAB_CHANGED, { tab: tabId } );

		if ( tabId === ButtonIds.GARAGE_TAB_CHARACTERS ) {

			this.navigate( RouteIds.CHARACTERS );
			return;

		}

		if ( tabId === ButtonIds.GARAGE_TAB_KARTS ) {

			this.navigate( RouteIds.KARTS );
			return;

		}

		// In-page stubs: update active tab and show caption
		this._activeTab = tabId;
		this._view.setActiveTab( tabId );

		const stubLabel = TAB_STUBS[ tabId ] ?? 'CUSTOMIZATION';
		this._view.setPreviewCaption( `${stubLabel} — coming soon` );

	}

	_handleSave() {

		this._analytics?.track( EventIds.GARAGE_PRESET_SAVED );

		this.showToast( {
			message:  'PRESET SAVED',
			variant:  'success',
			duration: 2500,
		} );

	}

	/**
	 * @param {string} presetId
	 */
	_handlePresetSelect( presetId ) {

		this._analytics?.track( EventIds.GARAGE_ITEM_EQUIPPED, { preset: presetId } );

		this.showToast( {
			message:  `PRESET LOADED`,
			variant:  'success',
			duration: 2000,
		} );

	}

}
