import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { TrackProject, ELEV_GROUND } from '../js/track-editor/models/TrackProject.js';
import { TrackTile } from '../js/track-editor/models/TrackTile.js';
import { EventBus } from '../js/track-editor/core/EventBus.js';
import { EditorState } from '../js/track-editor/core/EditorState.js';
import { CommandHistory } from '../js/track-editor/core/CommandHistory.js';
import { PlacementController } from '../js/track-editor/services/PlacementController.js';
import { BuildMode } from '../js/track-editor/modes/BuildMode.js';
import { GameplayMode } from '../js/track-editor/modes/GameplayMode.js';
import { TERRAIN_TILE_ID, BOOST_MARKER_MODEL_ID } from '../js/track-editor/constants/EditorAssetIds.js';

function angleDelta( a, b ) {

	return Math.atan2( Math.sin( a - b ), Math.cos( a - b ) );

}

function createMeshFactory( project ) {

	return {
		createTerrainMesh( gx, gz, tile ) {

			const mesh = new THREE.Object3D();
			mesh.position.set( gx, tile.elevation, gz );
			tile.mesh = mesh;
			project.terrainGroup.add( mesh );
			return mesh;

		},
		createGhostMesh() {

			return new THREE.Object3D();

		},
	};

}

test( 'PlacementController places terrain on empty cells and erases it with the normal erase tool', () => {

	const project = new TrackProject();
	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	const history = new CommandHistory( eventBus );
	const placement = new PlacementController(
		project,
		createMeshFactory( project ),
		null,
		history,
		eventBus,
		state,
		null
	);

	state.activeElevation = ELEV_GROUND + 1;

	const placeCommand = placement.placeTerrain( 3, 4 );
	assert.ok( placeCommand, 'expected terrain placement command' );
	assert.equal( project.getTerrainTile( 3, 4 )?.type, TERRAIN_TILE_ID );
	assert.equal( project.getTerrainTile( 3, 4 )?.elevation, ELEV_GROUND + 1 );

	assert.equal( placement.placeTerrain( 3, 4 ), null, 'duplicate terrain placement should be blocked' );

	const erased = placement.eraseRoad( 3, 4 );
	assert.ok( erased, 'erase tool should remove terrain when no track tile exists' );
	assert.equal( project.getTerrainTile( 3, 4 ), null );

	project.setTile( 6, 7, new TrackTile( 'trk-straight', 0, ELEV_GROUND ) );
	assert.equal( placement.placeTerrain( 6, 7 ), null, 'terrain cannot overlap track tiles' );

} );

test( 'GameplayMode renders boost markers using the turbo tile model', () => {

	const project = new TrackProject();
	project.setTile( 1, 1, new TrackTile( 'trk-straight', 0, ELEV_GROUND ) );

	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	state.tool = 'boost';

	const turboModel = new THREE.Group();
	turboModel.add( new THREE.Mesh( new THREE.BoxGeometry( 1, 0.2, 1 ), new THREE.MeshBasicMaterial() ) );

	const gameplayMode = new GameplayMode( state, eventBus, project, {
		cloneModel( modelId ) {

			if ( modelId !== BOOST_MARKER_MODEL_ID ) return null;
			return turboModel.clone( true );

		},
	} );

	gameplayMode.handlePointerDown( 1, 1, {} );

	assert.equal( gameplayMode.getMarkers().length, 1 );
	const marker = gameplayMode.getMarkers()[ 0 ];
	assert.ok( marker.mesh, 'boost marker should create a mesh' );
	assert.equal( marker.mesh.children.length, 1 );
	assert.equal( marker.mesh.children[ 0 ].position.x, 15 );
	assert.equal( marker.mesh.children[ 0 ].position.z, 15 );

} );

test( 'GameplayMode aligns boost markers with track direction and cycles boost layouts on repeat clicks', () => {

	const project = new TrackProject();
	project.setTile( 0, 1, new TrackTile( 'trk-finish', 0, ELEV_GROUND ) );
	project.getTile( 0, 1 ).isFinish = true;
	project.setTile( 0, 0, new TrackTile( 'trk-corner-1x1', 16, ELEV_GROUND ) );
	project.setTile( 1, 0, new TrackTile( 'trk-straight', 16, ELEV_GROUND ) );
	project.setTile( 2, 0, new TrackTile( 'trk-corner-1x1', 0, ELEV_GROUND ) );
	project.setTile( 2, 1, new TrackTile( 'trk-straight', 0, ELEV_GROUND ) );
	project.setTile( 2, 2, new TrackTile( 'trk-corner-1x1', 22, ELEV_GROUND ) );
	project.setTile( 1, 2, new TrackTile( 'trk-straight', 16, ELEV_GROUND ) );
	project.setTile( 0, 2, new TrackTile( 'trk-corner-1x1', 10, ELEV_GROUND ) );

	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	state.tool = 'boost';

	const gameplayMode = new GameplayMode( state, eventBus, project, {
		cloneModel( modelId ) {

			if ( modelId !== BOOST_MARKER_MODEL_ID ) return null;
			return new THREE.Mesh( new THREE.BoxGeometry( 1, 0.2, 1 ), new THREE.MeshBasicMaterial() );

		},
		getDefinition() {

			return { category: 'road' };

		},
	} );

	gameplayMode.handlePointerDown( 1, 2, {} );
	assert.equal( gameplayMode.getMarkers().length, 1 );
	const marker = gameplayMode.getMarkers()[ 0 ];
	assert.equal( marker.settings.layout, 'center' );
	assert.equal( marker.mesh.children.length, 1 );
	assert.ok( Math.abs( angleDelta( marker.orient, Math.PI / 2 ) ) < 1e-6, 'route intel should orient the top straight eastbound' );

	gameplayMode.handlePointerDown( 1, 2, {} );
	assert.equal( marker.settings.layout, 'left' );
	assert.equal( marker.mesh.children.length, 1 );
	const leftPos = marker.mesh.children[ 0 ].position.clone();
	assert.ok( leftPos.z < 25, 'left-aligned eastbound boost should shift toward north edge' );

	gameplayMode.handlePointerDown( 1, 2, {} );
	assert.equal( marker.settings.layout, 'right' );
	const rightPos = marker.mesh.children[ 0 ].position.clone();
	assert.ok( rightPos.z > 25, 'right-aligned eastbound boost should shift toward south edge' );

	gameplayMode.handlePointerDown( 1, 2, {} );
	assert.equal( marker.settings.layout, 'split' );
	assert.equal( marker.mesh.children.length, 2 );

	gameplayMode.handlePointerDown( 1, 2, {} );
	assert.equal( marker.settings.layout, 'center' );
	assert.equal( marker.mesh.children.length, 1 );

} );

test( 'GameplayMode blocks boost placement on turn and jump tiles', () => {

	const project = new TrackProject();
	project.setTile( 0, 0, new TrackTile( 'trk-corner-1x1', 0, ELEV_GROUND ) );
	project.setTile( 1, 0, new TrackTile( 'trk-jump-long', 0, ELEV_GROUND ) );

	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	state.tool = 'boost';

	const gameplayMode = new GameplayMode( state, eventBus, project, {
		cloneModel() {

			return new THREE.Mesh( new THREE.BoxGeometry( 1, 0.2, 1 ), new THREE.MeshBasicMaterial() );

		},
		getDefinition( tileId ) {

			if ( tileId === 'trk-corner-1x1' ) return { category: 'turn' };
			if ( tileId === 'trk-jump-long' ) return { category: 'jump' };
			return { category: 'road' };

		},
	} );

	gameplayMode.handlePointerDown( 0, 0, {} );
	gameplayMode.handlePointerDown( 1, 0, {} );

	assert.equal( gameplayMode.getMarkers().length, 0 );

} );

test( 'PlacementController finish ghost arrows point in the true race start direction', () => {

	const project = new TrackProject();
	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	const history = new CommandHistory( eventBus );
	state.selectedOrient = 0;
	const placement = new PlacementController(
		project,
		createMeshFactory( project ),
		null,
		history,
		eventBus,
		state,
		null
	);

	placement.updateGhost( 2, 3, 'finish' );

	assert.equal( placement.ghostGroup.children.length, 5 );
	const arrow1 = placement.ghostGroup.children[ 3 ];
	const arrow2 = placement.ghostGroup.children[ 4 ];
	assert.ok( Math.abs( angleDelta( arrow1.rotation.z, Math.PI ) ) < 1e-6 );
	assert.ok( Math.abs( angleDelta( arrow2.rotation.z, Math.PI ) ) < 1e-6 );

} );

test( 'BuildMode erase removes gameplay markers before touching track or terrain layers', () => {

	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	state.tool = 'erase';
	const history = new CommandHistory( eventBus );
	let eraseRoadCalls = 0;
	let markerEraseCalls = 0;

	const buildMode = new BuildMode( state, eventBus, {
		eraseRoad() {

			eraseRoadCalls ++;
			return {};

		},
	}, history );

	buildMode.setGameplayMode( {
		removeMarkersAt( gx, gz ) {

			markerEraseCalls ++;
			return gx === 4 && gz === 7 ? 1 : 0;

		},
	} );

	buildMode._eraseAt( 4, 7 );
	assert.equal( markerEraseCalls, 1 );
	assert.equal( eraseRoadCalls, 0 );

	buildMode._eraseAt( 2, 3 );
	assert.equal( markerEraseCalls, 2 );
	assert.equal( eraseRoadCalls, 1 );

} );
