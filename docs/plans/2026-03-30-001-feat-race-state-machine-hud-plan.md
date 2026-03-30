---
title: "feat: Add race state machine, finish line detection, HUD, and multiplayer race sync"
type: feat
status: completed
date: 2026-03-30
origin: docs/brainstorms/2026-03-30-race-state-machine-hud-requirements.md
---

# feat: Add Race State Machine + HUD

## Overview

Add a complete race loop to Kart Kids: countdown, 3-lap race with finish line detection, minimal HUD, results screen, and synchronized multiplayer starts. Built on a game mode contract so future modes (time trial, battle) plug in without modifying the core loop.

## Problem Frame

Kart Kids is a driving sandbox with no win condition. The `track-finish` cell exists in `Track.js` but is never checked at runtime. Without lap tracking, every downstream feature (ghosts, AI, leaderboards) is blocked. (see origin: docs/brainstorms/2026-03-30-race-state-machine-hud-requirements.md)

## Requirements Trace

- R1. Game mode contract (start, update, isFinished, getResults)
- R2. Mode selectable via `?mode=race`, defaults to `race`
- R3. Lifecycle: IDLE → COUNTDOWN → RACING → FINISHED
- R4. 3-2-1-GO countdown with controls locked
- R5. Countdown audio cues
- R6. 3-lap race, lap count is a RaceMode property
- R7. Finish trigger zone derived from track-finish cell
- R8. Correct-direction crossing detection
- R9. Track current lap and best lap time per player
- R10. DOM overlay: lap counter + elapsed time
- R11. HUD visible during RACING/FINISHED, hidden during IDLE
- R12. HUD reads existing properties each frame
- R13. Results overlay: total time + best lap
- R14. Any key/tap to restart
- R15. Synchronized multiplayer countdown
- R16. Server broadcasts race events and lap completions
- R17. Client detects own crossings, reports to server

## Scope Boundaries

- No race position tracking (1st/2nd/3rd)
- No speedometer
- No persistent storage (localStorage)
- No anti-cheat or server-side lap validation
- No new audio asset files — procedural Web Audio beeps only

## Context & Research

### Relevant Code and Patterns

- **Game loop:** `main.js:animate()` — monolithic loop. Integration point is between `updateWorld()` and `playerManager.update()`. Controls locking pattern exists: pass `{x:0, z:0}` for spectating (line 840).
- **Finish cell:** `Track.js:computeSpawnPosition(cells)` finds `track-finish` cell, returns `{position: [x,y,z], angle}` in world space. Cell at `[0,0]` in default track.
- **Vehicle position:** `vehicle.spherePos` (THREE.Vector3), updated from physics each frame. `vehicle.modelVelocity` (THREE.Vector3) is per-frame position delta.
- **Network protocol:** JSON messages with `type` field. Client sends `state`, `spectate`. Server sends `welcome`, `playerJoin`, `playerLeave`, `world`, `playerSpectate`. Extend by adding new types to both `Network.js` switch and `server.js` handler.
- **HUD pattern:** DOM elements created programmatically in `main.js` with `style.cssText`, appended to `document.body`.
- **Audio:** `GameAudio` class with `listener` property (public). No generic `playSound()` — only engine/skid loops + impact one-shot pool. `new THREE.Audio(audio.listener)` works for custom sounds.
- **Module layout:** Flat `js/` directory, one class per file, no subdirectories.

### Institutional Learnings

No `docs/solutions/` or `tasks/lessons.md` exist yet.

## Key Technical Decisions

- **Finish line detection via line-segment crossing:** Each frame, check if the vehicle's previous→current position segment crosses the finish line plane. This is reliable, cheap, and handles high-speed crossings better than AABB volume tests. The finish plane normal and position are derived from the track-finish cell's orientation and grid coordinates.

- **Direction detection via dot product:** Compute the dot product of the vehicle's movement vector with the finish line normal. Positive dot = correct direction, count the lap. Negative = wrong direction, ignore. This prevents backward-crossing exploits.

- **Cooldown after crossing:** After a valid crossing, ignore crossings for ~2 seconds to prevent double-counting from vehicles lingering near the line.

- **Multiplayer countdown via server tick messages:** The server broadcasts `{type: 'raceCountdown', count: 3}`, `{count: 2}`, `{count: 1}`, `{count: 0}` at 1-second intervals. All clients react to the same messages. Simpler and more reliable than timestamp-offset sync (avoids clock drift issues between server and clients).

- **Flat module structure:** `js/GameMode.js` and `js/RaceMode.js` in the existing flat layout. Matches codebase convention — no subdirectories.

- **Procedural countdown beeps:** Use Web Audio `OscillatorNode` for countdown sounds — 440Hz beep for 3-2-1, 880Hz for GO. No audio files needed. Create via `new THREE.Audio(audio.listener)` or raw Web Audio API.

## Open Questions

### Resolved During Planning

- **Trigger zone shape (R7):** Line-segment crossing test against a plane, not AABB. The plane is defined by the finish cell's world position and orientation-derived normal.
- **Direction detection (R8):** Dot product of movement vector against finish plane normal.
- **WebSocket format (R15):** Server broadcasts individual `raceCountdown` tick messages at 1Hz, plus `raceStart` when countdown hits 0. No timestamp offset needed.
- **Module structure (R1):** Flat — `js/GameMode.js` + `js/RaceMode.js`. No subdirectories.

### Deferred to Implementation

- **Exact cooldown duration after crossing:** Start with 2 seconds, tune during testing.
- **Countdown overlay styling:** Exact font size, position, animation. Implement and adjust visually.
- **Fall-off reset position:** Vehicle.js line 334 hardcodes `[3.5, 0.5, 5]`. Should use spawn position from race mode. Fix opportunistically if touched.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
State Machine Flow:

  IDLE ──(all players connected / single-player)──> COUNTDOWN
    │                                                    │
    │  [controls locked, HUD hidden]          [3-2-1-GO beeps]
    │                                          [controls locked]
    │                                                    │
    │                                               RACING
    │                                                    │
    │                                    [controls active, HUD visible]
    │                                    [check finish crossing each frame]
    │                                    [track laps, best lap time]
    │                                                    │
    │                                    (lap == totalLaps)
    │                                                    │
    │                                              FINISHED
    │                                                    │
    │                                    [results overlay, controls locked]
    │                                                    │
    │  <──────────(any key / tap)─────────────────────────┘
```

```
Finish Line Detection (per frame):

  prevPos ────── finish plane ────── currPos
                     │
         dot(movement, planeNormal) > 0 ?
              YES → lap++, start cooldown
              NO  → ignore (backward crossing)
```

```
Integration in main.js animate():

  dt = timer.getDelta()
  input = controls.update()
  updateWorld(world, dt)

  // NEW: game mode intercepts input
  effectiveInput = gameMode.filterInput(input)

  playerManager.update(dt, effectiveInput)
  gameMode.update(dt, playerManager.localVehicle)
  hud.update(gameMode.getDisplayState())

  network.sendState(...)
  audio.update(...)
  renderer.render(...)
```

## Implementation Units

- [x] **Unit 1: Game Mode Contract + RaceMode Skeleton**

  **Goal:** Create the game mode interface and a RaceMode class with the state machine (IDLE→COUNTDOWN→RACING→FINISHED) but no finish line detection yet.

  **Requirements:** R1, R2, R3, R4, R6

  **Dependencies:** None

  **Files:**
  - Create: `js/GameMode.js`
  - Create: `js/RaceMode.js`
  - Modify: `js/main.js`

  **Approach:**
  - `GameMode.js` exports a base/interface with methods: `start()`, `update(dt, vehicle)`, `filterInput(input)`, `getDisplayState()`, `isFinished()`, `getResults()`, `reset()`
  - `RaceMode.js` implements the state machine. Constructor takes `{totalLaps, spawnPosition, spawnAngle}`. States stored as string constant.
  - `filterInput()` returns `{x:0, z:0}` during COUNTDOWN and FINISHED (matching existing spectate pattern), passes through during RACING
  - In `main.js`, read `?mode=` URL param. Instantiate `RaceMode`. Call `gameMode.start()` after init. In `animate()`, use `gameMode.filterInput(input)` before passing to `playerManager.update()`, then call `gameMode.update(dt, vehicle)`
  - Countdown: track elapsed time in COUNTDOWN state, transition through 3→2→1→0 at 1-second intervals, transition to RACING at 0

  **Patterns to follow:**
  - URL param reading: `new URLSearchParams(window.location.search).get('mode')` (same as `map` param pattern)
  - Controls locking: `spectating ? {x:0, z:0} : input` pattern in main.js line 840

  **Test scenarios:**
  - Happy path: RaceMode starts in IDLE, calling start() transitions to COUNTDOWN
  - Happy path: COUNTDOWN progresses 3→2→1→GO over 3 seconds of update(dt) calls, then transitions to RACING
  - Happy path: filterInput returns zero-input during COUNTDOWN and FINISHED, real input during RACING
  - Edge case: Multiple start() calls don't break state machine
  - Edge case: getDisplayState() returns correct state string and countdown number at each phase

  **Verification:**
  - Game loads, vehicle is frozen, countdown plays through, then vehicle becomes controllable

- [x] **Unit 2: Finish Line Detection**

  **Goal:** Detect when the local vehicle crosses the finish line in the correct direction and increment the lap counter.

  **Requirements:** R7, R8, R9

  **Dependencies:** Unit 1

  **Files:**
  - Create: `js/FinishLine.js`
  - Modify: `js/RaceMode.js`

  **Approach:**
  - `FinishLine.js` class. Constructor takes `{position, angle}` from `computeSpawnPosition()`. Computes a plane normal from the angle (the "forward" direction of the finish cell).
  - `check(prevPos, currPos)` method: tests if the segment prevPos→currPos crosses the plane, and if the dot product of movement with the normal is positive (correct direction). Returns `{crossed: bool, direction: 'forward'|'backward'}`
  - `RaceMode.update()` stores previous vehicle position each frame. Calls `finishLine.check()`. On valid crossing: increment lap, record lap time, check if race complete.
  - 2-second cooldown after valid crossing (timestamp comparison, not frame counting)
  - On final lap crossing: transition to FINISHED, record total time

  **Patterns to follow:**
  - `computeSpawnPosition()` in Track.js for deriving world position + angle from track-finish cell
  - THREE.Vector3 math for plane intersection

  **Test scenarios:**
  - Happy path: Vehicle crossing finish line in forward direction increments lap counter
  - Happy path: Completing 3 laps transitions RaceMode to FINISHED with correct total time
  - Happy path: Best lap time tracked correctly across 3 laps
  - Edge case: Backward crossing does not count as a lap
  - Edge case: Crossing during cooldown period is ignored
  - Edge case: Very fast crossing (large dt) still detected via line-segment test
  - Edge case: Track with no track-finish cell — FinishLine constructor handles gracefully (no detection, race runs indefinitely or doesn't start)

  **Verification:**
  - Drive 3 laps around the default track. Lap counter increments correctly on each crossing. Race ends after lap 3.

- [x] **Unit 3: HUD Overlay**

  **Goal:** Display lap counter and elapsed time during the race, countdown numbers during countdown, and results on finish.

  **Requirements:** R10, R11, R12, R13, R14

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Create: `js/HUD.js`
  - Modify: `js/main.js`

  **Approach:**
  - `HUD` class creates DOM elements in constructor: countdown overlay (centered, large text), race HUD (top-center: lap + time), results overlay (centered panel with total/best time + "Press any key" prompt)
  - `update(displayState)` method reads `gameMode.getDisplayState()` which returns `{state, countdown, lap, totalLaps, elapsedTime, bestLap, totalTime}`
  - Shows/hides appropriate elements based on state
  - Countdown: large centered "3", "2", "1", "GO!" text
  - Race HUD: `"Lap 2/3"` and `"01:23.456"` format
  - Results: semi-transparent black background, total time, best lap time, "Press any key to restart"
  - Restart listener: `keydown` / `touchstart` during FINISHED calls `gameMode.reset()` then `gameMode.start()`
  - All styling via `style.cssText` matching existing codebase pattern

  **Patterns to follow:**
  - DOM creation: same pattern as debug HUD in main.js lines 378-396
  - Inline CSS via `style.cssText`

  **Test scenarios:**
  - Happy path: Countdown shows "3", "2", "1", "GO!" centered on screen in sequence
  - Happy path: During RACING, lap counter shows "Lap 1/3" and timer increments
  - Happy path: On FINISHED, results overlay shows total time and best lap time
  - Happy path: Pressing any key during FINISHED restarts the race (back to countdown)
  - Edge case: HUD hidden during IDLE state
  - Edge case: Time formatting handles sub-second precision (mm:ss.ms format)

  **Verification:**
  - Complete a full race cycle: see countdown → HUD with live timer/lap → results screen → restart via keypress

- [x] **Unit 4: Countdown Audio**

  **Goal:** Play procedural beeps during the countdown sequence.

  **Requirements:** R5

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/Audio.js`
  - Modify: `js/RaceMode.js` or `js/main.js`

  **Approach:**
  - Add a `playBeep(frequency, duration)` method to `GameAudio`. Uses `OscillatorNode` connected to `this.listener.context` (the Web Audio AudioContext). Creates oscillator, connects to destination, starts, stops after duration.
  - RaceMode calls `audio.playBeep(440, 0.15)` on each countdown tick (3, 2, 1) and `audio.playBeep(880, 0.3)` on GO
  - Pass audio reference to RaceMode constructor or expose as a callback
  - Respects the existing audio context unlock pattern — beeps only play after user interaction

  **Patterns to follow:**
  - `GameAudio` class in Audio.js — the `listener` property exposes the THREE.AudioListener, which has `.context` (AudioContext)
  - Existing `playImpact()` pattern for one-shot sounds

  **Test scenarios:**
  - Happy path: Each countdown number (3, 2, 1) produces a short beep
  - Happy path: GO produces a higher-pitched, longer beep
  - Edge case: Audio works even if audio context was not yet unlocked (beeps are silent, no error thrown)

  **Verification:**
  - Start a race with audio enabled. Hear 3 beeps at descending countdown, then a distinct GO tone.

- [x] **Unit 5: Multiplayer Race Sync**

  **Goal:** Synchronize countdown and race state across all connected players.

  **Requirements:** R15, R16, R17

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `server.js`
  - Modify: `js/Network.js`
  - Modify: `js/RaceMode.js`
  - Modify: `js/main.js`

  **Approach:**
  - **Server-side:** Add race state to the server. When 2+ players are connected, server initiates countdown. Broadcasts `{type: 'raceCountdown', count: N}` at 1-second intervals. Broadcasts `{type: 'raceStart'}` at count 0. On receiving `{type: 'lapComplete', lap, time}` from a client, broadcasts `{type: 'playerLap', id, lap, time}` to all.
  - **NetworkClient:** Add handlers for `raceCountdown`, `raceStart`, `playerLap` message types. Expose callbacks: `onRaceCountdown(msg)`, `onRaceStart(msg)`, `onPlayerLap(msg)`.
  - **RaceMode multiplayer path:** When multiplayer is active, RaceMode doesn't self-manage countdown — it waits for server `raceCountdown` messages. On `raceStart`, transitions to RACING. On local lap completion, sends `{type: 'lapComplete', lap, time}` to server.
  - **Single-player path unchanged:** RaceMode manages its own countdown timer when no network is present.
  - **Late joiners:** Players who join mid-race enter spectate mode until the next race restart.

  **Patterns to follow:**
  - Message handling: switch on `msg.type` in both `server.js` and `Network.js`
  - Broadcast pattern: `server.js` iterates `wss.clients` with `client.send()`
  - Client callback pattern: `network.onPlayerJoin = (msg) => ...` in main.js

  **Test scenarios:**
  - Happy path: Two clients connect, both see synchronized 3-2-1-GO countdown
  - Happy path: Player completes a lap, other players receive the lap event
  - Happy path: Race starts only when server initiates countdown
  - Edge case: Single-player mode uses local countdown (no server dependency)
  - Edge case: Player disconnects mid-race — remaining players continue normally
  - Edge case: Late joiner doesn't disrupt an in-progress race
  - Integration: Client sends lapComplete → server broadcasts playerLap → other client receives and can display it

  **Verification:**
  - Open two browser tabs. Both see the same countdown. One player's lap completion is visible to the other.

## System-Wide Impact

- **Interaction graph:** `main.js animate()` loop gains a game mode update call and input filtering. `PlayerManager.update()` receives filtered input. `Audio.js` gains a new `playBeep()` method. `server.js` gains race state tracking and new message types.
- **Error propagation:** If finish line detection fails (no track-finish cell), race runs but laps never increment — acceptable degradation per scope boundaries.
- **State lifecycle risks:** Race state must be reset cleanly on restart (R14). Ensure all timers, lap counts, and HUD elements reset. The cooldown timer must reset on race restart.
- **API surface parity:** New WebSocket message types must be handled gracefully by older clients that don't understand them (ignored via default switch case, which already exists).
- **Unchanged invariants:** Vehicle physics, track rendering, camera behavior, debug panel, spectate mode — all unchanged. The game mode only intercepts input and reads vehicle position.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Finish line crossing missed at very high speed | Line-segment test handles large per-frame deltas; dt is capped at 1/30s which limits max movement per frame |
| Audio context not unlocked before countdown | Beeps fail silently; gameplay is unaffected. Existing unlock pattern covers most cases. |
| WebSocket race messages arrive out of order | Countdown is sequential (3→2→1→0); client trusts most recent count. Lap messages are idempotent (same lap number ignored). |
| Custom tracks without track-finish cell | No finish line created; race stays in RACING state indefinitely. Acceptable — track validation is a separate feature. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-30-race-state-machine-hud-requirements.md](docs/brainstorms/2026-03-30-race-state-machine-hud-requirements.md)
- Related code: `js/Track.js:computeSpawnPosition()`, `js/Vehicle.js:spherePos`, `js/main.js:animate()`, `server.js`
- Related ideation: `docs/ideation/2026-03-30-open-ideation.md` idea #1
