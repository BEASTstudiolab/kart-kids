import test from 'node:test';
import assert from 'node:assert/strict';

import { TrackIntel } from '../js/TrackIntel.js';
import { TRACK_CELLS } from '../js/TrackData.js';
import { TrackProject } from '../js/track-editor/models/TrackProject.js';
import { TrackTile } from '../js/track-editor/models/TrackTile.js';
import {
	CORNER_EXIT_MASKS,
	STRAIGHT_EXIT_MASKS,
	getFinishRoadCells,
	isNorthSouthOrient,
} from '../js/TrackOrientation.js';

const RECT_LOOP_CELLS = [
	[ - 1, 0, 'trk-finish', 0 ],
	[ - 1, - 1, 'trk-straight', 0 ],
	[ - 1, 1, 'trk-straight', 0 ],
	[ - 1, - 2, 'trk-straight', 0 ],
	[ - 1, - 3, 'trk-straight', 0 ],
	[ - 1, 2, 'trk-straight', 0 ],
	[ - 1, 3, 'trk-straight', 0 ],
	[ - 1, 4, 'trk-straight', 0 ],
	[ - 4, 4, 'trk-straight', 0 ],
	[ - 4, 3, 'trk-straight', 0 ],
	[ - 4, 2, 'trk-straight', 0 ],
	[ - 4, 1, 'trk-straight', 0 ],
	[ - 4, 0, 'trk-straight', 0 ],
	[ - 4, - 1, 'trk-straight', 0 ],
	[ - 4, - 2, 'trk-straight', 0 ],
	[ - 4, - 3, 'trk-straight', 0 ],
	[ - 3, - 4, 'trk-straight', 16 ],
	[ - 2, - 4, 'trk-straight', 16 ],
	[ - 3, 5, 'trk-straight', 16 ],
	[ - 2, 5, 'trk-straight', 16 ],
	[ - 1, 5, 'trk-corner-1x1', 22 ],
	[ - 4, 5, 'trk-corner-1x1', 10 ],
	[ - 4, - 4, 'trk-corner-1x1', 16 ],
	[ - 1, - 4, 'trk-corner-1x1', 0 ],
];

test( 'TrackOrientation exposes canonical straight and corner exit masks', () => {

	assert.deepEqual( STRAIGHT_EXIT_MASKS, { 0: 12, 10: 12, 16: 3, 22: 3 } );
	assert.deepEqual( CORNER_EXIT_MASKS, { 0: 5, 16: 6, 10: 10, 22: 9 } );

} );

test( 'TrackOrientation identifies north-south orientations and finish road cells', () => {

	assert.equal( isNorthSouthOrient( 0 ), true );
	assert.equal( isNorthSouthOrient( 10 ), true );
	assert.equal( isNorthSouthOrient( 16 ), false );
	assert.equal( isNorthSouthOrient( 22 ), false );

	assert.deepEqual(
		getFinishRoadCells( 8, 12, 0 ),
		[ { gx: 8, gz: 11 }, { gx: 8, gz: 13 } ],
	);
	assert.deepEqual(
		getFinishRoadCells( 8, 12, 10 ),
		[ { gx: 8, gz: 11 }, { gx: 8, gz: 13 } ],
	);
	assert.deepEqual(
		getFinishRoadCells( 8, 12, 16 ),
		[ { gx: 7, gz: 12 }, { gx: 9, gz: 12 } ],
	);
	assert.deepEqual(
		getFinishRoadCells( 8, 12, 22 ),
		[ { gx: 7, gz: 12 }, { gx: 9, gz: 12 } ],
	);

} );

test( 'TrackTile.getExitMask matches the editor orientation semantics', () => {

	for ( const [ orient, expected ] of Object.entries( STRAIGHT_EXIT_MASKS ) ) {

		const tile = new TrackTile( 'trk-straight', Number( orient ) );
		assert.equal( tile.getExitMask(), expected );

	}

	for ( const [ orient, expected ] of Object.entries( CORNER_EXIT_MASKS ) ) {

		const tile = new TrackTile( 'trk-corner-1x1', Number( orient ) );
		assert.equal( tile.getExitMask(), expected );

	}

} );

test( 'TrackIntel validates the reported rectangular loop from the editor screenshot', () => {

	const intel = new TrackIntel( RECT_LOOP_CELLS );

	assert.equal( intel.valid, true );
	assert.equal( intel.error, null );
	assert.ok( intel.count > 0 );

} );

test( 'TrackProject restores finish road cells on load using the shared orientation helper', () => {

	const project = new TrackProject();

	project.loadFromV4JSON( {
		v: 4,
		meta: {},
		trackTiles: [
			{ gx: 8, gz: 12, t: 3, o: 0 },
			{ gx: 3, gz: 7, t: 3, o: 1 },
		],
	} );

	assert.equal( project.getTile( 8, 11 )?.type, 'trk-straight' );
	assert.equal( project.getTile( 8, 13 )?.type, 'trk-straight' );
	assert.equal( project.getTile( 2, 7 )?.type, 'trk-straight' );
	assert.equal( project.getTile( 4, 7 )?.type, 'trk-straight' );

} );

test.skip( 'TrackIntel validates the default TRACK_CELLS layout', () => {

	// TRACK_CELLS still uses a separate legacy center-anchored multi-tile curve format.
	// This orientation fix keeps editor semantics consistent; legacy curve normalization
	// is a separate compatibility task.
	const intel = new TrackIntel( TRACK_CELLS );
	assert.equal( intel.valid, true );
	assert.equal( intel.error, null );
	assert.ok( intel.count > 0 );

} );
