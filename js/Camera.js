import * as THREE from 'three';

export class Camera {

	constructor() {

		this.camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 60 );

		// Matches Godot View: 45° azimuth, 35° elevation, distance 16
		this.baseOffset = new THREE.Vector3( 9.27, 9.18, 9.27 );
		this.zoom = 1.0;
		this.offset = new THREE.Vector3();
		this.targetPosition = new THREE.Vector3();

		this.camera.position.copy( this.baseOffset );
		this.camera.lookAt( 0, 0, 0 );

		// Orbit state
		this.orbitAngle = 0;
		this.dragging = false;
		this.dragStartX = 0;
		this.yAxis = new THREE.Vector3( 0, 1, 0 );

		window.addEventListener( 'wheel', ( e ) => {

			this.zoom = THREE.MathUtils.clamp(
				this.zoom * ( 1 + e.deltaY * 0.001 ),
				0.3,
				3.0
			);

		} );

		window.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );

		window.addEventListener( 'mousedown', ( e ) => {

			if ( e.button === 2 ) {

				this.dragging = true;
				this.dragStartX = e.clientX;

			}

		} );

		window.addEventListener( 'mousemove', ( e ) => {

			if ( ! this.dragging ) return;
			const dx = e.clientX - this.dragStartX;
			this.orbitAngle -= dx * 0.005;
			this.dragStartX = e.clientX;

		} );

		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 2 ) this.dragging = false;

		} );

		window.addEventListener( 'resize', () => {

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();

		} );

	}

	update( dt, target ) {

		this.targetPosition.lerp( target, dt * 4 );

		this.offset.copy( this.baseOffset ).applyAxisAngle( this.yAxis, this.orbitAngle ).multiplyScalar( this.zoom );
		this.camera.position.copy( this.targetPosition ).add( this.offset );
		this.camera.lookAt( this.targetPosition );

	}

}
