import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';

// ─── Connectivity Table ──────────────────────────────────────
// Each piece type maps to its two open edges at orientation 0 (0°).
// Edges: N = -Z, S = +Z, E = +X, W = -X
// Verified against the default 16-cell track.

const EDGES = { N: [ 0, -1 ], S: [ 0, 1 ], E: [ 1, 0 ], W: [ -1, 0 ] };

// Rotation per 90° step (Y-axis rotation):
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
	'trk-straight': [ 'N', 'S' ],
	'trk-finish':         [ 'N', 'S' ],
	'trk-corner-1x1':   [ 'S', 'W' ],

	// Multi-tile curves — same corner connectivity
	'trk-curve-2x2-l':      [ 'S', 'W' ],
	'trk-curve-3x3-l':      [ 'S', 'W' ],
	'trk-curve-3x3-wide-l': [ 'S', 'W' ],

	// Elevation tiles — same connectivity as straights
	'trk-elev-2p5':       [ 'N', 'S' ],
	'trk-elev-5':         [ 'N', 'S' ],
	'trk-ramp-up-2p5':    [ 'N', 'S' ],
	'trk-ramp-up-5':      [ 'N', 'S' ],
	'trk-ramp-down-2p5':  [ 'N', 'S' ],
	'trk-ramp-down-5':    [ 'N', 'S' ],

	// Smooth ramp variants — same connectivity
	'trk-ramp-up-2p5-smooth':    [ 'N', 'S' ],
	'trk-ramp-up-5-smooth':      [ 'N', 'S' ],
	'trk-ramp-down-2p5-smooth':  [ 'N', 'S' ],
	'trk-ramp-down-5-smooth':    [ 'N', 'S' ],

	// Bridge tiles — straight-through
	'trk-bridge-entry':  [ 'N', 'S' ],
	'trk-bridge-mid':    [ 'N', 'S' ],

	// Tunnel tiles — straight-through
	'trk-tunnel-entry':  [ 'N', 'S' ],
	'trk-tunnel-mid':    [ 'N', 'S' ],
	'trk-tunnel-exit':   [ 'N', 'S' ],
	'trk-tunnel-open':   [ 'N', 'S' ],

	// Jump tiles — straight-through
	'trk-jump-short':    [ 'N', 'S' ],
	'trk-jump-long':     [ 'N', 'S' ],

	// Chicane — straight-through (S-curve within one cell)
	'trk-chicane-3x3-l': [ 'N', 'S' ],

	// Junctions — 3+ exits, incompatible with linear walk.
	// Use null (bump behavior): scan all neighbors, skip previous.
	'trk-junction-y':    null,
	'trk-junction-t':    null,
	'trk-junction-4way': null,
};

function getOpenEdges( pieceType, cellOrient ) {

	const base = BASE_CONNECTIVITY[ pieceType ];
	if ( base === undefined ) {

		console.warn( `TrackIntel: Unknown piece type: ${pieceType} — returning null` );
		return null;

	}

	if ( base === null ) return null; // bump — all edges

	const deg = ORIENT_DEG[ cellOrient ] ?? 0;
	return base.map( e => rotateEdge( e, deg ) );

}

// ─── TrackIntel Class ────────────────────────────────────────

export class TrackIntel {

	constructor( cells ) {

		this.valid = true;
		this.error = null;

		// Build cell lookup by "gx,gz" key
		const cellMap = new Map();
		for ( const cell of cells ) {

			cellMap.set( cell[ 0 ] + ',' + cell[ 1 ], cell );

		}

		// Find finish cell
		let finishCell = null;
		for ( const cell of cells ) {

			if ( cell[ 2 ] === 'trk-finish' ) {

				finishCell = cell;
				break;

			}

		}

		if ( ! finishCell ) {

			this._setInvalid( 'No trk-finish cell found in cells array' );
			return;

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

						this._setInvalid( `Ambiguous bump piece at (${gx},${gz}) — multiple non-previous neighbors` );
						return;

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

				this._setInvalid( `Connectivity broken at (${gx},${gz}) — no valid neighbor found` );
				return;

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
			this._setInvalid( `Walk covered ${ordered.length}/${cells.length} cells. Unreached: ${unreached.join( ', ' )}` );
			return;

		}

		// Store ordered cells for checkpoint anchor tile-type lookup
		this._orderedCells = ordered;

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

	// ─── Checkpoint Anchors ─────────────────────────────────

	/**
	 * Returns an array of checkpoint anchors for respawn positioning.
	 * One anchor every `interval` waypoints, plus forced anchors after
	 * ramp-down / jump tiles (safe landing zones).
	 *
	 * Each anchor: { x, z, forward: {x,z}, waypointIndex, progress }
	 */
	getCheckpointAnchors( interval = 4 ) {

		if ( ! this.valid || this.count === 0 ) return [];

		const anchors = [];
		const added = new Set();

		// Ramp/jump tile types that warrant a forced checkpoint after them
		const RAMP_EXIT_TYPES = new Set( [
			'trk-ramp-down-2p5', 'trk-ramp-down-5',
			'trk-ramp-down-2p5-smooth', 'trk-ramp-down-5-smooth',
			'trk-jump-short', 'trk-jump-long',
		] );

		const addAnchor = ( idx ) => {

			if ( added.has( idx ) ) return;
			added.add( idx );

			const info = this.getWaypointInfo( idx );
			anchors.push( {
				x: info.position.x,
				z: info.position.z,
				forward: info.forward,
				waypointIndex: idx,
				progress: this.totalLength > 0
					? this._cumDist[ idx ] / this.totalLength
					: 0,
			} );

		};

		for ( let i = 0; i < this.count; i ++ ) {

			// Regular interval checkpoints
			if ( i % interval === 0 ) addAnchor( i );

			// Forced anchors: the cell after a ramp exit / jump landing
			if ( this._orderedCells ) {

				const cell = this._orderedCells[ i ];
				if ( cell && RAMP_EXIT_TYPES.has( cell[ 2 ] ) ) {

					// Add the next waypoint as a safe respawn point
					const nextIdx = ( i + 1 ) % this.count;
					addAnchor( nextIdx );

				}

			}

		}

		// Sort by progress for binary search in getNearestCheckpointBehind
		anchors.sort( ( a, b ) => a.progress - b.progress );

		return anchors;

	}

	/**
	 * Returns the checkpoint anchor just behind (or at) the given progress.
	 * Progress is 0.0–1.0. Returns null if no anchors exist.
	 */
	getNearestCheckpointBehind( progress ) {

		if ( ! this._checkpointCache ) {

			this._checkpointCache = this.getCheckpointAnchors();

		}

		const anchors = this._checkpointCache;
		if ( anchors.length === 0 ) return null;

		// Binary search for the last anchor with progress <= input
		let lo = 0, hi = anchors.length - 1;
		let best = anchors[ anchors.length - 1 ]; // wrap-around default

		while ( lo <= hi ) {

			const mid = ( lo + hi ) >> 1;

			if ( anchors[ mid ].progress <= progress ) {

				best = anchors[ mid ];
				lo = mid + 1;

			} else {

				hi = mid - 1;

			}

		}

		return best;

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

	_setInvalid( reason ) {

		console.warn( `TrackIntel: ${reason}` );
		this.valid = false;
		this.error = reason;
		this.waypoints = [];
		this._orderedCells = [];
		this.count = 0;
		this._cumDist = new Float64Array( 0 );
		this.totalLength = 0;

	}

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
