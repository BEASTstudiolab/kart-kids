import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
	createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer,
	enableCollision, registerAll, updateWorld,
	rigidBody, box, MotionType,
	castRay, createClosestCastRayCollector, createDefaultCastRaySettings, CastRayStatus, filter
} from 'crashcat';
import { buildSingleTileCollider, createVehicleBody } from './Physics.js';
import { Vehicle } from './Vehicle.js';
import { getTrackAsphaltMode, applyTrackAsphaltMode } from './TrackAsphaltMode.js';

// ── Tile manifest (same as TileTester) ─────────────────────────────────────

const TILE_FILES = [
	'kartkids_base_trk_010_rd_straight_1x1',
	'kartkids_base_trk_020_trn_90_l_1x1',
	'kartkids_base_trk_020_trn_90_r_1x1',
	'kartkids_base_trk_040_trn_180_l_2x2',
	'kartkids_base_trk_080_trn_wide_l_2x2',
	'kartkids_base_trk_090_trn_wide_r_2x2',
	'kartkids_base_trk_100_trn_widest_l_3x3',
	'kartkids_base_trk_110_trn_widest_r_3x3',
	'kartkids_base_trk_120_chn_scurve_l_2x1',
	'kartkids_base_trk_130_chn_scurve_r_2x1',
	'kartkids_base_trk_140_jct_ysplit_3x3',
	'kartkids_base_trk_150_jct_tjunction_3x3',
	'kartkids_base_trk_160_jct_4way_3x3',
	'kartkids_base_trk_170_elv_flat_1x1_z2p5',
	'kartkids_base_trk_180_elv_flat_1x1_z5',
	'kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5',
	'kartkids_base_trk_200_rmp_up_1x1_z0_to_z5',
	'kartkids_base_trk_210_rmp_down_1x1_z2p5_to_z0',
	'kartkids_base_trk_220_rmp_down_1x1_z5_to_z0',
	'kartkids_base_trk_230_rmp_transition_flat_to_up_1x1_z2p5',
	'kartkids_base_trk_240_rmp_transition_up_to_flat_1x1_z2p5',
	'kartkids_base_trk_250_rmp_transition_flat_to_down_1x1_z2p5',
	'kartkids_base_trk_260_rmp_transition_down_to_flat_1x1_z2p5',
	'kartkids_base_trk_270_rmp_transition_flat_to_up_1x1_z5',
	'kartkids_base_trk_280_rmp_transition_up_to_flat_1x1_z5',
	'kartkids_base_trk_290_rmp_transition_flat_to_down_1x1_z5',
	'kartkids_base_trk_300_rmp_transition_down_to_flat_1x1_z5',
	'kartkids_base_trk_390_brg_entry_1x1',
	'kartkids_base_trk_400_brg_mid_1x1',
	'kartkids_base_trk_410_brg_exit_1x1',
	'kartkids_base_trk_420_tun_closed_entry_1x1',
	'kartkids_base_trk_430_tun_closed_mid_1x1',
	'kartkids_base_trk_440_tun_closed_exit_1x1',
	'kartkids_base_trk_460_tun_openframe_mid_1x1',
	'kartkids_base_trk_480_jmp_01_short_25pct_1x1',
	'kartkids_base_trk_490_jmp_02_mid_50pct_railed_1x1',
	'kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1',
	'kartkids_base_trk_510_srt_startfinish_arch_3x1',
	'kartkids_base_trk_510_trn_90_r_3x3',
	'kartkids_base_trk_520_trn_90_l_3x3',
	'kartkids_base_trk_530_trn_90_l_4x4',
	'kartkids_base_trk_530_trn_90_r_4x4',
	'3x3_s_turn_chicane',
	'3x3_turn',
	'4x4_turn',
	'6x6_turn',
];

const CELL_RAW = 10.0;

// Grid positions for 3 tiles in a row along X-axis (vehicle drives forward along +X)
const SLOT_POSITIONS = [
	{ x: 0.5 * CELL_RAW, z: 0.5 * CELL_RAW },
	{ x: 1.5 * CELL_RAW, z: 0.5 * CELL_RAW },
	{ x: 2.5 * CELL_RAW, z: 0.5 * CELL_RAW },
];

// ── Renderer & Scene ───────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x1a1a2e );

const dirLight = new THREE.DirectionalLight( 0xffffff, 2 );
dirLight.position.set( 10, 20, 15 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.set( 2048, 2048 );
dirLight.shadow.camera.left = - 40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = - 40;
scene.add( dirLight );
scene.add( new THREE.AmbientLight( 0x404060, 1.5 ) );

const gridHelper = new THREE.GridHelper( 60, 60, 0x444466, 0x333355 );
gridHelper.position.set( SLOT_POSITIONS[ 1 ].x, - 0.01, SLOT_POSITIONS[ 1 ].z );
scene.add( gridHelper );


const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 200 );
camera.position.set( SLOT_POSITIONS[ 1 ].x, 15, SLOT_POSITIONS[ 1 ].z + 20 );

const orbitControls = new OrbitControls( camera, renderer.domElement );
orbitControls.target.set( SLOT_POSITIONS[ 1 ].x, 1, SLOT_POSITIONS[ 1 ].z );
orbitControls.update();

window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

} );

// ── State ──────────────────────────────────────────────────────────────────

const loader = new GLTFLoader();
const asphaltMode = getTrackAsphaltMode( globalThis.location?.search ?? '' );
let vehicleModel = null;
let vehicle = null;
let world = null;
let paused = false;

const timer = new THREE.Timer();

// 3 slots — each has a tile index and scene reference
const slots = [
	{ tileIndex: 0, scene: null },
	{ tileIndex: 0, scene: null },
	{ tileIndex: 0, scene: null },
];
let activeSlot = 0;

// Input state
const keys = {};
const keyJustPressed = {};
window.addEventListener( 'keydown', ( e ) => {

	if ( ! keys[ e.code ] ) keyJustPressed[ e.code ] = true;
	keys[ e.code ] = true;

} );
window.addEventListener( 'keyup', ( e ) => { keys[ e.code ] = false; } );

// HUD elements
const slotElements = [
	document.getElementById( 'slot-0' ),
	document.getElementById( 'slot-1' ),
	document.getElementById( 'slot-2' ),
];

// ── Physics world ──────────────────────────────────────────────────────────

function createPhysicsWorld() {

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];

	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );

	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );

	const w = createWorld( worldSettings );
	w._OL_MOVING = OL_MOVING;
	w._OL_STATIC = OL_STATIC;

	rigidBody.create( w, {
		shape: box.create( { halfExtents: [ 50, 0.01, 50 ] } ),
		motionType: MotionType.STATIC,
		objectLayer: OL_STATIC,
		position: [ 0, - 20, 0 ],
		friction: 5.0,
		restitution: 0.0,
	} );

	return w;

}

// ── Find spawn height via raycast ──────────────────────────────────────────

function findSurfaceY( w, x, z ) {

	const collector = createClosestCastRayCollector();
	const settings = createDefaultCastRaySettings();
	const rayFilter = filter.forWorld( w );

	const LOW_Y = 3.0;
	const LOW_RAY = 10.0;
	castRay( w, collector, settings, [ x, LOW_Y, z ], [ 0, - 1, 0 ], LOW_RAY, rayFilter );

	if ( collector.hit.status === CastRayStatus.COLLIDING ) {

		return LOW_Y - collector.hit.fraction * LOW_RAY;

	}

	collector.hit.status = CastRayStatus.NOT_COLLIDING;
	collector.hit.fraction = 1;
	collector.earlyOutFraction = 1;

	castRay( w, collector, settings, [ x, 30, z ], [ 0, - 1, 0 ], 60, rayFilter );

	if ( collector.hit.status === CastRayStatus.COLLIDING ) {

		return 30 - collector.hit.fraction * 60;

	}

	return 1.0;

}

// ── Load a single tile GLB ─────────────────────────────────────────────────

async function loadTileGLB( tileName ) {

	const gltf = await new Promise( ( resolve, reject ) => {

		loader.load( `models/standard-map/${ tileName }.glb`, resolve, undefined, reject );

	} );

	gltf.scene.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.material.side = THREE.FrontSide;
			applyTrackAsphaltMode( child.material, { asphaltMode } );
			child.receiveShadow = true;
			child.castShadow = false;

		}

	} );

	return gltf.scene;

}

// ── Load/rebuild the full 3-tile track ─────────────────────────────────────

async function loadTrack() {

	// Remove old tiles from scene
	for ( const slot of slots ) {

		if ( slot.scene ) {

			scene.remove( slot.scene );
			slot.scene = null;

		}

	}

	// Recreate physics world
	world = createPhysicsWorld();

	// Load and position each slot
	for ( let i = 0; i < 3; i ++ ) {

		const tileName = TILE_FILES[ slots[ i ].tileIndex ];
		const tileScene = await loadTileGLB( tileName );

		tileScene.position.set( SLOT_POSITIONS[ i ].x, 0, SLOT_POSITIONS[ i ].z );
		scene.add( tileScene );
		slots[ i ].scene = tileScene;

		// Build collider (uses matrixWorld so position is accounted for)
		tileScene.updateMatrixWorld( true );
		buildSingleTileCollider( world, tileScene );

	}

	updateHUD();
	spawnVehicle();

}

// ── Reload a single slot ───────────────────────────────────────────────────

async function reloadSlot( slotIndex ) {

	// Remove old tile scene
	if ( slots[ slotIndex ].scene ) {

		scene.remove( slots[ slotIndex ].scene );

	}

	// Recreate physics world (clear all colliders)
	world = createPhysicsWorld();

	// Load new tile for this slot
	const tileName = TILE_FILES[ slots[ slotIndex ].tileIndex ];
	const tileScene = await loadTileGLB( tileName );
	tileScene.position.set( SLOT_POSITIONS[ slotIndex ].x, 0, SLOT_POSITIONS[ slotIndex ].z );
	scene.add( tileScene );
	slots[ slotIndex ].scene = tileScene;

	// Rebuild colliders for ALL slots (physics world was recreated)
	for ( let i = 0; i < 3; i ++ ) {

		if ( slots[ i ].scene ) {

			slots[ i ].scene.updateMatrixWorld( true );
			buildSingleTileCollider( world, slots[ i ].scene );

		}

	}

	updateHUD();
	spawnVehicle();

}

// ── HUD ────────────────────────────────────────────────────────────────────

function updateHUD() {

	for ( let i = 0; i < 3; i ++ ) {

		const name = TILE_FILES[ slots[ i ].tileIndex ];
		const shortName = name.replace( 'kartkids_base_trk_', '' );
		const prefix = i === activeSlot ? '> ' : '  ';
		slotElements[ i ].textContent = `${ prefix }${ i + 1 }: ${ shortName }`;
		slotElements[ i ].className = i === activeSlot ? 'slot active' : 'slot';

	}

}

// ── Spawn vehicle on tile 1 ────────────────────────────────────────────────

function spawnVehicle() {

	if ( vehicle ) {

		scene.remove( vehicle.container );

	}

	const spawnX = SLOT_POSITIONS[ 0 ].x;
	const spawnZ = SLOT_POSITIONS[ 0 ].z;
	const surfaceY = findSurfaceY( world, spawnX, spawnZ );
	const spawnY = surfaceY + 2.0;

	vehicle = Vehicle.spawn( {
		world,
		createBody: createVehicleBody,
		model: vehicleModel,
		position: [ spawnX, spawnY, spawnZ ],
		angle: 0,
	} );

	scene.add( vehicle.container );

}

// ── Input ──────────────────────────────────────────────────────────────────

function getInput() {

	let x = 0, z = 0;

	if ( keys.KeyA || keys.ArrowLeft ) x = - 1;
	if ( keys.KeyD || keys.ArrowRight ) x = 1;
	if ( keys.KeyW || keys.ArrowUp ) z = 1;
	if ( keys.KeyS || keys.ArrowDown ) z = - 1;

	const brake = keys.Space ? 1 : 0;

	return { x, z, touchActive: false, boost: false, gas: z > 0, brake: brake > 0 };

}

// ── Slot cycling ───────────────────────────────────────────────────────────

let bracketCooldown = 0;

function handleSlotControls( dt ) {

	bracketCooldown = Math.max( 0, bracketCooldown - dt );
	if ( bracketCooldown > 0 ) return;

	if ( keys.BracketLeft ) {

		slots[ activeSlot ].tileIndex = ( slots[ activeSlot ].tileIndex - 1 + TILE_FILES.length ) % TILE_FILES.length;
		reloadSlot( activeSlot );
		bracketCooldown = 0.3;

	} else if ( keys.BracketRight ) {

		slots[ activeSlot ].tileIndex = ( slots[ activeSlot ].tileIndex + 1 ) % TILE_FILES.length;
		reloadSlot( activeSlot );
		bracketCooldown = 0.3;

	}

	if ( keys.KeyR ) {

		spawnVehicle();
		bracketCooldown = 0.3;

	}

}

// ── Game loop ──────────────────────────────────────────────────────────────

function animate() {

	requestAnimationFrame( animate );

	timer.update();
	const dt = Math.min( timer.getDelta(), 1 / 30 );

	if ( keyJustPressed.KeyP ) paused = ! paused;

	if ( keyJustPressed.KeyQ ) {

		activeSlot = ( activeSlot + 1 ) % 3;
		updateHUD();

	}

	if ( keyJustPressed.KeyH ) {

		const hud = document.getElementById( 'hud' );
		const dbg = document.getElementById( 'debug-overlay' );
		if ( hud ) hud.style.display = hud.style.display === 'none' ? 'block' : 'none';
		if ( dbg ) dbg.style.display = dbg.style.display === 'none' ? 'block' : 'none';

	}

	// Clear just-pressed flags (must happen after all checks above)
	for ( const key in keyJustPressed ) delete keyJustPressed[ key ];

	if ( paused ) {

		handleSlotControls( dt );
		renderer.render( scene, camera );
		return;

	}

	handleSlotControls( dt );

	if ( world && vehicle ) {

		const input = getInput();
		vehicle.inputX = input.x;
		vehicle.inputZ = input.z;

		updateWorld( world, null, dt );
		vehicle.update( dt, input );

		// Debug overlay
		const dbg = document.getElementById( 'debug-overlay' );
		if ( dbg && dbg.style.display !== 'none' ) {

			const wY = vehicle._wheelContactY;
			const n = vehicle.groundNormal;

			dbg.textContent =
				`groundHeight:  ${ vehicle.groundHeight.toFixed( 3 ) }\n` +
				`vehicleY:      ${ vehicle._vehicleY.toFixed( 3 ) }\n` +
				`vertVelocity:  ${ vehicle._verticalVelocity.toFixed( 3 ) }\n` +
				`grounded:      ${ vehicle._grounded }\n` +
				`wheelContact:  FL=${ wY[ 0 ].toFixed( 2 ) } FR=${ wY[ 1 ].toFixed( 2 ) } BL=${ wY[ 2 ].toFixed( 2 ) } BR=${ wY[ 3 ].toFixed( 2 ) }\n` +
				`normal:        (${ n.x.toFixed( 2 ) }, ${ n.y.toFixed( 2 ) }, ${ n.z.toFixed( 2 ) })\n` +
				`linearSpeed:   ${ vehicle.linearSpeed.toFixed( 3 ) }`;

		}

		orbitControls.target.lerp( vehicle.container.position, 0.1 );
		orbitControls.update();

	}

	renderer.render( scene, camera );

}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {

	registerAll();

	// Load vehicle model
	const gltf = await new Promise( ( resolve, reject ) => {

		loader.load( 'models/vehicle-truck-yellow.glb', resolve, undefined, reject );

	} );

	gltf.scene.traverse( ( child ) => {

		if ( child.isMesh ) child.material.side = THREE.FrontSide;

	} );

	gltf.scene.scale.setScalar( 0.5 );
	vehicleModel = gltf.scene;

	// Default: 3 straight tiles
	slots[ 0 ].tileIndex = 0;
	slots[ 1 ].tileIndex = 0;
	slots[ 2 ].tileIndex = 0;

	await loadTrack();

	animate();

}

init();
