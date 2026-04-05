# Tile Catalog — Kart Kids (Current)

Active tiles loaded by the game after the reduction pass. All track tiles use the `standard-map/` tileset by default.

## Track Tiles (11 logical tiles, 8 unique models)

### 1x1 Base Tiles

| Tile Key | Model File | Notes |
|---|---|---|
| `trk-straight` | `kartkids_base_trk_010_rd_straight_1x1.gltf` | Basic straight road segment |
| `trk-corner-1x1` | `kartkids_base_trk_020_trn_90_l_1x1.gltf` | 90-degree corner (1x1) |
| `trk-finish` | `track-finish.glb` | Start/finish line (legacy model, not in standard-map) |

### Elevated Flats

| Tile Key | Model File | Notes |
|---|---|---|
| `trk-elev-2p5` | `kartkids_base_trk_010_rd_straight_1x1.gltf` | Reuses straight model, placed at Y=2.416 |
| `trk-elev-5` | `kartkids_base_trk_010_rd_straight_1x1.gltf` | Reuses straight model, placed at Y=4.832 |

### Ramps

| Tile Key | Model File | Notes |
|---|---|---|
| `trk-ramp-up-2p5` | `kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf` | Ramp from ground to elevation 2.5 |
| `trk-ramp-up-5` | `kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf` | Ramp from ground to elevation 5 |
| `trk-ramp-down-2p5` | `kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf` | Reuses ramp-up model, orient flip in `transformCells` |
| `trk-ramp-down-5` | `kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf` | Reuses ramp-up model, orient flip in `transformCells` |

### Multi-Tile Curves

| Tile Key | Model File | Notes |
|---|---|---|
| `trk-curve-2x2-l` | `kartkids_base_trk_080_trn_wide_l_2x2.gltf` | Wide curve spanning 2x2 cells |
| `trk-curve-3x3-l` | `kartkids_base_trk_520_trn_90_l_3x3.gltf` | Wide curve spanning 3x3 cells |
| `trk-curve-4x4-l` | `kartkids_base_trk_530_trn_90_l_4x4.glb` | Widest curve spanning 4x4 cells |

## Decoration Tiles (3)

| Tile Key | Model File | Notes |
|---|---|---|
| `decoration-empty-night` | `decoration-empty-night.glb` | Empty tile (night variant) |
| `decoration-buildings-1` | `decoration-buildings-1.glb` | Building cluster variant 1 |
| `decoration-buildings-2` | `decoration-buildings-2.glb` | Building cluster variant 2 |

## Vehicle Models (4)

| Model Key | Model File |
|---|---|
| `vehicle-truck-yellow` | `vehicle-truck-yellow.glb` |
| `vehicle-truck-green` | `vehicle-truck-green.glb` |
| `vehicle-truck-purple` | `vehicle-truck-purple.glb` |
| `vehicle-truck-red` | `vehicle-truck-red.glb` |

## Summary

- **11 logical track tiles** (8 unique model files — elevated flats reuse straight, ramp-down reuses ramp-up)
- **3 decoration tiles**
- **4 vehicle models**
- **18 total entries** loaded in `modelNames` array (`js/main.js:160`)
- All curves use the **L variant only** — rotation handles all 4 directions

## Unused Standard-Map Models (Present on Disk, Not Loaded)

These models exist in `models/standard-map/` but are not in the active `modelNames` list:

- `kartkids_base_trk_100_trn_widest_l_3x3` — Original 3x3 curve (replaced by 520)
- `kartkids_base_trk_140_jct_ysplit_3x3` — Y-split junction
- `kartkids_base_trk_150_jct_tjunction_3x3` — T-junction
- `kartkids_base_trk_160_jct_4way_3x3` — 4-way intersection
- `kartkids_base_trk_230_rmp_transition_flat_to_up_1x1_z2p5` — Transition piece
- `kartkids_base_trk_250_rmp_transition_flat_to_down_1x1_z2p5` — Transition piece
- `kartkids_base_trk_260_rmp_transition_down_to_flat_1x1_z2p5` — Transition piece
- `kartkids_base_trk_270_rmp_transition_flat_to_up_1x1_z5` — Transition piece
- `kartkids_base_trk_290_rmp_transition_flat_to_down_1x1_z5` — Transition piece
- `kartkids_base_trk_300_rmp_transition_down_to_flat_1x1_z5` — Transition piece
- `kartkids_base_trk_390_brg_entry_1x1` — Bridge entry
- `kartkids_base_trk_400_brg_mid_1x1` — Bridge middle
- `kartkids_base_trk_420_tun_closed_entry_1x1` — Tunnel closed entry
- `kartkids_base_trk_430_tun_closed_mid_1x1` — Tunnel closed middle
- `kartkids_base_trk_440_tun_closed_exit_1x1` — Tunnel closed exit
- `kartkids_base_trk_460_tun_openframe_mid_1x1` — Tunnel open-frame middle
- `kartkids_base_trk_480_jmp_01_short_25pct_1x1` — Short jump
- `kartkids_base_trk_490_jmp_02_mid_50pct_railed_1x1` — Medium jump (railed)
- `kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1` — Long jump
- `kartkids_base_trk_510_srt_startfinish_arch_3x1` — Start/finish arch
- `3x3_s_turn_chicane` — S-turn chicane
