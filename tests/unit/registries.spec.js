import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
	getAllVehicles,
	getVehicleById,
	getVehicleStats,
	getAllCharacters,
	PLAYER_VEHICLES,
	PLAYER_CHARACTERS,
} from '../../js/VehicleRegistry.js';
import {
	getTracks,
	getTrackById,
	getRandomTrack,
} from '../../js/TrackRegistry.js';

// ── VehicleRegistry ────────────────────────────────────────────────────────

describe( 'VehicleRegistry', () => {

	describe( 'getAllVehicles', () => {

		it( 'returns an array with 2+ entries', () => {

			const vehicles = getAllVehicles();
			assert.ok( Array.isArray( vehicles ) );
			assert.ok( vehicles.length >= 2, `Expected >= 2 vehicles, got ${ vehicles.length }` );

		} );

		it( 'each vehicle has id, label, path, stats', () => {

			for ( const v of getAllVehicles() ) {

				assert.ok( typeof v.id === 'string', `vehicle missing id` );
				assert.ok( typeof v.label === 'string', `vehicle missing label` );
				assert.ok( typeof v.path === 'string', `vehicle missing path` );
				assert.ok( v.stats && typeof v.stats === 'object', `vehicle missing stats` );

			}

		} );

		it( 'returned array is frozen (immutable)', () => {

			assert.ok( Object.isFrozen( PLAYER_VEHICLES ) );

		} );

		it( 'each vehicle object is frozen', () => {

			for ( const v of getAllVehicles() ) {

				assert.ok( Object.isFrozen( v ), `vehicle ${ v.id } is not frozen` );

			}

		} );

	} );

	describe( 'getVehicleById', () => {

		it( 'returns correct vehicle for kart-1', () => {

			const v = getVehicleById( 'kart-1' );
			assert.strictEqual( v.id, 'kart-1' );
			assert.strictEqual( v.label, 'Kart 1' );

		} );

		it( 'returns fallback (first vehicle) for nonexistent id', () => {

			const v = getVehicleById( 'nonexistent' );
			assert.strictEqual( v.id, PLAYER_VEHICLES[ 0 ].id );

		} );

	} );

	describe( 'getVehicleStats', () => {

		it( 'returns stats object with speed/handling/acceleration/weight/boost for kart-1', () => {

			const stats = getVehicleStats( 'kart-1' );
			assert.ok( stats !== null );
			for ( const key of [ 'speed', 'handling', 'acceleration', 'weight', 'boost' ] ) {

				assert.ok( typeof stats[ key ] === 'number', `missing stat: ${ key }` );

			}

		} );

		it( 'stats object is frozen', () => {

			const stats = getVehicleStats( 'kart-1' );
			assert.ok( Object.isFrozen( stats ) );

		} );

		it( 'returns null for nonexistent id', () => {

			assert.strictEqual( getVehicleStats( 'nonexistent' ), null );

		} );

	} );

	describe( 'getAllCharacters', () => {

		it( 'returns array with at least 1 entry', () => {

			const chars = getAllCharacters();
			assert.ok( Array.isArray( chars ) );
			assert.ok( chars.length >= 1 );

		} );

		it( 'returned array is frozen', () => {

			assert.ok( Object.isFrozen( PLAYER_CHARACTERS ) );

		} );

	} );

} );

// ── TrackRegistry ──────────────────────────────────────────────────────────

describe( 'TrackRegistry', () => {

	describe( 'getTracks', () => {

		it( 'returns non-empty array', () => {

			const tracks = getTracks();
			assert.ok( Array.isArray( tracks ) );
			assert.ok( tracks.length > 0 );

		} );

		it( 'returned array is frozen', () => {

			assert.ok( Object.isFrozen( getTracks() ) );

		} );

	} );

	describe( 'getTrackById', () => {

		it( 'returns starter-circuit with cells', () => {

			const t = getTrackById( 'starter-circuit' );
			assert.ok( t !== undefined );
			assert.strictEqual( t.id, 'starter-circuit' );
			assert.ok( Array.isArray( t.cells ) );
			assert.ok( t.cells.length > 0 );

		} );

		it( 'returns undefined for nonexistent id', () => {

			assert.strictEqual( getTrackById( 'nonexistent' ), undefined );

		} );

	} );

	describe( 'getRandomTrack', () => {

		it( 'returns a valid track object', () => {

			const t = getRandomTrack();
			assert.ok( t !== undefined );
			assert.ok( typeof t.id === 'string' );
			assert.ok( typeof t.name === 'string' );
			assert.ok( Array.isArray( t.cells ) );

		} );

	} );

} );
