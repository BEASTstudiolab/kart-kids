// ─── TrackTile ───────────────────────────────────────────────────────────────
// Represents a single placed track tile in the editor grid.
// Stores type, orientation, elevation, curve state, and mesh reference.

// Corner exit masks by orient code: N=8 S=4 E=2 W=1
const CORNER_EXITS = { 0: 5, 16: 6, 10: 10, 22: 9 };  // S+W, S+E, N+E, N+W
// Straight exit masks: N+S or E+W
const STRAIGHT_EXITS = { 0: 12, 10: 12, 16: 3, 22: 3 };

// Junction exit masks by orient code
// Y-split: 3 exits (one stem + two forks)
const JUNCTION_Y_EXITS = { 0: 14, 16: 7, 10: 13, 22: 11 };  // N+S+E, S+E+W, N+S+W, N+E+W
// T-junction: 3 exits (crossbar + one stem)
const JUNCTION_T_EXITS = { 0: 11, 16: 14, 10: 7, 22: 13 };   // N+E+W, N+S+E, S+E+W, N+S+W
// 4-way: all 4 exits regardless of orient
const JUNCTION_4WAY_EXITS = 15;

// 3x3 tiles with consumed cells
const TILES_3X3 = new Set( [
	'trk-junction-y', 'trk-junction-t', 'trk-junction-4way', 'trk-chicane-3x3-l',
	'trk-curve-3x3-l', 'trk-curve-3x3-wide-l',
] );

// Finish tile (3x1)
const TILE_FINISH = 'trk-finish';

export class TrackTile {

	/**
	 * @param {string} type     Tile type name (e.g. 'trk-straight')
	 * @param {number} orient   Orientation code: 0|10|16|22
	 * @param {number} [elevation=12]  Elevation step index (0-24, 12=ground)
	 */
	constructor( type, orient, elevation = 12 ) {

		this.type = type;
		this.orient = orient;
		this.elevation = elevation;

		/** @type {import('three').Object3D|null} */
		this.mesh = null;

		// ── Curve state ──
		/** @type {string|null} '2x2-wide'|'3x3'|'3x3-wide' */
		this.curveVariant = null;
		/** @type {number|null} */
		this.curveSize = null;
		/** @type {Set<string>|null} cell keys consumed by this curve */
		this.curveConsumed = null;
		/** @type {import('three').Object3D|null} */
		this.curveMesh = null;
		/** @type {boolean} */
		this.curveOverride = false;

		// ── Rotation ──
		/** @type {boolean} user manually set orientation */
		this.rotationOverride = false;

		// ── Elevation / Ramp ──
		/** @type {boolean} auto-generated ramp tile */
		this.autoRamp = false;
		/** @type {string|null} cell key of the parent elevated tile */
		this.rampParent = null;
		/** @type {'steep'|'smooth'} */
		this.rampStyle = 'steep';
		/** @type {number} derived elevation from adjacent elevated tiles */
		this._derivedElevation = 0;

		// ── Finish ──
		/** @type {boolean} */
		this.isFinish = false;
		/** @type {boolean} flanking cell of finish (not the center) */
		this.finishFlank = false;

		// ── Multi-tile ──
		/** @type {boolean} this cell is consumed by a larger tile */
		this._consumed = false;

	}

	/**
	 * Get the 4-bit exit connectivity mask for this tile.
	 * N=8, S=4, E=2, W=1.
	 * @returns {number}
	 */
	getExitMask() {

		// Consumed cells of multi-tile pieces have no exits of their own
		if ( this._consumed ) return 0;

		// Multi-tile curves: all exits open so walker can traverse the 3x3 footprint.
		// Actual road connectivity is handled by consumed cells connecting to neighbors.
		if ( this.type.startsWith( 'trk-curve-' ) ) {

			return 15;

		}

		if ( this.type === 'trk-corner-1x1' ) {

			return CORNER_EXITS[ this.orient ] ?? 5;

		}

		if ( this.type === 'trk-junction-y' ) {

			return JUNCTION_Y_EXITS[ this.orient ] ?? 14;

		}

		if ( this.type === 'trk-junction-t' ) {

			return JUNCTION_T_EXITS[ this.orient ] ?? 11;

		}

		if ( this.type === 'trk-junction-4way' ) {

			return JUNCTION_4WAY_EXITS;

		}

		// All other road tiles (straight, chicane, bridges, tunnels, etc.) are through-tiles
		return STRAIGHT_EXITS[ this.orient ] ?? 12;

	}

	/**
	 * Get all grid cells occupied by this tile placed at (gx, gz).
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {Array<{gx: number, gz: number}>}
	 */
	getFootprintCells( gx, gz ) {

		// 3x3 junctions / chicane
		if ( TILES_3X3.has( this.type ) ) {

			const cells = [];
			for ( let dx = - 1; dx <= 1; dx ++ ) {

				for ( let dz = - 1; dz <= 1; dz ++ ) {

					cells.push( { gx: gx + dx, gz: gz + dz } );

				}

			}

			return cells;

		}

		// Finish (3x1) — center + 2 flanking cells along perpendicular axis
		if ( this.type === TILE_FINISH ) {

			const isNS = ( this.orient === 0 || this.orient === 10 );
			if ( isNS ) {

				return [
					{ gx, gz },
					{ gx: gx - 1, gz },
					{ gx: gx + 1, gz },
				];

			}

			return [
				{ gx, gz },
				{ gx, gz: gz - 1 },
				{ gx, gz: gz + 1 },
			];

		}

		// Default: 1x1
		return [ { gx, gz } ];

	}

	/**
	 * Create a shallow clone of this tile (for snapshots).
	 * Does NOT clone mesh references.
	 * @returns {TrackTile}
	 */
	clone() {

		const t = new TrackTile( this.type, this.orient, this.elevation );

		t.curveVariant = this.curveVariant;
		t.curveSize = this.curveSize;
		t.curveConsumed = this.curveConsumed ? new Set( this.curveConsumed ) : null;
		t.curveOverride = this.curveOverride;
		t.rotationOverride = this.rotationOverride;
		t.autoRamp = this.autoRamp;
		t.rampParent = this.rampParent;
		t.rampStyle = this.rampStyle;
		t._derivedElevation = this._derivedElevation;
		t.isFinish = this.isFinish;
		t.finishFlank = this.finishFlank;
		t._consumed = this._consumed;

		return t;

	}

}

export { CORNER_EXITS, STRAIGHT_EXITS, TILES_3X3, TILE_FINISH };
