import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { getTrackModelConfig, getTrackTileSet } from './TrackModelConfig.js';
import { getTrackAsphaltMode, applyTrackAsphaltMode } from './TrackAsphaltMode.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, transformCells, deriveRampCells, computeSpawnPosition, computeTrackBounds, TRACK_CELLS, CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';
import { RaceLobby } from './RaceLobby.js';
import { AFKDetector } from './AFKDetector.js';
import { buildWallColliders, buildTrackColliders } from './Physics.js';
import { GameAudio } from './Audio.js';
import { NetworkClient } from './Network.js';
import { PlayerManager } from './PlayerManager.js';
import { RaceMode } from './RaceMode.js';
import { HUD } from './HUD.js';
import { Minimap } from './Minimap.js';
import { TrackIntel } from './TrackIntel.js';
import { WallSparks } from './WallSparks.js';
import { BoostBurst } from './BoostBurst.js';
import { Haptics } from './Haptics.js';
import { ItemBoxManager } from './ItemBoxManager.js';
import { ItemPickupVFX } from './ItemPickupVFX.js';
import { AIManager } from './AIManager.js';
import { DebugMenu } from './DebugMenu.js';
import { PostProcessing } from './PostProcessing.js';
import { Settings } from './Settings.js';
import { SettingsMenu } from './SettingsMenu.js';
import { PRESETS, TIER_PIXEL_RATIO } from './QualityTiers.js';
import { DraftingSystem } from './DraftingSystem.js';
import { DraftLines } from './DraftLines.js';
import { Speedometer } from './Speedometer.js';
import { RearviewMirror } from './RearviewMirror.js';


const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
window.isMobile = isMobile;

let renderer;
let bloomPass;
let postFX;

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xadb2ba );
scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
dirLight.position.set( 11.4, 15, -5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 2048 ); // Overridden by quality preset during init
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 200;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 1.5 );
scene.add( hemiLight );

const LIGHTING_DAY = {
	background: 0xadb2ba,
	hemiSky: 0xc8d8e8,
	hemiGround: 0x7a8a5a,
	hemiIntensity: 1.5,
	dirColor: 0xffffff,
	dirIntensity: 5,
	bloomStrength: 0.02,
	bloomRadius: 0.02,
	bloomThreshold: 0.5,
	exposure: 1.0,
};

const LIGHTING_NIGHT = {
	background: 0x1a0a2e,
	hemiSky: 0x1a0a2e,
	hemiGround: 0x2a1a3a,
	hemiIntensity: 0.5,
	dirColor: 0xe8d0f8,
	dirIntensity: 3,
	bloomStrength: 0.03,
	bloomRadius: 0.05,
	bloomThreshold: 0.9,
	exposure: 1.0,
};

const _originalMaterials = new WeakMap();
const _boostFwd = new THREE.Vector3();

// Populated once after scene is fully built; avoids per-call scene.traverse (H-6)
const _lightingMeshes = [];

function buildLightingCache() {

	_lightingMeshes.length = 0;
	scene.traverse( ( child ) => {

		if ( child.isMesh && child.material.isMeshStandardMaterial ) {

			// Snapshot original material values on first encounter
			if ( ! _originalMaterials.has( child.material ) ) {

				_originalMaterials.set( child.material, {
					metalness: child.material.metalness,
					roughness: child.material.roughness,
				} );

			}

			_lightingMeshes.push( child );

		}

	} );

}

function applyLighting( preset ) {

	scene.background.setHex( preset.background );
	if ( scene.fog ) scene.fog.color.setHex( preset.background );
	hemiLight.color.setHex( preset.hemiSky );
	hemiLight.groundColor.setHex( preset.hemiGround );
	hemiLight.intensity = preset.hemiIntensity;
	dirLight.color.setHex( preset.dirColor );
	dirLight.intensity = preset.dirIntensity;

	bloomPass.strength = preset.bloomStrength;
	bloomPass.radius = preset.bloomRadius;
	bloomPass.threshold = preset.bloomThreshold;
	renderer.toneMappingExposure = preset.exposure;

	const isNight = preset === LIGHTING_NIGHT;

	for ( const child of _lightingMeshes ) {

		if ( isNight ) {

			child.material.metalness = 0.3;
			child.material.roughness = 0.4;

		} else {

			const orig = _originalMaterials.get( child.material );
			child.material.metalness = orig.metalness;
			child.material.roughness = orig.roughness;

		}

	}

}


window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );
	if ( postFX ) postFX.resize( window.innerWidth, window.innerHeight );

} );

const loader = new GLTFLoader();
const modelNames = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'trk-straight', 'trk-corner-1x1', 'trk-finish',
	'trk-curve-2x2-l',
	'trk-curve-2x2-tight-l',
	'trk-curve-3x3-l',
	'trk-curve-3x3-wide-l',
	'trk-elev-2p5', 'trk-elev-5',
	'trk-ramp-up-2p5', 'trk-ramp-up-5',
	'trk-ramp-up-2p5-smooth', 'trk-ramp-up-5-smooth',
	'trk-ramp-down-2p5', 'trk-ramp-down-5',
	'decoration-empty-night', 'decoration-buildings-1', 'decoration-buildings-2',
];

const models = {};
const trackTileSet = getTrackTileSet( globalThis.location?.search ?? '' );
const asphaltMode = getTrackAsphaltMode( globalThis.location?.search ?? '' );

async function loadModels() {

	const promises = modelNames.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			const modelConfig = getTrackModelConfig( name, trackTileSet );
            loader.load( `models/${ modelConfig.path }`, ( gltf ) => {

				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;
						child.material.depthWrite = true;
					applyTrackAsphaltMode( child.material, { asphaltMode } );

					}

				} );

				// Vehicle models use root_scale=0.5
				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				if ( modelConfig.rotationY !== 0 ) {

					const wrapper = new THREE.Group();
					gltf.scene.rotation.y = modelConfig.rotationY;
					wrapper.add( gltf.scene );
					models[ name ] = wrapper;

				} else {

					models[ name ] = gltf.scene;

				}
				resolve();

			}, undefined, ( err ) => { console.error( '[model] FAILED:', name, err ); reject( err ); } );

		} )
	);

	await Promise.all( promises );

}

async function init() {

	// ── Renderer setup ───────────────────────────────────────────────────────
	// WebGPU requires a node-based post-processing pipeline (TSL) which is
	// incompatible with the ShaderPass / setEffects() API we use.  Stick with
	// WebGLRenderer for now; WebGPU can be revisited once the post-processing
	// pipeline is migrated to TSL nodes.
	renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setPixelRatio( 1.0 ); // Overridden by quality preset during init
	renderer.shadowMap.enabled = true;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;

	bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
	bloomPass.strength = 0.02;
	bloomPass.radius = 0.02;
	bloomPass.threshold = 0.5;

	renderer.setEffects( [ bloomPass ] );
	document.body.appendChild( renderer.domElement );

	registerAll();
	await loadModels();

	const mapParam = new URLSearchParams( window.location.search ).get( 'map' );
	let customCells = null;

	if ( mapParam ) {

		try {

			customCells = decodeCells( mapParam );

		} catch ( e ) {

			console.warn( 'Invalid map parameter, using default track' );

		}

	}

	const activeCells = customCells || TRACK_CELLS;

	// Transform cells: derive elevation/ramps and multi-tile curves for rendering.
	// The original activeCells (with base types) go to TrackIntel for waypoint walking.
	// The transformed cells (with visual types) go to buildTrack/buildTrackColliders/buildWallColliders.
	const renderCells = customCells ? transformCells( activeCells ) : activeCells;

	const spawn = computeSpawnPosition( activeCells );

	// Compute track bounds and size physics/shadows to fit
	const bounds = computeTrackBounds( activeCells );
	const hw = bounds.halfWidth;
	const hd = bounds.halfDepth;
	const groundSize = Math.max( hw, hd ) * 2 + 20;

	const shadowExtent = Math.max( hw, hd ) + 10;
	dirLight.shadow.camera.left = - shadowExtent;
	dirLight.shadow.camera.right = shadowExtent;
	dirLight.shadow.camera.top = shadowExtent;
	dirLight.shadow.camera.bottom = - shadowExtent;
	dirLight.shadow.camera.updateProjectionMatrix();

	if ( scene.fog ) {

		scene.fog.near = groundSize * 1.2;
		scene.fog.far = groundSize * 2.5;

	}

	buildTrack( scene, models, renderCells );

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];

	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );

	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );

	const world = createWorld( worldSettings );
	world._OL_MOVING = OL_MOVING;
	world._OL_STATIC = OL_STATIC;

	// Debug: pass a group to visualize wall colliders as green wireframes
	// Wall colliders are OFF by default — toggle via debug menu
	const wallDebugGroup = new THREE.Group();
	wallDebugGroup.visible = false;
	scene.add( wallDebugGroup );
	let wallCollidersEnabled = false;

	// Build debug wireframes only (no physics bodies) on first load
	buildWallColliders( world, wallDebugGroup, renderCells, { skipPhysics: true } );

	const trackColliderData = buildTrackColliders( world, models, renderCells );

	// Build debug visualization of the track surface collider (pink wireframe)
	const colliderDebugGroup = new THREE.Group();
	colliderDebugGroup.visible = false;
	scene.add( colliderDebugGroup );
	{

		const geo = new THREE.BufferGeometry();
		geo.setAttribute( 'position', new THREE.BufferAttribute( trackColliderData.positions, 3 ) );
		geo.setIndex( new THREE.BufferAttribute( trackColliderData.indices, 1 ) );
		const edges = new THREE.EdgesGeometry( geo, 15 );
		const mat = new THREE.LineBasicMaterial( { color: 0xff69b4, depthTest: false, transparent: true, opacity: 0.6 } );
		colliderDebugGroup.add( new THREE.LineSegments( edges, mat ) );

	}

	// Build debug visualization: one cyan wireframe cube per track tile
	const meshDebugGroup = new THREE.Group();
	meshDebugGroup.visible = false;
	scene.add( meshDebugGroup );
	function rebuildMeshOutlines() {

		meshDebugGroup.clear();
		const S = GRID_SCALE;

		for ( const cell of renderCells ) {

			const [ gx, gz, key, , flags ] = cell;
			if ( ! key ) continue;

			const x = ( gx + 0.5 ) * CELL_RAW * S;
			const z = ( gz + 0.5 ) * CELL_RAW * S;
			const elev = flags?.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const cubeH = 1.5;
			const y = elevY - 0.5 + cubeH / 2;

			const mesh = new THREE.Mesh( new THREE.BoxGeometry( CELL_RAW * S, cubeH, CELL_RAW * S ) );
			mesh.position.set( x, y, z );
			const helper = new THREE.BoxHelper( mesh, 0x00ffff );
			helper.material.depthTest = false;
			helper.material.transparent = true;
			helper.material.opacity = 0.6;
			meshDebugGroup.add( helper );

		}

	}

	// ── Debug: text sprite helper ────────────────────────────────────────────
	function makeTextSprite( text, color = '#ffffff', fontSize = 48, scale = 2.5 ) {

		const canvas = document.createElement( 'canvas' );
		const ctx = canvas.getContext( '2d' );
		ctx.font = `bold ${fontSize}px monospace`;
		const metrics = ctx.measureText( text );
		const w = Math.ceil( metrics.width ) + 12;
		const h = fontSize + 12;
		canvas.width = w;
		canvas.height = h;
		ctx.font = `bold ${fontSize}px monospace`;
		ctx.fillStyle = 'rgba(0,0,0,0.6)';
		ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = color;
		ctx.textBaseline = 'middle';
		ctx.fillText( text, 6, h / 2 );
		const tex = new THREE.CanvasTexture( canvas );
		tex.minFilter = THREE.LinearFilter;
		const mat = new THREE.SpriteMaterial( { map: tex, depthTest: false, transparent: true } );
		const sprite = new THREE.Sprite( mat );
		sprite.scale.set( scale * ( w / h ), scale, 1 );
		return sprite;

	}

	// ── Debug: floating tile name labels ─────────────────────────────────────
	const tileLabelsGroup = new THREE.Group();
	tileLabelsGroup.visible = false;
	scene.add( tileLabelsGroup );
	function buildTileLabels() {

		const S = GRID_SCALE;
		for ( const cell of renderCells ) {

			const [ gx, gz, key, orient, flags ] = cell;
			if ( ! key ) continue;
			const x = ( gx + 0.5 ) * CELL_RAW * S;
			const z = ( gz + 0.5 ) * CELL_RAW * S;
			const elev = flags?.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const y = elevY + 2.5;
			const label = `${key} [${orient}]`;
			const sprite = makeTextSprite( label, '#00ffcc', 24, 0.25 );
			sprite.position.set( x, y, z );
			tileLabelsGroup.add( sprite );

		}

	}

	// ── Debug: barrier & curb Y height labels ────────────────────────────────
	// Uses known model heights from GLTF accessor data:
	// Road surface: Y 0.085-0.185 (model space), wall/curb: Y 0.085-0.935
	// Track group offset: -0.5, tile placement Y: 0.5 → net world Y = model Y
	const heightLabelsGroup = new THREE.Group();
	heightLabelsGroup.visible = false;
	scene.add( heightLabelsGroup );
	function buildHeightLabels() {

		const S = GRID_SCALE;
		// Known model-space heights (from GLTF accessor measurements)
		const ROAD_Y = 0.185;   // top of road surface
		const WALL_Y = 0.935;   // top of barrier/curb
		const BASE_Y = 0.085;   // bottom of road
		// World offset: tile placed at Y=0.5, trackGroup at Y=-0.5 → net 0

		const samples = [
			{ label: 'L wall top', lx: - 4.8, modelY: WALL_Y },
			{ label: 'R wall top', lx: 4.8, modelY: WALL_Y },
			{ label: 'L curb', lx: - 4.0, modelY: ROAD_Y },
			{ label: 'R curb', lx: 4.0, modelY: ROAD_Y },
			{ label: 'road', lx: 0, modelY: ROAD_Y },
			{ label: 'base', lx: 0, modelY: BASE_Y },
		];

		for ( const cell of renderCells ) {

			const [ gx, gz, key, orient, flags ] = cell;
			if ( ! key ) continue;

			const cx = ( gx + 0.5 ) * CELL_RAW * S;
			const cz = ( gz + 0.5 ) * CELL_RAW * S;
			const elev = flags?.elevation || 0;
			const elevY = elev === 1 ? 2.416 : elev === 2 ? 4.832 : 0;
			const deg = ORIENT_DEG[ orient ] ?? 0;
			const rad = deg * Math.PI / 180;
			const cr = Math.cos( rad ), sr = Math.sin( rad );

			for ( const sample of samples ) {

				const wx = cx + ( sample.lx * cr ) * S;
				const wz = cz + ( - sample.lx * sr ) * S;
				const worldY = sample.modelY + elevY;
				const yText = `${sample.label}: ${worldY.toFixed( 2 )}m`;
				const sprite = makeTextSprite( yText, '#ffaa00', 24, 0.25 );
				sprite.position.set( wx, worldY + 0.3, wz );
				heightLabelsGroup.add( sprite );

			}

		}

	}

	// Safety-net ground far below the track — catches the vehicle if it falls off-track
	const roadHalf = groundSize / 2;
	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
		motionType: MotionType.STATIC,
		objectLayer: OL_STATIC,
		position: [ bounds.centerX, - 5, bounds.centerZ ],
		friction: 5.0,
		restitution: 0.0,
	} );

	const spawnPosition = spawn.position;
	const spawnAngle = spawn.angle;

	const playerManager = new PlayerManager( scene, world, models, spawnPosition, spawnAngle );

	// ── Multiplayer connection ────────────────────────────────────────────────
	const network = new NetworkClient();
	let multiplayer = false;
	let spectating = false;

	const spectateBtn = document.getElementById( 'spectate-btn' );

	try {

		await network.connect();
		multiplayer = true;

		// Wait for welcome message before continuing (5s timeout to avoid hanging)
		await new Promise( ( resolve, reject ) => {

			const timeout = setTimeout( () => reject( new Error( 'Server welcome timed out' ) ), 5000 );

			network.onWelcome = ( data ) => {

				clearTimeout( timeout );

				try {

					playerManager.initLocalPlayer( data );
					if ( spectateBtn ) spectateBtn.style.display = 'block';
					resolve();

				} catch ( err ) {

					reject( err );

				}

			};

		} );

		network.onPlayerJoin = ( data ) => playerManager.addRemotePlayer( data );
		network.onPlayerLeave = ( data ) => playerManager.removeRemotePlayer( data.id );
		network.onWorldUpdate = ( data ) => playerManager.applyWorldUpdate( data );
		network.onPlayerSpectate = ( data ) => playerManager.setSpectating( data.id, data.active );

		network.onDisconnect = () => {

			console.log( 'Disconnected from server' );
			multiplayer = false;
			if ( spectateBtn ) spectateBtn.style.display = 'none';

		};

	} catch ( e ) {

		console.warn( 'Multiplayer failed, single-player mode:', e );
		playerManager.initSinglePlayer();

	}

	// Direct reference for debug panel compatibility
	const vehicle = playerManager.localVehicle;

	const dirLightOffset = { x: 11.4, y: 15, z: - 5.3 };
	let lastShadowX = 0, lastShadowZ = 0;

	// ── Audio (must be before RaceMode which references it in callbacks) ────
	const audio = new GameAudio();

	// ── Race mode setup ──────────────────────────────────────────────────────
	const raceMode = new RaceMode( {
		totalLaps: 3,
		spawnPosition: spawnPosition,
		spawnAngle: spawnAngle,
		onCountdownTick: ( count ) => {

			if ( count > 0 ) audio.playBeep( 440, 0.15 );
			else audio.playBeep( 880, 0.3 );

		},
	} );

	// Init finish line from spawn/finish cell position (use finishAngle, not spawn angle)
	raceMode.initFinishLine( spawn.position, spawn.finishAngle );

	// ── Race lobby (zone-based start) ───────────────────────────────────────
	const raceLobby = new RaceLobby( {
		zoneCenter: [ spawn.position[ 0 ], spawn.position[ 2 ] ],
		zoneHalfExtent: CELL_RAW * GRID_SCALE / 2,
		dwellTime: 5,
		onAllReady: () => {

			raceLobby.reset();
			if ( aiManager.count > 0 ) aiManager.teleportToGrid( vehicle );
			raceMode.start();
			aiManager.startRace();

		},
	} );

	// ── AFK detector ────────────────────────────────────────────────────────
	const afkDetector = new AFKDetector( {
		timeout: 60,
		movementThreshold: 0.1,
		onAFK: () => {

			spectating = true;
			if ( spectateBtn ) spectateBtn.textContent = 'Race';
			if ( multiplayer ) network.sendSpectate( true );
			playerManager.setSpectating( playerManager.localId, true );
			cam.spectatorTarget = playerManager.getFirstActiveVehicle();

		},
	} );

	const hud = new HUD(
		() => { raceMode.reset(); aiManager.resetRace(); raceLobby.reset(); },
		() => raceLobby.setReady( playerManager.localId )
	);

	const intelCells = customCells ? deriveRampCells( activeCells ) : activeCells;
	const trackIntel = new TrackIntel( intelCells );
	raceMode.trackIntel = trackIntel;
	vehicle.setTrackIntel( trackIntel );

	const aiManager = new AIManager( scene, world, models, trackIntel, spawnPosition, spawnAngle, spawn.finishAngle );
	aiManager.totalLaps = 3;
	let playerModelIndex = 0;

	const minimap = new Minimap( activeCells, bounds );

	// ── Item boxes ───────────────────────────────────────────────────────────
	const itemBoxManager = new ItemBoxManager( scene, trackIntel );

	// ── Multiplayer race sync ────────────────────────────────────────────────

	if ( multiplayer ) {

		network.onRaceCountdown = ( msg ) => {

			raceMode.networkDriven = true;
			raceMode.setCountdown( msg.count );

		};

		network.onRaceStart = () => {

			raceMode.setCountdown( 0 );

		};

		network.onPlayerLap = () => {

			// Future: display other players' lap progress

		};

		raceMode.onLapComplete = ( lap, time ) => {

			audio.playLapChime();
			network.sendLapComplete( lap, time );

		};

	}

	let debugCollider = null;
	let wheelDebug = null;
	let hudVisible = false;

	{

		// ─── DEBUG OVERLAY ────────────────────────────────────────────────────────

		// Helper: sprite label for axis ends
		function makeAxisLabel( text, color ) {

			const canvas = document.createElement( 'canvas' );
			canvas.width = 64; canvas.height = 32;
			const ctx = canvas.getContext( '2d' );
			ctx.font = 'bold 20px Arial';
			ctx.fillStyle = color;
			ctx.fillText( text, 14, 22 );
			const tex = new THREE.CanvasTexture( canvas );
			const mat = new THREE.SpriteMaterial( { map: tex, depthTest: false } );
			const sprite = new THREE.Sprite( mat );
			sprite.scale.set( 0.3, 0.15, 1 );
			return sprite;

		}

		// Vehicle physics collider: box with halfExtents [0.4, 0.3, 0.7] (from Physics.js)
		debugCollider = new THREE.Mesh(
			new THREE.BoxGeometry( 0.8, 0.6, 1.4 ),
			new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
		);
		debugCollider.visible = false;
		scene.add( debugCollider );

		// Per-wheel: yellow box + local axes (Red=X roll, Green=Y steer, Blue=Z) + labels
		wheelDebug = vehicle.wheels.map( ( w ) => {

			const boxH = new THREE.BoxHelper( w, 0xffff00 );
			boxH.visible = false;
			scene.add( boxH );

			const axes = new THREE.AxesHelper( 0.5 );
			axes.visible = false;
			w.add( axes );

			const xLabel = makeAxisLabel( 'X', '#ff4444' );
			xLabel.position.set( 0.65, 0, 0 );
			xLabel.visible = false;
			w.add( xLabel );

			const yLabel = makeAxisLabel( 'Y', '#44ff44' );
			yLabel.position.set( 0, 0.65, 0 );
			yLabel.visible = false;
			w.add( yLabel );

			const zLabel = makeAxisLabel( 'Z', '#4488ff' );
			zLabel.position.set( 0, 0, 0.65 );
			zLabel.visible = false;
			w.add( zLabel );

			return { boxH, axes, labels: [ xLabel, yLabel, zLabel ] };

		} );

		// ─── HUD PANEL (toggle with H key) ────────────────────────────────────────
		const debugHud = document.createElement( 'div' );
		debugHud.style.cssText = [
			'position:fixed', 'top:12px', 'right:12px',
			'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
			'padding:10px 14px', 'border-radius:6px', 'pointer-events:none',
			'min-width:260px', 'white-space:pre', 'z-index:999',
		].join( ';' );
		document.body.appendChild( debugHud );

		hudVisible = false;
		debugHud.style.display = 'none';
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'h' || e.key === 'H' ) {

				hudVisible = ! hudVisible;
				debugHud.style.display = hudVisible ? 'block' : 'none';

			}

		} );

		// ─── DEBUG CONTROLS PANEL (tabbed, toggle with M) ────────────────────────

		const debugMenu = new DebugMenu();

		// ── Tab: General ─────────────────────────────────────────────────────────
		const generalTab = debugMenu.addTab( 'general', 'General' );

		debugMenu.addHeader( generalTab, 'Environment' );

		debugMenu.addCheckbox( generalTab, 'Night mode', false, ( v ) => {

			applyLighting( v ? LIGHTING_NIGHT : LIGHTING_DAY );
			for ( const hl of vehicle.headlights ) hl.visible = v;

		} );

		{

			const row = document.createElement( 'div' );
			row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';

			const lbl = document.createElement( 'span' );
			lbl.style.cssText = 'min-width:100px';
			lbl.textContent = 'Vehicle';

			const select = document.createElement( 'select' );
			select.style.cssText = 'flex:1;background:#222;color:#0f0;border:1px solid #0f0;font:12px monospace;padding:2px';

			const truckNames = [
				'vehicle-truck-yellow', 'vehicle-truck-green',
				'vehicle-truck-purple', 'vehicle-truck-red',
			];

			for ( const name of truckNames ) {

				const opt = document.createElement( 'option' );
				opt.value = name;
				opt.textContent = name.replace( 'vehicle-truck-', '' );
				select.appendChild( opt );

			}

			select.addEventListener( 'change', () => {

				const newModel = models[ select.value ];
				if ( ! newModel ) return;

				playerModelIndex = truckNames.indexOf( select.value );
				aiManager.playerModelIndex = playerModelIndex;

				const oldLights = [ vehicle.underglowLight, ...vehicle.headlights ];
				const oldTargets = vehicle.headlights.map( ( hl ) => hl.target );

				vehicle.container.clear();
				vehicle.wheels = [];
				vehicle.wheelFL = vehicle.wheelFR = vehicle.wheelBL = vehicle.wheelBR = null;
				vehicle.bodyNode = null;

				const vehicleModel = newModel.clone();
				vehicle.container.add( vehicleModel );

				vehicleModel.traverse( ( child ) => {

					const name = child.name.toLowerCase();

					if ( name === 'body' ) {

						child.rotation.order = 'YXZ';
						vehicle.bodyNode = child;

					} else if ( name.includes( 'wheel' ) && ! name.includes( 'steering' ) ) {

						child.rotation.order = 'YXZ';
						vehicle.wheels.push( child );

						if ( name.includes( 'front' ) && name.includes( 'left' ) ) vehicle.wheelFL = child;
						if ( name.includes( 'front' ) && name.includes( 'right' ) ) vehicle.wheelFR = child;
						if ( name.includes( 'back' ) && name.includes( 'left' ) ) vehicle.wheelBL = child;
						if ( name.includes( 'back' ) && name.includes( 'right' ) ) vehicle.wheelBR = child;

					}

					if ( child.isMesh ) {

						child.castShadow = true;
						child.receiveShadow = true;

					}

				} );

				vehicle.container.add( oldLights[ 0 ] );
				for ( let i = 0; i < vehicle.headlights.length; i ++ ) {

					vehicle.container.add( oldTargets[ i ] );
					vehicle.container.add( vehicle.headlights[ i ] );

				}

			} );

			row.appendChild( lbl );
			row.appendChild( select );
			generalTab.appendChild( row );

		}

		debugMenu.addHeader( generalTab, 'Debug visuals' );

		debugMenu.addCheckbox( generalTab, 'Show Vehicle Physics Collider', false, ( v ) => {

			debugCollider.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Show wall colliders', false, ( v ) => {

			wallDebugGroup.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Enable wall colliders', false, ( v ) => {

			if ( v && ! wallCollidersEnabled ) {

				buildWallColliders( world, null, renderCells );
				wallCollidersEnabled = true;

			}

		} );

		debugMenu.addCheckbox( generalTab, 'Show mesh outlines (cyan)', false, ( v ) => {

			if ( v && meshDebugGroup.children.length === 0 ) rebuildMeshOutlines();
			meshDebugGroup.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Show collider geometry (pink)', false, ( v ) => {

			colliderDebugGroup.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Show tile names', false, ( v ) => {

			if ( v && tileLabelsGroup.children.length === 0 ) buildTileLabels();
			tileLabelsGroup.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Show Y heights', false, ( v ) => {

			if ( v && heightLabelsGroup.children.length === 0 ) buildHeightLabels();
			heightLabelsGroup.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Jitter diagnostic overlay', false, ( v ) => {

			jitterDisplay.style.display = v ? 'block' : 'none';

		} );

		// Decoration layer toggles
		const tg = scene.getObjectByName( 'trackGroup' );
		const decoLayers = tg && tg.userData.decoLayers;
		if ( decoLayers ) {

			debugMenu.addHeader( generalTab, 'Decoration layers' );

			debugMenu.addCheckbox( generalTab, 'buildings-1', true, ( v ) => { decoLayers[ 'buildings-1' ].visible = v; } );
			debugMenu.addCheckbox( generalTab, 'buildings-2', true, ( v ) => { decoLayers[ 'buildings-2' ].visible = v; } );
			debugMenu.addCheckbox( generalTab, 'empty-night', true, ( v ) => { decoLayers[ 'empty-night' ].visible = v; } );

		}

		debugMenu.addCheckbox( generalTab, 'Show ground plane indicator', false, ( v ) => {

			groundIndicator.visible = v;

		} );

		debugMenu.addSlider( generalTab, 'FPS cap', 0, 240, 1, 0, ( v ) => {

			fpsCapMs = v > 0 ? 1000 / v : 0;

		} );

		debugMenu.addCheckbox( generalTab, 'Show wall colliders', false, ( v ) => {

			wallDebugGroup.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Jitter diagnostic overlay', false, ( v ) => {

			jitterDisplay.style.display = v ? 'block' : 'none';

		} );

		debugMenu.addCheckbox( generalTab, 'Show ground plane indicator', false, ( v ) => {

			groundIndicator.visible = v;

		} );

		debugMenu.addSlider( generalTab, 'FPS cap', 0, 240, 1, 0, ( v ) => {

			fpsCapMs = v > 0 ? 1000 / v : 0;

		} );

		debugMenu.addCheckbox( generalTab, 'Show wheel debug', false, ( v ) => {

			for ( const wd of wheelDebug ) {

				wd.boxH.visible = v;
				wd.axes.visible = v;
				for ( const l of wd.labels ) l.visible = v;

			}

		} );

		debugMenu.addCheckbox( generalTab, 'Show draft debug', false, ( v ) => {

			draftIndicatorEnabled = v;
			if ( ! v ) draftIndicator.style.display = 'none';

		} );

		debugMenu.addHeader( generalTab, 'Height offsets (Y axis)' );

		debugMenu.addSlider( generalTab, 'Wheel height', - 1.0, 1.0, 0.01, 0, ( v ) => { vehicle.debug.wheelHeight = v; } );
		debugMenu.addSlider( generalTab, 'Body height', - 1.0, 1.0, 0.01, 0.2, ( v ) => { vehicle.debug.bodyHeight = v; } );
		debugMenu.addSlider( generalTab, 'Underbody', - 2.0, 1.0, 0.01, - 0.5, ( v ) => { vehicle.debug.underbodyOffset = v; } );
		debugMenu.addSlider( generalTab, 'Ride height', 0, 0.5, 0.01, 0, ( v ) => { vehicle.debug.rideHeight = v; } );
		debugMenu.addSlider( generalTab, 'Chase cam height', 0, 10.0, 0.1, 2, ( v ) => { cam.chaseHeight = v; } );
		debugMenu.addSlider( generalTab, 'Zoom', 0.5, 3.0, 0.05, 1.0, ( v ) => { cam.zoom = v; } );
		debugMenu.addSlider( generalTab, 'Acceleration', 1, 20, 0.5, 1, ( v ) => { vehicle.debug.accelerationRate = v; } );
		debugMenu.addSlider( generalTab, 'Top speed', 10, 300, 5, 250, ( v ) => { vehicle.debug.topSpeed = v; } );

		debugMenu.addHeader( generalTab, 'Camera G-Force' );

		debugMenu.addCheckbox( generalTab, 'G-Force Effects', true, ( v ) => { cam.gforceEnabled = v; } );
		debugMenu.addSlider( generalTab, 'Roll intensity', 0, 1.0, 0.01, 0.35, ( v ) => { cam.rollIntensity = v; } );
		debugMenu.addSlider( generalTab, 'FOV narrow', 0, 16, 0.5, 8, ( v ) => { cam.fovNarrowMax = v; } );
		debugMenu.addSlider( generalTab, 'Boost punch', 0, 20, 0.5, 8, ( v ) => { cam.boostPunchAmount = v; } );

		debugMenu.addHeader( generalTab, 'AI Racers' );

		debugMenu.addSlider( generalTab, 'AI count', 0, 8, 1, 0, ( v ) => { aiManager.setCount( v ); } );
		debugMenu.addSlider( generalTab, 'Rubber band %', 0, 100, 1, 50, ( v ) => { aiManager.rubberBandIntensity = v / 100; } );

		const aiPersonalityLabel = document.createElement( 'div' );
		aiPersonalityLabel.style.cssText = 'margin:4px 0;font-size:11px;color:#0f08';
		aiPersonalityLabel.textContent = '';
		generalTab.appendChild( aiPersonalityLabel );

		// Update personality display when AI count changes
		const updatePersonalityLabel = () => {

			const data = aiManager.getAIRaceData();
			if ( data.length === 0 ) {

				aiPersonalityLabel.textContent = '';

			} else {

				aiPersonalityLabel.textContent = 'Personalities: ' + data.map( ( d ) => d.profileName ).join( ', ' );

			}

		};

		// Poll every 500ms (lightweight, only when debug visible)
		setInterval( () => { if ( debugMenu.visible ) updatePersonalityLabel(); }, 500 );

		// ── Tab: Post FX ─────────────────────────────────────────────────────────
		const postFXTab = debugMenu.addTab( 'postprocessing', 'Post FX' );

		// Active preset label
		const presetLabel = document.createElement( 'div' );
		presetLabel.style.cssText = 'margin:4px 0 8px;padding:4px 8px;background:#0f02;border:1px solid #0f044;border-radius:3px;text-align:center';
		presetLabel.textContent = 'Active preset: detecting...';
		postFXTab.appendChild( presetLabel );
		window.addEventListener( 'settings-changed', ( e ) => {

			if ( e.detail.key === 'quality' ) presetLabel.textContent = 'Active preset: ' + e.detail.value;

		} );

		debugMenu.addHeader( postFXTab, 'Bloom / Glow' );

		let _savedBloomStrength = bloomPass.strength;
		debugMenu.addCheckbox( postFXTab, 'Bloom enabled', true, ( v ) => {

			if ( v ) {

				bloomPass.strength = _savedBloomStrength;

			} else {

				_savedBloomStrength = bloomPass.strength;
				bloomPass.strength = 0;

			}

		} );

		debugMenu.addCheckbox( postFXTab, 'Glow (underglow light)', true, ( v ) => {

			if ( vehicle.underglowLight ) vehicle.underglowLight.visible = v;
			vehicle._glowEnabled = v;

		} );

		debugMenu.addCheckbox( postFXTab, 'Emissive materials', true, ( v ) => {

			scene.traverse( ( child ) => {

				if ( child.isMesh && child.material && child.material.emissiveIntensity !== undefined ) {

					child.material.emissiveIntensity = v ? child.material.userData._origEmissive || 0.8 : 0;
					if ( v && ! child.material.userData._origEmissive ) {

						child.material.userData._origEmissive = child.material.emissiveIntensity;

					}

				}

			} );

		} );

		debugMenu.addSlider( postFXTab, 'Bloom strength', 0, 3.0, 0.01, bloomPass.strength, ( v ) => { bloomPass.strength = v; } );
		debugMenu.addSlider( postFXTab, 'Bloom radius', 0, 1.0, 0.01, bloomPass.radius, ( v ) => { bloomPass.radius = v; } );
		debugMenu.addSlider( postFXTab, 'Bloom threshold', 0, 1.0, 0.01, bloomPass.threshold, ( v ) => { bloomPass.threshold = v; } );

		debugMenu.addHeader( postFXTab, 'Motion Blur' );

		debugMenu.addCheckbox( postFXTab, 'Motion Blur', false, ( v ) => { postFX.setEnabled( 'motionBlur', v ); } );
		debugMenu.addSlider( postFXTab, 'MB Intensity', 0, 1.0, 0.01, 0.5, ( v ) => { postFX.getPass( 'motionBlur' ).uniforms.intensity.value = v; } );
		debugMenu.addSlider( postFXTab, 'MB Samples', 1, 16, 1, 8, ( v ) => { postFX.getPass( 'motionBlur' ).uniforms.samples.value = v; } );

		debugMenu.addHeader( postFXTab, 'Chromatic Aberration' );

		debugMenu.addCheckbox( postFXTab, 'Chromatic Aberration', false, ( v ) => { postFX.setEnabled( 'chromaticAberration', v ); } );
		debugMenu.addSlider( postFXTab, 'CA Offset', 0, 0.02, 0.001, 0.005, ( v ) => { postFX.getPass( 'chromaticAberration' ).uniforms.offset.value = v; } );

		debugMenu.addHeader( postFXTab, 'Radial Zoom Blur' );

		debugMenu.addCheckbox( postFXTab, 'Radial Zoom', false, ( v ) => { postFX.setEnabled( 'radialZoom', v ); } );
		debugMenu.addSlider( postFXTab, 'RZ Intensity', 0, 1.0, 0.01, 0.3, ( v ) => { postFX.getPass( 'radialZoom' ).uniforms.intensity.value = v; } );

		debugMenu.addHeader( postFXTab, 'Vignette' );

		debugMenu.addCheckbox( postFXTab, 'Vignette', false, ( v ) => { postFX.setEnabled( 'vignette', v ); } );
		debugMenu.addSlider( postFXTab, 'Vignette intensity', 0, 1.5, 0.01, 0.5, ( v ) => { postFX.getPass( 'vignette' ).uniforms.intensity.value = v; } );
		debugMenu.addSlider( postFXTab, 'Vignette softness', 0, 1.0, 0.01, 0.5, ( v ) => { postFX.getPass( 'vignette' ).uniforms.softness.value = v; } );

		debugMenu.addHeader( postFXTab, 'Color Grading' );

		debugMenu.addCheckbox( postFXTab, 'Color Grading', false, ( v ) => { postFX.setEnabled( 'colorGrading', v ); } );
		debugMenu.addSlider( postFXTab, 'Brightness', - 1, 1, 0.01, 0, ( v ) => { postFX.getPass( 'colorGrading' ).uniforms.brightness.value = v; } );
		debugMenu.addSlider( postFXTab, 'Contrast', 0, 2, 0.01, 1, ( v ) => { postFX.getPass( 'colorGrading' ).uniforms.contrast.value = v; } );
		debugMenu.addSlider( postFXTab, 'Saturation', 0, 2, 0.01, 1, ( v ) => { postFX.getPass( 'colorGrading' ).uniforms.saturation.value = v; } );

		debugMenu.addHeader( postFXTab, 'Screen Shake' );

		debugMenu.addCheckbox( postFXTab, 'Screen Shake', false, ( v ) => { postFX.setEnabled( 'screenShake', v ); } );
		debugMenu.addSlider( postFXTab, 'Shake Intensity', 0, 0.05, 0.001, 0.02, ( v ) => { postFX.shakeIntensity = v; } );
		debugMenu.addSlider( postFXTab, 'Shake Decay', 1, 20, 0.5, 10, ( v ) => { postFX.shakeDecay = v; } );
		debugMenu.addButton( postFXTab, 'Test Shake', () => { postFX.triggerScreenShake( 0.03 ); } );

		debugMenu.addHeader( postFXTab, 'SSAO' );

		debugMenu.addCheckbox( postFXTab, 'SSAO', false, ( v ) => { postFX.setEnabled( 'ssao', v ); } );
		debugMenu.addSlider( postFXTab, 'SSAO Radius', 0, 4, 0.1, 1, ( v ) => { postFX.setSSAOParam( 'kernelRadius', v ); } );
		debugMenu.addSlider( postFXTab, 'SSAO Min Dist', 0, 0.01, 0.001, 0.001, ( v ) => { postFX.setSSAOParam( 'minDistance', v ); } );
		debugMenu.addSlider( postFXTab, 'SSAO Max Dist', 0, 0.1, 0.005, 0.05, ( v ) => { postFX.setSSAOParam( 'maxDistance', v ); } );

		debugMenu.addHeader( postFXTab, 'God Rays' );

		debugMenu.addCheckbox( postFXTab, 'God Rays', false, ( v ) => { postFX.setEnabled( 'godRays', v ); } );
		debugMenu.addSlider( postFXTab, 'GR Intensity', 0, 2, 0.01, 1.0, ( v ) => { postFX.getPass( 'godRays' ).uniforms.intensity.value = v; } );
		debugMenu.addSlider( postFXTab, 'GR Decay', 0.9, 1.0, 0.005, 0.96, ( v ) => { postFX.getPass( 'godRays' ).uniforms.decay.value = v; } );
		debugMenu.addSlider( postFXTab, 'GR Density', 0, 1, 0.01, 0.5, ( v ) => { postFX.getPass( 'godRays' ).uniforms.density.value = v; } );
		debugMenu.addSlider( postFXTab, 'GR Weight', 0, 1, 0.01, 0.1, ( v ) => { postFX.getPass( 'godRays' ).uniforms.weight.value = v; } );

		// ── Tab: Physics ─────────────────────────────────────────────────────────
		const physicsTab = debugMenu.addTab( 'physics', 'Physics' );

		debugMenu.addHeader( physicsTab, 'Wheel rotation locks' );

		debugMenu.addCheckbox( physicsTab, 'Lock X', false, ( v ) => { vehicle.debug.lockX = v; } );
		debugMenu.addCheckbox( physicsTab, 'Lock Y (roll)', false, ( v ) => { vehicle.debug.lockY = v; } );
		debugMenu.addCheckbox( physicsTab, 'Lock Z (steer)', false, ( v ) => { vehicle.debug.lockZ = v; } );

		debugMenu.addHeader( physicsTab, 'Vehicle Physics' );

		debugMenu.addSlider( physicsTab, 'Steering multiplier', 0.5, 10, 0.1, vehicle.debug.steeringMultiplier, ( v ) => { vehicle.debug.steeringMultiplier = v; } );
		debugMenu.addSlider( physicsTab, 'Steering lerp', 0.5, 15, 0.1, vehicle.debug.steeringLerp, ( v ) => { vehicle.debug.steeringLerp = v; } );
		debugMenu.addSlider( physicsTab, 'Steering grip min', 0.0, 1.0, 0.01, vehicle.debug.steeringGripMin, ( v ) => { vehicle.debug.steeringGripMin = v; } );
		debugMenu.addSlider( physicsTab, 'Steering grip max', 0.2, 2.0, 0.01, vehicle.debug.steeringGripMax, ( v ) => { vehicle.debug.steeringGripMax = v; } );
		debugMenu.addSlider( physicsTab, 'Brake rate', 1, 20, 0.5, vehicle.debug.brakeRate, ( v ) => { vehicle.debug.brakeRate = v; } );
		debugMenu.addSlider( physicsTab, 'Reverse speed factor', 0.1, 1.0, 0.05, vehicle.debug.reverseSpeedFactor, ( v ) => { vehicle.debug.reverseSpeedFactor = v; } );
		debugMenu.addSlider( physicsTab, 'Reverse accel rate', 0.5, 10, 0.5, vehicle.debug.reverseAccelRate, ( v ) => { vehicle.debug.reverseAccelRate = v; } );
		debugMenu.addSlider( physicsTab, 'Linear damp', 0.0, 1.0, 0.01, vehicle.debug.linearDamp, ( v ) => { vehicle.debug.linearDamp = v; } );
		debugMenu.addSlider( physicsTab, 'Speed scale', 1, 30, 0.5, vehicle.debug.speedScale, ( v ) => { vehicle.debug.speedScale = v; } );
		debugMenu.addSlider( physicsTab, 'Velocity blend rate', 1, 20, 0.5, vehicle.debug.velocityBlendRate, ( v ) => { vehicle.debug.velocityBlendRate = v; } );

		debugMenu.addHeader( physicsTab, 'Drift & Boost' );

		debugMenu.addSlider( physicsTab, 'Drift threshold', 0.1, 5.0, 0.1, vehicle.debug.driftThreshold, ( v ) => { vehicle.debug.driftThreshold = v; } );
		debugMenu.addSlider( physicsTab, 'Boost fill time', 5, 60, 1, vehicle.debug.boostFillTime, ( v ) => { vehicle.debug.boostFillTime = v; } );
		debugMenu.addSlider( physicsTab, 'Boost drift multiplier', 1, 15, 0.5, vehicle.debug.boostDriftMultiplier, ( v ) => { vehicle.debug.boostDriftMultiplier = v; } );
		debugMenu.addSlider( physicsTab, 'Boost duration', 1, 15, 0.5, vehicle.debug.boostDuration, ( v ) => { vehicle.debug.boostDuration = v; } );
		debugMenu.addSlider( physicsTab, 'Boost top speed', 100, 500, 10, vehicle.debug.boostTopSpeed, ( v ) => { vehicle.debug.boostTopSpeed = v; } );

		debugMenu.addHeader( physicsTab, 'Body Lean' );

		debugMenu.addSlider( physicsTab, 'Body lean pitch', 1, 20, 0.5, vehicle.debug.bodyLeanPitch, ( v ) => { vehicle.debug.bodyLeanPitch = v; } );
		debugMenu.addSlider( physicsTab, 'Body lean roll', 1, 20, 0.5, vehicle.debug.bodyLeanRoll, ( v ) => { vehicle.debug.bodyLeanRoll = v; } );

		debugMenu.addHeader( physicsTab, 'Suspension' );

		debugMenu.addSlider( physicsTab, 'Susp stiffness', 50, 500, 5, vehicle.debug.suspStiffness, ( v ) => { vehicle.debug.suspStiffness = v; } );
		debugMenu.addSlider( physicsTab, 'Susp damping', 5, 50, 1, vehicle.debug.suspDamping, ( v ) => { vehicle.debug.suspDamping = v; } );
		debugMenu.addSlider( physicsTab, 'Max compress', 0.05, 0.4, 0.01, vehicle.debug.suspMaxCompress, ( v ) => { vehicle.debug.suspMaxCompress = v; } );
		debugMenu.addSlider( physicsTab, 'Max extend', 0.05, 0.5, 0.01, vehicle.debug.suspMaxExtend, ( v ) => { vehicle.debug.suspMaxExtend = v; } );

		debugMenu.addHeader( physicsTab, 'Bump Physics' );

		debugMenu.addSlider( physicsTab, 'Weight', 1, 10, 1, vehicle.weight, ( v ) => { vehicle.weight = v; } );
		debugMenu.addSlider( physicsTab, 'Bump force scale', 0, 3, 0.1, vehicle.debug.bumpForceScale, ( v ) => { vehicle.debug.bumpForceScale = v; } );
		debugMenu.addSlider( physicsTab, 'Bump max force', 0, 30, 0.5, vehicle.debug.bumpMaxForce, ( v ) => { vehicle.debug.bumpMaxForce = v; } );
		debugMenu.addSlider( physicsTab, 'Bump lateral bias', 0, 1, 0.05, vehicle.debug.bumpLateralBias, ( v ) => { vehicle.debug.bumpLateralBias = v; } );
		debugMenu.addSlider( physicsTab, 'Bump cooldown', 0, 2, 0.05, vehicle.debug.bumpCooldown, ( v ) => { vehicle.debug.bumpCooldown = v; } );

		// ── Tab: Lighting ────────────────────────────────────────────────────────
		const lightingTab = debugMenu.addTab( 'lighting', 'Lighting' );

		debugMenu.addHeader( lightingTab, 'Exposure' );

		debugMenu.addSlider( lightingTab, 'Exposure', 0, 3.0, 0.01, renderer.toneMappingExposure, ( v ) => { renderer.toneMappingExposure = v; } );

		debugMenu.addHeader( lightingTab, 'Directional light' );

		debugMenu.addSlider( lightingTab, 'Dir X', - 30, 30, 0.1, dirLightOffset.x, ( v ) => { dirLightOffset.x = v; } );
		debugMenu.addSlider( lightingTab, 'Dir Y', 0, 40, 0.1, dirLightOffset.y, ( v ) => { dirLightOffset.y = v; } );
		debugMenu.addSlider( lightingTab, 'Dir Z', - 30, 30, 0.1, dirLightOffset.z, ( v ) => { dirLightOffset.z = v; } );
		debugMenu.addSlider( lightingTab, 'Dir intensity', 0, 10, 0.1, dirLight.intensity, ( v ) => { dirLight.intensity = v; } );
		debugMenu.addColorPicker( lightingTab, 'Dir color', dirLight.color.getHex(), ( v ) => { dirLight.color.setHex( v ); } );

		debugMenu.addHeader( lightingTab, 'Hemisphere light' );

		debugMenu.addSlider( lightingTab, 'Hemi intensity', 0, 5, 0.05, hemiLight.intensity, ( v ) => { hemiLight.intensity = v; } );
		debugMenu.addColorPicker( lightingTab, 'Sky color', hemiLight.color.getHex(), ( v ) => { hemiLight.color.setHex( v ); } );
		debugMenu.addColorPicker( lightingTab, 'Ground color', hemiLight.groundColor.getHex(), ( v ) => { hemiLight.groundColor.setHex( v ); } );

		debugMenu.addHeader( lightingTab, 'Fog' );

		debugMenu.addSlider( lightingTab, 'Fog near', 0, 200, 1, scene.fog ? scene.fog.near : 30, ( v ) => { if ( scene.fog ) scene.fog.near = v; } );
		debugMenu.addSlider( lightingTab, 'Fog far', 0, 400, 1, scene.fog ? scene.fog.far : 55, ( v ) => { if ( scene.fog ) scene.fog.far = v; } );
		debugMenu.addColorPicker( lightingTab, 'Fog color', scene.fog ? scene.fog.color.getHex() : 0xadb2ba, ( v ) => { if ( scene.fog ) scene.fog.color.setHex( v ); } );

		debugMenu.addHeader( lightingTab, 'Shadows' );

		debugMenu.addCheckbox( lightingTab, 'Shadows enabled', true, ( v ) => { renderer.shadowMap.enabled = v; dirLight.castShadow = v; } );
		debugMenu.addSlider( lightingTab, 'Shadow bias', - 0.01, 0.01, 0.0001, dirLight.shadow.bias, ( v ) => { dirLight.shadow.bias = v; } );
		debugMenu.addSlider( lightingTab, 'Shadow near', 0, 10, 0.1, dirLight.shadow.camera.near, ( v ) => { dirLight.shadow.camera.near = v; dirLight.shadow.camera.updateProjectionMatrix(); } );
		debugMenu.addSlider( lightingTab, 'Shadow far', 10, 200, 1, dirLight.shadow.camera.far, ( v ) => { dirLight.shadow.camera.far = v; dirLight.shadow.camera.updateProjectionMatrix(); } );
		debugMenu.addSlider( lightingTab, 'Shadow darkness', 0, 1.0, 0.01, dirLight.shadow.intensity ?? 1, ( v ) => { dirLight.shadow.intensity = v; } );

		debugMenu.addHeader( lightingTab, 'Headlights' );

		debugMenu.addSlider( lightingTab, 'HL intensity', 0, 20, 0.5, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].intensity : 8, ( v ) => { for ( const hl of vehicle.headlights ) hl.intensity = v; } );
		debugMenu.addSlider( lightingTab, 'HL distance', 1, 100, 1, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].distance : 54, ( v ) => { for ( const hl of vehicle.headlights ) hl.distance = v; } );
		debugMenu.addSlider( lightingTab, 'HL angle', 0.05, 1.57, 0.01, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].angle : Math.PI / 8, ( v ) => { for ( const hl of vehicle.headlights ) hl.angle = v; } );
		debugMenu.addSlider( lightingTab, 'HL penumbra', 0, 1.0, 0.01, vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].penumbra : 0.3, ( v ) => { for ( const hl of vehicle.headlights ) hl.penumbra = v; } );
		debugMenu.addColorPicker( lightingTab, 'HL color', vehicle.headlights[ 0 ] ? vehicle.headlights[ 0 ].color.getHex() : 0xffe0b0, ( v ) => { for ( const hl of vehicle.headlights ) hl.color.setHex( v ); } );

		// ── M key toggle ─────────────────────────────────────────────────────────
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'm' || e.key === 'M' ) {

				e.preventDefault();
				debugMenu.toggle();

			}

		} );

	}

	// ─────────────────────────────────────────────────────────────────────────
	const dirLightTarget = new THREE.Object3D();
	scene.add( dirLightTarget );
	dirLight.target = dirLightTarget;

	buildLightingCache();
	applyLighting( LIGHTING_DAY );
	for ( const hl of vehicle.headlights ) hl.visible = false;

	const cam = new Camera();
	cam.targetPosition.copy( vehicle.vehPos );

	const rearview = new RearviewMirror( renderer );

	// Initialize PostProcessing now that cam is available
	postFX = new PostProcessing( renderer, scene, cam.camera, bloomPass );
	postFX.setDirLight( dirLight );

	const settings = new Settings();
	const controls = new Controls( settings, cam );
	const settingsMenu = new SettingsMenu( settings, controls, audio );
	const speedometer = new Speedometer( settings );

	// ── Debug toggle in hamburger menu ───────────────────────────────────
	{

		const debugSec = settingsMenu._section( 'Developer' );
		debugSec.appendChild( settingsMenu._toggleRowCustom( 'Debug Panel', false, ( v ) => {

			if ( v ) {

				debugMenu.show();
				settingsMenu.close();

			} else {

				debugMenu.hide();

			}

		} ) );
		settingsMenu.addSection( debugSec );

	}

	// ── Rearview mirror toggle in hamburger menu ─────────────────────────
	{

		const rvSec = settingsMenu._section( 'HUD' );
		rvSec.appendChild( settingsMenu._toggleRowCustom( 'Rearview Mirror', true, ( v ) => {

			rearview.setEnabled( v );

		} ) );
		settingsMenu.addSection( rvSec );

	}

	// Apply initial quality preset from settings
	{

		const tier = settings.get( 'quality' );
		const preset = PRESETS[ tier ];
		if ( preset ) {

			postFX.applyPreset( preset );
			dirLight.shadow.mapSize.setScalar( preset.shadowMapSize );
			dirLight.shadow.map = null;
			renderer.shadowMap.needsUpdate = true;
			renderer.setPixelRatio( TIER_PIXEL_RATIO[ tier ] );
			renderer.setSize( window.innerWidth, window.innerHeight );

		}

		// Notify debug label of initial quality
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'quality', value: tier } } ) );

	}

	// ─── Camera toggle button (top-left) ─────────────────────────────────
	const camToggleBtn = document.createElement( 'div' );
	camToggleBtn.style.cssText = 'position:fixed;top:16px;left:16px;z-index:100;width:44px;height:44px;border-radius:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
	camToggleBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
	camToggleBtn.addEventListener( 'pointerup', () => {

		cam.cycleMode();

	} );
	document.body.appendChild( camToggleBtn );

	// ─── Draft debug indicator (to the right of camera icon) ─────────────
	const draftIndicator = document.createElement( 'div' );
	draftIndicator.textContent = 'ACTIVE DRAFT';
	draftIndicator.style.cssText = 'position:fixed;top:24px;left:68px;color:#00ffff;font:bold 14px/1 monospace;text-shadow:0 0 6px rgba(0,255,255,0.6);z-index:100;user-select:none;pointer-events:none;display:none;';
	document.body.appendChild( draftIndicator );
	let draftIndicatorEnabled = false;

	// ─── React to settings changes ───────────────────────────────────────
	window.addEventListener( 'settings-changed', ( e ) => {

		const { key, value } = e.detail;

		if ( key === 'quality' && postFX ) {

			if ( ! PRESETS[ value ] ) return;
			postFX.applyPreset( PRESETS[ value ] );
			dirLight.shadow.mapSize.setScalar( PRESETS[ value ].shadowMapSize );
			dirLight.shadow.map = null;
			renderer.shadowMap.needsUpdate = true;
			renderer.setPixelRatio( TIER_PIXEL_RATIO[ value ] );
			renderer.setSize( window.innerWidth, window.innerHeight );

		}

		if ( key === 'cameraMode' ) {

			cam.mode = value;

		}

		if ( key === 'aiCount' ) {

			aiManager.setCount( value );

		}

		if ( key === 'difficulty' ) {

			aiManager.rubberBandIntensity = value / 100;

		}

		if ( key === 'steeringAssist' ) {

			vehicle.setSteeringAssist( value );

		}

	} );

	audio.init( cam.camera );

	// Apply saved volume settings
	const savedSfxVol = settings.get( 'sfxVolume' );
	if ( savedSfxVol !== undefined ) audio.setSfxVolume( savedSfxVol / 100 );
	const savedMusicVol = settings.get( 'musicVolume' );
	if ( savedMusicVol !== undefined ) audio.setMusicVolume( savedMusicVol / 100 );

	// Apply saved steering assist
	vehicle.setSteeringAssist( !! settings.get( 'steeringAssist' ) );

	let lastImpactTime = 0;
	let wasBoostActive = false;
	let prevDriftStage = 0;

	// ─── Juice particles (local player only) ─────────────────────────────────
	const wallSparks = new WallSparks( scene );
	const boostBurst = new BoostBurst( scene );
	const itemPickupVFX = new ItemPickupVFX( scene );
	const haptics = new Haptics();

	// Wire item pickup feedback
	itemBoxManager.onPickup = ( x, z, powerupType ) => {

		itemPickupVFX.emit( x, z, powerupType );
		audio.playItemPickup();

	};

	// Reusable vectors for bump calculations (avoid per-contact allocation)
	const _bumpFwd = new THREE.Vector3();
	const _bumpRight = new THREE.Vector3();
	const _bumpNormalXZ = new THREE.Vector3();
	const _bumpLateral = new THREE.Vector3();
	const _bumpPushDir = new THREE.Vector3();

	const contactListener = {
		onContactAdded( bodyA, bodyB, manifold ) {

			const wn = manifold && manifold.worldSpaceNormal;
			if ( ! wn ) return;

			// Skip ground-like contacts (normal mostly vertical)
			if ( Math.abs( wn[ 1 ] ) > 0.5 ) return;

			const vehicleA = bodyToVehicle.get( bodyA );
			const vehicleB = bodyToVehicle.get( bodyB );
			const bothVehicles = !! vehicleA && !! vehicleB;

			// ── Vehicle-vs-Vehicle bump ──────────────────────────────────────
			if ( bothVehicles ) {

				const now = performance.now() / 1000;
				const cd = vehicle.debug.bumpCooldown;
				if ( now - vehicleA.lastBumpTime < cd && now - vehicleB.lastBumpTime < cd ) return;

				const svA = vehicleA.vehVel;
				const svB = vehicleB.vehVel;
				const speedA = Math.sqrt( svA.x * svA.x + svA.z * svA.z );
				const speedB = Math.sqrt( svB.x * svB.x + svB.z * svB.z );

				if ( Math.max( speedA, speedB ) < vehicle.debug.bumpMinSpeed ) return;

				// Aggressor = faster vehicle
				const attacker = speedA >= speedB ? vehicleA : vehicleB;
				const defender = speedA >= speedB ? vehicleB : vehicleA;
				const attackSpeed = Math.max( speedA, speedB );

				// Star: defender is immune
				if ( defender.starActive ) return;

				// Shield: absorb one bump
				if ( defender.shieldActive ) {

					defender.shieldActive = false;
					defender.shieldTimer = 0;
					if ( defender === vehicle ) audio.playShieldBreak();
					vehicleA.lastBumpTime = now;
					vehicleB.lastBumpTime = now;
					return;

				}

				// Push magnitude: (attackerSpeed * attackerWeight) / defenderWeight
				let pushMag = ( attackSpeed * attacker.weight ) / defender.weight;
				pushMag *= vehicle.debug.bumpForceScale;

				// Speed ramp: weaker bumps at low speed
				pushMag *= Math.min( attackSpeed / 15, 1.0 );

				// Star attacker gets 2x force
				if ( attacker.starActive ) pushMag *= 2.0;

				// Clamp
				pushMag = Math.min( pushMag, vehicle.debug.bumpMaxForce );

				// Direction: blend contact normal with defender's lateral axis
				_bumpFwd.set( 0, 0, 1 ).applyQuaternion( defender.container.quaternion );
				_bumpFwd.y = 0;
				_bumpFwd.normalize();
				_bumpRight.set( - _bumpFwd.z, 0, _bumpFwd.x );

				// Contact normal in XZ, pointing from attacker toward defender
				const nSign = ( attacker === vehicleA ) ? 1 : - 1;
				_bumpNormalXZ.set( wn[ 0 ] * nSign, 0, wn[ 2 ] * nSign ).normalize();

				// Modulate lateral bias by hit angle: side hits = more lateral
				const headOnDot = Math.abs( _bumpNormalXZ.dot( _bumpFwd ) );
				const lateralBias = vehicle.debug.bumpLateralBias * ( 1 - headOnDot * 0.5 );

				_bumpLateral.copy( _bumpRight ).multiplyScalar( Math.sign( _bumpRight.dot( _bumpNormalXZ ) ) );
				_bumpPushDir.copy( _bumpNormalXZ ).lerp( _bumpLateral, lateralBias ).normalize();

				// Inject bump as a smooth velocity overlay (decays over ~0.15s in Vehicle.update)
				defender._bumpVel.x += _bumpPushDir.x * pushMag;
				defender._bumpVel.z += _bumpPushDir.z * pushMag;

				// Counter-push on attacker (Newton's 3rd, scaled by weight ratio)
				const counterScale = defender.weight / attacker.weight * 0.3;
				attacker._bumpVel.x -= _bumpPushDir.x * pushMag * counterScale;
				attacker._bumpVel.z -= _bumpPushDir.z * pushMag * counterScale;

				vehicleA.lastBumpTime = now;
				vehicleB.lastBumpTime = now;

				// Suppress vertical launch after bump — keep both karts grounded
				defender._wallHitTime = now;
				defender._verticalVelocity = 0;

				// VFX/audio for local player
				if ( vehicleA === vehicle || vehicleB === vehicle ) {

					const isDefender = ( defender === vehicle );
					const severity = pushMag / vehicle.debug.bumpMaxForce;

					audio.playImpact( pushMag );
					cam.applyShake(
						_bumpPushDir.x, _bumpPushDir.z,
						pushMag * ( isDefender ? 1.0 : 0.4 )
					);

					const posA = vehicleA.container.position;
					const posB = vehicleB.container.position;
					wallSparks.emit(
						{ x: ( posA.x + posB.x ) / 2, y: posA.y, z: ( posA.z + posB.z ) / 2 },
						_bumpPushDir.x, _bumpPushDir.z, pushMag
					);
					haptics.impulse( severity * 0.6 );

				}

				return;

			}

			// ── Vehicle-vs-Wall (local player only) ─────────────────────────
			if ( ! vehicle.rigidBody ) return;
			if ( bodyA !== vehicle.rigidBody && bodyB !== vehicle.rigidBody ) return;

			// Star: ignore all wall impacts
			if ( vehicle.starActive ) return;

			// Shield: absorb one wall hit
			if ( vehicle.shieldActive ) {

				vehicle.shieldActive = false;
				vehicle.shieldTimer = 0;
				audio.playShieldBreak();
				return;

			}

			const sv = vehicle.vehVel;
			const speed = Math.sqrt( sv.x * sv.x + sv.z * sv.z );
			if ( speed < 1.5 ) return;

			// Cooldown
			const now = performance.now() / 1000;
			if ( now - lastImpactTime < 0.3 ) return;
			lastImpactTime = now;

			// ── Wall normal ──────────────────────────────────────────────────
			const normalSign = ( bodyA === vehicle.rigidBody ) ? - 1 : 1;
			const nx = wn[ 0 ] * normalSign;
			const nz = wn[ 2 ] * normalSign;

			// Let crashcat's collision solver handle the wall bounce naturally.
			// Scale damping by impact angle: glancing ~15% loss, head-on ~55% loss.
			const dot = Math.abs( nx * sv.x + nz * sv.z ) / ( speed || 1 );
			const dampFactor = THREE.MathUtils.lerp( 0.85, 0.45, dot );
			vehicle.linearSpeed *= dampFactor;
			vehicle._wallHitTime = now;
			vehicle._verticalVelocity = 0;
			audio.playImpact( speed );

			// ── Feedback ─────────────────────────────────────────────────────
			cam.applyShake( nx, nz, speed );
			wallSparks.emit( vehicle.container.position, nx, nz, speed );
			haptics.impulse( speed / 10 );

		}
	};

	const timer = new THREE.Timer();

	// ─── FPS DISPLAY ─────────────────────────────────────────────────────────
	const fpsDisplay = document.createElement( 'div' );
	fpsDisplay.style.cssText = [
		'position:fixed', 'top:68px', 'left:16px',
		'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
		'padding:4px 10px', 'border-radius:6px', 'z-index:999', 'user-select:none',
	].join( ';' );
	document.body.appendChild( fpsDisplay );

	// Jitter debug overlay
	const jitterDisplay = document.createElement( 'div' );
	jitterDisplay.style.cssText = [
		'position:fixed', 'top:100px', 'left:16px',
		'background:rgba(0,0,0,0.72)', 'color:#ff0', 'font:11px/1.4 monospace',
		'padding:4px 10px', 'border-radius:6px', 'z-index:999', 'user-select:none',
		'display:none', 'white-space:pre',
	].join( ';' );
	document.body.appendChild( jitterDisplay );

	let fpsFrames = 0;
	let fpsTime = performance.now();
	let gamePaused = false;
	const allActiveVehicles = [];
	const bodyToVehicle = new Map();
	const draftingSystem = new DraftingSystem();
	const draftLines = new DraftLines( scene );

	document.addEventListener( 'keydown', ( e ) => {

		if ( e.code === 'KeyP' ) {

			gamePaused = ! gamePaused;
			console.log( '%c[PAUSE] ' + ( gamePaused ? 'PAUSED' : 'RESUMED' ), 'color: cyan; font-weight: bold' );

		}


	} );

	// Debug: ground plane visualizer — shows raycast ground height as a green disc
	const groundIndicator = new THREE.Mesh(
		new THREE.CircleGeometry( 1.5, 16 ),
		new THREE.MeshBasicMaterial( { color: 0x00ff00, transparent: true, opacity: 0.4, side: THREE.DoubleSide } )
	);
	groundIndicator.rotation.x = - Math.PI / 2;
	groundIndicator.visible = false;
	scene.add( groundIndicator );

	// Frame rate cap (0 = uncapped)
	let fpsCapMs = 0;
	let lastFrameTime = 0;

	function animate() {

		requestAnimationFrame( animate );

		// Optional FPS cap
		if ( fpsCapMs > 0 ) {

			const nowCap = performance.now();
			if ( nowCap - lastFrameTime < fpsCapMs ) return;
			lastFrameTime = nowCap;

		}

		fpsFrames ++;
		const now = performance.now();
		if ( now - fpsTime >= 500 ) {

			fpsDisplay.textContent = ( fpsFrames / ( ( now - fpsTime ) / 1000 ) ).toFixed( 0 ) + ' FPS' + ( gamePaused ? ' (PAUSED)' : '' );
			fpsFrames = 0;
			fpsTime = now;

		}

		timer.update();
		const dt = Math.min( timer.getDelta(), 1 / 30 );

		if ( gamePaused ) {

			renderer.render( scene, cam.camera );
			return;

		}

		const rawInput = controls.update();
		const input = raceMode.filterInput( rawInput );

		// Rebuild body→vehicle lookup for contact listener
		bodyToVehicle.clear();
		for ( const v of playerManager.getActiveVehicles() ) {

			if ( v.vehicle.rigidBody ) bodyToVehicle.set( v.vehicle.rigidBody, v.vehicle );

		}

		for ( const v of aiManager.getActiveVehicles() ) {

			if ( v.vehicle.rigidBody ) bodyToVehicle.set( v.vehicle.rigidBody, v.vehicle );

		}

		updateWorld( world, contactListener, dt );

		playerManager.update( dt, spectating ? { x: 0, z: 0, touchActive: false, boost: false, gas: false, brake: false } : input );

		aiManager.update( dt, vehicle, raceMode.state, raceMode.lap );

		// ─── Item box pickups ─────────────────────────────────────────────────
		if ( ! spectating ) itemBoxManager.update( dt, vehicle );

		// ─── Boost activation feedback ───────────────────────────────────────
		if ( ! spectating && vehicle ) {

			const boostJustActivated = vehicle.boostActive && ! wasBoostActive;
			const boostJustEnded = ! vehicle.boostActive && wasBoostActive;

			if ( boostJustActivated ) {

				if ( ! window.isMobile ) vehicle.underglowLight.visible = true;
				vehicle.underglowLight.color.setHex( 0xff8800 );
				audio.playBoostWhoosh();

				_boostFwd.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
				boostBurst.emit( vehicle.container.position, _boostFwd.x, _boostFwd.z );

			}

			if ( boostJustEnded ) {

				vehicle.underglowLight.visible = false;
				vehicle.underglowLight.color.setHex( 0x00ffff );

			}

			wasBoostActive = vehicle.boostActive;

			// Drift stage transition haptic pulse
			if ( vehicle.driftStage !== prevDriftStage && vehicle.driftStage > prevDriftStage ) {

				haptics.pulse();

			}

			prevDriftStage = vehicle.driftStage;

		}

		// ─── Juice updates ───────────────────────────────────────────────────
		haptics.update( dt );
		if ( ! spectating && vehicle ) haptics.setRumble( Math.abs( vehicle.linearSpeed ) );
		wallSparks.update( dt );
		boostBurst.update( dt );
		itemPickupVFX.update( dt );

		allActiveVehicles.length = 0;
		for ( const v of playerManager.getActiveVehicles() ) allActiveVehicles.push( v );
		for ( const v of aiManager.getActiveVehicles() ) allActiveVehicles.push( v );

		// Drafting detection and VFX
		draftingSystem.update( dt, allActiveVehicles );
		draftLines.update( dt, draftingSystem.getActiveDrafts(), draftingSystem.getProximityLeads() );

		raceMode.update( dt, vehicle, allActiveVehicles, aiManager.getAIRaceData() );

		if ( raceMode.state === 'idle' ) {

			raceLobby.update( dt, playerManager.players, playerManager.localId );

		}

		if ( ! spectating ) {

			afkDetector.update( dt, vehicle );

		}

		hud.update( dt, raceMode.getDisplayState(), raceLobby.getDisplayState() );
		speedometer.update( dt, vehicle.linearSpeed, vehicle.momentum, vehicle.boostActive, vehicle.effectiveTopSpeed, vehicle.debug.topSpeed );
		minimap.update( allActiveVehicles, raceMode.getDisplayState().state );

		// Send local state to server (throttled internally at 20Hz)
		if ( multiplayer && network.connected && ! spectating ) {

			const state = playerManager.getLocalState();
			if ( state ) network.sendState( state );

		}

		// ─── DEBUG updates (desktop only) ─────────────────────────────────────
		if ( debugCollider && vehicle ) {

			const colliderY = ( vehicle._vehicleY || 0 ) + 0.8;
			debugCollider.position.set( vehicle.vehPos.x, colliderY, vehicle.vehPos.z );
			const yaw = Math.atan2(
				2 * ( vehicle.container.quaternion.w * vehicle.container.quaternion.y ),
				1 - 2 * ( vehicle.container.quaternion.y * vehicle.container.quaternion.y )
			);
			debugCollider.rotation.set( 0, yaw, 0 );
			for ( const wd of wheelDebug ) wd.boxH.update();

		}
		// ───────────────────────────────────────────────────────────────────────

		// Follow local vehicle or spectator target
		const followVehicle = spectating ? cam.spectatorTarget : vehicle;

		if ( followVehicle ) {

			const vehPos = followVehicle.vehPos;
			const dsx = vehPos.x - lastShadowX;
			const dsz = vehPos.z - lastShadowZ;
			if ( dsx * dsx + dsz * dsz > 0.25 ) {

				dirLight.position.set(
					vehPos.x + dirLightOffset.x,
					dirLightOffset.y,
					vehPos.z + dirLightOffset.z
				);
				dirLightTarget.position.set( vehPos.x, 0, vehPos.z );
				lastShadowX = vehPos.x;
				lastShadowZ = vehPos.z;

			}

			cam.update( dt, followVehicle.vehPos, followVehicle.container.quaternion, {
				inputX: followVehicle.inputX,
				linearSpeed: followVehicle.linearSpeed,
				boostActive: followVehicle.boostActive,
				bodyLeanRoll: followVehicle.debug.bodyLeanRoll,
				driftActive: followVehicle.driftActive,
				driftDirection: followVehicle.driftDirection,
			} );

			// Rearview mirror: update + render to texture (skip in isometric or if user disabled)
			if ( rearview.enabled && cam.mode !== 'isometric' ) {

				rearview.setVisible( true );
				rearview.update( followVehicle.vehPos, followVehicle.container.quaternion );

				// Disable post-processing effects for the mirror render to avoid
				// corrupting bloom state and viewport for the main camera render
				renderer.setEffects( [] );
				rearview.render( scene );
				if ( postFX ) postFX.rebuildEffects();

			} else {

				rearview.setVisible( false );

			}

		}

		audio.update( dt, vehicle ? vehicle.linearSpeed : 0, input.z, vehicle ? vehicle.driftIntensity : 0 );

		// Draft wind audio — get player's draft intensity
		if ( vehicle ) {

			const playerDraft = draftingSystem.getActiveDrafts().get( vehicle );
			audio.updateDraft( playerDraft ? playerDraft.intensity : 0 );

			// Draft debug indicator — only shows when actively boosting speed
			if ( draftIndicatorEnabled ) {

				if ( vehicle.draftSpeedMultiplier > 1.0 ) {

					const pct = ( ( vehicle.draftSpeedMultiplier - 1.0 ) * 100 ).toFixed( 0 );
					draftIndicator.textContent = 'ACTIVE DRAFT +' + pct + '%';
					draftIndicator.style.display = 'block';

				} else {

					draftIndicator.style.display = 'none';

				}

			}

		}

		// Update dynamic post-processing effects
		if ( postFX ) {

			const followV = spectating ? cam.spectatorTarget : vehicle;
			postFX.update( dt, cam.getVelocity(), followV ? followV.boostActive : false );

		}

		// Update ground plane indicator — shows where raycasts think ground is
		if ( groundIndicator.visible && vehicle ) {

			groundIndicator.position.set(
				vehicle.container.position.x,
				vehicle.groundHeight,
				vehicle.container.position.z
			);

		}

		// Update jitter diagnostic overlay
		if ( jitterDisplay.style.display !== 'none' && vehicle && vehicle.debugJitterInfo ) {

			const j = vehicle.debugJitterInfo;
			const spike = j.lastSpike;
			const pos = vehicle.container.position;
			jitterDisplay.textContent =
				`pos:      ${ pos.x.toFixed( 2 ) }, ${ pos.y.toFixed( 2 ) }, ${ pos.z.toFixed( 2 ) }\n` +
				`vehY:     ${ vehicle._vehicleY.toFixed( 4 ) }  Δ${ j.lastDelta >= 0 ? '+' : '' }${ j.lastDelta.toFixed( 4 ) }\n` +
				`gndH:     ${ vehicle.groundHeight.toFixed( 4 ) }\n` +
				`rawAvg:   ${ j.rawAvg.toFixed( 4 ) }\n` +
				`grounded: ${ vehicle._grounded }\n` +
				`spikes:   ${ j.spikeCount }/20\n` +
				( spike ? `last:     Δ${ spike.delta >= 0 ? '+' : '' }${ spike.delta.toFixed( 4 ) } spd=${ spike.speed.toFixed( 2 ) } gnd=${ spike.grounded }` : '' );

		}

		renderer.render( scene, cam.camera );

	}

	// ─── Spectate button ─────────────────────────────────────────────────────
	if ( spectateBtn ) {

		spectateBtn.addEventListener( 'click', () => {

			if ( ! multiplayer ) return;

			spectating = ! spectating;
			spectateBtn.textContent = spectating ? 'Race' : 'Spectate';
			network.sendSpectate( spectating );

			playerManager.setSpectating( playerManager.localId, spectating );

			if ( spectating ) {

				cam.spectatorTarget = playerManager.getFirstActiveVehicle();

			} else {

				cam.spectatorTarget = null;
				afkDetector.reset();

			}

		} );

	}

	animate();

}

init().catch( ( e ) => console.error( 'Init failed:', e ) );