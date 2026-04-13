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
	fx.setQualityTier( 'ultra' );
	assert.equal( fx.quality, 'ultra' );

	fx.update( 2.0 );

	assert.equal( fx.activeEffectCount, 0 );
	assert.equal( fx.activeMeshCount, 0 );
	assert.equal( fx.activeParticleCount, 0 );

} );

test( 'lower quality preserves the core explosion layers and drops lower-priority tail layers first', () => {

	const scene = new THREE.Scene();
	const fx = new ExplosionFXManager( scene, { quality: 'low' } );

	const effect = fx.spawnEffect( {
		type: 'missileStrike',
		position: new THREE.Vector3( 0, 0, 0 ),
		normal: new THREE.Vector3( 0, 1, 0 ),
		direction: new THREE.Vector3( 0, 0, 1 ),
		intensity: 1,
		localPlayerInvolved: false,
	} );

	assert.equal( fx.activeEffectCount, 1 );
	assert.equal( fx.activeMeshCount, 2 );
	assert.equal( fx.activeParticleCount, 1 );
	assert.deepEqual( effect.layerIds, [ 'flash', 'streak', 'core', 'ring' ] );

} );
