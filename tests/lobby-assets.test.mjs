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

	assert.ok( source.includes( 'const CAM_POS  = new THREE.Vector3( 0.00, 2.30, 5.70 );' ) );
	assert.ok( source.includes( 'const LOOK_AT  = new THREE.Vector3( 0.00, 0.00, 0.40 );' ) );
	assert.ok( source.includes( 'const CAM_FOV  = 70;' ) );
	assert.ok( source.includes( 'const KART_POS   = new THREE.Vector3( 0.00, 0.40, 1.50 );' ) );
	assert.ok( source.includes( 'const KART_SCALE = 1.15;' ) );
	assert.ok( source.includes( 'const KART_ROT_Y_DEG = 1436;' ) );
	assert.ok( source.includes( 'const LOBBY_FOG_DENSITY = 0.0000;' ) );
	assert.ok( source.includes( 'const LOBBY_AMBIENT_INTENSITY = 0.00;' ) );
	assert.ok( source.includes( 'const LOBBY_DIR_LIGHT_INTENSITY = 2.50;' ) );
	assert.ok( source.includes( 'const LOBBY_DIR_LIGHT_POS = new THREE.Vector3( - 0.50, 0.00, 0.10 );' ) );
	assert.ok( source.includes( 'const LOBBY_RIM_LIGHT_INTENSITY = 1.90;' ) );
	assert.ok( source.includes( 'const LOBBY_RIM_LIGHT_POS = new THREE.Vector3( 2.00, 2.50, 1.50 );' ) );
	assert.ok( source.includes( 'const LOBBY_BLOOM_STRENGTH = 0.10;' ) );
	assert.ok( source.includes( 'const LOBBY_BLOOM_RADIUS = 0.59;' ) );
	assert.ok( source.includes( 'const LOBBY_BLOOM_THRESHOLD = 1.41;' ) );
	assert.ok( source.includes( "'kart-1': Object.freeze( { x: - 0.22, y: - 0.06, z: - 0.07 } )," ) );
	assert.ok( source.includes( 'this._kartGroup.rotation.y = this._currentKartRotationY;' ) );

} );

test( 'LobbyScene uses the animated garage idle rider pose for the menu kart preview', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.match( source, /import \{ CHARACTER_GARAGE_IDLE_ANIMATION_PATH, CHARACTER_MODEL_PATH \} from '\.\.\/CharacterCustomization\.js';/ );
	assert.match( source, /const CHARACTER_ANIM_PATH = CHARACTER_GARAGE_IDLE_ANIMATION_PATH;/ );
	assert.ok( source.includes( 'action.reset();' ) );
	assert.ok( source.includes( 'action.play();' ) );
	assert.ok( source.includes( 'this._mixer.update( 0 );' ) );
	assert.ok( source.includes( 'if ( this._mixer ) this._mixer.update( dt );' ) );
	assert.doesNotMatch( source, /action\.paused = true;/ );
	assert.doesNotMatch( source, /this\._kartGroup\.rotation\.y \+= 0\.15 \* dt;/ );

} );

test( 'LobbyScene wires shared menu blink tuning and exposes blink debug sliders', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.match( source, /import \{\s*getMenuCharacterBlinkTuning,\s*MenuCharacterBlinkController,\s*setMenuCharacterBlinkTuning,\s*\} from '\.\/MenuCharacterBlinkController\.js';/m );
	assert.ok( source.includes( 'this._blinkController = new MenuCharacterBlinkController();' ) );
	assert.ok( source.includes( 'this._blinkController.bind( character );' ) );
	assert.ok( source.includes( 'this._blinkController.update( dt );' ) );
	assert.ok( source.includes( "addSection( sceneTab, 'BLINK' );" ) );
	assert.ok( source.includes( "addSlider( sceneTab, 'Frequency (sec)', 0.0, 12.0, 0.1, initialBlinkTuning.frequencySeconds, ( v ) => {" ) );
	assert.ok( source.includes( "setMenuCharacterBlinkTuning( { frequencySeconds: v } );" ) );
	assert.ok( source.includes( "addSlider( sceneTab, 'Speed (sec)', 0.05, 0.40, 0.01, initialBlinkTuning.speedSeconds, ( v ) => {" ) );
	assert.ok( source.includes( "setMenuCharacterBlinkTuning( { speedSeconds: v } );" ) );

} );

test( 'LobbyScene wires menu character normal debug tuning and exposes normal intensity sliders', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.match( source, /import \{\s*applyMenuCharacterMaterialDebugTuning,\s*getMenuCharacterMaterialDebugTuning,\s*getMenuCharacterMaterialDebugVersion,\s*setMenuCharacterMaterialDebugTuning,\s*\} from '\.\/MenuCharacterMaterialDebug\.js';/m );
	assert.ok( source.includes( 'this._characterMaterialDebugVersion = - 1;' ) );
	assert.ok( source.includes( 'applyMenuCharacterMaterialDebugTuning( this._currentCharacterRoot );' ) );
	assert.ok( source.includes( "addSection( sceneTab, 'CHARACTER NORMALS' );" ) );
	assert.ok( source.includes( "addSlider( sceneTab, 'Mask Normal', 0.0, 3.0, 0.05, initialMaterialDebugTuning.maskNormalIntensity, ( v ) => {" ) );
	assert.ok( source.includes( "addSlider( sceneTab, 'Jeans Normal', 0.0, 3.0, 0.05, initialMaterialDebugTuning.jeansNormalIntensity, ( v ) => {" ) );
	assert.ok( source.includes( "addSlider( sceneTab, 'Shirt Normal', 0.0, 3.0, 0.05, initialMaterialDebugTuning.shirtNormalIntensity, ( v ) => {" ) );

} );

test( 'LobbyScene supports contextual menu preview presets', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.ok( source.includes( "PLAY: 'play'," ) );
	assert.ok( source.includes( "CHARACTER_BODY: 'character-body'," ) );
	assert.ok( source.includes( "CHARACTER_FACE: 'character-face'," ) );
	assert.ok( source.includes( "CHARACTER_ACCESSORIES: 'character-accessories'," ) );
	assert.ok( source.includes( "CHARACTER_SHIRT: 'character-shirt'," ) );
	assert.ok( source.includes( "CHARACTER_PANTS: 'character-pants'," ) );
	assert.ok( source.includes( "GARAGE_KART: 'garage-kart'," ) );
	assert.ok( source.includes( '[ MENU_PREVIEW_PRESET_IDS.CHARACTER_ACCESSORIES ]: Object.freeze( {' ) );
	assert.ok( source.includes( '[ MENU_PREVIEW_PRESET_IDS.CHARACTER_SHIRT ]: Object.freeze( {' ) );
	assert.ok( source.includes( '[ MENU_PREVIEW_PRESET_IDS.CHARACTER_PANTS ]: Object.freeze( {' ) );
	assert.ok( source.includes( 'cameraPos: Object.freeze( { x: - 1.50, y: 1.63, z: 5.82 } ),' ) );
	assert.ok( source.includes( 'lookAt: Object.freeze( { x: - 1.06, y: 1.00, z: 0.05 } ),' ) );
	assert.ok( source.includes( 'cameraPos: Object.freeze( { x: - 1.50, y: 1.80, z: 5.04 } ),' ) );
	assert.ok( source.includes( 'lookAt: Object.freeze( { x: 0.18, y: 2.06, z: - 0.02 } ),' ) );
	assert.ok( source.includes( 'cameraPos: Object.freeze( { x: - 1.50, y: 1.72, z: 4.92 } ),' ) );
	assert.ok( source.includes( 'lookAt: Object.freeze( { x: 0.17, y: 1.05, z: 0.04 } ),' ) );
	assert.ok( source.includes( 'cameraPos: Object.freeze( { x: - 1.50, y: 1.32, z: 4.59 } ),' ) );
	assert.ok( source.includes( 'lookAt: Object.freeze( { x: 0.56, y: 1.71, z: 0.14 } ),' ) );
	assert.ok( source.includes( 'cameraPos: Object.freeze( { x: - 1.31, y: 0.93, z: 4.67 } ),' ) );
	assert.ok( source.includes( 'lookAt: Object.freeze( { x: 0.56, y: 1.22, z: 0.52 } ),' ) );
	assert.ok( source.includes( 'setPreviewPreset( presetId, { immediate = false } = {} ) {' ) );
	assert.ok( source.includes( 'setPreviewTuning( nextTuning = {}, { immediate = false } = {} ) {' ) );
	assert.ok( source.includes( 'resetPreviewTuning( options = {} ) {' ) );
	assert.ok( source.includes( 'getPreviewTuning() {' ) );
	assert.ok( source.includes( '_syncPreviewTargets() {' ) );
	assert.ok( source.includes( 'getResolvedPreviewPose() {' ) );
	assert.ok( source.includes( 'preset.cameraPos.x + this._previewTuning.cameraOffsetX' ) );
	assert.ok( source.includes( 'preset.lookAt.x + this._previewTuning.lookTargetX' ) );
	assert.ok( source.includes( 'this._targetFov = preset.fov;' ) );
	assert.ok( source.includes( 'this._targetKartRotationYDeg = preset.kartRotYDeg;' ) );
	assert.ok( source.includes( 'this._targetKartRotationY = normalizeRotationRadians( THREE.MathUtils.degToRad( preset.kartRotYDeg ) );' ) );
	assert.ok( source.includes( 'this._currentKartRotationY = dampAngle( this._currentKartRotationY, this._targetKartRotationY, safeDt );' ) );

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
