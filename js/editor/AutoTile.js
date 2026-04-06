// ─── Auto-tile Resolve Logic ─────────────────────────────────────────
// All functions receive `grid` (Map<string, cell>) as first param.

import { AUTOTILE, DIR_INFO, cellKey } from './EditorState.js';

// ─── Exit bitmask ────────────────────────────────────────────────────
// Bits: N=8 S=4 E=2 W=1

export function getCellExits( cell ) {

	const t = cell.type;
	const o = cell.orient;

	if ( t === 'trk-corner-1x1' ) {

		if ( o === 0 ) return 5;    // S+W
		if ( o === 16 ) return 6;   // S+E
		if ( o === 10 ) return 10;  // N+E
		if ( o === 22 ) return 9;   // N+W

	}

	// Straight, finish, bump — all symmetric
	if ( o === 0 || o === 10 ) return 12; // N+S
	return 3; // E+W

}

// Check which neighbors have a road exit facing toward this cell
export function getConnectivityMask( grid, gx, gz ) {

	let mask = 0;

	// N neighbor has S exit?
	const n = grid.get( cellKey( gx, gz - 1 ) );
	if ( n && ( getCellExits( n ) & 4 ) ) mask |= 8;

	// S neighbor has N exit?
	const s = grid.get( cellKey( gx, gz + 1 ) );
	if ( s && ( getCellExits( s ) & 8 ) ) mask |= 4;

	// E neighbor has W exit?
	const e = grid.get( cellKey( gx + 1, gz ) );
	if ( e && ( getCellExits( e ) & 1 ) ) mask |= 2;

	// W neighbor has E exit?
	const w = grid.get( cellKey( gx - 1, gz ) );
	if ( w && ( getCellExits( w ) & 2 ) ) mask |= 1;

	return mask;

}

// Raw presence mask (any road in adjacent cell)
function getPresenceMask( grid, gx, gz ) {

	let mask = 0;
	if ( grid.has( cellKey( gx, gz - 1 ) ) ) mask |= 8;
	if ( grid.has( cellKey( gx, gz + 1 ) ) ) mask |= 4;
	if ( grid.has( cellKey( gx + 1, gz ) ) ) mask |= 2;
	if ( grid.has( cellKey( gx - 1, gz ) ) ) mask |= 1;
	return mask;

}

// Count bits in a 4-bit mask
export function bitCount( mask ) {

	return ( mask >> 3 & 1 ) + ( mask >> 2 & 1 ) + ( mask >> 1 & 1 ) + ( mask & 1 );

}

// Count how many of a cell's exits are connected to neighbors
function connectedExitCount( grid, gx, gz ) {

	const cell = grid.get( cellKey( gx, gz ) );
	if ( ! cell ) return 0;
	return bitCount( getCellExits( cell ) & getConnectivityMask( grid, gx, gz ) );

}

// When a new cell has 3+ neighbors, pick the best pair to connect.
// Prefer corners over straights, then prefer neighbors with more existing connections.
function pickBestPair( grid, mask, gx, gz ) {

	const active = DIR_INFO.filter( d => mask & d.bit );
	if ( active.length <= 2 ) return mask;

	let bestMask = active[ 0 ].bit | active[ 1 ].bit;
	let bestScore = - 1;
	let bestIsCorner = false;

	for ( let i = 0; i < active.length; i ++ ) {

		for ( let j = i + 1; j < active.length; j ++ ) {

			const pairMask = active[ i ].bit | active[ j ].bit;
			const isCorner = ( pairMask !== 3 && pairMask !== 12 ); // not E+W or N+S

			const s1 = connectedExitCount( grid, gx + active[ i ].dx, gz + active[ i ].dz );
			const s2 = connectedExitCount( grid, gx + active[ j ].dx, gz + active[ j ].dz );
			const score = s1 + s2;

			if ( ( isCorner && ! bestIsCorner ) ||
				( isCorner === bestIsCorner && score > bestScore ) ) {

				bestMask = pairMask;
				bestScore = score;
				bestIsCorner = isCorner;

			}

		}

	}

	return bestMask;

}

// Only count neighbors that can actually connect:
// either they already exit toward us, or they have a free (unconnected) exit
function getAvailableMask( grid, gx, gz ) {

	let mask = 0;
	const dirs = [
		[ 0, - 1, 8, 4 ], // N neighbor, sets N bit, check if neighbor has S exit
		[ 0, 1, 4, 8 ],   // S neighbor, sets S bit, check if neighbor has N exit
		[ 1, 0, 2, 1 ],   // E neighbor, sets E bit, check if neighbor has W exit
		[ - 1, 0, 1, 2 ], // W neighbor, sets W bit, check if neighbor has E exit
	];

	for ( const [ dx, dz, bit, oppBit ] of dirs ) {

		const neighbor = grid.get( cellKey( gx + dx, gz + dz ) );
		if ( ! neighbor ) continue;

		const exits = getCellExits( neighbor );

		// Already has an exit facing us
		if ( exits & oppBit ) { mask |= bit; continue; }

		// Has a free (unconnected) exit — could change to face us
		const conn = getConnectivityMask( grid, gx + dx, gz + dz );
		if ( bitCount( exits & conn ) < 2 ) mask |= bit;

	}

	return mask;

}

// Resolve tile for new cells: use available neighbors, pick best pair if 3+
export function resolveNewTile( grid, gx, gz ) {

	const pMask = getAvailableMask( grid, gx, gz );

	if ( bitCount( pMask ) >= 3 ) {

		return AUTOTILE[ pickBestPair( grid, pMask, gx, gz ) ];

	}

	return AUTOTILE[ pMask ];

}

export function resolveTile( grid, gx, gz ) {

	const cMask = getConnectivityMask( grid, gx, gz );

	// If any neighbor connects toward us, use connectivity-based auto-tile
	if ( cMask !== 0 ) return AUTOTILE[ cMask ];

	// No neighbor connects toward us — orient parallel to nearest road
	const pMask = getPresenceMask( grid, gx, gz );
	if ( pMask !== 0 ) {

		// Find any adjacent road cell and match its direction
		const dirs = [ [ 0, - 1, 8 ], [ 0, 1, 4 ], [ 1, 0, 2 ], [ - 1, 0, 1 ] ];
		for ( const [ dx, dz, bit ] of dirs ) {

			if ( ! ( pMask & bit ) ) continue;
			const neighbor = grid.get( cellKey( gx + dx, gz + dz ) );
			if ( ! neighbor ) continue;

			const exits = getCellExits( neighbor );
			// Match the neighbor's running direction
			if ( exits & 12 ) return [ 'trk-straight', 0 ];  // neighbor runs N-S
			if ( exits & 3 ) return [ 'trk-straight', 16 ];  // neighbor runs E-W

		}

	}

	return AUTOTILE[ 0 ]; // isolated default

}
