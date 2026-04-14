import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' );

}

function readJson( relPath ) {

	return JSON.parse( readText( relPath ) );

}

function getTextureUri( gltf, textureIndex ) {

	const textureDef = gltf.textures?.[ textureIndex ];
	assert.ok( textureDef, `Missing texture definition at index ${ textureIndex }` );

	const imageDef = gltf.images?.[ textureDef.source ];
	assert.ok( imageDef, `Missing image definition for texture index ${ textureIndex }` );
	return imageDef.uri;

}

function assertLobbyMaterialConfig( source, materialName, expectedConfigLines ) {

	const escapedMaterialName = materialName.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	const expectedBlock = expectedConfigLines.map( ( line ) => line.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ).join( '\\s*' );
	const blockPattern = new RegExp(
		`'${ escapedMaterialName }': Object\\.freeze\\( \\{\\s*${ expectedBlock }\\s*\\} \\)`,
		'm'
	);
	assert.match( source, blockPattern );

}

test( 'LobbyScene pins the lobby environment to Lobby.gltf only', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.match( source, /const LOBBY_MODEL_PATH = 'models\/environments\/Lobby\.gltf';/ );
	assert.doesNotMatch( source, /lobby\.glb/i );

} );

test( 'LobbyScene bakes in the tuned scene defaults', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.ok( source.includes( 'const CAM_POS  = new THREE.Vector3( 0.00, 1.70, 4.50 );' ) );
	assert.ok( source.includes( 'const LOOK_AT  = new THREE.Vector3( 0.00, 0.00, 0.40 );' ) );
	assert.ok( source.includes( 'const CAM_FOV  = 75;' ) );
	assert.ok( source.includes( 'const KART_POS   = new THREE.Vector3( 0.00, 0.40, 2.10 );' ) );
	assert.ok( source.includes( 'const KART_SCALE = 1.15;' ) );
	assert.ok( source.includes( 'const KART_ROT_Y_DEG = 2447;' ) );
	assert.ok( source.includes( 'const LOBBY_FOG_DENSITY = 0.0000;' ) );
	assert.ok( source.includes( 'const LOBBY_AMBIENT_INTENSITY = 0.00;' ) );
	assert.ok( source.includes( 'const LOBBY_DIR_LIGHT_INTENSITY = 2.50;' ) );
	assert.ok( source.includes( 'const LOBBY_DIR_LIGHT_POS = new THREE.Vector3( - 0.49, 0.02, 0.09 );' ) );
	assert.ok( source.includes( 'const LOBBY_RIM_LIGHT_INTENSITY = 1.90;' ) );
	assert.ok( source.includes( 'const LOBBY_RIM_LIGHT_POS = new THREE.Vector3( 2.04, 2.45, 1.54 );' ) );
	assert.ok( source.includes( 'const LOBBY_BLOOM_STRENGTH = 0.10;' ) );
	assert.ok( source.includes( 'const LOBBY_BLOOM_RADIUS = 0.59;' ) );
	assert.ok( source.includes( 'const LOBBY_BLOOM_THRESHOLD = 1.41;' ) );
	assert.ok( source.includes( 'this._kartGroup.rotation.y = THREE.MathUtils.degToRad( KART_ROT_Y_DEG );' ) );

} );

test( 'LobbyScene bakes in the tuned lobby material preset values', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assertLobbyMaterialConfig( source, 'Lobby Props', [
		"debugLabel: 'Lobby Props (Lobby2)',",
		"ormPath: 'models/environments/textures/Lobby2_OcclusionRoughnessMetallic.png',",
		'emissiveIntensity: 10.0,',
		'emissiveColor: Object.freeze( { r: 0.07, g: 0.34, b: 1.00 } ),',
		'normalScale: Object.freeze( { x: 0.00, y: 0.00 } ),',
		'aoMapIntensity: 1.50,',
		'roughness: 0.65,',
		'metalness: 1.00,',
		'envMapIntensity: 1.80,',
		'baseColor: Object.freeze( { r: 1.00, g: 1.00, b: 1.00 } ),',
		'opacity: 1.00,',
	] );

	assertLobbyMaterialConfig( source, 'LobbyRoom_Atlas', [
		"debugLabel: 'LobbyRoom Atlas (Lobby1)',",
		"ormPath: 'models/environments/textures/Lobby1_OcclusionRoughnessMetallic.png',",
		'emissiveIntensity: 10.0,',
		'emissiveColor: Object.freeze( { r: 0.11, g: 0.00, b: 1.00 } ),',
		'normalScale: Object.freeze( { x: 3.00, y: 3.00 } ),',
		'aoMapIntensity: 3.00,',
		'roughness: 0.90,',
		'metalness: 1.00,',
		'envMapIntensity: 1.10,',
		'baseColor: Object.freeze( { r: 1.00, g: 1.00, b: 1.00 } ),',
		'opacity: 1.00,',
	] );

	assert.ok( source.includes( 'mat.color.setRGB( config.baseColor.r, config.baseColor.g, config.baseColor.b );' ) );
	assert.ok( source.includes( 'mat.opacity = config.opacity;' ) );
	assert.ok( source.includes( 'mat.transparent = config.opacity < 1;' ) );

} );

test( 'Lobby.gltf wires packed ORM textures for both lobby materials', () => {

	const gltf = readJson( 'models/environments/Lobby.gltf' );
	const expectedMaterials = new Map( [
		[ 'Lobby Props', 'textures/Lobby2_OcclusionRoughnessMetallic.png' ],
		[ 'LobbyRoom_Atlas', 'textures/Lobby1_OcclusionRoughnessMetallic.png' ],
	] );

	for ( const [ materialName, expectedOrmUri ] of expectedMaterials ) {

		const materialDef = gltf.materials?.find( ( material ) => material.name === materialName );
		assert.ok( materialDef, `Missing lobby material: ${ materialName }` );

		const occlusionIndex = materialDef.occlusionTexture?.index;
		const ormIndex = materialDef.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
		assert.equal( occlusionIndex, ormIndex, `${ materialName } should share the packed ORM texture index` );
		assert.equal( getTextureUri( gltf, ormIndex ), expectedOrmUri );

	}

} );

test( 'Lobby ORM texture files exist on disk', () => {

	assert.equal(
		existsSync( new URL( '../models/environments/textures/Lobby1_OcclusionRoughnessMetallic.png', import.meta.url ) ),
		true
	);
	assert.equal(
		existsSync( new URL( '../models/environments/textures/Lobby2_OcclusionRoughnessMetallic.png', import.meta.url ) ),
		true
	);

} );
