/**
 * Page16CreateHubView — Track Builder / Create Hub.
 *
 * Layout: full-viewport grid; no scroll.
 *
 * Grid rows:  page header | top tab bar | body (1fr)
 * Body cols:  220px left sidebar | 1fr center | 260px right (featured creator)
 *
 * Zones:
 *   header         — PageHeader ("CREATE HUB", back to /home)
 *   topTabs        — TRACK BUILDER, KART CUSTOMIZER, STREET ART STUDIO, COMMUNITY HUB
 *   sidebar        — CREATE NEW TRACK (primary), MY TRACKS, DRAFTS, PUBLISHED TRACKS, STARTER TEMPLATES
 *   center         — MY RECENT TRACKS grid (3 cards) + FEATURED TRACKS grid
 *   right          — FEATURED CREATOR spotlight panel
 *
 * Track cards are built inline (TrackCard-style) using the design system's
 * dark panel aesthetic with star ratings and EDIT TRACK / PLAY CTAs.
 *
 * Deviations from spec:
 *   - COMMUNITY HUB tab is a placeholder (routes to /discover externally).
 *   - KART CUSTOMIZER and STREET ART STUDIO tabs show placeholder panels —
 *     they are separate major systems, not sub-views of this page.
 *   - MY TRACKS / DRAFTS / PUBLISHED sidebar buttons act as visual filter
 *     selectors updating the center section heading; full filter logic awaits
 *     a real TrackRepository.
 */

import { PageViewBase }   from '../../core/PageViewBase.js';
import { PageHeader }     from '../../components/PageHeader.js';
import { Tabs }           from '../../components/Tabs.js';
import { CTAButton }      from '../../components/CTAButton.js';
import { ButtonIds }      from '../../enums/ButtonIds.js';

export class Page16CreateHubView extends PageViewBase {

	constructor() {

		super( 'page-create-hub' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {Tabs} */
		this._topTabs = null;

		/** @type {HTMLElement} */
		this._myRecentTracksEl = null;

		/** @type {HTMLElement} */
		this._featuredTracksEl = null;

		/** @type {HTMLElement} */
		this._featuredHeadingBtn = null;

		/** @type {CTAButton[]} */
		this._sidebarBtns = [];

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page16CreateHubView._cssInjected ) return;
		Page16CreateHubView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root
			================================================================ */

			.page-create-hub {
				display: grid;
				grid-template-rows: auto auto 1fr;
				grid-template-columns: 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-bg-base);
			}

			/* ================================================================
			   Header strip
			================================================================ */

			.page-create-hub__header-strip {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* Brand wordmarks in header */
			.page-create-hub__brand {
				display: flex;
				align-items: center;
				gap: var(--space-4);
			}

			.page-create-hub__brand-beastside {
				font-family: var(--font-display);
				font-weight: var(--weight-black);
				font-size: var(--text-lg);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.page-create-hub__brand-game {
				font-family: var(--font-display);
				font-weight: var(--weight-black);
				font-size: var(--text-lg);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.page-create-hub__title-pill {
				padding: var(--space-1) var(--space-4);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-pill);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* ================================================================
			   Top tab bar
			================================================================ */

			.page-create-hub__top-tabs {
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
				padding: 0 var(--space-2);
			}

			/* Override Tabs base to use wider, more prominent tab style */
			.page-create-hub__top-tabs .kk-tabs {
				background: transparent;
				border-bottom: none;
				gap: var(--space-1);
			}

			.page-create-hub__top-tabs .kk-tabs__tab {
				padding: var(--space-3) var(--space-6);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				font-family: var(--font-display);
				letter-spacing: var(--tracking-wider);
				border-radius: var(--radius-sm) var(--radius-sm) 0 0;
				border-bottom-width: 3px;
				background: rgba(255, 255, 255, 0.02);
				transition:
					color var(--duration-fast) var(--ease-standard),
					background var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard);
			}

			.page-create-hub__top-tabs .kk-tabs__tab:hover {
				background: rgba(255, 255, 255, 0.06);
			}

			.page-create-hub__top-tabs .kk-tabs__tab[aria-selected="true"] {
				background: rgba(255, 107, 0, 0.08);
				color: var(--color-accent-orange);
				border-bottom-color: var(--color-accent-orange);
			}

			/* ================================================================
			   Body — three-column layout
			================================================================ */

			.page-create-hub__body {
				display: grid;
				grid-template-columns: 220px 1fr 260px;
				overflow: hidden;
			}

			/* ================================================================
			   Left sidebar
			================================================================ */

			.page-create-hub__sidebar {
				display: flex;
				flex-direction: column;
				gap: 0;
				background: var(--color-panel-base);
				border-right: 1px solid var(--color-panel-border);
				overflow-y: auto;
				scrollbar-width: thin;
			}

			.page-create-hub__sidebar-section {
				padding: var(--space-4) var(--space-3) var(--space-2);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-create-hub__sidebar-section:last-child {
				border-bottom: none;
			}

			.page-create-hub__sidebar-section-label {
				margin-bottom: var(--space-3);
				display: block;
			}

			/* Sidebar button overrides */
			.page-create-hub__sidebar .kk-cta-button {
				width: 100%;
				justify-content: flex-start;
				text-align: left;
				padding: 0 var(--space-4);
				font-size: var(--text-sm);
				border-radius: var(--radius-sm);
				margin-bottom: var(--space-1);
			}

			.page-create-hub__sidebar .kk-cta-button:last-child {
				margin-bottom: 0;
			}

			/* Primary CTA — CREATE NEW TRACK */
			.page-create-hub__sidebar .kk-cta-button--primary {
				font-size: var(--text-base);
				font-weight: var(--weight-black);
				background: var(--color-accent-orange);
				color: var(--color-black);
				box-shadow: 0 2px 12px rgba(255, 107, 0, 0.4);
				letter-spacing: var(--tracking-wider);
				margin-bottom: var(--space-3);
			}

			.page-create-hub__sidebar .kk-cta-button--primary:hover:not([aria-disabled="true"]) {
				filter: brightness(1.12);
				box-shadow: 0 4px 18px rgba(255, 107, 0, 0.55);
			}

			/* Secondary sidebar buttons */
			.page-create-hub__sidebar .kk-cta-button--secondary {
				background: rgba(255, 255, 255, 0.03);
				border-color: var(--color-panel-border);
				color: var(--color-ink-200);
			}

			.page-create-hub__sidebar .kk-cta-button--secondary:hover:not([aria-disabled="true"]) {
				background: rgba(255, 255, 255, 0.07);
				border-color: var(--color-ink-400);
				color: var(--color-white);
			}

			/* Ghost sidebar buttons (e.g., STARTER TEMPLATES) */
			.page-create-hub__sidebar .kk-cta-button--ghost {
				border: 1px dashed var(--color-panel-border);
				color: var(--color-ink-400);
				font-size: var(--text-xs);
			}

			.page-create-hub__sidebar .kk-cta-button--ghost:hover:not([aria-disabled="true"]) {
				border-color: var(--color-ink-300);
				color: var(--color-ink-200);
				background: rgba(255,255,255,0.03);
			}

			/* Badge for DRAFTS (notification dot) */
			.page-create-hub__draft-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 18px;
				height: 18px;
				background: var(--color-cta-danger);
				color: var(--color-white);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				border-radius: 50%;
				margin-left: auto;
				flex-shrink: 0;
			}

			/* ================================================================
			   Center — main content
			================================================================ */

			.page-create-hub__center {
				display: flex;
				flex-direction: column;
				gap: 0;
				overflow-y: auto;
				padding: var(--space-5) var(--space-6);
				scrollbar-width: thin;
			}

			/* Section headings */
			.page-create-hub__section-heading {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				margin-bottom: var(--space-4);
			}

			.page-create-hub__section-heading-label {
				flex: 1;
			}

			/* Heading button (e.g., FEATURED TRACKS → /discover) */
			.page-create-hub__section-heading-btn {
				border-radius: var(--radius-sm);
			}

			/* ================================================================
			   Track card — MY RECENT TRACKS style
			================================================================ */

			.page-create-hub__track-grid {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: var(--space-4);
				margin-bottom: var(--space-7);
			}

			.page-create-hub__track-card {
				display: flex;
				flex-direction: column;
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				overflow: hidden;
				transition:
					border-color var(--duration-fast) var(--ease-standard),
					box-shadow var(--duration-fast) var(--ease-standard);
			}

			.page-create-hub__track-card:hover {
				border-color: var(--color-panel-border-strong);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			/* Thumbnail zone */
			.page-create-hub__track-thumb {
				position: relative;
				width: 100%;
				aspect-ratio: 16/10;
				background: var(--color-panel-raised);
				overflow: hidden;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.page-create-hub__track-thumb-label {
				color: var(--color-ink-400);
			}

			.page-create-hub__track-thumb-badge {
				position: absolute;
				top: var(--space-2);
				left: var(--space-2);
				padding: 2px var(--space-2);
				background: rgba(0, 0, 0, 0.65);
				border-radius: var(--radius-sm);
				font-family: var(--font-ui);
				font-size: 10px;
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* Card info */
			.page-create-hub__track-info {
				padding: var(--space-3);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-create-hub__track-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.page-create-hub__track-meta {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
			}

			.page-create-hub__track-rating {
				color: var(--color-accent-orange);
				font-weight: var(--weight-bold);
			}

			.page-create-hub__track-cta {
				padding: var(--space-2) var(--space-3) var(--space-3);
			}

			/* EDIT TRACK / PLAY buttons inside track cards */
			.page-create-hub__track-cta .kk-cta-button {
				width: 100%;
				justify-content: center;
				font-size: var(--text-xs);
				min-height: 36px;
				border-radius: var(--radius-sm);
			}

			/* ================================================================
			   Featured Creator — right sidebar
			================================================================ */

			.page-create-hub__creator-panel {
				background: var(--color-panel-base);
				border-left: 1px solid var(--color-panel-border);
				display: flex;
				flex-direction: column;
				overflow-y: auto;
				scrollbar-width: thin;
			}

			.page-create-hub__creator-header {
				padding: var(--space-4) var(--space-4) var(--space-2);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-create-hub__creator-label {
				display: block;
				margin-bottom: var(--space-1);
			}

			.page-create-hub__creator-avatar-zone {
				width: 100%;
				aspect-ratio: 1/1.1;
				background: linear-gradient(
					160deg,
					rgba(255, 107, 0, 0.08) 0%,
					var(--color-panel-raised) 60%
				);
				display: flex;
				align-items: flex-end;
				justify-content: center;
				overflow: hidden;
			}

			.page-create-hub__creator-avatar-placeholder {
				font-family: var(--font-display);
				font-size: var(--text-5xl, 4rem);
				color: var(--color-ink-600);
				font-weight: var(--weight-black);
				user-select: none;
				padding-bottom: var(--space-4);
			}

			.page-create-hub__creator-info {
				padding: var(--space-3) var(--space-4);
			}

			.page-create-hub__creator-spotlight {
				color: var(--color-ink-400);
				margin-bottom: var(--space-1);
				display: block;
			}

			.page-create-hub__creator-handle {
				font-family: var(--font-display);
				font-size: var(--text-base);
				font-weight: var(--weight-black);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-create-hub__creator-featured-label {
				margin: var(--space-3) var(--space-4) var(--space-2);
				border-top: 1px solid var(--color-panel-border);
				padding-top: var(--space-3);
				display: block;
			}

			.page-create-hub__creator-tracks {
				padding: 0 var(--space-4) var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-create-hub__creator-track-thumb {
				width: 100%;
				aspect-ratio: 16/9;
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.page-create-hub__creator-track-thumb-label {
				color: var(--color-ink-500);
			}

			/* ================================================================
			   Placeholder panel (non-active tabs)
			================================================================ */

			.page-create-hub__placeholder-panel {
				height: 100%;
			}

			.page-create-hub__placeholder-panel-icon {
				font-size: 3rem;
				opacity: 0.3;
			}

			.page-create-hub__placeholder-panel-text {
				color: var(--color-ink-500);
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

		// ----- Header strip -----
		const headerStrip = document.createElement( 'div' );
		headerStrip.className = 'page-create-hub__header-strip';

		// Brand left
		const brandLeft = document.createElement( 'div' );
		brandLeft.className = 'page-create-hub__brand';
		const beastsideEl = document.createElement( 'span' );
		beastsideEl.className = 'page-create-hub__brand-beastside';
		beastsideEl.textContent = 'BEASTSIDE';
		brandLeft.appendChild( beastsideEl );
		headerStrip.appendChild( brandLeft );

		// Center pill title — PageHeader for back button and accessible title
		this._header = new PageHeader( {
			title:    'CREATE HUB',
			showBack: true,
		} );

		// Wrap the pill-style title label separately, insert PageHeader for back
		const centerArea = document.createElement( 'div' );
		centerArea.className = 'kk-ui-inline-row';
		centerArea.appendChild( this._header.el );
		headerStrip.appendChild( centerArea );

		// Brand right
		const brandRight = document.createElement( 'div' );
		brandRight.className = 'page-create-hub__brand';
		const gameNameEl = document.createElement( 'span' );
		gameNameEl.className = 'page-create-hub__brand-game';
		gameNameEl.textContent = 'KART KIDS';
		brandRight.appendChild( gameNameEl );
		headerStrip.appendChild( brandRight );

		root.appendChild( headerStrip );
		this._registerSection( 'header', headerStrip );

		// ----- Top tab bar -----
		const tabsWrapper = document.createElement( 'div' );
		tabsWrapper.className = 'page-create-hub__top-tabs';

		this._topTabs = new Tabs( {
			ariaLabel: 'Create Hub sections',
			activeId:  'tab_track_builder',
			tabs: [
				{ id: 'tab_track_builder',   label: 'TRACK BUILDER' },
				{ id: 'tab_kart_customizer', label: 'KART CUSTOMIZER' },
				{ id: 'tab_street_art',      label: 'STREET ART STUDIO' },
				{ id: 'tab_community_hub',   label: 'COMMUNITY HUB' },
			],
		} );

		tabsWrapper.appendChild( this._topTabs.el );
		root.appendChild( tabsWrapper );
		this._registerSection( 'topTabs', tabsWrapper );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-create-hub__body';

		// Append tab panels that need body-level slot — they share the body layout
		// Track builder panel drives the 3-col body; other panels are full-span placeholders
		const trackBuilderPanel = this._topTabs.getPanel( 'tab_track_builder' );
		trackBuilderPanel.classList.add( 'kk-ui-display-contents' ); // dissolves into body grid
		body.appendChild( trackBuilderPanel );

		[ 'tab_kart_customizer', 'tab_street_art', 'tab_community_hub' ].forEach( ( tabId ) => {

			const panel = this._topTabs.getPanel( tabId );
			panel.classList.add( 'kk-ui-tab-panel' );
			panel.appendChild( this._buildPlaceholderPanel( tabId ) );
			body.appendChild( panel );

		} );

		// --- Sidebar ---
		const sidebar = this._buildSidebar();
		trackBuilderPanel.appendChild( sidebar );

		// --- Center ---
		const center = this._buildCenter();
		trackBuilderPanel.appendChild( center );

		// --- Featured Creator right panel ---
		const creatorPanel = this._buildCreatorPanel();
		trackBuilderPanel.appendChild( creatorPanel );

		root.appendChild( body );
		this._registerSection( 'body', body );

	}

	/**
	 * Build the left sidebar navigation column.
	 *
	 * @returns {HTMLElement}
	 */
	_buildSidebar() {

		const sidebar = document.createElement( 'nav' );
		sidebar.className = 'page-create-hub__sidebar';
		sidebar.setAttribute( 'aria-label', 'Create tools navigation' );

		// Primary CTA
		const primarySection = document.createElement( 'div' );
		primarySection.className = 'page-create-hub__sidebar-section';

		const newTrackBtn = new CTAButton( {
			label:    'CREATE NEW TRACK',
			variant:  'primary',
			actionId: ButtonIds.CREATE_NEW_TRACK,
		} );
		this._sidebarBtns.push( newTrackBtn );
		primarySection.appendChild( newTrackBtn.el );
		sidebar.appendChild( primarySection );

		// Library section
		const libSection = document.createElement( 'div' );
		libSection.className = 'page-create-hub__sidebar-section';

		const libLabel = document.createElement( 'span' );
		libLabel.className = 'page-create-hub__sidebar-section-label kk-ui-meta-label';
		libLabel.textContent = 'MY LIBRARY';
		libSection.appendChild( libLabel );

		const libButtons = [
			{ label: 'MY TRACKS',       actionId: ButtonIds.CREATE_TAB_MY_TRACKS },
			{ label: 'DRAFTS',           actionId: ButtonIds.CREATE_TAB_DRAFTS },
			{ label: 'PUBLISHED TRACKS', actionId: ButtonIds.CREATE_TAB_PUBLISHED },
		];

		libButtons.forEach( ( def ) => {

			const btn = new CTAButton( {
				label:    def.label,
				variant:  'secondary',
				actionId: def.actionId,
			} );

			if ( def.actionId === ButtonIds.CREATE_TAB_DRAFTS ) {

				// Inline badge for "1 unsaved draft"
				const badge = document.createElement( 'span' );
				badge.className = 'page-create-hub__draft-badge';
				badge.textContent = '1';
				badge.setAttribute( 'aria-label', '1 draft' );
				btn.el.appendChild( badge );

			}

			this._sidebarBtns.push( btn );
			libSection.appendChild( btn.el );

		} );

		sidebar.appendChild( libSection );

		// Templates section
		const tmplSection = document.createElement( 'div' );
		tmplSection.className = 'page-create-hub__sidebar-section';

		const tmplLabel = document.createElement( 'span' );
		tmplLabel.className = 'page-create-hub__sidebar-section-label kk-ui-meta-label';
		tmplLabel.textContent = 'TEMPLATES';
		tmplSection.appendChild( tmplLabel );

		const tmplBtn = new CTAButton( {
			label:    'STARTER TEMPLATES',
			variant:  'ghost',
			actionId: ButtonIds.CREATE_STARTER_TEMPLATES,
		} );
		this._sidebarBtns.push( tmplBtn );
		tmplSection.appendChild( tmplBtn.el );
		sidebar.appendChild( tmplSection );

		this._registerSection( 'sidebar', sidebar );
		return sidebar;

	}

	/**
	 * Build the center content column.
	 *
	 * @returns {HTMLElement}
	 */
	_buildCenter() {

		const center = document.createElement( 'div' );
		center.className = 'page-create-hub__center';

		// MY RECENT TRACKS section
		const recentHeading = document.createElement( 'div' );
		recentHeading.className = 'page-create-hub__section-heading';

		const recentLabel = document.createElement( 'span' );
		recentLabel.className = 'page-create-hub__section-heading-label kk-ui-meta-label';
		recentLabel.textContent = 'MY RECENT TRACKS';
		recentHeading.appendChild( recentLabel );
		center.appendChild( recentHeading );

		const recentGrid = document.createElement( 'div' );
		recentGrid.className = 'page-create-hub__track-grid';
		recentGrid.setAttribute( 'role', 'list' );
		recentGrid.setAttribute( 'aria-label', 'My recent tracks' );
		this._myRecentTracksEl = recentGrid;
		center.appendChild( recentGrid );

		this._registerSection( 'recentTracks', recentGrid );

		// FEATURED TRACKS section
		const featuredHeading = document.createElement( 'div' );
		featuredHeading.className = 'page-create-hub__section-heading';

		const featuredLabel = document.createElement( 'span' );
		featuredLabel.className = 'page-create-hub__section-heading-label kk-ui-meta-label';
		featuredLabel.textContent = 'FEATURED TRACKS';
		featuredHeading.appendChild( featuredLabel );

		const featuredBtn = document.createElement( 'button' );
		featuredBtn.type = 'button';
		featuredBtn.className = 'page-create-hub__section-heading-btn kk-ui-meta-action';
		featuredBtn.textContent = 'SEE ALL';
		featuredBtn.dataset.action = ButtonIds.CREATE_FEATURED_TRACKS;
		this._featuredHeadingBtn = featuredBtn;
		featuredHeading.appendChild( featuredBtn );
		center.appendChild( featuredHeading );

		const featuredGrid = document.createElement( 'div' );
		featuredGrid.className = 'page-create-hub__track-grid';
		featuredGrid.setAttribute( 'role', 'list' );
		featuredGrid.setAttribute( 'aria-label', 'Featured tracks' );
		this._featuredTracksEl = featuredGrid;
		center.appendChild( featuredGrid );

		this._registerSection( 'featuredTracks', featuredGrid );

		return center;

	}

	/**
	 * Build the featured creator right panel.
	 *
	 * @returns {HTMLElement}
	 */
	_buildCreatorPanel() {

		const panel = document.createElement( 'aside' );
		panel.className = 'page-create-hub__creator-panel';
		panel.setAttribute( 'aria-label', 'Featured creator' );

		const header = document.createElement( 'div' );
		header.className = 'page-create-hub__creator-header';

		const headerLabel = document.createElement( 'span' );
		headerLabel.className = 'page-create-hub__creator-label kk-ui-meta-label';
		headerLabel.textContent = 'FEATURED CREATOR';
		header.appendChild( headerLabel );
		panel.appendChild( header );

		// Avatar zone (character silhouette placeholder)
		const avatarZone = document.createElement( 'div' );
		avatarZone.className = 'page-create-hub__creator-avatar-zone';
		avatarZone.setAttribute( 'aria-hidden', 'true' );
		const avatarPlaceholder = document.createElement( 'span' );
		avatarPlaceholder.className = 'page-create-hub__creator-avatar-placeholder';
		avatarPlaceholder.textContent = '?';
		avatarZone.appendChild( avatarPlaceholder );
		panel.appendChild( avatarZone );

		// Creator info
		const info = document.createElement( 'div' );
		info.className = 'page-create-hub__creator-info';

		const spotlight = document.createElement( 'span' );
		spotlight.className = 'page-create-hub__creator-spotlight kk-ui-meta-label';
		spotlight.textContent = 'CREATOR SPOTLIGHT:';
		info.appendChild( spotlight );

		const handle = document.createElement( 'span' );
		handle.className = 'page-create-hub__creator-handle';
		handle.textContent = '@OUR_KID';
		info.appendChild( handle );

		panel.appendChild( info );

		// His featured tracks
		const featLabel = document.createElement( 'span' );
		featLabel.className = 'page-create-hub__creator-featured-label kk-ui-meta-label';
		featLabel.textContent = 'HIS FEATURED TRACKS';
		panel.appendChild( featLabel );

		const creatorTracks = document.createElement( 'div' );
		creatorTracks.className = 'page-create-hub__creator-tracks';

		// Two placeholder thumbnails
		for ( let i = 0; i < 2; i ++ ) {

			const thumb = document.createElement( 'div' );
			thumb.className = 'page-create-hub__creator-track-thumb';
			const thumbLabel = document.createElement( 'span' );
			thumbLabel.className = 'page-create-hub__creator-track-thumb-label kk-ui-meta-label';
			thumbLabel.textContent = `TRACK ${i + 1}`;
			thumb.appendChild( thumbLabel );
			creatorTracks.appendChild( thumb );

		}

		panel.appendChild( creatorTracks );
		this._registerSection( 'creatorPanel', panel );
		return panel;

	}

	/**
	 * Build a placeholder panel for non-active top-level tabs.
	 *
	 * @param {string} tabId
	 * @returns {HTMLElement}
	 */
	_buildPlaceholderPanel( tabId ) {

		const labels = {
			tab_kart_customizer: 'KART CUSTOMIZER',
			tab_street_art:      'STREET ART STUDIO',
			tab_community_hub:   'COMMUNITY HUB',
		};

		const el = document.createElement( 'div' );
		el.className = 'page-create-hub__placeholder-panel kk-ui-placeholder kk-ui-fill';

		const icon = document.createElement( 'div' );
		icon.className = 'page-create-hub__placeholder-panel-icon';
		icon.setAttribute( 'aria-hidden', 'true' );
		icon.textContent = '?';
		el.appendChild( icon );

		const text = document.createElement( 'p' );
		text.className = 'page-create-hub__placeholder-panel-text kk-ui-placeholder__title';
		text.textContent = `${labels[ tabId ] ?? tabId} — COMING SOON`;
		el.appendChild( text );

		return el;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the primary CTA on mount
		const newTrackBtn = this._sidebarBtns[ 0 ];
		if ( newTrackBtn ) newTrackBtn.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} My Recent Tracks grid container. */
	get myRecentTracksEl() { return this._myRecentTracksEl; }

	/** @returns {HTMLElement} Featured Tracks grid container. */
	get featuredTracksEl() { return this._featuredTracksEl; }

	/** @returns {HTMLElement} Featured Tracks "SEE ALL" heading button. */
	get featuredHeadingBtn() { return this._featuredHeadingBtn; }

	/**
	 * Populate MY RECENT TRACKS grid with EDIT TRACK cards.
	 *
	 * @param {Array<{ id: string, name: string, creator: string, difficulty: string, rating: number }>} tracks
	 */
	setRecentTracks( tracks ) {

		const grid = this._myRecentTracksEl;
		if ( ! grid ) return;
		grid.innerHTML = '';

		if ( ! tracks || tracks.length === 0 ) {

			grid.appendChild(
				this.buildEmptyState( {
					label:   'No recent tracks',
					heading: 'NO TRACKS YET',
					subtext: 'Create your first track to get started.',
				} )
			);
			return;

		}

		tracks.forEach( ( track ) => {

			const card = this._buildTrackCard( track, 'edit' );
			grid.appendChild( card );

		} );

	}

	/**
	 * Populate FEATURED TRACKS grid with PLAY cards.
	 *
	 * @param {Array<{ id: string, name: string, creator: string, difficulty: string, rating: number, plays: number }>} tracks
	 */
	setFeaturedTracks( tracks ) {

		const grid = this._featuredTracksEl;
		if ( ! grid ) return;
		grid.innerHTML = '';

		if ( ! tracks || tracks.length === 0 ) {

			grid.appendChild(
				this.buildEmptyState( {
					label:   'No featured tracks',
					heading: 'NO FEATURED TRACKS',
				} )
			);
			return;

		}

		tracks.forEach( ( track ) => {

			const card = this._buildTrackCard( track, 'play' );
			grid.appendChild( card );

		} );

	}

	/**
	 * Build a single track card element.
	 *
	 * @param {{ id: string, name: string, creator: string, difficulty: string, rating: number, plays?: number }} track
	 * @param {'edit'|'play'} mode
	 * @returns {HTMLElement}
	 */
	_buildTrackCard( track, mode ) {

		const card = document.createElement( 'article' );
		card.className = 'page-create-hub__track-card';
		card.setAttribute( 'role', 'listitem' );
		card.setAttribute( 'aria-label', `Track: ${track.name}` );

		// Thumbnail
		const thumb = document.createElement( 'div' );
		thumb.className = 'page-create-hub__track-thumb';
		thumb.setAttribute( 'aria-hidden', 'true' );

			const thumbLabel = document.createElement( 'span' );
			thumbLabel.className = 'page-create-hub__track-thumb-label kk-ui-meta-label';
		thumbLabel.textContent = 'USER-MADE TRACKS';
		thumb.appendChild( thumbLabel );

		const thumbBadge = document.createElement( 'span' );
		thumbBadge.className = 'page-create-hub__track-thumb-badge';
		thumbBadge.textContent = track.difficulty.toUpperCase();
		thumb.appendChild( thumbBadge );

		card.appendChild( thumb );

		// Info
		const info = document.createElement( 'div' );
		info.className = 'page-create-hub__track-info';

		const name = document.createElement( 'span' );
		name.className = 'page-create-hub__track-name';
		name.textContent = track.name;
		info.appendChild( name );

		const meta = document.createElement( 'div' );
		meta.className = 'page-create-hub__track-meta';

		const rating = document.createElement( 'span' );
		rating.className = 'page-create-hub__track-rating';
		rating.textContent = `${'★'.repeat( Math.round( track.rating ) )} ${track.rating.toFixed( 1 )}`;
		meta.appendChild( rating );

		if ( track.plays != null ) {

			const plays = document.createElement( 'span' );
			plays.textContent = `${( track.plays / 1000 ).toFixed( 1 )}k plays`;
			meta.appendChild( plays );

		}

		info.appendChild( meta );
		card.appendChild( info );

		// CTA
		const ctaArea = document.createElement( 'div' );
		ctaArea.className = 'page-create-hub__track-cta';

		const ctaBtn = document.createElement( 'button' );
		ctaBtn.type = 'button';
		ctaBtn.className = `kk-cta-button kk-cta-button--${mode === 'edit' ? 'secondary' : 'primary'}`;
		ctaBtn.dataset.action = mode === 'edit' ? ButtonIds.CREATE_EDIT_TRACK : 'create_featured_play';
		ctaBtn.dataset.trackId = track.id;
		ctaBtn.setAttribute( 'aria-label', `${mode === 'edit' ? 'Edit' : 'Play'} ${track.name}` );

		const ctaLabel = document.createElement( 'span' );
		ctaLabel.className = 'kk-cta-button__label';
		ctaLabel.textContent = mode === 'edit' ? 'EDIT TRACK' : 'PLAY';
		ctaBtn.appendChild( ctaLabel );
		ctaArea.appendChild( ctaBtn );
		card.appendChild( ctaArea );

		return card;

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._header?.dispose();
		this._header = null;

		this._topTabs?.dispose();
		this._topTabs = null;

		this._sidebarBtns = [];
		this._myRecentTracksEl = null;
		this._featuredTracksEl = null;
		this._featuredHeadingBtn = null;

		super.dispose();

	}

}

Page16CreateHubView._cssInjected = false;
