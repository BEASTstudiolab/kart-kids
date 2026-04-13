import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_PORT = 9877;
const BASE_URL = `http://localhost:${ TEST_PORT }`;

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

describe( 'TrackRoutes', () => {

	let serverProcess;
	let tempDir;

	before( async () => {

		tempDir = mkdtempSync( join( tmpdir(), 'kart-kids-track-routes-' ) );

		await new Promise( ( resolve, reject ) => {

			serverProcess = spawn( 'node', [ 'server.js' ], {
				cwd: '/Users/calebsmiler/Desktop/OS/kart-kids',
				env: {
					...process.env,
					PORT: String( TEST_PORT ),
					TRACKS_DB_PATH: join( tempDir, 'tracks.sqlite' ),
				},
				stdio: [ 'ignore', 'pipe', 'pipe' ],
			} );

			const timer = setTimeout( () => reject( new Error( 'Server failed to start' ) ), 10000 );

			serverProcess.stdout.on( 'data', ( chunk ) => {

				if ( chunk.toString().includes( 'running at' ) ) {

					clearTimeout( timer );
					resolve();

				}

			} );

			serverProcess.stderr.on( 'data', ( chunk ) => {

				const text = chunk.toString();
				if ( text.includes( 'Error' ) || text.includes( 'EADDRINUSE' ) ) {

					clearTimeout( timer );
					reject( new Error( text ) );

				}

			} );

		} );

	} );

	after( () => {

		serverProcess?.kill( 'SIGTERM' );
		rmSync( tempDir, { recursive: true, force: true } );

	} );

	it( 'publishes a track and resolves both public and manage routes', async () => {

		const publishRes = await fetch( `${ BASE_URL }/api/published-tracks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( {
				title: 'City Dash',
				creatorName: 'Caleb',
				trackData: makeTrack( 'City Dash' ),
			} ),
		} );

		assert.equal( publishRes.status, 201 );
		const created = await publishRes.json();

		const publicRes = await fetch( `${ BASE_URL }/api/published-tracks/${ created.publicId }` );
		assert.equal( publicRes.status, 200 );
		const publicTrack = await publicRes.json();
		assert.equal( publicTrack.title, 'City Dash' );

		const manageRes = await fetch( `${ BASE_URL }/api/manage-tracks/${ created.manageToken }` );
		assert.equal( manageRes.status, 200 );
		const managedTrack = await manageRes.json();
		assert.equal( managedTrack.publicId, created.publicId );

		const publicPageRes = await fetch( `${ BASE_URL }${ created.publicUrl }` );
		assert.equal( publicPageRes.status, 200 );

		const managePageRes = await fetch( `${ BASE_URL }${ created.manageUrl }` );
		assert.equal( managePageRes.status, 200 );

	} );

	it( 'updates and unpublishes a track through the manage route', async () => {

		const publishRes = await fetch( `${ BASE_URL }/api/published-tracks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( {
				title: 'Cloud Nine',
				creatorName: 'Caleb',
				trackData: makeTrack( 'Cloud Nine' ),
			} ),
		} );
		const created = await publishRes.json();

		const updatedTrack = makeTrack( 'Cloud Nine DX' );
		updatedTrack.trackTiles.push( { gx: 4, gz: 0, t: 0, o: 2 } );

		const updateRes = await fetch( `${ BASE_URL }/api/manage-tracks/${ created.manageToken }`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( {
				title: 'Cloud Nine DX',
				trackData: updatedTrack,
			} ),
		} );

		assert.equal( updateRes.status, 200 );
		const updated = await updateRes.json();
		assert.equal( updated.title, 'Cloud Nine DX' );
		assert.equal( updated.versionNumber, 2 );

		const unpublishRes = await fetch( `${ BASE_URL }/api/manage-tracks/${ created.manageToken }/unpublish`, {
			method: 'POST',
		} );
		assert.equal( unpublishRes.status, 200 );

		const publicRes = await fetch( `${ BASE_URL }/api/published-tracks/${ created.publicId }` );
		assert.equal( publicRes.status, 410 );

		const manageRes = await fetch( `${ BASE_URL }/api/manage-tracks/${ created.manageToken }` );
		assert.equal( manageRes.status, 200 );

	} );

} );
