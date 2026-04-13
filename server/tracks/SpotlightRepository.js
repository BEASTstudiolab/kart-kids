import { randomUUID } from 'crypto';

function _now() {

	return new Date().toISOString();

}

export class SpotlightRepository {

	constructor( trackDatabase, publishedTracks ) {

		this._db = trackDatabase.db;
		this._publishedTracks = publishedTracks;

		this._pinStmt = this._db.prepare( `
			INSERT INTO spotlight_entries ( entry_id, public_id, version_id, created_at, removed_at )
			VALUES ( @entry_id, @public_id, @version_id, @created_at, NULL )
		` );

		this._removeStmt = this._db.prepare( `
			UPDATE spotlight_entries
			SET removed_at = @removed_at
			WHERE entry_id = @entry_id
		` );

		this._listStmt = this._db.prepare( `
			SELECT
				s.entry_id,
				s.public_id,
				s.version_id,
				s.created_at,
				v.title,
				v.creator_name,
				v.track_json,
				p.status
			FROM spotlight_entries s
			JOIN published_track_versions v
				ON v.version_id = s.version_id
			JOIN published_tracks p
				ON p.public_id = s.public_id
			WHERE s.removed_at IS NULL
			ORDER BY s.created_at DESC
		` );

	}

	listActiveSpotlight() {

		return this._listStmt.all()
			.filter( ( row ) => row.status === 'live' )
			.map( ( row ) => ( {
				entryId: row.entry_id,
				publicId: row.public_id,
				versionId: row.version_id,
				title: row.title,
				creatorName: row.creator_name,
				createdAt: row.created_at,
				trackData: JSON.parse( row.track_json ),
			} ) );

	}

	pinTrack( publicId, versionId = null ) {

		const track = this._publishedTracks.getTrackByPublicId( publicId );
		if ( ! track ) return null;

		const targetVersionId = versionId || track.currentVersionId;
		const entryId = randomUUID();

		this._pinStmt.run( {
			entry_id: entryId,
			public_id: publicId,
			version_id: targetVersionId,
			created_at: _now(),
		} );

		return { entryId, publicId, versionId: targetVersionId };

	}

	removeSpotlight( entryId ) {

		this._removeStmt.run( {
			entry_id: entryId,
			removed_at: _now(),
		} );

	}

}
