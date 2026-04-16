// ─── PropsMode ───────────────────────────────────────────────────────────────
// For placing decorative props freely (not grid-snapped).
// Props can be placed on any surface where there isn't already a track tile.
// Shows red overlay on invalid placement surfaces.
// Props are persisted to v4 save format.

import * as THREE from 'three';
import { EditorMode } from './EditorMode.js';
import { CELL_RAW } from '../../TrackConstants.js';
import { ELEV_GROUND } from '../models/TrackProject.js';

const Y_PER_STEP = 2.416;

export class PropsMode extends EditorMode {

	constructor( editorState, eventBus, project, tileLibrary, occupancy, camera ) {

		super( editorState, eventBus );
		this._project = project;
		this._lib = tileLibrary;
		this._occupancy = occupancy;
		this._camera = camera;

		/** @type {Array<{ id: string, type: string, mesh: THREE.Object3D, pos: THREE.Vector3 }>} */
		this._placedProps = [];

		this.propsGroup = new THREE.Group();
		this.propsGroup.name = 'props-items';

		this._ghostGroup = new THREE.Group();
		this._ghostGroup.name = 'props-ghost';

		this._groundPlane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0 );
		this._raycaster = new THREE.Raycaster();
		this._movingProp = null;
		this._lastHoverWorldPos = null;

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

		this._state.tool = 'place-prop';
		this._state.activeLayer = 'props';

	}

	exit() {

		this._state.activeLayer = 'track';
		this._clearGhost();

	}

	getTools() {

		return [
			{ id: 'place-prop', name: 'Place Prop', icon: 'tree' },
			{ id: 'erase-prop', name: 'Erase Prop', icon: 'eraser' },
			{ id: 'rotate-prop', name: 'Rotate Prop', icon: 'rotate' },
			{ id: 'move-prop', name: 'Move Prop', icon: 'move' },
		];

	}

	handlePointerDown( gx, gz, event ) {

		const tool = this._state.tool;

		if ( tool === 'place-prop' ) {

			this._placeAtCursor( event );

		} else if ( tool === 'erase-prop' ) {

			this._eraseAtCursor( event );

		} else if ( tool === 'rotate-prop' ) {

			const worldPos = this._screenToWorld( event.clientX, event.clientY );
			if ( ! worldPos ) return;
			this._rotateNearestPropAt( worldPos );

		} else if ( tool === 'move-prop' ) {

			const worldPos = this._screenToWorld( event.clientX, event.clientY );
			if ( ! worldPos ) return;
			const nearest = this._findNearestProp( worldPos, 3.0 );
			if ( nearest ) {

				this._movingProp = nearest;

			}

		}

	}

	handlePointerUp() {

		this._movingProp = null;

	}

	handleKeyDown( code ) {

		if ( code !== 'KeyR' ) return false;

		const worldPos = this._getKeyboardTargetWorldPos();
		if ( ! worldPos ) return false;

		return this._rotateNearestPropAt( worldPos );

	}

	handlePointerMove( gx, gz, event ) {

		// Move-prop drag
		if ( this._movingProp ) {

			const worldPos = this._screenToWorld( event.clientX, event.clientY );
			if ( worldPos ) {

				this._movingProp.mesh.position.copy( worldPos );
				this._movingProp.pos = worldPos.clone();

			}

			return;

		}

		this._clearGhost();

		const worldPos = this._screenToWorld( event.clientX, event.clientY );
		if ( ! worldPos ) return;
		this._lastHoverWorldPos = worldPos.clone();

		const activeElev = this._state.activeElevation;
		const planeY = ( activeElev - ELEV_GROUND ) * Y_PER_STEP;
		worldPos.y = planeY;

		const cellGx = Math.floor( worldPos.x / CELL_RAW );
		const cellGz = Math.floor( worldPos.z / CELL_RAW );
		const trackTile = this._project.getTile( cellGx, cellGz );
		const isOnTrack = trackTile && ! trackTile._consumed ;

		if ( this._state.tool === 'place-prop' ) {

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

			const circleGeo = new THREE.RingGeometry( 1.5, 2.0, 24 );
			const circle = new THREE.Mesh( circleGeo, isOnTrack ? this._conflictMat : this._validMat );
			circle.rotation.x = - Math.PI / 2;
			circle.position.set( worldPos.x, planeY + 0.02, worldPos.z );
			this._ghostGroup.add( circle );

		} else if ( this._state.tool === 'erase-prop' ) {

			const nearest = this._findNearestProp( worldPos, 3.0 );
			if ( nearest && nearest.mesh ) {

				const box = new THREE.Box3().setFromObject( nearest.mesh );
				const boxHelper = new THREE.Box3Helper( box, 0xef4444 );
				this._ghostGroup.add( boxHelper );

			}

		}

	}

	/** @returns {Array} All placed props. */
	getPlacedProps() { return this._placedProps; }

	/**
	 * Serialize props for v4 JSON.
	 * @returns {Array}
	 */
	toJSON() {

		return this._placedProps.map( p => ( {
			id: p.id,
			type: p.type,
			pos: [ p.pos.x, p.pos.y, p.pos.z ],
			rotY: p.mesh?.rotation?.y ?? 0,
		} ) );

	}

	/**
	 * Load props from saved JSON data.
	 * @param {Array} propsData
	 */
	loadFromJSON( propsData ) {

		if ( ! propsData || ! Array.isArray( propsData ) ) return;

		for ( const p of this._placedProps ) {

			if ( p.mesh ) this.propsGroup.remove( p.mesh );

		}

		this._placedProps = [];

		for ( const data of propsData ) {

			const model = this._lib.getModel( data.type );
			if ( ! model ) continue;

			const clone = model.clone( true );
			const pos = new THREE.Vector3( data.pos[ 0 ], data.pos[ 1 ], data.pos[ 2 ] );
			clone.position.copy( pos );
			clone.rotation.y = Number.isFinite( data.rotY ) ? data.rotY : 0;

			clone.traverse( c => {

				if ( c.isMesh ) { c.castShadow = true; c.receiveShadow = true; }

			} );

			this._placedProps.push( {
				id: data.id || crypto.randomUUID(),
				type: data.type,
				mesh: clone,
				pos,
			} );

			this.propsGroup.add( clone );

		}

	}

	// ── Private ──

	_placeAtCursor( event ) {

		const worldPos = this._screenToWorld( event.clientX, event.clientY );
		if ( ! worldPos ) return;

		const activeElev = this._state.activeElevation;
		const planeY = ( activeElev - ELEV_GROUND ) * Y_PER_STEP;
		worldPos.y = planeY;

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

		this._placedProps.push( entry );
		this.propsGroup.add( clone );
		this._eventBus.emit( 'prop:placed', entry );

	}

	_eraseAtCursor( event ) {

		const worldPos = this._screenToWorld( event.clientX, event.clientY );
		if ( ! worldPos ) return;

		const nearest = this._findNearestProp( worldPos, 3.0 );
		if ( ! nearest ) return;

		this.propsGroup.remove( nearest.mesh );
		const idx = this._placedProps.indexOf( nearest );
		if ( idx >= 0 ) this._placedProps.splice( idx, 1 );
		this._eventBus.emit( 'prop:erased', { id: nearest.id } );

	}

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

	_findNearestProp( worldPos, radius ) {

		let nearest = null;
		let nearestDist = radius;

		for ( const entry of this._placedProps ) {

			const dist = entry.pos.distanceTo( worldPos );
			if ( dist < nearestDist ) {

				nearestDist = dist;
				nearest = entry;

			}

		}

		return nearest;

	}

	_rotateNearestPropAt( worldPos ) {

		const nearest = this._findNearestProp( worldPos, 3.0 );
		if ( ! nearest?.mesh ) return false;

		nearest.mesh.rotation.y = ( nearest.mesh.rotation.y + Math.PI / 2 ) % ( Math.PI * 2 );
		this._eventBus.emit( 'prop:rotated', { id: nearest.id } );
		return true;

	}

	_getKeyboardTargetWorldPos() {

		if ( this._lastHoverWorldPos ) return this._lastHoverWorldPos.clone();
		const hovered = this._state.hoveredCell;
		if ( ! hovered ) return null;

		const activeElev = this._state.activeElevation;
		const planeY = ( activeElev - ELEV_GROUND ) * Y_PER_STEP;
		return new THREE.Vector3( hovered.worldX, planeY, hovered.worldZ );

	}

	_clearGhost() {

		while ( this._ghostGroup.children.length > 0 ) {

			this._ghostGroup.remove( this._ghostGroup.children[ 0 ] );

		}

	}

}
