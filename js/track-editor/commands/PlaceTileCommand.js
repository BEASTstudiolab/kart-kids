// ─── PlaceTileCommand ────────────────────────────────────────────────────────
// Places the user's selected tile at (gx, gz) with their chosen orientation.
// Pure manual placement — no auto-tile, no neighbor scanning.

import { Command } from '../core/Command.js';
import { TrackTile } from '../models/TrackTile.js';

export class PlaceTileCommand {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {number} gx
	 * @param {number} gz
	 * @param {string} tileType     Exact tile type from carousel selection
	 * @param {number} orient       Exact orientation (0, 16, 10, or 22)
	 * @param {number} elevation    Elevation step index (12 = ground)
	 * @param {import('../services/MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, gx, gz, tileType, orient, elevation, meshFactory, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._tileType = tileType;
		this._orient = orient;
		this._elevation = elevation;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		/** @type {TrackTile|null} Previous tile at this cell (for undo) */
		this._prevTile = null;

	}

	execute() {

		const { _project: project, _gx: gx, _gz: gz } = this;

		// Snapshot what was here before
		const existing = project.getTile( gx, gz );
		this._prevTile = existing ? existing.clone() : null;

		// Remove old mesh if replacing
		if ( existing && existing.mesh ) {

			project.trackGroup.remove( existing.mesh );

		}

		// Place the exact tile the user selected
		const tile = new TrackTile( this._tileType, this._orient, this._elevation );
		project.setTile( gx, gz, tile );

		// Build mesh — no auto-resolve, no neighbor changes
		this._meshFactory.createTileMesh( gx, gz, tile );

		this._eventBus.emit( 'tile:placed', { gx, gz, tile } );

	}

	undo() {

		const { _project: project, _gx: gx, _gz: gz } = this;

		// Remove current tile mesh
		const current = project.getTile( gx, gz );
		if ( current && current.mesh ) {

			project.trackGroup.remove( current.mesh );

		}

		if ( this._prevTile ) {

			// Restore previous tile
			project.setTile( gx, gz, this._prevTile );
			this._meshFactory.createTileMesh( gx, gz, this._prevTile );

		} else {

			// Cell was empty before
			project.getGrid().delete( project.cellKey( gx, gz ) );

		}

		this._eventBus.emit( 'tile:erased', { gx, gz } );

	}

	get description() { return `Place ${ this._tileType } at ${ this._gx },${ this._gz }`; }

}
