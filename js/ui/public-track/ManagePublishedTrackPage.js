import { PublishedTrackApi } from '../../track-library/PublishedTrackApi.js';
import { TrackLibraryStore } from '../../track-library/TrackLibraryStore.js';

function _getManageToken() {

	const parts = window.location.pathname.split( '/' ).filter( Boolean );
	return parts[ parts.length - 1 ] || '';

}

export class ManagePublishedTrackPage {

	constructor() {

		this._api = new PublishedTrackApi();
		this._library = new TrackLibraryStore();
		this._root = document.getElementById( 'manage-track-page' );
		this._token = _getManageToken();

	}

	async init() {

		try {

			const track = await this._api.getManagedTrack( this._token );
			this._renderTrack( track );

		} catch ( err ) {

			this._renderError( err.message || 'Manage link unavailable.' );

		}

	}

	_renderTrack( track ) {

		this._root.innerHTML = `
			<main class="kk-public-track">
				<section class="kk-public-track__hero">
					<p class="kk-public-track__eyebrow">Manage Published Track</p>
					<h1 class="kk-public-track__title">${ _escape( track.title ) }</h1>
					<p class="kk-public-track__subtitle">By ${ _escape( track.creatorName ) } · Status: ${ _escape( track.status ) }</p>
					<div class="kk-public-track__actions" data-role="actions"></div>
					<p class="kk-public-track__note">Import this manage link on any device to add the track to My Published there, then open the editor to update the same live URL.</p>
				</section>
			</main>
		`;

		const actions = this._root.querySelector( '[data-role="actions"]' );
		const importBtn = _button( 'IMPORT TO MY PUBLISHED', () => {

			this._library.saveOwnedPublishedTrack( track, this._token );
			importBtn.textContent = 'IMPORTED';
			importBtn.disabled = true;

		} );

		const editorLink = document.createElement( 'a' );
		editorLink.className = 'kk-public-track__button kk-public-track__button--link';
		editorLink.href = `/track-editor.html?manage=${ encodeURIComponent( this._token ) }`;
		editorLink.textContent = 'OPEN IN EDITOR';

		const publicLink = document.createElement( 'a' );
		publicLink.className = 'kk-public-track__button kk-public-track__button--link';
		publicLink.href = track.publicUrl;
		publicLink.textContent = 'OPEN PUBLIC PAGE';

		const unpublishBtn = _button( 'UNPUBLISH', async () => {

			unpublishBtn.disabled = true;
			try {

				await this._api.unpublishManagedTrack( this._token );
				unpublishBtn.textContent = 'UNPUBLISHED';

			} catch ( err ) {

				unpublishBtn.disabled = false;
				alert( err.message || 'Unable to unpublish track.' );

			}

		} );

		actions.appendChild( importBtn );
		actions.appendChild( editorLink );
		actions.appendChild( publicLink );
		actions.appendChild( unpublishBtn );

	}

	_renderError( message ) {

		this._root.innerHTML = `
			<main class="kk-public-track kk-public-track--error">
				<section class="kk-public-track__hero">
					<p class="kk-public-track__eyebrow">Manage Link Unavailable</p>
					<h1 class="kk-public-track__title">This manage link doesn't work right now.</h1>
					<p class="kk-public-track__subtitle">${ _escape( message ) }</p>
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

new ManagePublishedTrackPage().init();
