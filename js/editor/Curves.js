// ─── Curve Logic ─────────────────────────────────────────────────────
// Curve options, rendering, and load-time derivation.
// All functions receive `grid` as first param.

import { CELL_RAW } from '../Track.js';
import { DIR_DELTA, cellKey } from './EditorState.js';
import { getCellExits } from './AutoTile.js';
import { getCurveConfig } from '../TileMetadata.js';

export const VARIANT_MODEL = {
	'2x2-wide': 'trk-curve-2x2-l',
	'3x3': 'trk-curve-3x3-l',
	'3x3-wide': 'trk-curve-3x3-wide-l',
};

/**
 * Returns array of { variant, curveSize, consumed } for a corner cell.
 */
export function getAvailableCurveOptions( grid, gx, gz ) {

	const cell = grid.get( cellKey( gx, gz ) );
	if ( ! cell || cell.type !== 'trk-corner-1x1' ) return [];

	const exits = getCellExits( cell );
	const dirBits = [ 8, 4, 2, 1 ].filter( b => exits & b );
	if ( dirBits.length !== 2 ) return [];

	// Collect all consumed keys across the grid (for other curves)
	const globalConsumed = new Set();
	for ( const [ , c ] of grid ) {

		if ( c.curveConsumed && c !== cell ) {

			for ( const ck of c.curveConsumed ) globalConsumed.add( ck );

		}

	}

	// Walk each arm counting consecutive straights
	const walks = dirBits.map( bit => {

		const [ ddx, ddz ] = DIR_DELTA[ bit ];
		const keys = [];
		let nx = gx + ddx, nz = gz + ddz;

		while ( true ) {

			const nk = cellKey( nx, nz );
			const nc = grid.get( nk );
			if ( ! nc ) break;
			if ( nc.type !== 'trk-straight' && nc.type !== 'trk-elev-2p5' && nc.type !== 'trk-elev-5' ) break;
			if ( globalConsumed.has( nk ) ) break;
			keys.push( nk );
			nx += ddx;
			nz += ddz;

		}

		return keys;

	} );

	const maxSize = Math.min( walks[ 0 ].length, walks[ 1 ].length, 4 );

	// Footprint direction based on corner orient
	let fpDx, fpDz;
	if ( cell.orient === 0 ) { fpDx = - 1; fpDz = 1; }
	else if ( cell.orient === 16 ) { fpDx = 1; fpDz = 1; }
	else if ( cell.orient === 10 ) { fpDx = 1; fpDz = - 1; }
	else if ( cell.orient === 22 ) { fpDx = - 1; fpDz = - 1; }
	else return [];

	const options = [];

	const variants = [
		{ variant: '2x2-wide', curveSize: 2 },
		{ variant: '3x3', curveSize: 3 },
		{ variant: '3x3-wide', curveSize: 3 },
	];

	for ( const v of variants ) {

		if ( v.curveSize - 1 > maxSize ) continue;

		const consumed = new Set();
		for ( const walk of walks ) {

			for ( let i = 0; i < v.curveSize - 1; i ++ ) {

				consumed.add( walk[ i ] );

			}

		}

		let clear = true;
		for ( let fx = 0; fx < v.curveSize && clear; fx ++ ) {

			for ( let fz = 0; fz < v.curveSize && clear; fz ++ ) {

				if ( fx === 0 && fz === 0 ) continue;
				const fpKey = cellKey( gx + fx * fpDx, gz + fz * fpDz );
				if ( grid.has( fpKey ) && ! consumed.has( fpKey ) ) clear = false;
				if ( globalConsumed.has( fpKey ) ) clear = false;

			}

		}

		if ( ! clear ) continue;

		options.push( { variant: v.variant, curveSize: v.curveSize, consumed } );

	}

	return options;

}

/**
 * Render curve meshes for all cells that have curveSize >= 2.
 */
export function renderCurves( grid, models, trackGroup ) {

	for ( const [ key, cell ] of grid ) {

		// --- Clean up cells that no longer have a curve ---
		if ( cell.curveMesh && ( cell.curveSize == null || cell.curveSize < 2 ) ) {

			trackGroup.remove( cell.curveMesh );
			cell.curveMesh.traverse( ( c ) => {

				if ( c.isMesh && c.geometry ) c.geometry.dispose();

			} );
			cell.curveMesh = null;

			if ( cell.mesh ) cell.mesh.visible = true;

			if ( cell._prevConsumed ) {

				for ( const ck of cell._prevConsumed ) {

					const cc = grid.get( ck );
					if ( cc && cc.mesh ) cc.mesh.visible = true;

				}

				cell._prevConsumed = null;

			}

		}

		// --- Render cells that have a curve ---
		if ( cell.curveSize >= 2 ) {

			const curveConfig = getCurveConfig( cell.orient, cell.curveVariant, cell.curveSize );

			const modelName = VARIANT_MODEL[ cell.curveVariant ];
			if ( ! modelName ) { console.warn( 'Unknown curve variant:', cell.curveVariant ); continue; }
			const src = models[ modelName ];
			if ( ! src ) {

				console.warn( `[renderCurves] Model not found: ${ modelName }` );
				continue;

			}

			if ( cell.curveConsumed ) {

				for ( const ck of cell.curveConsumed ) {

					const cc = grid.get( ck );
					if ( cc && cc.mesh ) cc.mesh.visible = false;

				}

			}

			if ( cell.mesh ) cell.mesh.visible = false;

			if ( cell.curveMesh ) {

				trackGroup.remove( cell.curveMesh );

			}

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const curveMesh = src.clone();

			const elev = cell._derivedElevation || cell.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			curveMesh.position.set(
				( gx + 0.5 ) * CELL_RAW + curveConfig.offset.x,
				0.5 + elevY,
				( gz + 0.5 ) * CELL_RAW + curveConfig.offset.z
			);

			curveMesh.rotation.y = curveConfig.rotation;

			curveMesh.traverse( ( c ) => {

				if ( c.isMesh ) {

					c.castShadow = true;
					c.receiveShadow = true;

				}

			} );

			trackGroup.add( curveMesh );
			cell.curveMesh = curveMesh;

			cell._prevConsumed = cell.curveConsumed ? new Set( cell.curveConsumed ) : null;

		}

	}

}

/**
 * Load-time: derive curves from corner cells.
 */
export function deriveAllCurves( grid, models, trackGroup ) {

	// Single-pass: clear ALL curve metadata first, then run detection once
	for ( const [ , cell ] of grid ) {

		if ( cell.type === 'trk-corner-1x1' ) {

			cell.curveSize = undefined;
			cell.curveConsumed = undefined;

		}

	}

	// ── Pre-pass: handle corners with saved curve metadata ──────
	const VARIANT_SIZE = { '2x2-wide': 2, '2x2-tight': 2, '3x3': 3, '3x3-wide': 3 };
	const preClaimed = new Set();

	for ( const [ key, cell ] of grid ) {

		if ( cell.type !== 'trk-corner-1x1' ) continue;
		if ( cell.rotationOverride ) continue;

		// If curveOverride is set but curveVariant is missing, assign default
		if ( cell.curveOverride && ! cell.curveVariant ) {

			cell.curveVariant = '3x3';

		}

		if ( ! cell.curveVariant ) continue;

		const curveSize = VARIANT_SIZE[ cell.curveVariant ];
		if ( ! curveSize ) continue;

		const [ cgx, cgz ] = key.split( ',' ).map( Number );
		const exits = getCellExits( cell );
		const dirBits = [];
		for ( const bit of [ 8, 4, 2, 1 ] ) {

			if ( exits & bit ) dirBits.push( bit );

		}

		if ( dirBits.length !== 2 ) continue;

		// Compute consumed cells from exit arms
		const consumed = new Set();
		for ( const bit of dirBits ) {

			const [ ddx, ddz ] = DIR_DELTA[ bit ];
			let nx = cgx + ddx;
			let nz = cgz + ddz;

			for ( let i = 0; i < curveSize - 1; i ++ ) {

				const nk = cellKey( nx, nz );
				if ( grid.has( nk ) ) consumed.add( nk );
				nx += ddx;
				nz += ddz;

			}

		}

		cell.curveSize = curveSize;
		cell.curveConsumed = consumed;

		preClaimed.add( key );
		for ( const ck of consumed ) preClaimed.add( ck );

	}

	// Collect all corner candidates in one pass (full grid scope)
	const candidates = [];

	for ( const [ key, cell ] of grid ) {

		if ( cell.type !== 'trk-corner-1x1' ) continue;
		if ( cell.rotationOverride ) continue;
		if ( preClaimed.has( key ) ) continue;

		const [ cgx, cgz ] = key.split( ',' ).map( Number );
		const exits = getCellExits( cell );

		const dirBits = [];
		for ( const bit of [ 8, 4, 2, 1 ] ) {

			if ( exits & bit ) dirBits.push( bit );

		}

		if ( dirBits.length !== 2 ) continue;

		const walks = [];
		for ( const bit of dirBits ) {

			const [ ddx, ddz ] = DIR_DELTA[ bit ];
			const keys = [];
			let nx = cgx + ddx;
			let nz = cgz + ddz;

			while ( true ) {

				const nk = cellKey( nx, nz );
				const nc = grid.get( nk );
				if ( ! nc ) break;
				if ( nc.type !== 'trk-straight' && nc.type !== 'trk-elev-2p5' && nc.type !== 'trk-elev-5' ) break;
				keys.push( nk );
				nx += ddx;
				nz += ddz;

			}

			walks.push( { count: keys.length, keys } );

		}

		const curveSize = Math.min( walks[ 0 ].count, walks[ 1 ].count, 4 );
		if ( curveSize < 2 ) continue;

		const consumed = new Set();
		for ( const walk of walks ) {

			for ( let i = 0; i < curveSize - 1; i ++ ) {

				consumed.add( walk.keys[ i ] );

			}

		}

		candidates.push( { gx: cgx, gz: cgz, key, curveSize, consumed } );

	}

	// Sort greedily — largest first, ties by key string
	candidates.sort( ( a, b ) => {

		if ( b.curveSize !== a.curveSize ) return b.curveSize - a.curveSize;
		return a.key < b.key ? - 1 : a.key > b.key ? 1 : 0;

	} );

	// Assign curves, preventing overlap
	const claimed = new Set( preClaimed );

	for ( const cand of candidates ) {

		if ( claimed.has( cand.key ) ) continue;

		let blocked = false;
		for ( const ck of cand.consumed ) {

			if ( claimed.has( ck ) ) { blocked = true; break; }

		}

		if ( blocked ) continue;

		const cell = grid.get( cand.key );
		const orient = cell.orient;
		let fpDx, fpDz;

		if ( orient === 0 ) { fpDx = - 1; fpDz = 1; }
		else if ( orient === 16 ) { fpDx = 1; fpDz = 1; }
		else if ( orient === 10 ) { fpDx = 1; fpDz = - 1; }
		else if ( orient === 22 ) { fpDx = - 1; fpDz = - 1; }
		else continue;

		let footprintClear = true;
		for ( let fx = 0; fx < cand.curveSize && footprintClear; fx ++ ) {

			for ( let fz = 0; fz < cand.curveSize && footprintClear; fz ++ ) {

				if ( fx === 0 && fz === 0 ) continue;

				const fpKey = cellKey( cand.gx + fx * fpDx, cand.gz + fz * fpDz );

				if ( grid.has( fpKey ) && ! cand.consumed.has( fpKey ) ) {

					footprintClear = false;

				}

				if ( claimed.has( fpKey ) ) {

					footprintClear = false;

				}

			}

		}

		if ( ! footprintClear ) continue;

		cell.curveSize = cand.curveSize;
		cell.curveConsumed = cand.consumed;

		// Assign default curveVariant for auto-detected curves
		if ( ! cell.curveVariant ) {

			cell.curveVariant = cell.curveSize === 2 ? '2x2-wide' : '3x3';

		}

		claimed.add( cand.key );
		for ( const ck of cand.consumed ) {

			claimed.add( ck );

		}

	}

	renderCurves( grid, models, trackGroup );

}
