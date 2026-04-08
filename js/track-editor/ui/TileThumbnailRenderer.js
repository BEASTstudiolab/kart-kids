// ─── TileThumbnailRenderer ───────────────────────────────────────────────────
// Renders low-res isometric preview images of each tile model for the carousel.
// Uses a small offscreen Three.js renderer + camera.

import * as THREE from 'three';

const THUMB_SIZE = 72;

export class TileThumbnailRenderer {

	constructor() {

		this._renderer = new THREE.WebGLRenderer( { alpha: true, antialias: true } );
		this._renderer.setSize( THUMB_SIZE, THUMB_SIZE );
		this._renderer.setClearColor( 0x000000, 0 );

		this._scene = new THREE.Scene();

		// Isometric-ish camera
		const d = 8;
		this._camera = new THREE.OrthographicCamera( - d, d, d, - d, 0.1, 100 );
		this._camera.position.set( 10, 12, 10 );
		this._camera.lookAt( 0, 0, 0 );

		// Lighting
		this._scene.add( new THREE.AmbientLight( 0x606080, 0.8 ) );
		const dir = new THREE.DirectionalLight( 0xffffff, 1.5 );
		dir.position.set( 5, 10, 5 );
		this._scene.add( dir );

	}

	/**
	 * Render a tile model to a data URL.
	 * @param {import('three').Object3D} model  The source model (will be cloned)
	 * @returns {string}  PNG data URL
	 */
	render( model ) {

		if ( ! model ) return '';

		const clone = model.clone( true );

		// Center the model
		const box = new THREE.Box3().setFromObject( clone );
		const center = box.getCenter( new THREE.Vector3() );
		clone.position.sub( center );

		// Apply any base rotation
		if ( model.userData.rotationY ) {

			clone.rotation.y = model.userData.rotationY;

		}

		// Scale to fit
		const size = box.getSize( new THREE.Vector3() );
		const maxDim = Math.max( size.x, size.y, size.z );
		if ( maxDim > 10 ) {

			const scale = 10 / maxDim;
			clone.scale.multiplyScalar( scale );

		}

		this._scene.add( clone );
		this._renderer.render( this._scene, this._camera );
		this._scene.remove( clone );

		return this._renderer.domElement.toDataURL( 'image/png' );

	}

	dispose() {

		this._renderer.dispose();

	}

}
