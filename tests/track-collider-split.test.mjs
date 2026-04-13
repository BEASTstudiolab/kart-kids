import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
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

function loadGLTFScene( relPath ) {

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

	const scene = new THREE.Group();

	for ( const nodeDef of ( gltf.nodes || [] ) ) {

		if ( nodeDef.mesh == null ) continue;

		const meshDef = gltf.meshes[ nodeDef.mesh ];
		const node = new THREE.Group();

		if ( nodeDef.translation ) node.position.fromArray( nodeDef.translation );
		if ( nodeDef.rotation ) node.quaternion.fromArray( nodeDef.rotation );
		if ( nodeDef.scale ) node.scale.fromArray( nodeDef.scale );

		for ( const primitive of ( meshDef.primitives || [] ) ) {

			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute(
				'position',
				new THREE.BufferAttribute( new Float32Array( readAccessor( primitive.attributes.POSITION ) ), 3 ),
			);

			if ( primitive.indices != null ) {

				geometry.setIndex( Array.from( readAccessor( primitive.indices ) ) );

			}

			node.add( new THREE.Mesh( geometry, new THREE.MeshBasicMaterial() ) );

		}

		scene.add( node );

	}

	scene.updateMatrixWorld( true );
	return scene;

}

function summarizeFile( relPath ) {

	const records = loadGLTFPrimitiveRecords( relPath );
	const summary = {
		supportTriangles: 0,
		blockerTriangles: 0,
		classifications: [],
		supportCentroids: [],
		blockerCentroids: [],
	};

	for ( const record of records ) {

		const classification = classifyTrackPrimitiveTriangles( record.positions, record.indices, { tileKey: relPath } );
		summary.classifications.push( classification );
		summary.supportTriangles += classification.supportIndices.length / 3;
		summary.blockerTriangles += classification.blockerIndices.length / 3;
		summary.supportCentroids.push( ...collectTriangleCentroids( record.positions, classification.supportIndices ) );
		summary.blockerCentroids.push( ...collectTriangleCentroids( record.positions, classification.blockerIndices ) );

	}

	return summary;

}

function collectTriangleCentroids( positions, indices ) {

	const centroids = [];

	for ( let i = 0; i < indices.length; i += 3 ) {

		const ia = indices[ i ] * 3;
		const ib = indices[ i + 1 ] * 3;
		const ic = indices[ i + 2 ] * 3;
		centroids.push( {
			x: ( positions[ ia ] + positions[ ib ] + positions[ ic ] ) / 3,
			y: ( positions[ ia + 1 ] + positions[ ib + 1 ] + positions[ ic + 1 ] ) / 3,
			z: ( positions[ ia + 2 ] + positions[ ib + 2 ] + positions[ ic + 2 ] ) / 3,
		} );

	}

	return centroids;

}

function buildSceneFromRecords( records ) {

	const scene = new THREE.Group();

	for ( const record of records ) {

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.BufferAttribute( record.positions, 3 ) );
		geometry.setIndex( Array.from( record.indices ) );
		scene.add( new THREE.Mesh( geometry, new THREE.MeshBasicMaterial() ) );

	}

	scene.updateMatrixWorld( true );
	return scene;

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

test( 'short jump tile keeps launch support while clearing the crest center lane', () => {

	const summary = summarizeFile( 'models/standard-map/kartkids_base_trk_480_jmp_01_short_25pct_1x1.gltf' );

	assert.ok( summary.supportTriangles > 0, 'expected jump launch support triangles' );
	assert.ok( summary.blockerTriangles > 0, 'expected jump side blocker triangles' );
	assert.equal(
		summary.blockerCentroids.filter( ( centroid ) => Math.abs( centroid.x ) < 0.5 && centroid.z > 1.0 ).length,
		0,
		'expected the jump crest center lane to remain clear of blocker triangles'
	);
	assert.ok(
		summary.blockerCentroids.some( ( centroid ) => Math.abs( centroid.x ) > 1.0 ),
		'expected jump side rails to remain blocker geometry'
	);
	assert.equal(
		summary.supportCentroids.filter( ( centroid ) => Math.abs( centroid.x ) < 0.6 && centroid.z > 0.5 && centroid.y > 0.8 ).length,
		0,
		'expected the short jump crest cap to stay out of support geometry'
	);

} );

test( 'long jump tile keeps support while preserving side blocker faces', () => {

	const summary = summarizeFile( 'models/standard-map/kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1.gltf' );

	assert.ok( summary.supportTriangles > 0, 'expected long jump launch support triangles' );
	assert.ok( summary.blockerTriangles > 0, 'expected long jump side blocker triangles' );
	assert.equal(
		summary.blockerCentroids.filter( ( centroid ) => Math.abs( centroid.x ) < 0.5 && centroid.z > 1.0 ).length,
		0,
		'expected the long jump center lane to remain clear of blocker triangles'
	);
	assert.ok(
		summary.blockerCentroids.some( ( centroid ) => Math.abs( centroid.x ) > 1.0 ),
		'expected long jump side rails to remain blocker geometry'
	);

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

test( 'back-to-back long jumps keep support geometry across the shared seam', () => {

	const scene = buildSceneFromRecords(
		loadGLTFPrimitiveRecords( 'models/standard-map/kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1.gltf' )
	);
	const geometry = buildTrackCollisionGeometry( {
		'trk-jump-long': scene,
	}, [
		[ 0, 0, 'trk-jump-long', 0 ],
		[ 0, 1, 'trk-jump-long', 0 ],
	] );

	const seamVertices = [];
	for ( let i = 0; i < geometry.supportPositions.length; i += 3 ) {

		const x = geometry.supportPositions[ i ];
		const y = geometry.supportPositions[ i + 1 ];
		const z = geometry.supportPositions[ i + 2 ];
		if ( Math.abs( z - 10 ) < 0.05 && Math.abs( x ) < 5.05 ) {

			seamVertices.push( { x, y, z } );

		}

	}

	assert.ok( seamVertices.length > 0, 'expected support vertices at the seam between consecutive long jumps' );
	assert.ok(
		seamVertices.some( ( vertex ) => vertex.y > 2.2 ),
		'expected elevated landing support at the long-jump seam'
	);

} );

test( 'straight tile wall extension stays on the outside shell and remains symmetric', () => {

	const models = {
		'trk-straight': loadGLTFScene( 'models/standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf' ),
	};

	const geometry = buildTrackCollisionGeometry( models, [
		[ 0, 0, 'trk-straight', 0 ],
	] );
	const barrierCentroids = collectTriangleCentroids( geometry.barrierPositions, geometry.barrierIndices )
		.map( ( centroid ) => ( {
			x: centroid.x - 5,
			z: centroid.z - 5,
		} ) );

	assert.ok( barrierCentroids.length > 0, 'expected straight tile barrier extension geometry' );
	assert.ok(
		barrierCentroids.every( ( centroid ) => Math.abs( centroid.x ) >= 4.49 ),
		'expected barrier triangles to stay on the outside wall band'
	);

	const leftCount = barrierCentroids.filter( ( centroid ) => centroid.x < 0 ).length;
	const rightCount = barrierCentroids.filter( ( centroid ) => centroid.x > 0 ).length;
	assert.equal( leftCount, rightCount, 'expected barrier extension counts to match on both sides' );

} );
