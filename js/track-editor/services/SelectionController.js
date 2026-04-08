// ─── SelectionController ─────────────────────────────────────────────────────
// Manages tile selection with 3D bounding box, elevation drop-line, and
// height label for clear spatial awareness.

import * as THREE from 'three';
import { CELL_RAW } from '../../TrackConstants.js';
import { ELEV_GROUND } from '../models/TrackProject.js';

const Y_PER_STEP = 2.416;
const BOX_COLOR = 0x00d4e8;   // cyan
const LINE_COLOR = 0x00d4e8;
const BOX_OPACITY = 0.15;

export class SelectionController {

	constructor( project, state, eventBus ) {

		this._project = project;
		this._state = state;
		this._eventBus = eventBus;

		/** @type {Map<string, THREE.Group>} cell key -> selection indicator group */
		this._indicators = new Map();

		this._indicatorGroup = new THREE.Group();
		this._indicatorGroup.name = 'selection-indicators';

		// Shared materials
		this._boxMat = new THREE.MeshBasicMaterial( {
			color: BOX_COLOR,
			transparent: true,
			opacity: BOX_OPACITY,
			depthWrite: false,
			side: THREE.DoubleSide,
		} );

		this._edgeMat = new THREE.LineBasicMaterial( {
			color: BOX_COLOR,
			transparent: true,
			opacity: 0.6,
		} );

		this._lineMat = new THREE.LineDashedMaterial( {
			color: LINE_COLOR,
			transparent: true,
			opacity: 0.5,
			dashSize: 0.3,
			gapSize: 0.2,
		} );

	}

	get indicatorGroup() { return this._indicatorGroup; }

	selectCell( gx, gz ) {

		const tile = this._project.getTile( gx, gz );
		if ( ! tile || tile._consumed || tile.autoRamp ) return;

		this.clearSelection();
		const key = this._project.cellKey( gx, gz );
		this._state.selection.add( key );
		this._addIndicator( gx, gz, tile );
		this._notify();

	}

	toggleCell( gx, gz ) {

		const key = this._project.cellKey( gx, gz );

		if ( this._state.selection.has( key ) ) {

			this._state.selection.delete( key );
			this._removeIndicator( key );

		} else {

			const tile = this._project.getTile( gx, gz );
			if ( ! tile || tile._consumed || tile.autoRamp ) return;

			this._state.selection.add( key );
			this._addIndicator( gx, gz, tile );

		}

		this._notify();

	}

	boxSelect( startGx, startGz, endGx, endGz ) {

		this.clearSelection();

		const minGx = Math.min( startGx, endGx );
		const maxGx = Math.max( startGx, endGx );
		const minGz = Math.min( startGz, endGz );
		const maxGz = Math.max( startGz, endGz );

		for ( let gx = minGx; gx <= maxGx; gx ++ ) {

			for ( let gz = minGz; gz <= maxGz; gz ++ ) {

				const tile = this._project.getTile( gx, gz );
				if ( tile && ! tile._consumed && ! tile.autoRamp ) {

					const key = this._project.cellKey( gx, gz );
					this._state.selection.add( key );
					this._addIndicator( gx, gz, tile );

				}

			}

		}

		this._notify();

	}

	clearSelection() {

		this._state.selection.clear();

		for ( const group of this._indicators.values() ) {

			this._indicatorGroup.remove( group );

		}

		this._indicators.clear();
		this._notify();

	}

	/** @private */
	_addIndicator( gx, gz, tile ) {

		const key = this._project.cellKey( gx, gz );
		if ( this._indicators.has( key ) ) return;

		const group = new THREE.Group();
		group.name = 'sel-' + key;

		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;

		// Calculate tile Y from elevation
		const elevStep = tile._derivedElevation || tile.elevation || ELEV_GROUND;
		const tileY = ( elevStep - ELEV_GROUND ) * Y_PER_STEP;
		const tileHeight = 2.0; // approximate tile height for bounding box

		// ── 1. Wireframe bounding box ──
		const boxW = CELL_RAW * 0.98;
		const boxH = tileHeight;
		const boxD = CELL_RAW * 0.98;
		const boxGeo = new THREE.BoxGeometry( boxW, boxH, boxD );
		const edges = new THREE.EdgesGeometry( boxGeo );
		const wireframe = new THREE.LineSegments( edges, this._edgeMat );
		wireframe.position.set( worldX, tileY + boxH / 2, worldZ );
		group.add( wireframe );

		// Semi-transparent box fill
		const boxMesh = new THREE.Mesh( boxGeo, this._boxMat );
		boxMesh.position.set( worldX, tileY + boxH / 2, worldZ );
		group.add( boxMesh );

		// ── 2. Drop-line from tile to ground (if elevated) ──
		if ( Math.abs( tileY ) > 0.1 ) {

			const groundY = 0;
			const lineGeo = new THREE.BufferGeometry().setFromPoints( [
				new THREE.Vector3( worldX, tileY, worldZ ),
				new THREE.Vector3( worldX, groundY, worldZ ),
			] );
			const dropLine = new THREE.Line( lineGeo, this._lineMat );
			dropLine.computeLineDistances(); // needed for dashed lines
			group.add( dropLine );

			// Small ground marker (cross at ground level)
			const crossSize = 0.6;
			const crossGeo = new THREE.BufferGeometry().setFromPoints( [
				new THREE.Vector3( worldX - crossSize, groundY + 0.02, worldZ ),
				new THREE.Vector3( worldX + crossSize, groundY + 0.02, worldZ ),
				new THREE.Vector3( worldX, groundY + 0.02, worldZ - crossSize ),
				new THREE.Vector3( worldX, groundY + 0.02, worldZ + crossSize ),
			] );
			crossGeo.setIndex( [ 0, 1, 2, 3 ] );
			const cross = new THREE.LineSegments( crossGeo, this._edgeMat );
			group.add( cross );

			// ── 3. Height label (HTML overlay positioned in 3D) ──
			const heightM = ( ( elevStep - ELEV_GROUND ) * 2.5 ).toFixed( 1 );
			const sign = elevStep >= ELEV_GROUND ? '+' : '';
			this._addHeightLabel( group, worldX, tileY / 2, worldZ, `${ sign }${ heightM }m` );

		}

		this._indicatorGroup.add( group );
		this._indicators.set( key, group );

	}

	/**
	 * Add a small 3D text sprite showing the height.
	 * @private
	 */
	_addHeightLabel( group, x, y, z, text ) {

		const canvas = document.createElement( 'canvas' );
		canvas.width = 128;
		canvas.height = 48;
		const ctx = canvas.getContext( '2d' );

		// Background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		ctx.roundRect( 2, 2, 124, 44, 6 );
		ctx.fill();

		// Border
		ctx.strokeStyle = '#00d4e8';
		ctx.lineWidth = 2;
		ctx.roundRect( 2, 2, 124, 44, 6 );
		ctx.stroke();

		// Text
		ctx.fillStyle = '#00d4e8';
		ctx.font = 'bold 24px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText( text, 64, 24 );

		const texture = new THREE.CanvasTexture( canvas );
		texture.minFilter = THREE.LinearFilter;

		const spriteMat = new THREE.SpriteMaterial( {
			map: texture,
			transparent: true,
			depthTest: false,
		} );

		const sprite = new THREE.Sprite( spriteMat );
		sprite.position.set( x + CELL_RAW * 0.6, y, z );
		sprite.scale.set( 3, 1.2, 1 );
		group.add( sprite );

	}

	/** @private */
	_removeIndicator( key ) {

		const group = this._indicators.get( key );
		if ( group ) {

			this._indicatorGroup.remove( group );
			this._indicators.delete( key );

		}

	}

	/** @private */
	_notify() {

		this._eventBus.emit( 'selection:changed', { selected: this._state.selection } );

	}

}
