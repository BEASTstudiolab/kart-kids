/**
 * TracksPanel — TRACKS tab content panel (track management workshop).
 *
 * Composes TrackBrowser for the browse/minimap UI and adds
 * workshop-specific features: CREATE TRACK card, delete/share/edit actions.
 * Clicking a card shows its details and management actions but does NOT
 * select the track for racing — race track selection lives on the PLAY screen.
 *
 * Lifecycle: constructor(container, services), show(), hide(), dispose().
 */

import { getTracks }                          from '../../TrackRegistry.js';
import { deleteNamedTrack }                   from '../../editor/Persistence.js';
import { Settings }                           from '../../Settings.js';
import { TrackBrowser }                       from '../components/TrackBrowser.js';

export class TracksPanel {

	/**
	 * @param {HTMLElement} container  The #kk-panel-tracks div created by AppShell.
	 * @param {object}      services   AppShell service bag.
	 */
	constructor( container, services ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {Settings} */
		this._settings = new Settings();

		/** @type {HTMLElement|null} */
		this._root = null;

		/** @type {TrackBrowser|null} */
		this._browser = null;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( TracksPanel._cssInjected ) return;
		TracksPanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* ===================================================
			   Tracks panel root — full page, opaque background
			   =================================================== */

			.kk-tracks {
				width: 100%;
				height: 100%;
				overflow-y: auto;
				overflow-x: hidden;
				background: rgba( 10, 10, 10, 1.0 );
				padding: var(--space-6, 1.5rem);
				box-sizing: border-box;
				-webkit-overflow-scrolling: touch;
			}

			/* ===================================================
			   Create card — dashed border, big +
			   =================================================== */

			.kk-tracks__card--create {
				border-style: dashed;
				border-color: rgba( 255, 255, 255, 0.2 );
				background: rgba( 20, 20, 30, 0.4 );
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: var(--space-2, 0.5rem);
			}

			.kk-tracks__card--create:hover {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 14px rgba( 249, 115, 22, 0.25 );
			}

			.kk-tracks__create-plus {
				font-size: 2.5rem;
				font-weight: 300;
				line-height: 1;
				color: var(--color-ink-300, #aaa);
				transition: color var(--duration-fast, 100ms) var(--ease-standard, ease);
			}

			.kk-tracks__card--create:hover .kk-tracks__create-plus {
				color: var(--color-accent-orange, #f97316);
			}

			.kk-tracks__create-label {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.14em);
				color: var(--color-ink-300, #aaa);
			}

			@media ( max-width: 480px ) {

				.kk-tracks {
					padding: var(--space-4, 1rem);
				}

			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = document.createElement( 'div' );
		root.className = 'kk-tracks';
		root.setAttribute( 'role', 'region' );
		root.setAttribute( 'aria-label', 'Tracks — track management' );

		// Create the TrackBrowser with manage actions enabled.
		this._browser = new TrackBrowser( root, {
			onTrackSelected: ( trackId ) => this._onTrackSelected( trackId ),
			showManageActions: true,
		} );

		// Wire up manage actions (share/edit/delete).
		this._browser.setManageActionHandler( ( action, track ) => {

			if ( action === 'share' ) this._shareTrack( track );
			else if ( action === 'edit' ) this._editTrack( track );
			else if ( action === 'delete' ) this._deleteTrack( track );

		} );

		// Append CREATE TRACK card to the my tracks carousel.
		const myTracksRow = this._browser.getMyTracksRow();
		if ( myTracksRow ) {

			myTracksRow.appendChild( this._buildCreateCard() );

		}

		this._root = root;

	}

	// ---------------------------------------------------------------------------
	// Track selection callback
	// ---------------------------------------------------------------------------

	/**
	 * Handle track card click — update the detail panel only.
	 *
	 * This is a workshop view: clicking a card shows its details and
	 * management actions, but does NOT select the track for racing.
	 * Race track selection is handled by the PLAY screen's TrackBrowser.
	 *
	 * @param {string} _trackId
	 */
	_onTrackSelected( trackId ) {

		// Workshop mode: persist selection to Settings so TrackBrowser's
		// highlight and detail panel update correctly on re-render.
		// This does NOT affect the PLAY screen — RacePanel has its own
		// TrackBrowser instance with its own onTrackSelected callback.
		this._settings.setSelectedTrackId( trackId );

		// Re-append CREATE TRACK card (TrackBrowser.re-render clears the row).
		this._reappendCreateCard();

	}

	/**
	 * Re-append the CREATE TRACK card to the my tracks carousel row.
	 * Called after any TrackBrowser re-render that clears the row.
	 */
	_reappendCreateCard() {

		const myTracksRow = this._browser.getMyTracksRow();
		if ( myTracksRow ) {

			myTracksRow.appendChild( this._buildCreateCard() );

		}

	}

	// ---------------------------------------------------------------------------
	// Workshop-specific cards
	// ---------------------------------------------------------------------------

	/**
	 * Build the "CREATE TRACK" card with a big + icon.
	 *
	 * @returns {HTMLElement}
	 */
	_buildCreateCard() {

		const card = document.createElement( 'div' );
		card.className = 'kk-tracks__card kk-tracks__card--create';

		const plus = document.createElement( 'div' );
		plus.className = 'kk-tracks__create-plus';
		plus.textContent = '+';
		card.appendChild( plus );

		const label = document.createElement( 'div' );
		label.className = 'kk-tracks__create-label';
		label.textContent = 'CREATE TRACK';
		card.appendChild( label );

		card.addEventListener( 'click', () => {

			window.open( 'track-editor.html', '_blank', 'noopener' );

		} );

		return card;

	}

	// ---------------------------------------------------------------------------
	// Workshop actions
	// ---------------------------------------------------------------------------

	/**
	 * Copy the share URL for a user track to the clipboard.
	 *
	 * @param {object} track  User track object with cells field.
	 */
	_shareTrack( track ) {

		const url = window.location.origin + '/index.html?map=' + track.cells;

		navigator.clipboard.writeText( url ).then( () => {

			this._services.notification?.show( {
				message: 'Link copied!',
				variant: 'success',
				duration: 2000,
			} );

		} ).catch( () => {

			this._services.notification?.show( {
				message: 'Failed to copy link',
				variant: 'error',
				duration: 2000,
			} );

		} );

	}

	/**
	 * Open the editor for a user track.
	 *
	 * @param {object} track  User track object with cells field.
	 */
	_editTrack( track ) {

		window.open( `track-editor.html#map=${ encodeURIComponent( track.cells ) }`, '_blank', 'noopener' );

	}

	/**
	 * Delete a user track after confirmation.
	 *
	 * @param {object} track  User track object.
	 */
	_deleteTrack( track ) {

		const confirmed = window.confirm( `Delete "${ track.name }"? This cannot be undone.` );
		if ( ! confirmed ) return;

		deleteNamedTrack( track.name );

		// If the deleted track was selected, fall back to default.
		const selectedId = this._settings.getSelectedTrackId();
		if ( selectedId === 'user:' + track.name ) {

			const builtIn = getTracks();
			const fallback = builtIn.length > 0 ? builtIn[ 0 ].id : 'starter-circuit';
			this._settings.setSelectedTrackId( fallback );

		}

		// Refresh the browser to reflect deletion.
		this._browser.refresh();
		this._reappendCreateCard();

		this._services.notification?.show( {
			message: `"${ track.name }" deleted`,
			variant: 'info',
			duration: 2000,
		} );

	}

	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Called when the TRACKS tab becomes active.
	 * Re-reads user tracks and refreshes the display.
	 */
	show() {

		// Re-read settings for delete fallback checks.
		this._settings = new Settings();

		this._browser.show();
		this._reappendCreateCard();

	}

	/**
	 * Called when the TRACKS tab becomes inactive.
	 */
	hide() {

		this._browser.hide();

	}

	/**
	 * Full teardown. Called only if AppShell itself is destroyed.
	 */
	dispose() {

		if ( this._browser ) {

			this._browser.dispose();
			this._browser = null;

		}

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}

TracksPanel._cssInjected = false;
