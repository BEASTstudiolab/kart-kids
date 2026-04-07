/**
 * Page18DiscoverView — Community Tracks / Discover.
 *
 * Layout: full-height viewport, no outer scroll.
 *
 * Grid rows: PageHeader zone | search bar + filter tabs | body (1fr)
 * Body cols: track preview panel (340px) | track card list (1fr)
 *
 * Filter tabs: FEATURED, POPULAR, NEWEST, FRIENDS, FAVORITES.
 * Track preview: large preview area, creator info, stats, PLAY NOW CTA.
 * Track card list: vertically scrolling list of track cards.
 *
 * Public API consumed by Page18DiscoverController:
 *   setTrackList(tracks[])
 *   setTrackPreview(track)
 *   get playNowBtn — CTAButton
 *
 * Deviations from spec:
 *   - Search bar and filter tabs are combined in a single row below the PageHeader
 *     to save vertical space. Spec lists them separately but does not specify layout.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { Tabs }          from '../../components/Tabs.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

const FILTER_TABS = [
	{ id: ButtonIds.DISCOVER_TAB_FEATURED,  label: 'FEATURED' },
	{ id: ButtonIds.DISCOVER_TAB_POPULAR,   label: 'POPULAR' },
	{ id: ButtonIds.DISCOVER_TAB_NEWEST,    label: 'NEWEST' },
	{ id: ButtonIds.DISCOVER_TAB_FRIENDS,   label: 'FRIENDS' },
	{ id: ButtonIds.DISCOVER_TAB_FAVORITES, label: 'FAVORITES' },
];

export class Page18DiscoverView extends PageViewBase {

	constructor() {

		super( 'page-discover' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {Tabs} */
		this._tabs = null;

		/** @type {CTAButton} */
		this._playNowBtn = null;

		/** @type {HTMLElement} */
		this._previewPanelEl = null;

		/** @type {HTMLElement} */
		this._trackListEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( Page18DiscoverView._cssInjected ) return;
		Page18DiscoverView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-discover {
				display: grid;
				grid-template-rows: auto auto 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-surface);
			}

			/* ------------------------------------------------------------------ */
			/* Header zone                                                         */
			/* ------------------------------------------------------------------ */

			.page-discover__header-zone {
				display: flex;
				align-items: center;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* ------------------------------------------------------------------ */
			/* Search + filter row                                                 */
			/* ------------------------------------------------------------------ */

			.page-discover__filter-row {
				display: flex;
				align-items: stretch;
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-discover__search-wrap {
				display: flex;
				align-items: center;
				padding: var(--space-2) var(--space-4);
				border-right: 1px solid var(--color-panel-border);
				min-width: 220px;
				gap: var(--space-2);
			}

			.page-discover__search-icon {
				color: var(--color-ink-400);
				flex-shrink: 0;
			}

			.page-discover__search-input {
				flex: 1 1 auto;
				background: transparent;
				border: none;
				outline: none;
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-white);
				placeholder-color: var(--color-ink-500);
			}

			.page-discover__search-input::placeholder {
				color: var(--color-ink-500);
				letter-spacing: var(--tracking-wider);
				text-transform: uppercase;
				font-size: var(--text-xs);
			}

			.page-discover__search-input:focus-visible {
				outline: none;
			}

			.page-discover__search-wrap:focus-within {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: -2px;
			}

			.page-discover__tabs-wrap {
				flex: 1 1 auto;
				overflow: hidden;
			}

			.page-discover__tabs-wrap .kk-tabs {
				border-bottom: none;
			}

			/* ------------------------------------------------------------------ */
			/* Body — two-column layout                                            */
			/* ------------------------------------------------------------------ */

			.page-discover__body {
				display: grid;
				grid-template-columns: 340px 1fr;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Left — track preview panel                                         */
			/* ------------------------------------------------------------------ */

			.page-discover__preview-panel {
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
				padding: var(--space-5) var(--space-4);
				background: var(--color-panel-base);
				border-right: 1px solid var(--color-panel-border);
				overflow-y: auto;
			}

			.kk-track-preview__thumb {
				width: 100%;
				aspect-ratio: 16 / 9;
				background: var(--color-panel-raised);
				border-radius: var(--radius-md);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-500);
				font-size: var(--text-sm);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				border: 1px solid var(--color-panel-border);
			}

			.kk-track-preview__name {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-track-preview__creator {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-track-preview__creator-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background: var(--color-accent-orange);
				flex-shrink: 0;
			}

			.kk-track-preview__stats {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-3);
				padding: var(--space-3) 0;
				border-top: 1px solid var(--color-panel-border);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.kk-track-preview__stat {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-track-preview__stat-value {
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-black);
				color: var(--color-white);
			}

			.kk-track-preview__stat-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.kk-track-preview__difficulty {
				display: inline-flex;
				align-items: center;
				padding: var(--space-1) var(--space-2);
				border-radius: var(--radius-sm);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-track-preview__difficulty--easy    { background: rgba(34,197,94,0.15); color: #22c55e; }
			.kk-track-preview__difficulty--medium  { background: rgba(249,115,22,0.15); color: var(--color-accent-orange); }
			.kk-track-preview__difficulty--hard    { background: rgba(239,68,68,0.15); color: #ef4444; }
			.kk-track-preview__difficulty--expert  { background: rgba(168,85,247,0.15); color: #a855f7; }

			.kk-track-preview__play-wrap {
				margin-top: auto;
			}

			.kk-track-preview__play-wrap .kk-cta-button {
				width: 100%;
				justify-content: center;
			}

			.page-discover__preview-empty {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				flex: 1 1 auto;
				gap: var(--space-3);
				color: var(--color-ink-500);
				text-align: center;
			}

			/* ------------------------------------------------------------------ */
			/* Right — track card list                                             */
			/* ------------------------------------------------------------------ */

			.page-discover__list-panel {
				overflow-y: auto;
				padding: var(--space-4) var(--space-5);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* ---- Track card ---- */

			.kk-discover-card {
				display: grid;
				grid-template-columns: 80px 1fr auto;
				gap: var(--space-3);
				padding: var(--space-3);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				cursor: pointer;
				align-items: center;
				transition:
					border-color var(--duration-fast) var(--ease-standard),
					background var(--duration-fast) var(--ease-standard);
				user-select: none;
			}

			.kk-discover-card:hover {
				border-color: var(--color-accent-orange);
				background: rgba(249,115,22,0.04);
			}

			.kk-discover-card:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.kk-discover-card--selected {
				border-color: var(--color-accent-orange);
				background: rgba(249,115,22,0.08);
			}

			.kk-discover-card__thumb {
				width: 80px;
				height: 56px;
				background: var(--color-panel-raised);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-500);
				font-size: var(--text-xs);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				flex-shrink: 0;
			}

			.kk-discover-card__details {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				min-width: 0;
			}

			.kk-discover-card__name {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.kk-discover-card__meta {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
			}

			.kk-discover-card__rating {
				display: flex;
				align-items: center;
				gap: var(--space-1);
				color: var(--color-accent-yellow);
				font-weight: var(--weight-bold);
			}

			.kk-discover-card__plays {
				color: var(--color-ink-400);
			}

			.kk-discover-card__difficulty-badge {
				flex-shrink: 0;
				padding: 2px var(--space-2);
				border-radius: var(--radius-sm);
				font-family: var(--font-ui);
				font-size: 10px;
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-discover-card__difficulty-badge--easy    { background: rgba(34,197,94,0.15); color: #22c55e; }
			.kk-discover-card__difficulty-badge--medium  { background: rgba(249,115,22,0.15); color: var(--color-accent-orange); }
			.kk-discover-card__difficulty-badge--hard    { background: rgba(239,68,68,0.15); color: #ef4444; }
			.kk-discover-card__difficulty-badge--expert  { background: rgba(168,85,247,0.15); color: #a855f7; }

			/* ------------------------------------------------------------------ */
			/* Responsive                                                          */
			/* ------------------------------------------------------------------ */

			@media (max-width: 900px) {
				.page-discover__body {
					grid-template-columns: 1fr;
					grid-template-rows: auto 1fr;
				}

				.page-discover__preview-panel {
					border-right: none;
					border-bottom: 1px solid var(--color-panel-border);
					max-height: 200px;
					flex-direction: row;
					flex-wrap: wrap;
				}

				.kk-track-preview__thumb {
					width: 120px;
					height: 80px;
					flex-shrink: 0;
				}
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.setAttribute( 'aria-label', 'Discover Tracks' );

		// ----- Header zone -----
		this._header = new PageHeader( {
			title:    'DISCOVER TRACKS',
			showBack: true,
		} );

		const headerZone = document.createElement( 'div' );
		headerZone.className = 'page-discover__header-zone';
		headerZone.appendChild( this._header.el );
		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Search + filter row -----
		const filterRow = document.createElement( 'div' );
		filterRow.className = 'page-discover__filter-row';

		// Search
		const searchWrap = document.createElement( 'div' );
		searchWrap.className = 'page-discover__search-wrap';

		const searchIcon = document.createElement( 'span' );
		searchIcon.className = 'page-discover__search-icon';
		searchIcon.setAttribute( 'aria-hidden', 'true' );
		searchIcon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

		const searchInput = document.createElement( 'input' );
		searchInput.type = 'text';
		searchInput.className = 'page-discover__search-input';
		searchInput.placeholder = 'Search tracks...';
		searchInput.setAttribute( 'aria-label', 'Search community tracks' );
		searchInput.setAttribute( 'data-action', ButtonIds.DISCOVER_SEARCH );

		searchWrap.appendChild( searchIcon );
		searchWrap.appendChild( searchInput );
		filterRow.appendChild( searchWrap );

		// Filter tabs
		this._tabs = new Tabs( {
			tabs:      FILTER_TABS,
			activeId:  ButtonIds.DISCOVER_TAB_FEATURED,
			ariaLabel: 'Track filter categories',
		} );

		const tabsWrap = document.createElement( 'div' );
		tabsWrap.className = 'page-discover__tabs-wrap';
		tabsWrap.appendChild( this._tabs.el );
		filterRow.appendChild( tabsWrap );

		root.appendChild( filterRow );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-discover__body';
		this._registerSection( 'body', body );

		// Left: preview panel
		this._previewPanelEl = document.createElement( 'div' );
		this._previewPanelEl.className = 'page-discover__preview-panel';
		this._previewPanelEl.setAttribute( 'aria-label', 'Track preview' );
		this._registerSection( 'previewPanel', this._previewPanelEl );
		body.appendChild( this._previewPanelEl );

		// Right: track list
		this._trackListEl = document.createElement( 'div' );
		this._trackListEl.className = 'page-discover__list-panel';
		this._trackListEl.setAttribute( 'role', 'list' );
		this._trackListEl.setAttribute( 'aria-label', 'Community tracks' );
		this._registerSection( 'trackList', this._trackListEl );
		body.appendChild( this._trackListEl );

		root.appendChild( body );

		// Build a persistent PLAY NOW button referenced by the controller.
		// It will be appended to the preview panel by setTrackPreview().
		this._playNowBtn = new CTAButton( {
			label:    'PLAY NOW',
			variant:  'primary',
			actionId: ButtonIds.DISCOVER_PLAY_NOW,
		} );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		const backBtn = this._root.querySelector( '.kk-page-header__back' );
		backBtn?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Render the track card list.
	 *
	 * @param {Array<object>} tracks
	 */
	setTrackList( tracks ) {

		const container = this._trackListEl;
		container.innerHTML = '';

		if ( ! tracks || tracks.length === 0 ) {
			container.appendChild( this.buildEmptyState( {
				label:   'No tracks found',
				heading: 'NO TRACKS FOUND',
				subtext: 'Try a different filter or search term.',
			} ) );
			return;
		}

		tracks.forEach( ( track ) => {
			const card = this._buildTrackCard( track );
			container.appendChild( card );
		} );

	}

	/**
	 * Populate the track preview panel.
	 *
	 * @param {object} track
	 */
	setTrackPreview( track ) {

		const panel = this._previewPanelEl;
		panel.innerHTML = '';

		// Thumbnail
		const thumb = document.createElement( 'div' );
		thumb.className = 'kk-track-preview__thumb';
		thumb.setAttribute( 'aria-hidden', 'true' );
		thumb.textContent = 'PREVIEW';
		panel.appendChild( thumb );

		// Name
		const name = document.createElement( 'div' );
		name.className = 'kk-track-preview__name';
		name.textContent = track.name;
		panel.appendChild( name );

		// Creator
		const creator = document.createElement( 'div' );
		creator.className = 'kk-track-preview__creator';
		const dot = document.createElement( 'div' );
		dot.className = 'kk-track-preview__creator-dot';
		dot.setAttribute( 'aria-hidden', 'true' );
		creator.appendChild( dot );
		creator.appendChild( document.createTextNode( `BY ${track.creator}` ) );
		panel.appendChild( creator );

		// Difficulty badge
		const diff = document.createElement( 'div' );
		diff.className = `kk-track-preview__difficulty kk-track-preview__difficulty--${track.difficulty.toLowerCase()}`;
		diff.textContent = track.difficulty;
		panel.appendChild( diff );

		// Stats
		const stats = document.createElement( 'div' );
		stats.className = 'kk-track-preview__stats';

		const makeStat = ( value, label ) => {
			const s = document.createElement( 'div' );
			s.className = 'kk-track-preview__stat';
			const v = document.createElement( 'div' );
			v.className = 'kk-track-preview__stat-value';
			v.textContent = String( value );
			const l = document.createElement( 'div' );
			l.className = 'kk-track-preview__stat-label';
			l.textContent = label;
			s.appendChild( v );
			s.appendChild( l );
			return s;
		};

		stats.appendChild( makeStat( `${track.rating} ★`, 'RATING' ) );
		stats.appendChild( makeStat( track.plays >= 1000 ? `${( track.plays / 1000 ).toFixed( 1 )}K` : track.plays, 'PLAYS' ) );
		panel.appendChild( stats );

		// Play now button
		const playWrap = document.createElement( 'div' );
		playWrap.className = 'kk-track-preview__play-wrap';
		playWrap.appendChild( this._playNowBtn.el );
		panel.appendChild( playWrap );

		// Mark selected card
		this._trackListEl.querySelectorAll( '.kk-discover-card' ).forEach( ( c ) => {
			c.classList.toggle( 'kk-discover-card--selected', c.dataset.discoverTrackId === track.id );
			c.setAttribute( 'aria-selected', String( c.dataset.discoverTrackId === track.id ) );
		} );

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a single track card.
	 *
	 * @param {object} track
	 * @returns {HTMLElement}
	 */
	_buildTrackCard( track ) {

		const card = document.createElement( 'div' );
		card.className = 'kk-discover-card';
		card.setAttribute( 'role', 'listitem' );
		card.setAttribute( 'tabindex', '0' );
		card.setAttribute( 'aria-label', `${track.name} by ${track.creator}, ${track.difficulty}, ${track.rating} stars, ${track.plays} plays` );
		card.dataset.discoverTrackId = track.id;

		// Thumbnail
		const thumb = document.createElement( 'div' );
		thumb.className = 'kk-discover-card__thumb';
		thumb.setAttribute( 'aria-hidden', 'true' );
		thumb.textContent = 'MAP';
		card.appendChild( thumb );

		// Details
		const details = document.createElement( 'div' );
		details.className = 'kk-discover-card__details';

		const name = document.createElement( 'div' );
		name.className = 'kk-discover-card__name';
		name.textContent = track.name;
		details.appendChild( name );

		const meta = document.createElement( 'div' );
		meta.className = 'kk-discover-card__meta';

		const rating = document.createElement( 'span' );
		rating.className = 'kk-discover-card__rating';
		rating.textContent = `${track.rating} ★`;
		meta.appendChild( rating );

		const plays = document.createElement( 'span' );
		plays.className = 'kk-discover-card__plays';
		plays.textContent = track.plays >= 1000 ? `${( track.plays / 1000 ).toFixed( 1 )}K` : track.plays;
		meta.appendChild( plays );

		details.appendChild( meta );
		card.appendChild( details );

		// Difficulty badge
		const diffBadge = document.createElement( 'div' );
		diffBadge.className = `kk-discover-card__difficulty-badge kk-discover-card__difficulty-badge--${track.difficulty.toLowerCase()}`;
		diffBadge.setAttribute( 'aria-hidden', 'true' );
		diffBadge.textContent = track.difficulty;
		card.appendChild( diffBadge );

		// Keyboard activation
		card.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				card.click();
			}
		} );

		return card;

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get playNowBtn() { return this._playNowBtn; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._tabs?.dispose();
		this._tabs = null;

		this._header?.dispose();
		this._header = null;

		this._playNowBtn      = null;
		this._previewPanelEl  = null;
		this._trackListEl     = null;

		super.dispose();

	}

}
