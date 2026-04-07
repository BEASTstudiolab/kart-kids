// ─── Elevation Logic ─────────────────────────────────────────────────
// Elevation cycling, clearing, and load-time derivation.

import { ORIENT_FLIP, DIR_DELTA, cellKey } from './EditorState.js';
import { getElevationModelName, scanElevatedRun } from '../ElevationUtils.js';
import { getCellExits } from './AutoTile.js';

/**
 * Derive elevation for a corner cell from its adjacent elevated straights.
 * Sets cell._derivedElevation so placeMesh and renderCurves pick up the Y-offset.
 */
export function deriveCornerElevation( grid, gx, gz ) {

	const key = cellKey( gx, gz );
	const cell = grid.get( key );
	if ( ! cell || cell.type !== 'trk-corner-1x1' ) return;

	const exits = getCellExits( cell );
	let maxElev = 0;

	for ( const bit of [ 8, 4, 2, 1 ] ) {

		if ( ! ( exits & bit ) ) continue;

		const [ dx, dz ] = DIR_DELTA[ bit ];
		const nKey = cellKey( gx + dx, gz + dz );
		const nCell = grid.get( nKey );
		if ( ! nCell ) continue;

		const nElev = nCell.elevation || 0;
		if ( nElev > maxElev ) maxElev = nElev;

	}

	cell._derivedElevation = maxElev;

}

/**
 * Load-time: scan all elevated cells, derive ramps using run-scanning logic,
 * and derive corner elevations.
 *
 * Pass 1: Clear all autoRamp cells (reset to trk-straight).
 * Pass 2: For each elevated tile, call recalculateRunRamps once per run.
 * Pass 3: Derive corner elevations for all corner cells.
 */
export function deriveRampsFromElevation( grid, placeMesh ) {

	// Pass 1: Clear all autoRamp cells
	for ( const [ key, cell ] of grid ) {

		if ( ! cell.autoRamp ) continue;

		cell.autoRamp = false;
		delete cell.rampParent;
		cell.type = 'trk-straight';

		const [ gx, gz ] = key.split( ',' ).map( Number );
		placeMesh( gx, gz, cell );

	}

	// Pass 2: Process each elevated run exactly once
	const processed = new Set();

	for ( const [ key, cell ] of grid ) {

		if ( ! cell.elevation || cell.elevation === 0 ) continue;
		if ( cell.type === 'trk-corner-1x1' || cell.type === 'trk-finish' ) continue;
		if ( processed.has( key ) ) continue;

		const [ gx, gz ] = key.split( ',' ).map( Number );

		// Ensure the elevated tile has the correct model type
		const elevModel = getElevationModelName( cell.elevation, 'flat' );
		cell.type = elevModel;
		placeMesh( gx, gz, cell );

		// Scan the full run and mark all tiles as processed
		const run = scanElevatedRun( grid, gx, gz, cellKey );
		for ( const tile of run ) {

			processed.add( tile.key );

		}

		// Recalculate ramps for this run (harmless re-clear of already-cleared ramps)
		recalculateRunRamps( grid, placeMesh, gx, gz );

	}

	// Pass 3: Derive elevation for all corner cells
	for ( const [ cKey, cCell ] of grid ) {

		if ( cCell.type !== 'trk-corner-1x1' ) continue;
		const [ cgx, cgz ] = cKey.split( ',' ).map( Number );
		deriveCornerElevation( grid, cgx, cgz );
		placeMesh( cgx, cgz, cCell );

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
		let nCell = grid.get( nKey );

		// Ramp cells are filtered out during save — create them if missing
		if ( ! nCell ) {

			nCell = { type: 'trk-straight', orient, isFinish: false, mesh: null };
			grid.set( nKey, nCell );

		}

		// Skip if neighbor is elevated or not a straight
		if ( nCell.elevation && nCell.elevation > 0 ) continue;

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

	// Derive elevation for any corners adjacent to tiles in the run
	const cornerChecked = new Set();
	for ( const tile of run ) {

		for ( const bit of [ 8, 4, 2, 1 ] ) {

			const [ dx, dz ] = DIR_DELTA[ bit ];
			const nx2 = tile.gx + dx;
			const nz2 = tile.gz + dz;
			const nKey2 = cellKey( nx2, nz2 );
			if ( cornerChecked.has( nKey2 ) ) continue;
			cornerChecked.add( nKey2 );

			const nCell2 = grid.get( nKey2 );
			if ( nCell2 && nCell2.type === 'trk-corner-1x1' ) {

				deriveCornerElevation( grid, nx2, nz2 );
				placeMesh( nx2, nz2, nCell2 );

			}

		}

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

		// Clear orphaned ramps that were parented to this cell
		for ( const [ rKey, rCell ] of grid ) {

			if ( rCell.autoRamp && rCell.rampParent === key ) {

				rCell.autoRamp = false;
				delete rCell.rampParent;
				rCell.type = 'trk-straight';

				const [ rx, rz ] = rKey.split( ',' ).map( Number );
				placeMesh( rx, rz, rCell );

			}

		}

		// Recalculate ramps for any elevated neighbors
		for ( const bit of [ 8, 4, 2, 1 ] ) {

			const [ dx, dz ] = DIR_DELTA[ bit ];
			const nKey = cellKey( gx + dx, gz + dz );
			const nCell = grid.get( nKey );
			if ( nCell && nCell.elevation && nCell.elevation > 0 ) {

				recalculateRunRamps( grid, placeMesh, gx + dx, gz + dz );

			}

		}

		showToast( 'Elevation: ground' );

	}

	save();

}
