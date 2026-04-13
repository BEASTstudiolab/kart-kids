import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
	registerAll,
	createWorldSettings,
	createWorld,
	addBroadphaseLayer,
	addObjectLayer,
	enableCollision,
	rigidBody,
	box,
	MotionType,
	castRay,
	createClosestCastRayCollector,
	createDefaultCastRaySettings,
	CastRayStatus,
	updateWorld,
} from 'crashcat';
import { createSingleLayerRayFilter, VehicleGroundRaycast } from '../js/vehicle/VehicleGroundRaycast.js';

registerAll();

function createLayeredWorld() {

	const worldSettings = createWorldSettings();
	const movingBroadphase = addBroadphaseLayer( worldSettings );
	const staticBroadphase = addBroadphaseLayer( worldSettings );
	const movingLayer = addObjectLayer( worldSettings, movingBroadphase );
	const staticLayer = addObjectLayer( worldSettings, staticBroadphase );
	const supportLayer = addObjectLayer( worldSettings, staticBroadphase );
	const blockerLayer = addObjectLayer( worldSettings, staticBroadphase );

	enableCollision( worldSettings, movingLayer, staticLayer );
	enableCollision( worldSettings, movingLayer, blockerLayer );

	const world = createWorld( worldSettings );
	world._OL_MOVING = movingLayer;
	world._OL_STATIC = staticLayer;
	world._OL_TRACK_SUPPORT = supportLayer;
	world._OL_TRACK_BLOCKER = blockerLayer;

	return world;

}

function castDown( world, rayFilter, x = 0 ) {

	const collector = createClosestCastRayCollector();
	const settings = createDefaultCastRaySettings();

	castRay( world, collector, settings, [ x, 2, 0 ], [ 0, - 1, 0 ], 10, rayFilter );

	return collector.hit.status === CastRayStatus.COLLIDING;

}

test( 'support-layer ray filter hits support bodies and excludes blocker bodies', () => {

	const world = createLayeredWorld();

	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ 2, 0.1, 2 ] } ),
		motionType: MotionType.STATIC,
		objectLayer: world._OL_TRACK_SUPPORT,
		position: [ 0, 0, 0 ],
	} );

	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ 2, 0.1, 2 ] } ),
		motionType: MotionType.STATIC,
		objectLayer: world._OL_TRACK_BLOCKER,
		position: [ 10, 0, 0 ],
	} );

	updateWorld( world, null, 1 / 60 );

	const supportFilter = createSingleLayerRayFilter( world, world._OL_TRACK_SUPPORT );

	assert.equal( castDown( world, supportFilter, 0 ), true );
	assert.equal( castDown( world, supportFilter, 10 ), false );

} );

test( 'blocker-layer ray filter hits blocker bodies and excludes support bodies', () => {

	const world = createLayeredWorld();

	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ 2, 0.1, 2 ] } ),
		motionType: MotionType.STATIC,
		objectLayer: world._OL_TRACK_SUPPORT,
		position: [ 0, 0, 0 ],
	} );

	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ 2, 0.1, 2 ] } ),
		motionType: MotionType.STATIC,
		objectLayer: world._OL_TRACK_BLOCKER,
		position: [ 10, 0, 0 ],
	} );

	updateWorld( world, null, 1 / 60 );

	const blockerFilter = createSingleLayerRayFilter( world, world._OL_TRACK_BLOCKER );

	assert.equal( castDown( world, blockerFilter, 0 ), false );
	assert.equal( castDown( world, blockerFilter, 10 ), true );

} );

test( 'VehicleGroundRaycast reattaches to a lower support surface while descending', () => {

	const world = createLayeredWorld();

	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ 5, 0.1, 5 ] } ),
		motionType: MotionType.STATIC,
		objectLayer: world._OL_TRACK_SUPPORT,
		position: [ 0, 0, 0 ],
	} );

	updateWorld( world, null, 1 / 60 );

	const raycast = new VehicleGroundRaycast();
	const vehicle = {
		physicsWorld: world,
		container: {
			quaternion: new THREE.Quaternion(),
		},
		vehPos: { x: 0, z: 0 },
		debug: {
			suspStiffness: 200,
			suspDamping: 25,
		},
		wheelFL: null,
		wheelFR: null,
		wheelBL: null,
		wheelBR: null,
		_vehicleY: 1.4,
		groundHeight: 2.8,
		groundNormal: new THREE.Vector3( 0, 1, 0 ),
		_verticalVelocity: - 1.5,
		_grounded: false,
		_wallProximityLeft: 0,
		_wallProximityRight: 0,
	};

	raycast.init( vehicle, world );
	vehicle._vehicleY = 1.4;
	vehicle.groundHeight = 2.8;

	const sensor = raycast.updateGround( 1 / 60, vehicle );

	assert.equal( sensor.frontOnSurface, true );
	assert.equal( sensor.rearOnSurface, true );
	assert.ok( Math.abs( vehicle.groundHeight - 0.1 ) < 0.25 );
	assert.deepEqual( raycast._wheelOnSurface, [ true, true, true, true ] );

} );
