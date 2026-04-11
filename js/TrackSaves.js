// ─── Track Saves ─────────────────────────────────────────────────────
// Read/write named track saves in localStorage.
// Shared between the game UI and the track editor.

const SAVES_KEY = 'racing-editor-saved-tracks';

/**
 * Get list of saved tracks.
 * @returns {Array<{ name: string, cells: string, pieces: number, date: string }>}
 */
export function getSavedTracks() {

	try {

		const parsed = JSON.parse( localStorage.getItem( SAVES_KEY ) );
		return Array.isArray( parsed ) ? parsed : [];

	} catch {

		return [];

	}

}

/**
 * Delete a named track save by name.
 * @param {string} name
 */
export function deleteNamedTrack( name ) {

	const tracks = getSavedTracks().filter( t => t.name !== name );

	try {

		localStorage.setItem( SAVES_KEY, JSON.stringify( tracks ) );

	} catch ( e ) {

		console.warn( 'Failed to update saved tracks:', e.message );

	}

}
