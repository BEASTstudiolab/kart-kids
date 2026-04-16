import test from 'node:test';
import assert from 'node:assert/strict';

import {
	ACCESSORY_DEFS,
	applyCharacterAppearance,
	applyCharacterMaterialTuningToMaterial,
	createDefaultPlayerAppearance,
	getVisibleAccessoryLabels,
	normalizeAppearanceColor,
	normalizePlayerAppearance,
} from '../js/PlayerAppearance.js';
import { DEFAULT_BALACLAVA_ID } from '../js/CharacterCustomization.js';

function createMockMaterial( { name = 'Masks Batch', color = '#ffffff' } = {} ) {

	const createMockTexture = () => ( {
		isTexture: true,
		anisotropy: 0,
		needsUpdate: false,
	} );

	return {
		name,
		userData: {},
		color: {
			value: color,
			r: 1,
			g: 1,
			b: 1,
			set( next ) {

				this.value = next;

			},
			setRGB( r, g, b ) {

				this.r = r;
				this.g = g;
				this.b = b;

			},
		},
		emissive: {
			r: 0,
			g: 0,
			b: 0,
			setRGB( r, g, b ) {

				this.r = r;
				this.g = g;
				this.b = b;

			},
		},
		normalScale: {
			x: 1,
			y: - 1,
			set( x, y ) {

				this.x = x;
				this.y = y;

			},
		},
		emissiveIntensity: 0,
		aoMapIntensity: 0,
		roughness: 0,
		metalness: 0,
		envMapIntensity: 0,
		opacity: 1,
		alphaTest: 0,
		side: 0,
		wireframe: false,
		flatShading: false,
		depthWrite: true,
		transparent: false,
		map: createMockTexture(),
		normalMap: createMockTexture(),
		aoMap: createMockTexture(),
		roughnessMap: createMockTexture(),
		metalnessMap: createMockTexture(),
		emissiveMap: createMockTexture(),
		alphaMap: createMockTexture(),
		clone() {

			const cloned = createMockMaterial( {
				name: this.name,
				color: this.color.value,
			} );
			cloned.userData = { ...this.userData };
			cloned.emissiveIntensity = this.emissiveIntensity;
			cloned.aoMapIntensity = this.aoMapIntensity;
			cloned.roughness = this.roughness;
			cloned.metalness = this.metalness;
			cloned.envMapIntensity = this.envMapIntensity;
			cloned.opacity = this.opacity;
			cloned.alphaTest = this.alphaTest;
			cloned.side = this.side;
			cloned.wireframe = this.wireframe;
			cloned.flatShading = this.flatShading;
			cloned.depthWrite = this.depthWrite;
			cloned.transparent = this.transparent;
			cloned.normalScale.set( this.normalScale.x, this.normalScale.y );
			cloned.emissive.setRGB( this.emissive.r, this.emissive.g, this.emissive.b );
			cloned.map = this.map;
			cloned.normalMap = this.normalMap;
			cloned.aoMap = this.aoMap;
			cloned.roughnessMap = this.roughnessMap;
			cloned.metalnessMap = this.metalnessMap;
			cloned.emissiveMap = this.emissiveMap;
			cloned.alphaMap = this.alphaMap;
			return cloned;

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
	assert.ok( labels.includes( 'Jeans' ) );

} );

test( 'normalizePlayerAppearance keeps jeans and boots visible even when the source payload hides them', () => {

	const appearance = normalizePlayerAppearance( {
		charAccessories: {
			Jeans: { visible: false, color: '#224466' },
			Boots: { visible: false, color: '#553311' },
		},
	} );

	assert.deepEqual( appearance.charAccessories.Jeans, {
		visible: true,
		color: '#224466',
	} );
	assert.deepEqual( appearance.charAccessories.Boots, {
		visible: true,
		color: '#553311',
	} );

} );

test( 'applyCharacterAppearance no longer uses legacy characterColor as a fallback tint for clothing', () => {

	const originalMaterial = createMockMaterial( { name: 'Charcoal.002' } );
	const child = {
		isMesh: true,
		name: 'Tshirt',
		visible: true,
		material: originalMaterial,
	};

	applyCharacterAppearance( createMockCharacterRoot( child ), {
		characterColor: '#00ccff',
		charAccessories: {
			Tshirt: { visible: true, color: '' },
		},
	} );

	assert.strictEqual( child.material, originalMaterial );
	assert.equal( child.material.color.value, '#ffffff' );

} );

test( 'applyCharacterAppearance tints boots from the feet customizer color when boots are a body material slot', () => {

	const bodyMaterial = createMockMaterial( { name: 'Body Base' } );
	const originalBootsMaterial = createMockMaterial( { name: 'Boots' } );
	const child = {
		isMesh: true,
		name: 'Body',
		visible: true,
		material: [ bodyMaterial, originalBootsMaterial ],
	};

	applyCharacterAppearance( createMockCharacterRoot( child ), {
		charAccessories: {
			Boots: { visible: true, color: '#663300' },
		},
	} );

	assert.equal( child.visible, true );
	assert.ok( Array.isArray( child.material ) );
	assert.strictEqual( child.material[ 0 ], bodyMaterial );
	assert.notStrictEqual( child.material[ 1 ], originalBootsMaterial );
	assert.equal( child.material[ 1 ].color.value, '#663300' );

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
	assert.equal( child.material.normalScale.x, 0.1 );
	assert.equal( child.material.normalScale.y, - 0.1 );

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

test( 'applyCharacterMaterialTuningToMaterial bakes the shared mask material defaults', () => {

	const material = createMockMaterial();
	const originalEmissiveMap = material.emissiveMap;
	const originalAlphaMap = material.alphaMap;

	applyCharacterMaterialTuningToMaterial( material );

	assert.equal( material.normalScale.x, 0.1 );
	assert.equal( material.normalScale.y, - 0.1 );
	assert.equal( material.aoMapIntensity, 1 );
	assert.equal( material.roughness, 1 );
	assert.equal( material.metalness, 1 );
	assert.equal( material.envMapIntensity, 1 );
	assert.equal( material.side, 2 );
	assert.equal( material.emissiveMap, null );
	assert.equal( material.alphaMap, null );
	assert.strictEqual( material._kkCharacterMaterialOriginalTextures.emissiveMap, originalEmissiveMap );
	assert.strictEqual( material._kkCharacterMaterialOriginalTextures.alphaMap, originalAlphaMap );
	assert.equal( material.map.anisotropy, 1 );
	assert.equal( material.map.needsUpdate, true );
	assert.equal( material.needsUpdate, true );

} );
