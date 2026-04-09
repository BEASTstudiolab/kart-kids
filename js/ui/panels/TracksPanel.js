/**
 * TracksPanel — TRACKS tab content panel.
 *
 * Scrollable list of official tracks (from TrackRegistry) and user-created
 * tracks (from editor localStorage). Supports select, share, edit, and
 * delete actions.
 *
 * Lifecycle: constructor(container, services), show(), hide(), dispose().
 *
 * Data sources:
 *   - TrackRegistry.getTracks()          — built-in tracks
 *   - getSavedTracks() / deleteNamedTrack() — user tracks (editor/Persistence.js)
 *   - Settings                           — getSelectedTrackId(), setSelectedTrackId()
 *   - services.notification.show()       — toast feedback
 */

import { getTracks }                          from '../../TrackRegistry.js';
import { getSavedTracks, deleteNamedTrack }   from '../../editor/Persistence.js';
import { Settings }                           from '../../Settings.js';
import { HudButton }                          from '../components/HudButton.js';

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

		/** @type {HTMLElement|null} */
		this._officialSection = null;

		/** @type {HTMLElement|null} */
		this._myTracksSection = null;

		/** @type {Array<HudButton>} Track select/action buttons for disposal. */
		this._buttons = [];

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
			   Tracks panel root — scrollable content
			   =================================================== */

			.kk-tracks {
				width: 100%;
				height: 100%;
				overflow-y: auto;
				overflow-x: hidden;
				padding: var(--space-6, 1.5rem);
				padding-bottom: calc( var(--space-6, 1.5rem) + 5rem );
				box-sizing: border-box;
				-webkit-overflow-scrolling: touch;
			}

			.kk-tracks__inner {
				max-width: 36rem;
				margin: 0 auto;
				display: flex;
				flex-direction: column;
				gap: var(--space-6, 1.5rem);
			}

			/* ===================================================
			   Section heading
			   =================================================== */

			.kk-tracks__heading {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.14em);
				color: var(--color-ink-300, #aaa);
				margin: 0;
				padding-bottom: var(--space-2, 0.5rem);
				border-bottom: var(--border-thin, 1px) solid rgba( 255, 255, 255, 0.08 );
			}

			/* ===================================================
			   Track card — HUD-style border with glow
			   =================================================== */

			.kk-tracks__card {
				position: relative;
				background: rgba( 0, 0, 0, 0.55 );
				border: var(--border-base, 2px) solid rgba( 255, 255, 255, 0.1 );
				border-radius: var(--radius-md, 4px);
				padding: var(--space-4, 1rem);
				backdrop-filter: blur( 8px );
				transition:
					border-color var(--duration-normal, 200ms) var(--ease-standard, ease),
					box-shadow var(--duration-normal, 200ms) var(--ease-standard, ease);
			}

			.kk-tracks__card:hover {
				border-color: rgba( 255, 255, 255, 0.2 );
			}

			.kk-tracks__card--selected {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 12px rgba( 0, 212, 232, 0.3 ),
					inset 0 0 12px rgba( 0, 212, 232, 0.05 );
			}

			.kk-tracks__card--selected::before {
				content: '';
				position: absolute;
				inset: -1px;
				border-radius: inherit;
				border: var(--border-thin, 1px) solid rgba( 0, 212, 232, 0.3 );
				pointer-events: none;
			}

			/* ===================================================
			   Card layout
			   =================================================== */

			.kk-tracks__card-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--space-3, 0.75rem);
				margin-bottom: var(--space-3, 0.75rem);
			}

			.kk-tracks__card-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-md, 1rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.kk-tracks__badge {
				display: inline-block;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				padding: 2px var(--space-2, 0.5rem);
				border-radius: var(--radius-sm, 2px);
				flex-shrink: 0;
			}

			.kk-tracks__badge--easy {
				background: rgba( 52, 211, 153, 0.2 );
				color: #34d399;
				border: 1px solid rgba( 52, 211, 153, 0.3 );
			}

			.kk-tracks__badge--medium {
				background: rgba( 255, 214, 0, 0.2 );
				color: #ffd600;
				border: 1px solid rgba( 255, 214, 0, 0.3 );
			}

			.kk-tracks__badge--hard {
				background: rgba( 255, 58, 140, 0.2 );
				color: #ff3a8c;
				border: 1px solid rgba( 255, 58, 140, 0.3 );
			}

			.kk-tracks__card-meta {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				color: var(--color-ink-400, #666);
				margin-bottom: var(--space-3, 0.75rem);
			}

			/* ===================================================
			   Card actions row
			   =================================================== */

			.kk-tracks__card-actions {
				display: flex;
				align-items: center;
				gap: var(--space-2, 0.5rem);
				flex-wrap: wrap;
			}

			.kk-tracks__card-actions .kk-hud-button {
				font-size: var(--text-xs, 0.75rem);
			}

			/* Small text buttons for secondary actions */

			.kk-tracks__action-btn {
				background: rgba( 255, 255, 255, 0.06 );
				border: 1px solid rgba( 255, 255, 255, 0.12 );
				border-radius: var(--radius-sm, 2px);
				padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-ink-200, #ddd);
				cursor: pointer;
				transition:
					background var(--duration-fast, 100ms) var(--ease-standard, ease),
					border-color var(--duration-fast, 100ms) var(--ease-standard, ease);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-tracks__action-btn:hover {
				background: rgba( 255, 255, 255, 0.12 );
				border-color: rgba( 255, 255, 255, 0.25 );
			}

			.kk-tracks__action-btn--delete {
				color: var(--color-accent-pink, #ff3a8c);
				border-color: rgba( 255, 58, 140, 0.25 );
			}

			.kk-tracks__action-btn--delete:hover {
				background: rgba( 255, 58, 140, 0.15 );
				border-color: rgba( 255, 58, 140, 0.4 );
			}

			/* ===================================================
			   Empty state
			   =================================================== */

			.kk-tracks__empty {
				text-align: center;
				padding: var(--space-6, 1.5rem) var(--space-4, 1rem);
				color: var(--color-ink-400, #666);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				line-height: var(--leading-relaxed, 1.65);
			}

			.kk-tracks__empty-text {
				margin-bottom: var(--space-4, 1rem);
			}

			/* ===================================================
			   Make Your Own section
			   =================================================== */

			.kk-tracks__create-wrap {
				display: flex;
				justify-content: center;
				padding: var(--space-4, 1rem) 0;
			}

			/* ===================================================
			   Responsive
			   =================================================== */

			@media ( max-width: 480px ) {

				.kk-tracks {
					padding: var(--space-4, 1rem);
					padding-bottom: calc( var(--space-4, 1rem) + 5rem );
				}

				.kk-tracks__card {
					padding: var(--space-3, 0.75rem);
				}

				.kk-tracks__card-actions {
					gap: var(--space-1, 0.25rem);
				}

			}

			/* ===================================================
			   Reduced motion
			   =================================================== */

			@media ( prefers-reduced-motion: reduce ) {

				.kk-tracks__card {
					transition: none;
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
		root.setAttribute( 'aria-label', 'Tracks — track selection' );

		const inner = document.createElement( 'div' );
		inner.className = 'kk-tracks__inner';

		// Official tracks section.
		this._officialSection = document.createElement( 'section' );
		this._officialSection.setAttribute( 'aria-label', 'Official tracks' );
		inner.appendChild( this._officialSection );

		// My Tracks section.
		this._myTracksSection = document.createElement( 'section' );
		this._myTracksSection.setAttribute( 'aria-label', 'My tracks' );
		inner.appendChild( this._myTracksSection );

		// Make Your Own button.
		const createWrap = document.createElement( 'div' );
		createWrap.className = 'kk-tracks__create-wrap';

		const createBtn = new HudButton( {
			text: 'MAKE YOUR OWN',
			color: '--color-accent-orange',
			onClick: () => {

				window.open( 'editor.html', '_blank', 'noopener' );

			},
		} );
		this._buttons.push( createBtn );
		createWrap.appendChild( createBtn.el );
		inner.appendChild( createWrap );

		root.appendChild( inner );
		this._root = root;

		this._renderOfficialTracks();
		this._renderMyTracks();

	}

	// ---------------------------------------------------------------------------
	// Render sections
	// ---------------------------------------------------------------------------

	_renderOfficialTracks() {

		const section = this._officialSection;
		section.innerHTML = '';

		const heading = document.createElement( 'h2' );
		heading.className = 'kk-tracks__heading';
		heading.textContent = 'OFFICIAL TRACKS';
		section.appendChild( heading );

		const tracks = getTracks();
		const selectedId = this._settings.getSelectedTrackId();

		for ( const track of tracks ) {

			const card = this._buildOfficialCard( track, selectedId );
			section.appendChild( card );

		}

	}

	_renderMyTracks() {

		const section = this._myTracksSection;
		section.innerHTML = '';

		const heading = document.createElement( 'h2' );
		heading.className = 'kk-tracks__heading';
		heading.textContent = 'MY TRACKS';
		section.appendChild( heading );

		const userTracks = getSavedTracks();

		if ( userTracks.length === 0 ) {

			this._renderEmptyState( section );
			return;

		}

		const selectedId = this._settings.getSelectedTrackId();

		for ( const track of userTracks ) {

			const card = this._buildUserCard( track, selectedId );
			section.appendChild( card );

		}

	}

	_renderEmptyState( section ) {

		const empty = document.createElement( 'div' );
		empty.className = 'kk-tracks__empty';

		const text = document.createElement( 'p' );
		text.className = 'kk-tracks__empty-text';
		text.textContent = 'No tracks yet \u2014 create one!';
		empty.appendChild( text );

		const createBtn = new HudButton( {
			text: 'MAKE YOUR OWN',
			color: '--color-accent-orange',
			onClick: () => {

				window.open( 'editor.html', '_blank', 'noopener' );

			},
		} );
		this._buttons.push( createBtn );
		empty.appendChild( createBtn.el );

		section.appendChild( empty );

	}

	// ---------------------------------------------------------------------------
	// Card builders
	// ---------------------------------------------------------------------------

	/**
	 * Build a card for a built-in (official) track.
	 *
	 * @param {object} track       Track from TrackRegistry.
	 * @param {string} selectedId  Currently selected track id.
	 * @returns {HTMLElement}
	 */
	_buildOfficialCard( track, selectedId ) {

		const isSelected = track.id === selectedId;

		const card = document.createElement( 'div' );
		card.className = 'kk-tracks__card';
		if ( isSelected ) card.classList.add( 'kk-tracks__card--selected' );

		// Header: name + difficulty badge.
		const header = document.createElement( 'div' );
		header.className = 'kk-tracks__card-header';

		const name = document.createElement( 'div' );
		name.className = 'kk-tracks__card-name';
		name.textContent = track.name;
		header.appendChild( name );

		if ( track.difficulty ) {

			const badge = document.createElement( 'span' );
			badge.className = `kk-tracks__badge kk-tracks__badge--${ track.difficulty }`;
			badge.textContent = track.difficulty.toUpperCase();
			header.appendChild( badge );

		}

		card.appendChild( header );

		// Actions row.
		const actions = document.createElement( 'div' );
		actions.className = 'kk-tracks__card-actions';

		const selectBtn = new HudButton( {
			text: isSelected ? 'SELECTED' : 'SELECT',
			color: '--color-accent-cyan',
			onClick: () => {

				this._selectTrack( track.id );

			},
		} );
		if ( isSelected ) selectBtn.setDimmed( true );
		this._buttons.push( selectBtn );
		actions.appendChild( selectBtn.el );

		card.appendChild( actions );

		return card;

	}

	/**
	 * Build a card for a user-created track.
	 *
	 * @param {object} track       Track from getSavedTracks().
	 * @param {string} selectedId  Currently selected track id.
	 * @returns {HTMLElement}
	 */
	_buildUserCard( track, selectedId ) {

		const trackId = 'user:' + track.name;
		const isSelected = trackId === selectedId;

		const card = document.createElement( 'div' );
		card.className = 'kk-tracks__card';
		if ( isSelected ) card.classList.add( 'kk-tracks__card--selected' );

		// Header: name.
		const header = document.createElement( 'div' );
		header.className = 'kk-tracks__card-header';

		const name = document.createElement( 'div' );
		name.className = 'kk-tracks__card-name';
		name.textContent = track.name;
		header.appendChild( name );

		card.appendChild( header );

		// Meta: piece count + date.
		const meta = document.createElement( 'div' );
		meta.className = 'kk-tracks__card-meta';

		const parts = [];
		if ( track.pieces != null ) parts.push( `${ track.pieces } pieces` );
		if ( track.date ) parts.push( track.date );
		meta.textContent = parts.join( ' \u2022 ' );

		card.appendChild( meta );

		// Actions row.
		const actions = document.createElement( 'div' );
		actions.className = 'kk-tracks__card-actions';

		// SELECT button.
		const selectBtn = new HudButton( {
			text: isSelected ? 'SELECTED' : 'SELECT',
			color: '--color-accent-cyan',
			onClick: () => {

				this._selectTrack( trackId );

			},
		} );
		if ( isSelected ) selectBtn.setDimmed( true );
		this._buttons.push( selectBtn );
		actions.appendChild( selectBtn.el );

		// SHARE button.
		const shareBtn = document.createElement( 'button' );
		shareBtn.type = 'button';
		shareBtn.className = 'kk-tracks__action-btn';
		shareBtn.textContent = 'SHARE';
		shareBtn.addEventListener( 'click', () => {

			this._shareTrack( track );

		} );
		actions.appendChild( shareBtn );

		// EDIT button.
		const editBtn = document.createElement( 'button' );
		editBtn.type = 'button';
		editBtn.className = 'kk-tracks__action-btn';
		editBtn.textContent = 'EDIT';
		editBtn.addEventListener( 'click', () => {

			window.open( `editor.html?load=${ encodeURIComponent( track.name ) }`, '_blank', 'noopener' );

		} );
		actions.appendChild( editBtn );

		// DELETE button.
		const deleteBtn = document.createElement( 'button' );
		deleteBtn.type = 'button';
		deleteBtn.className = 'kk-tracks__action-btn kk-tracks__action-btn--delete';
		deleteBtn.textContent = 'DELETE';
		deleteBtn.addEventListener( 'click', () => {

			this._deleteTrack( track );

		} );
		actions.appendChild( deleteBtn );

		card.appendChild( actions );

		return card;

	}

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------

	/**
	 * Select a track and persist the choice.
	 *
	 * @param {string} trackId  Registry id for built-in, 'user:' + name for user tracks.
	 */
	_selectTrack( trackId ) {

		this._settings.setSelectedTrackId( trackId );

		// Re-render both sections to update highlight states.
		this._disposeButtons();
		this._renderOfficialTracks();
		this._renderMyTracks();

		this._services.notification?.show( {
			message: 'Track selected',
			variant: 'success',
			duration: 1500,
		} );

	}

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

		// Re-render My Tracks section.
		this._disposeButtons();
		this._renderOfficialTracks();
		this._renderMyTracks();

		this._services.notification?.show( {
			message: `"${ track.name }" deleted`,
			variant: 'info',
			duration: 2000,
		} );

	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/**
	 * Dispose all tracked HudButton instances. Called before re-rendering.
	 */
	_disposeButtons() {

		for ( const btn of this._buttons ) {

			btn.dispose();

		}

		this._buttons = [];

	}

	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Called when the TRACKS tab becomes active.
	 * Re-reads user tracks and refreshes the display.
	 */
	show() {

		// Re-read settings in case track was selected elsewhere.
		this._settings = new Settings();

		// Re-render to pick up new user tracks or selection changes.
		this._disposeButtons();
		this._renderOfficialTracks();
		this._renderMyTracks();

	}

	/**
	 * Called when the TRACKS tab becomes inactive.
	 */
	hide() {

		// No teardown needed — panel persists.

	}

	/**
	 * Full teardown. Called only if AppShell itself is destroyed.
	 */
	dispose() {

		this._disposeButtons();

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;
		this._officialSection = null;
		this._myTracksSection = null;

	}

}

TracksPanel._cssInjected = false;
