// ─── Track Codec ──────────────────────────────────────────

// track-bump kept at index 2 for backwards compatibility with saved tracks —
// decoded as trk-straight since the bump tile was removed.
const TYPE_NAMES = [ 'trk-straight', 'trk-corner-1x1', 'trk-straight', 'trk-finish' ];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

const ORIENT_ENCODE = [ 0, 16, 10, 22 ];
const ORIENT_DECODE = { 0: 0, 16: 1, 10: 2, 22: 3 };


export function encodeCells( cells ) {

	// Filter out autoRamp cells — they are derived from elevated cells at load time
	const filtered = cells.filter( c => ! c[ 4 ]?.autoRamp );

	// v2 format: 4 bytes per cell (adds flags2 byte for rampStyle + future flags)
	const bytes = new Uint8Array( filtered.length * 4 );

	for ( let i = 0; i < filtered.length; i ++ ) {

		const [ gx, gz, name, cellOrient, flags ] = filtered[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = ORIENT_DECODE[ cellOrient ] ?? 0;

		// Byte 2: pack type + orient + legacy flags (bits 4-7)
		// bits 4-5: elevLevel (2 bits: 0=ground, 1=2.5m, 2=5m)
		// bit 6: curveOverride (1=force hard corner)
		// bit 7: rotationOverride (1=manual rotation)
		let flagBits = 0;
		// Byte 3 (flags2): bit 0 = rampStyle (0=steep, 1=smooth)
		let flags2 = 0;
		if ( flags ) {

			const elev = flags.elevation ?? 0;
			const curve = flags.curveOverride ? 1 : 0;
			const rot = flags.rotationOverride ? 1 : 0;
			flagBits = ( elev & 0x03 ) | ( curve << 2 ) | ( rot << 3 );

			if ( flags.rampStyle === 'smooth' ) flags2 |= 1;

			// bits 1-3: curveVariant (0=none, 1=2x2-wide, 2=2x2-tight, 3=3x3, 4=3x3-wide)
			const CURVE_VARIANT_ENCODE = { '2x2-wide': 1, '2x2-tight': 2, '3x3': 3, '3x3-wide': 4 };
			if ( flags.curveVariant && CURVE_VARIANT_ENCODE[ flags.curveVariant ] ) {

				flags2 |= ( CURVE_VARIANT_ENCODE[ flags.curveVariant ] << 1 );

			}

		}

		bytes[ i * 4 ] = gx + 128;
		bytes[ i * 4 + 1 ] = gz + 128;
		bytes[ i * 4 + 2 ] = ( flagBits << 4 ) | ( ti << 2 ) | oi;
		bytes[ i * 4 + 3 ] = flags2;

	}

	return 'v2:' + bytesToBase64url( bytes );

}

export function decodeCells( str ) {

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
	const binary = atob( base64 );
	const bytes = new Uint8Array( binary.length );
	for ( let i = 0; i < binary.length; i ++ ) bytes[ i ] = binary.charCodeAt( i );

	return bytes;

}
