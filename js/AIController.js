import * as THREE from 'three';
import { DEFAULT_PROFILE } from './AIProfiles.js';
import { AICombatBehavior } from './AICombatBehavior.js';

const _forward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

const STUCK_THRESHOLD = 0.05;
const STUCK_PROGRESS_SPEED_THRESHOLD = 0.75;
const STUCK_PROGRESS_LINEAR_MIN = 0.2;
const BEND_TURN_DEG = 10;
const HARD_TURN_DEG = 25;
const EXIT_BLEND_DISTANCE = 10;
const MAX_LANE_BIAS = 2.25;
const MAX_SEED_LANE_SPREAD = 0.6;
const WALL_PIN_THRESHOLD = 0.82;
const WALL_PIN_SPEED = 0.2;
const WALL_PIN_TIME = 0.45;
const RECOVERY_CLEAR_SPEED = 0.35;
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
const ROUTE_BLEND_MIN = 0.24;
const ROUTE_BLEND_MAX = 0.46;
const ROUTE_RECAPTURE_GAIN = 0.7;
const ROUTE_RECAPTURE_TURN_GAIN = 1.4;
const ROUTE_RECAPTURE_MAX_SHIFT = 4.0;
const TRAFFIC_CORNER_LATERAL_SUPPRESSION = 2.4;
const NOISE_TURN_SUPPRESSION_THRESHOLD = 0.15;
const TRAFFIC_SCAN_DIST_SQ = 36 * 36;
const OVERTAKE_OCCUPANCY_MIN = 0.2;
const OVERTAKE_OCCUPANCY_MAX = 0.48;
const OVERTAKE_TURN_SEVERITY_MAX = 0.72;
const OVERTAKE_RELEASE_TURN_SEVERITY = 0.85;
const OVERTAKE_COMMIT_MIN = 0.45;
const OVERTAKE_COMMIT_MAX = 1.1;
const OVERTAKE_LATERAL_MIN = 0.5;
const OVERTAKE_LATERAL_MAX = 1.0;
const OVERTAKE_THROTTLE_FLOOR = 0.94;
const LAUNCH_PHASE_DURATION = 3.2;
const LAUNCH_PHASE_MAX_DT = 0.08;
const LAUNCH_LANE_BIAS_MAX = 1.35;
const LAUNCH_LANE_SPACE_MIN = 0.22;
const LAUNCH_HOLD_THROTTLE_MIN = 0.08;
const LAUNCH_HOLD_THROTTLE_MAX = 0.32;
const LAUNCH_THROTTLE_FLOOR_MIN = 0.95;
const LAUNCH_THROTTLE_FLOOR_MAX = 1.0;
const MISTAKE_INTERVAL_MIN = 3.6;
const MISTAKE_INTERVAL_MAX = 7.2;
const MISTAKE_DURATION_MIN = 0.35;
const MISTAKE_DURATION_MAX = 0.85;
const MISTAKE_WIDE_SHIFT_MIN = 0.25;
const MISTAKE_WIDE_SHIFT_MAX = 0.85;
const MISTAKE_THROTTLE_LIFT_MIN = 0.08;
const MISTAKE_THROTTLE_LIFT_MAX = 0.28;
const MISTAKE_MIN_SPEED = 0.18;
const WRENCH_SEEK_MIN_FORWARD_DISTANCE = 1.5;
const WRENCH_SEEK_MAX_FORWARD_DISTANCE = 18;
const WRENCH_SEEK_MAX_LATERAL_DISTANCE = 3.0;
const WRENCH_SEEK_MAX_PROGRESS_DELTA = 0.08;

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

function clonePoint( point ) {

	return point ? { ...point } : null;

}

export class AIController {

	constructor( trackIntel, seed, profile ) {

		this._trackIntel = trackIntel;
		this._seed = seed || 0;
		this._noisePhase = seed * 137.5;
		this._laneSpread = ( seededUnit( this._seed ) - 0.5 ) * 2 * MAX_SEED_LANE_SPREAD;

		this._segmentHint = null;
		this._waypointHint = 0;

		this._profile = Object.assign( {}, DEFAULT_PROFILE, profile );
		this._preferredPassSide = seededUnit( this._seed + 23 ) < 0.5 ? - 1 : 1;

		this._stuckTimer = 0;
		this._wallPinTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._recovering = false;
		this._reverseSteer = 0;
		this._recoveryStableTimer = 0;
		this._lastDistanceAlongTrack = null;
		this._lastProgress = null;
		this._activeTurnSign = 0;
		this._exitBlendRemaining = 0;
		this._exitLaneStart = 0;
		this._overtakeTimer = 0;
		this._overtakeDirection = 0;
		this._overtakeTargetId = null;
		this._mistakeTimer = 0;
		this._mistakeType = null;
		this._mistakeDirection = 0;
		this._mistakeMagnitude = 0;
		this._mistakeCycle = 0;
		this._mistakeCheckTimer = 0;
		this._mistakeInterval = this._computeNextMistakeInterval();
		this._launchPhaseElapsed = 0;
		this._launchDirection = Math.abs( this._laneSpread ) > 0.08 ? Math.sign( this._laneSpread ) : this._preferredPassSide;
		this._launchArmed = false;

		this._input = { x: 0, z: 0, touchActive: false, boost: false, drift: false, useItem: false };

		this._combat = new AICombatBehavior();
		this._allVehiclesRef = [];
		this._wrenchPositionsRef = [];
		this._wrenchTarget = null;
		this._debugState = null;

	}

	reset() {

		this._segmentHint = null;
		this._waypointHint = 0;
		this._stuckTimer = 0;
		this._wallPinTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._recovering = false;
		this._reverseSteer = 0;
		this._recoveryStableTimer = 0;
		this._lastDistanceAlongTrack = null;
		this._lastProgress = null;
		this._activeTurnSign = 0;
		this._exitBlendRemaining = 0;
		this._exitLaneStart = 0;
		this._overtakeTimer = 0;
		this._overtakeDirection = 0;
		this._overtakeTargetId = null;
		this._mistakeTimer = 0;
		this._mistakeType = null;
		this._mistakeDirection = 0;
		this._mistakeMagnitude = 0;
		this._mistakeCycle = 0;
		this._mistakeCheckTimer = 0;
		this._mistakeInterval = this._computeNextMistakeInterval();
		this._launchPhaseElapsed = 0;
		this._launchDirection = Math.abs( this._laneSpread ) > 0.08 ? Math.sign( this._laneSpread ) : this._preferredPassSide;
		this._launchArmed = false;
		this._wrenchTarget = null;
		this._input.x = 0;
		this._input.z = 0;
		this._input.touchActive = false;
		this._input.boost = false;
		this._input.drift = false;
		this._input.useItem = false;
		this._debugState = null;

	}

	update( dt, vehicle ) {

		const trackIntel = this._trackIntel;
		if ( ! trackIntel || ! trackIntel.waypoints || trackIntel.count === 0 ) {

			return this._updateFallback( dt );

		}

		if ( this._supportsProgressSampling( trackIntel ) ) {

			return this._updateWithProgressSampling( dt, vehicle );

		}

		if ( this._supportsRouteProjection( trackIntel ) ) {

			return this._updateWithRouteProjection( dt, vehicle );

		}

		return this._updateFallback( dt );

	}

	_updateFallback( dt ) {

		this._clearOvertakePlan();
		this._deactivateMistake();
		this._input.x = Math.sin( this._noisePhase + dt * 2 ) * 0.3;
		this._input.z = 1.0;
		this._input.boost = false;
		this._input.useItem = false;
		this._noisePhase += dt;
		this._setDebugState( {
			mode: 'fallback',
			recoveryActive: false,
		} );
		return this._input;

	}

	_updateWithProgressSampling( dt, vehicle ) {

		const trackIntel = this._trackIntel;
		const pos = vehicle.vehPos;
		const p = this._profile;
		const speed = Math.abs( vehicle.linearSpeed || 0 );

		if ( this._reversing ) {

			this._reverseTimer -= dt;

			if ( this._reverseTimer <= 0 ) {

				this._reversing = false;
				this._stuckTimer = 0;
				this._lastProgress = null;
				this._waypointHint = 0;

			} else {

				this._clearOvertakePlan();
				this._deactivateMistake();
				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				this._input.useItem = false;
				this._setDebugState( {
					mode: 'reversing',
					recoveryActive: true,
				} );
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

		if (
			Math.abs( vehicle.linearSpeed ) < STUCK_THRESHOLD ||
			( Math.abs( vehicle.linearSpeed ) >= STUCK_PROGRESS_LINEAR_MIN && ! makingProgress )
		) {

			this._stuckTimer += dt;

			if ( this._stuckTimer >= p.stuckTime ) {

				this._reversing = true;
				this._reverseTimer = p.reverseTime;
				this._reverseSteer = getWallAwareReverseSteer( vehicle );
				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				this._input.useItem = false;
				this._setDebugState( {
					mode: 'stuck-reverse',
					recoveryActive: true,
				} );
				return this._input;

			}

		} else {

			this._stuckTimer = 0;

		}

		this._waypointHint = trackIntel.getNearestWaypoint?.( pos.x, pos.z, this._waypointHint ) ?? this._waypointHint;

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
		const nearDistance = lerp(
			baseNearDistance,
			Math.max( 6, baseNearDistance * TURN_LOOK_AHEAD_NEAR_SCALE ),
			turnSeverity
		);
		const farDistance = lerp(
			baseFarDistance,
			Math.max( nearDistance + 2, baseFarDistance * TURN_LOOK_AHEAD_FAR_SCALE ),
			turnSeverity
		);
		const nearSample = trackIntel.sampleAhead( currentProgress, nearDistance );
		const farSample = trackIntel.sampleAhead( currentProgress, farDistance );
		const turnAngleDeg = signedAngleDeg( routeSample.forward, farSample.forward );

		const lookAheadBlend = clamp( lerp( p.lookAheadBlend, TURN_LOOK_AHEAD_BLEND_MIN, turnSeverity ), 0, 1 );
		const nearWeight = 1 - lookAheadBlend;
		const farWeight = lookAheadBlend;
		const routeTargetX = nearSample.x * nearWeight + farSample.x * farWeight;
		const routeTargetZ = nearSample.z * nearWeight + farSample.z * farWeight;
		let targetX = routeTargetX;
		let targetZ = routeTargetZ;

		const routeOffsetX = pos.x - routeSample.x;
		const routeOffsetZ = pos.z - routeSample.z;
		const routeLateralError = routeOffsetX * routeSample.left.x + routeOffsetZ * routeSample.left.z;
		const recaptureShift = clamp(
			- routeLateralError * ( ROUTE_RECAPTURE_GAIN + turnSeverity * ROUTE_RECAPTURE_TURN_GAIN ),
			- ROUTE_RECAPTURE_MAX_SHIFT,
			ROUTE_RECAPTURE_MAX_SHIFT
		);
		targetX += routeSample.left.x * recaptureShift;
		targetZ += routeSample.left.z * recaptureShift;

		const launch = this._getLaunchPhaseResponse( dt, {
			speed,
			turnSeverity,
			recoveryActive: this._recovering || this._reversing,
		} );
		const launchTurnBoost = clamp( launch.packRelease * 1.8, 0, 1 );
		const launchTurnRelaxation = launch.active ? lerp( 1.0, 0.02, launchTurnBoost ) : 1.0;
		const throttleTurnSeverity = turnSeverity * launchTurnRelaxation;
		if ( launch.laneBias !== 0 ) {

			targetX += routeSample.left.x * launch.laneBias;
			targetZ += routeSample.left.z * launch.laneBias;

		}

		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		_forward.normalize();

		_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
		if ( _toTarget.lengthSq() < 0.0001 ) {

			_toTarget.set( nearSample.forward.x, 0, nearSample.forward.z );

		}
		_toTarget.normalize();

		const baseDot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;

		if ( p.lateralOffset !== 0 ) {

			const lineScale = Math.max( 0.15, 1 - turnSeverity * 0.85 );
			const scale = p.lateralOffset * Math.max( 0, baseDot ) * lineScale;

			targetX += nearSample.left.x * scale;
			targetZ += nearSample.left.z * scale;
			this._refreshToTarget( pos, nearSample.forward, targetX, targetZ );

		}

		const traffic = this._computeTrafficResponse( vehicle, currentProgress, routeSample, p, throttleTurnSeverity, dt, {
			launchPackRelease: launch.packRelease,
		} );

		if ( traffic.lateralBias !== 0 ) {

			const laneSpace = Math.max( 0, 1 - turnSeverity * TRAFFIC_CORNER_LATERAL_SUPPRESSION );
			targetX += routeSample.left.x * traffic.lateralBias * laneSpace;
			targetZ += routeSample.left.z * traffic.lateralBias * laneSpace;
			this._refreshToTarget( pos, nearSample.forward, targetX, targetZ );

		}

		const mistake = this._getMistakeResponse( dt, {
			turnSeverity,
			turnAngleDeg,
			speed,
			trafficOccupancy: traffic.occupancy,
			wallEscapeFactor: 0,
			recoveryActive: this._recovering || this._reversing,
		} );

		if ( mistake.laneBias !== 0 ) {

			targetX += routeSample.left.x * mistake.laneBias;
			targetZ += routeSample.left.z * mistake.laneBias;
			this._refreshToTarget( pos, nearSample.forward, targetX, targetZ );

		}

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
			this._refreshToTarget( pos, nearSample.forward, targetX, targetZ );

		}

		const targetDot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;
		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;

		this._noisePhase += dt * 2.3;
		const noise = turnSeverity < NOISE_TURN_SUPPRESSION_THRESHOLD &&
			traffic.occupancy < 0.15 &&
			wallEscapeFactor === 0
			? Math.sin( this._noisePhase ) * p.noiseAmplitude
			: 0;

		const steerInput = clamp( cross * p.steerSensitivity + noise, - 1, 1 );

		let throttle = 1.0;
		if ( targetDot < p.turnThrottleDot ) {

			throttle = Math.max( p.turnThrottleMin, targetDot );

		}

		const cornerThrottleCap = lerp( 1.0, p.turnThrottleMin, throttleTurnSeverity );
		throttle = Math.min( throttle, cornerThrottleCap );

		if ( traffic.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, traffic.throttleCap );

		}

		if ( mistake.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, mistake.throttleCap );

		}

		if ( launch.throttleFloor > 0 && wallEscapeFactor === 0 ) {

			throttle = Math.max( throttle, launch.throttleFloor );

		}

		if ( launch.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, launch.throttleCap );

		}

		if ( wallEscapeFactor > 0 ) {

			const escapeThrottleCap = lerp( 1.0, WALL_ESCAPE_THROTTLE_MIN, wallEscapeFactor );
			throttle = Math.min( throttle, escapeThrottleCap );

		}

		let boost = false;
		if ( vehicle.boostMeter >= 1.0 ) {

			const aggressionBoostBias = ( ( p.aggression ?? DEFAULT_PROFILE.aggression ) - 0.5 ) * 0.04;
			const boostCommitDot = ( p.boostCommitDot ?? 0.95 ) - aggressionBoostBias;
			boost = p.boostEagerness ? true : targetDot > boostCommitDot;

		}

		if ( throttleTurnSeverity > 0.18 ) boost = false;
		if ( traffic.occupancy > 0.3 ) boost = false;
		if ( wallEscapeFactor > WALL_ESCAPE_BOOST_THRESHOLD ) boost = false;
		if ( mistake.blockBoost ) boost = false;
		if ( launch.blockBoost ) boost = false;

		this._input.x = steerInput;
		this._input.z = throttle;
		this._input.boost = boost;
		this._input.useItem = false;
		this._wrenchTarget = null;

		let finalTargetX = targetX;
		let finalTargetZ = targetZ;
		let debugMode = wallEscapeFactor > 0
			? 'wall-escape'
			: traffic.overtakeActive
				? 'overtake'
				: mistake.active
					? `mistake-${ mistake.type }`
			: traffic.occupancy > 0.25
				? 'traffic'
				: 'route';

		if ( this._combat.shouldUseItem( vehicle, this._allVehiclesRef ) ) {

			this._input.useItem = true;

		}

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

				_toTarget.set( wrench.x - pos.x, 0, wrench.z - pos.z );
				const wrenchDistance = _toTarget.length();
				if ( wrenchDistance > 0.5 && wrenchDistance < 30 ) {

					_toTarget.normalize();
					const wrenchCross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;
					this._input.x = clamp( wrenchCross * p.steerSensitivity, - 1, 1 );

				}

			}

		}

		this._setDebugState( {
			mode: debugMode,
			progress: currentProgress,
			routeTarget: { x: routeTargetX, z: routeTargetZ },
			anchorTarget: { x: routeSample.x, z: routeSample.z },
			finalTarget: { x: finalTargetX, z: finalTargetZ },
			target: { x: finalTargetX, z: finalTargetZ, laneOffset: 0, wrench: this._cloneWrenchTarget() },
			turnSeverity,
			effectiveTurnSeverity: throttleTurnSeverity,
			trafficOccupancy: traffic.occupancy,
			spacingPressure: traffic.spacingPressure,
			overtakeActive: traffic.overtakeActive,
			overtakeDirection: traffic.overtakeDirection,
			overtakeTargetId: traffic.overtakeTargetId,
			launchActive: launch.active,
			launchHolding: launch.holding,
			launchLaneBias: launch.laneBias,
			launchElapsed: launch.elapsed,
			wallEscapeFactor,
			recoveryActive: false,
			mistakeActive: mistake.active,
			mistakeType: mistake.type,
			wrenchTarget: this._cloneWrenchTarget(),
		} );

		return this._input;

	}

	_updateWithRouteProjection( dt, vehicle ) {

		const trackIntel = this._trackIntel;
		const pos = vehicle.vehPos;
		const p = this._profile;
		const speed = Math.abs( vehicle.linearSpeed || 0 );
		const wallLeft = vehicle?._wallProximityLeft || 0;
		const wallRight = vehicle?._wallProximityRight || 0;
		const wallPressure = Math.max( wallLeft, wallRight );
		const routeProjection = trackIntel.projectToRoute( pos.x, pos.z, this._segmentHint );

		if ( ! routeProjection ) {

			this._clearOvertakePlan();
			this._deactivateMistake();
			this._input.x = 0;
			this._input.z = 0.4;
			this._input.boost = false;
			this._input.useItem = false;
			this._setDebugState( {
				mode: 'route-miss',
				recoveryActive: false,
			} );
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

				this._clearOvertakePlan();
				this._deactivateMistake();
				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				this._input.useItem = false;
				this._setDebugState( {
					mode: 'reverse',
					segmentIndex: routeProjection.segmentIndex,
					recoveryActive: true,
				} );
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
			this._clearOvertakePlan();
			this._deactivateMistake();

			this._input.x = this._reverseSteer;
			this._input.z = - 1.0;
			this._input.boost = false;
			this._input.useItem = false;
			this._setDebugState( {
				mode: 'reverse',
				segmentIndex: routeProjection.segmentIndex,
				recoveryActive: true,
			} );
			return this._input;

		}

		const nearDist = clamp( 4 + speed * 0.35, 4, 10 );
		const farDist = clamp( 10 + speed * 0.65, 10, 22 );
		const brakeDist = clamp( 14 + speed * 0.9, 14, 28 );

		const routeNow = this._sampleProjectedRoute( routeProjection.distanceAlongTrack, 0 )
			|| { x: pos.x, z: pos.z, forward: { x: 0, z: 1 }, left: { x: - 1, z: 0 }, curvature: 0, segmentIndex: routeProjection.segmentIndex, progress: routeProjection.progress, distance: routeProjection.distanceAlongTrack };
		const nearCenter = this._sampleProjectedRoute( routeProjection.distanceAlongTrack + nearDist, 0 ) || routeNow;
		const farCenter = this._sampleProjectedRoute( routeProjection.distanceAlongTrack + farDist, 0 ) || nearCenter;
		const brakeCenter = this._sampleProjectedRoute( routeProjection.distanceAlongTrack + brakeDist, 0 ) || farCenter;

		const nearAngleDeg = signedAngleDeg( routeNow.forward, nearCenter.forward );
		const cornerAngleDeg = signedAngleDeg( routeNow.forward, brakeCenter.forward );
		const turnSeverity = clamp( Math.max( Math.abs( nearAngleDeg ) * 1.35, Math.abs( cornerAngleDeg ) * 0.65 ) / 85, 0, 1 );
		const lanePlan = this._computeLanePlan( {
			baseLane: this._recovering ? 0 : ( p.straightLaneOffset ?? 0 ),
			nearAngleDeg,
			cornerAngleDeg,
			traveledDistance,
			profile: p,
		} );

		const nearTarget = this._sampleProjectedRoute( routeProjection.distanceAlongTrack + nearDist, lanePlan.laneOffset ) || nearCenter;
		const farTarget = this._sampleProjectedRoute( routeProjection.distanceAlongTrack + farDist, lanePlan.laneOffset ) || farCenter;
		const farWeight = clamp( p.lookAheadBlend ?? 0.35, ROUTE_BLEND_MIN, ROUTE_BLEND_MAX );
		const nearWeight = 1 - farWeight;
		const routeTargetX = nearTarget.x * nearWeight + farTarget.x * farWeight;
		const routeTargetZ = nearTarget.z * nearWeight + farTarget.z * farWeight;
		let targetX = routeTargetX;
		let targetZ = routeTargetZ;

		const recaptureShift = clamp(
			- routeProjection.lateralOffset * ( ROUTE_RECAPTURE_GAIN + turnSeverity * ROUTE_RECAPTURE_TURN_GAIN ),
			- ROUTE_RECAPTURE_MAX_SHIFT,
			ROUTE_RECAPTURE_MAX_SHIFT
		);
		targetX += routeNow.left.x * recaptureShift;
		targetZ += routeNow.left.z * recaptureShift;

		const launch = this._getLaunchPhaseResponse( dt, {
			speed,
			turnSeverity,
			recoveryActive: this._recovering || this._reversing,
		} );
		const launchTurnBoost = clamp( launch.packRelease * 1.8, 0, 1 );
		const launchTurnRelaxation = launch.active ? lerp( 1.0, 0.02, launchTurnBoost ) : 1.0;
		const throttleTurnSeverity = turnSeverity * launchTurnRelaxation;
		if ( launch.laneBias !== 0 ) {

			targetX += routeNow.left.x * launch.laneBias;
			targetZ += routeNow.left.z * launch.laneBias;

		}

		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		_forward.normalize();

		this._refreshToTarget( pos, nearTarget.forward || routeNow.forward, targetX, targetZ );

		const traffic = this._computeTrafficResponse( vehicle, routeProjection.progress, routeNow, p, throttleTurnSeverity, dt, {
			launchPackRelease: launch.packRelease,
		} );

		if ( traffic.lateralBias !== 0 ) {

			const laneSpace = Math.max( 0, 1 - turnSeverity * TRAFFIC_CORNER_LATERAL_SUPPRESSION );
			targetX += routeNow.left.x * traffic.lateralBias * laneSpace;
			targetZ += routeNow.left.z * traffic.lateralBias * laneSpace;
			this._refreshToTarget( pos, nearTarget.forward || routeNow.forward, targetX, targetZ );

		}

		const mistake = this._getMistakeResponse( dt, {
			turnSeverity,
			turnAngleDeg: cornerAngleDeg,
			speed,
			trafficOccupancy: traffic.occupancy,
			wallEscapeFactor: 0,
			recoveryActive: this._recovering || this._reversing,
		} );

		if ( mistake.laneBias !== 0 ) {

			targetX += routeNow.left.x * mistake.laneBias;
			targetZ += routeNow.left.z * mistake.laneBias;
			this._refreshToTarget( pos, nearTarget.forward || routeNow.forward, targetX, targetZ );

		}

		let wallEscapeFactor = 0;
		if ( wallPressure > WALL_ESCAPE_THRESHOLD ) {

			wallEscapeFactor = Math.min(
				1,
				( wallPressure - WALL_ESCAPE_THRESHOLD ) / ( 1 - WALL_ESCAPE_THRESHOLD )
			);
			const leftX = - _forward.z;
			const leftZ = _forward.x;
			const lateralBias = wallRight - wallLeft;

			targetX += leftX * lateralBias * WALL_ESCAPE_TARGET_SHIFT * wallEscapeFactor;
			targetZ += leftZ * lateralBias * WALL_ESCAPE_TARGET_SHIFT * wallEscapeFactor;
			this._refreshToTarget( pos, nearTarget.forward || routeNow.forward, targetX, targetZ );

		}

		const dot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;
		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;

		this._noisePhase += dt * 2.3;
		const noise = turnSeverity < NOISE_TURN_SUPPRESSION_THRESHOLD &&
			traffic.occupancy < 0.15 &&
			wallEscapeFactor === 0
			? Math.sin( this._noisePhase ) * p.noiseAmplitude
			: 0;
		const steerInput = clamp( cross * p.steerSensitivity + noise, - 1, 1 );

		const turnRiskDeg = Math.max( Math.abs( nearAngleDeg ) * 1.35, Math.abs( cornerAngleDeg ) * 0.65 ) * launchTurnRelaxation;
		let desiredSpeedFactor = clamp( 1 - turnRiskDeg / 85, 0.32, 1 ) * ( p.cornerSpeedFactor ?? 1 );
		desiredSpeedFactor = clamp( desiredSpeedFactor, 0.25, 1.0 );
		let throttle = desiredSpeedFactor;

		if ( speed > desiredSpeedFactor + 0.08 && Math.abs( cornerAngleDeg ) >= BEND_TURN_DEG ) {

			throttle = - clamp( ( speed - desiredSpeedFactor ) / 0.2, 0.35, 1.0 );

		} else if ( dot < p.turnThrottleDot ) {

			throttle = Math.min( throttle, Math.max( p.turnThrottleMin, dot ) );

		}

		if ( traffic.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, traffic.throttleCap );

		}

		if ( mistake.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, mistake.throttleCap );

		}

		if ( launch.throttleFloor > 0 && wallEscapeFactor === 0 ) {

			throttle = Math.max( throttle, launch.throttleFloor );

		}

		if ( launch.throttleCap < 1.0 ) {

			throttle = Math.min( throttle, launch.throttleCap );

		}

		if ( wallEscapeFactor > 0 ) {

			const escapeThrottleCap = lerp( 1.0, WALL_ESCAPE_THROTTLE_MIN, wallEscapeFactor );
			throttle = Math.min( throttle, escapeThrottleCap );

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
			wallPressure < 0.5 &&
			traffic.occupancy <= 0.3 &&
			wallEscapeFactor <= WALL_ESCAPE_BOOST_THRESHOLD
		) {

			const aggressionBoostBias = ( ( p.aggression ?? DEFAULT_PROFILE.aggression ) - 0.5 ) * 0.04;
			const boostCommitDot = ( p.boostCommitDot ?? 0.92 ) - aggressionBoostBias;
			boost = p.boostEagerness ? true : dot > boostCommitDot;

		}

		if ( mistake.blockBoost ) boost = false;
		if ( launch.blockBoost ) boost = false;

		this._input.x = steerInput;
		this._input.z = throttle;
		this._input.boost = boost;
		this._input.useItem = false;
		this._wrenchTarget = null;

		let finalTargetX = targetX;
		let finalTargetZ = targetZ;
		let debugMode = lanePlan.mode;
		if ( wallEscapeFactor > 0 ) debugMode = 'wall-escape';
		else if ( traffic.overtakeActive ) debugMode = 'overtake';
		else if ( mistake.active ) debugMode = `mistake-${ mistake.type }`;
		else if ( traffic.occupancy > 0.25 ) debugMode = 'traffic';

		if ( this._combat.shouldUseItem( vehicle, this._allVehiclesRef ) ) {

			this._input.useItem = true;

		}

		if ( this._wrenchPositionsRef && this._combat.shouldPursueWrench( vehicle, {
			turnSeverity,
			effectiveTurnSeverity: throttleTurnSeverity,
			trafficOccupancy: traffic.occupancy,
			wallEscapeFactor,
		} ) ) {

			const wrench = this._selectWrenchTarget( vehicle, routeProjection.progress, routeNow );
			if ( wrench ) {

				this._wrenchTarget = wrench;
				finalTargetX = wrench.x;
				finalTargetZ = wrench.z;
				debugMode = 'wrench';

				_toTarget.set( wrench.x - pos.x, 0, wrench.z - pos.z );
				const wrenchDistance = _toTarget.length();
				if ( wrenchDistance > 0.5 && wrenchDistance < 30 ) {

					_toTarget.normalize();
					const wrenchCross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;
					this._input.x = clamp( wrenchCross * p.steerSensitivity, - 1, 1 );

				}

			}

		}

		this._setDebugState( {
			mode: debugMode,
			progress: routeProjection.progress,
			segmentIndex: routeProjection.segmentIndex,
			routeTarget: { x: routeTargetX, z: routeTargetZ },
			anchorTarget: { x: routeNow.x, z: routeNow.z },
			finalTarget: { x: finalTargetX, z: finalTargetZ },
			target: {
				x: finalTargetX,
				z: finalTargetZ,
				laneOffset: lanePlan.laneOffset,
				wrench: this._cloneWrenchTarget(),
			},
			cornerAngleDeg,
			desiredSpeedFactor,
			turnSeverity,
			trafficOccupancy: traffic.occupancy,
			spacingPressure: traffic.spacingPressure,
			overtakeActive: traffic.overtakeActive,
			overtakeDirection: traffic.overtakeDirection,
			overtakeTargetId: traffic.overtakeTargetId,
			launchActive: launch.active,
			launchHolding: launch.holding,
			launchLaneBias: launch.laneBias,
			launchElapsed: launch.elapsed,
			wallEscapeFactor,
			recoveryActive: this._recovering || this._reversing,
			mistakeActive: mistake.active,
			mistakeType: mistake.type,
			wrenchTarget: this._cloneWrenchTarget(),
		} );

		return this._input;

	}

	_sampleProjectedRoute( distanceAlongTrack, lateralOffset = 0 ) {

		const sample = this._trackIntel.sampleRoute?.( distanceAlongTrack, lateralOffset );
		if ( ! sample ) return null;

		const forwardX = sample.forward?.x ?? 0;
		const forwardZ = sample.forward?.z ?? 1;
		const totalLength = this._trackIntel.totalLength || 0;
		const distance = sample.distanceAlongTrack ?? distanceAlongTrack ?? 0;

		return {
			...sample,
			left: { x: - forwardZ, z: forwardX },
			progress: totalLength > 0 ? this._normalizeProgressDistance( distance, totalLength ) / totalLength : 0,
			distance,
		};

	}

	_refreshToTarget( pos, fallbackForward, targetX, targetZ ) {

		_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
		if ( _toTarget.lengthSq() < 0.0001 ) {

			_toTarget.set( fallbackForward.x, 0, fallbackForward.z );

		}
		_toTarget.normalize();

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

	_getLaunchPhaseResponse( dt, context = {} ) {

		const response = {
			active: false,
			holding: false,
			laneBias: 0,
			throttleFloor: 0,
			throttleCap: 1.0,
			blockBoost: false,
			packRelease: 0,
			elapsed: this._launchPhaseElapsed,
		};

		if ( context.recoveryActive || ! this._launchArmed ) return response;

		this._launchPhaseElapsed += Math.min( dt, LAUNCH_PHASE_MAX_DT );
		response.elapsed = this._launchPhaseElapsed;

		if ( this._launchPhaseElapsed > LAUNCH_PHASE_DURATION ) {

			this._launchArmed = false;
			return response;

		}

		response.active = true;
		const reactionDelay = clamp( this._profile.startReactionDelay ?? DEFAULT_PROFILE.startReactionDelay, 0, 0.25 );
		const launchAssertiveness = clamp( this._profile.launchAssertiveness ?? DEFAULT_PROFILE.launchAssertiveness, 0, 1 );
		const openingLaneCommit = clamp( this._profile.openingLaneCommit ?? DEFAULT_PROFILE.openingLaneCommit, 0, 1 );

		if ( this._launchPhaseElapsed < reactionDelay ) {

			response.holding = true;
			response.throttleCap = lerp( LAUNCH_HOLD_THROTTLE_MIN, LAUNCH_HOLD_THROTTLE_MAX, launchAssertiveness );
			response.blockBoost = true;
			return response;

		}

		const progress = clamp(
			( this._launchPhaseElapsed - reactionDelay ) / Math.max( 0.35, LAUNCH_PHASE_DURATION - reactionDelay ),
			0,
			1
		);
		const fade = 1 - progress;
		const laneSpace = Math.max( LAUNCH_LANE_SPACE_MIN, 1 - ( context.turnSeverity ?? 0 ) * 1.1 );
		response.laneBias = this._launchDirection * openingLaneCommit * LAUNCH_LANE_BIAS_MAX * fade * laneSpace;
		response.packRelease = fade * lerp( 0.58, 1.0, launchAssertiveness );

		const desiredLaunchFloor = lerp( LAUNCH_THROTTLE_FLOOR_MIN, LAUNCH_THROTTLE_FLOOR_MAX, launchAssertiveness );
		const launchFloorFade = lerp( 1.0, 0.86, progress );
		const speedFade = lerp( 1.0, 0.88, clamp( ( context.speed ?? 0 ) / 0.95, 0, 1 ) );
		const turnSafetyFade = lerp( 1.0, 0.74, clamp( ( context.turnSeverity ?? 0 ) / 0.4, 0, 1 ) );
		response.throttleFloor = desiredLaunchFloor * launchFloorFade * speedFade * turnSafetyFade;
		response.blockBoost = this._launchPhaseElapsed < reactionDelay + 0.25;

		return response;

	}

	armLaunchPhase() {

		this._launchPhaseElapsed = 0;
		this._launchDirection = Math.abs( this._laneSpread ) > 0.08 ? Math.sign( this._laneSpread ) : this._preferredPassSide;
		this._launchArmed = true;

	}

	_computeTrafficResponse( vehicle, currentProgress, routeSample, profile, turnSeverity = 0, dt = 0, context = {} ) {

		const response = {
			throttleCap: 1.0,
			lateralBias: 0,
			occupancy: 0,
			spacingPressure: 0,
			overtakeActive: false,
			overtakeDirection: 0,
			overtakeTargetId: null,
		};
		const vehicles = this._allVehiclesRef || [];
		const trackIntel = this._trackIntel;

		if ( dt > 0 && this._overtakeTimer > 0 ) {

			this._overtakeTimer = Math.max( 0, this._overtakeTimer - dt );

		}

		if ( vehicles.length === 0 || ! routeSample ) {

			this._clearOvertakePlan();
			return response;

		}

		const totalLength = trackIntel?.totalLength || 0;
		if ( totalLength <= 0 ) {

			this._clearOvertakePlan();
			return response;

		}

		const lookAheadDistance = profile.trafficLookAheadDistance ?? DEFAULT_TRAFFIC_LOOK_AHEAD_DISTANCE;
		const progressWindow = lookAheadDistance / totalLength;
		const laneBiasMax = profile.trafficLateralBias ?? DEFAULT_TRAFFIC_LATERAL_BIAS;
		const trafficThrottleMin = profile.trafficThrottleMin ?? Math.max( profile.turnThrottleMin, 0.35 );
		const aggression = clamp( profile.aggression ?? DEFAULT_PROFILE.aggression, 0, 1 );
		const overtakeCommitment = clamp( profile.overtakeCommitment ?? DEFAULT_PROFILE.overtakeCommitment, 0, 1 );
		const trafficPatience = clamp( profile.trafficPatience ?? DEFAULT_PROFILE.trafficPatience, 0, 1 );
		const launchAssertiveness = clamp( profile.launchAssertiveness ?? DEFAULT_PROFILE.launchAssertiveness, 0, 1 );
		const openingLaneCommit = clamp( profile.openingLaneCommit ?? DEFAULT_PROFILE.openingLaneCommit, 0, 1 );
		const launchPackRelease = clamp( context.launchPackRelease ?? 0, 0, 1 );
		const openingPaceStrength = launchPackRelease * lerp( 0.82, 1.0, launchAssertiveness );
		const openingSpacingStrength = launchPackRelease * openingLaneCommit;
		const sameLaneWidth = lerp( 3.25, 2.1, openingSpacingStrength );
		let bestBlocker = null;

		for ( const entry of vehicles ) {

			const otherVehicle = entry?.vehicle;
			if ( ! otherVehicle || otherVehicle === vehicle ) continue;

			const dx = otherVehicle.vehPos.x - vehicle.vehPos.x;
			const dz = otherVehicle.vehPos.z - vehicle.vehPos.z;
			const distSq = dx * dx + dz * dz;
			if ( distSq > TRAFFIC_SCAN_DIST_SQ ) continue;

			let delta = this._getTrackProgress( otherVehicle.vehPos.x, otherVehicle.vehPos.z ) - currentProgress;
			if ( delta < 0 ) delta += 1;
			if ( delta <= 0 || delta > progressWindow ) continue;

			const relForward = dx * routeSample.forward.x + dz * routeSample.forward.z;
			if ( relForward < - 1.0 ) continue;

			const relLeft = dx * routeSample.left.x + dz * routeSample.left.z;
			const sameLaneFactor = Math.max( 0, 1 - Math.min( Math.abs( relLeft ) / sameLaneWidth, 1 ) );
			const closeness = Math.max( 0, 1 - delta / progressWindow );
			const occupancy = sameLaneFactor * closeness;
			if ( occupancy <= 0 ) continue;

			response.occupancy = Math.max( response.occupancy, occupancy );
			const trafficFloor = clamp(
				lerp( trafficThrottleMin + 0.12, trafficThrottleMin - 0.08, trafficPatience ),
				0.2,
				0.92
			);
			const openingTrafficFloor = clamp(
				lerp( trafficFloor, 1.0, openingPaceStrength ),
				trafficFloor,
				1.0
			);
			const occupancyPenalty = Math.min(
				1,
				occupancy * ( 1 + turnSeverity * 0.5 ) * lerp( 1.0, 0.08, openingPaceStrength )
			);
			response.throttleCap = Math.min(
				response.throttleCap,
				lerp( 1.0, openingTrafficFloor, occupancyPenalty )
			);

			if ( Math.abs( relLeft ) > lerp( 0.75, 0.2, openingSpacingStrength ) ) {

				response.lateralBias += ( relLeft > 0 ? - 1 : 1 ) * occupancy * laneBiasMax * lerp( 1.0, 1.28, openingSpacingStrength );

			}

			if ( openingSpacingStrength > 0 && sameLaneFactor > 0.38 && relForward >= 0.6 ) {

				const spacingDirection = Math.abs( relLeft ) > 0.08 ? ( relLeft > 0 ? - 1 : 1 ) : this._preferredPassSide;
				response.lateralBias += spacingDirection * occupancy * laneBiasMax * openingSpacingStrength * 0.88;
				response.spacingPressure = Math.max( response.spacingPressure, occupancy * openingSpacingStrength );

			}

			if ( sameLaneFactor > 0.28 && relForward >= 1.0 ) {

				const blockerScore = occupancy * 0.7 + closeness * 0.3;
				if ( ! bestBlocker || blockerScore > bestBlocker.score ) {

					bestBlocker = {
						id: entry.id ?? null,
						occupancy,
						score: blockerScore,
						relForward,
						relLeft,
					};

				}

			}

		}

		const passThreshold = Math.max(
			0.12,
			lerp(
			OVERTAKE_OCCUPANCY_MAX,
			OVERTAKE_OCCUPANCY_MIN,
			aggression * 0.55 + overtakeCommitment * 0.45
			) - openingSpacingStrength * 0.22
		);
		const safeToOvertake = turnSeverity <= OVERTAKE_TURN_SEVERITY_MAX;
		const canMaintainPlan = this._overtakeTimer > 0 &&
			this._overtakeDirection !== 0 &&
			safeToOvertake &&
			bestBlocker &&
			( ! this._overtakeTargetId || bestBlocker.id === this._overtakeTargetId );

		if ( turnSeverity >= OVERTAKE_RELEASE_TURN_SEVERITY ) {

			this._clearOvertakePlan();

		} else if ( canMaintainPlan ) {

			response.overtakeActive = true;
			response.overtakeDirection = this._overtakeDirection;
			response.overtakeTargetId = this._overtakeTargetId;

		} else if ( bestBlocker && safeToOvertake && bestBlocker.occupancy >= passThreshold ) {

			this._overtakeDirection = Math.abs( bestBlocker.relLeft ) > 0.35
				? ( bestBlocker.relLeft > 0 ? - 1 : 1 )
				: this._preferredPassSide;
			this._overtakeTargetId = bestBlocker.id;
			this._overtakeTimer = lerp( OVERTAKE_COMMIT_MIN, OVERTAKE_COMMIT_MAX, overtakeCommitment );
			response.overtakeActive = true;
			response.overtakeDirection = this._overtakeDirection;
			response.overtakeTargetId = this._overtakeTargetId;

		} else if ( this._overtakeTimer <= 0 ) {

			this._clearOvertakePlan();

		}

		if ( response.overtakeActive ) {

			const overtakeBias = laneBiasMax * lerp(
				OVERTAKE_LATERAL_MIN,
				OVERTAKE_LATERAL_MAX,
				aggression * 0.5 + overtakeCommitment * 0.5
			);
			const overtakeThrottleFloor = clamp(
				lerp(
					trafficThrottleMin,
					OVERTAKE_THROTTLE_FLOOR + openingPaceStrength * 0.05,
					aggression * 0.65 + overtakeCommitment * 0.35
				),
				trafficThrottleMin,
				0.99
			);

			response.lateralBias += response.overtakeDirection * overtakeBias;
			response.throttleCap = Math.max( response.throttleCap, overtakeThrottleFloor - turnSeverity * 0.2 );
			response.spacingPressure = Math.max( response.spacingPressure, openingSpacingStrength * 0.75 );

		}

		if ( launchPackRelease > 0 && turnSeverity < 0.2 ) {

			const launchTrafficCapFloor = clamp(
				lerp( 0.84, 1.0, launchAssertiveness ) - response.occupancy * 0.08,
				0.8,
				1.0
			);
			response.throttleCap = Math.max( response.throttleCap, launchTrafficCapFloor );

		}

		const lateralClamp = laneBiasMax + openingSpacingStrength * 0.8;
		response.lateralBias = clamp( response.lateralBias, - lateralClamp, lateralClamp );
		return response;

	}

	_getMistakeResponse( dt, context = {} ) {

		const response = {
			active: false,
			type: null,
			laneBias: 0,
			throttleCap: 1.0,
			blockBoost: false,
		};

		if ( context.recoveryActive || ( context.wallEscapeFactor ?? 0 ) > 0.05 ) {

			this._deactivateMistake();
			return response;

		}

		if ( this._mistakeTimer <= 0 ) {

			this._mistakeCheckTimer += dt;
			const canTrigger = ( context.speed ?? 0 ) > MISTAKE_MIN_SPEED &&
				( context.trafficOccupancy ?? 0 ) < 0.7 &&
				( context.turnSeverity ?? 0 ) < 0.8;

			if ( canTrigger && this._mistakeCheckTimer >= this._mistakeInterval ) {

				this._mistakeCheckTimer = 0;
				this._activateMistake( context );

			}

		}

		if ( this._mistakeTimer <= 0 ) return response;

		this._mistakeTimer = Math.max( 0, this._mistakeTimer - dt );
		response.active = true;
		response.type = this._mistakeType;
		response.blockBoost = true;

		if ( this._mistakeType === 'wide-line' ) {

			response.laneBias = this._mistakeDirection * this._mistakeMagnitude;

		} else if ( this._mistakeType === 'hesitate' ) {

			response.throttleCap = Math.max( 0.22, 1 - this._mistakeMagnitude );

		}

		if ( this._mistakeTimer <= 0 ) {

			this._deactivateMistake();

		}

		return response;

	}

	_activateMistake( context = {} ) {

		const turnSeverity = context.turnSeverity ?? 0;
		const turnSign = Math.sign( context.turnAngleDeg ?? 0 ) || this._activeTurnSign || 0;
		const severity = clamp( this._profile.mistakeSeverity ?? DEFAULT_PROFILE.mistakeSeverity, 0, 1 );
		const pick = seededUnit( this._seed + this._mistakeCycle, 31 );
		const canWideLine = turnSign !== 0 && turnSeverity >= 0.18 && turnSeverity <= 0.65;
		const useWideLine = canWideLine && pick < 0.7;
		const intensity = clamp( severity * lerp( 0.9, 1.15, seededUnit( this._seed + this._mistakeCycle, 32 ) ), 0, 1 );

		this._mistakeType = useWideLine ? 'wide-line' : 'hesitate';
		this._mistakeDirection = useWideLine ? - turnSign : 0;
		this._mistakeMagnitude = useWideLine
			? lerp( MISTAKE_WIDE_SHIFT_MIN, MISTAKE_WIDE_SHIFT_MAX, intensity )
			: lerp( MISTAKE_THROTTLE_LIFT_MIN, MISTAKE_THROTTLE_LIFT_MAX, intensity );
		this._mistakeTimer = lerp( MISTAKE_DURATION_MIN, MISTAKE_DURATION_MAX, intensity );
		this._mistakeCycle += 1;
		this._mistakeInterval = this._computeNextMistakeInterval();

	}

	_deactivateMistake() {

		this._mistakeTimer = 0;
		this._mistakeType = null;
		this._mistakeDirection = 0;
		this._mistakeMagnitude = 0;

	}

	_computeNextMistakeInterval() {

		const rate = clamp( this._profile.mistakeRate ?? DEFAULT_PROFILE.mistakeRate, 0, 1 );
		const seed = seededUnit( this._seed + this._mistakeCycle, 33 );
		const base = lerp( MISTAKE_INTERVAL_MAX, MISTAKE_INTERVAL_MIN, rate );
		return base * lerp( 0.9, 1.14, seed );

	}

	_clearOvertakePlan() {

		this._overtakeTimer = 0;
		this._overtakeDirection = 0;
		this._overtakeTargetId = null;

	}

	_selectWrenchTarget( vehicle, currentProgress, routeSample ) {

		const wrenchPositions = this._wrenchPositionsRef || [];
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

			const wrenchProgress = this._getTrackProgress( wrench.x, wrench.z );
			if ( Number.isFinite( wrenchProgress ) ) {

				let progressDelta = wrenchProgress - currentProgress;
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

	_getTrackProgress( worldX, worldZ ) {

		const trackIntel = this._trackIntel;

		if ( typeof trackIntel?.getProgress === 'function' ) {

			return trackIntel.getProgress( worldX, worldZ, this._segmentHint ?? this._waypointHint );

		}

		if ( typeof trackIntel?.projectToRoute === 'function' ) {

			return trackIntel.projectToRoute( worldX, worldZ, this._segmentHint )?.progress ?? 0;

		}

		return 0;

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

	_normalizeProgressDistance( distance, totalLength ) {

		if ( totalLength <= 0 ) return 0;
		let normalized = distance % totalLength;
		if ( normalized < 0 ) normalized += totalLength;
		return normalized;

	}

	_supportsProgressSampling( trackIntel ) {

		return typeof trackIntel?.getProgress === 'function' &&
			typeof trackIntel?.sampleAtProgress === 'function' &&
			typeof trackIntel?.sampleAhead === 'function' &&
			typeof trackIntel?.estimateTurnSeverity === 'function';

	}

	_supportsRouteProjection( trackIntel ) {

		return typeof trackIntel?.projectToRoute === 'function' &&
			typeof trackIntel?.sampleRoute === 'function';

	}

	_cloneWrenchTarget() {

		return this._wrenchTarget ? { x: this._wrenchTarget.x, z: this._wrenchTarget.z } : null;

	}

	_setDebugState( nextState ) {

		this._debugState = {
			mode: nextState.mode ?? 'follow',
			progress: nextState.progress ?? null,
			segmentIndex: nextState.segmentIndex ?? 0,
			target: nextState.target ? { ...nextState.target } : null,
			routeTarget: clonePoint( nextState.routeTarget ),
			anchorTarget: clonePoint( nextState.anchorTarget ),
			finalTarget: clonePoint( nextState.finalTarget ),
			cornerAngleDeg: nextState.cornerAngleDeg ?? 0,
			desiredSpeedFactor: nextState.desiredSpeedFactor ?? 1,
			turnSeverity: nextState.turnSeverity ?? 0,
			effectiveTurnSeverity: nextState.effectiveTurnSeverity ?? nextState.turnSeverity ?? 0,
			trafficOccupancy: nextState.trafficOccupancy ?? 0,
			spacingPressure: nextState.spacingPressure ?? 0,
			overtakeActive: nextState.overtakeActive ?? false,
			overtakeDirection: nextState.overtakeDirection ?? 0,
			overtakeTargetId: nextState.overtakeTargetId ?? null,
			launchActive: nextState.launchActive ?? false,
			launchHolding: nextState.launchHolding ?? false,
			launchLaneBias: nextState.launchLaneBias ?? 0,
			launchElapsed: nextState.launchElapsed ?? 0,
			wallEscapeFactor: nextState.wallEscapeFactor ?? 0,
			recoveryActive: nextState.recoveryActive ?? false,
			mistakeActive: nextState.mistakeActive ?? false,
			mistakeType: nextState.mistakeType ?? null,
			wrenchTarget: clonePoint( nextState.wrenchTarget ),
		};

	}

	setCombatRefs( allVehicles, wrenchPositions ) {

		this._allVehiclesRef = allVehicles;
		this._wrenchPositionsRef = wrenchPositions;

	}

	getDebugState() {

		if ( ! this._debugState ) return null;

		return {
			...this._debugState,
			target: this._debugState.target ? {
				...this._debugState.target,
				wrench: clonePoint( this._debugState.target.wrench ),
			} : null,
			routeTarget: clonePoint( this._debugState.routeTarget ),
			anchorTarget: clonePoint( this._debugState.anchorTarget ),
			finalTarget: clonePoint( this._debugState.finalTarget ),
			wrenchTarget: clonePoint( this._debugState.wrenchTarget ),
		};

	}

}
