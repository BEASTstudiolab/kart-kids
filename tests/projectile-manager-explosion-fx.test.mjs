import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { ExplosionFXManager } from '../js/explosions/ExplosionFXManager.js';
import { ProjectileManager } from '../js/ProjectileManager.js';

test( 'projectiles can trigger explosion preset VFX on timeout', () => {

	const scene = new THREE.Scene();
	const combatManager = {
		processWeaponHit() {},
	};
	const explosionFXManager = new ExplosionFXManager( scene, { quality: 'high' } );
	const projectileManager = new ProjectileManager( scene, combatManager, explosionFXManager );

	projectileManager.spawn( {
		type: 'projectile',
		mesh: new THREE.Mesh( new THREE.SphereGeometry( 0.2, 6, 4 ), new THREE.MeshBasicMaterial() ),
		position: new THREE.Vector3( 0, 0, 0 ),
		velocity: new THREE.Vector3( 0, 0, 0 ),
		lifetime: 0.05,
		radius: 1,
		damage: 1,
		damageType: 'splash',
		sourceVehicle: { isLocalPlayer: true },
		homing: false,
		homingStrength: 0,
		explosionPreset: 'pulseShockwave',
		explodeOnTimeout: true,
	} );

	projectileManager.update( 0.1, [] );

	assert.equal( explosionFXManager.activeEffectCount, 1 );
	assert.equal( explosionFXManager.activeMeshCount > 0, true );
	assert.equal( explosionFXManager.activeParticleCount > 0, true );

	explosionFXManager.update( 2.0 );

	assert.equal( explosionFXManager.activeEffectCount, 0 );

} );
