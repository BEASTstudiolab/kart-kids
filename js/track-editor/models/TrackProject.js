// ─── TrackProject ────────────────────────────────────────────────────────────
// Root editable project object. Owns the grid Map, Three.js track group,
// and project metadata. Handles serialization to/from v4 JSON format.

import * as THREE from 'three';
import { TrackTile } from './TrackTile.js';

// ── v4 format constants ──
const ELEV_STEP = 2.5;
const ELEV_GROUND = 12;

// Tile type index (v4 ↔ type name)
const V4_TYPE_NAMES = [
	'trk-straight',            // 0
	'trk-corner-1x1',         // 1
	'trk-straight',            // 2 (reserved/legacy)
	'trk-finish',              // 3
	'trk-junction-y',          // 4
	'trk-junction-t',          // 5
	'trk-junction-4way',       // 6
	'trk-bridge-entry',        // 7
	'trk-bridge-mid',          // 8
	'trk-tunnel-entry',        // 9
	'trk-tunnel-mid',          // 10
	'trk-tunnel-exit',         // 11
	'trk-tunnel-open',         // 12
	'trk-jump-short',          // 13
	'trk-jump-long',           // 14
	'trk-chicane-3x3-l',      // 15
	// ── Elevation & ramp types ──
	'trk-elev-2p5',            // 16
	'trk-elev-5',              // 17
	'trk-ramp-up-2p5',         // 18
	'trk-ramp-up-5',           // 19
	'trk-ramp-down-2p5',       // 20
	'trk-ramp-down-5',         // 21
	'trk-ramp-up-2p5-smooth',  // 22
	'trk-ramp-up-5-smooth',    // 23
	'trk-ramp-down-2p5-smooth', // 24
	'trk-ramp-down-5-smooth',  // 25
];

const V4_TYPE_INDEX = {};
for ( let i = 0; i < V4_TYPE_NAMES.length; i ++ ) {

	if ( i === 2 ) continue; // skip legacy alias
	if ( V4_TYPE_INDEX[ V4_TYPE_NAMES[ i ] ] === undefined ) {

		V4_TYPE_INDEX[ V4_TYPE_NAMES[ i ] ] = i;

	}

}

// Orient: v4 quadrant (0-3) ↔ internal code (0, 16, 10, 22)
const V4_TO_INTERNAL = [ 0, 16, 10, 22 ];
const INTERNAL_TO_V4 = { 0: 0, 16: 1, 10: 2, 22: 3 };

// Curve variant encoding
const CURVE_VARIANT_ENCODE = { '2x2-wide': 1, '2x2-tight': 2, '3x3': 3, '3x3-wide': 4 };
const CURVE_VARIANT_DECODE = { 1: '2x2-wide', 2: '2x2-tight', 3: '3x3', 4: '3x3-wide' };


export class TrackProject {

	constructor() {

		/** @type {Map<string, TrackTile>} "gx,gz" -> TrackTile */
		this._grid = new Map();

		/** Three.js group containing all track meshes. */
		this.trackGroup = new THREE.Group();
		this.trackGroup.name = 'track-editor-group';

		/** Project metadata. */
		this.meta = {
			id: crypto.randomUUID(),
			name: 'Untitled Track',
			description: '',
			themeId: 'city-night',
			timeOfDay: 'night',
			raceType: 'circuit',
			laps: 3,
			racerCount: 4,
			gridWidth: 255,
			gridHeight: 255,
			validationState: null,
			shareId: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			version: 1,
		};

		/** Raw markers data loaded from JSON (consumed by GameplayMode after init). */
		this._pendingMarkers = null;
		/** Raw props data loaded from JSON (consumed by PropsMode after init). */
		this._pendingProps = null;

	}

	// ── Grid access ──

	/**
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {string}
	 */
	cellKey( gx, gz ) {

		return gx + ',' + gz;

	}

	/**
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {TrackTile|null}
	 */
	getTile( gx, gz ) {

		return this._grid.get( this.cellKey( gx, gz ) ) ?? null;

	}

	/**
	 * @param {number} gx
	 * @param {number} gz
	 * @param {TrackTile} tile
	 */
	setTile( gx, gz, tile ) {

		this._grid.set( this.cellKey( gx, gz ), tile );

	}

	/**
	 * @param {number} gx
	 * @param {number} gz
	 */
	deleteTile( gx, gz ) {

		const key = this.cellKey( gx, gz );
		const tile = this._grid.get( key );

		if ( tile ) {

			// Remove mesh from scene
			if ( tile.mesh ) {

				this.trackGroup.remove( tile.mesh );
				tile.mesh = null;

			}

			if ( tile.curveMesh ) {

				this.trackGroup.remove( tile.curveMesh );
				tile.curveMesh = null;

			}

		}

		this._grid.delete( key );

	}

	/** @returns {Map<string, TrackTile>} */
	getGrid() {

		return this._grid;

	}

	/** @returns {number} */
	get tileCount() {

		return this._grid.size;

	}

	/** Clear all tiles and remove all meshes from the scene. */
	clear() {

		for ( const tile of this._grid.values() ) {

			if ( tile.mesh ) this.trackGroup.remove( tile.mesh );
			if ( tile.curveMesh ) this.trackGroup.remove( tile.curveMesh );

		}

		this._grid.clear();

	}

	// ── Serialization: v4 JSON ──

	/**
	 * Produce the v4 JSON save payload.
	 * Filters out auto-ramp cells, normalizes elevated types, strips defaults.
	 * @returns {object}
	 */
	toV4JSON() {

		const trackTiles = [];

		for ( const [ key, tile ] of this._grid ) {

			// Skip consumed cells and finish flanks (structural, not visual)
			if ( tile._consumed ) continue;
			if ( tile.finishFlank ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );

			// Keep the exact tile type — no normalization (editor is source of truth)
			let typeName = tile.type;

			// Curve tiles → normalize to corner + curveVariant (curves are derived)
			const CURVE_TO_VARIANT_V4 = {
				'trk-curve-2x2-l': '2x2-wide',
				'trk-curve-3x3-l': '3x3',
				'trk-curve-3x3-wide-l': '3x3-wide',
			};

			if ( CURVE_TO_VARIANT_V4[ typeName ] ) {

				tile.curveVariant = CURVE_TO_VARIANT_V4[ typeName ];
				tile.curveOverride = true;
				typeName = 'trk-corner-1x1';

			}

			const t = V4_TYPE_INDEX[ typeName ] ?? 0;
			const o = INTERNAL_TO_V4[ tile.orient ] ?? 0;

			const entry = { gx, gz, t, o };

			// Elevation (only if not ground)
			if ( tile.elevation !== ELEV_GROUND ) {

				entry.e = tile.elevation;

			}

			// Flags byte
			let f = 0;
			if ( tile.curveOverride ) f |= 0x01;
			if ( tile.rotationOverride ) f |= 0x02;
			if ( tile.rampStyle === 'smooth' ) f |= 0x04;

			const cv = CURVE_VARIANT_ENCODE[ tile.curveVariant ];
			if ( cv ) f |= ( cv << 3 );

			if ( f !== 0 ) entry.f = f;

			trackTiles.push( entry );

		}

		return {
			v: 4,
			meta: { ...this.meta, updatedAt: new Date().toISOString() },
			trackTiles,
			decorTiles: [],
			props: this._pendingProps || [],
			markers: this._pendingMarkers || [],
		};

	}

	/**
	 * Load a v4 JSON payload into this project. Clears existing data first.
	 * Note: caller must run deriveRamps + deriveCurves after this.
	 * @param {object} json
	 */
	loadFromV4JSON( json ) {

		this.clear();

		// Metadata
		if ( json.meta ) {

			Object.assign( this.meta, json.meta );

		}

		// Store markers and props for modes to consume after init
		this._pendingMarkers = json.markers || null;
		this._pendingProps = json.props || null;

		// Track tiles
		for ( const entry of ( json.trackTiles || [] ) ) {

			const type = V4_TYPE_NAMES[ entry.t ] ?? 'trk-straight';
			const orient = V4_TO_INTERNAL[ entry.o ] ?? 0;
			const elevation = entry.e ?? ELEV_GROUND;

			const tile = new TrackTile( type, orient, elevation );

			// Unpack flags
			const f = entry.f ?? 0;
			tile.curveOverride = !! ( f & 0x01 );
			tile.rotationOverride = !! ( f & 0x02 );
			if ( f & 0x04 ) tile.rampStyle = 'smooth';

			const cvCode = ( f >> 3 ) & 0x07;
			if ( cvCode && CURVE_VARIANT_DECODE[ cvCode ] ) {

				tile.curveVariant = CURVE_VARIANT_DECODE[ cvCode ];

			}

			// Finish flag
			if ( type === 'trk-finish' ) tile.isFinish = true;

			this.setTile( entry.gx, entry.gz, tile );

		}

	}

	/**
	 * Build the cells array for the v5 encoder.
	 * ALL tiles are included (ramps, elevated, etc.) — no filtering, no type normalization.
	 * The game renders exactly what the editor has.
	 * Format: [gx, gz, typeName, orient, flags]
	 * @returns {Array}
	 */
	getCellsArray() {

		const result = [];

		for ( const [ key, tile ] of this._grid ) {

			// Only skip consumed multi-tile cells and finish flanks (those are structural)
			if ( tile._consumed ) continue;
			if ( tile.finishFlank ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );

			// Keep the EXACT tile type — no normalization
			let typeName = tile.type;

			// Curve tiles → normalize to corner + curveVariant (curves are derived from corners)
			const CURVE_TO_VARIANT = {
				'trk-curve-2x2-l': '2x2-wide',
				'trk-curve-3x3-l': '3x3',
				'trk-curve-3x3-wide-l': '3x3-wide',
			};

			if ( CURVE_TO_VARIANT[ typeName ] ) {

				tile.curveVariant = CURVE_TO_VARIANT[ typeName ];
				tile.curveOverride = true;
				typeName = 'trk-corner-1x1';

			}

			const elevStep = tile.elevation ?? ELEV_GROUND;
			const stepsAboveGround = elevStep - ELEV_GROUND;
			let v3Elev = 0;
			if ( stepsAboveGround === 1 ) v3Elev = 1;
			else if ( stepsAboveGround >= 2 ) v3Elev = 2;

			const flags = {};
			if ( v3Elev !== 0 ) flags.elevation = v3Elev;
			flags.fullElevation = elevStep;
			if ( tile.curveOverride ) flags.curveOverride = true;
			if ( tile.rotationOverride ) flags.rotationOverride = true;
			if ( tile.rampStyle === 'smooth' ) flags.rampStyle = 'smooth';
			if ( tile.curveVariant ) flags.curveVariant = tile.curveVariant;

			result.push( [ gx, gz, typeName, tile.orient, flags ] );

		}

		return result;

	}

	/**
	 * Create a TrackProject from v3 decoded cells.
	 * @param {Array} cells  Array of [gx, gz, typeName, orient, flags]
	 * @returns {TrackProject}
	 */
	static fromV3Cells( cells ) {

		const project = new TrackProject();

		for ( const [ gx, gz, typeName, orient, flags ] of cells ) {

			// Map v3 elevation (0,1,2) to v4 step index
			const v3Elev = flags?.elevation ?? 0;
			const elevation = v3Elev === 0 ? ELEV_GROUND
				: v3Elev === 1 ? 13
					: 14;

			const tile = new TrackTile( typeName, orient, elevation );

			if ( flags ) {

				if ( flags.curveOverride ) tile.curveOverride = true;
				if ( flags.rotationOverride ) tile.rotationOverride = true;
				if ( flags.rampStyle ) tile.rampStyle = flags.rampStyle;
				if ( flags.curveVariant ) tile.curveVariant = flags.curveVariant;

			}

			if ( typeName === 'trk-finish' ) tile.isFinish = true;

			project.setTile( gx, gz, tile );

		}

		return project;

	}

}

// Export constants for use by other modules
export {
	ELEV_STEP, ELEV_GROUND,
	V4_TYPE_NAMES, V4_TYPE_INDEX,
	V4_TO_INTERNAL, INTERNAL_TO_V4,
	CURVE_VARIANT_ENCODE, CURVE_VARIANT_DECODE,
};
