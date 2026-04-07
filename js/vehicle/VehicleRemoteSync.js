import * as THREE from 'three';
import { rigidBody } from 'crashcat';


export class VehicleRemoteSync {

	constructor() {

		this._targetPos = null;
		this._targetQuat = new THREE.Quaternion();
		this._targetVel = [ 0, 0, 0 ];
		this._targetAngVel = [ 0, 0, 0 ];
		this._targetSpeed = 0;
		this._targetDrift = 0;
		this._targetBoostActive = false;
		this._targetShieldActive = false;
		this._targetStarActive = false;
		this._renderPos = new THREE.Vector3();
		this._renderQuat = new THREE.Quaternion();
		this._remoteInitialized = false;

	}

	setTargetState( pos, rot, vel, angVel, speed, drift, boostActive, shield, star ) {

		this._targetPos = pos;
		this._targetQuat.set( rot[ 0 ], rot[ 1 ], rot[ 2 ], rot[ 3 ] );
		this._targetVel = vel;
		this._targetAngVel = angVel;
		this._targetSpeed = speed;
		this._targetDrift = drift;
		this._targetBoostActive = boostActive;
		this._targetShieldActive = shield;
		this._targetStarActive = star;

	}

	/**
	 * Serialize local vehicle state for network transmission.
	 * @param {object} v - The Vehicle instance
	 * @returns {object}
	 */
	getState( v ) {

		const angVel = v.rigidBody ? [ ...v.rigidBody.motionProperties.angularVelocity ] : [ 0, 0, 0 ];

		return {
			pos: [ v.vehPos.x, v.vehPos.y, v.vehPos.z ],
			rot: [ v.container.quaternion.x, v.container.quaternion.y, v.container.quaternion.z, v.container.quaternion.w ],
			vel: [ v.vehVel.x, v.vehVel.y, v.vehVel.z ],
			angVel,
			speed: v.linearSpeed,
			drift: v.driftIntensity,
			boost: v.boostActive,
			shield: v.shieldActive,
			star: v.starActive,
		};

	}

	/**
	 * Interpolate remote player toward latest server state.
	 * @param {number} dt
	 * @param {object} v - The Vehicle instance
	 */
	update( dt, v ) {

		if ( ! this._targetPos || ! v.rigidBody ) return;

		// On first target, snap to position instead of interpolating
		if ( ! this._remoteInitialized ) {

			this._renderPos.set( this._targetPos[ 0 ], this._targetPos[ 1 ], this._targetPos[ 2 ] );
			this._renderQuat.copy( this._targetQuat );
			this._remoteInitialized = true;

		}

		// Dead-reckon: advance render position using target velocity
		this._renderPos.x += this._targetVel[ 0 ] * dt;
		this._renderPos.y += this._targetVel[ 1 ] * dt;
		this._renderPos.z += this._targetVel[ 2 ] * dt;

		// Smooth correction toward latest server position (dt-independent)
		const correctionSpeed = 8; // higher = snappier, lower = smoother
		const t = 1 - Math.exp( - correctionSpeed * dt );

		this._renderPos.x += ( this._targetPos[ 0 ] - this._renderPos.x ) * t;
		this._renderPos.y += ( this._targetPos[ 1 ] - this._renderPos.y ) * t;
		this._renderPos.z += ( this._targetPos[ 2 ] - this._renderPos.z ) * t;

		this._renderQuat.slerp( this._targetQuat, t );

		// Update physics body for collisions (snap, don't fight the sim)
		rigidBody.setPosition( v.physicsWorld, v.rigidBody,
			[ this._renderPos.x, this._renderPos.y, this._renderPos.z ], false );
		rigidBody.setLinearVelocity( v.physicsWorld, v.rigidBody, this._targetVel );
		rigidBody.setAngularVelocity( v.physicsWorld, v.rigidBody, [ 0, 0, 0 ] );

		// Update visual position (decouple from physics readback)
		v.vehPos.copy( this._renderPos );
		v.vehVel.set( this._targetVel[ 0 ], this._targetVel[ 1 ], this._targetVel[ 2 ] );

		v.container.position.set(
			this._renderPos.x,
			this._renderPos.y,
			this._renderPos.z
		);
		v.container.quaternion.copy( this._renderQuat );

		// Drive animations from received state
		v.linearSpeed = THREE.MathUtils.lerp( v.linearSpeed, this._targetSpeed, t );
		v.driftIntensity = THREE.MathUtils.lerp( v.driftIntensity, this._targetDrift, t );
		v.acceleration = v.linearSpeed;

		// Derive synthetic drift state from interpolated driftIntensity for remote visuals
		if ( v.driftIntensity >= 2.5 ) v.driftSparkTier = 3;
		else if ( v.driftIntensity >= 1.5 ) v.driftSparkTier = 2;
		else if ( v.driftIntensity >= 0.5 ) v.driftSparkTier = 1;
		else v.driftSparkTier = 0;
		v.driftActive = v.driftSparkTier > 0;
		v.driftStage = v.driftSparkTier;

		// Sync remote boost and powerup state
		v.boostActive = this._targetBoostActive || false;
		v.shieldActive = this._targetShieldActive || false;
		v.starActive = this._targetStarActive || false;

		v.updateBody( dt );
		v.updateWheels( dt );

	}

}
