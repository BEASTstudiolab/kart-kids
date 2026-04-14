import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

function readJson( relPath ) {

	return JSON.parse( readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' ) );

}

function getTextureUri( gltf, textureIndex ) {

	const textureDef = gltf.textures?.[ textureIndex ];
	assert.ok( textureDef, `Missing texture definition at index ${ textureIndex }` );

	const imageDef = gltf.images?.[ textureDef.source ];
	assert.ok( imageDef, `Missing image definition for texture index ${ textureIndex }` );
	return imageDef.uri;

}

test( 'standard-map GLTFs share packed ORM textures between metallic-roughness and occlusion', () => {

	const trackFiles = readdirSync( new URL( '../models/standard-map/', import.meta.url ) )
		.filter( ( fileName ) => fileName.endsWith( '.gltf' ) )
		.sort();

	assert.equal( trackFiles.length > 0, true, 'expected at least one standard-map glTF asset' );

	const unexpectedFailures = [];

	for ( const fileName of trackFiles ) {

		const gltf = readJson( `models/standard-map/${ fileName }` );
		const ormMaterials = ( gltf.materials || [] ).filter( ( material ) =>
			material?.pbrMetallicRoughness?.metallicRoughnessTexture
		);

		assert.equal( ormMaterials.length > 0, true, `${ fileName } should expose at least one ORM-backed material` );

		for ( const materialDef of ormMaterials ) {

			const ormIndex = materialDef.pbrMetallicRoughness.metallicRoughnessTexture.index;
			const occlusionIndex = materialDef.occlusionTexture?.index;
			const ormUri = getTextureUri( gltf, ormIndex );
			const occlusionUri = occlusionIndex === undefined ? '' : getTextureUri( gltf, occlusionIndex );

			if ( occlusionIndex !== ormIndex || occlusionUri !== ormUri ) {

				unexpectedFailures.push(
					`${ fileName}: ${ materialDef.name || 'unnamed-material' } orm=${ ormUri || 'missing' } ao=${ occlusionUri || 'missing' }`
				);

			}

		}

	}

	assert.deepEqual(
		unexpectedFailures,
		[],
		'Unexpected standard-map ORM/occlusion metadata gaps:\n' + unexpectedFailures.join( '\n' )
	);

} );
