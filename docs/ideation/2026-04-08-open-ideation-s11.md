---
date: 2026-04-08
topic: open-ideation
focus: low complexity auto-coder improvements
---

# Ideation: Kart Kids Open Improvements (Session 11)

## Codebase Context

Browser-based multiplayer kart racing game. three.js + crashcat physics, 70+ JS modules. 10 prior ideation sessions produced PRs #38-#119. Session 10 added: pause menu, persistent race stats, connection badge, ghost rival, reverse track, void auto-respawn, live reload. Focus: low-complexity improvements noticeable in the first 5 minutes of play.

## Ranked Ideas

### 1. Tab-Away Race Freeze
**Description:** When a player switches browser tabs during a race, freeze the race timer via `visibilitychange` event. Currently `dt` is clamped but `_elapsedTime` still accumulates wall-clock time on return, ruining lap times. Set `gamePaused = true` when hidden, unpause when visible.
**Rationale:** Power users chasing personal bests lose their run to a single tab switch. The dt clamp prevents physics explosions but doesn't protect the competitive metric.
**Downsides:** Multiplayer desync if one player tabs away.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 2. Lap Time Delta Flash
**Description:** When crossing the finish line mid-race, flash a green "+0.42s" or red "-0.31s" delta comparing the just-finished lap to the best lap. Disappears after 2 seconds. Uses existing `_bestLap` and `onLapComplete` callback.
**Rationale:** Zero mid-race feedback on improvement. Every racing game shows split times. This turns invisible progress into immediate feedback.
**Downsides:** Minimal — purely additive HUD element.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 3. Backward Lap Rejection
**Description:** Add a minimum progress gate before a forward finish-line crossing counts as a lap. Must have traversed at least 80% of waypoints. Prevents exploit where driving backward through finish then forward gives a fake lap credit.
**Rationale:** Without this, illegitimate 2-second laps can be permanently stored in ghost and race stats. The existing `lapTime < 5` guard only catches the most egregious cases.
**Downsides:** Progress tracking must be reliable — could reject legitimate laps on very short tracks.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 4. Engine Pitch Gear Shifts
**Description:** Replace the linear engine pitch ramp with a stepped curve that simulates gear shifts — brief pitch drops at speed thresholds (30%, 60%, 85% of top speed). Purely a modification to Audio.js.
**Rationale:** Current linear pitch sounds flat and monotone. Stepped drops give intuitive speed-zone feedback without new assets.
**Downsides:** Might sound jarring if breakpoints are wrong. Needs tuning.
**Confidence:** 70%
**Complexity:** Low
**Status:** Unexplored

### 5. Countdown Rev-Up
**Description:** During 3-2-1 countdown, if gas is held, play escalating engine rev. Engine pitch rises with countdown progress. Purely cosmetic — no launch boost mechanic.
**Rationale:** Countdown is dead time. Every kart game makes it interactive. This turns passive waiting into anticipatory ritual.
**Downsides:** Need to handle case where engine audio isn't initialized yet.
**Confidence:** 75%
**Complexity:** Low
**Status:** Unexplored

### 6. Brake Lights on AI Karts
**Description:** Add a red emissive glow to the rear of vehicles when braking. A PointLight parented to the vehicle mesh, toggled by brake input.
**Rationale:** No visual telegraph when following another kart. Brake lights are a universal readability cue.
**Downsides:** Extra point lights could impact performance on low-end devices. May need to limit to nearest 2-3 karts.
**Confidence:** 70%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Wrong-way detector | Already done in PR #97 |
| 2 | Ghost delta indicator | Already done in PR #102 |
| 3 | NEW BEST celebration pop | Overlaps with PR #114 NEW RECORD display |
| 4 | Position arrows on karts | Needs UX design |
| 5 | Momentum crash penalty | Needs balance tuning |
| 6 | AFK input-aware reset | Edge case, low impact |

## Session Log
- 2026-04-08: Session 11 ideation — 12 raw ideas from 2 frames, 6 survived adversarial filtering
