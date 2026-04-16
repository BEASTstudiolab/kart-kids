import { CHARACTER_MODEL_PATH } from './CharacterCustomization.js';
import { BOOST_MARKER_MODEL_ID, TERRAIN_TILE_ID } from './track-editor/constants/EditorAssetIds.js';

export function getTrackTileSet( search = '' ) {

	const params = new URLSearchParams( search.startsWith( '?' ) ? search.slice( 1 ) : search );
	return params.get( 'tileset' ) === 'legacy' ? 'legacy' : 'standard';

}

export function getTrackModelConfig( name, tileSet = 'standard' ) {

	if ( tileSet === 'standard' ) {

		// ─── 1x1 base tiles ─────────────────────────────────────
		// Runtime/editor semantics treat orient 0 as north/south.
		// Standard 1x1 models use that convention directly, so no extra correction
		// rotation is applied here.

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
		if ( name === 'trk-curve-3x3-l' ) return { path: 'standard-map/kartkids_base_trk_520_trn_90_l_3x3.gltf', rotationY: Math.PI };
		if ( name === 'trk-curve-3x3-wide-l' ) return { path: 'standard-map/kartkids_base_trk_100_trn_widest_l_3x3.gltf', rotationY: Math.PI };

		// ─── Junctions (3x3) ───────────────────────────────────
		if ( name === 'trk-junction-y' ) return { path: 'standard-map/kartkids_base_trk_140_jct_ysplit_3x3.gltf', rotationY: Math.PI };
		if ( name === 'trk-junction-t' ) return { path: 'standard-map/kartkids_base_trk_150_jct_tjunction_3x3.gltf', rotationY: Math.PI };
		if ( name === 'trk-junction-4way' ) return { path: 'standard-map/kartkids_base_trk_160_jct_4way_3x3.gltf', rotationY: Math.PI };

		// ─── Bridges (1x1) ─────────────────────────────────────
		if ( name === 'trk-bridge-entry' ) return { path: 'standard-map/kartkids_base_trk_390_brg_entry_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-bridge-mid' ) return { path: 'standard-map/kartkids_base_trk_400_brg_mid_1x1.gltf', rotationY: 0 };

		// ─── Tunnels (1x1) ─────────────────────────────────────
		if ( name === 'trk-tunnel-entry' ) return { path: 'standard-map/kartkids_base_trk_420_tun_closed_entry_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-tunnel-mid' ) return { path: 'standard-map/kartkids_base_trk_430_tun_closed_mid_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-tunnel-exit' ) return { path: 'standard-map/kartkids_base_trk_440_tun_closed_exit_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-tunnel-open' ) return { path: 'standard-map/kartkids_base_trk_460_tun_openframe_mid_1x1.gltf', rotationY: 0 };

		// ─── Jumps (1x1) ───────────────────────────────────────
		if ( name === 'trk-jump-short' ) return { path: 'standard-map/kartkids_base_trk_480_jmp_01_short_25pct_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-jump-medium' ) return { path: 'standard-map/kartkids_base_trk_490_jmp_02_mid_50pct_railed_1x1.gltf', rotationY: 0 };
		if ( name === 'trk-jump-long' ) return { path: 'standard-map/kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1.gltf', rotationY: 0 };

		// ─── Chicane (3x3) ─────────────────────────────────────
		if ( name === 'trk-chicane-3x3-l' ) return { path: 'standard-map/kartkids_base_trk_550_chicane_90_l_3x3.gltf', rotationY: Math.PI };

		// ─── Shared editor/runtime utility assets ──────────────
		if ( name === TERRAIN_TILE_ID ) return { path: 'standard-map/kartkids_base_trk_700_terrain_blank.gltf', rotationY: 0 };
		if ( name === BOOST_MARKER_MODEL_ID ) return { path: 'standard-map/kartkids_base_trk_600__Turbo_2x2.gltf', rotationY: 0 };

	}

	// ─── Kart + Character ──────────────────────────────────
	if ( name === 'kart-1' ) return { path: 'vehicles/BaseRaceKart1.gltf', rotationY: 0 };
	if ( name === 'kart-2' ) return { path: 'vehicles/BaseRaceKart2.gltf', rotationY: 0 };
	if ( name === 'kart-3' ) return { path: 'vehicles/BaseRaceKart3.gltf', rotationY: 0 };
	if ( name === 'kart-4' ) return { path: 'vehicles/BaseRaceKart4.gltf', rotationY: 0 };
	if ( name === 'kart-5' ) return { path: 'vehicles/BaseRaceKart5.gltf', rotationY: 0 };
	if ( name === 'kart-6' ) return { path: 'vehicles/BaseRaceKart6.gltf', rotationY: 0 };
	if ( name === 'kart-7' ) return { path: 'vehicles/BaseRaceKart7.gltf', rotationY: 0 };
	if ( name === 'kart-8' ) return { path: 'vehicles/BaseRaceKart8.gltf', rotationY: 0 };
	if ( name === 'kart-beast' ) return { path: CHARACTER_MODEL_PATH, rotationY: 0 };

	// ─── Decoration / Props (moved to props/ folder) ────────
	if ( name === 'decoration-buildings-1' ) return { path: 'props/decoration-buildings-1.glb', rotationY: 0 };
	if ( name === 'decoration-buildings-2' ) return { path: 'props/decoration-buildings-2.glb', rotationY: 0 };
	if ( name === 'decoration-empty-night' ) return { path: 'props/decoration-empty-night.glb', rotationY: 0 };

	return { path: name + '.glb', rotationY: 0 };

}
