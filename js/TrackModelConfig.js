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
		if ( name === 'trk-finish' ) return { path: 'standard-map/kartkids_base_trk_510_srt_startfinish_arch_3x1.gltf', rotationY: 0 };

		// Elevated flats → reuse straight tile (Y offset applied at placement time)
		if ( name === 'trk-elev-2p5' ) return { path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-elev-5' ) return { path: 'standard-map/kartkids_base_trk_010_rd_straight_1x1.gltf', rotationY: 0 };

		// Ramp up
		if ( name === 'trk-ramp-up-2p5' ) return { path: 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf', rotationY: 0 };
		if ( name === 'trk-ramp-up-5' ) return { path: 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf', rotationY: 0 };

		// Ramp down → reuse ramp-up model (orient flip applied in transformCells)
		if ( name === 'trk-ramp-down-2p5' ) return { path: 'standard-map/kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf', rotationY: 0 };
		if ( name === 'trk-ramp-down-5' ) return { path: 'standard-map/kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf', rotationY: 0 };

		// Smooth transition ramps (flat-to-elevated)
		if ( name === 'trk-ramp-up-2p5-smooth' ) return { path: 'standard-map/kartkids_base_trk_230_rmp_transition_flat_to_up_1x1_z2p5.gltf', rotationY: 0 };
		if ( name === 'trk-ramp-up-5-smooth' ) return { path: 'standard-map/kartkids_base_trk_270_rmp_transition_flat_to_up_1x1_z5.gltf', rotationY: 0 };

		// Smooth transition ramp down → reuse smooth ramp-up model
		if ( name === 'trk-ramp-down-2p5-smooth' ) return { path: 'standard-map/kartkids_base_trk_230_rmp_transition_flat_to_up_1x1_z2p5.gltf', rotationY: 0 };
		if ( name === 'trk-ramp-down-5-smooth' ) return { path: 'standard-map/kartkids_base_trk_270_rmp_transition_flat_to_up_1x1_z5.gltf', rotationY: 0 };

		// ─── Multi-tile curves ──────────────────────────────────
		// All curves calibrated to 270deg (-PI/2)

		if ( name === 'trk-curve-2x2-l' ) return { path: 'standard-map/kartkids_base_trk_080_trn_wide_l_2x2.gltf', rotationY: Math.PI };
		if ( name === 'trk-curve-2x2-tight-l' ) return { path: 'standard-map/kartkids_base_trk_530_trn_90_l_2x2.gltf', rotationY: Math.PI };
		if ( name === 'trk-curve-3x3-l' ) return { path: 'standard-map/kartkids_base_trk_520_trn_90_l_3x3.gltf', rotationY: Math.PI };
		if ( name === 'trk-curve-3x3-wide-l' ) return { path: 'standard-map/kartkids_base_trk_100_trn_widest_l_3x3.gltf', rotationY: Math.PI };

	}

	return { path: name + '.glb', rotationY: 0 };

}
