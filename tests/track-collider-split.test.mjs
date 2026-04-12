import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
	buildTrackCollisionGeometry,
	classifyTrackPrimitiveTriangles,
} from '../js/Physics.js';

const ROOT = process.cwd();

function loadGLTFPrimitiveRecords( relPath ) {

	const absPath = path.join( ROOT, relPath );
	const dir = path.dirname( absPath );
	const gltf = JSON.parse( fs.readFileSync( absPath, 'utf8' ) );
	const buffers = ( gltf.buffers || [] ).map( ( bufferDef ) =>
		fs.readFileSync( path.join( dir, bufferDef.uri ) )
	);

	function readAccessor( accessorIndex ) {

		const accessor = gltf.accessors[ accessorIndex ];
		const bufferView = gltf.bufferViews[ accessor.bufferView ];
		const buffer = buffers[ bufferView.buffer ];
		const itemSize = {
			SCALAR: 1,
			VEC2: 2,
			VEC3: 3,
			VEC4: 4,
		}[ accessor.type ];
		const componentSize = {
			5126: 4,
			5125: 4,
			5123: 2,
			5121: 1,
		}[ accessor.componentType ];
		const byteOffset = ( bufferView.byteOffset || 0 ) + ( accessor.byteOffset || 0 );
		const byteLength = accessor.count * itemSize * componentSize;
		const slice = buffer.subarray( byteOffset, byteOffset + byteLength );

		if ( accessor.componentType === 5126 ) {

			return new Float32Array( slice.buffer, slice.byteOffset, slice.byteLength / 4 );

		}

		if ( accessor.componentType === 5125 ) {

			return new Uint32Array( slice.buffer, slice.byteOffset, slice.byteLength / 4 );

		}

		if ( accessor.componentType === 5123 ) {

			return new Uint16Array( slice.buffer, slice.byteOffset, slice.byteLength / 2 );

		}

		return new Uint8Array( slice.buffer, slice.byteOffset, slice.byteLength );

	}

	const records = [];

	for ( const mesh of ( gltf.meshes || [] ) ) {

		for ( const primitive of ( mesh.primitives || [] ) ) {

			records.push( {
				materialName: gltf.materials?.[ primitive.material ]?.name || '',
				positions: readAccessor( primitive.attributes.POSITION ),
				indices: readAccessor( primitive.indices ),
			} );

		}

	}

	return records;

}

function summarizeFile( relPath ) {

	const records = loadGLTFPrimitiveRecords( relPath );
	const summary = {
		supportTriangles: 0,
		blockerTriangles: 0,
		classifications: [],
	};

	for ( const record of records ) {

		const classification = classifyTrackPrimitiveTriangles( record.positions, record.indices );
		summary.classifications.push( classification );
		summary.supportTriangles += classification.supportIndices.length / 3;
		summary.blockerTriangles += classification.blockerIndices.length / 3;

	}

	return summary;

}

test( 'straight tile excludes wall shell from support while keeping blocker faces', () => {

	const summary = summarizeFile( 'models/standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf' );

	assert.ok( summary.supportTriangles > 0, 'expected driveable support triangles for the straight road' );
	assert.ok( summary.blockerTriangles > 0, 'expected blocker faces for straight walls' );
	assert.ok(
		summary.classifications.some( ( entry ) => entry.isElevatedClosedShell ),
		'expected at least one straight primitive to be classified as a closed wall shell'
	);

} );

test( 'ramp tile keeps ramp surface support while excluding shell geometry from support', () => {

	const summary = summarizeFile( 'models/standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf' );

	assert.ok( summary.supportTriangles > 0, 'expected ramp surface support triangles' );
	assert.ok( summary.blockerTriangles > 0, 'expected ramp side blocker triangles' );
	assert.ok(
		summary.classifications.some( ( entry ) => entry.isElevatedClosedShell ),
		'expected the ramp shell primitive to be treated as a closed shell'
	);

} );

test( 'jump tile keeps jump launch surface support while preserving blocker faces', () => {

	const summary = summarizeFile( 'models/standard-map/kartkids_base_trk_480_jmp_01_short_25pct_1x1.gltf' );

	assert.ok( summary.supportTriangles > 0, 'expected jump launch support triangles' );
	assert.ok( summary.blockerTriangles > 0, 'expected jump side blocker triangles' );

} );

test( 'tunnel tile excludes structural shell triangles from support', () => {

	const summary = summarizeFile( 'models/standard-map/kartkids_base_trk_430_tun_closed_mid_1x1.gltf' );

	assert.ok( summary.supportTriangles > 0, 'expected tunnel road support triangles' );
	assert.ok( summary.blockerTriangles > 0, 'expected tunnel wall blocker triangles' );
	assert.ok(
		summary.classifications.some( ( entry ) => entry.isElevatedClosedShell ),
		'expected tunnel structure to be classified as a closed shell'
	);

} );

test( 'collision-only cells contribute support geometry and no blocker geometry', () => {

	const cells = [
		[ 0, 0, 'trk-straight', 0, { _collisionOnly: true } ],
	];

	const geometry = buildTrackCollisionGeometry( {}, cells );

	assert.equal( geometry.supportIndices.length / 3, 2 );
	assert.equal( geometry.blockerIndices.length / 3, 0 );

} );
