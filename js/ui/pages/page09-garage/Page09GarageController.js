/**
 * Page09GarageController — Garage / Customization Hub.
 *
 * Route: RouteIds.GARAGE ("/garage")
 *
 * Responsibilities:
 *   - Create and configure Page09GarageView.
 *   - Populate kart stats from VehicleRegistry, loadout from Settings.
 *   - Handle tab navigation: CHARACTERS and KARTS tabs switch to shell tabs or navigate out;
 *     PAINT, WHEELS, ACCESSORIES, EMOTES, LOADOUT show stubs.
 *   - Handle bottom ButtonBar: ROTATE, INSPECT, LOADOUT (toast), SAVE (toast).
 *   - Handle SAVE PRESET action.
 *
 * Data: VehicleRegistry (kart stats), Settings (selected kart id).
 */

import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page09GarageView }   from './Page09GarageView.js';
import { RouteIds }           from '../../enums/RouteIds.js';
import { ButtonIds }          from '../../enums/ButtonIds.js';
import { PageIds }            from '../../enums/PageIds.js';
import { EventIds }           from '../../enums/EventIds.js';
import { Settings }           from '../../../Settings.js';
import { getVehicleById, PLAYER_CHARACTERS } from '../../../VehicleRegistry.js';

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

		// All data comes from synchronous sources (Settings, VehicleRegistry).
		return Promise.resolve();

	}

	render( container ) {

		const view     = this._view;
		const settings = new Settings();
		const kartId   = settings.getSelectedKartId();
		const kart     = getVehicleById( kartId );
		const charName = PLAYER_CHARACTERS[ 0 ]?.label ?? 'Racer';
		const kartName = kart.label;
		const stats    = kart.stats;

		view.setKartStats( {
			speed:      stats.speed,
			accel:      stats.acceleration,
			handling:   stats.handling,
			boost:      stats.boost,
		} );

		// Preset slots
		view.setPresets( [
			{ id: 'preset_1', label: 'PRESET 1' },
			{ id: 'loadout_2', label: 'LOADOUT 2' },
		] );

		// Current loadout caption
		view.setPreviewCaption( `${charName}  /  ${kartName}` );

		// Set initial active tab
		view.setActiveTab( this._activeTab );

		// Mount
		view.mount( container );

		// Activate the garage 3D preview turntable.
		const garagePreview = this._services.garagePreview;
		if ( garagePreview ) {

			garagePreview.setKart( kartId );

		}

		if ( this._services.setRenderMode ) {

			this._services.setRenderMode( 'garage' );

		}

		this._analytics?.trackPageView( PageIds.GARAGE );

	}

	dispose() {

		// Switch render mode back to idle when leaving Garage.
		if ( this._services.setRenderMode ) {

			this._services.setRenderMode( 'idle' );

		}

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

			if ( this._services.switchTab ) {

				this._services.switchTab( 'character' );
				return;

			}
			this.navigate( RouteIds.CHARACTERS );
			return;

		}

		if ( tabId === ButtonIds.GARAGE_TAB_KARTS ) {

			if ( this._services.switchTab ) {

				this._services.switchTab( 'garage' );
				return;

			}
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
