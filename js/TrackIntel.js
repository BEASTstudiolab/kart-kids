import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';
import {
	TRACK_INTEL_BASE_CONNECTIVITY,
	getCurveVariantSize,
	normalizeLegacyTrackIntelCells,
} from './TrackOrientation.js';
import {
	getCurveBlockTemplateWaypoints,
	getTemplateWaypoints,
	transformToWorld,
} from './WaypointTemplates.js';

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

const BASE_CONNECTIVITY = TRACK_INTEL_BASE_CONNECTIVITY;

// Map grid delta (dx, dz) to edge direction
function _deltaToEdge( dx, dz ) {

	if ( dz === - 1 ) return 'N';
	if ( dz === 1 ) return 'S';
	if ( dx === 1 ) return 'E';
	if ( dx === - 1 ) return 'W';
	return 'N'; // fallback

}

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

function isCurveArmType( type ) {

	return type === 'trk-straight' || type.startsWith( 'trk-elev-' );

}

// ─── TrackIntel Class ────────────────────────────────────────

export class TrackIntel {

	constructor( cells ) {

		this.valid = true;
		this.error = null;
		const normalizedCells = normalizeLegacyTrackIntelCells( cells );

		// Build cell lookup by "gx,gz" key
		const cellMap = new Map();
		for ( const cell of normalizedCells ) {

			cellMap.set( cell[ 0 ] + ',' + cell[ 1 ], cell );

		}

		// Find finish cell
		let finishCell = null;
		for ( const cell of normalizedCells ) {

			if ( cell[ 2 ] === 'trk-finish' ) {

				finishCell = cell;
				break;

			}

		}

		if ( ! finishCell ) {

			this._setInvalid( 'No trk-finish cell found in cells array' );
			return;

		}

		// Walk connectivity to produce ordered cell sequence + track entry/exit edges
		const ordered = [];
		const exitEdges = [];   // exitEdges[i] = edge we leave cell i through
		const entryEdges = [];  // entryEdges[i] = edge we enter cell i from
		let current = finishCell;
		let prevKey = null;

		do {

			const idx = ordered.length;
			ordered.push( current );
			const [ gx, gz, type, orient ] = current;
			const currentKey = gx + ',' + gz;

			// Determine entry edge (direction toward previous cell)
			if ( prevKey !== null ) {

				const [ px, pz ] = prevKey.split( ',' ).map( Number );
				const dx = px - gx;
				const dz = pz - gz;
				entryEdges[ idx ] = _deltaToEdge( dx, dz );

			}

			const openEdges = getOpenEdges( type, orient );
			let nextCell = null;
			let exitEdge = null;

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
					exitEdge = dir;

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
						exitEdge = edge;
						break;

					}

				}

			}

			exitEdges[ idx ] = exitEdge;

			if ( ! nextCell ) {

				// Report the exact tile and edges where the walk broke
				const _edges = openEdges || [ 'N', 'S', 'E', 'W' ];
				const _edgeDetails = _edges.map( e => {

					const [ _dx, _dz ] = EDGES[ e ];
					const _nk = ( gx + _dx ) + ',' + ( gz + _dz );
					return `${e}→${cellMap.has( _nk ) ? 'occupied' : 'empty'}`;

				} ).join( ', ' );
				this._deadEndInfo = `Dead end at (${gx},${gz}) type=${type} orient=${orient}: edges [${_edgeDetails}]`;
				break;

			}

			prevKey = currentKey;
			current = nextCell;

		} while ( current && current !== finishCell );

		// The walk must form a closed loop (returned to finish) with at least 4 tiles
		if ( ordered.length < 4 || ( current !== finishCell ) ) {

			const visited = ordered.length;
			const total = normalizedCells.length;
			if ( visited < total ) {

				const msg = this._deadEndInfo || `Walk stopped after ${visited}/${total} cells`;
				this._setInvalid( msg );

			} else {

				this._setInvalid( 'Track does not form a closed loop' );

			}

			return;

		}

		// Fix circular entry/exit: first cell's entry = last cell's exit direction
		// (the track loops back)
		const lastCell = ordered[ ordered.length - 1 ];
		const firstCell = ordered[ 0 ];
		const dxLast = lastCell[ 0 ] - firstCell[ 0 ];
		const dzLast = lastCell[ 1 ] - firstCell[ 1 ];
		entryEdges[ 0 ] = _deltaToEdge( dxLast, dzLast );

		// Store ordered cells for checkpoint anchor tile-type lookup
		this._orderedCells = ordered;

		// ── Generate sub-tile waypoints from templates ────────────
		this.waypoints = [];
		this._waypointToCellIndex = [];
		this._buildWaypoints( ordered, entryEdges, exitEdges );
		this._rebuildRouteCache();

	}

	_buildWaypoints( ordered, entryEdges, exitEdges ) {

		const curveBlocksByStart = this._buildCurveBlocks( ordered, entryEdges, exitEdges );

		for ( let i = 0; i < ordered.length; ) {

			const block = curveBlocksByStart.get( i );
			if ( block ) {

				const worldPts = this._buildCurveBlockWorldPoints( ordered, block );
				this._appendWorldPoints( worldPts, block.anchorIndex );
				i = block.endIndex + 1;
				continue;

			}

			const worldPts = this._buildCellWorldPoints( ordered, entryEdges, exitEdges, i );
			this._appendWorldPoints( worldPts, i );
			i ++;

		}

	}

	_buildCurveBlocks( ordered, entryEdges, exitEdges ) {

		const blocksByStart = new Map();
		const claimed = new Set();

		for ( let i = 0; i < ordered.length; i ++ ) {

			const block = this._createCurveBlock( ordered, entryEdges, exitEdges, i );
			if ( ! block ) continue;

			let overlaps = false;
			for ( let idx = block.startIndex; idx <= block.endIndex; idx ++ ) {

				if ( claimed.has( idx ) ) {

					overlaps = true;
					break;

				}

			}

			if ( overlaps ) continue;

			for ( let idx = block.startIndex; idx <= block.endIndex; idx ++ ) {

				claimed.add( idx );

			}

			blocksByStart.set( block.startIndex, block );

		}

		return blocksByStart;

	}

	_createCurveBlock( ordered, entryEdges, exitEdges, anchorIndex ) {

		const [ gx, gz, type, orient, flags ] = ordered[ anchorIndex ];
		const curveVariant = flags?.curveVariant;
		const curveSize = getCurveVariantSize( curveVariant );
		if ( type !== 'trk-corner-1x1' || curveSize < 2 ) return null;

		const startIndex = anchorIndex - ( curveSize - 1 );
		const endIndex = anchorIndex + ( curveSize - 1 );
		if ( startIndex < 0 || endIndex >= ordered.length ) return null;

		for ( let i = startIndex; i < anchorIndex; i ++ ) {

			if ( ! isCurveArmType( ordered[ i ][ 2 ] ) ) return null;

		}

		for ( let i = anchorIndex + 1; i <= endIndex; i ++ ) {

			if ( ! isCurveArmType( ordered[ i ][ 2 ] ) ) return null;

		}

		const orientDeg = ORIENT_DEG[ orient ] ?? 0;
		const entry = entryEdges[ anchorIndex ];
		const exit = exitEdges[ anchorIndex ];
		const localPts = getCurveBlockTemplateWaypoints( curveVariant, entry, exit, orientDeg );
		if ( ! localPts || localPts.length === 0 ) return null;

		const entryY = this._getCellSurfaceY( ordered[ startIndex ] );
		const exitY = this._getCellSurfaceY( ordered[ endIndex ] );

		return {
			anchorIndex,
			startIndex,
			endIndex,
			gx,
			gz,
			orientDeg,
			entryY,
			exitY,
			localPts,
		};

	}

	_buildCurveBlockWorldPoints( ordered, block ) {

		return transformToWorld(
			block.localPts,
			block.gx,
			block.gz,
			block.orientDeg,
			block.entryY,
			block.exitY
		);

	}

	_buildCellWorldPoints( ordered, entryEdges, exitEdges, index ) {

		const [ gx, gz, type, orient, flags ] = ordered[ index ];
		const orientDeg = ORIENT_DEG[ orient ] ?? 0;
		const entry = entryEdges[ index ];
		const exit = exitEdges[ index ];

		let entryY = this._getCellSurfaceY( ordered[ index ] );
		let exitY = entryY;

		if ( type.includes( 'ramp' ) ) {

			const prevIdx = ( index - 1 + ordered.length ) % ordered.length;
			const nextIdx = ( index + 1 ) % ordered.length;
			entryY = this._getCellSurfaceY( ordered[ prevIdx ] );
			exitY = this._getCellSurfaceY( ordered[ nextIdx ] );

		}

		const localPts = getTemplateWaypoints( type, entry, exit, orientDeg );
		return transformToWorld( localPts, gx, gz, orientDeg, entryY, exitY );

	}

	_appendWorldPoints( worldPts, cellIndex ) {

		const startIdx = this.waypoints.length === 0 ? 0 : 1;

		for ( let j = startIdx; j < worldPts.length; j ++ ) {

			this.waypoints.push( worldPts[ j ] );
			this._waypointToCellIndex.push( cellIndex );

		}

	}

	_getCellSurfaceY( cell ) {

		const thisElev = cell?.[ 4 ]?.fullElevation ?? 12;
		return ( thisElev - 12 ) * 2.5;

	}

	_rebuildRouteCache() {

		this.count = this.waypoints.length;
		this._checkpointCache = null;
		this._segmentInfo = [];

		if ( this.count === 0 ) {

			this._cumDist = new Float64Array( 0 );
			this.totalLength = 0;
			return;

		}

		this._cumDist = new Float64Array( this.count );
		this._cumDist[ 0 ] = 0;

		for ( let i = 1; i < this.count; i ++ ) {

			const prev = this.waypoints[ i - 1 ];
			const curr = this.waypoints[ i ];
			const dx = curr.x - prev.x;
			const dz = curr.z - prev.z;
			this._cumDist[ i ] = this._cumDist[ i - 1 ] + Math.sqrt( dx * dx + dz * dz );

		}

		for ( let i = 0; i < this.count; i ++ ) {

			const a = this.waypoints[ i ];
			const b = this.waypoints[ ( i + 1 ) % this.count ];
			const dx = b.x - a.x;
			const dy = ( b.y || 0 ) - ( a.y || 0 );
			const dz = b.z - a.z;
			const length = Math.sqrt( dx * dx + dz * dz );
			const forward = length > 0
				? { x: dx / length, z: dz / length }
				: { x: 0, z: 1 };

			this._segmentInfo.push( {
				index: i,
				startDist: this._cumDist[ i ],
				length,
				forward,
				curvature: 0,
				from: a,
				to: b,
				deltaY: dy,
			} );

		}

		const lastSeg = this._segmentInfo[ this._segmentInfo.length - 1 ];
		this.totalLength = lastSeg.startDist + lastSeg.length;

		for ( let i = 0; i < this._segmentInfo.length; i ++ ) {

			const curr = this._segmentInfo[ i ];
			const next = this._segmentInfo[ ( i + 1 ) % this._segmentInfo.length ];
			const dot = Math.max( - 1, Math.min( 1, curr.forward.x * next.forward.x + curr.forward.z * next.forward.z ) );
			const cross = curr.forward.x * next.forward.z - curr.forward.z * next.forward.x;
			const signedAngle = Math.atan2( cross, dot );
			const avgLen = Math.max( ( curr.length + next.length ) * 0.5, 1e-6 );
			curr.curvature = signedAngle / avgLen;

		}

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

		// Scale interval by average waypoints-per-cell so spacing stays
		// roughly the same as before (when there was 1 wp per cell).
		const wpPerCell = this._orderedCells.length > 0
			? this.count / this._orderedCells.length
			: 1;
		const scaledInterval = Math.max( 1, Math.round( interval * wpPerCell ) );

		let lastCheckedCellIdx = - 1;

		for ( let i = 0; i < this.count; i ++ ) {

			// Regular interval checkpoints (scaled for denser waypoints)
			if ( i % scaledInterval === 0 ) addAnchor( i );

			// Forced anchors: the cell after a ramp exit / jump landing
			if ( this._orderedCells && this._waypointToCellIndex ) {

				const cellIdx = this._waypointToCellIndex[ i ];
				if ( cellIdx !== lastCheckedCellIdx ) {

					lastCheckedCellIdx = cellIdx;
					const cell = this._orderedCells[ cellIdx ];
					if ( cell && RAMP_EXIT_TYPES.has( cell[ 2 ] ) ) {

						// Add the next waypoint as a safe respawn point
						const nextIdx = ( i + 1 ) % this.count;
						addAnchor( nextIdx );

					}

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

		return this.projectToRoute( worldX, worldZ, lastSegmentHint )?.progress ?? 0;

	}

	/**
	 * Returns lap + progress for position ranking.
	 * Lap count is caller-provided (from RaceMode).
	 */
	getRaceProgress( lap, worldX, worldZ, lastSegmentHint ) {

		return lap + this.getProgress( worldX, worldZ, lastSegmentHint );

	}

	projectToRoute( worldX, worldZ, lastSegmentHint ) {

		if ( this.count === 0 || this.totalLength <= 0 ) return null;

		let best = null;
		const searchWindow = lastSegmentHint !== undefined && lastSegmentHint !== null;
		const windowSize = 8;

		if ( searchWindow ) {

			for ( let offset = -windowSize; offset <= windowSize; offset ++ ) {

				const i = ( ( lastSegmentHint + offset ) % this.count + this.count ) % this.count;
				const candidate = this._projectOntoSegmentDetailed( worldX, worldZ, i );
				if ( ! best || candidate.distanceFromRoute < best.distanceFromRoute ) {

					best = candidate;

				}

			}

			if ( best && best.distanceFromRoute < 30 ) return best;

		}

		for ( let i = 0; i < this.count; i ++ ) {

			const candidate = this._projectOntoSegmentDetailed( worldX, worldZ, i );
			if ( ! best || candidate.distanceFromRoute < best.distanceFromRoute ) {

				best = candidate;

			}

		}

		return best;

	}

	sampleRoute( distanceAlongTrack, lateralOffset = 0 ) {

		if ( this.count === 0 || this.totalLength <= 0 ) return null;

		const normalizedDistance = this._normalizeDistance( distanceAlongTrack );
		const segIndex = this._findSegmentIndexByDistance( normalizedDistance );
		const seg = this._segmentInfo[ segIndex ];
		const t = seg.length > 0
			? Math.max( 0, Math.min( 1, ( normalizedDistance - seg.startDist ) / seg.length ) )
			: 0;

		const baseX = seg.from.x + ( seg.to.x - seg.from.x ) * t;
		const baseY = ( seg.from.y || 0 ) + seg.deltaY * t;
		const baseZ = seg.from.z + ( seg.to.z - seg.from.z ) * t;
		const perpX = - seg.forward.z;
		const perpZ = seg.forward.x;

		return {
			x: baseX + perpX * lateralOffset,
			y: baseY,
			z: baseZ + perpZ * lateralOffset,
			forward: { x: seg.forward.x, z: seg.forward.z },
			curvature: seg.curvature,
			segmentIndex: segIndex,
			distanceAlongTrack: normalizedDistance,
		};

	}

	// ─── Spatial Queries (R6, R7, R8) ────────────────────────

	/**
	 * Returns the index of the nearest waypoint to a world position (XZ distance).
	 */
	getNearestWaypoint( worldX, worldZ, lastWaypointHint ) {

		let bestIdx = 0;
		let bestDist = Infinity;
		const searchWindow = lastWaypointHint !== undefined && lastWaypointHint !== null;
		const windowSize = 8;

		if ( searchWindow ) {

			for ( let offset = -windowSize; offset <= windowSize; offset ++ ) {

				const i = ( ( lastWaypointHint + offset ) % this.count + this.count ) % this.count;
				const w = this.waypoints[ i ];
				const dx = w.x - worldX;
				const dz = w.z - worldZ;
				const d = dx * dx + dz * dz;

				if ( d < bestDist ) {

					bestDist = d;
					bestIdx = i;

				}

			}

			if ( bestDist < 400 ) return bestIdx;

			bestDist = Infinity;

		}

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

		for ( let i = 0; i < count; i ++ ) {

			const sample = this.sampleRoute( this.totalLength * i / count );
			if ( ! sample ) continue;

			positions.push( {
				x: sample.x,
				z: sample.z,
				forward: sample.forward,
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
		this._segmentInfo = [];
		this.totalLength = 0;
		this._checkpointCache = null;

	}

	_projectOntoSegment( worldX, worldZ, segIndex ) {

		const projected = this._projectOntoSegmentDetailed( worldX, worldZ, segIndex );
		return {
			dist: projected.distanceFromRoute,
			progress: projected.progress,
		};

	}

	_projectOntoSegmentDetailed( worldX, worldZ, segIndex ) {

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
		const segLen = Math.sqrt( abLenSq );
		const forwardX = segLen > 0 ? abx / segLen : 0;
		const forwardZ = segLen > 0 ? abz / segLen : 1;
		const perpX = - forwardZ;
		const perpZ = forwardX;
		const lateralOffset = dx * perpX + dz * perpZ;
		const distanceFromRoute = Math.sqrt( dx * dx + dz * dz );

		// Compute progress
		const cumAtSeg = this._cumDist[ segIndex ];
		const progressDist = cumAtSeg + segLen * t;
		const progress = this.totalLength > 0 ? ( progressDist / this.totalLength ) % 1 : 0;

		return {
			segmentIndex: segIndex,
			distanceAlongTrack: progressDist,
			progress,
			lateralOffset,
			distanceFromRoute,
			point: { x: cx, z: cz },
			forward: { x: forwardX, z: forwardZ },
		};

	}

	_normalizeDistance( distanceAlongTrack ) {

		if ( this.totalLength <= 0 ) return 0;
		let dist = distanceAlongTrack % this.totalLength;
		if ( dist < 0 ) dist += this.totalLength;
		return dist;

	}

	_findSegmentIndexByDistance( distanceAlongTrack ) {

		for ( let i = 0; i < this._segmentInfo.length; i ++ ) {

			const seg = this._segmentInfo[ i ];
			const endDist = seg.startDist + seg.length;

			if ( distanceAlongTrack >= seg.startDist && distanceAlongTrack < endDist ) {

				return i;

			}

		}

		return this._segmentInfo.length - 1;

	}

}
