import test from 'node:test';
import assert from 'node:assert/strict';
import {
	getTrackModelConfig,
	getTrackTileSet,
} from '../js/TrackModelConfig.js';
import { BOOST_MARKER_MODEL_ID, TERRAIN_TILE_ID } from '../js/track-editor/constants/EditorAssetIds.js';

test( 'track tile set defaults to standard unless explicitly opted into legacy', () => {

	assert.equal( getTrackTileSet( '' ), 'standard' );
	assert.equal( getTrackTileSet( '?tileset=legacy' ), 'legacy' );
	assert.equal( getTrackTileSet( '?tileset=standard' ), 'standard' );
	assert.equal( getTrackTileSet( '?foo=bar' ), 'standard' );

} );

test( 'legacy track tiles use the original model paths and no correction rotation', () => {

	assert.deepEqual(
		getTrackModelConfig( 'trk-straight', 'legacy' ),
		{ path: 'trk-straight.glb', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'trk-corner-1x1', 'legacy' ),
		{ path: 'trk-corner-1x1.glb', rotationY: 0 }
	);

} );

test( 'standard track tiles keep the standard-map paths and correction rotations', () => {

	assert.deepEqual(
		getTrackModelConfig( 'trk-straight', 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'trk-corner-1x1', 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_020_trn_90_l_1x1.gltf', rotationY: 0 }
	);

} );

test( 'non-track models are unaffected by the tile set selection', () => {

	assert.deepEqual(
		getTrackModelConfig( 'vehicle-truck-yellow', 'legacy' ),
		{ path: 'vehicle-truck-yellow.glb', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'vehicle-truck-yellow', 'standard' ),
		{ path: 'vehicle-truck-yellow.glb', rotationY: 0 }
	);

} );

test( 'shared terrain and gameplay boost assets are registered in the standard tileset config', () => {

	assert.deepEqual(
		getTrackModelConfig( TERRAIN_TILE_ID, 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_700_terrain_blank.gltf', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( BOOST_MARKER_MODEL_ID, 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_600__Turbo_2x2.gltf', rotationY: 0 }
	);
	assert.deepEqual(
		getTrackModelConfig( 'trk-jump-medium', 'standard' ),
		{ path: 'standard-map/kartkids_base_trk_490_jmp_02_mid_50pct_railed_1x1.gltf', rotationY: 0 }
	);

} );
