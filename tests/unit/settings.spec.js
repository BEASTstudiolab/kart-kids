import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// ── Mock browser globals before importing Settings ─────────────────────────

const store = {};

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || {
	createElement: () => ( { getContext: () => null } ),
};

// Mock localStorage
const mockLocalStorage = {
	getItem: ( key ) => ( key in store ? store[ key ] : null ),
	setItem: ( key, value ) => { store[ key ] = String( value ); },
	removeItem: ( key ) => { delete store[ key ]; },
	clear: () => { for ( const k of Object.keys( store ) ) delete store[ k ]; },
};

globalThis.localStorage = mockLocalStorage;
globalThis.window.localStorage = mockLocalStorage;

// Mock dispatchEvent — capture events for optional inspection
const dispatchedEvents = [];
globalThis.window.dispatchEvent = ( event ) => { dispatchedEvents.push( event ); };
globalThis.dispatchEvent = globalThis.window.dispatchEvent;

// Mock CustomEvent if not available
if ( typeof globalThis.CustomEvent === 'undefined' ) {

	globalThis.CustomEvent = class CustomEvent {

		constructor( type, init ) {

			this.type = type;
			this.detail = init?.detail ?? null;

		}

	};

}

// Mock performance.now for AdaptiveQuality
if ( typeof globalThis.performance === 'undefined' ) {

	globalThis.performance = { now: () => Date.now() };

}

// Now import Settings (after mocks are in place)
const { Settings } = await import( '../../js/Settings.js' );

const STORAGE_KEY = 'kart-kids-settings';

function clearState() {

	mockLocalStorage.clear();
	dispatchedEvents.length = 0;

}

// ── Tests ──────────────────────────────────────────────────────────────────
//
// NOTE: Settings.js uses Object.assign({}, DEFAULTS) which is a shallow copy.
// Nested objects (profile, loadout, stats) share references with DEFAULTS.
// Calling setDisplayName() etc. mutates the shared DEFAULTS nested objects.
// Tests that depend on pristine DEFAULTS (migration, corrupt data) are placed
// before any tests that mutate nested properties to avoid cross-contamination.
// This is a known shallow-copy limitation in Settings.js.

describe( 'Settings', () => {

	beforeEach( () => {

		clearState();

	} );

	// ── Tests that need pristine DEFAULTS (no nested-object mutation yet) ──

	it( 'initializes with defaults on fresh localStorage', () => {

		const s = new Settings();
		assert.strictEqual( s.get( 'handedness' ), 'right' );
		assert.strictEqual( s.get( 'accelerometer' ), false );
		assert.strictEqual( s.get( 'vehicleModel' ), 'kart-1' );

	} );

	it( 'isFirstRun() returns true when displayName is null', () => {

		const s = new Settings();
		assert.strictEqual( s.isFirstRun(), true );

	} );

	it( 'getSelectedKartId returns default kart-1', () => {

		const s = new Settings();
		assert.strictEqual( s.getSelectedKartId(), 'kart-1' );

	} );

	it( 'schema migration: v2 data gets profile/loadout/stats namespaces', () => {

		mockLocalStorage.setItem( STORAGE_KEY, JSON.stringify( {
			_version: 2,
			handedness: 'left',
			vehicleModel: 'kart-2',
		} ) );

		const s = new Settings();
		assert.strictEqual( s.get( 'handedness' ), 'left' );
		// Profile namespace should exist with defaults
		assert.strictEqual( s.isFirstRun(), true );
		assert.strictEqual( s.getSelectedKartId(), 'kart-1' );
		assert.strictEqual( s.getStats().totalRaces, 0 );

	} );

	it( 'schema migration: v0 postProcessing=false migrates to quality=low', () => {

		mockLocalStorage.setItem( STORAGE_KEY, JSON.stringify( {
			postProcessing: false,
		} ) );

		const s = new Settings();
		assert.strictEqual( s.get( 'quality' ), 'low' );

	} );

	it( 'corrupt localStorage data falls back to defaults gracefully', () => {

		mockLocalStorage.setItem( STORAGE_KEY, 'NOT VALID JSON {{{{' );

		const s = new Settings();
		// Should not throw, should have defaults
		assert.strictEqual( s.get( 'handedness' ), 'right' );
		assert.strictEqual( s.isFirstRun(), true );

	} );

	// ── Tests that mutate nested DEFAULTS objects ──────────────────────────

	it( 'setDisplayName persists and isFirstRun returns false', () => {

		const s = new Settings();
		s.setDisplayName( 'Test' );
		assert.strictEqual( s.isFirstRun(), false );
		assert.strictEqual( s.getDisplayName(), 'Test' );

		// Verify persisted to localStorage
		const stored = JSON.parse( mockLocalStorage.getItem( STORAGE_KEY ) );
		assert.strictEqual( stored.profile.displayName, 'Test' );

	} );

	it( 'setSelectedKartId persists', () => {

		const s = new Settings();
		s.setSelectedKartId( 'kart-2' );
		assert.strictEqual( s.getSelectedKartId(), 'kart-2' );

		// Verify via new instance reading from localStorage
		const s2 = new Settings();
		assert.strictEqual( s2.getSelectedKartId(), 'kart-2' );

	} );

	it( 'incrementTotalRaces increments stats.totalRaces', () => {

		const s = new Settings();
		const baseline = s.getStats().totalRaces;
		s.incrementTotalRaces();
		assert.strictEqual( s.getStats().totalRaces, baseline + 1 );
		s.incrementTotalRaces();
		assert.strictEqual( s.getStats().totalRaces, baseline + 2 );

	} );

	it( 'incrementWins increments stats.wins', () => {

		const s = new Settings();
		const baseline = s.getStats().wins;
		s.incrementWins();
		assert.strictEqual( s.getStats().wins, baseline + 1 );

	} );

	it( 'setBestTime stores a best time', () => {

		const s = new Settings();
		s.setBestTime( 'track1', 60.5 );
		assert.strictEqual( s.getBestTime( 'track1' ), 60.5 );

	} );

	it( 'setBestTime does NOT overwrite a better (lower) time', () => {

		const s = new Settings();
		s.setBestTime( 'unique-track-a', 60.5 );
		s.setBestTime( 'unique-track-a', 70.0 );
		assert.strictEqual( s.getBestTime( 'unique-track-a' ), 60.5 );

	} );

	it( 'setBestTime DOES overwrite a worse (higher) time', () => {

		const s = new Settings();
		s.setBestTime( 'unique-track-b', 60.5 );
		s.setBestTime( 'unique-track-b', 50.0 );
		assert.strictEqual( s.getBestTime( 'unique-track-b' ), 50.0 );

	} );

	it( 'dispatches settings-changed event on set()', () => {

		const s = new Settings();
		dispatchedEvents.length = 0;
		s.set( 'handedness', 'left' );
		assert.ok( dispatchedEvents.length >= 1 );
		const ev = dispatchedEvents[ dispatchedEvents.length - 1 ];
		assert.strictEqual( ev.type, 'settings-changed' );
		assert.strictEqual( ev.detail.key, 'handedness' );
		assert.strictEqual( ev.detail.value, 'left' );

	} );

} );
