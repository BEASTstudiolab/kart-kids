// ─── SculptMode ──────────────────────────────────────────────────────────────
// For modifying placed tiles: select, box-select, rotate, elevate, duplicate, delete.

import * as THREE from 'three';
import { EditorMode } from './EditorMode.js';
import { TrackTile } from '../models/TrackTile.js';
import { CELL_RAW } from '../../TrackConstants.js';

export class SculptMode extends EditorMode {

	constructor( editorState, eventBus, selection, transform, elevation, curves, commandHistory, project, meshFactory ) {

		super( editorState, eventBus );
		this._selection = selection;
		this._transform = transform;
		this._elevation = elevation;
		this._curves = curves;
		this._commandHistory = commandHistory;
		this._project = project;
		this._meshFactory = meshFactory;

		// Box select state
		this._boxStart = null;
		this._boxDragging = false;
		this._boxRect = null;

		// Move state
		this._moveSource = null;
		this._moveDragging = false;

	}

	enter() {

		this._state.tool = 'rotate';

	}

	exit() {

		this._selection.clearSelection();
		this._clearBoxRect();

	}

	getTools() {

		return [
			{ id: 'select', name: 'Select', icon: 'pointer' },
			{ id: 'box-select', name: 'Box Select', icon: 'rectangle' },
			{ id: 'move', name: 'Move', icon: 'move' },
			{ id: 'rotate', name: 'Rotate', icon: 'rotate' },
			{ id: 'elevate-up', name: 'Raise', icon: 'arrow-up' },
			{ id: 'elevate-down', name: 'Lower', icon: 'arrow-down' },
			{ id: 'duplicate', name: 'Duplicate', icon: 'copy' },
			{ id: 'delete', name: 'Delete', icon: 'trash' },
		];

	}

	handlePointerDown( gx, gz, event ) {

		const tool = this._state.tool;

		if ( tool === 'rotate' ) {

			if ( event.shiftKey ) {

				this._transform.rotateTile( gx, gz );
				this._transform.rotateTile( gx, gz );
				this._transform.rotateTile( gx, gz );

			} else {

				this._transform.rotateTile( gx, gz );

			}

			this._selection.selectCell( gx, gz );

		} else if ( tool === 'select' ) {

			if ( event.shiftKey ) {

				this._selection.toggleCell( gx, gz );

			} else {

				this._selection.selectCell( gx, gz );

			}

		} else if ( tool === 'box-select' ) {

			this._boxStart = { gx, gz };
			this._boxDragging = true;

		} else if ( tool === 'elevate-up' ) {

			this._elevation.raiseElevation( gx, gz );
			this._selection.selectCell( gx, gz );

		} else if ( tool === 'elevate-down' ) {

			this._elevation.lowerElevation( gx, gz );
			this._selection.selectCell( gx, gz );

		} else if ( tool === 'duplicate' ) {

			this._duplicateTile( gx, gz );

		} else if ( tool === 'delete' ) {

			this._transform.deleteSelected( new Set( [ this._project.cellKey( gx, gz ) ] ) );

		} else if ( tool === 'move' ) {

			// Start move: pick up tile at this cell
			const tile = this._project.getTile( gx, gz );
			if ( tile && ! tile._consumed && ! tile.autoRamp && ! tile.finishFlank ) {

				this._moveSource = { gx, gz };
				this._moveDragging = true;
				this._selection.selectCell( gx, gz );

			}

		}

	}

	handlePointerMove( gx, gz, event ) {

		// Box select drag: draw visual rectangle
		if ( this._boxDragging && this._boxStart ) {

			this._drawBoxRect( this._boxStart.gx, this._boxStart.gz, gx, gz );

		}

	}

	handlePointerUp( event ) {

		// Finalize box select
		if ( this._boxDragging && this._boxStart ) {

			const cell = this._state.hoveredCell;
			if ( cell ) {

				this._selection.boxSelect(
					this._boxStart.gx, this._boxStart.gz,
					cell.gx, cell.gz
				);

			}

			this._boxDragging = false;
			this._boxStart = null;
			this._clearBoxRect();

		}

		// Finalize move
		if ( this._moveDragging && this._moveSource ) {

			const dest = this._state.hoveredCell;
			if ( dest && ( dest.gx !== this._moveSource.gx || dest.gz !== this._moveSource.gz ) ) {

				this._moveTile( this._moveSource.gx, this._moveSource.gz, dest.gx, dest.gz );

			}

			this._moveDragging = false;
			this._moveSource = null;

		}

	}

	handleKeyDown( code, event ) {

		if ( code === 'KeyR' ) {

			for ( const key of this._state.selection ) {

				const [ gx, gz ] = key.split( ',' ).map( Number );
				this._transform.rotateTile( gx, gz );

			}

			return true;

		}

		if ( code === 'Delete' || code === 'Backspace' ) {

			this._transform.deleteSelected( this._state.selection );
			this._selection.clearSelection();
			return true;

		}

		if ( code === 'Equal' || code === 'NumpadAdd' ) {

			for ( const key of this._state.selection ) {

				const [ gx, gz ] = key.split( ',' ).map( Number );
				this._elevation.raiseElevation( gx, gz );

			}

			return true;

		}

		if ( code === 'Minus' || code === 'NumpadSubtract' ) {

			for ( const key of this._state.selection ) {

				const [ gx, gz ] = key.split( ',' ).map( Number );
				this._elevation.lowerElevation( gx, gz );

			}

			return true;

		}

		if ( code === 'KeyD' && ! event.ctrlKey ) {

			for ( const key of this._state.selection ) {

				const [ gx, gz ] = key.split( ',' ).map( Number );
				this._duplicateTile( gx, gz );

			}

			return true;

		}

		return false;

	}

	/** @private Draw green wireframe rectangle during box select drag. */
	_drawBoxRect( startGx, startGz, endGx, endGz ) {

		this._clearBoxRect();

		const minGx = Math.min( startGx, endGx );
		const maxGx = Math.max( startGx, endGx );
		const minGz = Math.min( startGz, endGz );
		const maxGz = Math.max( startGz, endGz );

		const w = ( maxGx - minGx + 1 ) * CELL_RAW;
		const d = ( maxGz - minGz + 1 ) * CELL_RAW;
		const cx = ( minGx + ( maxGx - minGx + 1 ) / 2 ) * CELL_RAW;
		const cz = ( minGz + ( maxGz - minGz + 1 ) / 2 ) * CELL_RAW;

		const geo = new THREE.BoxGeometry( w, 0.5, d );
		const edgeMat = new THREE.LineBasicMaterial( { color: 0x00d4e8, transparent: true, opacity: 0.8 } );
		this._boxRect = new THREE.LineSegments( new THREE.EdgesGeometry( geo ), edgeMat );
		this._boxRect.position.set( cx, 0.25, cz );

		this._selection.indicatorGroup.add( this._boxRect );

	}

	/** @private */
	_clearBoxRect() {

		if ( this._boxRect ) {

			this._selection.indicatorGroup.remove( this._boxRect );
			this._boxRect = null;

		}

	}

	/** @private Move a tile from one cell to another. */
	_moveTile( fromGx, fromGz, toGx, toGz ) {

		const tile = this._project.getTile( fromGx, fromGz );
		if ( ! tile ) return;

		// Check destination is empty
		const dest = this._project.getTile( toGx, toGz );
		if ( dest && ! dest._consumed ) return;

		// Remove old mesh
		if ( tile.mesh ) {

			this._project.trackGroup.remove( tile.mesh );
			tile.mesh = null;

		}

		// Move in grid
		this._project.getGrid().delete( this._project.cellKey( fromGx, fromGz ) );
		this._project.setTile( toGx, toGz, tile );

		// Rebuild mesh at new position
		this._meshFactory.createTileMesh( toGx, toGz, tile );

		this._selection.selectCell( toGx, toGz );
		this._eventBus.emit( 'tile:placed', { gx: toGx, gz: toGz, tile } );
		this._eventBus.emit( 'tile:erased', { gx: fromGx, gz: fromGz } );

	}

	/** @private Duplicate a tile to the first free adjacent cell. */
	_duplicateTile( gx, gz ) {

		const tile = this._project.getTile( gx, gz );
		if ( ! tile || tile._consumed || tile.autoRamp || tile.finishFlank ) return;

		const offsets = [ [ 1, 0 ], [ 0, 1 ], [ - 1, 0 ], [ 0, - 1 ] ];
		for ( const [ dx, dz ] of offsets ) {

			const nx = gx + dx;
			const nz = gz + dz;
			if ( ! this._project.getTile( nx, nz ) ) {

				const clone = new TrackTile( tile.type, tile.orient, tile.elevation );
				this._project.setTile( nx, nz, clone );
				this._meshFactory.createTileMesh( nx, nz, clone );
				this._eventBus.emit( 'tile:placed', { gx: nx, gz: nz, tile: clone } );
				return;

			}

		}

	}

}
