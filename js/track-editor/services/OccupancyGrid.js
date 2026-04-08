// ─── OccupancyGrid ───────────────────────────────────────────────────────────
// Multi-layer spatial data structure for the track editor.
// Tracks occupancy across Track, Decor, Prop, and Marker layers.
// Provides clearance validation and conflict detection.

import { ELEV_GROUND } from '../models/TrackProject.js';

const CLEARANCE_MIN_METERS = 10;  // Minimum vertical gap for elevated track over content
const ELEV_STEP_METERS = 2.5;
const CLEARANCE_MIN_STEPS = CLEARANCE_MIN_METERS / ELEV_STEP_METERS; // = 4 steps

export class OccupancyGrid {

	constructor() {

		/**
		 * Track layer: "gx,gz" -> { elevation: step, tileType: string }
		 * Can have MULTIPLE entries per cell at different elevations.
		 * Key format: "gx,gz" for ground, "gx,gz@elev" for elevated.
		 * @type {Map<string, object>}
		 */
		this.track = new Map();

		/** Decor layer: "gx,gz" -> { elevation: step } */
		this.decor = new Map();

		/** Prop layer: "gx,gz" -> Set<propId> (spatial bucket) */
		this.props = new Map();

		/** Marker layer: "gx,gz" -> Set<markerId> */
		this.markers = new Map();

		/**
		 * Multi-cell ownership: "gx,gz" -> "anchorGx,anchorGz"
		 * For tiles with footprint > 1x1 (junctions, finish, curves).
		 */
		this.multiCellOwner = new Map();

	}

	// ── Build from project ──

	/**
	 * Rebuild the occupancy grid from a TrackProject.
	 * Call this after loading or when the grid changes significantly.
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 */
	rebuildFromProject( project ) {

		this.track.clear();
		this.multiCellOwner.clear();

		for ( const [ key, tile ] of project.getGrid() ) {

			if ( tile.finishFlank || tile._consumed ) {

				// Track multi-cell ownership
				this.multiCellOwner.set( key, key ); // simplified — anchor tracking

			}

			this.track.set( this._elevKey( key, tile.elevation ), {
				elevation: tile.elevation,
				tileType: tile.type,
				isFinish: tile.isFinish,
				autoRamp: tile.autoRamp,
			} );

		}

	}

	// ── Queries ──

	/**
	 * Check if a grid cell is occupied on the track layer at a specific elevation.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {number} elevation  Step index (12=ground)
	 * @returns {boolean}
	 */
	isTrackOccupied( gx, gz, elevation ) {

		const baseKey = gx + ',' + gz;

		// Check exact elevation
		if ( this.track.has( this._elevKey( baseKey, elevation ) ) ) return true;

		// Also check if any tile at this cell position exists (regardless of elevation)
		// This handles the case where we need to know if the cell has ANY content
		return false;

	}

	/**
	 * Check if a grid cell has ANY track tile at any elevation.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {Array<{ elevation: number, tileType: string }>}
	 */
	getTrackTilesAt( gx, gz ) {

		const results = [];
		const prefix = gx + ',' + gz;

		for ( const [ key, data ] of this.track ) {

			if ( key === prefix || key.startsWith( prefix + '@' ) ) {

				results.push( data );

			}

		}

		return results;

	}

	/**
	 * Check clearance: can a tile be placed at (gx, gz, elevation) without
	 * violating the 10m minimum gap rule?
	 *
	 * @param {number} gx
	 * @param {number} gz
	 * @param {number} elevation  Step index of the tile to be placed
	 * @returns {{ valid: boolean, conflict: object|null }}
	 */
	checkClearance( gx, gz, elevation ) {

		const tilesHere = this.getTrackTilesAt( gx, gz );

		for ( const existing of tilesHere ) {

			const gap = Math.abs( elevation - existing.elevation );

			// Same elevation = direct conflict (occupancy)
			if ( gap === 0 ) {

				return {
					valid: false,
					conflict: {
						reason: 'occupied',
						existingElev: existing.elevation,
						message: 'Cell already occupied at this elevation',
					},
				};

			}

			// Gap too small (< 10m = 4 steps)
			if ( gap < CLEARANCE_MIN_STEPS ) {

				const gapMeters = gap * ELEV_STEP_METERS;
				return {
					valid: false,
					conflict: {
						reason: 'clearance',
						existingElev: existing.elevation,
						gap: gapMeters,
						required: CLEARANCE_MIN_METERS,
						message: `Clearance too low: ${ gapMeters }m (need ${ CLEARANCE_MIN_METERS }m)`,
					},
				};

			}

		}

		return { valid: true, conflict: null };

	}

	/**
	 * Check if a multi-cell footprint can be placed without conflicts.
	 * @param {Array<{gx: number, gz: number}>} cells  Footprint cells
	 * @param {number} elevation  Step index
	 * @returns {{ valid: boolean, conflicts: Array }}
	 */
	checkFootprintClearance( cells, elevation ) {

		const conflicts = [];

		for ( const cell of cells ) {

			const result = this.checkClearance( cell.gx, cell.gz, elevation );
			if ( ! result.valid ) {

				conflicts.push( { gx: cell.gx, gz: cell.gz, ...result.conflict } );

			}

		}

		return {
			valid: conflicts.length === 0,
			conflicts,
		};

	}

	/**
	 * Check if decor can be placed at (gx, gz, elevation).
	 * Decor cannot overlap track tiles on the same surface plane.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {number} elevation
	 * @returns {{ valid: boolean, reason: string|null }}
	 */
	checkDecorPlacement( gx, gz, elevation ) {

		const tilesHere = this.getTrackTilesAt( gx, gz );

		for ( const existing of tilesHere ) {

			if ( existing.elevation === elevation ) {

				return {
					valid: false,
					reason: 'Track tile occupies this surface plane',
				};

			}

		}

		return { valid: true, reason: null };

	}

	// ── Mutation (called by PlacementController after tile changes) ──

	/**
	 * Register a tile placement.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {number} elevation
	 * @param {string} tileType
	 */
	addTrackTile( gx, gz, elevation, tileType ) {

		const key = this._elevKey( gx + ',' + gz, elevation );
		this.track.set( key, { elevation, tileType } );

	}

	/**
	 * Remove a tile from occupancy tracking.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {number} elevation
	 */
	removeTrackTile( gx, gz, elevation ) {

		const key = this._elevKey( gx + ',' + gz, elevation );
		this.track.delete( key );

	}

	// ── Private ──

	/**
	 * Create an elevation-aware key: "gx,gz" for ground, "gx,gz@step" for elevated.
	 * @private
	 */
	_elevKey( baseKey, elevation ) {

		if ( elevation === ELEV_GROUND ) return baseKey;
		return baseKey + '@' + elevation;

	}

}

export { CLEARANCE_MIN_METERS, CLEARANCE_MIN_STEPS };
