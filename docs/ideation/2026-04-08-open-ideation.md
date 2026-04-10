---
date: 2026-04-08
topic: open-ideation
focus: low-to-medium complexity user-visible improvements
---

# Ideation: Kart Kids Open Improvements (Session 8)

## Codebase Context

Browser-based multiplayer kart racing game. three.js + crashcat physics, 73 JS modules, no bundler. 2-person team. 57+ micro-optimization PRs merged (per-frame allocs, null guards, dispose, unused imports, error boundaries). 4 complex items tracked pending (fixed timestep, junction support, network buffer, network reconnect). Focus this session: user-visible improvements at low-to-medium complexity.

## Ranked Ideas

### 1. Wrong-Way Detection & U-Turn Prompt
**Description:** Use TrackIntel waypoint progression to detect when a player's segment index decreases for 2+ seconds. Show a "WRONG WAY" HUD warning with a directional arrow. Auto-dismiss when the player turns around.
**Rationale:** On complex tracks with elevation, bridges, and tunnels, players get turned around after collisions or respawns. Zero feedback currently. Every racing game since 1992 has this.
**Downsides:** Needs tuning for edge cases (multi-path tracks if junction support lands).
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 2. Race Position Audio Callouts
**Description:** Play a rising tone when gaining a position, descending tone when losing one. RaceMode already tracks _position per-frame. Trigger a one-shot sound from GameAudio when the value changes.
**Rationale:** Players often miss position changes because the minimap is small and HUD is easy to miss at speed. Audio feedback is pre-attentional — players feel race dynamics without looking away. ~15 minutes of work for outsized feel improvement.
**Downsides:** Needs tasteful sound design to avoid annoyance. Rapid oscillation during tight racing needs debounce.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 3. Quick Restart with Track Variation ("Remix")
**Description:** Add a "Remix" button on the results screen. Re-races the same track but randomizes AI profile assignments, item box positions (shifted by one waypoint), and starting grid order. Same track, different race dynamics.
**Rationale:** Players who enjoy a track hit Restart and get the exact same race. Varying lineup and items makes each re-race feel different without new content. Dramatically extends replay value of user-created tracks.
**Downsides:** Randomized AI profiles may occasionally produce degenerate races (all cautious or all aggressive).
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 4. Dynamic Race Commentary Callouts
**Description:** Flash contextual text phrases during races: "CLOSE CALL!" (near-miss), "COMEBACK!" (gain 3+ positions), "NICE DRIFT!" (long drift chain), "FINAL LAP!" with urgency. Pure HUD text with spring animations.
**Rationale:** Races feel silent from a narrative standpoint. Commentary callouts are low-cost emotional amplifiers. HUD.js already uses SpringAnimator for punch animations.
**Downsides:** Must be brief and infrequent to avoid clutter. Threshold tuning needed.
**Confidence:** 75%
**Complexity:** Low
**Status:** Unexplored

### 5. Adaptive AI Difficulty
**Description:** Track player's average finish position and best lap times in localStorage. Auto-adjust rubberBandIntensity and AI profile selection between races. Expose a single "Challenge Level" indicator (not a raw slider) on results screen.
**Rationale:** Currently rubberBandIntensity is a raw 0-1 slider with no feedback loop. New players get destroyed; experienced players lap the AI. Adaptive difficulty keeps every race contested without manual tuning.
**Downsides:** Algorithm needs hysteresis to avoid oscillation. "Challenge Level" display needs UX design.
**Confidence:** 75%
**Complexity:** Low-Medium
**Status:** Unexplored

### 6. Ghost Split-Time Delta Display
**Description:** Show a real-time delta indicator when racing against your ghost: "+0.8s" (red) or "-1.2s" (green) comparing elapsed time at matching waypoint positions. Display as a fleeting HUD toast near the timer.
**Rationale:** Ghost replay exists but gives zero feedback DURING the race. Players can't tell if they're ahead or behind until the lap ends. Split deltas turn every corner into a micro-competition.
**Downsides:** Requires mapping ghost frame index to waypoint progress for comparison. Only useful when a ghost is loaded.
**Confidence:** 70%
**Complexity:** Low-Medium
**Status:** Unexplored

### 7. Auto-Generate Track Thumbnails
**Description:** When saving a track in the editor, render a top-down orthographic snapshot to a small canvas and store as a data URL alongside track data in localStorage. Display thumbnails in the load-track picker instead of just names.
**Rationale:** Editor saves are text-only names. With 10+ tracks, users can't tell them apart. Visual thumbnails make track management instant-recognition.
**Downsides:** Adds ~5KB per saved track to localStorage. Needs temporary orthographic camera setup.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Ghost coaching overlay (braking points, racing line highlight) | Scope creep on top of split deltas; three features stapled together |
| 2 | Steering dead-zone calibration | Too niche; fixed thresholds work for most users |
| 3 | Lobby countdown on track surface | Cosmetic polish on 3-second moment; low impact |
| 4 | Editor In-Place Test Drive | High complexity, needs brainstorming phase, not auto-coder material |
| 5 | Track ratings & personal stats | No sharing mechanism; ratings without community are dead feature |
| 6 | Rear-View Mirror as Threat Radar | Needs design decisions about radar visual language |
| 7 | Post-Race Cinematic Replay | Medium complexity, camera work needs design decisions |
| 8 | AI Profiles as Unlockable Characters | Interesting but premature — needs garage UI, progression system |
| 9 | Automated playtest bot | AI already drives tracks; what new validation does this add? |
| 10 | Ghost replay export/import | Large data, compression work non-trivial, tiny audience |
| 11 | Session-persistent player identity | Too small for ideation — just do it when needed |
| 12 | Track metadata header | Prerequisite only, not standalone value |
| 13 | Editor prefab templates | Needs content authoring by Rafsby |
| 14 | Client-side telemetry | No backend infra; zero user-visible value |
| 15 | Eliminate duplicated elevToY | 5-minute cleanup, not an "idea" |
| 16 | Auto-generate import map | Solving a problem that doesn't exist |
| 17 | Lazy-load combat/debug | Premature optimization without measured bottleneck |
| 18 | main.js init() extraction | Architecture for architecture's sake |
| 19 | Keyboard+Touch couch co-op | High complexity, doubled draw calls kill mobile perf |
| 20 | Demand-load models per tile | Visual pop-in for marginal load time improvement |
| 21 | Ghost-to-Track generator | Research-project complexity; path-to-grid is unsolved |
| 22 | Elimination mode with shrinking track | Dynamic collision mesh updates + design work = high complexity |
| 23 | Spectator drone camera | Zero user demand for browser game |
| 24 | Shortcut detection & penalty | Interesting but conflated with wrong-way; keep wrong-way, defer shortcuts |

## Session Log
- 2026-04-08: Session 8 ideation — 39 raw ideas from 5 frames, 30 after dedupe, 7 survived adversarial filtering
