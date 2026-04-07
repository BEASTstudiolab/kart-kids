import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { getTrackTileSet } from './TrackModelConfig.js';
import { getTrackAsphaltMode } from './TrackAsphaltMode.js';
import { loadModels } from './ModelLoader.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, transformCells, deriveRampCells, computeSpawnPosition, computeTrackBounds, TRACK_CELLS, CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';
import { RaceLobby } from './RaceLobby.js';
import { AFKDetector } from './AFKDetector.js';
import { buildTrackColliders } from './Physics.js';
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
import { PassByAudio } from './PassByAudio.js';
import { ItemBoxManager } from './ItemBoxManager.js';
import { ItemPickupVFX } from './ItemPickupVFX.js';
import { AIManager } from './AIManager.js';
import { PostProcessing } from './PostProcessing.js';
import { setupDebugPanel } from './DebugPanelSetup.js';
import { LIGHTING_DAY, LIGHTING_NIGHT, buildLightingCache, applyLighting as _applyLighting } from './Lighting.js';
import { createContactListener } from './ContactHandler.js';
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

const _boostFwd = new THREE.Vector3();

// Bound lighting helper — wraps _applyLighting with scene/light references
const applyLighting = ( preset ) => _applyLighting( preset, { scene, hemiLight, dirLight, bloomPass, renderer } );


window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );
	if ( postFX ) postFX.resize( window.innerWidth, window.innerHeight );

} );

const trackTileSet = getTrackTileSet( globalThis.location?.search ?? '' );
const asphaltMode = getTrackAsphaltMode( globalThis.location?.search ?? '' );

function applyPlayerTints( vehicle, settings ) {

	const vehColor = settings.get( 'vehicleColor' );
	const charColor = settings.get( 'characterColor' );

	// Vehicle body tint — bodyNode may be a Group with child meshes (multi-material)
	if ( vehicle.bodyNode ) {

		vehicle.bodyNode.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			if ( vehColor ) {

				if ( ! child._originalMaterial ) child._originalMaterial = child.material;
				child.material = child._originalMaterial.clone();
				child.material.color.set( vehColor );

			} else if ( child._originalMaterial ) {

				child.material = child._originalMaterial;

			}

		} );

	}

	// Character tint — find the 'base-character' group node and tint all its child meshes
	let charNode = null;
	vehicle.container.traverse( ( child ) => {

		if ( child.name.toLowerCase().includes( 'character' ) ) charNode = child;

	} );

	if ( charNode ) {

		charNode.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			if ( charColor ) {

				if ( ! child._originalMaterial ) child._originalMaterial = child.material;
				child.material = child._originalMaterial.clone();
				child.material.color.set( charColor );

			} else if ( child._originalMaterial ) {

				child.material = child._originalMaterial;

			}

		} );

	}

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
	renderer.shadowMap.autoUpdate = false;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;

	bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
	bloomPass.strength = 0.02;
	bloomPass.radius = 0.02;
	bloomPass.threshold = 0.5;

	renderer.setEffects( [ bloomPass ] );
	document.body.appendChild( renderer.domElement );

	// Handle WebGL context loss (common on mobile tab switches / memory pressure)
	renderer.domElement.addEventListener( 'webglcontextlost', ( e ) => {

		e.preventDefault();
		console.warn( '[renderer] WebGL context lost — rendering paused' );

	} );

	renderer.domElement.addEventListener( 'webglcontextrestored', () => {

		console.warn( '[renderer] WebGL context restored — resuming' );
		renderer.shadowMap.needsUpdate = true;

	} );

	registerAll();

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
	// The transformed cells (with visual types) go to buildTrack/buildTrackColliders.
	const renderCells = transformCells( activeCells );

	// Loading progress UI
	const loadingBar = document.getElementById( 'loading-bar' );
	const loadingText = document.getElementById( 'loading-text' );

	// Load only models the track actually uses (+ always-loaded vehicles/decorations)
	const models = await loadModels( trackTileSet, asphaltMode, renderCells, ( loaded, total, name ) => {

		const pct = Math.round( ( loaded / total ) * 100 );
		if ( loadingBar ) loadingBar.style.width = pct + '%';
		if ( loadingText ) loadingText.textContent = `Loading models... ${ loaded }/${ total }`;

	} );

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

	// Debug groups for visualization (populated lazily by debug panel)
	const meshDebugGroup = new THREE.Group();
	meshDebugGroup.visible = false;
	scene.add( meshDebugGroup );

	const tileLabelsGroup = new THREE.Group();
	tileLabelsGroup.visible = false;
	scene.add( tileLabelsGroup );

	const heightLabelsGroup = new THREE.Group();
	heightLabelsGroup.visible = false;
	scene.add( heightLabelsGroup );

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

	// ── Debug panel setup ────────────────────────────────────────────────────
	// Boxed primitives: shared between debug callbacks and game loop
	const fpsCapMs = { value: 0 };
	const draftIndicatorEnabled = { value: false };

	// Debug: ground plane visualizer — shows raycast ground height as a green disc
	const groundIndicator = new THREE.Mesh(
		new THREE.CircleGeometry( 1.5, 16 ),
		new THREE.MeshBasicMaterial( { color: 0x00ff00, transparent: true, opacity: 0.4, side: THREE.DoubleSide } )
	);
	groundIndicator.rotation.x = - Math.PI / 2;
	groundIndicator.visible = false;
	scene.add( groundIndicator );

	// Draft debug indicator (to the right of camera icon)
	const draftIndicator = document.createElement( 'div' );
	draftIndicator.textContent = 'ACTIVE DRAFT';
	draftIndicator.style.cssText = 'position:fixed;top:24px;left:68px;color:#00ffff;font:bold 14px/1 monospace;text-shadow:0 0 6px rgba(0,255,255,0.6);z-index:100;user-select:none;pointer-events:none;display:none;';
	document.body.appendChild( draftIndicator );

	// Jitter debug overlay
	const jitterDisplay = document.createElement( 'div' );
	jitterDisplay.style.cssText = [
		'position:fixed', 'top:100px', 'left:16px',
		'background:rgba(0,0,0,0.72)', 'color:#ff0', 'font:11px/1.4 monospace',
		'padding:4px 10px', 'border-radius:6px', 'z-index:999', 'user-select:none',
		'display:none', 'white-space:pre',
	].join( ';' );
	document.body.appendChild( jitterDisplay );

	// debugMenu, debugCollider, wheelDebug — created by setupDebugPanel below (after cam/postFX exist)
	let debugCollider, wheelDebug, debugMenu;

	// ─────────────────────────────────────────────────────────────────────────
	const dirLightTarget = new THREE.Object3D();
	scene.add( dirLightTarget );
	dirLight.target = dirLightTarget;

	buildLightingCache( scene );
	applyLighting( LIGHTING_DAY );
	for ( const hl of vehicle.headlights ) hl.visible = false;

	const cam = new Camera();
	cam.targetPosition.copy( vehicle.vehPos );

	const rearview = new RearviewMirror( renderer );

	// Initialize PostProcessing now that cam is available
	postFX = new PostProcessing( renderer, scene, cam.camera, bloomPass );
	postFX.setDirLight( dirLight );

	const settings = new Settings();

	// Apply custom vehicle/character colors from settings
	applyPlayerTints( vehicle, settings );

	const controls = new Controls( settings, cam );
	const settingsMenu = new SettingsMenu( settings, controls, audio );
	const speedometer = new Speedometer( settings );

	// Re-apply tints live when settings change
	window.addEventListener( 'settings-changed', ( e ) => {

		if ( e.detail.key === 'vehicleColor' || e.detail.key === 'characterColor' ) {

			applyPlayerTints( vehicle, settings );

		}

	} );

	// ── Debug panel (all debug UI and visualization) ─────────────────────
	( { debugMenu, debugCollider, wheelDebug } = setupDebugPanel( {
		scene, renderer, bloomPass, postFX,
		vehicle, cam, aiManager,
		dirLight, dirLightOffset, hemiLight,
		meshDebugGroup, colliderDebugGroup,
		tileLabelsGroup, heightLabelsGroup,
		renderCells, models,
		groundIndicator, jitterDisplay, draftIndicator,
		applyLighting, LIGHTING_DAY, LIGHTING_NIGHT,
		fpsCapMs, draftIndicatorEnabled,
	} ) );

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
		rvSec.appendChild( settingsMenu._toggleRowCustom( 'Rearview Mirror', false, ( v ) => {

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
	const passByAudio = new PassByAudio( audio.listener );

	// Apply saved volume settings
	const savedSfxVol = settings.get( 'sfxVolume' );
	if ( savedSfxVol !== undefined ) audio.setSfxVolume( savedSfxVol / 100 );
	const savedMusicVol = settings.get( 'musicVolume' );
	if ( savedMusicVol !== undefined ) audio.setMusicVolume( savedMusicVol / 100 );

	// Apply saved steering assist
	vehicle.setSteeringAssist( !! settings.get( 'steeringAssist' ) );

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

	const bodyToVehicle = new Map();
	const contactListener = createContactListener( { vehicle, audio, cam, wallSparks, haptics, bodyToVehicle } );

	const timer = new THREE.Timer();

	// ─── FPS DISPLAY ─────────────────────────────────────────────────────────
	const fpsDisplay = document.createElement( 'div' );
	fpsDisplay.style.cssText = [
		'position:fixed', 'top:68px', 'left:16px',
		'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
		'padding:4px 10px', 'border-radius:6px', 'z-index:999', 'user-select:none',
	].join( ';' );
	document.body.appendChild( fpsDisplay );

	let fpsFrames = 0;
	let fpsTime = performance.now();
	let gamePaused = false;
	const allActiveVehicles = [];
	const draftingSystem = new DraftingSystem();
	const draftLines = new DraftLines( scene );

	document.addEventListener( 'keydown', ( e ) => {

		if ( e.code === 'KeyP' ) {

			gamePaused = ! gamePaused;
			console.log( '%c[PAUSE] ' + ( gamePaused ? 'PAUSED' : 'RESUMED' ), 'color: cyan; font-weight: bold' );

		}


	} );

	let lastFrameTime = 0;
	let shadowFrameCounter = 0;

	function animate() {

		requestAnimationFrame( animate );

		// Optional FPS cap
		if ( fpsCapMs.value > 0 ) {

			const nowCap = performance.now();
			if ( nowCap - lastFrameTime < fpsCapMs.value ) return;
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

		// Stereo whoosh when vehicles pass nearby
		if ( ! spectating ) passByAudio.update( dt, vehicle, allActiveVehicles );

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
			if ( draftIndicatorEnabled.value ) {

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

		// Refresh shadow map every 3rd frame (static track + moving vehicles)
		shadowFrameCounter ++;
		if ( shadowFrameCounter >= 3 ) {

			renderer.shadowMap.needsUpdate = true;
			shadowFrameCounter = 0;

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

	// Dismiss loading overlay
	const overlay = document.getElementById( 'loading-overlay' );
	if ( overlay ) {

		overlay.classList.add( 'fade-out' );
		setTimeout( () => overlay.remove(), 400 );

	}

	animate();

}

init().catch( ( e ) => console.error( 'Init failed:', e ) );