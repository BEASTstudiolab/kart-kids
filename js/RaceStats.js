const KEY_PREFIX = 'race-stats:';
const SCHEMA_VERSION = 1;

/**
 * Save race results for a track. Compares against existing bests and
 * returns which records were broken.
 *
 * @param {string} trackId
 * @param {{ totalTime: number, bestLap: number, laps: number }} results
 * @returns {{ newBestLap: boolean, newBestTotal: boolean, prevBestLap: number, prevBestTotal: number }}
 */
export function saveRaceStats( trackId, results ) {

	const existing = loadRaceStats( trackId );

	const prevBestLap = existing ? existing.bestLap : Infinity;
	const prevBestTotal = existing ? existing.bestTotal : Infinity;

	const newBestLap = results.bestLap > 0 && results.bestLap < prevBestLap;
	const newBestTotal = results.totalTime > 0 && results.totalTime < prevBestTotal;

	// Coerce Infinity to 0 before JSON serialization (Infinity → null in JSON)
	const safePrevLap = prevBestLap === Infinity ? 0 : prevBestLap;
	const safePrevTotal = prevBestTotal === Infinity ? 0 : prevBestTotal;

	const data = {
		_version: SCHEMA_VERSION,
		bestLap: newBestLap ? results.bestLap : safePrevLap,
		bestTotal: newBestTotal ? results.totalTime : safePrevTotal,
		raceCount: ( existing ? existing.raceCount : 0 ) + 1,
	};

	try {

		localStorage.setItem( KEY_PREFIX + trackId, JSON.stringify( data ) );

	} catch ( e ) {

		// localStorage quota exceeded — fail silently

	}

	return {
		newBestLap,
		newBestTotal,
		prevBestLap: safePrevLap,
		prevBestTotal: safePrevTotal,
	};

}

/**
 * Load persisted race stats for a track.
 *
 * @param {string} trackId
 * @returns {{ bestLap: number, bestTotal: number, raceCount: number } | null}
 */
export function loadRaceStats( trackId ) {

	try {

		const raw = localStorage.getItem( KEY_PREFIX + trackId );
		if ( ! raw ) return null;

		const data = JSON.parse( raw );
		if ( typeof data.bestLap !== 'number' || typeof data.bestTotal !== 'number' ) return null;

		return {
			bestLap: data.bestLap,
			bestTotal: data.bestTotal,
			raceCount: data.raceCount || 0,
		};

	} catch ( e ) {

		return null;

	}

}
