// ─── Elevation Utilities ─────────────────────────────────────────────
// Shared between editor (Elevation.js) and game (Track.js).
// Pure functions — no dependencies on state or THREE.

/**
 * Get the model name for an elevation piece.
 * @param {number} elevation - 1 (half = 2.5m) or 2 (full = 5m)
 * @param {string} role - 'flat', 'ramp-up', or 'ramp-down'
 * @returns {string} Model name like 'trk-elev-2p5', 'trk-ramp-up-5', etc.
 */
export function getElevationModelName( elevation, role ) {

	const suffix = elevation === 1 ? '2p5' : '5';
	if ( role === 'flat' ) return 'trk-elev-' + suffix;
	if ( role === 'ramp-up' ) return 'trk-ramp-up-' + suffix;
	if ( role === 'ramp-down' ) return 'trk-ramp-down-' + suffix;
	return 'trk-straight';

}

/**
 * Get the ramp neighbor positions for an elevated cell.
 * After PI/2 base rotation, ramp-up has HIGH at -Z (north) and LOW at +Z (south).
 * So ramp-up must be placed SOUTH of the elevated cell (its HIGH north edge meets elevated).
 * Ramp-down has HIGH at +Z (south), placed NORTH (its HIGH south edge meets elevated).
 *
 * @param {number} gx - Grid X of the elevated cell
 * @param {number} gz - Grid Z of the elevated cell
 * @param {number} orient - Orientation of the elevated cell (0, 10, 16, or 22)
 * @returns {Array<{gx: number, gz: number, role: string}>}
 */
export function getRampNeighborKeys( gx, gz, orient ) {

	if ( orient === 0 || orient === 10 ) {

		return [
			{ gx, gz: gz - 1, role: 'ramp-down' },
			{ gx, gz: gz + 1, role: 'ramp-up' },
		];

	}

	return [
		{ gx: gx - 1, gz, role: 'ramp-down' },
		{ gx: gx + 1, gz, role: 'ramp-up' },
	];

}
