---
title: "feat: Add Track Intelligence Layer"
type: feat
status: completed
date: 2026-03-30
origin: docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md
---

# feat: Add Track Intelligence Layer

## Overview

Add a new `TrackIntel.js` module that derives an ordered waypoint sequence from any valid cell array, providing track progress computation, position ranking, and spatial queries. This is the foundational layer that unblocks AI opponents, items, rubber-banding, and checkpoint respawning.

## Problem Frame

Every major gameplay feature needs to answer "where on the track is this kart?" Currently, TRACK_CELLS is an unordered flat array with no adjacency or sequencing. The finish line is the only spatial marker. (see origin: docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md)

## Requirements Trace

- R1. Auto-detect cell connectivity by walking the grid from the finish cell
- R2. Produce an ordered waypoint array (one per cell center) in racing-direction order, forming a closed loop
- R3. Work with any valid closed-loop track (hardcoded, editor, procedural)
- R4. Compute continuous 0.0–1.0 track progress for any world position
- R5. Combine lap count + progress into comparable race progress value
- R6. Nearest waypoint lookup (for respawning)
- R7. Waypoint position + forward direction by index (for AI)
- R8. Evenly distributed positions along the loop at requested count (for items)
- R9. Standalone `js/TrackIntel.js` module
- R10. Simple API consumable by RaceMode, future AI, future Items, Vehicle

## Scope Boundaries

- No spline interpolation or sub-cell waypoints — cell centers only
- No AI, items, or rubber-banding implementation
- No changes to Track.js rendering or Physics.js colliders
- No server-side intelligence — client-only
- No visual debug rendering required (acceptable if helpful)

## Context & Research

### Relevant Code and Patterns

- `js/Track.js` — `TRACK_CELLS`, `CELL_RAW`, `GRID_SCALE`, `ORIENT_DEG`, `computeSpawnPosition`, `encodeCells`/`decodeCells`
- `js/FinishLine.js` — Signed-distance plane crossing with dot-product direction check; proven spatial query pattern
- `js/RaceMode.js` — Race state machine, stores `_prevPos` each frame, `_lap` counter, `onLapComplete` callback
- `js/Minimap.js` — Example of a module that consumes cells + bounds + vehicle positions
- `js/GameMode.js` — Base class with `start/update/filterInput/getDisplayState/isFinished/getResults/reset`
- `js/main.js` — Module wiring in `init()`, per-frame `animate()` loop

### Grid-to-World Conversion

```
worldX = (gx + 0.5) * CELL_RAW * GRID_SCALE
worldZ = (gz + 0.5) * CELL_RAW * GRID_SCALE
```
Where `CELL_RAW = 9.99`, `GRID_SCALE = 0.75`, effective cell size = 7.4925 units.

### Piece Connectivity (Resolved from Research)

Each piece type + orientation maps to exactly two open edges from {N, S, E, W}:

**Straight / Finish** (road runs along one axis):
- Orient 0 (0°) / Orient 10 (180°): opens N (-Z) and S (+Z)
- Orient 16 (90°) / Orient 22 (270°): opens E (+X) and W (-X)

**Corner** (road curves between two adjacent edges):
- Orient 0 (0°): opens S (+Z) and W (-X)
- Orient 16 (90°): opens E (+X) and S (+Z)
- Orient 10 (180°): opens N (-Z) and E (+X)
- Orient 22 (270°): opens W (-X) and N (-Z)

*Verified by tracing all 6 corner cells in the default 16-cell track against their actual neighbors.*

**Bump**: open on all 4 sides (no walls, visual only). During the connectivity walk, filter open edges to only those with an existing track neighbor, then apply the same "skip previous" logic as other pieces. If more than one non-previous neighbor remains after filtering, throw an error (ambiguous track layout). This handles bump pieces in linear track sections without special-casing.

Edge directions map to grid neighbor offsets:
- N (-Z): `[gx, gz - 1]`
- S (+Z): `[gx, gz + 1]`
- E (+X): `[gx + 1, gz]`
- W (-X): `[gx - 1, gz]`

## Key Technical Decisions

- **Connectivity walk algorithm**: Build a lookup map of cells by `"gx,gz"` key. Start at the finish cell. For each cell, determine its two open edges from the connectivity table. Walk to the neighbor that isn't the cell we came from. Continue until we return to the finish cell. This produces the ordered waypoint loop. (Resolves origin deferred question about piece orientation connectivity)

- **Progress projection via windowed nearest segment**: For `getProgress(pos, lastSegmentHint?)`, project the world position onto waypoint-to-waypoint segments in the XZ plane. To avoid snapping to the wrong segment at concave track regions (e.g., the L-shaped inner corner where non-adjacent segments are ~5.3 units apart), accept an optional `lastSegmentHint` parameter and search only a window of +/- 3 segments around the hint first. Fall back to full scan only if no segment is within a reasonable distance threshold. Progress = (cumulative length to nearest segment + projection along it) / total loop length, clamped to [0, 1). The segment loop is closed: the last segment connects the final waypoint back to waypoint[0]. (Resolves origin deferred question about corner projection)

- **Wrap-around via lap + progress**: `getRaceProgress(lap, pos)` takes the lap count as a parameter (not tracked internally — FinishLine/RaceMode remain responsible for lap counting). Returns `lap + getProgress(pos)`. Comparing two vehicles: higher race progress = further ahead. The 0.99→0.01 wrap is handled naturally because lap increments at the finish line. TrackIntel is stateless per query. (Resolves origin deferred question about wrap-around)

- **Class-based module**: TrackIntel is instantiated once with cell data in `[gx, gz, pieceType, godotOrient]` tuple format (same format as TRACK_CELLS and decodeCells output). Caches the computed waypoint graph and cumulative distances. Per-frame queries are O(n) over ~16 segments — negligible. After the connectivity walk completes, asserts that the waypoint count equals the input cell count to catch disconnected tracks at init time.

- **Import constants from Track.js**: Reuse `CELL_RAW`, `GRID_SCALE`, `ORIENT_DEG` rather than redeclaring.

## Open Questions

### Resolved During Planning

- **Piece connectivity encoding**: Fully mapped above from wall collider geometry in Track.js. Each type+orient → two open edges.
- **Corner projection accuracy**: Cell-center-only granularity means corners are just line segments between adjacent cell centers. No special arc projection needed.
- **Finish line wrap-around**: `lap + progress` comparison handles this naturally.

### Deferred to Implementation

- **Invalid track detection**: What happens if the walk doesn't form a closed loop or doesn't cover all cells? Throw a clear error listing unreached cells. Future: the editor should validate before encoding.
- **TrackIntel and FinishLine coexistence**: TrackIntel provides continuous progress; FinishLine/RaceMode handle discrete lap counting. These are complementary, not competing. Confirm during integration (Unit 4) that no conflicts arise.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
TrackIntel class:
  constructor(cells):
    1. Build cell lookup: Map<"gx,gz", cell>
    2. Find finish cell (type === 'track-finish')
    3. Walk connectivity:
       - Start at finish cell
       - Determine open edges from CONNECTIVITY_TABLE[type][orient]
       - Pick the neighbor that isn't "previous"
       - Repeat until back at finish
    4. Convert ordered cells to world-space waypoints:
       - waypoints[i] = { x: (gx+0.5)*CELL_RAW*GRID_SCALE, z: (gz+0.5)*CELL_RAW*GRID_SCALE }
    5. Precompute cumulative distances and total loop length

  getProgress(worldPos):
    - Project pos onto each segment (XZ plane)
    - Find nearest segment
    - Return (cumDist[nearestSegment] + projectionAlongSegment) / totalLength

  getRaceProgress(lap, worldPos):
    - Return lap + getProgress(worldPos)

  getNearestWaypoint(worldPos):
    - Return index of waypoint with minimum XZ distance

  getWaypointInfo(index):
    - Return { position, forward } where forward = normalize(waypoints[next] - waypoints[index])

  getDistributedPositions(count):
    - Space evenly along total loop length
    - Interpolate between waypoints at each target distance
```

## Implementation Units

- [x] **Unit 1: Connectivity Table and Graph Walker**

  **Goal:** Build the core algorithm that takes a cell array and produces an ordered waypoint loop.

  **Requirements:** R1, R2, R3, R9

  **Dependencies:** None

  **Files:**
  - Create: `js/TrackIntel.js`

  **Approach:**
  - Define a `CONNECTIVITY` lookup: maps each piece type to its open edges at orientation 0, then rotate edges based on `ORIENT_DEG`
  - Build a `Map<"gx,gz", cell>` for O(1) neighbor lookup
  - Walk from finish cell, following open edges to connected neighbors, collecting ordered cells
  - Convert ordered cells to world-space waypoints using `(gx + 0.5) * CELL_RAW * GRID_SCALE`
  - Throw a descriptive error if the walk doesn't close back to the finish cell
  - After walk completes, assert waypoint count equals input cell count to catch disconnected tracks
  - Find finish cell by matching `cells[i][2] === 'track-finish'` (pieceType is the 3rd element of the `[gx, gz, type, orient]` tuple)

  **Patterns to follow:**
  - Import `CELL_RAW`, `GRID_SCALE`, `ORIENT_DEG` from `Track.js`
  - Export a class like `Minimap` or `RaceMode` — constructor takes cells, caches computed data

  **Test scenarios:**
  - Happy path: Default 16-cell TRACK_CELLS produces 16 ordered waypoints that form a closed loop (last connects back to first)
  - Happy path: Waypoint[0] is the finish cell's world-space center position
  - Happy path: Walking the waypoints in order traces the actual racing direction (verify by checking that waypoint sequence moves through known grid positions in the correct order)
  - Edge case: Track with only corners and finish (no straights) — still produces valid loop
  - Error path: Cell array with a gap (missing cell breaks connectivity) — throws descriptive error
  - Error path: Cell array with a disconnected spur (walk completes but doesn't cover all cells) — throws error listing unreached cells
  - Integration: Editor-decoded cells via `decodeCells()` produce valid waypoints identical to hardcoded cells

  **Verification:**
  - Instantiate TrackIntel with default TRACK_CELLS. Log the ordered waypoint positions. Visually confirm they trace the track in racing order via the existing debug panel or console.

- [x] **Unit 2: Track Progress Computation**

  **Goal:** Add `getProgress(worldPos)` and `getRaceProgress(lap, worldPos)` methods.

  **Requirements:** R4, R5

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/TrackIntel.js`

  **Approach:**
  - Precompute cumulative segment distances and total loop length in the constructor
  - `getProgress(pos, lastSegmentHint?)`: search a +/- 3 window around lastSegmentHint first (fall back to full scan). For each segment, compute perpendicular distance (XZ plane). Return `(cumDist + projAlongSegment) / totalLength`, clamped to [0, 1). Include the closing segment (last waypoint → first waypoint).
  - `getRaceProgress(lap, pos)`: takes lap count as parameter (caller-provided), returns `lap + getProgress(pos)`
  - Use dot product for segment projection (same math family as FinishLine.js signed-distance approach)

  **Patterns to follow:**
  - FinishLine.js signed-distance and dot-product approach for spatial projection

  **Test scenarios:**
  - Happy path: Vehicle at finish cell center returns progress ≈ 0.0
  - Happy path: Vehicle at the cell center halfway around the track returns progress ≈ 0.5
  - Happy path: Progress increases monotonically as a vehicle position moves forward through consecutive waypoint positions
  - Happy path: `getRaceProgress(2, pos)` returns value > `getRaceProgress(1, pos)` for any position
  - Edge case: Position exactly on a waypoint returns the correct cumulative progress for that waypoint
  - Edge case: Position equidistant between two segments returns a reasonable (non-jumping) value
  - Edge case: Position far off-track (e.g., off the side) still returns a valid progress value (projects to nearest segment)
  - Edge case: Position at concave inner corner (e.g., between cells (-3,-1) and (-2,0)) with lastSegmentHint returns consistent progress (no jump to wrong segment)
  - Edge case: Progress near the closing segment (last waypoint → waypoint[0]) wraps correctly to ~0.0

  **Verification:**
  - Drive a full lap. Log `getProgress()` each frame. Confirm values increase from ~0 to ~1 without jumps or reversals. Check that crossing the finish line resets to ~0.

- [x] **Unit 3: Spatial Query Methods**

  **Goal:** Add `getNearestWaypoint`, `getWaypointInfo`, and `getDistributedPositions` methods.

  **Requirements:** R6, R7, R8

  **Dependencies:** Unit 1 (waypoint array), Unit 2 (cumulative distances for `getDistributedPositions`)

  **Files:**
  - Modify: `js/TrackIntel.js`

  **Approach:**
  - `getNearestWaypoint(pos)`: iterate waypoints, return index with minimum XZ distance. O(n) is fine for ~16 waypoints.
  - `getWaypointInfo(index)`: return `{ position: {x, z}, forward: normalized(waypoints[next] - waypoints[index]) }`. Handle wrap-around (last → first).
  - `getDistributedPositions(count)`: compute target distances at `totalLength * i / count` for i in [0, count). Walk the segment list, interpolating between waypoints at each target distance. Return array of `{x, z, forward}`.

  **Patterns to follow:**
  - Pure data methods with no side effects, like `computeSpawnPosition` and `computeTrackBounds` in Track.js

  **Test scenarios:**
  - Happy path: `getNearestWaypoint` for a position at waypoint[5]'s center returns index 5
  - Happy path: `getWaypointInfo(0)` returns the finish cell position and a forward direction pointing toward waypoint[1]
  - Happy path: `getWaypointInfo(lastIndex)` wraps correctly — forward points toward waypoint[0]
  - Happy path: `getDistributedPositions(4)` returns 4 positions roughly equally spaced around the track
  - Edge case: `getDistributedPositions(1)` returns one position at the start
  - Edge case: `getNearestWaypoint` for a position far off-track returns the closest waypoint by XZ distance

  **Verification:**
  - Call `getDistributedPositions(8)` and log positions. Verify they are evenly spaced by checking distances between consecutive positions are roughly equal.

- [x] **Unit 4: Integration with main.js and RaceMode**

  **Goal:** Wire TrackIntel into the game so position ranking is available in the HUD.

  **Requirements:** R10, R5

  **Dependencies:** Units 1-3

  **Files:**
  - Modify: `js/main.js`
  - Modify: `js/RaceMode.js`

  **Approach:**
  - In `main.js init()`: instantiate `TrackIntel` with the active cells (same cells passed to `buildTrack`). Pass the instance to `RaceMode`.
  - In `RaceMode`: store the TrackIntel reference. In `getDisplayState()`, compute race progress for each active vehicle and determine position ranking. Add `position` (1st/2nd/3rd) to the display state.
  - HUD can optionally display position — but HUD changes are outside this plan's scope. The data just needs to be available in `getDisplayState()`.

  **Patterns to follow:**
  - How `Minimap` is instantiated in `main.js` with cells and bounds, then updated per-frame
  - How `RaceMode` receives config via constructor and exposes data via `getDisplayState()`

  **Test scenarios:**
  - Happy path: TrackIntel is created without errors for both default and custom tracks
  - Happy path: `getDisplayState()` includes a `position` field that correctly ranks the local player among all active vehicles
  - Integration: In a 2-player multiplayer session, position ranking updates correctly as vehicles change relative track positions
  - Edge case: Single-player mode — position is always 1

  **Verification:**
  - Start a race. Open the debug panel or console. Confirm `getDisplayState().position` shows correct values. In multiplayer with 2+ players, confirm positions swap as vehicles overtake each other.

## System-Wide Impact

- **Interaction graph:** TrackIntel is consumed by RaceMode (position ranking). Future consumers: AI module (pathfinding), Items module (placement), Vehicle (respawn). No existing callbacks or middleware are affected.
- **Error propagation:** If TrackIntel construction fails (invalid track), it should throw during `init()` — same pattern as other initialization failures in main.js.
- **State lifecycle risks:** TrackIntel is built once at track load and is immutable thereafter. No mutation, no cache invalidation concerns.
- **API surface parity:** The same TrackIntel instance should be used by all consumers. Pass it as a dependency rather than creating multiple instances.
- **Unchanged invariants:** Track.js rendering, Physics.js colliders, FinishLine detection, and the editor codec are not modified.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Connectivity walk fails on some editor tracks (gaps, dead ends) | Throw descriptive error at construction time. Assert waypoint count == cell count to catch partial walks. |
| Bump pieces have 4 open edges | Filter to existing neighbors, skip previous. If >1 candidate remains, throw error (ambiguous layout). |
| Progress snaps to wrong segment at concave regions | Windowed search (+/- 3 segments around lastSegmentHint) prevents topological jumps. Full scan as fallback. |
| No test infrastructure exists in the project | Define clear manual verification steps. Test scenarios are documented for future test setup. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md](docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md)
- Related code: `js/Track.js` (TRACK_CELLS, ORIENT_DEG, coordinate math), `js/FinishLine.js` (spatial projection pattern), `js/RaceMode.js` (race state, lap tracking), `js/Minimap.js` (cell consumer pattern)
