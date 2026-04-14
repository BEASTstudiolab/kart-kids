import test from 'node:test';
import assert from 'node:assert/strict';

import {
	ACCESSORY_DEFS,
	applyCharacterAppearance,
	createDefaultPlayerAppearance,
	getVisibleAccessoryLabels,
	normalizeAppearanceColor,
	normalizePlayerAppearance,
} from '../js/PlayerAppearance.js';
import { DEFAULT_BALACLAVA_ID } from '../js/CharacterCustomization.js';

function createMockMaterial( { name = 'Masks Batch', color = '#ffffff' } = {} ) {

	return {
		name,
		color: {
			value: color,
			set( next ) {

				this.value = next;

			},
		},
		clone() {

			return createMockMaterial( {
				name: this.name,
				color: this.color.value,
			} );

		},
	};

}

function createMockCharacterRoot( child ) {

	return {
		traverse( visit ) {

			visit( child );

		},
	};

}

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
		maskTintMainColor: '#FF00AA',
		maskTintSecondaryColor: 'invalid',
		selectedBalaclavaId: 'BALACLAVA-WOLF',
		charAccessories: {
			Baseball_Hat: { visible: true, color: 'invalid' },
			Gold_Chain: { visible: false, color: '#123ABC' },
		},
	} );

	assert.equal( appearance.vehicleColor, '#ffaa00' );
	assert.equal( appearance.characterColor, '#00ccff' );
	assert.equal( appearance.charSkinColor, '#cc9966' );
	assert.equal( appearance.maskTintMainColor, '#ff00aa' );
	assert.equal( appearance.maskTintSecondaryColor, '' );
	assert.equal( appearance.selectedBalaclavaId, 'balaclava-wolf' );
	assert.deepEqual( appearance.charAccessories.Baseball_Hat, {
		visible: true,
		color: '',
	} );
	assert.deepEqual( appearance.charAccessories.Gold_Chain, {
		visible: false,
		color: '#123abc',
	} );

	for ( const def of ACCESSORY_DEFS ) {

		assert.ok( appearance.charAccessories[ def.key ] );

	}

} );

test( 'getVisibleAccessoryLabels reflects sanitized visibility state', () => {

	const labels = getVisibleAccessoryLabels( {
		selectedBalaclavaId: 'balaclava-basic',
		charAccessories: {
			Baseball_Hat: { visible: true, color: '#ffffff' },
			Jeans: { visible: false, color: '' },
		},
	} );

	assert.ok( labels.includes( 'Balaclava Basic' ) );
	assert.ok( labels.includes( 'Baseball Hat' ) );
	assert.ok( ! labels.includes( 'Jeans' ) );

} );

test( 'normalizePlayerAppearance defaults unknown balaclavas back to basic', () => {

	const appearance = normalizePlayerAppearance( {
		selectedBalaclavaId: 'mystery-mask',
	} );

	assert.equal( appearance.selectedBalaclavaId, DEFAULT_BALACLAVA_ID );
	assert.equal( appearance.maskTintMainColor, '' );
	assert.equal( appearance.maskTintSecondaryColor, '' );

} );

test( 'applyCharacterAppearance tints balaclava materials with the main tint only', () => {

	const originalMaterial = createMockMaterial();
	const child = {
		isMesh: true,
		name: 'Balaclava Panda',
		visible: true,
		material: originalMaterial,
	};

	applyCharacterAppearance( createMockCharacterRoot( child ), {
		selectedBalaclavaId: 'balaclava-panda',
		maskTintMainColor: '#ff0000',
		maskTintSecondaryColor: '#00ff00',
	} );

	assert.notStrictEqual( child.material, originalMaterial );
	assert.equal( child.material.color.value, '#ff0000' );

} );

test( 'applyCharacterAppearance ignores the secondary mask tint when no main tint is set', () => {

	const originalMaterial = createMockMaterial();
	const child = {
		isMesh: true,
		name: 'Balaclava Panda',
		visible: true,
		material: originalMaterial,
	};

	applyCharacterAppearance( createMockCharacterRoot( child ), {
		selectedBalaclavaId: 'balaclava-panda',
		maskTintMainColor: '',
		maskTintSecondaryColor: '#00ff00',
	} );

	assert.strictEqual( child.material, originalMaterial );
	assert.equal( child.material.color.value, '#ffffff' );

} );

test( 'applyCharacterAppearance restores the original balaclava material when the main tint is cleared', () => {

	const originalMaterial = createMockMaterial();
	const child = {
		isMesh: true,
		name: 'Balaclava Panda',
		visible: true,
		material: originalMaterial,
	};
	const root = createMockCharacterRoot( child );

	applyCharacterAppearance( root, {
		selectedBalaclavaId: 'balaclava-panda',
		maskTintMainColor: '#ffffff',
	} );

	assert.notStrictEqual( child.material, originalMaterial );

	applyCharacterAppearance( root, {
		selectedBalaclavaId: 'balaclava-panda',
		maskTintMainColor: '',
		maskTintSecondaryColor: '#ff0000',
	} );

	assert.strictEqual( child.material, originalMaterial );

} );
