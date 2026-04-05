---
date: 2026-04-05
topic: curve-toggle
---

# Manual Curve Toggle on Corners

## Problem Frame

The track editor autodraw places straights and 1x1 corners correctly, but multi-tile curves (2x2, 3x3, 4x4) currently auto-detect and auto-place with incorrect orientations. Users need manual control to select which curve model to use on any corner, and the curves need to render at the correct rotation so the road path connects seamlessly to adjacent straights.

## Requirements

**Corner Detection**
- R1. When hovering a 1x1 corner tile, the system counts consecutive straights extending from each arm of the corner
- R2. Available curve sizes are determined by `min(arm1_straights, arm2_straights)`: 1 straight per arm = 2x2 available, 2 = 3x3, 3+ = 4x4
- R3. The footprint (NxN area) must be clear of other tiles for a curve size to be available

**Curve Toggle**
- R4. A button appears when hovering a corner tile that shows available curve options
- R5. Pressing the button cycles through: 1x1 corner -> 2x2 wide -> 2x2 tight -> 3x3 -> 4x4 -> back to 1x1 (skipping sizes that don't fit)
- R6. The system does not remember previous selections — each toggle is independent

**Curve Models (4 total)**
- R7. 2x2 wide: `kartkids_base_trk_080_trn_wide_l_2x2.gltf`
- R8. 2x2 tight: `kartkids_base_trk_530_trn_90_l_2x2.gltf`
- R9. 3x3: `kartkids_base_trk_520_trn_90_l_3x3.gltf`
- R10. 4x4: `kartkids_base_trk_530_trn_90_l_4x4.glb`

**Rendering**
- R11. When a curve is selected, it replaces the corner + consumed straights visually (hides their meshes, shows the curve model)
- R12. The curve model must be rotated and positioned so the road edges (pink lines, white lines) connect seamlessly to adjacent straight tiles
- R13. Each curve model's base rotation (`rotationY`) must be calibrated via the tile calibrator before integration

**Autodraw Behavior**
- R14. Remove automatic curve detection (`detectCurves`) — corners always start as 1x1
- R15. Straights and 1x1 corners continue to auto-place and auto-orient as they do now (no change)

## Success Criteria

- A player can draw a track, toggle corners to curves, and the road path is visually continuous at every tile boundary
- Driving the track in-game, the kart stays on the road through every curve

## Scope Boundaries

- No auto-detection of curves — user manually toggles
- No new tile types beyond the 4 curve models listed
- Curve calibration (rotationY values) handled separately via tile calibrator before this work
- No changes to how straights or 1x1 corners are placed

## Key Decisions

- Toggle order is fixed: 1x1 -> 2x2 wide -> 2x2 tight -> 3x3 -> 4x4
- Two distinct 2x2 models (wide and tight) both available in the toggle
- No memory of previous curve selection

## Outstanding Questions

### Resolve Before Planning
- [Affects R12-R13] The correct `rotationY` for each curve model needs to be determined via tile calibrator before implementation

### Deferred to Planning
- [Affects R4] UI design for the hover button — reuse existing radial menu or new overlay
- [Affects R11] How consumed straights are tracked when toggling back to 1x1 (restore visibility)

## Next Steps

-> Calibrate curve rotations in tile calibrator first, then `/ce:plan` for implementation
