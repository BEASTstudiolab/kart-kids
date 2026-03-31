---
date: 2026-03-31
topic: arcade-racing-features
focus: Features inspired by Diddy Kong Racing, Mario Kart, Disney Speedstorm, and Crash Team Racing — E for Everyone arcade feel with Tokyo drift circuit mechanics
---

# Ideation: Arcade Racing Features

## Codebase Context

- **Project shape:** Three.js + crashcat physics kart racer, ported from Godot 4.6. JS modules in `js/`, GLB models in `models/`, existing track editor at `editor.html`.
- **Current features:** Single-player racing, WebSocket multiplayer (4 players), dynamic track building from cell arrays, 4 vehicle colors, touch/keyboard/gamepad input, smoke particles, day/night lighting, bloom post-processing, TrackIntel waypoints/progress, race state machine + HUD (brainstormed).
- **Key physics:** crashcat sphere bodies with box wall colliders. Vehicle.js has `driftIntensity`, `boostMeter`, `boostDriftMultiplier` (5x), `steeringGripMin` (0.2) / `steeringGripMax` (1.0), `bodyLeanRoll`. Drift is approximated via steering grip curves, not rigid body torque. `gravityFactor: 0` on vehicle body.
- **Key gaps:** No dedicated drift input state, no item/weapon system, no AI opponents, no character roster, no progression/career, limited audio, basic VFX.
- **Inspiration games:** Diddy Kong Racing, Mario Kart, Disney Speedstorm, Crash Team Racing.
- **Past learnings:** No `docs/solutions/` directory exists yet.

## Ranked Ideas

### 1. Drift-to-Boost Chain System
**Description:** Holding a drift through corners builds a chain multiplier (1x -> 2x -> 3x -> 5x cap). Releasing the drift converts the accumulated meter into a boost burst. Chaining consecutive corners without wall contact multiplies the yield. Wall collision kills the chain entirely — high risk, high reward.
**Rationale:** This IS the game's core identity. Vehicle.js already has `driftIntensity`, `boostMeter`, and `boostDriftMultiplier` (currently 5x) — the scaffolding exists, only the chain counter and angular-velocity-based drift detection are missing. Every inspiration game (CTR especially) uses drift-to-boost as its primary skill expression.
**Downsides:** Tuning the chain decay rate and wall-kill threshold will require extensive playtesting. Too generous = no skill ceiling; too punishing = children can't complete a chain.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Unexplored

### 2. Character Archetypes with Drift Personas
**Description:** 4-6 named characters (mapped to existing vehicle colors) that modify drift-boost formula coefficients rather than raw stats. A "Drifter" has steeper chain multiplier growth but a tighter drift threshold window. A "Charger" builds boost from straights faster but can't chain past 2 corners. A "Trickster" unlocks higher item tiers at half-meter. Same underlying physics for all — different flywheel emphasis.
**Rationale:** DKR, Speedstorm, and CTR all rely on roster asymmetry for replayability. Modifying existing Vehicle.js `debug` object coefficients (`boostDriftMultiplier`, `driftThreshold`, `steeringGripMin/Max`) costs near-zero implementation and gives players identity investment. 4 vehicle color models already provide visual differentiation.
**Downsides:** Balance across archetypes is a multiplicative problem when combined with items (#3). Keep to 3-4 archetypes max to contain the tuning surface.
**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Unexplored

### 3. Item Box System with Boost Cascade
**Description:** Collidable item boxes on track grant power-ups, but the item tier is determined by the player's boost meter level at pickup — not race position. Empty meter = defensive items (shield, oil slick). Half meter = neutral (speed burst). Full meter = offensive (homing projectile, EMP). Skilled drifters who build meter before hitting a box get the best items.
**Rationale:** Items are genre-mandatory (all 4 inspiration games have them). The boost cascade twist fuses the drift skill loop into the item economy, making Kart Kids' items feel distinct from Mario Kart's pure-position randomness. The implementation is a single lookup table at the moment item collision fires.
**Downsides:** Item interactions with the existing boost system need explicit deconfliction (item-boost vs. drift-boost shouldn't stack multiplicatively). Item art assets needed.
**Confidence:** 85%
**Complexity:** Medium-High
**Status:** Unexplored

### 4. Hairpin Brake-to-Drift Entry
**Description:** A 100-200ms window after pressing brake at high speed triggers "snap oversteer" — rear grip drops to near zero, linearDamp spikes, kart rotates toward input direction faster than normal steering. Exiting early wastes it; exiting late = full spin. The timing is the skill expression. Beginners can ignore it entirely and drift normally.
**Rationale:** This is CTR's power-slide entry — the single most-cited mechanic from that game's competitive community. Vehicle.js already has the exact branch point (`targetSpeed < 0` while `linearSpeed > 0`) where this window inserts. No new systems required.
**Downsides:** The 100-200ms timing window may be too tight for mobile/touch input. Needs per-input-method tuning.
**Confidence:** 80%
**Complexity:** Low-Medium
**Status:** Unexplored

### 5. Momentum-Based Cornering Oversteer
**Description:** Above 60% of topSpeed, the steering grip curve falls off quadratically instead of linearly. The kart's turning radius widens at high speed, forcing players to brake or begin turning early. Entry speed into corners directly determines exit angle.
**Rationale:** A single formula change to the `steeringGrip` computation (already lerps between `steeringGripMin` 0.2 and `steeringGripMax` 1.0 based on speed). Makes karts feel like they have mass. Directly supports the Tokyo drift fantasy — you NEED to drift because grip steering fails at speed.
**Downsides:** May conflict with the drift chain system if the oversteer makes chaining too difficult. Needs co-tuning with #1.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 6. Ghost Intelligence Suite
**Description:** Three read-only systems sharing one recorded data buffer: (A) Ghost as AI — record player's physics state at 10Hz, replay as a translucent opponent using the existing `Vehicle.setTargetState` remote interpolation path. (B) Drift Tutor — post-race debrief comparing your drift chains to the ghost's, with a heat-color trail showing where/how long each drift was held. (C) Ghost Line Overlay — fastest-lap color-coded spline on the track surface (red=slow, green=fast).
**Rationale:** Solves single-player opponent, skill teaching, and racing line visualization with ONE recording system. The remote player interpolation infrastructure already exists. ~50KB per 3-minute lap at 10Hz. All three components are additive (no system interactions), making this the lowest-risk multi-feature on the list.
**Downsides:** Depends on the race state machine (lap detection) being implemented first. Ghost-as-AI won't work until lap recording works.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 7. Camera G-Force Lean & Focus Pull
**Description:** During high-speed cornering, camera FOV narrows by ~8 degrees and physically leans 3-5 degrees into the turn direction, using the existing `bodyLeanRoll` value as input. Subtle depth-of-field focus pull toward the nearest track edge. Communicates speed through camera feel rather than HUD numbers.
**Rationale:** One lerp per frame, zero game logic changes. `bodyLeanRoll` is already computed in Vehicle.js. Camera.js is a separate module that can consume the lean value. Bloom post-processing is already active. This is the cheapest, highest-impact feel improvement — it makes 200+ speed feel physically dangerous.
**Downsides:** Not a gameplay mechanic (it's a feel/juice feature). May cause motion sensitivity issues for some players — needs an accessibility toggle.
**Confidence:** 90%
**Complexity:** Low
**Status:** Explored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Wall-Kiss Rebound | Sphere-box contact detection too imprecise for glancing-angle threshold |
| 2 | Speed Pads w/ Diminishing Returns | Punishes the chaser more than the leader — inverts risk/reward |
| 3 | Slipstream Draft | Network interpolation lag makes 1.5s detection unreliable across WebSocket |
| 4 | Track Surface Evolution | crashcat cannot mutate static body friction at runtime; multiplayer desync |
| 5 | Blind Apex Prediction | All corners geometrically identical on flat GridMap; no information asymmetry |
| 6 | Rubber-Band AI | Destroys skill feedback; ghost-as-AI is the better answer |
| 7 | Jump Pad Tiles | gravityFactor:0 conflicts with Y-impulse; raycast fights artificial Y offset |
| 8 | Puddle/Surface Zones | Three physics personalities each need separate tuning; ice collapses into drift feel |
| 9 | Track-as-Invite-Code | Infrastructure/UX, not a game feature — worth building separately |
| 10 | Collective Drift Tempo Meter | Shared meter removes individual agency; degenerate ignore-strategy |
| 11 | Track Builder via Text | Visual editor already exists; text parsing is niche |
| 12 | Track Breathes (Cells Rotate) | Static body destruction/recreation violates crashcat model |
| 13 | Score-Based Racing | Breaks circuit structure; speed-at-finish is RNG-correlated |
| 14 | Headlights as Gameplay | Track too small for visibility to be skill-relevant |
| 15 | Always-On Multiplayer | Requires persistent server race loop; architectural rewrite |
| 16 | Spectator Interaction | Non-consented difficulty injection violates competitive integrity |
| 17 | Track URL Remix Chain | Requires backend track ancestry storage that doesn't exist |
| 18 | Browser Tab Split-Screen | Two tabs can't share WebGL/physics context |
| 19 | QR Code Track Sharing | QR scan to access a game already on a screen is backwards UX |
| 20 | Generative Audio | Procedural music from noisy per-frame data risks sounding terrible |
| 21 | Momentum Bank | Dominant strategy: never boost; math resolves to null operation |
| 22 | Environmental Resonance | Invisible causation; antisocial dominant strategy |
| 23 | Boost Compression | Maximum hold always optimal; no genuine decision |
| 24 | Drift Flywheel Ecosystem (combined) | Three-layer positive feedback spiral with no dampener; constituents kept individually |
| 25 | Living Track (combined) | Both constituent systems rejected independently |

## Session Log
- 2026-03-31: Initial arcade racing features ideation — 48 raw ideas from 6 agents, ~33 after dedupe + 3 cross-cutting combinations, 7 survived dual adversarial filtering (gameplay feasibility + systems balance)
- 2026-03-31: Brainstormed idea #7 (Camera G-Force Lean & Focus Pull)
