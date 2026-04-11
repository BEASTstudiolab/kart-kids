// ─── ShareLinkService ────────────────────────────────────────────────────────
// Generates shareable URLs for tracks using v4 JSON encoding.

export class ShareLinkService {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 */
	constructor( project ) {

		this._project = project;

	}

	/** @private Base64url-encode a v4 JSON payload. */
	_encodeV4() {

		const v4 = this._project.toV4JSON();
		const json = JSON.stringify( v4 );
		const bytes = new TextEncoder().encode( json );
		let binary = '';
		for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );
		return btoa( binary )
			.replace( /\+/g, '-' )
			.replace( /\//g, '_' )
			.replace( /=+$/, '' );

	}

	/**
	 * Generate a play link (opens game with this track).
	 * @returns {string}
	 */
	generatePlayUrl() {

		return `${ window.location.origin }/index.html#track=v4:${ this._encodeV4() }`;

	}

	/**
	 * Generate an editor link (opens editor with this track).
	 * @returns {string}
	 */
	generateEditorUrl() {

		return `${ window.location.origin }/track-editor.html#track=v4:${ this._encodeV4() }`;

	}

	/**
	 * Copy a URL to the clipboard.
	 * @param {string} url
	 * @returns {Promise<boolean>}
	 */
	async copyToClipboard( url ) {

		try {

			await navigator.clipboard.writeText( url );
			return true;

		} catch {

			return false;

		}

	}

}
