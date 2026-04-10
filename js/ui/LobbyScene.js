/**
 * LobbyScene — 3D environment rendered behind all menu tabs.
 *
 * Shares the WebGLRenderer from GameEngine — AppShell calls update(dt) from its
 * coordinator rAF loop; this class does NOT run its own requestAnimationFrame.
 *
 * Public API:
 *   constructor(renderer)       — set up scene, camera, lights
 *   setKart(kartId)             — load kart model, place in scene
 *   update(dt)                  — animate, render frame
 *   dispose()                   — clean up
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getVehicleById } from '../VehicleRegistry.js';

// Camera parameters
const CAM_DISTANCE = 6;
const CAM_HEIGHT   = 3;
const LOOK_HEIGHT  = 0.3;

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
		this._scene.fog = new THREE.FogExp2( 0x1a1a2e, 0.06 );

		// ── Lights ───────────────────────────────────────────────────────
		const ambient = new THREE.AmbientLight( 0xffffff, 0.8 );
		this._scene.add( ambient );

		const dir = new THREE.DirectionalLight( 0xffffff, 2.0 );
		dir.position.set( 5, 8, 3 );
		this._scene.add( dir );

		const rim = new THREE.DirectionalLight( 0x4488ff, 1.0 );
		rim.position.set( - 3, 2, - 4 );
		this._scene.add( rim );

		// ── Camera ───────────────────────────────────────────────────────
		this._camera = new THREE.PerspectiveCamera(
			40,
			window.innerWidth / window.innerHeight,
			0.1,
			100
		);
		this._camera.position.set( CAM_DISTANCE, CAM_HEIGHT, CAM_DISTANCE );
		this._camera.lookAt( 0, LOOK_HEIGHT, 0 );

		// ── Ground plane ─────────────────────────────────────────────────
		const groundGeo = new THREE.PlaneGeometry( 40, 40 );
		const groundMat = new THREE.MeshStandardMaterial( {
			color: 0x222244,
			roughness: 0.9,
			metalness: 0.1,
		} );
		const ground = new THREE.Mesh( groundGeo, groundMat );
		ground.rotation.x = - Math.PI / 2;
		ground.receiveShadow = true;
		this._scene.add( ground );

		// ── Kart container ───────────────────────────────────────────────
		this._kartGroup = new THREE.Group();
		this._scene.add( this._kartGroup );

		/** @type {string | null} */
		this._currentKartId = null;

		/** @type {GLTFLoader} */
		this._loader = new GLTFLoader();

		/** @type {number} elapsed time for gentle sway */
		this._elapsed = 0;

		// Handle resize
		this._onResize = () => {

			this._camera.aspect = window.innerWidth / window.innerHeight;
			this._camera.updateProjectionMatrix();

		};
		window.addEventListener( 'resize', this._onResize );

	}

	/**
	 * Load and display a kart model.
	 * @param {string} kartId
	 */
	setKart( kartId ) {

		if ( kartId === this._currentKartId ) return;
		this._currentKartId = kartId;

		// Clear previous
		while ( this._kartGroup.children.length > 0 ) {

			this._kartGroup.remove( this._kartGroup.children[ 0 ] );

		}

		const entry = getVehicleById( kartId );
		if ( ! entry ) return;

		this._loader.load( entry.model, ( gltf ) => {

			const model = gltf.scene;
			model.scale.setScalar( 0.5 );
			this._kartGroup.add( model );

		} );

	}

	/**
	 * Per-frame update — gentle camera sway, render.
	 * @param {number} dt  Delta time in seconds.
	 */
	update( dt ) {

		this._elapsed += dt;

		// Gentle camera orbit
		const angle = this._elapsed * 0.15;
		this._camera.position.x = Math.cos( angle ) * CAM_DISTANCE;
		this._camera.position.z = Math.sin( angle ) * CAM_DISTANCE;
		this._camera.position.y = CAM_HEIGHT + Math.sin( this._elapsed * 0.3 ) * 0.2;
		this._camera.lookAt( 0, LOOK_HEIGHT, 0 );

		this._renderer.render( this._scene, this._camera );

	}

	/**
	 * Clean up.
	 */
	dispose() {

		window.removeEventListener( 'resize', this._onResize );

	}

}
