// ─── PlacementController ─────────────────────────────────────────────────────
// Handles ghost preview, placement validation, and delegates to commands.

import * as THREE from 'three';
import { CELL_RAW, ORIENT_DEG } from '../../TrackConstants.js';
import { isNorthSouthOrient } from '../../TrackOrientation.js';
import { ELEV_GROUND } from '../models/TrackProject.js';
import { PlaceTileCommand } from '../commands/PlaceTileCommand.js';
import { EraseTileCommand } from '../commands/EraseTileCommand.js';
import { PlaceFinishCommand } from '../commands/PlaceFinishCommand.js';
import { PlaceSpecialTileCommand } from '../commands/PlaceSpecialTileCommand.js';
import { PlaceTerrainCommand } from '../commands/PlaceTerrainCommand.js';
import { EraseTerrainCommand } from '../commands/EraseTerrainCommand.js';
import { TILES_3X3, TILES_2X2 } from '../models/TrackTile.js';
import { TERRAIN_TILE_ID } from '../constants/EditorAssetIds.js';

/**
 * Compute the anchor cell for a multi-cell footprint.
 * For even-sized footprints (2x2), snaps to grid corners so the tile
 * is centered on the cursor. For odd-sized (3x3, 1x1), uses standard cell snap.
 */
function anchorForFootprint( gx, gz, worldX, worldZ, footprintW, footprintH ) {

	if ( footprintW <= 1 && footprintH <= 1 ) return { gx, gz };

	// For even-width: snap X to nearest grid corner, then offset to anchor
	let ax = gx;
	let az = gz;

	if ( footprintW % 2 === 0 && worldX !== undefined ) {

		// fraction within cell: 0..1
		const fx = ( worldX / CELL_RAW ) - gx;
		// If cursor is in the right half of the cell, anchor here; left half, anchor one cell left
		ax = fx >= 0.5 ? gx : gx - 1;

	}

	if ( footprintH % 2 === 0 && worldZ !== undefined ) {

		const fz = ( worldZ / CELL_RAW ) - gz;
		az = fz >= 0.5 ? gz : gz - 1;

	}

	return { gx: ax, gz: az };

}

export class PlacementController {

	/**
	 * @param {import('./OccupancyGrid.js').OccupancyGrid} [occupancy]
	 */
	constructor( project, meshFactory, autoTile, commandHistory, eventBus, editorState, occupancy ) {

		this._project = project;
		this._meshFactory = meshFactory;
		this._autoTile = autoTile;
		this._commandHistory = commandHistory;
		this._eventBus = eventBus;
		this._state = editorState;
		this._occupancy = occupancy ?? null;

		/** Three.js group for ghost preview meshes. */
		this.ghostGroup = new THREE.Group();
		this.ghostGroup.name = 'ghost-preview';

		this._lastGhostCell = null;
		this._lastGhostTool = null;

		// Footprint indicator material (green translucent plane)
		this._footprintMat = new THREE.MeshBasicMaterial( {
			color: 0x22c55e,
			transparent: true,
			opacity: 0.2,
			depthWrite: false,
			side: THREE.DoubleSide,
		} );

		// Invalid footprint material (red)
		this._footprintInvalidMat = new THREE.MeshBasicMaterial( {
			color: 0xef4444,
			transparent: true,
			opacity: 0.3,
			depthWrite: false,
			side: THREE.DoubleSide,
		} );

		// Clearance warning material (orange/yellow)
		this._footprintClearanceMat = new THREE.MeshBasicMaterial( {
			color: 0xf59e0b,
			transparent: true,
			opacity: 0.25,
			depthWrite: false,
			side: THREE.DoubleSide,
		} );

	}

	/**
	 * Update ghost preview at grid cell.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {string} tool
	 * @param {string} [selectedTileType]  For 'special' tool
	 */
	updateGhost( gx, gz, tool, selectedTileType ) {

		// Skip if same cell + same tool (except for 2x2 tiles which need sub-cell updates)
		const tileTypeForCache = selectedTileType || this._state?.selectedTileType || 'trk-straight';
		if ( this._lastGhostCell &&
			this._lastGhostCell.gx === gx &&
			this._lastGhostCell.gz === gz &&
			this._lastGhostTool === tool &&
			! TILES_2X2.has( tileTypeForCache ) ) return;

		this.clearGhost();
		this._lastGhostCell = { gx, gz };
		this._lastGhostTool = tool;

		if ( tool === 'road' || tool === 'special' ) {

			// Manual placement ghost: show the exact tile the user selected
			const tileType = selectedTileType || this._state?.selectedTileType || 'trk-straight';
			const orient = this._state?.selectedOrient ?? 0;
			const activeElev = this._state ? this._state.activeElevation : 12;

			// Adjust anchor for 2x2 footprint tiles
			let ghostGx = gx;
			let ghostGz = gz;
			if ( TILES_2X2.has( tileType ) ) {

				const hovered = this._state?.hoveredCell;
				const anchor = anchorForFootprint( gx, gz, hovered?.worldX, hovered?.worldZ, 2, 2 );
				ghostGx = anchor.gx;
				ghostGz = anchor.gz;

			}

			const existing = this._project.getTile( ghostGx, ghostGz );
			if ( existing && ! existing._consumed  ) return;

			const ghost = this._meshFactory.createGhostMesh( tileType, orient, ghostGx, ghostGz, activeElev );
			if ( ghost ) this.ghostGroup.add( ghost );

			this._addClearanceIndicator( ghostGx, ghostGz, activeElev );

		} else if ( tool === 'terrain' ) {

			const activeElev = this._state ? this._state.activeElevation : 12;
			const terrainOccupied = this._project.getTerrainTile( gx, gz );
			const trackOccupied = this._project.getTile( gx, gz );
			const valid = ! terrainOccupied && ! trackOccupied;

			const ghost = this._meshFactory.createGhostMesh(
				TERRAIN_TILE_ID,
				0,
				gx,
				gz,
				activeElev,
				valid ? 0.4 : 0.18
			);
			if ( ghost ) this.ghostGroup.add( ghost );
			this._addFlatIndicator( gx, gz, activeElev, valid ? this._footprintMat : this._footprintInvalidMat );

		} else if ( tool === 'finish' ) {

			// Manual orient from R key — no auto-detection
			const orient = this._state?.selectedOrient ?? 0;

			// Show finish ghost model with correct orientation
			const ghost = this._meshFactory.createGhostMesh( 'trk-finish', orient, gx, gz );
			if ( ghost ) this.ghostGroup.add( ghost );

			// 3x1 wireframe bounding box matching the tile geometry
			const worldX = ( gx + 0.5 ) * CELL_RAW;
			const worldZ = ( gz + 0.5 ) * CELL_RAW;
			const northSouth = isNorthSouthOrient( orient );
			const boxW = northSouth ? CELL_RAW : CELL_RAW * 3;  // X size
			const boxD = northSouth ? CELL_RAW * 3 : CELL_RAW;  // Z size
			const boxH = 3.0;

			const boxGeo = new THREE.BoxGeometry( boxW * 0.98, boxH, boxD * 0.98 );
			const edgeMat = new THREE.LineBasicMaterial( { color: 0x22c55e, transparent: true, opacity: 0.7 } );
			const wireframe = new THREE.LineSegments( new THREE.EdgesGeometry( boxGeo ), edgeMat );
			wireframe.position.set( worldX, boxH / 2, worldZ );
			this.ghostGroup.add( wireframe );

			// Semi-transparent fill
			const fillMat = new THREE.MeshBasicMaterial( {
				color: 0x22c55e, transparent: true, opacity: 0.08,
				depthWrite: false, side: THREE.DoubleSide,
			} );
			const fillMesh = new THREE.Mesh( boxGeo, fillMat );
			fillMesh.position.set( worldX, boxH / 2, worldZ );
			this.ghostGroup.add( fillMesh );

			// Direction arrows on BOTH ends of the finish tile
			const arrowShape = new THREE.Shape();
			arrowShape.moveTo( 0, 1.2 );
			arrowShape.lineTo( - 0.7, - 0.3 );
			arrowShape.lineTo( 0, 0.2 );
			arrowShape.lineTo( 0.7, - 0.3 );
			arrowShape.closePath();

			const arrowGeo = new THREE.ShapeGeometry( arrowShape );
			const arrowMat = new THREE.MeshBasicMaterial( {
				color: 0x22c55e, transparent: true, opacity: 0.9,
				side: THREE.DoubleSide, depthWrite: false,
			} );

			const orientRad = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] ?? 0 );

			// Arrow at the start (behind finish line)
			const behindDist = CELL_RAW * 0.8;
			const arrow1 = new THREE.Mesh( arrowGeo, arrowMat );
			arrow1.rotation.x = - Math.PI / 2;
			arrow1.rotation.z = Math.PI - orientRad;
			arrow1.position.set(
				worldX - Math.sin( orientRad ) * behindDist,
				0.1,
				worldZ + Math.cos( orientRad ) * behindDist
			);
			this.ghostGroup.add( arrow1 );

			// Arrow at the front (ahead of finish line)
			const aheadDist = CELL_RAW * 0.8;
			const arrow2 = new THREE.Mesh( arrowGeo, arrowMat );
			arrow2.rotation.x = - Math.PI / 2;
			arrow2.rotation.z = Math.PI - orientRad;
			arrow2.position.set(
				worldX + Math.sin( orientRad ) * aheadDist,
				0.1,
				worldZ - Math.cos( orientRad ) * aheadDist
			);
			this.ghostGroup.add( arrow2 );

		} else if ( tool === 'erase' ) {

			// Red highlight on tile that would be erased (including consumed cells)
			const existing = this._project.getTile( gx, gz );
			const terrain = this._project.getTerrainTile( gx, gz );
			const tileForHeight = existing || terrain;
			if ( tileForHeight ) {

				const elevation = tileForHeight.elevation ?? ELEV_GROUND;
				this._addFlatIndicator( gx, gz, elevation, this._footprintInvalidMat );

			}

		}

	}

	/** Clear ghost preview meshes. */
	clearGhost() {

		while ( this.ghostGroup.children.length > 0 ) {

			this.ghostGroup.remove( this.ghostGroup.children[ 0 ] );

		}

		this._lastGhostCell = null;
		this._lastGhostTool = null;

	}

	/**
	 * Place a road tile at (gx, gz) via command.
	 * Enforces occupancy and clearance rules before placement.
	 * @returns {PlaceTileCommand|null}
	 */
	placeRoad( gx, gz ) {

		const existing = this._project.getTile( gx, gz );
		if ( existing && ! existing._consumed && ! existing.autoRamp  ) return null;

		const activeElev = this._state ? this._state.activeElevation : 12;

		// Clearance enforcement: block if occupancy says invalid
		if ( this._occupancy ) {

			const check = this._occupancy.checkClearance( gx, gz, activeElev );
			if ( ! check.valid ) return null;

		}

		// Manual placement: use the exact tile type and orient the user selected
		const tileType = this._state?.selectedTileType || 'trk-straight';
		const orient = this._state?.selectedOrient ?? 0;

		const cmd = new PlaceTileCommand(
			this._project, gx, gz,
			tileType, orient, activeElev,
			this._meshFactory, this._eventBus
		);

		this._commandHistory.execute( cmd );
		this.clearGhost();
		return cmd;

	}

	placeTerrain( gx, gz ) {

		const trackTile = this._project.getTile( gx, gz );
		const terrainTile = this._project.getTerrainTile( gx, gz );
		if ( trackTile || terrainTile ) return null;

		const elevation = this._state ? this._state.activeElevation : ELEV_GROUND;
		const cmd = new PlaceTerrainCommand(
			this._project,
			gx,
			gz,
			TERRAIN_TILE_ID,
			0,
			elevation,
			this._meshFactory,
			this._eventBus
		);

		this._commandHistory.execute( cmd );
		this.clearGhost();
		return cmd;

	}

	/**
	 * Erase a tile at (gx, gz) via command.
	 * @returns {EraseTileCommand|null}
	 */
	eraseRoad( gx, gz ) {

		const tile = this._project.getTile( gx, gz );
		if ( ! tile ) {

			const terrain = this._project.getTerrainTile( gx, gz );
			if ( ! terrain ) return null;

			const terrainCmd = new EraseTerrainCommand(
				this._project,
				gx,
				gz,
				this._meshFactory,
				this._eventBus
			);
			this._commandHistory.execute( terrainCmd );
			return terrainCmd;

		}

		// Consumed cells are handled by EraseTileCommand (finds and erases the anchor)

		const cmd = new EraseTileCommand(
			this._project, gx, gz,
			this._meshFactory, this._autoTile, this._eventBus
		);

		this._commandHistory.execute( cmd );
		return cmd;

	}

	/**
	 * Place the start/finish line.
	 */
	placeFinishAt( gx, gz ) {

		// Use whatever orient the user has selected (R key to rotate)
		const orient = this._state?.selectedOrient ?? 0;

		const cmd = new PlaceFinishCommand(
			this._project, gx, gz, orient,
			this._meshFactory, this._autoTile, this._eventBus
		);

		this._commandHistory.execute( cmd );

	}

	/**
	 * Place a special tile (junction, bridge, tunnel, jump, chicane, curve).
	 * For 2x2 tiles, adjusts anchor based on cursor position within the cell.
	 */
	placeSpecialTile( gx, gz, tileType ) {

		// Adjust anchor for 2x2 footprint
		if ( TILES_2X2.has( tileType ) ) {

			const hovered = this._state?.hoveredCell;
			const anchor = anchorForFootprint( gx, gz, hovered?.worldX, hovered?.worldZ, 2, 2 );
			gx = anchor.gx;
			gz = anchor.gz;

		}

		const cmd = new PlaceSpecialTileCommand(
			this._project, gx, gz, tileType,
			this._meshFactory, this._autoTile, this._eventBus
		);

		this._commandHistory.execute( cmd );

	}

	// ── Clearance visualization ──

	/**
	 * Add a clearance indicator plane at a cell.
	 * Green = valid, red = occupied/blocked, orange = clearance too low.
	 * @private
	 */
	_addClearanceIndicator( gx, gz, elevation ) {

		if ( ! this._occupancy ) return;

		const result = this._occupancy.checkClearance( gx, gz, elevation );

		let mat;
		if ( result.valid ) {

			mat = this._footprintMat; // green

		} else if ( result.conflict && result.conflict.reason === 'clearance' ) {

			mat = this._footprintClearanceMat; // orange — too close but not same level

		} else {

			mat = this._footprintInvalidMat; // red — direct occupancy conflict

		}

		const Y_PER_STEP = 2.416;
		const worldY = ( elevation - ELEV_GROUND ) * Y_PER_STEP + 0.03;

		const geo = new THREE.PlaneGeometry( CELL_RAW * 0.95, CELL_RAW * 0.95 );
		const plane = new THREE.Mesh( geo, mat );
		plane.rotation.x = - Math.PI / 2;
		plane.position.set(
			( gx + 0.5 ) * CELL_RAW,
			worldY,
			( gz + 0.5 ) * CELL_RAW
		);
		this.ghostGroup.add( plane );

	}

	_addFlatIndicator( gx, gz, elevation, material ) {

		const worldY = ( elevation - ELEV_GROUND ) * 2.416 + 0.03;
		const geo = new THREE.PlaneGeometry( CELL_RAW * 0.95, CELL_RAW * 0.95 );
		const plane = new THREE.Mesh( geo, material );
		plane.rotation.x = - Math.PI / 2;
		plane.position.set(
			( gx + 0.5 ) * CELL_RAW,
			worldY,
			( gz + 0.5 ) * CELL_RAW
		);
		this.ghostGroup.add( plane );

	}

	// ── Elevation highlight ──

	/**
	 * Show a persistent green highlight on a tile being elevated.
	 * Stays visible until clearGhost() or another setElevationHighlight() call.
	 * @param {number} gx
	 * @param {number} gz
	 */
	setElevationHighlight( gx, gz ) {

		this._clearElevHighlight();

		const tile = this._project.getTile( gx, gz );
		if ( ! tile ) return;

		const elevStep = tile._derivedElevation || tile.elevation || ELEV_GROUND;
		const Y_PER_STEP = 2.416;
		const tileY = ( elevStep - ELEV_GROUND ) * Y_PER_STEP;
		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;

		const group = new THREE.Group();
		group.userData._isElevHighlight = true;

		// Green wireframe bounding box
		const boxW = CELL_RAW * 0.96;
		const boxH = 2.0;
		const boxGeo = new THREE.BoxGeometry( boxW, boxH, boxW );
		const edgeMat = new THREE.LineBasicMaterial( { color: 0x22c55e, transparent: true, opacity: 0.7 } );
		const edges = new THREE.EdgesGeometry( boxGeo );
		const wireframe = new THREE.LineSegments( edges, edgeMat );
		wireframe.position.set( worldX, tileY + boxH / 2, worldZ );
		group.add( wireframe );

		// Semi-transparent fill
		const fillMat = new THREE.MeshBasicMaterial( {
			color: 0x22c55e, transparent: true, opacity: 0.12,
			depthWrite: false, side: THREE.DoubleSide,
		} );
		const boxMesh = new THREE.Mesh( boxGeo, fillMat );
		boxMesh.position.set( worldX, tileY + boxH / 2, worldZ );
		group.add( boxMesh );

		// Drop-line + height label (if elevated)
		if ( Math.abs( tileY ) > 0.1 ) {

			// Dashed drop-line to ground
			const lineGeo = new THREE.BufferGeometry().setFromPoints( [
				new THREE.Vector3( worldX, tileY, worldZ ),
				new THREE.Vector3( worldX, 0, worldZ ),
			] );
			const lineMat = new THREE.LineDashedMaterial( {
				color: 0x22c55e, transparent: true, opacity: 0.5,
				dashSize: 0.3, gapSize: 0.2,
			} );
			const dropLine = new THREE.Line( lineGeo, lineMat );
			dropLine.computeLineDistances();
			group.add( dropLine );

			// Ground cross
			const crossGeo = new THREE.BufferGeometry().setFromPoints( [
				new THREE.Vector3( worldX - 0.6, 0.02, worldZ ),
				new THREE.Vector3( worldX + 0.6, 0.02, worldZ ),
				new THREE.Vector3( worldX, 0.02, worldZ - 0.6 ),
				new THREE.Vector3( worldX, 0.02, worldZ + 0.6 ),
			] );
			crossGeo.setIndex( [ 0, 1, 2, 3 ] );
			group.add( new THREE.LineSegments( crossGeo, edgeMat ) );

			// Height label sprite
			const heightM = ( ( elevStep - ELEV_GROUND ) * 2.5 ).toFixed( 1 );
			const sign = elevStep >= ELEV_GROUND ? '+' : '';
			const canvas = document.createElement( 'canvas' );
			canvas.width = 128;
			canvas.height = 48;
			const ctx = canvas.getContext( '2d' );
			ctx.fillStyle = 'rgba(0,0,0,0.75)';
			ctx.roundRect( 2, 2, 124, 44, 6 );
			ctx.fill();
			ctx.strokeStyle = '#22c55e';
			ctx.lineWidth = 2;
			ctx.roundRect( 2, 2, 124, 44, 6 );
			ctx.stroke();
			ctx.fillStyle = '#22c55e';
			ctx.font = 'bold 24px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( `${ sign }${ heightM }m`, 64, 24 );

			const texture = new THREE.CanvasTexture( canvas );
			texture.minFilter = THREE.LinearFilter;
			const spriteMat = new THREE.SpriteMaterial( { map: texture, transparent: true, depthTest: false } );
			const sprite = new THREE.Sprite( spriteMat );
			sprite.position.set( worldX + CELL_RAW * 0.6, tileY / 2, worldZ );
			sprite.scale.set( 3, 1.2, 1 );
			group.add( sprite );

		}

		this.ghostGroup.add( group );

	}

	/** @private Remove elevation highlight meshes. */
	_clearElevHighlight() {

		const toRemove = [];
		for ( const child of this.ghostGroup.children ) {

			if ( child.userData._isElevHighlight ) toRemove.push( child );

		}

		for ( const mesh of toRemove ) this.ghostGroup.remove( mesh );

	}

}
