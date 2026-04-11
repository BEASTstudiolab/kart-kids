// ─── CurveService ────────────────────────────────────────────────────────────
// Multi-tile curve detection, rendering, and load-time derivation.
// Ported from js/editor/Curves.js into OOP structure.

import { CELL_RAW } from '../../TrackConstants.js';
import { getCurveConfig } from '../../TileMetadata.js';
import { DIR_INFO } from './AutoTileService.js';

const VARIANT_MODEL = {
	'2x2-wide': 'trk-curve-2x2-l',
	'3x3': 'trk-curve-3x3-l',
	'3x3-wide': 'trk-curve-3x3-wide-l',
};

const CURVE_VARIANTS = [
	{ variant: '2x2-wide', curveSize: 2 },
	{ variant: '3x3', curveSize: 3 },
	{ variant: '3x3-wide', curveSize: 3 },
];

// Footprint direction by corner orient
const FP_DIR = {
	0:  { dx: -1, dz: 1 },
	16: { dx: 1,  dz: 1 },
	10: { dx: 1,  dz: -1 },
	22: { dx: -1, dz: -1 },
};

export class CurveService {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('./TileLibrary.js').TileLibrary} tileLibrary
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, tileLibrary, eventBus ) {

		this._project = project;
		this._lib = tileLibrary;
		this._eventBus = eventBus;

	}

	/**
	 * Get available curve options for a corner cell.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {Array<{ variant: string, curveSize: number, consumed: Set<string> }>}
	 */
	getAvailableCurveOptions( gx, gz ) {

		const grid = this._project.getGrid();
		const cell = this._project.getTile( gx, gz );
		if ( !cell || cell.type !== 'trk-corner-1x1' ) return [];

		const exits = cell.getExitMask();
		const dirBits = DIR_INFO.filter( d => exits & d.bit );
		if ( dirBits.length !== 2 ) return [];

		// Collect consumed keys from other curves
		const globalConsumed = new Set();
		for ( const [ , c ] of grid ) {

			if ( c.curveConsumed && c !== cell ) {

				for ( const ck of c.curveConsumed ) globalConsumed.add( ck );

			}

		}

		// Walk each arm counting consecutive straights
		const walks = dirBits.map( dir => {

			const keys = [];
			let nx = gx + dir.dx, nz = gz + dir.dz;

			while ( true ) {

				const nk = this._project.cellKey( nx, nz );
				const nc = grid.get( nk );
				if ( !nc ) break;
				if ( nc.type !== 'trk-straight' && !nc.type.startsWith( 'trk-elev-' ) ) break;
				if ( globalConsumed.has( nk ) ) break;
				keys.push( nk );
				nx += dir.dx;
				nz += dir.dz;

			}

			return keys;

		} );

		const maxSize = Math.min( walks[0].length, walks[1].length, 4 );
		const fp = FP_DIR[ cell.orient ];
		if ( !fp ) return [];

		const options = [];

		for ( const v of CURVE_VARIANTS ) {

			if ( v.curveSize - 1 > maxSize ) continue;

			const consumed = new Set();
			for ( const walk of walks ) {

				for ( let i = 0; i < v.curveSize - 1; i++ ) consumed.add( walk[i] );

			}

			// Check footprint clear
			let clear = true;
			for ( let fx = 0; fx < v.curveSize && clear; fx++ ) {

				for ( let fz = 0; fz < v.curveSize && clear; fz++ ) {

					if ( fx === 0 && fz === 0 ) continue;
					const fpKey = this._project.cellKey( gx + fx * fp.dx, gz + fz * fp.dz );
					if ( grid.has( fpKey ) && !consumed.has( fpKey ) ) clear = false;
					if ( globalConsumed.has( fpKey ) ) clear = false;

				}

			}

			if ( !clear ) continue;
			options.push( { variant: v.variant, curveSize: v.curveSize, consumed } );

		}

		return options;

	}

	/**
	 * Render curve meshes for all cells with curveSize >= 2.
	 */
	renderCurves() {

		const grid = this._project.getGrid();
		const trackGroup = this._project.trackGroup;

		for ( const [ key, cell ] of grid ) {

			// Clean up cells that lost their curve
			if ( cell.curveMesh && ( cell.curveSize == null || cell.curveSize < 2 ) ) {

				trackGroup.remove( cell.curveMesh );
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

			// Render active curves
			if ( cell.curveSize >= 2 ) {

				const curveConfig = getCurveConfig( cell.orient, cell.curveVariant, cell.curveSize );
				const modelName = VARIANT_MODEL[ cell.curveVariant ];
				if ( !modelName ) continue;

				const src = this._lib.getModel( modelName );
				if ( !src ) continue;

				// Hide consumed cells
				if ( cell.curveConsumed ) {

					for ( const ck of cell.curveConsumed ) {

						const cc = grid.get( ck );
						if ( cc && cc.mesh ) cc.mesh.visible = false;

					}

				}

				if ( cell.mesh ) cell.mesh.visible = false;
				if ( cell.curveMesh ) trackGroup.remove( cell.curveMesh );

				const [ cgx, cgz ] = key.split( ',' ).map( Number );
				const curveMesh = src.clone( true );

				const elev = cell._derivedElevation || 0;
				const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;

				curveMesh.position.set(
					( cgx + 0.5 ) * CELL_RAW + curveConfig.offset.x,
					0.5 + elevY,
					( cgz + 0.5 ) * CELL_RAW + curveConfig.offset.z
				);
				curveMesh.rotation.y = curveConfig.rotation;

				curveMesh.traverse( c => {

					if ( c.isMesh ) { c.castShadow = true; c.receiveShadow = true; }

				} );

				trackGroup.add( curveMesh );
				cell.curveMesh = curveMesh;
				cell._prevConsumed = cell.curveConsumed ? new Set( cell.curveConsumed ) : null;

			}

		}

	}

	/**
	 * Load-time: detect and assign curves greedily (largest first).
	 */
	deriveAllCurves() {

		const grid = this._project.getGrid();

		// Clear existing curve metadata
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
			const exits = cell.getExitMask();
			const dirBits = DIR_INFO.filter( d => exits & d.bit );
			if ( dirBits.length !== 2 ) continue;

			// Compute consumed cells from exit arms
			const consumed = new Set();
			for ( const dir of dirBits ) {

				let nx = cgx + dir.dx;
				let nz = cgz + dir.dz;

				for ( let i = 0; i < curveSize - 1; i ++ ) {

					const nk = this._project.cellKey( nx, nz );
					if ( grid.has( nk ) ) consumed.add( nk );
					nx += dir.dx;
					nz += dir.dz;

				}

			}

			cell.curveSize = curveSize;
			cell.curveConsumed = consumed;

			preClaimed.add( key );
			for ( const ck of consumed ) preClaimed.add( ck );

		}

		// Collect candidates — only corners that explicitly opted into curves
		// (curveOverride=true). Plain corners stay as 1x1.
		const candidates = [];

		for ( const [ key, cell ] of grid ) {

			if ( cell.type !== 'trk-corner-1x1' ) continue;
			if ( cell.rotationOverride ) continue;
			if ( preClaimed.has( key ) ) continue;
			if ( ! cell.curveOverride ) continue;

			const [ cgx, cgz ] = key.split( ',' ).map( Number );
			const exits = cell.getExitMask();
			const dirBits = DIR_INFO.filter( d => exits & d.bit );
			if ( dirBits.length !== 2 ) continue;

			const walks = dirBits.map( dir => {

				const keys = [];
				let nx = cgx + dir.dx, nz = cgz + dir.dz;

				while ( true ) {

					const nk = this._project.cellKey( nx, nz );
					const nc = grid.get( nk );
					if ( !nc ) break;
					if ( nc.type !== 'trk-straight' && !nc.type.startsWith( 'trk-elev-' ) ) break;
					keys.push( nk );
					nx += dir.dx;
					nz += dir.dz;

				}

				return keys;

			} );

			const curveSize = Math.min( walks[0].length, walks[1].length, 4 );
			if ( curveSize < 2 ) continue;

			const consumed = new Set();
			for ( const walk of walks ) {

				for ( let i = 0; i < curveSize - 1; i++ ) consumed.add( walk[i] );

			}

			candidates.push( { gx: cgx, gz: cgz, key, curveSize, consumed } );

		}

		// Sort greedily: largest first
		candidates.sort( ( a, b ) => b.curveSize - a.curveSize || ( a.key < b.key ? -1 : 1 ) );

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
			const fp = FP_DIR[ cell.orient ];
			if ( !fp ) continue;

			// Check footprint clear
			let clear = true;
			for ( let fx = 0; fx < cand.curveSize && clear; fx++ ) {

				for ( let fz = 0; fz < cand.curveSize && clear; fz++ ) {

					if ( fx === 0 && fz === 0 ) continue;
					const fpKey = this._project.cellKey( cand.gx + fx * fp.dx, cand.gz + fz * fp.dz );
					if ( grid.has( fpKey ) && !cand.consumed.has( fpKey ) ) clear = false;
					if ( claimed.has( fpKey ) ) clear = false;

				}

			}

			if ( !clear ) continue;

			// Pick variant based on size
			cell.curveSize = cand.curveSize;
			cell.curveConsumed = cand.consumed;

			// Assign variant: if cell already has one (from save), keep it
			if ( !cell.curveVariant ) {

				cell.curveVariant = cand.curveSize === 2 ? '2x2-wide' : '3x3';

			}

			claimed.add( cand.key );
			for ( const ck of cand.consumed ) claimed.add( ck );

		}

		this.renderCurves();

	}

}

export { VARIANT_MODEL };
