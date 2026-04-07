/**
 * Page10CharacterSelectController — Character Select.
 *
 * Route: RouteIds.CHARACTERS ("/characters")
 *
 * Responsibilities:
 *   - Create and configure Page10CharacterSelectView.
 *   - Populate the 2-column character card grid from MockData.characters.
 *   - Track the selected character (starts with the currently equipped one).
 *   - Update the stats panel and special ability panel on selection change.
 *   - SELECT button: equip selected character and navigate back via navigateBack().
 *   - Locked characters: show a toast explaining they are unavailable.
 *
 * Data: MockData.characters, MockData.loadout — no async required.
 *
 * Caller-return context:
 *   NavigationService back-stack handles the return destination automatically.
 *   This controller never inspects or stores the caller route — it always
 *   calls navigateBack() so Quick Play → Characters → back goes to Quick Play,
 *   and Garage → Characters → back goes to Garage.
 */

import { PageControllerBase }        from '../../core/PageControllerBase.js';
import { Page10CharacterSelectView } from './Page10CharacterSelectView.js';
import { ButtonIds }                 from '../../enums/ButtonIds.js';
import { PageIds }                   from '../../enums/PageIds.js';
import { EventIds }                  from '../../enums/EventIds.js';
import { MockData }                  from '../../repositories/mocks/MockData.js';

export class Page10CharacterSelectController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page10CharacterSelectView} */
		this._view = null;

		/**
		 * The character currently highlighted in the UI.
		 * Starts as the equipped character from loadout.
		 * @type {object | null}
		 */
		this._selectedCharacter = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page10CharacterSelectView();

		// Default selection: currently equipped character.
		this._selectedCharacter = MockData.characters.find(
			c => c.id === MockData.loadout.characterId
		) ?? MockData.characters[ 0 ] ?? null;

	}

	bindEvents() {

		const view = this._view;

		// Back button
		this._addListener( view.backBtn, 'click', () => {

			this._analytics?.track( EventIds.BACK_CLICKED );
			this.navigateBack();

		} );

		// Character card grid — cards fire a delegated 'kk:character:select' event
		this._addListener( view.cardGrid, 'kk:character:select', ( e ) => {

			const { characterId } = e.detail;
			this._handleCharacterSelect( characterId );

		} );

		// SELECT (confirm) button
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

		// Populate card grid.
		view.setCharacters( MockData.characters, MockData.loadout.characterId );

		// Show the initially-selected character in the detail panels.
		if ( this._selectedCharacter ) {

			view.setSelectedCharacter( this._selectedCharacter, MockData.loadout.characterId );

		}

		// Mount.
		view.mount( container );

		this._analytics?.trackPageView( PageIds.CHARACTERS );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * User clicked a character card.
	 *
	 * @param {string} characterId
	 */
	_handleCharacterSelect( characterId ) {

		const character = MockData.characters.find( c => c.id === characterId );
		if ( ! character ) return;

		if ( ! character.owned ) {

			this.showToast( {
				message:  `${character.name} is LOCKED — visit the Shop to unlock.`,
				variant:  'warning',
				duration: 3000,
			} );

			// Still update the preview so the player can inspect locked characters.
			this._selectedCharacter = character;
			this._view.setSelectedCharacter( character, MockData.loadout.characterId );
			this._view.setCardSelected( characterId );

			this._analytics?.track( EventIds.CHARACTER_SKIN_VIEWED, { characterId } );
			return;

		}

		this._selectedCharacter = character;
		this._view.setSelectedCharacter( character, MockData.loadout.characterId );
		this._view.setCardSelected( characterId );

		this._analytics?.track( EventIds.CHARACTER_SELECTED, { characterId } );

	}

	/**
	 * User pressed the SELECT / confirm button.
	 * Equip the selected character (owned characters only), then return to caller.
	 */
	_handleConfirm() {

		const character = this._selectedCharacter;

		if ( ! character ) return;

		if ( ! character.owned ) {

			this.showToast( {
				message:  'Cannot equip a LOCKED character.',
				variant:  'warning',
				duration: 2500,
			} );
			return;

		}

		// In production this would dispatch a command to GarageService.
		// For mock phase, update the loadout reference in MockData is read-only;
		// we just emit the analytics event and navigate back.
		this._analytics?.track( EventIds.CHARACTER_EQUIPPED, { characterId: character.id } );

		this.showToast( {
			message:  `${character.name} EQUIPPED`,
			variant:  'success',
			duration: 2000,
		} );

		this.navigateBack();

	}

}
