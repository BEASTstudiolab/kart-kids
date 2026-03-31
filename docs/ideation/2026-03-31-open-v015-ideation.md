---
date: 2026-03-31
topic: open-v015-ideation
focus: open-ended post-v0.15 review
---

# Ideation: Post-v0.15 Open Ideation

## Codebase Context

- **Project shape:** Three.js + crashcat physics kart racer, 25 JS modules, no bundler, ES module importmap.
- **v0.15 features:** Race state machine + HUD, WebSocket multiplayer (4 players), track editor, minimap, TrackIntel waypoints/progress, boost/nitro, drift stage machine (3 stages) with sparks, g-force camera (roll, FOV, distance, shake), wall sparks, boost burst/flame particles, haptics, race lobby, AFK detector, raycast ground detection, box collider vehicle, triangle mesh track colliders, instanced mesh rendering, mobile optimizations.
- **Key gaps:** No AI opponents, no ghost replay, no items/pickups, no progression/career, no character differentiation, no leaderboards, no track validation in editor, no procedural tracks, limited audio (engine + impacts + whoosh + chime only).
- **Past learnings:** Boost physics scales with topSpeed (set once, not every frame). Line-segment crossing for spatial triggers. Constructor injection + display state flow for module integration. Triangle mesh colliders from visual meshes risk phantom collisions.
- **Open tech debt:** 5 deferred review items in tasks/todo.md (phantom collision risk, solo lobby start, window.isMobile global, haptics polling, audio spatial bypass).

## Ranked Ideas

### 1. Ghost Replay via Input Recording
**Description:** Record per-frame inputs (steer, throttle, boost) during a race, replay as a transparent ghost kart. Store best laps in localStorage keyed by track hash. Encode replays as URL parameters alongside track data — a single link = track + ghost + time to beat.
**Rationale:** Highest standalone value. Uses existing Vehicle remote-player interpolation path. ~16KB per 90s race. Zero server infrastructure. Inherently viral via URL sharing.
**Downsides:** Requires deterministic-enough physics (may need fixed timestep later for perfect replay fidelity). Replay drift over long races.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 2. AI Opponents via TrackIntel Waypoints
**Description:** AI drivers follow TrackIntel waypoint chain, producing inputX/inputZ/boost per frame. Difficulty via topSpeed and aggression scaling. Rubber-banding via progress delta.
**Rationale:** Transforms the game from solo time trial into an actual race. TrackIntel already has ordered waypoints and progress %. PlayerManager already handles multiple vehicles.
**Downsides:** Making AI feel fun (not robotic, not rubberbanding too obviously) is a tuning challenge. Ship dumb AI first.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 3. Kart Selection with Physics Profiles
**Description:** 4 physics profiles (speed, drift, balanced, heavy) that override Vehicle.debug params per color variant. Pre-race selection screen with stat bars.
**Rationale:** Near-zero implementation cost — just named presets over existing tuning params. Gives players identity and strategic track-dependent choices.
**Downsides:** Balance across profiles needs playtesting. Selection UI is more work than the profiles themselves.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 4. Track Hazards: Speed Pads & Jump Ramps
**Description:** New cell types that modulate existing Vehicle params on contact — speed pad triggers mini-boost, jump ramp adds Y velocity. Oil slick zeroes grip temporarily.
**Rationale:** Multiplies track design space using existing systems. Each hazard is just a temporary param override on a trigger zone. Massively improves the track editor.
**Downsides:** Jump ramp interacts with the raycast ground system (needs careful Y handling). New 3D assets needed or use flat decals.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 5. Track Items/Pickups at Waypoint Positions
**Description:** Item boxes placed at TrackIntel waypoint positions. Pickup triggers existing systems (boost, shield, speed burst). Item tier could vary by drift meter or position. Multiplayer sync via existing 20Hz WebSocket state broadcast.
**Rationale:** Highest leverage — touches VFX, audio, HUD, haptics, multiplayer, and TrackIntel in one feature. Pairs naturally with hazards (#4).
**Downsides:** Item interactions with boost system need deconfliction. Item art needed. Multiplayer sync adds complexity.
**Confidence:** 80%
**Complexity:** Medium-High
**Status:** Explored

### 6. Procedural Track Generation
**Description:** Random walk through TrackIntel's connectivity grammar with loop-closure constraint. Seed-based generation shareable via `?seed=12345`.
**Rationale:** Infinite replayability from existing infrastructure. TrackIntel BASE_CONNECTIVITY is literally a formal grammar for valid tracks. Combined with ghosts, creates an endless content loop.
**Downsides:** Valid tracks != fun tracks. Needs constraints on minimum length, corner distribution, etc.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 7. Reactive Layered Music System
**Description:** Pre-composed stems (bass, percussion, melody) crossfade based on speed, drift stage, boost state. Uses existing Web Audio GainNode pattern from Audio.js.
**Rationale:** Pure juice. Audio.js already demonstrates reactive volume/pitch. Drift 3-stage system is begging for escalating musical tension.
**Downsides:** Needs good layered audio assets. The music itself is the hard part, not the code.
**Confidence:** 70%
**Complexity:** Low (code) / Medium (assets)
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Spectator Cinematic Director | No audience to spectate an indie kart racer |
| 2 | Play-to-Build Track Editor | Edge cases (branching, corrections) worse than grid editor |
| 3 | Editor-First UX Pivot | Product strategy pivot, not a feature at v0.15 |
| 4 | Deterministic Physics Timestep | Premature infra — no replay validation needs it yet |
| 5 | Replace Triangle Mesh Colliders | Speculative rewrite — fix specific bugs instead |
| 6 | Vertical Tracks (Y axis) | 3+ week feature touching every system; jump ramp is cheaper |
| 7 | WebRTC P2P Multiplayer | Infra rewrite with zero player-facing improvement |
| 8 | Positional Audio for Remotes | Weak payoff on tight circuit with 4 players |
| 9 | Schema-Driven Debug Panel | Premature DX infra for solo dev |
| 10 | Split main.js | Housekeeping, not gameplay — do when it causes pain |
| 11 | Module Self-Registration Kernel | Framework-building, not game-building |
| 12 | Merge GLB Models | Micro-optimization — add loading screen instead |
| 13 | Headless Physics Tuning | Can't gradient-descend toward fun |
| 14 | Tag/Chase Game Mode | Needs kart-to-kart collision (risky prerequisite) |
| 15 | Kart-to-Kart Collision | High impact but collision response in crashcat is genuinely hard |
| 16 | Leaderboards | Companion to ghost replay, not standalone |
| 17 | Track Editor Validation | Useful but low impact vs gameplay features |

## Session Log
- 2026-03-31: Fresh open-ended ideation post-v0.15 — 39 raw ideas from 5 agents, 24 after dedupe, 7 survived adversarial filtering
- 2026-03-31: Brainstormed idea #5 (Track Items/Pickups) — requirements doc at docs/brainstorms/2026-03-31-track-item-pickups-requirements.md
