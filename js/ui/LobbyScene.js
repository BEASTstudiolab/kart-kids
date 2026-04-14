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
		cameraPos: Object.freeze( { x: 0.00, y: 2.75, z: 4.80 } ),
		lookAt: Object.freeze( { x: 0.00, y: 1.05, z: 0.05 } ),
		fov: 44,
		kartRotYDeg: 1432,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_FACE ]: Object.freeze( {
		cameraPos: Object.freeze( { x: 0.00, y: 2.92, z: 3.65 } ),
		lookAt: Object.freeze( { x: 0.00, y: 1.68, z: - 0.02 } ),
		fov: 28,
		kartRotYDeg: 1434,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_ACCESSORIES ]: Object.freeze( {
		cameraPos: Object.freeze( { x: 0.00, y: 2.84, z: 4.02 } ),
		lookAt: Object.freeze( { x: 0.00, y: 1.38, z: 0.04 } ),
		fov: 34,
		kartRotYDeg: 1433,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_SHIRT ]: Object.freeze( {
		cameraPos: Object.freeze( { x: 0.00, y: 2.44, z: 4.18 } ),
		lookAt: Object.freeze( { x: 0.00, y: 0.95, z: 0.14 } ),
		fov: 35,
		kartRotYDeg: 1434,
	} ),
	[ MENU_PREVIEW_PRESET_IDS.CHARACTER_PANTS ]: Object.freeze( {
		cameraPos: Object.freeze( { x: 0.00, y: 1.76, z: 4.26 } ),
		lookAt: Object.freeze( { x: 0.00, y: 0.34, z: 0.52 } ),
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
const PREVIEW_POSE_LERP_SPEED = 7.5;
const TWO_PI = Math.PI * 2;
const DEFAULT_MENU_PREVIEW_TUNING = Object.freeze( {
	lookTargetX: 0,
	lookTargetY: 0,
	cameraOffsetX: 0,
	cameraOffsetY: 0,
	cameraOffsetZ: 0,
} );

// Character model — rest armature rides the selected kart using the garage idle loop.
const CHARACTER_MESH_PATH = CHARACTER_MODEL_PATH;
const CHARACTER_ANIM_PATH = CHARACTER_GARAGE_IDLE_ANIMATION_PATH;
const LOBBY_MODEL_PATH = 'models/environments/Lobby.gltf';
const LOBBY_MATERIAL_CONFIGS = Object.freeze( {
	'Lobby Props': Object.freeze( {
		debugLabel: 'Lobby Props (Lobby2)',
		ormPath: 'models/environments/textures/Lobby2_OcclusionRoughnessMetallic.png',
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
		ormPath: 'models/environments/textures/Lobby1_OcclusionRoughnessMetallic.png',
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

function normalizeRotationRadians( radians ) {

	return THREE.MathUtils.euclideanModulo( radians, TWO_PI );

}

function dampScalar( current, target, dt, speed = PREVIEW_POSE_LERP_SPEED ) {

	const alpha = 1 - Math.exp( - speed * Math.max( dt, 0 ) );
	return THREE.MathUtils.lerp( current, target, alpha );

}

function dampAngle( current, target, dt, speed = PREVIEW_POSE_LERP_SPEED ) {

	const alpha = 1 - Math.exp( - speed * Math.max( dt, 0 ) );
	const delta = THREE.MathUtils.euclideanModulo( ( target - current ) + Math.PI, TWO_PI ) - Math.PI;
	return normalizeRotationRadians( current + ( delta * alpha ) );

}

export class LobbyScene {

	/**
	 * @param {THREE.WebGLRenderer} renderer  Shared renderer from GameEngine.
	 */
	constructor( renderer ) {

		/** @type {THREE.WebGLRenderer} */
		this._renderer = renderer;

		/** @type {boolean} */
		this.ready = true;

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

		// ── Lobby materials (populated on load) ─────────────────────────
		/** @type {THREE.MeshStandardMaterial[]} */
		this._lobbyMaterials = [];
		/** @type {THREE.TextureLoader} */
		this._lobbyTextureLoader = new THREE.TextureLoader();
		/** @type {Map<string, Promise<THREE.Texture>>} */
		this._lobbyOrmTextureCache = new Map();

		// ── Lobby environment ────────────────────────────────────────────
		this._loader = new GLTFLoader();
		this._loader.load( LOBBY_MODEL_PATH, ( gltf ) => {

			const lobbyModel = gltf.scene;
			this._prepareLobbyEnvironment( lobbyModel );

			this._scene.add( lobbyModel );

		}, undefined, ( err ) => {

			console.error( `[LobbyScene] Failed to load lobby model: ${ LOBBY_MODEL_PATH }`, err );

		} );

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
		this._syncDriverOffsetDebugControls();
		const gen = ++ this._loadGen;

		// Clear previous kart + character
		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

		const entry = getVehicleById( kartId );
		if ( ! entry ) return;

		// Load kart model, then attach character to the seat_anchor node
		// (same approach as Vehicle.js _attachCharacter).
		this._loader.load( `models/${ entry.path }`, ( kartGltf ) => {

			if ( gen !== this._loadGen ) return;

			const kartModel = kartGltf.scene;
			kartModel.scale.setScalar( KART_SCALE );
			this._kartGroup.add( kartModel );

			// Find seat_anchor node inside the kart model
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

			this._currentBodyRoot = bodyNode || kartModel;
			this._currentCharacterRoot = null;
			this._applyAppearance();

			// Load character mesh and attach to seat anchor
			this._loader.load( `models/${ CHARACTER_MESH_PATH }`, ( meshGltf ) => {

				if ( gen !== this._loadGen ) return;

				const character = meshGltf.scene;
				character.scale.setScalar( 1.0 );
				const offset = this._getResolvedCharacterOffset(
					kartId,
					seatAnchor ? DEFAULT_SEAT_OFFSET : DEFAULT_KART_OFFSET
				);

				// Position: use seat_anchor if found, otherwise use characterOffset
				if ( seatAnchor ) {

					character.position.set( offset.x, offset.y, offset.z );
					seatAnchor.add( character );

				} else {

					character.position.set( offset.x, offset.y, offset.z );
					kartModel.add( character );

				}

				this._currentCharacterRoot = character;
				this._syncDriverOffsetDebugControls( offset );
				this._applyAppearance();

				// Apply driving pose animation
				this._loader.load( `models/${ CHARACTER_ANIM_PATH }`, ( animGltf ) => {

					if ( gen !== this._loadGen ) return;

					if ( animGltf.animations && animGltf.animations.length > 0 ) {

						this._mixer = new THREE.AnimationMixer( character );
						const clip = animGltf.animations[ 0 ];
						const action = this._mixer.clipAction( clip );
						action.reset();
						action.play();
						this._mixer.update( 0 );

					}

				} );

			} );

		} );

	}

	setPreviewPreset( presetId, { immediate = false } = {} ) {

		const nextPresetId = MENU_PREVIEW_PRESETS[ presetId ] ? presetId : MENU_PREVIEW_PRESET_IDS.PLAY;
		this._previewPresetId = nextPresetId;
		this._syncPreviewTargets();

		if ( immediate ) {

			this._currentCameraPos.copy( this._targetCameraPos );
			this._currentLookAt.copy( this._targetLookAt );
			this._currentFov = this._targetFov;
			this._currentKartRotationY = this._targetKartRotationY;
			this._applyPreviewPose();

		}

	}

	setPreviewTuning( nextTuning = {}, { immediate = false } = {} ) {

		for ( const [ key, defaultValue ] of Object.entries( DEFAULT_MENU_PREVIEW_TUNING ) ) {

			if ( ! Object.prototype.hasOwnProperty.call( nextTuning, key ) ) continue;

			const rawValue = Number( nextTuning[ key ] );
			this._previewTuning[ key ] = Number.isFinite( rawValue ) ? rawValue : defaultValue;

		}

		this._syncPreviewTargets();

		if ( immediate ) {

			this._currentCameraPos.copy( this._targetCameraPos );
			this._currentLookAt.copy( this._targetLookAt );
			this._currentFov = this._targetFov;
			this._currentKartRotationY = this._targetKartRotationY;
			this._applyPreviewPose();

		}

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

	/**
	 * Remove the kart and character from the scene.
	 */
	clearKart() {

		this._currentKartId = null;
		this._mixer = null;
		this._currentBodyRoot = null;
		this._currentCharacterRoot = null;
		this._syncDriverOffsetDebugControls( DEFAULT_SEAT_OFFSET );

		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

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
		this._currentCameraPos.lerp( this._targetCameraPos, 1 - Math.exp( - PREVIEW_POSE_LERP_SPEED * safeDt ) );
		this._currentLookAt.lerp( this._targetLookAt, 1 - Math.exp( - PREVIEW_POSE_LERP_SPEED * safeDt ) );
		this._currentFov = dampScalar( this._currentFov, this._targetFov, safeDt );
		this._currentKartRotationY = dampAngle( this._currentKartRotationY, this._targetKartRotationY, safeDt );
		this._applyPreviewPose();

		// Keep the menu hero static; only the seated rider animation should move.
		if ( this._mixer ) this._mixer.update( dt );

		// Keep debug helpers in sync with slider changes
		if ( this._dirHelper.visible ) this._dirHelper.update();
		if ( this._rimHelper.visible ) this._rimHelper.update();
		if ( this._camHelper.visible ) this._camHelper.update();

		this._composer.render( dt );

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
		panel.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.85);color:#fff;padding:0;border-radius:8px;font:12px monospace;z-index:99999;max-height:90vh;overflow:hidden;min-width:280px;display:none;flex-direction:column;';

		const cam = this._camera;
		const self = this;

		// ── Toggle button (happy face) ──────────────────────────────────
		const toggleBtn = document.createElement( 'button' );
		toggleBtn.textContent = '\u{1F60A}';
		toggleBtn.title = 'Lobby Debug';
		toggleBtn.style.cssText = 'position:fixed;top:12px;left:12px;z-index:99998;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.15);border-radius:8px;font-size:22px;cursor:pointer;padding:4px 7px;line-height:1;transition:transform 0.15s ease,background 0.15s ease;';
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
			lbl.style.cssText = 'width:70px;font-size:11px;';

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.min = min;
			input.max = max;
			input.step = step;
			input.value = value;
			input.style.cssText = 'flex:1;height:14px;';

			const val = document.createElement( 'span' );
			val.textContent = Number( value ).toFixed( 2 );
			val.style.cssText = 'width:45px;text-align:right;font-size:11px;';

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
			let on = initiallyOn;
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

		document.body.appendChild( panel );
		return panel;

	}

	/**
	 * Clean up.
	 */
	dispose() {

		window.removeEventListener( 'resize', this._onResize );
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
