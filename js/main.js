import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds, TRACK_CELLS, CELL_RAW, GRID_SCALE } from './Track.js';
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
dirLight.shadow.mapSize.setScalar( isMobile ? 1024 : 2048 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
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
	'track-straight-night', 'track-corner-night', 'track-bump', 'track-finish',
	'decoration-empty-night', 'decoration-buildings-1', 'decoration-buildings-2', 'decoration-tents',
];

const models = {};

async function loadModels() {

	const promises = modelNames.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			loader.load( `models/${ name }.glb`, ( gltf ) => {

				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;

					}

				} );

				// Godot imports vehicle models at root_scale=0.5
				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				models[ name ] = gltf.scene;
				resolve();

			}, undefined, reject );

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
	renderer.setPixelRatio( isMobile ? 1.0 : Math.min( window.devicePixelRatio, 2.0 ) );
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

	buildTrack( scene, models, customCells );


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

	buildWallColliders( world, null, customCells );
	buildTrackColliders( world, models, customCells );

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

		// Wait for welcome message before continuing
		await new Promise( ( resolve, reject ) => {

			network.onWelcome = ( data ) => {

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
	const vehicleGroup = vehicle.container;

	const dirLightOffset = { x: 11.4, y: 15, z: - 5.3 };
	let lastShadowX = 0, lastShadowZ = 0;

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

	const trackIntel = new TrackIntel( activeCells );
	raceMode.trackIntel = trackIntel;

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

	let debugSphere = null;
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

		// Physics body sphere — sized to encapsulate the whole vehicle frame
		const vehicleBBox = new THREE.Box3().setFromObject( vehicleGroup );
		const vehicleSize = vehicleBBox.getSize( new THREE.Vector3() );
		const debugRadius = vehicleSize.length() * 0.5;

		debugSphere = new THREE.Mesh(
			new THREE.SphereGeometry( debugRadius, 16, 10 ),
			new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
		);
		debugSphere.visible = false;
		scene.add( debugSphere );

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

		debugMenu.addCheckbox( generalTab, 'Night mode', true, ( v ) => {

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

				while ( vehicle.container.children.length > 0 ) {

					const child = vehicle.container.children[ 0 ];
					if ( child.isLight || child.isObject3D && child === vehicle.underglowLight ) break;
					if ( child.isLight ) break;
					vehicle.container.remove( child );

				}

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

				vehicle.wheelOrigY = vehicle.wheels.map( ( w ) => w.position.y );
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

		debugMenu.addCheckbox( generalTab, 'Show physics sphere', false, ( v ) => {

			debugSphere.visible = v;

		} );

		debugMenu.addCheckbox( generalTab, 'Show wheel debug', false, ( v ) => {

			for ( const wd of wheelDebug ) {

				wd.boxH.visible = v;
				wd.axes.visible = v;
				for ( const l of wd.labels ) l.visible = v;

			}

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

		debugMenu.addSlider( generalTab, 'AI count', 0, 9, 1, 0, ( v ) => { aiManager.setCount( v ); } );
		debugMenu.addSlider( generalTab, 'Rubber band %', 0, 100, 1, 50, ( v ) => { aiManager.rubberBandIntensity = v / 100; } );

		// ── Tab: Post FX ─────────────────────────────────────────────────────────
		const postFXTab = debugMenu.addTab( 'postprocessing', 'Post FX' );

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
		debugMenu.addSlider( postFXTab, 'SSAO Radius', 0, 4, 0.1, 1, ( v ) => { if ( postFX._ssaoPass ) postFX._ssaoPass.kernelRadius = v; } );
		debugMenu.addSlider( postFXTab, 'SSAO Min Dist', 0, 0.01, 0.001, 0.001, ( v ) => { if ( postFX._ssaoPass ) postFX._ssaoPass.minDistance = v; } );
		debugMenu.addSlider( postFXTab, 'SSAO Max Dist', 0, 0.1, 0.005, 0.05, ( v ) => { if ( postFX._ssaoPass ) postFX._ssaoPass.maxDistance = v; } );

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
	dirLight.target = vehicleGroup;

	buildLightingCache();
	applyLighting( LIGHTING_NIGHT );
	for ( const hl of vehicle.headlights ) hl.visible = true;

	const cam = new Camera();
	cam.targetPosition.copy( vehicle.spherePos );

	// Initialize PostProcessing now that cam is available
	postFX = new PostProcessing( renderer, scene, cam.camera, bloomPass );
	postFX.setDirLight( dirLight );

	const settings = new Settings();
	const controls = new Controls( settings, cam );
	const settingsMenu = new SettingsMenu( settings, controls, aiManager );

	// ─── Camera toggle button (top-left) ─────────────────────────────────
	const camToggleBtn = document.createElement( 'div' );
	camToggleBtn.style.cssText = 'position:fixed;top:16px;left:16px;z-index:100;width:44px;height:44px;border-radius:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
	camToggleBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
	camToggleBtn.addEventListener( 'pointerup', () => {

		cam.mode = cam.mode === 'chase' ? 'isometric' : 'chase';

	} );
	document.body.appendChild( camToggleBtn );

	// ─── React to settings changes ───────────────────────────────────────
	window.addEventListener( 'settings-changed', ( e ) => {

		const { key, value } = e.detail;

		if ( key === 'shadowQuality' ) {

			dirLight.shadow.mapSize.setScalar( value === 'high' ? 2048 : 1024 );
			dirLight.shadow.map = null; // force shadow map rebuild
			renderer.shadowMap.needsUpdate = true;

		}

		if ( key === 'postProcessing' && postFX ) {

			postFX.setEnabled( 'bloom', value );

		}

		if ( key === 'cameraMode' ) {

			cam.mode = value;

		}

	} );

	const audio = new GameAudio();
	audio.init( cam.camera );

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

	const contactListener = {
		onContactAdded( bodyA, bodyB, manifold ) {

			if ( ! vehicle.rigidBody ) return;
			if ( bodyA !== vehicle.rigidBody && bodyB !== vehicle.rigidBody ) return;

			// Need a valid contact normal for direction-dependent effects
			const wn = manifold && manifold.worldSpaceNormal;
			if ( ! wn ) return;

			// Skip ground-like contacts (normal mostly vertical)
			if ( Math.abs( wn[ 1 ] ) > 0.5 ) return;

			// Star: ignore all wall impacts
			if ( vehicle.starActive ) return;

			// Shield: absorb one wall hit
			if ( vehicle.shieldActive ) {

				vehicle.shieldActive = false;
				vehicle.shieldTimer = 0;
				audio.playShieldBreak();
				return;

			}

			// Velocity into the contact surface
			const sv = vehicle.sphereVel;
			const speed = Math.sqrt( sv.x * sv.x + sv.z * sv.z );

			if ( speed < 1.5 ) return;

			// Cooldown
			const now = performance.now() / 1000;
			if ( now - lastImpactTime < 0.3 ) return;
			lastImpactTime = now;

			audio.playImpact( speed );

			// Screen shake + wall sparks (directional)
			const sign = ( bodyA === vehicle.rigidBody ) ? - 1 : 1;
			cam.applyShake( wn[ 0 ] * sign, wn[ 2 ] * sign, speed );
			wallSparks.emit( vehicle.container.position, wn[ 0 ] * sign, wn[ 2 ] * sign, speed );
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

	let fpsFrames = 0;
	let fpsTime = performance.now();

	function animate() {

		requestAnimationFrame( animate );

		fpsFrames ++;
		const now = performance.now();
		if ( now - fpsTime >= 500 ) {

			fpsDisplay.textContent = ( fpsFrames / ( ( now - fpsTime ) / 1000 ) ).toFixed( 0 ) + ' FPS';
			fpsFrames = 0;
			fpsTime = now;

		}

		timer.update();
		const dt = Math.min( timer.getDelta(), 1 / 30 );

		const rawInput = controls.update();
		const input = raceMode.filterInput( rawInput );

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

				const fwd = new THREE.Vector3( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
				boostBurst.emit( vehicle.container.position, fwd.x, fwd.z );

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

		const allActiveVehicles = [ ...playerManager.getActiveVehicles(), ...aiManager.getActiveVehicles() ];
		raceMode.update( dt, vehicle, allActiveVehicles, aiManager.getAIRaceData() );

		if ( raceMode.state === 'idle' ) {

			raceLobby.update( dt, playerManager.players, playerManager.localId );

		}

		if ( ! spectating ) {

			afkDetector.update( dt, vehicle );

		}

		hud.update( dt, raceMode.getDisplayState(), raceLobby.getDisplayState() );
		minimap.update( allActiveVehicles, raceMode.getDisplayState().state );

		// Send local state to server (throttled internally at 20Hz)
		if ( multiplayer && network.connected && ! spectating ) {

			const state = playerManager.getLocalState();
			if ( state ) network.sendState( state );

		}

		// ─── DEBUG updates (desktop only) ─────────────────────────────────────
		if ( debugSphere && vehicle ) {

			debugSphere.position.copy( vehicle.spherePos );
			for ( const wd of wheelDebug ) wd.boxH.update();

		}
		// ───────────────────────────────────────────────────────────────────────

		// Follow local vehicle or spectator target
		const followVehicle = spectating ? cam.spectatorTarget : vehicle;

		if ( followVehicle ) {

			const vehPos = followVehicle.spherePos;
			const dsx = vehPos.x - lastShadowX;
			const dsz = vehPos.z - lastShadowZ;
			if ( dsx * dsx + dsz * dsz > 0.25 ) {

				dirLight.position.set(
					vehPos.x + dirLightOffset.x,
					dirLightOffset.y,
					vehPos.z + dirLightOffset.z
				);
				dirLight.target.position.set( vehPos.x, 0, vehPos.z );
				lastShadowX = vehPos.x;
				lastShadowZ = vehPos.z;

			}

			cam.update( dt, followVehicle.spherePos, followVehicle.container.quaternion, {
				inputX: followVehicle.inputX,
				linearSpeed: followVehicle.linearSpeed,
				boostActive: followVehicle.boostActive,
				bodyLeanRoll: followVehicle.debug.bodyLeanRoll
			} );

		}

		audio.update( dt, vehicle ? vehicle.linearSpeed : 0, input.z, vehicle ? vehicle.driftIntensity : 0 );

		// Update dynamic post-processing effects
		if ( postFX ) {

			const followV = spectating ? cam.spectatorTarget : vehicle;
			postFX.update( dt, cam.getVelocity(), followV ? followV.boostActive : false );

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
