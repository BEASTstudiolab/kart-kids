---
date: 2026-03-30
topic: race-state-machine-hud
---

# Race State Machine + HUD

## Problem Frame

Kart Kids is a driving sandbox with no win condition. Players can drive around tracks but there is no lap counting, no finish line detection, no countdown, and no results screen. This makes the game feel unfinished and blocks every downstream feature (ghosts, AI, leaderboards, multiplayer race sync). The `track-finish` cell already exists in `Track.js` but is never checked at runtime.

## Requirements

**Game Mode Infrastructure**
- R1. Define a game mode contract (start, update, isFinished, getResults) that the main loop delegates to. The first implementation is `RaceMode`. Future modes (time trial, battle) plug into the same contract.
- R2. The active game mode is selectable via URL parameter (e.g., `?mode=race`). Default to `race` when omitted.

**Race Lifecycle**
- R3. Race lifecycle follows: IDLE -> COUNTDOWN -> RACING -> FINISHED.
- R4. Countdown is 3-2-1-GO with vehicle controls locked until GO. Each count displays prominently on screen.
- R5. Countdown includes audio cues (beeps for 3-2-1, distinct tone for GO) using the existing audio system.
- R6. Race is 3 laps. Lap count is a property of RaceMode, not hardcoded in the lifecycle.

**Finish Line Detection**
- R7. Derive a finish line trigger zone from the `track-finish` cell's world position and orientation at track load time. No manual authoring step.
- R8. A lap completes when the local vehicle crosses the finish trigger in the correct direction (forward, not backward).
- R9. Track the current lap number and best lap time per player.

**HUD**
- R10. Minimal DOM overlay showing: current lap (e.g., "Lap 2/3") and elapsed race time.
- R11. HUD is visible during RACING and FINISHED states, hidden during IDLE.
- R12. HUD updates every frame, reading existing vehicle/race state properties. No new data pipeline.

**Results Screen**
- R13. On race finish, display a semi-transparent overlay with total race time and best lap time.
- R14. Press any key or tap to restart (returns to COUNTDOWN state).

**Multiplayer Sync**
- R15. In multiplayer, the server initiates a synchronized countdown. All connected clients see 3-2-1-GO at the same time.
- R16. The server broadcasts race start and each player's lap completions so all clients can track race progress.
- R17. Each client independently detects its own finish line crossings and reports them to the server.

## Success Criteria

- A player can load the game, see a countdown, race 3 laps, and see their total time and best lap.
- In multiplayer, all players start at the same time after a synced countdown.
- The game mode contract is clean enough that a second mode (e.g., time trial) could be added without modifying the race loop or HUD infrastructure.

## Scope Boundaries

- No race position tracking (1st/2nd/3rd) — deferred until minimap or AI opponents exist.
- No speedometer — deferred to a future HUD iteration.
- No persistent time storage (localStorage leaderboards) — deferred to ghost replay feature.
- No anti-cheat or server-side lap validation — deferred to server-authoritative race state.
- No new audio assets for countdown — use procedural beeps via Web Audio or existing sounds.

## Key Decisions

- **Game mode interface over hardcoded race:** Small upfront cost, avoids a rewrite when adding time trial or battle modes. The contract is ~4 methods.
- **Minimal HUD (timer + lap only):** Keeps the screen clean. Speed and position are separate features with their own dependencies.
- **Synced multiplayer countdown in v1:** Fair starts are essential for multiplayer to feel like racing. The server protocol change is small (one new message type).
- **Finish line derived from track-finish cell:** Zero authoring burden. Works automatically for custom tracks that include a finish tile.

## Dependencies / Assumptions

- The `track-finish` cell is present in every valid track. Custom tracks without one will have no race loop (acceptable — track validation is a separate feature).
- Audio system is functional and can play sounds on demand.
- Multiplayer server can be extended with new message types without breaking existing clients.

## Outstanding Questions

### Deferred to Planning
- [Affects R7][Needs research] What is the best shape for the finish trigger zone — a plane intersection test, an AABB box, or a line-segment crossing check? Depends on how crashcat exposes position data per frame.
- [Affects R8][Needs research] How to detect crossing direction reliably — dot product of velocity against finish line normal, or track which side of the line the vehicle was on last frame?
- [Affects R15][Technical] What WebSocket message format should the server use for countdown sync? Should it be a single "race_start" with a timestamp offset, or individual "countdown_tick" messages?
- [Affects R1][Technical] Where in the module structure should the game mode live — new `js/GameMode.js` with `js/modes/RaceMode.js`, or a simpler flat structure?

## Next Steps

-> `/ce:plan` for structured implementation planning
