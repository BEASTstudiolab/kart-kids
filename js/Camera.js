import * as THREE from 'three';

const _chaseOffset = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _cockpitPos = new THREE.Vector3();

export class Camera {

	constructor() {

		this.camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1.5, 200 );

		// Default chase cam: 45° azimuth, 35° elevation, distance 16
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

		// Cockpit camera
		this.cockpitOffset = new THREE.Vector3( 0, 0.8, 0.3 );
		this.cockpitFOV = 75;
		this.cockpitNear = 0.1;
		this._cockpitRollIntensity = 0.15;

		// Dashboard camera (just behind steering wheel, looking over it)
		this.dashboardOffset = new THREE.Vector3( 0.0, 1.0, -0.05 );
		this.dashboardFOV = 80;
		this.dashboardNear = 0.01;

		// Chase camera near clip
		this.chaseNear = 1.5;

		// Look-behind (hold Backspace)
		this.lookBehind = false;

		// Velocity tracking for motion blur
		this.prevPosition = new THREE.Vector3();
		this._velocity = new THREE.Vector3();

		// Orbit state
		this.orbitAngle = 0;
		this.dragging = false;
		this.dragStartX = 0;
		this.yAxis = new THREE.Vector3( 0, 1, 0 );

		// Bound event handlers — stored for dispose() cleanup
		this._onWheel = ( e ) => {

			this.zoom = THREE.MathUtils.clamp(
				this.zoom * ( 1 + e.deltaY * 0.001 ),
				0.35,
				3.0
			);

		};

		this._onZoomKey = ( e ) => {

			if ( e.key === '+' || e.key === '=' ) {

				this.zoom = THREE.MathUtils.clamp( this.zoom - 0.1, 0.35, 3.0 );

			} else if ( e.key === '-' || e.key === '_' ) {

				this.zoom = THREE.MathUtils.clamp( this.zoom + 0.1, 0.35, 3.0 );

			}

		};

		this._onContextMenu = ( e ) => e.preventDefault();

		this._onMouseDown = ( e ) => {

			if ( e.button === 2 ) {

				this.dragging = true;
				this.dragStartX = e.clientX;

			}

		};

		this._onMouseMove = ( e ) => {

			if ( ! this.dragging ) return;
			const dx = e.clientX - this.dragStartX;
			this.orbitAngle -= dx * 0.0025;
			this.dragStartX = e.clientX;

		};

		this._onMouseUp = ( e ) => {

			if ( e.button === 2 ) this.dragging = false;

		};

		this._onCameraKey = ( e ) => {

			if ( e.key === 't' || e.key === 'T' ) {

				this.mode = ( this.mode === 'isometric' ) ? 'chase' : 'isometric';

			} else if ( e.key === 'c' || e.key === 'C' ) {

				this.cycleMode();

			} else if ( e.key === 'Backspace' ) {

				this.lookBehind = true;
				e.preventDefault();

			}

		};

		this._onKeyUp = ( e ) => {

			if ( e.key === 'Backspace' ) this.lookBehind = false;

		};

		this._onResize = () => {

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();

		};

		window.addEventListener( 'wheel', this._onWheel );
		window.addEventListener( 'keydown', this._onZoomKey );
		window.addEventListener( 'contextmenu', this._onContextMenu );
		window.addEventListener( 'mousedown', this._onMouseDown );
		window.addEventListener( 'mousemove', this._onMouseMove );
		window.addEventListener( 'mouseup', this._onMouseUp );
		window.addEventListener( 'keydown', this._onCameraKey );
		window.addEventListener( 'keyup', this._onKeyUp );
		window.addEventListener( 'resize', this._onResize );

	}

	dispose() {

		window.removeEventListener( 'wheel', this._onWheel );
		window.removeEventListener( 'keydown', this._onZoomKey );
		window.removeEventListener( 'contextmenu', this._onContextMenu );
		window.removeEventListener( 'mousedown', this._onMouseDown );
		window.removeEventListener( 'mousemove', this._onMouseMove );
		window.removeEventListener( 'mouseup', this._onMouseUp );
		window.removeEventListener( 'keydown', this._onCameraKey );
		window.removeEventListener( 'keyup', this._onKeyUp );
		window.removeEventListener( 'resize', this._onResize );

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

			// Auto-return orbit angle when not dragging
			if ( ! this.dragging && this.orbitAngle !== 0 ) {

				this.orbitAngle *= Math.exp( - 5 * dt );
				if ( Math.abs( this.orbitAngle ) < 0.001 ) this.orbitAngle = 0;

			}

			// Dynamic height: minimum 1.0 at closest zoom (0.35), chaseHeight at default zoom (1.0)
			const zoomT = THREE.MathUtils.clamp( ( this.zoom - 0.35 ) / 0.65, 0, 1 );
			const dynamicHeight = THREE.MathUtils.lerp( 1.0, this.chaseHeight, zoomT );

			// Dynamic near clip: smaller when zoomed in (avoids frame clipping),
			// larger when zoomed out (hides geometry the camera clips into)
			this.camera.near = THREE.MathUtils.lerp( 0.3, this.chaseNear, zoomT );
			this.camera.updateProjectionMatrix();

			// Camera offset: behind vehicle normally, in front when looking behind
			if ( this.lookBehind ) {

				_chaseOffset.set( 0, dynamicHeight, this.chaseDistance );

			} else {

				_chaseOffset.set( 0, dynamicHeight, - this.chaseDistance );

			}

			_chaseOffset.applyQuaternion( vehicleQuaternion );
			if ( ! this.lookBehind ) _chaseOffset.applyAxisAngle( this.yAxis, this.orbitAngle );
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

			// Look target: ahead normally, behind (past vehicle) when looking behind
			if ( this.lookBehind ) {

				_forward.set( 0, 0, - this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );

			} else {

				_forward.set( 0, 0, this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );
				_forward.applyAxisAngle( this.yAxis, this.orbitAngle );

			}

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
				const driftActive = vehicleState.driftActive ?? false;
				const driftDirection = vehicleState.driftDirection ?? 0;

				// Cornering lean signal: same formula as Vehicle.js updateBody()
				let rawLean = -( inputX / bodyLeanRoll ) * linearSpeed;

				// Drift camera: extra lean in drift direction
				if ( driftActive ) rawLean += driftDirection * 0.15;

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
				// Invert roll when looking behind (lean direction is perceptually reversed)
				this.camera.rotateZ( this.lookBehind ? - this._currentRoll : this._currentRoll );
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

		} else if ( this.mode === 'cockpit' && vehicleQuaternion ) {

			// Cockpit mode — rigid first-person view from driver head position
			_cockpitPos.copy( this.cockpitOffset ).applyQuaternion( vehicleQuaternion ).add( target );
			this.camera.position.copy( _cockpitPos );

			// Near clip tight for cockpit
			this.camera.near = this.cockpitNear;

			// Look forward or behind
			if ( this.lookBehind ) {

				_forward.set( 0, 0, - this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );

			} else {

				_forward.set( 0, 0, this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );

			}

			_lookTarget.copy( _cockpitPos ).add( _forward );
			_lookTarget.y += 0.2;
			this.camera.lookAt( _lookTarget );

			// G-force effects with reduced intensity
			if ( this.gforceEnabled ) {

				const inputX = vehicleState.inputX ?? 0;
				const linearSpeed = vehicleState.linearSpeed ?? 0;
				const bodyLeanRoll = vehicleState.bodyLeanRoll ?? 5;
				const boostActive = vehicleState.boostActive ?? false;
				const driftActive = vehicleState.driftActive ?? false;
				const driftDirection = vehicleState.driftDirection ?? 0;

				let rawLean = - ( inputX / bodyLeanRoll ) * linearSpeed;
				if ( driftActive ) rawLean += driftDirection * 0.15;

				const targetRoll = rawLean * this._cockpitRollIntensity;
				const rollRate = Math.abs( targetRoll ) > Math.abs( this._currentRoll )
					? this.attackRate : this.releaseRate;
				const rollSmooth = 1 - Math.exp( - rollRate * dt );
				this._currentRoll += ( targetRoll - this._currentRoll ) * rollSmooth;

				// Speed FOV
				const speedDelta = this.speedFOVMax * THREE.MathUtils.clamp( Math.abs( linearSpeed ), 0, 1 );

				// Boost punch
				if ( boostActive && ! this._prevBoostActive ) this._boostDelta = this.boostPunchAmount;
				const boostSmooth = 1 - Math.exp( - this.boostDecayRate * dt );
				this._boostDelta += ( 0 - this._boostDelta ) * boostSmooth;

				const targetFOV = this.cockpitFOV + speedDelta + this._boostDelta;
				const fovRate = targetFOV < this._currentFOV ? this.attackRate : this.releaseRate;
				const fovSmooth = 1 - Math.exp( - fovRate * dt );
				this._currentFOV += ( targetFOV - this._currentFOV ) * fovSmooth;

				this.camera.rotateZ( this.lookBehind ? - this._currentRoll : this._currentRoll );
				this.camera.fov = this._currentFOV;
				this.camera.updateProjectionMatrix();

				this._prevBoostActive = boostActive;

			} else {

				this.camera.fov = this.cockpitFOV;
				this.camera.updateProjectionMatrix();

			}

			this._prevGforceEnabled = this.gforceEnabled;

		} else if ( this.mode === 'dashboard' && vehicleQuaternion ) {

			// Dashboard mode — behind and above steering wheel so it's visible
			_cockpitPos.copy( this.dashboardOffset ).applyQuaternion( vehicleQuaternion ).add( target );
			this.camera.position.copy( _cockpitPos );

			this.camera.near = this.dashboardNear;

			if ( this.lookBehind ) {

				_forward.set( 0, 0, - this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );

			} else {

				_forward.set( 0, 0, this.chaseLookAhead ).applyQuaternion( vehicleQuaternion );

			}

			_lookTarget.copy( _cockpitPos ).add( _forward );
			this.camera.lookAt( _lookTarget );

			if ( this.gforceEnabled ) {

				const inputX = vehicleState.inputX ?? 0;
				const linearSpeed = vehicleState.linearSpeed ?? 0;
				const bodyLeanRoll = vehicleState.bodyLeanRoll ?? 5;
				const boostActive = vehicleState.boostActive ?? false;
				const driftActive = vehicleState.driftActive ?? false;
				const driftDirection = vehicleState.driftDirection ?? 0;

				let rawLean = - ( inputX / bodyLeanRoll ) * linearSpeed;
				if ( driftActive ) rawLean += driftDirection * 0.15;

				const targetRoll = rawLean * this._cockpitRollIntensity;
				const rollRate = Math.abs( targetRoll ) > Math.abs( this._currentRoll )
					? this.attackRate : this.releaseRate;
				const rollSmooth = 1 - Math.exp( - rollRate * dt );
				this._currentRoll += ( targetRoll - this._currentRoll ) * rollSmooth;

				const speedDelta = this.speedFOVMax * THREE.MathUtils.clamp( Math.abs( linearSpeed ), 0, 1 );

				if ( boostActive && ! this._prevBoostActive ) this._boostDelta = this.boostPunchAmount;
				const boostSmooth = 1 - Math.exp( - this.boostDecayRate * dt );
				this._boostDelta += ( 0 - this._boostDelta ) * boostSmooth;

				const targetFOV = this.dashboardFOV + speedDelta + this._boostDelta;
				const fovRate = targetFOV < this._currentFOV ? this.attackRate : this.releaseRate;
				const fovSmooth = 1 - Math.exp( - fovRate * dt );
				this._currentFOV += ( targetFOV - this._currentFOV ) * fovSmooth;

				this.camera.rotateZ( this.lookBehind ? - this._currentRoll : this._currentRoll );
				this.camera.fov = this._currentFOV;
				this.camera.updateProjectionMatrix();

				this._prevBoostActive = boostActive;

			} else {

				this.camera.fov = this.dashboardFOV;
				this.camera.updateProjectionMatrix();

			}

			this._prevGforceEnabled = this.gforceEnabled;

		} else if ( this.mode === 'topdown' ) {

			// Top-down debug view — looks straight down, scroll to zoom
			const height = ( this._topdownHeight ?? 80 ) * this.zoom;
			this.camera.fov = 50;
			this.camera.near = 1;
			this.camera.far = 500;
			this.camera.updateProjectionMatrix();

			this.camera.position.set( target.x, height, target.z );
			this.camera.rotation.set( - Math.PI / 2, 0, 0 );

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

		// Velocity tracking for motion blur
		this._velocity.copy( this.camera.position ).sub( this.prevPosition );
		if ( dt > 0 ) this._velocity.divideScalar( dt );
		this.prevPosition.copy( this.camera.position );

	}

	cycleMode() {

		if ( this.mode === 'chase' ) this.mode = 'cockpit';
		else if ( this.mode === 'cockpit' ) this.mode = 'dashboard';
		else if ( this.mode === 'dashboard' ) this.mode = 'isometric';
		else if ( this.mode === 'isometric' ) this.mode = 'chase';

	}

	getVelocity() {

		return this._velocity;

	}

}
