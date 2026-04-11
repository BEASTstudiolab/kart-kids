import test from 'node:test';
import assert from 'node:assert/strict';

import { CELL_RAW } from '../js/TrackConstants.js';
import { EventBus } from '../js/track-editor/core/EventBus.js';
import { CameraController } from '../js/track-editor/services/CameraController.js';

function createCanvasStub() {
	return {
		clientWidth: 1280,
		clientHeight: 720,
		getBoundingClientRect: () => ( { left: 0, top: 0, width: 1280, height: 720 } ),
	};
}

test( 'CameraController pauses and resumes chase without drifting progress', () => {

	let nowMs = 0;
	const bus = new EventBus();
	const camera = new CameraController( createCanvasStub(), null, bus, () => nowMs );
	const route = [
		{ gx: 0, gz: 0 },
		{ gx: 0, gz: 1 },
		{ gx: 0, gz: 2 },
		{ gx: 0, gz: 3 },
	];

	camera.chaseRoute( route, 1000 );
	nowMs = 500;
	camera.updateChase();
	const beforePause = camera.camera.position.clone();

	camera.pauseChase();
	nowMs = 900;
	camera.updateChase();
	const duringPause = camera.camera.position.clone();

	assert.deepEqual( duringPause.toArray(), beforePause.toArray() );
	assert.equal( camera.isChasePaused, true );

	camera.resumeChase();
	nowMs = 1200;
	camera.updateChase();

	assert.notDeepEqual( camera.camera.position.toArray(), duringPause.toArray() );
	assert.equal( camera.isChasePaused, false );

} );

test( 'CameraController emits camera:moved during chase updates without mutating orbit angle', () => {

	let nowMs = 0;
	const events = [];
	const bus = new EventBus();
	const camera = new CameraController( createCanvasStub(), null, bus, () => nowMs );
	const route = [
		{ gx: 0, gz: 0 },
		{ gx: 1, gz: 0 },
		{ gx: 2, gz: 0 },
		{ gx: 3, gz: 0 },
	];
	const orbitBefore = camera._orbitAngle;

	bus.on( 'camera:moved', event => events.push( event ) );

	camera.chaseRoute( route, 1000 );
	nowMs = 250;
	camera.updateChase();

	assert.equal( camera._orbitAngle, orbitBefore );
	assert.ok( events.length >= 1 );

} );

test( 'CameraController stopChase clears pause bookkeeping', () => {

	let nowMs = 0;
	const bus = new EventBus();
	const camera = new CameraController( createCanvasStub(), null, bus, () => nowMs );
	const route = [
		{ gx: 0, gz: 0 },
		{ gx: 0, gz: 1 },
	];

	camera.chaseRoute( route, 1000 );
	camera.pauseChase();
	camera.stopChase();

	assert.equal( camera.isChasePaused, false );

} );

test( 'CameraController resets chase timing when the route loops', () => {

	let nowMs = 0;
	const events = [];
	const bus = new EventBus();
	const camera = new CameraController( createCanvasStub(), null, bus, () => nowMs );
	const route = [
		{ gx: 0, gz: 0 },
		{ gx: 0, gz: 1 },
		{ gx: 0, gz: 2 },
		{ gx: 0, gz: 3 },
	];
	bus.on( 'camera:moved', event => events.push( event ) );

	camera.chaseRoute( route, 1000 );
	nowMs = 500;
	camera.updateChase();
	camera.pauseChase();
	nowMs = 900;
	camera.resumeChase();
	nowMs = 4500;
	camera.updateChase();

	assert.equal( camera._chaseStartTime, 4500 );
	assert.equal( camera._chaseElapsedBeforePause, 0 );
	assert.ok( events.length >= 2 );
	assert.deepEqual( events.at( -1 ).target.toArray(), [ CELL_RAW / 2, 0, CELL_RAW / 2 ] );

} );

test( 'CameraController clamps invalid chase speeds to a safe minimum', () => {

	let nowMs = 0;
	const events = [];
	const bus = new EventBus();
	const camera = new CameraController( createCanvasStub(), null, bus, () => nowMs );
	const route = [
		{ gx: 0, gz: 0 },
		{ gx: 0, gz: 1 },
		{ gx: 0, gz: 2 },
	];
	bus.on( 'camera:moved', event => events.push( event ) );

	camera.chaseRoute( route, 0 );
	nowMs = 25;
	camera.updateChase();

	assert.ok( events.length >= 1 );
	assert.ok( Number.isFinite( camera.camera.position.x ) );
	assert.ok( Number.isFinite( camera.camera.position.y ) );
	assert.ok( Number.isFinite( camera.camera.position.z ) );

} );
