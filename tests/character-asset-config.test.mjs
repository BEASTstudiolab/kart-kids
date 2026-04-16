import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
	BALACLAVA_OPTIONS,
	CHARACTER_ACCESSORY_DEFS,
	CHARACTER_GARAGE_IDLE_ANIMATION_PATH,
	CHARACTER_MODEL_PATH,
	MASK_TINT_TEXTURE_PATH,
} from '../js/CharacterCustomization.js';

function getTextureImageUri( gltf, textureIndex ) {

	const textureDef = gltf?.textures?.[ textureIndex ];
	const imageIndex = textureDef?.source;
	return gltf?.images?.[ imageIndex ]?.uri || '';

}

test( 'configured balaclava and accessory mesh or material targets exist in the character gltf', async () => {

	const raw = await readFile( new URL( `../models/${ CHARACTER_MODEL_PATH }`, import.meta.url ), 'utf8' );
	const gltf = JSON.parse( raw );
	const availableNames = new Set( [
		...( gltf.nodes || [] ).map( ( node ) => node.name ).filter( Boolean ),
		...( gltf.meshes || [] ).map( ( mesh ) => mesh.name ).filter( Boolean ),
		...( gltf.materials || [] ).map( ( material ) => material.name ).filter( Boolean ),
	] );

	for ( const option of BALACLAVA_OPTIONS ) {

		assert.ok( availableNames.has( option.meshName ), `missing balaclava mesh "${ option.meshName }"` );

	}

	for ( const accessory of CHARACTER_ACCESSORY_DEFS ) {

		for ( const meshName of accessory.meshes || [] ) {

			assert.ok( availableNames.has( meshName ), `missing accessory mesh "${ meshName }"` );

		}

		for ( const materialName of accessory.materials || [] ) {

			assert.ok( availableNames.has( materialName ), `missing accessory material "${ materialName }"` );

		}

	}

	assert.equal( availableNames.has( 'Mask_Basic' ), false );

} );

test( 'character boots material is authored on the body mesh primitive', async () => {

	const raw = await readFile( new URL( `../models/${ CHARACTER_MODEL_PATH }`, import.meta.url ), 'utf8' );
	const gltf = JSON.parse( raw );
	const bootsMaterialIndex = ( gltf.materials || [] ).findIndex( ( material ) => material?.name === 'Boots' );

	assert.notEqual( bootsMaterialIndex, - 1, 'missing Boots material' );

	const bootsMesh = ( gltf.meshes || [] ).find( ( mesh ) =>
		( mesh.primitives || [] ).some( ( primitive ) => primitive?.material === bootsMaterialIndex )
	);

	assert.ok( bootsMesh, 'missing mesh primitive using the Boots material' );
	assert.equal( bootsMesh.name, 'Body.002' );

} );

test( 'garage idle animation and tint mask assets exist', async () => {

	const [ idleAnimationRaw, tintMaskRaw ] = await Promise.all( [
		readFile( new URL( `../models/${ CHARACTER_GARAGE_IDLE_ANIMATION_PATH }`, import.meta.url ) ),
		readFile( new URL( `../models/${ MASK_TINT_TEXTURE_PATH }`, import.meta.url ) ),
	] );

	assert.ok( idleAnimationRaw.byteLength > 0, 'garage idle animation file is empty' );
	assert.ok( tintMaskRaw.byteLength > 0, 'tint mask texture file is empty' );

} );

test( 'character mask material wires the packed ORM texture for both metal-rough and occlusion', async () => {

	const raw = await readFile( new URL( `../models/${ CHARACTER_MODEL_PATH }`, import.meta.url ), 'utf8' );
	const gltf = JSON.parse( raw );
	const maskMaterial = ( gltf.materials || [] ).find( ( material ) => material?.name === 'Masks Batch ' );

	assert.ok( maskMaterial, 'missing character mask material' );
	assert.ok( maskMaterial.normalTexture, 'missing character normal texture metadata' );
	assert.ok( maskMaterial.pbrMetallicRoughness?.baseColorTexture, 'missing character base color texture metadata' );
	assert.ok( maskMaterial.pbrMetallicRoughness?.metallicRoughnessTexture, 'missing character metallic-roughness texture metadata' );
	assert.ok( maskMaterial.occlusionTexture, 'missing character occlusion texture metadata' );

	const ormTextureIndex = maskMaterial.pbrMetallicRoughness.metallicRoughnessTexture.index;
	const occlusionTextureIndex = maskMaterial.occlusionTexture.index;
	const ormUri = getTextureImageUri( gltf, ormTextureIndex );
	const occlusionUri = getTextureImageUri( gltf, occlusionTextureIndex );

	assert.equal( ormTextureIndex, occlusionTextureIndex, 'character occlusion texture should reuse the ORM texture slot' );
	assert.equal( ormUri, 'textures/Masks_OcclusionRoughnessMetallic.png' );
	assert.equal( occlusionUri, ormUri, 'character occlusion texture should resolve to the packed ORM image' );

} );
