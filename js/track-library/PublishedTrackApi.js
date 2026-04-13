function _headers() {

	return {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
	};

}

async function _readJson( response ) {

	const payload = await response.json().catch( () => ( {} ) );
	if ( ! response.ok ) {

		throw new Error( payload.error || `Request failed (${ response.status })` );

	}

	return payload;

}

export class PublishedTrackApi {

	async publishTrack( { title, creatorName, trackData } ) {

		const response = await fetch( '/api/published-tracks', {
			method: 'POST',
			headers: _headers(),
			body: JSON.stringify( { title, creatorName, trackData } ),
		} );

		return _readJson( response );

	}

	async getPublicTrack( publicId ) {

		const response = await fetch( `/api/published-tracks/${ encodeURIComponent( publicId ) }`, {
			headers: _headers(),
		} );

		return _readJson( response );

	}

	async getManagedTrack( manageToken ) {

		const response = await fetch( `/api/manage-tracks/${ encodeURIComponent( manageToken ) }`, {
			headers: _headers(),
		} );

		return _readJson( response );

	}

	async updateManagedTrack( manageToken, { title, trackData } ) {

		const response = await fetch( `/api/manage-tracks/${ encodeURIComponent( manageToken ) }`, {
			method: 'PUT',
			headers: _headers(),
			body: JSON.stringify( { title, trackData } ),
		} );

		return _readJson( response );

	}

	async unpublishManagedTrack( manageToken ) {

		const response = await fetch( `/api/manage-tracks/${ encodeURIComponent( manageToken ) }/unpublish`, {
			method: 'POST',
			headers: _headers(),
		} );

		return _readJson( response );

	}

	async getSpotlightTracks() {

		const response = await fetch( '/api/spotlight', {
			headers: _headers(),
		} );

		return _readJson( response );

	}

}
