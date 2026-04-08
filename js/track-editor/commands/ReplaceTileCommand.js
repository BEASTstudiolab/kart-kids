// ─── ReplaceTileCommand ──────────────────────────────────────────────────────
// Replaces a tile's type in-place, preserving elevation, orient, and flags.

import { Command } from '../core/Command.js';

export class ReplaceTileCommand {

	constructor( project, gx, gz, newType, meshFactory, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._newType = newType;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		this._prevType = null;

	}

	execute() {

		const tile = this._project.getTile( this._gx, this._gz );
		if ( ! tile || tile._consumed || tile.autoRamp || tile.finishFlank ) return;

		this._prevType = tile.type;
		tile.type = this._newType;
		this._meshFactory.createTileMesh( this._gx, this._gz, tile );
		this._eventBus.emit( 'tile:changed', { gx: this._gx, gz: this._gz, tile } );

	}

	undo() {

		if ( this._prevType === null ) return;

		const tile = this._project.getTile( this._gx, this._gz );
		if ( ! tile ) return;

		tile.type = this._prevType;
		this._meshFactory.createTileMesh( this._gx, this._gz, tile );
		this._eventBus.emit( 'tile:changed', { gx: this._gx, gz: this._gz, tile } );

	}

	get description() { return `Replace tile at ${ this._gx },${ this._gz } with ${ this._newType }`; }

}
