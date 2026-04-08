/**
 * VehicleRespawn — Checkpoint-aware respawn flow.
 *
 * When the vehicle enters RESPAWNING state:
 * 1. Compute current track progress
 * 2. Find nearest checkpoint behind current position
 * 3. Teleport vehicle to checkpoint position, aligned to track forward
 * 4. Zero velocities, reset unstable state
 * 5. Brief invulnerability period
 * 6. Transition back to GROUNDED
 *
 * Falls back to hardcoded spawn [3.5, 0, 5] if TrackIntel unavailable.
 */

import { rigidBody } from 'crashcat';
import { PhysicsState } from './VehicleStateMachine.js';

// Default fallback spawn position
const FALLBACK_SPAWN = { x: 3.5, y: 0.5, z: 5, yaw: 0 };


export class VehicleRespawn {

	constructor() {

		// Invulnerability after respawn
		this.invulnTimer = 0;
		this.invulnDuration = 2.0; // seconds

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

			// Find checkpoint behind current position
			const progress = trackIntel.getProgress(
				v.vehPos.x, v.vehPos.z, v._assistWaypointHint
			);
			const checkpoint = trackIntel.getNearestCheckpointBehind( progress );

			if ( checkpoint ) {

				spawnX = checkpoint.x;
				spawnZ = checkpoint.z;
				spawnYaw = Math.atan2( checkpoint.forward.x, checkpoint.forward.z );

			} else {

				// No checkpoints — use first waypoint
				const info = trackIntel.getWaypointInfo( 0 );
				spawnX = info.position.x;
				spawnZ = info.position.z;
				spawnYaw = Math.atan2( info.forward.x, info.forward.z );

			}

		} else {

			// Fallback: hardcoded spawn
			spawnX = FALLBACK_SPAWN.x;
			spawnZ = FALLBACK_SPAWN.z;
			spawnYaw = FALLBACK_SPAWN.yaw;

		}

		// Teleport vehicle with forward impulse so the player isn't a sitting target
		const respawnSpeed = 0.3;
		const fwdX = Math.sin( spawnYaw );
		const fwdZ = Math.cos( spawnYaw );
		const worldSpeed = respawnSpeed * v.debug.topSpeed / v.debug.speedScale;

		v.vehPos.set( spawnX, FALLBACK_SPAWN.y, spawnZ );
		v.vehVel.set( fwdX * worldSpeed, 0, fwdZ * worldSpeed );
		v._bumpVel.set( 0, 0, 0 );
		v._vehicleY = FALLBACK_SPAWN.y;
		v.groundHeight = FALLBACK_SPAWN.y;
		v._verticalVelocity = 0;
		v._groundVelocity = worldSpeed;
		v.linearSpeed = respawnSpeed;
		v.angularSpeed = 0;
		v.acceleration = 0;
		v._airborneTimer = 0;
		v._offTrackTimer = 0;
		v._allWheelsMissTimer = 0;
		v._grounded = true;

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

		// Sync physics body
		if ( v.rigidBody && v.physicsWorld ) {

			rigidBody.setPosition( v.physicsWorld, v.rigidBody,
				[ spawnX, FALLBACK_SPAWN.y + 0.8, spawnZ ], false );
			rigidBody.setLinearVelocity( v.physicsWorld, v.rigidBody,
				[ fwdX * worldSpeed, 0, fwdZ * worldSpeed ] );
			rigidBody.setAngularVelocity( v.physicsWorld, v.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setQuaternion( v.physicsWorld, v.rigidBody,
				[ 0, Math.sin( halfYaw ), 0, Math.cos( halfYaw ) ], false );

		}

		// Start invulnerability
		this.invulnTimer = this.invulnDuration;

		// Transition back to GROUNDED
		if ( v._stateMachine ) {

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
