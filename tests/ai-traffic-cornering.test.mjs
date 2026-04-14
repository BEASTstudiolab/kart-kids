import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIController } from '../js/AIController.js';

function makeStraightTrackIntel( turnSeverity = 0 ) {

	return {
		waypoints: [
			{ x: 0, z: 0 },
			{ x: 0, z: 20 },
			{ x: 0, z: 40 },
			{ x: 0, z: 60 },
		],
		count: 4,
		totalLength: 60,
		getNearestWaypoint() {

			return 0;

		},
		getProgress( worldX, worldZ ) {

			void worldX;
			let wrapped = worldZ % 60;
			if ( wrapped < 0 ) wrapped += 60;
			return wrapped / 60;

		},
		sampleAtProgress( progress ) {

			return this.sampleAhead( progress, 0 );

		},
		sampleAhead( progress, distanceAhead = 0 ) {

			const distance = ( ( progress % 1 ) + 1 ) % 1 * 60 + distanceAhead;
			let wrapped = distance % 60;
			if ( wrapped < 0 ) wrapped += 60;

			return {
				x: 0,
				z: wrapped,
				forward: { x: 0, z: 1 },
				left: { x: - 1, z: 0 },
				progress: wrapped / 60,
				distance: wrapped,
				segmentIndex: 0,
			};

		},
		estimateTurnSeverity() {

			return turnSeverity;

		},
	};

}

function makeVehicle( x, z, boostMeter = 0 ) {

	return {
		vehPos: new THREE.Vector3( x, 0, z ),
		linearSpeed: 1,
		boostMeter,
		_wallProximityLeft: 0,
		_wallProximityRight: 0,
		container: {
			quaternion: new THREE.Quaternion(),
		},
	};

}

test( 'AIController slows and holds boost when another kart blocks the lane ahead', () => {

	const controller = new AIController(
		makeStraightTrackIntel(),
		0,
		{
			name: 'Traffic Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 10,
			lookAheadFarDistance: 18,
			trafficLookAheadDistance: 14,
			trafficThrottleMin: 0.35,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const selfVehicle = makeVehicle( 0, 0, 1.0 );
	const blockingVehicle = makeVehicle( 0, 5, 0 );
	controller.setCombatRefs( [
		{ id: 'self', vehicle: selfVehicle },
		{ id: 'blocker', vehicle: blockingVehicle },
	], [] );

	const input = controller.update( 1 / 60, selfVehicle );

	assert.ok( input.z < 0.8, `expected traffic ahead to reduce throttle, got ${ input.z }` );
	assert.equal( input.boost, false );

} );

test( 'AIController ignores a kart that is ahead but clearly in another lane', () => {

	const controller = new AIController(
		makeStraightTrackIntel(),
		0,
		{
			name: 'Lane Separation Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 10,
			lookAheadFarDistance: 18,
			trafficLookAheadDistance: 14,
			trafficThrottleMin: 0.35,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const selfVehicle = makeVehicle( 0, 0, 0 );
	const offLaneVehicle = makeVehicle( 5, 5, 0 );
	controller.setCombatRefs( [
		{ id: 'self', vehicle: selfVehicle },
		{ id: 'offlane', vehicle: offLaneVehicle },
	], [] );

	const input = controller.update( 1 / 60, selfVehicle );

	assert.ok( input.z > 0.9, `expected off-lane traffic to leave throttle mostly intact, got ${ input.z }` );

} );

test( 'AIController prefers slowing over lateral dodging when traffic appears in a sharp corner', () => {

	const controller = new AIController(
		makeStraightTrackIntel( 0.9 ),
		0,
		{
			name: 'Corner Traffic Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.25,
			lookAheadBlend: 0.55,
			lookAheadNearDistance: 10,
			lookAheadFarDistance: 18,
			trafficLookAheadDistance: 14,
			trafficThrottleMin: 0.3,
			trafficLateralBias: 1.4,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	const selfVehicle = makeVehicle( 0, 0, 1.0 );
	const cornerTraffic = makeVehicle( 2, 5, 0 );
	controller.setCombatRefs( [
		{ id: 'self', vehicle: selfVehicle },
		{ id: 'corner-traffic', vehicle: cornerTraffic },
	], [] );

	const input = controller.update( 1 / 60, selfVehicle );

	assert.ok( input.z < 0.55, `expected sharp-corner traffic to reduce throttle hard, got ${ input.z }` );
	assert.ok( Math.abs( input.x ) < 0.15, `expected sharp-corner traffic to avoid a hard lane change, got ${ input.x }` );

} );

test( 'Aggressive AI commits to a pass on a straight while cautious AI stays tucked in longer', () => {

	const track = makeStraightTrackIntel();
	const selfVehicle = makeVehicle( 0, 0, 1.0 );
	const blocker = makeVehicle( 0.1, 8, 0 );

	const aggressiveController = new AIController(
		track,
		0,
		{
			name: 'Aggressive Passer',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 10,
			lookAheadFarDistance: 18,
			trafficLookAheadDistance: 14,
			trafficThrottleMin: 0.35,
			trafficLateralBias: 0.9,
			aggression: 0.82,
			overtakeCommitment: 0.86,
			trafficPatience: 0.24,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);
	aggressiveController.setCombatRefs( [
		{ id: 'self', vehicle: selfVehicle },
		{ id: 'blocker', vehicle: blocker },
	], [] );

	const cautiousVehicle = makeVehicle( 0, 0, 1.0 );
	const cautiousBlocker = makeVehicle( 0.1, 8, 0 );
	const cautiousController = new AIController(
		track,
		1,
		{
			name: 'Cautious Follower',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 10,
			lookAheadFarDistance: 18,
			trafficLookAheadDistance: 14,
			trafficThrottleMin: 0.35,
			trafficLateralBias: 0.9,
			aggression: 0.32,
			overtakeCommitment: 0.34,
			trafficPatience: 0.72,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);
	cautiousController.setCombatRefs( [
		{ id: 'self', vehicle: cautiousVehicle },
		{ id: 'blocker', vehicle: cautiousBlocker },
	], [] );

	const aggressiveInput = aggressiveController.update( 1 / 60, selfVehicle );
	const aggressiveDebug = aggressiveController.getDebugState();
	const cautiousInput = cautiousController.update( 1 / 60, cautiousVehicle );
	const cautiousDebug = cautiousController.getDebugState();

	assert.equal( aggressiveDebug.overtakeActive, true );
	assert.equal( aggressiveDebug.mode, 'overtake' );
	assert.ok( Math.abs( aggressiveInput.x ) > 0.18, `expected a committed pass steer input, got ${ aggressiveInput.x }` );
	assert.ok( aggressiveInput.z > cautiousInput.z, 'aggressive AI should preserve more throttle than cautious AI when a pass opens' );
	assert.ok(
		Math.abs( aggressiveInput.x ) >= Math.abs( cautiousInput.x ),
		'aggressive AI should commit to the pass lane at least as strongly as cautious AI'
	);
	assert.ok(
		aggressiveDebug.overtakeDirection !== 0 || cautiousDebug.overtakeDirection !== 0,
		'at least one controller should claim a pass direction in the straight-line probe'
	);

} );

test( 'AIController launch phase keeps assertive starts from bogging under opening traffic', () => {

	const track = makeStraightTrackIntel();
	const selfVehicle = makeVehicle( 0, 0, 0 );
	const blocker = makeVehicle( 0.15, 4, 0 );
	const controller = new AIController(
		track,
		0,
		{
			name: 'Launch Traffic Probe',
			steerSensitivity: 3.5,
			noiseAmplitude: 0,
			turnThrottleDot: 0.7,
			turnThrottleMin: 0.3,
			lookAheadBlend: 0.5,
			lookAheadNearDistance: 10,
			lookAheadFarDistance: 18,
			trafficLookAheadDistance: 14,
			trafficThrottleMin: 0.3,
			trafficLateralBias: 0.9,
			aggression: 0.8,
			overtakeCommitment: 0.84,
			trafficPatience: 0.24,
			startReactionDelay: 0,
			openingLaneCommit: 0.88,
			launchAssertiveness: 0.92,
			lateralOffset: 0,
			boostEagerness: true,
			stuckTime: 2.0,
			reverseTime: 1.5,
			weight: 5,
		}
	);

	controller.setCombatRefs( [
		{ id: 'self', vehicle: selfVehicle },
		{ id: 'blocker', vehicle: blocker },
	], [] );
	controller.armLaunchPhase();

	let input = null;
	for ( let i = 0; i < 18; i ++ ) {

		input = controller.update( 1 / 60, selfVehicle );
		selfVehicle.linearSpeed = Math.max( selfVehicle.linearSpeed, Math.max( 0, input.z ) * 0.78 );
		selfVehicle.vehPos.z += selfVehicle.linearSpeed * 0.55;
		blocker.linearSpeed = Math.max( 0.32, selfVehicle.linearSpeed * 0.9 );
		blocker.vehPos.z = selfVehicle.vehPos.z + 4;

	}

	const debug = controller.getDebugState();
	assert.equal( debug.launchActive, true );
	assert.ok( debug.trafficOccupancy > 0.2, `expected nearby launch traffic occupancy, got ${ debug.trafficOccupancy }` );
	assert.ok( debug.spacingPressure > 0.2, `expected launch spacing pressure to be visible, got ${ debug.spacingPressure }` );
	assert.ok( Math.abs( input.x ) > 0.12, `expected launch traffic to create a committed lane move, got ${ input.x }` );
	assert.ok( input.z > 0.9, `expected assertive launch to keep near-full throttle under traffic, got ${ input.z }` );
	assert.equal( controller._reversing, false );

} );
