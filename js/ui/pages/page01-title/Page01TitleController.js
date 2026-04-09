/**
 * Page01TitleController — Title Screen / Start Screen.
 *
 * Route: RouteIds.TITLE ("/")
 *
 * Responsibilities:
 *   - Create and configure Page01TitleView.
 *   - Bind [PRESS START] → navigate to HOME.
 *   - Bind utility rail buttons (SIGN-IN modal, SETTINGS route, etc.).
 *   - Populate version badge from hardcoded app version string.
 *
 * Data: Static — no external data source required.
 */

import { PageControllerBase }  from '../../core/PageControllerBase.js';
import { Page01TitleView }     from './Page01TitleView.js';
import { RouteIds }            from '../../enums/RouteIds.js';
import { ModalIds }            from '../../enums/ModalIds.js';
import { ButtonIds }           from '../../enums/ButtonIds.js';
import { PageIds }             from '../../enums/PageIds.js';
import { EventIds }            from '../../enums/EventIds.js';

const APP_VERSION = 'KART KIDS ALPHA v0.28';

export class Page01TitleController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page01TitleView} */
		this._view = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page01TitleView();

	}

	bindEvents() {

		const view = this._view;

		// [PRESS START] — navigate to Home
		this._addListener( view.pressStartBtn.el, 'click', () => {

			this._analytics?.track( EventIds.START_GAME_CLICKED );
			this.navigate( RouteIds.HOME );

		} );

		// Utility rail — delegate by actionId
		for ( const btn of view.utilityBtns ) {

			this._addListener( btn.el, 'click', () => {

				this._handleUtilityAction( btn.el.dataset.action );

			} );

		}

		// Keyboard: Escape on title screen has no action (top of nav stack).
		// Enter / Space on [PRESS START] is handled natively by button click.

	}

	loadData() {

		// Static content — no async work required.
		return Promise.resolve();

	}

	render( container ) {

		// Populate static data before mounting so it is visible immediately.
		this._view.setVersion( APP_VERSION );
		this._view.setFeaturedEventLabel( 'Kart Kids Racing' );

		this._view.mount( container );

		this._analytics?.trackPageView( PageIds.TITLE );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * Dispatch the correct action for each utility rail button.
	 *
	 * @param {string} actionId
	 */
	_handleUtilityAction( actionId ) {

		switch ( actionId ) {

			case ButtonIds.TITLE_SIGN_IN:
				this._analytics?.track( EventIds.SIGN_IN_CLICKED );
				this._view.setSignInLoading( true );
				this.openModal( { id: ModalIds.SIGN_IN } );
				// Sign-in result will be handled externally; loading cleared on modal close.
				break;

			case ButtonIds.TITLE_SETTINGS:
				this.navigate( RouteIds.SETTINGS );
				break;

			case ButtonIds.TITLE_ACCESSIBILITY:
				this.navigate( RouteIds.SETTINGS + '#accessibility' );
				break;

			case ButtonIds.TITLE_LANGUAGE:
				this.navigate( RouteIds.SETTINGS + '#language' );
				break;

			case ButtonIds.TITLE_FEATURED_EVENT:
				this.navigate( RouteIds.EVENTS );
				break;

			default:
				break;

		}

	}

}
