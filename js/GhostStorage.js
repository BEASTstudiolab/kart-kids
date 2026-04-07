const MAX_REPLAY_BYTES = 500 * 1024; // 500KB cap per recording
const KEY_PREFIX = 'ghost:';


/**
 * Simple FNV-1a hash of a string, returned as hex.
 */
function fnv1a( str ) {

	let hash = 0x811c9dc5;
	for ( let i = 0; i < str.length; i ++ ) {

		hash ^= str.charCodeAt( i );
		hash = Math.imul( hash, 0x01000193 );

	}

	return ( hash >>> 0 ).toString( 16 );

}


/**
 * Derive a stable track ID from the cells array.
 */
export function getTrackId( cells ) {

	return fnv1a( JSON.stringify( cells ) );

}


/**
 * Save a ghost recording to localStorage.
 * Silently discards if the encoded size exceeds the cap.
 *
 * @param {string} trackId
 * @param {Float32Array} frames — interleaved [x,y,z,rotY, x,y,z,rotY, ...]
 * @param {number} lapTime — in seconds
 */
export function save( trackId, frames, lapTime ) {

	try {

		// Encode Float32Array as base64
		const bytes = new Uint8Array( frames.buffer, frames.byteOffset, frames.byteLength );
		let binary = '';
		for ( let i = 0; i < bytes.length; i ++ ) {

			binary += String.fromCharCode( bytes[ i ] );

		}

		const base64 = btoa( binary );

		const data = JSON.stringify( {
			lapTime,
			frameCount: frames.length / 4,
			frames: base64,
		} );

		if ( data.length > MAX_REPLAY_BYTES ) return;

		localStorage.setItem( KEY_PREFIX + trackId, data );

	} catch ( e ) {

		// localStorage quota exceeded or other error — fail silently

	}

}


/**
 * Load a ghost recording from localStorage.
 *
 * @param {string} trackId
 * @returns {{ frames: Float32Array, lapTime: number, frameCount: number } | null}
 */
export function load( trackId ) {

	try {

		const raw = localStorage.getItem( KEY_PREFIX + trackId );
		if ( ! raw ) return null;

		const data = JSON.parse( raw );
		if ( ! data.frames || ! data.lapTime || ! data.frameCount ) return null;

		// Decode base64 back to Float32Array
		const binary = atob( data.frames );
		const bytes = new Uint8Array( binary.length );
		for ( let i = 0; i < binary.length; i ++ ) {

			bytes[ i ] = binary.charCodeAt( i );

		}

		const frames = new Float32Array( bytes.buffer );

		return {
			frames,
			lapTime: data.lapTime,
			frameCount: data.frameCount,
		};

	} catch ( e ) {

		return null;

	}

}
