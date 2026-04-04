import test from 'node:test';
import assert from 'node:assert/strict';
import {
	getTrackModelConfig,
	getTrackTileSet,
} from '../js/TrackModelConfig.js';

test( 'track tile set defaults to legacy unless explicitly opted into standard', () => {

	assert.equal( getTrackTileSet( '' ), 'legacy' );
	assert.equal( getTrackTileSet( '?tileset=legacy' ), 'legacy' );
	assert.equal( getTrackTileSet( '?tileset=standard' ), 'standard' );
	assert.equal( getTrackTileSet( '?foo=bar' ), 'legacy' );

} );

test( 'legacy track tiles use the original model paths and no correction rotation', () => {

	assert.deepEqual(
		getTrackModelConfig( 'track-straight-night', 'legacy' ),
		{ path: 'track-straight-night', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'track-corner-night', 'legacy' ),
		{ path: 'track-corner-night', rotationY: 0 }
	);

} );

test( 'standard track tiles keep the standard-map paths and correction rotations', () => {

	assert.deepEqual(
		getTrackModelConfig( 'track-straight-night', 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1', rotationY: Math.PI / 2 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'track-corner-night', 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_020_trn_90_l_1x1', rotationY: Math.PI }
	);

} );

test( 'non-track models are unaffected by the tile set selection', () => {

	assert.deepEqual(
		getTrackModelConfig( 'vehicle-truck-yellow', 'legacy' ),
		{ path: 'vehicle-truck-yellow', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'vehicle-truck-yellow', 'standard' ),
		{ path: 'vehicle-truck-yellow', rotationY: 0 }
	);

} );
