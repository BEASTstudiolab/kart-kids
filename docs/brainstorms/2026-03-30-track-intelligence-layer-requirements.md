---
date: 2026-03-30
topic: track-intelligence-layer
---

# Track Intelligence Layer

## Problem Frame

Every major gameplay feature on the roadmap — AI opponents, position ranking, item placement, checkpoint respawning, rubber-banding — needs to answer "where on the track is this kart?" Currently, TRACK_CELLS is an unordered flat array of `[gridX, gridZ, pieceType, orientation]` with no adjacency, sequencing, or spatial query support. The finish line is the only spatial marker in the game. A new `TrackIntel.js` module will derive an ordered waypoint sequence from any valid cell array, providing a shared foundation for all track-aware systems.

## Requirements

**Waypoint Graph Construction**
- R1. Auto-detect cell connectivity by walking the grid starting from the finish cell, following piece orientations to determine the next connected cell
- R2. Produce an ordered array of waypoints, one per cell center, in racing-direction order forming a closed loop
- R3. Work with any valid closed-loop track — hardcoded TRACK_CELLS, editor-created tracks (?map= param), and future procedural tracks

**Track Progress**
- R4. Compute a continuous 0.0–1.0 "track progress" value for any world-space position by projecting onto the nearest segment of the waypoint loop
- R5. Combine lap count and track progress into a single comparable "race progress" value (e.g., `lap + progress`) for position ranking across multiple vehicles

**Spatial Queries**
- R6. Given a world position, return the nearest waypoint (for checkpoint respawning)
- R7. Given a waypoint index, return the world-space position and forward direction (for AI pathfinding)
- R8. Return evenly distributed positions along the waypoint loop at a requested count (for item box placement)

**Integration**
- R9. New standalone `js/TrackIntel.js` module — takes cell data as input, produces the waypoint graph. Track.js handles geometry; TrackIntel.js handles spatial reasoning.
- R10. Expose a simple API consumable by RaceMode (position ranking), future AI module (pathfinding), future Items module (placement), and Vehicle (respawn)

## Success Criteria

- Given the default 16-cell track, the auto-detected waypoint order matches the actual racing direction
- `getProgress(position)` returns monotonically increasing values as a vehicle drives forward around the track
- Position ranking using race progress correctly identifies which of N vehicles is "ahead" at any point mid-lap
- Works correctly for editor-created custom tracks loaded via ?map= parameter
- No measurable frame time impact (waypoint graph is built once at track load, per-frame queries are O(n) over ~16 waypoints)

## Scope Boundaries

- No spline interpolation or sub-cell waypoints — cell centers only
- No AI opponent implementation (that's a separate feature consuming this API)
- No item system implementation (same — separate consumer)
- No changes to Track.js rendering or Physics.js colliders
- No server-side track intelligence — client-only
- No visual debug rendering required (but acceptable if helpful during development)

## Key Decisions

- **Cell centers only**: One waypoint per cell. Simple, directly derivable from TRACK_CELLS, sufficient for all planned consumers. Can be densified later if AI needs smoother paths.
- **Auto-detect ordering**: Algorithm walks connectivity from the finish cell rather than requiring cells to be stored in order. This means the editor and procedural generation only need to output valid cells, not ordered cells.
- **Separate module**: TrackIntel.js keeps spatial reasoning decoupled from track rendering. Clean input/output boundary.

## Dependencies / Assumptions

- Assumes all tracks form a single closed loop (no branches, no dead ends)
- Depends on piece orientation conventions already defined in Track.js (ORIENT_DEG mapping)
- The finish cell (`track-finish`) is the origin of the waypoint walk

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Needs research] How exactly do piece orientations encode connectivity? Need to map which edges of each piece type (straight, corner, bump, finish) are "open" for each orientation value.
- [Affects R4][Technical] What projection method works best for corners? Nearest-segment projection on a polygon loop may assign incorrect progress near tight corners where two segments are close.
- [Affects R5][Technical] How should progress handle the wrap-around at the finish line (0.99 → 0.01 transition) for position comparison?

## Next Steps

→ `/ce:plan` for structured implementation planning
