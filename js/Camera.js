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
		this.mode = 'chase'; // 'isometric', 'chase', or 'spectator'
		this.chaseDistance = 6;
		this.chaseHeight = 2;
		this.chaseLookAhead = 3;
		this.chaseSmooth = new THREE.Vector3();

		// Spectator state
		this.spectatorTarget = null;

		// G-force camera effects
		this.gforceEnabled = true;
		this._prevGforceEnabled = true;
		this._currentRoll = 0;
		this._currentFOV = 40;
		this.baseFOV = 40;
		this._prevBoostActive = false;
		this._boostDelta = 0;
		this.rollIntensity = 0.35;
		this.fovNarrowMax = 8;
		this.boostPunchAmount = 8;
		this.attackRate = 3;
		this.releaseRate = 1.5;
		this.boostDecayRate = 3;

		// Screen shake state
		this._shakeOffset = new THREE.Vector3();
		this._shakeDecay = 0;
		this.MAX_SHAKE = 0.8;

		// Speed-reactive camera (Unit 1 — gameplay-juice-pass-plan.md)
		this.speedFOVMax = 12;
		this.speedDistMax = 1;
		this.baseChaseDistance = 6;
		this._currentChaseDistance = 6;

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

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.key === '+' || e.key === '=' ) {

				this.zoom = THREE.MathUtils.clamp( this.zoom - 0.1, 0.5, 3.0 );

			} else if ( e.key === '-' || e.key === '_' ) {

				this.zoom = THREE.MathUtils.clamp( this.zoom + 0.1, 0.5, 3.0 );

			}

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

	// Directional screen shake triggered by wall impacts.
	// normalX/normalZ: world-space contact normal XZ components (pointing away from wall).
	// magnitude: impact speed used to scale the shake amount.
	// Implements R6-R9 from docs/plans/2026-03-31-002-feat-gameplay-juice-pass-plan.md
	applyShake( normalX, normalZ, magnitude ) {

		const m = Math.min( magnitude * 0.05, this.MAX_SHAKE );
		this._shakeOffset.set( normalX * m, 0, normalZ * m );
		this._shakeDecay = 1;

	}

	update( dt, target, vehicleQuaternion, vehicleState = {} ) {

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

			// Screen shake: offset camera position by decaying shake vector after the lerp
			// but before lookAt(), so the look target stays fixed (directional shake feel).
			if ( this._shakeDecay > 0.01 ) {

				this.camera.position.copy( this.chaseSmooth ).addScaledVector( this._shakeOffset, this._shakeDecay );

			} else {

				this.camera.position.copy( this.chaseSmooth );

			}

			// Exponential decay -- ~150ms to near-zero at rate 15
			this._shakeDecay *= Math.exp( - 15 * dt );
			if ( this._shakeDecay < 0.01 ) this._shakeDecay = 0;

			// Look ahead of the vehicle
			_forward.set( 0, 0, this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );
			_lookTarget.copy( target ).add( _forward );
			_lookTarget.y += 1;
			this.camera.lookAt( _lookTarget );

			// G-force camera effects — applied after lookAt() which resets orientation.
			// Camera roll depends on default XYZ Euler rotation order where Z = roll.
			if ( this.gforceEnabled ) {

				const inputX = vehicleState.inputX ?? 0;
				const linearSpeed = vehicleState.linearSpeed ?? 0;
				const bodyLeanRoll = vehicleState.bodyLeanRoll ?? 5;
				const boostActive = vehicleState.boostActive ?? false;

				// Cornering lean signal: same formula as Vehicle.js updateBody()
				const rawLean = -( inputX / bodyLeanRoll ) * linearSpeed;
				const targetRoll = rawLean * this.rollIntensity;

				// Asymmetric smoothing: fast attack, slow release
				const rollRate = Math.abs( targetRoll ) > Math.abs( this._currentRoll )
					? this.attackRate : this.releaseRate;
				const rollSmooth = 1 - Math.exp( - rollRate * dt );
				this._currentRoll += ( targetRoll - this._currentRoll ) * rollSmooth;

				// Cornering FOV narrowing (delta from base)
				const maxLeanSignal = 0.2;
				const leanNorm = THREE.MathUtils.clamp( Math.abs( rawLean ) / maxLeanSignal, 0, 1 );
				const corneringDelta = this.fovNarrowMax * leanNorm;

				// Speed FOV delta: widens FOV toward baseFOV + speedFOVMax at top speed
				const speedDelta = this.speedFOVMax * THREE.MathUtils.clamp( Math.abs( linearSpeed ), 0, 1 );

				// Boost FOV punch — edge detection
				if ( boostActive && ! this._prevBoostActive ) {

					this._boostDelta = this.boostPunchAmount;

				}

				// Decay boost delta toward 0
				const boostSmooth = 1 - Math.exp( - this.boostDecayRate * dt );
				this._boostDelta += ( 0 - this._boostDelta ) * boostSmooth;

				// Additive FOV: base + speed widen + boost widen - cornering narrow
				const targetFOV = this.baseFOV + speedDelta + this._boostDelta - corneringDelta;

				// Asymmetric smoothing for FOV
				const fovRate = targetFOV < this._currentFOV
					? this.attackRate : this.releaseRate;
				const fovSmooth = 1 - Math.exp( - fovRate * dt );
				this._currentFOV += ( targetFOV - this._currentFOV ) * fovSmooth;

				// Speed-reactive chase distance: pulls camera back at speed
				const targetDist = this.baseChaseDistance + this.speedDistMax * THREE.MathUtils.clamp( Math.abs( linearSpeed ), 0, 1 );
				const distRate = targetDist > this._currentChaseDistance ? this.attackRate : this.releaseRate;
				const distSmooth = 1 - Math.exp( - distRate * dt );
				this._currentChaseDistance += ( targetDist - this._currentChaseDistance ) * distSmooth;
				this.chaseDistance = this._currentChaseDistance;

				// rotateZ applies roll around the camera's local forward axis,
				// which is correct after lookAt() has set the orientation.
				// Direct rotation.z assignment would corrupt the Euler decomposition.
				this.camera.rotateZ( this._currentRoll );
				this.camera.fov = this._currentFOV;
				this.camera.updateProjectionMatrix();

				this._prevBoostActive = boostActive;

			} else if ( this._prevGforceEnabled ) {

				// One-shot reset on transition from enabled to disabled
				this._currentRoll = 0;
				this._currentFOV = this.baseFOV;
				this._boostDelta = 0;
				this._currentChaseDistance = this.baseChaseDistance;
				this.chaseDistance = this.baseChaseDistance;
				this.camera.fov = this.baseFOV;
				this.camera.updateProjectionMatrix();
				// No rotation.z reset needed — lookAt() already produces zero-roll orientation

			}

			this._prevGforceEnabled = this.gforceEnabled;

		} else {

			// Isometric mode — reset G-force state to prevent leaking
			this.camera.fov = this.baseFOV;
			this.camera.updateProjectionMatrix();
			this._currentRoll = 0;
			this._currentFOV = this.baseFOV;
			this._boostDelta = 0;
			this._currentChaseDistance = this.baseChaseDistance;
			this.chaseDistance = this.baseChaseDistance;

			this.targetPosition.lerp( target, dt * 4 );

			this.offset.copy( this.baseOffset ).applyAxisAngle( this.yAxis, this.orbitAngle ).multiplyScalar( this.zoom );
			this.camera.position.copy( this.targetPosition ).add( this.offset );
			this.camera.lookAt( this.targetPosition );

		}

	}

}
