import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
	collectVehiclePaintTargetsFromObject3D,
	inspectRuntimeVehiclePaintMaterial,
	inspectVehiclePaintMaterialDefinition,
	isVehicleBodyMeshName,
	summarizeVehiclePaintabilityFromGltf,
} from '../js/vehicle/vehiclePaintInspection.js';

function createRuntimeMaterial( { name = 'car 1', mapSrc = '' } = {} ) {

	return {
		name,
		map: mapSrc ? { source: { data: { src: mapSrc } } } : null,
	};

}

function loadVehicleGltf( fileName ) {

	return JSON.parse(
		fs.readFileSync(
			new URL( `../models/vehicles/${ fileName }`, import.meta.url ),
			'utf8'
		)
	);

}

test( 'isVehicleBodyMeshName recognizes the current kart body mesh names', () => {

	assert.equal( isVehicleBodyMeshName( 'Body' ), true );
	assert.equal( isVehicleBodyMeshName( 'body.002' ), true );
	assert.equal( isVehicleBodyMeshName( 'Underbody' ), false );
	assert.equal( isVehicleBodyMeshName( 'wheel-front-left' ), false );

} );

test( 'inspectVehiclePaintMaterialDefinition reports texture-multiply tinting for textured body materials', () => {

	const report = inspectVehiclePaintMaterialDefinition( {
		name: 'car 1',
		pbrMetallicRoughness: {
			baseColorTexture: { index: 1 },
		},
	}, {
		textures: [
			null,
			{ source: 0 },
		],
		images: [
			{ uri: 'textures/cars_car 1_BaseColor.1001.webp' },
		],
	} );

	assert.equal( report.materialName, 'car 1' );
	assert.equal( report.hasBaseColorTexture, true );
	assert.equal( report.baseColorImageUri, 'textures/cars_car 1_BaseColor.1001.webp' );
	assert.equal( report.tintMode, 'texture-multiply' );

} );

test( 'inspectRuntimeVehiclePaintMaterial reports runtime texture-backed tinting when a map is present', () => {

	const report = inspectRuntimeVehiclePaintMaterial( createRuntimeMaterial( {
		name: 'car 1',
		mapSrc: 'http://localhost:3000/models/vehicles/textures/cars_car%201_BaseColor.1001.webp',
	} ) );

	assert.equal( report.materialName, 'car 1' );
	assert.equal( report.hasBaseColorTexture, true );
	assert.match( report.baseColorTextureUri, /BaseColor/ );
	assert.equal( report.tintMode, 'texture-multiply' );

} );

test( 'collectVehiclePaintTargetsFromObject3D only returns body meshes', () => {

	const bodyMaterial = createRuntimeMaterial( {
		name: 'car 1',
		mapSrc: 'textures/cars_car 1_BaseColor.1001.webp',
	} );
	const wheelMaterial = createRuntimeMaterial( { name: 'wheel' } );
	const root = {
		traverse( visit ) {

			visit( {
				isMesh: true,
				name: 'Body',
				material: bodyMaterial,
			} );
			visit( {
				isMesh: true,
				name: 'wheel-front-left',
				material: wheelMaterial,
			} );

		},
	};

	const targets = collectVehiclePaintTargetsFromObject3D( root );

	assert.equal( targets.length, 1 );
	assert.equal( targets[ 0 ].meshName, 'Body' );
	assert.equal( targets[ 0 ].materials.length, 1 );
	assert.equal( targets[ 0 ].materials[ 0 ].tintMode, 'texture-multiply' );

} );

test( 'representative kart assets use body meshes backed by BaseColor textures', () => {

	for ( const fileName of [
		'BaseRaceKart1.gltf',
		'BaseRaceKart2.gltf',
		'BaseRaceKart3.gltf',
	] ) {

		const summary = summarizeVehiclePaintabilityFromGltf( loadVehicleGltf( fileName ) );

		assert.ok( summary.bodyMeshCount >= 1, `${ fileName } should expose at least one body mesh` );
		assert.equal( summary.usesTexturedBaseColor, true );
		assert.equal( summary.supportsFlatTintWithoutTexture, false );

		for ( const meshReport of summary.bodyMeshes ) {

			assert.ok( meshReport.materials.length >= 1, `${ fileName } should expose at least one body material` );
			for ( const materialReport of meshReport.materials ) {

				assert.equal( materialReport.hasBaseColorTexture, true );
				assert.match( materialReport.baseColorImageUri, /BaseColor/i );
				assert.equal( materialReport.tintMode, 'texture-multiply' );

			}

		}

	}

} );
