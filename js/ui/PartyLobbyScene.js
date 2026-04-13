/**
 * PartyLobbyScene — 3D starting grid rendered behind the PARTY lobby overlay.
 *
 * Loads the trk-finish (3×1 starting tile) and displays karts in a pre-race
 * lineup. As players join, their karts appear; when they leave, karts are
 * removed. All karts are static — no physics, no driving.
 *
 * Shares the WebGLRenderer from GameEngine — AppShell calls update(dt) from
 * its coordinator rAF loop; this class does NOT run its own rAF.
 *
 * Public API:
 *   constructor(renderer)              — set up scene, camera, lights, load tile
 *   setLocalKart(kartId)               — load local player's kart at center
 *   addRemoteKart(playerId)            — add a remote player kart (color tint)
 *   removeKart(playerId)               — remove a player's kart
 *   clearAllKarts()                    — remove all karts
 *   update(dt)                         — render frame
 *   dispose()                          — clean up
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { getVehicleById } from '../VehicleRegistry.js';
import { applyPlayerAppearanceToNodes, createDefaultPlayerAppearance, normalizePlayerAppearance } from '../PlayerAppearance.js';

// ── Camera — elevated angle looking down at the starting grid ────────────
const CAM_POS  = new THREE.Vector3( 15, 2, -9.5 );
const LOOK_AT  = new THREE.Vector3( 15, 0, 5 );
const CAM_FOV  = 21;

// ── Character model paths ────────────────────────────────────────────────
const CHARACTER_MESH_PATH = 'characters/Kart_Beast_Rest-Armature.glb';
const CHARACTER_ANIM_PATH = 'characters/Kart_Beast_Driving.glb';

// ── Grid placement — karts line up across the tile width ─────────────────
// The trk-finish tile occupies 3 cells (30 units) centered at x=15 in a
// default placement (gx=0,1,2 → world x = 5, 15, 25).
// Karts are placed along the z-axis at the tile center, spread on x.
const GRID_CENTER_X = 15;
const GRID_Z        = 8;       // center of the tile
const GRID_Y        = 0;
const GRID_SPACING  = 1.8;    // lateral spacing between karts (tight for narrow FOV camera)
const KART_SCALE    = 0.5;    // root_scale matches Vehicle.js

// Color tints for remote karts (hue-shifted from base)
const REMOTE_TINTS = [
	new THREE.Color( 0x44bb44 ),  // green
	new THREE.Color( 0x8844cc ),  // purple
	new THREE.Color( 0xcc4444 ),  // red
	new THREE.Color( 0x44aacc ),  // cyan
	new THREE.Color( 0xccaa44 ),  // gold
];

export class PartyLobbyScene {

	/**
	 * @param {THREE.WebGLRenderer} renderer  Shared renderer from GameEngine.
	 */
	constructor( renderer ) {

		/** @type {THREE.WebGLRenderer} */
		this._renderer = renderer;

		/** @type {boolean} */
		this.ready = false;

		// ── Scene ────────────────────────────────────────────────────
		this._scene = new THREE.Scene();

		// Use the same sunshine skybox as the race
		this._scene.background = new THREE.CubeTextureLoader()
			.setPath( 'skybox/' )
			.load( [
				'jettelly_sunshine_RIGHT.png',
				'jettelly_sunshine_LEFT.png',
				'jettelly_sunshine_UP.png',
				'jettelly_sunshine_DOWN.png',
				'jettelly_sunshine_FRONT.png',
				'jettelly_sunshine_BACK.png',
			] );

		// Soft fog for depth
		this._scene.fog = new THREE.FogExp2( 0x87ceeb, 0.008 );

		// ── Lights ───────────────────────────────────────────────────
		const ambient = new THREE.AmbientLight( 0xffffff, 1.0 );
		this._scene.add( ambient );

		const sun = new THREE.DirectionalLight( 0xffffff, 2.0 );
		sun.position.set( 10, 15, 10 );
		this._scene.add( sun );

		const fill = new THREE.DirectionalLight( 0x88aaff, 0.5 );
		fill.position.set( - 5, 3, - 5 );
		this._scene.add( fill );

		// ── Camera ───────────────────────────────────────────────────
		this._camera = new THREE.PerspectiveCamera(
			CAM_FOV,
			window.innerWidth / window.innerHeight,
			0.5,
			200
		);
		this._camera.position.copy( CAM_POS );
		this._camera.lookAt( LOOK_AT );

		// ── Load starting tile ───────────────────────────────────────
		this._loader = new GLTFLoader();
		/** @type {THREE.Object3D | null} */
		this._tileModel = null;

		// Load the 3×1 finish tile
		this._loader.load( 'models/standard-map/kartkids_base_trk_510_srt_startfinish_arch_3x1.gltf', ( gltf ) => {

			const tile = gltf.scene;
			tile.position.set( 15, 0, 8 );
			this._scene.add( tile );
			this._tileModel = tile;
			this.ready = true;

		} );

		// Load 1×1 straight tiles extending behind the finish line.
		// Each row is 3 straights across (x = 5, 15, 25) at increasing z.
		const STRAIGHT_PATH = 'models/standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf';
		const EXTEND_ROWS = 15;

		this._loader.load( STRAIGHT_PATH, ( gltf ) => {

			for ( let row = 0; row < EXTEND_ROWS; row ++ ) {

				const z = 18 + row * 10;  // first row at z=18, then 28, 38...

				for ( const x of [ 5, 15, 25 ] ) {

					const clone = gltf.scene.clone();
					clone.position.set( x, 0, z );
					this._scene.add( clone );

				}

			}

		} );

		// ── Kart management ──────────────────────────────────────────
		/** @type {Map<string, { group: THREE.Group, slot: number }>} */
		this._karts = new Map();

		/** @type {number} Next color tint index for remote karts */
		this._nextTintIdx = 0;

		/** @type {number} generation counter for async load staleness */
		this._loadGen = 0;

		// Handle resize
		this._onResize = () => {

			this._camera.aspect = window.innerWidth / window.innerHeight;
			this._camera.updateProjectionMatrix();

		};
		window.addEventListener( 'resize', this._onResize );

		// Debug camera sliders
		this._debugPanel = null;
		this._buildDebugPanel();

	}

	// ---------------------------------------------------------------------------
	// Debug camera panel
	// ---------------------------------------------------------------------------

	_buildDebugPanel() {

		const panel = document.createElement( 'div' );
		panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:9999;background:rgba(0,0,0,0.85);color:#fff;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;display:flex;flex-direction:column;gap:6px;min-width:280px;';

		const title = document.createElement( 'div' );
		title.textContent = 'Camera Debug';
		title.style.cssText = 'font-weight:bold;font-size:14px;margin-bottom:4px;';
		panel.appendChild( title );

		const output = document.createElement( 'pre' );
		output.style.cssText = 'margin:0;font-size:11px;color:#aaa;white-space:pre;';
		this._debugOutput = output;

		const sliders = [
			{ label: 'Cam X',    target: 'camPos',  axis: 'x', min: -30, max: 50, step: 0.5 },
			{ label: 'Cam Y',    target: 'camPos',  axis: 'y', min: 0,   max: 30, step: 0.5 },
			{ label: 'Cam Z',    target: 'camPos',  axis: 'z', min: -30, max: 50, step: 0.5 },
			{ label: 'Look X',   target: 'lookAt',  axis: 'x', min: -20, max: 40, step: 0.5 },
			{ label: 'Look Y',   target: 'lookAt',  axis: 'y', min: -5,  max: 15, step: 0.5 },
			{ label: 'Look Z',   target: 'lookAt',  axis: 'z', min: -20, max: 30, step: 0.5 },
			{ label: 'FOV',      target: 'fov',     axis: null, min: 10,  max: 120, step: 1 },
			{ label: 'Tile X',   target: 'tilePos', axis: 'x', min: -20, max: 40, step: 0.5 },
			{ label: 'Tile Y',   target: 'tilePos', axis: 'y', min: -5,  max: 10, step: 0.5 },
			{ label: 'Tile Z',   target: 'tilePos', axis: 'z', min: -20, max: 30, step: 0.5 },
		];

		this._debugState = {
			camPos: { x: CAM_POS.x, y: CAM_POS.y, z: CAM_POS.z },
			lookAt: { x: LOOK_AT.x, y: LOOK_AT.y, z: LOOK_AT.z },
			fov:    CAM_FOV,
			tilePos: { x: 15, y: 0, z: 5 },
		};

		for ( const s of sliders ) {

			const row = document.createElement( 'div' );
			row.style.cssText = 'display:flex;align-items:center;gap:8px;';

			const lbl = document.createElement( 'span' );
			lbl.textContent = s.label;
			lbl.style.cssText = 'width:50px;flex-shrink:0;';
			row.appendChild( lbl );

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.min = s.min;
			input.max = s.max;
			input.step = s.step;
			input.style.cssText = 'flex:1;';

			const val = document.createElement( 'span' );
			val.style.cssText = 'width:40px;text-align:right;flex-shrink:0;';

			if ( s.target === 'fov' ) {

				input.value = this._debugState.fov;
				val.textContent = this._debugState.fov;

			} else {

				input.value = this._debugState[ s.target ][ s.axis ];
				val.textContent = this._debugState[ s.target ][ s.axis ];

			}

			input.addEventListener( 'input', () => {

				const v = parseFloat( input.value );
				val.textContent = v;

				if ( s.target === 'fov' ) {

					this._debugState.fov = v;

				} else {

					this._debugState[ s.target ][ s.axis ] = v;

				}

				this._applyDebugState();

			} );

			row.appendChild( input );
			row.appendChild( val );
			panel.appendChild( row );

		}

		// Copy button
		const copyBtn = document.createElement( 'button' );
		copyBtn.textContent = 'Copy Values';
		copyBtn.style.cssText = 'margin-top:6px;padding:6px;cursor:pointer;background:#444;color:#fff;border:1px solid #666;border-radius:4px;font-family:monospace;font-size:12px;';
		copyBtn.addEventListener( 'click', () => {

			const s = this._debugState;
			const text = `CAM_POS = new THREE.Vector3( ${ s.camPos.x }, ${ s.camPos.y }, ${ s.camPos.z } );\nLOOK_AT = new THREE.Vector3( ${ s.lookAt.x }, ${ s.lookAt.y }, ${ s.lookAt.z } );\nCAM_FOV = ${ s.fov };\ntile.position.set( ${ s.tilePos.x }, ${ s.tilePos.y }, ${ s.tilePos.z } );`;
			navigator.clipboard?.writeText( text );
			copyBtn.textContent = 'Copied!';
			setTimeout( () => { copyBtn.textContent = 'Copy Values'; }, 1500 );

		} );
		panel.appendChild( copyBtn );

		panel.appendChild( output );
		document.body.appendChild( panel );
		this._debugPanel = panel;

		this._applyDebugState();

	}

	_applyDebugState() {

		const s = this._debugState;

		this._camera.position.set( s.camPos.x, s.camPos.y, s.camPos.z );
		this._camera.fov = s.fov;
		this._camera.updateProjectionMatrix();
		this._camera.lookAt( s.lookAt.x, s.lookAt.y, s.lookAt.z );

		// Move the tile if loaded
		if ( this._tileModel ) {

			this._tileModel.position.set( s.tilePos.x, s.tilePos.y, s.tilePos.z );

		}

		if ( this._debugOutput ) {

			this._debugOutput.textContent = `pos(${s.camPos.x}, ${s.camPos.y}, ${s.camPos.z}) look(${s.lookAt.x}, ${s.lookAt.y}, ${s.lookAt.z}) fov:${s.fov}`;

		}

	}

	// ---------------------------------------------------------------------------
	// Grid placement — slot 0 = center, then alternate left/right
	// ---------------------------------------------------------------------------

	/**
	 * Compute world X position for a grid slot.
	 * Slot 0 = center, 1 = left, 2 = right, 3 = further left, etc.
	 * @param {number} slot
	 * @returns {number}
	 */
	_slotToX( slot ) {

		if ( slot === 0 ) return GRID_CENTER_X;

		// Odd slots go left, even slots go right
		const offset = Math.ceil( slot / 2 ) * GRID_SPACING;
		return slot % 2 === 1
			? GRID_CENTER_X - offset
			: GRID_CENTER_X + offset;

	}

	/**
	 * Get the next available slot index.
	 * @returns {number}
	 */
	_nextSlot() {

		const usedSlots = new Set();
		for ( const entry of this._karts.values() ) {

			usedSlots.add( entry.slot );

		}

		let slot = 0;
		while ( usedSlots.has( slot ) ) slot ++;
		return slot;

	}

	// ---------------------------------------------------------------------------
	// Kart loading
	// ---------------------------------------------------------------------------

	/**
	 * Load and display the local player's selected kart at center position.
	 * @param {string} kartId  Vehicle ID from VehicleRegistry.
	 */
	setLocalKart( kartId, appearance = null ) {

		this._loadKart( 'local', kartId, null, appearance );

	}

	/**
	 * Add a remote player's kart with a color tint.
	 * Uses the base vehicle model with a unique color.
	 * @param {string} playerId
	 */
	addRemoteKart( playerId, kartId, appearance = null ) {

		if ( this._karts.has( playerId ) ) return;

		const tint = REMOTE_TINTS[ this._nextTintIdx % REMOTE_TINTS.length ];
		this._nextTintIdx ++;

		this._loadKart( playerId, kartId || 'kart-1', tint, appearance );

	}

	/**
	 * Remove a kart from the scene.
	 * @param {string} playerId
	 */
	removeKart( playerId ) {

		const entry = this._karts.get( playerId );
		if ( ! entry ) return;

		this._scene.remove( entry.group );
		this._karts.delete( playerId );

	}

	/**
	 * Remove all karts from the scene.
	 */
	clearAllKarts() {

		for ( const [ id ] of this._karts ) {

			this.removeKart( id );

		}

	}

	/**
	 * Internal: load a kart model with character and place it in a grid slot.
	 * @param {string}            id     Player ID ('local' for local player)
	 * @param {string}            kartId Vehicle registry ID
	 * @param {THREE.Color|null}  tint   Optional fallback color tint for the model
	 * @param {object|null}       appearance
	 */
	_loadKart( id, kartId, tint, appearance = null ) {

		// Remove existing kart for this ID
		this.removeKart( id );

		const slot = id === 'local' ? 0 : this._nextSlot();
		const group = new THREE.Group();
		group.position.set( this._slotToX( slot ), GRID_Y, GRID_Z );
		group.rotation.y = Math.PI;  // face the racing direction
		this._scene.add( group );

		const gen = ++ this._loadGen;
		this._karts.set( id, { group, slot, gen } );

		const entry = getVehicleById( kartId );
		if ( ! entry ) return;
		const effectiveAppearance = normalizePlayerAppearance( appearance || createDefaultPlayerAppearance() );
		if ( ! effectiveAppearance.vehicleColor && tint ) {

			effectiveAppearance.vehicleColor = '#' + tint.getHexString();

		}

		this._loader.load( `models/${ entry.path }`, ( kartGltf ) => {

			const current = this._karts.get( id );
			if ( ! current || current.gen !== gen ) return;

			const kartModel = kartGltf.scene.clone();
			kartModel.scale.setScalar( KART_SCALE );

			group.add( kartModel );

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

			applyPlayerAppearanceToNodes( {
				bodyRoot: bodyNode || kartModel,
				characterRoot: null,
			}, effectiveAppearance );

			// Load character mesh and attach to seat anchor
			this._loader.load( `models/${ CHARACTER_MESH_PATH }`, ( meshGltf ) => {

				const cur = this._karts.get( id ); if ( ! cur || cur.gen !== gen ) return;

				const character = SkeletonUtils.clone( meshGltf.scene );
				character.scale.setScalar( 1.0 );

				if ( seatAnchor ) {

					const offset = entry.characterOffset || { x: 0, y: 0, z: 0 };
					character.position.set( offset.x, offset.y, offset.z );
					seatAnchor.add( character );

				} else {

					const offset = entry.characterOffset || { x: 0, y: - 0.5, z: 0.3 };
					character.position.set( offset.x, offset.y, offset.z );
					kartModel.add( character );

				}

				applyPlayerAppearanceToNodes( {
					bodyRoot: bodyNode || kartModel,
					characterRoot: character,
				}, effectiveAppearance );

				// Apply driving pose animation (snapped to first frame)
				this._loader.load( `models/${ CHARACTER_ANIM_PATH }`, ( animGltf ) => {

					const cur = this._karts.get( id ); if ( ! cur || cur.gen !== gen ) return;

					if ( animGltf.animations && animGltf.animations.length > 0 ) {

						const mixer = new THREE.AnimationMixer( character );
						const clip = animGltf.animations[ 0 ];
						const action = mixer.clipAction( clip );
						action.play();
						mixer.update( 0 );
						action.paused = true;

					}

				} );

			} );

		} );

	}

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	/**
	 * Per-frame update — render the scene.
	 * @param {number} dt  Delta time in seconds.
	 */
	update( dt ) { // eslint-disable-line no-unused-vars

		this._renderer.render( this._scene, this._camera );

	}

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	/**
	 * Full cleanup — remove all karts, detach resize listener.
	 */
	dispose() {

		this.clearAllKarts();
		window.removeEventListener( 'resize', this._onResize );

		if ( this._debugPanel ) {

			this._debugPanel.remove();
			this._debugPanel = null;

		}

		this._scene = null;
		this._camera = null;
		this._loader = null;
		this._karts = null;
		this._tileModel = null;

	}

}
