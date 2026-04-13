import { getTracks, getTrackById } from '../TrackRegistry.js';
import { createOfficialTrackRecord, createPublicSnapshotRecord, makeOfficialTrackId, makePublishedTrackId, makeSavedTrackId, makeSpotlightTrackId, v4ToCells } from './TrackRecordMappers.js';
import { PublishedOwnershipStore } from './PublishedOwnershipStore.js';

const SAVED_SNAPSHOTS_KEY = 'kk-track-library-saved';
const LEGACY_SAVES_KEY = 'racing-editor-saved-tracks';
const LEGACY_V4_INDEX_KEY = 'kk-editor-saved-tracks';

function _safeParseArray( raw ) {

	try {

		const parsed = JSON.parse( raw || '[]' );
		return Array.isArray( parsed ) ? parsed : [];

	} catch {

		return [];

	}

}

function _loadLegacyStringSaves() {

	return _safeParseArray( localStorage.getItem( LEGACY_SAVES_KEY ) ).map( ( track ) => ( {
		id: track.id || `legacy-${ track.name }`,
		trackId: makeSavedTrackId( track.id || `legacy-${ track.name }` ),
		title: track.name,
		name: track.name,
		pieces: track.pieces,
		savedAt: track.date,
		cells: Array.isArray( track.cells ) ? track.cells : [],
		trackData: null,
		source: 'legacy',
	} ) );

}

function _loadLegacyV4Saves() {

	const index = _safeParseArray( localStorage.getItem( LEGACY_V4_INDEX_KEY ) );
	return index.map( ( entry ) => {

		try {

			const raw = localStorage.getItem( `kk-project-${ entry.id }` );
			if ( ! raw ) return null;

			const trackData = JSON.parse( raw );
			return {
				id: entry.id,
				trackId: makeSavedTrackId( entry.id ),
				title: entry.name,
				name: entry.name,
				pieces: entry.pieces,
				savedAt: entry.date,
				trackData,
				cells: v4ToCells( trackData ),
				source: 'editor',
			};

		} catch {

			return null;

		}

	} ).filter( Boolean );

}

export class TrackLibraryStore {

	constructor() {

		this._ownerships = new PublishedOwnershipStore();

	}

	getOfficialTracks() {

		return getTracks().map( createOfficialTrackRecord );

	}

	getSavedTracks() {

		const snapshots = _safeParseArray( localStorage.getItem( SAVED_SNAPSHOTS_KEY ) );
	const snapshotRecords = snapshots.map( ( entry ) => ( {
		...entry,
		trackId: entry.trackId || makeSavedTrackId( entry.id ),
		name: entry.name || entry.title || 'Untitled',
		title: entry.title || entry.name || 'Untitled',
		cells: Array.isArray( entry.cells ) ? entry.cells : ( entry.trackData ? v4ToCells( entry.trackData ) : [] ),
		source: entry.source || 'published',
	} ) );

		const all = [ ...snapshotRecords, ..._loadLegacyV4Saves(), ..._loadLegacyStringSaves() ];
		const seen = new Set();
		return all.filter( ( entry ) => {

			if ( seen.has( entry.trackId ) ) return false;
			seen.add( entry.trackId );
			return true;

		} );

	}

	savePublishedTrack( track, source = 'published' ) {

		const snapshot = createPublicSnapshotRecord( track );
		snapshot.source = source;
		const current = this.getSavedTracks()
			.filter( ( entry ) => entry.source === 'published' || entry.source === 'owned' )
			.filter( ( entry ) => ! ( entry.publicId === snapshot.publicId && entry.versionId === snapshot.versionId ) )
			.map( ( entry ) => ( {
				id: entry.id,
				trackId: entry.trackId,
				publicId: entry.publicId || null,
				versionId: entry.versionId || null,
				title: entry.title,
				name: entry.name || entry.title,
				creatorName: entry.creatorName || '',
				savedAt: entry.savedAt || new Date().toISOString(),
				trackData: entry.trackData || null,
				cells: entry.cells || [],
				source: entry.source || 'published',
			} ) );

		current.unshift( snapshot );
		localStorage.setItem( SAVED_SNAPSHOTS_KEY, JSON.stringify( current ) );
		return snapshot;

	}

	saveOwnedPublishedTrack( track, manageToken ) {

		this._ownerships.save( {
			publicId: track.publicId,
			manageToken,
			title: track.title,
			creatorName: track.creatorName,
			currentVersionId: track.currentVersionId,
			status: track.status,
			updatedAt: track.updatedAt,
		} );

		const snapshot = this.savePublishedTrack( track, 'owned' );
		return snapshot;

	}

	getOwnerships() {

		return this._ownerships.getAll().map( ( entry ) => ( {
			...entry,
			trackId: makePublishedTrackId( entry.publicId ),
			title: entry.title,
			source: 'published',
		} ) );

	}

	getTrackById( trackId ) {

		if ( ! trackId ) return null;

		if ( trackId.startsWith( 'official:' ) ) {

			const officialId = trackId.slice( 'official:'.length );
			const official = getTrackById( officialId );
			return official ? createOfficialTrackRecord( official ) : null;

		}

		if ( trackId.startsWith( 'saved:' ) ) {

			return this.getSavedTracks().find( ( entry ) => entry.trackId === trackId ) || null;

		}

		if ( trackId.startsWith( 'published:' ) ) {

			return this.getOwnerships().find( ( entry ) => entry.trackId === trackId ) || null;

		}

		const official = getTrackById( trackId );
		if ( official ) return createOfficialTrackRecord( official );

		if ( trackId.startsWith( 'user:' ) ) {

			const legacyName = trackId.slice( 'user:'.length );
			return this.getSavedTracks().find( ( entry ) => entry.title === legacyName || entry.name === legacyName ) || null;

		}

		return this.getSavedTracks().find( ( entry ) => entry.trackId === trackId ) || null;

	}

	resolveSelectedTrack( trackId ) {

		const resolved = this.getTrackById( trackId );
		if ( resolved ) return resolved;

		const fallback = this.getOfficialTracks()[ 0 ];
		return fallback || null;

	}

	mapSpotlightTrack( track ) {

		return {
			id: track.entryId,
			trackId: makeSpotlightTrackId( track.entryId ),
			publicId: track.publicId,
			versionId: track.versionId,
			title: track.title,
			name: track.title,
			creatorName: track.creatorName,
			cells: v4ToCells( track.trackData ),
			trackData: track.trackData,
			source: 'spotlight',
		};

	}

}
