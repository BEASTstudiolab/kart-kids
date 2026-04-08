// ─── EraseTileCommand ────────────────────────────────────────────────────────
// Erases a tile at (gx, gz), handles cascade deletions, re-resolves neighbors.

import { Command } from '../core/Command.js';

export class EraseTileCommand {

	constructor( project, gx, gz, meshFactory, autoTile, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._meshFactory = meshFactory;
		this._autoTile = autoTile;
		this._eventBus = eventBus;

		/** @type {Map<string, import('../models/TrackTile.js').TrackTile|null>} */
		this._beforeSnapshot = new Map();

	}

	execute() {

		const { _project: project, _gx: gx, _gz: gz } = this;

		const tile = project.getTile( gx, gz );
		if ( ! tile ) return;
		if ( tile._consumed ) return;

		// All tiles are manually placed and can be erased

		// Snapshot affected area
		this._takeWideSnapshot( gx, gz, tile );

		// Handle finish: remove center + flanks
		if ( tile.isFinish ) {

			const footprint = tile.getFootprintCells( gx, gz );
			for ( const cell of footprint ) {

				project.deleteTile( cell.gx, cell.gz );

			}

		} else {

			project.deleteTile( gx, gz );

		}

		// No auto-resolve — neighbors stay as they are (manual placement mode)

		this._eventBus.emit( 'tile:erased', { gx, gz, prevTile: tile } );

	}

	undo() {

		const trackGroup = this._project.trackGroup;

		// First pass: remove ALL meshes for affected cells
		for ( const [ key ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const current = this._project.getTile( gx, gz );
			if ( ! current ) continue;

			if ( current.mesh ) {

				trackGroup.remove( current.mesh );
				current.mesh = null;

			}

			if ( current.curveMesh ) {

				trackGroup.remove( current.curveMesh );
				current.curveMesh = null;

			}

		}

		// Second pass: restore from snapshot
		for ( const [ key, snapshot ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );

			this._project.getGrid().delete( key );

			if ( snapshot ) {

				this._project.setTile( gx, gz, snapshot );
				this._meshFactory.createTileMesh( gx, gz, snapshot );

			}

		}

		this._eventBus.emit( 'tile:placed', { gx: this._gx, gz: this._gz } );

	}

	get description() { return `Erase tile at ${ this._gx },${ this._gz }`; }

	/** @private */
	_takeWideSnapshot( gx, gz, tile ) {

		const footprint = tile.getFootprintCells( gx, gz );
		const keysToSnapshot = new Set();

		for ( const cell of footprint ) {

			keysToSnapshot.add( this._project.cellKey( cell.gx, cell.gz ) );

			const deltas = [ [ 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ - 1, 0 ] ];
			for ( const [ dx, dz ] of deltas ) {

				keysToSnapshot.add( this._project.cellKey( cell.gx + dx, cell.gz + dz ) );

			}

		}

		for ( const key of keysToSnapshot ) {

			const [ cx, cz ] = key.split( ',' ).map( Number );
			const t = this._project.getTile( cx, cz );
			this._beforeSnapshot.set( key, t ? t.clone() : null );

		}

	}

}
