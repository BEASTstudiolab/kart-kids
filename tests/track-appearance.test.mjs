import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { resolveBoostPadPlacement } from '../js/BoostPadLayout.js';
import { hasAnimatedTrackAppearance, normalizeTrackAppearance } from '../js/TrackAppearance.js';
import {
	applyTrackAppearanceToObject3D,
	applyTrackGlowSettings,
	tagObject3DAppearanceTarget,
} from '../js/TrackAppearanceApplier.js';

function angleDelta( a, b ) {

	return Math.atan2( Math.sin( a - b ), Math.cos( a - b ) );

}

test( 'track appearance normalizes defaults and clamps invalid values', () => {

	const appearance = normalizeTrackAppearance( {
		glow: { strength: 9, radius: - 2, threshold: 'bad' },
		targets: {
			track: { color: 'oops', intensity: - 1 },
			terrain: { color: '#12abef', intensity: 2.5 },
		},
	} );

	assert.equal( appearance.glow.strength, 4 );
	assert.equal( appearance.glow.radius, 0 );
	assert.equal( appearance.glow.threshold, 0.5 );
	assert.equal( appearance.targets.track.color, '#ffffff' );
	assert.equal( appearance.targets.track.intensity, 0 );
	assert.equal( appearance.targets.track.hueShiftEnabled, false );
	assert.equal( appearance.targets.track.hueShiftSpeed, 0.6 );
	assert.equal( appearance.targets.terrain.color, '#12abef' );
	assert.equal( appearance.targets.terrain.intensity, 2.5 );
	assert.equal( hasAnimatedTrackAppearance( appearance ), false );

} );

test( 'track appearance applies separate emissive tint sets and glow settings', () => {

	const trackMaterial = new THREE.MeshStandardMaterial( { emissive: 0x000000, emissiveIntensity: 0 } );
	const terrainMaterial = new THREE.MeshStandardMaterial( { emissive: 0x000000, emissiveIntensity: 0 } );
	const boostMaterial = new THREE.MeshStandardMaterial( { emissive: 0x000000, emissiveIntensity: 0 } );
	trackMaterial.name = 'asphalt';
	terrainMaterial.name = 'asphalt';
	boostMaterial.name = 'TurboTile';
	const root = new THREE.Group();
	const trackMesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), trackMaterial );
	const terrainMesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), terrainMaterial );
	const boostMesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), boostMaterial );

	tagObject3DAppearanceTarget( trackMesh, 'track' );
	tagObject3DAppearanceTarget( terrainMesh, 'terrain' );
	tagObject3DAppearanceTarget( boostMesh, 'boost' );
	root.add( trackMesh );
	root.add( terrainMesh );
	root.add( boostMesh );

	applyTrackAppearanceToObject3D( root, {
		glow: { strength: 0.4, radius: 0.2, threshold: 0.7 },
		targets: {
			track: { color: '#00ffaa', intensity: 2.1 },
			terrain: { color: '#ff00cc', intensity: 1.4 },
			boost: { color: '#ffd400', intensity: 3.25 },
		},
	} );

	const bloomPass = { strength: 0, radius: 0, threshold: 0 };
	applyTrackGlowSettings( bloomPass, {
		glow: { strength: 0.4, radius: 0.2, threshold: 0.7 },
	} );

	assert.equal( trackMaterial.emissive.getHexString(), '00ffaa' );
	assert.equal( trackMaterial.emissiveIntensity, 2.1 );
	assert.equal( terrainMaterial.emissive.getHexString(), 'ff00cc' );
	assert.equal( terrainMaterial.emissiveIntensity, 1.4 );
	assert.equal( boostMaterial.emissive.getHexString(), 'ffd400' );
	assert.equal( boostMaterial.emissiveIntensity, 3.25 );
	assert.equal( bloomPass.strength, 0.4 );
	assert.equal( bloomPass.radius, 0.2 );
	assert.equal( bloomPass.threshold, 0.7 );

} );

test( 'track appearance hue shift animates emissive colors per target', () => {

	const boostMaterial = new THREE.MeshStandardMaterial( { emissive: 0x000000, emissiveIntensity: 0 } );
	boostMaterial.name = 'TurboTile';
	const boostMesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), boostMaterial );
	tagObject3DAppearanceTarget( boostMesh, 'boost' );

	applyTrackAppearanceToObject3D( boostMesh, {
		targets: {
			boost: { color: '#ff0000', intensity: 2.4, hueShiftEnabled: true, hueShiftSpeed: 0.5 },
		},
	}, 0 );
	const startColor = boostMaterial.emissive.getHexString();

	applyTrackAppearanceToObject3D( boostMesh, {
		targets: {
			boost: { color: '#ff0000', intensity: 2.4, hueShiftEnabled: true, hueShiftSpeed: 0.5 },
		},
	}, 0.5 );
	const shiftedColor = boostMaterial.emissive.getHexString();

	assert.notEqual( shiftedColor, startColor );
	assert.equal( boostMaterial.emissiveIntensity, 2.4 );
	assert.equal( hasAnimatedTrackAppearance( {
		targets: { boost: { hueShiftEnabled: true, hueShiftSpeed: 0.5 } },
	} ), true );

} );

test( 'boost pad placement keeps editor and runtime layouts aligned', () => {

	const placement = resolveBoostPadPlacement( {
		gx: 1,
		gz: 2,
		layout: 'split',
		trackIntel: {
			valid: true,
			count: 1,
			getNearestWaypoint() {

				return 0;

			},
			getWaypointInfo() {

				return {
					position: { x: 15, z: 25 },
					forward: { x: - 1, z: 0 },
				};

			},
		},
		cellType: 'trk-straight',
		orient: 16,
	} );

	assert.equal( placement.padCenters.length, 2 );
	assert.ok( Math.abs( angleDelta( placement.rotationY, - Math.PI / 2 ) ) < 1e-6 );
	assert.ok( placement.padCenters[ 0 ].z > 25 );
	assert.ok( placement.padCenters[ 1 ].z < 25 );

} );
