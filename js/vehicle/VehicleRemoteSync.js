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
		this._targetDamage = null;
		this._renderPos = new THREE.Vector3();
		this._renderQuat = new THREE.Quaternion();
		this._remoteInitialized = false;
		this._angVelBuf = [ 0, 0, 0 ];

		// Reusable buffers for getState() to avoid per-send allocations
		this._posBuf = [ 0, 0, 0 ];
		this._rotBuf = [ 0, 0, 0, 0 ];
		this._velBuf = [ 0, 0, 0 ];
		this._angVelBuf = [ 0, 0, 0 ];
		this._damageBuf = [ 0, 0, 0, 0 ];

	}

	setTargetState( pos, rot, vel, angVel, speed, drift, boostActive, shield, star, damage ) {

		this._targetPos = pos;
		this._targetQuat.set( rot[ 0 ], rot[ 1 ], rot[ 2 ], rot[ 3 ] );
		this._targetVel = vel;
		this._targetAngVel = angVel;
		this._targetSpeed = speed;
		this._targetDrift = drift;
		this._targetBoostActive = boostActive;
		this._targetShieldActive = shield;
		this._targetStarActive = star;
		this._targetDamage = damage || null;

	}

	/**
	 * Serialize local vehicle state for network transmission.
	 * @param {object} v - The Vehicle instance
	 * @returns {object}
	 */
	getState( v ) {

		const pos = this._posBuf;
		pos[ 0 ] = v.vehPos.x; pos[ 1 ] = v.vehPos.y; pos[ 2 ] = v.vehPos.z;

		const rot = this._rotBuf;
		const q = v.container.quaternion;
		rot[ 0 ] = q.x; rot[ 1 ] = q.y; rot[ 2 ] = q.z; rot[ 3 ] = q.w;

		const vel = this._velBuf;
		vel[ 0 ] = v.vehVel.x; vel[ 1 ] = v.vehVel.y; vel[ 2 ] = v.vehVel.z;

		const angVel = this._angVelBuf;
		const src = v.rigidBody ? v.rigidBody.motionProperties.angularVelocity : null;
		if ( src ) { angVel[ 0 ] = src[ 0 ]; angVel[ 1 ] = src[ 1 ]; angVel[ 2 ] = src[ 2 ]; }
		else { angVel[ 0 ] = 0; angVel[ 1 ] = 0; angVel[ 2 ] = 0; }

		const dmg = this._damageBuf;
		const dmgSrc = v.damageDeform.getDamageState();
		dmg[ 0 ] = dmgSrc[ 0 ]; dmg[ 1 ] = dmgSrc[ 1 ]; dmg[ 2 ] = dmgSrc[ 2 ]; dmg[ 3 ] = dmgSrc[ 3 ];

		return {
			pos,
			rot,
			vel,
			angVel,
			speed: v.linearSpeed,
			drift: v.driftIntensity,
			boost: v.boostActive,
			shield: v.shieldActive,
			star: v.starActive,
			damage: dmg,
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

		// Snap if correction distance is too large (respawn, teleport, latency spike)
		const dx = this._targetPos[ 0 ] - this._renderPos.x;
		const dy = this._targetPos[ 1 ] - this._renderPos.y;
		const dz = this._targetPos[ 2 ] - this._renderPos.z;
		const distSq = dx * dx + dy * dy + dz * dz;

		let t = 1.0; // default: snap instantly (used when distSq > 25)

		if ( distSq > 25 ) { // 5m threshold squared

			this._renderPos.set( this._targetPos[ 0 ], this._targetPos[ 1 ], this._targetPos[ 2 ] );
			this._renderQuat.copy( this._targetQuat );

		} else {

			// Dead-reckon: advance render position using target velocity
			this._renderPos.x += this._targetVel[ 0 ] * dt;
			this._renderPos.y += this._targetVel[ 1 ] * dt;
			this._renderPos.z += this._targetVel[ 2 ] * dt;

			// Smooth correction toward latest server position (dt-independent)
			const correctionSpeed = 8; // higher = snappier, lower = smoother
			t = 1 - Math.exp( - correctionSpeed * dt );

			this._renderPos.x += ( this._targetPos[ 0 ] - this._renderPos.x ) * t;
			this._renderPos.y += ( this._targetPos[ 1 ] - this._renderPos.y ) * t;
			this._renderPos.z += ( this._targetPos[ 2 ] - this._renderPos.z ) * t;

			this._renderQuat.slerp( this._targetQuat, t );

		}

		// Update physics body for collisions (snap, don't fight the sim)
		// activate: true keeps the body awake so it participates in collision detection
		rigidBody.setPosition( v.physicsWorld, v.rigidBody,
			[ this._renderPos.x, this._renderPos.y, this._renderPos.z ], true );
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

		// Sync remote damage deformation
		if ( this._targetDamage ) v.damageDeform.update( dt, null, this._targetDamage );

		v.updateBody( dt );
		v.updateWheels( dt );

	}

}
