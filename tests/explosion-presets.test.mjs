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

	for ( const id of EXPLOSION_PRESET_IDS ) {

		const preset = getExplosionPreset( id );
		assert.ok( preset );
		assert.equal( typeof preset.label, 'string' );
		assert.ok( preset.label.length > 0 );
		assert.ok( preset.budgets.mesh > 0 );
		assert.ok( preset.budgets.particles > 0 );
		assert.ok( Array.isArray( preset.layers ) );
		assert.ok( Array.isArray( preset.layerDropOrder ) );
		assert.ok( preset.feedbackStrengths );
		assert.ok( typeof preset.feedbackStrengths.cameraShake === 'number' );
		assert.ok( typeof preset.feedbackStrengths.audio === 'number' );
		assert.ok( typeof preset.feedbackStrengths.haptics === 'number' );

		const layerIds = new Set( preset.layers.map( ( layer ) => layer.id ) );

		for ( const layerId of preset.layerDropOrder ) {

			assert.ok( layerIds.has( layerId ) );

		}

		for ( const layer of preset.layers ) {

			if ( layer.kind === 'mesh' ) {

				assert.equal( typeof layer.meshKind, 'string' );
				assert.ok( layer.meshKind.length > 0 );
				assert.equal( typeof layer.materialKind, 'string' );
				assert.ok( layer.materialKind.length > 0 );

			}

			if ( layer.kind === 'particles' ) {

				assert.equal( typeof layer.particleFamily, 'string' );
				assert.ok( layer.particleFamily.length > 0 );

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

} );
