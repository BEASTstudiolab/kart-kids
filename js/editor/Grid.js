// ─── Grid Operations ─────────────────────────────────────────────────
// Core grid manipulation: placeMesh, resolveCell, undo/redo.
// All functions receive explicit dependencies instead of closing over state.

import * as THREE from 'three';
import { ORIENT_DEG, CELL_RAW } from '../Track.js';
import { cellKey } from './EditorState.js';
import {
	getCellExits,
	getConnectivityMask,
	resolveNewTile,
	resolveTile,
} from './AutoTile.js';

/**
 * Place (or replace) the 3D mesh for a grid cell.
 */
export function placeMesh( grid, models, trackGroup, gx, gz, cell ) {

	if ( cell.mesh ) trackGroup.remove( cell.mesh );

	const src = models[ cell.type ];
	if ( ! src ) return;

	const mesh = src.clone();
	const elev = cell.elevation || 0;
	const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
	mesh.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5 + elevY, ( gz + 0.5 ) * CELL_RAW );
	mesh.rotation.y = THREE.MathUtils.degToRad( ORIENT_DEG[ cell.orient ] || 0 );
	mesh.traverse( ( c ) => {

		if ( c.isMesh ) {

			c.castShadow = true;
			c.receiveShadow = true;

		}

	} );

	trackGroup.add( mesh );
	cell.mesh = mesh;

}

/**
 * Auto-resolve a single cell's tile type and orientation.
 */
export function resolveCell( grid, models, trackGroup, gx, gz ) {

	const key = cellKey( gx, gz );
	const cell = grid.get( key );
	if ( ! cell ) return;

	// Manual rotation override: keep current type/orient, just ensure mesh exists
	if ( cell.rotationOverride ) {

		if ( ! cell.mesh ) placeMesh( grid, models, trackGroup, gx, gz, cell );
		return;

	}

	// Auto-ramp and elevated cells: don't auto-resolve
	if ( cell.autoRamp || ( cell.elevation && cell.elevation > 0 ) ) {

		if ( ! cell.mesh ) placeMesh( grid, models, trackGroup, gx, gz, cell );
		return;

	}

	let baseType, orient;

	if ( ! cell.mesh ) {

		// New cell: connect to neighbors, pick best pair if 3+
		[ baseType, orient ] = resolveNewTile( grid, gx, gz );

	} else {

		// Existing cell: re-resolve, but don't break existing connections
		const cMask = getConnectivityMask( grid, gx, gz );
		const currentExits = getCellExits( cell );
		const currentConnected = currentExits & cMask;

		[ baseType, orient ] = resolveTile( grid, gx, gz );

		// Check if the proposed shape keeps all current connections
		const proposedExits = getCellExits( { type: baseType, orient } );
		if ( ( proposedExits & currentConnected ) !== currentConnected ) {

			// Would disconnect something — keep current shape
			return;

		}

	}

	// Finish cells use trk-finish but only when resolved as straight
	const type = ( cell.isFinish && baseType === 'trk-straight' ) ? 'trk-finish' : baseType;

	// Skip if nothing changed and mesh already exists
	if ( cell.type === type && cell.orient === orient && cell.mesh ) return;

	cell.type = type;
	cell.orient = orient;

	placeMesh( grid, models, trackGroup, gx, gz, cell );

}

/**
 * Resolve a cell and its four direct neighbors, then call renderCurves.
 */
export function resolveCellAndNeighbors( grid, models, trackGroup, gx, gz, renderCurves ) {

	resolveCell( grid, models, trackGroup, gx, gz );
	resolveCell( grid, models, trackGroup, gx, gz - 1 );
	resolveCell( grid, models, trackGroup, gx, gz + 1 );
	resolveCell( grid, models, trackGroup, gx + 1, gz );
	resolveCell( grid, models, trackGroup, gx - 1, gz );

	renderCurves();

}

// ─── Undo / Redo ─────────────────────────────────────────────────────

export function snapshotGrid( grid ) {

	const snap = [];
	for ( const [ key, cell ] of grid ) {

		const [ gx, gz ] = key.split( ',' ).map( Number );
		const entry = { gx, gz, type: cell.type, orient: cell.orient, isFinish: cell.isFinish };
		if ( cell.curveSize != null ) entry.curveSize = cell.curveSize;
		if ( cell.curveConsumed ) entry.curveConsumed = [ ...cell.curveConsumed ];
		if ( cell.curveVariant ) entry.curveVariant = cell.curveVariant;
		if ( cell.rotationOverride ) entry.rotationOverride = true;
		if ( cell.elevation != null && cell.elevation !== 0 ) entry.elevation = cell.elevation;
		if ( cell.autoRamp ) entry.autoRamp = true;
		if ( cell.rampParent ) entry.rampParent = cell.rampParent;
		snap.push( entry );

	}

	return snap;

}

export function restoreSnapshot( grid, models, trackGroup, snap, callbacks ) {

	// Remove all existing meshes (including curve meshes)
	for ( const [ , cell ] of grid ) {

		if ( cell.mesh ) trackGroup.remove( cell.mesh );
		if ( cell.curveMesh ) trackGroup.remove( cell.curveMesh );

	}

	grid.clear();

	for ( const entry of snap ) {

		const cell = {
			type: entry.type,
			orient: entry.orient,
			isFinish: entry.isFinish,
			mesh: null,
		};
		if ( entry.curveSize != null ) cell.curveSize = entry.curveSize;
		if ( entry.curveConsumed ) cell.curveConsumed = new Set( entry.curveConsumed );
		if ( entry.curveVariant ) cell.curveVariant = entry.curveVariant;
		// Migration: old saves with curveSize but no curveVariant
		if ( cell.curveSize >= 2 && ! cell.curveVariant ) {

			if ( cell.curveSize === 2 ) cell.curveVariant = '2x2-wide';
			else cell.curveVariant = '3x3'; // cap at 3x3 (no 4x4 model)
			if ( cell.curveSize > 3 ) cell.curveSize = 3;

		}

		if ( entry.rotationOverride ) cell.rotationOverride = true;
		if ( entry.elevation != null ) cell.elevation = entry.elevation;
		if ( entry.autoRamp ) cell.autoRamp = true;
		if ( entry.rampParent ) cell.rampParent = entry.rampParent;

		grid.set( cellKey( entry.gx, entry.gz ), cell );
		placeMesh( grid, models, trackGroup, entry.gx, entry.gz, cell );

	}

	// Re-render curves from restored metadata
	callbacks.renderCurves();
	callbacks.save();
	callbacks.updateStats();
	callbacks.updateFinishCar();

}
