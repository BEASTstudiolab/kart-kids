/**
 * GaragePreview — lightweight 3D turntable preview for the Garage page.
 *
 * Creates its own THREE.Scene with neutral lighting (no fog, no post-processing).
 * Shares the WebGLRenderer from GameEngine — AppShell calls update(dt) from its
 * coordinator rAF loop; this class does NOT run its own requestAnimationFrame.
 *
 * Public API:
 *   constructor(renderer)       — set up scene, camera, lights
 *   setKart(kartId)             — load kart model, swap into scene
 *   update(dt)                  — rotate turntable, render frame
 *   dispose()                   — remove all objects, release references
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getVehicleById } from '../VehicleRegistry.js';

// Turntable parameters
const ORBIT_RADIUS   = 3.5;
const ORBIT_HEIGHT   = 1.8;
const ORBIT_SPEED    = 0.4;    // radians per second
const LOOK_AT_HEIGHT = 0.4;    // vertical offset for the look-at target

export class GaragePreview {

	/**
	 * @param {THREE.WebGLRenderer} renderer  Shared renderer from GameEngine.
	 */
	constructor( renderer ) {

		/** @type {THREE.WebGLRenderer} */
		this._renderer = renderer;

		// ── Scene ────────────────────────────────────────────────────────
		this._scene = new THREE.Scene();
		this._scene.background = new THREE.Color( 0x2a2a2a );

		// ── Lights ───────────────────────────────────────────────────────
		const ambient = new THREE.AmbientLight( 0xffffff, 1.2 );
		this._scene.add( ambient );

		const dir = new THREE.DirectionalLight( 0xffffff, 2.5 );
		dir.position.set( 4, 6, 3 );
		this._scene.add( dir );

		// ── Camera ───────────────────────────────────────────────────────
		this._camera = new THREE.PerspectiveCamera(
			40,
			window.innerWidth / window.innerHeight,
			0.1,
			100
		);

		// ── Turntable state ──────────────────────────────────────────────
		this._angle = 0;
		this._updateCameraPosition();

		// ── Model state ──────────────────────────────────────────────────
		/** @type {THREE.Object3D | null} */
		this._kartModel = null;

		/** @type {string | null} */
		this._currentKartId = null;

		/** @type {GLTFLoader} */
		this._loader = new GLTFLoader();

		/** @type {boolean} */
		this._disposed = false;

		// Listen for window resize to update camera aspect ratio.
		this._onResize = () => {

			this._camera.aspect = window.innerWidth / window.innerHeight;
			this._camera.updateProjectionMatrix();

		};

		window.addEventListener( 'resize', this._onResize );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Load a kart model by VehicleRegistry id and place it in the scene.
	 * If the same kart is already loaded, this is a no-op.
	 *
	 * @param {string} kartId  Vehicle id from VehicleRegistry (e.g. 'kart-1').
	 */
	setKart( kartId ) {

		if ( this._disposed ) return;
		if ( kartId === this._currentKartId ) return;

		// Remove existing model
		this._removeCurrentModel();

		this._currentKartId = kartId;

		const vehicleDef = getVehicleById( kartId );
		if ( ! vehicleDef ) {

			console.warn( '[GaragePreview] Unknown kart id:', kartId );
			return;

		}

		const modelPath = `models/${ vehicleDef.path }`;

		this._loader.load(
			modelPath,
			( gltf ) => {

				// Guard: if kart changed during async load or preview disposed
				if ( this._disposed || kartId !== this._currentKartId ) {

					gltf.scene.traverse( ( child ) => {

						if ( child.isMesh ) {

							child.geometry?.dispose();
							if ( Array.isArray( child.material ) ) {

								child.material.forEach( m => m.dispose() );

							} else {

								child.material?.dispose();

							}

						}

					} );
					return;

				}

				// Apply vehicle scale convention (root_scale = 0.5)
				gltf.scene.scale.setScalar( 0.5 );

				this._kartModel = gltf.scene;
				this._scene.add( this._kartModel );

			},
			undefined,
			( err ) => {

				console.error( '[GaragePreview] Failed to load kart model:', modelPath, err );

			}
		);

	}

	/**
	 * Called each frame by AppShell's render loop coordinator.
	 * Rotates the turntable camera and renders a frame.
	 *
	 * @param {number} dt  Delta time in seconds.
	 */
	update( dt ) {

		if ( this._disposed || ! this._renderer ) return;

		// Advance turntable angle
		this._angle += ORBIT_SPEED * dt;
		this._updateCameraPosition();

		// Render
		this._renderer.render( this._scene, this._camera );

	}

	/**
	 * Tear down the preview: remove models, lights, listeners.
	 */
	dispose() {

		if ( this._disposed ) return;
		this._disposed = true;

		window.removeEventListener( 'resize', this._onResize );

		this._removeCurrentModel();

		// Dispose all scene children (lights, etc.)
		while ( this._scene.children.length > 0 ) {

			this._scene.remove( this._scene.children[ 0 ] );

		}

		this._scene = null;
		this._camera = null;
		this._renderer = null;
		this._loader = null;

	}

	// ---------------------------------------------------------------------------
	// Internal
	// ---------------------------------------------------------------------------

	/**
	 * Update camera position on the circular orbit path.
	 */
	_updateCameraPosition() {

		this._camera.position.set(
			Math.cos( this._angle ) * ORBIT_RADIUS,
			ORBIT_HEIGHT,
			Math.sin( this._angle ) * ORBIT_RADIUS
		);

		this._camera.lookAt( 0, LOOK_AT_HEIGHT, 0 );

	}

	/**
	 * Remove and dispose the current kart model from the scene.
	 */
	_removeCurrentModel() {

		if ( ! this._kartModel ) return;

		this._scene.remove( this._kartModel );

		this._kartModel.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.geometry?.dispose();

				if ( Array.isArray( child.material ) ) {

					child.material.forEach( m => m.dispose() );

				} else {

					child.material?.dispose();

				}

			}

		} );

		this._kartModel = null;
		this._currentKartId = null;

	}

}
