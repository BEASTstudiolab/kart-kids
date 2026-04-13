/**
 * VehicleRespawn — Nearest-surface respawn flow.
 *
 * When the vehicle enters RESPAWNING state:
 * 1. Find the nearest waypoint to the vehicle's last grounded position
 * 2. Teleport vehicle to that waypoint, aligned to track forward
 * 3. Zero velocities, reset unstable state
 * 4. Brief invulnerability period
 * 5. Transition back to GROUNDED
 *
 * Falls back to hardcoded spawn [3.5, 0, 5] if TrackIntel unavailable.
 */

import { rigidBody } from 'crashcat';
import { getVehicleColliderCenterY } from '../Physics.js';
import { PhysicsState } from './VehicleStateMachine.js';

// Default fallback spawn position
const FALLBACK_SPAWN = { x: 3.5, y: 0.5, z: 5, yaw: 0 };


export class VehicleRespawn {

	constructor() {

		// Invulnerability after respawn
		this.invulnTimer = 0;
		this.invulnDuration = 1.0; // seconds

		// Respawn flow state
		this._respawnPending = false;
		this._respawnDelay = 0;      // brief pause before teleport
		this._respawnDelayMax = 0.2; // seconds

	}

	/**
	 * Check if vehicle is currently invulnerable from respawn.
	 */
	isInvulnerable() {

		return this.invulnTimer > 0;

	}

	/**
	 * Called when entering RESPAWNING state. Performs the respawn.
	 * @param {object} v - Vehicle instance
	 */
	execute( v ) {

		const trackIntel = v._trackIntel;
		let spawnX, spawnZ, spawnYaw;

		if ( trackIntel && trackIntel.valid ) {

			// Respawn at the nearest waypoint to where the vehicle last touched
			// the track — puts the player back close to where they fell off.
			const refPos = v._lastOnTrackPos || v.vehPos;
			const nearIdx = trackIntel.getNearestWaypoint( refPos.x, refPos.z );
			const info = trackIntel.getWaypointInfo( nearIdx );

			if ( info ) {

				spawnX = info.position.x;
				spawnZ = info.position.z;
				spawnYaw = Math.atan2( info.forward.x, info.forward.z );

			} else {

				// Fallback: first waypoint
				const first = trackIntel.getWaypointInfo( 0 );
				spawnX = first.position.x;
				spawnZ = first.position.z;
				spawnYaw = Math.atan2( first.forward.x, first.forward.z );

			}

		} else {

			// Fallback: hardcoded spawn
			spawnX = FALLBACK_SPAWN.x;
			spawnZ = FALLBACK_SPAWN.z;
			spawnYaw = FALLBACK_SPAWN.yaw;

		}

		// Teleport vehicle
		v.vehPos.set( spawnX, FALLBACK_SPAWN.y, spawnZ );
		v.vehVel.set( 0, 0, 0 );
		v._bumpVel.set( 0, 0, 0 );
		v._vehicleY = FALLBACK_SPAWN.y;
		v.groundHeight = FALLBACK_SPAWN.y;
		v.groundNormal.set( 0, 1, 0 );
		v._verticalVelocity = 0;
		v._groundVelocity = 0;
		v.linearSpeed = 0;
		v.angularSpeed = 0;
		v.acceleration = 0;
		v._airborneTimer = 0;
		v._launchCooldown = 0;
		v._offTrackTimer = 0;
		v._allWheelsMissTimer = 0;
		v._grounded = true;
		v._airborneWallContact = false;
		v._wallHitTime = 0;
		v._landingEvent = null;
		v._trickEvent = null;
		v._lastTrickResult = null;
		v._aerialHintTimer = 0;
		v._aerialHintText = 'HOLD DRIFT + TAP A DIRECTION';
		v._landingBounceVel = 0;
		v._landingBounceOffset = 0;
		v._landingSquash = 0;

		if ( v._groundRaycast?._targetNormal ) v._groundRaycast._targetNormal.set( 0, 1, 0 );
		if ( v._airborne ) {

			v._airborne.resetLaunchState( v );
			v._airborne.clearLandingCarry?.();
			v._airborne.lastImpactSpeed = 0;

		}
		if ( v._trick ) {

			v._trick.cancel( v );
			v.trickState = v._trick.getStateSnapshot();

		}

		// Clear powerup state
		v.shieldActive = false;
		v.shieldTimer = 0;
		v.starActive = false;
		v.starTimer = 0;

		// Reset drift
		v.drivingState = 0; // DrivingState.NORMAL
		v.driftActive = false;
		v.driftTimer = 0;
		v.driftSparkTier = 0;
		v.driftBoostTimer = 0;
		v.driftBoostMultiplier = 1.0;

		// Reset health
		if ( v.health ) v.health.reset();

		// Set rotation
		v.container.rotation.set( 0, 0, 0 );
		v.container.quaternion.identity();
		const halfYaw = spawnYaw / 2;
		v.container.quaternion.set( 0, Math.sin( halfYaw ), 0, Math.cos( halfYaw ) );
		if ( v.visualRoot ) v.visualRoot.rotation.set( 0, 0, 0 );

		// Sync physics body
		if ( v.rigidBody && v.physicsWorld ) {

			rigidBody.setPosition( v.physicsWorld, v.rigidBody,
				[ spawnX, FALLBACK_SPAWN.y + getVehicleColliderCenterY(), spawnZ ], false );
			rigidBody.setLinearVelocity( v.physicsWorld, v.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setAngularVelocity( v.physicsWorld, v.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setQuaternion( v.physicsWorld, v.rigidBody,
				[ 0, Math.sin( halfYaw ), 0, Math.cos( halfYaw ) ], false );

		}

		// Start invulnerability
		this.invulnTimer = this.invulnDuration;

		// Transition back to GROUNDED
		if ( v._stateMachine ) {

			v._stateMachine._recoveryDuration = 0;
			v._stateMachine.landingSeverity = 'clean';
			v._stateMachine.forceState( PhysicsState.GROUNDED );

		}

	}

	/**
	 * Per-frame update. Decrements invulnerability timer.
	 * @param {number} dt
	 */
	update( dt ) {

		if ( this.invulnTimer > 0 ) {

			this.invulnTimer -= dt;

		}

	}

}
