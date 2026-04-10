---
date: 2026-04-08
topic: open
focus: overnight session 13 — fresh ideas after 112 prior items
---

# Ideation: Open (Session 13)

## Codebase Context

- JS/three.js kart racer, 73 files, no bundler/TypeScript
- 40+ open PRs covering features from ghost replay to confetti
- 112 prior ideation items across 12 sessions
- Known deferred: phantom collisions (P1), Haptics polling (P3), isMobile global (P3)
- Vehicle.js (1629 lines) and main.js (1279 lines) are the heaviest files
- Editor well-modularized (8 modules); game code less so
- 47+ tile types with autotile, elevation, curves

## Ranked Ideas

### 1. Accelerometer Tilt Calibration

**Description:** Add a "recenter" button and double-tap gesture for mobile accelerometer steering. Controls.js reads DeviceOrientationEvent.gamma with no baseline offset — if a player picks up their phone at an angle, the car permanently drifts. A stored `_accelBaseline` corrected on calibration events fixes this in ~20 lines.
**Rationale:** Mobile is an explicitly supported input mode (HTTPS + ngrok documented in CLAUDE.md). Tilt drift is the #1 abandonment cause for accelerometer games. Near-zero risk, enormous UX payoff.
**Downsides:** Requires a UI element (recenter button) that needs placement on the touch overlay.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 2. AI Personality Names on HUD

**Description:** Surface AI racer names and personality types (Aggressive, Cautious, Drifter) in the pre-race lineup and during races via nameplates above AI karts. AIProfiles.js already defines names and personalities; they just never reach the player.
**Rationale:** Named opponents with visible personality create rivalry and replayability. Currently AI feels like identical colored clones despite rich behavioral differentiation under the hood.
**Downsides:** Nameplates add visual noise; need to be subtle. Pre-race screen may not exist yet.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 3. Item Box Editor Placement

**Description:** Allow track authors to manually place item boxes in the tile editor instead of relying solely on ItemBoxManager's automatic even-distribution along waypoints. Add an item-box placement tool or tile type to the editor.
**Rationale:** Track design intent is overridden by the auto-placer. A well-designed track should cluster items near dangerous sections for tension or reward harder lines. Currently placeholder yellow cubes with no model.
**Downsides:** Requires editor UI changes and a new data field in the save format. Auto-placement should remain as fallback.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 4. Top-Down Playable Mode

**Description:** Expose the existing DEBUG_TOPDOWN camera as a real playable game mode with orthographic overhead view. The Minimap already renders this perspective. Physics runs unchanged in 3D; only the camera switches to orthographic overhead.
**Rationale:** Completely different skill ceiling — see the whole track, anticipate AI, plan strategically. Also makes the game playable on tiny mobile screens where 3D view is cramped.
**Downsides:** May need UI adjustments for overhead perspective. Some visual effects (rearview mirror, camera shake) become meaningless.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 5. Per-Tile Surface Materials (Grip Zones)

**Description:** Assign each tile a surface type (asphalt, dirt, ice, boost-pad) that modifies friction and drift behavior in Vehicle.js. The editor exposes a surface-paint brush. No new tile models required — pure data layer.
**Rationale:** All tiles currently feel identical under the kart. Surface variety is one of the highest-leverage feel improvements in kart racers. Vehicle.js already has per-frame friction parameters that just don't vary by surface.
**Downsides:** Requires per-frame surface lookup (raycast to determine tile under vehicle). Needs visual feedback (tint overlay or particle change) to communicate surface type.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 6. Network Delta Compression

**Description:** Replace per-frame JSON.stringify of full vehicle state with delta-only encoding — send only changed fields, with a full sync every N frames. Would cut multiplayer bandwidth 60-80%.
**Rationale:** Multiplayer on shared WiFi or 4G is the main hosting use case. Current approach sends position, velocity, orientation, and inputs every frame even when a vehicle is stationary.
**Downsides:** Adds state tracking complexity. Must handle packet loss gracefully with periodic full syncs.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 7. Physics Skin System

**Description:** Allow tracks to declare a physics profile (arcade/ice/moon/chaos) that swaps Vehicle.js constants (friction, gravity, turn factor). Track metadata carries the profile; Vehicle.js reads it at race start.
**Rationale:** One physics feel limits content variety. A "moon" track with low gravity and floaty jumps is a completely different game using the same code. Multiplies content value without new art.
**Downsides:** Balance implications — items/AI tuned for arcade may break on ice. Needs per-profile AI parameter adjustments.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Pre-play track linter | Already done (PR #68) |
| 2 | Delete stale test HTMLs | Trivial housekeeping |
| 3 | Wire up npm test | Task, not an idea |
| 4 | Single HTML shell template | Low impact, premature abstraction |
| 5 | Bake curve derivation | Breaks saved map compatibility |
| 6 | Session log as JSON | Infrastructure, not game improvement |
| 7 | Agent task spec format | Meta-tooling |
| 8 | Community tracks as ranked | Requires nonexistent backend |
| 9 | Agent-designed content | Requires nonexistent telemetry |
| 10 | Diegetic HUD removal | Too radical for current stage |
| 11 | Structured replay viewer | Incremental over ghost; low urgency |
| 12 | Editor-as-metagame | Too complex (live collision patching) |
| 13 | Behavior tree AI | Major rewrite of working system |
| 14 | Ambient async multiplayer | Requires persistent storage |
| 15 | window.isMobile removal | Too small for ideation |
| 16 | Haptics event-driven | Too small alone (deferred P3) |
| 17 | Track URL sharing for play | Overlaps PR #109 |
| 18 | AI racing line viz | Debug-only, narrow audience |
| 19 | Event bus | Infrastructure; part of larger task |
| 20 | TrackIntel shared service | Abstract; future-only payoff |
| 21 | TileMetadata contract | Abstract; future-only payoff |
| 22 | Procedural track mutations | Autotile constraints make this hard |
| 23 | Vehicle.js decomposition | Pure refactor; better as backlog |

## Session Log

- 2026-04-08: Session 13 ideation — 38 raw from 5 agents, 31 after dedup, 7 survivors
