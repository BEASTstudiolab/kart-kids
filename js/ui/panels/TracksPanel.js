import { Settings } from '../../Settings.js';
import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';
import { encodeV4ToUrlPayload, v4ToCells } from '../../track-library/TrackRecordMappers.js';
import { MarginalPanelCard } from '../components/MarginalPanelCard.js';
import { MarginalPanelHeader } from '../components/MarginalPanelHeader.js';
import { TrackLibraryBrowser } from '../components/TrackLibraryBrowser.js';
import { renderMinimap } from '../components/TrackMinimap.js';

const TAB_DEFS = [
	{ id: 'official',  label: 'Official',  emptyText: 'No official tracks yet.' },
	{ id: 'spotlight', label: 'Spotlight', emptyText: 'Spotlight is empty for now.' },
	{ id: 'saved',     label: 'My Saved',  emptyText: 'Save a public track or create one in the editor.' },
	{ id: 'published', label: 'My Published', emptyText: 'Publish a track to manage it here.' },
];

function _formatChip( value, fallback = 'Ready' ) {

	return String( value || fallback )
		.replace( /[-_]+/g, ' ' )
		.trim()
		.toUpperCase();

}

function _describeTrackBrief( track ) {

	if ( ! track ) return '';
	if ( track.source === 'official' ) return 'An official Kart Kids route available to every player in the current build.';
	if ( track.source === 'spotlight' ) return 'A featured public route curated into the live spotlight rotation.';
	if ( track.source === 'published' ) return 'Your published route is live and ready for management, sharing, and re-entry into the editor.';
	return 'A saved route from your local library, ready to slot into solo or party play.';

}

export class TracksPanel {

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._settings = new Settings();
		this._api = new PublishedTrackApi();
		this._library = new TrackLibraryStore();
		this._root = null;
		this._browser = null;
		this._browserMount = null;
		this._sectionsById = new Map();
		this._activeTabId = 'official';
		this._tabButtons = new Map();
		this._tabCounts = new Map();

		this._selectionTitleEl = null;
		this._selectionMetaEl = null;
		this._selectionCopyEl = null;
		this._selectionMapEl = null;
		this._selectionLaunchBtn = null;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	_injectCSS() {

		if ( TracksPanel._cssInjected ) return;
		TracksPanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-tracks {
				--mv-cream: #F7F3E9;
				--mv-red: #D82C2C;
				--mv-dark: #0F1115;
				--mv-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
				--mv-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
				position: relative;
				width: 100%;
				height: 100%;
				overflow: hidden;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
				background: unset;
			}

			.kk-tracks,
			.kk-tracks * {
				cursor: crosshair;
			}

			.kk-tracks__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(280px, var(--kk-tracks-deck-width, 22rem));
				grid-template-rows: auto auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 16px;
			}

			.kk-tracks__header {
				grid-column: 1 / span 2;
			}

			.kk-tracks__header.kk-mv-header {
				padding-top: 57px;
			}

			/* ---------- Sub-tab strip ---------- */

			.kk-tracks__tabs {
				grid-column: 1 / span 2;
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				padding: 4px 0;
			}

			.kk-tracks__tab {
				flex: 0 0 10rem;
				padding: 0.7rem 0.9rem;
				border: 1px solid rgba(247, 243, 233, 0.42);
				background: rgba(15, 17, 21, 0.45);
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 0.66rem;
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				cursor: pointer;
				transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
				clip-path: polygon(0 0, 100% 0, 100% 86%, 94% 100%, 0 100%);
				display: inline-flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.kk-tracks__tab:hover {
				background: rgba(15, 17, 21, 0.65);
				border-color: rgba(247, 243, 233, 0.78);
				transform: translateY(-1px);
			}

			.kk-tracks__tab--active {
				background: var(--mv-cream);
				color: var(--mv-dark);
				border-color: var(--mv-cream);
			}

			.kk-tracks__tab-count {
				font-family: var(--mv-font-mono);
				font-size: 0.6rem;
				font-weight: 700;
				letter-spacing: 0.12em;
				opacity: 0.78;
			}

			/* ---------- Stage (browser carousel) ---------- */

			.kk-tracks__stage {
				grid-column: 1;
				grid-row: 3;
				min-height: 0;
				background: rgba(15, 17, 21, 0.42);
				padding: 1rem;
				clip-path: polygon(0 0, 100% 0, 100% 95%, 96% 100%, 0 100%);
				overflow: hidden;
			}

			.kk-tracks__browser {
				height: 100%;
				min-height: 0;
			}

			.kk-tracks .kk-track-library {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
				grid-template-columns: 1fr;
			}

			.kk-tracks .kk-track-library__detail {
				display: none;
			}

			.kk-tracks .kk-track-library__content {
				height: 100%;
				gap: 0.95rem;
				padding: 0;
				padding-bottom: 0;
				overflow-y: auto;
			}

			.kk-tracks .kk-track-library__section {
				gap: 0.5rem;
			}

			.kk-tracks .kk-track-library__heading {
				display: none;
			}

			.kk-tracks .kk-track-library__carousel {
				padding: 0.4rem 0.1rem;
				gap: 0.75rem;
			}

			.kk-tracks .kk-track-library__arrow {
				width: 2.1rem;
				height: 3rem;
				border-radius: 0;
				border: 1px solid rgba(247, 243, 233, 0.32);
				background: rgba(15, 17, 21, 0.86);
				color: var(--mv-cream);
				clip-path: polygon(0 0, 100% 0, 100% 88%, 94% 100%, 0 100%);
			}

			.kk-tracks .kk-track-library__card {
				min-width: 13rem;
				max-width: 13rem;
				padding: 0.85rem;
				border: 1px solid rgba(247, 243, 233, 0.18);
				background: rgba(15, 17, 21, 0.92);
				border-radius: 0;
				box-shadow: none;
				clip-path: polygon(0 0, 100% 0, 100% 92%, 94% 100%, 0 100%);
			}

			.kk-tracks .kk-track-library__card--selected {
				border-color: var(--mv-red);
				box-shadow: 0 0 0 1px rgba(216, 44, 44, 0.5), 0 14px 24px rgba(216, 44, 44, 0.18);
			}

			.kk-tracks .kk-track-library__card-name {
				color: var(--mv-cream);
				font-family: var(--mv-font-display);
				font-size: 1rem;
				letter-spacing: -0.02em;
			}

			.kk-tracks .kk-track-library__card-meta {
				color: rgba(247, 243, 233, 0.66);
				font-family: var(--mv-font-mono);
				font-size: 0.62rem;
				letter-spacing: 0.12em;
			}

			.kk-tracks .kk-track-library__card-minimap {
				border: 1px solid rgba(247, 243, 233, 0.08);
				background: transparent;
				border-radius: 0;
				--track-minimap-track: var(--mv-cream);
			}

			.kk-tracks .kk-track-library__badge {
				border-radius: 0;
				font-family: var(--mv-font-mono);
				font-size: 0.6rem;
			}

			.kk-tracks .kk-track-library__empty {
				border-radius: 0;
				border: 1px dashed rgba(247, 243, 233, 0.18);
				background: rgba(247, 243, 233, 0.03);
				color: rgba(247, 243, 233, 0.62);
				font-family: var(--mv-font-mono);
				font-size: 0.72rem;
				letter-spacing: 0.12em;
				margin: 0;
				padding: 1rem 1.2rem;
			}

			/* ---------- Right deck (Selected + Editor CTA) ---------- */

			.kk-tracks__deck {
				grid-column: 2;
				grid-row: 3;
				display: flex;
				flex-direction: column;
				gap: 14px;
				min-height: 0;
				z-index: 4;
			}

			.kk-tracks__cta,
			.kk-tracks__selection-card.kk-mv-card {
				background: rgba(15, 17, 21, 0.78);
				color: var(--mv-cream);
				border: 1px solid rgba(247, 243, 233, 0.18);
				padding: 1rem;
				display: flex;
				flex-direction: column;
				gap: 0.6rem;
				clip-path: polygon(0 0, 100% 0, 100% 94%, 95% 100%, 0 100%);
				box-shadow: 0 24px 44px rgba(0, 0, 0, 0.32);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				margin: 0;
			}

			.kk-tracks__selection-card .kk-mv-value {
				margin-top: 12px;
				margin-bottom: 12px;
			}

			.kk-tracks__selection-card .kk-mv-card__body {
				gap: 0.5rem;
			}

			.kk-tracks__selection-card .kk-mv-card__header,
			.kk-tracks__selection-card .kk-mv-card__header-left,
			.kk-tracks__selection-card .kk-mv-card__header-right {
				color: rgba(247, 243, 233, 0.78);
				border-color: rgba(247, 243, 233, 0.22);
			}

			.kk-tracks__deck-eyebrow {
				font-family: var(--mv-font-mono);
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.22em;
				text-transform: uppercase;
				color: var(--mv-red);
			}

			.kk-tracks__deck-title {
				margin: 0;
				font-family: var(--mv-font-display);
				font-size: clamp(1.5rem, 2.6vw, 2rem);
				font-weight: 900;
				line-height: 0.92;
				letter-spacing: -0.04em;
				text-transform: uppercase;
				color: var(--mv-cream);
			}

			.kk-tracks__deck-copy {
				margin: 0;
				font-family: var(--mv-font-mono);
				font-size: 0.72rem;
				line-height: 1.55;
				letter-spacing: 0.06em;
				color: rgba(247, 243, 233, 0.72);
				text-transform: uppercase;
			}

			.kk-tracks__badge-row {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
			}

			.kk-tracks__badge {
				display: inline-flex;
				align-items: center;
				padding: 5px 9px;
				background: rgba(247, 243, 233, 0.08);
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 0.58rem;
				font-weight: 700;
				letter-spacing: 0.16em;
				text-transform: uppercase;
			}

			.kk-tracks__badge--selected {
				background: var(--mv-cream);
				color: var(--mv-dark);
			}

			.kk-tracks__map {
				min-height: 80px;
				padding: 4px;
				border: 1px solid rgba(247, 243, 233, 0.18);
				--track-minimap-track: var(--mv-cream);
				overflow: hidden;
			}

			.kk-tracks__selection-card .kk-tracks__map {
				width: 291px;
				max-width: 100%;
				height: 100px;
				min-height: 100px;
				padding: 0;
				border-width: 0;
				border: 0;
				overflow: visible;
				position: relative;
				box-sizing: border-box;
			}

			.kk-tracks__map canvas,
			.kk-tracks__map svg {
				display: block;
				width: 100%;
				height: auto;
			}

			.kk-tracks__selection-card .kk-tracks__map svg.kk-track-minimap {
				position: absolute;
				left: -134px;
				top: 23px;
				width: 378px;
				height: 99px;
				max-width: none;
				overflow: visible;
				vertical-align: bottom;
				text-align: left;
			}

			.kk-tracks__btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 44px;
				padding: 0.85rem 1rem;
				border: 1px solid rgba(247, 243, 233, 0.32);
				background: transparent;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 0.66rem;
				font-weight: 700;
				letter-spacing: 0.16em;
				text-transform: uppercase;
				cursor: pointer;
				text-decoration: none;
				transition: background 150ms ease, transform 150ms ease, border-color 150ms ease;
			}

			.kk-tracks__btn:hover {
				background: rgba(247, 243, 233, 0.1);
				border-color: rgba(247, 243, 233, 0.62);
				transform: translateY(-1px);
			}

			.kk-tracks__btn--primary {
				background: var(--mv-cream);
				color: var(--mv-dark);
				border-color: var(--mv-cream);
			}

			.kk-tracks__btn--primary:hover {
				background: rgba(247, 243, 233, 0.84);
				color: var(--mv-dark);
				border-color: var(--mv-cream);
			}

			.kk-tracks__btn--cta {
				background: var(--mv-red);
				color: var(--mv-cream);
				border-color: var(--mv-red);
				font-size: 0.78rem;
				min-height: 52px;
			}

			.kk-tracks__btn--cta:hover {
				background: rgba(216, 44, 44, 0.86);
				border-color: var(--mv-red);
				color: var(--mv-cream);
			}

			.kk-tracks__btn:disabled {
				opacity: 0.4;
				cursor: default;
				transform: none;
			}

			.kk-tracks__btn-row {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
			}

			@media (max-width: 980px) {
				.kk-tracks {
					overflow-y: auto;
				}

				.kk-tracks__interface {
					grid-template-columns: 1fr;
					grid-template-rows: auto auto auto auto;
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 14px;
				}

				.kk-tracks__header,
				.kk-tracks__tabs,
				.kk-tracks__stage,
				.kk-tracks__deck {
					grid-column: auto;
					grid-row: auto;
				}

				.kk-tracks__stage {
					min-height: 16rem;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-tracks';

		const frame = document.createElement( 'div' );
		frame.className = 'kk-tracks__interface';
		this._root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Tracks',
			subtitle: 'Route Index // Pick, Tune, Build',
			badge: '',
			className: 'kk-tracks__header',
		} ).el );

		// Sub-tab strip
		const tabs = document.createElement( 'nav' );
		tabs.className = 'kk-tracks__tabs';
		tabs.setAttribute( 'aria-label', 'Track sources' );
		for ( const def of TAB_DEFS ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'kk-tracks__tab';
			btn.dataset.tabId = def.id;

			const label = document.createElement( 'span' );
			label.textContent = def.label;
			btn.appendChild( label );

			const count = document.createElement( 'span' );
			count.className = 'kk-tracks__tab-count';
			count.textContent = '—';
			btn.appendChild( count );
			this._tabCounts.set( def.id, count );

			btn.addEventListener( 'click', () => this._setActiveTab( def.id ) );
			tabs.appendChild( btn );
			this._tabButtons.set( def.id, btn );

		}
		frame.appendChild( tabs );

		// Stage with browser
		const stage = document.createElement( 'div' );
		stage.className = 'kk-tracks__stage';
		frame.appendChild( stage );

		this._browserMount = document.createElement( 'div' );
		this._browserMount.className = 'kk-tracks__browser';
		stage.appendChild( this._browserMount );
		this._browser = new TrackLibraryBrowser( this._browserMount, {
			onTrackSelected: ( trackId ) => {

				this._settings.setSelectedTrackId( trackId );
				this._updateSelectionCard( this._findTrackById( trackId ) );

			},
		} );

		// Right deck — selection + editor CTA
		const deck = document.createElement( 'aside' );
		deck.className = 'kk-tracks__deck';

		deck.appendChild( this._buildSelectionCard() );
		deck.appendChild( this._buildEditorCta() );

		frame.appendChild( deck );

	}

	_buildSelectionCard() {

		const panelCard = new MarginalPanelCard( {
			variant: 'cream',
			headerLeft: 'Selected Route',
			headerRight: '',
		} );

		const card = panelCard.el;
		card.classList.add( 'kk-tracks__selection', 'kk-tracks__selection-card' );

		const body = panelCard.bodyEl;

		this._selectionMapEl = document.createElement( 'div' );
		this._selectionMapEl.className = 'kk-tracks__map';
		body.appendChild( this._selectionMapEl );

		const valueWrap = document.createElement( 'div' );
		valueWrap.className = 'kk-mv-value';
		body.appendChild( valueWrap );

		this._selectionTitleEl = document.createElement( 'h3' );
		this._selectionTitleEl.className = 'kk-tracks__deck-title';
		this._selectionTitleEl.textContent = '—';
		valueWrap.appendChild( this._selectionTitleEl );

		this._selectionMetaEl = document.createElement( 'div' );
		this._selectionMetaEl.className = 'kk-tracks__badge-row';
		valueWrap.appendChild( this._selectionMetaEl );

		this._selectionCopyEl = document.createElement( 'p' );
		this._selectionCopyEl.className = 'kk-tracks__deck-copy';
		this._selectionCopyEl.textContent = 'Pick a route from the strip to see details.';
		valueWrap.appendChild( this._selectionCopyEl );

		this._selectionLaunchBtn = document.createElement( 'button' );
		this._selectionLaunchBtn.type = 'button';
		this._selectionLaunchBtn.className = 'kk-tracks__btn kk-tracks__btn--primary';
		this._selectionLaunchBtn.textContent = 'Launch Solo';
		this._selectionLaunchBtn.addEventListener( 'click', () => {

			this._services.startRace?.( { mode: 'solo' } );

		} );
		body.appendChild( this._selectionLaunchBtn );

		return card;

	}

	_buildEditorCta() {

		const card = document.createElement( 'section' );
		card.className = 'kk-tracks__cta';

		const eyebrow = document.createElement( 'div' );
		eyebrow.className = 'kk-tracks__deck-eyebrow';
		eyebrow.textContent = 'Track Editor';
		card.appendChild( eyebrow );

		const title = document.createElement( 'h3' );
		title.className = 'kk-tracks__deck-title';
		title.textContent = 'Build Your Own';
		card.appendChild( title );

		const copy = document.createElement( 'p' );
		copy.className = 'kk-tracks__deck-copy';
		copy.textContent = 'Drop tiles, set elevation, place a finish line. Save it, race it, share it.';
		card.appendChild( copy );

		const link = document.createElement( 'a' );
		link.className = 'kk-tracks__btn kk-tracks__btn--cta';
		link.href = '/track-editor.html';
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = 'Open Track Editor →';
		card.appendChild( link );

		const refreshBtn = document.createElement( 'button' );
		refreshBtn.type = 'button';
		refreshBtn.className = 'kk-tracks__btn';
		refreshBtn.textContent = 'Refresh Library';
		refreshBtn.addEventListener( 'click', () => this.refresh() );
		card.appendChild( refreshBtn );

		return card;

	}

	_setActiveTab( tabId ) {

		this._activeTabId = tabId;
		for ( const [ id, btn ] of this._tabButtons ) {

			const active = id === tabId;
			btn.classList.toggle( 'kk-tracks__tab--active', active );
			btn.setAttribute( 'aria-pressed', String( active ) );

		}

		const section = this._sectionsById.get( tabId ) || { id: tabId, label: TAB_DEFS.find( d => d.id === tabId )?.label, items: [], emptyText: TAB_DEFS.find( d => d.id === tabId )?.emptyText };
		const selectedId = this._settings.getSelectedTrackId();
		this._browser.setSections( [ section ], selectedId );

		const items = section.items || [];
		const sel = items.find( ( i ) => i.trackId === selectedId ) || items[ 0 ] || null;
		this._updateSelectionCard( sel );

	}

	async refresh() {

		this._settings = new Settings();
		const selectedId = this._settings.getSelectedTrackId();

		const officialTracks = this._library.getOfficialTracks();
		const spotlightTracks = await this._loadSpotlightTracks();
		const myPublished = await this._loadPublishedTracks();
		const mySaved = this._loadSavedTracks();

		this._sectionsById = new Map( [
			[ 'official',  { id: 'official',  label: 'Official',     items: officialTracks,  emptyText: 'No official tracks yet.' } ],
			[ 'spotlight', { id: 'spotlight', label: 'Spotlight',    items: spotlightTracks, emptyText: 'Spotlight is empty for now.' } ],
			[ 'saved',     { id: 'saved',     label: 'My Saved',     items: mySaved,         emptyText: 'Save a public track or create one in the editor.' } ],
			[ 'published', { id: 'published', label: 'My Published', items: myPublished,     emptyText: 'Publish a track to manage it here.' } ],
		] );

		for ( const def of TAB_DEFS ) {

			const count = this._sectionsById.get( def.id )?.items?.length ?? 0;
			const countEl = this._tabCounts.get( def.id );
			if ( countEl ) countEl.textContent = String( count );

		}

		const validIds = new Set();
		for ( const section of this._sectionsById.values() ) {

			for ( const item of section.items || [] ) {

				if ( item.trackId ) validIds.add( item.trackId );

			}

		}
		const nextSelectedId = validIds.has( selectedId ) ? selectedId : ( officialTracks[ 0 ]?.trackId ?? null );
		if ( nextSelectedId && nextSelectedId !== selectedId ) {

			this._settings.setSelectedTrackId( nextSelectedId );

		}

		this._setActiveTab( this._activeTabId );

	}

	async _loadSpotlightTracks() {

		try {

			const response = await this._api.getSpotlightTracks();
			return ( response.tracks || [] ).map( ( track ) => ( {
				...this._library.mapSpotlightTrack( track ),
				actions: [
					{ label: 'Open Public Page', href: `/t/${ track.publicId }`, target: '_blank' },
				],
			} ) );

		} catch {

			return [];

		}

	}

	async _loadPublishedTracks() {

		const ownerships = this._library.getOwnerships();

		return Promise.all( ownerships.map( async ( ownership ) => {

			try {

				const managed = await this._api.getManagedTrack( ownership.manageToken );
				return {
					trackId: ownership.trackId,
					publicId: managed.publicId,
					title: managed.title,
					creatorName: managed.creatorName,
					status: managed.status,
					trackData: managed.trackData,
					cells: managed.trackData ? v4ToCells( managed.trackData ) : [],
					source: 'published',
					selectable: false,
					actions: [
						{ label: 'Open Manage', href: `/m/${ ownership.manageToken }`, target: '_blank' },
						{ label: 'Open in Editor', href: `/track-editor.html?manage=${ ownership.manageToken }`, target: '_blank' },
						{ label: 'Copy Public Link', onClick: () => this._copyText( `${ window.location.origin }/t/${ managed.publicId }`, 'Public link copied.' ) },
					],
				};

			} catch {

				return {
					trackId: ownership.trackId,
					publicId: ownership.publicId,
					title: ownership.title,
					creatorName: ownership.creatorName,
					status: ownership.status || 'unknown',
					cells: [],
					source: 'published',
					selectable: false,
					actions: [
						{ label: 'Open Manage', href: `/m/${ ownership.manageToken }`, target: '_blank' },
					],
				};

			}

		} ) );

	}

	_loadSavedTracks() {

		return this._library.getSavedTracks().map( ( track ) => {

			const actions = [];
			if ( track.trackData ) {

				actions.push( {
					label: 'Open in Editor',
					href: `/track-editor.html#track=v4:${ encodeV4ToUrlPayload( track.trackData ) }`,
					target: '_blank',
				} );

			}

			return {
				...track,
				title: track.title || track.name,
				selectable: true,
				actions,
			};

		} );

	}

	_updateSelectionCard( track ) {

		if ( ! track ) {

			if ( this._selectionTitleEl ) this._selectionTitleEl.textContent = 'Nothing here';
			if ( this._selectionMetaEl ) this._selectionMetaEl.innerHTML = '';
			if ( this._selectionCopyEl ) this._selectionCopyEl.textContent = 'Pick a route from the strip to see details.';
			if ( this._selectionMapEl ) this._selectionMapEl.innerHTML = '';
			if ( this._selectionLaunchBtn ) this._selectionLaunchBtn.disabled = true;
			return;

		}

		if ( this._selectionTitleEl ) this._selectionTitleEl.textContent = track.title || track.name || 'Route';
		if ( this._selectionCopyEl ) this._selectionCopyEl.textContent = _describeTrackBrief( track );

		if ( this._selectionMetaEl ) {

			this._selectionMetaEl.innerHTML = '';

			const difficultyBadge = document.createElement( 'span' );
			difficultyBadge.className = 'kk-tracks__badge kk-tracks__badge--selected';
			difficultyBadge.textContent = _formatChip( track.difficulty, 'Easy' );
			this._selectionMetaEl.appendChild( difficultyBadge );

			const sourceBadge = document.createElement( 'span' );
			sourceBadge.className = 'kk-tracks__badge';
			sourceBadge.textContent = _formatChip( track.source, 'Official' );
			this._selectionMetaEl.appendChild( sourceBadge );

			if ( track.creatorName ) {

				const creatorBadge = document.createElement( 'span' );
				creatorBadge.className = 'kk-tracks__badge';
				creatorBadge.textContent = _formatChip( track.creatorName, 'Studio' );
				this._selectionMetaEl.appendChild( creatorBadge );

			}

		}

		if ( this._selectionMapEl ) {

			this._selectionMapEl.innerHTML = '';
			if ( Array.isArray( track.cells ) && track.cells.length > 0 ) {

				this._selectionMapEl.appendChild( renderMinimap( track.cells, 540, 120 ) );

			}

		}

		if ( this._selectionLaunchBtn ) this._selectionLaunchBtn.disabled = ! track.trackId || track.selectable === false;

	}

	_findTrackById( trackId ) {

		if ( ! trackId ) return null;
		for ( const section of this._sectionsById.values() ) {

			const item = ( section.items || [] ).find( ( i ) => i.trackId === trackId );
			if ( item ) return item;

		}
		return null;

	}

	async _copyText( value, message ) {

		try {

			await navigator.clipboard.writeText( value );
			this._services.notification?.show( { message, variant: 'success', duration: 2000 } );

		} catch {

			this._services.notification?.show( { message: value, variant: 'info', duration: 3500 } );

		}

	}

	show() {

		this.refresh();

	}

	hide() {}

	dispose() {

		this._browser?.dispose?.();
		if ( this._root?.parentNode ) this._root.parentNode.removeChild( this._root );
		this._root = null;
		this._tabButtons.clear();
		this._tabCounts.clear();
		this._sectionsById.clear();

	}

}

TracksPanel._cssInjected = false;
