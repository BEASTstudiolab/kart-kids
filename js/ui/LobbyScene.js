/**
 * LobbyScene — 3D environment rendered behind all menu tabs.
 *
 * Shares the WebGLRenderer from GameEngine — AppShell calls update(dt) from its
 * coordinator rAF loop; this class does NOT run its own requestAnimationFrame.
 *
 * Public API:
 *   constructor(renderer)       — set up scene, camera, lights
 *   setKart(kartId)             — load kart + character model, place in scene
 *   clearKart()                 — remove kart + character from scene
 *   update(dt)                  — render frame (static camera, no orbit)
 *   dispose()                   — clean up
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getVehicleById } from '../VehicleRegistry.js';

// Camera parameters — tuned from the lobby debug panel.
const CAM_POS  = new THREE.Vector3( 0, 1.5, 4.9 );
const LOOK_AT  = new THREE.Vector3( 0, 1.0, 0 );
const CAM_FOV  = 75;

// Kart placement
const KART_POS   = new THREE.Vector3( 0, 0.6, 0.9 );
const KART_SCALE = 0.9;

// Character model — rest armature has meshes, driving has the seated animation.
const CHARACTER_MESH_PATH = 'characters/Kart_Beast_Rest-Armature.glb';
const CHARACTER_ANIM_PATH = 'characters/Kart_Beast_Driving.glb';

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
		this._scene.fog = new THREE.FogExp2( 0x1a1a2e, 0.04 );

		// ── Lights ───────────────────────────────────────────────────────
		const ambient = new THREE.AmbientLight( 0xffffff, 0.8 );
		this._scene.add( ambient );

		const dir = new THREE.DirectionalLight( 0xffffff, 2.0 );
		dir.position.set( 5, 8, 3 );
		this._scene.add( dir );

		const rim = new THREE.DirectionalLight( 0x4488ff, 1.0 );
		rim.position.set( - 3, 2, - 4 );
		this._scene.add( rim );

		// ── Camera (static — no orbit) ───────────────────────────────────
		this._camera = new THREE.PerspectiveCamera(
			CAM_FOV,
			window.innerWidth / window.innerHeight,
			0.1,
			100
		);
		this._camera.position.copy( CAM_POS );
		this._camera.lookAt( LOOK_AT );

		// ── Lobby environment ────────────────────────────────────────────
		this._loader = new GLTFLoader();
		this._loader.load( 'models/environments/lobby.glb', ( gltf ) => {

			const lobbyModel = gltf.scene;

			// Remove placeholder objects (e.g. "Mirror" / Cube.006)
			const toRemove = [];
			lobbyModel.traverse( ( child ) => {

				const name = ( child.name || '' ).toLowerCase();
				if ( name === 'mirror' || name.includes( 'cube' ) || name.includes( 'placeholder' ) ) {

					toRemove.push( child );

				}

			} );

			for ( const obj of toRemove ) {

				obj.removeFromParent();

			}

			this._scene.add( lobbyModel );

		} );

		// ── Kart + character container ───────────────────────────────────
		this._kartGroup = new THREE.Group();
		this._kartGroup.position.copy( KART_POS );
		this._scene.add( this._kartGroup );

		/** @type {string | null} */
		this._currentKartId = null;

		/** @type {THREE.AnimationMixer | null} */
		this._mixer = null;

		// Handle resize
		this._onResize = () => {

			this._camera.aspect = window.innerWidth / window.innerHeight;
			this._camera.updateProjectionMatrix();

		};
		window.addEventListener( 'resize', this._onResize );

	}

	/**
	 * Load and display a kart model with the character seated on it.
	 * @param {string} kartId
	 */
	setKart( kartId ) {

		if ( kartId === this._currentKartId ) return;
		this._currentKartId = kartId;

		// Clear previous kart + character
		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

		const entry = getVehicleById( kartId );
		if ( ! entry ) return;

		// Load kart model, then attach character to the seat_anchor node
		// (same approach as Vehicle.js _attachCharacter).
		this._loader.load( `models/${ entry.path }`, ( kartGltf ) => {

			const kartModel = kartGltf.scene;
			kartModel.scale.setScalar( KART_SCALE );
			this._kartGroup.add( kartModel );

			// Find seat_anchor node inside the kart model
			let seatAnchor = null;
			kartModel.traverse( ( child ) => {

				const name = ( child.name || '' ).toLowerCase();
				if ( name === 'seat_anchor' || name.startsWith( 'seat_anchor.' ) ) {

					seatAnchor = child;

				}

			} );

			// Load character mesh and attach to seat anchor
			this._loader.load( `models/${ CHARACTER_MESH_PATH }`, ( meshGltf ) => {

				const character = meshGltf.scene;
				character.scale.setScalar( 1.0 );

				// Position: use seat_anchor if found, otherwise use characterOffset
				if ( seatAnchor ) {

					const offset = entry.characterOffset || { x: 0, y: 0, z: 0 };
					character.position.set( offset.x, offset.y, offset.z );
					seatAnchor.add( character );

				} else {

					const offset = entry.characterOffset || { x: 0, y: - 0.5, z: 0.3 };
					character.position.set( offset.x, offset.y, offset.z );
					kartModel.add( character );

				}

				// Apply driving pose animation
				this._loader.load( `models/${ CHARACTER_ANIM_PATH }`, ( animGltf ) => {

					if ( animGltf.animations && animGltf.animations.length > 0 ) {

						this._mixer = new THREE.AnimationMixer( character );
						const clip = animGltf.animations[ 0 ];
						const action = this._mixer.clipAction( clip );
						action.play();

						// Snap to first frame to hold seated pose
						this._mixer.update( 0 );
						action.paused = true;

					}

				} );

			} );

		} );

	}

	/**
	 * Remove the kart and character from the scene.
	 */
	clearKart() {

		this._currentKartId = null;
		this._mixer = null;

		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

	}

	/**
	 * Per-frame update — static camera, just render.
	 * @param {number} dt  Delta time in seconds.
	 */
	update( dt ) {

		this._renderer.render( this._scene, this._camera );

	}

	/**
	 * Clean up.
	 */
	dispose() {

		window.removeEventListener( 'resize', this._onResize );

	}

}
