import { renderMinimap } from '../components/TrackMinimap.js';
import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';
import { encodeV4ToUrlPayload, v4ToCells } from '../../track-library/TrackRecordMappers.js';

function _getPublicId() {

	const parts = window.location.pathname.split( '/' ).filter( Boolean );
	return parts[ parts.length - 1 ] || '';

}

export class PublishedTrackPage {

	constructor() {

		this._api = new PublishedTrackApi();
		this._library = new TrackLibraryStore();
		this._root = document.getElementById( 'published-track-page' );

	}

	async init() {

		try {

			const track = await this._api.getPublicTrack( _getPublicId() );
			this._renderTrack( track );

		} catch ( err ) {

			this._renderError( err.message || 'Track unavailable.' );

		}

	}

	_renderTrack( track ) {

		const cells = v4ToCells( track.trackData );
		this._root.innerHTML = '';

		const shell = document.createElement( 'main' );
		shell.className = 'kk-public-track';

		const hero = document.createElement( 'section' );
		hero.className = 'kk-public-track__hero';
		hero.innerHTML = `
			<p class="kk-public-track__eyebrow">Shared Track</p>
			<h1 class="kk-public-track__title">${ _escape( track.title ) }</h1>
			<p class="kk-public-track__subtitle">By ${ _escape( track.creatorName ) }</p>
		`;

		const minimap = document.createElement( 'div' );
		minimap.className = 'kk-public-track__minimap';
		minimap.appendChild( renderMinimap( cells, 720, 260 ) );
		hero.appendChild( minimap );

		const actions = document.createElement( 'div' );
		actions.className = 'kk-public-track__actions';

		const playBtn = _button( 'PLAY SOLO', () => {

			window.location.href = `/index.html#track=v4:${ encodeV4ToUrlPayload( track.trackData ) }`;

		} );

		const saveBtn = _button( 'SAVE TO MY SAVED', () => {

			this._library.savePublishedTrack( track );
			saveBtn.textContent = 'SAVED';
			saveBtn.disabled = true;

		} );

		actions.appendChild( playBtn );
		actions.appendChild( saveBtn );
		hero.appendChild( actions );

		const note = document.createElement( 'p' );
		note.className = 'kk-public-track__note';
		note.textContent = 'Save this track to host it in your normal party flow later.';
		hero.appendChild( note );

		shell.appendChild( hero );
		this._root.appendChild( shell );

	}

	_renderError( message ) {

		this._root.innerHTML = `
			<main class="kk-public-track kk-public-track--error">
				<section class="kk-public-track__hero">
					<p class="kk-public-track__eyebrow">Track Unavailable</p>
					<h1 class="kk-public-track__title">This track can't be opened right now.</h1>
					<p class="kk-public-track__subtitle">${ _escape( message ) }</p>
					<div class="kk-public-track__actions">
						<a class="kk-public-track__link" href="/index.html">Back to Kart Kids</a>
					</div>
				</section>
			</main>
		`;

	}

}

function _button( label, onClick ) {

	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = 'kk-public-track__button';
	button.textContent = label;
	button.addEventListener( 'click', onClick );
	return button;

}

function _escape( value ) {

	return String( value ?? '' )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' )
		.replace( /'/g, '&#39;' );

}

new PublishedTrackPage().init();
