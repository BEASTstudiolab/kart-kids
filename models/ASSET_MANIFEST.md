# KART KIDS — Asset Manifest

All models are GLB/GLTF format, placed in `models/`. This document tracks what
exists, what's needed, and where each asset type should go.

---

## Current Folder Structure

```
models/
  standard-map/          Track tiles (22 GLTF + textures)
  Textures/              Shared textures (colormap)
  backup/                Archived/unused models
  *.glb                  Vehicles + decorations (root level)
```

## Recommended Folder Structure (future)

When creating new assets, place them in these subdirectories:

```
models/
  standard-map/          Track tiles (KEEP — referenced by TrackModelConfig.js)
  vehicles/              Kart/vehicle models
  characters/            Driver character models
  decor/                 Decorative world tiles (buildings, ground, nature)
  props/                 Free-placed props (barriers, signs, trees, lights)
  gameplay/              Marker visuals (checkpoint flag, boost pad, powerup box)
```

**DO NOT move existing files** — `standard-map/`, root-level vehicles, and
decorations are referenced by path in `js/TrackModelConfig.js` and `js/TrackData.js`.
New assets go in the new folders; old ones stay put.

---

## Track Tiles (COMPLETE — 22 models)

All in `models/standard-map/`. These are done.

| ID | File | Type |
|----|------|------|
| trk-010 | `kartkids_base_trk_010_rd_straight_1x1.gltf` | Straight 1x1 |
| trk-020 | `kartkids_base_trk_020_trn_90_l_1x1.gltf` | Corner 90deg 1x1 |
| trk-080 | `kartkids_base_trk_080_trn_wide_l_2x2.gltf` | Wide turn 2x2 |
| trk-100 | `kartkids_base_trk_100_trn_widest_l_3x3.gltf` | Widest turn 3x3 |
| trk-140 | `kartkids_base_trk_140_jct_ysplit_3x3.gltf` | Y-split junction 3x3 |
| trk-150 | `kartkids_base_trk_150_jct_tjunction_3x3.gltf` | T-junction 3x3 |
| trk-160 | `kartkids_base_trk_160_jct_4way_3x3.gltf` | 4-way intersection 3x3 |
| trk-190 | `kartkids_base_trk_190_rmp_up_1x1_z0_to_z2p5.gltf` | Ramp up 2.5m |
| trk-200 | `kartkids_base_trk_200_rmp_up_1x1_z0_to_z5.gltf` | Ramp up 5m |
| trk-230 | `kartkids_base_trk_230_rmp_transition_flat_to_up_1x1_z2p5.gltf` | Smooth ramp 2.5m |
| trk-270 | `kartkids_base_trk_270_rmp_transition_flat_to_up_1x1_z5.gltf` | Smooth ramp 5m |
| trk-390 | `kartkids_base_trk_390_brg_entry_1x1.gltf` | Bridge entry |
| trk-400 | `kartkids_base_trk_400_brg_mid_1x1.gltf` | Bridge middle |
| trk-420 | `kartkids_base_trk_420_tun_closed_entry_1x1.gltf` | Tunnel closed entry |
| trk-430 | `kartkids_base_trk_430_tun_closed_mid_1x1.gltf` | Tunnel closed mid |
| trk-440 | `kartkids_base_trk_440_tun_closed_exit_1x1.gltf` | Tunnel closed exit |
| trk-460 | `kartkids_base_trk_460_tun_openframe_mid_1x1.gltf` | Tunnel open frame |
| trk-480 | `kartkids_base_trk_480_jmp_01_short_25pct_1x1.gltf` | Jump short |
| trk-500 | `kartkids_base_trk_500_jmp_03_long_midstart_to_edge_1x1.gltf` | Jump long |
| trk-510 | `kartkids_base_trk_510_srt_startfinish_arch_3x1.gltf` | Start/finish arch |
| trk-520 | `kartkids_base_trk_520_trn_90_l_3x3.gltf` | Turn 90deg 3x3 |
| trk-550 | `kartkids_base_trk_550_chicane_90_l_3x3.gltf` | Chicane 3x3 |

---

## Vehicles (4 color variants — needs more)

| File | Status |
|------|--------|
| `vehicle-truck-red.glb` | EXISTS |
| `vehicle-truck-green.glb` | EXISTS |
| `vehicle-truck-yellow.glb` | EXISTS |
| `vehicle-truck-purple.glb` | EXISTS |

### Needed vehicle models (place in `models/vehicles/`)

- [ ] `kart-standard-red.glb` — Standard kart body
- [ ] `kart-standard-blue.glb`
- [ ] `kart-standard-green.glb`
- [ ] `kart-standard-yellow.glb`
- [ ] `kart-sport-*.glb` — Sporty kart variant
- [ ] `kart-offroad-*.glb` — Off-road kart variant

**Specs**: Scale 0.5 (root_scale), origin at center-bottom, facing +Z.

---

## Characters (NONE — all needed)

Place in `models/characters/`.

- [ ] `driver-default.glb` — Default driver (seated pose)
- [ ] `driver-alt-1.glb` — Alternate character 1
- [ ] `driver-alt-2.glb` — Alternate character 2

**Specs**: Seated pose, attach point at kart seat position, ~0.6m tall seated.

---

## Decorations (3 exist — many needed)

| File | Status |
|------|--------|
| `decoration-buildings-1.glb` | EXISTS |
| `decoration-buildings-2.glb` | EXISTS |
| `decoration-empty-night.glb` | EXISTS |

### Needed decor tiles (place in `models/decor/`)

Grid-snapped decorative floor tiles (1x1 = 10m x 10m):

- [ ] `decor-grass-1x1.glb` — Grass ground tile
- [ ] `decor-dirt-1x1.glb` — Dirt ground tile
- [ ] `decor-water-1x1.glb` — Water/pond tile
- [ ] `decor-sand-1x1.glb` — Sand tile
- [ ] `decor-concrete-1x1.glb` — Concrete pad
- [ ] `decor-buildings-day-1.glb` — City buildings (day variant)
- [ ] `decor-buildings-day-2.glb` — City buildings (day variant 2)
- [ ] `decor-park-1x1.glb` — Park with trees
- [ ] `decor-parking-1x1.glb` — Parking lot

**Specs**: 10m x 10m footprint, flat, origin at center-bottom.

---

## Props (NONE — all needed)

Free-placed decorative objects. Place in `models/props/`.

### Barriers / Safety
- [ ] `prop-barrier-concrete.glb` — Concrete barrier
- [ ] `prop-barrier-tire.glb` — Tire wall barrier
- [ ] `prop-fence-metal.glb` — Metal fence segment
- [ ] `prop-cone-traffic.glb` — Traffic cone

### Vegetation
- [ ] `prop-tree-pine.glb` — Pine tree
- [ ] `prop-tree-palm.glb` — Palm tree
- [ ] `prop-bush-round.glb` — Round bush
- [ ] `prop-flower-bed.glb` — Flower planter

### Street Furniture
- [ ] `prop-light-street.glb` — Street lamp
- [ ] `prop-light-flood.glb` — Floodlight tower
- [ ] `prop-sign-speed.glb` — Speed limit sign
- [ ] `prop-sign-direction.glb` — Direction arrow sign
- [ ] `prop-bench.glb` — Park bench
- [ ] `prop-bin-trash.glb` — Trash bin

### Crowd / Atmosphere
- [ ] `prop-crowd-stand.glb` — Spectator grandstand
- [ ] `prop-banner-arch.glb` — Banner archway
- [ ] `prop-flag-checkered.glb` — Checkered flag
- [ ] `prop-camera-tower.glb` — Camera tower

**Specs**: Various sizes, origin at center-bottom, no fixed grid snap.

---

## Gameplay Markers (NONE — all needed)

Visual models for race logic markers. Place in `models/gameplay/`.

- [ ] `marker-checkpoint.glb` — Checkpoint gate/post
- [ ] `marker-spawn-point.glb` — Racer spawn position indicator
- [ ] `marker-boost-pad.glb` — Boost pad surface tile
- [ ] `marker-powerup-box.glb` — Powerup item box (floating)
- [ ] `marker-respawn.glb` — Respawn point indicator

**Specs**: Visually distinct, recognizable at distance. Powerup box should
hover/rotate. Checkpoint should be arch or post pair.

Currently the editor uses procedural gizmos (colored shapes) for these.
When GLB models are available, replace the gizmos with the real models.

---

## Theme Variants (NONE — future)

Additional texture/material sets for track tiles. Same geometry, different look.

Themes planned:
- City Night (CURRENT — standard-map textures)
- City Day
- Beach
- Jungle
- Space
- Volcano
- Frozen
- Retro/Neon

Each theme needs a texture atlas set matching the standard-map format:
- `AsphaltAtlas1` (BaseColor, Normal, ORM)
- `AsphaltAtlas2` (BaseColor, Normal, ORM)
- `Rubber` (BaseColor, Emissive, Normal, ORM)

---

## Blender Source Files

Blender project files go in `Blender/` at the project root.
Export to GLB/GLTF into the appropriate `models/` subfolder.

Pipeline: Blender -> Export GLTF 2.0 (.glb) -> place in models/ subfolder
