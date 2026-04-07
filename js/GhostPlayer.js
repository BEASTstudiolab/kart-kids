import * as THREE from 'three';
import * as GhostStorage from './GhostStorage.js';


export class GhostPlayer {

	constructor( scene ) {

		this._scene = scene;
		this._mesh = null; // cloned vehicle model group
		this._frames = null; // Float32Array
		this._frameCount = 0;
		this._lapTime = 0;
		this._elapsed = 0;
		this._visible = true;
		this._loaded = false;

	}

	/**
	 * Initialize the ghost mesh from a vehicle model.
	 * Clones the model and makes all materials translucent.
	 */
	initMesh( vehicleModel ) {

		if ( this._mesh ) this._disposeMesh();

		this._mesh = vehicleModel.clone();

		// Make all materials translucent
		this._mesh.traverse( ( child ) => {

			if ( ! child.isMesh ) return;

			child.material = child.material.clone();
			child.material.transparent = true;
			child.material.opacity = 0.3;
			child.material.depthWrite = false;
			child.castShadow = false;
			child.receiveShadow = false;

		} );

		this._mesh.visible = false;
		this._scene.add( this._mesh );

	}

	/**
	 * Load a ghost recording for the given track.
	 * Returns true if a recording was found.
	 */
	load( trackId ) {

		const data = GhostStorage.load( trackId );

		if ( ! data ) {

			this._loaded = false;
			if ( this._mesh ) this._mesh.visible = false;
			return false;

		}

		this._frames = data.frames;
		this._frameCount = data.frameCount;
		this._lapTime = data.lapTime;
		this._elapsed = 0;
		this._loaded = true;

		if ( this._mesh && this._visible ) this._mesh.visible = true;

		return true;

	}

	/**
	 * Update ghost position based on elapsed lap time.
	 * Interpolates between recorded frames for smooth movement.
	 */
	update( lapElapsed ) {

		if ( ! this._loaded || ! this._mesh || ! this._visible || this._frameCount < 2 ) return;

		// Wrap elapsed time to loop the ghost (R7)
		const t = ( ( lapElapsed % this._lapTime ) + this._lapTime ) % this._lapTime;

		// Map time to frame index (ratio-based)
		const progress = t / this._lapTime;
		const rawIndex = progress * ( this._frameCount - 1 );
		const i0 = Math.floor( rawIndex );
		const i1 = Math.min( i0 + 1, this._frameCount - 1 );
		const frac = rawIndex - i0;

		// Read frame data (4 floats per frame: x, y, z, rotY)
		const base0 = i0 * 4;
		const base1 = i1 * 4;

		const x = this._frames[ base0 ] + ( this._frames[ base1 ] - this._frames[ base0 ] ) * frac;
		const y = this._frames[ base0 + 1 ] + ( this._frames[ base1 + 1 ] - this._frames[ base0 + 1 ] ) * frac;
		const z = this._frames[ base0 + 2 ] + ( this._frames[ base1 + 2 ] - this._frames[ base0 + 2 ] ) * frac;

		// Angle-wrap rotation interpolation to avoid spinning when crossing ±PI
		let dRot = this._frames[ base1 + 3 ] - this._frames[ base0 + 3 ];
		if ( dRot > Math.PI ) dRot -= Math.PI * 2;
		if ( dRot < - Math.PI ) dRot += Math.PI * 2;
		const rotY = this._frames[ base0 + 3 ] + dRot * frac;

		this._mesh.position.set( x, y, z );
		this._mesh.rotation.y = rotY;

	}

	/**
	 * Restart playback from the beginning.
	 */
	restart() {

		this._elapsed = 0;

	}

	/**
	 * Show or hide the ghost.
	 */
	setVisible( visible ) {

		this._visible = visible;

		if ( this._mesh ) {

			this._mesh.visible = visible && this._loaded;

		}

	}

	/**
	 * Get the ghost's lap time (for HUD display).
	 */
	get lapTime() {

		return this._loaded ? this._lapTime : 0;

	}

	/**
	 * Whether a ghost recording is loaded.
	 */
	get hasGhost() {

		return this._loaded;

	}

	/**
	 * Clean up resources.
	 */
	dispose() {

		this._disposeMesh();
		this._frames = null;
		this._loaded = false;

	}

	_disposeMesh() {

		if ( ! this._mesh ) return;

		this._mesh.traverse( ( child ) => {

			if ( child.isMesh ) child.material.dispose();

		} );

		this._mesh.removeFromParent();
		this._mesh = null;

	}

}
