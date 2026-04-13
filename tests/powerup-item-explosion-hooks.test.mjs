import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { ITEMS } from '../js/PowerupItem.js';
import { ItemSlotManager } from '../js/ItemSlotManager.js';

test( 'magnet pulse can trigger a pulse shockwave explosion effect', () => {

	const owner = {
		vehPos: new THREE.Vector3( 2, 0, 3 ),
		container: new THREE.Object3D(),
		isLocalPlayer: true,
	};
	owner.container.quaternion.setFromEuler( new THREE.Euler( 0, Math.PI * 0.5, 0 ) );

	let spawned = null;
	const explosionFXManager = {
		spawnEffect( effect ) {

			spawned = effect;

		},
	};

	const itemSlot = new ItemSlotManager( owner );
	itemSlot.receive( 'magnet_pulse' );

	const combatManager = {
		processWeaponHit() {},
	};

	const result = itemSlot.use( [], null, null, combatManager, explosionFXManager );

	assert.equal( result, null );
	assert.ok( spawned );
	assert.equal( spawned.type, 'pulseShockwave' );
	assert.equal( spawned.localPlayerInvolved, true );
	assert.equal( spawned.position.x, 2 );
	assert.equal( spawned.position.y, 0 );
	assert.equal( spawned.position.z, 3 );
	assert.equal( ITEMS.magnet_pulse.id, 'magnet_pulse' );

} );

test( 'magnet pulse does not mark AI-owned effects as local-player-involved', () => {

	const owner = {
		vehPos: new THREE.Vector3( - 1, 0, 4 ),
		container: new THREE.Object3D(),
		isLocalPlayer: false,
	};
	owner.container.quaternion.setFromEuler( new THREE.Euler( 0, Math.PI, 0 ) );

	let spawned = null;
	const explosionFXManager = {
		spawnEffect( effect ) {

			spawned = effect;

		},
	};

	const itemSlot = new ItemSlotManager( owner );
	itemSlot.receive( 'magnet_pulse' );

	const combatManager = {
		processWeaponHit() {},
	};

	const result = itemSlot.use( [], null, null, combatManager, explosionFXManager );

	assert.equal( result, null );
	assert.ok( spawned );
	assert.equal( spawned.type, 'pulseShockwave' );
	assert.equal( spawned.localPlayerInvolved, false );

} );
