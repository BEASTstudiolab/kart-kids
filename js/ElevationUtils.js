// ─── Elevation Utilities ─────────────────────────────────────────────
// Shared between editor (Elevation.js) and game (Track.js).
// Pure functions — no dependencies on state or THREE.

/**
 * Get the model name for an elevation piece.
 * @param {number} elevation - 1 (half = 2.5m) or 2 (full = 5m)
 * @param {string} role - 'flat', 'ramp-up', or 'ramp-down'
 * @param {string} [style] - 'steep' (default) or 'smooth'
 * @returns {string} Model name like 'trk-elev-2p5', 'trk-ramp-up-5', etc.
 */
export function getElevationModelName( elevation, role, style ) {

	const suffix = elevation === 1 ? '2p5' : '5';
	if ( role === 'flat' ) return 'trk-elev-' + suffix;

	const smooth = style === 'smooth';

	if ( role === 'ramp-up' ) return smooth ? 'trk-ramp-up-' + suffix + '-smooth' : 'trk-ramp-up-' + suffix;
	if ( role === 'ramp-down' ) return smooth ? 'trk-ramp-down-' + suffix + '-smooth' : 'trk-ramp-down-' + suffix;
	return 'trk-straight';

}

/**
 * Scan the full elevated run containing the cell at (gx, gz).
 * Walks both directions along the tile's axis collecting elevated tiles.
 * Stops at: corners, grid edges, ground tiles, or different-axis tiles.
 *
 * @param {Map} grid - The editor grid
 * @param {number} gx - Grid X of the starting cell
 * @param {number} gz - Grid Z of the starting cell
 * @param {function} cellKeyFn - cellKey(gx, gz) → string
 * @returns {Array<{gx: number, gz: number, key: string}>} All tiles in the run
 */
export function scanElevatedRun( grid, gx, gz, cellKeyFn ) {

	const startKey = cellKeyFn( gx, gz );
	const startCell = grid.get( startKey );
	if ( ! startCell || ! startCell.elevation || startCell.elevation === 0 ) return [];

	// Determine axis: orient 0 or 10 = N/S (walk along Z), orient 16 or 22 = E/W (walk along X)
	const orient = startCell.orient;
	const isNS = orient === 0 || orient === 10;
	const dx = isNS ? 0 : 1;
	const dz = isNS ? 1 : 0;

	const run = [ { gx, gz, key: startKey } ];

	// Walk in both directions: positive and negative along the axis
	for ( const sign of [ 1, - 1 ] ) {

		let cx = gx + dx * sign;
		let cz = gz + dz * sign;

		while ( true ) {

			const key = cellKeyFn( cx, cz );
			const cell = grid.get( key );

			// Stop at grid edge
			if ( ! cell ) break;

			// Stop at ground tiles
			if ( ! cell.elevation || cell.elevation === 0 ) break;

			// Stop at corners
			if ( cell.type === 'trk-corner-1x1' ) break;

			// Stop at different-axis tiles
			const cellIsNS = cell.orient === 0 || cell.orient === 10;
			if ( cellIsNS !== isNS ) break;

			if ( sign === 1 ) {

				run.push( { gx: cx, gz: cz, key } );

			} else {

				run.unshift( { gx: cx, gz: cz, key } );

			}

			cx += dx * sign;
			cz += dz * sign;

		}

	}

	return run;

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
