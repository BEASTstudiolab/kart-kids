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

// ── Tile manifest ──────────────────────────────────────────────────────────

const TILE_FILES = [
	'kartkids_base_trk_010_rd_straight_1x1.gltf',
	'kartkids_base_trk_020_trn_90_l_1x1.gltf',
	'kartkids_base_trk_080_trn_wide_l_2x2.gltf',
	'kartkids_base_trk_100_trn_widest_l_3x3.gltf',
	'kartkids_base_trk_140_jct_ysplit_3x3.gltf',
	'kartkids_base_trk_150_jct_tjunction_3x3.gltf',
	'kartkids_base_trk_160_jct_4way_3x3.gltf',
	'kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf',
	'kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf',
	'kartkids_base_trk_230_rmp_transition_flat_to_up_1x1_z2p5.gltf',
	'kartkids_base_trk_250_rmp_transition_flat_to_down_1x1_z2p5.glb',
	'kartkids_base_trk_260_rmp_transition_down_to_flat_1x1_z2p5.glb',
	'kartkids_base_trk_270_rmp_transition_flat_to_up_1x1_z5.gltf',
	'kartkids_base_trk_290_rmp_transition_flat_to_down_1x1_z5.glb',
	'kartkids_base_trk_300_rmp_transition_down_to_flat_1x1_z5.glb',
	'kartkids_base_trk_390_brg_entry_1x1.gltf',
	'kartkids_base_trk_400_brg_mid_1x1.gltf',
	'kartkids_base_trk_420_tun_closed_entry_1x1.gltf',
	'kartkids_base_trk_430_tun_closed_mid_1x1.gltf',
	'kartkids_base_trk_440_tun_closed_exit_1x1.gltf',
	'kartkids_base_trk_460_tun_openframe_mid_1x1.gltf',
	'kartkids_base_trk_480_jmp_01_short_25pct_1x1.gltf',
	'kartkids_base_trk_490_jmp_02_mid_50pct_railed_1x1.gltf',
	'kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1.gltf',
	'kartkids_base_trk_510_srt_startfinish_arch_3x1.gltf',
	'kartkids_base_trk_520_trn_90_l_3x3.gltf',
	'kartkids_base_trk_530_trn_90_l_4x4.glb',
	'3x3_s_turn_chicane.glb',
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

// Lighting
const dirLight = new THREE.DirectionalLight( 0xffffff, 2 );
dirLight.position.set( 10, 20, 10 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.set( 2048, 2048 );
dirLight.shadow.camera.left = - 30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = - 30;
scene.add( dirLight );
scene.add( new THREE.AmbientLight( 0x404060, 1.5 ) );

// Grid helper for reference
const gridHelper = new THREE.GridHelper( 40, 40, 0x444466, 0x333355 );
gridHelper.position.y = - 0.01;
scene.add( gridHelper );

// Camera with orbit controls
const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 200 );
camera.position.set( 12, 10, 12 );

const orbitControls = new OrbitControls( camera, renderer.domElement );
orbitControls.target.set( 0, 1, 0 );
orbitControls.update();

window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

} );

// ── State ──────────────────────────────────────────────────────────────────

const loader = new GLTFLoader();
const asphaltMode = getTrackAsphaltMode( globalThis.location?.search ?? '' );
let currentTileIndex = 0;
let currentTileGroup = null;
let vehicleModel = null;
let vehicle = null;
let world = null;
let paused = false;

// ── Auto-test state ────────────────────────────────────────────────────────

let autoTest = null;  // { phase, timer, log[] }
let jumpTest = null;  // Jump-specific multi-tile test
let wallScrapeTest = null;

// ── Jump tile auto-test ────────────────────────────────────────────────────

const JUMP_TILE_INDICES = [ 34, 35, 36 ];  // tiles 35-37 (0-based)

function startJumpTest() {

	jumpTest = {
		tileQueue: [ ...JUMP_TILE_INDICES ],
		currentTile: null,
		phase: 'loading',   // 'loading', 'accelerating', 'climbing', 'airborne', 'landing', 'done'
		timer: 0,
		wasGrounded: true,
		launchSource: 'none',
		trickType: null,
		trickCompleted: null,
		landingSeverity: null,
		rewardGranted: false,
		launchSpeed: 0,
		launchVertVel: 0,
		launchY: 0,
		peakY: 0,
		airTime: 0,
		landingVertVel: 0,
		normalAtLaunch: '',
		normalAtLanding: '',
		results: [],
	};

	console.log( '%c[JUMP-TEST] ═══ Starting jump test on 3 tiles ═══', 'color: magenta; font-weight: bold' );
	loadNextJumpTile();

}

function loadNextJumpTile() {

	if ( jumpTest.tileQueue.length === 0 ) {

		printJumpTestResults();
		jumpTest = null;
		return;

	}

	const idx = jumpTest.tileQueue.shift();
	jumpTest.currentTile = idx;
	jumpTest.phase = 'loading';
	jumpTest.timer = 0;
	jumpTest.wasGrounded = true;
	jumpTest.launchSource = 'none';
	jumpTest.trickType = null;
	jumpTest.trickCompleted = null;
	jumpTest.landingSeverity = null;
	jumpTest.rewardGranted = false;
	jumpTest.peakY = 0;
	jumpTest.airTime = 0;
	currentTileIndex = idx;
	loadTile( idx ).then( () => {

		jumpTest.phase = 'accelerating';
		console.log( `%c[JUMP-TEST] Loaded: ${ TILE_FILES[ idx ] }`, 'color: magenta' );

	} );

}

function updateJumpTest( dt ) {

	if ( ! jumpTest || ! vehicle || jumpTest.phase === 'loading' ) return null;

	jumpTest.timer += dt;
	const t = jumpTest.timer;
	const grounded = vehicle._grounded;
	const n = vehicle.groundNormal;

	// Log state every 0.25s
	const logInterval = Math.floor( t * 4 ) !== Math.floor( ( t - dt ) * 4 );
	if ( logInterval && t > 0.3 ) {

		const state = grounded ? 'GND' : 'AIR';
		console.log(
			`[JUMP-TEST] t=${ t.toFixed( 2 ) }s [${ state }] ` +
			`vehY=${ vehicle._vehicleY.toFixed( 2 ) } vertV=${ vehicle._verticalVelocity.toFixed( 2 ) } ` +
			`speed=${ vehicle.linearSpeed.toFixed( 3 ) } ` +
			`normal=(${ n.x.toFixed( 2 ) },${ n.y.toFixed( 2 ) },${ n.z.toFixed( 2 ) })`
		);

	}

	// Detect launch: was grounded, now airborne (ignore spawn drop — require speed > 0.1)
	if ( jumpTest.wasGrounded && ! grounded && Math.abs( vehicle.linearSpeed ) > 0.1 ) {

		jumpTest.phase = 'airborne';
		jumpTest.launchSpeed = vehicle.linearSpeed;
		jumpTest.launchVertVel = vehicle._verticalVelocity;
		jumpTest.launchY = vehicle._vehicleY;
		jumpTest.peakY = vehicle._vehicleY;
		jumpTest.airTime = 0;
		jumpTest.launchSource = vehicle._airborne?.launchSource || 'none';
		jumpTest.trickType = vehicle.trickState?.currentTrick || vehicle.trickState?.completedTrick || null;
		jumpTest.normalAtLaunch = `(${ n.x.toFixed( 2 ) },${ n.y.toFixed( 2 ) },${ n.z.toFixed( 2 ) })`;
		console.log(
			`%c[JUMP-TEST] LAUNCH! source=${ jumpTest.launchSource } vertVel=${ jumpTest.launchVertVel.toFixed( 2 ) } ` +
			`speed=${ jumpTest.launchSpeed.toFixed( 3 ) } Y=${ jumpTest.launchY.toFixed( 2 ) } trick=${ jumpTest.trickType || 'none' }`,
			'color: #0ff'
		);

	}

	// Track airborne state
	if ( ! grounded ) {

		jumpTest.airTime += dt;
		if ( vehicle._vehicleY > jumpTest.peakY ) jumpTest.peakY = vehicle._vehicleY;

	}

	// Detect landing: was airborne, now grounded
	if ( ! jumpTest.wasGrounded && grounded && jumpTest.phase === 'airborne' ) {

		jumpTest.phase = 'landing';
		jumpTest.landingVertVel = vehicle._verticalVelocity;
		jumpTest.landingSeverity = vehicle._airborne?.lastSeverity || null;
		jumpTest.trickCompleted = vehicle._lastTrickResult?.type || null;
		jumpTest.rewardGranted = !! vehicle._lastTrickResult?.rewardGranted;
		jumpTest.normalAtLanding = `(${ n.x.toFixed( 2 ) },${ n.y.toFixed( 2 ) },${ n.z.toFixed( 2 ) })`;

		console.log(
			`%c[JUMP-TEST] LANDED! airTime=${ jumpTest.airTime.toFixed( 2 ) }s ` +
			`peakY=${ jumpTest.peakY.toFixed( 2 ) } landVertVel=${ jumpTest.landingVertVel.toFixed( 2 ) } ` +
			`severity=${ jumpTest.landingSeverity || 'unknown' } reward=${ jumpTest.rewardGranted ? 'yes' : 'no' }`,
			'color: #0f0'
		);

		jumpTest.results.push( {
			tile: TILE_FILES[ jumpTest.currentTile ],
			launchSource: jumpTest.launchSource,
			trickType: jumpTest.trickType,
			trickCompleted: jumpTest.trickCompleted,
			launchSpeed: jumpTest.launchSpeed,
			launchVertVel: jumpTest.launchVertVel,
			launchY: jumpTest.launchY,
			peakY: jumpTest.peakY,
			airTime: jumpTest.airTime,
			landingVertVel: jumpTest.landingVertVel,
			landingSeverity: jumpTest.landingSeverity,
			rewardGranted: jumpTest.rewardGranted,
			normalAtLaunch: jumpTest.normalAtLaunch,
			normalAtLanding: jumpTest.normalAtLanding,
		} );

		// Wait 1s then load next tile
		setTimeout( () => loadNextJumpTile(), 1000 );

	}

	// Timeout: if no launch after 6s or no landing after 10s
	if ( t > 10 ) {

		console.log( '%c[JUMP-TEST] Timeout on tile — skipping', 'color: #f44' );
		jumpTest.results.push( { tile: TILE_FILES[ jumpTest.currentTile ], error: 'TIMEOUT' } );
		loadNextJumpTile();

	}

	jumpTest.wasGrounded = grounded;

	// Always accelerate forward
	return { x: 0, z: 1, touchActive: false, boost: false, gas: true, brake: false };

}

function printJumpTestResults() {

	console.log( '%c[JUMP-TEST] ═══ Results ═══', 'color: magenta; font-weight: bold' );

	for ( const r of jumpTest.results ) {

		if ( r.error ) {

			console.log( `  ${ r.tile }: %c${ r.error }`, 'color: #f44' );
			continue;

		}

		const launchOK = r.launchVertVel > 0.5;
		const airOK = r.airTime > 0.3;
		const landOK = Math.abs( r.landingVertVel ) < 15;

		console.log(
			`  ${ r.tile }:\n` +
			`    Launch: source=${ r.launchSource || 'none' } trick=${ r.trickType || 'none' } vertVel=${ r.launchVertVel.toFixed( 2 ) } speed=${ r.launchSpeed.toFixed( 3 ) } Y=${ r.launchY.toFixed( 2 ) } normal=${ r.normalAtLaunch } ${ launchOK ? '✓' : '✗ (no upward momentum)' }\n` +
			`    Flight: airTime=${ r.airTime.toFixed( 2 ) }s peakY=${ r.peakY.toFixed( 2 ) } ${ airOK ? '✓' : '✗ (too short)' }\n` +
			`    Landing: severity=${ r.landingSeverity || 'unknown' } trickDone=${ r.trickCompleted || 'none' } reward=${ r.rewardGranted ? 'yes' : 'no' } vertVel=${ r.landingVertVel.toFixed( 2 ) } normal=${ r.normalAtLanding } ${ landOK ? '✓' : '✗ (too hard)' }`
		);

	}

}

function placeVehicleForWallScrape( config ) {

	if ( ! vehicle || ! vehicle.rigidBody ) return;

	const surfaceY = findSurfaceY( world, config.x, config.z );
	const yaw = config.yaw;
	const halfYaw = yaw / 2;
	const colliderLift = vehicle._lastColliderLift ?? 0.8;

	rigidBody.setPosition( world, vehicle.rigidBody, [ config.x, surfaceY + colliderLift, config.z ], false );
	rigidBody.setQuaternion( world, vehicle.rigidBody, [ 0, Math.sin( halfYaw ), 0, Math.cos( halfYaw ) ], false );
	rigidBody.setLinearVelocity( world, vehicle.rigidBody, [ 0, 0, 0 ] );
	rigidBody.setAngularVelocity( world, vehicle.rigidBody, [ 0, 0, 0 ] );

	vehicle.vehPos.set( config.x, surfaceY, config.z );
	vehicle.vehVel.set( 0, 0, 0 );
	vehicle.groundHeight = surfaceY;
	vehicle._prevGroundHeight = surfaceY;
	vehicle._vehicleY = surfaceY;
	vehicle._smoothVehicleY = surfaceY;
	vehicle._verticalVelocity = 0;
	vehicle._grounded = true;
	vehicle._airborneTimer = 0;
	vehicle._launchCooldown = 0;
	vehicle.linearSpeed = 0;
	vehicle.acceleration = 0;
	vehicle.angularSpeed = 0;
	vehicle._wallHitTime = 0;
	vehicle._bumpVel.set( 0, 0, 0 );
	vehicle.container.position.set( config.x, surfaceY, config.z );
	vehicle.container.quaternion.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), yaw );

}

function startWallScrapeTest() {

	spawnVehicle();

	const scenarios = [
		{
			label: 'negative-z wall',
			x: - 3.4,
			z: - 3.25,
			yaw: Math.PI / 2 + 0.12,
		},
		{
			label: 'positive-z wall',
			x: - 3.4,
			z: 3.25,
			yaw: Math.PI / 2 - 0.12,
		},
	];

	wallScrapeTest = {
		scenarios,
		index: 0,
		phase: 'settle',
		timer: 0,
		settleTime: 0.45,
		driveTime: 2.4,
		results: [],
		peakLift: 0,
		maxWallProximity: 0,
		escaped: false,
	};

	placeVehicleForWallScrape( scenarios[ 0 ] );
	console.log( '%c[WALL-SCRAPE] ═══ Starting wall scrape test ═══', 'color: #ff9f1c; font-weight: bold' );
	console.log( `%c[WALL-SCRAPE] Scenario 1: ${ scenarios[ 0 ].label }`, 'color: #ff9f1c' );

}

function finalizeWallScrapeScenario() {

	const scenario = wallScrapeTest.scenarios[ wallScrapeTest.index ];

	wallScrapeTest.results.push( {
		label: scenario.label,
		peakLift: wallScrapeTest.peakLift,
		maxWallProximity: wallScrapeTest.maxWallProximity,
		escaped: wallScrapeTest.escaped,
	} );

	wallScrapeTest.index ++;

	if ( wallScrapeTest.index >= wallScrapeTest.scenarios.length ) {

		console.log( '%c[WALL-SCRAPE] ═══ Results ═══', 'color: #ff9f1c; font-weight: bold' );

		for ( const result of wallScrapeTest.results ) {

			const passed = result.maxWallProximity > 0.5 && result.peakLift < 0.35 && ! result.escaped;
			console.log(
				`  ${ result.label }: peakLift=${ result.peakLift.toFixed( 3 ) } ` +
				`wallProximity=${ result.maxWallProximity.toFixed( 3 ) } escaped=${ result.escaped } ` +
				`${ passed ? '✓' : '✗' }`
			);

		}

		wallScrapeTest = null;
		return;

	}

	const nextScenario = wallScrapeTest.scenarios[ wallScrapeTest.index ];
	wallScrapeTest.phase = 'settle';
	wallScrapeTest.timer = 0;
	wallScrapeTest.peakLift = 0;
	wallScrapeTest.maxWallProximity = 0;
	wallScrapeTest.escaped = false;
	placeVehicleForWallScrape( nextScenario );
	console.log( `%c[WALL-SCRAPE] Scenario ${ wallScrapeTest.index + 1 }: ${ nextScenario.label }`, 'color: #ff9f1c' );

}

function updateWallScrapeTest( dt ) {

	if ( ! wallScrapeTest || ! vehicle ) return null;

	wallScrapeTest.timer += dt;
	const currentScenario = wallScrapeTest.scenarios[ wallScrapeTest.index ];
	const lift = Math.max( 0, vehicle._vehicleY - vehicle.groundHeight );

	wallScrapeTest.peakLift = Math.max( wallScrapeTest.peakLift, lift );
	wallScrapeTest.maxWallProximity = Math.max( wallScrapeTest.maxWallProximity, vehicle._wallProximityAny || 0 );
	if ( Math.abs( vehicle.vehPos.z ) > 5.4 ) wallScrapeTest.escaped = true;

	if ( wallScrapeTest.phase === 'settle' && wallScrapeTest.timer >= wallScrapeTest.settleTime ) {

		wallScrapeTest.phase = 'drive';
		wallScrapeTest.timer = 0;

	}

	if ( wallScrapeTest.phase === 'drive' ) {

		if ( wallScrapeTest.timer >= wallScrapeTest.driveTime ) {

			finalizeWallScrapeScenario();
			return { x: 0, z: 0, touchActive: false, boost: false, gas: false, brake: false };

		}

		const logInterval = Math.floor( wallScrapeTest.timer * 4 ) !== Math.floor( ( wallScrapeTest.timer - dt ) * 4 );

		if ( logInterval ) {

			console.log(
				`[WALL-SCRAPE] ${ currentScenario.label } ` +
				`t=${ wallScrapeTest.timer.toFixed( 2 ) }s ` +
				`lift=${ lift.toFixed( 3 ) } ` +
				`wall=${ ( vehicle._wallProximityAny || 0 ).toFixed( 3 ) } ` +
				`pos=(${ vehicle.vehPos.x.toFixed( 2 ) }, ${ vehicle.vehPos.z.toFixed( 2 ) })`
			);

		}

		return { x: 0, z: 1, touchActive: false, boost: false, gas: true, brake: false };

	}

	return { x: 0, z: 0, touchActive: false, boost: false, gas: false, brake: false };

}

// ── Jitter diagnostic test ──────────────────────────────────────────────────

let jitterTest = null;

function startJitterTest() {

	spawnVehicle();
	jitterTest = {
		timer: 0,
		duration: 5.0,
		prevVehY: null,
		prevGndH: null,
		prevBodyY: null,
		spikes: [],
		maxVehDelta: 0,
		maxGndDelta: 0,
		maxBodyDelta: 0,
		frameCount: 0,
	};
	console.log( '%c[JITTER-TEST] Started — driving forward for 5s, logging Y spikes > 0.01', 'color: orange; font-weight: bold' );

}

function updateJitterTest( dt ) {

	if ( ! jitterTest || ! vehicle ) return null;

	jitterTest.timer += dt;
	jitterTest.frameCount ++;

	const vehY = vehicle._vehicleY;
	const gndH = vehicle.groundHeight;
	const bodyY = vehicle.bodyNode ? vehicle.bodyNode.position.y : 0;

	if ( jitterTest.prevVehY !== null ) {

		const vDelta = Math.abs( vehY - jitterTest.prevVehY );
		const gDelta = Math.abs( gndH - jitterTest.prevGndH );
		const bDelta = Math.abs( bodyY - jitterTest.prevBodyY );

		if ( vDelta > jitterTest.maxVehDelta ) jitterTest.maxVehDelta = vDelta;
		if ( gDelta > jitterTest.maxGndDelta ) jitterTest.maxGndDelta = gDelta;
		if ( bDelta > jitterTest.maxBodyDelta ) jitterTest.maxBodyDelta = bDelta;

		// Log any frame with delta > 0.01 units
		if ( vDelta > 0.01 || gDelta > 0.01 || bDelta > 0.01 ) {

			const spike = {
				t: jitterTest.timer,
				vehY: vehY.toFixed( 4 ),
				vDelta: vDelta.toFixed( 4 ),
				gndH: gndH.toFixed( 4 ),
				gDelta: gDelta.toFixed( 4 ),
				bodyY: bodyY.toFixed( 4 ),
				bDelta: bDelta.toFixed( 4 ),
				grounded: vehicle._grounded,
				speed: vehicle.linearSpeed.toFixed( 3 ),
				dt: ( dt * 1000 ).toFixed( 1 ),
			};

			jitterTest.spikes.push( spike );

			console.log(
				`%c[JITTER] t=${ spike.t.toFixed( 2 ) }s ` +
				`vehY=${ spike.vehY } Δ${ spike.vDelta } | ` +
				`gndH=${ spike.gndH } Δ${ spike.gDelta } | ` +
				`bodyY=${ spike.bodyY } Δ${ spike.bDelta } | ` +
				`gnd=${ spike.grounded } spd=${ spike.speed } dt=${ spike.dt }ms`,
				vDelta > 0.05 ? 'color: red' : 'color: orange'
			);

		}

	}

	jitterTest.prevVehY = vehY;
	jitterTest.prevGndH = gndH;
	jitterTest.prevBodyY = bodyY;

	// End test
	if ( jitterTest.timer >= jitterTest.duration ) {

		console.log( '%c[JITTER-TEST] ═══ Results ═══', 'color: orange; font-weight: bold' );
		console.log( `  Frames:       ${ jitterTest.frameCount }` );
		console.log( `  Spikes:       ${ jitterTest.spikes.length } (frames with Δ > 0.01)` );
		console.log( `  Max vehicleY: Δ${ jitterTest.maxVehDelta.toFixed( 4 ) }` );
		console.log( `  Max groundH:  Δ${ jitterTest.maxGndDelta.toFixed( 4 ) }` );
		console.log( `  Max bodyY:    Δ${ jitterTest.maxBodyDelta.toFixed( 4 ) }` );

		if ( jitterTest.spikes.length === 0 ) {

			console.log( '%c  ✓ PASS — no jitter detected', 'color: #0f0; font-weight: bold' );

		} else {

			// Categorize: which value is the source?
			let vehSource = 0, gndSource = 0, bodySource = 0;
			for ( const s of jitterTest.spikes ) {

				if ( parseFloat( s.vDelta ) > 0.01 ) vehSource ++;
				if ( parseFloat( s.gDelta ) > 0.01 ) gndSource ++;
				if ( parseFloat( s.bDelta ) > 0.01 ) bodySource ++;

			}

			console.log( `  Source breakdown: vehicleY=${ vehSource } groundH=${ gndSource } bodyY=${ bodySource }` );

			if ( gndSource > vehSource && gndSource > bodySource ) {

				console.log( '%c  → Root cause: groundHeight noise (raw raycast centroid)', 'color: #ff0' );

			} else if ( vehSource > bodySource ) {

				console.log( '%c  → Root cause: _vehicleY tracking (grounded spring or gravity)', 'color: #ff0' );

			} else {

				console.log( '%c  → Root cause: bodyNode.y (updateBody lerp)', 'color: #ff0' );

			}

		}

		jitterTest = null;
		return { x: 0, z: 0, touchActive: false, boost: false, gas: false, brake: false };

	}

	// Drive forward during test
	return { x: 0, z: 1, touchActive: false, boost: false, gas: true, brake: false };

}

function startAutoTest() {

	spawnVehicle();
	autoTest = {
		phase: 'forward',    // 'forward', 'pause', 'reverse', 'done'
		timer: 0,
		maxTime: 4.0,        // seconds per phase
		pauseTime: 1.0,
		log: [],
		worstClip: { value: 0, time: 0, phase: '', wheel: '' },
		worstFloat: { value: 0, time: 0, phase: '', wheel: '' },
	};
	console.log( '%c[AUTO-TEST] Started on: ' + TILE_FILES[ currentTileIndex ], 'color: cyan; font-weight: bold' );

}

function updateAutoTest( dt ) {

	if ( ! autoTest || ! vehicle ) return null;

	autoTest.timer += dt;
	const t = autoTest.timer;

	// Phase transitions
	if ( autoTest.phase === 'forward' && t > autoTest.maxTime ) {

		autoTest.phase = 'pause';
		autoTest.timer = 0;
		console.log( '%c[AUTO-TEST] Forward phase done, pausing...', 'color: yellow' );

	} else if ( autoTest.phase === 'pause' && t > autoTest.pauseTime ) {

		autoTest.phase = 'reverse';
		autoTest.timer = 0;
		console.log( '%c[AUTO-TEST] Reversing...', 'color: yellow' );

	} else if ( autoTest.phase === 'reverse' && t > autoTest.maxTime ) {

		autoTest.phase = 'done';
		printAutoTestResults();
		autoTest = null;
		return { x: 0, z: 0, touchActive: false, boost: false, gas: false, brake: false };

	}

	// Generate input
	let z = 0;
	if ( autoTest.phase === 'forward' ) z = 1;
	if ( autoTest.phase === 'reverse' ) z = - 1;

	// Sample every frame (past 0.5s settle) — log detailed state periodically
	if ( t > 0.5 ) {

		const n = vehicle.groundNormal;
		const wheelNames = [ 'FL', 'FR', 'BL', 'BR' ];
		const rawY = vehicle._wheelRawHitY;
		const missed = vehicle._wheelMissedFrames;

		// Log detailed state every 0.5s
		const logInterval = Math.floor( t * 2 ) !== Math.floor( ( t - dt ) * 2 );
		if ( logInterval ) {

			const hitInfo = wheelNames.map( ( name, i ) =>
				`${ name }=${ rawY[ i ].toFixed( 2 ) }${ missed[ i ] > 0 ? '(miss)' : '' }`
			).join( ' ' );

			console.log(
				`[AUTO-TEST] t=${ t.toFixed( 1 ) }s phase=${ autoTest.phase } ` +
				`gndH=${ vehicle.groundHeight.toFixed( 2 ) } vehY=${ vehicle._vehicleY.toFixed( 2 ) } ` +
				`rawHits: ${ hitInfo } ` +
				`normal=(${ n.x.toFixed( 2 ) },${ n.y.toFixed( 2 ) },${ n.z.toFixed( 2 ) })`
			);

		}

		// Track worst deviations using raw hits vs raw centroid plane
		const rawCentroidY = ( rawY[ 0 ] + rawY[ 1 ] + rawY[ 2 ] + rawY[ 3 ] ) / 4;
		const tn = vehicle._targetNormal;

		for ( let i = 0; i < 4; i ++ ) {

			if ( missed[ i ] > 0 ) continue;

			const localOff = vehicle._wheelOffsets[ i ];
			const wOff = localOff.clone().applyQuaternion( vehicle.container.quaternion );
			const expectedY = rawCentroidY - ( tn.x * wOff.x + tn.z * wOff.z ) / ( tn.y || 1 );
			const dev = rawY[ i ] - expectedY;

			if ( dev < autoTest.worstClip.value ) {

				autoTest.worstClip = { value: dev, time: t, phase: autoTest.phase, wheel: wheelNames[ i ] };

			}

			if ( dev > autoTest.worstFloat.value ) {

				autoTest.worstFloat = { value: dev, time: t, phase: autoTest.phase, wheel: wheelNames[ i ] };

			}

		}

		autoTest.sampleCount = ( autoTest.sampleCount || 0 ) + 1;

	}

	return { x: 0, z, touchActive: false, boost: false, gas: z > 0, brake: false };

}

function printAutoTestResults() {

	const clip = autoTest.worstClip;
	const float = autoTest.worstFloat;

	console.log( '%c[AUTO-TEST] ═══ Results ═══', 'color: cyan; font-weight: bold' );
	console.log( `  Samples:     ${ autoTest.sampleCount || 0 } (only while all 4 wheels grounded, after 0.5s settle)` );
	console.log( `  Worst CLIP:  ${ clip.value.toFixed( 4 ) }  wheel=${ clip.wheel || 'none' }  phase=${ clip.phase || '-' }  t=${ clip.time.toFixed( 2 ) }s` );
	console.log( `  Worst FLOAT: ${ float.value.toFixed( 4 ) }  wheel=${ float.wheel || 'none' }  phase=${ float.phase || '-' }  t=${ float.time.toFixed( 2 ) }s` );

	if ( Math.abs( clip.value ) < 0.05 && Math.abs( float.value ) < 0.05 ) {

		console.log( '%c  ✓ PASS — deviation within ±0.05 tolerance', 'color: #0f0; font-weight: bold' );

	} else {

		console.log( '%c  ✗ FAIL — deviation exceeds ±0.05 tolerance', 'color: #f44; font-weight: bold' );

	}

}

const timer = new THREE.Timer();

// Input state
const keys = {};
const keyJustPressed = {};
window.addEventListener( 'keydown', ( e ) => {

	if ( ! keys[ e.code ] ) keyJustPressed[ e.code ] = true;
	keys[ e.code ] = true;

} );
window.addEventListener( 'keyup', ( e ) => { keys[ e.code ] = false; } );

// ── Debug bounds visualization ─────────────────────────────────────────────

const debugBoundsMat = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );
const debugTireMats = [
	new THREE.MeshBasicMaterial( { color: 0xff4444, wireframe: true } ), // FL red
	new THREE.MeshBasicMaterial( { color: 0x44ff44, wireframe: true } ), // FR green
	new THREE.MeshBasicMaterial( { color: 0x4444ff, wireframe: true } ), // BL blue
	new THREE.MeshBasicMaterial( { color: 0xffff44, wireframe: true } ), // BR yellow
];

let bodyBoundsVisible = false;
let tireBoundsVisible = [ false, false, false, false ];
let bodyBoundsMesh = null;
let tireBoundsMeshes = [ null, null, null, null ];

// Vehicle box collider: halfExtents [0.4, 0.3, 0.7] from Physics.js
const BODY_HALF = [ 0.4, 0.3, 0.7 ];
const TIRE_RADIUS = 0.18;

function createBoundsVisuals() {

	// Body bounds
	const bodyGeo = new THREE.BoxGeometry( BODY_HALF[ 0 ] * 2, BODY_HALF[ 1 ] * 2, BODY_HALF[ 2 ] * 2 );
	bodyBoundsMesh = new THREE.Mesh( bodyGeo, debugBoundsMat );
	bodyBoundsMesh.visible = bodyBoundsVisible;

	// Tire bounds (one per wheel)
	const tireGeo = new THREE.SphereGeometry( TIRE_RADIUS, 8, 6 );
	for ( let i = 0; i < 4; i ++ ) {

		tireBoundsMeshes[ i ] = new THREE.Mesh( tireGeo, debugTireMats[ i ] );
		tireBoundsMeshes[ i ].visible = tireBoundsVisible[ i ];

	}

}

function attachBoundsToVehicle() {

	if ( ! vehicle ) return;

	// Body bounds attach to the vehicle container
	vehicle.container.add( bodyBoundsMesh );
	bodyBoundsMesh.position.set( 0, BODY_HALF[ 1 ] + vehicle.debug.rideHeight, 0 );

	// Tire bounds as siblings in the scene, updated each frame to match wheel world positions
	const wheelNodes = [ vehicle.wheelFL, vehicle.wheelFR, vehicle.wheelBL, vehicle.wheelBR ];
	for ( let i = 0; i < 4; i ++ ) {

		if ( wheelNodes[ i ] ) {

			scene.add( tireBoundsMeshes[ i ] );

		}

	}

}

function handleBoundsToggles() {

	if ( keyJustPressed.KeyB ) {

		bodyBoundsVisible = ! bodyBoundsVisible;
		if ( bodyBoundsMesh ) bodyBoundsMesh.visible = bodyBoundsVisible;

	}

	if ( keyJustPressed.KeyT ) {

		const allOn = tireBoundsVisible.every( v => v );
		const newState = ! allOn;
		for ( let i = 0; i < 4; i ++ ) {

			tireBoundsVisible[ i ] = newState;
			if ( tireBoundsMeshes[ i ] ) tireBoundsMeshes[ i ].visible = newState;

		}

	}

	// 1-4 toggle individual tires
	const tireKeys = [ 'Digit1', 'Digit2', 'Digit3', 'Digit4' ];
	for ( let i = 0; i < 4; i ++ ) {

		if ( keyJustPressed[ tireKeys[ i ] ] ) {

			tireBoundsVisible[ i ] = ! tireBoundsVisible[ i ];
			if ( tireBoundsMeshes[ i ] ) tireBoundsMeshes[ i ].visible = tireBoundsVisible[ i ];

		}

	}

	// Clear all just-pressed flags
	for ( const key in keyJustPressed ) delete keyJustPressed[ key ];

}

// HUD elements
const hudIndex = document.getElementById( 'tile-index' );
const hudName = document.getElementById( 'tile-name' );

// ── Physics world creation ─────────────────────────────────────────────────

function createPhysicsWorld() {

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];

	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );
	const OL_TRACK_SUPPORT = addObjectLayer( worldSettings, BPL_STATIC );
	const OL_TRACK_BLOCKER = addObjectLayer( worldSettings, BPL_STATIC );

	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_TRACK_BLOCKER );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );

	const w = createWorld( worldSettings );
	w._OL_MOVING = OL_MOVING;
	w._OL_STATIC = OL_STATIC;
	w._OL_TRACK_SUPPORT = OL_TRACK_SUPPORT;
	w._OL_TRACK_BLOCKER = OL_TRACK_BLOCKER;

	// Safety-net ground far below
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

	// First try a low-origin ray (inside tunnels/bridges — finds floor, not roof)
	const LOW_Y = 3.0;
	const LOW_RAY = 10.0;
	castRay( w, collector, settings, [ x, LOW_Y, z ], [ 0, - 1, 0 ], LOW_RAY, rayFilter );

	if ( collector.hit.status === CastRayStatus.COLLIDING ) {

		return LOW_Y - collector.hit.fraction * LOW_RAY;

	}

	// Fallback: high ray for open tiles (ramps, elevated flats)
	collector.hit.status = CastRayStatus.NOT_COLLIDING;
	collector.hit.fraction = 1;
	collector.earlyOutFraction = 1;

	castRay( w, collector, settings, [ x, 30, z ], [ 0, - 1, 0 ], 60, rayFilter );

	if ( collector.hit.status === CastRayStatus.COLLIDING ) {

		return 30 - collector.hit.fraction * 60;

	}

	return 1.0;

}

// ── Load a tile by index ───────────────────────────────────────────────────

async function loadTile( index ) {

	// Remove old tile
	if ( currentTileGroup ) {

		scene.remove( currentTileGroup );
		currentTileGroup = null;

	}

	// Recreate physics world (cleanest way to clear old colliders)
	world = createPhysicsWorld();

	const tileName = TILE_FILES[ index ];
	hudIndex.textContent = `${ index + 1 } / ${ TILE_FILES.length }`;
	hudName.textContent = tileName;

	const gltf = await new Promise( ( resolve, reject ) => {

		loader.load( `models/standard-map/${ tileName }`, resolve, undefined, reject );

	} );

	const tileScene = gltf.scene;
	tileScene.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.material.side = THREE.FrontSide;
			applyTrackAsphaltMode( child.material, { asphaltMode } );
			child.receiveShadow = true;
			child.castShadow = false;

		}

	} );

	currentTileGroup = tileScene;
	scene.add( tileScene );

	// Build collider from the tile geometry
	buildSingleTileCollider( world, tileScene );

	// Spawn vehicle on the tile surface
	spawnVehicle();

}

// ── Spawn / respawn vehicle ────────────────────────────────────────────────

function spawnVehicle() {

	// Remove old vehicle from scene
	if ( vehicle ) {

		scene.remove( vehicle.container );

	}

	// Tunnel tiles: spawn near origin, skip raycast (would hit roof)
	const tileName = TILE_FILES[ currentTileIndex ];
	const isTunnel = tileName.includes( '_tun_' );

	let spawnY;
	if ( isTunnel ) {

		spawnY = 1.5; // inside tunnel, above floor

	} else {

		const surfaceY = findSurfaceY( world, 0, 0 );
		spawnY = surfaceY + 2.0; // drop from height so suspension responds

	}

	vehicle = Vehicle.spawn( {
		world,
		createBody: createVehicleBody,
		model: vehicleModel,
		position: [ 0, spawnY, 0 ],
		angle: Math.PI / 2,
	} );

	scene.add( vehicle.container );
	attachBoundsToVehicle();

}

// ── Input → Vehicle ────────────────────────────────────────────────────────

function getInput() {

	let x = 0, z = 0;

	if ( keys.KeyA || keys.ArrowLeft ) x = - 1;
	if ( keys.KeyD || keys.ArrowRight ) x = 1;
	if ( keys.KeyW || keys.ArrowUp ) z = 1;
	if ( keys.KeyS || keys.ArrowDown ) z = - 1;

	const brake = keys.Space ? 1 : 0;

	return { x, z, touchActive: false, boost: false, gas: z > 0, brake: brake > 0 };

}

// ── Tile cycling via [ ] keys ──────────────────────────────────────────────

let bracketCooldown = 0;

function handleTileCycling( dt ) {

	bracketCooldown = Math.max( 0, bracketCooldown - dt );
	if ( bracketCooldown > 0 ) return;

	if ( keys.BracketLeft ) {

		currentTileIndex = ( currentTileIndex - 1 + TILE_FILES.length ) % TILE_FILES.length;
		loadTile( currentTileIndex );
		bracketCooldown = 0.3;

	} else if ( keys.BracketRight ) {

		currentTileIndex = ( currentTileIndex + 1 ) % TILE_FILES.length;
		loadTile( currentTileIndex );
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
	if ( keyJustPressed.KeyG && ! autoTest && ! jumpTest && ! jitterTest && ! wallScrapeTest ) startAutoTest();
	if ( keyJustPressed.KeyJ && ! jumpTest && ! autoTest && ! jitterTest && ! wallScrapeTest ) startJumpTest();
	if ( keyJustPressed.KeyF && ! jitterTest && ! autoTest && ! jumpTest && ! wallScrapeTest ) startJitterTest();
	if ( keyJustPressed.KeyK && ! wallScrapeTest && ! autoTest && ! jumpTest && ! jitterTest ) startWallScrapeTest();

	if ( keyJustPressed.KeyH ) {

		const hud = document.getElementById( 'hud' );
		const dbg = document.getElementById( 'debug-overlay' );
		if ( hud ) hud.style.display = hud.style.display === 'none' ? 'block' : 'none';
		if ( dbg ) dbg.style.display = dbg.style.display === 'none' ? 'block' : 'none';

	}

	handleBoundsToggles();

	if ( paused ) {

		handleTileCycling( dt );
		renderer.render( scene, camera );
		return;

	}

	handleTileCycling( dt );

	if ( world && vehicle ) {

		const jitterInput = updateJitterTest( dt );
		const jumpInput = jitterInput || updateJumpTest( dt );
		const autoInput = jumpInput || updateAutoTest( dt );
		const scrapeInput = autoInput || updateWallScrapeTest( dt );
		const input = scrapeInput || getInput();
		vehicle.inputX = input.x;
		vehicle.inputZ = input.z;

		updateWorld( world, null, dt );
		vehicle.update( dt, input );

		// Sync tire bounds to wheel world positions each frame
		const wNodes = [ vehicle.wheelFL, vehicle.wheelFR, vehicle.wheelBL, vehicle.wheelBR ];
		for ( let i = 0; i < 4; i ++ ) {

			if ( wNodes[ i ] && tireBoundsMeshes[ i ] ) {

				wNodes[ i ].getWorldPosition( tireBoundsMeshes[ i ].position );

			}

		}

		// +/- to adjust body height live
		if ( keyJustPressed.Equal || keyJustPressed.NumpadAdd ) {

			vehicle.debug.bodyHeight += 0.05;

		}

		if ( keyJustPressed.Minus || keyJustPressed.NumpadSubtract ) {

			vehicle.debug.bodyHeight -= 0.05;

		}

		// Live debug overlay
		const dbg = document.getElementById( 'debug-overlay' );
		if ( dbg ) {

			const wY = vehicle._wheelContactY;
			const bNode = vehicle.bodyNode;
			const n = vehicle.groundNormal;

			// Compute per-wheel suspension deviations for display
			const devLabels = [ 'FL', 'FR', 'BL', 'BR' ];
			let devStr = '';
			for ( let di = 0; di < 4; di ++ ) {

				const lo = vehicle._wheelOffsets[ di ];
				const wo = lo.clone().applyQuaternion( vehicle.container.quaternion );
				const expY = vehicle.groundHeight - ( n.x * wo.x + n.z * wo.z ) / ( n.y || 1 );
				const dev = wY[ di ] - expY;
				const sign = dev >= 0 ? '+' : '';
				devStr += `${ devLabels[ di ] }=${ sign }${ dev.toFixed( 3 ) } `;

			}

			dbg.textContent =
				`groundHeight:  ${ vehicle.groundHeight.toFixed( 3 ) }\n` +
				`vehicleY:      ${ vehicle._vehicleY.toFixed( 3 ) }\n` +
				`vertVelocity:  ${ vehicle._verticalVelocity.toFixed( 3 ) }\n` +
				`grounded:      ${ vehicle._grounded }\n` +
				`bodyHeight:    ${ vehicle.debug.bodyHeight.toFixed( 3 ) }\n` +
				`bodyNode.y:    ${ bNode ? bNode.position.y.toFixed( 3 ) : 'n/a' }\n` +
				`rideHeight:    ${ vehicle.debug.rideHeight.toFixed( 3 ) }\n` +
				`wheelContact:  FL=${ wY[ 0 ].toFixed( 2 ) } FR=${ wY[ 1 ].toFixed( 2 ) } BL=${ wY[ 2 ].toFixed( 2 ) } BR=${ wY[ 3 ].toFixed( 2 ) }\n` +
				`suspDeviation: ${ devStr }\n` +
				`normal:        (${ n.x.toFixed( 2 ) }, ${ n.y.toFixed( 2 ) }, ${ n.z.toFixed( 2 ) })\n` +
				`linearSpeed:   ${ vehicle.linearSpeed.toFixed( 3 ) }` +
				( autoTest ? `\nautoTest:      ${ autoTest.phase } ${ autoTest.timer.toFixed( 1 ) }s` : '' ) +
				( wallScrapeTest ? `\nwallScrape:   ${ wallScrapeTest.phase } ${ wallScrapeTest.timer.toFixed( 1 ) }s` : '' ) +
				( jumpTest ? `\njumpTest:      ${ jumpTest.phase } ${ jumpTest.timer.toFixed( 1 ) }s` : '' ) +
				( jitterTest ? `\njitterTest:    ${ jitterTest.frameCount } frames, ${ jitterTest.spikes.length } spikes` : '' );

		}

		// Update orbit controls target to follow vehicle
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

	createBoundsVisuals();

	// Load first tile
	await loadTile( currentTileIndex );

	// Start loop
	animate();

}

init();
