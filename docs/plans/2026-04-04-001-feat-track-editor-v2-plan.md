---
title: "feat: Track Editor v2 — Smart Curves, Elevation & Rotation"
type: feat
status: completed
date: 2026-04-04
origin: docs/brainstorms/2026-04-04-track-editor-v2-requirements.md
deepened: 2026-04-04
---

# Track Editor v2 — Smart Curves, Elevation & Rotation

## Overview

Upgrade the 1x1 grid editor to automatically render multi-tile curve pieces when turn geometry warrants it, add fixed-level elevation with auto-ramp insertion, and give users manual rotation control. The grid stays 1x1 for authoring; a rendering layer on top swaps in the right models.

## Problem Frame

The editor places only 1x1 hard corners and flat tiles, but `models/standard-map/` has 47+ GLBs including 2x2–4x4 curves, ramps, and elevation pieces. Tracks look blocky and flat compared to what the tile set supports. (see origin: docs/brainstorms/2026-04-04-track-editor-v2-requirements.md)

## Requirements Trace

- R1. Corner auto-detection: shorter straight side determines curve size (1→1x1, 2→2x2, 3→3x3, 4→4x4)
- R2. Grid stays 1x1; curve pieces are a rendering concern
- R3. Click a curve to toggle it back to a hard 1x1 corner
- R4. Corner detection re-evaluates when adjacent tiles change
- R5. R key rotates hovered tile 90° clockwise
- R6. Manual rotation overrides auto-resolve for that tile
- R7. Visual rotation indicator on hover
- R8. Elevation on straights only
- R9. Click straight to cycle: ground → 2.5m → 5m → ground
- R10. Auto-insert ramp transitions using existing GLBs
- R11. Reject elevation when no room for ramps
- R12. Ramp tiles are auto-managed

## Scope Boundaries

- Fixed elevation levels only (0, 2.5m, 5m)
- No elevation on corners or multi-tile pieces
- No new GLB models — only existing standard-map assets
- Bridges, tunnels, jumps, junctions out of scope
- Editor grid stays 1x1 for all authoring

## Context & Research

### Relevant Code and Patterns

- `editor.html` — 2300-line single-file editor with auto-tile via 4-bit bitmask (N=8, S=4, E=2, W=1), `AUTOTILE` lookup table, `resolveCell`/`resolveCellAndNeighbors` cascade, ghost preview, undo/redo snapshots
- `js/TrackModelConfig.js` — Maps tile type names to `{ path, rotationY }`. Currently only maps `track-straight-night` and `track-corner-night`
- `js/Track.js` — `buildTrack()` uses InstancedMesh per type, `encodeCells`/`decodeCells` with 3 bytes per cell (4 spare bits in byte 2)
- `js/Physics.js` — `buildTrackColliders()` merges all tile geometry into one triangle mesh; `buildWallColliders()` creates box/arc segments per tile type
- `js/TrackIntel.js` — Walks cell connectivity from finish, builds waypoint array. `BASE_CONNECTIVITY` table has 4 types. `getOpenEdges()` rotates edge pairs by orient

### Key Model Inventory

| Category | Models | Dims |
|----------|--------|------|
| Hard turns | `020_trn_90_l/r_1x1` | 1x1 |
| Wide turns | `080/090_trn_wide_l/r_2x2` | 2x2 |
| Widest turns | `100/110_trn_widest_l/r_3x3`, `510/520_trn_90_l/r_3x3` | 3x3 |
| Large turns | `530_trn_90_l/r_4x4` | 4x4 |
| Elevated flat | `170_elv_flat_1x1_z2p5`, `180_elv_flat_1x1_z5` | 1x1 |
| Ramps up | `190_rmp_up_z0_to_z2p5`, `200_rmp_up_z0_to_z5` | 1x1 |
| Ramps down | `210_rmp_down_z2p5_to_z0`, `220_rmp_down_z5_to_z0` | 1x1 |
| Ramp transitions | `230–300` series (8 variants for flat↔up/down at 2.5 & 5) | 1x1 |

## Key Technical Decisions

- **Grid stays 1x1, curves are a render overlay**: The corner cell is the anchor. The curve mesh replaces visuals for the corner cell + consumed straight cells. Those grid cells still exist for connectivity but their individual meshes are hidden. This keeps the draw/erase UX unchanged. (see origin)
- **Curves/ramps/elevation are derived, never saved as distinct types**: The save format stores only the 4 base types (straight, corner, bump, finish) plus flags. `TYPE_NAMES` stays at 4 entries and `typeIndex` stays at 2 bits. Curve pieces, ramp models, and elevated flat models are resolved at render time from the base grid + flags. This means both the editor and `buildTrack()` must run the detection/elevation engine to produce the visual output. `TrackModelConfig` maps the derived visual names to GLBs, but these names never appear in the save codec.
- **Curve detection runs after every resolve**: `resolveCellAndNeighbors` already cascades. A new `detectCurves()` pass runs after the resolve cascade, scanning the grid for turn patterns and upgrading visuals. Detection is scoped to corners near the changed cell (not a full grid scan) to avoid O(n*k) on every keystroke.
- **Shorter side wins for curve sizing**: 3 straights into turn + 5 out = 3x3 curve. (see origin)
- **Save format uses spare bits**: Byte 2 currently uses 4 bits `(typeIndex << 2 | orientIndex)`. The upper 4 bits encode: `elevLevel` (2 bits: 0/1/2 for 0m/2.5m/5m) + `curveOverride` (1 bit: 1 = force hard corner) + `rotationOverride` (1 bit: 1 = manual orient, skip auto-resolve). New format: `(flags << 4) | (typeIndex << 2) | orientIndex`. Fully backward-compatible — old saves have flags=0. No new type indices needed since visual tiles are derived.
- **Ramp chain for 2.5m elevation**: ground → `rmp_up_z0_to_z2p5` → `elv_flat_z2p5` → `rmp_down_z2p5_to_z0` → ground (5 cells minimum). For 5m: same pattern with z5 variants. Transition pieces (230–300) are **not** auto-inserted in this pass — they are optional polish for a future iteration. The basic ramp chain is: 1 ramp up + 1 elevated flat + 1 ramp down. Validation must check the full chain depth (3 cells for the ramp group + 1 ground straight on each side = 5 contiguous straights required).
- **Multi-tile curve GLB origin must be verified**: Before implementing Unit 3, load each multi-tile curve GLB and inspect its bounding box to determine whether the local origin is at the corner cell or at the model center. If centered, compute an offset table per model. This is a blocking prerequisite for curve rendering.
- **Multi-tile curves in physics**: The merged triangle mesh approach in `buildTrackColliders` already handles arbitrary geometry. Multi-tile curve GLBs get their vertices collected at the correct position (corner cell + offset if needed). Wall colliders need new procedural arc geometry matching the curve radius — these are code-generated colliders, not GLB models.
- **Snapshot format extends with cell properties**: Every unit that adds cell properties must also update `snapshotGrid`/`restoreSnapshot` to include them. Elevation changes (which modify 3+ cells atomically) must take a single snapshot before the multi-cell modification so undo restores the full group.

## Open Questions

### Resolved During Planning

- **How should multi-tile curves anchor?** One mesh at the corner cell position, plus an offset if the GLB origin is model-centered (verified per-model in Unit 1). Adjacent consumed cells hide their meshes.
- **Do all ramp GLBs exist?** Yes — verified: up/down for both 2.5m and 5m, plus 8 transition variants. Transition pieces (230–300) are deferred to a future polish pass.
- **Should resolveCell skip manually rotated tiles?** Yes. If `rotationOverride` flag is set, `resolveCell` preserves the current type/orient. Curve detection also skips corners with `rotationOverride` — they stay as hard 1x1 corners. If a user rotates a corner that was already part of a curve, the rotation sets `rotationOverride`, which causes `detectCurves()` on the next pass to skip that corner, effectively dissolving the curve. The mechanism is: rotation → flag set → detection skips → curve gone. Not two separate mechanisms.
- **How do new tile types get saved?** They don't — curves, ramps, and elevation visuals are derived at render time from base types + flags. `TYPE_NAMES` stays at 4 entries. `TrackModelConfig` maps derived visual names to GLBs but these never enter the save codec.
- **Are ramp transition pieces auto-inserted?** No — the basic ramp chain uses only ramp_up + elev_flat + ramp_down. Transition pieces are future polish.
- **What about ramp cell erasure?** Ramp cells (marked `autoRamp: true`) cannot be clicked to edit or cycle elevation. Erasing a ramp cell with the eraser tool cascade-deletes the entire elevation group (parent + all ramps). This is consistent: ramps are auto-managed, and the eraser is the only way to remove them.

### Deferred to Implementation

- Exact `rotationY` correction values and position offsets for each multi-tile GLB (load and test visual alignment — blocking for Unit 3)
- Whether `510/520_trn_90_l/r_3x3` or `100/110_trn_widest_l/r_3x3` is the better 3x3 curve (test both visually)
- Whether 2x2 "wide" turns (`080/090`) have the same 90° connectivity as 1x1 corners (verify geometry before using)
- TrackIntel waypoint generation for cells consumed by multi-tile curves (may need arc waypoints instead of cell centers)
- Tie-breaking rule for equal-size competing curves sharing a straight run (try: prefer the curve whose corner was placed first, i.e., lower grid key)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
Grid Layer (1x1 cells)          Render Layer (visual output)
┌───┬───┬───┬───┐              ┌───┬───────────┐
│ S │ S │ S │   │              �� S │           │
├───┼───┼───┤   │              ├───┤  3x3      │
│   │   │ C │   │   ──────►   │   │  Curve    │
├───┼───┼───┤   │              ├───┤  Mesh     │
│   │   │ S │   │              │   │           │
├───┼───┼───┼───┤              ├───┼───────────┤
│   │   │ S │   │              │   │ S │   │   │
└───┴───┴───┴───┘              └───┴───┴───┴───┘

S = straight, C = corner cell (anchor)
3 straights before corner → 3x3 curve replaces C + adjacent cells visually
```

**Elevation auto-ramp insertion:**
```
User clicks tile at (3,0) to elevate to 2.5m:

Before: [ S(0m) ][ S(0m) ][ S(0m) ][ S(0m) ][ S(0m) ]
After:  [ S(0m) ][ramp_up][ E(2.5m)][ramp_dn][ S(0m) ]
                  ^auto     ^user     ^auto
```

## Implementation Units

- [ ] **Unit 1: Extend TrackModelConfig + Preload Models**

**Goal:** Register all curve, ramp, and elevation GLBs in the model config so they can be loaded and placed.

**Requirements:** Foundation for R1, R2, R8, R10

**Dependencies:** None

**Files:**
- Modify: `js/TrackModelConfig.js`
- Modify: `editor.html` (model loading section, ~line 792 `loadModels()`)
- Test: manual — load editor, verify no console errors, all models accessible

**Approach:**
- Add new visual tile names to `getTrackModelConfig` only (NOT to `TYPE_NAMES` in Track.js — these are derived visual types, never saved): `track-curve-2x2-l`, `track-curve-2x2-r`, `track-curve-3x3-l`, `track-curve-3x3-r`, `track-curve-4x4-l`, `track-curve-4x4-r`, `track-elev-2p5`, `track-elev-5`, `track-ramp-up-2p5`, `track-ramp-up-5`, `track-ramp-down-2p5`, `track-ramp-down-5`
- Each entry maps to the correct `standard-map/` GLB path, `rotationY` correction, and **position offset** (for multi-tile models whose origin isn't at one corner)
- Load each multi-tile GLB and inspect bounding box to determine origin position. Record offset in config: `{ path, rotationY, offset: { x, z } }`
- In `loadModels()`, load all new model types alongside existing ones. Use the same GLTFLoader pattern
- Add a safety fallback to `TrackIntel.getOpenEdges()`: unknown types return `null` instead of throwing, so partial implementations don't crash the game

**Patterns to follow:**
- Existing `getTrackModelConfig` structure: `{ path, rotationY }` — extend with optional `offset`
- Existing `loadModels()` pattern in editor.html

**Verification:**
- Editor loads without errors
- All new model types are accessible via `models[name]`
- TrackIntel doesn't crash on unknown tile types

---

- [ ] **Unit 2: Smart Corner Detection Engine**

**Goal:** After auto-tile resolution, scan the grid for turn patterns and determine which curve size fits.

**Requirements:** R1, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `editor.html` (new function `detectCurves()`, called from `resolveCellAndNeighbors`)

**Approach:**
- New function `detectCurves(changedGx, changedGz)` scans corner cells near the changed cell (within radius 5), not the entire grid
- For each corner: walk outward along both exit directions, counting consecutive straights
- The shorter count determines curve size: min(countA, countB) capped at 4
- Before confirming a curve: verify the full NxN footprint area is clear (cells are either empty or part of the straight runs being consumed). Obstacles in the footprint block the curve
- If size >= 2 and footprint is clear, store curve metadata on the corner cell: `{ curveSize, curveConsumed: Set of cell keys }`
- Re-runs whenever `resolveCellAndNeighbors` fires (existing cascade point)
- Must handle overlapping curve candidates: a cell consumed by one curve can't be consumed by another. Process curves greedily from largest to smallest. Tie-breaking for equal sizes: prefer the corner with the lower grid key (`gx,gz` string comparison)
- Also update `snapshotGrid`/`restoreSnapshot` to include `curveSize` and `curveConsumed` on corner cells

**Patterns to follow:**
- `getCellExits(cell)` for determining exit directions
- `connectedExitCount()` for neighbor scanning
- The existing `resolveCell → placeMesh` pipeline

**Test scenarios:**
- Happy path: 3 straights + corner + 3 straights → detects 3x3 curve
- Happy path: 2 straights + corner + 5 straights → detects 2x2 curve (shorter side wins)
- Happy path: 1 straight + corner → stays 1x1 (no upgrade)
- Edge case: corner with 0 straights on one side → stays 1x1
- Edge case: two adjacent curves sharing a straight run → greedy largest-first prevents overlap
- Edge case: corner at grid edge with only 1 straight available → caps at available count

**Verification:**
- Console logging shows correct curve sizes detected for test layouts
- Curve metadata stored on corner cells matches expected sizes

---

- [ ] **Unit 3: Curve Rendering Layer**

**Goal:** Replace corner + consumed straight meshes with the appropriate multi-tile curve GLB.

**Requirements:** R2, R4

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `editor.html` (new function `renderCurves()`, modifications to `placeMesh`)

**Approach:**
- After `detectCurves()` identifies curve groups, `renderCurves()` swaps visuals
- For each curve group: hide meshes of consumed cells (set `visible = false`), place curve model mesh at the corner cell's world position
- Curve mesh rotation derived from the corner cell's orient value + model-specific `rotationY`
- Store the curve mesh reference on the corner cell for cleanup
- When a cell is removed or changed, any curve group it belongs to is dissolved — consumed cells get their individual meshes restored
- Ghost preview: defer curve ghost preview to a future pass (not traced to R1-R12). Basic ghost preview continues showing individual tiles

**Patterns to follow:**
- `placeMesh(gx, gz, cell)` for mesh creation, positioning, and rotation
- `addGhostPiece()` for preview rendering

**Test scenarios:**
- Happy path: draw L-shape with 3+3 straights → see 3x3 curve model appear
- Happy path: extend a straight next to existing corner → curve upgrades dynamically
- Happy path: erase a straight from a curve's run → curve dissolves back to individual tiles
- Edge case: curve model orientation matches the turn direction (test all 4 rotations)
- Integration: ghost preview shows curve shape when hovering to complete a turn pattern

**Verification:**
- Visual: curves render smoothly at correct position/rotation
- Removing any cell in a curve group restores individual tiles

---

- [ ] **Unit 4: Corner Override Toggle**

**Goal:** Let users click a detected curve to force it back to a hard 1x1 corner.

**Requirements:** R3

**Dependencies:** Unit 3

**Files:**
- Modify: `editor.html` (click handler modification, cell data extension)

**Approach:**
- Add `curveOverride: boolean` to cell data (default false)
- When user clicks on a cell that's part of a detected curve, toggle `curveOverride` on the corner cell
- If `curveOverride = true`, `detectCurves()` skips that corner → renders as 1x1
- Visual feedback: toast message "Hard corner" / "Auto curve"
- Override persists through resolve cascades until explicitly toggled or cell removed

**Patterns to follow:**
- Existing finish-tile click behavior (flip orient on click, line 1195)
- Toast notification pattern (`showToast()`)

**Test scenarios:**
- Happy path: click a 3x3 curve → reverts to hard corner + individual straights
- Happy path: click the hard corner again → re-enables auto curve
- Edge case: override persists when adjacent tiles change
- Edge case: removing and re-placing the corner cell clears the override

**Verification:**
- Toggle works bidirectionally
- Minimap updates to reflect curve/hard corner state

---

- [ ] **Unit 5: Manual Rotation**

**Goal:** R key rotates the hovered tile 90° clockwise, overriding auto-resolve.

**Requirements:** R5, R6, R7

**Dependencies:** Unit 3 (rotation of a curve corner dissolves the curve, requiring curve rendering logic)

**Files:**
- Modify: `editor.html` (keydown handler, resolveCell modification, cell data extension)

**Approach:**
- Add `rotationOverride: boolean` to cell data (default false)
- On `R` keypress: if hovering a grid cell with a tile, cycle orient (0→16→10→22→0), set `rotationOverride = true`
- `resolveCell()` checks `rotationOverride` — if true, skip auto-resolve, keep current type/orient
- Visual indicator: directional arrow or highlighted exit edge on hovered tile showing current orientation
- Override clears when tile is removed. Re-placing a tile at the same position starts fresh

**Patterns to follow:**
- Existing keyboard handlers in editor (view toggle, tool select)
- `ORIENT_DEG` mapping for rotation values
- `getCellExits(cell)` for determining which edges to highlight

**Test scenarios:**
- Happy path: hover tile, press R → rotates 90° clockwise visually
- Happy path: press R 4 times → returns to original orientation
- Happy path: rotated tile keeps orientation when neighbors change
- Edge case: rotating a corner cell that's part of a curve → dissolves the curve, keeps manual orient
- Edge case: erasing and re-drawing at same position → override cleared, auto-resolve kicks in
- Integration: rotation indicator visible on hover

**Verification:**
- Tile visually rotates to correct orientation
- Auto-resolve no longer overrides manually rotated tiles
- Undo restores previous rotation state

---

- [ ] **Unit 6: Elevation & Auto-Ramps**

**Goal:** Click a straight tile to cycle elevation, with automatic ramp insertion.

**Requirements:** R8, R9, R10, R11, R12

**Dependencies:** Unit 1

**Files:**
- Modify: `editor.html` (click handler, new elevation functions, cell data extension)

**Approach:**
- Add `elevation: 0 | 1 | 2` to cell data (0 = ground, 1 = 2.5m, 2 = 5m)
- Click a straight tile while in "elevation tool" mode (or modifier key) → cycle elevation
- Before applying: validate full ramp chain — the target cell needs 1 straight neighbor on each side of its axis (for ramp placement), and those ramp neighbors need a ground-level straight beyond them (for the ramp to connect to). Total: 5 contiguous straights required (ground + ramp + elevated + ramp + ground)
  - Each ramp neighbor must exist, be a straight, be at ground level, not be consumed by a curve, and not be a ramp for another elevation group
  - If validation fails, show toast "No room for ramps" and reject
- Take a single undo snapshot before the multi-cell modification (so undo restores the full group atomically)
- On valid elevation change:
  - Set target cell elevation and swap its mesh to `track-elev-2p5` or `track-elev-5`
  - Replace neighbor meshes with ramp models. Direction convention: for N/S straights (orient 0), `ramp_up` faces the lower gz neighbor, `ramp_down` faces the higher gz neighbor. For E/W straights (orient 16), `ramp_up` faces the lower gx neighbor, `ramp_down` faces the higher gx. This is a fixed spatial convention — no travel direction needed
  - Mark ramp cells as `autoRamp: true` and store a reference to the parent elevated cell
- On de-elevation (back to ground): restore ramp cells to normal straights
- Ramp cells cannot be clicked to edit or cycle elevation (click rejected with toast)
- Erasing a ramp cell with the eraser tool cascade-deletes the entire elevation group (parent + all ramps)
- Elevation rejected on corners, finish tile, and cells consumed by curves
- Update `snapshotGrid`/`restoreSnapshot` to include `elevation`, `autoRamp`, and ramp parent reference

**Patterns to follow:**
- Existing tool selection pattern (Road/Eraser buttons)
- `placeMesh()` for swapping visuals
- Toast pattern for validation feedback

**Test scenarios:**
- Happy path: click straight → elevates to 2.5m, ramps appear on both sides
- Happy path: click again → elevates to 5m, ramps update to 5m variants
- Happy path: click again → returns to ground, ramps removed
- Error path: click straight with corner neighbor → "No room for ramps" toast
- Error path: click straight at grid edge (no neighbor) → rejected
- Error path: click a corner tile → no elevation change
- Error path: click a straight consumed by a curve → "Curves cannot be elevated" toast, rejected
- Edge case: click a ramp tile → rejected (auto-managed)
- Edge case: erasing a ramp's parent elevated tile → ramps auto-removed
- Edge case: erasing a ramp tile directly → should erase the whole elevation group (parent + ramps)
- Integration: elevated tiles display at correct Y position in 3D view

**Verification:**
- Ramps visually connect elevated section to ground level
- Cannot create invalid ramp configurations
- Undo restores full elevation group (parent + ramps)

---

- [ ] **Unit 7: Save/Load Format Extension**

**Goal:** Persist elevation, curve overrides, and rotation overrides in the save format.

**Requirements:** Supports R3, R6, R8–R12 persistence

**Dependencies:** Units 4, 5, 6

**Files:**
- Modify: `js/Track.js` (`encodeCells`, `decodeCells`)
- Modify: `editor.html` (save/load functions, snapshot functions)

**Approach:**
- Extend byte 2 format: `(flags << 4) | (typeIndex << 2) | orientIndex`
- `typeIndex` stays at 2 bits (4 base types only). Visual types (curves, ramps, elevation) are derived at load time — never stored
- Flags (4 bits): `elevLevel[1:0]` (2 bits: 0/1/2 for 0m/2.5m/5m) + `curveOverride` (1 bit) + `rotationOverride` (1 bit)
- `encodeCells`: pack flags from cell data into upper 4 bits. Ramp cells (`autoRamp: true`) are NOT encoded — they are derived from elevated cells at load time
- `decodeCells`: unpack flags, reconstruct cell properties. After decoding, run elevation engine to re-derive ramp cells, then run curve detection to re-derive curve groups
- Backward compatible: old saves have flags=0 (ground level, no overrides)
- Named track save/load must round-trip all flag properties
- URL `?map=` encoding carries the same format to the game

**Patterns to follow:**
- Existing `encodeCells`/`decodeCells` in Track.js
- Existing `snapshotGrid`/`restoreSnapshot` in editor.html

**Test scenarios:**
- Happy path: save track with elevation + overrides → load → all properties restored
- Happy path: load old-format save (no flags) → defaults to ground/no overrides
- Edge case: URL encoding round-trips correctly with new flags
- Integration: game loads editor-created track with elevations and renders correctly

**Verification:**
- Round-trip: create track with all features → save → reload → identical result
- Old saves still load correctly

---

- [ ] **Unit 8: Game-Side Integration**

**Goal:** Make editor-created tracks with curves, elevation, and ramps play correctly in `index.html`.

**Requirements:** All — this is the integration point

**Dependencies:** Units 1–7

**Files:**
- Modify: `js/Track.js` (`buildTrack` to handle new tile types and multi-tile curve placement)
- Modify: `js/Physics.js` (`buildTrackColliders` already merges geometry — verify it handles new models; `buildWallColliders` needs new arc sizes for curves)
- Modify: `js/TrackIntel.js` (`BASE_CONNECTIVITY` table needs entries for new tile types; waypoint generation may need arc interpolation for curves)

**Approach:**
- `buildTrack()` must run the detection/elevation engine on the decoded cells array to produce a **transformed cells array** before rendering. The transformed array: (1) removes consumed cells, (2) replaces curve anchor cells with derived visual type names (e.g., `track-curve-3x3-l`), (3) replaces elevated/ramp cells with their visual type names. This transformed array feeds into the existing `cellsByType` grouping so InstancedMesh counts are correct from the start (InstancedMesh count is fixed at creation). Curve models use individual `Mesh` objects added separately (not InstancedMesh) since each curve size has very few instances per track
- `buildTrackColliders()` also iterates the cells array directly (`for (const [gx, gz, key, orient] of cells)`) — it does NOT traverse the rendered scene. It must receive the same transformed cells array so it generates colliders from curve/ramp/elevation GLB geometry, not from base-type geometry at consumed-cell positions
- `buildWallColliders()`: Add procedural wall generation for curve tiles — outer arc radius scales with curve size (2x2 = 2 cells, 3x3 = 3 cells, etc.). Inner arc for tighter curves. These are code-generated box colliders arranged in arcs, not GLB models
- `TrackIntel`: The saved grid only has base types (straight, corner, bump, finish) so `BASE_CONNECTIVITY` doesn't need new entries — it already handles these. The `getOpenEdges()` fallback (added in Unit 1) handles any unexpected types gracefully. Consumed straight cells within a curve still report their original connectivity so the waypoint walker traverses them. Consider emitting smoother arc waypoints for curves instead of cell-center waypoints

**Patterns to follow:**
- Existing `buildTrack()` instancing pattern
- Existing `buildWallColliders()` arc generation for 1x1 corners
- Existing `TrackIntel` connectivity walk

**Test scenarios:**
- Happy path: play a track with 3x3 curves → kart follows the curve, no wall clipping
- Happy path: play a track with elevated section → kart drives up ramp, across elevated flat, down ramp
- Happy path: AI vehicles navigate curves and elevation correctly
- Edge case: wall colliders match visual geometry for all curve sizes
- Edge case: item boxes place correctly on curved and elevated sections
- Integration: minimap in-game shows correct track shape with curves

**Verification:**
- Drive a test track with all new features — no physics glitches, correct visual rendering
- AI completes laps on tracks with curves and elevation
- ItemBoxManager places boxes at valid positions

## System-Wide Impact

- **TrackModelConfig**: Central mapping — all model loading flows through here. New entries must use consistent naming
- **Physics colliders**: Merged triangle mesh approach scales automatically. Wall colliders need new arc geometry per curve size
- **TrackIntel**: Waypoint generation affects AI, item placement, and position tracking. Must handle new tile types gracefully
- **Save format**: Backward compatible — old saves still work. New saves won't load correctly in old code (acceptable for branch work)
- **Unchanged invariants**: Vehicle physics, camera, controls, multiplayer, HUD all unchanged. They consume TrackIntel output which maintains the same API

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Curve GLB alignment/rotation/origin may be wrong | Unit 1 includes `rotationY` and position offset per model; load and inspect each GLB before implementing Unit 3 |
| Multi-tile curve physics gaps (seams between curve mesh and adjacent tiles) | Merged triangle mesh eliminates seams by design; verify with collision testing |
| Save format change breaks shared tracks | Backward compatible — old format loads as flags=0. New→old: flags ignored, base grid still valid |
| TrackIntel waypoints too coarse for large curves | Deferred — if AI path-following is jerky on curves, add arc interpolation in TrackIntel |
| 2x2 "wide" turns may not have 90° connectivity | Verify geometry before using; if mismatched, only use 3x3+ curves (skip 2x2) |
| Three-way interaction: curves × rotation × elevation | Test combined scenarios during implementation; each feature explicitly rejects interaction with the others (rotated corners skip curves, elevated cells can't be in curves) |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-04-track-editor-v2-requirements.md](docs/brainstorms/2026-04-04-track-editor-v2-requirements.md)
- Related code: `editor.html`, `js/TrackModelConfig.js`, `js/Track.js`, `js/Physics.js`, `js/TrackIntel.js`
- Model assets: `models/standard-map/` (47 GLBs)
