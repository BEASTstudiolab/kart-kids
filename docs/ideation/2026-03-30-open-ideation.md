---
date: 2026-03-30
topic: open-ideation
focus: open-ended
---

# Ideation: Kart Kids Improvements

## Codebase Context

- **Project shape:** Three.js + crashcat physics kart racer, ported from Godot 4.6. JS modules in `js/`, GLB models in `models/`, existing track editor at `editor.html`.
- **Current features:** Single-player racing, WebSocket multiplayer (4 players), dynamic track building from cell arrays, URL-encoded custom tracks, 4 vehicle colors, touch/keyboard/gamepad input, smoke particles, day/night lighting, bloom post-processing.
- **Key gaps:** No race loop (no lap timing, finish line detection, or HUD), Audio.js is a stub, NPC array unused, physics constants hardcoded, no multiplayer lobby/auth, no track validation.
- **Past learnings:** No `docs/solutions/` directory exists yet.

## Ranked Ideas

### 1. Race State Machine + HUD
**Description:** Finish line detection from the existing `track-finish` cell, lap counting, countdown, and a minimal DOM overlay showing speed/lap/time. The foundation that turns a driving sandbox into a race game.
**Rationale:** Every downstream feature (ghosts, AI, leaderboards, multiplayer sync) depends on the concept of "a lap" existing. The `track-finish` cell already exists in `Track.js`.
**Downsides:** Table-stakes work, not a differentiator on its own.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Explored

### 2. Track Platform (Editor UI + Validation + Cell Metadata)
**Description:** Complete the existing `editor.html` with drag-drop palette, closed-loop validation via graph traversal, and cell metadata (boost/mud/jump properties encoded in URLs). Turns the editor from a dev tool into a content platform.
**Rationale:** The editor already exists. URL-encoded tracks already work. Highest-leverage feature because it lets players generate infinite content.
**Downsides:** Cell metadata is speculative scope — the base editor + validation is the real deliverable.
**Confidence:** 85%
**Complexity:** Medium-High
**Status:** Unexplored

### 3. Audio-Driven Game Feel (Procedural Audio + Collision Feedback)
**Description:** Replace the `Audio.js` stub with Web Audio oscillators mapped to vehicle speed (zero audio assets), plus camera shake and impact sounds on collisions using the existing `impactPool`.
**Rationale:** Silence is the #1 signal a game feels unfinished. Procedural audio costs zero assets, works offline, and communicates speed better than any HUD number.
**Downsides:** Oscillator-based engine sound can sound harsh if poorly tuned. Needs careful frequency mapping.
**Confidence:** 80%
**Complexity:** Low-Medium
**Status:** Unexplored

### 4. Track URL = Session Identity
**Description:** Same track URL = same multiplayer room. The server partitions players by track hash. No lobby, no room codes, no out-of-band coordination. Sharing a link IS the invite.
**Rationale:** Uniquely browser-native — no other racing game can do "paste a link to join my race." Small server change.
**Downsides:** No privacy control — anyone with the URL can join.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 5. Physics Tuning via URL Params
**Description:** Extract hardcoded constants from `Vehicle.js` debug object into a config, overridable via `?physics=speed:15,damp:0.08` URL params. Shareable tuning presets.
**Rationale:** Uniquely exploits crashcat as a custom physics layer. Turns physics feel into a shareable artifact. ~2 hours of work.
**Downsides:** Risk of parameter combinations that break the game. Needs sensible clamping.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 6. Ghost Replay System
**Description:** Record vehicle state at 20Hz during a lap, store in localStorage, race against a translucent ghost. Share ghost replays via URL. Uses the same interpolation code path as remote multiplayer players.
**Rationale:** Highest-retention single-player mechanic in kart games. URL-shareable ghosts are a unique browser-native social feature. Requires race state machine (#1) first.
**Downsides:** Depends on race state machine. Competes with live multiplayer for "race someone" slot.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 7. Minimap
**Description:** 2D canvas overlay projecting track cells + colored player dots. Reads existing data from `Track.js` cell positions and `computeTrackBounds`. No new data pipeline needed.
**Rationale:** 1-2 hours of work. Transforms racing from "follow the road" to "racing with intent." All data already exists.
**Downsides:** Generic feature, not a differentiator.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | First-Time Onboarding | Polish on unbuilt game; subsumes into race state machine |
| 2 | Multiplayer Room Codes | Superseded by Track URL = Session which is simpler |
| 3 | Mobile Touch UX | Backwards priority; fix game loop first |
| 4 | Procedural Track Gen | Research project; editor solves track creation cheaper |
| 5 | Accessibility & Remapping | Correct but not actionable; no concrete implementation path |
| 6 | Event Bus | Pure infrastructure; do when coupling causes a specific bug |
| 7 | AI Opponents | 3-system dependency chain |
| 8 | Server-Auth Race State | Premature; build client-side first |
| 9 | Live Track Building | 4 unsolved hard problems bundled as one feature |
| 10 | Stunt Witnesses | No stunt detection model in crashcat |
| 11 | Slow Wins / Destructible Track | Dynamic collider removal unproven |
| 12 | Asymmetric Multiplayer | Symmetric multiplayer has no race loop yet |
| 13 | Musical Track Cells | Game jam demo; zero replayability |
| 14 | Lap Time as Currency | Requires 4 non-existent systems |
| 15 | First-Person Camera | Incoherent scope |
| 16 | Chunked Track Loading | Tracks are 16-80 cells; no performance problem |
| 17 | 20-Player Optimization | Server caps at 4; problem doesn't exist |
| 18 | Headless Bot Harness | crashcat in Node unconfirmed |
| 19 | Replay Compression | Storage problem doesn't exist yet |

## Session Log
- 2026-03-30: Initial ideation — 48 raw ideas from 6 agents, 29 after dedupe, 7 survived adversarial filtering
- 2026-03-30: Brainstormed idea #1 (Race State Machine + HUD) — requirements doc at docs/brainstorms/2026-03-30-race-state-machine-hud-requirements.md
