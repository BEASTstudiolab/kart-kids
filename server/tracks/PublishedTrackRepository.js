import { randomUUID, randomBytes } from 'crypto';

function _now() {

	return new Date().toISOString();

}

function _makePublicId() {

	return randomBytes( 9 ).toString( 'base64url' );

}

function _assertV4Track( trackData ) {

	return !! ( trackData && typeof trackData === 'object' && Array.isArray( trackData.trackTiles ) );

}

function _parseTrackJson( raw ) {

	try {

		return JSON.parse( raw );

	} catch {

		return null;

	}

}

export class PublishedTrackRepository {

	constructor( trackDatabase, manageTokens ) {

		this._db = trackDatabase.db;
		this._manageTokens = manageTokens;

		this._insertTrackStmt = this._db.prepare( `
			INSERT INTO published_tracks (
				public_id, title, creator_name, status, current_version_id, created_at, updated_at, unavailable_at
			)
			VALUES (
				@public_id, @title, @creator_name, @status, @current_version_id, @created_at, @updated_at, @unavailable_at
			)
		` );

		this._insertVersionStmt = this._db.prepare( `
			INSERT INTO published_track_versions (
				version_id, public_id, version_number, title, creator_name, track_json, created_at
			)
			VALUES (
				@version_id, @public_id, @version_number, @title, @creator_name, @track_json, @created_at
			)
		` );

		this._upsertManageTokenStmt = this._db.prepare( `
			INSERT INTO manage_tokens ( public_id, token_hash, created_at, last_used_at )
			VALUES ( @public_id, @token_hash, @created_at, NULL )
			ON CONFLICT ( public_id ) DO UPDATE SET
				token_hash = excluded.token_hash,
				created_at = excluded.created_at
		` );

		this._touchManageTokenStmt = this._db.prepare( `
			UPDATE manage_tokens
			SET last_used_at = @last_used_at
			WHERE public_id = @public_id
		` );

		this._updateTrackLiveVersionStmt = this._db.prepare( `
			UPDATE published_tracks
			SET title = @title,
				current_version_id = @current_version_id,
				updated_at = @updated_at,
				status = @status,
				unavailable_at = @unavailable_at
			WHERE public_id = @public_id
		` );

		this._setStatusStmt = this._db.prepare( `
			UPDATE published_tracks
			SET status = @status,
				updated_at = @updated_at,
				unavailable_at = @unavailable_at
			WHERE public_id = @public_id
		` );

		this._getTrackRowStmt = this._db.prepare( `
			SELECT
				p.public_id,
				p.title,
				p.creator_name,
				p.status,
				p.current_version_id,
				p.created_at,
				p.updated_at,
				p.unavailable_at,
				v.version_number,
				v.track_json
			FROM published_tracks p
			JOIN published_track_versions v
				ON v.version_id = p.current_version_id
			WHERE p.public_id = ?
		` );

		this._getTrackByTokenStmt = this._db.prepare( `
			SELECT
				p.public_id,
				p.title,
				p.creator_name,
				p.status,
				p.current_version_id,
				p.created_at,
				p.updated_at,
				p.unavailable_at,
				v.version_number,
				v.track_json,
				m.token_hash
			FROM manage_tokens m
			JOIN published_tracks p
				ON p.public_id = m.public_id
			JOIN published_track_versions v
				ON v.version_id = p.current_version_id
			WHERE m.token_hash = ?
		` );

		this._getLatestVersionNumberStmt = this._db.prepare( `
			SELECT COALESCE( MAX( version_number ), 0 ) AS version_number
			FROM published_track_versions
			WHERE public_id = ?
		` );

		this._listTracksStmt = this._db.prepare( `
			SELECT public_id, title, creator_name, status, created_at, updated_at
			FROM published_tracks
			ORDER BY updated_at DESC
		` );

	}

	createPublishedTrack( { title, creatorName, trackData } ) {

		if ( ! _assertV4Track( trackData ) ) {

			throw new Error( 'Invalid track payload' );

		}

		const createdAt = _now();
		const publicId = _makePublicId();
		const versionId = randomUUID();
		const manageToken = this._manageTokens.createToken();

		const tx = this._db.transaction( () => {

			this._insertTrackStmt.run( {
				public_id: publicId,
				title,
				creator_name: creatorName,
				status: 'live',
				current_version_id: versionId,
				created_at: createdAt,
				updated_at: createdAt,
				unavailable_at: null,
			} );

			this._insertVersionStmt.run( {
				version_id: versionId,
				public_id: publicId,
				version_number: 1,
				title,
				creator_name: creatorName,
				track_json: JSON.stringify( trackData ),
				created_at: createdAt,
			} );

			this._upsertManageTokenStmt.run( {
				public_id: publicId,
				token_hash: this._manageTokens.hashToken( manageToken ),
				created_at: createdAt,
			} );

		} );

		tx();

		return {
			...this.getTrackByPublicId( publicId ),
			manageToken,
		};

	}

	getTrackByPublicId( publicId ) {

		const row = this._getTrackRowStmt.get( publicId );
		return row ? this._mapTrackRow( row ) : null;

	}

	getTrackByManageToken( token ) {

		const tokenHash = this._manageTokens.hashToken( token );
		const row = this._getTrackByTokenStmt.get( tokenHash );
		if ( ! row ) return null;

		this._touchManageTokenStmt.run( {
			public_id: row.public_id,
			last_used_at: _now(),
		} );

		return this._mapTrackRow( row );

	}

	updatePublishedTrackByToken( token, { title, trackData } ) {

		if ( ! _assertV4Track( trackData ) ) {

			throw new Error( 'Invalid track payload' );

		}

		const current = this.getTrackByManageToken( token );
		if ( ! current ) return null;

		const versionNumber = this._getLatestVersionNumberStmt.get( current.publicId ).version_number + 1;
		const versionId = randomUUID();
		const updatedAt = _now();

		const tx = this._db.transaction( () => {

			this._insertVersionStmt.run( {
				version_id: versionId,
				public_id: current.publicId,
				version_number: versionNumber,
				title,
				creator_name: current.creatorName,
				track_json: JSON.stringify( trackData ),
				created_at: updatedAt,
			} );

			this._updateTrackLiveVersionStmt.run( {
				public_id: current.publicId,
				title,
				current_version_id: versionId,
				updated_at: updatedAt,
				status: 'live',
				unavailable_at: null,
			} );

		} );

		tx();

		return this.getTrackByPublicId( current.publicId );

	}

	unpublishTrackByToken( token ) {

		const current = this.getTrackByManageToken( token );
		if ( ! current ) return null;

		this._setStatusStmt.run( {
			public_id: current.publicId,
			status: 'unpublished',
			updated_at: _now(),
			unavailable_at: _now(),
		} );

		return this.getTrackByPublicId( current.publicId );

	}

	setTrackStatus( publicId, status ) {

		const current = this.getTrackByPublicId( publicId );
		if ( ! current ) return null;

		const unavailableAt = status === 'live' ? null : _now();
		this._setStatusStmt.run( {
			public_id: publicId,
			status,
			updated_at: _now(),
			unavailable_at: unavailableAt,
		} );

		return this.getTrackByPublicId( publicId );

	}

	listTracks() {

		return this._listTracksStmt.all().map( ( row ) => ( {
			publicId: row.public_id,
			title: row.title,
			creatorName: row.creator_name,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		} ) );

	}

	_mapTrackRow( row ) {

		return {
			publicId: row.public_id,
			title: row.title,
			creatorName: row.creator_name,
			status: row.status,
			currentVersionId: row.current_version_id,
			versionNumber: row.version_number,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			unavailableAt: row.unavailable_at,
			trackData: _parseTrackJson( row.track_json ),
		};

	}

}
