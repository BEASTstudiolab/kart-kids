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

const EDGE_DELTAS = {
	N: { gx: 0, gz: - 1 },
	S: { gx: 0, gz: 1 },
	E: { gx: 1, gz: 0 },
	W: { gx: - 1, gz: 0 },
};

const CORNER_OPEN_EDGES = {
	0: [ 'S', 'W' ],
	16: [ 'S', 'E' ],
	10: [ 'N', 'E' ],
	22: [ 'N', 'W' ],
};

const LEGACY_CENTER_CURVE_3X3 = {
	0: { anchorDx: - 1, anchorDz: 1, anchorOrient: 10 },
	16: { anchorDx: 1, anchorDz: 1, anchorOrient: 22 },
	10: { anchorDx: 1, anchorDz: - 1, anchorOrient: 0 },
	22: { anchorDx: - 1, anchorDz: - 1, anchorOrient: 16 },
};

function cloneFlags( flags ) {

	return flags ? { ...flags } : flags;

}

function isLegacyCenterCurve3x3Type( type ) {

	return type === 'trk-curve-3x3-l' || type === 'trk-curve-3x3-wide-l';

}

export function expandLegacyCenterCurve3x3( gx, gz, orient, flags ) {

	const legacy = LEGACY_CENTER_CURVE_3X3[ orient ];
	if ( ! legacy ) return null;

	const anchorGx = gx + legacy.anchorDx;
	const anchorGz = gz + legacy.anchorDz;
	const cornerFlags = cloneFlags( flags );
	const expanded = [
		[ anchorGx, anchorGz, 'trk-corner-1x1', legacy.anchorOrient, cornerFlags ],
	];

	for ( const edge of CORNER_OPEN_EDGES[ legacy.anchorOrient ] ?? [] ) {

		const delta = EDGE_DELTAS[ edge ];

		for ( let step = 1; step <= 2; step ++ ) {

			expanded.push( [
				anchorGx + delta.gx * step,
				anchorGz + delta.gz * step,
				'trk-straight',
				edge === 'N' || edge === 'S' ? 0 : 16,
				cloneFlags( flags ),
			] );

		}

	}

	return expanded;

}

export function normalizeLegacyTrackIntelCells( cells ) {

	const reservedKeys = new Set( cells.map( ( [ gx, gz ] ) => `${gx},${gz}` ) );
	const normalized = [];

	for ( const cell of cells ) {

		const [ gx, gz, type, orient, flags ] = cell;

		if ( ! isLegacyCenterCurve3x3Type( type ) ) {

			normalized.push( cell );
			continue;

		}

		const expanded = expandLegacyCenterCurve3x3( gx, gz, orient, flags );
		if ( ! expanded ) {

			normalized.push( cell );
			continue;

		}

		const expansionKeys = expanded.map( ( [ ex, ez ] ) => `${ex},${ez}` );
		const collides = expansionKeys.some( key => reservedKeys.has( key ) );

		if ( collides ) {

			normalized.push( cell );
			continue;

		}

		for ( const key of expansionKeys ) reservedKeys.add( key );
		normalized.push( ...expanded );

	}

	const legacyFinishCells = [];

	for ( const [ gx, gz, type, orient, flags ] of normalized ) {

		if ( type !== 'trk-finish' ) continue;

		for ( const roadCell of getFinishRoadCells( gx, gz, orient ) ) {

			const key = `${roadCell.gx},${roadCell.gz}`;
			if ( reservedKeys.has( key ) ) continue;

			reservedKeys.add( key );
			legacyFinishCells.push( [
				roadCell.gx,
				roadCell.gz,
				'trk-straight',
				isNorthSouthOrient( orient ) ? 0 : 16,
				cloneFlags( flags ),
			] );

		}

	}

	normalized.push( ...legacyFinishCells );
	return normalized;

}
