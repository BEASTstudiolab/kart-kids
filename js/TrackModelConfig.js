export function getTrackTileSet( search = '' ) {

	const params = new URLSearchParams( search.startsWith( '?' ) ? search.slice( 1 ) : search );
	return params.get( 'tileset' ) === 'legacy' ? 'legacy' : 'standard';

}

export function getTrackModelConfig( name, tileSet = 'standard' ) {

	if ( tileSet === 'standard' ) {

		// ─── 1x1 base tiles ─────────────────────────────────────
		// All 1x1 tiles share the same axis convention: road geometry runs along X,
		// rotationY: PI/2 rotates it to align with orient 0 (N/S).

		if ( name === 'trk-straight' ) return { path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-corner-1x1' ) return { path: 'standard-map/kartkids_base_trk_020_trn_90_l_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-finish' ) return { path: 'track-finish.glb', rotationY: 0 };

		// Elevated flats → reuse straight tile (Y offset applied at placement time)
		if ( name === 'trk-elev-2p5' ) return { path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-elev-5' ) return { path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf', rotationY: 0 };

		// Ramp up
		if ( name === 'trk-ramp-up-2p5' ) return { path: 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf', rotationY: 0 };
		if ( name === 'trk-ramp-up-5' ) return { path: 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf', rotationY: 0 };

		// Ramp down → reuse ramp-up model (orient flip applied in transformCells)
		if ( name === 'trk-ramp-down-2p5' ) return { path: 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf', rotationY: 0 };
		if ( name === 'trk-ramp-down-5' ) return { path: 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf', rotationY: 0 };

		// ─── Multi-tile curves ──────────────────────────────────
		// Curve models are pre-aligned — no base rotation needed

		if ( name === 'trk-curve-2x2-l' ) return { path: 'standard-map/kartkids_base_trk_080_trn_wide_l_2x2.gltf', rotationY: 0 };
		if ( name === 'trk-curve-3x3-l' ) return { path: 'standard-map/kartkids_base_trk_520_trn_90_l_3x3.gltf', rotationY: 0 };
		if ( name === 'trk-curve-4x4-l' ) return { path: 'standard-map/kartkids_base_trk_530_trn_90_l_4x4.glb', rotationY: 0 };

	}

	return { path: name + '.glb', rotationY: 0 };

}
