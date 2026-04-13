import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIController } from '../js/AIController.js';

function makeLoopSampler( waypoints ) {

	const count = waypoints.length;
	const cumulative = new Float64Array( count );
	cumulative[ 0 ] = 0;

	for ( let i = 1; i < count; i ++ ) {

		const prev = waypoints[ i - 1 ];
		const curr = waypoints[ i ];
		const dx = curr.x - prev.x;
		const dz = curr.z - prev.z;
		cumulative[ i ] = cumulative[ i - 1 ] + Math.sqrt( dx * dx + dz * dz );

	}

	const last = waypoints[ count - 1 ];
	const first = waypoints[ 0 ];
	const closeDx = first.x - last.x;
	const closeDz = first.z - last.z;
	const totalLength = cumulative[ count - 1 ] + Math.sqrt( closeDx * closeDx + closeDz * closeDz );

	function sampleAtDistance( distance ) {

		let wrapped = distance % totalLength;
		if ( wrapped < 0 ) wrapped += totalLength;

		let segIdx = 0;
		for ( let i = 0; i < count; i ++ ) {

			const next = ( i + 1 ) % count;
			const segStart = cumulative[ i ];
			const segEnd = next === 0 ? totalLength : cumulative[ next ];

			if ( wrapped >= segStart && wrapped < segEnd ) {

				segIdx = i;
				break;

			}

		}

		const next = ( segIdx + 1 ) % count;
		const a = waypoints[ segIdx ];
		const b = waypoints[ next ];
		const segStart = cumulative[ segIdx ];
		const segEnd = next === 0 ? totalLength : cumulative[ next ];
		const segLen = Math.max( segEnd - segStart, 0 );
		const t = segLen > 0 ? ( wrapped - segStart ) / segLen : 0;
		const fx = b.x - a.x;
		const fz = b.z - a.z;
		const fLen = Math.sqrt( fx * fx + fz * fz ) || 1;
		const nx = fx / fLen;
		const nz = fz / fLen;

		return {
			x: a.x + ( b.x - a.x ) * t,
			z: a.z + ( b.z - a.z ) * t,
			forward: { x: nx, z: nz },
			left: { x: - nz, z: nx },
			progress: wrapped / totalLength,
		};

	}

	return { sampleAtDistance, totalLength };

}

function makeVehicle( { x = 0, z = 0, boostMeter = 0, health = null } = {} ) {

	return {
		vehPos: new THREE.Vector3( x, 0, z ),
		linearSpeed: 1,
		boostMeter,
		health,
		_wallProximityLeft: 0,
		_wallProximityRight: 0,
		container: {
			quaternion: new THREE.Quaternion(),
		},
	};

}

function makeTrackIntel( waypoints, { turnSeverity = 0 } = {} ) {

	const sampler = makeLoopSampler( waypoints );

	return {
		waypoints,
		count: waypoints.length,
		totalLength: sampler.totalLength,
		getNearestWaypoint() {

			return 0;

		},
		getProgress() {

			return 0;

		},
		sampleAhead( progress, distanceAhead = 0 ) {

			return sampler.sampleAtDistance( progress * sampler.totalLength + distanceAhead );

		},
		sampleAtProgress( progress ) {

			return sampler.sampleAtDistance( progress * sampler.totalLength );

		},
		estimateTurnSeverity() {

			return turnSeverity;

		},
	};

}

function makeProgressTrackIntel( progresses, options ) {

	let index = 0;
	const trackIntel = makeTrackIntel( [
		{ x: 0, z: 0 },
		{ x: 0, z: 5 },
		{ x: 5, z: 5 },
	], options );

	return {
		...trackIntel,
		getProgress() {

			const value = progresses[ Math.min( index, progresses.length - 1 ) ];
			index ++;
			return value;

		},
	};

}

test( 'AIController throttles against the final offset target, not the pre-offset heading', () => {

	const controller = new AIController(
		makeTrackIntel( [
			{ x: 0, z: 0 },
			{ x: 0, z: 5 },
			{ x: 5, z: 5 },
		] ),
		0,
		{
			name: 'Throttle Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.95,
			turnThrottleMin: 0.2,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 8,
			lookAheadFarDistance: 14,
			lateralOffset: - 6,
			boostEagerness: false,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const input = controller.update( 1 / 60, makeVehicle() );

	assert.ok(
		input.z < 0.75,
		`expected throttle to reflect the sharper offset target, got ${ input.z }`
	);

} );

test( 'AIController boost gating uses the final offset target heading', () => {

	const controller = new AIController(
		makeTrackIntel( [
			{ x: 0, z: 0 },
			{ x: 0, z: 8 },
			{ x: 5, z: 8 },
		] ),
		0,
		{
			name: 'Boost Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNear: 1,
			lookAheadFar: 2,
			lateralOffset: - 6,
			boostEagerness: false,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const input = controller.update( 1 / 60, makeVehicle( { boostMeter: 1.0 } ) );

	assert.equal( input.boost, false );

} );

test( 'AIController reverses when it is moving but not making track progress', () => {

	const controller = new AIController(
		makeProgressTrackIntel( [ 0.2, 0.20005, 0.2001, 0.20015 ] ),
		0,
		{
			name: 'Progress Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNear: 1,
			lookAheadFar: 2,
			lateralOffset: 0,
			boostEagerness: false,
			stuckTime: 0.05,
			reverseTime: 0.5,
			weight: 5,
		}
	);

	const vehicle = makeVehicle();
	vehicle.linearSpeed = 0.6;

	controller.update( 1 / 60, vehicle );
	controller.update( 1 / 60, vehicle );
	controller.update( 1 / 60, vehicle );
	const input = controller.update( 1 / 60, vehicle );

	assert.equal( input.z, - 1.0 );
	assert.ok( Math.abs( input.x ) > 0 );

} );

test( 'AIController reduces throttle for upcoming turn severity before the heading fully tightens', () => {

	const controller = new AIController(
		makeTrackIntel(
			[
				{ x: 0, z: 0 },
				{ x: 0, z: 10 },
				{ x: 10, z: 10 },
			],
			{ turnSeverity: 0.85 }
		),
		0,
		{
			name: 'Corner Planner Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.6,
			turnThrottleMin: 0.25,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 8,
			lookAheadFarDistance: 14,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const input = controller.update( 1 / 60, makeVehicle() );

	assert.ok( input.z < 0.5, `expected turn planning to trim throttle, got ${ input.z }` );
	assert.equal( input.boost, false );

} );

test( 'AIController biases away from a side wall and suppresses boost while recovering', () => {

	const controller = new AIController(
		makeTrackIntel( [
			{ x: 0, z: 0 },
			{ x: 0, z: 6 },
			{ x: 0, z: 12 },
		] ),
		0,
		{
			name: 'Wall Escape Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNear: 1,
			lookAheadFar: 2,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const vehicle = makeVehicle( { boostMeter: 1.0 } );
	vehicle._wallProximityRight = 0.95;

	const input = controller.update( 1 / 60, vehicle );

	assert.ok( input.x > 0.2, `expected wall escape to steer left, got ${ input.x }` );
	assert.ok( input.z < 0.8, `expected wall escape to cut throttle, got ${ input.z }` );
	assert.equal( input.boost, false );

} );

test( 'AIController pulls a wide kart back toward the route and exposes debug targets', () => {

	const controller = new AIController(
		makeTrackIntel( [
			{ x: 0, z: 0 },
			{ x: 0, z: 8 },
			{ x: 0, z: 16 },
		] ),
		0,
		{
			name: 'Route Recapture Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.6,
			lookAheadNearDistance: 8,
			lookAheadFarDistance: 16,
			lateralOffset: 0,
			boostEagerness: false,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const vehicle = makeVehicle( { x: 3, z: 0 } );
	const input = controller.update( 1 / 60, vehicle );
	const debug = controller.getDebugState();

	assert.ok( input.x > 0.25, `expected wide kart to steer left toward route, got ${ input.x }` );
	assert.ok( debug, 'expected controller debug state to exist' );
	assert.equal( debug.mode, 'route' );
	assert.equal( debug.routeTarget.x, 0 );
	assert.ok( debug.finalTarget.x < - 1.0, `expected final target to pull back across the centerline, got ${ debug.finalTarget.x }` );

} );

test( 'AIController ignores a damaged-wrench lure on a neighboring lane', () => {

	const controller = new AIController(
		makeTrackIntel( [
			{ x: 0, z: 0 },
			{ x: 0, z: 10 },
			{ x: 0, z: 20 },
		] ),
		0,
		{
			name: 'Wrench Lane Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 8,
			lookAheadFarDistance: 14,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const vehicle = makeVehicle( {
		health: {
			globalHP: 40,
			quadrants: [
				{ state: 0 },
				{ state: 0 },
				{ state: 0 },
				{ state: 0 },
			],
		},
	} );

	controller.setCombatRefs( [ { id: 'self', vehicle } ], [
		{ x: 6, z: 5 },
	] );

	const input = controller.update( 1 / 60, vehicle );

	assert.equal( controller._wrenchTarget, null );
	assert.ok(
		Math.abs( input.x ) < 0.05,
		`expected controller to stay on the route, got steer ${ input.x }`
	);

} );

test( 'AIController can still target a repair wrench directly ahead on the race line', () => {

	const controller = new AIController(
		makeTrackIntel( [
			{ x: 0, z: 0 },
			{ x: 0, z: 10 },
			{ x: 0, z: 20 },
		] ),
		0,
		{
			name: 'Wrench Corridor Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 8,
			lookAheadFarDistance: 14,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const vehicle = makeVehicle( {
		health: {
			globalHP: 40,
			quadrants: [
				{ state: 0 },
				{ state: 0 },
				{ state: 0 },
				{ state: 0 },
			],
		},
	} );

	controller.setCombatRefs( [ { id: 'self', vehicle } ], [
		{ x: 0, z: 8 },
	] );

	controller.update( 1 / 60, vehicle );

	assert.deepEqual( controller._wrenchTarget, { x: 0, z: 8 } );

} );
