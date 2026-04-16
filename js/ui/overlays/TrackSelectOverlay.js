import { HudButton } from '../components/HudButton.js';
import { Settings } from '../../Settings.js';
import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';
import { TrackLibraryBrowser } from '../components/TrackLibraryBrowser.js';

export class TrackSelectOverlay {

	static _cssInjected = false;

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._library = new TrackLibraryStore();
		this._api = new PublishedTrackApi();
		this._browser = null;
		this._goBtn = null;
		this._overlay = null;
		this._onConfirm = null;
		this._isReady = false;

		this._injectCSS();

	}

	_injectCSS() {

		if ( TrackSelectOverlay._cssInjected ) return;
		TrackSelectOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-track-select {
				position: fixed;
				inset: 0;
				z-index: 45;
				display: flex;
				flex-direction: column;
				background: rgba(15,17,21,0.9);
				backdrop-filter: blur(14px);
				opacity: 0;
				transition: opacity 0.25s ease;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				box-sizing: border-box;
				color: #f7f3e9;
				text-transform: uppercase;
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
			}
			.kk-track-select--visible { opacity: 1; }
			.kk-track-select__header {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				padding: 0 0 18px;
				border-bottom: 1px solid rgba(247,243,233,0.62);
			}
			.kk-track-select__title {
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				font-size: clamp(2.6rem, 7vw, 5.2rem);
				font-weight: 900;
				letter-spacing: -0.08em;
				text-transform: uppercase;
				line-height: 0.86;
				color: #d82c2c;
			}
			.kk-track-select__back {
				min-height: 2.65rem;
				padding: 0.7rem 1rem;
				border: 1px solid rgba(247,243,233,0.78);
				background: rgba(15,17,21,0.76);
				color: #f7f3e9;
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: var(--text-editorial-label, 0.625rem);
				font-weight: 700;
				letter-spacing: var(--tracking-widest, 0.14em);
				text-transform: uppercase;
				cursor: pointer;
				clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
			}
			.kk-track-select__body {
				flex: 1;
				padding: 18px 0 0;
				overflow: hidden;
			}
			.kk-track-select__footer {
				display: flex;
				justify-content: flex-end;
				padding: 18px 0 0;
				border-top: 1px solid rgba(247,243,233,0.24);
			}

			.kk-track-select .kk-track-library {
				gap: 20px;
			}

			.kk-track-select .kk-track-library__detail {
				padding: 18px;
				border-radius: 0;
				background: #f7f3e9;
				border: 1px solid rgba(15,17,21,0.12);
				box-shadow: 0 26px 48px rgba(0,0,0,0.26);
				clip-path: polygon(0 0, 100% 0, 100% 94%, 95% 100%, 0 100%);
			}

			.kk-track-select .kk-track-library__detail-name,
			.kk-track-select .kk-track-library__card-name {
				color: #0f1115;
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				letter-spacing: -0.04em;
			}

			.kk-track-select .kk-track-library__detail-desc,
			.kk-track-select .kk-track-library__card-meta,
			.kk-track-select .kk-track-library__heading {
				color: rgba(15,17,21,0.72);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				letter-spacing: 0.12em;
			}

			.kk-track-select .kk-track-library__heading {
				padding: 0 8px;
				font-size: 0.62rem;
			}

			.kk-track-select .kk-track-library__detail-minimap,
			.kk-track-select .kk-track-library__card-minimap {
				border-radius: 0;
				border-color: rgba(15,17,21,0.12);
				background: rgba(15,17,21,0.04);
			}

			.kk-track-select .kk-track-library__card {
				min-width: 230px;
				max-width: 230px;
				border-radius: 0;
				padding: 14px;
				background: rgba(247,243,233,0.92);
				border: 1px solid rgba(15,17,21,0.12);
				clip-path: polygon(0 0, 100% 0, 100% 92%, 95% 100%, 0 100%);
			}

			.kk-track-select .kk-track-library__card--selected {
				border-color: #d82c2c;
				box-shadow: 0 0 0 1px rgba(216,44,44,0.22), 0 18px 36px rgba(0,0,0,0.22);
			}

			.kk-track-select .kk-track-library__badge {
				border-radius: 0;
				background: rgba(15,17,21,0.06);
				color: #0f1115;
			}

			.kk-track-select .kk-track-library__badge--selected,
			.kk-track-select .kk-track-library__badge--medium {
				background: rgba(216,44,44,0.14);
				color: #8d1919;
			}

			.kk-track-select .kk-track-library__arrow {
				border-radius: 0;
				border-color: rgba(247,243,233,0.32);
				background: rgba(15,17,21,0.86);
			}

			@media (max-width: 860px) {
				.kk-track-select {
					padding-inline: 16px;
				}

				.kk-track-select .kk-track-library {
					grid-template-columns: 1fr;
				}

				.kk-track-select .kk-track-library__detail {
					position: static;
				}
			}
		`;
		document.head.appendChild( style );

	}

	async show( onConfirm ) {

		this._onConfirm = onConfirm;
		if ( this._overlay ) this._overlay.remove();

		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-track-select';
		overlay.innerHTML = `
			<div class="kk-track-select__header">
				<div class="kk-track-select__title">Select Track</div>
				<button type="button" class="kk-track-select__back">Back</button>
			</div>
			<div class="kk-track-select__body"></div>
			<div class="kk-track-select__footer"></div>
		`;
		overlay.querySelector( '.kk-track-select__back' ).addEventListener( 'click', () => this.hide() );

		const body = overlay.querySelector( '.kk-track-select__body' );
		this._browser = new TrackLibraryBrowser( body, {
			onTrackSelected: ( trackId ) => {

				const settings = new Settings();
				settings.setSelectedTrackId( trackId );

			},
		} );

		this._goBtn = new HudButton( {
			text: 'GO!',
			color: '--color-accent-orange',
			onClick: () => this._handleGo(),
		} );
		this._goBtn.el.disabled = true;
		overlay.querySelector( '.kk-track-select__footer' ).appendChild( this._goBtn.el );

		this._overlay = overlay;
		this._container.appendChild( overlay );

		await this._loadSections();
		this._isReady = true;
		if ( this._goBtn?.el ) this._goBtn.el.disabled = false;

		requestAnimationFrame( () => overlay.classList.add( 'kk-track-select--visible' ) );

	}

	hide() {

		if ( ! this._overlay ) return;
		this._overlay.classList.remove( 'kk-track-select--visible' );

		setTimeout( () => {

			this._isReady = false;
			this._browser?.dispose();
			this._browser = null;
			this._goBtn?.dispose();
			this._goBtn = null;
			if ( this._overlay?.parentNode ) this._overlay.parentNode.removeChild( this._overlay );
			this._overlay = null;
			this._onConfirm = null;

		}, 220 );

	}

	dispose() {

		this.hide();

	}

	async _loadSections() {

		const settings = new Settings();
		const selectedId = settings.getSelectedTrackId();
		const official = this._library.getOfficialTracks();
		const saved = this._library.getSavedTracks()
			.filter( ( track ) => ( track.trackData || ( Array.isArray( track.cells ) && track.cells.length > 0 ) ) )
			.map( ( track ) => ( {
			...track,
			title: track.title || track.name,
			selectable: true,
		} ) );

		let spotlight = [];
		try {

			const response = await this._api.getSpotlightTracks();
			spotlight = ( response.tracks || [] ).map( ( track ) => this._library.mapSpotlightTrack( track ) );

		} catch { /* ignore spotlight fetch failures in picker */ }

		const validIds = new Set( [
			...official.map( ( track ) => track.trackId ),
			...spotlight.map( ( track ) => track.trackId ),
			...saved.map( ( track ) => track.trackId ),
		] );
		const nextSelectedId = validIds.has( selectedId ) ? selectedId : official[ 0 ]?.trackId ?? null;
		if ( nextSelectedId && nextSelectedId !== selectedId ) settings.setSelectedTrackId( nextSelectedId );

		this._browser.setSections( [
			{ id: 'official', label: 'Official', items: official, emptyText: 'No official tracks yet.' },
			{ id: 'spotlight', label: 'Spotlight', items: spotlight, emptyText: 'No spotlight tracks yet.' },
			{ id: 'saved', label: 'My Saved', items: saved, emptyText: 'Save a public track or build one in the editor first.' },
		], nextSelectedId );

	}

	_handleGo() {

		if ( ! this._isReady ) return;

		const callback = this._onConfirm;
		const track = this._browser?.getSelectedTrack() || null;

		if ( this._overlay ) {

			this._overlay.remove();
			this._overlay = null;

		}

		this._browser?.dispose();
		this._browser = null;
		this._goBtn?.dispose();
		this._goBtn = null;
		this._isReady = false;
		this._onConfirm = null;

		if ( callback && track ) callback( track );

	}

}
