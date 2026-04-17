import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { computeSpawnPosition } from '../js/Track.js';
import { ORIENT_DEG } from '../js/TrackConstants.js';

// Reproduces the editor finish-arrow rotation pipeline used by
// PlaceFinishCommand._addDirectionArrow and PlacementController:
//   rotation.x = -π/2, rotation.z = π + orientRad, applied in three.js
// 'XYZ' Euler order. The 2D arrow shape is drawn with its tip at local +Y.
function arrowTipWorldDirection( orient ) {

	const orientRad = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] ?? 0 );
	const tipLocal = new THREE.Vector3( 0, 1, 0 );
	const euler = new THREE.Euler( - Math.PI / 2, 0, Math.PI + orientRad, 'XYZ' );
	tipLocal.applyEuler( euler );
	return tipLocal;

}

function spawnForwardVector( orient ) {

	const spawn = computeSpawnPosition( [ [ 0, 0, 'trk-finish', orient ] ] );
	return new THREE.Vector3(
		Math.sin( spawn.angle ),
		0,
		Math.cos( spawn.angle ),
	);

}

test( 'finish arrow tip direction matches spawn forward vector for every legal orient', () => {

	// Arrange
	const legalOrients = [ 0, 10, 16, 22 ];

	for ( const orient of legalOrients ) {

		// Act
		const arrowDir = arrowTipWorldDirection( orient );
		const spawnFwd = spawnForwardVector( orient );

		// Assert
		assert.ok(
			Math.abs( arrowDir.x - spawnFwd.x ) < 1e-6,
			`orient=${orient}: arrow.x=${arrowDir.x} != spawn.x=${spawnFwd.x}`,
		);
		assert.ok(
			Math.abs( arrowDir.y - spawnFwd.y ) < 1e-6,
			`orient=${orient}: arrow.y=${arrowDir.y} != spawn.y=${spawnFwd.y}`,
		);
		assert.ok(
			Math.abs( arrowDir.z - spawnFwd.z ) < 1e-6,
			`orient=${orient}: arrow.z=${arrowDir.z} != spawn.z=${spawnFwd.z}`,
		);

	}

} );

test( 'finish arrow points east for orient=16 (default track convention)', () => {

	// Arrange
	const orient = 16;

	// Act
	const arrowDir = arrowTipWorldDirection( orient );

	// Assert — east is +X in the game's coordinate system
	assert.ok( arrowDir.x > 0.99, `expected +X, got x=${arrowDir.x}` );
	assert.ok( Math.abs( arrowDir.z ) < 1e-6, `expected z≈0, got z=${arrowDir.z}` );

} );

test( 'finish arrow points west for orient=22 (opposite of orient=16)', () => {

	// Arrange
	const orient = 22;

	// Act
	const arrowDir = arrowTipWorldDirection( orient );

	// Assert — west is -X
	assert.ok( arrowDir.x < - 0.99, `expected -X, got x=${arrowDir.x}` );
	assert.ok( Math.abs( arrowDir.z ) < 1e-6, `expected z≈0, got z=${arrowDir.z}` );

} );

test( 'finish arrow points south for orient=0 and north for orient=10', () => {

	// Arrange & Act
	const south = arrowTipWorldDirection( 0 );
	const north = arrowTipWorldDirection( 10 );

	// Assert — south is +Z, north is -Z
	assert.ok( south.z > 0.99, `orient=0 expected +Z, got z=${south.z}` );
	assert.ok( Math.abs( south.x ) < 1e-6, `orient=0 expected x≈0, got x=${south.x}` );
	assert.ok( north.z < - 0.99, `orient=10 expected -Z, got z=${north.z}` );
	assert.ok( Math.abs( north.x ) < 1e-6, `orient=10 expected x≈0, got x=${north.x}` );

} );
