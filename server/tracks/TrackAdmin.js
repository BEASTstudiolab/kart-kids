import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TrackDatabase } from './TrackDatabase.js';
import { ManageTokenService } from './ManageTokenService.js';
import { PublishedTrackRepository } from './PublishedTrackRepository.js';
import { SpotlightRepository } from './SpotlightRepository.js';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const DB_PATH = process.env.TRACKS_DB_PATH || join( __dirname, '..', '..', 'data', 'tracks.sqlite' );

const db = new TrackDatabase( DB_PATH );
const tracks = new PublishedTrackRepository( db, new ManageTokenService() );
const spotlight = new SpotlightRepository( db, tracks );

function printUsage() {

	console.log( `Track admin usage:
  node server/tracks/TrackAdmin.js list
  node server/tracks/TrackAdmin.js spotlight <publicId> [versionId]
  node server/tracks/TrackAdmin.js spotlight-remove <entryId>
  node server/tracks/TrackAdmin.js takedown <publicId>
  node server/tracks/TrackAdmin.js restore <publicId>
  node server/tracks/TrackAdmin.js spotlight-list` );

}

const [ command, arg1, arg2 ] = process.argv.slice( 2 );

try {

	switch ( command ) {

		case 'list':
			console.table( tracks.listTracks() );
			break;

		case 'spotlight':
			if ( ! arg1 ) throw new Error( 'Missing publicId for spotlight command.' );
			console.log( spotlight.pinTrack( arg1, arg2 ) );
			break;

		case 'spotlight-remove':
			if ( ! arg1 ) throw new Error( 'Missing entryId for spotlight-remove command.' );
			spotlight.removeSpotlight( arg1 );
			console.log( `Removed spotlight entry ${ arg1 }` );
			break;

		case 'spotlight-list':
			console.table( spotlight.listActiveSpotlight().map( ( entry ) => ( {
				entryId: entry.entryId,
				publicId: entry.publicId,
				versionId: entry.versionId,
				title: entry.title,
				creatorName: entry.creatorName,
			} ) ) );
			break;

		case 'takedown':
			if ( ! arg1 ) throw new Error( 'Missing publicId for takedown command.' );
			console.log( tracks.setTrackStatus( arg1, 'taken_down' ) );
			break;

		case 'restore':
			if ( ! arg1 ) throw new Error( 'Missing publicId for restore command.' );
			console.log( tracks.setTrackStatus( arg1, 'live' ) );
			break;

		default:
			printUsage();
			process.exitCode = command ? 1 : 0;
			break;

	}

} catch ( err ) {

	console.error( err.message || err );
	process.exitCode = 1;

} finally {

	db.close();

}
