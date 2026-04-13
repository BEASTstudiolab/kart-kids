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
		assert.ok( preset.budgets.mesh > 0 );
		assert.ok( preset.budgets.particles > 0 );
		assert.ok( Array.isArray( preset.layers ) );
		assert.ok( Array.isArray( preset.layerDropOrder ) );

		const layerIds = new Set( preset.layers.map( ( layer ) => layer.id ) );
		for ( const layerId of preset.layerDropOrder ) {

			assert.ok( layerIds.has( layerId ) );

		}

	}

	assert.equal( getExplosionPreset( 'pulseShockwave' ).styleFamily, 'energy' );
	assert.equal( getExplosionPreset( 'missileStrike' ).heroWeight, 'hero' );

} );
