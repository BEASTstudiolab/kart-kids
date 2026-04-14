import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { getTrackTileSet } from './TrackModelConfig.js';
import { getTrackAsphaltMode } from './TrackAsphaltMode.js';
import { loadModels } from './ModelLoader.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, transformCells, deriveRampCells, computeSpawnPosition, computeTrackBounds, TRACK_CELLS, CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';
import { V4_TYPE_NAMES, V4_TO_INTERNAL, ELEV_GROUND, CURVE_VARIANT_DECODE } from './track-editor/models/TrackV4Format.js';
import { RaceLobby } from './RaceLobby.js';
import { AFKDetector } from './AFKDetector.js';
import { buildTrackColliders, resetPhysicsWorld } from './Physics.js';
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
import { CombatManager } from './CombatManager.js';
import { DamageSFX } from './DamageSFX.js';
import { DamageVFX } from './DamageVFX.js';
import { HUDDamage } from './HUDDamage.js';
import { ProjectileManager } from './ProjectileManager.js';
import { ExplosionFXManager } from './explosions/ExplosionFXManager.js';
import { ItemSlotManager } from './ItemSlotManager.js';
import { rollItem } from './PowerupItem.js';
import { WreckManager } from './WreckManager.js';
import { EliminationManager } from './EliminationManager.js';
import { WrenchPickupManager } from './WrenchPickupManager.js';
import { Settings } from './Settings.js';
import { SettingsMenu } from './SettingsMenu.js';
import { PRESETS, TIER_PIXEL_RATIO, AdaptiveQuality } from './QualityTiers.js';
import { DraftingSystem } from './DraftingSystem.js';
import { PLAYER_VEHICLES } from './VehicleRegistry.js';
import { DraftLines } from './DraftLines.js';
import { Speedometer } from './Speedometer.js';
import { RearviewMirror } from './RearviewMirror.js';
import { GhostRecorder } from './GhostRecorder.js';
import { GhostPlayer } from './GhostPlayer.js';
import { getTrackId } from './GhostStorage.js';
import { ACCESSORY_DEFS, applyPlayerAppearanceToVehicle, getPlayerAppearanceFromSettings } from './PlayerAppearance.js';


const SPECTATE_INPUT = { x: 0, z: 0, touchActive: false, boost: false, gas: false, brake: false };

/** Convert v4 JSON trackTiles to the cells array format the game expects. */
function _v4TilesToCells( v4 ) {

	const cells = [];

	for ( const entry of ( v4.trackTiles || [] ) ) {

		const type = V4_TYPE_NAMES[ entry.t ] ?? 'trk-straight';
		const orient = V4_TO_INTERNAL[ entry.o ] ?? 0;
		const elevStep = entry.e ?? ELEV_GROUND;

		const flags = {};
		const stepsAbove = elevStep - ELEV_GROUND;
		if ( stepsAbove === 1 ) flags.elevation = 1;
		else if ( stepsAbove >= 2 ) flags.elevation = 2;
		flags.fullElevation = elevStep;

		const f = entry.f ?? 0;
		if ( f & 0x01 ) flags.curveOverride = true;
		if ( f & 0x02 ) flags.rotationOverride = true;
		if ( f & 0x04 ) flags.rampStyle = 'smooth';

		const cvCode = ( f >> 3 ) & 0x07;
		if ( cvCode && CURVE_VARIANT_DECODE[ cvCode ] ) flags.curveVariant = CURVE_VARIANT_DECODE[ cvCode ];

		cells.push( [ entry.gx, entry.gz, type, orient, flags ] );

	}

	return cells;

}

/**
 * Factory that creates a startable/stoppable game engine.
 *
 * - Physics world and renderer persist across start/stop cycles.
 * - Game-specific state (HUD, AI, items, combat, VFX) tears down on stop().
 * - registerAll() is called exactly ONCE here, never inside start().
 *
 * @param {HTMLElement} canvasContainer - DOM element to append the renderer canvas to
 * @returns {{ start: Function, stop: Function, update: Function, getRenderer: Function, getScene: Function, isRunning: Function }}
 */
export function createGameEngine( canvasContainer ) {

	// ── Persistent state (survives start/stop cycles) ────────────────────────

	const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	window.isMobile = isMobile;

	// Scene
	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xadb2ba );
	scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
	dirLight.position.set( 11.4, 15, - 5.3 );
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.setScalar( 2048 );
	dirLight.shadow.camera.near = 0.5;
	dirLight.shadow.camera.far = 200;
	scene.add( dirLight );

	const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 1.5 );
	scene.add( hemiLight );

	const _boostFwd = new THREE.Vector3();

	// Renderer
	const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setPixelRatio( 1.0 );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.autoUpdate = false;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;

	const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
	bloomPass.strength = 0.02;
	bloomPass.radius = 0.02;
	bloomPass.threshold = 0.5;

	renderer.setEffects( [ bloomPass ] );
	canvasContainer.appendChild( renderer.domElement );

	// Handle WebGL context loss
	renderer.domElement.addEventListener( 'webglcontextlost', ( e ) => {

		e.preventDefault();
		console.warn( '[renderer] WebGL context lost — rendering paused' );

	} );

	renderer.domElement.addEventListener( 'webglcontextrestored', () => {

		console.warn( '[renderer] WebGL context restored — resuming' );
		renderer.shadowMap.needsUpdate = true;

	} );

	// Bound lighting helper
	const applyLighting = ( preset ) => _applyLighting( preset, { scene, hemiLight, dirLight, bloomPass, renderer } );

	// Post-processing reference — set during start(), nulled during stop()
	let postFX = null;

	// Resize handler persists with renderer — null-guard postFX
	window.addEventListener( 'resize', () => {

		renderer.setSize( window.innerWidth, window.innerHeight );
		if ( postFX ) postFX.resize( window.innerWidth, window.innerHeight );

	} );

	// Physics world — created once, persists
	registerAll();

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

	const world = createWorld( worldSettings );
	world._OL_MOVING = OL_MOVING;
	world._OL_STATIC = OL_STATIC;
	world._OL_TRACK_SUPPORT = OL_TRACK_SUPPORT;
	world._OL_TRACK_BLOCKER = OL_TRACK_BLOCKER;

	// ── Mutable game-specific state ──────────────────────────────────────────

	let _running = false;
	let _listenerRegistry = [];   // { target, event, handler }
	let _hudContainer = null;     // Single DOM container for all game HUD elements
	let _trackedBodies = [];      // Physics bodies to reset on stop()
	let _trackSupportBody = null; // Driveable support mesh body
	let _trackBlockerBody = null; // Wall/blocker mesh body
	let _trackGroup = null;       // Track mesh group added to scene

	// Game subsystem references (nulled during stop)
	let _vehicle = null;
	let _playerManager = null;
	let _controls = null;
	let _cam = null;
	let _audio = null;
	let _raceMode = null;
	let _raceLobby = null;
	let _afkDetector = null;
	let _hud = null;
	let _trackIntel = null;
	let _aiManager = null;
	let _minimap = null;
	let _itemBoxManager = null;
	let _wrenchPickupManager = null;
	let _network = null;
	let _combatManager = null;
	let _damageSFX = null;
	let _damageVFX = null;
	let _hudDamage = null;
	let _explosionFXManager = null;
	let _projectileManager = null;
	let _wreckManager = null;
	let _eliminationManager = null;
	let _wallSparks = null;
	let _boostBurst = null;
	let _itemPickupVFX = null;
	let _haptics = null;
	let _passByAudio = null;
	let _settings = null;
	let _settingsMenu = null;
	let _speedometer = null;
	let _rearview = null;
	let _ghostRecorder = null;
	let _ghostPlayer = null;
	let _adaptiveQuality = null;
	let _draftingSystem = null;
	let _draftLines = null;
	let _contactListener = null;
	let _bodyToVehicle = null;

	// Animate loop state
	let _timer = null;
	let _fpsFrames = 0;
	let _fpsTime = 0;
	let _gamePaused = false;
	let _lastFrameTime = 0;
	let _shadowFrameCounter = 0;
	let _wasBoostActive = false;
	let _prevDriftStage = 0;
	let _multiplayer = false;
	let _spectating = false;
	let _allActiveVehicles = [];
	let _fpsCapMs = { value: 0 };
	let _draftIndicatorEnabled = { value: false };
	let _prevSwitchView = false;

	// DOM element refs (inside HUD container)
	let _fpsDisplay = null;
	let _draftIndicator = null;
	let _jitterDisplay = null;
	let _ghostHudEl = null;
	let _camToggleBtn = null;
	let _groundIndicator = null;
	let _dirLightTarget = null;
	let _dirLightOffset = null;
	let _lastShadowX = 0;
	let _lastShadowZ = 0;

	// Debug
	let _debugCollider = null;
	let _wheelDebug = null;
	let _debugMenu = null;
	let _colliderDebugGroup = null;
	let _barrierDebugGroup = null;
	let _meshDebugGroup = null;
	let _tileLabelsGroup = null;
	let _heightLabelsGroup = null;
	let _routePathDebugGroup = null;
	let _aiTargetDebugGroup = null;


	// ── Helper: register a listener that will be auto-removed on stop() ──────

	function _addListener( target, event, handler, options ) {

		target.addEventListener( event, handler, options );
		_listenerRegistry.push( { target, event, handler, options } );

	}

	function _disposeDebugGroupChildren( group ) {

		if ( ! group ) return;

		for ( const child of group.children ) {

			if ( child.geometry ) child.geometry.dispose();

			if ( child.material ) {

				if ( Array.isArray( child.material ) ) {

					for ( const mat of child.material ) mat.dispose();

				} else {

					child.material.dispose();

				}

			}

		}

		group.clear();

	}

	function _updateAITargetDebugOverlay() {

		if ( ! _aiTargetDebugGroup ) return;

		if ( ! _aiTargetDebugGroup.visible ) {

			if ( _aiTargetDebugGroup.children.length > 0 ) _disposeDebugGroupChildren( _aiTargetDebugGroup );
			return;

		}

		const debugEntries = _aiManager?.getAIDebugData ? _aiManager.getAIDebugData() : [];
		const activeEntries = debugEntries.filter( ( entry ) => entry?.vehicle && entry?.debugState?.finalTarget );

		if ( activeEntries.length === 0 ) {

			if ( _aiTargetDebugGroup.children.length > 0 ) _disposeDebugGroupChildren( _aiTargetDebugGroup );
			return;

		}

		_disposeDebugGroupChildren( _aiTargetDebugGroup );

		const linePositions = new Float32Array( activeEntries.length * 6 );
		const routePositions = new Float32Array( activeEntries.length * 3 );
		const finalPositions = new Float32Array( activeEntries.length * 3 );

		for ( let i = 0; i < activeEntries.length; i ++ ) {

			const { vehicle, debugState } = activeEntries[ i ];
			const lineOffset = i * 6;
			const pointOffset = i * 3;
			const routeTarget = debugState.routeTarget || debugState.anchorTarget || debugState.finalTarget;
			const finalTarget = debugState.finalTarget;
			const baseY = ( vehicle.vehPos.y || 0 ) + 1.0;

			linePositions[ lineOffset ] = vehicle.vehPos.x;
			linePositions[ lineOffset + 1 ] = baseY;
			linePositions[ lineOffset + 2 ] = vehicle.vehPos.z;
			linePositions[ lineOffset + 3 ] = finalTarget.x;
			linePositions[ lineOffset + 4 ] = baseY;
			linePositions[ lineOffset + 5 ] = finalTarget.z;

			routePositions[ pointOffset ] = routeTarget.x;
			routePositions[ pointOffset + 1 ] = baseY + 0.1;
			routePositions[ pointOffset + 2 ] = routeTarget.z;

			finalPositions[ pointOffset ] = finalTarget.x;
			finalPositions[ pointOffset + 1 ] = baseY + 0.15;
			finalPositions[ pointOffset + 2 ] = finalTarget.z;

		}

		const lineGeo = new THREE.BufferGeometry();
		lineGeo.setAttribute( 'position', new THREE.BufferAttribute( linePositions, 3 ) );
		const lineMat = new THREE.LineBasicMaterial( {
			color: 0xffd54f,
			depthTest: false,
			transparent: true,
			opacity: 0.9,
		} );
		const line = new THREE.LineSegments( lineGeo, lineMat );
		line.renderOrder = 1001;
		_aiTargetDebugGroup.add( line );

		const routeGeo = new THREE.BufferGeometry();
		routeGeo.setAttribute( 'position', new THREE.BufferAttribute( routePositions, 3 ) );
		const routeMat = new THREE.PointsMaterial( {
			color: 0x66ccff,
			size: 1.8,
			sizeAttenuation: true,
			depthTest: false,
		} );
		const routePoints = new THREE.Points( routeGeo, routeMat );
		routePoints.renderOrder = 1002;
		_aiTargetDebugGroup.add( routePoints );

		const finalGeo = new THREE.BufferGeometry();
		finalGeo.setAttribute( 'position', new THREE.BufferAttribute( finalPositions, 3 ) );
		const finalMat = new THREE.PointsMaterial( {
			color: 0xff7b39,
			size: 2.6,
			sizeAttenuation: true,
			depthTest: false,
		} );
		const finalPoints = new THREE.Points( finalGeo, finalMat );
		finalPoints.renderOrder = 1003;
		_aiTargetDebugGroup.add( finalPoints );

	}


	// ── start() ──────────────────────────────────────────────────────────────

	async function start( config = {} ) {

		if ( _running ) {

			console.warn( '[GameEngine] start() called while already running — ignoring' );
			return;

		}

		_running = true;
		try {

			_trackedBodies = [];
			_listenerRegistry = [];
			_allActiveVehicles = [];
			_multiplayer = false;
			_spectating = false;
			_wasBoostActive = false;
			_prevDriftStage = 0;
			_lastShadowX = 0;
			_lastShadowZ = 0;
			_shadowFrameCounter = 0;
			_lastFrameTime = 0;
			_fpsFrames = 0;
			_fpsTime = performance.now();
			_gamePaused = false;
			_prevSwitchView = false;
			_fpsCapMs = { value: 0 };
			_draftIndicatorEnabled = { value: false };

			// ── HUD container (all game DOM elements go here for easy teardown) ──
			_hudContainer = document.createElement( 'div' );
			_hudContainer.id = 'game-hud-container';
			_hudContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
			_hudContainer.style.pointerEvents = 'none';
			document.body.appendChild( _hudContainer );

			// Allow child elements to receive pointer events
			const hudStyle = document.createElement( 'style' );
			hudStyle.textContent = '#game-hud-container > * { pointer-events: auto; }';
			_hudContainer.appendChild( hudStyle );

			// ── Track setup ──────────────────────────────────────────────────────
			const trackTileSet = getTrackTileSet( globalThis.location?.search ?? '' );
			const asphaltMode = getTrackAsphaltMode( globalThis.location?.search ?? '' );

			const urlParams = new URLSearchParams( window.location.search );
			const hash = window.location.hash.slice( 1 );
			const debugTopdown = urlParams.get( 'debug' ) === 'topdown';
			let customCells = null;

			if ( config.trackData ) {

			// config.trackData can be raw cells array or v4 JSON object
			if ( Array.isArray( config.trackData ) ) {

				customCells = config.trackData;

			} else if ( config.trackData.trackTiles ) {

				customCells = _v4TilesToCells( config.trackData );

			}

		} else if ( hash.startsWith( 'track=v4:' ) ) {

			// v4 JSON track (base64url-encoded)
			try {

				const b64 = hash.slice( 9 );
				const bytes = atob( b64.replace( /-/g, '+' ).replace( /_/g, '/' ) );
				const json = new TextDecoder().decode( Uint8Array.from( bytes, c => c.charCodeAt( 0 ) ) );
				const v4 = JSON.parse( json );

				if ( v4.trackTiles ) {

					customCells = _v4TilesToCells( v4 );

				}

			} catch ( e ) {

				console.warn( 'Invalid v4 track parameter, using default track' );

			}

			}

			const activeCells = customCells || TRACK_CELLS;
			const renderCells = transformCells( activeCells );

		// Loading progress UI
		const loadingBar = document.getElementById( 'loading-bar' );
		const loadingText = document.getElementById( 'loading-text' );

			const models = await loadModels( trackTileSet, asphaltMode, renderCells, ( loaded, total, name ) => {

			const pct = Math.round( ( loaded / total ) * 100 );
			if ( loadingBar ) loadingBar.style.width = pct + '%';
			if ( loadingText ) loadingText.textContent = `Loading models... ${ loaded }/${ total }`;

			} );

			const spawn = computeSpawnPosition( activeCells );
			const bounds = computeTrackBounds( activeCells );
			const hw = bounds.halfWidth;
			const hd = bounds.halfDepth;
			const groundSize = Math.max( hw, hd ) * 2 + 20;

		// Shadow frustum
		const shadowRadius = 25;
		dirLight.shadow.camera.left = - shadowRadius;
		dirLight.shadow.camera.right = shadowRadius;
		dirLight.shadow.camera.top = shadowRadius;
		dirLight.shadow.camera.bottom = - shadowRadius;
		dirLight.shadow.camera.updateProjectionMatrix();

		if ( scene.fog ) {

			scene.fog.near = groundSize * 1.2;
			scene.fog.far = groundSize * 2.5;

		}

		// ── Resolve props (editor-placed decorations) ───────────────────────
		let props = config.props || null;
		if ( ! props ) {

			try {

				const v4Raw = localStorage.getItem( 'kk-editor-project' );
				if ( v4Raw ) {

					const v4 = JSON.parse( v4Raw );
					if ( v4.props && v4.props.length > 0 ) props = v4.props;

				}

			} catch { /* ignore */ }

		}

		_trackGroup = buildTrack( scene, models, renderCells, props );

		// ── Track colliders ──────────────────────────────────────────────────
		// Teleport old track body if switching tracks
		if ( _trackSupportBody ) rigidBody.setPosition( world, _trackSupportBody, [ 0, - 10000, 0 ], false );
		if ( _trackBlockerBody ) rigidBody.setPosition( world, _trackBlockerBody, [ 0, - 10000, 0 ], false );

		const trackColliderData = buildTrackColliders( world, models, renderCells );
		_trackSupportBody = trackColliderData.supportBody;
		_trackBlockerBody = trackColliderData.blockerBody;

		// Build debug visualization of track support/blocker collider meshes
		_colliderDebugGroup = new THREE.Group();
		_colliderDebugGroup.visible = false;
		scene.add( _colliderDebugGroup );
		if ( trackColliderData.supportPositions && trackColliderData.supportPositions.length > 0 ) {

			const geo = new THREE.BufferGeometry();
			geo.setAttribute( 'position', new THREE.BufferAttribute( trackColliderData.supportPositions, 3 ) );
			geo.setIndex( new THREE.BufferAttribute( trackColliderData.supportIndices, 1 ) );
			const edges = new THREE.EdgesGeometry( geo, 15 );
			const mat = new THREE.LineBasicMaterial( { color: 0xff69b4, depthTest: false, transparent: true, opacity: 0.6 } );
			_colliderDebugGroup.add( new THREE.LineSegments( edges, mat ) );

		}
		if ( trackColliderData.blockerPositions && trackColliderData.blockerPositions.length > 0 ) {

			const geo = new THREE.BufferGeometry();
			geo.setAttribute( 'position', new THREE.BufferAttribute( trackColliderData.blockerPositions, 3 ) );
			geo.setIndex( new THREE.BufferAttribute( trackColliderData.blockerIndices, 1 ) );
			const edges = new THREE.EdgesGeometry( geo, 15 );
			const mat = new THREE.LineBasicMaterial( { color: 0xffa500, depthTest: false, transparent: true, opacity: 0.45 } );
			_colliderDebugGroup.add( new THREE.LineSegments( edges, mat ) );

		}

		// Build debug visualization of extruded barrier walls (cyan)
		_barrierDebugGroup = new THREE.Group();
		_barrierDebugGroup.visible = false;
		scene.add( _barrierDebugGroup );
		if ( trackColliderData.barrierPositions && trackColliderData.barrierPositions.length > 0 ) {

			const geo = new THREE.BufferGeometry();
			geo.setAttribute( 'position', new THREE.BufferAttribute( trackColliderData.barrierPositions, 3 ) );
			geo.setIndex( new THREE.BufferAttribute( trackColliderData.barrierIndices, 1 ) );
			const edges = new THREE.EdgesGeometry( geo, 15 );
			const mat = new THREE.LineBasicMaterial( { color: 0x00ffff, depthTest: false, transparent: true, opacity: 0.5 } );
			_barrierDebugGroup.add( new THREE.LineSegments( edges, mat ) );

		}

		_meshDebugGroup = new THREE.Group();
		_meshDebugGroup.visible = false;
		scene.add( _meshDebugGroup );

		_tileLabelsGroup = new THREE.Group();
		_tileLabelsGroup.visible = false;
		scene.add( _tileLabelsGroup );

			_heightLabelsGroup = new THREE.Group();
			_heightLabelsGroup.visible = false;
			scene.add( _heightLabelsGroup );

			_routePathDebugGroup = new THREE.Group();
			_routePathDebugGroup.visible = false;
			scene.add( _routePathDebugGroup );

			_aiTargetDebugGroup = new THREE.Group();
			_aiTargetDebugGroup.visible = false;
			scene.add( _aiTargetDebugGroup );

		// Safety-net ground
		const roadHalf = groundSize / 2;
		const groundBody = rigidBody.create( world, {
			shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
			motionType: MotionType.STATIC,
			objectLayer: OL_STATIC,
			position: [ bounds.centerX, - 5, bounds.centerZ ],
			friction: 5.0,
			restitution: 0.0,
		} );
		_trackedBodies.push( groundBody );

		const spawnPosition = spawn.position;
		const spawnAngle = spawn.angle;

		_playerManager = new PlayerManager( scene, world, models, spawnPosition, spawnAngle );

		_settings = new Settings();

		// ── Multiplayer connection ───────────────────────────────────────────
		const localDisplayName = ( config.displayName || _settings.getDisplayName() || '' ).trim();
		_network = config.network || new NetworkClient();
		if ( ! config.network ) _network.setDisplayName( localDisplayName );
		const spectateBtn = document.getElementById( 'spectate-btn' );

		if ( ( customCells || config.mode === 'solo' ) && ! config.network ) {

			_playerManager.initSinglePlayer( config.vehicleId, localDisplayName );

		} else try {

			if ( ! _network.connected ) await _network.connect();
			_multiplayer = true;

			if ( config.network ) {

				// Lobby already connected — build welcome data from config + stored state
				const lastWelcome = _network.lastWelcome || {};
				const welcomeData = {
					...lastWelcome,
					id: _network.localPlayerId,
					vehicleId: config.vehicleId || lastWelcome.vehicleId,
					displayName: localDisplayName,
					existingPlayers: config.players || lastWelcome.existingPlayers || [],
				};
				_playerManager.initLocalPlayer( welcomeData );
				if ( spectateBtn ) spectateBtn.style.display = 'block';

			} else {

				await new Promise( ( resolve, reject ) => {

					const timeout = setTimeout( () => reject( new Error( 'Server welcome timed out' ) ), 5000 );

					_network.onWelcome = ( data ) => {

						clearTimeout( timeout );

						try {

							_playerManager.initLocalPlayer( {
								...data,
								displayName: localDisplayName,
							} );
							if ( spectateBtn ) spectateBtn.style.display = 'block';
							resolve();

						} catch ( err ) {

							reject( err );

						}

					};

				} );

			}

			_network.onPlayerJoin = ( data ) => _playerManager.addRemotePlayer( data );
			_network.onPlayerLeave = ( data ) => {

				_playerManager.removeRemotePlayer( data.id );
				if ( _raceMode ) _raceMode.clearRemoteLap( data.id );

			};
			_network.onWorldUpdate = ( data ) => _playerManager.applyWorldUpdate( data );
			_network.onPlayerSpectate = ( data ) => {

				_playerManager.setSpectating( data.id, data.active );
				if ( data.active && _raceMode ) _raceMode.clearRemoteLap( data.id );

			};

			_network.onDisconnect = () => {

				console.log( 'Disconnected from server' );
				_multiplayer = false;
				if ( spectateBtn ) spectateBtn.style.display = 'none';

			};

		} catch ( e ) {

			console.warn( 'Multiplayer failed, single-player mode:', e );
			_playerManager.initSinglePlayer( config.vehicleId, localDisplayName );

		}

		_vehicle = _playerManager.localVehicle;

		_dirLightOffset = { x: 11.4, y: 15, z: - 5.3 };

		// ── Audio ────────────────────────────────────────────────────────────
		_audio = new GameAudio();

		// ── Race mode ────────────────────────────────────────────────────────
		_raceMode = new RaceMode( {
			totalLaps: 3,
			spawnPosition: spawnPosition,
			spawnAngle: spawnAngle,
			onCountdownTick: ( count ) => {

				if ( count > 0 ) _audio.playBeep( 440, 0.15 );
				else _audio.playBeep( 880, 0.3 );

			},
		} );

		_raceMode.initFinishLine( spawn.position, spawn.finishAngle );

		// ── Race lobby ───────────────────────────────────────────────────────
		_raceLobby = new RaceLobby( {
			zoneCenter: [ spawn.position[ 0 ], spawn.position[ 2 ] ],
			zoneHalfExtent: CELL_RAW * GRID_SCALE / 2,
			dwellTime: 5,
			onAllReady: () => {

				_raceLobby.reset();
				if ( _aiManager.count > 0 ) _aiManager.teleportToGrid( _vehicle );
				_raceMode.start();
				_aiManager.startRace();
				if ( _debugMenu ) _debugMenu.hide();

			},
		} );

		// ── AFK detector ─────────────────────────────────────────────────────
		_afkDetector = new AFKDetector( {
			timeout: 60,
			movementThreshold: 0.1,
			onAFK: () => {

				_spectating = true;
				if ( spectateBtn ) spectateBtn.textContent = 'Race';
				if ( _multiplayer ) _network.sendSpectate( true );
				_playerManager.setSpectating( _playerManager.localId, true );
				_cam.spectatorTarget = _playerManager.getFirstActiveVehicle();

			},
		} );

		_hud = new HUD(
			() => { _raceMode.reset(); _aiManager.resetRace(); _raceLobby.reset(); },
			() => _raceLobby.setReady( _playerManager.localId )
		);

		const intelCells = customCells ? deriveRampCells( activeCells ) : activeCells;
		_trackIntel = new TrackIntel( intelCells );

		console.log( `[TrackIntel] valid=${ _trackIntel.valid }, cells=${ intelCells.length }, customCells=${ !! customCells }`, _trackIntel.valid ? '' : _trackIntel.error );

		if ( ! _trackIntel.valid ) {

			console.warn( 'TrackIntel invalid — AI, position ranking, and item boxes disabled:', _trackIntel.error );

		}

		_raceMode.trackIntel = _trackIntel.valid ? _trackIntel : null;
		_vehicle.setTrackIntel( _trackIntel.valid ? _trackIntel : null );

		_aiManager = new AIManager( scene, world, models, _trackIntel.valid ? _trackIntel : null, spawnPosition, spawnAngle, spawn.finishAngle );
		_aiManager.totalLaps = 3;

		// ── AI fill + auto-start ─────────────────────────────────────────
		const mode = config.mode || null;

		// Determine AI count based on mode (applies to both multiplayer and non-multiplayer).
		let aiCount = 0;

		if ( mode === 'online' ) {

			const playerCount = config.playerCount || 1;
			aiCount = Math.max( 0, 8 - playerCount );

		} else {

			const storedAICount = Number( _settings?.get( 'aiCount' ) ?? 0 );
			aiCount = Number.isFinite( storedAICount )
				? Math.max( 0, Math.min( 8, Math.round( storedAICount ) ) )
				: 0;

		}

		console.log( `[GameEngine] Race start: mode=${ mode }, multiplayer=${ _multiplayer }, aiCount=${ aiCount }, trackIntel=${ !! ( _trackIntel && _trackIntel.valid ) }` );

		// Tell server we're ready (party lobby flow — server waits for all players)
		if ( _multiplayer && _network ) _network.sendRaceLoaded();

		if ( aiCount > 0 ) {

			_aiManager.setCount( aiCount );

		}

		// Auto-start — skip the RaceLobby dwell/ready system.
		setTimeout( () => {

			if ( _aiManager.count > 0 ) _aiManager.teleportToGrid( _vehicle );
			_raceMode.start();
			_aiManager.startRace();
			if ( _debugMenu ) _debugMenu.hide();

		}, 500 );

		_minimap = new Minimap( activeCells, bounds );

		// ── Item boxes ───────────────────────────────────────────────────────
		_itemBoxManager = _trackIntel.valid ? new ItemBoxManager( scene, _trackIntel ) : null;

		// ── Combat systems ───────────────────────────────────────────────────
		_wrenchPickupManager = _trackIntel.valid ? new WrenchPickupManager( scene, _trackIntel ) : null;

		// ── Multiplayer race sync ────────────────────────────────────────────
		if ( _multiplayer ) {

			_network.onRaceCountdown = ( msg ) => {

				_raceMode.networkDriven = true;
				_raceMode.setCountdown( msg.count );

			};

			_network.onRaceStart = () => {

				_raceMode.setCountdown( 0 );

			};

			_network.onPlayerLap = ( msg ) => {

				if ( ! msg || msg.id === _playerManager.localId ) return;
				_raceMode.setRemoteLap( msg.id, msg.lap );

			};

			_raceMode.onLapComplete = ( lap, time ) => {

				_audio.playLapChime();
				_network.sendLapComplete( lap, time );

			};

		}

		// ── Debug panel setup ────────────────────────────────────────────────
		_groundIndicator = new THREE.Mesh(
			new THREE.CircleGeometry( 1.5, 16 ),
			new THREE.MeshBasicMaterial( { color: 0x00ff00, transparent: true, opacity: 0.4, side: THREE.DoubleSide } )
		);
		_groundIndicator.rotation.x = - Math.PI / 2;
		_groundIndicator.visible = false;
		scene.add( _groundIndicator );

		_draftIndicator = document.createElement( 'div' );
		_draftIndicator.textContent = 'ACTIVE DRAFT';
		_draftIndicator.style.cssText = 'position:fixed;top:24px;left:68px;color:#00ffff;font:bold 14px/1 monospace;text-shadow:0 0 6px rgba(0,255,255,0.6);z-index:100;user-select:none;pointer-events:none;display:none;';
		_hudContainer.appendChild( _draftIndicator );

		_jitterDisplay = document.createElement( 'div' );
		_jitterDisplay.style.cssText = [
			'position:fixed', 'top:100px', 'left:16px',
			'background:rgba(0,0,0,0.72)', 'color:#ff0', 'font:11px/1.4 monospace',
			'padding:4px 10px', 'border-radius:6px', 'z-index:999', 'user-select:none',
			'display:none', 'white-space:pre',
		].join( ';' );
		_hudContainer.appendChild( _jitterDisplay );

		let debugCollider, wheelDebug, debugMenu;

		_dirLightTarget = new THREE.Object3D();
		scene.add( _dirLightTarget );
		dirLight.target = _dirLightTarget;

		buildLightingCache( scene );
		applyLighting( LIGHTING_DAY );
		for ( const hl of _vehicle.headlights ) hl.visible = false;

		_cam = new Camera();
		_cam.targetPosition.copy( _vehicle.vehPos );

		_rearview = new RearviewMirror( renderer );

		// Initialize PostProcessing
		postFX = new PostProcessing( renderer, scene, _cam.camera, bloomPass );
		postFX.setDirLight( dirLight );

		_adaptiveQuality = new AdaptiveQuality( _settings );

		applyPlayerAppearanceToVehicle( _vehicle, getPlayerAppearanceFromSettings( _settings ) );

		_controls = new Controls( _settings, _cam );
		_settingsMenu = new SettingsMenu( _settings, _controls, _audio );
		_speedometer = new Speedometer( _settings );

		// ── Listener registry: settings-changed for player appearance ────────
		_addListener( window, 'settings-changed', ( e ) => {

			if ( e.detail.key === 'vehicleColor' ||
				e.detail.key === 'characterColor' ||
				e.detail.key === 'charAccessories' ||
				e.detail.key === 'charSkinColor' ||
				e.detail.key === 'maskTintMainColor' ||
				e.detail.key === 'maskTintSecondaryColor' ||
				e.detail.key === 'selectedBalaclavaId' ) {

				applyPlayerAppearanceToVehicle( _playerManager.localVehicle, getPlayerAppearanceFromSettings( _settings ) );

			}

		} );

		_addListener( window, 'character-attached', () => {

			applyPlayerAppearanceToVehicle( _playerManager.localVehicle, getPlayerAppearanceFromSettings( _settings ) );

		} );

		// Apply saved vehicle selection + character customization
		const savedVehicle = _settings.get( 'vehicleModel' );
		if ( savedVehicle && savedVehicle !== 'kart-1' ) {

			_playerManager.swapLocalVehicle( savedVehicle );

		}

		applyPlayerAppearanceToVehicle( _playerManager.localVehicle, getPlayerAppearanceFromSettings( _settings ) );

		// ── Debug panel ──────────────────────────────────────────────────────
			( { debugMenu, debugCollider, wheelDebug } = setupDebugPanel( {
				scene, renderer, bloomPass, postFX,
				vehicle: _vehicle, cam: _cam, aiManager: _aiManager,
				trackIntel: _trackIntel.valid ? _trackIntel : null,
				controls: _controls,
				dirLight, dirLightOffset: _dirLightOffset, hemiLight,
				meshDebugGroup: _meshDebugGroup, colliderDebugGroup: _colliderDebugGroup, barrierDebugGroup: _barrierDebugGroup,
				tileLabelsGroup: _tileLabelsGroup, heightLabelsGroup: _heightLabelsGroup, routePathDebugGroup: _routePathDebugGroup, aiTargetDebugGroup: _aiTargetDebugGroup,
				renderCells, models,
				groundIndicator: _groundIndicator, jitterDisplay: _jitterDisplay, draftIndicator: _draftIndicator,
				applyLighting, LIGHTING_DAY, LIGHTING_NIGHT,
			fpsCapMs: _fpsCapMs, draftIndicatorEnabled: _draftIndicatorEnabled,
		} ) );

		_debugMenu = debugMenu;
		_debugCollider = debugCollider;
		_wheelDebug = wheelDebug;

		if ( debugTopdown ) {

			_cam.mode = 'topdown';
			_cam.zoom = 3;
			_debugMenu.show();

		}

		// ── Vehicle selector in hamburger menu ───────────────────────────────
		{

			const vehicleSec = _settingsMenu._section( 'Vehicle' );
			const vehicleOptions = PLAYER_VEHICLES.map( ( v ) => ( { value: v.id, label: v.label } ) );
			vehicleSec.appendChild( _settingsMenu._selectRow( 'Model', 'vehicleModel', vehicleOptions ) );
			_settingsMenu.addSection( vehicleSec );

			_addListener( window, 'settings-changed', ( e ) => {

				if ( e.detail.key === 'vehicleModel' ) {

					_playerManager.swapLocalVehicle( e.detail.value );

				}

			} );

		}

		// ── Character customization in hamburger menu ────────────────────────
		{

			const charSec = _settingsMenu._section( 'Character' );
			charSec.appendChild( _settingsMenu._colorRow( 'Skin Color', 'charSkinColor' ) );

			const accHeader = document.createElement( 'h3' );
			accHeader.textContent = 'Accessories';
			accHeader.style.cssText = 'margin:12px 0 4px;font-size:14px';
			charSec.appendChild( accHeader );

			const accessories = _settings.get( 'charAccessories' ) || {};

			for ( const accDef of ACCESSORY_DEFS ) {

				const accKey = accDef.key;
				const acc = accessories[ accKey ] || { visible: true, color: '' };

				const row = document.createElement( 'div' );
				row.className = 'settings-row';
				row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0';

				const lbl = document.createElement( 'span' );
				lbl.className = 'settings-label';
				lbl.textContent = accDef.label;
				lbl.style.flex = '1';

				const toggle = document.createElement( 'div' );
				toggle.className = 'settings-toggle' + ( acc.visible !== false ? ' on' : '' );
				toggle.setAttribute( 'role', 'switch' );
				toggle.setAttribute( 'aria-checked', String( acc.visible !== false ) );
				toggle.setAttribute( 'tabindex', '0' );
				toggle.style.flexShrink = '0';

				const colorInput = document.createElement( 'input' );
				colorInput.type = 'color';
				colorInput.className = 'settings-color-input';
				colorInput.value = acc.color || '#ffffff';
				colorInput.style.flexShrink = '0';

				const resetBtn = document.createElement( 'button' );
				resetBtn.className = 'settings-color-clear';
				resetBtn.textContent = 'Reset';
				resetBtn.style.flexShrink = '0';

				const updateAccessory = () => {

					const all = _settings.get( 'charAccessories' );
					all[ accKey ] = {
						visible: toggle.classList.contains( 'on' ),
						color: colorInput.value === '#ffffff' ? '' : colorInput.value,
					};
					_settings.set( 'charAccessories', { ...all } );

				};

				toggle.addEventListener( 'pointerup', () => {

					const newVal = ! toggle.classList.contains( 'on' );
					toggle.classList.toggle( 'on', newVal );
					toggle.setAttribute( 'aria-checked', String( newVal ) );
					updateAccessory();

				} );

				toggle.addEventListener( 'keydown', ( e ) => {

					if ( e.key === 'Enter' || e.key === ' ' ) {

						e.preventDefault();
						toggle.click();

					}

				} );

				colorInput.addEventListener( 'input', updateAccessory );

				resetBtn.addEventListener( 'pointerup', () => {

					colorInput.value = '#ffffff';
					updateAccessory();

				} );

				row.appendChild( lbl );
				row.appendChild( toggle );
				row.appendChild( colorInput );
				row.appendChild( resetBtn );
				charSec.appendChild( row );

			}

			_settingsMenu.addSection( charSec );

		}

		// ── Debug toggle in hamburger menu ───────────────────────────────────
		{

			const debugSec = _settingsMenu._section( 'Developer' );
			debugSec.appendChild( _settingsMenu._toggleRowCustom( 'Debug Panel', false, ( v ) => {

				if ( v ) {

					_debugMenu.show();
					_settingsMenu.close();

				} else {

					_debugMenu.hide();

				}

			} ) );
			_settingsMenu.addSection( debugSec );

		}

		// ── Rearview mirror toggle ───────────────────────────────────────────
		{

			const rvSec = _settingsMenu._section( 'HUD' );
			rvSec.appendChild( _settingsMenu._toggleRowCustom( 'Rearview Mirror', false, ( v ) => {

				_rearview.setEnabled( v );

			} ) );
			_settingsMenu.addSection( rvSec );

		}

		// ── Ghost replay setup ───────────────────────────────────────────────
		const ghostTrackId = getTrackId( activeCells );
		_ghostRecorder = new GhostRecorder();
		_ghostRecorder.init( ghostTrackId );

		_ghostPlayer = new GhostPlayer( scene );
		if ( _vehicle ) _ghostPlayer.initMesh( _vehicle.container );
		_ghostPlayer.load( ghostTrackId );
		_ghostPlayer.setVisible( _settings.get( 'ghostEnabled' ) !== false );

		_ghostHudEl = document.createElement( 'div' );
		_ghostHudEl.style.cssText = [
			'position:fixed', 'top:60px', 'left:50%', 'transform:translateX(-50%)',
			'color:rgba(255,255,255,0.6)', 'font:bold 14px/1 monospace',
			'z-index:1000', 'pointer-events:none', 'user-select:none', 'display:none',
		].join( ';' );
		_hudContainer.appendChild( _ghostHudEl );

		if ( _ghostPlayer.hasGhost ) {

			const gt = _ghostPlayer.lapTime;
			const mins = Math.floor( gt / 60 );
			const secs = ( gt % 60 ).toFixed( 2 );
			_ghostHudEl.textContent = `Ghost: ${ mins }:${ secs.padStart( 5, '0' ) }`;
			_ghostHudEl.style.display = 'block';

		}

		// Wrap onLapComplete for ghost recording
		const _prevOnLapComplete = _raceMode.onLapComplete;
		_raceMode.onLapComplete = ( lap, time ) => {

			if ( _prevOnLapComplete ) _prevOnLapComplete( lap, time );

			const wasNewBest = _ghostRecorder.finishLap( time );
			if ( wasNewBest ) {

				_ghostPlayer.load( ghostTrackId );
				const gt = _ghostPlayer.lapTime;
				const mins = Math.floor( gt / 60 );
				const secs = ( gt % 60 ).toFixed( 2 );
				_ghostHudEl.textContent = `Ghost: ${ mins }:${ secs.padStart( 5, '0' ) }`;
				_ghostHudEl.style.display = 'block';

			}

			_ghostPlayer.restart();

		};

		// Ghost toggle in hamburger menu
		{

			const ghostSec = _settingsMenu._section( 'Ghost' );
			ghostSec.appendChild( _settingsMenu._toggleRowCustom(
				'Show Ghost',
				_settings.get( 'ghostEnabled' ) !== false,
				( v ) => {

					_settings.set( 'ghostEnabled', v );
					_ghostPlayer.setVisible( v );

				}
			) );
			_settingsMenu.addSection( ghostSec );

		}

		// Apply initial quality preset
		{

			const tier = _settings.get( 'quality' );
			const preset = PRESETS[ tier ];
			if ( preset ) {

				postFX.applyPreset( preset );
				dirLight.shadow.mapSize.setScalar( preset.shadowMapSize );
				dirLight.shadow.map = null;
				renderer.shadowMap.needsUpdate = true;
				renderer.setPixelRatio( TIER_PIXEL_RATIO[ tier ] );
				renderer.setSize( window.innerWidth, window.innerHeight );

			}

			window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'quality', value: tier } } ) );
			if ( _rearview?.setQualityTier ) _rearview.setQualityTier( tier );

		}

		// ── Camera toggle button ─────────────────────────────────────────────
		_camToggleBtn = document.createElement( 'div' );
		_camToggleBtn.style.cssText = 'position:fixed;top:16px;left:16px;z-index:100;width:44px;height:44px;border-radius:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
		_camToggleBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
		_camToggleBtn.addEventListener( 'pointerup', () => {

			_cam.cycleMode();

		} );
		_hudContainer.appendChild( _camToggleBtn );

		// ── Settings-changed listener ────────────────────────────────────────
		_addListener( window, 'settings-changed', ( e ) => {

			const { key, value } = e.detail;

			if ( key === 'quality' && postFX ) {

				if ( ! PRESETS[ value ] ) return;
				postFX.applyPreset( PRESETS[ value ] );
				dirLight.shadow.mapSize.setScalar( PRESETS[ value ].shadowMapSize );
				dirLight.shadow.map = null;
				renderer.shadowMap.needsUpdate = true;
				renderer.setPixelRatio( TIER_PIXEL_RATIO[ value ] );
				renderer.setSize( window.innerWidth, window.innerHeight );
				if ( _rearview?.setQualityTier ) _rearview.setQualityTier( value );

			}

			if ( key === 'cameraMode' ) {

				_cam.mode = value;

			}

			if ( key === 'aiCount' ) {

				const previousCount = _aiManager.count;
				_aiManager.setCount( value );

				const raceState = _raceMode?.getDisplayState?.().state ?? null;
				if ( _aiManager.count > 0 && _aiManager.count !== previousCount && raceState !== 'racing' ) {

					_aiManager.teleportToGrid( _vehicle );
					_aiManager.startRace();

				}

			}

			if ( key === 'difficulty' ) {

				_aiManager.rubberBandIntensity = value / 100;

			}

			if ( key === 'steeringAssist' ) {

				_vehicle.setSteeringAssist( value );

			}

		} );

		_audio.init( _cam.camera );
		_passByAudio = new PassByAudio( _audio.listener, _audio._sfxGain );

		// Apply saved volume settings
		const savedSfxVol = _settings.get( 'sfxVolume' );
		if ( savedSfxVol !== undefined ) _audio.setSfxVolume( savedSfxVol / 100 );
		const savedMusicVol = _settings.get( 'musicVolume' );
		if ( savedMusicVol !== undefined ) _audio.setMusicVolume( savedMusicVol / 100 );

		// Apply saved steering assist
		_vehicle.setSteeringAssist( !! _settings.get( 'steeringAssist' ) );

		// ── Juice particles (local player only) ──────────────────────────────
		_wallSparks = new WallSparks( scene );
		_boostBurst = new BoostBurst( scene );
		_itemPickupVFX = new ItemPickupVFX( scene );
		_haptics = new Haptics();

		// Wire item pickup feedback
		if ( _itemBoxManager ) _itemBoxManager.onPickup = ( x, z, powerupType ) => {

			_itemPickupVFX.emit( x, z, powerupType );
			_audio.playItemPickup();

		};

		_bodyToVehicle = new Map();

		// ── Combat system wiring ─────────────────────────────────────────────
		_combatManager = new CombatManager( { audio: _audio, cam: _cam, haptics: _haptics } );
		_damageSFX = ( _audio.listener && _audio.listener.context ) ? new DamageSFX( _audio.listener.context ) : null;
		_damageVFX = new DamageVFX( scene );
		_hudDamage = new HUDDamage();
		_explosionFXManager = new ExplosionFXManager( scene, { quality: _settings.get( 'quality' ) || 'high' } );
		_projectileManager = new ProjectileManager( scene, _combatManager, _explosionFXManager );
		_wreckManager = new WreckManager( scene, world );
		_eliminationManager = new EliminationManager();

		_combatManager.damageSFX = _damageSFX;
		_combatManager.damageVFX = _damageVFX;
		if ( _wrenchPickupManager ) _wrenchPickupManager._damageSFX = _damageSFX;

		_combatManager.onElimination = ( v ) => {

			_wreckManager.createWreck( v );
			_eliminationManager.eliminate( v );

		};

		_raceMode.eliminationManager = _eliminationManager;

		// Attach item slot to local vehicle
		if ( _vehicle ) _vehicle.itemSlot = new ItemSlotManager( _vehicle );

		// ── Contact listener (recreated each start with fresh refs) ──────────
		_contactListener = createContactListener( {
			vehicle: _vehicle,
			audio: _audio,
			cam: _cam,
			wallSparks: _wallSparks,
			haptics: _haptics,
			bodyToVehicle: _bodyToVehicle,
			combatManager: _combatManager,
		} );

		_timer = new THREE.Timer();

		// ── FPS display ──────────────────────────────────────────────────────
		_fpsDisplay = document.createElement( 'div' );
		_fpsDisplay.style.cssText = [
			'position:fixed', 'top:68px', 'left:16px',
			'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
			'padding:4px 10px', 'border-radius:6px', 'z-index:999', 'user-select:none',
		].join( ';' );
		_hudContainer.appendChild( _fpsDisplay );

		_draftingSystem = new DraftingSystem();
		_draftLines = new DraftLines( scene );

		// Pause key
		_addListener( document, 'keydown', ( e ) => {

			if ( e.code === 'KeyP' ) {

				_gamePaused = ! _gamePaused;

			}

		} );

		// ── Spectate button ──────────────────────────────────────────────────
		if ( spectateBtn ) {

			const spectateHandler = () => {

				if ( ! _multiplayer ) return;

				_spectating = ! _spectating;
				spectateBtn.textContent = _spectating ? 'Race' : 'Spectate';
				_network.sendSpectate( _spectating );

				_playerManager.setSpectating( _playerManager.localId, _spectating );

				if ( _spectating ) {

					_cam.spectatorTarget = _playerManager.getFirstActiveVehicle();

				} else {

					_cam.spectatorTarget = null;
					_afkDetector.reset();

				}

			};

			_addListener( spectateBtn, 'click', spectateHandler );

		}

		// Dismiss loading overlay
			const overlay = document.getElementById( 'loading-overlay' );
			if ( overlay ) {

				overlay.classList.add( 'fade-out' );
				setTimeout( () => overlay.remove(), 400 );

			}

		} catch ( err ) {

			try {

				stop();

			} catch ( stopErr ) {

				console.error( '[GameEngine] stop() during failed start also failed:', stopErr );

			}

			throw err;

		}

	}


	// ── stop() ───────────────────────────────────────────────────────────────

	function stop() {

		_running = false;

		// Remove all registered listeners
		for ( const entry of _listenerRegistry ) {

			entry.target.removeEventListener( entry.event, entry.handler, entry.options );

		}

		_listenerRegistry = [];

		// Dispose game-specific subsystems that have dispose()
		if ( _controls ) { _controls.dispose(); _controls = null; }
		if ( _wallSparks ) { _wallSparks.dispose(); _wallSparks = null; }
		if ( _boostBurst ) { _boostBurst.dispose(); _boostBurst = null; }
		if ( _itemPickupVFX ) { _itemPickupVFX.dispose(); _itemPickupVFX = null; }
		if ( _damageVFX ) { _damageVFX.dispose(); _damageVFX = null; }
		if ( _hudDamage ) { _hudDamage.dispose(); _hudDamage = null; }
		if ( _explosionFXManager ) { _explosionFXManager.dispose(); _explosionFXManager = null; }
		if ( _projectileManager ) { _projectileManager.dispose(); _projectileManager = null; }
		if ( _wreckManager ) { _wreckManager.dispose(); _wreckManager = null; }
		if ( _wrenchPickupManager ) { _wrenchPickupManager.dispose(); _wrenchPickupManager = null; }
		if ( _itemBoxManager ) { _itemBoxManager.dispose(); _itemBoxManager = null; }
		if ( _draftLines ) { _draftLines.dispose(); _draftLines = null; }
		if ( _rearview ) { _rearview.dispose(); _rearview = null; }
		if ( _ghostPlayer ) { _ghostPlayer.dispose(); _ghostPlayer = null; }
		if ( _aiManager ) { if ( _aiManager.dispose ) _aiManager.dispose(); _aiManager = null; }
		if ( _playerManager ) { if ( _playerManager.dispose ) _playerManager.dispose(); _playerManager = null; }

		// Dispose PostProcessing (nulled; resize handler has null guard)
		if ( postFX ) { postFX = null; }

		// Remove HUD container from DOM (cleans up all game DOM elements at once)
		if ( _hudContainer ) {

			_hudContainer.remove();
			_hudContainer = null;

		}

		// Remove debug groups from scene
		if ( _colliderDebugGroup ) { scene.remove( _colliderDebugGroup ); _colliderDebugGroup = null; }
		if ( _barrierDebugGroup ) { scene.remove( _barrierDebugGroup ); _barrierDebugGroup = null; }
		if ( _meshDebugGroup ) { scene.remove( _meshDebugGroup ); _meshDebugGroup = null; }
		if ( _tileLabelsGroup ) { scene.remove( _tileLabelsGroup ); _tileLabelsGroup = null; }
		if ( _heightLabelsGroup ) { scene.remove( _heightLabelsGroup ); _heightLabelsGroup = null; }
		if ( _routePathDebugGroup ) { _disposeDebugGroupChildren( _routePathDebugGroup ); scene.remove( _routePathDebugGroup ); _routePathDebugGroup = null; }
		if ( _aiTargetDebugGroup ) { _disposeDebugGroupChildren( _aiTargetDebugGroup ); scene.remove( _aiTargetDebugGroup ); _aiTargetDebugGroup = null; }
		if ( _groundIndicator ) { scene.remove( _groundIndicator ); _groundIndicator = null; }
		if ( _dirLightTarget ) { scene.remove( _dirLightTarget ); _dirLightTarget = null; }

		// Remove track meshes from scene, dispose geometries/materials
		if ( _trackGroup ) {

			_trackGroup.traverse( ( child ) => {

				if ( child.isMesh || child.isInstancedMesh ) {

					if ( child.geometry ) child.geometry.dispose();
					if ( child.material ) {

						if ( Array.isArray( child.material ) ) {

							child.material.forEach( ( m ) => m.dispose() );

						} else {

							child.material.dispose();

						}

					}

				}

			} );

			scene.remove( _trackGroup );
			_trackGroup = null;

		}

		// Reset physics bodies (teleport to depth, keep world alive)
		if ( _trackedBodies.length > 0 ) {

			resetPhysicsWorld( world, _trackedBodies );
			_trackedBodies = [];

		}

		// Null out remaining game refs
		_vehicle = null;
		_trackSupportBody = null;
		_trackBlockerBody = null;
		_audio = null;
		_raceMode = null;
		_raceLobby = null;
		_afkDetector = null;
		_hud = null;
		_trackIntel = null;
		_minimap = null;
		if ( _network ) _network.disconnect();
		_network = null;
		_combatManager = null;
		_damageSFX = null;
		_eliminationManager = null;
		_haptics = null;
		_passByAudio = null;
		_settings = null;
		_settingsMenu = null;
		_speedometer = null;
		_ghostRecorder = null;
		_adaptiveQuality = null;
		_draftingSystem = null;
		_contactListener = null;
		_bodyToVehicle = null;
		_timer = null;
		_fpsDisplay = null;
		_draftIndicator = null;
		_jitterDisplay = null;
		_ghostHudEl = null;
		_camToggleBtn = null;
		_debugCollider = null;
		_wheelDebug = null;
		_debugMenu = null;
		_cam = null;

	}


	// ── update(dt) — called externally by the host rAF loop ──────────────────

	function update( externalDt ) {

		if ( ! _running ) return;
		if ( ! _timer || ! _controls || ! _raceMode || ! _playerManager || ! _aiManager || ! _bodyToVehicle || ! _contactListener || ! _cam ) return;

		// Optional FPS cap
		if ( _fpsCapMs.value > 0 ) {

			const nowCap = performance.now();
			if ( nowCap - _lastFrameTime < _fpsCapMs.value ) return;
			_lastFrameTime = nowCap;

		}

		_fpsFrames ++;
		const now = performance.now();
		if ( now - _fpsTime >= 500 ) {

			const measuredFps = _fpsFrames / ( ( now - _fpsTime ) / 1000 );
			if ( _fpsDisplay ) _fpsDisplay.textContent = measuredFps.toFixed( 0 ) + ' FPS' + ( _gamePaused ? ' (PAUSED)' : '' );
			if ( _adaptiveQuality ) _adaptiveQuality.sample( measuredFps );
			_fpsFrames = 0;
			_fpsTime = now;

		}

		_timer.update();
		const dt = Math.min( _timer.getDelta(), 1 / 30 );

		if ( _gamePaused ) {

			renderer.render( scene, _cam.camera );
			return;

		}

		const rawInput = _controls.update();
		const input = _raceMode.filterInput( rawInput );

		// Rebuild body->vehicle lookup for contact listener
		_bodyToVehicle.clear();
		for ( const v of _playerManager.getActiveVehicles() ) {

			if ( v.vehicle.rigidBody ) _bodyToVehicle.set( v.vehicle.rigidBody, v.vehicle );

		}

		for ( const v of _aiManager.getActiveVehicles() ) {

			if ( v.vehicle.rigidBody ) _bodyToVehicle.set( v.vehicle.rigidBody, v.vehicle );

		}

		updateWorld( world, _contactListener, dt );

		_playerManager.update( dt, _spectating ? SPECTATE_INPUT : input );

		// Ghost: record vehicle state each frame
		if ( ! _spectating && _vehicle ) {

			_ghostRecorder.record( _vehicle );

		}

		_aiManager.update( dt, _vehicle, _raceMode.state, _raceMode.lap );

		// ── Item box pickups ─────────────────────────────────────────────────
		if ( ! _spectating && _itemBoxManager ) {

			const totalRacers = _allActiveVehicles.length || 1;
			const posRatio = Math.max( 0, ( _raceMode.getDisplayState().position - 1 ) / ( totalRacers - 1 || 1 ) );
			_itemBoxManager.setPositionRatio( posRatio );
			_itemBoxManager.update( dt, _vehicle );

		}

		// ── Combat system updates ────────────────────────────────────────────
		_combatManager.update( dt );
		_projectileManager.update( dt, _allActiveVehicles );
		_wreckManager.update( dt );
		if ( ! _spectating && _wrenchPickupManager ) _wrenchPickupManager.update( dt, _vehicle );
		if ( ! _spectating && _vehicle ) _damageVFX.update( dt, _vehicle );

		// ── Item use ─────────────────────────────────────────────────────────
		if ( ! _spectating && _vehicle && input.useItem && _vehicle.itemSlot && _vehicle.itemSlot.hasItem() ) {

			const desc = _vehicle.itemSlot.use( _allActiveVehicles, _trackIntel, _projectileManager, _combatManager );
			if ( desc ) _projectileManager.spawn( desc );
			input.useItem = false;

		}

		// ── AI combat refs + AI item use + AI item grant ─────────────────────
		const wrenchPositions = _wrenchPickupManager ? _wrenchPickupManager.getAvailablePositions() : [];
		if ( _aiManager._racers ) {

			for ( const ai of _aiManager._racers ) {

				if ( ai.controller && ai.controller.setCombatRefs ) {

					ai.controller.setCombatRefs( _allActiveVehicles, wrenchPositions );

				}

				if ( ai.vehicle && ai.vehicle.itemSlot && ! ai.vehicle.itemSlot.hasItem() && Math.random() < dt / 8 ) {

					ai.vehicle.itemSlot.receive( rollItem( 0.5 ).id );

				}

				if ( ai.vehicle && ai.vehicle.itemSlot && ai.controller && ai.controller._input && ai.controller._input.useItem && ai.vehicle.itemSlot.hasItem() ) {

					const desc = ai.vehicle.itemSlot.use( _allActiveVehicles, _trackIntel, _projectileManager, _combatManager );
					if ( desc ) _projectileManager.spawn( desc );

				}

			}

		}

		// ── Boost activation feedback ────────────────────────────────────────
		if ( ! _spectating && _vehicle ) {

			const boostJustActivated = _vehicle.boostActive && ! _wasBoostActive;
			const boostJustEnded = ! _vehicle.boostActive && _wasBoostActive;

			if ( boostJustActivated ) {

				if ( _vehicle.underglowLight ) {

					if ( ! window.isMobile ) _vehicle.underglowLight.visible = true;
					_vehicle.underglowLight.color.setHex( 0xff8800 );

				}
				_audio.playBoostWhoosh();

				_boostFwd.set( 0, 0, 1 ).applyQuaternion( _vehicle.container.quaternion );
				_boostBurst.emit( _vehicle.container.position, _boostFwd.x, _boostFwd.z );

			}

			if ( boostJustEnded && _vehicle.underglowLight ) {

				_vehicle.underglowLight.visible = false;
				_vehicle.underglowLight.color.setHex( 0x00ffff );

			}

			_wasBoostActive = _vehicle.boostActive;

			if ( _vehicle.driftStage !== _prevDriftStage && _vehicle.driftStage > _prevDriftStage ) {

				_haptics.pulse();

			}

			_prevDriftStage = _vehicle.driftStage;

		}

		// ── Juice updates ────────────────────────────────────────────────────
		_haptics.update( dt );
		if ( ! _spectating && _vehicle ) _haptics.setRumble( Math.abs( _vehicle.linearSpeed ) );
		_wallSparks.update( dt );
		_boostBurst.update( dt );
		_itemPickupVFX.update( dt );

		_allActiveVehicles.length = 0;
		for ( const v of _playerManager.getActiveVehicles() ) _allActiveVehicles.push( v );
		for ( const v of _aiManager.getActiveVehicles() ) _allActiveVehicles.push( v );

		if ( ! _spectating ) _contactListener.checkVehicleBumps( _allActiveVehicles );

		if ( ! _spectating ) _passByAudio.update( dt, _vehicle, _allActiveVehicles );

		_draftingSystem.update( dt, _allActiveVehicles );
		_draftLines.update( dt, _draftingSystem.getActiveDrafts(), _draftingSystem.getProximityLeads() );

		_raceMode.update( dt, _vehicle, _playerManager.getHumanRaceData(), _aiManager.getAIRaceData() );

		// Ghost: update playback
		if ( _ghostPlayer.hasGhost ) {

			const ghostTime = _raceMode.state === 'racing' ? _raceMode.lapElapsed : ( _ghostPlayer._freeRoamTime = ( _ghostPlayer._freeRoamTime || 0 ) + dt );
			_ghostPlayer.update( ghostTime );
			if ( _ghostHudEl.style.display === 'none' && _settings.get( 'ghostEnabled' ) !== false ) {

				_ghostHudEl.style.display = 'block';

			}

		}

		if ( _raceMode.state === 'idle' ) {

			_raceLobby.update( dt, _playerManager.players, _playerManager.localId );

		}

		// AFK detector disabled during development — re-enable for release.
		// if ( ! _spectating ) {
		//
		// 	_afkDetector.update( dt, _vehicle );
		//
		// }

		_hud.update( dt, _raceMode.getDisplayState(), _raceLobby.getDisplayState() );
		if ( ! _spectating && _vehicle ) _hudDamage.update( _vehicle.health, _vehicle.itemSlot ? _vehicle.itemSlot.heldItemId : null, dt );
		_speedometer.update( dt, _vehicle.linearSpeed, _vehicle.momentum, _vehicle.boostActive, _vehicle.effectiveTopSpeed, _vehicle.debug.topSpeed );
		_minimap.update( _allActiveVehicles, _raceMode.getDisplayState().state );

		// Send local state to server
		if ( _multiplayer && _network.connected && ! _spectating ) {

			const state = _playerManager.getLocalState();
			if ( state ) _network.sendState( state );

		}

		// ── DEBUG updates ────────────────────────────────────────────────────
		_updateAITargetDebugOverlay();

		if ( _debugCollider && _vehicle ) {

			// Position debug box at the actual physics body position
			// (matches Vehicle.js rigidBody.setPosition)
			const lift = _vehicle._lastColliderLift ?? 0.8;
			const colliderY = ( _vehicle._vehicleY || 0 ) + lift;
			_debugCollider.position.set( _vehicle.vehPos.x, colliderY, _vehicle.vehPos.z );
			const yaw = Math.atan2(
				2 * ( _vehicle.container.quaternion.w * _vehicle.container.quaternion.y ),
				1 - 2 * ( _vehicle.container.quaternion.y * _vehicle.container.quaternion.y )
			);
			_debugCollider.rotation.set( 0, yaw, 0 );
			for ( const wd of _wheelDebug ) wd.boxH.update();

		}

		// Follow local vehicle or spectator target
		const followVehicle = _spectating ? _cam.spectatorTarget : _vehicle;

		if ( followVehicle ) {

			const vehPos = followVehicle.vehPos;
			const dsx = vehPos.x - _lastShadowX;
			const dsz = vehPos.z - _lastShadowZ;
			if ( dsx * dsx + dsz * dsz > 0.25 ) {

				dirLight.position.set(
					vehPos.x + _dirLightOffset.x,
					_dirLightOffset.y,
					vehPos.z + _dirLightOffset.z
				);
				_dirLightTarget.position.set( vehPos.x, 0, vehPos.z );
				_lastShadowX = vehPos.x;
				_lastShadowZ = vehPos.z;

			}

			// ── Gamepad camera controls ──────────────────────────────────────
			// Camera controls use rawInput so they work during countdown too
			if ( rawInput.orbitX ) _cam.orbitAngle -= rawInput.orbitX * 2.5 * dt;
			if ( rawInput.zoomIn ) _cam.zoom = Math.max( 0.35, _cam.zoom - 1.5 * dt );
			if ( rawInput.zoomOut ) _cam.zoom = Math.min( 3.0, _cam.zoom + 1.5 * dt );
			_cam.lookBehind = !! rawInput.lookBehind;

			// Edge-trigger: cycle camera view on Y press
			if ( rawInput.switchView && ! _prevSwitchView ) _cam.cycleMode();
			_prevSwitchView = !! rawInput.switchView;

			// Consume landing events for camera/audio/haptics feedback
			if ( _vehicle && _vehicle._landingEvent ) {

				const le = _vehicle._landingEvent;
				_cam.applyLandingImpact( le.severity, le.impactSpeed );
				if ( _audio ) _audio.playImpact( le.impactSpeed );
				if ( _haptics ) _haptics.impulse( le.impactSpeed / 8 );
				_vehicle._landingEvent = null;

			}

			if ( _vehicle && _vehicle._trickEvent ) {

				const te = _vehicle._trickEvent;

				if ( te.rewardGranted ) {

					if ( _audio ) _audio.playBoostWhoosh();
					if ( _boostBurst ) {

						_boostFwd.set( 0, 0, 1 ).applyQuaternion( _vehicle.container.quaternion );
						_boostBurst.emit( _vehicle.container.position, _boostFwd.x, _boostFwd.z );

					}
					if ( _haptics ) _haptics.impulse( 0.35 );

				}

				_vehicle._trickEvent = null;

			}

			_cam.update( dt, followVehicle.vehPos, followVehicle.container.quaternion, {
				inputX: followVehicle.inputX,
				linearSpeed: followVehicle.linearSpeed,
				boostActive: followVehicle.boostActive,
				bodyLeanRoll: followVehicle.debug.bodyLeanRoll,
				driftActive: followVehicle.driftActive,
				driftDirection: followVehicle.driftDirection,
			} );

			// Rearview mirror
			if ( _rearview.enabled && _cam.mode !== 'isometric' ) {

				_rearview.setVisible( true );
				_rearview.update( followVehicle.vehPos, followVehicle.container.quaternion );

			} else {

				_rearview.setVisible( false );

			}

		}

		_audio.update( dt, _vehicle ? _vehicle.linearSpeed : 0, input.z, _vehicle ? _vehicle.driftIntensity : 0 );

		// Draft wind audio
		if ( _vehicle ) {

			const playerDraft = _draftingSystem.getActiveDrafts().get( _vehicle );
			_audio.updateDraft( playerDraft ? playerDraft.intensity : 0 );

			if ( _draftIndicatorEnabled.value ) {

				if ( _vehicle.draftSpeedMultiplier > 1.0 ) {

					const pct = ( ( _vehicle.draftSpeedMultiplier - 1.0 ) * 100 ).toFixed( 0 );
					_draftIndicator.textContent = 'ACTIVE DRAFT +' + pct + '%';
					_draftIndicator.style.display = 'block';

				} else {

					_draftIndicator.style.display = 'none';

				}

			}

		}

		// Dynamic post-processing
		if ( postFX ) {

			const followV = _spectating ? _cam.spectatorTarget : _vehicle;
			postFX.update( dt, _cam.getVelocity(), followV ? followV.boostActive : false );

		}

		// Ground plane indicator
		if ( _groundIndicator && _groundIndicator.visible && _vehicle ) {

			_groundIndicator.position.set(
				_vehicle.container.position.x,
				_vehicle.groundHeight,
				_vehicle.container.position.z
			);

		}

		// Jitter diagnostic overlay
		if ( _jitterDisplay && _jitterDisplay.style.display !== 'none' && _vehicle && _vehicle.debugJitterInfo ) {

			const j = _vehicle.debugJitterInfo;
			const spike = j.lastSpike;
			const pos = _vehicle.container.position;
			_jitterDisplay.textContent =
				`pos:      ${ pos.x.toFixed( 2 ) }, ${ pos.y.toFixed( 2 ) }, ${ pos.z.toFixed( 2 ) }\n` +
				`vehY:     ${ _vehicle._vehicleY.toFixed( 4 ) }  Δ${ j.lastDelta >= 0 ? '+' : '' }${ j.lastDelta.toFixed( 4 ) }\n` +
				`gndH:     ${ _vehicle.groundHeight.toFixed( 4 ) }\n` +
				`rawAvg:   ${ j.rawAvg.toFixed( 4 ) }\n` +
				`grounded: ${ _vehicle._grounded }\n` +
				`spikes:   ${ j.spikeCount }/20\n` +
				( spike ? `last:     Δ${ spike.delta >= 0 ? '+' : '' }${ spike.delta.toFixed( 4 ) } spd=${ spike.speed.toFixed( 2 ) } gnd=${ spike.grounded }` : '' );

		}

		// Refresh shadow map every 3rd frame
		_shadowFrameCounter ++;
		if ( _shadowFrameCounter >= 3 ) {

			renderer.shadowMap.needsUpdate = true;
			_shadowFrameCounter = 0;

		}

		renderer.render( scene, _cam.camera );
		if ( _rearview && _rearview.enabled && _rearview.visible ) {

			_rearview.render( scene, postFX );

		}

	}

	function _getDebugAIState() {

		if ( ! _aiManager || ! _trackIntel ) return [];

		const debugEntries = _aiManager?.getAIDebugData ? _aiManager.getAIDebugData() : [];

		return ( _aiManager._racers || [] ).map( ( ai, index ) => {

			const controllerDebug = debugEntries[ index ]?.debugState || null;

			return {
			id: ai.id,
			profile: ai.profile?.name || 'Unknown',
			x: Number( ai.vehicle.vehPos.x.toFixed( 2 ) ),
			z: Number( ai.vehicle.vehPos.z.toFixed( 2 ) ),
			speed: Number( ai.vehicle.linearSpeed.toFixed( 2 ) ),
			yaw: Number( ai.vehicle.container.rotation.y.toFixed( 3 ) ),
			hint: ai.controller?._waypointHint ?? null,
			progress: Number( _trackIntel.getProgress( ai.vehicle.vehPos.x, ai.vehicle.vehPos.z ).toFixed( 4 ) ),
			lap: ai.lap,
			reversing: !! ai.controller?._reversing,
			inputX: Number( ( ai.controller?._input?.x ?? 0 ).toFixed( 3 ) ),
			inputZ: Number( ( ai.controller?._input?.z ?? 0 ).toFixed( 3 ) ),
			mode: controllerDebug?.mode || null,
			turnSeverity: controllerDebug ? Number( ( controllerDebug.turnSeverity ?? 0 ).toFixed( 3 ) ) : null,
			trafficOccupancy: controllerDebug ? Number( ( controllerDebug.trafficOccupancy ?? 0 ).toFixed( 3 ) ) : null,
			wallEscapeFactor: controllerDebug ? Number( ( controllerDebug.wallEscapeFactor ?? 0 ).toFixed( 3 ) ) : null,
			routeTarget: controllerDebug?.routeTarget || null,
			finalTarget: controllerDebug?.finalTarget || null,
			wrenchTarget: controllerDebug?.wrenchTarget || null,
		};

		} );

	}

	function _getDebugState() {

		const raceState = _raceMode?.getDisplayState ? _raceMode.getDisplayState() : null;
		const player = _vehicle ? {
			x: Number( _vehicle.vehPos.x.toFixed( 2 ) ),
			z: Number( _vehicle.vehPos.z.toFixed( 2 ) ),
			speed: Number( _vehicle.linearSpeed.toFixed( 2 ) ),
			yaw: Number( _vehicle.container.rotation.y.toFixed( 3 ) ),
			inputX: Number( ( _vehicle.inputX ?? 0 ).toFixed( 3 ) ),
			inputZ: Number( ( _vehicle.inputZ ?? 0 ).toFixed( 3 ) ),
		} : null;

		return {
			running: _running,
			multiplayer: _multiplayer,
			spectating: _spectating,
			trackIntelValid: !! _trackIntel?.valid,
			race: raceState ? {
				state: raceState.state ?? null,
				countdown: raceState.countdown ?? null,
				lap: raceState.lap ?? null,
				totalLaps: raceState.totalLaps ?? null,
				position: raceState.position ?? null,
				positionLabel: raceState.positionLabel ?? null,
			} : null,
			player,
			aiCount: _aiManager?.count ?? 0,
			ai: _getDebugAIState(),
		};

	}


	// ── Public API ───────────────────────────────────────────────────────────

	return {
		start,
		stop,
		update,
		getRenderer: () => renderer,
		getScene: () => scene,
		isRunning: () => _running,
		getDebugAIState: _getDebugAIState,
		getDebugState: _getDebugState,
	};

}
