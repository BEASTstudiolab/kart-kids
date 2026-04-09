/**
 * Central registry of all playable tracks.
 * Each entry contains the static cell data needed to build the track.
 * To add a new track: add an entry to TRACKS with its cell array.
 */

import { TRACK_CELLS, DECO_CELLS } from './TrackData.js';

/**
 * @typedef {Object} Track
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} difficulty - 'easy' | 'medium' | 'hard'
 * @property {Array} cells - Cell data in [ gx, gz, tileKey, orient, flags? ] format
 * @property {Array} [decoCells] - Optional decoration cell data
 */

const TRACKS = Object.freeze( [
	Object.freeze( {
		id: 'starter-circuit',
		name: 'Starter Circuit',
		difficulty: 'easy',
		cells: TRACK_CELLS,
		decoCells: DECO_CELLS,
	} ),
] );

/**
 * Return the full list of available tracks.
 * @returns {ReadonlyArray<Track>}
 */
export function getTracks() {

	return TRACKS;

}

/**
 * Look up a track by id. Returns undefined if not found.
 * @param {string} id
 * @returns {Track|undefined}
 */
export function getTrackById( id ) {

	return TRACKS.find( ( t ) => t.id === id );

}

/**
 * Return a random track from the registry.
 * @returns {Track}
 */
export function getRandomTrack() {

	return TRACKS[ Math.floor( Math.random() * TRACKS.length ) ];

}
