// ─── Elevation Logic ─────────────────────────────────────────────────
// Elevation cycling, clearing, and load-time derivation.

import { ORIENT_FLIP, cellKey } from './EditorState.js';
import { getElevationModelName, getRampNeighborKeys, scanElevatedRun } from '../ElevationUtils.js';

/**
 * Load-time: scan all elevated cells and re-derive ramp neighbors.
 */
export function deriveRampsFromElevation( grid, placeMesh ) {

	for ( const [ key, cell ] of grid ) {

		if ( ! cell.elevation || cell.elevation === 0 ) continue;
		if ( cell.type === 'trk-corner-1x1' || cell.type === 'trk-finish' ) continue;

		const [ gx, gz ] = key.split( ',' ).map( Number );

		const elevModel = getElevationModelName( cell.elevation, 'flat' );
		cell.type = elevModel;
		placeMesh( gx, gz, cell );

		const rampNeighbors = getRampNeighborKeys( gx, gz, cell.orient );

		for ( const rn of rampNeighbors ) {

			const rKey = cellKey( rn.gx, rn.gz );
			const rCell = grid.get( rKey );
			if ( ! rCell ) continue;

			if ( rCell.autoRamp ) continue;
			if ( rCell.type !== 'trk-straight' ) continue;

			rCell.autoRamp = true;
			rCell.rampParent = key;
			rCell.type = getElevationModelName( cell.elevation, rn.role );
			rCell.orient = cell.orient;
			placeMesh( rn.gx, rn.gz, rCell );

		}

	}

}

/**
 * Recalculate ramps for the entire elevated run containing (gx, gz).
 * Clears old ramps belonging to the run, then places new ramps at run edges.
 * Never calls pushUndo — callers handle undo boundaries.
 *
 * @param {Map} grid - The editor grid
 * @param {function} placeMesh - placeMesh(gx, gz, cell)
 * @param {number} gx - Grid X of any tile in the run
 * @param {number} gz - Grid Z of any tile in the run
 */
export function recalculateRunRamps( grid, placeMesh, gx, gz ) {

	const key = cellKey( gx, gz );
	const cell = grid.get( key );
	if ( ! cell || ! cell.elevation || cell.elevation === 0 ) return;

	// 1. Scan the full run
	const run = scanElevatedRun( grid, gx, gz, cellKey );
	if ( run.length === 0 ) return;

	// Build a set of run keys for fast lookup
	const runKeys = new Set( run.map( t => t.key ) );

	// 2. Clear all autoRamp cells whose rampParent points to any tile in this run
	for ( const [ rKey, rCell ] of grid ) {

		if ( rCell.autoRamp && runKeys.has( rCell.rampParent ) ) {

			rCell.autoRamp = false;
			delete rCell.rampParent;
			rCell.type = 'trk-straight';

			const [ rx, rz ] = rKey.split( ',' ).map( Number );
			placeMesh( rx, rz, rCell );

		}

	}

	// 3. Determine axis from the first tile in the run
	const firstCell = grid.get( run[ 0 ].key );
	const orient = firstCell.orient;
	const isNS = orient === 0 || orient === 10;

	// Axis deltas: direction from first→last tile in the run
	const dx = isNS ? 0 : 1;
	const dz = isNS ? 1 : 0;

	// 4. Place ramps at run edges
	// Edge A: before the first tile (negative direction)
	const first = run[ 0 ];
	const last = run[ run.length - 1 ];

	const edges = [
		{ edge: first, dir: - 1, parentIdx: 0 },
		{ edge: last, dir: 1, parentIdx: run.length - 1 },
	];

	for ( const { edge, dir, parentIdx } of edges ) {

		const parentTile = run[ parentIdx ];
		const parentCell = grid.get( parentTile.key );

		// Neighbor in the axis direction beyond the run edge
		const nx = edge.gx + dx * dir;
		const nz = edge.gz + dz * dir;
		const nKey = cellKey( nx, nz );
		const nCell = grid.get( nKey );

		// Skip if no neighbor or neighbor is elevated
		if ( ! nCell ) continue;
		if ( nCell.elevation && nCell.elevation > 0 ) continue;
		if ( nCell.type !== 'trk-straight' ) continue;

		// Check beyond-cell (one more tile past the ramp)
		const bx = nx + dx * dir;
		const bz = nz + dz * dir;
		const bKey = cellKey( bx, bz );
		const bCell = grid.get( bKey );
		if ( ! bCell ) continue;

		// Determine role: ramp going away from the elevated section
		// For N/S axis: negative dir (toward -Z / north) = ramp-down, positive (toward +Z / south) = ramp-up
		// For E/W axis: negative dir (toward -X / west) = ramp-down, positive (toward +X / east) = ramp-up
		const role = dir === 1 ? 'ramp-up' : 'ramp-down';

		const style = parentCell.rampStyle || 'steep';

		nCell.autoRamp = true;
		nCell.rampParent = parentTile.key;
		nCell.type = getElevationModelName( parentCell.elevation, role, style );
		nCell.orient = orient;

		if ( role === 'ramp-up' ) {

			nCell.orient = ORIENT_FLIP[ orient ] ?? orient;

		}

		placeMesh( nx, nz, nCell );

	}

}

/**
 * Cycle elevation on a cell: ground → half → full → ground.
 * Ramp placement is delegated to recalculateRunRamps.
 * @param {object} ctx - { grid, placeMesh, pushUndo, save, showToast }
 */
export function cycleElevation( ctx, gx, gz ) {

	const { grid, placeMesh, pushUndo, save, showToast } = ctx;
	const key = cellKey( gx, gz );
	const cell = grid.get( key );

	if ( ! cell ) {

		showToast( 'No tile here' );
		return;

	}

	if ( cell.type !== 'trk-straight' && cell.type !== 'trk-elev-2p5' && cell.type !== 'trk-elev-5' ) {

		showToast( 'Only straights can be elevated' );
		return;

	}

	if ( cell.isFinish ) {

		showToast( 'Cannot elevate finish tile' );
		return;

	}

	for ( const [ , cc ] of grid ) {

		if ( cc.curveConsumed && cc.curveConsumed.has( key ) ) {

			showToast( 'Curves cannot be elevated' );
			return;

		}

	}

	if ( cell.curveSize >= 2 ) {

		showToast( 'Curves cannot be elevated' );
		return;

	}

	if ( cell.autoRamp ) {

		showToast( 'Ramp is auto-managed' );
		return;

	}

	pushUndo();

	const currentElev = cell.elevation || 0;
	const ELEV_CYCLE = { 0: 1, 1: 2, 2: 0 };
	const nextElev = ELEV_CYCLE[ currentElev ];

	if ( nextElev > 0 ) {

		cell.elevation = nextElev;
		cell.type = getElevationModelName( nextElev, 'flat' );
		placeMesh( gx, gz, cell );

		recalculateRunRamps( grid, placeMesh, gx, gz );

		showToast( 'Elevation: ' + ( nextElev === 1 ? '2.5m' : '5m' ) );

	} else {

		cell.elevation = 0;
		cell.type = 'trk-straight';
		placeMesh( gx, gz, cell );

		showToast( 'Elevation: ground' );

	}

	save();

}
