import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { buildTrack } from '../js/Track.js';
import { TERRAIN_TILE_ID } from '../js/track-editor/constants/EditorAssetIds.js';

function createModel() {

	const root = new THREE.Group();
	root.add( new THREE.Mesh( new THREE.BoxGeometry( 1, 0.1, 1 ), new THREE.MeshBasicMaterial() ) );
	return root;

}

test( 'buildTrack renders editor terrain tiles in a dedicated runtime group', () => {

	const scene = new THREE.Scene();
	const models = {
		[ TERRAIN_TILE_ID ]: createModel(),
	};

	const trackGroup = buildTrack( scene, models, [], [], [
		{ gx: 2, gz: 1, type: TERRAIN_TILE_ID, e: 12 },
	] );

	const terrainGroup = trackGroup.getObjectByName( 'editor-terrain' );
	assert.ok( terrainGroup );
	assert.equal( terrainGroup.children.length, 1 );

} );

test( 'buildTrack applies editor prop rotation values in runtime tracks', () => {

	const scene = new THREE.Scene();
	const models = {
		'decor-test': createModel(),
	};

	const trackGroup = buildTrack( scene, models, [], [
		{ type: 'decor-test', pos: [ 12, 3, 8 ], rotY: Math.PI / 2 },
	], [] );

	const propsGroup = trackGroup.getObjectByName( 'editor-props' );
	assert.ok( propsGroup );
	assert.equal( propsGroup.children.length, 1 );
	assert.ok( Math.abs( propsGroup.children[ 0 ].rotation.y - Math.PI / 2 ) < 1e-6 );

} );

test( 'GameEngine wires terrain payloads from v4 config, share links, and local editor storage', () => {

	const source = readFileSync( new URL( '../js/GameEngine.js', import.meta.url ), 'utf8' );

	assert.equal( source.includes( "_resolveTerrainTiles( config.trackData ) || []" ), true );
	assert.equal( source.includes( "_resolveTerrainTiles( v4 ) || []" ), true );
	assert.equal( source.includes( "terrainTiles = _resolveTerrainTiles( v4 );" ), true );
	assert.equal( source.includes( "buildTrack( scene, models, renderCells, props, terrainTiles || [] )" ), true );
	assert.equal( source.includes( "props = config.props ?? _resolveProps( config.trackData ) ?? null;" ), true );
	assert.equal( source.includes( "props = config.props ?? _resolveProps( v4 ) ?? null;" ), true );
	assert.equal( source.includes( "markers = config.markers ?? _resolveMarkers( config.trackData ) ?? null;" ), true );
	assert.equal( source.includes( "markers = config.markers ?? _resolveMarkers( v4 ) ?? null;" ), true );
	assert.equal( source.includes( "trackAppearance = normalizeTrackAppearance( config.trackAppearance ?? _resolveTrackAppearance( config.trackData ) );" ), true );
	assert.equal( source.includes( "trackAppearance = normalizeTrackAppearance( config.trackAppearance ?? _resolveTrackAppearance( v4 ) );" ), true );
	assert.equal( source.includes( "extraModelNames.add( BOOST_MARKER_MODEL_ID );" ), true );
	assert.equal( source.includes( "_createRuntimeBoostPads(" ), true );
	assert.equal( source.includes( "_updateBoostPadCollisions( _allActiveVehicles );" ), true );
	assert.equal( source.includes( "extraModelNames: [ ...extraModelNames ]" ), true );
	assert.equal( source.includes( "boostMesh.position.set( padCenter.x, worldY + BOOST_PAD_VISUAL_LIFT, padCenter.z );" ), true );
	assert.equal( source.includes( "runtimeBoostPads.group.updateMatrixWorld( true );" ), true );

} );

test( 'solo race entrypoints preserve full v4 track payloads so props and markers reach runtime', () => {

	const playModesSource = readFileSync( new URL( '../js/ui/pages/page04-play-modes/Page04PlayModesController.js', import.meta.url ), 'utf8' );
	const appShellSource = readFileSync( new URL( '../js/ui/core/AppShell.js', import.meta.url ), 'utf8' );

	assert.equal( playModesSource.includes( 'trackData: track.trackData || track.cells' ), true );
	assert.equal( appShellSource.includes( 'nextConfig.trackData = track.trackData || track.cells;' ), true );

} );
