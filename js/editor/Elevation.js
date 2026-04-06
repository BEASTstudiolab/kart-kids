// ─── Elevation Logic ─────────────────────────────────────────────────
// Elevation cycling, clearing, and load-time derivation.

import { ORIENT_FLIP, cellKey } from './EditorState.js';
import { getElevationModelName, getRampNeighborKeys } from '../ElevationUtils.js';

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
 * Clear an elevation group: restore parent and ramps to ground straights.
 */
export function clearElevationGroup( grid, placeMesh, parentKey ) {

	const parentCell = grid.get( parentKey );
	if ( ! parentCell ) return;

	const [ pgx, pgz ] = parentKey.split( ',' ).map( Number );
	const rampNeighbors = getRampNeighborKeys( pgx, pgz, parentCell.orient );

	parentCell.elevation = 0;
	parentCell.type = 'trk-straight';
	placeMesh( pgx, pgz, parentCell );

	for ( const rn of rampNeighbors ) {

		const rKey = cellKey( rn.gx, rn.gz );
		const rCell = grid.get( rKey );
		if ( rCell && rCell.autoRamp && rCell.rampParent === parentKey ) {

			rCell.autoRamp = false;
			delete rCell.rampParent;
			rCell.type = 'trk-straight';
			rCell.orient = parentCell.orient;
			placeMesh( rn.gx, rn.gz, rCell );

		}

	}

}

/**
 * Cycle elevation on a cell: ground → half → full → ground.
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

	const currentElev = cell.elevation || 0;
	const ELEV_CYCLE = { 0: 1, 1: 2, 2: 0 };
	const nextElev = ELEV_CYCLE[ currentElev ];

	const rampNeighbors = getRampNeighborKeys( gx, gz, cell.orient );

	if ( nextElev > 0 ) {

		for ( const rn of rampNeighbors ) {

			const rKey = cellKey( rn.gx, rn.gz );
			const rCell = grid.get( rKey );

			if ( ! rCell ) {

				showToast( 'No room for ramps' );
				return;

			}

			const isOwnRamp = rCell.autoRamp && rCell.rampParent === key;

			if ( ! isOwnRamp ) {

				if ( rCell.type !== 'trk-straight' ) {

					showToast( 'No room for ramps' );
					return;

				}

				if ( rCell.elevation && rCell.elevation !== 0 ) {

					showToast( 'No room for ramps' );
					return;

				}

				if ( rCell.isFinish ) {

					showToast( 'No room for ramps' );
					return;

				}

				for ( const [ , cc ] of grid ) {

					if ( cc.curveConsumed && cc.curveConsumed.has( rKey ) ) {

						showToast( 'No room for ramps' );
						return;

					}

				}

				if ( rCell.autoRamp ) {

					showToast( 'No room for ramps' );
					return;

				}

			}

			const beyondGx = rn.gx + ( rn.gx - gx );
			const beyondGz = rn.gz + ( rn.gz - gz );
			const beyondKey = cellKey( beyondGx, beyondGz );
			const beyondCell = grid.get( beyondKey );

			if ( ! beyondCell ) {

				showToast( 'No room for ramps' );
				return;

			}

			if ( beyondCell.elevation && beyondCell.elevation !== 0 ) {

				showToast( 'No room for ramps' );
				return;

			}

		}

		pushUndo();

		cell.elevation = nextElev;
		cell.type = getElevationModelName( nextElev, 'flat' );
		placeMesh( gx, gz, cell );

		for ( const rn of rampNeighbors ) {

			const rKey = cellKey( rn.gx, rn.gz );
			const rCell = grid.get( rKey );

			rCell.autoRamp = true;
			rCell.rampParent = key;
			rCell.type = getElevationModelName( nextElev, rn.role );
			rCell.orient = cell.orient;

			if ( rn.role === 'ramp-up' ) {

				rCell.orient = ORIENT_FLIP[ cell.orient ] ?? cell.orient;

			}

			placeMesh( rn.gx, rn.gz, rCell );

		}

		showToast( 'Elevation: ' + ( nextElev === 1 ? '2.5m' : '5m' ) );

	} else {

		pushUndo();
		clearElevationGroup( grid, placeMesh, key );
		showToast( 'Elevation: ground' );

	}

	save();

}
