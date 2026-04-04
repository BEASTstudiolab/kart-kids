export function getTrackTileSet( search = '' ) {

	const params = new URLSearchParams( search.startsWith( '?' ) ? search.slice( 1 ) : search );
	return params.get( 'tileset' ) === 'standard' ? 'standard' : 'legacy';

}

export function getTrackModelConfig( name, tileSet = 'legacy' ) {

	if ( tileSet === 'standard' ) {

		if ( name === 'track-straight-night' ) {

			return {
				path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1',
				rotationY: Math.PI / 2,
			};

		}

		if ( name === 'track-corner-night' ) {

			return {
				path: 'standard-map/kartkids_base_trk_020_trn_90_l_1x1',
				rotationY: Math.PI,
			};

		}

	}

	return {
		path: name,
		rotationY: 0,
	};

}
