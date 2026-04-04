import test from 'node:test';
import assert from 'node:assert/strict';
import { tuneTrackMaterial } from '../js/TrackMaterialTuning.js';

test( 'tuneTrackMaterial removes the asphalt normal map that creates tile seams', () => {

	const normalMap = { id: 'atlas-normal' };
	const material = {
		name: 'asphalt',
		normalMap,
		needsUpdate: false,
	};

	tuneTrackMaterial( material );

	assert.equal( material.normalMap, null );
	assert.equal( material.needsUpdate, true );

} );

test( 'tuneTrackMaterial leaves non-asphalt materials alone', () => {

	const normalMap = { id: 'atlas-normal' };
	const material = {
		name: 'concrete',
		normalMap,
		needsUpdate: false,
	};

	tuneTrackMaterial( material );

	assert.equal( material.normalMap, normalMap );
	assert.equal( material.needsUpdate, false );

} );
