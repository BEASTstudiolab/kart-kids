import { Command } from '../core/Command.js';

export class EraseTerrainCommand extends Command {

	constructor( project, gx, gz, meshFactory, eventBus ) {

		super();
		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		this._prevTile = null;

	}

	execute() {

		const tile = this._project.getTerrainTile( this._gx, this._gz );
		if ( ! tile ) return;

		this._prevTile = tile.clone();
		this._project.deleteTerrainTile( this._gx, this._gz );
		this._eventBus.emit( 'terrain:erased', { gx: this._gx, gz: this._gz, prevTile: tile } );

	}

	undo() {

		if ( ! this._prevTile ) return;

		this._project.setTerrainTile( this._gx, this._gz, this._prevTile );
		this._meshFactory.createTerrainMesh( this._gx, this._gz, this._prevTile );
		this._eventBus.emit( 'terrain:placed', { gx: this._gx, gz: this._gz, tile: this._prevTile } );

	}

	get description() { return `Erase terrain at ${ this._gx },${ this._gz }`; }

}
