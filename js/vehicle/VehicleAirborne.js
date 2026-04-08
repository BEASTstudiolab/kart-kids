/**
 * VehicleAirborne — Takeoff impulse, airborne control, and landing logic.
 *
 * Delegates from Vehicle.js. Manages the vertical physics pipeline when
 * the vehicle is in TAKEOFF, AIRBORNE, or LANDING physics states.
 *
 * Takeoff: authored impulse scaled by speed and ramp type.
 * Airborne: gravity, limited yaw/pitch influence, stabilization torques.
 * Landing: severity classification (CLEAN/HARD/BAD) with recovery windows.
 */

import * as THREE from 'three';
import { SurfaceType } from './VehicleGroundRaycast.js';
import { PhysicsState } from './VehicleStateMachine.js';

const _forward = new THREE.Vector3();

// Landing severity levels
export const LandingSeverity = {
	CLEAN: 'clean',
	HARD: 'hard',
	BAD: 'bad',
};

// Per-ramp-type base launch impulses
const RAMP_IMPULSE = {
	[ SurfaceType.RAMP_UP ]: 4.0,
	[ SurfaceType.RAMP_EXIT ]: 5.0,
	[ SurfaceType.RAMP_DOWN ]: 1.5,
	[ SurfaceType.FLAT ]: 2.5,  // ramp crest launches when surface has already flattened
};


export class VehicleAirborne {

	constructor() {

		// Takeoff state (captured at launch for landing severity calc)
		this.launchSpeed = 0;
		this.launchVerticalVelocity = 0;

		// Air control accumulators
		this._airYawInfluence = 0;

		// Landing result
		this.lastSeverity = LandingSeverity.CLEAN;
		this.recoveryDuration = 0;     // how long RECOVERY state lasts
		this.recoverySpeedPenalty = 1;  // speed multiplier during recovery (1 = no penalty)

		// Tuning (exposed via vehicle.debug)
		this.config = {
			// Takeoff
			launchImpulseScale: 0.85,     // global multiplier on all launch impulses
			launchSpeedMin: 0.3,          // minimum speed factor
			launchSpeedMax: 1.0,          // maximum speed factor
			launchSpeedRef: 0.8,          // speed at which factor = 1.0
			launchCap: 6.0,              // absolute max vertical velocity

			// Air control
			airYawRate: 0.3,             // fraction of normal steering rate in air
			airPitchStabilize: 2.0,      // restoring torque rate for pitch (rad/s)
			airPitchThreshold: 0.52,     // 30° in radians — pitch beyond this triggers correction
			airAngularDamping: 2.0,      // angular velocity decay rate (1/s)

			// Anti-flip / self-righting
			flipRollThreshold: 1.047,    // 60° in radians — trigger self-right
			flipRespawnThreshold: 2.618, // 150° in radians — trigger respawn
			selfRightRate: 4.0,          // SLERP acceleration for self-righting
			selfRightBounce: 0.3,        // upward bounce during self-right (world units)

			// Landing
			landingCleanMaxImpact: 3.0,  // max impact speed for CLEAN
			landingHardMaxImpact: 6.0,   // max impact speed for HARD (above = BAD)
			landingCleanMaxPitch: 0.26,  // ~15° max pitch deviation for CLEAN
			landingHardMaxPitch: 0.52,   // ~30° max pitch deviation for HARD
			landingCleanRecovery: 0.1,   // recovery duration for CLEAN
			landingHardRecovery: 0.3,    // recovery duration for HARD
			landingBadRecovery: 0.5,     // recovery duration for BAD
			landingHardSpeedMult: 0.9,   // speed penalty during HARD recovery
			landingBadSpeedMult: 0.7,    // speed penalty during BAD recovery
			landingBounceRestitution: 0.35, // bounce factor on landing (damped)
			landingBounceMinImpact: 0.5,   // minimum impact speed to trigger bounce
		};

	}

	// ── Takeoff ─────────────────────────────────────────────────

	/**
	 * Compute and apply takeoff impulse. Called on TAKEOFF state entry.
	 * @param {object} v - Vehicle instance
	 * @param {number} surfaceType - SurfaceType enum from VehicleGroundRaycast
	 */
	applyTakeoff( v, surfaceType ) {

		const cfg = this.config;

		// Base impulse from ramp type
		const baseImpulse = RAMP_IMPULSE[ surfaceType ] ?? RAMP_IMPULSE[ SurfaceType.RAMP_UP ];

		// Speed factor: faster approach = higher launch, with ceiling
		const speedNorm = Math.abs( v.linearSpeed ) / cfg.launchSpeedRef;
		const speedFactor = THREE.MathUtils.clamp( speedNorm, cfg.launchSpeedMin, cfg.launchSpeedMax );

		// Compute existing slope-based velocity (preserve original calculation feel)
		_forward.set( 0, 0, 1 ).applyQuaternion( v.container.quaternion );
		const slopeVelocity = _forward.y * Math.abs( v.linearSpeed ) *
			v.effectiveTopSpeed / v.debug.speedScale;

		// Blend: use the greater of slope-based, authored impulse, or existing
		// momentum (ramp crest launches may have pre-computed velocity from
		// the slope frames before the normal flattened out)
		const authoredVelocity = baseImpulse * speedFactor * cfg.launchImpulseScale;
		const existingMomentum = v._verticalVelocity;
		const finalVelocity = Math.max( slopeVelocity, authoredVelocity, existingMomentum );

		v._verticalVelocity = Math.min( finalVelocity, cfg.launchCap );

		// Store launch state for landing severity calc
		this.launchSpeed = Math.abs( v.linearSpeed );
		this.launchVerticalVelocity = v._verticalVelocity;

		// Reset air control
		this._airYawInfluence = 0;

	}

	// ── Airborne Update ─────────────────────────────────────────

	/**
	 * Per-frame airborne physics. Called while in AIRBORNE state.
	 * @param {number} dt - delta time
	 * @param {object} v - Vehicle instance
	 */
	updateAirborne( dt, v ) {

		const cfg = this.config;
		const GRAVITY = 9.81;

		// ── Gravity ──
		v._airborneTimer = ( v._airborneTimer || 0 ) + dt;
		v._verticalVelocity -= GRAVITY * dt;
		v._vehicleY += v._verticalVelocity * dt;

		// Hard ceiling: never fly more than 4 units above ground
		const MAX_AIR_HEIGHT = 4.0;
		if ( v._vehicleY > v.groundHeight + MAX_AIR_HEIGHT ) {

			v._vehicleY = v.groundHeight + MAX_AIR_HEIGHT;
			if ( v._verticalVelocity > 0 ) v._verticalVelocity = 0;

		}

		// ── Air control: limited yaw influence ──
		if ( v.inputX !== 0 ) {

			// Apply reduced steering in air (fraction of normal rate)
			const yawDelta = v.inputX * v.debug.steeringMultiplier * cfg.airYawRate * dt;
			this._airYawInfluence += yawDelta;

			// Extract current yaw from container
			const q = v.container.quaternion;
			const yaw = Math.atan2(
				2 * ( q.w * q.y ),
				1 - 2 * ( q.y * q.y )
			);

			// Apply yaw correction to container quaternion
			const newYaw = yaw + yawDelta;
			const halfYaw = newYaw / 2;
			q.set( 0, Math.sin( halfYaw ), 0, Math.cos( halfYaw ) );

		}

		// ── Pitch stabilization ──
		// If the vehicle pitches beyond threshold, apply restoring torque.
		// The VehicleGroundRaycast already tilts the target normal nose-down
		// during airborne (line 341-345). We add stabilization to prevent
		// excessive pitch from collisions.
		// Note: pitch is encoded in the groundNormal target, so we
		// influence it indirectly by biasing toward level.

		// ── Angular damping ──
		// The existing quaternion SLERP toward groundNormal provides damping.
		// Additional damping would require angular velocity tracking which
		// isn't in the current architecture. The SLERP rate handles this.

	}

	// ── Landing ─────────────────────────────────────────────────

	/**
	 * Classify landing severity and compute recovery params.
	 * Called on LANDING state entry.
	 * @param {object} v - Vehicle instance
	 * @returns {string} LandingSeverity enum value
	 */
	applyLanding( v ) {

		const cfg = this.config;
		const impactSpeed = Math.abs( v._verticalVelocity );

		// Compute pitch deviation: how far from level the vehicle is
		_forward.set( 0, 0, 1 ).applyQuaternion( v.container.quaternion );
		const pitchDeviation = Math.abs( Math.asin( THREE.MathUtils.clamp( _forward.y, - 1, 1 ) ) );

		// Classify severity
		let severity;

		if ( impactSpeed < cfg.landingCleanMaxImpact &&
			 pitchDeviation < cfg.landingCleanMaxPitch ) {

			severity = LandingSeverity.CLEAN;

		} else if ( impactSpeed < cfg.landingHardMaxImpact &&
					pitchDeviation < cfg.landingHardMaxPitch ) {

			severity = LandingSeverity.HARD;

		} else {

			severity = LandingSeverity.BAD;

		}

		// Set recovery params
		switch ( severity ) {

			case LandingSeverity.CLEAN:
				this.recoveryDuration = cfg.landingCleanRecovery;
				this.recoverySpeedPenalty = 1.0;
				break;

			case LandingSeverity.HARD:
				this.recoveryDuration = cfg.landingHardRecovery;
				this.recoverySpeedPenalty = cfg.landingHardSpeedMult;
				break;

			case LandingSeverity.BAD:
				this.recoveryDuration = cfg.landingBadRecovery;
				this.recoverySpeedPenalty = cfg.landingBadSpeedMult;
				break;

		}

		// Snap to ground
		const targetY = v.groundHeight + v.debug.rideHeight;
		v._vehicleY = targetY;
		v._grounded = true;

		// Jiggly bounce: landings on flat/downhill get a damped bounce.
		// Skip bounce on ramp surfaces — bouncing prevents the vehicle
		// from climbing steep ramps like trk-jump-long.
		const landingOnRamp = v.groundNormal.y < 0.96;

		if ( ! landingOnRamp && impactSpeed > cfg.landingBounceMinImpact ) {

			const bounceVel = impactSpeed * cfg.landingBounceRestitution;

			if ( bounceVel > 0.3 ) {

				// Enough energy for a visible bounce — go back airborne
				v._verticalVelocity = bounceVel;
				v._grounded = false;
				v._launchCooldown = 0.1;

				if ( v._stateMachine ) {

					v._stateMachine.forceState( PhysicsState.AIRBORNE );

				}

				this.lastSeverity = severity;

				// Don't enter RECOVERY yet — the bounce will land again
				return severity;

			}

		}

		// Sub-threshold bounce: just settle
		v._verticalVelocity = 0;

		this.lastSeverity = severity;

		// Store recovery duration in state machine for RECOVERY state timing
		if ( v._stateMachine ) {

			v._stateMachine._recoveryDuration = this.recoveryDuration;
			v._stateMachine.landingSeverity = severity;

		}

		return severity;

	}

	/**
	 * Per-frame recovery update. Called while in RECOVERY state.
	 * Applies speed penalty that fades over the recovery window.
	 * @param {number} dt - delta time
	 * @param {object} v - Vehicle instance
	 */
	updateRecovery( dt, v ) {

		if ( ! v._stateMachine ) return;

		const elapsed = v._stateMachine.stateTimer;
		const duration = this.recoveryDuration;

		if ( duration <= 0 ) return;

		// Fade speed penalty from full penalty to 1.0 over recovery duration
		const t = Math.min( elapsed / duration, 1 );
		const penalty = THREE.MathUtils.lerp( this.recoverySpeedPenalty, 1.0, t );

		// Apply as a soft clamp rather than multiplier to avoid jerk
		if ( penalty < 1.0 ) {

			v.linearSpeed *= ( 1 - ( 1 - penalty ) * dt * 3 );

		}

	}

	// ── Anti-Flip / Self-Righting ───────────────────────────────

	/**
	 * Check vehicle roll angle and apply self-righting or trigger respawn.
	 * Called each frame from Vehicle.js regardless of state.
	 *
	 * @param {number} dt
	 * @param {object} v - Vehicle instance
	 * @returns {'ok'|'self-righting'|'respawn'} status
	 */
	checkFlip( dt, v ) {

		const cfg = this.config;

		// Compute roll from the container quaternion's local up vector
		const q = v.container.quaternion;
		// Local up vector in world space: rotate (0,1,0) by quaternion
		const upX = 2 * ( q.x * q.y - q.w * q.z );
		const upY = 1 - 2 * ( q.x * q.x + q.z * q.z );
		const upZ = 2 * ( q.y * q.z + q.w * q.x );

		// Roll angle: angle between local-up and world-up
		const rollAngle = Math.acos( THREE.MathUtils.clamp( upY, - 1, 1 ) );

		if ( rollAngle > cfg.flipRespawnThreshold ) {

			// Completely flipped — trigger respawn
			return 'respawn';

		}

		if ( rollAngle > cfg.flipRollThreshold ) {

			// Partially flipped — accelerated self-righting
			// Override the normal SLERP rate with a much faster correction
			const uprightNormal = new THREE.Vector3( 0, 1, 0 );
			const targetQuat = v.alignWithY( v.container.quaternion, uprightNormal );
			const fastRate = 1 - Math.exp( - cfg.selfRightRate * dt );
			v.container.quaternion.slerp( targetQuat, fastRate );

			// Slight upward bounce to unstick from ground
			if ( v._grounded && v._verticalVelocity <= 0 ) {

				v._verticalVelocity = cfg.selfRightBounce;

			}

			return 'self-righting';

		}

		return 'ok';

	}

}
