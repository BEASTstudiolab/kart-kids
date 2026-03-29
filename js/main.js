import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { Vehicle } from './Vehicle.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds } from './Track.js';
import { buildWallColliders, createSphereBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { GameAudio } from './Audio.js';


const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
bloomPass.strength = 0.02;
bloomPass.radius = 0.02;
bloomPass.threshold = 0.5;

renderer.setEffects( [ bloomPass ] );

document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xadb2ba );
scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
dirLight.position.set( 11.4, 15, -5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 4096 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 1.5 );
scene.add( hemiLight );


window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );

} );

const loader = new GLTFLoader();
const modelNames = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'track-straight', 'track-corner', 'track-bump', 'track-finish',
	'decoration-empty', 'decoration-forest', 'decoration-tents',
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

	registerAll();
	await loadModels();

	const mapParam = new URLSearchParams( window.location.search ).get( 'map' );
	let customCells = null;
	let spawn = null;

	if ( mapParam ) {

		try {

			customCells = decodeCells( mapParam );
			spawn = computeSpawnPosition( customCells );

		} catch ( e ) {

			console.warn( 'Invalid map parameter, using default track' );

		}

	}

	// Compute track bounds and size physics/shadows to fit
	const bounds = computeTrackBounds( customCells );
	const hw = bounds.halfWidth;
	const hd = bounds.halfDepth;
	const groundSize = Math.max( hw, hd ) * 2 + 20;

	const shadowExtent = Math.max( hw, hd ) + 10;
	dirLight.shadow.camera.left = - shadowExtent;
	dirLight.shadow.camera.right = shadowExtent;
	dirLight.shadow.camera.top = shadowExtent;
	dirLight.shadow.camera.bottom = - shadowExtent;
	dirLight.shadow.camera.updateProjectionMatrix();

	scene.fog.near = groundSize * 0.4;
	scene.fog.far = groundSize * 0.8;

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

	const roadHalf = groundSize / 2;
	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
		motionType: MotionType.STATIC,
		objectLayer: OL_STATIC,
		position: [ bounds.centerX, - 0.125, bounds.centerZ ],
		friction: 5.0,
		restitution: 0.0,
	} );

	const sphereBody = createSphereBody( world, spawn ? spawn.position : null );

	const vehicle = new Vehicle();
	vehicle.rigidBody = sphereBody;
	vehicle.physicsWorld = world;

	if ( spawn ) {

		const [ sx, sy, sz ] = spawn.position;
		vehicle.spherePos.set( sx, sy, sz );
		vehicle.prevModelPos.set( sx, 0, sz );
		vehicle.container.rotation.y = spawn.angle;

	}

	vehicle.forceWheelCorrection = true; // truck-yellow/green exported with flat wheels from Blender

	const vehicleGroup = vehicle.init( models[ 'vehicle-truck-yellow' ] );
	scene.add( vehicleGroup );

	const isMobile = 'ontouchstart' in window;
	let debugSphere = null;
	let wheelDebug = null;
	let hudVisible = false;

	if ( ! isMobile ) {

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
		const hud = document.createElement( 'div' );
		hud.style.cssText = [
			'position:fixed', 'top:12px', 'right:12px',
			'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
			'padding:10px 14px', 'border-radius:6px', 'pointer-events:none',
			'min-width:260px', 'white-space:pre', 'z-index:999',
		].join( ';' );
		document.body.appendChild( hud );

		hudVisible = true;
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'h' || e.key === 'H' ) {

				hudVisible = ! hudVisible;
				hud.style.display = hudVisible ? 'block' : 'none';

			}

		} );

		// ─── DEBUG CONTROLS PANEL (top-left, toggle with Z) ──────────────────────

		const debugPanel = document.createElement( 'div' );
		debugPanel.style.cssText = [
			'position:fixed', 'top:12px', 'left:12px',
			'background:rgba(0,0,0,0.72)', 'color:#0f0', 'font:13px/1.6 monospace',
			'padding:10px 14px', 'border-radius:6px', 'pointer-events:auto',
			'min-width:260px', 'z-index:999', 'user-select:none',
		].join( ';' );
		document.body.appendChild( debugPanel );

		debugPanel.addEventListener( 'keydown', ( e ) => e.stopPropagation() );
		debugPanel.addEventListener( 'keyup', ( e ) => e.stopPropagation() );

		function addCheckbox( parent, label, defaultVal, onChange ) {

			const row = document.createElement( 'div' );
			row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';

			const input = document.createElement( 'input' );
			input.type = 'checkbox';
			input.checked = defaultVal;
			input.style.cssText = 'accent-color:#0f0';

			const lbl = document.createElement( 'span' );
			lbl.textContent = label;

			input.addEventListener( 'change', () => onChange( input.checked ) );

			row.appendChild( input );
			row.appendChild( lbl );
			parent.appendChild( row );

		}

		function addSlider( parent, label, min, max, step, defaultVal, onChange ) {

			const row = document.createElement( 'div' );
			row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';

			const lbl = document.createElement( 'span' );
			lbl.style.cssText = 'min-width:100px';
			lbl.textContent = label;

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.min = min;
			input.max = max;
			input.step = step;
			input.value = defaultVal;
			input.style.cssText = 'flex:1;accent-color:#0f0';

			const val = document.createElement( 'span' );
			val.style.cssText = 'min-width:50px;text-align:right';
			val.textContent = Number( defaultVal ).toFixed( 2 );

			input.addEventListener( 'input', () => {

				const v = parseFloat( input.value );
				val.textContent = v.toFixed( 2 );
				onChange( v );

			} );

			row.appendChild( lbl );
			row.appendChild( input );
			row.appendChild( val );
			parent.appendChild( row );

		}

		// Title
		const debugTitle = document.createElement( 'div' );
		debugTitle.textContent = '─── DEBUG CONTROLS ─────────';
		debugTitle.style.marginBottom = '6px';
		debugPanel.appendChild( debugTitle );

		// Wheel axis locks
		const axisHeader = document.createElement( 'div' );
		axisHeader.textContent = 'Wheel rotation locks:';
		axisHeader.style.cssText = 'margin:6px 0 2px';
		debugPanel.appendChild( axisHeader );

		addCheckbox( debugPanel, 'Lock X', false, ( v ) => { vehicle.debug.lockX = v; } );
		addCheckbox( debugPanel, 'Lock Y (roll)', false, ( v ) => { vehicle.debug.lockY = v; } );
		addCheckbox( debugPanel, 'Lock Z (steer)', false, ( v ) => { vehicle.debug.lockZ = v; } );

		// Visibility toggles
		const visHeader = document.createElement( 'div' );
		visHeader.textContent = 'Debug visuals:';
		visHeader.style.cssText = 'margin:8px 0 2px';
		debugPanel.appendChild( visHeader );

		addCheckbox( debugPanel, 'Show physics sphere', false, ( v ) => {

			debugSphere.visible = v;

		} );

		addCheckbox( debugPanel, 'Show wheel debug', false, ( v ) => {

			for ( const wd of wheelDebug ) {

				wd.boxH.visible = v;
				wd.axes.visible = v;
				for ( const l of wd.labels ) l.visible = v;

			}

		} );

		// Height sliders
		const heightHeader = document.createElement( 'div' );
		heightHeader.textContent = 'Height offsets (Y axis):';
		heightHeader.style.cssText = 'margin:8px 0 2px';
		debugPanel.appendChild( heightHeader );

		addSlider( debugPanel, 'Wheel height', - 1.0, 1.0, 0.01, 0, ( v ) => { vehicle.debug.wheelHeight = v; } );
		addSlider( debugPanel, 'Body height', - 1.0, 1.0, 0.01, 0.2, ( v ) => { vehicle.debug.bodyHeight = v; } );
		addSlider( debugPanel, 'Underbody', - 2.0, 1.0, 0.01, - 0.5, ( v ) => { vehicle.debug.underbodyOffset = v; } );
		addSlider( debugPanel, 'Chase cam height', 0, 10.0, 0.1, 2, ( v ) => { cam.chaseHeight = v; } );
		addSlider( debugPanel, 'Zoom', 0.5, 3.0, 0.05, 1.0, ( v ) => { cam.zoom = v; } );
		addSlider( debugPanel, 'Acceleration', 1, 20, 0.5, 1, ( v ) => { vehicle.debug.accelerationRate = v; } );
		addSlider( debugPanel, 'Top speed', 10, 300, 5, 150, ( v ) => { vehicle.debug.topSpeed = v; } );

		// Footer
		const debugFooter = document.createElement( 'div' );
		debugFooter.textContent = '─── Press Z to toggle ──────';
		debugFooter.style.cssText = 'margin-top:6px;opacity:0.5';
		debugPanel.appendChild( debugFooter );

		let debugPanelVisible = false;
		debugPanel.style.display = 'none';
		window.addEventListener( 'keydown', ( e ) => {

			if ( ( e.key === 'z' || e.key === 'Z' ) &&
				! ( document.activeElement && debugPanel.contains( document.activeElement ) ) ) {

				debugPanelVisible = ! debugPanelVisible;
				debugPanel.style.display = debugPanelVisible ? 'block' : 'none';

			}

		} );

	}

	// ─────────────────────────────────────────────────────────────────────────
	dirLight.target = vehicleGroup;

	const cam = new Camera();
	cam.targetPosition.copy( vehicle.spherePos );

	const controls = new Controls();

	const particles = new SmokeTrails( scene );

	const audio = new GameAudio();
	audio.init( cam.camera );

	const _forward = new THREE.Vector3();

	const contactListener = {
		onContactAdded( bodyA, bodyB ) {

			if ( bodyA !== sphereBody && bodyB !== sphereBody ) return;

			_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			const impactVelocity = Math.abs( vehicle.modelVelocity.dot( _forward ) );
			audio.playImpact( impactVelocity );

		}
	};

	const timer = new THREE.Timer();

	function animate() {

		requestAnimationFrame( animate );

		timer.update();
		const dt = Math.min( timer.getDelta(), 1 / 30 );

		const input = controls.update();

		updateWorld( world, contactListener, dt );

		vehicle.update( dt, input );

		// ─── DEBUG updates (desktop only) ─────────────────────────────────────
		if ( debugSphere ) {

			debugSphere.position.copy( vehicle.spherePos );
			for ( const wd of wheelDebug ) wd.boxH.update();

		}
		// ───────────────────────────────────────────────────────────────────────

		dirLight.position.set(
			vehicle.spherePos.x + 11.4,
			15,
			vehicle.spherePos.z - 5.3
		);

		cam.update( dt, vehicle.spherePos, vehicle.container.quaternion );
		particles.update( dt, vehicle );
		audio.update( dt, vehicle.linearSpeed, input.z, vehicle.driftIntensity );

		renderer.render( scene, cam.camera );

	}

	animate();

}

init();
