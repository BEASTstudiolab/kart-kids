import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';

// ─── Connectivity Table ──────────────────────────────────────
// Each piece type maps to its two open edges at orientation 0 (0°).
// Edges: N = -Z, S = +Z, E = +X, W = -X
// Verified against the default 16-cell track.

const EDGES = { N: [ 0, -1 ], S: [ 0, 1 ], E: [ 1, 0 ], W: [ -1, 0 ] };

// Rotation per 90° step (matches Godot/three.js Y-axis rotation):
// S→E, E→N, N→W, W→S
const ROTATE_STEP = { N: 'W', W: 'S', S: 'E', E: 'N' };

function rotateEdge( edge, degrees ) {

	const steps = ( ( degrees % 360 ) + 360 ) % 360 / 90;
	let e = edge;
	for ( let i = 0; i < steps; i ++ ) e = ROTATE_STEP[ e ];
	return e;

}

// Base connectivity at orientation 0°
const BASE_CONNECTIVITY = {
	'track-straight-night': [ 'N', 'S' ],
	'track-finish':         [ 'N', 'S' ],
	'track-corner-night':   [ 'S', 'W' ],
	'track-bump':           null, // handled specially — all 4 edges open
};

function getOpenEdges( pieceType, godotOrient ) {

	const base = BASE_CONNECTIVITY[ pieceType ];
	if ( base === undefined ) {

		throw new Error( `TrackIntel: Unknown piece type: ${pieceType}` );

	}

	if ( base === null ) return null; // bump — all edges

	const deg = ORIENT_DEG[ godotOrient ] ?? 0;
	return base.map( e => rotateEdge( e, deg ) );

}

// ─── TrackIntel Class ────────────────────────────────────────

export class TrackIntel {

	constructor( cells ) {

		// Build cell lookup by "gx,gz" key
		const cellMap = new Map();
		for ( const cell of cells ) {

			cellMap.set( cell[ 0 ] + ',' + cell[ 1 ], cell );

		}

		// Find finish cell
		let finishCell = null;
		for ( const cell of cells ) {

			if ( cell[ 2 ] === 'track-finish' ) {

				finishCell = cell;
				break;

			}

		}

		if ( ! finishCell ) {

			throw new Error( 'TrackIntel: No track-finish cell found in cells array' );

		}

		// Walk connectivity to produce ordered cell sequence
		const ordered = [];
		let current = finishCell;
		let prevKey = null;

		do {

			ordered.push( current );
			const [ gx, gz, type, orient ] = current;
			const currentKey = gx + ',' + gz;

			const openEdges = getOpenEdges( type, orient );
			let nextCell = null;

			if ( openEdges === null ) {

				// Bump piece — find all existing neighbors that aren't previous
				for ( const dir of [ 'N', 'S', 'E', 'W' ] ) {

					const [ dx, dz ] = EDGES[ dir ];
					const nKey = ( gx + dx ) + ',' + ( gz + dz );
					if ( nKey === prevKey ) continue;

					const neighbor = cellMap.get( nKey );
					if ( ! neighbor ) continue;

					if ( nextCell ) {

						throw new Error(
							`TrackIntel: Ambiguous bump piece at (${gx},${gz}) — multiple non-previous neighbors`
						);

					}

					nextCell = neighbor;

				}

			} else {

				// Normal piece — check open edges
				for ( const edge of openEdges ) {

					const [ dx, dz ] = EDGES[ edge ];
					const nKey = ( gx + dx ) + ',' + ( gz + dz );
					if ( nKey === prevKey ) continue;

					const neighbor = cellMap.get( nKey );
					if ( neighbor ) {

						nextCell = neighbor;
						break;

					}

				}

			}

			if ( ! nextCell && ordered.length < cells.length ) {

				throw new Error(
					`TrackIntel: Connectivity broken at (${gx},${gz}) — no valid neighbor found`
				);

			}

			prevKey = currentKey;
			current = nextCell;

		} while ( current && current !== finishCell );

		// Validate completeness
		if ( ordered.length !== cells.length ) {

			const reachedKeys = new Set( ordered.map( c => c[ 0 ] + ',' + c[ 1 ] ) );
			const unreached = cells
				.filter( c => ! reachedKeys.has( c[ 0 ] + ',' + c[ 1 ] ) )
				.map( c => `(${c[ 0 ]},${c[ 1 ]})` );
			throw new Error(
				`TrackIntel: Walk covered ${ordered.length}/${cells.length} cells. Unreached: ${unreached.join( ', ' )}`
			);

		}

		// Convert to world-space waypoints
		this.waypoints = ordered.map( ( [ gx, gz ] ) => ( {
			x: ( gx + 0.5 ) * CELL_RAW * GRID_SCALE,
			z: ( gz + 0.5 ) * CELL_RAW * GRID_SCALE
		} ) );

		this.count = this.waypoints.length;

		// Precompute cumulative distances and total loop length
		this._cumDist = new Float64Array( this.count );
		this._cumDist[ 0 ] = 0;

		for ( let i = 1; i < this.count; i ++ ) {

			const prev = this.waypoints[ i - 1 ];
			const curr = this.waypoints[ i ];
			const dx = curr.x - prev.x;
			const dz = curr.z - prev.z;
			this._cumDist[ i ] = this._cumDist[ i - 1 ] + Math.sqrt( dx * dx + dz * dz );

		}

		// Closing segment: last waypoint → first waypoint
		const last = this.waypoints[ this.count - 1 ];
		const first = this.waypoints[ 0 ];
		const closeDx = first.x - last.x;
		const closeDz = first.z - last.z;
		this.totalLength = this._cumDist[ this.count - 1 ] + Math.sqrt( closeDx * closeDx + closeDz * closeDz );

	}

	// ─── Track Progress (R4, R5) ─────────────────────────────

	/**
	 * Returns 0.0–1.0 progress along the track for a world position.
	 * Optional lastSegmentHint constrains search to a +/- 3 window first.
	 */
	getProgress( worldX, worldZ, lastSegmentHint ) {

		const n = this.count;
		let bestDist = Infinity;
		let bestProgress = 0;

		const searchWindow = ( lastSegmentHint !== undefined && lastSegmentHint !== null );
		const windowSize = 3;

		// Try windowed search first
		if ( searchWindow ) {

			for ( let offset = -windowSize; offset <= windowSize; offset ++ ) {

				const i = ( ( lastSegmentHint + offset ) % n + n ) % n;
				const result = this._projectOntoSegment( worldX, worldZ, i );

				if ( result.dist < bestDist ) {

					bestDist = result.dist;
					bestProgress = result.progress;

				}

			}

			// If we found something reasonably close, use it
			if ( bestDist < this.totalLength * 0.15 ) {

				return bestProgress;

			}

		}

		// Full scan fallback
		bestDist = Infinity;
		bestProgress = 0;

		for ( let i = 0; i < n; i ++ ) {

			const result = this._projectOntoSegment( worldX, worldZ, i );

			if ( result.dist < bestDist ) {

				bestDist = result.dist;
				bestProgress = result.progress;

			}

		}

		return bestProgress;

	}

	/**
	 * Returns lap + progress for position ranking.
	 * Lap count is caller-provided (from RaceMode).
	 */
	getRaceProgress( lap, worldX, worldZ, lastSegmentHint ) {

		return lap + this.getProgress( worldX, worldZ, lastSegmentHint );

	}

	// ─── Spatial Queries (R6, R7, R8) ────────────────────────

	/**
	 * Returns the index of the nearest waypoint to a world position (XZ distance).
	 */
	getNearestWaypoint( worldX, worldZ ) {

		let bestIdx = 0;
		let bestDist = Infinity;

		for ( let i = 0; i < this.count; i ++ ) {

			const w = this.waypoints[ i ];
			const dx = w.x - worldX;
			const dz = w.z - worldZ;
			const d = dx * dx + dz * dz;

			if ( d < bestDist ) {

				bestDist = d;
				bestIdx = i;

			}

		}

		return bestIdx;

	}

	/**
	 * Returns { position: {x, z}, forward: {x, z} } for a waypoint index.
	 * Forward direction points toward the next waypoint in racing order.
	 */
	getWaypointInfo( index ) {

		const w = this.waypoints[ index ];
		const next = this.waypoints[ ( index + 1 ) % this.count ];

		const dx = next.x - w.x;
		const dz = next.z - w.z;
		const len = Math.sqrt( dx * dx + dz * dz );

		return {
			position: { x: w.x, z: w.z },
			forward: len > 0 ? { x: dx / len, z: dz / len } : { x: 0, z: 1 }
		};

	}

	/**
	 * Returns an array of `count` evenly-spaced positions along the track loop.
	 * Each entry: { x, z, forward: {x, z} }
	 */
	getDistributedPositions( count ) {

		const positions = [];
		const n = this.count;

		for ( let i = 0; i < count; i ++ ) {

			const targetDist = this.totalLength * i / count;

			// Find which segment this distance falls on
			let segIdx = 0;

			for ( let s = 0; s < n; s ++ ) {

				const nextS = ( s + 1 ) % n;
				const segStart = this._cumDist[ s ];
				const segEnd = ( nextS === 0 ) ? this.totalLength : this._cumDist[ nextS ];

				if ( targetDist >= segStart && targetDist < segEnd ) {

					segIdx = s;
					break;

				}

			}

			const segStart = this._cumDist[ segIdx ];
			const a = this.waypoints[ segIdx ];
			const b = this.waypoints[ ( segIdx + 1 ) % n ];

			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const segLen = Math.sqrt( dx * dx + dz * dz );

			const t = segLen > 0 ? ( targetDist - segStart ) / segLen : 0;

			const fx = segLen > 0 ? dx / segLen : 0;
			const fz = segLen > 0 ? dz / segLen : 1;

			positions.push( {
				x: a.x + dx * t,
				z: a.z + dz * t,
				forward: { x: fx, z: fz }
			} );

		}

		return positions;

	}

	// ─── Internal Helpers ────────────────────────────────────

	_projectOntoSegment( worldX, worldZ, segIndex ) {

		const n = this.count;
		const a = this.waypoints[ segIndex ];
		const b = this.waypoints[ ( segIndex + 1 ) % n ];

		const abx = b.x - a.x;
		const abz = b.z - a.z;
		const apx = worldX - a.x;
		const apz = worldZ - a.z;

		const abLenSq = abx * abx + abz * abz;

		let t = 0;

		if ( abLenSq > 0 ) {

			t = ( apx * abx + apz * abz ) / abLenSq;
			t = Math.max( 0, Math.min( 1, t ) );

		}

		// Closest point on segment
		const cx = a.x + abx * t;
		const cz = a.z + abz * t;

		const dx = worldX - cx;
		const dz = worldZ - cz;
		const dist = Math.sqrt( dx * dx + dz * dz );

		// Compute progress
		const segLen = Math.sqrt( abLenSq );
		const cumAtSeg = this._cumDist[ segIndex ];
		const progressDist = cumAtSeg + segLen * t;
		const progress = this.totalLength > 0 ? ( progressDist / this.totalLength ) % 1 : 0;

		return { dist, progress };

	}

}
