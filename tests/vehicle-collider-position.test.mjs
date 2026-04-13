import test from 'node:test';
import assert from 'node:assert/strict';
import {
	registerAll,
	createWorldSettings,
	createWorld,
	addBroadphaseLayer,
	addObjectLayer,
	enableCollision,
} from 'crashcat';
import {
	VEHICLE_BODY_HALF_EXTENTS,
	createVehicleBody,
	getVehicleColliderCenterY,
} from '../js/Physics.js';

registerAll();

function createPhysicsWorld() {

	const worldSettings = createWorldSettings();
	const movingBroadphase = addBroadphaseLayer( worldSettings );
	const staticBroadphase = addBroadphaseLayer( worldSettings );
	const movingLayer = addObjectLayer( worldSettings, movingBroadphase );
	const staticLayer = addObjectLayer( worldSettings, staticBroadphase );

	enableCollision( worldSettings, movingLayer, staticLayer );

	const world = createWorld( worldSettings );
	world._OL_MOVING = movingLayer;

	return world;

}

test( 'vehicle collider center sits on the box half-height above the vehicle root', () => {

	const world = createPhysicsWorld();
	const body = createVehicleBody( world, [ 12, 1.5, - 4 ] );

	assert.equal( getVehicleColliderCenterY(), VEHICLE_BODY_HALF_EXTENTS[ 1 ] );
	assert.equal( body.position[ 0 ], 12 );
	assert.equal( body.position[ 1 ], 1.5 + VEHICLE_BODY_HALF_EXTENTS[ 1 ] );
	assert.equal( body.position[ 2 ], - 4 );

} );
