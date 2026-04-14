import test from 'node:test';
import assert from 'node:assert/strict';

import {
	CHARACTER_PREVIEW_CAMERA_DEFAULTS,
	computeCharacterPreviewFrame,
} from '../js/ui/utils/characterPreviewFrame.js';

function toRadians( degrees ) {

	return ( degrees * Math.PI ) / 180;

}

function computeHorizontalFov( verticalFovDegrees, aspect ) {

	const verticalFov = toRadians( verticalFovDegrees );
	return 2 * Math.atan( Math.tan( verticalFov / 2 ) * aspect );

}

function almostEqual( actual, expected, epsilon = 1e-9 ) {

	assert.ok(
		Math.abs( actual - expected ) <= epsilon,
		`expected ${ actual } to be within ${ epsilon } of ${ expected }`
	);

}

test( 'computeCharacterPreviewFrame fits tall characters vertically with padding', () => {

	const size = { x: 0.5, y: 2.4, z: 0.3 };
	const aspect = 1.4;
	const fovDegrees = 26;
	const expectedDistance = ( size.y * 1.15 * 0.5 ) / Math.tan( toRadians( fovDegrees ) / 2 );
	const expectedLookTargetX = Math.hypot( size.x, size.z ) * 0.08;

	const frame = computeCharacterPreviewFrame( { size, aspect, fovDegrees } );

	almostEqual( frame.lookTargetX, expectedLookTargetX );
	almostEqual( frame.lookTargetY, size.y * 0.5 );
	almostEqual( frame.cameraY, frame.lookTargetY - size.y * 0.06 );
	almostEqual( frame.cameraZ, expectedDistance );

} );

test( 'computeCharacterPreviewFrame uses rotation-safe horizontal fit for wide characters', () => {

	const size = { x: 2.6, y: 1.4, z: 2.0 };
	const aspect = 1.8;
	const fovDegrees = 26;
	const rotationSafeWidth = Math.hypot( size.x, size.z );
	const horizontalFov = computeHorizontalFov( fovDegrees, aspect );
	const expectedHorizontalDistance = ( rotationSafeWidth * 1.15 * 0.5 ) / Math.tan( horizontalFov / 2 );
	const expectedVerticalDistance = ( size.y * 1.15 * 0.5 ) / Math.tan( toRadians( fovDegrees ) / 2 );

	const frame = computeCharacterPreviewFrame( { size, aspect, fovDegrees } );

	assert.ok( expectedHorizontalDistance > expectedVerticalDistance );
	almostEqual( frame.lookTargetX, rotationSafeWidth * 0.08 );
	almostEqual( frame.cameraZ, expectedHorizontalDistance );

} );

test( 'computeCharacterPreviewFrame increases distance on narrow aspect ratios', () => {

	const size = { x: 1.8, y: 1.6, z: 1.2 };
	const fovDegrees = 26;

	const wideFrame = computeCharacterPreviewFrame( {
		size,
		aspect: 1.6,
		fovDegrees,
	} );
	const narrowFrame = computeCharacterPreviewFrame( {
		size,
		aspect: 0.6,
		fovDegrees,
	} );

	assert.ok( narrowFrame.cameraZ > wideFrame.cameraZ );
	almostEqual( narrowFrame.lookTargetX, wideFrame.lookTargetX );
	almostEqual( narrowFrame.lookTargetY, wideFrame.lookTargetY );
	almostEqual( narrowFrame.cameraY, wideFrame.cameraY );

} );

test( 'CHARACTER_PREVIEW_CAMERA_DEFAULTS expose the tuned preview camera values', () => {

	assert.deepEqual( CHARACTER_PREVIEW_CAMERA_DEFAULTS, {
		lookTargetX: - 0.20,
		lookTargetY: - 1.37,
		cameraOffsetX: 0.40,
		cameraOffsetY: 1.50,
		cameraOffsetZ: 3.00,
	} );

} );
