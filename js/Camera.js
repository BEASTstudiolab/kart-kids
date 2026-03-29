import * as THREE from 'three';

const _chaseOffset = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();

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

		// Chase camera state
		this.mode = 'isometric'; // 'isometric' or 'chase'
		this.chaseDistance = 6;
		this.chaseHeight = 2;
		this.chaseLookAhead = 3;
		this.chaseSmooth = new THREE.Vector3();

		// Orbit state
		this.orbitAngle = 0;
		this.dragging = false;
		this.dragStartX = 0;
		this.yAxis = new THREE.Vector3( 0, 1, 0 );

		window.addEventListener( 'wheel', ( e ) => {

			this.zoom = THREE.MathUtils.clamp(
				this.zoom * ( 1 + e.deltaY * 0.001 ),
				0.5,
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

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 't' || e.key === 'T' ) {

				this.mode = this.mode === 'isometric' ? 'chase' : 'isometric';

			}

		} );

		window.addEventListener( 'resize', () => {

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();

		} );

	}

	update( dt, target, vehicleQuaternion ) {

		if ( this.mode === 'chase' && vehicleQuaternion ) {

			// Dynamic height: 0 at closest zoom (0.5), chaseHeight at default zoom (1.0)
			const zoomT = THREE.MathUtils.clamp( ( this.zoom - 0.5 ) / 0.5, 0, 1 );
			const dynamicHeight = this.chaseHeight * zoomT;

			// Behind offset: -Z is forward in Three.js convention, so backward is +Z (local)
			_chaseOffset.set( 0, dynamicHeight, - this.chaseDistance );
			_chaseOffset.applyQuaternion( vehicleQuaternion );
			_chaseOffset.multiplyScalar( this.zoom );
			_chaseOffset.add( target );

			// Smooth follow
			const smoothFactor = 1 - Math.exp( - 8 * dt );
			this.chaseSmooth.lerp( _chaseOffset, smoothFactor );
			this.camera.position.copy( this.chaseSmooth );

			// Look ahead of the vehicle
			_forward.set( 0, 0, this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );
			_lookTarget.copy( target ).add( _forward );
			_lookTarget.y += 1;
			this.camera.lookAt( _lookTarget );

		} else {

			// Isometric mode (original)
			this.targetPosition.lerp( target, dt * 4 );

			this.offset.copy( this.baseOffset ).applyAxisAngle( this.yAxis, this.orbitAngle ).multiplyScalar( this.zoom );
			this.camera.position.copy( this.targetPosition ).add( this.offset );
			this.camera.lookAt( this.targetPosition );

		}

	}

}
