/**
 * Page17TrackEditorController — Track Editor.
 *
 * Route: RouteIds.EDITOR ("/editor")
 *
 * Responsibilities:
 *   - Create and configure Page17TrackEditorView.
 *   - Wire PageHeader back → RouteIds.CREATE.
 *   - Wire left-panel category tab buttons (ROAD PIECES, TURNS, RAMPS, BRIDGES,
 *     TUNNELS, JUMPS) — updates active palette category in the view.
 *   - Wire UNDO / REDO toolbar buttons → command-stack stubs.
 *   - Wire SAVE → save action + analytics.
 *   - Wire TEST DRIVE → gameplay preview state stub + analytics.
 *   - Wire VALIDATE → validation panel focus.
 *   - Wire PUBLISH → publish confirmation modal.
 *   - Wire metadata field changes → internal state tracking.
 *   - Emit analytics page view on mount.
 *
 * NOTE: This controller manages the MENU CHROME only.
 * The actual 3D editor canvas (js/editor/) mounts into the viewport placeholder
 * via the data-preview-target="editor-viewport" attribute on the center panel.
 * The editor code communicates through CustomEvents on document:
 *   kk:editor:ready          — fires when the 3D editor has initialized
 *   kk:editor:validation     — fires with { checkpointCount, status }
 *   kk:editor:saved          — fires after a successful save
 *
 * Data: no async data required; track metadata defaults from params.
 */

import { PageControllerBase }       from '../../core/PageControllerBase.js';
import { Page17TrackEditorView }    from './Page17TrackEditorView.js';
import { RouteIds }                 from '../../enums/RouteIds.js';
import { ButtonIds }                from '../../enums/ButtonIds.js';
import { PageIds }                  from '../../enums/PageIds.js';
import { EventIds }                 from '../../enums/EventIds.js';

export class Page17TrackEditorController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page17TrackEditorView} */
		this._view = null;

		/**
		 * In-memory track state for the editor session.
		 * Will be persisted on SAVE.
		 *
		 * @type {{ name: string, creator: string, style: string, difficulty: string }}
		 */
		this._trackState = {
			name:       params.trackName   ?? '[New Track]',
			creator:    params.creator     ?? '[You]',
			style:      params.style       ?? 'Standard',
			difficulty: params.difficulty  ?? 'Medium',
		};

		/** @type {{ checkpointCount: string, status: string }} */
		this._validationState = {
			checkpointCount: '0/4',
			status:          'Not validated',
		};

		/** Current palette category */
		this._activePaletteCategory = ButtonIds.EDITOR_TAB_ROAD_PIECES;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page17TrackEditorView();

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → /create
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.TRACK_EDITOR } );
			this.navigate( RouteIds.CREATE );

		} );

		// Palette category tabs (left panel)
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			this._activePaletteCategory = tabId;
			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, {
				tab:  tabId,
				page: PageIds.TRACK_EDITOR,
			} );
			view.setActivePaletteCategory( tabId );

		} );

		// Toolbar action buttons (UNDO, REDO, SAVE, TEST DRIVE, VALIDATE, PUBLISH)
		this._addListener( view.root, 'kk:cta-button:click', ( e ) => {

			this._handleToolbarAction( e.detail.actionId );

		} );

		// Metadata field changes — delegate on the metadata container
		this._addListener( view.metadataPanelEl, 'change', ( e ) => {

			const field = e.target.dataset.field;
			if ( ! field ) return;

			this._trackState[ field ] = e.target.value;

		} );

		// Editor 3D system events (from existing js/editor/ code via document)
		this._addListener( document, 'kk:editor:ready', () => {

			view.setViewportReady( true );

		} );

		this._addListener( document, 'kk:editor:validation', ( e ) => {

			if ( e.detail ) {
				this._validationState = e.detail;
				view.setValidation( e.detail );
			}

		} );

		this._addListener( document, 'kk:editor:saved', () => {

			this.showToast( {
				message:  'Track saved.',
				variant:  'success',
				duration: 2500,
			} );

		} );

	}

	loadData() {

		// No async required for editor chrome.
		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Pre-populate metadata fields
		view.setMetadata( this._trackState );

		// Pre-populate validation panel
		view.setValidation( this._validationState );

		view.mount( container );

		this._analytics?.trackPageView( PageIds.TRACK_EDITOR );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * Route toolbar button presses to the appropriate actions.
	 *
	 * @param {string} actionId
	 */
	_handleToolbarAction( actionId ) {

		switch ( actionId ) {

			case ButtonIds.EDITOR_UNDO:
				// Dispatch to existing editor command stack via CustomEvent
				document.dispatchEvent( new CustomEvent( 'kk:editor:undo', { bubbles: false } ) );
				break;

			case ButtonIds.EDITOR_REDO:
				document.dispatchEvent( new CustomEvent( 'kk:editor:redo', { bubbles: false } ) );
				break;

			case ButtonIds.EDITOR_SAVE:
				this._analytics?.track( EventIds.TRACK_SAVED, { name: this._trackState.name } );
				document.dispatchEvent( new CustomEvent( 'kk:editor:save', {
					bubbles: false,
					detail:  { trackState: this._trackState },
				} ) );
				break;

			case ButtonIds.EDITOR_TEST_DRIVE:
				this._analytics?.track( EventIds.TRACK_TESTED, { name: this._trackState.name } );
				document.dispatchEvent( new CustomEvent( 'kk:editor:test-drive', { bubbles: false } ) );
				break;

			case ButtonIds.EDITOR_VALIDATION:
				// Focus the validation panel in the right rail
				this._view.focusValidationPanel();
				break;

			case ButtonIds.EDITOR_PUBLISH:
				this._handlePublish();
				break;

			default:
				break;

		}

	}

	/**
	 * Open the publish confirmation modal.
	 * On confirm, dispatch the publish event to the editor system.
	 */
	_handlePublish() {

		this.openConfirm( {
			title:          'PUBLISH TRACK',
			message:        `Publish "${this._trackState.name}" to the community? You can still edit after publishing.`,
			confirmLabel:   'PUBLISH',
			cancelLabel:    'CANCEL',
			onConfirm: () => {

				this._analytics?.track( EventIds.TRACK_PUBLISHED, {
					name:       this._trackState.name,
					difficulty: this._trackState.difficulty,
					style:      this._trackState.style,
				} );

				document.dispatchEvent( new CustomEvent( 'kk:editor:publish', {
					bubbles: false,
					detail:  { trackState: this._trackState },
				} ) );

			},
		} );

	}

}
