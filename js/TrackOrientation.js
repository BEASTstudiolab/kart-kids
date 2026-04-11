// Shared orientation semantics for the editor, validator, and runtime.
// Internal orientation codes: 0|10|16|22 map to 0|180|90|270 degrees.

export const CORNER_EXIT_MASKS = { 0: 5, 16: 6, 10: 10, 22: 9 }; // S+W, S+E, N+E, N+W
export const STRAIGHT_EXIT_MASKS = { 0: 12, 10: 12, 16: 3, 22: 3 }; // N+S, N+S, E+W, E+W

export const TRACK_INTEL_BASE_CONNECTIVITY = {
	'trk-straight': [ 'N', 'S' ],
	'trk-finish': [ 'N', 'S' ],
	'trk-corner-1x1': [ 'S', 'W' ],

	// Multi-tile curves are calibrated separately from the 1x1 pieces.
	'trk-curve-2x2-l': [ 'S', 'E' ],
	'trk-curve-3x3-l': [ 'S', 'E' ],
	'trk-curve-3x3-wide-l': [ 'S', 'E' ],

	'trk-ramp-up-2p5': [ 'N', 'S' ],
	'trk-ramp-up-5': [ 'N', 'S' ],
	'trk-ramp-down-2p5': [ 'N', 'S' ],
	'trk-ramp-down-5': [ 'N', 'S' ],
	'trk-elev-2p5': [ 'N', 'S' ],
	'trk-elev-5': [ 'N', 'S' ],
	'trk-ramp-up-2p5-smooth': [ 'N', 'S' ],
	'trk-ramp-up-5-smooth': [ 'N', 'S' ],
	'trk-ramp-down-2p5-smooth': [ 'N', 'S' ],
	'trk-ramp-down-5-smooth': [ 'N', 'S' ],
	'trk-bridge-entry': [ 'N', 'S' ],
	'trk-bridge-mid': [ 'N', 'S' ],
	'trk-tunnel-entry': [ 'N', 'S' ],
	'trk-tunnel-mid': [ 'N', 'S' ],
	'trk-tunnel-exit': [ 'N', 'S' ],
	'trk-tunnel-open': [ 'N', 'S' ],
	'trk-jump-short': [ 'N', 'S' ],
	'trk-jump-long': [ 'N', 'S' ],
	'trk-chicane-3x3-l': [ 'N', 'S' ],
	'trk-junction-y': null,
	'trk-junction-t': null,
	'trk-junction-4way': null,
};

export function isNorthSouthOrient( orient ) {

	return orient === 0 || orient === 10;

}

export function getFinishRoadCells( gx, gz, orient ) {

	return isNorthSouthOrient( orient )
		? [ { gx, gz: gz - 1 }, { gx, gz: gz + 1 } ]
		: [ { gx: gx - 1, gz }, { gx: gx + 1, gz } ];

}
