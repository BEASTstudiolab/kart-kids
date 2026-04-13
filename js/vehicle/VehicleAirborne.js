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
const _up = new THREE.Vector3( 0, 1, 0 );
const _levelQuat = new THREE.Quaternion();

// Landing severity levels
export const LandingSeverity = {
	CLEAN: 'clean',
	HARD: 'hard',
	BAD: 'bad',
};

export const LaunchSource = {
	NONE: 'none',
	RAMP: 'ramp',
	JUMP: 'jump',
	DROP: 'drop',
	IMPACT: 'impact',
};

const LANDING_SEVERITY_RANK = {
	[ LandingSeverity.CLEAN ]: 0,
	[ LandingSeverity.HARD ]: 1,
	[ LandingSeverity.BAD ]: 2,
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
		this.lastImpactSpeed = 0;
		this.recoveryDuration = 0;     // how long RECOVERY state lasts
		this.recoverySpeedPenalty = 1;  // speed multiplier during recovery (1 = no penalty)
		this.launchSource = LaunchSource.NONE;
		this.wallContactSinceLaunch = false;
		this.lastLandingInfo = {
			severity: LandingSeverity.CLEAN,
			impactSpeed: 0,
			launchSource: LaunchSource.NONE,
			trickType: null,
			rewardGranted: false,
			bounced: false,
			suppressEvent: false,
		};
		this._carriedLandingSeverity = null;
		this._carriedLandingImpactSpeed = 0;
		this._suppressNextLandingEvent = false;

		// Tuning (exposed via vehicle.debug)
		this.config = {
			// Takeoff
			launchImpulseScale: 0.85,     // global multiplier on all launch impulses
			launchSpeedMin: 0.3,          // minimum speed factor
			launchSpeedMax: 1.0,          // maximum speed factor
			launchSpeedRef: 0.8,          // speed at which factor = 1.0
			launchCap: 5.0,              // absolute max vertical velocity
			rampLaunchBoost: 1.1,         // extra pop for authored ramp launches
			jumpLaunchBoost: 1.2,         // extra pop for jump exits / crest launches
			launchCommitWindow: 0.18,     // ignore ground contact briefly after launch
			jumpCommitWindow: 0.3,        // a little longer to keep crest launches consistent
			dropCommitWindow: 0.15,       // short float-off protection for ledges
			impactCommitWindow: 0.22,     // protects dramatic impact launches from instant re-ground
			minAirTime: 0.12,             // minimum airtime before latching support again
			regroundDistance: 0.5,        // max distance above support to reattach

			// Gravity curve (hang time feel)
			apexGravityScale: 0.7,       // slight hang time at apex (1.0 = no effect)
			descentGravityScale: 1.3,    // slightly faster descent (1.0 = no effect)
			descentAutoLevel: 7.0,       // how aggressively the body levels on descent

			// Air control
			airYawRate: 0.14,            // much weaker yaw than grounded steering
			airPitchControlRate: 0.8,    // pitch influence from forward/back input (rad/s)
			airRollControlRate: 0.5,     // cosmetic roll from left/right input (rad/s)
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
			landingBounceRestitution: 0.5,  // suspension spring kick factor (higher = bouncier)
			landingBounceMinImpact: 0.5,   // minimum impact speed to trigger suspension bounce
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
		let sourceBoost = 1.0;
		if ( surfaceType === SurfaceType.RAMP_EXIT ) sourceBoost = cfg.jumpLaunchBoost ?? 1.2;
		else if ( surfaceType === SurfaceType.RAMP_UP || surfaceType === SurfaceType.FLAT ) sourceBoost = cfg.rampLaunchBoost ?? 1.1;

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
		const authoredVelocity = baseImpulse * speedFactor * cfg.launchImpulseScale * sourceBoost;
		const existingMomentum = v._verticalVelocity;
		const finalVelocity = Math.max( slopeVelocity, authoredVelocity, existingMomentum );

		v._verticalVelocity = Math.min( finalVelocity, cfg.launchCap );

		// Store launch state for landing severity calc
		this.launchSpeed = Math.abs( v.linearSpeed );
		this.launchVerticalVelocity = v._verticalVelocity;

		// Reset air control
		this._airYawInfluence = 0;

	}

	_getLaunchProfile( source ) {

		switch ( source ) {

			case LaunchSource.JUMP:
				return {
					commitWindow: this.config.jumpCommitWindow ?? 0.3,
					verticalCap: this.config.launchCap,
				};

			case LaunchSource.DROP:
				return {
					commitWindow: this.config.dropCommitWindow ?? 0.15,
					verticalCap: this.config.launchCap,
				};

			case LaunchSource.IMPACT:
				return {
					commitWindow: this.config.impactCommitWindow ?? 0.22,
					verticalCap: this.config.launchCap,
				};

			case LaunchSource.RAMP:
			default:
				return {
					commitWindow: this.config.launchCommitWindow ?? 0.18,
					verticalCap: this.config.launchCap,
				};

		}

	}

	_clearCarriedLandingState() {

		this._carriedLandingSeverity = null;
		this._carriedLandingImpactSpeed = 0;
		this._suppressNextLandingEvent = false;

	}

	clearLandingCarry() {

		this._clearCarriedLandingState();

	}

	_classifyLandingSeverity( impactSpeed, pitchDeviation ) {

		const cfg = this.config;

		if ( impactSpeed < cfg.landingCleanMaxImpact &&
			 pitchDeviation < cfg.landingCleanMaxPitch ) {

			return LandingSeverity.CLEAN;

		}

		if ( impactSpeed < cfg.landingHardMaxImpact &&
			 pitchDeviation < cfg.landingHardMaxPitch ) {

			return LandingSeverity.HARD;

		}

		return LandingSeverity.BAD;

	}

	_applyRecoveryForSeverity( severity ) {

		const cfg = this.config;

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
			default:
				this.recoveryDuration = cfg.landingBadRecovery;
				this.recoverySpeedPenalty = cfg.landingBadSpeedMult;
				break;

		}

	}

	_getDominantLandingSeverity( nextSeverity ) {

		if ( ! this._carriedLandingSeverity ) return nextSeverity;

		const carriedRank = LANDING_SEVERITY_RANK[ this._carriedLandingSeverity ] ?? 0;
		const nextRank = LANDING_SEVERITY_RANK[ nextSeverity ] ?? 0;
		return carriedRank > nextRank ? this._carriedLandingSeverity : nextSeverity;

	}

	beginLaunch( v, {
		source = LaunchSource.RAMP,
		surfaceType = SurfaceType.RAMP_UP,
		verticalVelocity = null,
		commitWindow = null,
		verticalCap = null,
	} = {} ) {

		const launchProfile = this._getLaunchProfile( source );

		this.launchSource = source;
		this.wallContactSinceLaunch = false;
		this._clearCarriedLandingState();
		v._airborneWallContact = false;
		v._grounded = false;
		v._airborneTimer = 0;
		v._launchCooldown = commitWindow ?? launchProfile.commitWindow;

		if ( verticalVelocity == null ) {

			this.applyTakeoff( v, surfaceType );

		} else {

			const cap = verticalCap ?? launchProfile.verticalCap ?? this.config.launchCap;
			v._verticalVelocity = Math.min( verticalVelocity, cap );
			this.launchSpeed = Math.abs( v.linearSpeed );
			this.launchVerticalVelocity = v._verticalVelocity;
			this._airYawInfluence = 0;

		}

		if ( v._trick ) v._trick.onLaunch( v, source );

	}

	resolveGroundContact( v, sensor = {} ) {

		if ( ! sensor.hasSupport ) return false;

		const aboveSurface = sensor.aboveSurface ?? ( v._vehicleY - v.groundHeight );
		const launchLocked = this.launchSource !== LaunchSource.NONE && v._launchCooldown > 0;
		const hasWheelContact = sensor.frontOnSurface || sensor.rearOnSurface;
		const descendingOntoSupport = hasWheelContact &&
			v._verticalVelocity <= 0 &&
			aboveSurface <= this.config.regroundDistance;

		if ( launchLocked && ! descendingOntoSupport ) return false;
		if ( this.launchSource !== LaunchSource.NONE &&
			v._airborneTimer < this.config.minAirTime &&
			v._verticalVelocity >= 0 ) return false;

		if ( aboveSurface < 0 ) return true;
		if ( sensor.frontOnSurface && aboveSurface <= this.config.regroundDistance ) return true;
		if ( sensor.rearOnSurface && aboveSurface <= this.config.regroundDistance * 0.8 ) return true;
		if ( v._verticalVelocity < 0 && aboveSurface <= this.config.regroundDistance ) return true;

		return this.launchSource === LaunchSource.NONE;

	}

	// ── Airborne Update ─────────────────────────────────────────

	/**
	 * Per-frame airborne physics. Called while in AIRBORNE state.
	 * @param {number} dt - delta time
	 * @param {object} v - Vehicle instance
	 */
	updateAirborne( dt, v ) {

		const cfg = this.config;
		const BASE_GRAVITY = 9.81;

		// ── Gravity curve: reduced near apex (hang time), increased on descent ──
		v._airborneTimer = ( v._airborneTimer || 0 ) + dt;
		let gravityMult;
		if ( v._verticalVelocity > 0 ) {

			// Rising: lerp from apexGravityScale (at apex) to 1.0 (at launch speed)
			const t = Math.min( v._verticalVelocity / ( this.launchVerticalVelocity || 1 ), 1 );
			gravityMult = THREE.MathUtils.lerp( cfg.apexGravityScale, 1.0, t );

		} else {

			// Falling: lerp from 1.0 to descentGravityScale as fall speed increases
			const t = Math.min( Math.abs( v._verticalVelocity ) / 6.0, 1 );
			gravityMult = THREE.MathUtils.lerp( 1.0, cfg.descentGravityScale, t );

		}

		v._verticalVelocity -= BASE_GRAVITY * gravityMult * dt;
		v._vehicleY += v._verticalVelocity * dt;

		if ( v._verticalVelocity < 0 ) {

			const yaw = Math.atan2(
				2 * ( v.container.quaternion.w * v.container.quaternion.y ),
				1 - 2 * ( v.container.quaternion.y * v.container.quaternion.y )
			);
			_levelQuat.setFromAxisAngle( _up, yaw );
			const autoLevelRate = 1 - Math.exp( - cfg.descentAutoLevel * dt );
			v.container.quaternion.slerp( _levelQuat, autoLevelRate );
			if ( v._groundRaycast?._targetNormal ) {

				v._groundRaycast._targetNormal.lerp( _up, autoLevelRate ).normalize();

			}

		}

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

		// ── Air pitch control ──
		// Forward/back input biases the target normal for nose-up/nose-down
		if ( v.inputZ !== 0 && v._groundRaycast ) {

			const pitchRate = cfg.airPitchControlRate * dt;
			_forward.set( 0, 0, 1 ).applyQuaternion( v.container.quaternion );
			// Bias the target normal: inputZ > 0 (gas) = nose up, inputZ < 0 = nose down
			const pitchBias = - v.inputZ * pitchRate;
			v._groundRaycast._targetNormal.x += _forward.x * pitchBias;
			v._groundRaycast._targetNormal.z += _forward.z * pitchBias;
			v._groundRaycast._targetNormal.normalize();

		}

		// ── Cosmetic air roll ──
		// Left/right input adds body lean in air (visual only, no trajectory change)
		if ( v.inputX !== 0 && v.bodyNode ) {

			const rollTarget = - v.inputX * 0.3; // max ~17° visual roll
			v.bodyNode.rotation.z = THREE.MathUtils.lerp(
				v.bodyNode.rotation.z, rollTarget, 1 - Math.exp( - cfg.airRollControlRate * dt )
			);

		}

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
		const launchSource = this.launchSource;
		const rawImpactSpeed = Math.abs( v._verticalVelocity );

		// Compute pitch deviation: how far from level the vehicle is
		_forward.set( 0, 0, 1 ).applyQuaternion( v.container.quaternion );
		const pitchDeviation = Math.abs( Math.asin( THREE.MathUtils.clamp( _forward.y, - 1, 1 ) ) );

		const baseSeverity = this._classifyLandingSeverity( rawImpactSpeed, pitchDeviation );
		const severity = this._getDominantLandingSeverity( baseSeverity );
		const impactSpeed = Math.max( rawImpactSpeed, this._carriedLandingImpactSpeed );
		this._applyRecoveryForSeverity( severity );

		// Snap to ground
		const targetY = v.groundHeight + v.debug.rideHeight;
		v._vehicleY = targetY;
		v._grounded = true;

		const rewardGranted = v._trick ? v._trick.onLanding( v, severity ) : false;
		const trickType = v._lastTrickResult?.type || null;

		const landingInfo = {
			severity,
			impactSpeed,
			pitchDeviation,
			launchSource,
			trickType,
			rewardGranted,
			bounced: false,
			suppressEvent: false,
		};

		// Landing bounce: actual vehicle lift for arcade feel.
		// Short controlled bounce — vehicle goes briefly airborne then resettles.
		// Also kicks the suspension spring for body squash/rebound on top.
		const landingOnRamp = v.groundNormal.y < 0.96;

		if ( landingOnRamp ) {

			// Consecutive authored jumps need immediate ramp logic on the next frame.
			this.recoveryDuration = 0;
			this.recoverySpeedPenalty = 1.0;

		}

		if ( ! landingOnRamp && rawImpactSpeed > cfg.landingBounceMinImpact ) {

			const bounceVel = rawImpactSpeed * cfg.landingBounceRestitution;

			if ( bounceVel > 0.3 ) {

				// Real bounce: brief airborne with capped velocity, but keep the
				// original touchdown severity for the eventual recovery frame.
				v._verticalVelocity = Math.min( bounceVel, 2.5 );
				v._grounded = false;
				v._launchCooldown = 0.08;
				landingInfo.bounced = true;
				this._carriedLandingSeverity = severity;
				this._carriedLandingImpactSpeed = impactSpeed;
				this._suppressNextLandingEvent = true;
				this.resetLaunchState( v );

				if ( v._stateMachine ) {

					v._stateMachine.forceState( PhysicsState.AIRBORNE );

				}

				// Also kick the body spring for visual squash
				v._landingBounceVel = bounceVel * 0.5;

				this.lastImpactSpeed = impactSpeed;
				this.lastSeverity = severity;
				this.lastLandingInfo = landingInfo;
				return landingInfo;

			}

			// Sub-threshold: body spring only
			v._landingBounceVel = bounceVel;

		}

		v._verticalVelocity = 0;

		landingInfo.suppressEvent = this._suppressNextLandingEvent;
		this._clearCarriedLandingState();
		this.lastSeverity = severity;
		this.lastImpactSpeed = impactSpeed;
		this.lastLandingInfo = landingInfo;
		this.launchSource = LaunchSource.NONE;
		this.wallContactSinceLaunch = false;
		v._airborneWallContact = false;

		// Store recovery duration in state machine for RECOVERY state timing
		if ( v._stateMachine ) {

			v._stateMachine._recoveryDuration = this.recoveryDuration;
			v._stateMachine.landingSeverity = severity;

		}

		return landingInfo;

	}

	markWallContact( v ) {

		this.wallContactSinceLaunch = true;
		if ( v ) v._airborneWallContact = true;

	}

	resetLaunchState( v ) {

		this.launchSource = LaunchSource.NONE;
		this.wallContactSinceLaunch = false;
		if ( v ) v._airborneWallContact = false;

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

		// Ease-out quadratic: sharp initial decel then gradual recovery
		const t = Math.min( elapsed / duration, 1 );
		const eased = 1 - ( 1 - t ) * ( 1 - t );
		const penalty = THREE.MathUtils.lerp( this.recoverySpeedPenalty, 1.0, eased );

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
