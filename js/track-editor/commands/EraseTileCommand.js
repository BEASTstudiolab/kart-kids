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

		const { _project: project } = this;
		let { _gx: gx, _gz: gz } = this;

		let tile = project.getTile( gx, gz );
		if ( ! tile ) return;

		// If consumed cell, find the anchor tile that owns this footprint
		if ( tile._consumed ) {

			const anchor = this._findAnchor( gx, gz );
			if ( ! anchor ) return;
			gx = anchor.gx;
			gz = anchor.gz;
			tile = project.getTile( gx, gz );
			if ( ! tile ) return;

		}

		// Snapshot affected area
		this._takeWideSnapshot( gx, gz, tile );

		// Delete all footprint cells (handles finish 3x1, junction 3x3, 2x2 curves, etc.)
		const footprint = tile.getFootprintCells( gx, gz );
		for ( const cell of footprint ) {

			project.deleteTile( cell.gx, cell.gz );

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

	/** @private Find the anchor tile that owns a consumed cell at (gx, gz). */
	_findAnchor( gx, gz ) {

		const project = this._project;

		// Search nearby cells for a non-consumed tile whose footprint includes (gx, gz)
		for ( let dx = - 2; dx <= 2; dx ++ ) {

			for ( let dz = - 2; dz <= 2; dz ++ ) {

				const ax = gx + dx;
				const az = gz + dz;
				const candidate = project.getTile( ax, az );
				if ( ! candidate || candidate._consumed ) continue;

				const footprint = candidate.getFootprintCells( ax, az );
				for ( const cell of footprint ) {

					if ( cell.gx === gx && cell.gz === gz ) {

						return { gx: ax, gz: az };

					}

				}

			}

		}

		return null;

	}

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
