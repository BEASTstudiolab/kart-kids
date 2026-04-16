import test from 'node:test';
import assert from 'node:assert/strict';

import {
	applyMenuCharacterMaterialDebugTuning,
	getMenuCharacterMaterialDebugTuning,
	getMenuCharacterMaterialDebugVersion,
	MENU_CHARACTER_MATERIAL_DEBUG_DEFAULTS,
	setMenuCharacterMaterialDebugTuning,
} from '../js/ui/MenuCharacterMaterialDebug.js';

function createMaterial( name, x = 1, y = 1 ) {

	return {
		name,
		userData: {},
		normalScale: {
			x,
			y,
		},
	};

}

function createCharacterRoot( children ) {

	return {
		traverse( visit ) {

			for ( const child of children ) visit( child );

		},
	};

}

function resetMenuCharacterMaterialDebugTuning() {

	setMenuCharacterMaterialDebugTuning( MENU_CHARACTER_MATERIAL_DEBUG_DEFAULTS );

}

test( 'shared menu character material debug tuning keeps sane defaults and increments version on change', () => {

	resetMenuCharacterMaterialDebugTuning();
	const baselineVersion = getMenuCharacterMaterialDebugVersion();

	assert.deepEqual( getMenuCharacterMaterialDebugTuning(), {
		maskNormalIntensity: 0.20,
		jeansNormalIntensity: 1.0,
		shirtNormalIntensity: 1.0,
	} );

	assert.deepEqual( setMenuCharacterMaterialDebugTuning( {
		maskNormalIntensity: 2.5,
		jeansNormalIntensity: 20,
		shirtNormalIntensity: - 1,
	} ), {
		maskNormalIntensity: 2.5,
		jeansNormalIntensity: 3.0,
		shirtNormalIntensity: 0.0,
	} );
	assert.equal( getMenuCharacterMaterialDebugVersion(), baselineVersion + 1 );

	resetMenuCharacterMaterialDebugTuning();

} );

test( 'applyMenuCharacterMaterialDebugTuning scales the targeted mask, jeans, and shirt materials', () => {

	resetMenuCharacterMaterialDebugTuning();
	setMenuCharacterMaterialDebugTuning( {
		maskNormalIntensity: 0.5,
		jeansNormalIntensity: 1.5,
		shirtNormalIntensity: 2.0,
	} );

	const maskMaterial = createMaterial( 'Masks Batch ', 2, 3 );
	const jeansMaterial = createMaterial( 'Washed_Denim.002', 1, 1 );
	const shirtMaterial = createMaterial( 'Charcoal.002', 0.4, 0.6 );
	const untouchedMaterial = createMaterial( 'Boots', 5, 5 );
	const characterRoot = createCharacterRoot( [
		{ isMesh: true, material: maskMaterial },
		{ isSkinnedMesh: true, material: jeansMaterial },
		{ isMesh: true, material: [ shirtMaterial, untouchedMaterial ] },
	] );

	const appliedCount = applyMenuCharacterMaterialDebugTuning( characterRoot );

	assert.equal( appliedCount, 3 );
	assert.deepEqual( maskMaterial.userData._kkMenuOriginalNormalScale, { x: 2, y: 3 } );
	assert.equal( maskMaterial.normalScale.x, 1 );
	assert.equal( maskMaterial.normalScale.y, 1.5 );
	assert.equal( jeansMaterial.normalScale.x, 1.5 );
	assert.equal( jeansMaterial.normalScale.y, 1.5 );
	assert.equal( shirtMaterial.normalScale.x, 0.8 );
	assert.equal( shirtMaterial.normalScale.y, 1.2 );
	assert.equal( untouchedMaterial.normalScale.x, 5 );
	assert.equal( untouchedMaterial.normalScale.y, 5 );

	resetMenuCharacterMaterialDebugTuning();

} );

test( 'applyMenuCharacterMaterialDebugTuning preserves the original base scale across repeated updates', () => {

	resetMenuCharacterMaterialDebugTuning();
	const shirtMaterial = createMaterial( 'Charcoal.002', 0.4, 0.6 );
	const characterRoot = createCharacterRoot( [
		{ isMesh: true, material: shirtMaterial },
	] );

	setMenuCharacterMaterialDebugTuning( { shirtNormalIntensity: 2.0 } );
	applyMenuCharacterMaterialDebugTuning( characterRoot );
	assert.equal( shirtMaterial.normalScale.x, 0.8 );
	assert.equal( shirtMaterial.normalScale.y, 1.2 );

	setMenuCharacterMaterialDebugTuning( { shirtNormalIntensity: 0.5 } );
	applyMenuCharacterMaterialDebugTuning( characterRoot );
	assert.equal( shirtMaterial.normalScale.x, 0.2 );
	assert.equal( shirtMaterial.normalScale.y, 0.3 );

	resetMenuCharacterMaterialDebugTuning();

} );
