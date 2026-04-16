import test from 'node:test';
import assert from 'node:assert/strict';

import { TrackProject, ELEV_GROUND } from '../js/track-editor/models/TrackProject.js';
import { TrackTile } from '../js/track-editor/models/TrackTile.js';
import { TerrainTile } from '../js/track-editor/models/TerrainTile.js';
import { TERRAIN_TILE_ID } from '../js/track-editor/constants/EditorAssetIds.js';

test( 'TrackProject serializes and restores terrain tiles separately from track tiles', () => {

	const project = new TrackProject();
	project.setTile( 1, 2, new TrackTile( 'trk-straight', 0, ELEV_GROUND ) );
	project.setTerrainTile( 4, 5, new TerrainTile( TERRAIN_TILE_ID, 0, ELEV_GROUND + 2 ) );

	const json = project.toV4JSON();

	assert.equal( json.trackTiles.length, 1 );
	assert.deepEqual( json.terrainTiles, [
		{ gx: 4, gz: 5, type: TERRAIN_TILE_ID, e: ELEV_GROUND + 2 },
	] );

	const restored = new TrackProject();
	restored.loadFromV4JSON( json );

	assert.equal( restored.getTile( 1, 2 )?.type, 'trk-straight' );
	assert.equal( restored.getTerrainTile( 4, 5 )?.type, TERRAIN_TILE_ID );
	assert.equal( restored.getTerrainTile( 4, 5 )?.elevation, ELEV_GROUND + 2 );
	assert.equal( restored.getCellsArray().length, 1, 'terrain must stay out of track route/export cells' );

} );

test( 'TrackProject round-trips track appearance settings through v4 metadata', () => {

	const project = new TrackProject();
	project.meta.appearance.targets.track.color = '#00ffaa';
	project.meta.appearance.targets.track.intensity = 2.25;
	project.meta.appearance.targets.terrain.color = '#ff33aa';
	project.meta.appearance.targets.terrain.intensity = 1.75;
	project.meta.appearance.targets.boost.hueShiftEnabled = true;
	project.meta.appearance.targets.boost.hueShiftSpeed = 1.35;
	project.meta.appearance.glow.strength = 0.48;
	project.meta.appearance.glow.radius = 0.22;
	project.meta.appearance.glow.threshold = 0.64;

	const json = project.toV4JSON();
	assert.equal( json.meta.appearance.targets.track.color, '#00ffaa' );
	assert.equal( json.meta.appearance.targets.terrain.intensity, 1.75 );
	assert.equal( json.meta.appearance.targets.boost.hueShiftEnabled, true );
	assert.equal( json.meta.appearance.targets.boost.hueShiftSpeed, 1.35 );
	assert.equal( json.meta.appearance.glow.radius, 0.22 );

	const restored = new TrackProject();
	restored.loadFromV4JSON( json );

	assert.equal( restored.meta.appearance.targets.track.color, '#00ffaa' );
	assert.equal( restored.meta.appearance.targets.track.intensity, 2.25 );
	assert.equal( restored.meta.appearance.targets.terrain.color, '#ff33aa' );
	assert.equal( restored.meta.appearance.targets.boost.hueShiftEnabled, true );
	assert.equal( restored.meta.appearance.targets.boost.hueShiftSpeed, 1.35 );
	assert.equal( restored.meta.appearance.glow.strength, 0.48 );

} );

test( 'TrackProject.clear drops stale pending markers and props from future saves', () => {

	const project = new TrackProject();
	project._pendingMarkers = [ { id: 'boost-1', type: 'boost', pos: [ 1, 0, 2 ] } ];
	project._pendingProps = [ { id: 'prop-1', type: 'decor-test', pos: [ 1, 0, 2 ] } ];

	project.clear();

	const json = project.toV4JSON();
	assert.deepEqual( json.markers, [] );
	assert.deepEqual( json.props, [] );

} );
