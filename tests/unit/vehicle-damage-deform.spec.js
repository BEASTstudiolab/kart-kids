import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VehicleDamageDeform } from '../../js/vehicle/VehicleDamageDeform.js';
import { QUADRANT } from '../../js/vehicle/VehicleHealth.js';

function createMesh( name, morphTargetDictionary ) {

	const indices = Object.values( morphTargetDictionary || {} );
	const influenceCount = indices.length > 0 ? Math.max( ...indices ) + 1 : 0;

	return {
		name,
		isMesh: true,
		children: [],
		morphTargetDictionary,
		morphTargetInfluences: new Array( influenceCount ).fill( 0 ),
	};

}

function createNode( name, children = [] ) {

	return {
		name,
		children,
	};

}

describe( 'VehicleDamageDeform', () => {

	it( 'selects the mesh with the strongest canonical damage morph match', () => {

		const weakMatch = createMesh( 'wheel-front-left', {
			'Damage_Front_Left': 0,
		} );

		const strongMatch = createMesh( 'Body', {
			'Damage_Front_Left': 0,
			'Damage_Front_Right': 1,
			'Damage_Back_Left': 2,
			'Damage_Back_Right': 3,
			'Smile': 4,
		} );

		const deform = new VehicleDamageDeform();
		deform.init( createNode( 'kart-root', [
			weakMatch,
			createNode( 'nested', [ strongMatch ] ),
		] ), 'unit-strongest-match' );

		const report = deform.getSupportReport();
		assert.equal( report.status, 'full' );
		assert.equal( report.meshName, 'Body' );
		assert.deepEqual( report.missingMorphNames, [] );

		deform.setDebugOverride( true );
		deform.setDebugValue( QUADRANT.FL, 1.0 );
		deform.setDebugValue( QUADRANT.FR, 0.75 );
		deform.setDebugValue( QUADRANT.RL, 0.5 );
		deform.setDebugValue( QUADRANT.RR, 0.25 );
		deform.update( 1000, null, null );

		assert.equal( strongMatch.morphTargetInfluences[ 0 ], 1.0 );
		assert.equal( strongMatch.morphTargetInfluences[ 1 ], 0.75 );
		assert.equal( strongMatch.morphTargetInfluences[ 2 ], 0.5 );
		assert.equal( strongMatch.morphTargetInfluences[ 3 ], 0.25 );
		assert.equal( weakMatch.morphTargetInfluences[ 0 ], 0 );

	} );

	it( 'reports partial support and only drives the morphs that exist', () => {

		const partialMatch = createMesh( 'body.partial', {
			'Damage_Front_Left': 2,
			'Damage_Back_Right': 0,
		} );

		const warnings = [];
		const originalWarn = console.warn;
		console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );

		try {

			const deform = new VehicleDamageDeform();
			deform.init( createNode( 'kart-root', [ partialMatch ] ), 'unit-partial-match' );

			const report = deform.getSupportReport();
			assert.equal( report.status, 'partial' );
			assert.equal( report.meshName, 'body.partial' );
			assert.deepEqual( report.matchedMorphNames, [
				'Damage_Front_Left',
				'Damage_Back_Right',
			] );
			assert.deepEqual( report.missingMorphNames, [
				'Damage_Front_Right',
				'Damage_Back_Left',
			] );
			assert.equal( warnings.length, 1 );

			deform.setDebugOverride( true );
			deform.setDebugValue( QUADRANT.FL, 0.8 );
			deform.setDebugValue( QUADRANT.FR, 0.6 );
			deform.setDebugValue( QUADRANT.RL, 0.4 );
			deform.setDebugValue( QUADRANT.RR, 0.2 );
			deform.update( 1000, null, null );

			assert.equal( partialMatch.morphTargetInfluences[ 2 ], 0.8 );
			assert.equal( partialMatch.morphTargetInfluences[ 0 ], 0.2 );

		} finally {

			console.warn = originalWarn;

		}

	} );

	it( 'reports none when a morph mesh exists but does not expose canonical damage targets', () => {

		const unrelatedMorphs = createMesh( 'face-rig', {
			'Blink_Left': 0,
			'Blink_Right': 1,
			'Smile': 2,
		} );

		const warnings = [];
		const originalWarn = console.warn;
		console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );

		try {

			const deform = new VehicleDamageDeform();
			deform.init( createNode( 'kart-root', [ unrelatedMorphs ] ), 'unit-unrelated-morphs' );

			const report = deform.getSupportReport();
			assert.equal( report.status, 'none' );
			assert.equal( report.meshName, 'face-rig' );
			assert.deepEqual( report.matchedMorphNames, [] );
			assert.deepEqual( report.missingMorphNames, [
				'Damage_Front_Left',
				'Damage_Front_Right',
				'Damage_Back_Left',
				'Damage_Back_Right',
			] );
			assert.equal( warnings.length, 1 );
			assert.match( warnings[ 0 ], /unit-unrelated-morphs/ );
			assert.match( warnings[ 0 ], /face-rig/ );

		} finally {

			console.warn = originalWarn;

		}

	} );

	it( 'reports none when no morph-target meshes exist anywhere in the hierarchy', () => {

		const warnings = [];
		const originalWarn = console.warn;
		console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );

		try {

			const deform = new VehicleDamageDeform();
			deform.init( createNode( 'kart-root', [
				createNode( 'Body', [] ),
				createNode( 'wheel-front-left', [] ),
			] ), 'unit-no-morph-targets' );

			const report = deform.getSupportReport();
			assert.equal( report.status, 'none' );
			assert.equal( report.meshName, null );
			assert.deepEqual( report.availableMorphNames, [] );
			assert.deepEqual( report.missingMorphNames, [
				'Damage_Front_Left',
				'Damage_Front_Right',
				'Damage_Back_Left',
				'Damage_Back_Right',
			] );
			assert.equal( warnings.length, 1 );

		} finally {

			console.warn = originalWarn;

		}

	} );

	it( 'warns once per model key and support signature to avoid console spam', () => {

		const warnings = [];
		const originalWarn = console.warn;
		console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );

		try {

			const partialContainer = createNode( 'kart-root', [
				createMesh( 'body.partial', {
					'Damage_Front_Left': 0,
				} ),
			] );

			const first = new VehicleDamageDeform();
			first.init( partialContainer, 'warn-dedupe-model' );

			const second = new VehicleDamageDeform();
			second.init( partialContainer, 'warn-dedupe-model' );

			const third = new VehicleDamageDeform();
			third.init( partialContainer, 'warn-dedupe-other-model' );

			assert.equal( warnings.length, 2 );
			assert.match( warnings[ 0 ], /warn-dedupe-model/ );
			assert.match( warnings[ 1 ], /warn-dedupe-other-model/ );

		} finally {

			console.warn = originalWarn;

		}

	} );

} );
