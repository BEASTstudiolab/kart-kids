---
date: 2026-04-08
topic: open-ideation-s14
focus: open-ended
---

# Ideation: Open Session 14

## Codebase Context

Plain JS + three.js kart racer, ~70 files flat in js/, custom physics ("crashcat"), tile-based track editor, mobile-first with touch controls and accelerometer. 13 prior ideation sessions have shipped ~100 improvements covering ghost replay, adaptive AI, wrong-way detection, pause menu, brake lights, confetti, engine sounds, race commentary, position HUD, lap deltas, camera modes, accelerometer calibration, AI nameplates, network compression, physics profiles, and many per-frame allocation hoists.

## Ranked Ideas

### 1. Extract duplicate elevToY to ElevationUtils
**Description:** `elevToY()` and constants `ELEV_GROUND`/`ELEV_STEP_Y` are identically defined in both Track.js and Physics.js. Move to ElevationUtils.js which already exists for shared elevation helpers.
**Rationale:** Prevents silent divergence when elevation behavior changes. ElevationUtils.js was created specifically for this purpose.
**Downsides:** None
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 2. Clear wrecks on race restart
**Description:** WreckManager has no reset() method. When a race restarts within 60s of elimination, up to 6 wreck bodies persist as invisible hazards at spawn positions.
**Rationale:** Concrete bug in the common play-again loop. Wrecks block freshly spawned vehicles.
**Downsides:** None
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 3. Keyboard controls help overlay
**Description:** Desktop players have zero indication of controls. Add a help overlay (toggled by `?` key) showing WASD/arrows, Space=boost, Shift=drift, Backspace=respawn.
**Rationale:** New players cannot play without trial-and-error. Mobile has visible buttons; desktop has nothing.
**Downsides:** Minor HUD clutter; easily dismissed
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 4. localStorage ghost quota management
**Description:** Ghost recordings accumulate without limit. Add total-size cap with LRU eviction to prevent localStorage quota exhaustion that could break editor autosave.
**Rationale:** Ghost data shares localStorage with editor saves. Quota exhaustion silently fails via try/catch.
**Downsides:** Evicting old ghost data may surprise users
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 5. Race start zone visual indicator
**Description:** The finish tile race-start zone (5s dwell to trigger) has no visual indicator. Add a glowing ground marker showing where to park.
**Rationale:** First-time players don't know races exist or how to trigger one. They drive aimlessly.
**Downsides:** Needs visual design decisions
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 6. AI items from actual item boxes
**Description:** Replace `Math.random() < dt/8` AI item trickle with item box pickup detection. AI vehicles passing through item boxes collect items with position-weighted rolls.
**Rationale:** Current system ignores race position for AI items, breaking catch-up weighting. Items appearing from nowhere feels unfair.
**Downsides:** More complex collision detection; AI may stockpile on item-heavy tracks
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Split-screen local multiplayer | Too complex for auto-coder scope |
| 2 | Interactive tutorial mode | Needs design decisions on progression gating |
| 3 | Race replay viewer | Too complex — timeline UI, free camera, playback |
| 4 | Track selection screen | Full UI page + metadata + browsing flow |
| 5 | main.js god function refactor | Too risky, architectural decision needed |
| 6 | Community track hub | Needs backend/hosting decisions |
| 7 | Input replay / deterministic restart | Requires fixed timestep first |
| 8 | Weather effects | Complex particles + physics mods + per-theme tuning |
| 9 | Off-track surface penalties | Needs per-tile surface types (skipped s13) |
| 10 | Speed-adaptive shadow frustum | Niche visual optimization |
| 11 | Ghost as racing line for steering assist | Complex physics/AI integration |
| 12 | TrackIntel spatial index | Micro-optimization, low user impact |
| 13 | Projectile-vs-track collision | Complex physics, needs design decisions |
| 14 | Collider rebuild async | Complex Worker/chunking work |
| 15 | Track difficulty rating | Needs design decisions on scoring formula |
| 16 | Background music system | No audio assets exist |
| 17 | Audio unlock prompt | PR #72 handles AudioContext resume |
| 18 | Kart stats / vehicle differentiation | Needs design decisions on balance |
| 19 | Auto-generate TrackIntel connectivity | Related to pending junction support |

## Session Log

- 2026-04-08: Session 14 ideation — ~40 generated across 5 agents, 6 survived adversarial filtering
