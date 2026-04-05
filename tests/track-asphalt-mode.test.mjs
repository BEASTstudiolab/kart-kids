import test from 'node:test';
import assert from 'node:assert/strict';
import {
	getTrackAsphaltMode,
	applyTrackAsphaltMode,
} from '../js/TrackAsphaltMode.js';

test( 'track asphalt mode defaults to the normal renderer', () => {

	assert.equal( getTrackAsphaltMode( '' ), 'default' );
	assert.equal( getTrackAsphaltMode( '?foo=bar' ), 'default' );
	assert.equal( getTrackAsphaltMode( '?surface=opaque-asphalt' ), 'opaque-asphalt' );

} );

test( 'opaque asphalt mode only changes the asphalt material transparency flags', () => {

	const asphalt = {
		name: 'asphalt',
		transparent: true,
		opacity: 0.6,
		alphaTest: 0.25,
		depthWrite: false,
		needsUpdate: false,
	};
	const concrete = {
		name: 'concrete',
		transparent: true,
		opacity: 0.6,
		alphaTest: 0.25,
		depthWrite: false,
		needsUpdate: false,
	};

	applyTrackAsphaltMode( asphalt, { asphaltMode: 'opaque-asphalt' } );
	applyTrackAsphaltMode( concrete, { asphaltMode: 'opaque-asphalt' } );

	assert.equal( asphalt.transparent, false );
	assert.equal( asphalt.opacity, 1 );
	assert.equal( asphalt.alphaTest, 0 );
	assert.equal( asphalt.depthWrite, true );
	assert.equal( asphalt.needsUpdate, true );
	assert.equal( concrete.transparent, true );
	assert.equal( concrete.opacity, 0.6 );
	assert.equal( concrete.alphaTest, 0.25 );
	assert.equal( concrete.depthWrite, false );
	assert.equal( concrete.needsUpdate, false );

} );

test( 'default asphalt mode leaves materials unchanged', () => {

	const material = {
		name: 'asphalt',
		transparent: true,
		opacity: 0.6,
		alphaTest: 0.25,
		depthWrite: false,
		needsUpdate: false,
	};

	applyTrackAsphaltMode( material, { asphaltMode: 'default' } );

	assert.equal( material.transparent, true );
	assert.equal( material.opacity, 0.6 );
	assert.equal( material.alphaTest, 0.25 );
	assert.equal( material.depthWrite, false );
	assert.equal( material.needsUpdate, false );

} );
