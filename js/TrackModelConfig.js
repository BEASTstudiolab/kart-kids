export function getTrackTileSet( search = '' ) {

	const params = new URLSearchParams( search.startsWith( '?' ) ? search.slice( 1 ) : search );
	return params.get( 'tileset' ) === 'legacy' ? 'legacy' : 'standard';

}

export function getTrackModelConfig( name, tileSet = 'standard' ) {

	if ( tileSet === 'standard' ) {

		// ─── 1x1 base tiles ─────────────────────────────────────
		// All 1x1 tiles share the same axis convention: road geometry runs along X,
		// rotationY: PI/2 rotates it to align with orient 0 (N/S).

		if ( name === 'track-straight-night' ) return { path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1', rotationY: Math.PI / 2 };
		if ( name === 'track-corner-night' ) return { path: 'standard-map/kartkids_base_trk_020_trn_90_l_1x1', rotationY: Math.PI };

		if ( name === 'track-elev-2p5' ) return { path: 'standard-map/kartkids_base_trk_170_elv_flat_1x1_z2p5', rotationY: Math.PI / 2 };
		if ( name === 'track-elev-5' ) return { path: 'standard-map/kartkids_base_trk_180_elv_flat_1x1_z5', rotationY: Math.PI / 2 };
		if ( name === 'track-ramp-up-2p5' ) return { path: 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5', rotationY: Math.PI / 2 };
		if ( name === 'track-ramp-up-5' ) return { path: 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5', rotationY: Math.PI / 2 };
		if ( name === 'track-ramp-down-2p5' ) return { path: 'standard-map/kartkids_base_trk_210_rmp_down_1x1_z2p5_to_z0', rotationY: Math.PI / 2 };
		if ( name === 'track-ramp-down-5' ) return { path: 'standard-map/kartkids_base_trk_220_rmp_down_1x1_z5_to_z0', rotationY: Math.PI / 2 };

		// ─── Multi-tile curves ──────────────────────────────────
		// Curve models are pre-aligned — no base rotation needed

		if ( name === 'track-curve-2x2-l' ) return { path: 'standard-map/kartkids_base_trk_080_trn_wide_l_2x2', rotationY: 0 };
		if ( name === 'track-curve-2x2-r' ) return { path: 'standard-map/kartkids_base_trk_090_trn_wide_r_2x2', rotationY: 0 };
		if ( name === 'track-curve-3x3-l' ) return { path: 'standard-map/kartkids_base_trk_520_trn_90_l_3x3', rotationY: 0 };
		if ( name === 'track-curve-3x3-r' ) return { path: 'standard-map/kartkids_base_trk_510_trn_90_r_3x3', rotationY: 0 };
		if ( name === 'track-curve-4x4-l' ) return { path: 'standard-map/kartkids_base_trk_530_trn_90_l_4x4', rotationY: 0 };
		if ( name === 'track-curve-4x4-r' ) return { path: 'standard-map/kartkids_base_trk_530_trn_90_r_4x4', rotationY: 0 };

	}

	return { path: name, rotationY: 0 };

}
