// ─── RotateTileCommand ───────────────────────────────────────────────────────
// Cycles a tile's orientation clockwise (0→16→10→22→0).

import { Command } from '../core/Command.js';
import { ORIENT_CYCLE } from '../services/AutoTileService.js';

export class RotateTileCommand {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {number} gx
	 * @param {number} gz
	 * @param {import('../services/MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, gx, gz, meshFactory, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		this._prevOrient = 0;
		this._prevRotationOverride = false;

	}

	execute() {

		const tile = this._project.getTile( this._gx, this._gz );
		if ( ! tile ) return;

		this._prevOrient = tile.orient;
		this._prevRotationOverride = tile.rotationOverride;

		tile.orient = ORIENT_CYCLE[ tile.orient ] ?? 0;
		tile.rotationOverride = true;

		this._meshFactory.updateTileMesh( this._gx, this._gz, tile );

		this._eventBus.emit( 'tile:rotated', {
			gx: this._gx,
			gz: this._gz,
			tile,
			prevOrient: this._prevOrient,
		} );

	}

	undo() {

		const tile = this._project.getTile( this._gx, this._gz );
		if ( ! tile ) return;

		tile.orient = this._prevOrient;
		tile.rotationOverride = this._prevRotationOverride;

		this._meshFactory.updateTileMesh( this._gx, this._gz, tile );

		this._eventBus.emit( 'tile:rotated', {
			gx: this._gx,
			gz: this._gz,
			tile,
			prevOrient: tile.orient,
		} );

	}

	get description() { return `Rotate tile at ${ this._gx },${ this._gz }`; }

}
