import { Settings } from '../../Settings.js';
import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';
import { encodeV4ToUrlPayload, v4ToCells } from '../../track-library/TrackRecordMappers.js';
import { TrackLibraryBrowser } from '../components/TrackLibraryBrowser.js';

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
				width: 100%;
				height: 100%;
				box-sizing: border-box;
				padding: 24px;
				background: rgba(10,10,10,1);
			}
			.kk-tracks__toolbar {
				display: flex;
				flex-wrap: wrap;
				gap: 12px;
				align-items: center;
				justify-content: space-between;
				margin-bottom: 20px;
			}
			.kk-tracks__heading {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			.kk-tracks__heading h1 {
				margin: 0;
				font-family: var(--font-display, sans-serif);
				font-size: clamp(1.6rem, 4vw, 2.6rem);
				text-transform: uppercase;
				letter-spacing: 0.12em;
				color: #fff;
			}
			.kk-tracks__heading p {
				margin: 0;
				color: rgba(255,255,255,0.64);
			}
			.kk-tracks__toolbar-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
			}
			.kk-tracks__toolbar-btn {
				border: 1px solid rgba(255,255,255,0.12);
				background: rgba(255,255,255,0.06);
				color: #fff;
				border-radius: 999px;
				padding: 12px 16px;
				font-weight: 800;
				font-size: 0.78rem;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				cursor: pointer;
				text-decoration: none;
			}
			.kk-tracks__toolbar-btn--primary {
				background: linear-gradient(180deg, #ff9a3d 0%, #ff6b00 100%);
				color: #060606;
			}
			.kk-tracks__browser {
				height: calc(100% - 110px);
			}
			@media (max-width: 720px) {
				.kk-tracks {
					padding: 16px;
				}
				.kk-tracks__browser {
					height: calc(100% - 140px);
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-tracks';
		this._root.innerHTML = `
			<div class="kk-tracks__toolbar">
				<div class="kk-tracks__heading">
					<h1>Tracks</h1>
					<p>Official picks, curated spotlight, your live publishes, and playable saved snapshots.</p>
				</div>
				<div class="kk-tracks__toolbar-actions">
					<a class="kk-tracks__toolbar-btn kk-tracks__toolbar-btn--primary" href="/track-editor.html" target="_blank" rel="noopener">Open Track Editor</a>
					<button type="button" class="kk-tracks__toolbar-btn" data-action="refresh">Refresh Library</button>
				</div>
			</div>
			<div class="kk-tracks__browser"></div>
		`;

		this._browserMount = this._root.querySelector( '.kk-tracks__browser' );
		this._browser = new TrackLibraryBrowser( this._browserMount, {
			onTrackSelected: ( trackId ) => {

				this._settings.setSelectedTrackId( trackId );

			},
		} );

		this._root.querySelector( '[data-action="refresh"]' ).addEventListener( 'click', () => this.refresh() );

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
		];

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
