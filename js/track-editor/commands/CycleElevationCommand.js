// ─── CycleElevationCommand ───────────────────────────────────────────────────
// Cycles elevation on a straight tile. Uses full grid snapshot because
// elevation changes affect the entire elevated run + ramps.

import { Command } from '../core/Command.js';

export class CycleElevationCommand {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {number} gx
	 * @param {number} gz
	 * @param {import('../services/ElevationController.js').ElevationController} elevCtrl
	 * @param {import('../services/MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, gx, gz, elevCtrl, meshFactory, eventBus ) {

		this._project = project;
		this._gx = gx;
		this._gz = gz;
		this._elevCtrl = elevCtrl;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

		/** @type {Map<string, import('../models/TrackTile.js').TrackTile|null>} */
		this._beforeSnapshot = new Map();
		this._executed = false;

	}

	execute() {

		// Full grid snapshot (elevation affects many cells)
		for ( const [ key, tile ] of this._project.getGrid() ) {

			this._beforeSnapshot.set( key, tile.clone() );

		}

		const result = this._elevCtrl.cycleElevation( this._gx, this._gz );
		this._executed = result !== null;

	}

	undo() {

		if ( !this._executed ) return;

		// Remove all current meshes
		for ( const [ , tile ] of this._project.getGrid() ) {

			if ( tile.mesh ) this._project.trackGroup.remove( tile.mesh );
			if ( tile.curveMesh ) this._project.trackGroup.remove( tile.curveMesh );

		}

		// Clear and restore
		this._project.getGrid().clear();

		for ( const [ key, snapshot ] of this._beforeSnapshot ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			this._project.setTile( gx, gz, snapshot );
			this._meshFactory.createTileMesh( gx, gz, snapshot );

		}

		this._eventBus.emit( 'elevation:changed', { gx: this._gx, gz: this._gz } );

	}

	get description() { return `Cycle elevation at ${this._gx},${this._gz}`; }

}
