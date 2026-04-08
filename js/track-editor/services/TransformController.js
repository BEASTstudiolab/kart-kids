// ─── TransformController ─────────────────────────────────────────────────────
// Handles tile rotation, deletion, and duplication for selected tiles.

import { RotateTileCommand } from '../commands/RotateTileCommand.js';
import { EraseTileCommand } from '../commands/EraseTileCommand.js';

export class TransformController {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('./MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('./AutoTileService.js').AutoTileService} autoTile
	 * @param {import('../core/CommandHistory.js').CommandHistory} commandHistory
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, meshFactory, autoTile, commandHistory, eventBus ) {

		this._project = project;
		this._meshFactory = meshFactory;
		this._autoTile = autoTile;
		this._commandHistory = commandHistory;
		this._eventBus = eventBus;

	}

	/**
	 * Rotate a tile at (gx, gz) clockwise by 90 degrees.
	 * @param {number} gx
	 * @param {number} gz
	 */
	rotateTile( gx, gz ) {

		const tile = this._project.getTile( gx, gz );
		if ( !tile || tile._consumed || tile.autoRamp ) return;

		const cmd = new RotateTileCommand(
			this._project, gx, gz,
			this._meshFactory, this._eventBus
		);

		this._commandHistory.execute( cmd );

	}

	/**
	 * Delete all selected tiles.
	 * @param {Set<string>} selection  Set of cell keys
	 */
	deleteSelected( selection ) {

		for ( const key of selection ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const tile = this._project.getTile( gx, gz );
			if ( !tile || tile._consumed || tile.autoRamp ) continue;

			const cmd = new EraseTileCommand(
				this._project, gx, gz,
				this._meshFactory, this._autoTile, this._eventBus
			);

			this._commandHistory.execute( cmd );

		}

	}

}
