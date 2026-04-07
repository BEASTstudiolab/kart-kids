---
title: "feat: Ghost replay system for time trials"
type: feat
status: active
date: 2026-04-07
origin: docs/brainstorms/2026-04-07-ghost-replay-requirements.md
---

# feat: Ghost replay system for time trials

## Overview

Add a ghost replay system that records the player's best lap and replays it as a translucent vehicle during subsequent laps. The ghost provides a visible competitive reference for time trials.

## Problem Frame

Time trials lack a competitive reference point. Players complete laps with no way to compare against their previous best run. A ghost vehicle replaying the best lap makes improvement visible and time trials meaningful. (see origin: docs/brainstorms/2026-04-07-ghost-replay-requirements.md)

## Requirements Trace

- R1. Record per-frame vehicle state during each completed lap
- R2. Store recordings as compact typed arrays to minimize memory
- R3. Only retain the best (fastest) lap recording per track; discard slower runs
- R4. Replay ghost as a visual vehicle following recorded positions each frame
- R5. Render ghost as translucent (opacity ~0.3), no shadow, no collision
- R6. Ghost uses same model as player's vehicle with transparency
- R7. Ghost loops its recording continuously while player races
- R8. Persist best-lap recordings in localStorage keyed by track identifier
- R9. Cap stored replay size — discard if exceeds 500KB
- R10. Toggle ghost visibility in pause menu or pre-race settings
- R11. Show ghost lap time as a reference HUD element

## Scope Boundaries

- Single-player time trial mode only — no multiplayer ghost sharing
- No server-side storage — localStorage only
- No ghost for AI opponents
- No replay scrubbing or playback controls

## Context & Research

### Relevant Code and Patterns

- `js/RaceMode.js` — `onLapComplete(lap, lapTime)` callback is the lap completion hook (line 320)
- `js/RaceMode.js` — `_elapsedTime`, `_lapStartTime`, `_bestLap` track timing
- `js/main.js:738-758` — Game loop: `controls.update()` → `raceMode.filterInput()` → `vehicle.update(dt, input)`
- `js/Vehicle.js:529` — `update(dt, controlsInput)` consumes `{ x, z, boost, drift, gas, brake }`
- `js/Vehicle.js:1461` — `Vehicle.spawn()` factory creates vehicle with physics body
- `js/PlayerManager.js:282-318` — `_createVehicle()` shows model cloning + tint pattern
- `js/ModelLoader.js:139-175` — Vehicle color variant derivation via clone + tint
- `js/HUD.js` — Existing HUD system for lap time display
- `js/Settings.js` — localStorage persistence pattern for user preferences

### Institutional Learnings

- No existing docs/solutions/ for replay or ghost systems

## Key Technical Decisions

- **Position/rotation recording over input recording**: The origin doc proposed input recording, but position recording is strictly better for this use case. Recording `(x, y, z, rotationY)` per frame = 16 bytes/frame. At 60fps for a 60-second lap = 57.6KB — well within the 500KB cap. Advantages: (1) perfect visual replay with zero drift, (2) no second physics instance or Vehicle needed, (3) ghost is just a mesh following recorded positions. Input recording would require a parallel physics simulation and still produce drift due to floating-point non-determinism.
- **Ghost as a plain mesh, not a Vehicle instance**: Since we record positions, the ghost doesn't need physics, raycasting, or vehicle state. It's a cloned model group with transparent materials positioned each frame via interpolation.
- **Track identifier via TrackCodec hash**: Use the track cell data as the localStorage key so the same track layout always finds its ghost, regardless of save name.

## Open Questions

### Resolved During Planning

- **Vehicle.js modifications needed?** No — ghost doesn't use Vehicle. It's a standalone mesh positioned from recorded data.
- **Typed array layout?** Single interleaved Float32Array: `[x0, y0, z0, rotY0, x1, y1, z1, rotY1, ...]`. 4 floats per frame, simple indexed access.
- **Ghost material approach?** Clone the player's vehicle model, traverse meshes, clone each material, set `transparent: true`, `opacity: 0.3`, `depthWrite: false`. Same pattern used in `PlayerManager._createVehicle` for tinting (line 307-317).

### Deferred to Implementation

- Exact interpolation behavior when ghost recording framerate differs from current framerate
- Whether ghost should fade in/out at lap boundaries or teleport to start

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
GhostReplay.js (new module)
  ├── GhostRecorder — captures vehicle position/rotation each frame
  │     record(vehicle) → pushes [x, y, z, rotY] to buffer
  │     finishLap(lapTime) → if best, serialize to Float32Array + store
  │     reset() → clear buffer for new lap
  │
  ├── GhostPlayer — replays a recording as a translucent mesh
  │     load(trackId) → reads Float32Array from localStorage
  │     update(elapsed) → interpolates position, sets mesh transform
  │     setVisible(bool) → show/hide ghost
  │
  └── GhostStorage — localStorage persistence
        save(trackId, recording, lapTime)
        load(trackId) → { frames: Float32Array, lapTime, frameCount }
        getTrackId(cells) → hash of cell data
```

Game loop integration:
```
animate():
  after vehicle.update() → ghostRecorder.record(vehicle)
  after raceMode.update() → ghostPlayer.update(raceMode.lapElapsed)

onLapComplete(lap, time):
  ghostRecorder.finishLap(time) → saves if best
  ghostPlayer.restart() → begins replaying from frame 0
```

## Implementation Units

- [ ] **Unit 1: GhostStorage — localStorage persistence layer**

**Goal:** Create the storage module that saves/loads ghost recordings to localStorage with size-cap enforcement.

**Requirements:** R8, R9

**Dependencies:** None

**Files:**
- Create: `js/GhostStorage.js`
- Test: manual browser console verification

**Approach:**
- Export functions: `save(trackId, data)`, `load(trackId)`, `getTrackId(cells)`
- Storage format: JSON wrapper `{ lapTime, frameCount, dt, frames: base64(Float32Array) }` keyed as `ghost:<trackId>`
- `getTrackId` hashes the cells array (use simple FNV-1a or djb2 hash of JSON-serialized cells)
- `save` checks encoded size against 500KB cap before writing; discards silently if exceeded
- `load` returns null if no ghost exists or data is corrupt

**Patterns to follow:**
- `js/Settings.js` localStorage read/write pattern

**Test scenarios:**
- Happy path: save a recording, load it back, verify frameCount and lapTime match
- Edge case: save a recording exceeding 500KB, verify it is silently discarded
- Edge case: load from empty localStorage, verify null return
- Error path: corrupt localStorage entry, verify graceful null return

**Verification:**
- Can round-trip a Float32Array through save/load with no data loss

- [ ] **Unit 2: GhostRecorder — per-frame state capture**

**Goal:** Record vehicle position and rotation each frame during a lap, finalize to typed array on lap completion.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1

**Files:**
- Create: `js/GhostRecorder.js`

**Approach:**
- `record(vehicle)` pushes `vehicle.vehPos.x`, `vehicle.vehPos.y`, `vehicle.vehPos.z`, `vehicle.container.rotation.y` to a growing JS array buffer
- `finishLap(lapTime, trackId)` converts buffer to Float32Array, compares against stored best via `GhostStorage.load()`, saves if faster
- `reset()` clears the buffer for the next lap
- Buffer is a plain JS array during recording (push is fast); converted to Float32Array only on finalization

**Patterns to follow:**
- `js/RaceMode.js` lap timing pattern (lines 310-320)

**Test scenarios:**
- Happy path: record 100 frames, finishLap, verify Float32Array has 400 elements (100 × 4)
- Happy path: record two laps, second faster — verify second replaces first in storage
- Edge case: record two laps, second slower — verify first is retained
- Edge case: reset mid-lap — verify buffer is cleared

**Verification:**
- Recording a lap produces a correctly-sized Float32Array with valid position data

- [ ] **Unit 3: GhostPlayer — translucent mesh playback**

**Goal:** Load a ghost recording and replay it as a translucent vehicle mesh each frame.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Unit 1

**Files:**
- Create: `js/GhostPlayer.js`

**Approach:**
- Constructor takes a vehicle model (THREE.Group) and clones it
- Traverse cloned model, clone each mesh's material, set `transparent: true`, `opacity: 0.3`, `depthWrite: false`, `castShadow: false`
- `load(trackId)` reads recording from GhostStorage. Returns true/false for success
- `update(lapElapsed, totalLapTime)` computes frame index from elapsed/totalLapTime ratio, interpolates between adjacent frames, sets mesh position and rotation
- `restart()` resets elapsed playback to frame 0
- `setVisible(bool)` shows/hides the ghost mesh group
- `dispose()` removes from scene, disposes cloned materials

**Patterns to follow:**
- `js/PlayerManager.js:307-317` material clone + tint pattern
- `js/ItemBoxManager.js` dispose pattern (material + geometry cleanup)

**Test scenarios:**
- Happy path: load a recording, update at t=0 → ghost at first recorded position
- Happy path: update at t=lapTime/2 → ghost at midpoint position (interpolated)
- Happy path: update past t=lapTime → ghost wraps to start (R7 looping)
- Edge case: load with no stored recording → ghost hidden, update is no-op
- Edge case: setVisible(false) → ghost mesh not rendered

**Verification:**
- Ghost mesh follows recorded positions smoothly across a full loop

- [ ] **Unit 4: main.js integration — recording, playback, and lifecycle**

**Goal:** Wire GhostRecorder and GhostPlayer into the game loop and lap completion callback.

**Requirements:** R1, R4, R7, R11

**Dependencies:** Units 1-3

**Files:**
- Modify: `js/main.js`

**Approach:**
- Import GhostRecorder, GhostPlayer, GhostStorage
- After Vehicle.spawn: create GhostPlayer with cloned vehicle model, add to scene
- After track load: call `ghostPlayer.load(trackId)` to load existing best ghost
- In animate loop after `vehicle.update()`: call `ghostRecorder.record(vehicle)`
- In animate loop after `raceMode.update()`: call `ghostPlayer.update(raceMode.lapElapsed, ghostLapTime)`
- In `raceMode.onLapComplete`: call `ghostRecorder.finishLap(time, trackId)`, then `ghostPlayer.load(trackId)` to refresh if new best, then `ghostPlayer.restart()`
- Compute `trackId` once using `GhostStorage.getTrackId(cells)` at track load time
- Add ghost lap time to HUD display (R11) — small text element showing "Ghost: XX.XXs"

**Patterns to follow:**
- Existing `raceMode.onLapComplete` callback wiring (main.js:438-443)
- `aiManager.update()` / `draftLines.update()` pattern for game loop additions

**Test scenarios:**
- Integration: complete a lap → ghost appears on next lap replaying the recorded path
- Integration: complete a faster lap → ghost updates to faster recording
- Integration: reload page → ghost loads from localStorage and appears
- Happy path: ghost lap time appears in HUD

**Verification:**
- Full gameplay loop works: race a lap, see ghost on next lap, beat it, ghost updates

- [ ] **Unit 5: Ghost visibility toggle in settings**

**Goal:** Allow player to enable/disable ghost via settings.

**Requirements:** R10

**Dependencies:** Unit 4

**Files:**
- Modify: `js/Settings.js`
- Modify: `js/main.js` (read setting, wire to ghostPlayer.setVisible)

**Approach:**
- Add `ghostEnabled` boolean to Settings.js (default: true)
- Read setting at game start, pass to ghostPlayer.setVisible()
- If settings menu exists in pause screen, add toggle there; otherwise just persist via Settings.js

**Patterns to follow:**
- Existing boolean settings in `js/Settings.js`

**Test scenarios:**
- Happy path: toggle ghost off → ghost mesh hidden
- Happy path: toggle ghost on → ghost mesh visible (if recording exists)
- Happy path: setting persists across page reload

**Verification:**
- Ghost visibility responds to settings toggle and persists

## System-Wide Impact

- **Interaction graph:** GhostRecorder hooks into the game loop (after vehicle update) and lap completion callback. GhostPlayer hooks into the game loop (after raceMode update). No interaction with physics, AI, networking, or other game systems.
- **Error propagation:** localStorage failures (quota exceeded, corrupt data) should fail silently — ghost is a nice-to-have, not gameplay-critical. GhostStorage functions return null on failure.
- **State lifecycle risks:** Ghost recording buffer grows during a lap but is bounded by lap duration. At 60fps × 16 bytes/frame, a 5-minute lap = 288KB — well within the 500KB cap.
- **API surface parity:** No multiplayer API impact. Ghost is local-only.
- **Unchanged invariants:** Vehicle physics, RaceMode timing, network protocol, AI behavior — none of these change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| localStorage quota full | 500KB cap per recording, silent discard on save failure |
| Frame interpolation jitter | Linear interpolation between recorded frames; variable dt already handled by ratio-based playback |
| Model clone memory | One ghost = one cloned model. Dispose on scene teardown via existing cleanup pattern |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-07-ghost-replay-requirements.md](docs/brainstorms/2026-04-07-ghost-replay-requirements.md)
- Related code: `js/RaceMode.js` (lap detection), `js/main.js` (game loop), `js/Vehicle.js` (state to record)
- Related code: `js/PlayerManager.js:307-317` (model clone + material tint pattern)
