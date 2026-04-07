// ─── Track Codec ──────────────────────────────────────────

// v3 TYPE_NAMES: 4-bit index supports up to 16 tile types.
// Index 2 kept as trk-straight for backwards compatibility (legacy bump).
const TYPE_NAMES = [
	'trk-straight',       // 0
	'trk-corner-1x1',     // 1
	'trk-straight',       // 2 (legacy bump → straight)
	'trk-finish',         // 3
	'trk-junction-y',     // 4
	'trk-junction-t',     // 5
	'trk-junction-4way',  // 6
	'trk-bridge-entry',   // 7
	'trk-bridge-mid',     // 8
	'trk-tunnel-entry',   // 9
	'trk-tunnel-mid',     // 10
	'trk-tunnel-exit',    // 11
	'trk-tunnel-open',    // 12
	'trk-jump-short',     // 13
	'trk-jump-long',      // 14
	'trk-chicane-3x3-l',  // 15
];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) {

	// Skip index 2 (legacy bump alias) so trk-straight maps to 0
	if ( i === 2 ) continue;
	if ( TYPE_INDEX[ TYPE_NAMES[ i ] ] === undefined ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

}

const ORIENT_ENCODE = [ 0, 16, 10, 22 ];
const ORIENT_DECODE = { 0: 0, 16: 1, 10: 2, 22: 3 };


export function encodeCells( cells ) {

	// Filter out autoRamp cells — they are derived from elevated cells at load time
	const filtered = cells.filter( c => ! c[ 4 ]?.autoRamp );

	// v3 format: 4 bytes per cell
	// Byte 0: gx + 128
	// Byte 1: gz + 128
	// Byte 2: [type(4 bits)][orient(2 bits)][elevation(2 bits)]
	// Byte 3: [curveOverride(1)][rotationOverride(1)][rampStyle(1)][curveVariant(3)][reserved(2)]
	const bytes = new Uint8Array( filtered.length * 4 );

	for ( let i = 0; i < filtered.length; i ++ ) {

		const [ gx, gz, name, cellOrient, flags ] = filtered[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = ORIENT_DECODE[ cellOrient ] ?? 0;

		let elev = 0;
		let flags2 = 0;

		if ( flags ) {

			elev = flags.elevation ?? 0;
			const curve = flags.curveOverride ? 1 : 0;
			const rot = flags.rotationOverride ? 1 : 0;
			flags2 = curve | ( rot << 1 );

			if ( flags.rampStyle === 'smooth' ) flags2 |= ( 1 << 2 );

			// bits 3-5: curveVariant (0=none, 1=2x2-wide, 2=2x2-tight, 3=3x3, 4=3x3-wide)
			const CURVE_VARIANT_ENCODE = { '2x2-wide': 1, '2x2-tight': 2, '3x3': 3, '3x3-wide': 4 };
			if ( flags.curveVariant && CURVE_VARIANT_ENCODE[ flags.curveVariant ] ) {

				flags2 |= ( CURVE_VARIANT_ENCODE[ flags.curveVariant ] << 3 );

			}

		}

		bytes[ i * 4 ] = gx + 128;
		bytes[ i * 4 + 1 ] = gz + 128;
		bytes[ i * 4 + 2 ] = ( ti << 4 ) | ( oi << 2 ) | ( elev & 0x03 );
		bytes[ i * 4 + 3 ] = flags2;

	}

	return 'v3:' + bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	// v3 format: 4 bytes per cell, prefixed with "v3:"
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

			const CURVE_VARIANT_DECODE = [ null, '2x2-wide', '2x2-tight', '3x3', '3x3-wide' ];
			const curveVariant = CURVE_VARIANT_DECODE[ ( flags2 >> 3 ) & 0x07 ] || null;

			const flags = { elevation, curveOverride, rotationOverride, rampStyle, curveVariant };
			cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// v2 format: 4 bytes per cell, prefixed with "v2:"
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

			const CURVE_VARIANT_DECODE = [ null, '2x2-wide', '2x2-tight', '3x3', '3x3-wide' ];
			const curveVariant = CURVE_VARIANT_DECODE[ ( flags2 >> 1 ) & 0x07 ] || null;

			const flags = { elevation, curveOverride, rotationOverride, rampStyle, curveVariant };
			cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_ENCODE[ oi ], flags ] );

		}

		return cells;

	}

	// Legacy v1 format: 3 bytes per cell, no prefix
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

		const flags = { elevation, curveOverride, rotationOverride, rampStyle: null };
		cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_ENCODE[ oi ], flags ] );

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
