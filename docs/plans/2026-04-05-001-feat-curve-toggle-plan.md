---
title: "feat: Manual curve toggle on editor corners"
type: feat
status: active
date: 2026-04-05
origin: docs/brainstorms/2026-04-05-curve-toggle-requirements.md
deepened: 2026-04-05
---

# Manual Curve Toggle on Editor Corners

## Overview

Replace the automatic curve detection system with manual curve selection. When hovering a 1x1 corner in the editor, the existing radial menu button cycles through available curve sizes instead of toggling auto/hard corner.

## Problem Frame

The autodraw places straights and 1x1 corners correctly, but users have no control over which curve model to use on corners. Users need to manually pick which curve variant to place, with the system intelligently determining which sizes are available based on surrounding straights and clear footprint. (see origin: docs/brainstorms/2026-04-05-curve-toggle-requirements.md)

## Requirements Trace

- R1. Count consecutive straights on each arm when hovering a corner
- R2. Available sizes = min(arm1, arm2): 1=2x2, 2=3x3, 3+=4x4
- R3. Footprint must be clear for a curve size to be available
- R4. Button appears on hover via existing radial menu
- R5. Cycle order: 1x1 -> 2x2 wide -> 2x2 tight -> 3x3 -> 4x4 -> 1x1, skipping sizes where min(arm1, arm2) is insufficient or footprint is blocked
- R6. Save/load persists curveVariant to round-trip user selections
- R7-R10. Four curve models: 080 wide 2x2, 530 tight 2x2, 520 3x3, 530 4x4
- R11. Curve replaces corner + consumed straights visually
- R12. Road edges must connect seamlessly (depends on calibrated rotationY)
- R14. Remove automatic `detectCurves()` from ALL call sites — corners start as 1x1
- R15. No changes to straight/corner autodraw

## Scope Boundaries

- Curve rotationY calibration is a separate prerequisite — not part of this plan
- No new tile types beyond the 4 listed curve models
- No changes to how straights or 1x1 corners auto-place

## Context & Research

### Relevant Code and Patterns

- **Radial menu**: `editor.html:2705-3014` — already has a curve button (`radial-curve`) that shows on corner hover
- **Current curve button**: toggles `curveOverride` flag (auto vs hard corner) — will be repurposed to cycle sizes
- **`detectCurves()`**: `editor.html:1462-1636` — auto-detection logic, called from 5+ sites (lines 1447, 2302, 2426, 2992, 3894)
- **`renderCurves()`**: `editor.html:1645-1753` — positions/rotates curve meshes using `getCurveConfig()` — to be reused
- **`getCurveConfig()`**: `js/TileMetadata.js:32-63` — computes offset and rotation per orient/size — needs variant awareness
- **`resolveCellAndNeighbors()`**: `editor.html:1439-1450` — currently calls `detectCurves()` + `renderCurves()` at end
- **`eraseRoad()`**: calls `detectCurves()` at line 2426 and dissolves curves at lines 2377, 2407 — must be updated
- **Click handler**: `editor.html:2253-2298` — toggles `curveOverride` on click — must be removed or updated
- **Model loading**: `editor.html:1024-1032` — currently loads 3 curve models, needs 4th
- **`getRadialActions()`**: `editor.html:2729-2787` — gate condition `curveSize >= 2 || curveOverride` blocks fresh corners
- **Save/load**: `editor.html:596-604` — persists `curveSize`, `curveConsumed`, `curveOverride` in snapshots
- **curveOverride references**: 21 locations across editor.html — detection guards (1479, 1820), click handler (2253-2298), radial menu (2745, 2825-2831, 2950, 2980-2987), debug tooltip (2681), serialization (604, 639, 3046, 3148, 3500)

### Key Existing Patterns

- Radial button click handler pattern: find cell, modify state, call render, refresh menu
- Curve mesh lifecycle: `cell.curveMesh` stored on corner cell, `cell._prevConsumed` tracks previous consumed set for cleanup
- `curveConsumed` is a `Set` of cell keys ("gx,gz" strings)

## Key Technical Decisions

- **Repurpose existing radial-curve button** rather than adding new UI — the button already shows on corner hover, just change its behavior from toggle to cycle
- **Keep `renderCurves()` and extend `getCurveConfig()`** — rendering pipeline reused, but getCurveConfig needs a variant parameter to handle different offsets for 2x2-wide vs 2x2-tight
- **Add `curveVariant` field to cell** — stores which model variant is selected (e.g., '2x2-wide', '2x2-tight', '3x3', '4x4') instead of just `curveSize`. This is the authoritative field; `curveSize` is derived from it
- **Two model entries for 2x2** — `trk-curve-2x2-l` (wide, 080) and `trk-curve-2x2-tight-l` (tight, 530) both loaded and selectable
- **Remove curveOverride entirely** — replaced by curveVariant presence/absence. All 21 references must be cleaned up
- **530 2x2 tight model likely needs same rotationY as 530 4x4** (-PI/2) since they share the same geometry family

## Open Questions

### Resolved During Planning

- **UI for curve toggle**: Reuse existing radial-curve button — it already appears on corner hover. Change behavior from auto/hard toggle to size cycle.
- **How consumed straights restore on downgrade**: When cycling from larger to smaller curve (or back to 1x1), set `cell.curveMesh = null` and `cell.curveConsumed = null`, then `renderCurves()` cleanup logic (lines 1650-1675) already restores visibility of previously consumed cells via `_prevConsumed`.
- **getRadialActions gate**: Replace `curveSize >= 2 || curveOverride` with `cell.type === 'trk-corner-1x1' && getAvailableCurveSizes(gx, gz).length > 0`.
- **Backward compatibility**: Old saves with curveSize but no curveVariant get migrated: curveSize 2 -> '2x2-wide', 3 -> '3x3', 4 -> '4x4'.

### Deferred to Implementation

- Exact icon/tooltip text for each curve size in the cycle
- Whether 2x2-tight needs different getCurveConfig offsets than 2x2-wide (test visually)

## Implementation Units

- [ ] **Unit 1: Add 2x2 tight curve model**

**Goal:** Load the 4th curve model so all 4 variants are available

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `js/TrackModelConfig.js`
- Modify: `editor.html` (modelNames array ~line 1024)

**Approach:**
- Add `'trk-curve-2x2-tight-l'` to `modelNames` array in editor.html
- Add config entry in TrackModelConfig.js pointing to `standard-map/kartkids_base_trk_530_trn_90_l_2x2.gltf`
- Set `rotationY: -Math.PI / 2` as starting point (same as 530 4x4, since they share the same geometry family)

**Patterns to follow:**
- Existing `trk-curve-2x2-l` entry in TrackModelConfig.js
- Existing modelNames array pattern in editor.html

**Test scenarios:**
- Happy path: Page loads without error, `models['trk-curve-2x2-tight-l']` is populated

**Verification:**
- Editor loads successfully with no console errors about missing models

---

- [ ] **Unit 2: Remove ALL automatic curve detection**

**Goal:** Corners always start as 1x1 — no auto-upgrade to curves from any code path

**Requirements:** R14, R15

**Dependencies:** None

**Files:**
- Modify: `editor.html` (multiple locations)

**Approach:**
- Remove `detectCurves()` call from ALL call sites:
  - `resolveCellAndNeighbors()` (~line 1447)
  - `eraseRoad()` (~line 2426)
  - Click handler curveOverride toggle (~line 2302)
  - Radial menu click handler (~line 2992)
  - Any other call site (~line 3894)
- Keep `renderCurves()` calls — they handle cleanup of existing curves when cells change
- Delete the `detectCurves()` function body entirely (arm-counting logic will be reimplemented cleanly in Unit 3)

**Patterns to follow:**
- Current `resolveCellAndNeighbors()` structure

**Test scenarios:**
- Happy path: Place straights + corner via autodraw — corner stays as 1x1, no curve auto-placed
- Happy path: Erase a tile near a corner — no curve auto-placed
- Edge case: Existing saved tracks with curves load correctly (renderCurves still runs on load)

**Verification:**
- Drawing any track shape in the editor produces only 1x1 corners, never multi-tile curves
- No calls to `detectCurves` remain in the codebase

---

- [ ] **Unit 3: Add arm-counting utility function**

**Goal:** Create a function that determines which curve variants are available for a corner, including the consumed cell sets

**Requirements:** R1, R2, R3

**Dependencies:** Unit 2

**Files:**
- Modify: `editor.html` (new function)

**Approach:**
- Create `getAvailableCurveOptions( gx, gz )` that:
  1. Checks cell is a corner (`trk-corner-1x1`)
  2. Gets the 2 exit directions from `getCellExits()`
  3. Walks each direction counting consecutive `trk-straight` cells, **skipping straights that are in any other cell's curveConsumed set** (prevents double-counting)
  4. Computes `maxSize = min(arm1, arm2, 4)`
  5. For each candidate size (2, 3, 4), validates footprint is clear:
     - All NxN cells in the curve footprint (relative to corner, in the turn direction) must be either empty or existing straights on the arms being consumed
     - Cells consumed by another curve's curveConsumed are treated as occupied
  6. Returns array of objects with full state for each available option:
     ```
     [
       { variant: '2x2-wide', curveSize: 2, consumed: Set(['gx,gz', ...]) },
       { variant: '2x2-tight', curveSize: 2, consumed: Set(['gx,gz', ...]) },
       { variant: '3x3', curveSize: 3, consumed: Set(['gx,gz', ...]) },
       { variant: '4x4', curveSize: 4, consumed: Set(['gx,gz', ...]) },
     ]
     ```
     Filtered to only sizes that fit. Both 2x2 variants share the same consumed set.

**Variant-to-size mapping:**
```
null:        { curveSize: 1, consumed: 0 per arm }
'2x2-wide':  { curveSize: 2, consumed: 1 per arm }
'2x2-tight': { curveSize: 2, consumed: 1 per arm }
'3x3':       { curveSize: 3, consumed: 2 per arm }
'4x4':       { curveSize: 4, consumed: 3 per arm }
```

**Patterns to follow:**
- Walk logic concept from old `detectCurves()` Phase 1
- Footprint direction logic from old `detectCurves()` Phase 3

**Test scenarios:**
- Happy path: Corner with 1 straight per arm returns options for '2x2-wide' and '2x2-tight' with correct consumed sets
- Happy path: Corner with 2 straights per arm returns '2x2-wide', '2x2-tight', '3x3'
- Happy path: Corner with 3+ straights per arm returns all 4 variants
- Edge case: Corner with 0 straights on one arm returns empty array
- Edge case: Footprint blocked by another tile — that size excluded
- Edge case: Straight already consumed by another curve — not counted in arm walk

**Verification:**
- Function returns correct arrays with correct consumed sets for various configurations

---

- [ ] **Unit 4: Repurpose radial-curve button and update eraseRoad**

**Goal:** Clicking the curve button on a corner cycles through available curve variants. Erasing a consumed straight reverts the parent curve.

**Requirements:** R4, R5, R6, R11

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `editor.html` (radial menu ~2705-3014, eraseRoad ~2377-2427, click handler ~2253-2298, and ALL curveOverride references)

**Approach:**

**Radial menu gate (getRadialActions):**
- Replace `curveSize >= 2 || curveOverride` condition with: `cell.type === 'trk-corner-1x1' && getAvailableCurveOptions(gx, gz).length > 0`
- Keep consumed-cell scan for when user hovers a straight that is part of an active curve

**Radial-curve click handler:**
1. Call `getAvailableCurveOptions( gx, gz )` to get available options with consumed sets
2. Determine current state: `cell.curveVariant` or `null` (1x1)
3. Find current position in cycle order `[null, '2x2-wide', '2x2-tight', '3x3', '4x4']`
4. Advance to next available variant (skip unavailable ones, wrap to null/1x1)
5. Set `cell.curveVariant`, `cell.curveSize`, and `cell.curveConsumed` from the matching option
6. Call `renderCurves()` to update visuals — do NOT call detectCurves
7. Refresh radial menu to show updated state

**eraseRoad updates:**
- Where curveSize is cleared (lines 2377 and 2407), also clear `cell.curveVariant`
- When erasing a consumed straight: find the parent corner via curveConsumed scan, clear its `curveVariant`, `curveSize`, `curveConsumed`, then call `renderCurves()`

**curveOverride full cleanup — all 21 references:**
1. Detection guards at 1479, 1820 — remove curveOverride checks
2. Click handler at 2253-2298 — remove curveOverride toggle, replace with curveVariant cycle or remove entirely (radial menu is the sole entry point)
3. Radial menu at 2745, 2825-2831, 2950, 2980-2987 — replace with curveVariant logic
4. Debug tooltip at 2681 — show curveVariant instead of curveOverride
5. Serialization at 604, 639, 3046, 3148, 3500 — handled in Unit 6

**Patterns to follow:**
- Current radial-curve click handler pattern (lines 2938-2999)
- `renderCurves()` already handles mesh creation/cleanup based on `curveSize`

**Test scenarios:**
- Happy path: Hover corner with 1 straight per arm, click cycle — goes 1x1 -> 2x2 wide -> 2x2 tight -> 1x1
- Happy path: Hover corner with 3 straights per arm, click cycle — goes through all 5 states
- Happy path: Cycling to a curve hides consumed straights, cycling back to 1x1 restores them
- Edge case: Corner with no straights — curve button doesn't appear
- Error path: Erase a consumed straight — parent corner reverts to 1x1, curveVariant cleared
- Error path: Erase the corner cell itself — curve mesh removed, consumed straights restored
- Integration: Two adjacent corners — selecting a curve on one doesn't double-count shared straights

**Verification:**
- Can cycle through all available curve sizes on a corner
- Consumed straights hide/show correctly during cycle
- Erasing a consumed straight cleanly reverts the curve
- No references to curveOverride remain in non-serialization code

---

- [ ] **Unit 5: Update renderCurves for variant-aware model selection**

**Goal:** renderCurves picks the correct model based on `curveVariant` and uses variant-aware positioning

**Requirements:** R7, R8, R9, R10, R11, R12

**Dependencies:** Unit 1, Unit 4

**Files:**
- Modify: `editor.html` (renderCurves ~line 1645)
- Modify: `js/TileMetadata.js` (getCurveConfig — add variant parameter)

**Approach:**
- Change model name generation in `renderCurves()` to a variant-based lookup:
  - `'2x2-wide'` → `'trk-curve-2x2-l'`
  - `'2x2-tight'` → `'trk-curve-2x2-tight-l'`
  - `'3x3'` → `'trk-curve-3x3-l'`
  - `'4x4'` → `'trk-curve-4x4-l'`
- Extend `getCurveConfig()` to accept a variant parameter (not just curveSize), so it can return different offsets for 2x2-wide vs 2x2-tight if needed
- Keep existing consumed cell visibility logic unchanged

**Patterns to follow:**
- Current `renderCurves()` model selection pattern (line 1685)

**Test scenarios:**
- Happy path: Selecting 2x2 wide renders the 080 model at correct position
- Happy path: Selecting 2x2 tight renders the 530 model at correct position
- Happy path: Selecting 3x3 renders the 520 model, consumes 2 straights per arm
- Happy path: Selecting 4x4 renders the 530-4x4 model, consumes 3 straights per arm
- Integration: Cycling through variants shows different curve models without visual glitches

**Verification:**
- Each variant renders the correct model file
- Curve meshes are positioned and rotated correctly (road edges connect to straights)

---

- [ ] **Unit 6: Update save/load for curveVariant**

**Goal:** Persist the user's curve variant selection with backward compatibility

**Requirements:** R6

**Dependencies:** Unit 4

**Files:**
- Modify: `editor.html` (snapshotGrid ~line 595, restoreSnapshot, save/load functions, compact export)

**Approach:**
- Add `curveVariant` to the cell snapshot alongside existing `curveSize` and `curveConsumed`
- On load, if `curveVariant` exists, restore it and call `renderCurves()`
- Remove `curveOverride` from serialization — remaining references at lines 604, 639, 3046, 3148, 3500
- **Migration for old saves**: if a loaded cell has `curveSize >= 2` but no `curveVariant`, infer variant from curveSize:
  - curveSize 2 → `'2x2-wide'` (default)
  - curveSize 3 → `'3x3'`
  - curveSize 4 → `'4x4'`

**Patterns to follow:**
- Existing `snapshotGrid()` pattern for optional cell fields (line 602-607)

**Test scenarios:**
- Happy path: Save track with 3x3 curve, reload — curve is restored with correct variant
- Edge case: Load old save with curveSize=3 but no curveVariant — migrated to '3x3', curve renders
- Edge case: Load old save with curveOverride=true — ignored, corner loads as 1x1
- Edge case: Load old save with no curve data — corners are 1x1, no crash

**Verification:**
- Round-trip save/load preserves curve selections
- Old saves with auto-detected curves are migrated, not silently dropped

## System-Wide Impact

- **Interaction graph:** The radial menu click handler is the sole entry point for curve changes after cleanup. eraseRoad is the secondary entry point (for reverting curves on erase). `renderCurves()` is the sole renderer.
- **Error propagation:** If a curve model fails to load, `renderCurves()` already skips with `if ( !src ) continue` — graceful degradation.
- **State lifecycle:** When erasing a tile consumed by a curve, eraseRoad detects this and reverts the parent corner to 1x1 (clearing curveVariant, curveSize, curveConsumed). When erasing the corner itself, curve mesh is removed and consumed straights are restored.
- **curveOverride removal:** 21 references across detection, click handling, radial menu, debug tooltip, and serialization — all addressed in Units 4 and 6.
- **Unchanged invariants:** Autodraw for straights and 1x1 corners is untouched. Physics wall colliders are unaffected. The game's `Track.js` rendering is separate from the editor.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Curve rotationY not calibrated yet | Plan defers to tile calibrator — 530 2x2 initialized to -PI/2 (same family as 530 4x4) |
| 2x2 tight model may need different getCurveConfig offsets | getCurveConfig extended with variant parameter in Unit 5 — test visually |
| Erasing a consumed straight leaves orphaned curve state | eraseRoad explicitly clears curveVariant in Unit 4 |
| Old saves silently lose curves | Migration logic in Unit 6 infers curveVariant from curveSize |
| Two adjacent corners double-count shared straights | Unit 3 arm walk skips straights in any curveConsumed set |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-05-curve-toggle-requirements.md](docs/brainstorms/2026-04-05-curve-toggle-requirements.md)
- Radial menu: `editor.html:2705-3014`
- eraseRoad: `editor.html:2377-2427`
- Click handler: `editor.html:2253-2298`
- Curve detection: `editor.html:1462-1636`
- Curve rendering: `editor.html:1645-1753`
- Tile metadata: `js/TileMetadata.js:32-63`
- Model config: `js/TrackModelConfig.js`
