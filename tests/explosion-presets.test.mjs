import test from 'node:test';
import assert from 'node:assert/strict';

import {
	EXPLOSION_PRESET_IDS,
	EXPLOSION_PRESETS,
	getExplosionPreset,
} from '../js/explosions/ExplosionPresets.js';

test( 'exports the four shipped explosion presets', () => {

	assert.deepEqual(
		EXPLOSION_PRESET_IDS,
		[ 'mine', 'bomb', 'missileStrike', 'pulseShockwave' ]
	);
	assert.ok( Object.isFrozen( EXPLOSION_PRESET_IDS ) );
	assert.deepEqual( Object.keys( EXPLOSION_PRESETS ), EXPLOSION_PRESET_IDS );
	assert.equal( getExplosionPreset( 'unknown' ), null );

	const serialized = JSON.parse( JSON.stringify( EXPLOSION_PRESETS ) );
	assert.deepEqual( Object.keys( serialized ), EXPLOSION_PRESET_IDS );

	for ( const id of EXPLOSION_PRESET_IDS ) {

		const preset = getExplosionPreset( id );
		const roundTrippedPreset = serialized[ id ];
		assert.ok( preset );
		assert.ok( roundTrippedPreset );
		assert.equal( roundTrippedPreset.id, id );
		assert.equal( roundTrippedPreset.label, preset.label );
		assert.equal( roundTrippedPreset.styleFamily, preset.styleFamily );
		assert.equal( roundTrippedPreset.heroWeight, preset.heroWeight );
		assert.ok( roundTrippedPreset.budgets );
		assert.ok( roundTrippedPreset.layers );
		assert.ok( roundTrippedPreset.feedbackStrengths );
		assert.equal( typeof preset.label, 'string' );
		assert.ok( preset.label.length > 0 );
		assert.ok( preset.budgets.mesh > 0 );
		assert.ok( preset.budgets.particles > 0 );
		assert.ok( Array.isArray( preset.layers ) );
		assert.ok( Array.isArray( preset.layerDropOrder ) );
		assert.equal( new Set( preset.layerDropOrder ).size, preset.layerDropOrder.length );
		assert.ok( preset.feedbackStrengths );
		assert.ok( typeof preset.feedbackStrengths.cameraShake === 'number' );
		assert.ok( typeof preset.feedbackStrengths.audio === 'number' );
		assert.ok( typeof preset.feedbackStrengths.haptics === 'number' );

		const layerIds = new Set( preset.layers.map( ( layer ) => layer.id ) );
		assert.equal( layerIds.size, preset.layers.length );
		let previousWeight = Infinity;

		for ( const layerId of preset.layerDropOrder ) {

			const layer = preset.layers.find( ( entry ) => entry.id === layerId );
			assert.ok( layerIds.has( layerId ) );
			assert.ok( layer );
			assert.equal( typeof layer.weight, 'number' );
			assert.ok( layer.weight <= previousWeight );
			previousWeight = layer.weight;

		}

		for ( const layer of preset.layers ) {

			assert.equal( typeof layer.id, 'string' );
			assert.ok( layer.id.length > 0 );
			assert.equal( typeof layer.kind, 'string' );
			assert.equal( typeof layer.weight, 'number' );
			assert.ok( Number.isFinite( layer.weight ) );

			if ( layer.kind === 'mesh' ) {

				assert.equal( typeof layer.meshKind, 'string' );
				assert.ok( layer.meshKind.length > 0 );
				assert.equal( typeof layer.materialKind, 'string' );
				assert.ok( layer.materialKind.length > 0 );

			}

			if ( layer.kind === 'particles' ) {

				assert.equal( typeof layer.particleFamily, 'string' );
				assert.ok( layer.particleFamily.length > 0 );
				assert.equal( typeof layer.count, 'number' );
				assert.ok( Number.isFinite( layer.count ) );

			}

		}

	}

	assert.equal( getExplosionPreset( 'mine' ).styleFamily, 'hybridArcadeCombat' );
	assert.equal( getExplosionPreset( 'bomb' ).styleFamily, 'hybridArcadeCombat' );
	assert.equal( getExplosionPreset( 'missileStrike' ).styleFamily, 'hybridArcadeCombat' );
	assert.equal( getExplosionPreset( 'pulseShockwave' ).styleFamily, 'energy' );
	assert.equal( getExplosionPreset( 'mine' ).heroWeight, 'minor' );
	assert.equal( getExplosionPreset( 'bomb' ).heroWeight, 'standard' );
	assert.equal( getExplosionPreset( 'missileStrike' ).heroWeight, 'hero' );
	assert.ok( getExplosionPreset( 'mine' ).budgets.mesh < getExplosionPreset( 'bomb' ).budgets.mesh );
	assert.ok( getExplosionPreset( 'bomb' ).budgets.mesh < getExplosionPreset( 'missileStrike' ).budgets.mesh );
	assert.ok( getExplosionPreset( 'mine' ).budgets.particles < getExplosionPreset( 'bomb' ).budgets.particles );
	assert.ok( getExplosionPreset( 'bomb' ).budgets.particles < getExplosionPreset( 'missileStrike' ).budgets.particles );
	assert.ok(
		getExplosionPreset( 'mine' ).feedbackStrengths.cameraShake <
		getExplosionPreset( 'bomb' ).feedbackStrengths.cameraShake
	);
	assert.ok(
		getExplosionPreset( 'bomb' ).feedbackStrengths.cameraShake <
		getExplosionPreset( 'missileStrike' ).feedbackStrengths.cameraShake
	);
	assert.ok(
		getExplosionPreset( 'mine' ).feedbackStrengths.audio <
		getExplosionPreset( 'bomb' ).feedbackStrengths.audio
	);
	assert.ok(
		getExplosionPreset( 'bomb' ).feedbackStrengths.audio <
		getExplosionPreset( 'missileStrike' ).feedbackStrengths.audio
	);
	assert.ok(
		getExplosionPreset( 'mine' ).feedbackStrengths.haptics <
		getExplosionPreset( 'bomb' ).feedbackStrengths.haptics
	);
	assert.ok(
		getExplosionPreset( 'bomb' ).feedbackStrengths.haptics <
		getExplosionPreset( 'missileStrike' ).feedbackStrengths.haptics
	);

} );

test( 'returns immutable shared preset data from the supported access path', () => {

	const preset = getExplosionPreset( 'mine' );

	assert.ok( Object.isFrozen( preset ) );
	assert.ok( Object.isFrozen( preset.budgets ) );
	assert.ok( Object.isFrozen( preset.layers ) );
	assert.ok( Object.isFrozen( preset.layers[ 0 ] ) );
	assert.ok( Object.isFrozen( preset.feedbackStrengths ) );

	assert.throws( () => {

		preset.label = 'Changed';

	}, TypeError );

	assert.throws( () => {

		preset.budgets.mesh = 99;

	}, TypeError );

	assert.throws( () => {

		preset.layers[ 0 ].weight = 99;

	}, TypeError );

	assert.throws( () => {

		preset.layers.push( { id: 'extra', kind: 'flash', weight: 999 } );

	}, TypeError );

	assert.equal( getExplosionPreset( 'mine' ).label, 'Mine Burst' );
	assert.equal( getExplosionPreset( 'mine' ).budgets.mesh, 1 );
	assert.equal( getExplosionPreset( 'mine' ).layers[ 0 ].weight, 1 );
	assert.equal( getExplosionPreset( 'mine' ).layers.length, 5 );

} );
