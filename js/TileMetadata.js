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

export function getCurveConfig( orient, lr, curveSize ) {

	// CURVE L raw model: road connects WEST edge ↔ NORTH edge, arc at NW corner.
	// Rotating 90° maps the connected edges:
	//   rot=0°:   west+north = N+W → orient 22
	//   rot=90°:  south+west = S+W → orient 0
	//   rot=180°: east+south = S+E → orient 16
	//   rot=-90°: north+east = N+E → orient 10
	// ALL 4 orients use CURVE L at different rotations.

	const halfShift = ( curveSize - 1 ) / 2 * CELL;

	const rotations = {
		0: PI / 2,     // S+W
		16: PI,        // S+E
		10: - PI / 2,  // N+E
		22: 0,         // N+W
	};

	const offsets = {
		0:  { x: - halfShift, z: halfShift },
		16: { x: halfShift, z: halfShift },
		10: { x: halfShift, z: - halfShift },
		22: { x: - halfShift, z: - halfShift },
	};

	return {
		rotation: rotations[ orient ] ?? 0,
		offset: offsets[ orient ] ?? { x: 0, z: 0 },
		lr: 'l', // Always CURVE L — rotation handles all 4 directions
	};

}

// ─── L/R variant selection ───────────────────────────────────────────────
// Determined by the corner's turn direction.
// Orient 0 (S+W) = left turn, Orient 16 (S+E) = right turn, etc.

export function getCurveLR( orient ) {

	// All orients use CURVE L — rotation handles the direction
	return 'l';

}
