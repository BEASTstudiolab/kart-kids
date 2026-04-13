import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { ExplosionFXManager } from '../js/explosions/ExplosionFXManager.js';

test( 'spawns an explosion preset effect and recycles it after update', () => {

	const scene = new THREE.Scene();
	const fx = new ExplosionFXManager( scene, { quality: 'high' } );

	const effect = fx.spawnEffect( {
		type: 'missileStrike',
		position: new THREE.Vector3( 1, 0, 2 ),
		normal: new THREE.Vector3( 0, 1, 0 ),
		direction: new THREE.Vector3( 1, 0, 0 ),
		intensity: 1,
		localPlayerInvolved: true,
	} );

	assert.ok( effect );
	assert.equal( fx.activeEffectCount, 1 );
	assert.ok( fx.activeMeshCount > 0 );
	assert.ok( fx.activeParticleCount > 0 );

	fx.update( 2.0 );

	assert.equal( fx.activeEffectCount, 0 );
	assert.equal( fx.activeMeshCount, 0 );
	assert.equal( fx.activeParticleCount, 0 );

} );
