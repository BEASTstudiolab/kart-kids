---
date: 2026-04-04
topic: track-editor-v2
---

# Track Editor v2 — Smart Curves, Elevation & Rotation

## Problem Frame

The track editor draws on a 1x1 grid with auto-resolved straights and corners, but all turns are hard 1x1 corners and all tiles are flat. Meanwhile, `models/standard-map/` has 47+ tile GLBs including 2x2, 3x3, and 4x4 curved turns, ramps at two height levels, bridges, tunnels, and jumps. None of these can be placed through the editor today. Tracks feel blocky and flat compared to what the tile set supports.

## Requirements

**Smart Corner Auto-Detection**

- R1. When a turn is detected in the grid, the editor scans straight runs on both sides of the turn. The shorter side determines the curve size: 1 straight = 1x1 hard corner, 2 straights = 2x2 wide turn, 3 = 3x3, 4 = 4x4.
- R2. The curved piece replaces the visual rendering of the affected cells but the underlying grid stays 1x1. The grid is the authoring surface; the 3D view is the smart output.
- R3. Users can click a detected curve and toggle it back to a hard 1x1 corner (override). This preference persists in save/load.
- R4. Corner detection re-evaluates when adjacent tiles change (add, remove, or rotate).

**Manual Tile Rotation**

- R5. Press `R` to rotate the hovered/selected tile 90° clockwise. The tile's `orient` value cycles through 0° → 90° → 180° → 270°.
- R6. Rotating a tile overrides auto-resolve for that tile. The override persists until the tile is removed or the user triggers a re-resolve.
- R7. A visual rotation indicator shows current orientation on hover (e.g., a directional arrow or highlight on the tile's exit edges).

**Elevation & Auto-Ramps**

- R8. Elevation applies to straight tiles only. Corners, junctions, and multi-tile curves cannot be elevated.
- R9. Click a straight tile to cycle elevation: ground (0m) → 2.5m → 5m → ground.
- R10. When a tile is elevated, the editor auto-inserts ramp transition tiles on each side connecting the elevated tile to its neighbors' height. Uses existing GLBs: `rmp_up`, `rmp_down`, `rmp_transition_flat_to_up`, `rmp_transition_up_to_flat`, etc.
- R11. If there is no room for a ramp (neighbor is a corner, edge of track, or another elevated tile at a different height), the elevation is rejected and the user sees a toast explaining why.
- R12. Ramp tiles are auto-managed — users don't place or remove them directly. Removing or de-elevating the source tile removes its ramps.

## Success Criteria

- A user can draw a track with sweeping curves (2x2 through 4x4) without manually placing multi-tile pieces
- Tracks have elevation changes with correct ramp transitions, all from clicking existing straight tiles
- Manual rotation gives full control when auto-resolve picks wrong
- All editor tracks save/load correctly including curve overrides and elevation state
- Exported tracks play correctly in `index.html` with physics colliders matching the visual geometry

## Scope Boundaries

- No free-height elevation — fixed 2.5m and 5m only
- No elevation on corners or multi-tile pieces
- No new GLB models — only use what exists in `models/standard-map/`
- No procedural geometry — curves and ramps use existing model files
- Editor stays 2D grid-based for authoring; 3D view is display only
- Bridges, tunnels, jumps, and junctions are out of scope for this pass (future editor features)

## Key Decisions

- **Shorter side wins for curve sizing**: If 3 straights lead into a turn and 5 lead out, use the 3x3 curve. Predictable and avoids asymmetric edge cases.
- **Grid stays 1x1**: Multi-tile pieces are a rendering concern. The authoring grid does not change cell size. This keeps the draw/erase UX simple.
- **Ramps are auto-managed**: Users set elevation on a tile; the system handles transitions. No manual ramp placement.
- **Override model**: Curve toggles and manual rotations are per-tile overrides on top of auto-resolve. They persist in save data.

## Dependencies / Assumptions

- All referenced GLB models exist and load correctly in the current pipeline (confirmed: 47+ models in `models/standard-map/`)
- `TrackModelConfig.js` already maps tile types to model files — will need extending for curve variants and ramp pieces
- Physics colliders in the game (`Physics.js`) must support the geometry of multi-tile curve pieces and ramps

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] How should multi-tile curve pieces anchor in the 3D scene? One mesh centered on the corner cell, or does each grid cell in the curve area get a slice?
- [Affects R10][Needs research] Do all ramp transition GLBs exist for both 2.5m and 5m? Verify the full ramp chain: flat → transition_flat_to_up → rmp_up → transition_up_to_flat → flat.
- [Affects R2][Technical] How does `TrackIntel.js` handle multi-tile curve pieces for AI pathfinding and lap tracking? May need segment data updates.
- [Affects R5][Technical] Should `resolveCell()` skip cells with a manual rotation override, or should it propose and let the override take precedence?

## Next Steps

→ `/ce:plan` for structured implementation planning
