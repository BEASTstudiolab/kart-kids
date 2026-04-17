/**
 * LobbyScene — 3D environment rendered behind all menu tabs.
 *
 * Shares the WebGLRenderer from GameEngine — AppShell calls update(dt) from its
 * coordinator rAF loop; this class does NOT run its own requestAnimationFrame.
 *
 * Public API:
 *   constructor(renderer)       — set up scene, camera, lights
 *   setKart(kartId)             — load kart + character model, place in scene
 *   setPreviewPreset(presetId)  — retarget camera/kart framing for menu context
 *   clearKart()                 — remove kart + character from scene
 *   update(dt)                  — render frame (static camera, no orbit)
 *   dispose()                   — clean up
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { getVehicleById } from '../VehicleRegistry.js';
import { CHARACTER_GARAGE_IDLE_ANIMATION_PATH, CHARACTER_MODEL_PATH } from '../CharacterCustomization.js';
import { applyPlayerAppearanceToNodes, createDefaultPlayerAppearance, normalizePlayerAppearance } from '../PlayerAppearance.js';
import {
	getMenuCharacterBlinkTuning,
	MenuCharacterBlinkController,
	setMenuCharacterBlinkTuning,
} from './MenuCharacterBlinkController.js';
import {
	applyMenuCharacterMaterialDebugTuning,
	getMenuCharacterMaterialDebugTuning,
	getMenuCharacterMaterialDebugVersion,
	setMenuCharacterMaterialDebugTuning,
} from './MenuCharacterMaterialDebug.js';
import {
	advancePreviewPoseTransition,
	computePreviewPoseTransitionDuration,
	createPreviewPoseTransition,
	normalizeRotationRadians,
	retargetPreviewPoseTransition,
} from './utils/menuPreviewPoseTransition.js';
import { shouldAdoptCharacterMaterialDebugBaseline } from './utils/characterMaterialDebugState.js';

// Camera parameters — tuned from the lobby debug panel.
const CAM_POS  = new THREE.Vector3( 0.00, 2.30, 5.70 );
const LOOK_AT  = new THREE.Vector3( 0.00, 0.00, 0.40 );
const CAM_FOV  = 70;

// Kart placement
const KART_POS   = new THREE.Vector3( 0.00, 0.40, 1.50 );
const KART_SCALE = 1.15;
const KART_ROT_Y_DEG = 1436;
const LOBBY_FOG_DENSITY = 0.0000;
const LOBBY_AMBIENT_INTENSITY = 0.00;
const LOBBY_DIR_LIGHT_INTENSITY = 2.50;
const LOBBY_DIR_LIGHT_POS = new THREE.Vector3( - 0.50, 0.00, 0.10 );
const LOBBY_RIM_LIGHT_INTENSITY = 1.90;
const LOBBY_RIM_LIGHT_POS = new THREE.Vector3( 2.00, 2.50, 1.50 );
const LOBBY_BLOOM_STRENGTH = 0.10;
const LOBBY_BLOOM_RADIUS = 0.59;
const LOBBY_BLOOM_THRESHOLD = 1.41;
const DEFAULT_SEAT_OFFSET = Object.freeze( { x: 0, y: 0, z: 0 } );
const DEFAULT_KART_OFFSET = Object.freeze( { x: 0, y: - 0.5, z: 0.3 } );
const LOBBY_CHARACTER_OFFSET_ADJUSTMENTS = Object.freeze( {
	'kart-1': Object.freeze( { x: - 0.22, y: - 0.06, z: - 0.07 } ),
	'kart-3': Object.freeze( { y: 0.19, z: - 0.03 } ),
	'kart-4': Object.freeze( { y: - 0.06, z: 0.02 } ),
	'kart-7': Object.freeze( { y: 0.11, z: - 0.03 } ),
	'kart-8': Object.freeze( { y: 0.14, z: 0.00 } ),
} );
const MENU_PREVIEW_PRESET_IDS = Object.freeze( {
	PLAY: 'play',
	CHARACTER_BODY: 'character-body',
	CHARACTER_FACE: 'character-face',
	CHARACTER_ACCESSORIES: 'character-accessories',
	CHARACTER_SHIRT: 'character-shirt',
	CHARACTER_PANTS: 'character-pants',
	GARAGE_KART: 'garage-kart',
} );
const MENU_PREVIEW_PRESETS = Object.freeze( {
	[ MENU_PREVIEW_PRESET_IDS.PLAY ]: Object.freeze( {
		cameraPos: Object.freeze( { x: 0.00, y: 2.30, z: 5.70 } ),
		lookAt: Object.freeze( { x: 0.00, y: 0.00, z: 0.40 } ),
		fov: 70,
		kartRotYDeg: 1436,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_BODY ]: Object.freeze( {
		cameraPos: Object.freeze( { x: - 1.50, y: 1.63, z: 5.82 } ),
		lookAt: Object.freeze( { x: - 1.06, y: 1.00, z: 0.05 } ),
		fov: 44,
		kartRotYDeg: 1432,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_FACE ]: Object.freeze( {
		cameraPos: Object.freeze( { x: - 1.50, y: 1.80, z: 5.04 } ),
		lookAt: Object.freeze( { x: 0.18, y: 2.06, z: - 0.02 } ),
		fov: 28,
		kartRotYDeg: 1434,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_ACCESSORIES ]: Object.freeze( {
		cameraPos: Object.freeze( { x: - 1.50, y: 1.72, z: 4.92 } ),
		lookAt: Object.freeze( { x: 0.17, y: 1.05, z: 0.04 } ),
		fov: 34,
		kartRotYDeg: 1433,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_SHIRT ]: Object.freeze( {
		cameraPos: Object.freeze( { x: - 1.50, y: 1.32, z: 4.59 } ),
		lookAt: Object.freeze( { x: 0.56, y: 1.71, z: 0.14 } ),
		fov: 35,
		kartRotYDeg: 1434,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_PANTS ]: Object.freeze( {
		cameraPos: Object.freeze( { x: - 1.31, y: 0.93, z: 4.67 } ),
		lookAt: Object.freeze( { x: 0.56, y: 1.22, z: 0.52 } ),
		fov: 34,
		kartRotYDeg: 1438,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.GARAGE_KART ]: Object.freeze( {
		cameraPos: Object.freeze( { x: 0.52, y: 1.95, z: 4.05 } ),
		lookAt: Object.freeze( { x: 0.10, y: 0.52, z: 0.72 } ),
		fov: 52,
		kartRotYDeg: 1510,
	} ),
} );
const DEFAULT_MENU_PREVIEW_TUNING = Object.freeze( {
	lookTargetX: 0,
	lookTargetY: 0,
	cameraOffsetX: 0,
	cameraOffsetY: 0,
	cameraOffsetZ: 0,
} );
const MENU_PERF_PROFILES = Object.freeze( {
	high: Object.freeze( {
		renderScale: 1.0,
		useComposer: true,
		bloom: true,
	} ),
	medium: Object.freeze( {
		renderScale: 0.8,
		useComposer: true,
		bloom: true,
	} ),
	low: Object.freeze( {
		renderScale: 0.67,
		useComposer: false,
		bloom: false,
	} ),
} );
const MENU_PERF_PROFILE_ORDER = Object.freeze( [ 'low', 'medium', 'high' ] );
const MENU_PERF_SAMPLE_MS = 1500;
const MENU_PERF_LOW_FPS = 34;
const MENU_PERF_HIGH_FPS = 42;
const MENU_PERF_LOW_STREAK = 2;
const MENU_PERF_HIGH_STREAK = 3;
const MENU_PERF_COOLDOWN_MS = 3500;

// Character model — rest armature rides the selected kart using the garage idle loop.
const CHARACTER_MESH_PATH = CHARACTER_MODEL_PATH;
const CHARACTER_ANIM_PATH = CHARACTER_GARAGE_IDLE_ANIMATION_PATH;
const LOBBY_MODEL_PATH = 'models/environments/Lobby.gltf';
const LOBBY_MATERIAL_CONFIGS = Object.freeze( {
	'Lobby Props': Object.freeze( {
		debugLabel: 'Lobby Props (Lobby2)',
		ormPath: 'models/environments/textures/Lobby2_OcclusionRoughnessMetallic.webp',
		emissiveIntensity: 10.0,
		emissiveColor: Object.freeze( { r: 0.07, g: 0.34, b: 1.00 } ),
		normalScale: Object.freeze( { x: 0.00, y: 0.00 } ),
		aoMapIntensity: 1.50,
		roughness: 0.65,
		metalness: 1.00,
		envMapIntensity: 1.80,
		baseColor: Object.freeze( { r: 1.00, g: 1.00, b: 1.00 } ),
		opacity: 1.00,
	} ),
	'LobbyRoom_Atlas': Object.freeze( {
		debugLabel: 'LobbyRoom Atlas (Lobby1)',
		ormPath: 'models/environments/textures/Lobby1_OcclusionRoughnessMetallic.webp',
		emissiveIntensity: 10.0,
		emissiveColor: Object.freeze( { r: 0.11, g: 0.00, b: 1.00 } ),
		normalScale: Object.freeze( { x: 3.00, y: 3.00 } ),
		aoMapIntensity: 3.00,
		roughness: 0.90,
		metalness: 1.00,
		envMapIntensity: 1.10,
		baseColor: Object.freeze( { r: 1.00, g: 1.00, b: 1.00 } ),
		opacity: 1.00,
	} ),
} );
const LOBBY_MATERIAL_ORDER = Object.freeze( Object.keys( LOBBY_MATERIAL_CONFIGS ) );
const CHARACTER_DEBUG_TEXTURE_KEYS = Object.freeze( [
	'map',
	'normalMap',
	'aoMap',
	'roughnessMap',
	'metalnessMap',
	'emissiveMap',
	'alphaMap',
] );

function normalizeDebugMaterialName( materialName ) {

	return typeof materialName === 'string' ? materialName.trim() : '';

}

function isObject3DDescendantOf( node, ancestor ) {

	if ( ! node || ! ancestor ) return false;

	let current = node;
	while ( current ) {

		if ( current === ancestor ) return true;
		current = current.parent || null;

	}

	return false;

}

function cloneDebugColorState( colorState ) {

	if ( ! colorState ) return null;

	return {
		r: Number( colorState.r ) || 0,
		g: Number( colorState.g ) || 0,
		b: Number( colorState.b ) || 0,
	};

}

function cloneDebugVector2State( vectorState, fallbackValue = 0 ) {

	if ( ! vectorState ) {

		return { x: fallbackValue, y: fallbackValue };

	}

	return {
		x: Number( vectorState.x ) || fallbackValue,
		y: Number( vectorState.y ) || fallbackValue,
	};

}

function getDebugNormalAxisSign( value, fallbackSign = 1 ) {

	const numericValue = Number( value );
	if ( numericValue < 0 ) return - 1;
	if ( numericValue > 0 ) return 1;
	return fallbackSign < 0 ? - 1 : 1;

}

function getCharacterMaterialNormalStrength( state, baselineState = null ) {

	if ( ! state?.normalScale ) return 1;

	const baselineScale = baselineState?.normalScale || state.normalScale;
	const ratios = [];

	for ( const axis of [ 'x', 'y' ] ) {

		const baseMagnitude = Math.abs( Number( baselineScale?.[ axis ] ) || 0 );
		const currentMagnitude = Math.abs( Number( state.normalScale?.[ axis ] ) || 0 );
		const divisor = baseMagnitude > 0.0001 ? baseMagnitude : 1;
		ratios.push( currentMagnitude / divisor );

	}

	if ( ratios.length === 0 ) return 1;
	return ratios.reduce( ( total, ratio ) => total + ratio, 0 ) / ratios.length;

}

function applyCharacterMaterialNormalStrength( state, baselineState = null, nextStrength = 1 ) {

	if ( ! state?.normalScale ) return;

	const baselineScale = baselineState?.normalScale || state.normalScale || { x: 1, y: 1 };
	const strength = Number.isFinite( nextStrength ) ? nextStrength : 1;
	const nextScale = { x: 1, y: 1 };

	for ( const axis of [ 'x', 'y' ] ) {

		const baseValue = Number( baselineScale?.[ axis ] ) || 0;
		const baseMagnitude = Math.abs( baseValue ) > 0.0001 ? Math.abs( baseValue ) : 1;
		const fallbackSign = axis === 'y' ? - 1 : 1;
		const axisSign = getDebugNormalAxisSign( baseValue, getDebugNormalAxisSign( state.normalScale?.[ axis ], fallbackSign ) );
		nextScale[ axis ] = axisSign * baseMagnitude * strength;

	}

	state.normalScale.x = nextScale.x;
	state.normalScale.y = nextScale.y;

}

function cloneCharacterMaterialDebugState( state ) {

	if ( ! state ) return null;

	return {
		textureFidelity: Number( state.textureFidelity ) || 1,
		color: cloneDebugColorState( state.color ),
		emissive: cloneDebugColorState( state.emissive ),
		emissiveIntensity: Number( state.emissiveIntensity ) || 0,
		normalScale: cloneDebugVector2State( state.normalScale, 1 ),
		aoMapIntensity: Number( state.aoMapIntensity ) || 0,
		roughness: Number( state.roughness ) || 0,
		metalness: Number( state.metalness ) || 0,
		envMapIntensity: Number( state.envMapIntensity ) || 0,
		opacity: Number( state.opacity ) || 0,
		alphaTest: Number( state.alphaTest ) || 0,
		doubleSided: state.doubleSided !== false,
		wireframe: !! state.wireframe,
		flatShading: !! state.flatShading,
		depthWrite: state.depthWrite !== false,
		transparent: !! state.transparent,
		mapEnabled: !! state.mapEnabled,
		normalMapEnabled: !! state.normalMapEnabled,
		aoMapEnabled: !! state.aoMapEnabled,
		roughnessMapEnabled: !! state.roughnessMapEnabled,
		metalnessMapEnabled: !! state.metalnessMapEnabled,
		emissiveMapEnabled: !! state.emissiveMapEnabled,
		alphaMapEnabled: !! state.alphaMapEnabled,
	};

}

function createCharacterMaterialDebugSnapshot( material, maxTextureAnisotropy = 1 ) {

	if ( ! material?.isMaterial ) return null;

	let textureFidelity = 1;
	for ( const textureKey of CHARACTER_DEBUG_TEXTURE_KEYS ) {

		const texture = material[ textureKey ];
		if ( ! texture?.isTexture ) continue;
		textureFidelity = Math.max( textureFidelity, Math.round( Number( texture.anisotropy ) || 1 ) );

	}

	return {
		textureFidelity: THREE.MathUtils.clamp(
			textureFidelity,
			1,
			Math.max( 1, Math.round( maxTextureAnisotropy ) || 1 )
		),
		color: material.color
			? { r: material.color.r, g: material.color.g, b: material.color.b }
			: null,
		emissive: material.emissive
			? { r: material.emissive.r, g: material.emissive.g, b: material.emissive.b }
			: null,
		emissiveIntensity: Number.isFinite( material.emissiveIntensity ) ? material.emissiveIntensity : 0,
		normalScale: material.normalScale
			? { x: material.normalScale.x, y: material.normalScale.y }
			: { x: 1, y: 1 },
		aoMapIntensity: Number.isFinite( material.aoMapIntensity ) ? material.aoMapIntensity : 1,
		roughness: Number.isFinite( material.roughness ) ? material.roughness : 1,
		metalness: Number.isFinite( material.metalness ) ? material.metalness : 0,
		envMapIntensity: Number.isFinite( material.envMapIntensity ) ? material.envMapIntensity : 1,
		opacity: Number.isFinite( material.opacity ) ? material.opacity : 1,
		alphaTest: Number.isFinite( material.alphaTest ) ? material.alphaTest : 0,
		doubleSided: material.side === THREE.DoubleSide,
		wireframe: !! material.wireframe,
		flatShading: !! material.flatShading,
		depthWrite: material.depthWrite !== false,
		transparent: !! material.transparent,
		mapEnabled: !! material.map,
		normalMapEnabled: !! material.normalMap,
		aoMapEnabled: !! material.aoMap,
		roughnessMapEnabled: !! material.roughnessMap,
		metalnessMapEnabled: !! material.metalnessMap,
		emissiveMapEnabled: !! material.emissiveMap,
		alphaMapEnabled: !! material.alphaMap,
	};

}

function getInitialMenuPerfProfile() {

	if ( typeof window !== 'undefined' && window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches ) {

		return 'medium';

	}

	const deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
	if ( deviceMemory !== undefined && deviceMemory <= 4 ) return 'medium';
	return 'high';

}

export class LobbyScene {

	/**
	 * @param {THREE.WebGLRenderer} renderer  Shared renderer from GameEngine.
	 */
	constructor( renderer ) {

		/** @type {THREE.WebGLRenderer} */
		this._renderer = renderer;
		this._maxTextureAnisotropy = Math.max(
			1,
			Math.round( renderer?.capabilities?.getMaxAnisotropy?.() || 1 )
		);

		/** @type {boolean} */
		this.ready = false;

		// ── Scene ────────────────────────────────────────────────────────
		this._scene = new THREE.Scene();
		this._scene.background = new THREE.Color( 0x1a1a2e );

		// Fog for depth
		this._scene.fog = new THREE.FogExp2( 0x1a1a2e, LOBBY_FOG_DENSITY );

		// ── Lights ───────────────────────────────────────────────────────
		const ambient = new THREE.AmbientLight( 0xffffff, LOBBY_AMBIENT_INTENSITY );
		this._scene.add( ambient );

		const dir = new THREE.DirectionalLight( 0xffffff, LOBBY_DIR_LIGHT_INTENSITY );
		dir.position.copy( LOBBY_DIR_LIGHT_POS );
		this._scene.add( dir );

		const rim = new THREE.DirectionalLight( 0x4488ff, LOBBY_RIM_LIGHT_INTENSITY );
		rim.position.copy( LOBBY_RIM_LIGHT_POS );
		this._scene.add( rim );

		// ── Camera (static — no orbit) ───────────────────────────────────
		this._camera = new THREE.PerspectiveCamera(
			CAM_FOV,
			window.innerWidth / window.innerHeight,
			0.1,
			100
		);
		this._previewPresetId = MENU_PREVIEW_PRESET_IDS.PLAY;
		this._previewTuning = { ...DEFAULT_MENU_PREVIEW_TUNING };
		this._currentCameraPos = CAM_POS.clone();
		this._targetCameraPos = CAM_POS.clone();
		this._currentLookAt = LOOK_AT.clone();
		this._targetLookAt = LOOK_AT.clone();
		this._currentFov = CAM_FOV;
		this._targetFov = CAM_FOV;
		this._targetKartRotationYDeg = KART_ROT_Y_DEG;
		this._currentKartRotationY = normalizeRotationRadians( THREE.MathUtils.degToRad( KART_ROT_Y_DEG ) );
		this._targetKartRotationY = this._currentKartRotationY;
		this._previewPoseTransition = createPreviewPoseTransition( {
			cameraPos: { x: CAM_POS.x, y: CAM_POS.y, z: CAM_POS.z },
			lookAt: { x: LOOK_AT.x, y: LOOK_AT.y, z: LOOK_AT.z },
			fov: CAM_FOV,
			kartRotationY: this._currentKartRotationY,
		} );
		this._applyPreviewPose();

		// ── Bloom post-processing ────────────────────────────────────────
		this._composer = new EffectComposer( renderer );
		this._composer.addPass( new RenderPass( this._scene, this._camera ) );

		this._bloomPass = new UnrealBloomPass(
			new THREE.Vector2( window.innerWidth, window.innerHeight ),
			LOBBY_BLOOM_STRENGTH,
			LOBBY_BLOOM_RADIUS,
			LOBBY_BLOOM_THRESHOLD
		);
		this._composer.addPass( this._bloomPass );
		this._menuPerfProfile = getInitialMenuPerfProfile();
		this._menuPerfAccumMs = 0;
		this._menuPerfFrames = 0;
		this._menuPerfLowCount = 0;
		this._menuPerfHighCount = 0;
		this._menuPerfLastChangeTime = performance.now();
		this._useComposer = true;
		this._applyMenuPerfProfile( this._menuPerfProfile, { force: true } );

		// ── Lobby materials (populated on load) ─────────────────────────
		/** @type {THREE.MeshStandardMaterial[]} */
		this._lobbyMaterials = [];
		/** @type {THREE.TextureLoader} */
		this._lobbyTextureLoader = new THREE.TextureLoader();
		/** @type {Map<string, Promise<THREE.Texture>>} */
		this._lobbyOrmTextureCache = new Map();
		/** @type {Map<string, ReturnType<typeof createCharacterMaterialDebugSnapshot>>} */
		this._characterMaterialDebugSettings = new Map();
		/** @type {Map<string, ReturnType<typeof createCharacterMaterialDebugSnapshot>>} */
		this._characterMaterialDebugBaselines = new Map();
		/** @type {(() => void) | null} */
		this._refreshCharacterDebugTab = null;
		/** @type {Map<string, ReturnType<typeof createCharacterMaterialDebugSnapshot>>} */
		this._vehicleMaterialDebugSettings = new Map();
		/** @type {Map<string, ReturnType<typeof createCharacterMaterialDebugSnapshot>>} */
		this._vehicleMaterialDebugBaselines = new Map();
		/** @type {(() => void) | null} */
		this._refreshVehicleDebugTab = null;
		/** @type {string} */
		this._characterDebugExpandedMaterialName = 'Masks Batch';
		/** @type {string} */
		this._vehicleDebugExpandedMaterialName = 'Body';

		// ── Lobby environment ────────────────────────────────────────────
		this._loader = new GLTFLoader();
		this._environmentReady = false;
		this._hasPresentedScene = false;
		this._loadingProgressReporter = null;
		this._initialLoadSteps = {
			environment: false,
			kart: false,
			character: false,
			animation: false,
		};
		this._initialRevealReady = new Promise( ( resolve ) => {

			this._resolveInitialRevealReady = resolve;

		} );
		void this._loadLobbyEnvironment();

		// ── Kart + character container ───────────────────────────────────
		this._kartGroup = new THREE.Group();
		this._kartGroup.position.copy( KART_POS );
		this._kartGroup.rotation.y = this._currentKartRotationY;
		this._scene.add( this._kartGroup );

		/** @type {string | null} */
		this._currentKartId = null;

		/** @type {number} generation counter to detect stale async loads */
		this._loadGen = 0;

		/** @type {THREE.AnimationMixer | null} */
		this._mixer = null;

		/** @type {object} */
		this._appearance = createDefaultPlayerAppearance();

		/** @type {THREE.Object3D | null} */
		this._currentBodyRoot = null;

		/** @type {THREE.Object3D | null} */
		this._currentCharacterRoot = null;

		this._blinkController = new MenuCharacterBlinkController();
		this._characterMaterialDebugVersion = - 1;

		/** @type {Map<string, { x: number, y: number, z: number }>} */
		this._characterOffsetOverrides = new Map();

		/** @type {{ input: HTMLInputElement, valueEl: HTMLSpanElement, setValue: Function } | null} */
		this._driverOffsetXControl = null;

		/** @type {{ input: HTMLInputElement, valueEl: HTMLSpanElement, setValue: Function } | null} */
		this._driverOffsetYControl = null;

		/** @type {{ input: HTMLInputElement, valueEl: HTMLSpanElement, setValue: Function } | null} */
		this._driverOffsetZControl = null;

		/** @type {HTMLDivElement | null} */
		this._driverOffsetLabel = null;

		// Handle resize
		this._onResize = () => {

			this._camera.aspect = window.innerWidth / window.innerHeight;
			this._camera.updateProjectionMatrix();
			this._camera.lookAt( this._currentLookAt );
			this._composer.setSize( window.innerWidth, window.innerHeight );

		};
		window.addEventListener( 'resize', this._onResize );

		// ── Debug helpers (toggled from panel) ───────────────────────────
		this._helpers = [];

		this._camHelper = new THREE.CameraHelper( this._camera );
		this._camHelper.visible = false;
		this._scene.add( this._camHelper );
		this._helpers.push( this._camHelper );

		this._dirHelper = new THREE.DirectionalLightHelper( dir, 1, 0xffff00 );
		this._dirHelper.visible = false;
		this._scene.add( this._dirHelper );
		this._helpers.push( this._dirHelper );

		this._rimHelper = new THREE.DirectionalLightHelper( rim, 1, 0x4488ff );
		this._rimHelper.visible = false;
		this._scene.add( this._rimHelper );
		this._helpers.push( this._rimHelper );

		// Axes helper at world origin
		this._axesHelper = new THREE.AxesHelper( 5 );
		this._axesHelper.visible = false;
		this._scene.add( this._axesHelper );
		this._helpers.push( this._axesHelper );

		// Grid helper on the floor
		this._gridHelper = new THREE.GridHelper( 20, 20, 0x444444, 0x222222 );
		this._gridHelper.visible = false;
		this._scene.add( this._gridHelper );
		this._helpers.push( this._gridHelper );

		// ── Debug panel ─────────────────────────────────────────────────
		this._debugPanel = this._createDebugPanel( ambient, dir, rim );

	}

	/**
	 * Load and display a kart model with the character seated on it.
	 * @param {string} kartId
	 */
	setKart( kartId ) {

		if ( kartId === this._currentKartId ) return;
		this._currentKartId = kartId;
		this._mixer = null;
		this._blinkController.reset();
		this._syncDriverOffsetDebugControls();
		const gen = ++ this._loadGen;
		if ( ! this._hasPresentedScene ) {

			this._resetInitialLoadSteps();

		}

		const entry = getVehicleById( kartId );
		if ( ! entry ) {

			this.clearKart();
			return;

		}

		void this._loadKartBundle( gen, kartId, entry );

	}

	whenInitialRevealReady() {

		return this._initialRevealReady;

	}

	setLoadingProgressReporter( callback ) {

		this._loadingProgressReporter = typeof callback === 'function' ? callback : null;
		if ( this._loadingProgressReporter && ! this._hasPresentedScene ) {

			this._emitInitialLoadProgress( 'Preparing first menu scene' );

		}

	}

	async _loadLobbyEnvironment() {

		try {

			const gltf = await this._loadGltf( LOBBY_MODEL_PATH );
			const lobbyModel = gltf.scene;
			this._prepareLobbyEnvironment( lobbyModel );
			this._scene.add( lobbyModel );

		} catch ( err ) {

			console.error( `[LobbyScene] Failed to load lobby model: ${ LOBBY_MODEL_PATH }`, err );

		} finally {

			this._environmentReady = true;
			this._markInitialLoadStep( 'environment', 'Environment ready' );
			this._markPreviewReadyIfComplete();

		}

	}

	async _loadKartBundle( gen, kartId, entry ) {

		try {

			const [ kartGltf, meshGltf, animGltf ] = await Promise.all( [
				this._loadGltf( `models/${ entry.path }` ).then( ( gltf ) => {

					if ( gen === this._loadGen ) this._markInitialLoadStep( 'kart', 'Kart ready' );
					return gltf;

				} ),
				this._loadOptionalGltf( `models/${ CHARACTER_MESH_PATH }` ).then( ( gltf ) => {

					if ( gen === this._loadGen ) this._markInitialLoadStep( 'character', gltf?.scene ? 'Driver ready' : 'Driver fallback ready' );
					return gltf;

				} ),
				this._loadOptionalGltf( `models/${ CHARACTER_ANIM_PATH }` ).then( ( gltf ) => {

					if ( gen === this._loadGen ) this._markInitialLoadStep( 'animation', gltf?.animations?.length ? 'Animation ready' : 'Animation fallback ready' );
					return gltf;

				} ),
			] );

			if ( gen !== this._loadGen ) {

				this._disposeObject3D( kartGltf?.scene );
				this._disposeObject3D( meshGltf?.scene );
				return;

			}

			const bundle = this._buildKartBundle( kartId, kartGltf, meshGltf, animGltf );
			this._applyKartBundle( bundle );
			this._markPreviewReadyIfComplete();

		} catch ( err ) {

			if ( gen !== this._loadGen ) return;
			console.error( `[LobbyScene] Failed to load lobby preview bundle for ${ kartId }`, err );
			this._markPreviewReadyIfComplete();

		}

	}

	_buildKartBundle( kartId, kartGltf, meshGltf, animGltf ) {

		const kartModel = kartGltf.scene;
		kartModel.scale.setScalar( KART_SCALE );

		let seatAnchor = null;
		let bodyNode = null;
		kartModel.traverse( ( child ) => {

			const name = ( child.name || '' ).toLowerCase();
			if ( name === 'seat_anchor' || name.startsWith( 'seat_anchor.' ) ) {

				seatAnchor = child;

			} else if ( name === 'body' || name.startsWith( 'body.' ) ) {

				bodyNode = child;

			}

		} );

		let characterRoot = null;
		let mixer = null;
		const fallbackOffset = seatAnchor ? DEFAULT_SEAT_OFFSET : DEFAULT_KART_OFFSET;
		const offset = this._getResolvedCharacterOffset( kartId, fallbackOffset );

		if ( meshGltf?.scene ) {

			characterRoot = meshGltf.scene;
			characterRoot.scale.setScalar( 1.0 );
			characterRoot.position.set( offset.x, offset.y, offset.z );

			if ( seatAnchor ) {

				seatAnchor.add( characterRoot );

			} else {

				kartModel.add( characterRoot );

			}

			if ( animGltf?.animations?.length > 0 ) {

				mixer = new THREE.AnimationMixer( characterRoot );
				const clip = animGltf.animations[ 0 ];
				const action = mixer.clipAction( clip );
				action.reset();
				action.play();
				mixer.update( 0 );

			}

		}

		return {
			kartModel,
			bodyRoot: bodyNode || kartModel,
			characterRoot,
			mixer,
			offset,
		};

	}

	_applyKartBundle( bundle ) {

		this._clearKartGroup();
		this._kartGroup.add( bundle.kartModel );
		this._currentBodyRoot = bundle.bodyRoot;
		this._currentCharacterRoot = bundle.characterRoot;
		this._blinkController.bind( bundle.characterRoot );
		this._mixer = bundle.mixer;
		this._syncDriverOffsetDebugControls( bundle.offset );
		this._applyAppearance();

	}

	_markPreviewReadyIfComplete() {

		if ( this.ready ) return;

		const hasKartBundle = !! this._currentBodyRoot || ! this._currentKartId;
		if ( ! this._environmentReady || ! hasKartBundle ) return;

		this.ready = true;
		if ( ! this._hasPresentedScene ) {

			this._hasPresentedScene = true;
			this._resolveInitialRevealReady?.();
			this._resolveInitialRevealReady = null;

		}

	}

	_resetInitialLoadSteps() {

		this._initialLoadSteps.environment = this._environmentReady;
		this._initialLoadSteps.kart = false;
		this._initialLoadSteps.character = false;
		this._initialLoadSteps.animation = false;
		this._emitInitialLoadProgress( 'Loading selected kart' );

	}

	_markInitialLoadStep( stepKey, detail ) {

		if ( ! Object.prototype.hasOwnProperty.call( this._initialLoadSteps, stepKey ) ) return;
		if ( this._initialLoadSteps[ stepKey ] ) return;
		this._initialLoadSteps[ stepKey ] = true;
		this._emitInitialLoadProgress( detail );

	}

	_emitInitialLoadProgress( detail = 'Loading menu preview' ) {

		if ( ! this._loadingProgressReporter || this._hasPresentedScene ) return;

		const total = Object.keys( this._initialLoadSteps ).length;
		const loaded = Object.values( this._initialLoadSteps ).filter( Boolean ).length;
		this._loadingProgressReporter( {
			progress: total > 0 ? ( loaded / total ) : 1,
			detail,
			loaded,
			total,
		} );

	}

	_clearKartGroup() {

		while ( this._kartGroup.children.length > 0 ) {

			const child = this._kartGroup.children[ 0 ];
			this._kartGroup.remove( child );
			this._disposeObject3D( child );

		}

	}

	_loadGltf( path ) {

		return this._loader.loadAsync( path );

	}

	async _loadOptionalGltf( path ) {

		try {

			return await this._loadGltf( path );

		} catch ( err ) {

			console.warn( `[LobbyScene] Optional preview asset unavailable: ${ path }`, err );
			return null;

		}

	}

	_disposeObject3D( root ) {

		if ( ! root ) return;

		root.traverse?.( ( child ) => {

			if ( ! child.isMesh ) return;
			child.geometry?.dispose?.();

			if ( Array.isArray( child.material ) ) {

				for ( const material of child.material ) material?.dispose?.();

			} else {

				child.material?.dispose?.();

			}

		} );

	}

	setPreviewPreset( presetId, { immediate = false } = {} ) {

		const nextPresetId = MENU_PREVIEW_PRESETS[ presetId ] ? presetId : MENU_PREVIEW_PRESET_IDS.PLAY;
		this._previewPresetId = nextPresetId;
		this._syncPreviewTargets();
		this._retargetPreviewPose( { immediate } );

	}

	setPreviewTuning( nextTuning = {}, { immediate = false } = {} ) {

		for ( const [ key, defaultValue ] of Object.entries( DEFAULT_MENU_PREVIEW_TUNING ) ) {

			if ( ! Object.prototype.hasOwnProperty.call( nextTuning, key ) ) continue;

			const rawValue = Number( nextTuning[ key ] );
			this._previewTuning[ key ] = Number.isFinite( rawValue ) ? rawValue : defaultValue;

		}

		this._syncPreviewTargets();
		this._retargetPreviewPose( { immediate } );

	}

	resetPreviewTuning( options = {} ) {

		this._previewTuning = { ...DEFAULT_MENU_PREVIEW_TUNING };
		this.setPreviewTuning( this._previewTuning, options );

	}

	getPreviewTuning() {

		return { ...this._previewTuning };

	}

	getPreviewPresetId() {

		return this._previewPresetId;

	}

	getResolvedPreviewPose() {

		return {
			presetId: this._previewPresetId,
			cameraPos: {
				x: this._targetCameraPos.x,
				y: this._targetCameraPos.y,
				z: this._targetCameraPos.z,
			},
			lookAt: {
				x: this._targetLookAt.x,
				y: this._targetLookAt.y,
				z: this._targetLookAt.z,
			},
			fov: this._targetFov,
			kartRotYDeg: this._targetKartRotationYDeg,
			tuning: this.getPreviewTuning(),
		};

	}

	_getCurrentPreviewPoseSnapshot() {

		return {
			cameraPos: {
				x: this._currentCameraPos.x,
				y: this._currentCameraPos.y,
				z: this._currentCameraPos.z,
			},
			lookAt: {
				x: this._currentLookAt.x,
				y: this._currentLookAt.y,
				z: this._currentLookAt.z,
			},
			fov: this._currentFov,
			kartRotationY: this._currentKartRotationY,
		};

	}

	_getTargetPreviewPoseSnapshot() {

		return {
			cameraPos: {
				x: this._targetCameraPos.x,
				y: this._targetCameraPos.y,
				z: this._targetCameraPos.z,
			},
			lookAt: {
				x: this._targetLookAt.x,
				y: this._targetLookAt.y,
				z: this._targetLookAt.z,
			},
			fov: this._targetFov,
			kartRotationY: this._targetKartRotationY,
		};

	}

	_applyPreviewPoseSnapshot( pose ) {

		if ( ! pose ) return;
		this._currentCameraPos.set( pose.cameraPos.x, pose.cameraPos.y, pose.cameraPos.z );
		this._currentLookAt.set( pose.lookAt.x, pose.lookAt.y, pose.lookAt.z );
		this._currentFov = pose.fov;
		this._currentKartRotationY = pose.kartRotationY;

	}

	_retargetPreviewPose( { immediate = false } = {} ) {

		if ( ! this._previewPoseTransition ) {

			this._previewPoseTransition = createPreviewPoseTransition( this._getCurrentPreviewPoseSnapshot() );

		}

		const targetPose = this._getTargetPreviewPoseSnapshot();
		const duration = immediate
			? undefined
			: computePreviewPoseTransitionDuration( this._previewPoseTransition.currentPose, targetPose );

		this._applyPreviewPoseSnapshot(
			retargetPreviewPoseTransition(
				this._previewPoseTransition,
				targetPose,
				{
					immediate,
					duration,
				}
			)
		);

		if ( immediate ) this._applyPreviewPose();

	}

	/**
	 * Remove the kart and character from the scene.
	 */
	clearKart() {

		this._loadGen ++;
		this._currentKartId = null;
		this._mixer = null;
		this._currentBodyRoot = null;
		this._currentCharacterRoot = null;
		this._blinkController.reset();
		this._syncDriverOffsetDebugControls( DEFAULT_SEAT_OFFSET );
		this._clearKartGroup();
		this._markPreviewReadyIfComplete();
		this._refreshVehicleDebugTab?.();
		this._refreshCharacterDebugTab?.();

	}

	setAppearance( appearance ) {

		this._appearance = normalizePlayerAppearance( appearance );
		this._applyAppearance();

	}

	_applyAppearance() {

		applyPlayerAppearanceToNodes( {
			bodyRoot: this._currentBodyRoot,
			characterRoot: this._currentCharacterRoot,
		}, this._appearance );
		this._captureVehicleMaterialDebugBaselines();
		this._applyVehicleMaterialDebugOverrides();
		this._syncCharacterMaterialDebugTuning( true );
		this._captureCharacterMaterialDebugBaselines();
		this._applyCharacterMaterialDebugOverrides();
		this._refreshVehicleDebugTab?.();
		this._refreshCharacterDebugTab?.();

	}

	_collectVehicleMaterialEntries() {

		if ( ! this._currentBodyRoot ) return [];

		const entries = [];
		const seen = new Set();
		this._currentBodyRoot.traverse( ( child ) => {

			if ( this._currentCharacterRoot && isObject3DDescendantOf( child, this._currentCharacterRoot ) ) return;
			if ( ! child?.isMesh || ! child.material ) return;

			const materialList = Array.isArray( child.material ) ? child.material : [ child.material ];
			for ( const material of materialList ) {

				if ( ! material?.isMaterial ) continue;
				const materialKey = normalizeDebugMaterialName( material.name );
				if ( ! materialKey || seen.has( materialKey ) ) continue;

				seen.add( materialKey );
				entries.push( {
					name: materialKey,
					material,
				} );

			}

		} );

		return entries.sort( ( a, b ) => a.name.localeCompare( b.name ) );

	}

	_captureVehicleMaterialDebugBaselines() {

		const entries = this._collectVehicleMaterialEntries();
		const activeMaterialNames = new Set( entries.map( ( entry ) => entry.name ) );

		for ( const materialName of [ ...this._vehicleMaterialDebugBaselines.keys() ] ) {

			if ( ! activeMaterialNames.has( materialName ) ) this._vehicleMaterialDebugBaselines.delete( materialName );

		}

		for ( const materialName of [ ...this._vehicleMaterialDebugSettings.keys() ] ) {

			if ( ! activeMaterialNames.has( materialName ) ) this._vehicleMaterialDebugSettings.delete( materialName );

		}

		for ( const entry of entries ) {

			const snapshot = createCharacterMaterialDebugSnapshot( entry.material, this._maxTextureAnisotropy );
			if ( ! snapshot ) continue;

			const previousBaseline = this._vehicleMaterialDebugBaselines.get( entry.name ) || null;
			const currentState = this._vehicleMaterialDebugSettings.get( entry.name ) || null;
			const nextBaseline = cloneCharacterMaterialDebugState( snapshot );

			this._vehicleMaterialDebugBaselines.set( entry.name, nextBaseline );
			if ( shouldAdoptCharacterMaterialDebugBaseline( currentState, previousBaseline ) ) {

				this._vehicleMaterialDebugSettings.set( entry.name, cloneCharacterMaterialDebugState( nextBaseline ) );

			}

		}

	}

	_getVehicleMaterialDebugState( materialName, material = null ) {

		const materialKey = normalizeDebugMaterialName( materialName );
		const existingState = this._vehicleMaterialDebugSettings.get( materialKey );
		if ( existingState ) return existingState;

		const baselineState = this._vehicleMaterialDebugBaselines.get( materialKey );
		if ( baselineState ) {

			const clonedBaseline = cloneCharacterMaterialDebugState( baselineState );
			this._vehicleMaterialDebugSettings.set( materialKey, clonedBaseline );
			return clonedBaseline;

		}

		const nextState = createCharacterMaterialDebugSnapshot( material, this._maxTextureAnisotropy );
		if ( ! nextState ) return null;

		this._vehicleMaterialDebugSettings.set( materialKey, nextState );
		this._vehicleMaterialDebugBaselines.set( materialKey, cloneCharacterMaterialDebugState( nextState ) );
		return nextState;

	}

	_resetVehicleMaterialDebugState( materialName ) {

		const materialKey = normalizeDebugMaterialName( materialName );
		const baselineState = this._vehicleMaterialDebugBaselines.get( materialKey );
		if ( ! baselineState ) return;

		this._vehicleMaterialDebugSettings.set( materialKey, cloneCharacterMaterialDebugState( baselineState ) );
		this._applyVehicleMaterialDebugOverrides();
		this._refreshVehicleDebugTab?.();

	}

	_resetAllVehicleMaterialDebugStates() {

		for ( const [ materialName, baselineState ] of this._vehicleMaterialDebugBaselines ) {

			this._vehicleMaterialDebugSettings.set( materialName, cloneCharacterMaterialDebugState( baselineState ) );

		}

		this._applyVehicleMaterialDebugOverrides();
		this._refreshVehicleDebugTab?.();

	}

	_getVehicleMaterialDebugMaterialNames() {

		const names = new Set( [
			...this._vehicleMaterialDebugBaselines.keys(),
			...this._vehicleMaterialDebugSettings.keys(),
		] );

		for ( const entry of this._collectVehicleMaterialEntries() ) {

			names.add( entry.name );

		}

		return Array.from( names ).sort( ( a, b ) => a.localeCompare( b ) );

	}

	_getVehicleMaterialDebugExportPayload( materialNames = null ) {

		const targetNames = Array.isArray( materialNames ) && materialNames.length > 0
			? materialNames
			: this._getVehicleMaterialDebugMaterialNames();
		const materials = {};

		for ( const materialName of targetNames ) {

			const materialKey = normalizeDebugMaterialName( materialName );
			const state = this._vehicleMaterialDebugSettings.get( materialKey );
			const baseline = this._vehicleMaterialDebugBaselines.get( materialKey );
			if ( ! state ) continue;

			materials[ materialKey ] = {
				textureFidelity: state.textureFidelity,
				normalStrength: getCharacterMaterialNormalStrength( state, baseline ),
				color: cloneDebugColorState( state.color ),
				emissive: cloneDebugColorState( state.emissive ),
				emissiveIntensity: state.emissiveIntensity,
				normalScale: cloneDebugVector2State( state.normalScale, 1 ),
				aoMapIntensity: state.aoMapIntensity,
				roughness: state.roughness,
				metalness: state.metalness,
				envMapIntensity: state.envMapIntensity,
				opacity: state.opacity,
				alphaTest: state.alphaTest,
				doubleSided: state.doubleSided,
				wireframe: state.wireframe,
				flatShading: state.flatShading,
				depthWrite: state.depthWrite,
				transparent: state.transparent,
				maps: {
					map: { present: !! baseline?.mapEnabled, enabled: !! state.mapEnabled },
					normalMap: { present: !! baseline?.normalMapEnabled, enabled: !! state.normalMapEnabled },
					aoMap: { present: !! baseline?.aoMapEnabled, enabled: !! state.aoMapEnabled },
					roughnessMap: { present: !! baseline?.roughnessMapEnabled, enabled: !! state.roughnessMapEnabled },
					metalnessMap: { present: !! baseline?.metalnessMapEnabled, enabled: !! state.metalnessMapEnabled },
					emissiveMap: { present: !! baseline?.emissiveMapEnabled, enabled: !! state.emissiveMapEnabled },
					alphaMap: { present: !! baseline?.alphaMapEnabled, enabled: !! state.alphaMapEnabled },
				},
			};

		}

		return {
			maxTextureAnisotropy: this._maxTextureAnisotropy,
			materialCount: Object.keys( materials ).length,
			materials,
		};

	}

	_copyVehicleMaterialDebugPayload( materialNames = null ) {

		const payload = this._getVehicleMaterialDebugExportPayload( materialNames );
		return navigator.clipboard.writeText( JSON.stringify( payload, null, 2 ) );

	}

	_applyVehicleMaterialDebugOverride( materialName, material, state ) {

		if ( ! material?.isMaterial || ! state ) return;

		const originalTextures = material.userData._kkVehicleDebugOriginalTextures || {};
		material.userData._kkVehicleDebugOriginalTextures = originalTextures;

		for ( const textureKey of CHARACTER_DEBUG_TEXTURE_KEYS ) {

			if ( ! Object.prototype.hasOwnProperty.call( originalTextures, textureKey ) ) {

				originalTextures[ textureKey ] = material[ textureKey ] || null;

			}

			const originalTexture = originalTextures[ textureKey ];
			if ( originalTexture?.isTexture ) {

				originalTexture.anisotropy = THREE.MathUtils.clamp(
					Math.round( Number( state.textureFidelity ) || 1 ),
					1,
					this._maxTextureAnisotropy
				);
				originalTexture.needsUpdate = true;

			}

		}

		if ( material.color && state.color ) {

			material.color.setRGB( state.color.r, state.color.g, state.color.b );

		}

		if ( material.emissive && state.emissive ) {

			material.emissive.setRGB( state.emissive.r, state.emissive.g, state.emissive.b );

		}

		if ( Number.isFinite( state.emissiveIntensity ) ) material.emissiveIntensity = state.emissiveIntensity;
		if ( Number.isFinite( state.aoMapIntensity ) ) material.aoMapIntensity = state.aoMapIntensity;
		if ( Number.isFinite( state.roughness ) ) material.roughness = state.roughness;
		if ( Number.isFinite( state.metalness ) ) material.metalness = state.metalness;
		if ( Number.isFinite( state.envMapIntensity ) ) material.envMapIntensity = state.envMapIntensity;
		if ( Number.isFinite( state.opacity ) ) material.opacity = state.opacity;
		if ( Number.isFinite( state.alphaTest ) ) material.alphaTest = state.alphaTest;
		material.map = state.mapEnabled ? ( originalTextures.map || null ) : null;
		material.normalMap = state.normalMapEnabled ? ( originalTextures.normalMap || null ) : null;
		material.aoMap = state.aoMapEnabled ? ( originalTextures.aoMap || null ) : null;
		material.roughnessMap = state.roughnessMapEnabled ? ( originalTextures.roughnessMap || null ) : null;
		material.metalnessMap = state.metalnessMapEnabled ? ( originalTextures.metalnessMap || null ) : null;
		material.emissiveMap = state.emissiveMapEnabled ? ( originalTextures.emissiveMap || null ) : null;
		material.alphaMap = state.alphaMapEnabled ? ( originalTextures.alphaMap || null ) : null;
		if ( material.normalScale?.set ) {

			material.normalScale.set( state.normalScale?.x ?? 1, state.normalScale?.y ?? 1 );

		}
		material.side = state.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
		material.wireframe = !! state.wireframe;
		material.flatShading = !! state.flatShading;
		material.depthWrite = state.depthWrite !== false;
		material.transparent = state.transparent || ( Number( state.opacity ) < 1 );

		material.needsUpdate = true;

	}

	_applyVehicleMaterialDebugOverrides() {

		for ( const entry of this._collectVehicleMaterialEntries() ) {

			const state = this._getVehicleMaterialDebugState( entry.name, entry.material );
			if ( ! state ) continue;

			this._applyVehicleMaterialDebugOverride( entry.name, entry.material, state );

		}

	}

	_collectCharacterMaterialEntries() {

		if ( ! this._currentCharacterRoot ) return [];

		const entries = [];
		const seen = new Set();
		this._currentCharacterRoot.traverse( ( child ) => {

			if ( ! child?.isMesh || ! child.material ) return;

			const materialList = Array.isArray( child.material ) ? child.material : [ child.material ];
			for ( const material of materialList ) {

				if ( ! material?.isMaterial ) continue;
				const materialKey = normalizeDebugMaterialName( material.name );
				if ( ! materialKey || seen.has( materialKey ) ) continue;

				seen.add( materialKey );
				entries.push( {
					name: materialKey,
					material,
				} );

			}

		} );

		return entries.sort( ( a, b ) => a.name.localeCompare( b.name ) );

	}

	_captureCharacterMaterialDebugBaselines() {

		const entries = this._collectCharacterMaterialEntries();
		for ( const entry of entries ) {

			const snapshot = createCharacterMaterialDebugSnapshot( entry.material, this._maxTextureAnisotropy );
			if ( ! snapshot ) continue;

			const previousBaseline = this._characterMaterialDebugBaselines.get( entry.name ) || null;
			const currentState = this._characterMaterialDebugSettings.get( entry.name ) || null;
			const nextBaseline = cloneCharacterMaterialDebugState( snapshot );

			this._characterMaterialDebugBaselines.set( entry.name, nextBaseline );
			if ( shouldAdoptCharacterMaterialDebugBaseline( currentState, previousBaseline ) ) {

				this._characterMaterialDebugSettings.set( entry.name, cloneCharacterMaterialDebugState( nextBaseline ) );

			}

		}

	}

	_getCharacterMaterialDebugState( materialName, material = null ) {

		const materialKey = normalizeDebugMaterialName( materialName );
		const existingState = this._characterMaterialDebugSettings.get( materialKey );
		if ( existingState ) return existingState;

		const baselineState = this._characterMaterialDebugBaselines.get( materialKey );
		if ( baselineState ) {

			const clonedBaseline = cloneCharacterMaterialDebugState( baselineState );
			this._characterMaterialDebugSettings.set( materialKey, clonedBaseline );
			return clonedBaseline;

		}

		const nextState = createCharacterMaterialDebugSnapshot( material, this._maxTextureAnisotropy );
		if ( ! nextState ) return null;

		this._characterMaterialDebugSettings.set( materialKey, nextState );
		this._characterMaterialDebugBaselines.set( materialKey, cloneCharacterMaterialDebugState( nextState ) );
		return nextState;

	}

	_resetCharacterMaterialDebugState( materialName ) {

		const materialKey = normalizeDebugMaterialName( materialName );
		const baselineState = this._characterMaterialDebugBaselines.get( materialKey );
		if ( ! baselineState ) return;

		this._characterMaterialDebugSettings.set( materialKey, cloneCharacterMaterialDebugState( baselineState ) );
		this._applyCharacterMaterialDebugOverrides();
		this._refreshCharacterDebugTab?.();

	}

	_resetAllCharacterMaterialDebugStates() {

		for ( const [ materialName, baselineState ] of this._characterMaterialDebugBaselines ) {

			this._characterMaterialDebugSettings.set( materialName, cloneCharacterMaterialDebugState( baselineState ) );

		}

		this._applyCharacterMaterialDebugOverrides();
		this._refreshCharacterDebugTab?.();

	}

	_getCharacterMaterialDebugMaterialNames() {

		const names = new Set( [
			...this._characterMaterialDebugBaselines.keys(),
			...this._characterMaterialDebugSettings.keys(),
		] );

		for ( const entry of this._collectCharacterMaterialEntries() ) {

			names.add( entry.name );

		}

		return Array.from( names ).sort( ( a, b ) => a.localeCompare( b ) );

	}

	_getCharacterMaterialDebugExportPayload( materialNames = null ) {

		const targetNames = Array.isArray( materialNames ) && materialNames.length > 0
			? materialNames
			: this._getCharacterMaterialDebugMaterialNames();
		const materials = {};

		for ( const materialName of targetNames ) {

			const materialKey = normalizeDebugMaterialName( materialName );
			const state = this._characterMaterialDebugSettings.get( materialKey );
			const baseline = this._characterMaterialDebugBaselines.get( materialKey );
			if ( ! state ) continue;

			materials[ materialKey ] = {
				textureFidelity: state.textureFidelity,
				normalStrength: getCharacterMaterialNormalStrength( state, baseline ),
				color: cloneDebugColorState( state.color ),
				emissive: cloneDebugColorState( state.emissive ),
				emissiveIntensity: state.emissiveIntensity,
				normalScale: cloneDebugVector2State( state.normalScale, 1 ),
				aoMapIntensity: state.aoMapIntensity,
				roughness: state.roughness,
				metalness: state.metalness,
				envMapIntensity: state.envMapIntensity,
				opacity: state.opacity,
				alphaTest: state.alphaTest,
				doubleSided: state.doubleSided,
				wireframe: state.wireframe,
				flatShading: state.flatShading,
				depthWrite: state.depthWrite,
				transparent: state.transparent,
				maps: {
					map: { present: !! baseline?.mapEnabled, enabled: !! state.mapEnabled },
					normalMap: { present: !! baseline?.normalMapEnabled, enabled: !! state.normalMapEnabled },
					aoMap: { present: !! baseline?.aoMapEnabled, enabled: !! state.aoMapEnabled },
					roughnessMap: { present: !! baseline?.roughnessMapEnabled, enabled: !! state.roughnessMapEnabled },
					metalnessMap: { present: !! baseline?.metalnessMapEnabled, enabled: !! state.metalnessMapEnabled },
					emissiveMap: { present: !! baseline?.emissiveMapEnabled, enabled: !! state.emissiveMapEnabled },
					alphaMap: { present: !! baseline?.alphaMapEnabled, enabled: !! state.alphaMapEnabled },
				},
			};

		}

		return {
			maxTextureAnisotropy: this._maxTextureAnisotropy,
			materialCount: Object.keys( materials ).length,
			materials,
		};

	}

	_copyCharacterMaterialDebugPayload( materialNames = null ) {

		const payload = this._getCharacterMaterialDebugExportPayload( materialNames );
		return navigator.clipboard.writeText( JSON.stringify( payload, null, 2 ) );

	}

	_applyCharacterMaterialDebugOverride( materialName, material, state ) {

		if ( ! material?.isMaterial || ! state ) return;

		const originalTextures = material.userData._kkCharacterDebugOriginalTextures || {};
		material.userData._kkCharacterDebugOriginalTextures = originalTextures;

		for ( const textureKey of CHARACTER_DEBUG_TEXTURE_KEYS ) {

			if ( ! Object.prototype.hasOwnProperty.call( originalTextures, textureKey ) ) {

				originalTextures[ textureKey ] = material[ textureKey ] || null;

			}

			const originalTexture = originalTextures[ textureKey ];
			if ( originalTexture?.isTexture ) {

				originalTexture.anisotropy = THREE.MathUtils.clamp(
					Math.round( Number( state.textureFidelity ) || 1 ),
					1,
					this._maxTextureAnisotropy
				);
				originalTexture.needsUpdate = true;

			}

		}

		if ( material.color && state.color ) {

			material.color.setRGB( state.color.r, state.color.g, state.color.b );

		}

		if ( material.emissive && state.emissive ) {

			material.emissive.setRGB( state.emissive.r, state.emissive.g, state.emissive.b );

		}

		if ( Number.isFinite( state.emissiveIntensity ) ) material.emissiveIntensity = state.emissiveIntensity;
		if ( Number.isFinite( state.aoMapIntensity ) ) material.aoMapIntensity = state.aoMapIntensity;
		if ( Number.isFinite( state.roughness ) ) material.roughness = state.roughness;
		if ( Number.isFinite( state.metalness ) ) material.metalness = state.metalness;
		if ( Number.isFinite( state.envMapIntensity ) ) material.envMapIntensity = state.envMapIntensity;
		if ( Number.isFinite( state.opacity ) ) material.opacity = state.opacity;
		if ( Number.isFinite( state.alphaTest ) ) material.alphaTest = state.alphaTest;
		material.map = state.mapEnabled ? ( originalTextures.map || null ) : null;
		material.normalMap = state.normalMapEnabled ? ( originalTextures.normalMap || null ) : null;
		material.aoMap = state.aoMapEnabled ? ( originalTextures.aoMap || null ) : null;
		material.roughnessMap = state.roughnessMapEnabled ? ( originalTextures.roughnessMap || null ) : null;
		material.metalnessMap = state.metalnessMapEnabled ? ( originalTextures.metalnessMap || null ) : null;
		material.emissiveMap = state.emissiveMapEnabled ? ( originalTextures.emissiveMap || null ) : null;
		material.alphaMap = state.alphaMapEnabled ? ( originalTextures.alphaMap || null ) : null;
		if ( material.normalScale?.set ) {

			material.normalScale.set( state.normalScale?.x ?? 1, state.normalScale?.y ?? 1 );

		}
		material.side = state.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
		material.wireframe = !! state.wireframe;
		material.flatShading = !! state.flatShading;
		material.depthWrite = state.depthWrite !== false;
		material.transparent = state.transparent || ( Number( state.opacity ) < 1 );

		material.needsUpdate = true;

	}

	_applyCharacterMaterialDebugOverrides() {

		for ( const entry of this._collectCharacterMaterialEntries() ) {

			const state = this._getCharacterMaterialDebugState( entry.name, entry.material );
			if ( ! state ) continue;

			this._applyCharacterMaterialDebugOverride( entry.name, entry.material, state );

		}

	}

	_syncCharacterMaterialDebugTuning( force = false ) {

		const currentVersion = getMenuCharacterMaterialDebugVersion();
		if ( ! force && this._characterMaterialDebugVersion === currentVersion ) return;

		if ( this._currentCharacterRoot ) {

			applyMenuCharacterMaterialDebugTuning( this._currentCharacterRoot );

		}

		this._characterMaterialDebugVersion = currentVersion;

	}

	_getVehicleEntry( kartId ) {

		if ( ! kartId ) return null;

		const entry = getVehicleById( kartId );
		return entry?.id === kartId ? entry : null;

	}

	_cloneCharacterOffset( offset = DEFAULT_SEAT_OFFSET ) {

		return {
			x: Number( offset?.x ) || 0,
			y: Number( offset?.y ) || 0,
			z: Number( offset?.z ) || 0,
		};

	}

	_applyLobbyCharacterOffsetAdjustment( kartId, offset ) {

		const adjustment = kartId ? LOBBY_CHARACTER_OFFSET_ADJUSTMENTS[ kartId ] : null;
		if ( ! adjustment ) return offset;

		return {
			x: Number.isFinite( adjustment.x ) ? adjustment.x : offset.x,
			y: Number.isFinite( adjustment.y ) ? adjustment.y : offset.y,
			z: Number.isFinite( adjustment.z ) ? adjustment.z : offset.z,
		};

	}

	_getResolvedCharacterOffset( kartId = this._currentKartId, fallbackOffset = DEFAULT_SEAT_OFFSET ) {

		if ( kartId && this._characterOffsetOverrides.has( kartId ) ) {

			return this._cloneCharacterOffset( this._characterOffsetOverrides.get( kartId ) );

		}

		const entry = this._getVehicleEntry( kartId );
		if ( entry?.characterOffset ) {

			return this._applyLobbyCharacterOffsetAdjustment(
				kartId,
				this._cloneCharacterOffset( entry.characterOffset )
			);

		}

		return this._applyLobbyCharacterOffsetAdjustment(
			kartId,
			this._cloneCharacterOffset( fallbackOffset )
		);

	}

	_applyCharacterOffset( offset ) {

		if ( ! this._currentCharacterRoot ) return;

		this._currentCharacterRoot.position.set( offset.x, offset.y, offset.z );

	}

	_setCharacterOffsetOverride( axis, value ) {

		if ( ! this._currentKartId ) return;

		const nextOffset = this._getResolvedCharacterOffset( this._currentKartId );
		nextOffset[ axis ] = value;
		this._characterOffsetOverrides.set( this._currentKartId, nextOffset );
		this._applyCharacterOffset( nextOffset );
		this._syncDriverOffsetDebugControls( nextOffset );

	}

	_syncDriverOffsetDebugControls( offset = null ) {

		if ( ! this._driverOffsetLabel &&
			! this._driverOffsetXControl &&
			! this._driverOffsetYControl &&
			! this._driverOffsetZControl ) return;

		const currentOffset = offset || this._getResolvedCharacterOffset( this._currentKartId );
		const kartId = this._currentKartId || 'none';

		if ( this._driverOffsetLabel ) {

			this._driverOffsetLabel.textContent = `Kart: ${ kartId } | offset: (${ currentOffset.x.toFixed( 2 ) }, ${ currentOffset.y.toFixed( 2 ) }, ${ currentOffset.z.toFixed( 2 ) })`;

		}

		this._driverOffsetXControl?.setValue( currentOffset.x );
		this._driverOffsetYControl?.setValue( currentOffset.y );
		this._driverOffsetZControl?.setValue( currentOffset.z );

	}

	/**
	 * Per-frame update — rotate kart on turntable, render.
	 * @param {number} dt  Delta time in seconds.
	 */
	update( dt ) {

		const safeDt = Math.min( Math.max( dt, 0 ), 0.25 );
		this._applyPreviewPoseSnapshot( advancePreviewPoseTransition( this._previewPoseTransition, safeDt ) );
		this._applyPreviewPose();

		// Keep the menu hero static; only the seated rider animation should move.
		if ( this._mixer ) this._mixer.update( safeDt );
		this._blinkController.update( dt );
		this._syncCharacterMaterialDebugTuning();

		// Keep debug helpers in sync with slider changes
		if ( this._dirHelper.visible ) this._dirHelper.update();
		if ( this._rimHelper.visible ) this._rimHelper.update();
		if ( this._camHelper.visible ) this._camHelper.update();

		if ( this._useComposer ) {

			this._composer.render( safeDt );

		} else {

			this._renderer.render( this._scene, this._camera );

		}

		this._sampleMenuPerformance( safeDt );

	}

	_resetMenuPerformanceCounters() {

		this._menuPerfAccumMs = 0;
		this._menuPerfFrames = 0;
		this._menuPerfLowCount = 0;
		this._menuPerfHighCount = 0;

	}

	_applyMenuPerfProfile( profileId, { force = false } = {} ) {

		const nextProfileId = MENU_PERF_PROFILES[ profileId ] ? profileId : 'high';
		if ( ! force && nextProfileId === this._menuPerfProfile ) return;

		this._menuPerfProfile = nextProfileId;
		const profile = MENU_PERF_PROFILES[ nextProfileId ];
		this._useComposer = profile.useComposer;

		if ( this._bloomPass ) {

			this._bloomPass.enabled = profile.bloom;

		}

		if ( this._composer ) {

			this._composer.setPixelRatio( profile.renderScale );
			this._composer.setSize( window.innerWidth, window.innerHeight );

		}

	}

	_shiftMenuPerfProfile( direction ) {

		const currentIndex = MENU_PERF_PROFILE_ORDER.indexOf( this._menuPerfProfile );
		if ( currentIndex < 0 ) return;

		const nextIndex = Math.max( 0, Math.min( MENU_PERF_PROFILE_ORDER.length - 1, currentIndex + direction ) );
		if ( nextIndex === currentIndex ) return;

		this._applyMenuPerfProfile( MENU_PERF_PROFILE_ORDER[ nextIndex ] );
		this._menuPerfLastChangeTime = performance.now();
		this._resetMenuPerformanceCounters();

	}

	_sampleMenuPerformance( dt ) {

		if ( typeof document !== 'undefined' && document.hidden ) {

			this._resetMenuPerformanceCounters();
			return;

		}

		if ( ! Number.isFinite( dt ) || dt <= 0 || dt >= 0.2 ) return;

		this._menuPerfAccumMs += dt * 1000;
		this._menuPerfFrames ++;

		if ( this._menuPerfAccumMs < MENU_PERF_SAMPLE_MS ) return;

		const fps = ( this._menuPerfFrames * 1000 ) / this._menuPerfAccumMs;
		this._menuPerfAccumMs = 0;
		this._menuPerfFrames = 0;

		const now = performance.now();
		if ( now - this._menuPerfLastChangeTime < MENU_PERF_COOLDOWN_MS ) return;

		if ( fps < MENU_PERF_LOW_FPS ) {

			this._menuPerfLowCount ++;
			this._menuPerfHighCount = 0;

			if ( this._menuPerfLowCount >= MENU_PERF_LOW_STREAK ) {

				this._shiftMenuPerfProfile( - 1 );

			}

			return;

		}

		if ( fps > MENU_PERF_HIGH_FPS ) {

			this._menuPerfHighCount ++;
			this._menuPerfLowCount = 0;

			if ( this._menuPerfHighCount >= MENU_PERF_HIGH_STREAK ) {

				this._shiftMenuPerfProfile( 1 );

			}

			return;

		}

		this._menuPerfLowCount = 0;
		this._menuPerfHighCount = 0;

	}

	_syncPreviewTargets() {

		const preset = MENU_PREVIEW_PRESETS[ this._previewPresetId ] || MENU_PREVIEW_PRESETS[ MENU_PREVIEW_PRESET_IDS.PLAY ];
		this._targetCameraPos.set(
			preset.cameraPos.x + this._previewTuning.cameraOffsetX,
			preset.cameraPos.y + this._previewTuning.cameraOffsetY,
			preset.cameraPos.z + this._previewTuning.cameraOffsetZ
		);
		this._targetLookAt.set(
			preset.lookAt.x + this._previewTuning.lookTargetX,
			preset.lookAt.y + this._previewTuning.lookTargetY,
			preset.lookAt.z
		);
		this._targetFov = preset.fov;
		this._targetKartRotationYDeg = preset.kartRotYDeg;
		this._targetKartRotationY = normalizeRotationRadians( THREE.MathUtils.degToRad( preset.kartRotYDeg ) );

	}

	_applyPreviewPose() {

		this._camera.position.copy( this._currentCameraPos );
		this._camera.lookAt( this._currentLookAt );

		if ( Math.abs( this._camera.fov - this._currentFov ) > 0.0001 ) {

			this._camera.fov = this._currentFov;
			this._camera.updateProjectionMatrix();

		}

		if ( this._kartGroup ) {

			this._kartGroup.rotation.y = this._currentKartRotationY;

		}

	}

	_prepareLobbyEnvironment( lobbyModel ) {

		const toRemove = [];
		const materialsByName = new Map();

		lobbyModel.traverse( ( child ) => {

			const name = ( child.name || '' ).toLowerCase();
			if ( name === 'mirror' || name.includes( 'cube' ) || name.includes( 'placeholder' ) ) {

				toRemove.push( child );

			}

			if ( ! child.isMesh || ! child.material ) return;

			const mats = Array.isArray( child.material ) ? child.material : [ child.material ];
			for ( const mat of mats ) {

				if ( ! mat?.isMeshStandardMaterial ) continue;
				if ( ! LOBBY_MATERIAL_CONFIGS[ mat.name ] ) continue;
				if ( materialsByName.has( mat.name ) ) continue;

				materialsByName.set( mat.name, mat );

			}

		} );

		for ( const obj of toRemove ) {

			obj.removeFromParent();

		}

		this._lobbyMaterials.length = 0;

		for ( const materialName of LOBBY_MATERIAL_ORDER ) {

			const config = LOBBY_MATERIAL_CONFIGS[ materialName ];
			const mat = materialsByName.get( materialName );

			if ( ! mat ) {

				console.warn( `[LobbyScene] Expected lobby material not found: ${ materialName }` );
				continue;

			}

			this._applyLobbyMaterialConfig( mat, config );
			this._lobbyMaterials.push( mat );
			void this._ensureLobbyOrmMaps( mat, config );

		}

	}

	_applyLobbyMaterialConfig( mat, config ) {

		mat.userData.lobbyDebugLabel = config.debugLabel;
		mat.emissiveIntensity = config.emissiveIntensity;
		mat.emissive.setRGB( config.emissiveColor.r, config.emissiveColor.g, config.emissiveColor.b );
		mat.normalScale.set( config.normalScale.x, config.normalScale.y );
		mat.aoMapIntensity = config.aoMapIntensity;
		mat.roughness = config.roughness;
		mat.metalness = config.metalness;
		mat.envMapIntensity = config.envMapIntensity;
		mat.color.setRGB( config.baseColor.r, config.baseColor.g, config.baseColor.b );
		mat.opacity = config.opacity;
		mat.transparent = config.opacity < 1;

	}

	_hasCompleteLobbyOrmMaps( mat ) {

		return !! ( mat.aoMap && mat.roughnessMap && mat.metalnessMap );

	}

	async _ensureLobbyOrmMaps( mat, config ) {

		if ( this._hasCompleteLobbyOrmMaps( mat ) ) return;

		try {

			const ormTexture = await this._loadLobbyOrmTexture( config.ormPath );

			mat.aoMap = ormTexture;
			mat.roughnessMap = ormTexture;
			mat.metalnessMap = ormTexture;
			mat.needsUpdate = true;

		} catch ( err ) {

			console.error( `[LobbyScene] Failed to load lobby ORM fallback: ${ config.ormPath }`, err );

		}

	}

	_loadLobbyOrmTexture( texturePath ) {

		if ( this._lobbyOrmTextureCache.has( texturePath ) ) {

			return this._lobbyOrmTextureCache.get( texturePath );

		}

		const texturePromise = this._lobbyTextureLoader.loadAsync( texturePath )
			.then( ( texture ) => {

				texture.flipY = false;
				texture.colorSpace = THREE.NoColorSpace;
				texture.channel = 0;
				texture.needsUpdate = true;
				return texture;

			} )
			.catch( ( err ) => {

				this._lobbyOrmTextureCache.delete( texturePath );
				throw err;

			} );

		this._lobbyOrmTextureCache.set( texturePath, texturePromise );
		return texturePromise;

	}

	/**
	 * Build a debug slider panel for camera + lighting.
	 */
	_createDebugPanel( ambient, dir, rim ) {

		const panel = document.createElement( 'div' );
		panel.style.cssText = 'position:fixed;top:64px;right:12px;background:rgba(0,0,0,0.88);color:#fff;padding:0;border-radius:8px;font:12px monospace;z-index:99999;max-height:calc(100vh - 76px);overflow:hidden;width:min(18.5rem, calc(100vw - 24px));min-width:0;display:none;flex-direction:column;box-sizing:border-box;';

		const cam = this._camera;
		const self = this;

		// ── Toggle button (happy face) ──────────────────────────────────
		const toggleBtn = document.createElement( 'button' );
		toggleBtn.textContent = 'DBG';
		toggleBtn.title = 'Lobby Debug';
		toggleBtn.style.cssText = 'position:fixed;top:56px;right:12px;z-index:99998;background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font:700 11px monospace;letter-spacing:0.12em;cursor:pointer;padding:9px 10px;line-height:1;transition:transform 0.15s ease,background 0.15s ease;';
		toggleBtn.addEventListener( 'mouseover', () => { toggleBtn.style.background = 'rgba(0,0,0,0.85)'; toggleBtn.style.transform = 'scale(1.1)'; } );
		toggleBtn.addEventListener( 'mouseout', () => { toggleBtn.style.background = 'rgba(0,0,0,0.6)'; toggleBtn.style.transform = 'scale(1)'; } );
		toggleBtn.addEventListener( 'click', () => {

			const open = panel.style.display === 'none';
			panel.style.display = open ? 'flex' : 'none';
			toggleBtn.style.display = open ? 'none' : '';

		} );
		document.body.appendChild( toggleBtn );
		this._debugToggleBtn = toggleBtn;

		// ── Title bar with close button ──────────────────────────────────
		const titleBar = document.createElement( 'div' );
		titleBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 10px 4px;flex-shrink:0;';

		const titleLabel = document.createElement( 'span' );
		titleLabel.textContent = 'LOBBY DEBUG';
		titleLabel.style.cssText = 'font-weight:bold;font-size:11px;color:#888;letter-spacing:0.1em;';
		titleBar.appendChild( titleLabel );

		const closeBtn = document.createElement( 'button' );
		closeBtn.textContent = '\u2715';
		closeBtn.style.cssText = 'background:transparent;color:#888;border:1px solid #555;font:bold 13px monospace;cursor:pointer;padding:2px 7px;border-radius:3px;line-height:1;';
		closeBtn.addEventListener( 'mouseover', () => { closeBtn.style.color = '#f66'; closeBtn.style.borderColor = '#f66'; } );
		closeBtn.addEventListener( 'mouseout', () => { closeBtn.style.color = '#888'; closeBtn.style.borderColor = '#555'; } );
		closeBtn.addEventListener( 'click', () => { panel.style.display = 'none'; toggleBtn.style.display = ''; } );
		titleBar.appendChild( closeBtn );

		panel.appendChild( titleBar );

		// ── Tab bar ──────────────────────────────────────────────────────
		const tabBar = document.createElement( 'div' );
		tabBar.style.cssText = 'display:flex;border-bottom:1px solid #555;flex-shrink:0;';
		panel.appendChild( tabBar );

		const tabContents = [];
		const tabBtns = [];

		const createTab = ( label ) => {

			const btn = document.createElement( 'button' );
			btn.textContent = label;
			btn.style.cssText = 'flex:1;padding:8px 4px;border:none;cursor:pointer;font:12px monospace;font-weight:bold;background:transparent;color:#888;border-bottom:2px solid transparent;';
			tabBar.appendChild( btn );
			tabBtns.push( btn );

			const content = document.createElement( 'div' );
			content.style.cssText = 'display:none;padding:12px;overflow-y:auto;flex:1;';
			panel.appendChild( content );
			tabContents.push( content );

			btn.addEventListener( 'click', () => {

				for ( let i = 0; i < tabBtns.length; i ++ ) {

					tabBtns[ i ].style.color = '#888';
					tabBtns[ i ].style.borderBottomColor = 'transparent';
					tabContents[ i ].style.display = 'none';

				}
				btn.style.color = '#fff';
				btn.style.borderBottomColor = '#4488ff';
				content.style.display = 'block';

			} );

			return content;

		};

		const sceneTab = createTab( 'SCENE' );
		const texturesTab = createTab( 'TEXTURES' );
		const vehicleTab = createTab( 'VEHICLE' );
		const characterTab = createTab( 'CHARACTER' );

		// Activate scene tab by default
		tabBtns[ 0 ].style.color = '#fff';
		tabBtns[ 0 ].style.borderBottomColor = '#4488ff';
		sceneTab.style.display = 'block';

		// ── Shared helpers ───────────────────────────────────────────────
		const addSection = ( container, label ) => {

			const s = document.createElement( 'div' );
			s.textContent = label;
			s.style.cssText = 'font-weight:bold;margin-top:10px;margin-bottom:4px;color:#8af;font-size:11px;';
			container.appendChild( s );

		};

		const addSlider = ( container, label, min, max, step, value, onChange ) => {

			const row = document.createElement( 'div' );
			row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';

			const lbl = document.createElement( 'span' );
			lbl.textContent = label;
			lbl.style.cssText = 'width:60px;flex:0 0 60px;font-size:10px;';

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.min = min;
			input.max = max;
			input.step = step;
			input.value = value;
			input.style.cssText = 'flex:1 1 auto;min-width:0;height:14px;';

			const val = document.createElement( 'span' );
			val.textContent = Number( value ).toFixed( 2 );
			val.style.cssText = 'width:38px;flex:0 0 38px;text-align:right;font-size:10px;';

			input.addEventListener( 'input', () => {

				const v = parseFloat( input.value );
				val.textContent = v.toFixed( 2 );
				onChange( v );

			} );

			row.appendChild( lbl );
			row.appendChild( input );
			row.appendChild( val );
			container.appendChild( row );

			return {
				row,
				input,
				valueEl: val,
				setValue: ( nextValue ) => {

					const numericValue = Number( nextValue ) || 0;
					input.value = String( numericValue );
					val.textContent = numericValue.toFixed( 2 );

				},
			};

		};

		const addToggle = ( container, label, icon, initiallyOn, onChange ) => {

			const row = document.createElement( 'div' );
			row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';

			const btn = document.createElement( 'button' );
			let on = !! initiallyOn;
			const update = () => {

				btn.textContent = `${ icon } ${ label }: ${ on ? 'ON' : 'OFF' }`;
				btn.style.cssText = `flex:1;padding:4px 8px;border:1px solid ${ on ? '#4f8' : '#555' };border-radius:4px;cursor:pointer;font:11px monospace;color:${ on ? '#4f8' : '#888' };background:${ on ? 'rgba(68,255,136,0.1)' : 'rgba(0,0,0,0.3)' };text-align:left;`;

			};
			update();

			btn.addEventListener( 'click', () => {

				on = ! on;
				update();
				onChange( on );

			} );

			row.appendChild( btn );
			container.appendChild( row );

			return {
				row,
				button: btn,
				setOn: ( nextValue ) => {

					on = !! nextValue;
					update();

				},
			};

		};

		const addActionButton = ( container, label, onClick ) => {

			const button = document.createElement( 'button' );
			button.textContent = label;
			button.style.cssText = 'margin-top:8px;width:100%;padding:6px 8px;background:#1d1d1d;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font:11px monospace;letter-spacing:0.06em;line-height:1.25;text-align:left;white-space:normal;overflow-wrap:anywhere;';
			button.addEventListener( 'click', onClick );
			container.appendChild( button );
			return button;

		};

		// ══════════════════════════════════════════════════════════════════
		// SCENE TAB
		// ══════════════════════════════════════════════════════════════════

		// ── Gizmo Toggles ──
		addSection( sceneTab, 'HELPERS / GIZMOS' );
		addToggle( sceneTab, 'Camera Helper', '\u{1F3A5}', false, ( on ) => { self._camHelper.visible = on; } );
		addToggle( sceneTab, 'Dir Light Helper', '\u{2600}', false, ( on ) => { self._dirHelper.visible = on; } );
		addToggle( sceneTab, 'Rim Light Helper', '\u{1F535}', false, ( on ) => { self._rimHelper.visible = on; } );
		addToggle( sceneTab, 'World Axes', '\u{1F9ED}', false, ( on ) => { self._axesHelper.visible = on; } );
		addToggle( sceneTab, 'Floor Grid', '\u{1F4D0}', false, ( on ) => { self._gridHelper.visible = on; } );

		// ── Kart Position ──
		addSection( sceneTab, 'KART' );
		const kg = self._kartGroup;
		addSlider( sceneTab, 'Pos X', - 10, 10, 0.1, kg.position.x, ( v ) => { kg.position.x = v; } );
		addSlider( sceneTab, 'Pos Y', - 2, 5, 0.1, kg.position.y, ( v ) => { kg.position.y = v; } );
		addSlider( sceneTab, 'Pos Z', - 10, 10, 0.1, kg.position.z, ( v ) => { kg.position.z = v; } );
		addSlider( sceneTab, 'Scale', 0.1, 3, 0.05, KART_SCALE, ( v ) => {

			kg.children.forEach( ( c ) => c.scale.setScalar( v ) );

		} );
		addSlider( sceneTab, 'Rotate Y', - 10000, 10000, 1, THREE.MathUtils.radToDeg( kg.rotation.y ), ( v ) => { kg.rotation.y = THREE.MathUtils.degToRad( v ); } );

		// ── Driver Offset ──
		addSection( sceneTab, 'DRIVER OFFSET' );

		const driverOffsetLabel = document.createElement( 'div' );
		driverOffsetLabel.style.cssText = 'color:#bbb;font-size:11px;line-height:1.5;margin:2px 0 6px;';
		sceneTab.appendChild( driverOffsetLabel );
		this._driverOffsetLabel = driverOffsetLabel;

		const initialDriverOffset = this._getResolvedCharacterOffset();
		this._driverOffsetXControl = addSlider( sceneTab, 'X', - 2, 2, 0.01, initialDriverOffset.x, ( v ) => {

			self._setCharacterOffsetOverride( 'x', v );

		} );
		this._driverOffsetYControl = addSlider( sceneTab, 'Y', - 2, 2, 0.01, initialDriverOffset.y, ( v ) => {

			self._setCharacterOffsetOverride( 'y', v );

		} );
		this._driverOffsetZControl = addSlider( sceneTab, 'Z', - 2, 2, 0.01, initialDriverOffset.z, ( v ) => {

			self._setCharacterOffsetOverride( 'z', v );

		} );
		this._syncDriverOffsetDebugControls( initialDriverOffset );

		// ── Character Blink ──
		addSection( sceneTab, 'BLINK' );
		const initialBlinkTuning = getMenuCharacterBlinkTuning();
		addSlider( sceneTab, 'Frequency (sec)', 0.0, 12.0, 0.1, initialBlinkTuning.frequencySeconds, ( v ) => {

			setMenuCharacterBlinkTuning( { frequencySeconds: v } );
			self._blinkController.update( 0 );

		} );
		addSlider( sceneTab, 'Speed (sec)', 0.05, 0.40, 0.01, initialBlinkTuning.speedSeconds, ( v ) => {

			setMenuCharacterBlinkTuning( { speedSeconds: v } );

		} );

		// ── Character Normal Maps ──
		addSection( sceneTab, 'CHARACTER NORMALS' );
		const initialMaterialDebugTuning = getMenuCharacterMaterialDebugTuning();
		addSlider( sceneTab, 'Mask Normal', 0.0, 3.0, 0.05, initialMaterialDebugTuning.maskNormalIntensity, ( v ) => {

			setMenuCharacterMaterialDebugTuning( { maskNormalIntensity: v } );
			self._syncCharacterMaterialDebugTuning( true );

		} );
		addSlider( sceneTab, 'Jeans Normal', 0.0, 3.0, 0.05, initialMaterialDebugTuning.jeansNormalIntensity, ( v ) => {

			setMenuCharacterMaterialDebugTuning( { jeansNormalIntensity: v } );
			self._syncCharacterMaterialDebugTuning( true );

		} );
		addSlider( sceneTab, 'Shirt Normal', 0.0, 3.0, 0.05, initialMaterialDebugTuning.shirtNormalIntensity, ( v ) => {

			setMenuCharacterMaterialDebugTuning( { shirtNormalIntensity: v } );
			self._syncCharacterMaterialDebugTuning( true );

		} );

		// ── Camera Position ──
		addSection( sceneTab, 'CAMERA POSITION' );
		addSlider( sceneTab, 'Pos X', - 20, 20, 0.1, cam.position.x, ( v ) => { cam.position.x = v; } );
		addSlider( sceneTab, 'Pos Y', - 5, 20, 0.1, cam.position.y, ( v ) => { cam.position.y = v; } );
		addSlider( sceneTab, 'Pos Z', - 20, 20, 0.1, cam.position.z, ( v ) => { cam.position.z = v; } );

		// ── Camera LookAt ──
		addSection( sceneTab, 'CAMERA LOOK-AT' );
		const lookAt = LOOK_AT.clone();
		const updateLookAt = () => { cam.lookAt( lookAt ); };
		addSlider( sceneTab, 'Look X', - 20, 20, 0.1, lookAt.x, ( v ) => { lookAt.x = v; updateLookAt(); } );
		addSlider( sceneTab, 'Look Y', - 5, 20, 0.1, lookAt.y, ( v ) => { lookAt.y = v; updateLookAt(); } );
		addSlider( sceneTab, 'Look Z', - 20, 20, 0.1, lookAt.z, ( v ) => { lookAt.z = v; updateLookAt(); } );

		// ── Camera Rotation (direct euler control — overrides lookAt) ──
		addSection( sceneTab, 'CAMERA ROTATION' );
		let rotMode = false;
		addToggle( sceneTab, 'Free Rotate', '\u{1F504}', false, ( on ) => {

			rotMode = on;
			if ( ! on ) { cam.lookAt( lookAt ); }

		} );
		addSlider( sceneTab, 'Pitch (X)', - 180, 180, 1, THREE.MathUtils.radToDeg( cam.rotation.x ), ( v ) => { if ( rotMode ) { cam.rotation.x = THREE.MathUtils.degToRad( v ); } } );
		addSlider( sceneTab, 'Yaw (Y)', - 180, 180, 1, THREE.MathUtils.radToDeg( cam.rotation.y ), ( v ) => { if ( rotMode ) { cam.rotation.y = THREE.MathUtils.degToRad( v ); } } );
		addSlider( sceneTab, 'Roll (Z)', - 180, 180, 1, THREE.MathUtils.radToDeg( cam.rotation.z ), ( v ) => { if ( rotMode ) { cam.rotation.z = THREE.MathUtils.degToRad( v ); } } );

		// ── Camera FOV ──
		addSection( sceneTab, 'CAMERA FOV' );
		addSlider( sceneTab, 'FOV', 10, 120, 1, cam.fov, ( v ) => { cam.fov = v; cam.updateProjectionMatrix(); } );

		// ── Fog ──
		addSection( sceneTab, 'FOG' );
		addSlider( sceneTab, 'Density', 0, 0.2, 0.001, this._scene.fog.density, ( v ) => { self._scene.fog.density = v; } );

		// ── Ambient Light ──
		addSection( sceneTab, 'AMBIENT LIGHT' );
		addSlider( sceneTab, 'Intensity', 0, 5, 0.1, ambient.intensity, ( v ) => { ambient.intensity = v; } );

		// Helper: convert cartesian to spherical (returns { angle, elev, dist } in degrees)
		const toSpherical = ( pos ) => {

			const dist = Math.sqrt( pos.x * pos.x + pos.y * pos.y + pos.z * pos.z );
			const angle = THREE.MathUtils.radToDeg( Math.atan2( pos.x, pos.z ) );
			const elev = THREE.MathUtils.radToDeg( Math.asin( pos.y / ( dist || 1 ) ) );
			return { angle, elev, dist };

		};

		// Helper: apply spherical values to a light position
		const applySpherical = ( light, s ) => {

			const elevRad = THREE.MathUtils.degToRad( s.elev );
			const angleRad = THREE.MathUtils.degToRad( s.angle );
			light.position.set(
				s.dist * Math.cos( elevRad ) * Math.sin( angleRad ),
				s.dist * Math.sin( elevRad ),
				s.dist * Math.cos( elevRad ) * Math.cos( angleRad )
			);

		};

		// ── Directional Light ──
		addSection( sceneTab, 'DIR LIGHT (main)' );
		addSlider( sceneTab, 'Intensity', 0, 10, 0.1, dir.intensity, ( v ) => { dir.intensity = v; } );
		const dirS = toSpherical( dir.position );
		addSlider( sceneTab, 'Orbit', - 180, 180, 1, dirS.angle, ( v ) => { dirS.angle = v; applySpherical( dir, dirS ); } );
		addSlider( sceneTab, 'Elevation', - 90, 90, 1, dirS.elev, ( v ) => { dirS.elev = v; applySpherical( dir, dirS ); } );
		addSlider( sceneTab, 'Distance', 0.5, 30, 0.5, dirS.dist, ( v ) => { dirS.dist = v; applySpherical( dir, dirS ); } );

		// ── Rim Light ──
		addSection( sceneTab, 'RIM LIGHT' );
		addSlider( sceneTab, 'Intensity', 0, 10, 0.1, rim.intensity, ( v ) => { rim.intensity = v; } );
		const rimS = toSpherical( rim.position );
		addSlider( sceneTab, 'Orbit', - 180, 180, 1, rimS.angle, ( v ) => { rimS.angle = v; applySpherical( rim, rimS ); } );
		addSlider( sceneTab, 'Elevation', - 90, 90, 1, rimS.elev, ( v ) => { rimS.elev = v; applySpherical( rim, rimS ); } );
		addSlider( sceneTab, 'Distance', 0.5, 30, 0.5, rimS.dist, ( v ) => { rimS.dist = v; applySpherical( rim, rimS ); } );

		// ── Bloom ──
		addSection( sceneTab, 'BLOOM' );
		addSlider( sceneTab, 'Strength', 0, 3, 0.01, self._bloomPass.strength, ( v ) => { self._bloomPass.strength = v; } );
		addSlider( sceneTab, 'Radius', 0, 2, 0.01, self._bloomPass.radius, ( v ) => { self._bloomPass.radius = v; } );
		addSlider( sceneTab, 'Threshold', 0, 2, 0.01, self._bloomPass.threshold, ( v ) => { self._bloomPass.threshold = v; } );

		// ── Copy button (Scene tab) ──
		const copyBtn = document.createElement( 'button' );
		copyBtn.textContent = 'COPY VALUES';
		copyBtn.style.cssText = 'margin-top:12px;width:100%;padding:6px;background:#4488ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font:12px monospace;';
		copyBtn.addEventListener( 'click', () => {

			const emI = self._lobbyMaterials.length > 0 ? self._lobbyMaterials[ 0 ].emissiveIntensity : 1;
			const emC = self._lobbyMaterials.length > 0 ? self._lobbyMaterials[ 0 ].emissive : { r: 1, g: 1, b: 1 };
			const currentKartId = self._currentKartId || 'kart-id';
			const currentDriverOffset = self._getResolvedCharacterOffset( self._currentKartId );
			const text = [
				`KART_POS = new THREE.Vector3( ${ kg.position.x.toFixed( 2 ) }, ${ kg.position.y.toFixed( 2 ) }, ${ kg.position.z.toFixed( 2 ) } );`,
				`KART_SCALE = ${ kg.children[ 0 ] ? kg.children[ 0 ].scale.x.toFixed( 2 ) : KART_SCALE };`,
				`Kart rotation Y = ${ THREE.MathUtils.radToDeg( kg.rotation.y ).toFixed( 0 ) }`,
				`Vehicle: ${ currentKartId }`,
				`characterOffset: { x: ${ currentDriverOffset.x.toFixed( 2 ) }, y: ${ currentDriverOffset.y.toFixed( 2 ) }, z: ${ currentDriverOffset.z.toFixed( 2 ) } },`,
				`CAM_POS  = new THREE.Vector3( ${ cam.position.x.toFixed( 2 ) }, ${ cam.position.y.toFixed( 2 ) }, ${ cam.position.z.toFixed( 2 ) } );`,
				`LOOK_AT  = new THREE.Vector3( ${ lookAt.x.toFixed( 2 ) }, ${ lookAt.y.toFixed( 2 ) }, ${ lookAt.z.toFixed( 2 ) } );`,
				`CAM_FOV  = ${ cam.fov };`,
				`Fog density = ${ self._scene.fog.density.toFixed( 4 ) }`,
				`Ambient intensity = ${ ambient.intensity.toFixed( 2 ) }`,
				`Dir light: intensity=${ dir.intensity.toFixed( 2 ) } orbit=${ dirS.angle.toFixed( 0 ) } elev=${ dirS.elev.toFixed( 0 ) } dist=${ dirS.dist.toFixed( 1 ) } pos=(${ dir.position.x.toFixed( 1 ) }, ${ dir.position.y.toFixed( 1 ) }, ${ dir.position.z.toFixed( 1 ) })`,
				`Rim light: intensity=${ rim.intensity.toFixed( 2 ) } orbit=${ rimS.angle.toFixed( 0 ) } elev=${ rimS.elev.toFixed( 0 ) } dist=${ rimS.dist.toFixed( 1 ) } pos=(${ rim.position.x.toFixed( 1 ) }, ${ rim.position.y.toFixed( 1 ) }, ${ rim.position.z.toFixed( 1 ) })`,
				`Bloom: strength=${ self._bloomPass.strength.toFixed( 2 ) } radius=${ self._bloomPass.radius.toFixed( 2 ) } threshold=${ self._bloomPass.threshold.toFixed( 2 ) }`,
				`Emissive: intensity=${ emI.toFixed( 2 ) } color=(${ emC.r.toFixed( 2 ) }, ${ emC.g.toFixed( 2 ) }, ${ emC.b.toFixed( 2 ) })`,
			].join( '\n' );
			navigator.clipboard.writeText( text );
			copyBtn.textContent = 'COPIED!';
			setTimeout( () => { copyBtn.textContent = 'COPY VALUES'; }, 1500 );

		} );
		sceneTab.appendChild( copyBtn );

		// ══════════════════════════════════════════════════════════════════
		// TEXTURES TAB
		// ══════════════════════════════════════════════════════════════════

		const getLobbyMaterialDebugName = ( mat, index ) => (
			mat?.userData?.lobbyDebugLabel ||
			mat?.name ||
			`Material ${ index }`
		);

		// Build per-material texture controls once materials are loaded.
		// We poll briefly since the GLTF loads async.
		const buildTextureControls = () => {

			if ( self._lobbyMaterials.length === 0 ) {

				const waiting = document.createElement( 'div' );
				waiting.textContent = 'Waiting for model to load...';
				waiting.style.cssText = 'color:#888;padding:12px;';
				texturesTab.appendChild( waiting );
				const poll = setInterval( () => {

					if ( self._lobbyMaterials.length > 0 ) {

						clearInterval( poll );
						waiting.remove();
						populateTextureSliders();

					}

				}, 200 );
				return;

			}
			populateTextureSliders();

		};

		const populateTextureSliders = () => {

			for ( let i = 0; i < self._lobbyMaterials.length; i ++ ) {

				const mat = self._lobbyMaterials[ i ];
				const name = getLobbyMaterialDebugName( mat, i );

				// ── Material header ──
				const header = document.createElement( 'div' );
				header.textContent = name;
				header.style.cssText = 'font-weight:bold;margin-top:12px;margin-bottom:6px;color:#ff8;font-size:12px;border-bottom:1px solid #444;padding-bottom:4px;';
				texturesTab.appendChild( header );

				// ── Emissive ──
				addSection( texturesTab, 'EMISSIVE' );
				addSlider( texturesTab, 'Intensity', 0, 10, 0.1, mat.emissiveIntensity, ( v ) => { mat.emissiveIntensity = v; } );
				addSlider( texturesTab, 'Color R', 0, 1, 0.01, mat.emissive.r, ( v ) => { mat.emissive.r = v; } );
				addSlider( texturesTab, 'Color G', 0, 1, 0.01, mat.emissive.g, ( v ) => { mat.emissive.g = v; } );
				addSlider( texturesTab, 'Color B', 0, 1, 0.01, mat.emissive.b, ( v ) => { mat.emissive.b = v; } );
				addToggle( texturesTab, 'Emissive Map', '\u{1F4A1}', !! mat.emissiveMap, ( on ) => {

					if ( on && mat.userData._emissiveMap ) { mat.emissiveMap = mat.userData._emissiveMap; }
					else { mat.userData._emissiveMap = mat.emissiveMap; mat.emissiveMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Normal ──
				addSection( texturesTab, 'NORMAL MAP' );
				const nScale = mat.normalScale ? mat.normalScale.x : 1;
				addSlider( texturesTab, 'Scale X', - 3, 3, 0.05, nScale, ( v ) => { if ( mat.normalScale ) mat.normalScale.x = v; } );
				addSlider( texturesTab, 'Scale Y', - 3, 3, 0.05, mat.normalScale ? mat.normalScale.y : 1, ( v ) => { if ( mat.normalScale ) mat.normalScale.y = v; } );
				addToggle( texturesTab, 'Normal Map', '\u{1F5FA}', !! mat.normalMap, ( on ) => {

					if ( on && mat.userData._normalMap ) { mat.normalMap = mat.userData._normalMap; }
					else { mat.userData._normalMap = mat.normalMap; mat.normalMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Ambient Occlusion ──
				addSection( texturesTab, 'AMBIENT OCCLUSION' );
				addSlider( texturesTab, 'AO Intensity', 0, 3, 0.05, mat.aoMapIntensity !== undefined ? mat.aoMapIntensity : 1, ( v ) => { mat.aoMapIntensity = v; } );
				addToggle( texturesTab, 'AO Map', '\u{1F311}', !! mat.aoMap, ( on ) => {

					if ( on && mat.userData._aoMap ) { mat.aoMap = mat.userData._aoMap; }
					else { mat.userData._aoMap = mat.aoMap; mat.aoMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Roughness ──
				addSection( texturesTab, 'ROUGHNESS' );
				addSlider( texturesTab, 'Factor', 0, 1, 0.01, mat.roughness !== undefined ? mat.roughness : 1, ( v ) => { mat.roughness = v; } );
				addToggle( texturesTab, 'Rough Map', '\u{1F4CE}', !! mat.roughnessMap, ( on ) => {

					if ( on && mat.userData._roughnessMap ) { mat.roughnessMap = mat.userData._roughnessMap; }
					else { mat.userData._roughnessMap = mat.roughnessMap; mat.roughnessMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Metalness ──
				addSection( texturesTab, 'METALNESS' );
				addSlider( texturesTab, 'Factor', 0, 1, 0.01, mat.metalness !== undefined ? mat.metalness : 1, ( v ) => { mat.metalness = v; } );
				addToggle( texturesTab, 'Metal Map', '\u{1F529}', !! mat.metalnessMap, ( on ) => {

					if ( on && mat.userData._metalnessMap ) { mat.metalnessMap = mat.userData._metalnessMap; }
					else { mat.userData._metalnessMap = mat.metalnessMap; mat.metalnessMap = null; }
					mat.needsUpdate = true;

				} );

				// ── Base Color ──
				addSection( texturesTab, 'BASE COLOR / ALBEDO' );
				addSlider( texturesTab, 'Color R', 0, 1, 0.01, mat.color.r, ( v ) => { mat.color.r = v; } );
				addSlider( texturesTab, 'Color G', 0, 1, 0.01, mat.color.g, ( v ) => { mat.color.g = v; } );
				addSlider( texturesTab, 'Color B', 0, 1, 0.01, mat.color.b, ( v ) => { mat.color.b = v; } );
				addToggle( texturesTab, 'Base Map', '\u{1F3A8}', !! mat.map, ( on ) => {

					if ( on && mat.userData._map ) { mat.map = mat.userData._map; }
					else { mat.userData._map = mat.map; mat.map = null; }
					mat.needsUpdate = true;

				} );

				// ── General material ──
				addSection( texturesTab, 'MATERIAL' );
				addToggle( texturesTab, 'Double Sided', '\u{1F500}', mat.side === THREE.DoubleSide, ( on ) => {

					mat.side = on ? THREE.DoubleSide : THREE.FrontSide;
					mat.needsUpdate = true;

				} );
				addToggle( texturesTab, 'Wireframe', '\u{1F4D0}', mat.wireframe, ( on ) => {

					mat.wireframe = on;

				} );
				addSlider( texturesTab, 'Opacity', 0, 1, 0.01, mat.opacity, ( v ) => {

					mat.opacity = v;
					mat.transparent = v < 1;

				} );
				addSlider( texturesTab, 'Env Intens.', 0, 5, 0.1, mat.envMapIntensity !== undefined ? mat.envMapIntensity : 1, ( v ) => { mat.envMapIntensity = v; } );

			}

			// ── Copy button (Textures tab) ──
			const copyBtn2 = document.createElement( 'button' );
			copyBtn2.textContent = 'COPY TEXTURE VALUES';
			copyBtn2.style.cssText = 'margin-top:12px;width:100%;padding:6px;background:#4488ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font:12px monospace;';
			copyBtn2.addEventListener( 'click', () => {

				const lines = [];
				for ( let i = 0; i < self._lobbyMaterials.length; i ++ ) {

					const mat = self._lobbyMaterials[ i ];
					const name = getLobbyMaterialDebugName( mat, i );
					lines.push( `--- ${ name } ---` );
					lines.push( `Emissive: intensity=${ mat.emissiveIntensity.toFixed( 2 ) } color=(${ mat.emissive.r.toFixed( 2 ) }, ${ mat.emissive.g.toFixed( 2 ) }, ${ mat.emissive.b.toFixed( 2 ) })` );
					lines.push( `Normal: scale=(${ mat.normalScale ? mat.normalScale.x.toFixed( 2 ) : 'n/a' }, ${ mat.normalScale ? mat.normalScale.y.toFixed( 2 ) : 'n/a' })` );
					lines.push( `AO: intensity=${ mat.aoMapIntensity !== undefined ? mat.aoMapIntensity.toFixed( 2 ) : 'n/a' }` );
					lines.push( `Roughness: factor=${ mat.roughness !== undefined ? mat.roughness.toFixed( 2 ) : 'n/a' }` );
					lines.push( `Metalness: factor=${ mat.metalness !== undefined ? mat.metalness.toFixed( 2 ) : 'n/a' }` );
					lines.push( `Base color: (${ mat.color.r.toFixed( 2 ) }, ${ mat.color.g.toFixed( 2 ) }, ${ mat.color.b.toFixed( 2 ) })` );
					lines.push( `Opacity: ${ mat.opacity.toFixed( 2 ) }` );
					lines.push( `Env map intensity: ${ mat.envMapIntensity !== undefined ? mat.envMapIntensity.toFixed( 2 ) : 'n/a' }` );
					lines.push( '' );

				}
				navigator.clipboard.writeText( lines.join( '\n' ) );
				copyBtn2.textContent = 'COPIED!';
				setTimeout( () => { copyBtn2.textContent = 'COPY TEXTURE VALUES'; }, 1500 );

			} );
			texturesTab.appendChild( copyBtn2 );

		};

		buildTextureControls();

		// ══════════════════════════════════════════════════════════════════
		// VEHICLE TAB
		// ══════════════════════════════════════════════════════════════════
		const setTemporaryButtonLabel = ( button, label, nextLabel, delay = 1500 ) => {

			if ( ! button ) return;
			button.textContent = nextLabel;
			setTimeout( () => { button.textContent = label; }, delay );

		};

		const renderVehicleLab = () => {

			vehicleTab.replaceChildren();
			addSection( vehicleTab, 'VEHICLE MATERIAL LAB' );

			const vehicleIntro = document.createElement( 'div' );
			vehicleIntro.style.cssText = 'color:#bbb;font-size:11px;line-height:1.5;margin:2px 0 10px;';
			vehicleIntro.textContent = `Live kart material tuning for paint, metal, and reflections. ${ self._maxTextureAnisotropy }x is the current anisotropy cap.`;
			vehicleTab.appendChild( vehicleIntro );

			const materialEntries = self._collectVehicleMaterialEntries();
			if ( materialEntries.length === 0 ) {

				const waiting = document.createElement( 'div' );
				waiting.textContent = 'Kart preview not ready yet.';
				waiting.style.cssText = 'color:#888;padding:12px 0;';
				vehicleTab.appendChild( waiting );
				return;

			}

			self._captureVehicleMaterialDebugBaselines();

			const actionGrid = document.createElement( 'div' );
			actionGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';
			vehicleTab.appendChild( actionGrid );

			const copyAllBtn = addActionButton( actionGrid, 'COPY ALL', () => {

				self._copyVehicleMaterialDebugPayload()
					.then( () => { setTemporaryButtonLabel( copyAllBtn, 'COPY ALL', 'COPIED!' ); } )
					.catch( () => { setTemporaryButtonLabel( copyAllBtn, 'COPY ALL', 'FAILED', 2000 ); } );

			} );
			copyAllBtn.style.marginTop = '0';

			const resetAllBtn = addActionButton( actionGrid, 'RESET ALL', () => {

				self._resetAllVehicleMaterialDebugStates();

			} );
			resetAllBtn.style.marginTop = '0';

			for ( const entry of materialEntries ) {

				const state = self._getVehicleMaterialDebugState( entry.name, entry.material );
				const baseline = self._vehicleMaterialDebugBaselines.get( entry.name );
				if ( ! state ) continue;

				const block = document.createElement( 'section' );
				block.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px solid #444;';
				vehicleTab.appendChild( block );
				const isExpanded = self._vehicleDebugExpandedMaterialName === entry.name;

				const headerBtn = document.createElement( 'button' );
				headerBtn.type = 'button';
				headerBtn.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0;background:transparent;border:none;color:#8ff;cursor:pointer;text-align:left;';
				headerBtn.addEventListener( 'click', () => {

					self._vehicleDebugExpandedMaterialName = isExpanded ? '' : entry.name;
					self._refreshVehicleDebugTab?.();

				} );
				block.appendChild( headerBtn );

				const headerLabel = document.createElement( 'span' );
				headerLabel.textContent = `${ isExpanded ? '\u25BE' : '\u25B8' } ${ entry.name.toUpperCase() }`;
				headerLabel.style.cssText = 'font-weight:bold;color:#8ff;font-size:12px;letter-spacing:0.08em;';
				headerBtn.appendChild( headerLabel );

				const headerValue = document.createElement( 'span' );
				headerValue.textContent = `${ state.textureFidelity }x`;
				headerValue.style.cssText = 'color:#bbb;font-size:10px;';
				headerBtn.appendChild( headerValue );

				const meta = document.createElement( 'div' );
				meta.style.cssText = 'color:#8f8f8f;font-size:10px;line-height:1.4;margin:6px 0 4px;';
				meta.textContent = `B:${ baseline?.mapEnabled ? 'Y' : 'N' } N:${ baseline?.normalMapEnabled ? 'Y' : 'N' } AO:${ baseline?.aoMapEnabled ? 'Y' : 'N' } R:${ baseline?.roughnessMapEnabled ? 'Y' : 'N' } M:${ baseline?.metalnessMapEnabled ? 'Y' : 'N' } E:${ baseline?.emissiveMapEnabled ? 'Y' : 'N' }`;
				block.appendChild( meta );

				if ( ! isExpanded ) continue;

				addSection( block, 'TEXTURE FIDELITY' );
				addSlider( block, 'Fidelity', 1, self._maxTextureAnisotropy, 1, state.textureFidelity, ( value ) => {

					state.textureFidelity = THREE.MathUtils.clamp(
						Math.round( value ),
						1,
						self._maxTextureAnisotropy
					);
					self._applyVehicleMaterialDebugOverrides();

				} );

				if ( baseline?.mapEnabled ) {

					addToggle( block, 'Base Map', '\u{1F3A8}', state.mapEnabled, ( on ) => {

						state.mapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( baseline?.normalMapEnabled ) {

					addToggle( block, 'Normal Map', '\u{1F5FA}', state.normalMapEnabled, ( on ) => {

						state.normalMapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( baseline?.aoMapEnabled ) {

					addToggle( block, 'AO Map', '\u{1F311}', state.aoMapEnabled, ( on ) => {

						state.aoMapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( baseline?.roughnessMapEnabled ) {

					addToggle( block, 'Rough Map', '\u{1F4CE}', state.roughnessMapEnabled, ( on ) => {

						state.roughnessMapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( baseline?.metalnessMapEnabled ) {

					addToggle( block, 'Metal Map', '\u{1F529}', state.metalnessMapEnabled, ( on ) => {

						state.metalnessMapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( baseline?.emissiveMapEnabled ) {

					addToggle( block, 'Emis Map', '\u{1F4A1}', state.emissiveMapEnabled, ( on ) => {

						state.emissiveMapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( baseline?.alphaMapEnabled ) {

					addToggle( block, 'Alpha Map', '\u{1F3AD}', state.alphaMapEnabled, ( on ) => {

						state.alphaMapEnabled = on;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				addSection( block, 'SURFACE' );
				addSlider( block, 'Rough', 0, 1, 0.01, state.roughness, ( value ) => {

					state.roughness = value;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'Metal', 0, 1, 0.01, state.metalness, ( value ) => {

					state.metalness = value;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'AO Int', 0, 4, 0.05, state.aoMapIntensity, ( value ) => {

					state.aoMapIntensity = value;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'Env Int', 0, 5, 0.05, state.envMapIntensity, ( value ) => {

					state.envMapIntensity = value;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'Opacity', 0, 1, 0.01, state.opacity, ( value ) => {

					state.opacity = value;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'Alpha', 0, 1, 0.01, state.alphaTest, ( value ) => {

					state.alphaTest = value;
					self._applyVehicleMaterialDebugOverrides();

				} );

				addSection( block, 'NORMALS' );
				addSlider( block, 'Strength', 0, 4, 0.05, getCharacterMaterialNormalStrength( state, baseline ), ( value ) => {

					applyCharacterMaterialNormalStrength( state, baseline, value );
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'Scale X', - 4, 4, 0.05, state.normalScale.x, ( value ) => {

					state.normalScale.x = value;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addSlider( block, 'Scale Y', - 4, 4, 0.05, state.normalScale.y, ( value ) => {

					state.normalScale.y = value;
					self._applyVehicleMaterialDebugOverrides();

				} );

				if ( state.color ) {

					addSection( block, 'BASE COLOR' );
					addSlider( block, 'Color R', 0, 1, 0.01, state.color.r, ( value ) => {

						state.color.r = value;
						self._applyVehicleMaterialDebugOverrides();

					} );
					addSlider( block, 'Color G', 0, 1, 0.01, state.color.g, ( value ) => {

						state.color.g = value;
						self._applyVehicleMaterialDebugOverrides();

					} );
					addSlider( block, 'Color B', 0, 1, 0.01, state.color.b, ( value ) => {

						state.color.b = value;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				if ( state.emissive ) {

					addSection( block, 'EMISSIVE' );
					addSlider( block, 'Emis Int', 0, 10, 0.05, state.emissiveIntensity, ( value ) => {

						state.emissiveIntensity = value;
						self._applyVehicleMaterialDebugOverrides();

					} );
					addSlider( block, 'Emis R', 0, 1, 0.01, state.emissive.r, ( value ) => {

						state.emissive.r = value;
						self._applyVehicleMaterialDebugOverrides();

					} );
					addSlider( block, 'Emis G', 0, 1, 0.01, state.emissive.g, ( value ) => {

						state.emissive.g = value;
						self._applyVehicleMaterialDebugOverrides();

					} );
					addSlider( block, 'Emis B', 0, 1, 0.01, state.emissive.b, ( value ) => {

						state.emissive.b = value;
						self._applyVehicleMaterialDebugOverrides();

					} );

				}

				addSection( block, 'MATERIAL' );
				addToggle( block, '2-Sided', '\u{1F500}', state.doubleSided, ( on ) => {

					state.doubleSided = on;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addToggle( block, 'Wireframe', '\u{1F4D0}', state.wireframe, ( on ) => {

					state.wireframe = on;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addToggle( block, 'Flat Shade', '\u{25A6}', state.flatShading, ( on ) => {

					state.flatShading = on;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addToggle( block, 'Depth', '\u{21A7}', state.depthWrite, ( on ) => {

					state.depthWrite = on;
					self._applyVehicleMaterialDebugOverrides();

				} );
				addToggle( block, 'Transp', '\u{25D0}', state.transparent, ( on ) => {

					state.transparent = on;
					self._applyVehicleMaterialDebugOverrides();

				} );

				const materialActionGrid = document.createElement( 'div' );
				materialActionGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;';
				block.appendChild( materialActionGrid );

				const copyMaterialBtn = addActionButton( materialActionGrid, 'COPY', () => {

					self._copyVehicleMaterialDebugPayload( [ entry.name ] )
						.then( () => { setTemporaryButtonLabel( copyMaterialBtn, 'COPY', 'COPIED!' ); } )
						.catch( () => { setTemporaryButtonLabel( copyMaterialBtn, 'COPY', 'FAILED', 2000 ); } );

				} );
				copyMaterialBtn.style.marginTop = '0';

				const resetMaterialBtn = addActionButton( materialActionGrid, 'RESET', () => {

					self._resetVehicleMaterialDebugState( entry.name );

				} );
				resetMaterialBtn.style.marginTop = '0';

			}

		};

		this._refreshVehicleDebugTab = renderVehicleLab;
		renderVehicleLab();

		// ══════════════════════════════════════════════════════════════════
		// CHARACTER TAB
		// ══════════════════════════════════════════════════════════════════
		const renderCharacterLab = () => {

			characterTab.replaceChildren();
			addSection( characterTab, 'CHARACTER MATERIAL LAB' );

			const characterIntro = document.createElement( 'div' );
			characterIntro.style.cssText = 'color:#bbb;font-size:11px;line-height:1.5;margin:2px 0 10px;';
			characterIntro.textContent = `Slim inspector rail for live rider tuning. ${ self._maxTextureAnisotropy }x is the current anisotropy cap.`;
			characterTab.appendChild( characterIntro );

			const materialEntries = self._collectCharacterMaterialEntries();
			if ( materialEntries.length === 0 ) {

				const waiting = document.createElement( 'div' );
				waiting.textContent = 'Character preview not ready yet.';
				waiting.style.cssText = 'color:#888;padding:12px 0;';
				characterTab.appendChild( waiting );
				return;

			}

			self._captureCharacterMaterialDebugBaselines();

			const actionGrid = document.createElement( 'div' );
			actionGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;';
			characterTab.appendChild( actionGrid );

			const copyAllBtn = addActionButton( actionGrid, 'COPY ALL', () => {

				self._copyCharacterMaterialDebugPayload()
					.then( () => { setTemporaryButtonLabel( copyAllBtn, 'COPY ALL', 'COPIED!' ); } )
					.catch( () => { setTemporaryButtonLabel( copyAllBtn, 'COPY ALL', 'FAILED', 2000 ); } );

			} );
			copyAllBtn.style.marginTop = '0';

			const resetAllBtn = addActionButton( actionGrid, 'RESET ALL', () => {

				self._resetAllCharacterMaterialDebugStates();

			} );
			resetAllBtn.style.marginTop = '0';

			for ( const entry of materialEntries ) {

				const state = self._getCharacterMaterialDebugState( entry.name, entry.material );
				const baseline = self._characterMaterialDebugBaselines.get( entry.name );
				if ( ! state ) continue;

				const block = document.createElement( 'section' );
				block.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px solid #444;';
				characterTab.appendChild( block );
				const isExpanded = self._characterDebugExpandedMaterialName === entry.name;

				const headerBtn = document.createElement( 'button' );
				headerBtn.type = 'button';
				headerBtn.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0;background:transparent;border:none;color:#ff8;cursor:pointer;text-align:left;';
				headerBtn.addEventListener( 'click', () => {

					self._characterDebugExpandedMaterialName = isExpanded ? '' : entry.name;
					self._refreshCharacterDebugTab?.();

				} );
				block.appendChild( headerBtn );

				const headerLabel = document.createElement( 'span' );
				headerLabel.textContent = `${ isExpanded ? '\u25BE' : '\u25B8' } ${ entry.name.toUpperCase() }`;
				headerLabel.style.cssText = 'font-weight:bold;color:#ff8;font-size:12px;letter-spacing:0.08em;';
				headerBtn.appendChild( headerLabel );

				const headerValue = document.createElement( 'span' );
				headerValue.textContent = `${ state.textureFidelity }x`;
				headerValue.style.cssText = 'color:#bbb;font-size:10px;';
				headerBtn.appendChild( headerValue );

				const meta = document.createElement( 'div' );
				meta.style.cssText = 'color:#8f8f8f;font-size:10px;line-height:1.4;margin:6px 0 4px;';
				meta.textContent = `B:${ baseline?.mapEnabled ? 'Y' : 'N' } N:${ baseline?.normalMapEnabled ? 'Y' : 'N' } AO:${ baseline?.aoMapEnabled ? 'Y' : 'N' } R:${ baseline?.roughnessMapEnabled ? 'Y' : 'N' } M:${ baseline?.metalnessMapEnabled ? 'Y' : 'N' } E:${ baseline?.emissiveMapEnabled ? 'Y' : 'N' }`;
				block.appendChild( meta );

				if ( ! isExpanded ) continue;

				addSection( block, 'TEXTURE FIDELITY' );
				addSlider( block, 'Fidelity', 1, self._maxTextureAnisotropy, 1, state.textureFidelity, ( value ) => {

					state.textureFidelity = THREE.MathUtils.clamp(
						Math.round( value ),
						1,
						self._maxTextureAnisotropy
					);
					self._applyCharacterMaterialDebugOverrides();

				} );

				if ( baseline?.mapEnabled ) {

					addToggle( block, 'Base Map', '\u{1F3A8}', state.mapEnabled, ( on ) => {

						state.mapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( baseline?.normalMapEnabled ) {

					addToggle( block, 'Normal Map', '\u{1F5FA}', state.normalMapEnabled, ( on ) => {

						state.normalMapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( baseline?.aoMapEnabled ) {

					addToggle( block, 'AO Map', '\u{1F311}', state.aoMapEnabled, ( on ) => {

						state.aoMapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( baseline?.roughnessMapEnabled ) {

					addToggle( block, 'Rough Map', '\u{1F4CE}', state.roughnessMapEnabled, ( on ) => {

						state.roughnessMapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( baseline?.metalnessMapEnabled ) {

					addToggle( block, 'Metal Map', '\u{1F529}', state.metalnessMapEnabled, ( on ) => {

						state.metalnessMapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( baseline?.emissiveMapEnabled ) {

					addToggle( block, 'Emis Map', '\u{1F4A1}', state.emissiveMapEnabled, ( on ) => {

						state.emissiveMapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( baseline?.alphaMapEnabled ) {

					addToggle( block, 'Alpha Map', '\u{1F3AD}', state.alphaMapEnabled, ( on ) => {

						state.alphaMapEnabled = on;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				addSection( block, 'SURFACE' );
				addSlider( block, 'Rough', 0, 1, 0.01, state.roughness, ( value ) => {

					state.roughness = value;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'Metal', 0, 1, 0.01, state.metalness, ( value ) => {

					state.metalness = value;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'AO Int', 0, 4, 0.05, state.aoMapIntensity, ( value ) => {

					state.aoMapIntensity = value;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'Env Int', 0, 5, 0.05, state.envMapIntensity, ( value ) => {

					state.envMapIntensity = value;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'Opacity', 0, 1, 0.01, state.opacity, ( value ) => {

					state.opacity = value;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'Alpha', 0, 1, 0.01, state.alphaTest, ( value ) => {

					state.alphaTest = value;
					self._applyCharacterMaterialDebugOverrides();

				} );

				addSection( block, 'NORMALS' );
				addSlider( block, 'Strength', 0, 4, 0.05, getCharacterMaterialNormalStrength( state, baseline ), ( value ) => {

					applyCharacterMaterialNormalStrength( state, baseline, value );
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'Scale X', - 4, 4, 0.05, state.normalScale.x, ( value ) => {

					state.normalScale.x = value;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addSlider( block, 'Scale Y', - 4, 4, 0.05, state.normalScale.y, ( value ) => {

					state.normalScale.y = value;
					self._applyCharacterMaterialDebugOverrides();

				} );

				if ( state.color ) {

					addSection( block, 'BASE COLOR' );
					addSlider( block, 'Color R', 0, 1, 0.01, state.color.r, ( value ) => {

						state.color.r = value;
						self._applyCharacterMaterialDebugOverrides();

					} );
					addSlider( block, 'Color G', 0, 1, 0.01, state.color.g, ( value ) => {

						state.color.g = value;
						self._applyCharacterMaterialDebugOverrides();

					} );
					addSlider( block, 'Color B', 0, 1, 0.01, state.color.b, ( value ) => {

						state.color.b = value;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				if ( state.emissive ) {

					addSection( block, 'EMISSIVE' );
					addSlider( block, 'Emis Int', 0, 10, 0.05, state.emissiveIntensity, ( value ) => {

						state.emissiveIntensity = value;
						self._applyCharacterMaterialDebugOverrides();

					} );
					addSlider( block, 'Emis R', 0, 1, 0.01, state.emissive.r, ( value ) => {

						state.emissive.r = value;
						self._applyCharacterMaterialDebugOverrides();

					} );
					addSlider( block, 'Emis G', 0, 1, 0.01, state.emissive.g, ( value ) => {

						state.emissive.g = value;
						self._applyCharacterMaterialDebugOverrides();

					} );
					addSlider( block, 'Emis B', 0, 1, 0.01, state.emissive.b, ( value ) => {

						state.emissive.b = value;
						self._applyCharacterMaterialDebugOverrides();

					} );

				}

				addSection( block, 'MATERIAL' );
				addToggle( block, '2-Sided', '\u{1F500}', state.doubleSided, ( on ) => {

					state.doubleSided = on;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addToggle( block, 'Wireframe', '\u{1F4D0}', state.wireframe, ( on ) => {

					state.wireframe = on;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addToggle( block, 'Flat Shade', '\u{25A6}', state.flatShading, ( on ) => {

					state.flatShading = on;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addToggle( block, 'Depth', '\u{21A7}', state.depthWrite, ( on ) => {

					state.depthWrite = on;
					self._applyCharacterMaterialDebugOverrides();

				} );
				addToggle( block, 'Transp', '\u{25D0}', state.transparent, ( on ) => {

					state.transparent = on;
					self._applyCharacterMaterialDebugOverrides();

				} );

				const materialActionGrid = document.createElement( 'div' );
				materialActionGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;';
				block.appendChild( materialActionGrid );

				const copyMaterialBtn = addActionButton( materialActionGrid, 'COPY', () => {

					self._copyCharacterMaterialDebugPayload( [ entry.name ] )
						.then( () => { setTemporaryButtonLabel( copyMaterialBtn, 'COPY', 'COPIED!' ); } )
						.catch( () => { setTemporaryButtonLabel( copyMaterialBtn, 'COPY', 'FAILED', 2000 ); } );

				} );
				copyMaterialBtn.style.marginTop = '0';

				const resetMaterialBtn = addActionButton( materialActionGrid, 'RESET', () => {

					self._resetCharacterMaterialDebugState( entry.name );

				} );
				resetMaterialBtn.style.marginTop = '0';

			}

		};

		this._refreshCharacterDebugTab = renderCharacterLab;
		renderCharacterLab();

		document.body.appendChild( panel );
		return panel;

	}

	/**
	 * Clean up.
	 */
	dispose() {

		window.removeEventListener( 'resize', this._onResize );
		this._clearKartGroup();
		for ( const h of this._helpers ) {

			h.removeFromParent();
			if ( h.dispose ) h.dispose();

		}
		this._helpers.length = 0;
		if ( this._composer ) {

			this._composer.dispose();
			this._composer = null;

		}
		if ( this._debugPanel ) {

			this._debugPanel.remove();
			this._debugPanel = null;

		}
		this._refreshCharacterDebugTab = null;
		this._driverOffsetXControl = null;
		this._driverOffsetYControl = null;
		this._driverOffsetZControl = null;
		this._driverOffsetLabel = null;
		if ( this._debugToggleBtn ) {

			this._debugToggleBtn.remove();
			this._debugToggleBtn = null;

		}

	}

}
