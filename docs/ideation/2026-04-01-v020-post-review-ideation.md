---
date: 2026-04-01
topic: v020-post-review
focus: open-ended post-code-review, v0.20 with AI racers + mobile + post-fx + settings
---

# Ideation: Post-Review v0.20 Improvements

## Codebase Context

- **v0.20** with AI racers (up to 8), mobile touch controls (joystick + buttons + accelerometer + pinch-zoom), post-processing pipeline (9 effects), settings persistence, debug menu, multiplayer scaffolding
- 32 JS modules in flat js/ directory, no bundler, no tests, no TypeScript
- main.js is ~1200 lines with ~440 lines of inline debug menu wiring
- Just completed code review pass fixing P0-P2 issues (grid OOB, pinch interference, per-frame allocations, coupling)
- TrackIntel has review debt (P3 advisory items)
- No docs/solutions/ knowledge base, no test infrastructure
- Previous ideation explored: finish line slow-mo, brake-drift cancel, slope slingshot, spring UI, weather, track sharing, replays, daily tracks

## Ranked Ideas

### 1. Deterministic Replay System (Feature + Debug Tool)
**Description:** Record per-tick input streams + RNG seeds for all vehicles. Replay by feeding inputs through Vehicle.js/Physics.js. Ship as both "watch replay" and a bug reproduction tool.
**Rationale:** Solves two pain points with one system: players want ghosts/replays, developers need reproducible bug reports with zero test infrastructure. Unlocks ghost racing, AI training data, and regression testing.
**Downsides:** Requires crashcat physics determinism across platforms (float precision). Replay format needs versioning as physics params change.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 2. Procedural Track Generation from Tile Grammar
**Description:** Build a generator that chains track tiles using a graph grammar — constraints like "must form closed loop," "difficulty scales with corner density." Outputs the same GridMap format Track.js consumes.
**Rationale:** Hand-built tracks are finite content. The tile vocabulary and orientation mapping are already formalized. Combined with daily-track seeding, this becomes a perpetual content engine with zero art cost.
**Downsides:** Ensuring generated tracks are fun (not just valid) requires playtesting.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 3. Track Editor as Core Loop (Build -> Share -> Challenge)
**Description:** Reframe: racing tests your creations. Core loop becomes build -> share URL -> embed ghost run -> watch others race -> see stats -> iterate. Ghost data serialized into URL alongside track.
**Rationale:** Mario Maker proved creation IS the game. URL sharing is already zero-friction. Adding ghost + completion stats makes every link a self-contained challenge.
**Downsides:** Requires ghost system (#1). URL length limits may constrain track + ghost data.
**Confidence:** 70%
**Complexity:** Medium-High
**Status:** Unexplored

### 4. Post-Processing Presets with Adaptive Quality
**Description:** Replace 9 individually-togglable effects with 4 quality presets (low/med/high/ultra). Auto-detect device capability on startup and select the right preset. Single "Quality" slider in settings.
**Rationale:** 9 effects = 512 untested combinations. A single slider removes configuration friction. Mobile players benefit most.
**Downsides:** Presets may not match every device perfectly. Power users lose granular control (keep debug menu for them).
**Confidence:** 90%
**Complexity:** Low
**Status:** Explored

### 5. Post-Processing as Gameplay (Diegetic Visual Effects)
**Description:** Connect shader uniforms to game state: boost cranks bloom + radial zoom until it obscures vision, damage distorts chromatic aberration, shields clear your screen.
**Rationale:** Collapses feedback and challenge. PostProcessing stack is already runtime-adjustable. G-force camera proves the pattern.
**Downsides:** Tuning "fun obscurity" is hard — too much is nauseating, too little is meaningless.
**Confidence:** 72%
**Complexity:** Low-Medium
**Status:** Unexplored

### 6. The Track Is the Weapon (Real-Time Track Mutation)
**Description:** Spend collected pickups to place ramps, walls, or shortcuts mid-race. Every lap becomes different because players build the track as they drive.
**Rationale:** No kart racer does this. Track.js already supports dynamic piece placement. The item system provides the trigger.
**Downsides:** Dynamic physics colliders untested at runtime. Balance is extremely hard.
**Confidence:** 55%
**Complexity:** High
**Status:** Unexplored

### 7. AI Personality Profiles
**Description:** Per-racer personality (aggressive line-cutter, cautious wide-liner, drift-happy, item-hoarder) that modulates waypoint targeting offsets, braking points, and item timing.
**Rationale:** 8 identical AI feel like traffic cones. Personality differences create emergent race stories. Waypoint/rubber-banding system provides the modulation surface.
**Downsides:** Tuning 4+ distinct profiles requires significant playtesting.
**Confidence:** 78%
**Complexity:** Medium
**Status:** Explored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Module lazy loading / import maps | Premature optimization — 32 ES modules load fast |
| 2 | Module registry with hot-reload | Massive scope for unclear payoff |
| 3 | Collapse 32 files into 6 barrels | Organizational churn without functional benefit |
| 4 | EventBus to replace CustomEvent | Over-engineering a solved problem |
| 5 | Remove Network.js | Destructive — multiplayer may be in progress |
| 6 | Reactive Proxy store for settings | Over-engineering; CustomEvent just completed |
| 7 | Input latency audit | Speculative — no evidence of complaints |
| 8 | Haptic language vocabulary | Inconsistent browser support |
| 9 | Physics as character stats | Fundamentally changes game balance |
| 10 | Collaborative single-kart | Very narrow audience |
| 11 | Spectators are players | Requires working multiplayer |
| 12 | Auto-pilot racing | Reframes game too fundamentally |
| 13 | Auto-scaffold tests from sliders | Generated tests aren't meaningful |
| 14 | AI teaching hints | Depends on per-piece metadata that doesn't exist |
| 15 | Vehicle variant data defs | Already addressed by Vehicle.spawn() in v0.20 |
| 16 | GameEngine lifecycle hooks | Overlaps main.js refactor |
| 17 | DevTools framework from DebugMenu | Scope explosion |
| 18 | Spectator mode with race director | Requires working multiplayer |

## Session Log
- 2026-04-01: Initial ideation — 37 raw ideas from 5 frames, 7 survived adversarial filtering
- 2026-04-01: Ideas #4 and #7 selected for implementation
