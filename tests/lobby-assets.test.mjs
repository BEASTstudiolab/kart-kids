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
	assert.ok( source.includes( 'mixer.update( 0 );' ) );
	assert.ok( source.includes( 'if ( this._mixer ) this._mixer.update( safeDt );' ) );
	assert.doesNotMatch( source, /action\.paused = true;/ );
	assert.doesNotMatch( source, /this\._kartGroup\.rotation\.y \+= 0\.15 \* dt;/ );

} );

test( 'LobbyScene coordinates the first reveal and swaps complete preview bundles atomically', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.ok( source.includes( 'this.ready = false;' ) );
	assert.ok( source.includes( 'this._initialRevealReady = new Promise' ) );
	assert.ok( source.includes( 'whenInitialRevealReady() {' ) );
	assert.ok( source.includes( 'void this._loadLobbyEnvironment();' ) );
	assert.ok( source.includes( 'const [ kartGltf, meshGltf, animGltf ] = await Promise.all( [' ) );
	assert.ok( source.includes( 'this._applyKartBundle( bundle );' ) );
	assert.ok( source.includes( 'this._markPreviewReadyIfComplete();' ) );
	assert.ok( source.includes( 'this._clearKartGroup();' ) );
	assert.ok( source.includes( 'if ( gen !== this._loadGen ) {' ) );

} );

test( 'LobbyScene reports bootstrap preview progress across the initial reveal steps', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.ok( source.includes( 'setLoadingProgressReporter( callback ) {' ) );
	assert.ok( source.includes( "this._emitInitialLoadProgress( 'Preparing first menu scene' );" ) );
	assert.ok( source.includes( "this._emitInitialLoadProgress( 'Loading selected kart' );" ) );
	assert.ok( source.includes( "this._markInitialLoadStep( 'environment', 'Environment ready' );" ) );
	assert.ok( source.includes( "this._markInitialLoadStep( 'kart', 'Kart ready' );" ) );
	assert.ok( source.includes( "this._markInitialLoadStep( 'character', gltf?.scene ? 'Driver ready' : 'Driver fallback ready' );" ) );
	assert.ok( source.includes( "this._markInitialLoadStep( 'animation', gltf?.animations?.length ? 'Animation ready' : 'Animation fallback ready' );" ) );
	assert.ok( source.includes( 'progress: total > 0 ? ( loaded / total ) : 1,' ) );
	assert.ok( source.includes( 'detail,' ) );
	assert.ok( source.includes( 'loaded,' ) );
	assert.ok( source.includes( 'total,' ) );

} );

test( 'LobbyScene wires shared menu blink tuning and exposes blink debug sliders', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.match( source, /import \{\s*getMenuCharacterBlinkTuning,\s*MenuCharacterBlinkController,\s*setMenuCharacterBlinkTuning,\s*\} from '\.\/MenuCharacterBlinkController\.js';/m );
	assert.ok( source.includes( 'this._blinkController = new MenuCharacterBlinkController();' ) );
	assert.ok( source.includes( 'this._blinkController.bind( bundle.characterRoot );' ) );
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
	assert.ok( source.includes( 'retargetPreviewPoseTransition(' ) );
	assert.ok( source.includes( 'advancePreviewPoseTransition( this._previewPoseTransition, safeDt )' ) );

} );

test( 'LobbyScene bakes in the tuned lobby material preset values', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assertLobbyMaterialConfig( source, 'Lobby Props', [
		"debugLabel: 'Lobby Props (Lobby2)',",
		"ormPath: 'models/environments/textures/Lobby2_OcclusionRoughnessMetallic.webp',",
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
		"ormPath: 'models/environments/textures/Lobby1_OcclusionRoughnessMetallic.webp',",
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

test( 'LobbyScene exposes a full character material lab in the lobby debug panel', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.ok( source.includes( 'const CHARACTER_DEBUG_TEXTURE_KEYS = Object.freeze( [' ) );
	assert.ok( source.includes( "return typeof materialName === 'string' ? materialName.trim() : '';" ) );
	assert.ok( source.includes( 'function createCharacterMaterialDebugSnapshot( material, maxTextureAnisotropy = 1 ) {' ) );
	assert.ok( source.includes( 'function cloneCharacterMaterialDebugState( state ) {' ) );
	assert.ok( source.includes( 'function getCharacterMaterialNormalStrength( state, baselineState = null ) {' ) );
	assert.ok( source.includes( 'function applyCharacterMaterialNormalStrength( state, baselineState = null, nextStrength = 1 ) {' ) );
	assert.ok( source.includes( 'this._maxTextureAnisotropy = Math.max(' ) );
	assert.ok( source.includes( 'this._characterMaterialDebugSettings = new Map();' ) );
	assert.ok( source.includes( 'this._characterMaterialDebugBaselines = new Map();' ) );
	assert.ok( source.includes( 'this._refreshCharacterDebugTab = null;' ) );
	assert.ok( source.includes( 'this._captureCharacterMaterialDebugBaselines();' ) );
	assert.ok( source.includes( '_getCharacterMaterialDebugExportPayload( materialNames = null ) {' ) );
	assert.ok( source.includes( '_copyCharacterMaterialDebugPayload( materialNames = null ) {' ) );
	assert.ok( source.includes( 'JSON.stringify( payload, null, 2 )' ) );
	assert.ok( source.includes( 'normalStrength: getCharacterMaterialNormalStrength( state, baseline ),' ) );
	assert.ok( source.includes( 'this._applyCharacterMaterialDebugOverrides();' ) );
	assert.ok( source.includes( '_applyCharacterMaterialDebugOverrides() {' ) );
	assert.ok( source.includes( 'originalTexture.anisotropy = THREE.MathUtils.clamp(' ) );
	assert.ok( source.includes( 'material.normalMap = state.normalMapEnabled ? ( originalTextures.normalMap || null ) : null;' ) );
	assert.ok( source.includes( 'material.normalScale.set( state.normalScale?.x ?? 1, state.normalScale?.y ?? 1 );' ) );
	assert.ok( source.includes( 'material.flatShading = !! state.flatShading;' ) );
	assert.ok( source.includes( 'material.depthWrite = state.depthWrite !== false;' ) );
	assert.ok( source.includes( "const characterTab = createTab( 'CHARACTER' );" ) );
	assert.ok( source.includes( "addSection( characterTab, 'CHARACTER MATERIAL LAB' );" ) );
	assert.ok( source.includes( 'characterIntro.textContent = `Slim inspector rail for live rider tuning.' ) );
	assert.ok( source.includes( "'COPY ALL'" ) );
	assert.ok( source.includes( "'RESET ALL'" ) );
	assert.ok( source.includes( "'Flat Shade'" ) );
	assert.ok( source.includes( 'self._characterDebugExpandedMaterialName === entry.name' ) );
	assert.ok( source.includes( "headerLabel.textContent = `${ isExpanded ? '\\u25BE' : '\\u25B8' } ${ entry.name.toUpperCase() }`;" ) );
	assert.ok( source.includes( "addSlider( block, 'Strength', 0, 4, 0.05, getCharacterMaterialNormalStrength( state, baseline ), ( value ) => {" ) );
	assert.ok( source.includes( 'copyMaterialBtn = addActionButton( materialActionGrid, \'COPY\'' ) );
	assert.ok( source.includes( 'resetMaterialBtn = addActionButton( materialActionGrid, \'RESET\'' ) );

} );

test( 'LobbyScene exposes a full vehicle material lab in the lobby debug panel', () => {

	const source = readText( 'js/ui/LobbyScene.js' );

	assert.ok( source.includes( 'function isObject3DDescendantOf( node, ancestor ) {' ) );
	assert.ok( source.includes( 'this._vehicleMaterialDebugSettings = new Map();' ) );
	assert.ok( source.includes( 'this._vehicleMaterialDebugBaselines = new Map();' ) );
	assert.ok( source.includes( 'this._refreshVehicleDebugTab = null;' ) );
	assert.ok( source.includes( 'this._captureVehicleMaterialDebugBaselines();' ) );
	assert.ok( source.includes( 'this._applyVehicleMaterialDebugOverrides();' ) );
	assert.ok( source.includes( '_collectVehicleMaterialEntries() {' ) );
	assert.ok( source.includes( 'if ( this._currentCharacterRoot && isObject3DDescendantOf( child, this._currentCharacterRoot ) ) return;' ) );
	assert.ok( source.includes( '_copyVehicleMaterialDebugPayload( materialNames = null ) {' ) );
	assert.ok( source.includes( '_applyVehicleMaterialDebugOverride( materialName, material, state ) {' ) );
	assert.ok( source.includes( 'material.userData._kkVehicleDebugOriginalTextures = originalTextures;' ) );
	assert.ok( source.includes( "const vehicleTab = createTab( 'VEHICLE' );" ) );
	assert.ok( source.includes( "addSection( vehicleTab, 'VEHICLE MATERIAL LAB' );" ) );
	assert.ok( source.includes( 'vehicleIntro.textContent = `Live kart material tuning for paint, metal, and reflections.' ) );
	assert.ok( source.includes( "waiting.textContent = 'Kart preview not ready yet.';" ) );
	assert.ok( source.includes( "'COPY ALL'" ) );
	assert.ok( source.includes( "'RESET ALL'" ) );
	assert.ok( source.includes( 'self._vehicleDebugExpandedMaterialName === entry.name' ) );
	assert.ok( source.includes( "addSlider( block, 'Metal', 0, 1, 0.01, state.metalness, ( value ) => {" ) );
	assert.ok( source.includes( "addSlider( block, 'Env Int', 0, 5, 0.05, state.envMapIntensity, ( value ) => {" ) );
	assert.ok( source.includes( "self._copyVehicleMaterialDebugPayload( [ entry.name ] )" ) );
	assert.ok( source.includes( "self._resetVehicleMaterialDebugState( entry.name );" ) );

} );

test( 'Lobby.gltf wires packed ORM textures for both lobby materials', () => {

	const gltf = readJson( 'models/environments/Lobby.gltf' );
	const expectedMaterials = new Map( [
		[ 'Lobby Props', 'textures/Lobby2_OcclusionRoughnessMetallic.webp' ],
		[ 'LobbyRoom_Atlas', 'textures/Lobby1_OcclusionRoughnessMetallic.webp' ],
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

test( 'Character balaclava material includes base and normal textures for debug fidelity tuning', () => {

	const gltf = readJson( 'models/characters/Kart_Beast_Rest-Armature.gltf' );
	const balaclavaMaterial = gltf.materials?.find( ( material ) => ( material.name || '' ).trim() === 'Masks Batch' );
	assert.ok( balaclavaMaterial, 'Expected the rider balaclava material to exist' );

	const baseTextureIndex = balaclavaMaterial.pbrMetallicRoughness?.baseColorTexture?.index;
	const normalTextureIndex = balaclavaMaterial.normalTexture?.index;
	assert.notEqual( baseTextureIndex, undefined, 'Expected a balaclava base color texture' );
	assert.notEqual( normalTextureIndex, undefined, 'Expected a balaclava normal texture' );
	assert.equal( getTextureUri( gltf, baseTextureIndex ), 'textures/Masks_BaseColor.webp' );
	assert.equal( getTextureUri( gltf, normalTextureIndex ), 'textures/Masks_Normal.webp' );

} );

test( 'Lobby ORM texture files exist on disk', () => {

	assert.equal(
		existsSync( new URL( '../models/environments/textures/Lobby1_OcclusionRoughnessMetallic.webp', import.meta.url ) ),
		true
	);
	assert.equal(
		existsSync( new URL( '../models/environments/textures/Lobby2_OcclusionRoughnessMetallic.webp', import.meta.url ) ),
		true
	);

} );
