import test from 'node:test';
import assert from 'node:assert/strict';

import {
	ACCESSORY_DEFS,
	createDefaultPlayerAppearance,
	getVisibleAccessoryLabels,
	normalizeAppearanceColor,
	normalizePlayerAppearance,
} from '../js/PlayerAppearance.js';

test( 'normalizeAppearanceColor accepts canonical hex colors and rejects invalid values', () => {

	assert.equal( normalizeAppearanceColor( '#ABCDEF' ), '#abcdef' );
	assert.equal( normalizeAppearanceColor( ' #123456 ' ), '#123456' );
	assert.equal( normalizeAppearanceColor( '#abcd' ), '' );
	assert.equal( normalizeAppearanceColor( 'orange' ), '' );
	assert.equal( normalizeAppearanceColor( null ), '' );

} );

test( 'normalizePlayerAppearance handles null and fills defaults', () => {

	const appearance = normalizePlayerAppearance( null );
	const defaults = createDefaultPlayerAppearance();

	assert.deepEqual( appearance, defaults );
	assert.notStrictEqual( appearance.charAccessories, defaults.charAccessories );

} );

test( 'normalizePlayerAppearance sanitizes accessory payloads and preserves visibility flags', () => {

	const appearance = normalizePlayerAppearance( {
		vehicleColor: '#FFAA00',
		characterColor: '#00CCFF',
		charSkinColor: '#CC9966',
		charAccessories: {
			Balaclava_No_Ears: { visible: false, color: '#123ABC' },
			Baseball_Hat: { visible: true, color: 'invalid' },
		},
	} );

	assert.equal( appearance.vehicleColor, '#ffaa00' );
	assert.equal( appearance.characterColor, '#00ccff' );
	assert.equal( appearance.charSkinColor, '#cc9966' );
	assert.deepEqual( appearance.charAccessories.Balaclava_No_Ears, {
		visible: false,
		color: '#123abc',
	} );
	assert.deepEqual( appearance.charAccessories.Baseball_Hat, {
		visible: true,
		color: '',
	} );

	for ( const def of ACCESSORY_DEFS ) {

		assert.ok( appearance.charAccessories[ def.key ] );

	}

} );

test( 'getVisibleAccessoryLabels reflects sanitized visibility state', () => {

	const labels = getVisibleAccessoryLabels( {
		charAccessories: {
			Balaclava_No_Ears: { visible: false, color: '#ffffff' },
			Baseball_Hat: { visible: true, color: '#ffffff' },
			Mask_Basic: { visible: false, color: '' },
		},
	} );

	assert.ok( labels.includes( 'Baseball Hat' ) );
	assert.ok( ! labels.includes( 'Balaclava' ) );
	assert.ok( ! labels.includes( 'Mask' ) );

} );
