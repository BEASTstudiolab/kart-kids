import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrackLibraryStore } from '../../js/track-library/TrackLibraryStore.js';

class MemoryStorage {

	constructor() {

		this._map = new Map();

	}

	getItem( key ) {

		return this._map.has( key ) ? this._map.get( key ) : null;

	}

	setItem( key, value ) {

		this._map.set( key, String( value ) );

	}

	removeItem( key ) {

		this._map.delete( key );

	}

	clear() {

		this._map.clear();

	}

}

describe( 'TrackLibraryStore', () => {

	let originalLocalStorage;

	beforeEach( () => {

		originalLocalStorage = globalThis.localStorage;
		globalThis.localStorage = new MemoryStorage();

	} );

	afterEach( () => {

		if ( originalLocalStorage === undefined ) {

			delete globalThis.localStorage;

		} else {

			globalThis.localStorage = originalLocalStorage;

		}

	} );

	it( 'normalizes saved snapshots so legacy name-based UI still sees a name', () => {

		globalThis.localStorage.setItem( 'kk-track-library-saved', JSON.stringify( [
			{
				id: 'saved-1',
				trackId: 'saved:saved-1',
				title: 'Published Sunset',
				publicId: 'pub-1',
				versionId: 'ver-1',
				creatorName: 'Caleb',
				savedAt: '2026-04-13T12:00:00.000Z',
				trackData: {
					v: 4,
					meta: { name: 'Published Sunset' },
					trackTiles: [
						{ gx: 0, gz: 0, t: 3, o: 2 },
						{ gx: 1, gz: 0, t: 0, o: 2 },
					],
					props: [],
					markers: [],
				},
				source: 'published',
			},
		] ) );

		const store = new TrackLibraryStore();
		const [ savedTrack ] = store.getSavedTracks();

		assert.equal( savedTrack.title, 'Published Sunset' );
		assert.equal( savedTrack.name, 'Published Sunset' );
		assert.equal( savedTrack.trackId, 'saved:saved-1' );

	} );

} );
