import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../js/track-editor/core/EventBus.js';
import { EditorState } from '../js/track-editor/core/EditorState.js';
import { RouteTraceController } from '../js/track-editor/services/RouteTraceController.js';

function fakeButton() {
	const listeners = new Map();
	return {
		disabled: false,
		addEventListener( type, handler ) {
			listeners.set( type, handler );
		},
		removeEventListener( type, handler ) {
			const current = listeners.get( type );
			if ( current === handler ) listeners.delete( type );
		},
		click() {
			listeners.get( 'click' )?.();
		},
		hasListener( type ) {
			return listeners.has( type );
		},
	};
}

function createController( overrides = {} ) {
	const toggles = new Map( [ [ 'routePath', false ] ] );
	const eventBus = overrides.eventBus ?? new EventBus();
	const state = overrides.state ?? new EditorState( eventBus );
	if ( overrides.state?.debugEnabled != null ) state.debugEnabled = overrides.state.debugEnabled;
	const debugOverlay = overrides.debugOverlay ?? {
		getToggle: id => toggles.get( id ),
		setToggle: ( id, value ) => toggles.set( id, value ),
	};
	const validation = overrides.validation ?? {
		validate: () => ( { valid: false, stats: { tileCount: 2 }, issues: [] } ),
	};
	const routeAnalysis = overrides.routeAnalysis ?? {
		analyzeRoute: () => ( { sequence: [] } ),
	};
	const camera = overrides.camera ?? {
		chaseRouteCalls: 0,
		stopChaseCalls: 0,
		pauseChaseCalls: 0,
		resumeChaseCalls: 0,
		chaseRoute() { this.chaseRouteCalls ++; },
		stopChase() { this.stopChaseCalls ++; },
		pauseChase() { this.pauseChaseCalls ++; },
		resumeChase() { this.resumeChaseCalls ++; },
		get isChasePaused() { return this.pauseChaseCalls > this.resumeChaseCalls; },
	};
	const controls = overrides.controls ?? {
		root: { hidden: true },
		play: fakeButton(),
		pause: fakeButton(),
	};

	return {
		controller: new RouteTraceController( {
			state,
			debugOverlay,
			eventBus,
			validation,
			routeAnalysis,
			camera,
			controls,
			...overrides.options,
		} ),
		state,
		toggles,
		eventBus,
		camera,
		controls,
		debugOverlay,
		validation,
		routeAnalysis,
	};
}

test( 'RouteTraceController always starts an overlay session and restores the pre-trace snapshot on stop', () => {
	const { controller, state, toggles, camera, controls, eventBus, debugOverlay } = createController();

	const started = controller.start( { gameplayMode: { id: 'gameplay' } } );

	assert.equal( controller.isActive, true );
	assert.equal( started.playbackAvailable, false );
	assert.equal( state.debugEnabled, true );
	assert.equal( toggles.get( 'routePath' ), true );
	assert.equal( controls.root.hidden, false );
	assert.equal( controls.play.disabled, true );
	assert.equal( controls.pause.disabled, true );
	assert.equal( camera.chaseRouteCalls, 0 );

	eventBus.emit( 'debug:toggled', { enabled: false } );
	assert.equal( state.debugEnabled, true );

	controls.root.hidden = true;
	debugOverlay.setToggle( 'routePath', false );
	assert.equal( toggles.get( 'routePath' ), true );

	state.debugEnabled = false;
	toggles.set( 'routePath', false );

	controller.stop();

	assert.equal( controller.isActive, false );
	assert.equal( state.debugEnabled, false );
	assert.equal( toggles.get( 'routePath' ), false );
	assert.equal( controls.root.hidden, true );
} );

test( 'RouteTraceController restores EditorState through the real debug toggle loop on stop', () => {
	const toggles = new Map( [ [ 'routePath', false ] ] );
	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	const debugOverlay = {
		getToggle: id => toggles.get( id ),
		setToggle: ( id, value ) => toggles.set( id, value ),
	};
	const controller = new RouteTraceController( {
		state,
		debugOverlay,
		eventBus,
		validation: { validate: () => ( { valid: false, stats: { tileCount: 2 }, issues: [] } ) },
		routeAnalysis: { analyzeRoute: () => ( { sequence: [] } ) },
		camera: { stopChase() {}, pauseChase() {}, resumeChase() {}, chaseRoute() {}, get isChasePaused() { return false; } },
		controls: { root: { hidden: true }, play: fakeButton(), pause: fakeButton() },
	} );

	const emitted = [];
	eventBus.on( 'debug:toggled', data => emitted.push( data.enabled ) );

	controller.start( { gameplayMode: { id: 'gameplay' } } );
	assert.equal( state.debugEnabled, true );

	controller.stop();

	assert.equal( state.debugEnabled, false );
	assert.deepEqual( emitted.slice( -2 ), [ true, false ] );
} );

test( 'RouteTraceController dispose can restore an active session without leaving debug pinned on', () => {
	const toggles = new Map( [ [ 'routePath', true ] ] );
	const eventBus = new EventBus();
	const state = new EditorState( eventBus );
	state.debugEnabled = true;
	const debugOverlay = {
		getToggle: id => toggles.get( id ),
		setToggle: ( id, value ) => toggles.set( id, value ),
	};
	const controller = new RouteTraceController( {
		state,
		debugOverlay,
		eventBus,
		validation: { validate: () => ( { valid: false, stats: { tileCount: 2 }, issues: [] } ) },
		routeAnalysis: { analyzeRoute: () => ( { sequence: [] } ) },
		camera: { stopChase() {}, pauseChase() {}, resumeChase() {}, chaseRoute() {}, get isChasePaused() { return false; } },
		controls: { root: { hidden: true }, play: fakeButton(), pause: fakeButton() },
	} );

	controller.start( { gameplayMode: { id: 'gameplay' } } );
	controller.dispose();

	assert.equal( state.debugEnabled, true );
	assert.equal( toggles.get( 'routePath' ), true );
} );

test( 'RouteTraceController enables playback controls only when the gate passes and updates pause/play state', () => {
	const { controller, controls, camera } = createController( {
		validation: {
			validate: () => ( { valid: true, stats: { tileCount: 8 }, issues: [] } ),
		},
		routeAnalysis: {
			analyzeRoute: () => ( { sequence: [
				{ gx: 0, gz: 0 },
				{ gx: 0, gz: 1 },
				{ gx: 1, gz: 1 },
				{ gx: 1, gz: 0 },
			] } ),
		},
	} );

	const started = controller.start( { gameplayMode: { id: 'gameplay' } } );

	assert.equal( started.playbackAvailable, true );
	assert.equal( camera.chaseRouteCalls, 1 );
	assert.equal( controls.play.disabled, true );
	assert.equal( controls.pause.disabled, false );

	controls.pause.click();
	assert.equal( camera.pauseChaseCalls, 1 );
	assert.equal( controls.play.disabled, false );
	assert.equal( controls.pause.disabled, true );

	controls.play.click();
	assert.equal( camera.resumeChaseCalls, 1 );
	assert.equal( controls.play.disabled, true );
	assert.equal( controls.pause.disabled, false );
} );

test( 'RouteTraceController rolls back the pre-trace snapshot if startup fails', () => {
	const { controller, state, toggles } = createController( {
		validation: {
			validate: () => ( { valid: true, stats: { tileCount: 8 }, issues: [] } ),
		},
		routeAnalysis: {
			analyzeRoute: () => ( { sequence: [
				{ gx: 0, gz: 0 },
				{ gx: 0, gz: 1 },
				{ gx: 1, gz: 1 },
				{ gx: 1, gz: 0 },
			] } ),
		},
		camera: {
			stopChaseCalls: 0,
			chaseRoute() {
				throw new Error( 'camera failed to chase route' );
			},
			stopChase() { this.stopChaseCalls ++; },
			pauseChase() {},
			resumeChase() {},
			get isChasePaused() { return false; },
		},
	} );

	assert.throws( () => controller.start( { gameplayMode: { id: 'gameplay' } } ), /camera failed to chase route/ );

	assert.equal( controller.isActive, false );
	assert.equal( controller.playbackAvailable, false );
	assert.equal( state.debugEnabled, false );
	assert.equal( toggles.get( 'routePath' ), false );
	assert.equal( controller._camera.stopChaseCalls, 1 );
} );

test( 'RouteTraceController binds and disposes button listeners cleanly', () => {
	const controls = {
		root: { hidden: true },
		play: fakeButton(),
		pause: fakeButton(),
	};
	const { controller } = createController( { controls } );

	assert.equal( controls.play.hasListener( 'click' ), true );
	assert.equal( controls.pause.hasListener( 'click' ), true );

	controller.dispose();

	assert.equal( controls.play.hasListener( 'click' ), false );
	assert.equal( controls.pause.hasListener( 'click' ), false );
} );
