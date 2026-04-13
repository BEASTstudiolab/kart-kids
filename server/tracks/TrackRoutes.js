import { readFile } from 'fs/promises';
import { join } from 'path';

function _json( res, status, payload ) {

	res.writeHead( status, {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-cache, must-revalidate',
	} );
	res.end( JSON.stringify( payload ) );

}

function _text( res, status, message ) {

	res.writeHead( status, {
		'Content-Type': 'text/plain; charset=utf-8',
		'Cache-Control': 'no-cache, must-revalidate',
	} );
	res.end( message );

}

async function _readJsonBody( req ) {

	const chunks = [];
	for await ( const chunk of req ) {

		chunks.push( chunk );

	}

	if ( chunks.length === 0 ) return {};
	return JSON.parse( Buffer.concat( chunks ).toString( 'utf8' ) );

}

function _normalizeTitle( title ) {

	return String( title || '' ).trim().slice( 0, 80 );

}

function _normalizeCreator( creatorName ) {

	return String( creatorName || '' ).trim().slice( 0, 40 );

}

function _sanitizeTrackPayload( track ) {

	if ( ! track || typeof track !== 'object' || ! Array.isArray( track.trackTiles ) ) return null;

	return track;

}

export class TrackRoutes {

	constructor( { root, publishedTracks, spotlight } ) {

		this._root = root;
		this._publishedTracks = publishedTracks;
		this._spotlight = spotlight;

	}

	async handle( req, res ) {

		const url = new URL( req.url, 'http://localhost' );
		const path = url.pathname;

		if ( req.method === 'POST' && path === '/api/published-tracks' ) {

			return this._handleCreatePublishedTrack( req, res );

		}

		if ( req.method === 'GET' && path === '/api/spotlight' ) {

			_json( res, 200, { tracks: this._spotlight.listActiveSpotlight() } );
			return true;

		}

		const publicMatch = path.match( /^\/api\/published-tracks\/([^/]+)$/ );
		if ( req.method === 'GET' && publicMatch ) {

			return this._handleGetPublishedTrack( res, publicMatch[ 1 ] );

		}

		const manageMatch = path.match( /^\/api\/manage-tracks\/([^/]+)$/ );
		if ( manageMatch ) {

			if ( req.method === 'GET' ) {

				return this._handleGetManagedTrack( res, manageMatch[ 1 ] );

			}

			if ( req.method === 'PUT' ) {

				return this._handleUpdateManagedTrack( req, res, manageMatch[ 1 ] );

			}

		}

		const unpublishMatch = path.match( /^\/api\/manage-tracks\/([^/]+)\/unpublish$/ );
		if ( req.method === 'POST' && unpublishMatch ) {

			return this._handleUnpublishTrack( res, unpublishMatch[ 1 ] );

		}

		const publicPageMatch = path.match( /^\/t\/([^/]+)$/ );
		if ( req.method === 'GET' && publicPageMatch ) {

			return this._serveHtml( res, 'published-track.html' );

		}

		const managePageMatch = path.match( /^\/m\/([^/]+)$/ );
		if ( req.method === 'GET' && managePageMatch ) {

			return this._serveHtml( res, 'manage-track.html' );

		}

		return false;

	}

	async _handleCreatePublishedTrack( req, res ) {

		try {

			const body = await _readJsonBody( req );
			const title = _normalizeTitle( body.title );
			const creatorName = _normalizeCreator( body.creatorName );
			const trackData = _sanitizeTrackPayload( body.trackData );

			if ( ! title ) {

				_json( res, 400, { error: 'Track title is required.' } );
				return true;

			}

			if ( ! creatorName ) {

				_json( res, 400, { error: 'Creator name is required.' } );
				return true;

			}

			if ( ! trackData ) {

				_json( res, 400, { error: 'Track payload is invalid.' } );
				return true;

			}

			const created = this._publishedTracks.createPublishedTrack( {
				title,
				creatorName,
				trackData,
			} );

			_json( res, 201, this._formatTrackResponse( created, {
				manageToken: created.manageToken,
			} ) );
			return true;

		} catch ( err ) {

			console.error( '[TrackRoutes] Create failed:', err );
			_json( res, 500, { error: 'Failed to publish track.' } );
			return true;

		}

	}

	_handleGetPublishedTrack( res, publicId ) {

		const track = this._publishedTracks.getTrackByPublicId( publicId );
		if ( ! track ) {

			_json( res, 404, { error: 'Track not found.' } );
			return true;

		}

		if ( track.status !== 'live' ) {

			_json( res, 410, {
				error: 'Track unavailable.',
				status: track.status,
				track: this._formatTrackResponse( track ),
			} );
			return true;

		}

		_json( res, 200, this._formatTrackResponse( track ) );
		return true;

	}

	_handleGetManagedTrack( res, token ) {

		const track = this._publishedTracks.getTrackByManageToken( token );
		if ( ! track ) {

			_json( res, 404, { error: 'Manage link not found.' } );
			return true;

		}

		_json( res, 200, this._formatTrackResponse( track ) );
		return true;

	}

	async _handleUpdateManagedTrack( req, res, token ) {

		try {

			const body = await _readJsonBody( req );
			const title = _normalizeTitle( body.title );
			const trackData = _sanitizeTrackPayload( body.trackData );

			if ( ! title ) {

				_json( res, 400, { error: 'Track title is required.' } );
				return true;

			}

			if ( ! trackData ) {

				_json( res, 400, { error: 'Track payload is invalid.' } );
				return true;

			}

			const updated = this._publishedTracks.updatePublishedTrackByToken( token, {
				title,
				trackData,
			} );

			if ( ! updated ) {

				_json( res, 404, { error: 'Manage link not found.' } );
				return true;

			}

			_json( res, 200, this._formatTrackResponse( updated ) );
			return true;

		} catch ( err ) {

			console.error( '[TrackRoutes] Update failed:', err );
			_json( res, 500, { error: 'Failed to update track.' } );
			return true;

		}

	}

	_handleUnpublishTrack( res, token ) {

		const updated = this._publishedTracks.unpublishTrackByToken( token );
		if ( ! updated ) {

			_json( res, 404, { error: 'Manage link not found.' } );
			return true;

		}

		_json( res, 200, this._formatTrackResponse( updated ) );
		return true;

	}

	async _serveHtml( res, filename ) {

		try {

			const html = await readFile( join( this._root, filename ) );
			res.writeHead( 200, {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-cache, must-revalidate',
			} );
			res.end( html );
			return true;

		} catch {

			_text( res, 404, 'Not found' );
			return true;

		}

	}

	_formatTrackResponse( track, extras = {} ) {

		return {
			publicId: track.publicId,
			title: track.title,
			creatorName: track.creatorName,
			status: track.status,
			currentVersionId: track.currentVersionId,
			versionNumber: track.versionNumber,
			createdAt: track.createdAt,
			updatedAt: track.updatedAt,
			unavailableAt: track.unavailableAt,
			trackData: track.trackData,
			publicUrl: `/t/${ track.publicId }`,
			manageUrl: extras.manageToken ? `/m/${ extras.manageToken }` : null,
			...extras,
		};

	}

}
