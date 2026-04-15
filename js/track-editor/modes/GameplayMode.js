// ─── GameplayMode ────────────────────────────────────────────────────────────
// For placing race logic markers: checkpoints, spawns, boost, powerups.
// Markers are visual gizmos placed on track tiles.

import * as THREE from 'three';
import { EditorMode } from './EditorMode.js';
import { CELL_RAW } from '../../TrackConstants.js';
import { GameplayMarker } from '../models/GameplayMarker.js';
import { ELEV_GROUND } from '../models/TrackProject.js';
import { BOOST_MARKER_MODEL_ID } from '../constants/EditorAssetIds.js';
import { TrackIntel } from '../../TrackIntel.js';
import { BOOST_LAYOUTS, resolveBoostPadPlacement } from '../../BoostPadLayout.js';

const Y_PER_STEP = 2.416;
const BOOST_VISUAL_LIFT = 0.06;

// Marker visual colors
const MARKER_COLORS = {
	checkpoint: 0x3b82f6,  // blue
	spawn:      0x22c55e,  // green
	boost:      0xf59e0b,  // orange
	powerup:    0xa855f7,  // purple
	respawn:    0xef4444,  // red
};

export class GameplayMode extends EditorMode {

	/**
	 * @param {import('../core/EditorState.js').EditorState} editorState
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 */
	constructor( editorState, eventBus, project, tileLibrary ) {

		super( editorState, eventBus );
		this._project = project;
		this._tileLibrary = tileLibrary;

		/** @type {Array<GameplayMarker>} */
		this._markers = [];

		/** Three.js group for marker meshes. */
		this.markerGroup = new THREE.Group();
		this.markerGroup.name = 'gameplay-markers';

	}

	enter() {

		if ( ! this._state.tool || this._state.tool === 'road' ) this._state.tool = 'checkpoint';

	}

	getTools() {

		return [
			{ id: 'checkpoint', name: 'Checkpoint', icon: '🚩', color: '#3b82f6', desc: 'Race checkpoint gate' },
			{ id: 'spawn', name: 'Spawn Point', icon: '⭐', color: '#22c55e', desc: 'Player start position' },
			{
				id: 'boost',
				name: 'Turbo Tile',
				icon: '⬆️',
				color: '#f59e0b',
				desc: 'Speed boost zone',
				modelId: BOOST_MARKER_MODEL_ID,
			},
			{ id: 'powerup', name: 'Powerup', icon: '📦', color: '#a855f7', desc: 'Item pickup box' },
			{ id: 'respawn', name: 'Respawn', icon: '🔄', color: '#ef4444', desc: 'Respawn marker' },
		];

	}

	handlePointerDown( gx, gz, event ) {

		const tile = this._project.getTile( gx, gz );
		if ( ! tile ) return; // Must place on existing track

		const tool = this._state.tool;

		// Check if marker already exists at this cell for this type
		const existing = this._markers.find(
			m => m.gx === gx && m.gz === gz && m.type === tool
		);

		if ( existing ) {

			if ( tool === 'boost' ) {

				this._cycleBoostLayout( existing );

			} else {

				// Toggle off — remove marker
				this._removeMarker( existing );

			}
			return;

		}

		if ( tool === 'boost' && ! this._canPlaceBoostOnTile( tile ) ) return;

		// Create new marker
		const marker = new GameplayMarker( tool, gx, gz );
		marker.orderIndex = this._markers.filter( m => m.type === tool ).length;
		if ( tool === 'boost' ) marker.settings.layout = BOOST_LAYOUTS[ 0 ];

		// Build visual gizmo
		this._rebuildMarkerMesh( marker );

		this._markers.push( marker );
		this._eventBus.emit( 'marker:placed', { marker } );

	}

	/**
	 * Get all placed markers.
	 * @returns {Array<GameplayMarker>}
	 */
	getMarkers() { return this._markers; }

	/**
	 * Get markers as v4 JSON array.
	 * @returns {Array}
	 */
	toJSON() { return this._markers.map( m => m.toJSON() ); }

	/**
	 * Load markers from saved JSON data. Rebuilds all gizmos.
	 * @param {Array} markersData
	 */
	loadFromJSON( markersData ) {

		if ( ! markersData || ! Array.isArray( markersData ) ) return;

		this.clearMarkers( { emitEvents: false } );

		for ( const data of markersData ) {

			const gx = data.pos ? data.pos[ 0 ] : 0;
			const gz = data.pos ? data.pos[ 2 ] : 0;
			const marker = new GameplayMarker( data.type, gx, gz );
			marker.id = data.id || crypto.randomUUID();
			marker.orderIndex = data.order || 0;
			marker.settings = data.settings || {};
			if ( data.rot && Array.isArray( data.rot ) && Number.isFinite( data.rot[ 1 ] ) ) marker.orient = data.rot[ 1 ];

			this._rebuildMarkerMesh( marker );

			this._markers.push( marker );

		}

	}

	clearMarkers( { emitEvents = true } = {} ) {

		const markers = [ ...this._markers ];
		for ( const marker of markers ) {

			this._removeMarker( marker, { emitEvent: emitEvents } );

		}

		return markers.length;

	}

	removeMarkersAt( gx, gz ) {

		const markers = this._markers.filter( ( marker ) => marker.gx === gx && marker.gz === gz );
		for ( const marker of markers ) {

			this._removeMarker( marker );

		}

		return markers.length;

	}

	refreshMarkers() {

		for ( const marker of this._markers ) {

			this._rebuildMarkerMesh( marker );

		}

	}

	// ── Private ──

	/** @private */
	_removeMarker( marker, { emitEvent = true } = {} ) {

		if ( marker.mesh ) {

			this.markerGroup.remove( marker.mesh );
			marker.mesh = null;

		}

		const idx = this._markers.indexOf( marker );
		if ( idx >= 0 ) this._markers.splice( idx, 1 );

		// Re-index remaining markers of this type
		let order = 0;
		for ( const m of this._markers ) {

			if ( m.type === marker.type ) m.orderIndex = order ++;

		}

		if ( emitEvent ) this._eventBus.emit( 'marker:removed', { marker } );

	}

	_cycleBoostLayout( marker ) {

		const current = BOOST_LAYOUTS.indexOf( marker.settings?.layout || BOOST_LAYOUTS[ 0 ] );
		const nextIndex = current >= 0 ? ( current + 1 ) % BOOST_LAYOUTS.length : 0;
		marker.settings.layout = BOOST_LAYOUTS[ nextIndex ];
		this._rebuildMarkerMesh( marker );
		this._eventBus.emit( 'marker:changed', { marker } );

	}

	_rebuildMarkerMesh( marker ) {

		if ( marker.mesh ) {

			this.markerGroup.remove( marker.mesh );
			marker.mesh = null;

		}

		const tile = this._project.getTile( marker.gx, marker.gz );
		const elevStep = tile ? ( tile._derivedElevation || tile.elevation || ELEV_GROUND ) : ELEV_GROUND;
		const worldY = ( elevStep - ELEV_GROUND ) * Y_PER_STEP;
		const color = MARKER_COLORS[ marker.type ] ?? 0xffffff;
		const gizmo = this._createGizmo( marker, color, worldY );
		marker.mesh = gizmo;
		if ( gizmo ) this.markerGroup.add( gizmo );

	}

	/**
	 * Create a 3D gizmo for a marker type.
	 * @private
	 */
	_createGizmo( marker, color, worldY ) {

		const { type, gx, gz } = marker;

		if ( type === 'boost' ) {

			return this._createBoostMarkerMesh( marker, worldY );

		}

		const group = new THREE.Group();
		const worldX = ( gx + 0.5 ) * CELL_RAW;
		const worldZ = ( gz + 0.5 ) * CELL_RAW;

		// Base: colored diamond on the tile surface
		const diamondGeo = new THREE.CircleGeometry( 1.2, 4 );
		const diamondMat = new THREE.MeshBasicMaterial( {
			color,
			transparent: true,
			opacity: 0.6,
			side: THREE.DoubleSide,
			depthWrite: false,
		} );
		const diamond = new THREE.Mesh( diamondGeo, diamondMat );
		diamond.rotation.x = - Math.PI / 2;
		diamond.rotation.z = Math.PI / 4;
		diamond.position.set( worldX, worldY + 0.05, worldZ );
		group.add( diamond );

		// Pole: vertical line
		const poleGeo = new THREE.BufferGeometry().setFromPoints( [
			new THREE.Vector3( worldX, worldY + 0.05, worldZ ),
			new THREE.Vector3( worldX, worldY + 3.5, worldZ ),
		] );
		const poleMat = new THREE.LineBasicMaterial( { color, linewidth: 2 } );
		group.add( new THREE.Line( poleGeo, poleMat ) );

		// Top: icon indicator (sphere for now — different sizes per type)
		const radius = type === 'boost' ? 0.5 : type === 'spawn' ? 0.6 : 0.4;
		const topGeo = type === 'boost'
			? new THREE.ConeGeometry( radius, radius * 2, 4 )
			: new THREE.SphereGeometry( radius, 8, 6 );
		const topMat = new THREE.MeshBasicMaterial( { color } );
		const top = new THREE.Mesh( topGeo, topMat );
		top.position.set( worldX, worldY + 3.5 + radius, worldZ );
		group.add( top );

		// Label sprite with order number
		const order = this._markers.filter( m => m.type === type ).length;
		const label = this._createLabel( `${ type.toUpperCase() } ${ order + 1 }`, color );
		label.position.set( worldX + 1.5, worldY + 4.5, worldZ );
		group.add( label );

		return group;

	}

	_createBoostMarkerMesh( marker, worldY ) {

		const boostRoot = new THREE.Group();
		const { gx, gz } = marker;
		const layout = marker.settings?.layout || BOOST_LAYOUTS[ 0 ];
		const placement = this._resolveBoostPlacement( gx, gz, layout );

		for ( const padCenter of placement.padCenters ) {

			const boostMesh = this._tileLibrary?.cloneModel( BOOST_MARKER_MODEL_ID );
			if ( ! boostMesh ) continue;

			boostMesh.position.set(
				padCenter.x,
				worldY + BOOST_VISUAL_LIFT,
				padCenter.z
			);
			boostMesh.rotation.y = placement.rotationY;
			boostMesh.traverse( ( child ) => {

				if ( child.isMesh ) {

					child.castShadow = false;
					child.receiveShadow = true;

				}

			} );
			boostRoot.add( boostMesh );

		}

		marker.orient = placement.rotationY;
		return boostRoot.children.length > 0 ? boostRoot : null;

	}

	_resolveBoostPlacement( gx, gz, layout = BOOST_LAYOUTS[ 0 ] ) {

		const tile = this._project.getTile( gx, gz );
		let intel = null;

		try {

			const hasFinishTile = [ ...this._project.getGrid().values() ].some( ( cell ) => cell.type === 'trk-finish' );
			if ( hasFinishTile ) {

				const nextIntel = new TrackIntel( this._project.getCellsArray() );
				if ( nextIntel.valid && nextIntel.count > 0 ) intel = nextIntel;

			}

		} catch ( err ) {

			console.warn( '[GameplayMode] Failed to resolve boost heading from TrackIntel:', err );

		}

		return resolveBoostPadPlacement( {
			gx,
			gz,
			layout,
			trackIntel: intel,
			cellType: tile?.type,
			orient: tile?.orient ?? 0,
		} );

	}

	_canPlaceBoostOnTile( tile ) {

		const def = this._tileLibrary?.getDefinition?.( tile.type );
		if ( ! def ) return ! tile.type.includes( 'jump' ) && ! tile.type.startsWith( 'trk-corner' ) && ! tile.type.startsWith( 'trk-curve-' );
		return def.category !== 'jump' && def.category !== 'turn';

	}

	/**
	 * Create a text sprite label.
	 * @private
	 */
	_createLabel( text, color ) {

		const canvas = document.createElement( 'canvas' );
		canvas.width = 192;
		canvas.height = 48;
		const ctx = canvas.getContext( '2d' );

		ctx.fillStyle = 'rgba(0,0,0,0.75)';
		ctx.roundRect( 0, 0, 192, 48, 6 );
		ctx.fill();

		ctx.fillStyle = '#' + ( color & 0xffffff ).toString( 16 ).padStart( 6, '0' );
		ctx.font = 'bold 20px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText( text, 96, 24 );

		const texture = new THREE.CanvasTexture( canvas );
		texture.minFilter = THREE.LinearFilter;
		const mat = new THREE.SpriteMaterial( { map: texture, transparent: true, depthTest: false } );
		const sprite = new THREE.Sprite( mat );
		sprite.scale.set( 4, 1, 1 );
		return sprite;

	}

}
