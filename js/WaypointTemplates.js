// ─── Waypoint Templates ──────────────────────────────────────────────
// Per-tile waypoint paths for AI track intelligence.
// All templates defined in local tile space at orientation 0°.
// Coordinate system: center = (0,0), +X = East, +Z = South.
// Tile spans -5 to +5 (CELL_RAW = 10).

import { CELL_RAW, GRID_SCALE } from './Track.js';
import { getCurveVariantSize } from './TrackOrientation.js';

// ─── Rotation ────────────────────────────────────────────────────────

const ROTATE_FN = {
	0:   ( x, z ) => ( { x, z } ),                // 0°: identity
	90:  ( x, z ) => ( { x: z, z: - x } ),         // 90° CW (orient 16)
	180: ( x, z ) => ( { x: - x, z: - z } ),       // 180° (orient 10)
	270: ( x, z ) => ( { x: - z, z: x } ),          // 270° CW (orient 22)
};

function rotateLocal( x, z, degrees ) {

	const fn = ROTATE_FN[ degrees ];
	return fn ? fn( x, z ) : { x, z };

}

// ─── Edge → delta mapping (same as TrackIntel EDGES) ─────────────────

const EDGE_DELTA = { N: [ 0, - 1 ], S: [ 0, 1 ], E: [ 1, 0 ], W: [ - 1, 0 ] };

// Opposite edge lookup
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

// ─── Edge rotation (same convention as TrackIntel) ───────────────────

const ROTATE_STEP = { N: 'W', W: 'S', S: 'E', E: 'N' };

function rotateEdge( edge, degrees ) {

	const steps = ( ( degrees % 360 ) + 360 ) % 360 / 90;
	let e = edge;
	for ( let i = 0; i < steps; i ++ ) e = ROTATE_STEP[ e ];
	return e;

}

// ─── Base templates at orient 0° ─────────────────────────────────────
// Each template: array of { x, z } in local tile space.
// Keyed by "entryEdge>exitEdge" where edges are at orient 0°.

const HALF = CELL_RAW / 2; // 5
const NEAR = HALF * 0.8;   // 4 — near edge
const MID = 0;              // center

// Straight: N+S at orient 0
const STRAIGHT_S_N = [
	{ x: 0, z: NEAR },     // entry near south edge
	{ x: 0, z: MID },      // center
	{ x: 0, z: - NEAR },   // exit near north edge
];

const STRAIGHT_N_S = [
	{ x: 0, z: - NEAR },
	{ x: 0, z: MID },
	{ x: 0, z: NEAR },
];

// Corner 1x1: S+W at orient 0 — enters from south, exits west
// Use a denser quarter-arc so AI can thread stacked 1x1 bends without
// over-committing to a single apex point and clipping the wall.
const CORNER_S_W = [
	{ x: 0, z: NEAR },         // entry near south edge
	{ x: - 0.8, z: 3.6 },
	{ x: - 1.8, z: 2.8 },
	{ x: - 2.8, z: 1.8 },
	{ x: - 3.6, z: 0.8 },
	{ x: - NEAR, z: 0 },       // exit near west edge
];

const CORNER_W_S = [
	{ x: - NEAR, z: 0 },
	{ x: - 2.0, z: 2.0 },
	{ x: 0, z: NEAR },
];

// Legacy 3x3 curve tiles are normalized to proxy corner cells for TrackIntel
// only. These arcs span the full 3x3 footprint so AI sees the same wide bend
// the player drives visually instead of a tight 1x1 elbow.
const CURVE_PROXY_3x3_S_W = [
	{ x: 0, z: 10 },
	{ x: - 1.5, z: 9.7 },
	{ x: - 3.8, z: 8.9 },
	{ x: - 6.2, z: 7.3 },
	{ x: - 8.1, z: 5.1 },
	{ x: - 9.4, z: 2.6 },
	{ x: - 10, z: 0 },
];

const CURVE_PROXY_3x3_W_S = [ ...CURVE_PROXY_3x3_S_W ].reverse();

const CURVE_PROXY_3x3_WIDE_S_W = [
	{ x: 0, z: 10 },
	{ x: - 2.1, z: 9.9 },
	{ x: - 4.6, z: 9.2 },
	{ x: - 6.9, z: 7.8 },
	{ x: - 8.7, z: 5.8 },
	{ x: - 9.7, z: 3.1 },
	{ x: - 10, z: 0 },
];

const CURVE_PROXY_3x3_WIDE_W_S = [ ...CURVE_PROXY_3x3_WIDE_S_W ].reverse();

// ─── Multi-cell curve waypoints ──────────────────────────────────────
// Defined relative to the ANCHOR CELL center (the corner cell).
// Connectivity: S+E at orient 0. Walk enters from S edge, exits E edge.
// The curve road visually arcs through the footprint, but connectivity
// only checks immediate cardinal neighbors from the anchor cell.
// Waypoints trace a smooth arc from south entry to east exit of anchor.
//
// 2x2 curve: gentle quarter-arc through the anchor cell area
const CURVE_2x2_S_E = [
	{ x: 0, z: NEAR },         // entry: south edge
	{ x: 1.5, z: 3.0 },        // early arc
	{ x: 3.0, z: 1.5 },        // apex
	{ x: NEAR - 0.5, z: 0.5 }, // late arc
	{ x: NEAR, z: 0 },          // exit: east edge
];

const CURVE_2x2_E_S = [ ...CURVE_2x2_S_E ].reverse();

// 3x3 curve: wider sweep, more waypoints for smoother arc
const CURVE_3x3_S_E = [
	{ x: 0, z: NEAR },
	{ x: 0.8, z: 3.5 },
	{ x: 2.0, z: 2.8 },
	{ x: 3.0, z: 2.0 },
	{ x: 3.5, z: 1.2 },
	{ x: NEAR - 0.5, z: 0.5 },
	{ x: NEAR, z: 0 },
];

const CURVE_3x3_E_S = [ ...CURVE_3x3_S_E ].reverse();

// 3x3 wide: tighter inner radius
const CURVE_3x3_WIDE_S_E = [
	{ x: 0, z: NEAR },
	{ x: 1.0, z: 3.2 },
	{ x: 2.2, z: 2.5 },
	{ x: 3.2, z: 1.5 },
	{ x: NEAR - 0.5, z: 0.8 },
	{ x: NEAR - 0.2, z: 0.3 },
	{ x: NEAR, z: 0 },
];

const CURVE_3x3_WIDE_E_S = [ ...CURVE_3x3_WIDE_S_E ].reverse();

const CURVE_VARIANT_ARC_PARAMS = {
	'2x2-wide': { handleRatio: 0.5522847498, steps: 5 },
	'3x3': { handleRatio: 0.5522847498, steps: 7 },
	'3x3-wide': { handleRatio: 0.5522847498, steps: 9 },
};

function sampleCubicBezier( p0, p1, p2, p3, t ) {

	const invT = 1 - t;
	const invT2 = invT * invT;
	const t2 = t * t;
	return {
		x:
			invT2 * invT * p0.x +
			3 * invT2 * t * p1.x +
			3 * invT * t2 * p2.x +
			t2 * t * p3.x,
		z:
			invT2 * invT * p0.z +
			3 * invT2 * t * p1.z +
			3 * invT * t2 * p2.z +
			t2 * t * p3.z,
	};

}

function buildFootprintCurvePoints( curveVariant ) {

	const size = getCurveVariantSize( curveVariant );
	const params = CURVE_VARIANT_ARC_PARAMS[ curveVariant ];
	if ( size < 2 || ! params ) return null;

	const reach = ( size - 0.5 ) * CELL_RAW;
	const handle = reach * params.handleRatio;
	const p0 = { x: - reach, z: 0 };
	const p1 = { x: - reach + handle, z: 0 };
	const p2 = { x: 0, z: reach - handle };
	const p3 = { x: 0, z: reach };
	const points = [];

	for ( let i = 0; i < params.steps; i ++ ) {

		const t = params.steps > 1 ? i / ( params.steps - 1 ) : 0;
		points.push( sampleCubicBezier( p0, p1, p2, p3, t ) );

	}

	return points;

}

const CURVE_VARIANT_TEMPLATES = Object.fromEntries(
	Object.keys( CURVE_VARIANT_ARC_PARAMS ).map( ( curveVariant ) => {

		const points = buildFootprintCurvePoints( curveVariant );
		return [
			curveVariant,
			{
				'W>S': points,
				'S>W': [ ...points ].reverse(),
			},
		];

	} )
);

// ─── Chicane: S-curve through 3x3 footprint (N+S at orient 0) ───────
const CHICANE_S_N = [
	{ x: 0, z: NEAR },
	{ x: 2.5, z: 2.5 },
	{ x: 0, z: 0 },
	{ x: - 2.5, z: - 2.5 },
	{ x: 0, z: - NEAR },
];

const CHICANE_N_S = [ ...CHICANE_S_N ].reverse();

// ─── Junction straight-throughs ──────────────────────────────────────
// Junctions use the same straight/corner templates based on resolved entry/exit.
// Built dynamically in getTemplateWaypoints.

// ─── Template lookup ─────────────────────────────────────────────────

const TEMPLATES = {
	// Straight-type tiles (all N+S at orient 0)
	'trk-straight':   { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-finish':     { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-elev-2p5':   { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-elev-5':     { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },

	'trk-ramp-up-2p5':          { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-up-5':            { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-down-2p5':        { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-down-5':          { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-up-2p5-smooth':   { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-up-5-smooth':     { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-down-2p5-smooth': { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-ramp-down-5-smooth':   { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },

	'trk-bridge-entry': { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-bridge-mid':   { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },

	'trk-tunnel-entry': { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-tunnel-mid':   { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-tunnel-exit':  { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-tunnel-open':  { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },

	'trk-jump-short': { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },
	'trk-jump-long':  { 'S>N': STRAIGHT_S_N, 'N>S': STRAIGHT_N_S },

	// Corner
	'trk-corner-1x1': { 'S>W': CORNER_S_W, 'W>S': CORNER_W_S },
	'trk-curve-3x3-proxy': { 'S>W': CURVE_PROXY_3x3_S_W, 'W>S': CURVE_PROXY_3x3_W_S },
	'trk-curve-3x3-wide-proxy': { 'S>W': CURVE_PROXY_3x3_WIDE_S_W, 'W>S': CURVE_PROXY_3x3_WIDE_W_S },

	// Multi-cell curves (S+E at orient 0)
	'trk-curve-2x2-l':      { 'S>E': CURVE_2x2_S_E, 'E>S': CURVE_2x2_E_S },
	'trk-curve-3x3-l':      { 'S>E': CURVE_3x3_S_E, 'E>S': CURVE_3x3_E_S },
	'trk-curve-3x3-wide-l': { 'S>E': CURVE_3x3_WIDE_S_E, 'E>S': CURVE_3x3_WIDE_E_S },

	// Chicane (N+S at orient 0)
	'trk-chicane-3x3-l': { 'S>N': CHICANE_S_N, 'N>S': CHICANE_N_S },
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Get waypoint template in local tile space at orient 0°.
 * entryEdge / exitEdge are in ROTATED (world) edge space — they get
 * un-rotated to orient-0 space for the lookup.
 *
 * @param {string} tileType - e.g. 'trk-corner-1x1'
 * @param {string} entryEdge - world-space entry edge (N/S/E/W)
 * @param {string} exitEdge - world-space exit edge (N/S/E/W)
 * @param {number} orientDeg - tile orientation in degrees (0, 90, 180, 270)
 * @returns {Array<{x: number, z: number}>} local-space waypoints at orient 0°
 */
export function getTemplateWaypoints( tileType, entryEdge, exitEdge, orientDeg ) {

	// Un-rotate edges back to orient-0 space
	const invDeg = ( 360 - orientDeg ) % 360;
	const baseEntry = rotateEdge( entryEdge, invDeg );
	const baseExit = rotateEdge( exitEdge, invDeg );

	const tileTemplates = TEMPLATES[ tileType ];

	if ( tileTemplates ) {

		const key = baseEntry + '>' + baseExit;
		const template = tileTemplates[ key ];
		if ( template ) return template;

	}

	// Fallback for junctions or unknown tiles: generate a straight-through
	// from entry edge to exit edge in local space
	const entryDelta = EDGE_DELTA[ baseEntry ];
	const exitDelta = EDGE_DELTA[ baseExit ];

	if ( ! entryDelta || ! exitDelta ) {

		// Last resort: center point only
		return [ { x: 0, z: 0 } ];

	}

	// Entry point near the entry edge, exit point near the exit edge
	return [
		{ x: entryDelta[ 0 ] * NEAR, z: entryDelta[ 1 ] * NEAR },
		{ x: 0, z: 0 },
		{ x: exitDelta[ 0 ] * NEAR, z: exitDelta[ 1 ] * NEAR },
	];

}

export function getCurveBlockTemplateWaypoints( curveVariant, entryEdge, exitEdge, orientDeg ) {

	const invDeg = ( 360 - orientDeg ) % 360;
	const baseEntry = rotateEdge( entryEdge, invDeg );
	const baseExit = rotateEdge( exitEdge, invDeg );

	const templates = CURVE_VARIANT_TEMPLATES[ curveVariant ];
	const template = templates?.[ `${baseEntry}>${baseExit}` ];
	return template || null;

}

/**
 * Transform local-space waypoints (at orient 0°) to world space.
 *
 * @param {Array<{x: number, z: number}>} localPoints
 * @param {number} gx - grid X coordinate
 * @param {number} gz - grid Z coordinate
 * @param {number} orientDeg - tile orientation in degrees
 * @param {number} [entryY=0] - world Y at entry edge
 * @param {number} [exitY=0] - world Y at exit edge (interpolated for ramps)
 * @returns {Array<{x: number, y: number, z: number}>}
 */
export function transformToWorld( localPoints, gx, gz, orientDeg, entryY, exitY ) {

	const worldCenterX = ( gx + 0.5 ) * CELL_RAW * GRID_SCALE;
	const worldCenterZ = ( gz + 0.5 ) * CELL_RAW * GRID_SCALE;
	const yStart = entryY || 0;
	const yEnd = ( exitY !== undefined ) ? exitY : yStart;
	const count = localPoints.length;

	return localPoints.map( ( pt, idx ) => {

		const rotated = rotateLocal( pt.x, pt.z, orientDeg );
		const t = count > 1 ? idx / ( count - 1 ) : 0;
		return {
			x: worldCenterX + rotated.x * GRID_SCALE,
			y: yStart + ( yEnd - yStart ) * t,
			z: worldCenterZ + rotated.z * GRID_SCALE,
		};

	} );

}

export { EDGE_DELTA, OPPOSITE, rotateEdge };
