---
title: "refactor: Simplify tile system — one ramp, coded elevation"
type: refactor
status: completed
date: 2026-04-04
origin: docs/plans/2026-04-04-001-feat-track-editor-v2-plan.md
deepened: 2026-04-04
---

# Simplify Tile System — One Ramp, Coded Elevation

## Overview

Reduce the tile inventory by eliminating redundant models. Use a single ramp-up tile (flipped via orient index for down) and apply elevation via Y-position offset on the regular straight tile instead of separate elevated GLB models.

## Problem Frame

The current system has 6 dedicated elevation/ramp models (2 elevated flats + 2 ramp-ups + 2 ramp-downs) when only 2 are needed (1 ramp-up per height level). The ramp-down models are geometrically identical to ramp-up rotated 180°. The elevated flat models are geometrically identical to the straight tile placed higher. This complexity makes the tile pipeline harder to maintain and re-export from Blender.

**After refactor:** 2 ramp-up models remain (one per height level). Ramp-down and elevated flat models are deleted. Final model count reduced by 4.

## Requirements Trace

- R1. Remove ramp-down tile models — reuse ramp-up with flipped orient index
- R2. Remove elevated flat tile models — reuse straight tile with Y position offset (+2.5 or +5)
- R3. Editor elevation tool continues to work identically from the user's perspective
- R4. Game rendering and physics remain correct (both visual and collision)
- R5. Delete unused GLB/GLTF files from models/standard-map/

## Scope Boundaries

- No changes to the elevation cycling UX (still 0 → 2.5 → 5 → 0)
- No changes to auto-ramp neighbor detection logic
- No changes to save/load format
- No new flags or data structure changes on cell objects
- Ramp transition tiles (230-300 series) are out of scope — they're already deferred

## Prerequisites

- **Verify elevated flat GLB geometry:** Before implementation, compare the elevated flat GLB (170, 180) with the straight tile GLB (010) in the tile catalog. If the elevated flat has terrain fill, side walls, or support geometry underneath the road surface that the straight tile lacks, a simple Y offset will produce a floating road. This must be confirmed clean before proceeding.

## Key Technical Decisions

- **Ramp-down = ramp-up + orient flip**: Keep the logical type name `track-ramp-down-*` in cell data. In `TrackModelConfig`, map it to the same GLB path as `track-ramp-up-*`. In `transformCells`, flip the orient index using `{0:10, 10:0, 16:22, 22:16}` for ramp-down cells. This makes all downstream consumers (buildTrack, buildTrackColliders, buildWallColliders, editor placeMesh) automatically apply the correct 180° rotation without any flag checks or code changes.

- **Elevated flat = straight + Y offset**: Keep the logical type name `track-elev-*` in cell data. In `TrackModelConfig`, map it to the same path as `track-straight-night`. In `buildTrack` and `buildTrackColliders`, read the cell's elevation flag and add Y offset (2.5 or 5.0) to the tile position. Both rendering and physics must apply this offset.

- **Logical type names preserved**: `track-ramp-down-2p5` and `track-elev-2p5` continue to exist as type names in the editor's grid data and save format. The change is purely in model resolution (TrackModelConfig) and placement transforms (Y offset, orient flip). No new flags needed.

- **Existing save normalization acknowledged**: `editor.html` getCellsArray (line ~3480) already converts `track-elev-*` back to `track-straight-night` and skips `autoRamp` cells on save. This existing code ensures saved tracks never contain these logical names directly, so no save/load migration is needed.

## Resolved During Planning

- **Q: Does ramp-down geometry truly match ramp-up rotated 180°?** Yes — research confirms identical slope geometry, just facing opposite direction.

- **Q: Will physics work with Y-offset straights?** Yes, but `buildTrackColliders` must be updated — it currently hardcodes `Y=0.5`. The Y offset must be applied there too, not just in `buildTrack`.

- **Q: How is ramp-down state persisted?** The logical type name `track-ramp-down-*` stays in cell.type. No new flags needed. The orient flip is applied in `transformCells` before rendering/physics, and the save format already strips these names.

- **Q: How does the orient flip work?** The orient system uses discrete indices `{0, 10, 16, 22}` mapping to `{0°, 180°, 90°, 270°}`. A 180° flip is an index swap: `0↔10`, `16↔22`. This is applied in `transformCells` to ramp-down cells, so all consumers see the flipped orient automatically.

## Deferred to Implementation

- Exact Y offset values (2.5 and 5.0) should be validated against current elevated GLB vertex heights during integration testing

## Implementation Units

- [ ] **Unit 1: Model resolution + placement transforms (atomic change)**

  **Goal:** Make ramp-down resolve to ramp-up model, elevated flat resolve to straight model, and apply correct transforms (orient flip, Y offset) in all placement paths.

  **Requirements:** R1, R2, R3, R4

  **Files:**
  - Modify: `js/TrackModelConfig.js` — add ramp-down entries pointing to ramp-up GLB paths, add elev entries pointing to straight path
  - Modify: `js/Track.js` — `transformCells` (flip orient for ramp-down cells), `buildTrack` (add Y offset for elevated cells)
  - Modify: `js/Physics.js` — `buildTrackColliders` (add Y offset for elevated cells, read flags from cell array)
  - Modify: `editor.html` — `placeMesh` (add Y offset for elevated cells)

  **Approach:**

  *TrackModelConfig:*
  - Keep existing `track-ramp-up-2p5` and `track-ramp-up-5` entries
  - Add `track-ramp-down-2p5` → same path as `track-ramp-up-2p5`
  - Add `track-ramp-down-5` → same path as `track-ramp-up-5`
  - Add `track-elev-2p5` → same path as `track-straight-night`
  - Add `track-elev-5` → same path as `track-straight-night`

  *Track.js transformCells:*
  - After assigning `rCell.type = getElevationModelName(elev, rn.role)` for ramp-down cells, flip the orient index: `const ORIENT_FLIP = {0:10, 10:0, 16:22, 22:16}; rCell.orient = ORIENT_FLIP[cell.orient]`
  - `getElevationModelName` stays unchanged — it still returns `track-ramp-down-*` and `track-elev-*` names

  *Track.js buildTrack:*
  - In the per-instance placement loop, after setting `_dummy.position`, check if the cell type starts with `track-elev-`: if so, add `elevation === 1 ? 2.5 : 5.0` to Y position
  - The elevation value is available in the flags (5th element of cell array)

  *Physics.js buildTrackColliders:*
  - Destructure 5th element (flags) from cell array: `const [gx, gz, key, orient, flags] = cells[i]`
  - Apply same Y offset logic as buildTrack for `track-elev-*` types
  - The orient flip is already baked into the orient value by transformCells, so ramp-down physics rotation is automatic

  *editor.html placeMesh:*
  - Check `cell.elevation > 0` and `cell.type === 'track-straight-night'` or starts with `track-elev-`: add Y offset to mesh position

  **Patterns to follow:**
  - Current `placeMesh`: `mesh.position.set((gx+0.5)*CELL_RAW, 0.5, (gz+0.5)*CELL_RAW)` — Y becomes `0.5 + elevOffset`
  - `ORIENT_FLIP` already exists in editor.html line ~537 for other purposes

  **Verification:**
  - Elevated straight tiles render at correct height in both editor and game
  - Ramp-down tiles slope in the correct direction (opposite to ramp-up)
  - Physics colliders match visual positions for both elevated and ramp tiles
  - Vehicle can drive up one ramp and down the other smoothly
  - Save/load round-trips correctly

- [ ] **Unit 2: Delete unused model files**

  **Goal:** Remove ramp-down and elevated flat GLB files.

  **Requirements:** R5

  **Dependencies:** Unit 1 verified working

  **Files:**
  - Delete: `models/standard-map/kartkids_base_trk_170_elv_flat_1x1_z2p5.glb`
  - Delete: `models/standard-map/kartkids_base_trk_180_elv_flat_1x1_z5.glb`
  - Delete: `models/standard-map/kartkids_base_trk_210_rmp_down_1x1_z2p5_to_z0.glb`
  - Delete: `models/standard-map/kartkids_base_trk_220_rmp_down_1x1_z5_to_z0.glb`

  **Verification:** Files removed. No 404 errors in console when using editor or game.

- [ ] **Unit 3: Update tile manifests**

  **Goal:** Remove deleted tiles from TileTester, TrackTester, and tile-catalog manifests.

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `js/TileTester.js` — TILE_FILES array
  - Modify: `js/TrackTester.js` — TILE_FILES array
  - Modify: `tile-catalog.html` — TILES array
  - Modify: `editor.html` — model loading list (remove elev and ramp-down from load list)
  - Modify: `js/main.js` — model loading list

  **Approach:** Remove entries for the 4 deleted tiles from all manifests and model loading lists. Keep ramp-up entries.

  **Verification:** Tile tester, track tester, catalog, editor, and game load without errors. Tile count reduced by 4.

## System-Wide Impact

- **Physics (buildTrackColliders):** Must be updated to read elevation flags and apply Y offset — currently hardcodes Y=0.5. The orient flip for ramp-down is handled automatically since it's baked into the orient value by transformCells.
- **Physics (buildWallColliders):** Wall Y position is hardcoded at ground level. This is a pre-existing issue for elevated tiles (walls were at ground level even with the old elevated GLBs) and is out of scope for this refactor.
- **Save/load format:** Unchanged. Editor's getCellsArray already normalizes type names on save (converts `track-elev-*` to `track-straight-night`, skips `autoRamp` cells). `transformCells` re-derives these at load time from the elevation flag.
- **TrackIntel:** Uses ground height from physics raycasts, not tile type names — unaffected.
- **Vehicle:** Drives on physics mesh, not visual tiles — unaffected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Elevated flat GLB has terrain fill/supports that straight tile lacks | **Prerequisite check** — compare geometry in tile catalog before starting |
| Y offset values don't match old GLB geometry exactly | Validate offset values against GLB vertex heights during integration |
| buildTrackColliders flags destructuring breaks if cells lack 5th element | Add fallback: `const flags = cells[i][4] || {}` |
| Editor validation checks break (type-name matching for elev/ramp) | Grep for all `track-elev-` and `track-ramp-down-` string references in editor.html — these should continue to work since logical names are preserved |

## Sources & References

- Origin: `docs/plans/2026-04-04-001-feat-track-editor-v2-plan.md`
- Key code: `js/Track.js` getElevationModelName, getRampNeighborKeys, transformCells, buildTrack
- Key code: `editor.html` cycleElevation, clearElevationGroup, placeMesh, getCellsArray (save normalization)
- Key code: `js/TrackModelConfig.js`
- Key code: `js/Physics.js` buildTrackColliders, buildWallColliders
- Review: document-review findings 2026-04-04 (coherence, feasibility, scope-guardian)
