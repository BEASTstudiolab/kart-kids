import test from 'node:test';
import assert from 'node:assert/strict';
import {
	getTrackSurfaceMode,
	tuneTrackMaterial,
} from '../js/TrackMaterialTuning.js';

test( 'track surface mode defaults to the normal renderer', () => {

	assert.equal( getTrackSurfaceMode( '' ), 'default' );
	assert.equal( getTrackSurfaceMode( '?foo=bar' ), 'default' );
	assert.equal( getTrackSurfaceMode( '?surface=flat-materials' ), 'flat-materials' );

} );

test( 'flat material mode removes texture-driven asphalt rendering state', () => {

	const material = {
		name: 'asphalt',
		normalMap: { id: 'normal' },
		map: { id: 'base' },
		roughnessMap: { id: 'rough' },
		metalnessMap: { id: 'metal' },
		emissiveMap: { id: 'emit' },
		transparent: true,
		opacity: 0.5,
		alphaTest: 0.25,
		depthWrite: false,
		color: { value: null, setHex( v ) { this.value = v; } },
		emissive: { value: null, setHex( v ) { this.value = v; } },
		roughness: 0.2,
		metalness: 0.9,
		needsUpdate: false,
	};

	tuneTrackMaterial( material, { surfaceMode: 'flat-materials' } );

	assert.equal( material.normalMap, null );
	assert.equal( material.map, null );
	assert.equal( material.roughnessMap, null );
	assert.equal( material.metalnessMap, null );
	assert.equal( material.emissiveMap, null );
	assert.equal( material.transparent, false );
	assert.equal( material.opacity, 1 );
	assert.equal( material.alphaTest, 0 );
	assert.equal( material.depthWrite, true );
	assert.equal( material.color.value, 0x303030 );
	assert.equal( material.emissive.value, 0x000000 );
	assert.equal( material.roughness, 1 );
	assert.equal( material.metalness, 0 );
	assert.equal( material.needsUpdate, true );

} );
