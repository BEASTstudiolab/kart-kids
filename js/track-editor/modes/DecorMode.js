// ─── DecorMode ───────────────────────────────────────────────────────────────
// For placing decorative props freely (not grid-snapped).
// Items can be placed on any flat/elevated surface where there isn't track.
// Shows red overlay on invalid placement surfaces.

import * as THREE from 'three';
import { EditorMode } from './EditorMode.js';
import { CELL_RAW } from '../../TrackConstants.js';
import { ELEV_GROUND } from '../models/TrackProject.js';

const Y_PER_STEP = 2.416;

export class DecorMode extends EditorMode {

	constructor( editorState, eventBus, project, tileLibrary, occupancy, camera ) {

		super( editorState, eventBus );
		this._project = project;
		this._lib = tileLibrary;
		this._occupancy = occupancy;
		this._camera = camera;

		/** @type {Array<{ id: string, type: string, mesh: THREE.Object3D, pos: THREE.Vector3 }>} */
		this._placedDecor = [];

		/** Three.js group for decor meshes. */
		this.decorGroup = new THREE.Group();
		this.decorGroup.name = 'decor-items';

		/** Ghost preview group. */
		this._ghostGroup = new THREE.Group();
		this._ghostGroup.name = 'decor-ghost';

		// Ground plane for raycasting free placement
		this._groundPlane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0 );
		this._raycaster = new THREE.Raycaster();

		this._conflictMat = new THREE.MeshBasicMaterial( {
			color: 0xef4444, transparent: true, opacity: 0.3,
			depthWrite: false, side: THREE.DoubleSide,
		} );
		this._validMat = new THREE.MeshBasicMaterial( {
			color: 0x22c55e, transparent: true, opacity: 0.2,
			depthWrite: false, side: THREE.DoubleSide,
		} );

	}

	get ghostGroup() { return this._ghostGroup; }

	enter() {

		this._state.tool = 'place-decor';
		this._state.activeLayer = 'decor';

	}

	exit() {

		this._state.activeLayer = 'track';
		this._clearGhost();

	}

	getTools() {

		return [
			{ id: 'place-decor', name: 'Place Decor', icon: 'tree' },
			{ id: 'erase-decor', name: 'Erase Decor', icon: 'eraser' },
		];

	}

	handlePointerDown( gx, gz, event ) {

		if ( this._state.tool === 'place-decor' ) {

			this._placeAtCursor( event );

		} else if ( this._state.tool === 'erase-decor' ) {

			this._eraseAtCursor( event );

		}

	}

	handlePointerMove( gx, gz, event ) {

		this._clearGhost();

		const worldPos = this._screenToWorld( event.clientX, event.clientY );
		if ( ! worldPos ) return;

		// Snap Y to active elevation plane
		const activeElev = this._state.activeElevation;
		const planeY = ( activeElev - ELEV_GROUND ) * Y_PER_STEP;
		worldPos.y = planeY;

		// Check if this position overlaps a track tile
		const cellGx = Math.floor( worldPos.x / CELL_RAW );
		const cellGz = Math.floor( worldPos.z / CELL_RAW );
		const trackTile = this._project.getTile( cellGx, cellGz );
		const isOnTrack = trackTile && ! trackTile._consumed ;

		if ( this._state.tool === 'place-decor' ) {

			// Show ghost model at cursor
			const tileId = this._state.selectedTileType;
			if ( tileId ) {

				const model = this._lib.getModel( tileId );
				if ( model ) {

					const ghost = model.clone( true );
					ghost.position.copy( worldPos );
					ghost.traverse( c => {

						if ( c.isMesh ) {

							c.material = c.material.clone();
							c.material.transparent = true;
							c.material.opacity = isOnTrack ? 0.2 : 0.5;
							c.material.depthWrite = false;
							if ( isOnTrack ) c.material.color.setHex( 0xff4444 );

						}

					} );
					this._ghostGroup.add( ghost );

				}

			}

			// Red/green circle indicator at placement point
			const circleGeo = new THREE.RingGeometry( 1.5, 2.0, 24 );
			const circle = new THREE.Mesh( circleGeo, isOnTrack ? this._conflictMat : this._validMat );
			circle.rotation.x = - Math.PI / 2;
			circle.position.set( worldPos.x, planeY + 0.02, worldPos.z );
			this._ghostGroup.add( circle );

		} else if ( this._state.tool === 'erase-decor' ) {

			// Highlight nearest decor item
			const nearest = this._findNearestDecor( worldPos, 3.0 );
			if ( nearest && nearest.mesh ) {

				const box = new THREE.Box3().setFromObject( nearest.mesh );
				const boxHelper = new THREE.Box3Helper( box, 0xef4444 );
				this._ghostGroup.add( boxHelper );

			}

		}

	}

	// ── Placement ──

	/** @private */
	_placeAtCursor( event ) {

		const worldPos = this._screenToWorld( event.clientX, event.clientY );
		if ( ! worldPos ) return;

		const activeElev = this._state.activeElevation;
		const planeY = ( activeElev - ELEV_GROUND ) * Y_PER_STEP;
		worldPos.y = planeY;

		// Block placement on track tiles
		const cellGx = Math.floor( worldPos.x / CELL_RAW );
		const cellGz = Math.floor( worldPos.z / CELL_RAW );
		const trackTile = this._project.getTile( cellGx, cellGz );
		if ( trackTile && ! trackTile._consumed  ) return;

		const tileId = this._state.selectedTileType;
		if ( ! tileId ) return;

		const model = this._lib.getModel( tileId );
		if ( ! model ) return;

		const clone = model.clone( true );
		clone.position.copy( worldPos );
		clone.traverse( c => {

			if ( c.isMesh ) { c.castShadow = true; c.receiveShadow = true; }

		} );

		const entry = {
			id: crypto.randomUUID(),
			type: tileId,
			mesh: clone,
			pos: worldPos.clone(),
		};

		this._placedDecor.push( entry );
		this.decorGroup.add( clone );

		this._eventBus.emit( 'decor:placed', entry );

	}

	/** @private */
	_eraseAtCursor( event ) {

		const worldPos = this._screenToWorld( event.clientX, event.clientY );
		if ( ! worldPos ) return;

		const nearest = this._findNearestDecor( worldPos, 3.0 );
		if ( ! nearest ) return;

		this.decorGroup.remove( nearest.mesh );
		const idx = this._placedDecor.indexOf( nearest );
		if ( idx >= 0 ) this._placedDecor.splice( idx, 1 );

		this._eventBus.emit( 'decor:erased', { id: nearest.id } );

	}

	// ── Helpers ──

	/** @private Raycast screen point to ground plane at active elevation. */
	_screenToWorld( clientX, clientY ) {

		if ( ! this._camera ) return null;

		const canvas = this._camera._canvas;
		const rect = canvas.getBoundingClientRect();
		const ndc = new THREE.Vector2(
			( ( clientX - rect.left ) / rect.width ) * 2 - 1,
			- ( ( clientY - rect.top ) / rect.height ) * 2 + 1,
		);

		const activeElev = this._state.activeElevation;
		const planeY = ( activeElev - ELEV_GROUND ) * Y_PER_STEP;
		this._groundPlane.constant = - planeY;

		this._raycaster.setFromCamera( ndc, this._camera.camera );

		const intersection = new THREE.Vector3();
		const hit = this._raycaster.ray.intersectPlane( this._groundPlane, intersection );
		return hit ? intersection : null;

	}

	/** @private Find nearest placed decor within radius. */
	_findNearestDecor( worldPos, radius ) {

		let nearest = null;
		let nearestDist = radius;

		for ( const entry of this._placedDecor ) {

			const dist = entry.pos.distanceTo( worldPos );
			if ( dist < nearestDist ) {

				nearestDist = dist;
				nearest = entry;

			}

		}

		return nearest;

	}

	/** @private */
	_clearGhost() {

		while ( this._ghostGroup.children.length > 0 ) {

			this._ghostGroup.remove( this._ghostGroup.children[ 0 ] );

		}

	}

}
