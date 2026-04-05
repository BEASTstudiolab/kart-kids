#!/usr/bin/env node
/**
 * Autodraw placement correctness tests
 * Extracts editor.html logic and verifies all tile placement scenarios.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

// ─── Extracted from editor.html ─────────────────────────────────────────

const AUTOTILE = [
	[ 'trk-straight', 0 ],    //  0: isolated
	[ 'trk-straight', 16 ],   //  1: W
	[ 'trk-straight', 16 ],   //  2: E
	[ 'trk-straight', 16 ],   //  3: E+W
	[ 'trk-straight', 0 ],    //  4: S
	[ 'trk-corner-1x1', 0 ],  //  5: S+W
	[ 'trk-corner-1x1', 16 ], //  6: S+E
	[ 'trk-straight', 16 ],   //  7: S+E+W
	[ 'trk-straight', 0 ],    //  8: N
	[ 'trk-corner-1x1', 22 ], //  9: N+W
	[ 'trk-corner-1x1', 10 ], // 10: N+E
	[ 'trk-straight', 16 ],   // 11: N+E+W
	[ 'trk-straight', 0 ],    // 12: N+S
	[ 'trk-straight', 0 ],    // 13: N+S+W
	[ 'trk-straight', 0 ],    // 14: N+S+E
	[ 'trk-straight', 0 ],    // 15: N+S+E+W
];

const ORIENT_FLIP = { 0: 10, 10: 0, 16: 22, 22: 16 };

const DIR_DELTA = {
	8: [ 0, -1 ],  // N
	4: [ 0, 1 ],   // S
	2: [ 1, 0 ],   // E
	1: [ -1, 0 ],  // W
};

const DIR_INFO = [
	{ bit: 8, dx: 0, dz: -1 }, // N
	{ bit: 4, dx: 0, dz: 1 },  // S
	{ bit: 2, dx: 1, dz: 0 },  // E
	{ bit: 1, dx: -1, dz: 0 }, // W
];

// ─── Grid simulation ────────────────────────────────────────────────────

const grid = new Map();

function cellKey( gx, gz ) { return gx + ',' + gz; }

function getCellExits( cell ) {
	const t = cell.type;
	const o = cell.orient;
	if ( t === 'trk-corner-1x1' ) {
		if ( o === 0 ) return 5;    // S+W
		if ( o === 16 ) return 6;   // S+E
		if ( o === 10 ) return 10;  // N+E
		if ( o === 22 ) return 9;   // N+W
	}
	if ( o === 0 || o === 10 ) return 12; // N+S
	return 3; // E+W
}

function getConnectivityMask( gx, gz ) {
	let mask = 0;
	const n = grid.get( cellKey( gx, gz - 1 ) );
	if ( n && ( getCellExits( n ) & 4 ) ) mask |= 8;
	const s = grid.get( cellKey( gx, gz + 1 ) );
	if ( s && ( getCellExits( s ) & 8 ) ) mask |= 4;
	const e = grid.get( cellKey( gx + 1, gz ) );
	if ( e && ( getCellExits( e ) & 1 ) ) mask |= 2;
	const w = grid.get( cellKey( gx - 1, gz ) );
	if ( w && ( getCellExits( w ) & 2 ) ) mask |= 1;
	return mask;
}

function getPresenceMask( gx, gz ) {
	let mask = 0;
	if ( grid.has( cellKey( gx, gz - 1 ) ) ) mask |= 8;
	if ( grid.has( cellKey( gx, gz + 1 ) ) ) mask |= 4;
	if ( grid.has( cellKey( gx + 1, gz ) ) ) mask |= 2;
	if ( grid.has( cellKey( gx - 1, gz ) ) ) mask |= 1;
	return mask;
}

function bitCount( mask ) {
	return ( mask >> 3 & 1 ) + ( mask >> 2 & 1 ) + ( mask >> 1 & 1 ) + ( mask & 1 );
}

function connectedExitCount( gx, gz ) {
	const cell = grid.get( cellKey( gx, gz ) );
	if ( !cell ) return 0;
	return bitCount( getCellExits( cell ) & getConnectivityMask( gx, gz ) );
}

function getAvailableMask( gx, gz ) {
	let mask = 0;
	const dirs = [
		[ 0, -1, 8, 4 ],
		[ 0, 1, 4, 8 ],
		[ 1, 0, 2, 1 ],
		[ -1, 0, 1, 2 ],
	];
	for ( const [ dx, dz, bit, oppBit ] of dirs ) {
		const neighbor = grid.get( cellKey( gx + dx, gz + dz ) );
		if ( !neighbor ) continue;
		const exits = getCellExits( neighbor );
		if ( exits & oppBit ) { mask |= bit; continue; }
		const conn = getConnectivityMask( gx + dx, gz + dz );
		if ( bitCount( exits & conn ) < 2 ) mask |= bit;
	}
	return mask;
}

function pickBestPair( mask, gx, gz ) {
	const active = DIR_INFO.filter( d => mask & d.bit );
	if ( active.length <= 2 ) return mask;
	let bestMask = active[ 0 ].bit | active[ 1 ].bit;
	let bestScore = -1;
	let bestIsCorner = false;
	for ( let i = 0; i < active.length; i++ ) {
		for ( let j = i + 1; j < active.length; j++ ) {
			const pairMask = active[ i ].bit | active[ j ].bit;
			const isCorner = ( pairMask !== 3 && pairMask !== 12 );
			const s1 = connectedExitCount( gx + active[ i ].dx, gz + active[ i ].dz );
			const s2 = connectedExitCount( gx + active[ j ].dx, gz + active[ j ].dz );
			const score = s1 + s2;
			if ( ( isCorner && !bestIsCorner ) ||
				( isCorner === bestIsCorner && score > bestScore ) ) {
				bestMask = pairMask;
				bestScore = score;
				bestIsCorner = isCorner;
			}
		}
	}
	return bestMask;
}

function resolveNewTile( gx, gz ) {
	const pMask = getAvailableMask( gx, gz );
	if ( bitCount( pMask ) >= 3 ) {
		return AUTOTILE[ pickBestPair( pMask, gx, gz ) ];
	}
	return AUTOTILE[ pMask ];
}

function resolveTile( gx, gz ) {
	const cMask = getConnectivityMask( gx, gz );
	if ( cMask !== 0 ) return AUTOTILE[ cMask ];
	const pMask = getPresenceMask( gx, gz );
	if ( pMask !== 0 ) {
		const dirs = [ [ 0, -1, 8 ], [ 0, 1, 4 ], [ 1, 0, 2 ], [ -1, 0, 1 ] ];
		for ( const [ dx, dz, bit ] of dirs ) {
			if ( !( pMask & bit ) ) continue;
			const neighbor = grid.get( cellKey( gx + dx, gz + dz ) );
			if ( !neighbor ) continue;
			const exits = getCellExits( neighbor );
			if ( exits & 12 ) return [ 'trk-straight', 0 ];
			if ( exits & 3 ) return [ 'trk-straight', 16 ];
		}
	}
	return AUTOTILE[ 0 ];
}

function resolveCell( gx, gz ) {
	const key = cellKey( gx, gz );
	const cell = grid.get( key );
	if ( !cell ) return;
	if ( cell.rotationOverride || cell.autoRamp || ( cell.elevation && cell.elevation > 0 ) ) return;

	let baseType, orient;
	if ( !cell.resolved ) {
		[ baseType, orient ] = resolveNewTile( gx, gz );
	} else {
		const cMask = getConnectivityMask( gx, gz );
		const currentExits = getCellExits( cell );
		const currentConnected = currentExits & cMask;
		[ baseType, orient ] = resolveTile( gx, gz );
		const proposedExits = getCellExits( { type: baseType, orient } );
		if ( ( proposedExits & currentConnected ) !== currentConnected ) return;
	}

	const type = ( cell.isFinish && baseType === 'trk-straight' ) ? 'trk-finish' : baseType;
	cell.type = type;
	cell.orient = orient;
	cell.resolved = true;
}

function detectCurves( changedGx, changedGz ) {
	const SCAN_RADIUS = 5;
	const candidates = [];

	// Clear curve metadata in scan area
	for ( let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++ ) {
		for ( let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++ ) {
			const cgx = changedGx + dx;
			const cgz = changedGz + dz;
			const key = cellKey( cgx, cgz );
			const cell = grid.get( key );
			if ( !cell ) continue;
			if ( cell.type !== 'trk-corner-1x1' ) continue;
			if ( cell.curveOverride || cell.rotationOverride ) continue;

			cell.curveSize = undefined;
			cell.curveConsumed = undefined;

			const exits = getCellExits( cell );
			const dirBits = [];
			for ( const bit of [ 8, 4, 2, 1 ] ) {
				if ( exits & bit ) dirBits.push( bit );
			}
			if ( dirBits.length !== 2 ) continue;

			const walks = [];
			for ( const bit of dirBits ) {
				const [ ddx, ddz ] = DIR_DELTA[ bit ];
				const keys = [];
				let nx = cgx + ddx;
				let nz = cgz + ddz;
				while ( true ) {
					const nk = cellKey( nx, nz );
					const nc = grid.get( nk );
					if ( !nc ) break;
					if ( nc.type !== 'trk-straight' ) break;
					keys.push( nk );
					nx += ddx;
					nz += ddz;
				}
				walks.push( { count: keys.length, keys } );
			}

			const curveSize = Math.min( walks[ 0 ].count, walks[ 1 ].count, 4 );
			if ( curveSize < 2 ) continue;

			const consumed = new Set();
			for ( const walk of walks ) {
				for ( let i = 0; i < curveSize - 1; i++ ) {
					consumed.add( walk.keys[ i ] );
				}
			}
			candidates.push( { gx: cgx, gz: cgz, key, curveSize, consumed } );
		}
	}

	candidates.sort( ( a, b ) => {
		if ( b.curveSize !== a.curveSize ) return b.curveSize - a.curveSize;
		return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	} );

	const claimed = new Set();
	for ( const cand of candidates ) {
		if ( claimed.has( cand.key ) ) continue;
		let blocked = false;
		for ( const ck of cand.consumed ) {
			if ( claimed.has( ck ) ) { blocked = true; break; }
		}
		if ( blocked ) continue;

		const cell = grid.get( cand.key );
		const orient = cell.orient;
		let fpDx, fpDz;
		if ( orient === 0 ) { fpDx = -1; fpDz = 1; }
		else if ( orient === 16 ) { fpDx = 1; fpDz = 1; }
		else if ( orient === 10 ) { fpDx = 1; fpDz = -1; }
		else if ( orient === 22 ) { fpDx = -1; fpDz = -1; }
		else continue;

		let footprintClear = true;
		for ( let fx = 0; fx < cand.curveSize && footprintClear; fx++ ) {
			for ( let fz = 0; fz < cand.curveSize && footprintClear; fz++ ) {
				if ( fx === 0 && fz === 0 ) continue;
				const fpKey = cellKey( cand.gx + fx * fpDx, cand.gz + fz * fpDz );
				if ( grid.has( fpKey ) && !cand.consumed.has( fpKey ) ) footprintClear = false;
				if ( claimed.has( fpKey ) ) footprintClear = false;
			}
		}
		if ( !footprintClear ) continue;

		cell.curveSize = cand.curveSize;
		cell.curveConsumed = cand.consumed;
		claimed.add( cand.key );
		for ( const ck of cand.consumed ) claimed.add( ck );
	}
}

// Simulate placeRoad + resolveCellAndNeighbors
function placeRoad( gx, gz ) {
	const key = cellKey( gx, gz );
	if ( grid.has( key ) ) return; // skip existing
	grid.set( key, { type: 'trk-straight', orient: 0, isFinish: false, resolved: false } );
	resolveCell( gx, gz );
	resolveCell( gx, gz - 1 );
	resolveCell( gx, gz + 1 );
	resolveCell( gx + 1, gz );
	resolveCell( gx - 1, gz );
	detectCurves( gx, gz );
}

function clearGrid() {
	grid.clear();
}

// ─── Test framework ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert( condition, msg ) {
	if ( condition ) {
		passed++;
	} else {
		failed++;
		failures.push( msg );
	}
}

function assertCell( gx, gz, expectedType, expectedOrient, label ) {
	const cell = grid.get( cellKey( gx, gz ) );
	const actualType = cell ? cell.type : 'MISSING';
	const actualOrient = cell ? cell.orient : -1;
	const ok = actualType === expectedType && actualOrient === expectedOrient;
	assert( ok,
		`${label}: (${gx},${gz}) expected ${expectedType} orient=${expectedOrient}, ` +
		`got ${actualType} orient=${actualOrient}` );
}

function maskLabel( mask ) {
	const dirs = [];
	if ( mask & 8 ) dirs.push( 'N' );
	if ( mask & 4 ) dirs.push( 'S' );
	if ( mask & 2 ) dirs.push( 'E' );
	if ( mask & 1 ) dirs.push( 'W' );
	return dirs.join( '+' ) || 'none';
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: AUTOTILE table correctness
// ═════════════════════════════════════════════════════════════════════════

console.log( '\n═══ TEST 1: AUTOTILE table — exit consistency ═══' );

// For each AUTOTILE entry, verify that the tile's exits match the expected connectivity
const EXPECTED_EXITS = {
	// mask → expected exit bits the tile should have
	0:  12,  // isolated → N+S straight
	1:  3,   // W → E+W straight (connects to W)
	2:  3,   // E → E+W straight (connects to E)
	3:  3,   // E+W → E+W straight
	4:  12,  // S → N+S straight (connects to S)
	5:  5,   // S+W → corner S+W
	6:  6,   // S+E → corner S+E
	7:  3,   // S+E+W → E+W straight (T-junction, picks E+W)
	8:  12,  // N → N+S straight (connects to N)
	9:  9,   // N+W → corner N+W
	10: 10,  // N+E → corner N+E
	11: 3,   // N+E+W → E+W straight (T-junction)
	12: 12,  // N+S → N+S straight
	13: 12,  // N+S+W → N+S straight
	14: 12,  // N+S+E → N+S straight
	15: 12,  // N+S+E+W → N+S straight (4-way → straight)
};

for ( let mask = 0; mask < 16; mask++ ) {
	const [ type, orient ] = AUTOTILE[ mask ];
	const exits = getCellExits( { type, orient } );
	const expected = EXPECTED_EXITS[ mask ];

	// For corner masks (5,6,9,10), exits MUST contain the mask bits
	if ( [ 5, 6, 9, 10 ].includes( mask ) ) {
		assert( ( exits & mask ) === mask,
			`AUTOTILE[${mask}] (${maskLabel(mask)}): exits ${exits} don't contain mask ${mask}` );
	}

	// For straight masks, at least one neighbor direction should be in exits
	if ( ![ 5, 6, 9, 10 ].includes( mask ) && mask > 0 ) {
		assert( ( exits & mask ) !== 0,
			`AUTOTILE[${mask}] (${maskLabel(mask)}): exits ${exits} don't overlap mask ${mask}` );
	}

	assert( exits === expected,
		`AUTOTILE[${mask}] (${maskLabel(mask)}): expected exits=${expected} (${maskLabel(expected)}), got exits=${exits} (${maskLabel(exits)})` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Corner exit directions
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 2: Corner orient → exit direction mapping ═══' );

// Corner orient 0 should exit S+W
assert( getCellExits( { type: 'trk-corner-1x1', orient: 0 } ) === 5, 'Corner orient=0 exits S+W (5)' );
// Corner orient 16 should exit S+E
assert( getCellExits( { type: 'trk-corner-1x1', orient: 16 } ) === 6, 'Corner orient=16 exits S+E (6)' );
// Corner orient 10 should exit N+E
assert( getCellExits( { type: 'trk-corner-1x1', orient: 10 } ) === 10, 'Corner orient=10 exits N+E (10)' );
// Corner orient 22 should exit N+W
assert( getCellExits( { type: 'trk-corner-1x1', orient: 22 } ) === 9, 'Corner orient=22 exits N+W (9)' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Straight orientation
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 3: Straight orient → exit mapping ═══' );

assert( getCellExits( { type: 'trk-straight', orient: 0 } ) === 12, 'Straight orient=0 → N+S' );
assert( getCellExits( { type: 'trk-straight', orient: 10 } ) === 12, 'Straight orient=10 → N+S' );
assert( getCellExits( { type: 'trk-straight', orient: 16 } ) === 3, 'Straight orient=16 → E+W' );
assert( getCellExits( { type: 'trk-straight', orient: 22 } ) === 3, 'Straight orient=22 → E+W' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Connectivity mask — neighbor exit detection
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 4: Connectivity mask ═══' );

clearGrid();
// Place a N-S straight at (5,5)
grid.set( cellKey( 5, 5 ), { type: 'trk-straight', orient: 0, resolved: true } );
// Its exits are N+S (12). S exit = bit 4.
// Cell (5,6) is south — check if (5,5) has S exit → mask should have N bit (8) for cell (5,6)
assert( getConnectivityMask( 5, 6 ) === 8, 'N-S straight at (5,5): cell (5,6) sees N=8' );
assert( getConnectivityMask( 5, 4 ) === 4, 'N-S straight at (5,5): cell (5,4) sees S=4' );
assert( getConnectivityMask( 6, 5 ) === 0, 'N-S straight at (5,5): cell (6,5) sees nothing' );
assert( getConnectivityMask( 4, 5 ) === 0, 'N-S straight at (5,5): cell (4,5) sees nothing' );

clearGrid();
// Place E-W straight at (5,5)
grid.set( cellKey( 5, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
assert( getConnectivityMask( 5, 6 ) === 0, 'E-W straight at (5,5): cell (5,6) sees nothing' );
assert( getConnectivityMask( 6, 5 ) === 1, 'E-W straight at (5,5): cell (6,5) sees W=1' );
assert( getConnectivityMask( 4, 5 ) === 2, 'E-W straight at (5,5): cell (4,5) sees E=2' );

clearGrid();
// Place S+W corner at (5,5) orient=0
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 0, resolved: true } );
// Exits: S(4) + W(1) = 5
assert( getConnectivityMask( 5, 6 ) === 8, 'S+W corner at (5,5): (5,6) sees N=8' );
assert( getConnectivityMask( 4, 5 ) === 2, 'S+W corner at (5,5): (4,5) sees E=2' );
assert( getConnectivityMask( 6, 5 ) === 0, 'S+W corner at (5,5): (6,5) sees nothing' );
assert( getConnectivityMask( 5, 4 ) === 0, 'S+W corner at (5,5): (5,4) sees nothing' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Autodraw line patterns
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 5: Drawing straight lines ═══' );

// Draw horizontal line: (0,0) → (1,0) → (2,0) → (3,0)
clearGrid();
placeRoad( 0, 0 );
placeRoad( 1, 0 );
placeRoad( 2, 0 );
placeRoad( 3, 0 );
assertCell( 0, 0, 'trk-straight', 16, 'H-line: (0,0) E+W' );
assertCell( 1, 0, 'trk-straight', 16, 'H-line: (1,0) E+W' );
assertCell( 2, 0, 'trk-straight', 16, 'H-line: (2,0) E+W' );
assertCell( 3, 0, 'trk-straight', 16, 'H-line: (3,0) E+W' );

// Draw vertical line: (0,0) → (0,1) → (0,2) → (0,3)
clearGrid();
placeRoad( 0, 0 );
placeRoad( 0, 1 );
placeRoad( 0, 2 );
placeRoad( 0, 3 );
assertCell( 0, 0, 'trk-straight', 0, 'V-line: (0,0) N+S' );
assertCell( 0, 1, 'trk-straight', 0, 'V-line: (0,1) N+S' );
assertCell( 0, 2, 'trk-straight', 0, 'V-line: (0,2) N+S' );
assertCell( 0, 3, 'trk-straight', 0, 'V-line: (0,3) N+S' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: L-shape corner detection
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 6: L-shape corner detection ═══' );

// L going right then down: (0,0)→(1,0)→(2,0)→(2,1)→(2,2)
clearGrid();
placeRoad( 0, 0 );
placeRoad( 1, 0 );
placeRoad( 2, 0 );
placeRoad( 2, 1 );
placeRoad( 2, 2 );

// (2,0) should be a corner: has W neighbor (1,0) and S neighbor (2,1)
// That's S+E? No — (1,0) is to the west, (2,1) is to the south → S+W corner orient=0?
// Wait: (2,0) has neighbor at (1,0) to the west and (2,1) to the south
// Connectivity: W connects (exits E toward us) and S connects (exits N toward us) → mask = S+W = 5
assertCell( 2, 0, 'trk-corner-1x1', 0, 'L-right-down: (2,0) corner S+W' );

// L going down then right: (0,0)→(0,1)→(0,2)→(1,2)→(2,2)
clearGrid();
placeRoad( 0, 0 );
placeRoad( 0, 1 );
placeRoad( 0, 2 );
placeRoad( 1, 2 );
placeRoad( 2, 2 );

// (0,2) has N neighbor (0,1) and E neighbor (1,2) → N+E = 10 → corner orient=10
assertCell( 0, 2, 'trk-corner-1x1', 10, 'L-down-right: (0,2) corner N+E' );

// L going right then up: (0,2)→(1,2)→(2,2)→(2,1)→(2,0)
clearGrid();
placeRoad( 0, 2 );
placeRoad( 1, 2 );
placeRoad( 2, 2 );
placeRoad( 2, 1 );
placeRoad( 2, 0 );

// (2,2) has W neighbor (1,2) and N neighbor (2,1) → N+W = 9 → corner orient=22
assertCell( 2, 2, 'trk-corner-1x1', 22, 'L-right-up: (2,2) corner N+W' );

// L going down then left: (2,0)→(2,1)→(2,2)→(1,2)→(0,2)
clearGrid();
placeRoad( 2, 0 );
placeRoad( 2, 1 );
placeRoad( 2, 2 );
placeRoad( 1, 2 );
placeRoad( 0, 2 );

// (2,2) has N neighbor (2,1) and W neighbor (1,2) → N+W = 9 → corner orient=22
assertCell( 2, 2, 'trk-corner-1x1', 22, 'L-down-left: (2,2) corner N+W' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: All four corner orientations via specific patterns
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 7: All 4 corner orientations ═══' );

// S+W corner (orient=0): roads to south and west
clearGrid();
grid.set( cellKey( 5, 6 ), { type: 'trk-straight', orient: 0, resolved: true } ); // S
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } ); // W
grid.set( cellKey( 5, 5 ), { type: 'trk-straight', orient: 0, resolved: false } );
resolveCell( 5, 5 );
assertCell( 5, 5, 'trk-corner-1x1', 0, 'Corner S+W: orient=0' );

// S+E corner (orient=16): roads to south and east
clearGrid();
grid.set( cellKey( 5, 6 ), { type: 'trk-straight', orient: 0, resolved: true } ); // S
grid.set( cellKey( 6, 5 ), { type: 'trk-straight', orient: 16, resolved: true } ); // E
grid.set( cellKey( 5, 5 ), { type: 'trk-straight', orient: 0, resolved: false } );
resolveCell( 5, 5 );
assertCell( 5, 5, 'trk-corner-1x1', 16, 'Corner S+E: orient=16' );

// N+E corner (orient=10): roads to north and east
clearGrid();
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } ); // N
grid.set( cellKey( 6, 5 ), { type: 'trk-straight', orient: 16, resolved: true } ); // E
grid.set( cellKey( 5, 5 ), { type: 'trk-straight', orient: 0, resolved: false } );
resolveCell( 5, 5 );
assertCell( 5, 5, 'trk-corner-1x1', 10, 'Corner N+E: orient=10' );

// N+W corner (orient=22): roads to north and west
clearGrid();
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } ); // N
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } ); // W
grid.set( cellKey( 5, 5 ), { type: 'trk-straight', orient: 0, resolved: false } );
resolveCell( 5, 5 );
assertCell( 5, 5, 'trk-corner-1x1', 22, 'Corner N+W: orient=22' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: T-junction handling (3 neighbors)
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 8: T-junction (3 neighbors) ═══' );

// Place a T: roads at N, S, E of center → should become a straight (N+S or E+W)
// with pickBestPair choosing the best 2
clearGrid();
placeRoad( 5, 4 );  // will be N of center
placeRoad( 5, 6 );  // will be S of center
placeRoad( 6, 5 );  // will be E of center
placeRoad( 5, 5 );  // center — has 3 neighbors

const tCell = grid.get( cellKey( 5, 5 ) );
// Should be resolved as a corner or straight connecting the best pair
assert( tCell !== undefined, 'T-junction: center cell exists' );
// With pickBestPair preferring corners, should pick a corner pair
const tExits = getCellExits( tCell );
assert( bitCount( tExits ) === 2, `T-junction: exactly 2 exits (got ${bitCount(tExits)})` );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 9: Complete rectangle (loop)
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 9: Rectangle loop ═══' );

clearGrid();
// Draw a 4x3 rectangle:
// Top:    (0,0)-(1,0)-(2,0)-(3,0)
// Right:  (3,1)-(3,2)
// Bottom: (3,3)-(2,3)-(1,3)-(0,3)
// Left:   (0,2)-(0,1)

// Top row
placeRoad( 0, 0 ); placeRoad( 1, 0 ); placeRoad( 2, 0 ); placeRoad( 3, 0 );
// Right column
placeRoad( 3, 1 ); placeRoad( 3, 2 ); placeRoad( 3, 3 );
// Bottom row
placeRoad( 2, 3 ); placeRoad( 1, 3 ); placeRoad( 0, 3 );
// Left column
placeRoad( 0, 2 ); placeRoad( 0, 1 );

// Verify corners
assertCell( 3, 0, 'trk-corner-1x1', 0, 'Rect: top-right corner (3,0) S+W' );
assertCell( 3, 3, 'trk-corner-1x1', 22, 'Rect: bottom-right corner (3,3) N+W' );
assertCell( 0, 3, 'trk-corner-1x1', 10, 'Rect: bottom-left corner (0,3) N+E' );
assertCell( 0, 0, 'trk-corner-1x1', 16, 'Rect: top-left corner (0,0) S+E' );

// Verify straights
assertCell( 1, 0, 'trk-straight', 16, 'Rect: top (1,0) E+W' );
assertCell( 2, 0, 'trk-straight', 16, 'Rect: top (2,0) E+W' );
assertCell( 3, 1, 'trk-straight', 0, 'Rect: right (3,1) N+S' );
assertCell( 3, 2, 'trk-straight', 0, 'Rect: right (3,2) N+S' );
assertCell( 1, 3, 'trk-straight', 16, 'Rect: bottom (1,3) E+W' );
assertCell( 2, 3, 'trk-straight', 16, 'Rect: bottom (2,3) E+W' );
assertCell( 0, 1, 'trk-straight', 0, 'Rect: left (0,1) N+S' );
assertCell( 0, 2, 'trk-straight', 0, 'Rect: left (0,2) N+S' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 10: Mutual connectivity — every exit connects to a neighbor
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 10: Mutual connectivity audit ═══' );

// Check the rectangle from Test 9 — every cell's exits should connect
for ( const [ key, cell ] of grid ) {
	const [ gx, gz ] = key.split( ',' ).map( Number );
	const exits = getCellExits( cell );

	// For each exit direction, verify the neighbor exists and connects back
	if ( exits & 8 ) { // N exit
		const n = grid.get( cellKey( gx, gz - 1 ) );
		assert( n && ( getCellExits( n ) & 4 ),
			`Connectivity: (${gx},${gz}) exits N but neighbor (${gx},${gz-1}) doesn't exit S` );
	}
	if ( exits & 4 ) { // S exit
		const s = grid.get( cellKey( gx, gz + 1 ) );
		assert( s && ( getCellExits( s ) & 8 ),
			`Connectivity: (${gx},${gz}) exits S but neighbor (${gx},${gz+1}) doesn't exit N` );
	}
	if ( exits & 2 ) { // E exit
		const e = grid.get( cellKey( gx + 1, gz ) );
		assert( e && ( getCellExits( e ) & 1 ),
			`Connectivity: (${gx},${gz}) exits E but neighbor (${gx+1},${gz}) doesn't exit W` );
	}
	if ( exits & 1 ) { // W exit
		const w = grid.get( cellKey( gx - 1, gz ) );
		assert( w && ( getCellExits( w ) & 2 ),
			`Connectivity: (${gx},${gz}) exits W but neighbor (${gx-1},${gz}) doesn't exit E` );
	}
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 11: Smart curve detection — 2x2
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 11: Smart curve detection (2x2) ═══' );

clearGrid();
// Build an L with 2 straights on each arm + corner:
// Vertical arm: (5,3)-(5,4)  (straights, N+S)
// Corner:       (5,5)        (corner S+W, orient=0)  — wait, need to think about this
// Horizontal:   (4,5)-(3,5)  (straights, E+W)

// Place them manually for curve detection:
grid.set( cellKey( 5, 3 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 22, resolved: true } ); // N+W
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 3, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );

detectCurves( 5, 5 );

const curveCorner = grid.get( cellKey( 5, 5 ) );
assert( curveCorner.curveSize === 2,
	`2x2 curve: expected curveSize=2, got ${curveCorner.curveSize}` );
assert( curveCorner.curveConsumed !== undefined && curveCorner.curveConsumed.size === 2,
	`2x2 curve: expected 2 consumed cells, got ${curveCorner.curveConsumed ? curveCorner.curveConsumed.size : 0}` );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 12: Smart curve detection — 3x3
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 12: Smart curve detection (3x3) ═══' );

clearGrid();
// 3 straights north + corner + 3 straights west
grid.set( cellKey( 5, 2 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 3 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 22, resolved: true } ); // N+W
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 3, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 2, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );

detectCurves( 5, 5 );

const curve3 = grid.get( cellKey( 5, 5 ) );
assert( curve3.curveSize === 3,
	`3x3 curve: expected curveSize=3, got ${curve3.curveSize}` );
assert( curve3.curveConsumed !== undefined && curve3.curveConsumed.size === 4,
	`3x3 curve: expected 4 consumed cells, got ${curve3.curveConsumed ? curve3.curveConsumed.size : 0}` );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 13: Smart curve detection — 4x4 (max)
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 13: Smart curve detection (4x4 max) ═══' );

clearGrid();
// 5 straights north + corner + 5 straights west (more than 4 each arm)
for ( let i = 0; i < 5; i++ ) {
	grid.set( cellKey( 5, i ), { type: 'trk-straight', orient: 0, resolved: true } );
}
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 22, resolved: true } );
for ( let i = 1; i <= 5; i++ ) {
	grid.set( cellKey( 5 - i, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
}

detectCurves( 5, 5 );

const curve4 = grid.get( cellKey( 5, 5 ) );
assert( curve4.curveSize === 4,
	`4x4 curve: expected curveSize=4 (capped), got ${curve4.curveSize}` );
assert( curve4.curveConsumed !== undefined && curve4.curveConsumed.size === 6,
	`4x4 curve: expected 6 consumed cells (3 per arm), got ${curve4.curveConsumed ? curve4.curveConsumed.size : 0}` );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 14: Curve footprint validation
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 14: Curve footprint blocked by obstacle ═══' );

clearGrid();
// Same as 3x3 setup but put an obstacle in the footprint
grid.set( cellKey( 5, 2 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 3 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 22, resolved: true } ); // N+W
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 3, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 2, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );

// Orient 22 (N+W): footprint extends -x, -z from corner at (5,5)
// Footprint cells: (4,4), (3,4), (4,3), (3,3) for 3x3
// Place an obstacle at (4,4) — not part of consumed set
grid.set( cellKey( 4, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );

detectCurves( 5, 5 );

const blockedCurve = grid.get( cellKey( 5, 5 ) );
// Should fall back to 2x2 since 3x3 footprint is blocked
assert( blockedCurve.curveSize === 2 || blockedCurve.curveSize === undefined,
	`Blocked footprint: expected curveSize=2 or none, got ${blockedCurve.curveSize}` );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 15: Curve positioning offsets
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 15: Curve positioning offsets ═══' );

const CELL = 10;

function getCurveConfig( orient, lr, curveSize ) {
	const halfShift = ( curveSize - 1 ) / 2 * CELL;
	const rotations = {
		0:  Math.PI,
		16: -Math.PI / 2,
		10: 0,
		22: Math.PI / 2,
	};
	const offsets = {
		0:  { x: -halfShift, z: halfShift },
		16: { x: halfShift, z: halfShift },
		10: { x: halfShift, z: -halfShift },
		22: { x: -halfShift, z: -halfShift },
	};
	return {
		rotation: rotations[ orient ] ?? 0,
		offset: offsets[ orient ] ?? { x: 0, z: 0 },
		lr: 'l',
	};
}

// Test 2x2 curve offsets
for ( const orient of [ 0, 10, 16, 22 ] ) {
	const config = getCurveConfig( orient, null, 2 );
	const halfShift = ( 2 - 1 ) / 2 * CELL; // = 5
	assert( Math.abs( config.offset.x ) === halfShift,
		`2x2 orient=${orient}: |offset.x| should be ${halfShift}, got ${config.offset.x}` );
	assert( Math.abs( config.offset.z ) === halfShift,
		`2x2 orient=${orient}: |offset.z| should be ${halfShift}, got ${config.offset.z}` );
}

// Test 3x3 curve offsets
for ( const orient of [ 0, 10, 16, 22 ] ) {
	const config = getCurveConfig( orient, null, 3 );
	const halfShift = ( 3 - 1 ) / 2 * CELL; // = 10
	assert( Math.abs( config.offset.x ) === halfShift,
		`3x3 orient=${orient}: |offset.x| should be ${halfShift}, got ${config.offset.x}` );
	assert( Math.abs( config.offset.z ) === halfShift,
		`3x3 orient=${orient}: |offset.z| should be ${halfShift}, got ${config.offset.z}` );
}

// Verify offset directions match footprint directions
const config0 = getCurveConfig( 0, null, 3 );
assert( config0.offset.x < 0 && config0.offset.z > 0,
	'Orient 0 (S+W): offset should be (-x, +z)' );
const config16 = getCurveConfig( 16, null, 3 );
assert( config16.offset.x > 0 && config16.offset.z > 0,
	'Orient 16 (S+E): offset should be (+x, +z)' );
const config10 = getCurveConfig( 10, null, 3 );
assert( config10.offset.x > 0 && config10.offset.z < 0,
	'Orient 10 (N+E): offset should be (+x, -z)' );
const config22 = getCurveConfig( 22, null, 3 );
assert( config22.offset.x < 0 && config22.offset.z < 0,
	'Orient 22 (N+W): offset should be (-x, -z)' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 16: Full autodraw — draw an oval track
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 16: Full oval track autodraw ═══' );

clearGrid();
// Oval: 6 wide, 4 tall
// Top:    (1,0)-(2,0)-(3,0)-(4,0)
// TR corner: (5,0)
// Right:  (5,1)-(5,2)-(5,3)
// BR corner: (5,4)
// Bottom: (4,4)-(3,4)-(2,4)-(1,4)
// BL corner: (0,4)
// Left:   (0,3)-(0,2)-(0,1)
// TL corner: (0,0)

const ovalCells = [
	// top row L→R
	[0,0], [1,0], [2,0], [3,0], [4,0], [5,0],
	// right column
	[5,1], [5,2], [5,3], [5,4],
	// bottom row R→L
	[4,4], [3,4], [2,4], [1,4], [0,4],
	// left column
	[0,3], [0,2], [0,1],
];

for ( const [gx, gz] of ovalCells ) {
	placeRoad( gx, gz );
}

// Verify all 4 corners
assertCell( 5, 0, 'trk-corner-1x1', 0, 'Oval: TR corner (5,0) S+W' );
assertCell( 5, 4, 'trk-corner-1x1', 22, 'Oval: BR corner (5,4) N+W' );
assertCell( 0, 4, 'trk-corner-1x1', 10, 'Oval: BL corner (0,4) N+E' );
assertCell( 0, 0, 'trk-corner-1x1', 16, 'Oval: TL corner (0,0) S+E' );

// Verify straights
assertCell( 1, 0, 'trk-straight', 16, 'Oval: top (1,0) E+W' );
assertCell( 5, 2, 'trk-straight', 0, 'Oval: right (5,2) N+S' );
assertCell( 3, 4, 'trk-straight', 16, 'Oval: bottom (3,4) E+W' );
assertCell( 0, 2, 'trk-straight', 0, 'Oval: left (0,2) N+S' );

// Full connectivity audit
let ovalConnErrors = 0;
for ( const [ key, cell ] of grid ) {
	const [ gx, gz ] = key.split( ',' ).map( Number );
	const exits = getCellExits( cell );
	if ( exits & 8 ) {
		const n = grid.get( cellKey( gx, gz - 1 ) );
		if ( !n || !( getCellExits( n ) & 4 ) ) ovalConnErrors++;
	}
	if ( exits & 4 ) {
		const s = grid.get( cellKey( gx, gz + 1 ) );
		if ( !s || !( getCellExits( s ) & 8 ) ) ovalConnErrors++;
	}
	if ( exits & 2 ) {
		const e = grid.get( cellKey( gx + 1, gz ) );
		if ( !e || !( getCellExits( e ) & 1 ) ) ovalConnErrors++;
	}
	if ( exits & 1 ) {
		const w = grid.get( cellKey( gx - 1, gz ) );
		if ( !w || !( getCellExits( w ) & 2 ) ) ovalConnErrors++;
	}
}
assert( ovalConnErrors === 0, `Oval: ${ovalConnErrors} connectivity errors` );

// Check curve detection on corners
const trCorner = grid.get( cellKey( 5, 0 ) );
const brCorner = grid.get( cellKey( 5, 4 ) );
const blCorner = grid.get( cellKey( 0, 4 ) );
const tlCorner = grid.get( cellKey( 0, 0 ) );

// With 4 straights on each arm, corners should detect curves
// Top arm has 4 straights, right arm has 3, bottom has 4, left has 3
// TR (5,0): W arm = 4 straights (1-4,0), S arm = 3 straights (5,1-3) → min(4,3,4) = 3
if ( trCorner.curveSize ) {
	console.log( `  TR corner (5,0): ${trCorner.curveSize}x${trCorner.curveSize} curve detected` );
}
if ( brCorner.curveSize ) {
	console.log( `  BR corner (5,4): ${brCorner.curveSize}x${brCorner.curveSize} curve detected` );
}
if ( blCorner.curveSize ) {
	console.log( `  BL corner (0,4): ${blCorner.curveSize}x${blCorner.curveSize} curve detected` );
}
if ( tlCorner.curveSize ) {
	console.log( `  TL corner (0,0): ${tlCorner.curveSize}x${tlCorner.curveSize} curve detected` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 17: ORIENT_FLIP — finish tile rotation
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 17: ORIENT_FLIP symmetry ═══' );

assert( ORIENT_FLIP[ 0 ] === 10, 'ORIENT_FLIP[0] = 10 (0° → 180°)' );
assert( ORIENT_FLIP[ 10 ] === 0, 'ORIENT_FLIP[10] = 0 (180° → 0°)' );
assert( ORIENT_FLIP[ 16 ] === 22, 'ORIENT_FLIP[16] = 22 (90° → 270°)' );
assert( ORIENT_FLIP[ 22 ] === 16, 'ORIENT_FLIP[22] = 16 (270° → 90°)' );

// Double-flip should return to original
for ( const o of [ 0, 10, 16, 22 ] ) {
	assert( ORIENT_FLIP[ ORIENT_FLIP[ o ] ] === o, `Double flip orient=${o} returns to ${o}` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 18: Model file existence — every tile the editor loads
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 18: Model files exist for all editor tiles ═══' );

const modelsDir = path.join( __dirname, '..', 'models' );

// Replicate getTrackModelConfig logic for standard tileset
const TILE_MODEL_MAP = {
	'trk-straight': 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf',
	'trk-corner-1x1': 'standard-map/kartkids_base_trk_020_trn_90_l_1x1.gltf',
	'trk-finish': 'track-finish.glb',
	'trk-elev-2p5': 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf',
	'trk-elev-5': 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf',
	'trk-ramp-up-2p5': 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf',
	'trk-ramp-up-5': 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf',
	'trk-ramp-down-2p5': 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf',
	'trk-ramp-down-5': 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf',
	'trk-curve-2x2-l': 'standard-map/kartkids_base_trk_080_trn_wide_l_2x2.gltf',
	'trk-curve-3x3-l': 'standard-map/kartkids_base_trk_520_trn_90_l_3x3.gltf',
	'trk-curve-4x4-l': 'standard-map/kartkids_base_trk_530_trn_90_l_4x4.glb',
	'vehicle-truck-red': 'vehicle-truck-red.glb',
};

for ( const [ tileName, modelPath ] of Object.entries( TILE_MODEL_MAP ) ) {
	const fullPath = path.join( modelsDir, modelPath );
	const exists = fs.existsSync( fullPath );
	assert( exists, `Model file missing for ${tileName}: ${modelPath}` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 19: Finish tile behavior
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 19: Finish tile ═══' );

// Finish tile uses trk-finish when resolved as straight, same exits as straight
assert( getCellExits( { type: 'trk-finish', orient: 0 } ) === 12, 'Finish orient=0 → N+S' );
assert( getCellExits( { type: 'trk-finish', orient: 16 } ) === 3, 'Finish orient=16 → E+W' );
assert( getCellExits( { type: 'trk-finish', orient: 10 } ) === 12, 'Finish orient=10 → N+S' );
assert( getCellExits( { type: 'trk-finish', orient: 22 } ) === 3, 'Finish orient=22 → E+W' );

// Finish in a line should still connect
clearGrid();
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-finish', orient: 0, isFinish: true, resolved: true } );
grid.set( cellKey( 5, 6 ), { type: 'trk-straight', orient: 0, resolved: true } );
// North neighbor of finish should see S exit
assert( getConnectivityMask( 5, 4 ) === 4, 'Finish: north neighbor sees S=4' );
// South neighbor of finish should see N exit
assert( getConnectivityMask( 5, 6 ) === 8, 'Finish: south neighbor sees N=8' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 20: Elevation tile exits
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 20: Elevation and ramp tile exits ═══' );

// Elevated tiles are straights — same exit rules apply
const elevTypes = [ 'trk-elev-2p5', 'trk-elev-5', 'trk-ramp-up-2p5', 'trk-ramp-up-5',
                    'trk-ramp-down-2p5', 'trk-ramp-down-5' ];
for ( const t of elevTypes ) {
	assert( getCellExits( { type: t, orient: 0 } ) === 12,
		`${t} orient=0 → N+S (12)` );
	assert( getCellExits( { type: t, orient: 16 } ) === 3,
		`${t} orient=16 → E+W (3)` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 21: Ramp connectivity in elevation group
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 21: Ramp-straight-ramp connectivity ═══' );

// Simulate: ramp-up → elevated flat → ramp-down (N-S axis)
clearGrid();
grid.set( cellKey( 5, 3 ), { type: 'trk-straight', orient: 0, resolved: true } );        // approach
grid.set( cellKey( 5, 4 ), { type: 'trk-ramp-up-2p5', orient: 0, resolved: true } );     // ramp up
grid.set( cellKey( 5, 5 ), { type: 'trk-elev-2p5', orient: 0, elevation: 1, resolved: true } ); // elevated
grid.set( cellKey( 5, 6 ), { type: 'trk-ramp-down-2p5', orient: 10, resolved: true } );  // ramp down (flipped)
grid.set( cellKey( 5, 7 ), { type: 'trk-straight', orient: 0, resolved: true } );        // exit

// All cells should chain N↔S
for ( let gz = 3; gz <= 6; gz++ ) {
	const cell = grid.get( cellKey( 5, gz ) );
	const nextCell = grid.get( cellKey( 5, gz + 1 ) );
	const cellExits = getCellExits( cell );
	const nextExits = getCellExits( nextCell );
	assert( ( cellExits & 4 ) && ( nextExits & 8 ),
		`Ramp chain: (5,${gz})→(5,${gz+1}) connected S↔N` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 22: E-W axis ramp connectivity
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 22: E-W ramp connectivity ═══' );

clearGrid();
grid.set( cellKey( 3, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 4, 5 ), { type: 'trk-ramp-up-5', orient: 16, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-elev-5', orient: 16, elevation: 2, resolved: true } );
grid.set( cellKey( 6, 5 ), { type: 'trk-ramp-down-5', orient: 22, resolved: true } );
grid.set( cellKey( 7, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );

for ( let gx = 3; gx <= 6; gx++ ) {
	const cell = grid.get( cellKey( gx, 5 ) );
	const nextCell = grid.get( cellKey( gx + 1, 5 ) );
	const cellExits = getCellExits( cell );
	const nextExits = getCellExits( nextCell );
	assert( ( cellExits & 2 ) && ( nextExits & 1 ),
		`E-W ramp chain: (${gx},5)→(${gx+1},5) connected E↔W` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 23: All curve sizes — consumed cell counts
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 23: Curve consumed cell counts ═══' );

// Test each corner orient with each curve size
const CORNER_ORIENTS = [
	{ orient: 0, exits: 5, dirs: [ 4, 1 ] },   // S+W
	{ orient: 16, exits: 6, dirs: [ 4, 2 ] },   // S+E
	{ orient: 10, exits: 10, dirs: [ 8, 2 ] },  // N+E
	{ orient: 22, exits: 9, dirs: [ 8, 1 ] },   // N+W
];

for ( const co of CORNER_ORIENTS ) {
	for ( const size of [ 2, 3, 4 ] ) {
		clearGrid();
		const cx = 10, cz = 10;
		// Place corner
		grid.set( cellKey( cx, cz ), { type: 'trk-corner-1x1', orient: co.orient, resolved: true } );

		// Place straights along both exit directions
		for ( const dirBit of co.dirs ) {
			const [ ddx, ddz ] = DIR_DELTA[ dirBit ];
			for ( let i = 1; i <= size; i++ ) {
				grid.set( cellKey( cx + ddx * i, cz + ddz * i ),
					{ type: 'trk-straight', orient: ( dirBit === 8 || dirBit === 4 ) ? 0 : 16, resolved: true } );
			}
		}

		detectCurves( cx, cz );
		const corner = grid.get( cellKey( cx, cz ) );
		assert( corner.curveSize === size,
			`Curve orient=${co.orient} size=${size}: detected curveSize=${corner.curveSize}` );

		const expectedConsumed = ( size - 1 ) * 2;
		const actualConsumed = corner.curveConsumed ? corner.curveConsumed.size : 0;
		assert( actualConsumed === expectedConsumed,
			`Curve orient=${co.orient} size=${size}: consumed=${actualConsumed}, expected=${expectedConsumed}` );
	}
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 24: Curve model names generated correctly
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 24: Curve model name generation ═══' );

// The editor generates model names as: trk-curve-{size}x{size}-{lr}
// lr is always 'l' (getCurveLR always returns 'l')
for ( const size of [ 2, 3, 4 ] ) {
	const modelName = `trk-curve-${size}x${size}-l`;
	assert( TILE_MODEL_MAP[ modelName ] !== undefined,
		`Curve model ${modelName} exists in model map` );
	const fullPath = path.join( modelsDir, TILE_MODEL_MAP[ modelName ] );
	assert( fs.existsSync( fullPath ),
		`Curve model file exists for ${modelName}` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 25: Curve footprint direction matches offset direction
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 25: Curve footprint ↔ offset consistency ═══' );

// Footprint direction from detectCurves must match offset direction from getCurveConfig
const FP_DIRS = {
	0:  { fpDx: -1, fpDz: 1 },   // S+W → extends -x, +z
	16: { fpDx: 1, fpDz: 1 },    // S+E → extends +x, +z
	10: { fpDx: 1, fpDz: -1 },   // N+E → extends +x, -z
	22: { fpDx: -1, fpDz: -1 },  // N+W → extends -x, -z
};

for ( const orient of [ 0, 10, 16, 22 ] ) {
	const config = getCurveConfig( orient, null, 3 );
	const fp = FP_DIRS[ orient ];

	// Offset sign should match footprint direction
	const offsetXSign = Math.sign( config.offset.x );
	const offsetZSign = Math.sign( config.offset.z );
	assert( offsetXSign === fp.fpDx,
		`Orient ${orient}: offset.x sign (${offsetXSign}) matches footprint dx (${fp.fpDx})` );
	assert( offsetZSign === fp.fpDz,
		`Orient ${orient}: offset.z sign (${offsetZSign}) matches footprint dz (${fp.fpDz})` );
}

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 26: Autodraw snake pattern — alternating directions
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 26: Snake pattern autodraw ═══' );

clearGrid();
// Draw a snake: right 4, down 1, left 4, down 1, right 4
const snakeCells = [];
// Row 1: right
for ( let x = 0; x < 4; x++ ) snakeCells.push( [ x, 0 ] );
// Turn down
snakeCells.push( [ 3, 1 ] );
// Row 2: left
for ( let x = 2; x >= 0; x-- ) snakeCells.push( [ x, 1 ] );
// Turn down
snakeCells.push( [ 0, 2 ] );
// Row 3: right
for ( let x = 1; x < 4; x++ ) snakeCells.push( [ x, 2 ] );

for ( const [ gx, gz ] of snakeCells ) {
	placeRoad( gx, gz );
}

// Verify connectivity — where a neighbor exists, exits must be mutual
let snakeErrors = 0;
for ( const [ key, cell ] of grid ) {
	const [ gx, gz ] = key.split( ',' ).map( Number );
	const exits = getCellExits( cell );
	if ( exits & 8 ) {
		const n = grid.get( cellKey( gx, gz - 1 ) );
		if ( n && !( getCellExits( n ) & 4 ) ) snakeErrors++;
	}
	if ( exits & 4 ) {
		const s = grid.get( cellKey( gx, gz + 1 ) );
		if ( s && !( getCellExits( s ) & 8 ) ) snakeErrors++;
	}
	if ( exits & 2 ) {
		const e = grid.get( cellKey( gx + 1, gz ) );
		if ( e && !( getCellExits( e ) & 1 ) ) snakeErrors++;
	}
	if ( exits & 1 ) {
		const w = grid.get( cellKey( gx - 1, gz ) );
		if ( w && !( getCellExits( w ) & 2 ) ) snakeErrors++;
	}
}
assert( snakeErrors === 0, `Snake pattern: ${snakeErrors} connectivity errors` );

// Verify correct piece types at corners
assertCell( 3, 0, 'trk-corner-1x1', 0, 'Snake: TR corner (3,0) S+W' );
assertCell( 0, 1, 'trk-corner-1x1', 10, 'Snake: BL corner (0,1) N+E' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 27: Isolated tile — no neighbors
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 27: Isolated tile ═══' );

clearGrid();
placeRoad( 5, 5 );
assertCell( 5, 5, 'trk-straight', 0, 'Isolated tile: defaults to N+S straight' );
assert( getConnectivityMask( 5, 5 ) === 0, 'Isolated tile: no connectivity' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 28: Curve override — no curve when curveOverride is set
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 28: Curve override prevents curve detection ═══' );

clearGrid();
grid.set( cellKey( 5, 3 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 22, curveOverride: true, resolved: true } );
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 3, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );

detectCurves( 5, 5 );

const overrideCorner = grid.get( cellKey( 5, 5 ) );
assert( overrideCorner.curveSize === undefined,
	'Curve override: curveSize should be undefined (no curve detected)' );

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE 29: Two adjacent curves don't overlap
// ═════════════════════════════════════════════════════════════════════════

console.log( '═══ TEST 29: Adjacent curves — no overlap ═══' );

clearGrid();
// Two L-shapes sharing the middle straight:
// Corner1 at (5,5) orient=22 (N+W): straights at (5,3),(5,4) and (3,5),(4,5)
// Corner2 at (5,7) orient=0 (S+W): straights at (5,8),(5,9) and (3,7),(4,7)
// Both share nothing — they should both get curves

// Corner 1: N+W at (5,5)
grid.set( cellKey( 5, 3 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 4 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 5 ), { type: 'trk-corner-1x1', orient: 22, resolved: true } );
grid.set( cellKey( 4, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 3, 5 ), { type: 'trk-straight', orient: 16, resolved: true } );

// Corner 2: S+W at (5,7)
grid.set( cellKey( 5, 8 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 9 ), { type: 'trk-straight', orient: 0, resolved: true } );
grid.set( cellKey( 5, 7 ), { type: 'trk-corner-1x1', orient: 0, resolved: true } );
grid.set( cellKey( 4, 7 ), { type: 'trk-straight', orient: 16, resolved: true } );
grid.set( cellKey( 3, 7 ), { type: 'trk-straight', orient: 16, resolved: true } );

detectCurves( 5, 5 );

const c1 = grid.get( cellKey( 5, 5 ) );
const c2 = grid.get( cellKey( 5, 7 ) );
assert( c1.curveSize === 2, `Adjacent curves: corner1 has curveSize=2, got ${c1.curveSize}` );
assert( c2.curveSize === 2, `Adjacent curves: corner2 has curveSize=2, got ${c2.curveSize}` );

// Verify no consumed cell overlap
if ( c1.curveConsumed && c2.curveConsumed ) {
	let overlap = false;
	for ( const k of c1.curveConsumed ) {
		if ( c2.curveConsumed.has( k ) ) overlap = true;
	}
	assert( !overlap, 'Adjacent curves: no consumed cell overlap' );
}

// ═════════════════════════════════════════════════════════════════════════
// RESULTS
// ═════════════════════════════════════════════════════════════════════════

console.log( '\n═══════════════════════════════════════════' );
console.log( `RESULTS: ${passed} passed, ${failed} failed` );
console.log( '═══════════════════════════════════════════' );

if ( failures.length > 0 ) {
	console.log( '\nFAILURES:' );
	for ( const f of failures ) {
		console.log( `  ✗ ${f}` );
	}
}

process.exit( failed > 0 ? 1 : 0 );
