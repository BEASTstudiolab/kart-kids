/**
 * Tile edge metadata — programmatically extracted from GLB vertex data.
 * All values verified against actual model geometry.
 */

const PI = Math.PI;
const CELL = 10; // CELL_RAW

// ─── Ramp placement rules ────────────────────────────────────────────────
// All 1x1 tiles use rotationY: PI/2. After that rotation:
//   RAMP UP:   LOW at south (+Z), HIGH at north (-Z)
//   RAMP DOWN: HIGH at south (+Z), LOW at north (-Z)
//
// To connect correctly, the HIGH edge must face the elevated cell.

export function getRampRole( orient, isLowerCoord ) {

	// isLowerCoord: true for gz-1 (north) or gx-1 (west)
	// After PI/2 rotation, HIGH end of ramp-up is at NORTH (-Z).
	// North neighbor needs its HIGH (south) edge toward elevated → ramp-down
	// South neighbor needs its HIGH (north) edge toward elevated → ramp-up
	return isLowerCoord ? 'ramp-down' : 'ramp-up';

}

// ─── Multi-tile curve placement ──────────────────────────────────────────
// Verified by tracing road openings through rotation math.
//
// CURVE L 3x3 (520): raw openings at west+north (NW corner arc)
// CURVE R 3x3 (510): raw openings at east+north (NE corner arc)

export function getCurveConfig( orient, variant, curveSize ) {

	// Empirically verified via curve-rotation-test.html:
	//   orient 0  (S+W) → rot=180°,  NE corner of track
	//   orient 16 (S+E) → rot=-90°,  NW corner of track
	//   orient 10 (N+E) → rot=0°,    SW corner of track
	//   orient 22 (N+W) → rot=90°,   SE corner of track
	// ALL 4 orients use CURVE L at different rotations.

	const halfShift = ( curveSize - 1 ) / 2 * CELL;

	const rotations = {
		0:  PI,         // S+W (rot=180°)
		16: - PI / 2,   // S+E (rot=-90°)
		10: 0,          // N+E (rot=0°)
		22: PI / 2,     // N+W (rot=90°)
	};

	const offsets = {
		0:  { x: - halfShift, z: halfShift },
		16: { x: halfShift, z: halfShift },
		10: { x: halfShift, z: - halfShift },
		22: { x: - halfShift, z: - halfShift },
	};

	// Variant-specific offset overrides (if needed after calibration)
	// Currently 2x2-wide and 2x2-tight share the same offset formula.
	// Override here if tight model needs different positioning.

	return {
		rotation: rotations[ orient ] ?? 0,
		offset: offsets[ orient ] ?? { x: 0, z: 0 },
		lr: 'l',
	};

}

// ─── L/R variant selection ───────────────────────────────────────────────
// Determined by the corner's turn direction.
// Orient 0 (S+W) = left turn, Orient 16 (S+E) = right turn, etc.

export function getCurveLR( orient ) {

	// All orients use CURVE L — rotation handles the direction
	return 'l';

}
