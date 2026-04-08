// ─── ShareLinkService ────────────────────────────────────────────────────────
// Generates shareable URLs for tracks using v3 encoding (game-compatible)
// and v4 encoding (full project data).

import { encodeCells } from '../../TrackCodec.js';

export class ShareLinkService {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 */
	constructor( project ) {

		this._project = project;

	}

	/**
	 * Generate a play link (opens game with this track).
	 * Uses v3 encoding for backward compatibility.
	 * @returns {string}
	 */
	generatePlayUrl() {

		const cells = this._project.getCellsArray();
		const encoded = encodeCells( cells );
		return `${window.location.origin}/index.html#map=${encoded}`;

	}

	/**
	 * Generate an editor link (opens editor with this track).
	 * Uses v4 JSON encoding.
	 * @returns {string}
	 */
	generateEditorUrl() {

		const v4 = this._project.toV4JSON();
		const json = JSON.stringify( v4 );

		// Simple approach: base64url encode the JSON
		const encoded = btoa( unescape( encodeURIComponent( json ) ) )
			.replace( /\+/g, '-' )
			.replace( /\//g, '_' )
			.replace( /=+$/, '' );

		return `${window.location.origin}/track-editor.html#track=v4:${encoded}`;

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
