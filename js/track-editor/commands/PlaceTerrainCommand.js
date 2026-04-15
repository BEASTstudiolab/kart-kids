import { Command } from '../core/Command.js';
import { TerrainTile } from '../models/TerrainTile.js';

export class PlaceTerrainCommand extends Command {

	constructor( project, gx, gz, type, orient, elevation, meshFactory, eventBus ) {

		super();
		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._type = type;
		this._orient = orient;
		this._elevation = elevation;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		/** @type {TerrainTile|null} */
		this._prevTile = null;

	}

	execute() {

		const existing = this._project.getTerrainTile( this._gx, this._gz );
		this._prevTile = existing ? existing.clone() : null;

		if ( existing?.mesh ) {

			this._project.terrainGroup.remove( existing.mesh );

		}

		const tile = new TerrainTile( this._type, this._orient, this._elevation );
		this._project.setTerrainTile( this._gx, this._gz, tile );
		this._meshFactory.createTerrainMesh( this._gx, this._gz, tile );
		this._eventBus.emit( 'terrain:placed', { gx: this._gx, gz: this._gz, tile } );

	}

	undo() {

		const current = this._project.getTerrainTile( this._gx, this._gz );
		if ( current?.mesh ) {

			this._project.terrainGroup.remove( current.mesh );

		}

		if ( this._prevTile ) {

			this._project.setTerrainTile( this._gx, this._gz, this._prevTile );
			this._meshFactory.createTerrainMesh( this._gx, this._gz, this._prevTile );

		} else {

			this._project.deleteTerrainTile( this._gx, this._gz );

		}

		this._eventBus.emit( 'terrain:erased', { gx: this._gx, gz: this._gz } );

	}

	get description() { return `Place terrain at ${ this._gx },${ this._gz }`; }

}
