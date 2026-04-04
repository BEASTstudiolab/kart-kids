import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRACK_CELLS, CELL_RAW } from '../js/Track.js';

const MODEL_CONFIGS = {
	legacy: {
		'track-straight-night': { path: 'models/track-straight-night.glb', rotationY: 0 },
		'track-corner-night': { path: 'models/track-corner-night.glb', rotationY: 0 },
		'track-finish': { path: 'models/track-finish.glb', rotationY: 0 },
	},
	standard: {
		'track-straight-night': { path: 'models/standard-map/kartkids_base_trk_010_rd_straight_1x1.glb', rotationY: Math.PI / 2 },
		'track-corner-night': { path: 'models/standard-map/kartkids_base_trk_020_trn_90_l_1x1.glb', rotationY: Math.PI },
		'track-finish': { path: 'models/track-finish.glb', rotationY: 0 },
	},
};

function readGLB( path ) {

	const buf = readFileSync( path );
	let offset = 12;
	const jsonLength = buf.readUInt32LE( offset );
	offset += 4;
	offset += 4;
	const gltf = JSON.parse( buf.toString( 'utf8', offset, offset + jsonLength ) );
	offset += jsonLength;
	while ( offset % 4 ) offset ++;
	const binLength = buf.readUInt32LE( offset );
	offset += 4;
	offset += 4;
	return { gltf, bin: buf.subarray( offset, offset + binLength ) };

}

function readPositions( gltf, bin, accessorIndex ) {

	const accessor = gltf.accessors[ accessorIndex ];
	const view = gltf.bufferViews[ accessor.bufferView ];
	const offset = ( view.byteOffset || 0 ) + ( accessor.byteOffset || 0 );
	const stride = view.byteStride || 12;
	const positions = [];

	for ( let i = 0; i < accessor.count; i ++ ) {

		const base = offset + i * stride;
		positions.push( [
			bin.readFloatLE( base ),
			bin.readFloatLE( base + 4 ),
			bin.readFloatLE( base + 8 ),
		] );

	}

	return positions;

}

function rotateY( point, radians ) {

	const c = Math.cos( radians );
	const s = Math.sin( radians );
	return [
		point[ 0 ] * c + point[ 2 ] * s,
		point[ 1 ],
		-point[ 0 ] * s + point[ 2 ] * c,
	];

}

function getLocalBounds( config ) {

	const { gltf, bin } = readGLB( config.path );
	let minX = Infinity;
	let maxX = - Infinity;
	let minZ = Infinity;
	let maxZ = - Infinity;

	for ( const node of gltf.nodes ) {

		if ( node.mesh === undefined ) continue;
		const mesh = gltf.meshes[ node.mesh ];

		for ( const prim of mesh.primitives ) {

			const positions = readPositions( gltf, bin, prim.attributes.POSITION );

			for ( const position of positions ) {

				const rotated = rotateY( position, config.rotationY );
				minX = Math.min( minX, rotated[ 0 ] );
				maxX = Math.max( maxX, rotated[ 0 ] );
				minZ = Math.min( minZ, rotated[ 2 ] );
				maxZ = Math.max( maxZ, rotated[ 2 ] );

			}

		}

	}

	return { minX, maxX, minZ, maxZ };

}

function getPositiveGaps( setName ) {

	const boundsCache = new Map();
	const cells = TRACK_CELLS.map( ( [ gx, gz, key ] ) => {

		const cacheKey = `${ setName }:${ key }`;
		const localBounds = boundsCache.get( cacheKey ) || getLocalBounds( MODEL_CONFIGS[ setName ][ key ] );
		boundsCache.set( cacheKey, localBounds );
		const centerX = ( gx + 0.5 ) * CELL_RAW;
		const centerZ = ( gz + 0.5 ) * CELL_RAW;

		return {
			gx,
			gz,
			minX: centerX + localBounds.minX,
			maxX: centerX + localBounds.maxX,
			minZ: centerZ + localBounds.minZ,
			maxZ: centerZ + localBounds.maxZ,
		};

	} );

	const gaps = [];

	for ( const a of cells ) {

		for ( const b of cells ) {

			if ( a === b ) continue;

			if ( a.gz === b.gz && b.gx === a.gx + 1 ) {

				gaps.push( b.minX - a.maxX );

			}

			if ( a.gx === b.gx && b.gz === a.gz + 1 ) {

				gaps.push( b.minZ - a.maxZ );

			}

		}

	}

	return gaps;

}

test( 'track cell spacing is locked to 10 meters', () => {

	assert.equal( CELL_RAW, 10.0 );

} );

for ( const setName of [ 'legacy', 'standard' ] ) {

	test( `${ setName } track assets do not introduce positive gaps between adjacent cells`, () => {

		const positiveGap = Math.max( ...getPositiveGaps( setName ) );
		assert.ok( positiveGap <= 0.00001, `expected no positive gap, saw ${ positiveGap }` );

	} );

}
