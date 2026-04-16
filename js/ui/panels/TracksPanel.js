import { Settings } from '../../Settings.js';
import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';
import { encodeV4ToUrlPayload, v4ToCells } from '../../track-library/TrackRecordMappers.js';
import { MarginalPanelCard } from '../components/MarginalPanelCard.js';
import { MarginalPanelHeader } from '../components/MarginalPanelHeader.js';
import { TrackLibraryBrowser } from '../components/TrackLibraryBrowser.js';
import { renderMinimap } from '../components/TrackMinimap.js';

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
		this._sections = [];

		this._selectionValueEl = null;
		this._selectionMetaEls = [];
		this._selectionCopyEl = null;
		this._selectionBadgeWrapEl = null;
		this._selectionMapEl = null;
		this._selectionLaunchBtn = null;
		this._utilityLaunchBtn = null;
		this._editorLabelEl = null;
		this._editorValueEl = null;
		this._editorCopyEl = null;
		this._editorStickerEl = null;
		this._refreshBtn = null;
		this._editorMetaEls = [];

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
				background-color: unset;
				background-image: none;
			}

			.kk-tracks,
			.kk-tracks * {
				cursor: crosshair;
			}

			.kk-tracks__scanlines,
			.kk-tracks__vignette {
				display: none;
				position: absolute;
				inset: 0;
				pointer-events: none;
			}

			.kk-tracks__scanlines {
				z-index: 1;
				opacity: 0.24;
				background:
					linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
					linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
				background-size: 100% 3px, 3px 100%;
			}

			.kk-tracks__vignette {
				z-index: 2;
				box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.62);
			}

			.kk-tracks__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(280px, var(--kk-customizer-deck-width, 20rem));
				grid-template-rows: auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 20px;
			}

			.kk-tracks__header {
				grid-column: 1 / span 2;
			}

			.kk-tracks__header.kk-mv-header {
				padding-top: 57px;
			}

			.kk-tracks .kk-mv-header {
				padding-top: calc(var(--kk-shell-top-clearance, clamp(3.5rem, 6vw, 4.25rem)) - 0.35rem);
				padding-bottom: 12px;
			}

			.kk-tracks .kk-mv-header__title {
				font-size: var(--text-editorial-panel-title, clamp(2.35rem, 4.2vw, 3.4rem));
			}

			.kk-tracks .kk-mv-header__subtitle {
				margin-top: 6px;
				font-size: var(--text-editorial-label, 0.625rem);
			}

			.kk-tracks__tool-row {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}

			.kk-tracks__tool-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 10px 16px;
				border: 1px solid rgba(247, 243, 233, 0.82);
				background: transparent;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 10px;
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				text-decoration: none;
				transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
			}

			.kk-tracks__tool-btn:hover {
				background: rgba(247, 243, 233, 0.12);
				transform: translateY(-1px);
			}

			.kk-tracks__browser-shell {
				min-height: 0;
				padding-bottom: 12px;
			}

			.kk-tracks__browser {
				height: 100%;
				min-height: 0;
			}

			.kk-tracks .kk-track-library {
				height: 100%;
				grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
			}

			.kk-tracks .kk-track-library__detail {
				background: var(--mv-cream);
				color: var(--mv-dark);
				border: none;
				border-radius: 0;
				clip-path: polygon(0 0, 100% 0, 100% 94%, 95% 100%, 0 100%);
				padding: 18px;
				box-shadow: 0 24px 44px rgba(0, 0, 0, 0.24);
			}

			.kk-tracks .kk-track-library__detail-name,
			.kk-tracks .kk-track-library__card-name {
				color: inherit;
				font-family: var(--mv-font-display);
				letter-spacing: -0.03em;
			}

			.kk-tracks .kk-track-library__detail-meta,
			.kk-tracks .kk-track-library__detail-desc,
			.kk-tracks .kk-track-library__card-meta,
			.kk-tracks .kk-track-library__heading,
			.kk-tracks .kk-track-library__empty {
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
			}

			.kk-tracks .kk-track-library__detail-desc {
				color: rgba(15, 17, 21, 0.74);
				font-size: 0.8rem;
			}

			.kk-tracks .kk-track-library__detail-actions {
				gap: 8px;
			}

			.kk-tracks .kk-track-library__action {
				border-radius: 0;
				border: 1px solid rgba(15, 17, 21, 0.14);
				background: transparent;
				color: var(--mv-dark);
				font-family: var(--mv-font-mono);
				font-size: 0.7rem;
				letter-spacing: 0.14em;
			}

			.kk-tracks .kk-track-library__action--primary {
				background: var(--mv-dark);
				color: var(--mv-cream);
				border-color: var(--mv-dark);
			}

			.kk-tracks .kk-track-library__content {
				padding-right: 0;
				padding-bottom: calc(var(--kk-shell-nav-clearance, 6.75rem) + 32px);
			}

			.kk-tracks .kk-track-library__heading {
				padding: 0;
				font-size: 0.76rem;
				letter-spacing: 0.22em;
				color: rgba(247, 243, 233, 0.68);
			}

			.kk-tracks .kk-track-library__carousel {
				padding: 10px 0 calc(var(--kk-shell-nav-clearance, 6.75rem) + 8px);
				gap: 12px;
			}

			.kk-tracks .kk-track-library__arrow {
				border-radius: 0;
				border: 1px solid rgba(247, 243, 233, 0.2);
				background: rgba(15, 17, 21, 0.86);
				width: 38px;
				height: 38px;
			}

			.kk-tracks .kk-track-library__card {
				min-width: 220px;
				max-width: 220px;
				border-radius: 0;
				border: 1px solid rgba(247, 243, 233, 0.2);
				background: rgba(15, 17, 21, 0.86);
				clip-path: polygon(0 0, 100% 0, 100% 92%, 94% 100%, 0 100%);
			}

			.kk-tracks .kk-track-library__card--selected {
				border-color: var(--mv-red);
				box-shadow: 0 0 0 1px rgba(216, 44, 44, 0.48), 0 18px 30px rgba(216, 44, 44, 0.12);
			}

			.kk-tracks .kk-track-library__card-name,
			.kk-tracks .kk-track-library__card-meta {
				color: var(--mv-cream);
			}

			.kk-tracks .kk-track-library__card-minimap,
			.kk-tracks .kk-track-library__detail-minimap {
				border-radius: 0;
				border-color: rgba(15, 17, 21, 0.08);
				background: transparent;
				--track-minimap-track: var(--mv-cream);
			}

			.kk-tracks .kk-track-library__badge {
				border-radius: 0;
				font-family: var(--mv-font-mono);
			}

			.kk-tracks .kk-track-library__empty {
				margin: 0;
				border-radius: 0;
				background: rgba(247, 243, 233, 0.04);
				border: 1px dashed rgba(247, 243, 233, 0.16);
				color: rgba(247, 243, 233, 0.62);
				font-size: 0.72rem;
				letter-spacing: 0.14em;
			}

			.kk-tracks__stage {
				grid-column: 1 / span 2;
				grid-row: 2;
				min-height: 0;
			}

			.kk-tracks__deck {
				grid-column: 2;
				grid-row: 2;
				align-self: end;
				display: flex;
				flex-direction: column;
				gap: 20px;
				padding-bottom: 24px;
				z-index: 4;
			}

			.kk-tracks__selection-card .kk-mv-card__body,
			.kk-tracks__utility-card .kk-mv-card__body {
				gap: 7px;
			}

			.kk-tracks__selection-card {
				padding: 12px;
			}

			.kk-tracks__utility-card {
				padding: 12px 13px;
			}

			.kk-tracks__selection-card .kk-tracks__copy {
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
				overflow: hidden;
			}

			.kk-tracks__badge-row {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}

			.kk-tracks__badge {
				display: inline-flex;
				align-items: center;
				padding: 6px 10px;
				background: rgba(15, 17, 21, 0.06);
				color: var(--mv-dark);
				font-size: 10px;
				font-weight: 700;
				letter-spacing: 0.16em;
			}

			.kk-tracks__badge--difficulty-easy {
				background: rgba(34, 197, 94, 0.14);
				color: #1d7a40;
			}

			.kk-tracks__badge--difficulty-medium {
				background: rgba(249, 115, 22, 0.16);
				color: #a64f15;
			}

			.kk-tracks__badge--difficulty-hard {
				background: rgba(220, 38, 38, 0.16);
				color: #991b1b;
			}

			.kk-tracks__badge--selected {
				background: rgba(15, 17, 21, 0.92);
				color: var(--mv-cream);
			}

			.kk-tracks__map {
				min-height: 56px;
				padding: 4px;
				border: 1px solid rgba(15, 17, 21, 0.08);
				background: transparent;
				--track-minimap-track: var(--mv-red);
				overflow: hidden;
			}

			.kk-tracks__map canvas,
			.kk-tracks__map svg {
				display: block;
				width: 100%;
				height: auto;
			}

			.kk-tracks__action-row {
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
			}

			.kk-tracks__action-row--compact {
				flex-wrap: nowrap;
				gap: 6px;
			}

			.kk-tracks__action-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 42px;
				padding: 10px 16px;
				border: 1px solid rgba(15, 17, 21, 0.14);
				background: transparent;
				color: var(--mv-dark);
				font-family: var(--mv-font-mono);
				font-size: 10px;
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				cursor: pointer;
			}

			.kk-tracks__action-row--compact .kk-tracks__action-btn,
			.kk-tracks__action-row--compact .kk-tracks__tool-btn {
				flex: 1 1 0;
				min-height: 34px;
				padding: 8px 10px;
				font-size: 9px;
			}

			.kk-tracks__action-row--compact .kk-tracks__tool-btn {
				border-color: rgba(15, 17, 21, 0.16);
				color: var(--mv-dark);
				background: transparent;
			}

			.kk-tracks__action-row--compact .kk-tracks__tool-btn:hover {
				background: rgba(15, 17, 21, 0.08);
			}

			.kk-tracks__action-btn--primary {
				background: var(--mv-dark);
				color: var(--mv-cream);
				border-color: var(--mv-dark);
			}

			.kk-tracks__action-btn:disabled {
				opacity: 0.45;
				cursor: default;
			}

			.kk-tracks__editor-meta {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
				font-size: 9px;
			}

			.kk-tracks__editor-meta-item {
				border-left: 2px solid rgba(247, 243, 233, 0.7);
				padding-left: 6px;
			}

			.kk-tracks__browser-shell {
				min-height: 0;
				padding-bottom: 0;
				padding-top: 4px;
			}

			.kk-tracks .kk-track-library {
				height: 100%;
				grid-template-columns: 1fr;
			}

			.kk-tracks .kk-track-library__detail {
				display: none;
			}

			.kk-tracks .kk-track-library__content {
				height: 100%;
				gap: 18px;
				padding-bottom: calc(var(--kk-shell-nav-clearance, 6.75rem) + 18px);
			}

			.kk-tracks .kk-track-library__carousel {
				padding: 6px 0 8px;
				gap: 14px;
			}

			.kk-tracks .kk-track-library__card {
				min-width: 232px;
				max-width: 232px;
				padding: 15px;
			}

			/* ===================================================
			   Shared customizer shell alignment
			   =================================================== */

			.kk-tracks__stage {
				position: relative;
				min-height: 0;
				pointer-events: none;
			}

			.kk-tracks__stage > * {
				pointer-events: auto;
			}

			.kk-tracks__builder {
				position: absolute;
				top: 0;
				left: 0;
				width: min(var(--kk-tracks-builder-width, clamp(22rem, 34vw, 28rem)), calc(100vw - 3rem));
				max-height: min(35rem, calc(100% - 1rem));
				padding: 0.9rem;
				display: flex;
				flex-direction: column;
				gap: 0.72rem;
				background: var(--mv-cream);
				color: var(--mv-dark);
				border: none;
				border-radius: 0;
				clip-path: polygon(0 0, 100% 0, 100% 95%, 95% 100%, 0 100%);
				box-shadow: 0 24px 46px rgba(0, 0, 0, 0.28);
				overflow: hidden;
				z-index: 4;
			}

			.kk-tracks__builder-eyebrow {
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-eyebrow, var(--text-editorial-label, 0.625rem));
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				color: var(--mv-red);
			}

			.kk-tracks__builder-title {
				font-family: var(--mv-font-display);
				font-size: var(--text-customizer-title, var(--text-editorial-panel-title, clamp(2.35rem, 4.2vw, 3.4rem)));
				font-weight: 900;
				line-height: 0.92;
				letter-spacing: -0.04em;
				text-transform: uppercase;
				color: var(--mv-dark);
			}

			.kk-tracks__builder-copy {
				margin: 0;
				font-family: var(--mv-font-mono);
				font-size: var(--text-customizer-copy, 0.78rem);
				line-height: var(--leading-relaxed, 1.6);
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: rgba(15, 17, 21, 0.78);
			}

			.kk-tracks__browser-shell {
				flex: 1 1 auto;
				min-height: 16rem;
				padding: 0;
				padding-top: 0.1rem;
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
			}

			.kk-tracks .kk-track-library__content {
				height: 100%;
				gap: 0.95rem;
				padding-right: 0.2rem;
				padding-bottom: 0.2rem;
			}

			.kk-tracks .kk-track-library__section {
				gap: 0.5rem;
			}

			.kk-tracks .kk-track-library__heading {
				padding: 0;
				font-size: var(--text-customizer-eyebrow, var(--text-editorial-label, 0.625rem));
				font-weight: 700;
				letter-spacing: 0.18em;
				color: rgba(15, 17, 21, 0.56);
			}

			.kk-tracks .kk-track-library__carousel {
				padding: 0.4rem 0.1rem 0.3rem;
				gap: 0.75rem;
			}

			.kk-tracks .kk-track-library__arrow {
				width: 2.1rem;
				height: 3rem;
				border: 1px solid rgba(15, 17, 21, 0.16);
				background: rgba(15, 17, 21, 0.92);
				color: var(--mv-cream);
				clip-path: polygon(0 0, 100% 0, 100% 88%, 94% 100%, 0 100%);
			}

			.kk-tracks .kk-track-library__card {
				min-width: 11rem;
				max-width: 11rem;
				padding: 0.75rem;
				border: 1px solid rgba(15, 17, 21, 0.14);
				background: rgba(15, 17, 21, 0.96);
				box-shadow: none;
			}

			.kk-tracks .kk-track-library__card-name {
				font-size: 0.96rem;
				line-height: 1.02;
			}

			.kk-tracks .kk-track-library__card-meta {
				font-size: var(--text-editorial-copy, 0.625rem);
				letter-spacing: 0.12em;
			}

			.kk-tracks .kk-track-library__card-minimap,
			.kk-tracks .kk-track-library__detail-minimap {
				border-color: rgba(247, 243, 233, 0.08);
				background: transparent;
				--track-minimap-track: var(--mv-cream);
			}

			.kk-tracks .kk-track-library__empty {
				margin: 0;
				border: 1px dashed rgba(15, 17, 21, 0.16);
				background: rgba(15, 17, 21, 0.04);
				color: rgba(15, 17, 21, 0.56);
				letter-spacing: 0.12em;
			}

			.kk-tracks__deck {
				align-self: start;
				gap: 20px;
				padding-bottom: 0;
				z-index: 4;
			}

			.kk-tracks__selection-card,
			.kk-tracks__utility-card {
				padding: 0.9rem;
			}

			.kk-tracks__selection-card .kk-mv-value,
			.kk-tracks__utility-card .kk-mv-value {
				font-size: clamp(2rem, 4vw, 3rem);
			}

			.kk-tracks__selection-card .kk-mv-data-grid {
				gap: 8px;
			}

			.kk-tracks__selection-card .kk-mv-data-item {
				border-left-width: 2px;
			}

			@media (max-width: 980px) {
				.kk-tracks {
					overflow-y: auto;
				}

				.kk-tracks__interface {
					grid-template-columns: 1fr;
					grid-template-rows: auto auto auto;
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 16px;
				}

				.kk-tracks__header,
				.kk-tracks__stage,
				.kk-tracks__deck {
					grid-column: auto;
					grid-row: auto;
				}

				.kk-tracks__deck {
					padding-bottom: 8px;
				}

				.kk-tracks__stage {
					position: static;
				}

				.kk-tracks__builder {
					position: relative;
					top: auto;
					left: auto;
					width: auto;
					max-height: none;
				}

				.kk-tracks__browser-shell {
					min-height: 18rem;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-tracks';

		const scanlines = document.createElement( 'div' );
		scanlines.className = 'kk-tracks__scanlines';
		this._root.appendChild( scanlines );

		const vignette = document.createElement( 'div' );
		vignette.className = 'kk-tracks__vignette';
		this._root.appendChild( vignette );

		const frame = document.createElement( 'div' );
		frame.className = 'kk-tracks__interface';
		this._root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Tracks',
			subtitle: 'Route Index // Official, Spotlight, Saved',
			badge: '',
			className: 'kk-tracks__header',
		} ).el );

		const stage = document.createElement( 'div' );
		stage.className = 'kk-tracks__stage';
		frame.appendChild( stage );

		const builder = document.createElement( 'section' );
		builder.className = 'kk-tracks__builder';
		builder.setAttribute( 'aria-label', 'Route customizer' );
		stage.appendChild( builder );

		const builderEyebrow = document.createElement( 'div' );
		builderEyebrow.className = 'kk-tracks__builder-eyebrow';
		builderEyebrow.textContent = 'Customizer';
		builder.appendChild( builderEyebrow );

		const builderTitle = document.createElement( 'div' );
		builderTitle.className = 'kk-tracks__builder-title';
		builderTitle.textContent = 'Route Library';
		builder.appendChild( builderTitle );

		const builderCopy = document.createElement( 'p' );
		builderCopy.className = 'kk-tracks__builder-copy';
		builderCopy.textContent = 'Browse official, spotlight, and saved routes here. The live inspector on the right handles launch and route operations.';
		builder.appendChild( builderCopy );

		const browserShell = document.createElement( 'div' );
		browserShell.className = 'kk-tracks__browser-shell';
		browserShell.innerHTML = '<div class="kk-tracks__browser"></div>';
		builder.appendChild( browserShell );

		const deck = document.createElement( 'aside' );
		deck.className = 'kk-tracks__deck';
		deck.appendChild( this._buildSelectionCard() );
		deck.appendChild( this._buildEditorCard() );
		frame.appendChild( deck );

		this._browserMount = browserShell.querySelector( '.kk-tracks__browser' );
		this._browser = new TrackLibraryBrowser( this._browserMount, {
			onTrackSelected: ( trackId ) => {

				this._settings.setSelectedTrackId( trackId );
				this._updateSelectionCard( this._findTrackById( trackId ) );

			},
		} );

	}

	_buildSelectionCard() {

		const card = new MarginalPanelCard( {
			headerLeft: 'Selected Route',
			headerRight: 'Live',
		} );
		card.el.classList.add( 'kk-tracks__selection-card' );

		const label = document.createElement( 'div' );
		label.className = 'kk-mv-label';
		label.textContent = 'Library Focus';
		card.bodyEl.appendChild( label );

		const value = document.createElement( 'div' );
		value.className = 'kk-mv-value';
		card.bodyEl.appendChild( value );
		this._selectionValueEl = value;

		const badges = document.createElement( 'div' );
		badges.className = 'kk-tracks__badge-row';
		card.bodyEl.appendChild( badges );
		this._selectionBadgeWrapEl = badges;

		const copy = document.createElement( 'p' );
		copy.className = 'kk-mv-copy kk-tracks__copy';
		card.bodyEl.appendChild( copy );
		this._selectionCopyEl = copy;

		const metaGrid = document.createElement( 'div' );
		metaGrid.className = 'kk-mv-data-grid';
		card.bodyEl.appendChild( metaGrid );

		for ( let i = 0; i < 4; i ++ ) {

			const item = document.createElement( 'div' );
			item.className = 'kk-mv-data-item';
			metaGrid.appendChild( item );
			this._selectionMetaEls.push( item );

		}

		const map = document.createElement( 'div' );
		map.className = 'kk-tracks__map';
		card.bodyEl.appendChild( map );
		this._selectionMapEl = map;

		const actions = document.createElement( 'div' );
		actions.className = 'kk-tracks__action-row kk-tracks__action-row--compact';

		const launchBtn = document.createElement( 'button' );
		launchBtn.type = 'button';
		launchBtn.className = 'kk-tracks__action-btn kk-tracks__action-btn--primary';
		launchBtn.textContent = 'Launch';
		launchBtn.addEventListener( 'click', () => {

			this._services.startRace?.( { mode: 'solo' } );

		} );
		actions.appendChild( launchBtn );
		this._selectionLaunchBtn = launchBtn;

		card.bodyEl.appendChild( actions );

		return card.el;

	}

	_buildEditorCard() {

		const card = new MarginalPanelCard( {
			variant: 'red',
			headerLeft: 'Route Control',
			headerRight: '[TOOLS]',
			sticker: 'Build + Launch',
		} );
		card.el.classList.add( 'kk-tracks__utility-card' );

		this._editorStickerEl = card.el.querySelector( '.kk-mv-card__sticker' );

		const label = document.createElement( 'div' );
		label.className = 'kk-mv-label';
		card.bodyEl.appendChild( label );
		this._editorLabelEl = label;

		const value = document.createElement( 'div' );
		value.className = 'kk-mv-value';
		card.bodyEl.appendChild( value );
		this._editorValueEl = value;

		const copy = document.createElement( 'p' );
		copy.className = 'kk-mv-copy kk-tracks__copy';
		card.bodyEl.appendChild( copy );
		this._editorCopyEl = copy;

		const actions = document.createElement( 'div' );
		actions.className = 'kk-tracks__action-row';

		const launchBtn = document.createElement( 'button' );
		launchBtn.type = 'button';
		launchBtn.className = 'kk-tracks__action-btn kk-tracks__action-btn--primary';
		launchBtn.textContent = 'Launch Solo';
		launchBtn.addEventListener( 'click', () => {

			this._services.startRace?.( { mode: 'solo' } );

		} );
		actions.appendChild( launchBtn );
		this._utilityLaunchBtn = launchBtn;

		const metaGrid = document.createElement( 'div' );
		metaGrid.className = 'kk-tracks__editor-meta';
		for ( let i = 0; i < 4; i ++ ) {

			const item = document.createElement( 'div' );
			item.className = 'kk-tracks__editor-meta-item';
			metaGrid.appendChild( item );
			this._editorMetaEls.push( item );

		}

		const editorLink = document.createElement( 'a' );
		editorLink.className = 'kk-tracks__tool-btn';
		editorLink.href = '/track-editor.html';
		editorLink.target = '_blank';
		editorLink.rel = 'noopener';
		editorLink.textContent = 'Open Editor';

		const refreshBtn = document.createElement( 'button' );
		refreshBtn.type = 'button';
		refreshBtn.className = 'kk-tracks__tool-btn';
		refreshBtn.textContent = 'Refresh';
		refreshBtn.addEventListener( 'click', () => this.refresh() );
		this._refreshBtn = refreshBtn;

		actions.appendChild( editorLink );
		actions.appendChild( refreshBtn );
		card.bodyEl.appendChild( actions );
		card.bodyEl.appendChild( metaGrid );

		return card.el;

	}

	async refresh() {

		this._settings = new Settings();
		const selectedId = this._settings.getSelectedTrackId();
		const officialTracks = this._library.getOfficialTracks();
		const spotlightTracks = await this._loadSpotlightTracks();
		const myPublished = await this._loadPublishedTracks();
		const mySaved = this._loadSavedTracks();

		const sections = [
			{ id: 'official', label: 'Official', items: officialTracks, emptyText: 'No official tracks yet.' },
			{ id: 'spotlight', label: 'Spotlight', items: spotlightTracks, emptyText: 'Spotlight is empty for now.' },
			{ id: 'published', label: 'My Published', items: myPublished, emptyText: 'Publish a track to manage it here.' },
			{ id: 'saved', label: 'My Saved', items: mySaved, emptyText: 'Save a public track or create one in the editor.' },
		].filter( ( section, index ) => section.items.length > 0 || index === 0 );
		this._sections = sections;

		const validIds = new Set( [
			...officialTracks.map( ( t ) => t.trackId ),
			...spotlightTracks.map( ( t ) => t.trackId ),
			...mySaved.map( ( t ) => t.trackId ),
		] );
		const nextSelectedId = validIds.has( selectedId ) ? selectedId : officialTracks[ 0 ]?.trackId ?? null;
		if ( nextSelectedId && nextSelectedId !== selectedId ) {

			this._settings.setSelectedTrackId( nextSelectedId );

		}

		this._browser.setSections( sections, nextSelectedId );
		this._updateSelectionCard( this._findTrackById( nextSelectedId ) );
		this._updateEditorCard( {
			totalTracks: officialTracks.length + spotlightTracks.length + mySaved.length,
			publishedCount: myPublished.length,
			officialCount: officialTracks.length,
			spotlightCount: spotlightTracks.length,
			savedCount: mySaved.length,
		} );

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

		const tracks = await Promise.all( ownerships.map( async ( ownership ) => {

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

		return tracks;

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

		if ( ! track ) return;
		if ( this._selectionValueEl ) this._selectionValueEl.textContent = track.title || track.name || 'Route';
		if ( this._selectionCopyEl ) this._selectionCopyEl.textContent = _describeTrackBrief( track );

		const lines = [
			`Diff: ${ _formatChip( track.difficulty, 'Easy' ) }`,
			`Source: ${ _formatChip( track.source, 'Official' ) }`,
			`Maker: ${ _formatChip( track.creatorName, 'Studio' ) }`,
			`Tiles: ${ Array.isArray( track.cells ) ? track.cells.length : 0 }`,
		];
		this._selectionMetaEls.forEach( ( el, index ) => {

			el.textContent = lines[ index ] || '';

		} );

		if ( this._selectionBadgeWrapEl ) {

			this._selectionBadgeWrapEl.innerHTML = '';

			const difficultyBadge = document.createElement( 'span' );
			difficultyBadge.className = `kk-tracks__badge kk-tracks__badge--difficulty-${ String( track.difficulty || 'easy' ).toLowerCase() }`;
			difficultyBadge.textContent = _formatChip( track.difficulty, 'Easy' );
			this._selectionBadgeWrapEl.appendChild( difficultyBadge );

			const selectedBadge = document.createElement( 'span' );
			selectedBadge.className = 'kk-tracks__badge kk-tracks__badge--selected';
			selectedBadge.textContent = 'Selected';
			this._selectionBadgeWrapEl.appendChild( selectedBadge );

			const sourceBadge = document.createElement( 'span' );
			sourceBadge.className = 'kk-tracks__badge';
			sourceBadge.textContent = _formatChip( track.source, 'Official' );
			this._selectionBadgeWrapEl.appendChild( sourceBadge );

		}

		if ( this._selectionMapEl ) {

			this._selectionMapEl.innerHTML = '';
			if ( Array.isArray( track.cells ) && track.cells.length > 0 ) {

				this._selectionMapEl.appendChild( renderMinimap( track.cells, 540, 120 ) );

			}

		}

		if ( this._selectionLaunchBtn ) this._selectionLaunchBtn.disabled = ! track.trackId;
		if ( this._utilityLaunchBtn ) this._utilityLaunchBtn.disabled = ! track.trackId;

	}

	_updateEditorCard( meta ) {

		if ( this._editorLabelEl ) this._editorLabelEl.textContent = 'Library Ops';
		if ( this._editorValueEl ) this._editorValueEl.textContent = 'Toolkit';
		if ( this._editorCopyEl ) {

			this._editorCopyEl.textContent = `Open the editor or refresh the live route feed. ${ meta.publishedCount || 0 } managed route${ meta.publishedCount === 1 ? '' : 's' } are ready to tune.`;

		}
		if ( this._editorStickerEl ) this._editorStickerEl.textContent = `Routes: ${ meta.totalTracks || 0 }`;
		const lines = [
			`Official: ${ meta.officialCount || 0 }`,
			`Spotlight: ${ meta.spotlightCount || 0 }`,
			`Saved: ${ meta.savedCount || 0 }`,
			`Published: ${ meta.publishedCount || 0 }`,
		];
		this._editorMetaEls.forEach( ( el, index ) => {

			el.textContent = lines[ index ] || '';

		} );

	}

	_findTrackById( trackId ) {

		if ( ! trackId ) return null;
		return this._sections
			.flatMap( ( section ) => section.items || [] )
			.find( ( item ) => item.trackId === trackId ) || null;

	}

	async _copyText( value, message ) {

		try {

			await navigator.clipboard.writeText( value );
			this._services.notification?.show( {
				message,
				variant: 'success',
				duration: 2000,
			} );

		} catch {

			this._services.notification?.show( {
				message: value,
				variant: 'info',
				duration: 3500,
			} );

		}

	}

	show() {

		this.refresh();

	}

	hide() {}

	dispose() {

		this._browser?.dispose();
		if ( this._root?.parentNode ) this._root.parentNode.removeChild( this._root );
		this._root = null;

	}

}

TracksPanel._cssInjected = false;
