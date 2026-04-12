import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { createContactListener } from '../js/ContactHandler.js';
import { deriveTrickIntent } from '../js/Controls.js';
import { SurfaceType } from '../js/vehicle/VehicleGroundRaycast.js';
import { VehicleRemoteSync } from '../js/vehicle/VehicleRemoteSync.js';
import {
	VehicleAirborne,
	LaunchSource,
	LandingSeverity,
} from '../js/vehicle/VehicleAirborne.js';
import {
	VehicleTrickController,
	TrickType,
} from '../js/vehicle/VehicleTrickController.js';

function createVehicleStub() {

	return {
		container: {
			quaternion: new THREE.Quaternion(),
		},
		visualRoot: {
			rotation: new THREE.Euler(),
		},
		bodyNode: {
			rotation: new THREE.Euler(),
			position: new THREE.Vector3(),
		},
	debug: {
			rideHeight: 0,
			steeringMultiplier: 4,
			speedScale: 12.5,
		},
		_groundRaycast: {
			_targetNormal: new THREE.Vector3( 0, 1, 0 ),
		},
		linearSpeed: 0.85,
		effectiveTopSpeed: 250,
		_verticalVelocity: 0,
		_vehicleY: 2,
		groundHeight: 0,
		_airborneTimer: 0,
		_grounded: true,
		_launchCooldown: 0,
		miniBoostTimer: 0,
		miniBoostTopSpeed: 0,
		landingSeverity: LandingSeverity.CLEAN,
		_aerialHintTimer: 0,
		_aerialHintText: '',
	};

}

function getYaw( quaternion ) {

	return Math.atan2(
		2 * ( quaternion.w * quaternion.y + quaternion.x * quaternion.z ),
		1 - 2 * ( quaternion.y * quaternion.y + quaternion.z * quaternion.z )
	);

}

function normalizeAngle( angle ) {

	return Math.atan2( Math.sin( angle ), Math.cos( angle ) );

}

function createCombatVehicle( { speed = 0, x = 0, z = 0 } = {} ) {

	return {
		vehVel: new THREE.Vector3( 0, 0, speed ),
		vehPos: new THREE.Vector3( x, 0, z ),
		container: {
			quaternion: new THREE.Quaternion(),
			position: new THREE.Vector3( x, 0, z ),
		},
		weight: 5,
		linearSpeed: speed,
		angularSpeed: 0,
		_bumpVel: new THREE.Vector3(),
		_grounded: true,
		_verticalVelocity: 0,
		_launchCooldown: 0,
		_wallHitTime: 0,
		lastBumpTime: - Infinity,
		starActive: false,
		shieldActive: false,
		shieldTimer: 0,
		triggerCharacterImpact() {},
		airborneCalls: [],
		forcedStates: [],
		_airborne: {
			beginLaunch( vehicle, args ) {

				vehicle.airborneCalls.push( args );

			},
			markWallContact() {},
		},
		_trick: {
			cancel() {},
		},
		_stateMachine: {
			forceState( state ) {

				this.owner.forcedStates.push( state );

			},
			owner: null,
		},
	};

}

test( 'VehicleAirborne ignores opportunistic ground contact during launch commit and latches on descent after commit', () => {

	const airborne = new VehicleAirborne();
	const vehicle = createVehicleStub();

	airborne.beginLaunch( vehicle, {
		source: LaunchSource.RAMP,
		verticalVelocity: 4.2,
	} );

	const sensor = {
		hasSupport: true,
		allMissed: false,
		frontOnSurface: true,
		rearOnSurface: true,
		aboveSurface: 0.2,
	};

	assert.equal( airborne.resolveGroundContact( vehicle, sensor ), false );

	vehicle._airborneTimer = airborne.config.launchCommitWindow + 0.01;
	vehicle._launchCooldown = 0;
	vehicle._verticalVelocity = - 1.5;

	assert.equal( airborne.resolveGroundContact( vehicle, sensor ), true );

} );

test( 'VehicleTrickController arms tricks only for authored ramp and jump launches', () => {

	const trick = new VehicleTrickController();
	const vehicle = createVehicleStub();

	trick.onLaunch( vehicle, LaunchSource.IMPACT );
	assert.equal( trick.tryStartTrick( vehicle, TrickType.FRONTFLIP ), false );

	trick.onLaunch( vehicle, LaunchSource.RAMP );
	assert.equal( trick.tryStartTrick( vehicle, TrickType.FRONTFLIP ), true );

} );

test( 'VehicleTrickController allows only one completed trick per airtime', () => {

	const trick = new VehicleTrickController();
	const vehicle = createVehicleStub();

	trick.onLaunch( vehicle, LaunchSource.JUMP );
	assert.equal( trick.tryStartTrick( vehicle, TrickType.BARREL_LEFT ), true );
	trick.update( 1.0, vehicle );

	assert.equal( trick.completedTrick, TrickType.BARREL_LEFT );
	assert.equal( trick.tryStartTrick( vehicle, TrickType.BACKFLIP ), false );

} );

test( 'VehicleTrickController grants reward on hard landing and denies it on bad landing', () => {

	const trick = new VehicleTrickController();
	const vehicle = createVehicleStub();

	trick.onLaunch( vehicle, LaunchSource.RAMP );
	trick.tryStartTrick( vehicle, TrickType.BACKFLIP );
	trick.update( 1.0, vehicle );
	trick.onLanding( vehicle, LandingSeverity.HARD );

	assert.equal( trick.rewardGranted, true );
	assert.ok( vehicle.miniBoostTimer > 0 );
	assert.ok( vehicle.miniBoostTopSpeed > 0 );

	const badLandingVehicle = createVehicleStub();
	const badLandingTrick = new VehicleTrickController();
	badLandingTrick.onLaunch( badLandingVehicle, LaunchSource.JUMP );
	badLandingTrick.tryStartTrick( badLandingVehicle, TrickType.FRONTFLIP );
	badLandingTrick.update( 1.0, badLandingVehicle );
	badLandingTrick.onLanding( badLandingVehicle, LandingSeverity.BAD );

	assert.equal( badLandingTrick.rewardGranted, false );
	assert.equal( badLandingVehicle.miniBoostTimer, 0 );
	assert.equal( badLandingVehicle.miniBoostTopSpeed, 0 );

} );

test( 'deriveTrickIntent requires a tapped stunt direction and ignores held throttle alone', () => {

	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 1, touchActive: false, directionTap: null }, null ),
		null
	);
	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: false, directionTap: TrickType.FRONTFLIP }, null ),
		TrickType.FRONTFLIP
	);
	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: false, directionTap: TrickType.BARREL_RIGHT }, null ),
		TrickType.BARREL_RIGHT
	);

} );

test( 'VehicleTrickController shows aerial hint on authored launches only', () => {

	const trick = new VehicleTrickController();
	const vehicle = createVehicleStub();

	trick.onLaunch( vehicle, LaunchSource.IMPACT );
	assert.equal( vehicle._aerialHintTimer, 0 );

	trick.onLaunch( vehicle, LaunchSource.RAMP );
	assert.ok( vehicle._aerialHintTimer > 0 );
	assert.match( vehicle._aerialHintText, /hold drift/i );

} );

test( 'barrel roll visuals stay on the roll axis without introducing pitch', () => {

	const trick = new VehicleTrickController();
	const vehicle = createVehicleStub();

	trick.onLaunch( vehicle, LaunchSource.RAMP );
	trick.tryStartTrick( vehicle, TrickType.BARREL_LEFT );
	trick.update( trick.config.trickDuration * 0.5, vehicle );

	assert.ok( Math.abs( vehicle.visualRoot.rotation.z ) > 0.5 );
	assert.equal( vehicle.visualRoot.rotation.x, 0 );

} );

test( 'barrel rolls finish a full rotation loop by the completion window', () => {

	const trick = new VehicleTrickController();
	const vehicle = createVehicleStub();

	trick.onLaunch( vehicle, LaunchSource.RAMP );
	trick.tryStartTrick( vehicle, TrickType.BARREL_RIGHT );
	trick.update( trick.config.trickDuration * trick.config.completionWindow, vehicle );

	assert.equal( trick.completedTrick, TrickType.BARREL_RIGHT );
	assert.ok( Math.abs( normalizeAngle( vehicle.visualRoot.rotation.z ) ) < 0.25 );
	assert.ok( Math.abs( vehicle.visualRoot.rotation.z ) > Math.PI * 1.8 );

} );

test( 'VehicleAirborne keeps yaw authority much lower than grounded steering defaults', () => {

	const airborne = new VehicleAirborne();
	const vehicle = createVehicleStub();

	airborne.launchVerticalVelocity = 4;
	vehicle.inputX = 1;
	vehicle.inputZ = 0;
	vehicle._verticalVelocity = 2;

	airborne.updateAirborne( 1.0, vehicle );

	assert.ok( Math.abs( getYaw( vehicle.container.quaternion ) ) < 0.7 );

} );

test( 'VehicleAirborne gives jump exits extra authored launch height', () => {

	const airborne = new VehicleAirborne();
	const vehicle = createVehicleStub();

	vehicle.linearSpeed = 0.85;
	vehicle._verticalVelocity = 0;
	vehicle.container.quaternion.identity();

	airborne.applyTakeoff( vehicle, SurfaceType.RAMP_EXIT );

	assert.ok( vehicle._verticalVelocity > 4.25 );

} );

test( 'deriveTrickIntent emits one-shot desktop and gamepad trick commands from drift plus direction taps', () => {

	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: false, directionTap: TrickType.FRONTFLIP }, null ),
		TrickType.FRONTFLIP
	);
	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: false, directionTap: TrickType.BACKFLIP }, null ),
		TrickType.BACKFLIP
	);
	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: false, directionTap: TrickType.BARREL_LEFT }, null ),
		TrickType.BARREL_LEFT
	);
	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: false, directionTap: TrickType.BARREL_RIGHT }, null ),
		TrickType.BARREL_RIGHT
	);
	assert.equal(
		deriveTrickIntent( { drift: true, x: 0, z: 0, touchActive: true, directionTap: TrickType.BARREL_RIGHT }, null ),
		null
	);

} );

test( 'VehicleRemoteSync serializes authored trick payload for remote visuals', () => {

	const remoteSync = new VehicleRemoteSync();
	const vehicle = {
		vehPos: new THREE.Vector3( 1, 2, 3 ),
		container: {
			quaternion: new THREE.Quaternion(),
		},
		vehVel: new THREE.Vector3(),
		rigidBody: null,
		damageDeform: {
			getDamageState() {

				return [ 0, 0, 0, 0 ];

			},
		},
		linearSpeed: 0.7,
		driftIntensity: 0.2,
		boostActive: false,
		shieldActive: false,
		starActive: false,
		_trick: {
			getRemoteState() {

				return {
					source: LaunchSource.RAMP,
					currentTrick: TrickType.FRONTFLIP,
					progress: 0.5,
					rewardGranted: false,
				};

			},
		},
	};

	const state = remoteSync.getState( vehicle );

	assert.deepEqual( state.trick, {
		source: LaunchSource.RAMP,
		currentTrick: TrickType.FRONTFLIP,
		progress: 0.5,
		rewardGranted: false,
	} );

} );

test( 'ContactHandler upgrades heavy combat hits into explicit impact launches', () => {

	const localVehicle = createCombatVehicle( { speed: 12, x: 0, z: 0 } );
	const remoteVehicle = createCombatVehicle( { speed: 1, x: 0, z: 1 } );
	localVehicle._stateMachine.owner = localVehicle;
	remoteVehicle._stateMachine.owner = remoteVehicle;
	localVehicle.debug = {
		bumpCooldown: 0,
		bumpMinSpeed: 0.5,
		bumpForceScale: 1,
		bumpMaxForce: 20,
		bumpLateralBias: 0,
		impactLaunchThreshold: 8,
		impactLaunchScale: 0.5,
		impactLaunchCap: 4,
		bumpVerticalThreshold: 8,
		bumpVerticalScale: 0.5,
		bumpVerticalCap: 4,
		bumpSpinThreshold: 99,
		bumpSpinRate: 0,
		bumpSpeedTransferRate: 0,
		bumpHitStopThreshold: 99,
	};

	const listener = createContactListener( {
		vehicle: localVehicle,
		audio: { playImpact() {}, playShieldBreak() {} },
		cam: { applyShake() {} },
		wallSparks: { emit() {} },
		haptics: { impulse() {} },
		bodyToVehicle: new Map(),
		combatManager: {
			processVehicleBump() {},
			processWallHit() {},
		},
	} );

	listener.checkVehicleBumps( [ { vehicle: remoteVehicle } ] );

	assert.equal( remoteVehicle.airborneCalls.length, 1 );
	assert.equal( remoteVehicle.airborneCalls[ 0 ].source, LaunchSource.IMPACT );
	assert.ok( remoteVehicle.airborneCalls[ 0 ].verticalVelocity > 0 );
	assert.equal( remoteVehicle.forcedStates.length, 1 );

} );

test( 'ContactHandler keeps medium combat bumps grounded', () => {

	const localVehicle = createCombatVehicle( { speed: 5, x: 0, z: 0 } );
	const remoteVehicle = createCombatVehicle( { speed: 1, x: 0, z: 1 } );
	localVehicle._stateMachine.owner = localVehicle;
	remoteVehicle._stateMachine.owner = remoteVehicle;
	localVehicle.debug = {
		bumpCooldown: 0,
		bumpMinSpeed: 0.5,
		bumpForceScale: 1,
		bumpMaxForce: 20,
		bumpLateralBias: 0,
		impactLaunchThreshold: 8,
		impactLaunchScale: 0.5,
		impactLaunchCap: 4,
		bumpVerticalThreshold: 8,
		bumpVerticalScale: 0.5,
		bumpVerticalCap: 4,
		bumpSpinThreshold: 99,
		bumpSpinRate: 0,
		bumpSpeedTransferRate: 0,
		bumpHitStopThreshold: 99,
	};

	const listener = createContactListener( {
		vehicle: localVehicle,
		audio: { playImpact() {}, playShieldBreak() {} },
		cam: { applyShake() {} },
		wallSparks: { emit() {} },
		haptics: { impulse() {} },
		bodyToVehicle: new Map(),
		combatManager: {
			processVehicleBump() {},
			processWallHit() {},
		},
	} );

	listener.checkVehicleBumps( [ { vehicle: remoteVehicle } ] );

	assert.equal( remoteVehicle.airborneCalls.length, 0 );
	assert.equal( remoteVehicle._verticalVelocity, 0 );
	assert.ok( remoteVehicle._wallHitTime > 0 );

} );
