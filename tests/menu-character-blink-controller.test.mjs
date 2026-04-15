import test from 'node:test';
import assert from 'node:assert/strict';

import {
	MENU_CHARACTER_BLINK_DEFAULTS,
	getMenuCharacterBlinkTuning,
	MenuCharacterBlinkController,
	setMenuCharacterBlinkTuning,
} from '../js/ui/MenuCharacterBlinkController.js';

function createMesh( name, morphTargetDictionary = {} ) {

	const indices = Object.values( morphTargetDictionary );
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

function resetBlinkTuning() {

	setMenuCharacterBlinkTuning( MENU_CHARACTER_BLINK_DEFAULTS );

}

test( 'MenuCharacterBlinkController binds every Blink-capable mesh in the hierarchy', () => {

	resetBlinkTuning();
	setMenuCharacterBlinkTuning( {
		frequencySeconds: 0.1,
		speedSeconds: 0.2,
	} );

	const primaryBlinkMesh = createMesh( 'Body.002-part-a', {
		Smile: 0,
		Blink: 1,
	} );
	const secondaryBlinkMesh = createMesh( 'Body.002-part-b', {
		Blink: 0,
	} );
	const unrelatedMesh = createMesh( 'Mask', {
		Smile: 0,
	} );
	const controller = new MenuCharacterBlinkController( { random: () => 0 } );

	const boundTargetCount = controller.bind( createNode( 'character-root', [
		createNode( 'Body.002', [ primaryBlinkMesh, secondaryBlinkMesh ] ),
		unrelatedMesh,
	] ) );

	assert.equal( boundTargetCount, 2 );

	controller.update( 0.2 );

	assert.ok( primaryBlinkMesh.morphTargetInfluences[ 1 ] > 0 );
	assert.ok( secondaryBlinkMesh.morphTargetInfluences[ 0 ] > 0 );
	assert.equal( unrelatedMesh.morphTargetInfluences[ 0 ], 0 );

	resetBlinkTuning();

} );

test( 'MenuCharacterBlinkController forces eyes open when blink frequency is disabled', () => {

	resetBlinkTuning();
	setMenuCharacterBlinkTuning( {
		frequencySeconds: 0.1,
		speedSeconds: 0.2,
	} );

	const blinkMesh = createMesh( 'Body.002', { Blink: 0 } );
	const controller = new MenuCharacterBlinkController( { random: () => 0 } );
	controller.bind( createNode( 'character-root', [ blinkMesh ] ) );

	controller.update( 0.2 );
	assert.ok( blinkMesh.morphTargetInfluences[ 0 ] > 0 );

	setMenuCharacterBlinkTuning( { frequencySeconds: 0 } );
	controller.update( 0.01 );

	assert.equal( blinkMesh.morphTargetInfluences[ 0 ], 0 );

	resetBlinkTuning();

} );

test( 'MenuCharacterBlinkController completes a full blink cycle and returns to open eyes', () => {

	resetBlinkTuning();
	setMenuCharacterBlinkTuning( {
		frequencySeconds: 0.1,
		speedSeconds: 0.2,
	} );

	const blinkMesh = createMesh( 'Body.002', { Blink: 0 } );
	const controller = new MenuCharacterBlinkController( { random: () => 0 } );
	controller.bind( createNode( 'character-root', [ blinkMesh ] ) );

	controller.update( 0.2 );
	assert.ok( blinkMesh.morphTargetInfluences[ 0 ] > 0 );

	controller.update( 0.2 );
	assert.equal( blinkMesh.morphTargetInfluences[ 0 ], 0 );

	resetBlinkTuning();

} );

test( 'MenuCharacterBlinkController schedules independent blink timing per instance with injected RNG', () => {

	resetBlinkTuning();
	setMenuCharacterBlinkTuning( {
		frequencySeconds: 4,
		speedSeconds: 0.4,
	} );

	const earlyBlinkMesh = createMesh( 'Body.002-early', { Blink: 0 } );
	const lateBlinkMesh = createMesh( 'Body.002-late', { Blink: 0 } );
	const earlyController = new MenuCharacterBlinkController( { random: () => 0 } );
	const lateController = new MenuCharacterBlinkController( { random: () => 1 } );

	earlyController.bind( createNode( 'character-root-a', [ earlyBlinkMesh ] ) );
	lateController.bind( createNode( 'character-root-b', [ lateBlinkMesh ] ) );

	earlyController.update( 3.2 );
	lateController.update( 3.2 );

	assert.ok( earlyBlinkMesh.morphTargetInfluences[ 0 ] > 0.9 );
	assert.equal( lateBlinkMesh.morphTargetInfluences[ 0 ], 0 );

	resetBlinkTuning();

} );

test( 'shared menu blink tuning keeps sane defaults and clamps updates', () => {

	resetBlinkTuning();

	assert.deepEqual( getMenuCharacterBlinkTuning(), {
		frequencySeconds: 6.0,
		speedSeconds: 0.30,
	} );

	assert.deepEqual( setMenuCharacterBlinkTuning( {
		frequencySeconds: 20,
		speedSeconds: 0.001,
	} ), {
		frequencySeconds: 12,
		speedSeconds: 0.05,
	} );

	resetBlinkTuning();

} );
