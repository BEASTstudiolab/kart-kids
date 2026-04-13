// ─── TrackProject ────────────────────────────────────────────────────────────
// Root editable project object. Owns the grid Map, Three.js track group,
// and project metadata. Handles serialization to/from v4 JSON format.

import * as THREE from 'three';
import { TrackTile } from './TrackTile.js';
import { getFinishRoadCells } from '../../TrackOrientation.js';
import {
	ELEV_STEP,
	ELEV_GROUND,
	V4_TYPE_NAMES,
	V4_TYPE_INDEX,
	V4_TO_INTERNAL,
	INTERNAL_TO_V4,
	CURVE_VARIANT_ENCODE,
	CURVE_VARIANT_DECODE,
} from './TrackV4Format.js';


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

			if ( tile._consumed ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );

			// Keep the exact tile type — no normalization (editor is source of truth)
			const typeName = tile.type;

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

		// Restore finish road cells — the 3x1 finish model covers 3 cells
		// along the road but only the center is saved as trk-finish.
		// Add invisible straights at the two road-direction neighbors.
		this._restoreFinishRoadCells();

	}

	/** @private Ensure the finish tile has road cells along its road direction. */
	_restoreFinishRoadCells() {

		for ( const [ key, tile ] of this._grid ) {

			if ( ! tile.isFinish ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const roadCells = getFinishRoadCells( gx, gz, tile.orient );

			for ( const r of roadCells ) {

				if ( ! this._grid.has( this.cellKey( r.gx, r.gz ) ) ) {

					const road = new TrackTile( 'trk-straight', tile.orient );
					road.mesh = null;
					this.setTile( r.gx, r.gz, road );

				}

			}

		}

	}

	/**
	 * Build a cells array for TrackIntel and game consumption.
	 * Format: [gx, gz, typeName, orient, flags]
	 * @returns {Array}
	 */
	getCellsArray() {

		const result = [];

		for ( const [ key, tile ] of this._grid ) {

			if ( tile._consumed ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );

			const flags = { fullElevation: tile.elevation ?? ELEV_GROUND };
			if ( tile.curveOverride ) flags.curveOverride = true;
			if ( tile.rotationOverride ) flags.rotationOverride = true;
			if ( tile.rampStyle === 'smooth' ) flags.rampStyle = 'smooth';
			if ( tile.curveVariant ) flags.curveVariant = tile.curveVariant;

			result.push( [ gx, gz, tile.type, tile.orient, flags ] );

		}

		return result;

	}

}

export {
	ELEV_STEP, ELEV_GROUND,
	V4_TYPE_NAMES, V4_TYPE_INDEX,
	V4_TO_INTERNAL, INTERNAL_TO_V4,
	CURVE_VARIANT_ENCODE, CURVE_VARIANT_DECODE,
};
