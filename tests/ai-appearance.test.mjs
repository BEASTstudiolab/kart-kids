import test from 'node:test';
import assert from 'node:assert/strict';

import { ACCESSORY_DEFS, createDefaultAIAppearance } from '../js/PlayerAppearance.js';

test( 'createDefaultAIAppearance hides the baseball hat but keeps other defaults intact', () => {

	const appearance = createDefaultAIAppearance( 'BALACLAVA-WOLF' );

	assert.equal( appearance.selectedBalaclavaId, 'balaclava-wolf' );
	assert.deepEqual( appearance.charAccessories.Baseball_Hat, {
		visible: false,
		color: '',
	} );

	for ( const def of ACCESSORY_DEFS ) {

		if ( def.key === 'Baseball_Hat' ) continue;
		assert.equal( appearance.charAccessories[ def.key ]?.visible, true );
		assert.equal( appearance.charAccessories[ def.key ]?.color, '' );

	}

} );
