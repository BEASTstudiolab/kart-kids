---
date: 2026-04-08
topic: open-ideation
focus: low-to-medium complexity auto-coder improvements
---

# Ideation: Kart Kids Open Improvements (Session 10)

## Codebase Context

Browser-based multiplayer kart racing game. three.js + crashcat physics, 70+ JS modules, no bundler. 2-person team. 9 prior ideation sessions produced PRs #38-#112 covering micro-optimizations, robustness, gameplay features (wrong-way detection, adaptive AI, ghost splits, race commentary, track thumbnails, respawn, off-track warning, lap breakdown, camera mode, track export, audio feedback, position HUD, unused import cleanup). Pending complex items: fixed timestep, junction support, network buffer/reconnect. Focus this session: auto-coder-viable improvements at low-to-medium complexity.

## Ranked Ideas

### 1. Pause Menu with Resume / Restart / Quit
**Description:** Currently pressing `P` toggles `gamePaused` in main.js which just skips the update loop and appends "(PAUSED)" to the FPS counter. No overlay, no way to restart mid-race, and no mobile pause trigger. Add a proper pause overlay with Resume, Restart Race, and Back to Menu buttons. Include a mobile-accessible pause button in the HUD.
**Rationale:** Players who need to stop mid-race have no visible escape hatch. The game just freezes with no UI. Mobile players cannot even trigger pause. This is a basic usability gap that every game needs.
**Downsides:** Needs to handle multiplayer state (can't pause a shared race). Pausing physics mid-frame needs careful state management.
**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Unexplored

### 2. Auto-Recovery When Vehicle Falls Off Track
**Description:** A safety-net ground plane exists at Y=-5 (main.js line 311-318) but when a vehicle lands on it, there is no automatic respawn — the player slides around on an invisible floor below the track. Wire the safety-net collision to trigger `VehicleRespawn.execute()` automatically so players don't get stuck in the void.
**Rationale:** Falling off the track and being stuck in a void with no way back except reloading is one of the worst player experiences in any racing game. The respawn system already exists — it just needs a trigger.
**Downsides:** Must avoid respawn loops if the checkpoint itself is near an edge. Needs a cooldown.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 3. Session-Persistent Race Stats (Personal Bests per Track)
**Description:** Add a localStorage-backed stats tracker that records best lap time, best total time, and race count per `trackId`. Show personal best on the pre-race screen, flash "NEW RECORD" when beaten. `GhostStorage.js` already generates deterministic track hashes, and `RaceMode` tracks `_bestLap` and `_totalTime` — they just aren't persisted.
**Rationale:** Without persistent stats, every race feels disconnected. Players have no sense of progression or improvement, reducing replay motivation. This is the foundation for any leaderboard or achievement system.
**Downsides:** Storage schema needs versioning (already have Settings localStorage versioning from PR #53 as a pattern).
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 4. Ghost Rival Racing (Solid Ghost Collider)
**Description:** Currently ghosts are transparent replays you drive through. Add a toggle for "rival ghost" mode where the ghost has a physics collider that follows the replay path. You bump it, draft behind it, and must physically overtake it. GhostPlayer already replays position/rotation data; DraftingSystem works on any vehicle in `activeVehicles`; ContactHandler handles vehicle-vehicle collisions. The ghost just needs a rigid body.
**Rationale:** Turns a solo time-trial into a 1v1 physical race without any AI code. Massively increases replay value. The drafting and bump systems work automatically once the ghost has a collider.
**Downsides:** Ghost replay data is sampled at variable frame rates — the collider needs interpolation to avoid jitter. Ghost might clip through tight corners if the replay data is sparse.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 5. Mirror / Reverse Track Mode
**Description:** Let players race any track in reverse direction (reversed waypoint order, finish line crossed from opposite side) or mirrored (X-axis flip of track geometry). TrackIntel builds waypoint chains that drive AI and position ranking — reversing segment order produces reverse mode. Mirror mode flips the track group's X scale.
**Rationale:** Doubles or triples track variety for free. A staple in every modern kart racer. With user-created tracks from the editor, this multiplies content value.
**Downsides:** Reverse mode needs finish-line crossing direction logic in FinishLine.js (which already detects forward vs backward). Mirror mode needs to verify physics colliders are rebuilt correctly after the flip.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

### 6. Multiplayer Connection Status Indicator
**Description:** The multiplayer connection in main.js silently falls back to single-player on failure with only a console.warn. Add a small connection badge to the HUD showing online/offline/connecting state and player count. Show a notification when disconnect happens mid-race.
**Rationale:** Players have no idea if they're playing with real people or bots, and disconnects happen silently. Basic networking UX that every multiplayer game needs.
**Downsides:** Minimal — purely additive HUD element.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 7. Hot-Reload Dev Server
**Description:** Add a file-watcher to `server.js` that sends a WebSocket message to connected browsers when any `.js`, `.html`, or `.css` file changes, triggering an automatic page reload. The WebSocket infrastructure already exists in server.js for multiplayer.
**Rationale:** During active development, manual browser refresh after every code change is the most repeated manual action. With 70+ modules and no bundler, this is amplified. A sub-50-line addition to the existing WS server eliminates thousands of manual refreshes.
**Downsides:** File watcher on large directories can cause CPU spikes. Needs debouncing.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Grand Prix / Cup Mode | Complex, needs multi-screen UI/UX design |
| 2 | Difficulty tiers (speed classes) | Needs game design decisions and balance tuning |
| 3 | Weather / track conditions | Needs design decisions + art assets |
| 4 | Dynamic track hazards | Needs new tile types + design decisions |
| 5 | Post-race replay viewer | Complex, multi-system changes needed |
| 6 | Track scroll / infinite runner mode | Very high complexity, reframes entire engine |
| 7 | Rolling finish line | Needs design decisions, could break race logic |
| 8 | Proximity speed scaling | Needs tuning/playtesting, medium-high risk |
| 9 | Rear-fire items | Needs balance tuning and design decisions |
| 10 | Keyboard rebinding | Needs UX design for settings integration |
| 11 | Headlight-only night mode | Needs design/art decisions |
| 12 | Bump-to-boost | Needs balance tuning |
| 13 | Auto-steer accessibility mode | Needs accessibility design consultation |
| 14 | Backward camera toggle | Low value, gimmick |
| 15 | Shared importmap generator | Infrastructure, not game-facing |
| 16 | Consolidate test HTML pages | Low ROI |
| 17 | Centralized logger | Micro-optimization |
| 18 | Import/export lint script | Infrastructure, not game-facing |
| 19 | Extract main.js init | Complex refactor |
| 20 | Shared game constants module | Duplicates documented conventions |
| 21 | Pre-commit hook | Trivial infra, not game-facing |
| 22 | Server-side map validation | Needs server architecture decisions |
| 23 | Race countdown rev effect | Minor UX polish |
| 24 | Loading screen tips | Partially covered already |
| 25 | Dead branch cleanup script | Already exists as CE skill |
| 26 | .sandcastle gitignore | Already done in PR #90 |
| 27 | Error boundary | Already done in PR #89 |
| 28 | Editor track validation | Already done in PR #68 |

## Session Log
- 2026-04-08: Session 10 ideation — 39 raw ideas from 5 frames, 28 after dedupe (11 already done/covered), 7 survived adversarial filtering
