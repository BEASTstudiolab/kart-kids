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
				background: rgba(10,10,10,0.92);
				backdrop-filter: blur(12px);
				opacity: 0;
				transition: opacity 0.25s ease;
			}
			.kk-track-select--visible { opacity: 1; }
			.kk-track-select__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: calc(var(--space-4, 1rem) + 3.5rem) var(--space-6, 1.5rem) var(--space-4, 1rem);
				border-bottom: 1px solid rgba(255,255,255,0.08);
			}
			.kk-track-select__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xl, 1.375rem);
				font-weight: 900;
				letter-spacing: 0.1em;
				text-transform: uppercase;
				color: #fff;
			}
			.kk-track-select__back {
				background: none;
				border: none;
				color: rgba(255,255,255,0.68);
				font-weight: 800;
				letter-spacing: 0.1em;
				text-transform: uppercase;
				cursor: pointer;
			}
			.kk-track-select__body {
				flex: 1;
				padding: 16px;
				overflow: hidden;
			}
			.kk-track-select__footer {
				display: flex;
				justify-content: center;
				padding: 16px 24px;
				border-top: 1px solid rgba(255,255,255,0.08);
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
