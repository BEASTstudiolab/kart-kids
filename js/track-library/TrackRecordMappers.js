import { V4_TYPE_NAMES, V4_TO_INTERNAL, ELEV_GROUND, CURVE_VARIANT_DECODE } from '../track-editor/models/TrackV4Format.js';

export function makeOfficialTrackId( id ) {

	return id;

}

export function makeSpotlightTrackId( entryId ) {

	return `spotlight:${ entryId }`;

}

export function makePublishedTrackId( publicId ) {

	return `published:${ publicId }`;

}

export function makeSavedTrackId( localId ) {

	return `saved:${ localId }`;

}

export function encodeV4ToUrlPayload( v4 ) {

	const json = JSON.stringify( v4 );
	const bytes = new TextEncoder().encode( json );
	let binary = '';
	for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );
	return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

}

export function decodeV4UrlPayload( encoded ) {

	const bytes = atob( encoded.replace( /-/g, '+' ).replace( /_/g, '/' ) );
	const json = new TextDecoder().decode( Uint8Array.from( bytes, ( c ) => c.charCodeAt( 0 ) ) );
	return JSON.parse( json );

}

export function v4ToCells( v4 ) {

	const cells = [];

	for ( const entry of ( v4.trackTiles || [] ) ) {

		const type = V4_TYPE_NAMES[ entry.t ] ?? 'trk-straight';
		const orient = V4_TO_INTERNAL[ entry.o ] ?? 0;
		const elevStep = entry.e ?? ELEV_GROUND;

		const flags = {};
		const stepsAbove = elevStep - ELEV_GROUND;
		if ( stepsAbove === 1 ) flags.elevation = 1;
		else if ( stepsAbove >= 2 ) flags.elevation = 2;
		flags.fullElevation = elevStep;

		const f = entry.f ?? 0;
		if ( f & 0x01 ) flags.curveOverride = true;
		if ( f & 0x02 ) flags.rotationOverride = true;
		if ( f & 0x04 ) flags.rampStyle = 'smooth';

		const cvCode = ( f >> 3 ) & 0x07;
		if ( cvCode && CURVE_VARIANT_DECODE[ cvCode ] ) flags.curveVariant = CURVE_VARIANT_DECODE[ cvCode ];

		cells.push( [ entry.gx, entry.gz, type, orient, flags ] );

	}

	return cells;

}

export function createPublicSnapshotRecord( track ) {

	const localId = globalThis.crypto?.randomUUID?.() ?? `saved-${ Date.now() }-${ Math.random().toString( 36 ).slice( 2, 8 ) }`;
	const savedAt = new Date().toISOString();
	const trackData = JSON.parse( JSON.stringify( track.trackData ) );

	return {
		id: localId,
		trackId: makeSavedTrackId( localId ),
		publicId: track.publicId,
		versionId: track.currentVersionId,
		title: track.title,
		name: track.title,
		creatorName: track.creatorName,
		savedAt,
		trackData,
		cells: v4ToCells( trackData ),
		source: track.publicId ? 'published' : 'local',
	};

}

export function createOfficialTrackRecord( track ) {

	return {
		id: track.id,
		trackId: makeOfficialTrackId( track.id ),
		title: track.name,
		name: track.name,
		difficulty: track.difficulty,
		cells: track.cells,
		decoCells: track.decoCells,
		source: 'official',
	};

}
