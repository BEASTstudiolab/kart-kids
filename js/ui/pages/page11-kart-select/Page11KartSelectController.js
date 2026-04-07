/**
 * Page11KartSelectController — Kart Select.
 *
 * Route: RouteIds.KARTS ("/karts")
 *
 * Responsibilities:
 *   - Create and configure Page11KartSelectView.
 *   - Populate the kart thumbnail strip and hero preview from MockData.karts.
 *   - Track the selected kart (starts with the currently equipped one).
 *   - Update the stats panel on thumbnail click.
 *   - TEST DRIVE button: show toast placeholder (gameplay integration pending).
 *   - SELECT button: equip selected kart (owned only) and navigate back.
 *
 * Data: MockData.karts, MockData.loadout — no async required.
 *
 * Caller-return context:
 *   NavigationService back-stack handles the return destination automatically.
 *   The controller always calls navigateBack() — no caller inspection needed.
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page11KartSelectView }  from './Page11KartSelectView.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';
import { MockData }              from '../../repositories/mocks/MockData.js';

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

		// Default: currently equipped kart from loadout.
		this._selectedKart = MockData.karts.find(
			k => k.id === MockData.loadout.kartId
		) ?? MockData.karts[ 0 ] ?? null;

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

		// All data is synchronous MockData — nothing to fetch.
		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Populate thumbnail strip.
		view.setKarts( MockData.karts, MockData.loadout.kartId );

		// Show initial selection.
		if ( this._selectedKart ) {

			view.setSelectedKart( this._selectedKart, MockData.loadout.kartId );

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

		const kart = MockData.karts.find( k => k.id === kartId );
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
		this._view.setSelectedKart( kart, MockData.loadout.kartId );
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

		// In production this dispatches a command to GarageService.
		this._analytics?.track( EventIds.KART_EQUIPPED, { kartId: kart.id } );

		this.showToast( {
			message:  `${kart.name} EQUIPPED`,
			variant:  'success',
			duration: 2000,
		} );

		this.navigateBack();

	}

}
