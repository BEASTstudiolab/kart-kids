/**
 * Page11KartSelectController — Kart Select.
 *
 * Route: RouteIds.KARTS ("/karts")
 *
 * Responsibilities:
 *   - Create and configure Page11KartSelectView.
 *   - Populate the kart thumbnail strip and hero preview from VehicleRegistry.
 *   - Track the selected kart (starts with the currently equipped one).
 *   - Update the stats panel on thumbnail click.
 *   - TEST DRIVE button: show toast placeholder (gameplay integration pending).
 *   - SELECT button: equip selected kart via Settings and navigate back.
 *
 * Data: VehicleRegistry (all vehicles), Settings (selected kart id).
 *
 * Caller-return context:
 *   NavigationService back-stack handles the return destination automatically.
 *   The controller always calls navigateBack() — no caller inspection needed.
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page11KartSelectView }  from './Page11KartSelectView.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';
import { Settings }              from '../../../Settings.js';
import { getAllVehicles, getVehicleById } from '../../../VehicleRegistry.js';

export class Page11KartSelectController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page11KartSelectView} */
		this._view = null;

		/**
		 * Currently highlighted kart in the UI.
		 * @type {object | null}
		 */
		this._selectedKart = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page11KartSelectView();

		// Default: currently equipped kart from Settings.
		this._settings = new Settings();
		const equippedId = this._settings.getSelectedKartId();
		const allKarts = this._kartsList();
		this._selectedKart = allKarts.find( k => k.id === equippedId ) ?? allKarts[ 0 ] ?? null;

	}

	/**
	 * Map VehicleRegistry entries to the shape the view expects.
	 * All karts are considered owned (no shop/unlock system yet).
	 * @returns {Array<object>}
	 */
	_kartsList() {

		return getAllVehicles().map( ( v ) => ( {
			id:       v.id,
			name:     v.label,
			owned:    true,
			speed:    v.stats.speed,
			accel:    v.stats.acceleration,
			handling: v.stats.handling,
			traction: v.stats.weight,
			boost:    v.stats.boost,
		} ) );

	}

	bindEvents() {

		const view = this._view;

		// Back button
		this._addListener( view.backBtn, 'click', () => {

			this._analytics?.track( EventIds.BACK_CLICKED );
			this.navigateBack();

		} );

		// Thumbnail strip — delegated custom event
		this._addListener( view.thumbStrip, 'kk:kart:select', ( e ) => {

			const { kartId } = e.detail;
			this._handleKartSelect( kartId );

		} );

		// TEST DRIVE
		this._addListener( view.testDriveBtn.el, 'click', () => {

			this._handleTestDrive();

		} );

		// SELECT (confirm)
		this._addListener( view.selectBtn.el, 'click', () => {

			this._handleConfirm();

		} );

	}

	loadData() {

		// All data comes from synchronous sources (VehicleRegistry, Settings).
		return Promise.resolve();

	}

	render( container ) {

		const view       = this._view;
		const karts      = this._kartsList();
		const equippedId = this._settings.getSelectedKartId();

		// Populate thumbnail strip.
		view.setKarts( karts, equippedId );

		// Show initial selection.
		if ( this._selectedKart ) {

			view.setSelectedKart( this._selectedKart, equippedId );

		}

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.KARTS );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * User clicked a kart thumbnail.
	 *
	 * @param {string} kartId
	 */
	_handleKartSelect( kartId ) {

		const karts = this._kartsList();
		const kart = karts.find( k => k.id === kartId );
		if ( ! kart ) return;

		if ( ! kart.owned ) {

			this.showToast( {
				message:  `${kart.name} is LOCKED — visit the Shop to unlock.`,
				variant:  'warning',
				duration: 3000,
			} );

		}

		// Always update preview so players can inspect locked karts.
		this._selectedKart = kart;
		this._view.setSelectedKart( kart, this._settings.getSelectedKartId() );
		this._view.setThumbSelected( kartId );

		this._analytics?.track( EventIds.KART_SELECTED, { kartId } );

	}

	/**
	 * TEST DRIVE — placeholder until gameplay integration is ready.
	 */
	_handleTestDrive() {

		const kart = this._selectedKart;
		if ( ! kart ) return;

		if ( ! kart.owned ) {

			this.showToast( {
				message:  'Cannot test drive a LOCKED kart.',
				variant:  'warning',
				duration: 2500,
			} );
			return;

		}

		this._analytics?.track( EventIds.TEST_DRIVE_STARTED, { kartId: kart.id } );

		this.showToast( {
			message:  `TEST DRIVE with ${kart.name} — coming soon`,
			variant:  'info',
			duration: 2500,
		} );

	}

	/**
	 * SELECT — equip selected kart and return to caller.
	 */
	_handleConfirm() {

		const kart = this._selectedKart;
		if ( ! kart ) return;

		if ( ! kart.owned ) {

			this.showToast( {
				message:  'Cannot equip a LOCKED kart.',
				variant:  'warning',
				duration: 2500,
			} );
			return;

		}

		// Persist the selection to Settings.
		this._settings.setSelectedKartId( kart.id );
		this._analytics?.track( EventIds.KART_EQUIPPED, { kartId: kart.id } );

		this.showToast( {
			message:  `${kart.name} EQUIPPED`,
			variant:  'success',
			duration: 2000,
		} );

		this.navigateBack();

	}

}
