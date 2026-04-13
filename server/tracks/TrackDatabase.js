import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export class TrackDatabase {

	constructor( dbPath ) {

		mkdirSync( dirname( dbPath ), { recursive: true } );

		this._db = new Database( dbPath );
		this._db.pragma( 'journal_mode = WAL' );
		this._db.pragma( 'foreign_keys = ON' );
		this._db.pragma( 'synchronous = NORMAL' );

		this._initSchema();

	}

	get db() {

		return this._db;

	}

	close() {

		this._db.close();

	}

	_initSchema() {

		this._db.exec( `
			CREATE TABLE IF NOT EXISTS published_tracks (
				public_id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				creator_name TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'live',
				current_version_id TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				unavailable_at TEXT
			);

			CREATE TABLE IF NOT EXISTS published_track_versions (
				version_id TEXT PRIMARY KEY,
				public_id TEXT NOT NULL,
				version_number INTEGER NOT NULL,
				title TEXT NOT NULL,
				creator_name TEXT NOT NULL,
				track_json TEXT NOT NULL,
				created_at TEXT NOT NULL,
				FOREIGN KEY ( public_id ) REFERENCES published_tracks ( public_id ) ON DELETE CASCADE
			);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_track_versions_public_version
			ON published_track_versions ( public_id, version_number );

			CREATE TABLE IF NOT EXISTS manage_tokens (
				public_id TEXT PRIMARY KEY,
				token_hash TEXT NOT NULL UNIQUE,
				created_at TEXT NOT NULL,
				last_used_at TEXT,
				FOREIGN KEY ( public_id ) REFERENCES published_tracks ( public_id ) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS spotlight_entries (
				entry_id TEXT PRIMARY KEY,
				public_id TEXT NOT NULL,
				version_id TEXT NOT NULL,
				created_at TEXT NOT NULL,
				removed_at TEXT,
				FOREIGN KEY ( public_id ) REFERENCES published_tracks ( public_id ) ON DELETE CASCADE,
				FOREIGN KEY ( version_id ) REFERENCES published_track_versions ( version_id ) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_spotlight_active
			ON spotlight_entries ( created_at )
			WHERE removed_at IS NULL;
		` );

	}

}
