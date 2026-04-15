import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readJson( relPath ) {

	return JSON.parse( readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' ) );

}

test( 'character body mesh exposes the Blink morph target in the menu character asset', () => {

	const gltf = readJson( 'models/characters/Kart_Beast_Rest-Armature.gltf' );
	const blinkBodyMesh = ( gltf.meshes || [] ).find( ( mesh ) => (
		typeof mesh?.name === 'string' &&
		mesh.name.startsWith( 'Body' ) &&
		mesh?.extras?.targetNames?.includes( 'Blink' )
	) );

	assert.ok( blinkBodyMesh, 'expected a body mesh with a Blink target' );
	assert.ok( Array.isArray( blinkBodyMesh.primitives ) && blinkBodyMesh.primitives.length > 0, 'expected blink mesh primitives' );
	assert.ok(
		blinkBodyMesh.primitives.every( ( primitive ) => Array.isArray( primitive.targets ) && primitive.targets.length > 0 ),
		'expected every blink mesh primitive to expose morph target data'
	);

} );
