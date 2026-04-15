import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { AIManager } from '../js/AIManager.js';
import { AIController } from '../js/AIController.js';
import { createSeededCPUProfile } from '../js/AIProfiles.js';
import { computeSpawnPosition } from '../js/Track.js';
import { TRACK_CELLS } from '../js/TrackData.js';
import { TrackIntel } from '../js/TrackIntel.js';

const CUSTOM_RECT_LOOP_CELLS = [
	[ 0, - 1, 'trk-finish', 0 ],
	[ 0, - 2, 'trk-straight', 0 ],
	[ 0, 0, 'trk-straight', 0 ],
	[ 0, - 3, 'trk-straight', 0 ],
	[ 0, - 4, 'trk-straight', 0 ],
	[ 0, - 5, 'trk-corner-1x1', 0 ],
	[ - 1, - 5, 'trk-straight', 16 ],
	[ - 2, - 5, 'trk-straight', 16 ],
	[ - 3, - 5, 'trk-straight', 16 ],
	[ - 4, - 5, 'trk-corner-1x1', 16 ],
	[ - 4, - 4, 'trk-straight', 10 ],
	[ - 4, - 3, 'trk-straight', 10 ],
	[ - 4, - 2, 'trk-straight', 10 ],
	[ - 4, - 1, 'trk-straight', 10 ],
	[ - 4, 0, 'trk-straight', 10 ],
	[ - 4, 1, 'trk-straight', 10 ],
	[ - 4, 2, 'trk-straight', 10 ],
	[ - 4, 3, 'trk-corner-1x1', 10 ],
	[ - 3, 3, 'trk-straight', 22 ],
	[ - 2, 3, 'trk-straight', 22 ],
	[ - 1, 3, 'trk-straight', 22 ],
	[ 0, 3, 'trk-corner-1x1', 22 ],
	[ 0, 2, 'trk-straight', 0 ],
	[ 0, 1, 'trk-straight', 0 ],
];

function createPolylineTrack( rawPoints ) {

	const points = rawPoints.map( ( point ) => ( { x: point.x, y: point.y || 0, z: point.z } ) );
	const segments = [];
	let totalLength = 0;

	for ( let i = 0; i < points.length - 1; i ++ ) {

		const from = points[ i ];
		const to = points[ i + 1 ];
		const dx = to.x - from.x;
		const dz = to.z - from.z;
		const length = Math.sqrt( dx * dx + dz * dz );
		const forward = length > 0 ? { x: dx / length, z: dz / length } : { x: 0, z: 1 };
		segments.push( {
			index: i,
			startDist: totalLength,
			length,
			forward,
			from,
			to,
			curvature: 0,
		} );
		totalLength += length;

	}

	for ( let i = 0; i < segments.length; i ++ ) {

		const curr = segments[ i ];
		const next = segments[ Math.min( i + 1, segments.length - 1 ) ];
		const dot = THREE.MathUtils.clamp( curr.forward.x * next.forward.x + curr.forward.z * next.forward.z, - 1, 1 );
		const cross = curr.forward.x * next.forward.z - curr.forward.z * next.forward.x;
		curr.curvature = Math.atan2( cross, dot ) / Math.max( curr.length, 1e-6 );

	}

	function projectToRoute( worldX, worldZ ) {

		let best = null;

		for ( const seg of segments ) {

			const abx = seg.to.x - seg.from.x;
			const abz = seg.to.z - seg.from.z;
			const apx = worldX - seg.from.x;
			const apz = worldZ - seg.from.z;
			const abLenSq = abx * abx + abz * abz;
			let t = 0;
			if ( abLenSq > 0 ) t = THREE.MathUtils.clamp( ( apx * abx + apz * abz ) / abLenSq, 0, 1 );

			const px = seg.from.x + abx * t;
			const pz = seg.from.z + abz * t;
			const dx = worldX - px;
			const dz = worldZ - pz;
			const perpX = - seg.forward.z;
			const perpZ = seg.forward.x;
			const lateralOffset = dx * perpX + dz * perpZ;
			const distanceFromRoute = Math.sqrt( dx * dx + dz * dz );

			const candidate = {
				segmentIndex: seg.index,
				distanceAlongTrack: seg.startDist + seg.length * t,
				progress: totalLength > 0 ? ( seg.startDist + seg.length * t ) / totalLength : 0,
				lateralOffset,
				distanceFromRoute,
			};

			if ( ! best || candidate.distanceFromRoute < best.distanceFromRoute ) best = candidate;

		}

		return best;

	}

	function sampleRoute( distanceAlongTrack, lateralOffset = 0 ) {

		if ( segments.length === 0 ) return null;

		const dist = THREE.MathUtils.clamp( distanceAlongTrack, 0, totalLength );
		const seg = segments.find( ( candidate ) => dist <= candidate.startDist + candidate.length ) || segments[ segments.length - 1 ];
		const t = seg.length > 0
			? THREE.MathUtils.clamp( ( dist - seg.startDist ) / seg.length, 0, 1 )
			: 0;
		const baseX = seg.from.x + ( seg.to.x - seg.from.x ) * t;
		const baseZ = seg.from.z + ( seg.to.z - seg.from.z ) * t;
		const perpX = - seg.forward.z;
		const perpZ = seg.forward.x;

		return {
			x: baseX + perpX * lateralOffset,
			y: 0,
			z: baseZ + perpZ * lateralOffset,
			forward: seg.forward,
			curvature: seg.curvature,
			segmentIndex: seg.index,
			distanceAlongTrack: dist,
		};

	}

	return {
		waypoints: points,
		count: points.length,
		totalLength,
		projectToRoute,
		sampleRoute,
	};

}

function createVehicle( {
	x,
	z,
	yawDeg,
	speed,
	boostMeter = 1,
	wallLeft = 0,
	wallRight = 0,
} ) {

	return {
		vehPos: new THREE.Vector3( x, 0, z ),
		linearSpeed: speed,
		boostMeter,
		container: {
			quaternion: new THREE.Quaternion().setFromEuler(
				new THREE.Euler( 0, THREE.MathUtils.degToRad( yawDeg ), 0 )
			),
		},
		_wallProximityLeft: wallLeft,
		_wallProximityRight: wallRight,
	};

}

function getForwardDotToTarget( vehicle, target ) {

	const forward = new THREE.Vector3( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
	forward.y = 0;
	forward.normalize();

	const toTarget = new THREE.Vector3(
		target.x - vehicle.vehPos.x,
		0,
		target.z - vehicle.vehPos.z,
	);
	toTarget.normalize();

	return forward.dot( toTarget );

}

function getRouteHeading( track, worldX, worldZ ) {

	const waypointHint = track.getNearestWaypoint( worldX, worldZ );
	const info = track.getWaypointInfo( waypointHint );
	return {
		waypointHint,
		yaw: Math.atan2( info.forward.x, info.forward.z ),
	};

}

function getWrappedAngleDelta( a, b ) {

	return Math.atan2( Math.sin( a - b ), Math.cos( a - b ) );

}

test( 'AIController widens entry, tightens apex, and recenters on exit for a hard right turn', () => {

	const track = createPolylineTrack( [
		{ x: -20, z: 0 },
		{ x: 0, z: 0 },
		{ x: 0, z: 20 },
		{ x: 0, z: 80 },
	] );

	const controller = new AIController( track, 2, {
		name: 'Aggressive',
		noiseAmplitude: 0,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.75,
		cornerApexTightness: 0.7,
		cornerSpeedFactor: 1.0,
	} );

	const vehicle = createVehicle( { x: -8, z: 0, yawDeg: -90, speed: 0.95 } );
	let input = controller.update( 0.016, vehicle );
	let debug = controller.getDebugState();

	assert.equal( debug.mode, 'approach' );
	assert.ok( debug.target.laneOffset < 0, 'right turn entry should bias left/outside' );
	assert.ok( input.z < 0, 'hard turn approach should brake before impact' );
	assert.equal( input.boost, false, 'hard turn approach should suppress boost' );

	vehicle.vehPos.set( -2, 0, 0 );
	vehicle.container.quaternion.setFromEuler( new THREE.Euler( 0, THREE.MathUtils.degToRad( -90 ), 0 ) );
	vehicle.linearSpeed = 0.75;
	input = controller.update( 0.016, vehicle );
	debug = controller.getDebugState();

	assert.ok( debug.mode === 'apex' || debug.mode === 'bend' );
	assert.ok( debug.target.laneOffset > 0, 'apex should bias to the inside of the right turn' );
	assert.equal( input.boost, false );

	const apexOffset = Math.abs( debug.target.laneOffset );

	vehicle.vehPos.set( 0, 0, 10 );
	vehicle.container.quaternion.setFromEuler( new THREE.Euler( 0, 0, 0 ) );
	vehicle.linearSpeed = 0.7;
	controller.update( 0.016, vehicle );
	debug = controller.getDebugState();
	assert.ok( debug.mode === 'exit' || debug.mode === 'straight' );
	assert.ok( Math.abs( debug.target.laneOffset ) < apexOffset, 'exit should blend back toward the straight lane' );

	vehicle.vehPos.set( 0, 0, 50 );
	vehicle.linearSpeed = 0.7;
	input = controller.update( 0.016, vehicle );
	debug = controller.getDebugState();

	assert.equal( debug.mode, 'straight' );
	assert.ok( Math.abs( debug.target.laneOffset ) < 0.2, 'straight should recenter after the exit blend' );
	assert.ok( input.z > 0, 'post-exit straights should resume forward throttle' );
	assert.equal( input.boost, true, 'straights may spend boost once aligned again' );

} );

test( 'AIController brakes before hard turns and allows boost on aligned straights', () => {

	const track = createPolylineTrack( [
		{ x: -20, z: 0 },
		{ x: 0, z: 0 },
		{ x: 0, z: 20 },
	] );

	const controller = new AIController( track, 2, {
		name: 'Strategist',
		noiseAmplitude: 0,
		boostEagerness: false,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.45,
		cornerSpeedFactor: 0.98,
	} );

	const brakingVehicle = createVehicle( { x: -6, z: 0, yawDeg: -90, speed: 0.92, boostMeter: 1 } );
	let input = controller.update( 0.016, brakingVehicle );
	assert.ok( input.z < 0, 'the controller should use brake input when carrying too much speed into a hard turn' );
	assert.equal( input.boost, false );

	const straightController = new AIController( createPolylineTrack( [
		{ x: 0, z: 0 },
		{ x: 0, z: 50 },
	] ), 2, {
		name: 'Aggressive',
		noiseAmplitude: 0,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.75,
		cornerApexTightness: 0.7,
		cornerSpeedFactor: 1.0,
	} );
	const straightVehicle = createVehicle( { x: 0, z: 22, yawDeg: 0, speed: 0.72, boostMeter: 1 } );
	input = straightController.update( 0.016, straightVehicle );
	const debug = straightController.getDebugState();

	assert.equal( debug.mode, 'straight' );
	assert.ok( input.z > 0.9, 'aligned straight sections should return to near-full throttle' );
	assert.equal( input.boost, true, 'aligned straight sections should allow boost' );

} );

test( 'AIController enters wall recovery, reverses away from the dominant wall, and clears recovery after speed returns', () => {

	const track = createPolylineTrack( [
		{ x: 0, z: -20 },
		{ x: 0, z: 0 },
		{ x: 0, z: 20 },
	] );

	const controller = new AIController( track, 0, {
		name: 'Recovery',
		noiseAmplitude: 0,
		stuckTime: 0.5,
		reverseTime: 0.2,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.5,
		cornerSpeedFactor: 1,
	} );

	const vehicle = createVehicle( {
		x: 0,
		z: 0,
		yawDeg: 0,
		speed: 0.01,
		boostMeter: 0,
		wallLeft: 0.95,
		wallRight: 0.1,
	} );

	let input;
	for ( let i = 0; i < 6; i ++ ) {

		input = controller.update( 0.1, vehicle );

	}

	let debug = controller.getDebugState();
	assert.equal( debug.recoveryActive, true );
	assert.equal( debug.mode, 'reverse' );
	assert.ok( input.x > 0, 'left wall pinning should steer right during reverse recovery' );
	assert.equal( input.z, - 1 );

	for ( let i = 0; i < 3; i ++ ) {

		controller.update( 0.1, vehicle );

	}

	vehicle.linearSpeed = 0.5;
	vehicle._wallProximityLeft = 0.1;
	vehicle._wallProximityRight = 0.1;

	for ( let i = 0; i < 5; i ++ ) {

		input = controller.update( 0.1, vehicle );

	}

	debug = controller.getDebugState();
	assert.equal( debug.recoveryActive, false, 'recovery should clear once the kart is moving cleanly again' );
	assert.notEqual( debug.mode, 'reverse' );
	assert.ok( input.z > 0, 'post-recovery the kart should drive forward again' );

} );

test( 'AIController applies deterministic lane spread so bots do not stack on the same straight-line target', () => {

	const track = createPolylineTrack( [
		{ x: 0, z: 0 },
		{ x: 0, z: 60 },
	] );

	const sharedProfile = {
		name: 'Spread',
		noiseAmplitude: 0,
		boostEagerness: false,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.5,
		cornerSpeedFactor: 1,
	};

	const vehicleA = createVehicle( { x: 0, z: 20, yawDeg: 0, speed: 0.6, boostMeter: 0 } );
	const vehicleB = createVehicle( { x: 0, z: 20, yawDeg: 0, speed: 0.6, boostMeter: 0 } );

	const controllerA = new AIController( track, 0, sharedProfile );
	const controllerB = new AIController( track, 1, sharedProfile );

	controllerA.update( 0.016, vehicleA );
	controllerB.update( 0.016, vehicleB );

	const laneA = controllerA.getDebugState().target?.laneOffset ?? 0;
	const laneB = controllerB.getDebugState().target?.laneOffset ?? 0;

	assert.ok( Math.abs( laneA ) <= 0.6 );
	assert.ok( Math.abs( laneB ) <= 0.6 );
	assert.ok( Math.abs( laneA - laneB ) > 0.3, 'different seeds should choose visibly different straight lanes' );

} );

test( 'seeded CPU profiles create visible but still safe cornering differences', () => {

	const track = createPolylineTrack( [
		{ x: -20, z: 0 },
		{ x: 0, z: 0 },
		{ x: 0, z: 24 },
		{ x: 0, z: 90 },
	] );

	const vehicleA = createVehicle( { x: -8, z: 0, yawDeg: -90, speed: 0.9, boostMeter: 1 } );
	const vehicleB = createVehicle( { x: -8, z: 0, yawDeg: -90, speed: 0.9, boostMeter: 1 } );

	const controllerA = new AIController( track, 4, createSeededCPUProfile( 0, { noiseAmplitude: 0 } ) );
	const controllerB = new AIController( track, 4, createSeededCPUProfile( 7, { noiseAmplitude: 0 } ) );

	const inputA = controllerA.update( 0.016, vehicleA );
	const inputB = controllerB.update( 0.016, vehicleB );
	const debugA = controllerA.getDebugState();
	const debugB = controllerB.getDebugState();

	assert.equal( debugA.mode, 'approach' );
	assert.equal( debugB.mode, 'approach' );
	assert.ok( inputA.z < 0, 'seed A should still brake into the hard turn' );
	assert.ok( inputB.z < 0, 'seed B should still brake into the hard turn' );
	assert.equal( inputA.boost, false );
	assert.equal( inputB.boost, false );
	assert.ok(
		Math.abs( ( debugA.target?.laneOffset ?? 0 ) - ( debugB.target?.laneOffset ?? 0 ) ) > 0.12,
		'seeded runtime profiles should choose visibly different but still bounded entries'
	);

} );

test( 'AIController hesitation mistakes briefly soften straight-line pace and then clear cleanly', () => {

	const track = createPolylineTrack( [
		{ x: 0, z: 0 },
		{ x: 0, z: 80 },
	] );

	const baselineController = new AIController( track, 2, {
		name: 'Baseline',
		noiseAmplitude: 0,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.5,
		cornerSpeedFactor: 1.0,
	} );
	const mistakenController = new AIController( track, 2, {
		name: 'Baseline',
		noiseAmplitude: 0,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.5,
		cornerSpeedFactor: 1.0,
	} );

	const baselineVehicle = createVehicle( { x: 0, z: 20, yawDeg: 0, speed: 0.72, boostMeter: 1 } );
	const mistakenVehicle = createVehicle( { x: 0, z: 20, yawDeg: 0, speed: 0.72, boostMeter: 1 } );

	const baselineInput = baselineController.update( 0.016, baselineVehicle );

	mistakenController._mistakeTimer = 0.18;
	mistakenController._mistakeType = 'hesitate';
	mistakenController._mistakeMagnitude = 0.24;

	let mistakenInput = mistakenController.update( 0.016, mistakenVehicle );
	let mistakenDebug = mistakenController.getDebugState();

	assert.equal( mistakenDebug.mistakeActive, true );
	assert.equal( mistakenDebug.mistakeType, 'hesitate' );
	assert.equal( mistakenDebug.mode, 'mistake-hesitate' );
	assert.equal( mistakenInput.boost, false );
	assert.ok( mistakenInput.z < baselineInput.z, 'hesitation should reduce throttle versus the clean baseline' );

	for ( let i = 0; i < 20; i ++ ) {

		mistakenInput = mistakenController.update( 0.016, mistakenVehicle );

	}

	mistakenDebug = mistakenController.getDebugState();
	assert.equal( mistakenDebug.mistakeActive, false );
	assert.equal( mistakenDebug.mistakeType, null );
	assert.ok( mistakenInput.z >= baselineInput.z - 0.05, 'pace should recover once the short mistake window ends' );
	assert.equal( mistakenController._reversing, false );

} );

test( 'AIController opening phase creates immediate launch differences between aggressive and cautious starts', () => {

	const track = createPolylineTrack( [
		{ x: 0, z: 0 },
		{ x: 0, z: 120 },
	] );

	const aggressiveController = new AIController( track, 0, {
		name: 'Launch Aggressive',
		noiseAmplitude: 0,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.5,
		cornerSpeedFactor: 1.0,
		startReactionDelay: 0,
		openingLaneCommit: 0.9,
		launchAssertiveness: 0.92,
	} );
	const cautiousController = new AIController( track, 1, {
		name: 'Launch Cautious',
		noiseAmplitude: 0,
		boostEagerness: true,
		straightLaneOffset: 0,
		cornerEntryWidth: 0.85,
		cornerApexTightness: 0.5,
		cornerSpeedFactor: 1.0,
		startReactionDelay: 0.18,
		openingLaneCommit: 0.35,
		launchAssertiveness: 0.34,
	} );

	const aggressiveVehicle = createVehicle( { x: 0, z: 10, yawDeg: 0, speed: 0, boostMeter: 0 } );
	const cautiousVehicle = createVehicle( { x: 0, z: 10, yawDeg: 0, speed: 0, boostMeter: 0 } );
	aggressiveController.armLaunchPhase();
	cautiousController.armLaunchPhase();

	const aggressiveInput = aggressiveController.update( 0.016, aggressiveVehicle );
	const aggressiveDebug = aggressiveController.getDebugState();
	const cautiousInput = cautiousController.update( 0.016, cautiousVehicle );
	const cautiousDebug = cautiousController.getDebugState();

	assert.equal( aggressiveDebug.launchActive, true );
	assert.equal( cautiousDebug.launchActive, true );
	assert.equal( aggressiveDebug.launchHolding, false );
	assert.equal( cautiousDebug.launchHolding, true );
	assert.ok( aggressiveInput.z > 0.9, `aggressive launch should open with near-full throttle, got ${ aggressiveInput.z }` );
	assert.ok( cautiousInput.z < 0.3, `cautious launch should visibly hesitate, got ${ cautiousInput.z }` );
	assert.ok( Math.abs( aggressiveDebug.launchLaneBias ) > 0.25, 'aggressive launch should claim early lane space' );

	for ( let i = 0; i < 150; i ++ ) {

		aggressiveController.update( 0.016, aggressiveVehicle );

	}

	assert.equal( aggressiveController.getDebugState().launchActive, false, 'launch phase should clear after the opening window' );

} );

test( 'AIController primeAtPosition clears stale route hints so opening grid targets stay ahead on the default track', () => {

	const track = new TrackIntel( TRACK_CELLS );
	assert.equal( track.valid, true );

	const spawn = computeSpawnPosition( TRACK_CELLS );
	const yawDeg = THREE.MathUtils.radToDeg( spawn.angle );
	const fwdX = - Math.sin( spawn.angle );
	const fwdZ = - Math.cos( spawn.angle );
	const rightX = - fwdZ;
	const rightZ = fwdX;
	const colOffsets = [ - 2.5, 0, 2.5 ];
	const rowOffsets = [ 0, - 3.0, - 6.0 ];

	let slotIndex = 0;

	for ( const rowOffset of rowOffsets ) {

		for ( const colOffset of colOffsets ) {

			const controller = new AIController( track, slotIndex, {
				name: 'Spawn Regression',
				noiseAmplitude: 0,
				boostEagerness: false,
				straightLaneOffset: 0,
				cornerEntryWidth: 0.85,
				cornerApexTightness: 0.5,
				cornerSpeedFactor: 1,
			} );
			controller._segmentHint = 0;

			const vehicle = createVehicle( {
				x: spawn.position[ 0 ] + rightX * colOffset + fwdX * rowOffset,
				z: spawn.position[ 2 ] + rightZ * colOffset + fwdZ * rowOffset,
				yawDeg,
				speed: 0,
				boostMeter: 0,
			} );
			controller._reversing = true;
			controller._recovering = true;
			controller._reverseTimer = 1;
			controller._lastProgress = 0.75;
			controller._lastDistanceAlongTrack = track.totalLength * 0.75;
			controller.primeAtPosition( vehicle.vehPos.x, vehicle.vehPos.z );

			controller.update( 0.016, vehicle );
			const debug = controller.getDebugState();

			assert.equal( controller._reversing, false, `grid slot ${slotIndex} should clear stale reversing state` );
			assert.equal( controller._recovering, false, `grid slot ${slotIndex} should clear stale recovery state` );
			assert.ok( debug.target, `grid slot ${slotIndex} should produce a target` );
			assert.ok(
				getForwardDotToTarget( vehicle, debug.target ) > 0.2,
				`grid slot ${slotIndex} should target forward from the spawn heading`,
			);
			slotIndex ++;

		}

	}

} );

test( 'AIManager route-aligned start poses keep custom-track AI launches facing forward', () => {

	const track = new TrackIntel( CUSTOM_RECT_LOOP_CELLS );
	assert.equal( track.valid, true );

	const spawn = computeSpawnPosition( CUSTOM_RECT_LOOP_CELLS );
	const manager = new AIManager( null, null, {}, track, spawn.position, spawn.angle, spawn.finishAngle );
	const gridPositions = manager.computeGridPositions();

	for ( let slotIndex = 0; slotIndex < gridPositions.length; slotIndex ++ ) {

		const gridPos = gridPositions[ slotIndex ];
		const pose = manager._resolveAIStartPose( gridPos );
		const routeHeading = getRouteHeading( track, gridPos.x, gridPos.z );
		const controller = new AIController( track, slotIndex, {
			name: 'Custom Track Start',
			noiseAmplitude: 0,
			boostEagerness: false,
			straightLaneOffset: 0,
			cornerEntryWidth: 0.85,
			cornerApexTightness: 0.5,
			cornerSpeedFactor: 1,
		} );

		assert.ok(
			Math.abs( getWrappedAngleDelta( pose.yaw, routeHeading.yaw ) ) < 1e-6,
			`grid slot ${slotIndex} should align its start yaw to the nearest route tangent`,
		);
		assert.equal( pose.waypointHint, routeHeading.waypointHint );

		controller._reversing = true;
		controller._recovering = true;
		controller._reverseTimer = 1;
		controller._lastProgress = 0.5;
		controller._lastDistanceAlongTrack = track.totalLength * 0.5;
		controller.primeAtPosition( pose.x, pose.z );

		assert.equal( controller._reversing, false, `grid slot ${slotIndex} should clear stale reversing before launch` );
		assert.equal( controller._recovering, false, `grid slot ${slotIndex} should clear stale recovery before launch` );
		assert.equal( controller._waypointHint, routeHeading.waypointHint );
		assert.notEqual( controller._lastProgress, null, `grid slot ${slotIndex} should seed progress from its grid slot` );

		const vehicle = createVehicle( {
			x: pose.x,
			z: pose.z,
			yawDeg: THREE.MathUtils.radToDeg( pose.yaw ),
			speed: 0,
			boostMeter: 0,
		} );

		controller.update( 0.016, vehicle );
		const debug = controller.getDebugState();

		assert.ok( debug.target, `grid slot ${slotIndex} should produce a route target` );
		assert.ok(
			getForwardDotToTarget( vehicle, debug.target ) > 0.2,
			`grid slot ${slotIndex} should keep its first target in front of the AI`,
		);
		assert.equal( debug.recoveryActive, false );

	}

} );
