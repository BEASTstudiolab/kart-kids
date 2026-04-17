import test from 'node:test';
import assert from 'node:assert/strict';

import {
	advancePreviewPoseTransition,
	createPreviewPoseTransition,
	retargetPreviewPoseTransition,
} from '../js/ui/utils/menuPreviewPoseTransition.js';

function createPose( {
	cameraX = 0,
	cameraY = 0,
	cameraZ = 0,
	lookX = 0,
	lookY = 0,
	lookZ = 0,
	fov = 70,
	kartRotationY = 0,
} = {} ) {

	return {
		cameraPos: { x: cameraX, y: cameraY, z: cameraZ },
		lookAt: { x: lookX, y: lookY, z: lookZ },
		fov,
		kartRotationY,
	};

}

function assertClose( actual, expected, epsilon = 1e-6 ) {

	assert.ok(
		Math.abs( actual - expected ) <= epsilon,
		`expected ${ actual } to be within ${ epsilon } of ${ expected }`
	);

}

test( 'retargetPreviewPoseTransition preserves the live pose when a timed move starts', () => {

	const transition = createPreviewPoseTransition( createPose( { cameraZ: 5 } ), { duration: 0.32 } );

	const currentPose = retargetPreviewPoseTransition(
		transition,
		createPose( { cameraZ: 3, fov: 44 } ),
		{ immediate: false }
	);

	assert.equal( transition.active, true );
	assert.equal( currentPose.cameraPos.z, 5 );
	assert.equal( transition.targetPose.cameraPos.z, 3 );
	assert.equal( transition.targetPose.fov, 44 );

} );

test( 'advancePreviewPoseTransition moves partway to the target before settling exactly', () => {

	const transition = createPreviewPoseTransition( createPose( { cameraZ: 10, fov: 70 } ), { duration: 0.32 } );
	retargetPreviewPoseTransition( transition, createPose( { cameraZ: 6, fov: 34 } ), { immediate: false } );

	const midPose = advancePreviewPoseTransition( transition, 0.16 );
	assertClose( midPose.cameraPos.z, 8 );
	assertClose( midPose.fov, 52 );
	assert.equal( transition.active, true );

	const finalPose = advancePreviewPoseTransition( transition, 0.16 );
	assertClose( finalPose.cameraPos.z, 6 );
	assertClose( finalPose.fov, 34 );
	assert.equal( transition.active, false );

} );

test( 'retargetPreviewPoseTransition restarts from the current in-flight pose', () => {

	const transition = createPreviewPoseTransition( createPose( { cameraX: 0 } ), { duration: 0.32 } );
	retargetPreviewPoseTransition( transition, createPose( { cameraX: 10 } ), { immediate: false } );
	advancePreviewPoseTransition( transition, 0.08 );

	const beforeRetargetX = transition.currentPose.cameraPos.x;
	retargetPreviewPoseTransition( transition, createPose( { cameraX: 20 } ), { immediate: false } );

	assertClose( transition.startPose.cameraPos.x, beforeRetargetX );
	assertClose( transition.currentPose.cameraPos.x, beforeRetargetX );
	assert.equal( transition.targetPose.cameraPos.x, 20 );

} );

test( 'retargetPreviewPoseTransition supports immediate snaps', () => {

	const transition = createPreviewPoseTransition( createPose( { cameraY: 1 } ), { duration: 0.32 } );

	retargetPreviewPoseTransition(
		transition,
		createPose( { cameraY: 4, fov: 35, kartRotationY: Math.PI / 2 } ),
		{ immediate: true }
	);

	assert.equal( transition.active, false );
	assertClose( transition.currentPose.cameraPos.y, 4 );
	assertClose( transition.currentPose.fov, 35 );
	assertClose( transition.currentPose.kartRotationY, Math.PI / 2 );

} );

test( 'advancePreviewPoseTransition rotates across the shortest angular path', () => {

	const transition = createPreviewPoseTransition(
		createPose( { kartRotationY: ( 350 * Math.PI ) / 180 } ),
		{ duration: 0.32 }
	);
	retargetPreviewPoseTransition(
		transition,
		createPose( { kartRotationY: ( 10 * Math.PI ) / 180 } ),
		{ immediate: false }
	);

	const midPose = advancePreviewPoseTransition( transition, 0.16 );
	assertClose( midPose.kartRotationY, 0, 1e-5 );

} );
