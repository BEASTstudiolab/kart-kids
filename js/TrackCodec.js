// ─── Track Codec ──────────────────────────────────────────

// All known tile type names. 8-bit index in v5 format (up to 256 types).
const TYPE_NAMES = [
	'trk-straight',            // 0
	'trk-corner-1x1',         // 1
	'trk-straight',            // 2 (legacy alias)
	'trk-finish',              // 3
	'trk-junction-y',          // 4
	'trk-junction-t',          // 5
	'trk-junction-4way',       // 6
	'trk-bridge-entry',        // 7
	'trk-bridge-mid',          // 8
	'trk-tunnel-entry',        // 9
	'trk-tunnel-mid',          // 10
	'trk-tunnel-exit',         // 11
	'trk-tunnel-open',         // 12
	'trk-jump-short',          // 13
	'trk-jump-long',           // 14
	'trk-chicane-3x3-l',      // 15
	// ── Elevation & ramp types (v5+) ──
	'trk-elev-2p5',            // 16
	'trk-elev-5',              // 17
	'trk-ramp-up-2p5',         // 18
	'trk-ramp-up-5',           // 19
	'trk-ramp-down-2p5',       // 20
	'trk-ramp-down-5',         // 21
	'trk-ramp-up-2p5-smooth',  // 22
	'trk-ramp-up-5-smooth',    // 23
	'trk-ramp-down-2p5-smooth', // 24
	'trk-ramp-down-5-smooth',  // 25
	// ── Curve types (saved directly, no corner normalization) ──
	'trk-curve-2x2-l',         // 26
	'trk-curve-3x3-l',         // 27
	'trk-curve-3x3-wide-l',   // 28
];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) {

	if ( i === 2 ) continue; // skip legacy alias
	if ( TYPE_INDEX[ TYPE_NAMES[ i ] ] === undefined ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

}

const ORIENT_ENCODE = [ 0, 16, 10, 22 ];
const ORIENT_DECODE = { 0: 0, 16: 1, 10: 2, 22: 3 };

const CURVE_VARIANT_ENCODE = { '2x2-wide': 1, '2x2-tight': 2, '3x3': 3, '3x3-wide': 4 };
const CURVE_VARIANT_DECODE = [ null, '2x2-wide', '2x2-tight', '3x3', '3x3-wide' ];

const ELEV_GROUND = 12;


export function encodeCells( cells ) {

	// v5 format: 5 bytes per cell — NO filtering, direct pass-through
	// ALL tiles saved exactly as the editor has them (including ramps, elevated tiles)
	// Byte 0: gx + 128
	// Byte 1: gz + 128
	// Byte 2: type index (full 8 bits — supports 256 tile types)
	// Byte 3: [orient(2)][fullElevation(5)][rampStyle(1)]
	// Byte 4: [curveOverride(1)][rotationOverride(1)][curveVariant(3)][reserved(3)]
	const bytes = new Uint8Array( cells.length * 5 );

	for ( let i = 0; i < cells.length; i ++ ) {

		const [ gx, gz, name, cellOrient, flags ] = cells[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = ORIENT_DECODE[ cellOrient ] ?? 0;

		let fullElev = ELEV_GROUND;
		let byte3 = 0;
		let byte4 = 0;

		if ( flags ) {

			fullElev = flags.fullElevation ?? ELEV_GROUND;

			// If fullElevation isn't set, derive from legacy elevation
			if ( ! flags.fullElevation && flags.elevation && flags.elevation > 0 ) {

				fullElev = ELEV_GROUND + flags.elevation;

			}

			if ( flags.rampStyle === 'smooth' ) byte3 |= ( 1 << 7 );
			if ( flags.curveOverride ) byte4 |= 1;
			if ( flags.rotationOverride ) byte4 |= 2;

			if ( flags.curveVariant && CURVE_VARIANT_ENCODE[ flags.curveVariant ] ) {

				byte4 |= ( CURVE_VARIANT_ENCODE[ flags.curveVariant ] << 2 );

			}

		}

		byte3 |= ( oi << 5 ) | ( fullElev & 0x1F );

		bytes[ i * 5 ] = gx + 128;
		bytes[ i * 5 + 1 ] = gz + 128;
		bytes[ i * 5 + 2 ] = ti;
		bytes[ i * 5 + 3 ] = byte3;
		bytes[ i * 5 + 4 ] = byte4;

	}

	return 'v5:' + bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	// v5 format: 5 bytes per cell, full type byte, direct pass-through
	if ( str.startsWith( 'v5:' ) ) {

		const bytes = base64urlToBytes( str.slice( 3 ) );
		const cells = [];

		for ( let i = 0; i + 4 < bytes.length; i += 5 ) {

			const gx = bytes[ i ] - 128;
			const gz = bytes[ i + 1 ] - 128;
			const ti = bytes[ i + 2 ];
			const byte3 = bytes[ i + 3 ];
			const byte4 = bytes[ i + 4 ];

			const oi = ( byte3 >> 5 ) & 0x03;
			const fullElev = byte3 & 0x1F;
			const rampStyle = ( byte3 & 0x80 ) ? 'smooth' : null;

			const curveOverride = !! ( byte4 & 0x01 );
			const rotationOverride = !! ( byte4 & 0x02 );
			const curveVariant = CURVE_VARIANT_DECODE[ ( byte4 >> 2 ) & 0x07 ] || null;

			// Derive v3-compatible elevation for backward compat
			const stepsAbove = fullElev - ELEV_GROUND;
			let elevation = 0;
			if ( stepsAbove === 1 ) elevation = 1;
			else if ( stepsAbove >= 2 ) elevation = 2;

			const flags = {
				elevation,
				fullElevation: fullElev,
				curveOverride,
				rotationOverride,
				rampStyle,
				curveVariant,
			};

			const typeName = TYPE_NAMES[ ti ] ?? 'trk-straight';
			cells.push( [ gx, gz, typeName, ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// v4 format: 5 bytes per cell
	if ( str.startsWith( 'v4:' ) ) {

		const bytes = base64urlToBytes( str.slice( 3 ) );
		const cells = [];

		for ( let i = 0; i + 4 < bytes.length; i += 5 ) {

			const gx = bytes[ i ] - 128;
			const gz = bytes[ i + 1 ] - 128;
			const packed = bytes[ i + 2 ];
			const flags2 = bytes[ i + 3 ];
			const fullElev = bytes[ i + 4 ] & 0x1F;

			const ti = ( packed >> 4 ) & 0x0F;
			const oi = ( packed >> 2 ) & 0x03;
			const elevStepsAboveGround = fullElev - ELEV_GROUND;
			let elevation = 0;
			if ( elevStepsAboveGround === 1 ) elevation = 1;
			else if ( elevStepsAboveGround >= 2 ) elevation = 2;

			const curveOverride = !! ( flags2 & 0x01 );
			const rotationOverride = !! ( flags2 & 0x02 );
			const rampStyle = ( flags2 & 0x04 ) ? 'smooth' : null;
			const curveVariant = CURVE_VARIANT_DECODE[ ( flags2 >> 3 ) & 0x07 ] || null;

			const flags = { elevation, fullElevation: fullElev, curveOverride, rotationOverride, rampStyle, curveVariant };
			cells.push( [ gx, gz, TYPE_NAMES[ ti ] ?? 'trk-straight', ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// v3 format: 4 bytes per cell
	if ( str.startsWith( 'v3:' ) ) {

		const bytes = base64urlToBytes( str.slice( 3 ) );
		const cells = [];

		for ( let i = 0; i + 3 < bytes.length; i += 4 ) {

			const gx = bytes[ i ] - 128;
			const gz = bytes[ i + 1 ] - 128;
			const packed = bytes[ i + 2 ];
			const flags2 = bytes[ i + 3 ];

			const ti = ( packed >> 4 ) & 0x0F;
			const oi = ( packed >> 2 ) & 0x03;
			const elevation = packed & 0x03;

			const curveOverride = !! ( flags2 & 0x01 );
			const rotationOverride = !! ( flags2 & 0x02 );
			const rampStyle = ( flags2 & 0x04 ) ? 'smooth' : null;
			const curveVariant = CURVE_VARIANT_DECODE[ ( flags2 >> 3 ) & 0x07 ] || null;

			const fullElevation = elevation > 0 ? ELEV_GROUND + elevation : ELEV_GROUND;
			const flags = { elevation, fullElevation, curveOverride, rotationOverride, rampStyle, curveVariant };
			cells.push( [ gx, gz, TYPE_NAMES[ ti ] ?? 'trk-straight', ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// v2 format: 4 bytes per cell
	if ( str.startsWith( 'v2:' ) ) {

		const bytes = base64urlToBytes( str.slice( 3 ) );
		const cells = [];

		for ( let i = 0; i + 3 < bytes.length; i += 4 ) {

			const gx = bytes[ i ] - 128;
			const gz = bytes[ i + 1 ] - 128;
			const packed = bytes[ i + 2 ];
			const flags2 = bytes[ i + 3 ];

			const ti = ( packed >> 2 ) & 0x03;
			const oi = packed & 0x03;
			const flagBits = ( packed >> 4 ) & 0x0F;
			const elevation = flagBits & 0x03;
			const curveOverride = !! ( flagBits & 0x04 );
			const rotationOverride = !! ( flagBits & 0x08 );
			const rampStyle = ( flags2 & 1 ) ? 'smooth' : null;
			const curveVariant = CURVE_VARIANT_DECODE[ ( flags2 >> 1 ) & 0x07 ] || null;

			const fullElevation = elevation > 0 ? ELEV_GROUND + elevation : ELEV_GROUND;
			const flags = { elevation, fullElevation, curveOverride, rotationOverride, rampStyle, curveVariant };
			cells.push( [ gx, gz, TYPE_NAMES[ ti ] ?? 'trk-straight', ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// Legacy v1 format: 3 bytes per cell
	const bytes = base64urlToBytes( str );
	const cells = [];

	for ( let i = 0; i + 2 < bytes.length; i += 3 ) {

		const gx = bytes[ i ] - 128;
		const gz = bytes[ i + 1 ] - 128;
		const packed = bytes[ i + 2 ];
		const ti = ( packed >> 2 ) & 0x03;
		const oi = packed & 0x03;
		const flagBits = ( packed >> 4 ) & 0x0F;
		const elevation = flagBits & 0x03;
		const curveOverride = !! ( flagBits & 0x04 );
		const rotationOverride = !! ( flagBits & 0x08 );

		const fullElevation = elevation > 0 ? ELEV_GROUND + elevation : ELEV_GROUND;
		const flags = { elevation, fullElevation, curveOverride, rotationOverride, rampStyle: null };
		cells.push( [ gx, gz, TYPE_NAMES[ ti ] ?? 'trk-straight', ORIENT_ENCODE[ oi ], flags ] );

	}

	return cells;

}


function bytesToBase64url( bytes ) {

	let binary = '';
	for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );

	return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

}

function base64urlToBytes( str ) {

	const base64 = str.replace( /-/g, '+' ).replace( /_/g, '/' );

	let binary;
	try {

		binary = atob( base64 );

	} catch {

		console.warn( '[TrackCodec] Invalid base64 input — returning empty' );
		return new Uint8Array( 0 );

	}

	const bytes = new Uint8Array( binary.length );
	for ( let i = 0; i < binary.length; i ++ ) bytes[ i ] = binary.charCodeAt( i );

	return bytes;

}
