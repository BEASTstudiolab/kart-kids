import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLAYER_VEHICLES } from '../../js/VehicleRegistry.js';

const REQUIRED_DAMAGE_MORPHS = [
	'Damage_Front_Left',
	'Damage_Front_Right',
	'Damage_Back_Left',
	'Damage_Back_Right',
];

const ALLOWED_FALLBACK_KARTS = new Set( [ 'kart-8' ] );

function getSupportStatus( matchCount ) {

	if ( matchCount >= REQUIRED_DAMAGE_MORPHS.length ) return 'full';
	if ( matchCount > 0 ) return 'partial';
	return 'none';

}

function isBodyLikeMeshName( name = '' ) {

	const lower = name.toLowerCase();
	return lower === 'body' || lower.startsWith( 'body.' ) || lower.includes( 'body' );

}

function analyzeDamageMorphSupport( gltf ) {

	const meshes = Array.isArray( gltf.meshes ) ? gltf.meshes : [];
	let best = null;

	for ( let i = 0; i < meshes.length; i ++ ) {

		const mesh = meshes[ i ];
		const targetNames = Array.isArray( mesh?.extras?.targetNames ) ? mesh.extras.targetNames : [];
		const matchedMorphNames = REQUIRED_DAMAGE_MORPHS.filter( ( name ) => targetNames.includes( name ) );
		const candidate = {
			meshName: mesh?.name || `mesh-${ i }`,
			matchedMorphNames,
			missingMorphNames: REQUIRED_DAMAGE_MORPHS.filter( ( name ) => ! targetNames.includes( name ) ),
			matchCount: matchedMorphNames.length,
			targetNames,
			bodyLike: isBodyLikeMeshName( mesh?.name || '' ),
			order: i,
		};

		if ( ! best ||
			candidate.matchCount > best.matchCount ||
			( candidate.matchCount === best.matchCount && candidate.bodyLike && ! best.bodyLike ) ) {

			best = candidate;

		}

	}

	if ( ! best ) {

		return {
			status: 'none',
			meshName: null,
			matchedMorphNames: [],
			missingMorphNames: [ ...REQUIRED_DAMAGE_MORPHS ],
		};

	}

	return {
		status: getSupportStatus( best.matchCount ),
		meshName: best.meshName,
		matchedMorphNames: best.matchedMorphNames,
		missingMorphNames: best.missingMorphNames,
	};

}

describe( 'Vehicle damage morph asset audit', () => {

	it( 'requires full support for all player karts except the explicit fallback allowlist', async () => {

		const reports = await Promise.all( PLAYER_VEHICLES.map( async ( vehicle ) => {

			const text = await readFile( new URL( `../../models/${ vehicle.path }`, import.meta.url ), 'utf8' );
			const gltf = JSON.parse( text );
			return {
				id: vehicle.id,
				...analyzeDamageMorphSupport( gltf ),
			};

		} ) );

		const unexpectedFailures = reports.filter( ( report ) =>
			! ALLOWED_FALLBACK_KARTS.has( report.id ) && report.status !== 'full'
		);

		assert.deepEqual(
			unexpectedFailures,
			[],
			'Unexpected damage morph gaps:\n' +
			unexpectedFailures.map( ( report ) =>
				`${ report.id}: ${ report.status } on ${ report.meshName ?? 'none' } (missing ${ report.missingMorphNames.join( ', ' ) })`
			).join( '\n' )
		);

		const fallbackReports = reports.filter( ( report ) => ALLOWED_FALLBACK_KARTS.has( report.id ) );
		assert.equal( fallbackReports.length, ALLOWED_FALLBACK_KARTS.size );

		const kart8 = fallbackReports.find( ( report ) => report.id === 'kart-8' );
		assert.ok( kart8, 'kart-8 should remain visible as the known fallback exception' );
		assert.equal( kart8.status, 'none' );
		assert.equal( kart8.meshName, 'Body.003' );
		assert.deepEqual( kart8.missingMorphNames, REQUIRED_DAMAGE_MORPHS );

	} );

} );
