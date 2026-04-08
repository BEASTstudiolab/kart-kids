/**
 * StartZoneMarker — Pulsing ring on the ground marking the race start zone.
 * Visible during free-roam, fades out when a race starts.
 */

import * as THREE from 'three';

const RING_INNER = 3.5;
const RING_OUTER = 4.5;
const PULSE_SPEED = 2.0;

export class StartZoneMarker {

	constructor( scene, position, halfExtent ) {

		const geo = new THREE.RingGeometry( RING_INNER, RING_OUTER, 48 );
		const mat = new THREE.MeshBasicMaterial( {
			color: 0x00ddff,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide,
			depthWrite: false,
		} );

		this._mesh = new THREE.Mesh( geo, mat );
		this._mesh.rotation.x = - Math.PI / 2; // lay flat
		this._mesh.position.set( position[ 0 ], 0.05, position[ 1 ] );
		scene.add( this._mesh );

		this._mat = mat;
		this._time = 0;
		this._visible = true;

		// Text label floating above
		this._label = this._createLabel();
		this._label.position.set( position[ 0 ], 2.5, position[ 1 ] );
		scene.add( this._label );

	}

	_createLabel() {

		const canvas = document.createElement( 'canvas' );
		canvas.width = 256;
		canvas.height = 64;
		const ctx = canvas.getContext( '2d' );
		ctx.font = 'bold 28px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#00ddff';
		ctx.fillText( 'RACE START', 128, 32 );

		const tex = new THREE.CanvasTexture( canvas );
		const mat = new THREE.SpriteMaterial( {
			map: tex,
			transparent: true,
			opacity: 0.7,
			depthWrite: false,
		} );

		const sprite = new THREE.Sprite( mat );
		sprite.scale.set( 4, 1, 1 );
		return sprite;

	}

	update( dt, raceActive ) {

		if ( raceActive && this._visible ) {

			this._visible = false;
			this._mesh.visible = false;
			this._label.visible = false;
			return;

		}

		if ( ! raceActive && ! this._visible ) {

			this._visible = true;
			this._mesh.visible = true;
			this._label.visible = true;

		}

		if ( ! this._visible ) return;

		this._time += dt * PULSE_SPEED;
		const pulse = 0.3 + 0.2 * Math.sin( this._time );
		this._mat.opacity = pulse;
		this._label.material.opacity = 0.5 + 0.2 * Math.sin( this._time );

	}

	dispose() {

		this._mesh.geometry.dispose();
		this._mat.dispose();
		this._mesh.removeFromParent();
		this._label.material.map.dispose();
		this._label.material.dispose();
		this._label.removeFromParent();

	}

}
