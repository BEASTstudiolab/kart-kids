import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TrackDatabase } from '../../server/tracks/TrackDatabase.js';
import { ManageTokenService } from '../../server/tracks/ManageTokenService.js';
import { PublishedTrackRepository } from '../../server/tracks/PublishedTrackRepository.js';
import { SpotlightRepository } from '../../server/tracks/SpotlightRepository.js';

function makeTrack( name = 'Track One' ) {

	return {
		v: 4,
		meta: { name },
		trackTiles: [
			{ gx: 0, gz: 0, t: 3, o: 2 },
			{ gx: 1, gz: 0, t: 0, o: 2 },
			{ gx: 2, gz: 0, t: 0, o: 2 },
			{ gx: 3, gz: 0, t: 0, o: 2 },
		],
		props: [],
		markers: [],
	};

}

describe( 'PublishedTrackRepository', () => {

	let tempDir;
	let db;
	let repo;
	let spotlight;

	beforeEach( () => {

		tempDir = mkdtempSync( join( tmpdir(), 'kart-kids-publish-' ) );
		db = new TrackDatabase( join( tempDir, 'tracks.sqlite' ) );
		repo = new PublishedTrackRepository( db, new ManageTokenService() );
		spotlight = new SpotlightRepository( db, repo );

	} );

	afterEach( () => {

		db?.close();
		rmSync( tempDir, { recursive: true, force: true } );

	} );

	it( 'creates a stable public track plus manage token on first publish', () => {

		const created = repo.createPublishedTrack( {
			title: 'Neon Bend',
			creatorName: 'Caleb',
			trackData: makeTrack( 'Neon Bend' ),
		} );

		assert.ok( created.publicId );
		assert.ok( created.manageToken );
		assert.equal( created.title, 'Neon Bend' );
		assert.equal( created.status, 'live' );
		assert.equal( created.versionNumber, 1 );

		const fetched = repo.getTrackByPublicId( created.publicId );
		assert.equal( fetched.publicId, created.publicId );
		assert.equal( fetched.title, 'Neon Bend' );
		assert.deepEqual( fetched.trackData.trackTiles, makeTrack( 'Neon Bend' ).trackTiles );

	} );

	it( 'updates the live version in place while keeping the same public id', () => {

		const created = repo.createPublishedTrack( {
			title: 'Sunset Sprint',
			creatorName: 'Caleb',
			trackData: makeTrack( 'Sunset Sprint' ),
		} );

		const updatedTrackData = makeTrack( 'Sunset Sprint DX' );
		updatedTrackData.trackTiles.push( { gx: 4, gz: 0, t: 0, o: 2 } );

		const updated = repo.updatePublishedTrackByToken( created.manageToken, {
			title: 'Sunset Sprint DX',
			trackData: updatedTrackData,
		} );

		assert.equal( updated.publicId, created.publicId );
		assert.equal( updated.title, 'Sunset Sprint DX' );
		assert.equal( updated.versionNumber, 2 );
		assert.equal( updated.trackData.trackTiles.length, 5 );

	} );

	it( 'pins spotlight to a frozen version even after the live track changes', () => {

		const created = repo.createPublishedTrack( {
			title: 'Moon Loop',
			creatorName: 'Caleb',
			trackData: makeTrack( 'Moon Loop' ),
		} );

		const pinned = spotlight.pinTrack( created.publicId );
		repo.updatePublishedTrackByToken( created.manageToken, {
			title: 'Moon Loop 2',
			trackData: makeTrack( 'Moon Loop 2' ),
		} );

		const active = spotlight.listActiveSpotlight();
		assert.equal( active.length, 1 );
		assert.equal( active[ 0 ].versionId, pinned.versionId );
		assert.equal( active[ 0 ].title, 'Moon Loop' );

	} );

	it( 'marks a track unavailable without deleting manage access', () => {

		const created = repo.createPublishedTrack( {
			title: 'Harbor Heat',
			creatorName: 'Caleb',
			trackData: makeTrack( 'Harbor Heat' ),
		} );

		repo.unpublishTrackByToken( created.manageToken );

		const publicTrack = repo.getTrackByPublicId( created.publicId );
		const managedTrack = repo.getTrackByManageToken( created.manageToken );

		assert.equal( publicTrack.status, 'unpublished' );
		assert.equal( managedTrack.status, 'unpublished' );

	} );

} );
