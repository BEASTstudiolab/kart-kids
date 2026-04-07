/**
 * Page22PauseController — Pause Menu.
 *
 * Route: RouteIds.PAUSE ("/pause")
 *
 * Responsibilities:
 *   - Create and configure Page22PauseView.
 *   - Wire RESUME button → close overlay and resume gameplay via game event.
 *   - Wire RESTART button → restart session with loading state.
 *   - Wire SETTINGS button → navigate to RouteIds.SETTINGS.
 *   - Wire CONTROLS button → open ModalIds.CONTROLS_REFERENCE (in-page modal).
 *   - Wire LEAVE RACE button → open ConfirmationDialog; on confirm navigate HOME.
 *   - Wire Escape key → same as RESUME.
 *   - Emit analytics events for resume, restart, and leave.
 *
 * Data: Pause-time session state. In M2 all values are hardcoded placeholders.
 *       No MockData entries exist for pause state per spec §3.
 *
 * Architecture notes:
 *   - The pause overlay sits above the game canvas (position:fixed, z-index var(--z-modal)).
 *     The controller does not own the game canvas — it dispatches a custom DOM event
 *     (kk:game:resume / kk:game:restart) for the game layer to react to.
 *   - CONTROLS_REFERENCE modal ID is not in ModalIds enum (M2 scope); the controller
 *     opens it via ModalService with the raw id string from ModalIds.CONTROLS_REFERENCE
 *     if present, or falls back to a no-op with a console note.
 *   - Focus trap is owned by the view. The controller does not manage focus directly.
 */

import { PageControllerBase }   from '../../core/PageControllerBase.js';
import { Page22PauseView }      from './Page22PauseView.js';
import { RouteIds }             from '../../enums/RouteIds.js';
import { ModalIds }             from '../../enums/ModalIds.js';
import { PageIds }              from '../../enums/PageIds.js';
import { EventIds }             from '../../enums/EventIds.js';

export class Page22PauseController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page22PauseView} */
		this._view = null;

		/** @type {boolean} */
		this._restarting = false;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page22PauseView();

	}

	bindEvents() {

		const view = this._view;

		// RESUME
		this._addListener( view.resumeBtn.el, 'click', () => {

			this.resume();

		} );

		// RESTART
		this._addListener( view.restartBtn.el, 'click', () => {

			this.restart();

		} );

		// SETTINGS
		this._addListener( view.settingsBtn.el, 'click', () => {

			view.settingsBtn.setLoading( true );
			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { route: RouteIds.SETTINGS } );
			this.navigate( RouteIds.SETTINGS );

		} );

		// CONTROLS — open controls reference modal
		this._addListener( view.controlsBtn.el, 'click', () => {

			// ModalIds.CONTROLS_REFERENCE is not defined in the M2 enum.
			// Open via the generic id string; ModalService will no-op gracefully
			// if the modal is not registered yet.
			const modalId = ModalIds.CONTROLS_REFERENCE ?? 'controls_reference';
			this.openModal( { id: modalId } );

		} );

		// LEAVE RACE — open confirmation dialog
		this._addListener( view.leaveRaceBtn.el, 'click', () => {

			this._openLeaveConfirm();

		} );

		// Escape key — same as RESUME per spec §6
		this._addListener( view.root, 'keydown', ( e ) => {

			if ( e.key === 'Escape' ) {
				e.preventDefault();
				this.resume();
			}

		} );

		// ConfirmationDialog events bubble up from the view's dialog element
		this._addListener( view.root, 'kk:confirm-dialog:confirm', () => {

			this._analytics?.track( EventIds.GAME_LEFT );
			this.navigate( RouteIds.HOME );

		} );

		this._addListener( view.root, 'kk:confirm-dialog:cancel', () => {

			// Return focus to LEAVE RACE button per spec §6
			view.leaveRaceBtn.el.focus( { preventScroll: true } );

		} );

	}

	loadData() {

		// Pause state comes from the game session.
		// In M2, placeholder values are hardcoded in the view.
		return Promise.resolve();

	}

	render( container ) {

		this._view.mount( container );
		this._analytics?.trackPageView( PageIds.PAUSE );
		this._analytics?.track( EventIds.GAME_PAUSED );

	}

	dispose() {

		this._restarting = false;
		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Public actions (also callable by the game layer via reference)
	// ---------------------------------------------------------------------------

	/**
	 * Close the pause overlay and resume gameplay.
	 * Dispatches kk:game:resume on document so the game layer can react.
	 */
	resume() {

		if ( this._disposed ) return;

		this._analytics?.track( EventIds.GAME_RESUMED );

		document.dispatchEvent( new CustomEvent( 'kk:game:resume', { bubbles: false } ) );

		// Navigate back to previous state — game layer should handle removal.
		// In M2 scaffold, navigateBack() returns to whatever was before /pause.
		this.navigateBack();

	}

	/**
	 * Restart the current race session.
	 * Shows a loading spinner on the RESTART button while the session resets.
	 * Dispatches kk:game:restart on document so the game layer can react.
	 */
	restart() {

		if ( this._disposed || this._restarting ) return;

		this._restarting = true;
		this._view.restartBtn.setLoading( true );
		this._analytics?.track( EventIds.GAME_RESTARTED );

		document.dispatchEvent( new CustomEvent( 'kk:game:restart', { bubbles: false } ) );

		// Game layer is expected to dispatch kk:game:restart:complete when done.
		// In M2 scaffold, we resolve after a short frame to clear loading state.
		const onComplete = () => {

			document.removeEventListener( 'kk:game:restart:complete', onComplete );
			if ( this._disposed ) return;
			this._restarting = false;
			this._view.restartBtn.setLoading( false );
			// Return focus to resume after restart clears
			this._view.resumeBtn.el.focus( { preventScroll: true } );

		};

		document.addEventListener( 'kk:game:restart:complete', onComplete, { once: true } );

	}

	// ---------------------------------------------------------------------------
	// Internal
	// ---------------------------------------------------------------------------

	_openLeaveConfirm() {

		this._view.openLeaveConfirmDialog();

	}

}
