// ─── ClearAllCommand ─────────────────────────────────────────────────────────
// Clears the entire grid. Full snapshot for undo.

import { Command } from '../core/Command.js';

export class ClearAllCommand {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('../services/MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, meshFactory, eventBus ) {

		this._project = project;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		/** @type {Map<string, import('../models/TrackTile.js').TrackTile>} */
		this._beforeSnapshot = new Map();

	}

	execute() {

		// Full snapshot
		for ( const [ key, tile ] of this._project.getGrid() ) {

			this._beforeSnapshot.set( key, tile.clone() );

		}

		this._project.clear();
		this._eventBus.emit( 'project:cleared' );

	}

	undo() {

		this._project.clear();

		for ( const [ key, snapshot ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			this._project.setTile( gx, gz, snapshot );
			this._meshFactory.createTileMesh( gx, gz, snapshot );

		}

		this._eventBus.emit( 'project:loaded', { project: this._project } );

	}

	get description() { return 'Clear all tiles'; }

}
