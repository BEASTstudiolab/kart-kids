import test from 'node:test';
import assert from 'node:assert/strict';

import { TrackIntel } from '../js/TrackIntel.js';
import { TRACK_CELLS } from '../js/TrackData.js';
import { normalizeLegacyTrackIntelCells } from '../js/TrackOrientation.js';
import { getTracks } from '../js/TrackRegistry.js';
import { getTemplateWaypoints } from '../js/WaypointTemplates.js';

function wrapDistance( a, b, count ) {

	const delta = Math.abs( a - b );
	return Math.min( delta, count - delta );

}

function createRectLoopWithCurveVariant( curveVariant ) {

	return [
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
		[ - 1, - 4, 'trk-corner-1x1', 0, { curveVariant, curveOverride: true } ],
	];

}

function getCurveWaypointBounds( intel, gx, gz ) {

	const cellIdx = intel._orderedCells.findIndex( ( cell ) => cell[ 0 ] === gx && cell[ 1 ] === gz );
	assert.notEqual( cellIdx, - 1, `expected ordered cell ${gx},${gz} to exist` );

	const points = intel.waypoints.filter( ( _, idx ) => intel._waypointToCellIndex[ idx ] === cellIdx );
	assert.ok( points.length > 0, 'expected curve block to own dedicated waypoint samples' );

	return {
		count: points.length,
		minX: Math.min( ...points.map( ( point ) => point.x ) ),
		maxZ: Math.max( ...points.map( ( point ) => point.z ) ),
	};

}

function createLegacy3x3Loop( legacyType ) {

	return [
		[ - 1, 0, 'trk-finish', 0 ],
		[ - 1, - 1, 'trk-straight', 0 ],
		[ - 1, 1, 'trk-straight', 0 ],
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
		[ - 3, 5, 'trk-straight', 16 ],
		[ - 2, 5, 'trk-straight', 16 ],
		[ - 1, 5, 'trk-corner-1x1', 22 ],
		[ - 4, 5, 'trk-corner-1x1', 10 ],
		[ - 4, - 4, 'trk-corner-1x1', 16 ],
		[ - 2, - 3, legacyType, 10 ],
	];

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
		`expected hinted nearest waypoint to stay near ${hint}, got ${nearest}`
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
		`expected fallback nearest waypoint near ${remoteIndex}, got ${nearest}`
	);

} );

test( 'corner waypoint templates provide a smooth multi-point arc for stacked 1x1 bends', () => {

	const corner = getTemplateWaypoints( 'trk-corner-1x1', 'S', 'W', 0 );

	assert.ok( corner.length >= 6, `expected denser corner arc, got ${corner.length} points` );
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
	assert.ok( proxy.length >= 7, `expected a denser wide-curve arc, got ${proxy.length} points` );

	for ( let i = 1; i < proxy.length; i ++ ) {

		assert.ok( proxy[ i ].x <= proxy[ i - 1 ].x, 'wide proxy arc should keep moving toward the exit edge on X' );
		assert.ok( proxy[ i ].z <= proxy[ i - 1 ].z, 'wide proxy arc should keep moving toward the exit edge on Z' );

	}

} );

test( 'TrackIntel uses footprint-sized curve blocks for editor curve variants', () => {

	const expectedReachByVariant = {
		'2x2-wide': 15,
		'3x3': 25,
		'3x3-wide': 25,
	};

	for ( const [ variant, expectedReach ] of Object.entries( expectedReachByVariant ) ) {

		const intel = new TrackIntel( createRectLoopWithCurveVariant( variant ) );
		assert.equal( intel.valid, true, variant );

		const bounds = getCurveWaypointBounds( intel, - 1, - 4 );
		const anchorCenterX = ( - 1 + 0.5 ) * 10;
		const anchorCenterZ = ( - 4 + 0.5 ) * 10;

		assert.ok( bounds.count >= 4, `${variant} should emit multiple curve samples` );
		assert.ok( bounds.minX <= anchorCenterX - expectedReach + 0.1, `${variant} should extend across the west footprint` );
		assert.ok( bounds.maxZ >= anchorCenterZ + expectedReach * 0.6, `${variant} should cover most of the south footprint` );

	}

} );

test( 'TrackIntel normalizes legacy 3x3 curve tiles into the same route as curveVariant anchors', () => {

	const variantByLegacyType = {
		'trk-curve-3x3-l': '3x3',
		'trk-curve-3x3-wide-l': '3x3-wide',
	};

	for ( const [ legacyType, curveVariant ] of Object.entries( variantByLegacyType ) ) {

		const legacyIntel = new TrackIntel( createLegacy3x3Loop( legacyType ) );
		const anchorIntel = new TrackIntel( createRectLoopWithCurveVariant( curveVariant ) );

		assert.equal( legacyIntel.valid, true, legacyType );
		assert.equal( anchorIntel.valid, true, curveVariant );
		assert.ok( Math.abs( legacyIntel.totalLength - anchorIntel.totalLength ) < 1e-6, `${legacyType} should preserve route length` );
		assert.equal( legacyIntel.count, anchorIntel.count, `${legacyType} should preserve sampled route density` );

		const legacyBounds = getCurveWaypointBounds( legacyIntel, - 1, - 4 );
		const anchorBounds = getCurveWaypointBounds( anchorIntel, - 1, - 4 );

		assert.ok( Math.abs( legacyBounds.minX - anchorBounds.minX ) < 1e-6, `${legacyType} should normalize the curve block start` );
		assert.ok( Math.abs( legacyBounds.maxZ - anchorBounds.maxZ ) < 1e-6, `${legacyType} should normalize the curve block exit` );

	}

} );

test( 'TrackIntel keeps default track progress and route sampling stable', () => {

	const intel = new TrackIntel( TRACK_CELLS );
	assert.equal( intel.valid, true );
	assert.ok( intel.totalLength > 0 );

	const seg = intel._segmentInfo[ 24 ];
	const midRoute = intel.sampleRoute( seg.startDist + seg.length * 0.35, 0 );
	assert.ok( midRoute );

	const projected = intel.projectToRoute( midRoute.x, midRoute.z, midRoute.segmentIndex );
	assert.ok( projected );
	assert.ok( Math.abs( projected.distanceAlongTrack - midRoute.distanceAlongTrack ) < 1e-6 );
	assert.ok( Math.abs( projected.progress - intel.getProgress( midRoute.x, midRoute.z, projected.segmentIndex ) ) < 1e-9 );

	const offsetSample = intel.sampleRoute( midRoute.distanceAlongTrack, 1.5 );
	assert.ok( offsetSample );
	assert.notEqual( offsetSample.x, midRoute.x );
	assert.notEqual( offsetSample.z, midRoute.z );

} );

test( 'TrackIntel keeps chained default 3x3 curve transitions forward-continuous', () => {

	const intel = new TrackIntel( TRACK_CELLS );
	assert.equal( intel.valid, true );

	const curveAnchorIndices = intel._orderedCells
		.map( ( cell, index ) => ( { cell, index } ) )
		.filter( ( { cell } ) => Boolean( cell[ 4 ]?.curveVariant ) )
		.map( ( { index } ) => index );

	assert.ok( curveAnchorIndices.length >= 2, 'expected default track to contain chained wide-curve anchors' );

	const waypointIndices = intel._waypointToCellIndex
		.map( ( cellIndex, waypointIndex ) => ( curveAnchorIndices.includes( cellIndex ) ? waypointIndex : - 1 ) )
		.filter( ( waypointIndex ) => waypointIndex >= 0 );

	const start = Math.max( 0, Math.min( ...waypointIndices ) - 2 );
	const end = Math.min( intel._segmentInfo.length - 2, Math.max( ...waypointIndices ) + 2 );

	for ( let i = start; i <= end; i ++ ) {

		const curr = intel._segmentInfo[ i ];
		const next = intel._segmentInfo[ i + 1 ];
		const dot = curr.forward.x * next.forward.x + curr.forward.z * next.forward.z;
		assert.ok( dot > 0.7, `segment ${i} should not reverse or kink sharply into segment ${i + 1}` );

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

	assert.ok( straightSeverity < 0.2, `expected straight severity to stay low, got ${straightSeverity}` );
	assert.ok( cornerSeverity > 0.45, `expected corner severity to read high, got ${cornerSeverity}` );

} );
