import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
	location: {
		hostname: 'localhost',
		search: '',
		hash: '',
	},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => {},
};

globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

globalThis.document = globalThis.document || {
	createElement: () => ( {
		getContext: () => null,
		style: {},
		appendChild: () => {},
		setAttribute: () => {},
	} ),
	head: { appendChild: () => {} },
	body: { appendChild: () => {}, removeChild: () => {} },
	getElementById: () => null,
	addEventListener: () => {},
	removeEventListener: () => {},
};

globalThis.localStorage = globalThis.localStorage || {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {},
	clear: () => {},
};

globalThis.performance = globalThis.performance || { now: () => 0 };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ( () => 1 );
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ( () => {} );

if ( typeof globalThis.CustomEvent === 'undefined' ) {

	globalThis.CustomEvent = class CustomEvent {

		constructor( type, init ) {

			this.type = type;
			this.detail = init?.detail ?? null;

		}

	};

}

const { AppShell } = await import( '../js/ui/core/AppShell.js' );

function createFakeTabElement() {

	return {
		style: {},
		classList: {
			add: () => {},
			remove: () => {},
			toggle: () => {},
		},
		setAttribute: () => {},
	};

}

test( 'AppShell menu music helpers activate and deactivate the shared player', async () => {

	const shell = new AppShell( {} );
	const calls = [];
	shell._menuMusic = {
		activate: async () => {

			calls.push( 'activate' );
			return true;

		},
		deactivate: () => {

			calls.push( 'deactivate' );

		},
	};

	const activated = await shell._activateMenuMusic();
	shell._deactivateMenuMusic();

	assert.equal( activated, true );
	assert.deepEqual( calls, [ 'activate', 'deactivate' ] );

} );

test( 'AppShell.hidePartyLobby keeps menu music alive and restores shell state', () => {

	const shell = new AppShell( {} );
	let disposed = 0;
	shell._partyLobbyScene = {
		dispose: () => {

			disposed ++;

		},
	};
	shell._renderMode = 'party-lobby';
	shell._pageContainer = { style: { display: 'none' } };
	shell._tabBarEl = { style: { display: 'none' } };

	shell.hidePartyLobby();

	assert.equal( disposed, 1 );
	assert.equal( shell._partyLobbyScene, null );
	assert.equal( shell._renderMode, 'lobby' );
	assert.equal( shell._pageContainer.style.display, '' );
	assert.equal( shell._tabBarEl.style.display, '' );

} );

test( 'AppShell.startRace deactivates menu music before starting the engine', async () => {

	const shell = new AppShell( {} );
	const callOrder = [];
	shell._menuMusic = {
		deactivate: () => {

			callOrder.push( 'deactivate' );

		},
	};
	shell._engine = {
		start: async () => {

			callOrder.push( 'start' );

		},
		stop: () => {},
	};
	shell._shell = { style: { display: '' } };
	shell._tabBarEl = { style: { display: '' } };
	shell._lobbyScene = null;

	await shell.startRace( { mode: 'solo' } );

	assert.deepEqual( callOrder, [ 'deactivate', 'start' ] );
	assert.equal( shell._renderMode, 'race' );

} );

test( 'AppShell.startRace reactivates menu music when engine startup fails', async () => {

	const shell = new AppShell( {} );
	const callOrder = [];
	shell._menuMusic = {
		deactivate: () => {

			callOrder.push( 'deactivate' );

		},
		activate: async () => {

			callOrder.push( 'activate' );
			return true;

		},
	};
	shell._engine = {
		start: async () => {

			callOrder.push( 'start' );
			throw new Error( 'boom' );

		},
		stop: () => {},
	};
	shell._shell = { style: { display: '' } };
	shell._tabBarEl = { style: { display: '' } };
	shell._lobbyScene = null;
	shell._notification = { show: () => {} };

	await shell.startRace( { mode: 'solo' } );

	assert.deepEqual( callOrder, [ 'deactivate', 'start', 'activate' ] );
	assert.equal( shell._renderMode, 'idle' );
	assert.equal( shell._shell.style.display, '' );
	assert.equal( shell._tabBarEl.style.display, '' );

} );

test( 'AppShell.setMenuPreviewFocus delegates to the shared lobby scene', () => {

	const shell = new AppShell( {} );
	const calls = [];
	shell._lobbyScene = {
		setPreviewPreset: ( presetId, options ) => {

			calls.push( { presetId, options } );

		},
	};

	shell.setMenuPreviewFocus( 'character-face', { immediate: true } );

	assert.deepEqual( calls, [ {
		presetId: 'character-face',
		options: { immediate: true },
	} ] );

} );

test( 'AppShell preview tuning helpers delegate to the shared lobby scene', () => {

	const shell = new AppShell( {} );
	const calls = [];
	shell._lobbyScene = {
		setPreviewTuning: ( tuning, options ) => {

			calls.push( [ 'set', tuning, options ] );

		},
		resetPreviewTuning: ( options ) => {

			calls.push( [ 'reset', options ] );

		},
		getPreviewTuning: () => ( {
			cameraOffsetX: 0.1,
		} ),
		getResolvedPreviewPose: () => ( {
			presetId: 'character-face',
			cameraPos: { x: 0.4, y: 2.92, z: 3.65 },
			lookAt: { x: 0.4, y: 1.68, z: - 0.02 },
			fov: 28,
			kartRotYDeg: 1434,
		} ),
	};

	shell.setMenuPreviewTuning( { cameraOffsetY: 0.3 }, { immediate: true } );
	shell.resetMenuPreviewTuning();

	assert.deepEqual( calls, [
		[ 'set', { cameraOffsetY: 0.3 }, { immediate: true } ],
		[ 'reset', {} ],
	] );
	assert.deepEqual( shell.getMenuPreviewTuning(), { cameraOffsetX: 0.1 } );
	assert.deepEqual( shell.getMenuPreviewPose(), {
		presetId: 'character-face',
		cameraPos: { x: 0.4, y: 2.92, z: 3.65 },
		lookAt: { x: 0.4, y: 1.68, z: - 0.02 },
		fov: 28,
		kartRotYDeg: 1434,
	} );

} );

test( 'AppShell.switchTab applies contextual preview presets for shared menu scene', () => {

	const shell = new AppShell( {} );
	const presetCalls = [];
	const tabNames = [ 'race', 'character', 'garage', 'tracks', 'profile' ];

	shell._panels = new Map( tabNames.map( ( name ) => [ name, createFakeTabElement() ] ) );
	shell._tabButtons = new Map( tabNames.map( ( name ) => [ name, createFakeTabElement() ] ) );
	shell._analytics = { trackPageView: () => {} };
	shell._announce = () => {};
	shell._lobbyScene = {
		setKart: () => {},
		setAppearance: () => {},
		setPreviewPreset: ( presetId ) => {

			presetCalls.push( presetId );

		},
	};

	shell.switchTab( 'character' );
	shell.switchTab( 'garage' );
	shell.switchTab( 'race' );

	assert.deepEqual( presetCalls, [ 'character-body', 'garage-kart', 'play' ] );

} );

test( 'AppShell.startDebugSoloRace resolves a built-in track id before delegating to startRace', async () => {

	const shell = new AppShell( {} );
	let capturedConfig = null;
	shell.startRace = async ( config ) => {

		capturedConfig = config;
		return true;

	};

	await shell.startDebugSoloRace( { trackId: 'reverse-rush' } );

	assert.equal( capturedConfig.mode, 'solo' );
	assert.equal( capturedConfig.trackId, 'reverse-rush' );
	assert.ok( Array.isArray( capturedConfig.trackData ) );
	assert.ok( capturedConfig.trackData.length > 0 );
	assert.ok( Array.isArray( capturedConfig.decoCells ) );

} );

test( 'AppShell.startDebugSoloRace leaves custom config untouched when track id is unknown', async () => {

	const shell = new AppShell( {} );
	let capturedConfig = null;
	shell.startRace = async ( config ) => {

		capturedConfig = config;
		return true;

	};

	await shell.startDebugSoloRace( {
		trackId: 'missing-track',
		trackData: [ [ 1, 2, 3 ] ],
		decoCells: [ [ 4, 5, 6 ] ],
	} );

	assert.equal( capturedConfig.mode, 'solo' );
	assert.equal( capturedConfig.trackId, 'missing-track' );
	assert.deepEqual( capturedConfig.trackData, [ [ 1, 2, 3 ] ] );
	assert.deepEqual( capturedConfig.decoCells, [ [ 4, 5, 6 ] ] );

} );
