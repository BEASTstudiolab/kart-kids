import * as THREE from 'three';
import { DEFAULT_PROFILE } from './AIProfiles.js';
import { AICombatBehavior } from './AICombatBehavior.js';

const _forward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

const STUCK_THRESHOLD = 0.05;
const STUCK_PROGRESS_SPEED_THRESHOLD = 0.75;
const STUCK_PROGRESS_LINEAR_MIN = 0.2;
const WALL_ESCAPE_THRESHOLD = 0.25;
const WALL_ESCAPE_TARGET_SHIFT = 6.0;
const WALL_ESCAPE_THROTTLE_MIN = 0.45;
const WALL_ESCAPE_BOOST_THRESHOLD = 0.2;
const DEFAULT_LOOK_AHEAD_NEAR_DISTANCE = 12;
const DEFAULT_LOOK_AHEAD_FAR_DISTANCE = 22;
const DEFAULT_TURN_LOOK_AHEAD_DISTANCE = 24;
const DEFAULT_TURN_LOOK_AHEAD_STEP_DISTANCE = 6;
const DEFAULT_TRAFFIC_LOOK_AHEAD_DISTANCE = 16;
const DEFAULT_TRAFFIC_LATERAL_BIAS = 1.4;
const TURN_LOOK_AHEAD_NEAR_SCALE = 0.6;
const TURN_LOOK_AHEAD_FAR_SCALE = 0.5;
const TURN_LOOK_AHEAD_BLEND_MIN = 0.12;
const ROUTE_RECAPTURE_GAIN = 0.7;
const ROUTE_RECAPTURE_TURN_GAIN = 1.4;
const ROUTE_RECAPTURE_MAX_SHIFT = 4.0;
const TRAFFIC_CORNER_LATERAL_SUPPRESSION = 2.4;
const NOISE_TURN_SUPPRESSION_THRESHOLD = 0.15;
const TRAFFIC_SCAN_DIST_SQ = 36 * 36;
const WRENCH_SEEK_MIN_FORWARD_DISTANCE = 1.5;
const WRENCH_SEEK_MAX_FORWARD_DISTANCE = 18;
const WRENCH_SEEK_MAX_LATERAL_DISTANCE = 3.0;
const WRENCH_SEEK_MAX_PROGRESS_DELTA = 0.08;

export class AIController {

	constructor( trackIntel, seed, profile ) {

		this._trackIntel = trackIntel;
		this._seed = seed || 0;
		this._noisePhase = seed * 137.5;

		this._waypointHint = 0;

		// Merge profile with defaults — missing keys fall back to DEFAULT_PROFILE
		this._profile = Object.assign( {}, DEFAULT_PROFILE, profile );

		// Stuck detection
		this._stuckTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._reverseSteer = 0;
		this._lastProgress = null;

		// Reusable input object — avoids per-frame allocation
		this._input = { x: 0, z: 0, touchActive: false, boost: false, drift: false, useItem: false };

		// Combat behavior
		this._combat = new AICombatBehavior();
		this._wrenchTarget = null;
		this._debugState = null;

	}

	reset() {

		this._waypointHint = 0;
		this._stuckTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._reverseSteer = 0;
		this._lastProgress = null;
		this._wrenchTarget = null;
		this._debugState = null;

	}

	update( dt, vehicle ) {

		const trackIntel = this._trackIntel;

		// No track intelligence — drive forward with slight random steering.
		if ( ! trackIntel || ! trackIntel.waypoints || trackIntel.count === 0 ) {

			this._input.x = Math.sin( this._noisePhase + dt * 2 ) * 0.3;
			this._input.z = 1.0;
			this._input.boost = false;
			this._noisePhase += dt;
			this._debugState = {
				mode: 'fallback',
				routeTarget: null,
				finalTarget: null,
				turnSeverity: 0,
				trafficOccupancy: 0,
				wallEscapeFactor: 0,
				wrenchTarget: null,
			};
			return this._input;

		}

		const pos = vehicle.vehPos;
		const p = this._profile;

		// ── Stuck detection ──────────────────────────────────────
		if ( this._reversing ) {

			this._reverseTimer -= dt;

			if ( this._reverseTimer <= 0 ) {

				this._reversing = false;
				this._stuckTimer = 0;
				this._lastProgress = null;

			} else {

				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				this._debugState = {
					mode: 'reversing',
					routeTarget: null,
					finalTarget: null,
					turnSeverity: 0,
					trafficOccupancy: 0,
					wallEscapeFactor: 0,
					wrenchTarget: null,
				};
				return this._input;

			}

		}

		const currentProgress = trackIntel.getProgress( pos.x, pos.z, this._waypointHint );
		let makingProgress = true;

		if ( this._lastProgress !== null && dt > 0 && trackIntel.totalLength > 0 ) {

			let progressDelta = currentProgress - this._lastProgress;
			if ( progressDelta < - 0.5 ) progressDelta += 1;
			if ( progressDelta > 0.5 ) progressDelta -= 1;

			const trackSpeed = Math.abs( progressDelta * trackIntel.totalLength / dt );
			makingProgress = trackSpeed >= STUCK_PROGRESS_SPEED_THRESHOLD;

		}

		this._lastProgress = currentProgress;

		if ( Math.abs( vehicle.linearSpeed ) < STUCK_THRESHOLD ||
			( Math.abs( vehicle.linearSpeed ) >= STUCK_PROGRESS_LINEAR_MIN && ! makingProgress ) ) {

			this._stuckTimer += dt;

				if ( this._stuckTimer >= p.stuckTime ) {

					this._reversing = true;
					this._reverseTimer = p.reverseTime;
					this._reverseSteer = Math.random() > 0.5 ? 0.7 : - 0.7;
					this._input.x = this._reverseSteer;
					this._input.z = - 1.0;
					this._input.boost = false;
					this._debugState = {
						mode: 'stuck-reverse',
						routeTarget: null,
						finalTarget: null,
						turnSeverity: 0,
						trafficOccupancy: 0,
						wallEscapeFactor: 0,
						wrenchTarget: null,
					};
					return this._input;

				}

		} else {

			this._stuckTimer = 0;

		}

		// ── Find nearest waypoint and look-ahead target ──────────
		this._waypointHint = trackIntel.getNearestWaypoint( pos.x, pos.z, this._waypointHint );

		const routeSample = trackIntel.sampleAtProgress( currentProgress );
		const baseNearDistance = p.lookAheadNearDistance ?? ( p.lookAheadNear || DEFAULT_LOOK_AHEAD_NEAR_DISTANCE / 4 ) * 4;
		const baseFarDistance = p.lookAheadFarDistance ?? ( p.lookAheadFar || DEFAULT_LOOK_AHEAD_FAR_DISTANCE / 4 ) * 4;
		const turnLookAheadDistance = p.turnLookAheadDistance ?? Math.max( baseFarDistance, DEFAULT_TURN_LOOK_AHEAD_DISTANCE );
		const turnLookAheadStepDistance = p.turnLookAheadStepDistance ?? DEFAULT_TURN_LOOK_AHEAD_STEP_DISTANCE;
		const turnSeverity = trackIntel.estimateTurnSeverity(
			currentProgress,
			turnLookAheadDistance,
			turnLookAheadStepDistance
		);
		const nearDistance = THREE.MathUtils.lerp(
			baseNearDistance,
			Math.max( 6, baseNearDistance * TURN_LOOK_AHEAD_NEAR_SCALE ),
			turnSeverity
		);
		const farDistance = THREE.MathUtils.lerp(
			baseFarDistance,
			Math.max( nearDistance + 2, baseFarDistance * TURN_LOOK_AHEAD_FAR_SCALE ),
			turnSeverity
		);
		const nearSample = trackIntel.sampleAhead( currentProgress, nearDistance );
		const farSample = trackIntel.sampleAhead( currentProgress, farDistance );

		// Blend using profile lookAheadBlend (weight toward wp+2)
		const lookAheadBlend = THREE.MathUtils.clamp(
			THREE.MathUtils.lerp( p.lookAheadBlend, TURN_LOOK_AHEAD_BLEND_MIN, turnSeverity ),
			0,
			1
		);
		const nearWeight = 1 - lookAheadBlend;
		const farWeight = lookAheadBlend;
		const routeTargetX = nearSample.x * nearWeight + farSample.x * farWeight;
		const routeTargetZ = nearSample.z * nearWeight + farSample.z * farWeight;
		let targetX = routeTargetX;
		let targetZ = routeTargetZ;

		// Pull the look-ahead target back toward the route corridor when the
		// kart is offset from the centerline, especially before and during turns.
		const routeOffsetX = pos.x - routeSample.x;
		const routeOffsetZ = pos.z - routeSample.z;
		const routeLateralError = routeOffsetX * routeSample.left.x + routeOffsetZ * routeSample.left.z;
		const recaptureShift = THREE.MathUtils.clamp(
			- routeLateralError * ( ROUTE_RECAPTURE_GAIN + turnSeverity * ROUTE_RECAPTURE_TURN_GAIN ),
			- ROUTE_RECAPTURE_MAX_SHIFT,
			ROUTE_RECAPTURE_MAX_SHIFT
		);
		targetX += routeSample.left.x * recaptureShift;
		targetZ += routeSample.left.z * recaptureShift;

		// ── Compute steering ─────────────────────────────────────
		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		_forward.normalize();

		_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
		if ( _toTarget.lengthSq() < 0.0001 ) {

			_toTarget.set( nearSample.forward.x, 0, nearSample.forward.z );

		}
		_toTarget.normalize();

		// Dot product for throttle and lateral offset scaling
		const baseDot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;

		// ── Apply lateral offset perpendicular to track direction ─
		if ( p.lateralOffset !== 0 ) {

			const lineScale = Math.max( 0.15, 1 - turnSeverity * 0.85 );
			const scale = p.lateralOffset * Math.max( 0, baseDot ) * lineScale;

			targetX += nearSample.left.x * scale;
			targetZ += nearSample.left.z * scale;

			// Recompute toTarget after offset
			_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
			if ( _toTarget.lengthSq() < 0.0001 ) {

				_toTarget.set( nearSample.forward.x, 0, nearSample.forward.z );

			}
			_toTarget.normalize();

		}

		const traffic = this._computeTrafficResponse( vehicle, currentProgress, routeSample, p, turnSeverity );

		if ( traffic.lateralBias !== 0 ) {

			const laneSpace = Math.max( 0, 1 - turnSeverity * TRAFFIC_CORNER_LATERAL_SUPPRESSION );
			targetX += routeSample.left.x * traffic.lateralBias * laneSpace;
			targetZ += routeSample.left.z * traffic.lateralBias * laneSpace;

			_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
			if ( _toTarget.lengthSq() < 0.0001 ) {

				_toTarget.set( nearSample.forward.x, 0, nearSample.forward.z );

			}
			_toTarget.normalize();

		}

		// If the kart is already scraping a wall, bias the target back toward
		// open space before trying to continue downtrack. This gives the AI a
		// local recovery vector instead of repeatedly steering into the barrier.
		const wallLeft = Math.max( 0, vehicle._wallProximityLeft || 0 );
		const wallRight = Math.max( 0, vehicle._wallProximityRight || 0 );
		const wallProximity = Math.max( wallLeft, wallRight );
		let wallEscapeFactor = 0;

		if ( wallProximity > WALL_ESCAPE_THRESHOLD ) {

			wallEscapeFactor = Math.min(
				1,
				( wallProximity - WALL_ESCAPE_THRESHOLD ) / ( 1 - WALL_ESCAPE_THRESHOLD )
			);

			const leftX = - _forward.z;
			const leftZ = _forward.x;
			const lateralBias = wallRight - wallLeft;

			targetX += leftX * lateralBias * WALL_ESCAPE_TARGET_SHIFT * wallEscapeFactor;
			targetZ += leftZ * lateralBias * WALL_ESCAPE_TARGET_SHIFT * wallEscapeFactor;

			_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
			if ( _toTarget.lengthSq() < 0.0001 ) {

				_toTarget.set( nearSample.forward.x, 0, nearSample.forward.z );

			}
			_toTarget.normalize();

		}

		const targetDot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;

		// Cross product Y component: positive = target is to the left
		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;

		// Keep any remaining steering noise to calm straights only.
		this._noisePhase += dt * 2.3;
		const noise = turnSeverity < NOISE_TURN_SUPPRESSION_THRESHOLD &&
			traffic.occupancy < 0.15 &&
			wallEscapeFactor === 0
			? Math.sin( this._noisePhase ) * p.noiseAmplitude
			: 0;

		const steerInput = Math.max( - 1, Math.min( 1, cross * p.steerSensitivity + noise ) );

		// ── Compute throttle ─────────────────────────────────────
		let throttle = 1.0;
		if ( targetDot < p.turnThrottleDot ) {

			throttle = Math.max( p.turnThrottleMin, targetDot );

		}

		const cornerThrottleCap = THREE.MathUtils.lerp( 1.0, p.turnThrottleMin, turnSeverity );
		throttle = Math.min( throttle, cornerThrottleCap );

		if ( traffic.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, traffic.throttleCap );

		}

		if ( wallEscapeFactor > 0 ) {

			const escapeThrottleCap = THREE.MathUtils.lerp( 1.0, WALL_ESCAPE_THROTTLE_MIN, wallEscapeFactor );
			throttle = Math.min( throttle, escapeThrottleCap );

		}

		// ── Boost ────────────────────────────────────────────────
		let boost = false;
		if ( vehicle.boostMeter >= 1.0 ) {

			if ( p.boostEagerness ) {

				boost = true;

			} else {

				// Hold for straights: fire only when facing target (dot > 0.9)
				boost = targetDot > 0.95;

			}

		}

		if ( turnSeverity > 0.18 ) boost = false;
		if ( traffic.occupancy > 0.3 ) boost = false;
		if ( wallEscapeFactor > WALL_ESCAPE_BOOST_THRESHOLD ) boost = false;

		this._input.x = steerInput;
		this._input.z = throttle;
		this._input.boost = boost;
		this._input.useItem = false;
		this._wrenchTarget = null;
		let finalTargetX = targetX;
		let finalTargetZ = targetZ;
		let debugMode = wallEscapeFactor > 0
			? 'wall-escape'
			: traffic.occupancy > 0.25
				? 'traffic'
				: 'route';

		// ── Combat behavior ──────────────────────────────────────
		// Item use decision
		if ( this._combat.shouldUseItem( vehicle, this._allVehiclesRef || [] ) ) {

			this._input.useItem = true;

		}

		// Wrench seeking: override waypoint target toward nearest wrench
		if ( this._wrenchPositionsRef && this._combat.shouldPursueWrench( vehicle, {
			turnSeverity,
			trafficOccupancy: traffic.occupancy,
			wallEscapeFactor,
		} ) ) {

			const wrench = this._selectWrenchTarget( vehicle, currentProgress, nearSample );
			if ( wrench ) {

				this._wrenchTarget = wrench;
				finalTargetX = wrench.x;
				finalTargetZ = wrench.z;
				debugMode = 'wrench';

				// Steer toward wrench instead of waypoint
				_toTarget.set( wrench.x - pos.x, 0, wrench.z - pos.z );
				const wDist = _toTarget.length();
				if ( wDist > 0.5 && wDist < 30 ) {

					_toTarget.normalize();
					const wCross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;
					this._input.x = Math.max( - 1, Math.min( 1, wCross * p.steerSensitivity ) );

				}

			}

		}

		this._debugState = {
			mode: debugMode,
			progress: currentProgress,
			routeTarget: { x: routeTargetX, z: routeTargetZ },
			anchorTarget: { x: routeSample.x, z: routeSample.z },
			finalTarget: { x: finalTargetX, z: finalTargetZ },
			turnSeverity,
			trafficOccupancy: traffic.occupancy,
			wallEscapeFactor,
			wrenchTarget: this._wrenchTarget ? { x: this._wrenchTarget.x, z: this._wrenchTarget.z } : null,
		};

		return this._input;

	}

	_selectWrenchTarget( vehicle, currentProgress, routeSample ) {

		const wrenchPositions = this._wrenchPositionsRef || [];
		const trackIntel = this._trackIntel;

		if ( wrenchPositions.length === 0 || ! routeSample ) return null;

		let best = null;
		let bestScore = Infinity;

		for ( const wrench of wrenchPositions ) {

			const dx = wrench.x - vehicle.vehPos.x;
			const dz = wrench.z - vehicle.vehPos.z;
			const relForward = dx * routeSample.forward.x + dz * routeSample.forward.z;
			if ( relForward < WRENCH_SEEK_MIN_FORWARD_DISTANCE || relForward > WRENCH_SEEK_MAX_FORWARD_DISTANCE ) continue;

			const relLeft = dx * routeSample.left.x + dz * routeSample.left.z;
			if ( Math.abs( relLeft ) > WRENCH_SEEK_MAX_LATERAL_DISTANCE ) continue;

			if ( trackIntel && trackIntel.totalLength > 0 ) {

				let progressDelta = trackIntel.getProgress( wrench.x, wrench.z ) - currentProgress;
				if ( progressDelta < 0 ) progressDelta += 1;
				if ( progressDelta > WRENCH_SEEK_MAX_PROGRESS_DELTA ) continue;

			}

			const score = relForward + Math.abs( relLeft ) * 3;
			if ( score < bestScore ) {

				bestScore = score;
				best = wrench;

			}

		}

		return best;

	}

	/**
	 * Set external references for combat decisions (called by AIManager).
	 */
	setCombatRefs( allVehicles, wrenchPositions ) {

		this._allVehiclesRef = allVehicles;
		this._wrenchPositionsRef = wrenchPositions;

	}

	getDebugState() {

		return this._debugState;

	}

	_computeTrafficResponse( vehicle, currentProgress, routeSample, profile, turnSeverity = 0 ) {

		const response = { throttleCap: 1.0, lateralBias: 0, occupancy: 0 };
		const vehicles = this._allVehiclesRef || [];
		const trackIntel = this._trackIntel;

		if ( vehicles.length === 0 || ! trackIntel || trackIntel.totalLength <= 0 ) return response;

		const lookAheadDistance = profile.trafficLookAheadDistance ?? DEFAULT_TRAFFIC_LOOK_AHEAD_DISTANCE;
		const progressWindow = lookAheadDistance / trackIntel.totalLength;
		const laneBiasMax = profile.trafficLateralBias ?? DEFAULT_TRAFFIC_LATERAL_BIAS;
		const trafficThrottleMin = profile.trafficThrottleMin ?? Math.max( profile.turnThrottleMin, 0.35 );

		for ( const entry of vehicles ) {

			const otherVehicle = entry?.vehicle;
			if ( ! otherVehicle || otherVehicle === vehicle ) continue;

			const dx = otherVehicle.vehPos.x - vehicle.vehPos.x;
			const dz = otherVehicle.vehPos.z - vehicle.vehPos.z;
			const distSq = dx * dx + dz * dz;
			if ( distSq > TRAFFIC_SCAN_DIST_SQ ) continue;

			let delta = trackIntel.getProgress( otherVehicle.vehPos.x, otherVehicle.vehPos.z ) - currentProgress;
			if ( delta < 0 ) delta += 1;
			if ( delta <= 0 || delta > progressWindow ) continue;

			const relForward = dx * routeSample.forward.x + dz * routeSample.forward.z;
			if ( relForward < - 1.0 ) continue;

			const relLeft = dx * routeSample.left.x + dz * routeSample.left.z;
			const sameLaneFactor = Math.max( 0, 1 - Math.min( Math.abs( relLeft ) / 3.25, 1 ) );
			const closeness = Math.max( 0, 1 - delta / progressWindow );
			const occupancy = sameLaneFactor * closeness;
			if ( occupancy <= 0 ) continue;

			response.occupancy = Math.max( response.occupancy, occupancy );
			response.throttleCap = Math.min(
				response.throttleCap,
				THREE.MathUtils.lerp( 1.0, trafficThrottleMin, Math.min( 1, occupancy * ( 1 + turnSeverity * 0.5 ) ) )
			);

			if ( Math.abs( relLeft ) > 0.75 ) {

				response.lateralBias += ( relLeft > 0 ? - 1 : 1 ) * occupancy * laneBiasMax;

			}

		}

		response.lateralBias = THREE.MathUtils.clamp( response.lateralBias, - laneBiasMax, laneBiasMax );
		return response;

	}

}
