/**
 * TracksPanel — TRACKS tab content panel.
 *
 * Horizontal card carousel with CSS scroll-snap. Two rows: official tracks
 * and user-created tracks. Each card is a dark glass tile with angular cuts,
 * neon glow on selection, and inline action buttons for user tracks.
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
import { decodeCells }                        from '../../TrackCodec.js';
import { Settings }                           from '../../Settings.js';
import { renderMinimap }                      from '../components/TrackMinimap.js';

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
		this._officialRow = null;

		/** @type {HTMLElement|null} */
		this._myTracksRow = null;

		/** @type {Function|null} Bound keyboard handler for cleanup. */
		this._keyHandler = null;

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

			.kk-tracks__grid {
				display: grid;
				grid-template-columns: minmax( 260px, 1fr ) 2fr;
				gap: var(--space-6, 1.5rem);
				height: 100%;
			}

			/* ===================================================
			   Detail panel — left column
			   =================================================== */

			.kk-tracks__detail {
				display: flex;
				flex-direction: column;
				gap: var(--space-4, 1rem);
				padding: var(--space-4, 1rem);
				background: rgba( 20, 20, 30, 0.6 );
				border: 1px solid rgba( 255, 255, 255, 0.08 );
				border-radius: var(--radius-md, 4px);
				align-self: flex-start;
			}

			.kk-tracks__detail-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-2xl, 1.75rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
				line-height: 1.1;
			}

			.kk-tracks__detail-meta {
				display: flex;
				flex-wrap: wrap;
				gap: var(--space-2, 0.5rem);
				align-items: center;
			}

			.kk-tracks__detail-desc {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-300, #aaa);
				line-height: 1.4;
			}

			.kk-tracks__detail-minimap {
				border-radius: var(--radius-sm, 2px);
				overflow: hidden;
			}

			.kk-tracks__detail-minimap canvas {
				display: block;
				width: 100%;
				height: auto;
			}

			/* ===================================================
			   Right column — carousel rows
			   =================================================== */

			.kk-tracks__inner {
				display: flex;
				flex-direction: column;
				gap: var(--space-6, 1.5rem);
				overflow-y: auto;
			}

			/* ===================================================
			   Section: label + carousel row
			   =================================================== */

			.kk-tracks__section {
				display: flex;
				flex-direction: column;
				gap: var(--space-3, 0.75rem);
			}

			.kk-tracks__heading {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest, 0.14em);
				color: var(--color-ink-300, #aaa);
				margin: 0;
				padding: 0 var(--space-6, 1.5rem);
			}

			/* ===================================================
			   Carousel container — horizontal scroll-snap
			   =================================================== */

			.kk-tracks__carousel-wrap {
				position: relative;
			}

			.kk-tracks__carousel {
				display: flex;
				gap: var(--space-4, 1rem);
				overflow-x: auto;
				overflow-y: hidden;
				scroll-snap-type: x mandatory;
				-webkit-overflow-scrolling: touch;
				padding: var(--space-2, 0.5rem) var(--space-6, 1.5rem);
				scrollbar-width: none;
			}

			.kk-tracks__carousel::-webkit-scrollbar {
				display: none;
			}

			/* ===================================================
			   Nav arrows — left / right edge of carousel
			   =================================================== */

			.kk-tracks__arrow {
				position: absolute;
				top: 50%;
				transform: translateY( -50% );
				width: 2.5rem;
				height: 2.5rem;
				border-radius: 50%;
				background: rgba( 0, 0, 0, 0.7 );
				border: var(--border-thin, 1px) solid rgba( 255, 255, 255, 0.15 );
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				z-index: 2;
				transition:
					background var(--duration-fast, 100ms) var(--ease-standard, ease),
					transform var(--duration-fast, 100ms) var(--ease-spring, ease);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-tracks__arrow:hover {
				background: rgba( 255, 255, 255, 0.16 );
				transform: translateY( -50% ) scale( 1.1 );
			}

			.kk-tracks__arrow:active {
				transform: translateY( -50% ) scale( 0.95 );
			}

			.kk-tracks__arrow--left {
				left: var(--space-2, 0.5rem);
			}

			.kk-tracks__arrow--right {
				right: var(--space-2, 0.5rem);
			}

			.kk-tracks__arrow-chevron {
				width: 0.75rem;
				height: 0.75rem;
				border-top: 2px solid var(--color-white, #fff);
				border-right: 2px solid var(--color-white, #fff);
			}

			.kk-tracks__arrow--left .kk-tracks__arrow-chevron {
				transform: rotate( -135deg );
				margin-left: 3px;
			}

			.kk-tracks__arrow--right .kk-tracks__arrow-chevron {
				transform: rotate( 45deg );
				margin-right: 3px;
			}

			/* ===================================================
			   Track card — dark glass with angular cuts
			   =================================================== */

			.kk-tracks__card {
				flex: 0 0 200px;
				min-width: 200px;
				aspect-ratio: 3 / 2;
				scroll-snap-align: center;
				position: relative;
				background: rgba( 20, 20, 30, 0.75 );
				border: var(--border-base, 2px) solid rgba( 255, 255, 255, 0.1 );
				backdrop-filter: blur( 8px );
				clip-path: polygon(
					0 8px, 8px 0, 100% 0,
					100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%
				);
				padding: var(--space-3, 0.75rem);
				box-sizing: border-box;
				display: flex;
				flex-direction: column;
				justify-content: space-between;
				cursor: pointer;
				transition:
					border-color var(--duration-normal, 200ms) var(--ease-standard, ease),
					box-shadow var(--duration-normal, 200ms) var(--ease-standard, ease),
					transform var(--duration-normal, 200ms) var(--ease-standard, ease);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-tracks__card:hover {
				border-color: var(--color-accent-orange, #f97316);
				box-shadow: 0 0 14px rgba( 249, 115, 22, 0.3 );
				transform: scale( 1.04 );
			}

			/* Selected state — cyan glow */

			.kk-tracks__card--selected {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 16px rgba( 0, 212, 232, 0.4 ),
					inset 0 0 16px rgba( 0, 212, 232, 0.06 );
			}

			.kk-tracks__card--selected:hover {
				border-color: var(--color-accent-cyan, #00d4e8);
				box-shadow:
					0 0 20px rgba( 0, 212, 232, 0.5 ),
					inset 0 0 16px rgba( 0, 212, 232, 0.08 );
			}

			/* ===================================================
			   Card content
			   =================================================== */

			.kk-tracks__card-top {
				display: flex;
				flex-direction: column;
				gap: var(--space-1, 0.25rem);
			}

			.kk-tracks__card-name {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.kk-tracks__card-meta {
				font-family: var(--font-ui, sans-serif);
				font-size: 0.65rem;
				color: var(--color-ink-400, #666);
				letter-spacing: var(--tracking-wider, 0.1em);
			}

			/* ===================================================
			   Badges
			   =================================================== */

			.kk-tracks__badge {
				display: inline-block;
				font-family: var(--font-ui, sans-serif);
				font-size: 0.6rem;
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				padding: 1px var(--space-2, 0.5rem);
				border-radius: var(--radius-sm, 2px);
				align-self: flex-start;
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

			.kk-tracks__badge--selected {
				background: rgba( 0, 212, 232, 0.2 );
				color: var(--color-accent-cyan, #00d4e8);
				border: 1px solid rgba( 0, 212, 232, 0.4 );
			}

			/* ===================================================
			   Card bottom — action icons for user tracks
			   =================================================== */

			.kk-tracks__card-actions {
				display: flex;
				align-items: center;
				gap: var(--space-1, 0.25rem);
				justify-content: flex-end;
			}

			.kk-tracks__icon-btn {
				width: 1.75rem;
				height: 1.75rem;
				border-radius: var(--radius-sm, 2px);
				background: rgba( 255, 255, 255, 0.06 );
				border: 1px solid rgba( 255, 255, 255, 0.1 );
				color: var(--color-ink-200, #ddd);
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 0.8rem;
				transition:
					background var(--duration-fast, 100ms) var(--ease-standard, ease),
					border-color var(--duration-fast, 100ms) var(--ease-standard, ease);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
				padding: 0;
			}

			.kk-tracks__icon-btn:hover {
				background: rgba( 255, 255, 255, 0.14 );
				border-color: rgba( 255, 255, 255, 0.3 );
			}

			.kk-tracks__icon-btn--delete {
				color: var(--color-accent-pink, #ff3a8c);
				border-color: rgba( 255, 58, 140, 0.25 );
			}

			.kk-tracks__icon-btn--delete:hover {
				background: rgba( 255, 58, 140, 0.15 );
				border-color: rgba( 255, 58, 140, 0.4 );
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

			/* ===================================================
			   Empty state — inline in carousel
			   =================================================== */

			.kk-tracks__empty-card {
				flex: 0 0 200px;
				min-width: 200px;
				aspect-ratio: 3 / 2;
				scroll-snap-align: center;
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-400, #666);
				text-align: center;
				padding: var(--space-3, 0.75rem);
				box-sizing: border-box;
			}

			/* ===================================================
			   Responsive
			   =================================================== */

			/* Minimap thumbnail inside track cards */

			.kk-tracks__card-minimap {
				margin-top: auto;
				border-radius: var(--radius-sm, 2px);
				overflow: hidden;
			}

			.kk-tracks__card-minimap canvas {
				display: block;
				width: 100%;
				height: auto;
			}

			@media ( max-width: 768px ) {

				.kk-tracks__grid {
					grid-template-columns: 1fr;
				}

			}

			@media ( max-width: 480px ) {

				.kk-tracks {
					padding: var(--space-4, 1rem);
				}

				.kk-tracks__heading {
					padding: 0 var(--space-4, 1rem);
				}

				.kk-tracks__carousel {
					padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
					gap: var(--space-3, 0.75rem);
				}

				.kk-tracks__card {
					flex: 0 0 170px;
					min-width: 170px;
				}

				.kk-tracks__empty-card {
					flex: 0 0 170px;
					min-width: 170px;
				}

				.kk-tracks__arrow {
					width: 2rem;
					height: 2rem;
				}

				.kk-tracks__arrow-chevron {
					width: 0.6rem;
					height: 0.6rem;
				}

			}

			/* ===================================================
			   Reduced motion
			   =================================================== */

			@media ( prefers-reduced-motion: reduce ) {

				.kk-tracks__card {
					transition: none;
				}

				.kk-tracks__arrow {
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

		const grid = document.createElement( 'div' );
		grid.className = 'kk-tracks__grid';

		// --- Detail panel (left column) ---

		this._detailPanel = document.createElement( 'div' );
		this._detailPanel.className = 'kk-tracks__detail';

		this._detailName = document.createElement( 'div' );
		this._detailName.className = 'kk-tracks__detail-name';
		this._detailPanel.appendChild( this._detailName );

		this._detailMeta = document.createElement( 'div' );
		this._detailMeta.className = 'kk-tracks__detail-meta';
		this._detailPanel.appendChild( this._detailMeta );

		this._detailDesc = document.createElement( 'div' );
		this._detailDesc.className = 'kk-tracks__detail-desc';
		this._detailPanel.appendChild( this._detailDesc );

		this._detailMinimap = document.createElement( 'div' );
		this._detailMinimap.className = 'kk-tracks__detail-minimap';
		this._detailPanel.appendChild( this._detailMinimap );

		grid.appendChild( this._detailPanel );

		// --- Carousel rows (right column) ---

		const inner = document.createElement( 'div' );
		inner.className = 'kk-tracks__inner';

		// Official tracks section
		const officialSection = document.createElement( 'section' );
		officialSection.className = 'kk-tracks__section';
		officialSection.setAttribute( 'aria-label', 'Official tracks' );

		const officialHeading = document.createElement( 'h2' );
		officialHeading.className = 'kk-tracks__heading';
		officialHeading.textContent = 'OFFICIAL TRACKS';
		officialSection.appendChild( officialHeading );

		const officialCarouselWrap = document.createElement( 'div' );
		officialCarouselWrap.className = 'kk-tracks__carousel-wrap';

		this._officialRow = document.createElement( 'div' );
		this._officialRow.className = 'kk-tracks__carousel';
		officialCarouselWrap.appendChild( this._officialRow );

		this._buildArrows( officialCarouselWrap, this._officialRow );

		officialSection.appendChild( officialCarouselWrap );
		inner.appendChild( officialSection );

		// My Tracks section
		const myTracksSection = document.createElement( 'section' );
		myTracksSection.className = 'kk-tracks__section';
		myTracksSection.setAttribute( 'aria-label', 'My tracks' );

		const myTracksHeading = document.createElement( 'h2' );
		myTracksHeading.className = 'kk-tracks__heading';
		myTracksHeading.textContent = 'MY TRACKS';
		myTracksSection.appendChild( myTracksHeading );

		const myTracksCarouselWrap = document.createElement( 'div' );
		myTracksCarouselWrap.className = 'kk-tracks__carousel-wrap';

		this._myTracksRow = document.createElement( 'div' );
		this._myTracksRow.className = 'kk-tracks__carousel';
		myTracksCarouselWrap.appendChild( this._myTracksRow );

		this._buildArrows( myTracksCarouselWrap, this._myTracksRow );

		myTracksSection.appendChild( myTracksCarouselWrap );
		inner.appendChild( myTracksSection );

		grid.appendChild( inner );
		root.appendChild( grid );
		this._root = root;

		this._renderOfficialTracks();
		this._renderMyTracks();
		this._updateDetailPanel();

		// Keyboard navigation.
		this._keyHandler = ( e ) => this._onKeyDown( e );
		document.addEventListener( 'keydown', this._keyHandler );

	}

	/**
	 * Build left/right nav arrows for a carousel wrapper.
	 *
	 * @param {HTMLElement} wrap      The .kk-tracks__carousel-wrap element.
	 * @param {HTMLElement} carousel  The .kk-tracks__carousel element to scroll.
	 */
	_buildArrows( wrap, carousel ) {

		const leftArrow = document.createElement( 'button' );
		leftArrow.type = 'button';
		leftArrow.className = 'kk-tracks__arrow kk-tracks__arrow--left';
		leftArrow.setAttribute( 'aria-label', 'Scroll left' );

		const leftChevron = document.createElement( 'div' );
		leftChevron.className = 'kk-tracks__arrow-chevron';
		leftChevron.setAttribute( 'aria-hidden', 'true' );
		leftArrow.appendChild( leftChevron );

		leftArrow.addEventListener( 'click', () => {

			carousel.scrollBy( { left: - 220, behavior: 'smooth' } );

		} );
		wrap.appendChild( leftArrow );

		const rightArrow = document.createElement( 'button' );
		rightArrow.type = 'button';
		rightArrow.className = 'kk-tracks__arrow kk-tracks__arrow--right';
		rightArrow.setAttribute( 'aria-label', 'Scroll right' );

		const rightChevron = document.createElement( 'div' );
		rightChevron.className = 'kk-tracks__arrow-chevron';
		rightChevron.setAttribute( 'aria-hidden', 'true' );
		rightArrow.appendChild( rightChevron );

		rightArrow.addEventListener( 'click', () => {

			carousel.scrollBy( { left: 220, behavior: 'smooth' } );

		} );
		wrap.appendChild( rightArrow );

	}

	// ---------------------------------------------------------------------------
	// Keyboard
	// ---------------------------------------------------------------------------

	/**
	 * Handle left/right arrow keys to scroll the focused carousel.
	 *
	 * @param {KeyboardEvent} e
	 */
	_onKeyDown( e ) {

		if ( ! this._root || this._root.offsetParent === null ) return;

		if ( e.key === 'ArrowLeft' || e.key === 'ArrowRight' ) {

			const dir = e.key === 'ArrowLeft' ? - 1 : 1;

			// Scroll whichever carousel the user's pointer is nearest to,
			// or default to the official row.
			const target = this._officialRow;
			target.scrollBy( { left: dir * 220, behavior: 'smooth' } );

		}

	}

	// ---------------------------------------------------------------------------
	// Render sections
	// ---------------------------------------------------------------------------

	_renderOfficialTracks() {

		const row = this._officialRow;
		row.innerHTML = '';

		const tracks = getTracks();
		const selectedId = this._settings.getSelectedTrackId();

		for ( const track of tracks ) {

			const card = this._buildOfficialCard( track, selectedId );
			row.appendChild( card );

		}

	}

	_renderMyTracks() {

		const row = this._myTracksRow;
		row.innerHTML = '';

		const userTracks = getSavedTracks();
		const selectedId = this._settings.getSelectedTrackId();

		if ( userTracks.length === 0 ) {

			// Empty-state placeholder.
			const emptyCard = document.createElement( 'div' );
			emptyCard.className = 'kk-tracks__empty-card';
			emptyCard.textContent = 'No tracks yet';
			row.appendChild( emptyCard );

		} else {

			for ( const track of userTracks ) {

				const card = this._buildUserCard( track, selectedId );
				row.appendChild( card );

			}

		}

		// Always append "CREATE TRACK" card at the end.
		row.appendChild( this._buildCreateCard() );

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

		// Click to select.
		card.addEventListener( 'click', () => {

			this._selectTrack( track.id );

		} );

		// Top area: name + badges.
		const top = document.createElement( 'div' );
		top.className = 'kk-tracks__card-top';

		const name = document.createElement( 'div' );
		name.className = 'kk-tracks__card-name';
		name.textContent = track.name;
		top.appendChild( name );

		if ( track.difficulty ) {

			const badge = document.createElement( 'span' );
			badge.className = `kk-tracks__badge kk-tracks__badge--${ track.difficulty }`;
			badge.textContent = track.difficulty.toUpperCase();
			top.appendChild( badge );

		}

		card.appendChild( top );

		// Minimap thumbnail.
		if ( track.cells && track.cells.length > 0 ) {

			const thumbWrap = document.createElement( 'div' );
			thumbWrap.className = 'kk-tracks__card-minimap';
			thumbWrap.appendChild( renderMinimap( track.cells, 160, 60 ) );
			card.appendChild( thumbWrap );

		}

		// Bottom area: selected badge.
		const bottom = document.createElement( 'div' );
		bottom.className = 'kk-tracks__card-actions';

		if ( isSelected ) {

			const selectedBadge = document.createElement( 'span' );
			selectedBadge.className = 'kk-tracks__badge kk-tracks__badge--selected';
			selectedBadge.textContent = 'SELECTED';
			bottom.appendChild( selectedBadge );

		}

		card.appendChild( bottom );

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

		// Click body to select (but not when clicking action buttons).
		card.addEventListener( 'click', ( e ) => {

			if ( e.target.closest( '.kk-tracks__icon-btn' ) ) return;
			this._selectTrack( trackId );

		} );

		// Top area: name + meta.
		const top = document.createElement( 'div' );
		top.className = 'kk-tracks__card-top';

		const name = document.createElement( 'div' );
		name.className = 'kk-tracks__card-name';
		name.textContent = track.name;
		top.appendChild( name );

		const meta = document.createElement( 'div' );
		meta.className = 'kk-tracks__card-meta';
		const parts = [];
		if ( track.pieces != null ) parts.push( `${ track.pieces } pcs` );
		if ( track.date ) parts.push( track.date );
		meta.textContent = parts.join( ' \u2022 ' );
		top.appendChild( meta );

		if ( isSelected ) {

			const selectedBadge = document.createElement( 'span' );
			selectedBadge.className = 'kk-tracks__badge kk-tracks__badge--selected';
			selectedBadge.textContent = 'SELECTED';
			top.appendChild( selectedBadge );

		}

		card.appendChild( top );

		// Minimap thumbnail (user tracks have encoded cells string).
		if ( track.cells ) {

			try {

				const decoded = decodeCells( track.cells );
				if ( decoded && decoded.length > 0 ) {

					const thumbWrap = document.createElement( 'div' );
					thumbWrap.className = 'kk-tracks__card-minimap';
					thumbWrap.appendChild( renderMinimap( decoded, 160, 60 ) );
					card.appendChild( thumbWrap );

				}

			} catch ( e ) { /* ignore decode errors */ }

		}

		// Bottom area: action icon buttons.
		const actions = document.createElement( 'div' );
		actions.className = 'kk-tracks__card-actions';

		// SHARE icon.
		const shareBtn = document.createElement( 'button' );
		shareBtn.type = 'button';
		shareBtn.className = 'kk-tracks__icon-btn';
		shareBtn.setAttribute( 'aria-label', 'Share track' );
		shareBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
		shareBtn.addEventListener( 'click', ( e ) => {

			e.stopPropagation();
			this._shareTrack( track );

		} );
		actions.appendChild( shareBtn );

		// EDIT icon.
		const editBtn = document.createElement( 'button' );
		editBtn.type = 'button';
		editBtn.className = 'kk-tracks__icon-btn';
		editBtn.setAttribute( 'aria-label', 'Edit track' );
		editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
		editBtn.addEventListener( 'click', ( e ) => {

			e.stopPropagation();
			window.open( `track-editor.html#map=${ encodeURIComponent( track.cells ) }`, '_blank', 'noopener' );

		} );
		actions.appendChild( editBtn );

		// DELETE icon.
		const deleteBtn = document.createElement( 'button' );
		deleteBtn.type = 'button';
		deleteBtn.className = 'kk-tracks__icon-btn kk-tracks__icon-btn--delete';
		deleteBtn.setAttribute( 'aria-label', 'Delete track' );
		deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
		deleteBtn.addEventListener( 'click', ( e ) => {

			e.stopPropagation();
			this._deleteTrack( track );

		} );
		actions.appendChild( deleteBtn );

		card.appendChild( actions );

		return card;

	}

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
	// Detail panel
	// ---------------------------------------------------------------------------

	/**
	 * Update the left detail panel with the currently selected (or focused) track.
	 *
	 * @param {object} [trackOverride]  Optional track object to display instead of the selected track.
	 */
	_updateDetailPanel( trackOverride ) {

		if ( ! this._detailName ) return;

		let track = trackOverride;

		if ( ! track ) {

			// Show the currently selected track.
			const selectedId = this._settings.getSelectedTrackId();
			const officialTracks = getTracks();

			if ( selectedId && selectedId.startsWith( 'user:' ) ) {

				const trackName = selectedId.slice( 5 );
				const saved = getSavedTracks().find( ( t ) => t.name === trackName );
				if ( saved ) {

					track = { name: saved.name, pieces: saved.pieces, date: saved.date, cells: saved.cells, source: 'user' };

				}

			}

			if ( ! track ) {

				const builtIn = officialTracks.find( ( t ) => t.id === selectedId ) || officialTracks[ 0 ];
				if ( builtIn ) {

					track = { name: builtIn.name, difficulty: builtIn.difficulty, cells: builtIn.cells, source: 'official' };

				}

			}

		}

		if ( ! track ) return;

		// Name
		this._detailName.textContent = track.name;

		// Meta: difficulty badge or CUSTOM badge + piece count
		this._detailMeta.innerHTML = '';

		if ( track.difficulty ) {

			const badge = document.createElement( 'span' );
			badge.className = `kk-tracks__badge kk-tracks__badge--${ track.difficulty }`;
			badge.textContent = track.difficulty.toUpperCase();
			this._detailMeta.appendChild( badge );

		} else {

			const badge = document.createElement( 'span' );
			badge.className = 'kk-tracks__badge kk-tracks__badge--selected';
			badge.textContent = 'CUSTOM';
			this._detailMeta.appendChild( badge );

		}

		if ( track.pieces != null ) {

			const pcs = document.createElement( 'span' );
			pcs.className = 'kk-tracks__detail-desc';
			pcs.textContent = `${ track.pieces } pieces`;
			this._detailMeta.appendChild( pcs );

		}

		// Description
		if ( track.date ) {

			this._detailDesc.textContent = `Created ${ track.date }`;
			this._detailDesc.style.display = '';

		} else {

			this._detailDesc.style.display = 'none';

		}

		// Minimap
		this._detailMinimap.innerHTML = '';

		let cellsArray = track.cells;

		if ( typeof cellsArray === 'string' ) {

			try {

				cellsArray = decodeCells( cellsArray );

			} catch ( e ) {

				cellsArray = [];

			}

		}

		if ( cellsArray && cellsArray.length > 0 ) {

			const minimapCanvas = renderMinimap( cellsArray, 240, 180 );
			this._detailMinimap.appendChild( minimapCanvas );

		}

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
		this._renderOfficialTracks();
		this._renderMyTracks();
		this._updateDetailPanel();

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

		// Re-render both sections.
		this._renderOfficialTracks();
		this._renderMyTracks();

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

		// Re-read settings in case track was selected elsewhere.
		this._settings = new Settings();

		// Re-render to pick up new user tracks or selection changes.
		this._renderOfficialTracks();
		this._renderMyTracks();
		this._updateDetailPanel();

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

		if ( this._keyHandler ) {

			document.removeEventListener( 'keydown', this._keyHandler );
			this._keyHandler = null;

		}

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;
		this._officialRow = null;
		this._myTracksRow = null;
		this._detailPanel = null;
		this._detailName = null;
		this._detailMeta = null;
		this._detailDesc = null;
		this._detailMinimap = null;

	}

}

TracksPanel._cssInjected = false;
