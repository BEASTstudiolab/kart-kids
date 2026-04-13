import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackIntel } from '../js/TrackIntel.js';
import { normalizeLegacyTrackIntelCells } from '../js/TrackOrientation.js';
import { getTracks } from '../js/TrackRegistry.js';
import { getTemplateWaypoints } from '../js/WaypointTemplates.js';

function wrapDistance( a, b, count ) {

	const delta = Math.abs( a - b );
	return Math.min( delta, count - delta );

}

test( 'TrackIntel.getNearestWaypoint honors a route hint near close parallel sections', () => {

	const track = getTracks().find( ( entry ) => entry.id === 'starter-circuit' );
	const intel = new TrackIntel( track.cells );

	assert.equal( intel.valid, true );

	const hint = 4;
	const displaced = { x: - 9, z: 11 };

	const nearest = intel.getNearestWaypoint( displaced.x, displaced.z, hint );

	assert.ok(
		wrapDistance( nearest, hint, intel.count ) <= 3,
		`expected hinted nearest waypoint to stay near ${ hint }, got ${ nearest }`
	);

} );

test( 'TrackIntel.getNearestWaypoint falls back to the global nearest waypoint when far from the hint', () => {

	const track = getTracks().find( ( entry ) => entry.id === 'starter-circuit' );
	const intel = new TrackIntel( track.cells );

	assert.equal( intel.valid, true );

	const remoteIndex = 80;
	const remoteWaypoint = intel.waypoints[ remoteIndex ];
	const nearest = intel.getNearestWaypoint( remoteWaypoint.x, remoteWaypoint.z, 4 );

	assert.ok(
		wrapDistance( nearest, remoteIndex, intel.count ) <= 1,
		`expected fallback nearest waypoint near ${ remoteIndex }, got ${ nearest }`
	);

} );

test( 'corner waypoint templates provide a smooth multi-point arc for stacked 1x1 bends', () => {

	const corner = getTemplateWaypoints( 'trk-corner-1x1', 'S', 'W', 0 );

	assert.ok( corner.length >= 6, `expected denser corner arc, got ${ corner.length } points` );
	assert.deepEqual( corner[ 0 ], { x: 0, z: 4 } );
	assert.deepEqual( corner.at( - 1 ), { x: - 4, z: 0 } );

	for ( let i = 1; i < corner.length; i ++ ) {

		assert.ok( corner[ i ].x <= corner[ i - 1 ].x, 'corner arc should keep moving toward the exit edge on X' );
		assert.ok( corner[ i ].z <= corner[ i - 1 ].z, 'corner arc should keep moving toward the exit edge on Z' );

	}

} );

test( 'legacy 3x3 curves normalize to wide proxy corners instead of tight 1x1 elbows', () => {

	const track = getTracks().find( ( entry ) => entry.id === 'starter-circuit' );
	const normalized = normalizeLegacyTrackIntelCells( track.cells );

	assert.ok(
		normalized.some( ( [ gx, gz, type ] ) => gx === 15 && gz === 0 && type === 'trk-curve-3x3-wide-proxy' ),
		'expected the top-right wide turn to normalize to a wide proxy corner'
	);
	assert.ok(
		normalized.some( ( [ gx, gz, type ] ) => gx === 15 && gz === - 5 && type === 'trk-curve-3x3-proxy' ),
		'expected the bottom-right turn to normalize to a standard 3x3 proxy corner'
	);

} );

test( '3x3 curve proxy templates span the full bend radius', () => {

	const proxy = getTemplateWaypoints( 'trk-curve-3x3-wide-proxy', 'S', 'W', 0 );

	assert.equal( proxy[ 0 ].z, 10 );
	assert.equal( proxy.at( - 1 ).x, - 10 );
	assert.ok( proxy.length >= 7, `expected a denser wide-curve arc, got ${ proxy.length } points` );

	for ( let i = 1; i < proxy.length; i ++ ) {

		assert.ok( proxy[ i ].x <= proxy[ i - 1 ].x, 'wide proxy arc should keep moving toward the exit edge on X' );
		assert.ok( proxy[ i ].z <= proxy[ i - 1 ].z, 'wide proxy arc should keep moving toward the exit edge on Z' );

	}

} );

test( 'TrackIntel.sampleAhead returns stable distance-based route samples', () => {

	const track = getTracks().find( ( entry ) => entry.id === 'starter-circuit' );
	const intel = new TrackIntel( track.cells );
	const baseProgress = intel._cumDist[ 120 ] / intel.totalLength;

	const base = intel.sampleAtProgress( baseProgress );
	const ahead = intel.sampleAhead( baseProgress, 12 );
	const dx = ahead.x - base.x;
	const dz = ahead.z - base.z;

	assert.ok( Math.abs( ahead.distance - base.distance - 12 ) < 0.75, 'expected sampleAhead to advance by arc length' );
	assert.ok( Math.sqrt( dx * dx + dz * dz ) > 4, 'expected ahead sample to move materially down the route' );
	assert.ok( Math.abs( ahead.forward.x ) + Math.abs( ahead.forward.z ) > 0.9, 'expected normalized forward vector' );

} );

test( 'TrackIntel.estimateTurnSeverity distinguishes straights from the starter-circuit right bend', () => {

	const track = getTracks().find( ( entry ) => entry.id === 'starter-circuit' );
	const intel = new TrackIntel( track.cells );

	const straightProgress = intel._cumDist[ 20 ] / intel.totalLength;
	const cornerProgress = intel._cumDist[ 126 ] / intel.totalLength;
	const straightSeverity = intel.estimateTurnSeverity( straightProgress, 22, 6 );
	const cornerSeverity = intel.estimateTurnSeverity( cornerProgress, 22, 6 );

	assert.ok( straightSeverity < 0.2, `expected straight severity to stay low, got ${ straightSeverity }` );
	assert.ok( cornerSeverity > 0.45, `expected corner severity to read high, got ${ cornerSeverity }` );

} );
