// ─── PlaceSpecialTileCommand ─────────────────────────────────────────────────
// Places a special tile (junction, bridge, tunnel, jump, chicane).

import { Command } from '../core/Command.js';
import { TrackTile, TILES_3X3, TILES_2X2 } from '../models/TrackTile.js';

export class PlaceSpecialTileCommand {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {number} gx
	 * @param {number} gz
	 * @param {string} tileType
	 * @param {import('../services/MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../services/AutoTileService.js').AutoTileService} autoTile
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, gx, gz, tileType, meshFactory, autoTile, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._tileType = tileType;
		this._meshFactory = meshFactory;
		this._autoTile = autoTile;
		this._eventBus = eventBus;

		/** @type {Map<string, import('../models/TrackTile.js').TrackTile|null>} */
		this._beforeSnapshot = new Map();

	}

	execute() {

		const { _project: project, _gx: gx, _gz: gz, _tileType: tileType } = this;

		const tile = new TrackTile( tileType, 0 );

		// Snapshot and check footprint
		const footprint = tile.getFootprintCells( gx, gz );

		for ( const cell of footprint ) {

			const key = project.cellKey( cell.gx, cell.gz );
			const existing = project.getTile( cell.gx, cell.gz );
			this._beforeSnapshot.set( key, existing ? existing.clone() : null );

		}

		// Also snapshot neighbors of footprint
		for ( const cell of footprint ) {

			const deltas = [ [ 0, -1 ], [ 0, 1 ], [ 1, 0 ], [ -1, 0 ] ];
			for ( const [ dx, dz ] of deltas ) {

				const key = project.cellKey( cell.gx + dx, cell.gz + dz );
				if ( !this._beforeSnapshot.has( key ) ) {

					const nt = project.getTile( cell.gx + dx, cell.gz + dz );
					this._beforeSnapshot.set( key, nt ? nt.clone() : null );

				}

			}

		}

		// Check for conflicts
		for ( const cell of footprint ) {

			const existing = project.getTile( cell.gx, cell.gz );
			if ( existing && !existing._consumed && existing.type !== 'trk-straight' ) {

				// Conflict — skip placement
				return;

			}

		}

		// Place the anchor tile
		project.setTile( gx, gz, tile );
		this._meshFactory.createTileMesh( gx, gz, tile );

		// For multi-cell tiles (3x3 or 2x2), mark consumed cells
		if ( TILES_3X3.has( tileType ) || TILES_2X2.has( tileType ) ) {

			for ( const cell of footprint ) {

				if ( cell.gx === gx && cell.gz === gz ) continue;

				let consumed = project.getTile( cell.gx, cell.gz );
				if ( consumed ) {

					if ( consumed.mesh ) project.trackGroup.remove( consumed.mesh );

				}

				consumed = new TrackTile( tileType, 0 );
				consumed._consumed = true;
				consumed.mesh = null;
				project.setTile( cell.gx, cell.gz, consumed );

			}

		}

		this._eventBus.emit( 'tile:placed', { gx, gz, tile } );

	}

	undo() {

		for ( const [ key, snapshot ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const current = this._project.getTile( gx, gz );

			if ( current ) {

				if ( current.mesh ) this._project.trackGroup.remove( current.mesh );

			}

			if ( snapshot ) {

				this._project.setTile( gx, gz, snapshot );
				this._meshFactory.createTileMesh( gx, gz, snapshot );

			} else {

				this._project.deleteTile( gx, gz );

			}

		}

		this._eventBus.emit( 'tile:erased', { gx: this._gx, gz: this._gz } );

	}

	get description() { return `Place ${this._tileType} at ${this._gx},${this._gz}`; }

}
