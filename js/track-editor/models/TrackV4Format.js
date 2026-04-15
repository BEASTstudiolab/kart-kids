const ELEV_STEP = 2.5;
const ELEV_GROUND = 12;

const V4_TYPE_NAMES = [
	'trk-straight',
	'trk-corner-1x1',
	'trk-straight',
	'trk-finish',
	'trk-junction-y',
	'trk-junction-t',
	'trk-junction-4way',
	'trk-bridge-entry',
	'trk-bridge-mid',
	'trk-tunnel-entry',
	'trk-tunnel-mid',
	'trk-tunnel-exit',
	'trk-tunnel-open',
	'trk-jump-short',
	'trk-jump-long',
	'trk-chicane-3x3-l',
	'trk-elev-2p5',
	'trk-elev-5',
	'trk-ramp-up-2p5',
	'trk-ramp-up-5',
	'trk-ramp-down-2p5',
	'trk-ramp-down-5',
	'trk-ramp-up-2p5-smooth',
	'trk-ramp-up-5-smooth',
	'trk-ramp-down-2p5-smooth',
	'trk-ramp-down-5-smooth',
	'trk-curve-2x2-l',
	'trk-curve-3x3-l',
	'trk-curve-3x3-wide-l',
	'trk-jump-medium',
];

const V4_TYPE_INDEX = {};
for ( let i = 0; i < V4_TYPE_NAMES.length; i ++ ) {

	if ( i === 2 ) continue;
	if ( V4_TYPE_INDEX[ V4_TYPE_NAMES[ i ] ] === undefined ) {

		V4_TYPE_INDEX[ V4_TYPE_NAMES[ i ] ] = i;

	}

}

const V4_TO_INTERNAL = [ 0, 16, 10, 22 ];
const INTERNAL_TO_V4 = { 0: 0, 16: 1, 10: 2, 22: 3 };

const CURVE_VARIANT_ENCODE = { '2x2-wide': 1, '2x2-tight': 2, '3x3': 3, '3x3-wide': 4 };
const CURVE_VARIANT_DECODE = { 1: '2x2-wide', 2: '2x2-tight', 3: '3x3', 4: '3x3-wide' };

export {
	ELEV_STEP,
	ELEV_GROUND,
	V4_TYPE_NAMES,
	V4_TYPE_INDEX,
	V4_TO_INTERNAL,
	INTERNAL_TO_V4,
	CURVE_VARIANT_ENCODE,
	CURVE_VARIANT_DECODE,
};
