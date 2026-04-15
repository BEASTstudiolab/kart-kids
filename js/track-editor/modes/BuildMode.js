// ─── BuildMode ───────────────────────────────────────────────────────────────
// Primary mode for laying out track tiles.
// Tools: Road, Erase, Finish, Special, Terrain, Elevate, Eyedropper.

import { EditorMode } from './EditorMode.js';

const ELEV_DRAG_PX_PER_STEP = 30;

export class BuildMode extends EditorMode {

	constructor( editorState, eventBus, placement, commandHistory ) {

		super( editorState, eventBus );
		this._placement = placement;
		this._commandHistory = commandHistory;
		this._elevCtrl = null;
		this._gameplayMode = null;

		this._isDragging = false;
		this._dragCommands = [];
		// Elevation drag state
		this._elevDragStartY = 0;
		this._elevDragCell = null;
		this._elevDragStartElev = 0;
		this._elevDragCurrentElev = 0;
		this._isElevDragging = false;

	}

	setElevationController( elevCtrl ) { this._elevCtrl = elevCtrl; }
	setGameplayMode( gameplayMode ) { this._gameplayMode = gameplayMode; }

	enter() {

		const valid = [ 'road', 'erase', 'finish', 'special', 'terrain', 'elevate', 'eyedropper' ];
		if ( ! valid.includes( this._state.tool ) ) this._state.tool = 'road';

	}

	exit() {

		this._placement.clearGhost();
		this._isElevDragging = false;

	}

	getTools() {

		return [
			{ id: 'road', name: 'Road', icon: 'pencil' },
			{ id: 'erase', name: 'Erase', icon: 'eraser' },
			{ id: 'finish', name: 'Finish', icon: 'flag' },
			{ id: 'special', name: 'Special', icon: 'puzzle' },
			{ id: 'terrain', name: 'Terrain', icon: 'grid' },
			{ id: 'elevate', name: 'Elevate', icon: 'arrow-up' },
		];

	}

	handlePointerDown( gx, gz, event ) {

		const tool = this._state.tool;

		if ( tool === 'road' ) {

			this._isDragging = true;
			this._dragCommands = [];
			this._placeAt( gx, gz );

		} else if ( tool === 'erase' ) {

			this._isDragging = true;
			this._dragCommands = [];
			this._eraseAt( gx, gz );

		} else if ( tool === 'finish' ) {

			this._placement.placeFinishAt( gx, gz );

		} else if ( tool === 'special' ) {

			const tileType = this._state.selectedTileType;
			if ( tileType ) this._placement.placeSpecialTile( gx, gz, tileType );

		} else if ( tool === 'terrain' ) {

			this._isDragging = true;
			this._dragCommands = [];
			this._placeTerrainAt( gx, gz );

		} else if ( tool === 'eyedropper' ) {

			const tile = this._placement._project.getTile( gx, gz );
			if ( tile && ! tile._consumed && ! tile.autoRamp ) {

				this._state.selectedTileType = tile.type;
				this._state.tool = ( tile.type === 'trk-straight' || tile.type === 'trk-corner-1x1' ) ? 'road' : 'special';
				this._eventBus.emit( 'eyedropper:picked', { type: tile.type } );

			}

		} else if ( tool === 'elevate' && this._elevCtrl ) {

			const tile = this._placement._project.getTile( gx, gz );
			if ( tile && this._elevCtrl.canElevate( gx, gz ) ) {

				this._isElevDragging = true;
				this._elevDragStartY = event.clientY;
				this._elevDragCell = { gx, gz };
				this._elevDragStartElev = tile.elevation;
				this._elevDragCurrentElev = tile.elevation;
				this._placement.setElevationHighlight( gx, gz );

			} else if ( ! event.shiftKey ) {

				this._elevCtrl.raiseElevation( gx, gz );
				this._placement.setElevationHighlight( gx, gz );

			}

		}

	}

	handlePointerMove( gx, gz, event ) {

		const tool = this._state.tool;

		// Elevation drag
		if ( this._isElevDragging && this._elevDragCell ) {

			const deltaY = this._elevDragStartY - event.clientY;
			const deltaSteps = Math.round( deltaY / ELEV_DRAG_PX_PER_STEP );
			const targetElev = Math.max( 0, Math.min( 24, this._elevDragStartElev + deltaSteps ) );

			if ( targetElev !== this._elevDragCurrentElev ) {

				const { gx: cx, gz: cz } = this._elevDragCell;

				while ( this._elevDragCurrentElev < targetElev ) {

					if ( this._elevCtrl.raiseElevation( cx, cz ) === null ) break;
					this._elevDragCurrentElev ++;

				}

				while ( this._elevDragCurrentElev > targetElev ) {

					if ( this._elevCtrl.lowerElevation( cx, cz ) === null ) break;
					this._elevDragCurrentElev --;

				}

				this._placement.setElevationHighlight( cx, cz );

			}

			return;

		}

		if ( this._isDragging ) {

			if ( tool === 'road' ) this._placeAt( gx, gz );
			else if ( tool === 'terrain' ) this._placeTerrainAt( gx, gz );
			else if ( tool === 'erase' ) this._eraseAt( gx, gz );

		} else {

			this._placement.updateGhost( gx, gz, tool, this._state.selectedTileType );

		}

	}

	handlePointerUp() {

		this._isDragging = false;
		this._dragCommands = [];
		this._isElevDragging = false;
		this._elevDragCell = null;

	}

	handleKeyDown( code ) {

		// R key: cycle placement orientation (0 → 16 → 10 → 22 → 0)
		if ( code === 'KeyR' ) {

			const ORIENT_CYCLE = { 0: 16, 16: 10, 10: 22, 22: 0 };
			this._state.selectedOrient = ORIENT_CYCLE[ this._state.selectedOrient ] ?? 0;

			// Force ghost to update with new orient
			this._placement.clearGhost();
			return true;

		}

		if ( code === 'Equal' || code === 'NumpadAdd' ) {

			if ( this._state.hoveredCell && this._elevCtrl ) {

				const { gx, gz } = this._state.hoveredCell;
				if ( this._elevCtrl.canElevate( gx, gz ) ) {

					this._elevCtrl.raiseElevation( gx, gz );
					return true;

				}

			}

			this._state.activeElevation = this._state.activeElevation + 1;
			return true;

		}

		if ( code === 'Minus' || code === 'NumpadSubtract' ) {

			if ( this._state.hoveredCell && this._elevCtrl ) {

				const { gx, gz } = this._state.hoveredCell;
				if ( this._elevCtrl.canElevate( gx, gz ) ) {

					this._elevCtrl.lowerElevation( gx, gz );
					return true;

				}

			}

			this._state.activeElevation = this._state.activeElevation - 1;
			return true;

		}

		return false;

	}

	/** @private */
	_placeAt( gx, gz ) {

		const cmd = this._placement.placeRoad( gx, gz );
		if ( cmd ) this._dragCommands.push( cmd );

	}

	/** @private */
	_eraseAt( gx, gz ) {

		const removedMarkers = this._gameplayMode?.removeMarkersAt?.( gx, gz ) ?? 0;
		if ( removedMarkers > 0 ) return;

		const cmd = this._placement.eraseRoad( gx, gz );
		if ( cmd ) this._dragCommands.push( cmd );

	}

	/** @private */
	_placeTerrainAt( gx, gz ) {

		const cmd = this._placement.placeTerrain( gx, gz );
		if ( cmd ) this._dragCommands.push( cmd );

	}

}
