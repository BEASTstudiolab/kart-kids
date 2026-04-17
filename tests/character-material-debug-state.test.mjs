import test from 'node:test';
import assert from 'node:assert/strict';

import {
	areCharacterMaterialDebugStatesEquivalent,
	shouldAdoptCharacterMaterialDebugBaseline,
} from '../js/ui/utils/characterMaterialDebugState.js';

function createState( overrides = {} ) {

	return {
		textureFidelity: 4,
		color: { r: 0.1, g: 0.2, b: 0.3 },
		emissive: { r: 0, g: 0, b: 0 },
		emissiveIntensity: 1,
		normalScale: { x: 0.5, y: - 0.5 },
		aoMapIntensity: 1,
		roughness: 0.7,
		metalness: 0.2,
		envMapIntensity: 1.1,
		opacity: 1,
		alphaTest: 0,
		doubleSided: true,
		wireframe: false,
		flatShading: false,
		depthWrite: true,
		transparent: false,
		mapEnabled: true,
		normalMapEnabled: true,
		aoMapEnabled: true,
		roughnessMapEnabled: true,
		metalnessMapEnabled: true,
		emissiveMapEnabled: false,
		alphaMapEnabled: false,
		...overrides,
	};

}

test( 'areCharacterMaterialDebugStatesEquivalent detects matching baseline snapshots', () => {

	const left = createState();
	const right = createState();

	assert.equal( areCharacterMaterialDebugStatesEquivalent( left, right ), true );

} );

test( 'shouldAdoptCharacterMaterialDebugBaseline refreshes stale mirror state when it still matches the old baseline', () => {

	const previousBaseline = createState();
	const currentState = createState();

	assert.equal( shouldAdoptCharacterMaterialDebugBaseline( currentState, previousBaseline ), true );

} );

test( 'shouldAdoptCharacterMaterialDebugBaseline preserves explicit debug edits that diverged from the old baseline', () => {

	const previousBaseline = createState();
	const currentState = createState( {
		color: { r: 0.8, g: 0.1, b: 0.1 },
	} );

	assert.equal( shouldAdoptCharacterMaterialDebugBaseline( currentState, previousBaseline ), false );

} );
