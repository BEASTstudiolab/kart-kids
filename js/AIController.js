import * as THREE from 'three';
import { DEFAULT_PROFILE } from './AIProfiles.js';
import { AICombatBehavior } from './AICombatBehavior.js';

const _forward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

const STUCK_THRESHOLD = 0.05;
const BEND_TURN_DEG = 10;
const HARD_TURN_DEG = 25;
const EXIT_BLEND_DISTANCE = 10;
const MAX_LANE_BIAS = 2.25;
const MAX_SEED_LANE_SPREAD = 0.6;
const WALL_PIN_THRESHOLD = 0.82;
const WALL_PIN_SPEED = 0.2;
const WALL_PIN_TIME = 0.45;
const RECOVERY_CLEAR_SPEED = 0.35;

const { clamp, lerp } = THREE.MathUtils;

function signedAngleDeg( from, to ) {

	const dot = clamp( from.x * to.x + from.z * to.z, - 1, 1 );
	const cross = from.x * to.z - from.z * to.x;
	return THREE.MathUtils.radToDeg( Math.atan2( cross, dot ) );

}

function getWallAwareReverseSteer( vehicle ) {

	const left = vehicle?._wallProximityLeft || 0;
	const right = vehicle?._wallProximityRight || 0;
	if ( left > right + 0.05 ) return 0.9;
	if ( right > left + 0.05 ) return - 0.9;
	return Math.random() > 0.5 ? 0.7 : - 0.7;

}

function seededUnit( seed ) {

	const raw = Math.sin( ( seed + 1 ) * 12.9898 ) * 43758.5453;
	return raw - Math.floor( raw );

}

export class AIController {

	constructor( trackIntel, seed, profile ) {

		this._trackIntel = trackIntel;
		this._seed = seed || 0;
		this._noisePhase = seed * 137.5;
		this._laneSpread = ( seededUnit( this._seed ) - 0.5 ) * 2 * MAX_SEED_LANE_SPREAD;

		this._segmentHint = null;

		// Merge profile with defaults — missing keys fall back to DEFAULT_PROFILE
		this._profile = Object.assign( {}, DEFAULT_PROFILE, profile );

		// Recovery / route state
		this._stuckTimer = 0;
		this._wallPinTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._recovering = false;
		this._reverseSteer = 0;
		this._recoveryStableTimer = 0;
		this._lastDistanceAlongTrack = null;
		this._activeTurnSign = 0;
		this._exitBlendRemaining = 0;
		this._exitLaneStart = 0;

		// Reusable input object — avoids per-frame allocation
		this._input = { x: 0, z: 0, touchActive: false, boost: false, drift: false, useItem: false };

		// Combat behavior
		this._combat = new AICombatBehavior();
		this._wrenchTarget = null;
		this._debugState = {
			mode: 'follow',
			segmentIndex: 0,
			target: null,
			cornerAngleDeg: 0,
			desiredSpeedFactor: 1,
			recoveryActive: false,
		};
		this.reset();

	}

	update( dt, vehicle ) {

		const trackIntel = this._trackIntel;

		// No track intelligence — drive forward with slight random steering.
		if ( ! trackIntel || ! trackIntel.waypoints || trackIntel.count === 0 ) {

			this._input.x = Math.sin( this._noisePhase + dt * 2 ) * 0.3;
			this._input.z = 1.0;
			this._input.boost = false;
			this._input.useItem = false;
			this._noisePhase += dt;
			this._debugState = {
				mode: 'fallback',
				segmentIndex: 0,
				target: null,
				cornerAngleDeg: 0,
				desiredSpeedFactor: 1,
				recoveryActive: false,
			};
			return this._input;

		}

		const pos = vehicle.vehPos;
		const p = this._profile;
		const speed = Math.abs( vehicle.linearSpeed || 0 );
		const wallLeft = vehicle?._wallProximityLeft || 0;
		const wallRight = vehicle?._wallProximityRight || 0;
		const wallPressure = Math.max( wallLeft, wallRight );
		const routeProjection = trackIntel.projectToRoute( pos.x, pos.z, this._segmentHint );

		if ( ! routeProjection ) {

			this._input.x = 0;
			this._input.z = 0.4;
			this._input.boost = false;
			this._input.useItem = false;
			return this._input;

		}

		this._segmentHint = routeProjection.segmentIndex;
		const traveledDistance = this._consumeDistanceDelta( routeProjection.distanceAlongTrack, trackIntel.totalLength );

		if ( this._reversing ) {

			this._reverseTimer -= dt;

			if ( this._reverseTimer <= 0 ) {

				this._reversing = false;
				this._recovering = true;
				this._recoveryStableTimer = 0;
				this._stuckTimer = 0;
				this._wallPinTimer = 0;
				this._segmentHint = null;
				this._lastDistanceAlongTrack = null;

			} else {

				this._setDebugState( {
					mode: 'reverse',
					segmentIndex: routeProjection.segmentIndex,
					target: null,
					cornerAngleDeg: 0,
					desiredSpeedFactor: 0,
					recoveryActive: true,
				} );
				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				this._input.useItem = false;
				return this._input;

			}

		}

		if ( speed < STUCK_THRESHOLD ) {

			this._stuckTimer += dt;

		} else {

			this._stuckTimer = Math.max( 0, this._stuckTimer - dt * 2 );

		}

		if ( wallPressure > WALL_PIN_THRESHOLD && speed < WALL_PIN_SPEED ) {

			this._wallPinTimer += dt;

		} else {

			this._wallPinTimer = Math.max( 0, this._wallPinTimer - dt * 2 );

		}

		if ( ! this._recovering && ( this._stuckTimer >= p.stuckTime || this._wallPinTimer >= WALL_PIN_TIME ) ) {

			this._reversing = true;
			this._reverseTimer = p.reverseTime;
			this._reverseSteer = getWallAwareReverseSteer( vehicle );
			this._recovering = false;
			this._recoveryStableTimer = 0;
			this._segmentHint = null;
			this._lastDistanceAlongTrack = null;

			this._setDebugState( {
				mode: 'reverse',
				segmentIndex: routeProjection.segmentIndex,
				target: null,
				cornerAngleDeg: 0,
				desiredSpeedFactor: 0,
				recoveryActive: true,
			} );
			this._input.x = this._reverseSteer;
			this._input.z = - 1.0;
			this._input.boost = false;
			this._input.useItem = false;
			return this._input;

		}

		const nearDist = clamp( 4 + speed * 0.35, 4, 10 );
		const farDist = clamp( 10 + speed * 0.65, 10, 22 );
		const brakeDist = clamp( 14 + speed * 0.9, 14, 28 );

		const routeNow = trackIntel.sampleRoute( routeProjection.distanceAlongTrack, 0 )
			|| { forward: { x: 0, z: 1 }, curvature: 0 };
		const nearCenter = trackIntel.sampleRoute( routeProjection.distanceAlongTrack + nearDist, 0 ) || routeNow;
		const farCenter = trackIntel.sampleRoute( routeProjection.distanceAlongTrack + farDist, 0 ) || nearCenter;
		const brakeCenter = trackIntel.sampleRoute( routeProjection.distanceAlongTrack + brakeDist, 0 ) || farCenter;

		const nearAngleDeg = signedAngleDeg( routeNow.forward, nearCenter.forward );
		const cornerAngleDeg = signedAngleDeg( routeNow.forward, brakeCenter.forward );
		const lanePlan = this._computeLanePlan( {
			baseLane: this._recovering ? 0 : p.straightLaneOffset,
			nearAngleDeg,
			cornerAngleDeg,
			traveledDistance,
			profile: p,
		} );

		const nearTarget = trackIntel.sampleRoute( routeProjection.distanceAlongTrack + nearDist, lanePlan.laneOffset ) || nearCenter;
		const farTarget = trackIntel.sampleRoute( routeProjection.distanceAlongTrack + farDist, lanePlan.laneOffset ) || farCenter;
		let targetX = nearTarget.x * 0.65 + farTarget.x * 0.35;
		let targetZ = nearTarget.z * 0.65 + farTarget.z * 0.35;

		this._wrenchTarget = null;

		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		_forward.normalize();

		// Wrench seeking nudges the route target, but does not bypass
		// the new braking / recovery logic.
		const profileName = p.name || 'default';
		if ( this._wrenchPositionsRef && this._combat.shouldSeekWrench( vehicle, profileName ) ) {

			const wrench = this._combat.getNearestWrench( vehicle, this._wrenchPositionsRef );
			if ( wrench ) {

				const dx = wrench.x - pos.x;
				const dz = wrench.z - pos.z;
				const distSq = dx * dx + dz * dz;
				if ( distSq > 0.25 && distSq < 900 ) {

					this._wrenchTarget = wrench;
					targetX = wrench.x;
					targetZ = wrench.z;

				}

			}

		}

		_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
		if ( _toTarget.lengthSq() < 1e-6 ) {

			_toTarget.set( nearTarget.forward?.x || routeNow.forward.x, 0, nearTarget.forward?.z || routeNow.forward.z );

		}

		_toTarget.normalize();
		const dot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;
		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;

		// Per-AI noise so bots don't follow identical lines
		this._noisePhase += dt * 2.3;
		const noise = Math.sin( this._noisePhase ) * p.noiseAmplitude;
		const steerInput = clamp( cross * p.steerSensitivity + noise, - 1, 1 );

		const turnRiskDeg = Math.max( Math.abs( nearAngleDeg ) * 1.35, Math.abs( cornerAngleDeg ) * 0.65 );
		let desiredSpeedFactor = clamp( 1 - turnRiskDeg / 85, 0.32, 1 ) * p.cornerSpeedFactor;
		desiredSpeedFactor = clamp( desiredSpeedFactor, 0.25, 1.0 );
		let throttle = desiredSpeedFactor;
		if ( speed > desiredSpeedFactor + 0.08 && Math.abs( cornerAngleDeg ) >= BEND_TURN_DEG ) {

			throttle = - clamp( ( speed - desiredSpeedFactor ) / 0.2, 0.35, 1.0 );

		} else if ( dot < p.turnThrottleDot ) {

			throttle = Math.min( throttle, Math.max( p.turnThrottleMin, dot ) );

		}

		if ( this._recovering ) {

			throttle = Math.max( 0.35, desiredSpeedFactor * 0.9 );
			if ( wallPressure < 0.4 && speed > RECOVERY_CLEAR_SPEED && Math.abs( routeProjection.lateralOffset ) < 1.4 ) {

				this._recoveryStableTimer += dt;
				if ( this._recoveryStableTimer >= 0.35 ) {

					this._recovering = false;
					this._recoveryStableTimer = 0;

				}

			} else {

				this._recoveryStableTimer = 0;

			}

		}

		let boost = false;
		if (
			! this._recovering &&
			vehicle.boostMeter >= 1.0 &&
			Math.abs( cornerAngleDeg ) < BEND_TURN_DEG &&
			Math.abs( routeProjection.lateralOffset - lanePlan.laneOffset ) < 0.75 &&
			wallPressure < 0.5
		) {

			boost = p.boostEagerness ? true : dot > 0.92;

		}

		this._input.x = steerInput;
		this._input.z = throttle;
		this._input.boost = boost;
		this._input.useItem = false;

		// ── Combat behavior ──────────────────────────────────────
		// Item use decision
		if ( this._combat.shouldUseItem( vehicle, this._allVehiclesRef || [], profileName ) ) {

			this._input.useItem = true;

		}

		this._setDebugState( {
			mode: lanePlan.mode,
			segmentIndex: routeProjection.segmentIndex,
			target: {
				x: targetX,
				z: targetZ,
				laneOffset: lanePlan.laneOffset,
				wrench: this._wrenchTarget ? { x: this._wrenchTarget.x, z: this._wrenchTarget.z } : null,
			},
			cornerAngleDeg,
			desiredSpeedFactor,
			recoveryActive: this._recovering || this._reversing,
		} );

		return this._input;

	}

	_computeLanePlan( { baseLane, nearAngleDeg, cornerAngleDeg, traveledDistance, profile } ) {

		const absCornerAngle = Math.abs( cornerAngleDeg );
		const absNearAngle = Math.abs( nearAngleDeg );
		const turnSign = Math.sign( cornerAngleDeg ) || this._activeTurnSign || Math.sign( nearAngleDeg ) || 0;
		const seededBaseLane = clamp( baseLane + this._laneSpread, - MAX_SEED_LANE_SPREAD, MAX_SEED_LANE_SPREAD );
		const entryLane = seededBaseLane - turnSign * MAX_LANE_BIAS * profile.cornerEntryWidth;
		const apexLane = seededBaseLane + turnSign * MAX_LANE_BIAS * profile.cornerApexTightness;

		if ( this._recovering ) {

			this._activeTurnSign = 0;
			this._exitBlendRemaining = 0;
			return { laneOffset: 0, mode: 'recover' };

		}

		if ( absCornerAngle >= BEND_TURN_DEG && turnSign !== 0 ) {

			this._activeTurnSign = turnSign;

			if ( absNearAngle < 7 ) {

				this._exitBlendRemaining = 0;
				return { laneOffset: entryLane, mode: 'approach' };

			}

			this._exitBlendRemaining = EXIT_BLEND_DISTANCE;
			this._exitLaneStart = apexLane;
			return { laneOffset: apexLane, mode: absCornerAngle >= HARD_TURN_DEG ? 'apex' : 'bend' };

		}

		if ( this._exitBlendRemaining > 0 && this._activeTurnSign !== 0 ) {

			this._exitBlendRemaining = Math.max( 0, this._exitBlendRemaining - traveledDistance );
			const t = 1 - this._exitBlendRemaining / EXIT_BLEND_DISTANCE;
			const laneOffset = lerp( this._exitLaneStart, seededBaseLane, t );
			if ( this._exitBlendRemaining === 0 ) this._activeTurnSign = 0;
			return { laneOffset, mode: 'exit' };

		}

		this._activeTurnSign = 0;
		return { laneOffset: seededBaseLane, mode: 'straight' };

	}

	_consumeDistanceDelta( distanceAlongTrack, totalLength ) {

		if ( this._lastDistanceAlongTrack === null || totalLength <= 0 ) {

			this._lastDistanceAlongTrack = distanceAlongTrack;
			return 0;

		}

		let delta = distanceAlongTrack - this._lastDistanceAlongTrack;
		if ( delta < - totalLength * 0.5 ) delta += totalLength;
		else if ( delta > totalLength * 0.5 ) delta -= totalLength;

		this._lastDistanceAlongTrack = distanceAlongTrack;
		return Math.max( 0, delta );

	}

	_setDebugState( nextState ) {

		this._debugState = {
			mode: nextState.mode,
			segmentIndex: nextState.segmentIndex,
			target: nextState.target,
			cornerAngleDeg: nextState.cornerAngleDeg,
			desiredSpeedFactor: nextState.desiredSpeedFactor,
			recoveryActive: nextState.recoveryActive,
		};

	}

	reset() {

		this._segmentHint = null;
		this._stuckTimer = 0;
		this._wallPinTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._recovering = false;
		this._reverseSteer = 0;
		this._recoveryStableTimer = 0;
		this._lastDistanceAlongTrack = null;
		this._activeTurnSign = 0;
		this._exitBlendRemaining = 0;
		this._exitLaneStart = 0;
		this._wrenchTarget = null;
		this._input.x = 0;
		this._input.z = 0;
		this._input.touchActive = false;
		this._input.boost = false;
		this._input.drift = false;
		this._input.useItem = false;
		this._setDebugState( {
			mode: 'follow',
			segmentIndex: 0,
			target: null,
			cornerAngleDeg: 0,
			desiredSpeedFactor: 1,
			recoveryActive: false,
		} );

	}

	/**
	 * Set external references for combat decisions (called by AIManager).
	 */
	setCombatRefs( allVehicles, wrenchPositions ) {

		this._allVehiclesRef = allVehicles;
		this._wrenchPositionsRef = wrenchPositions;

	}

	getDebugState() {

		return {
			mode: this._debugState.mode,
			segmentIndex: this._debugState.segmentIndex,
			target: this._debugState.target
				? {
					x: this._debugState.target.x,
					z: this._debugState.target.z,
					laneOffset: this._debugState.target.laneOffset,
					wrench: this._debugState.target.wrench,
				}
				: null,
			cornerAngleDeg: this._debugState.cornerAngleDeg,
			desiredSpeedFactor: this._debugState.desiredSpeedFactor,
			recoveryActive: this._debugState.recoveryActive,
		};

	}

}
