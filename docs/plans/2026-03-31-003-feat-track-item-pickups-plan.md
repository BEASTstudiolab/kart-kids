---
title: "feat: Add track item pickups with self-use powerups"
type: feat
status: completed
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-track-item-pickups-requirements.md
---

# feat: Add track item pickups with self-use powerups

## Overview

Add collectable item boxes distributed along the track that grant immediate self-use powerups: Speed Boost (common), Shield Bubble (medium), and Star/Invincibility (rare). Items auto-place via TrackIntel, trigger on drive-through, and respawn on a 10-second cooldown.

## Problem Frame

The track surface is inert — driving skill is the only variable. Self-use powerup pickups add moment-to-moment decisions about racing lines and create surprise/delight without requiring AI opponents or offensive item mechanics. (see origin: docs/brainstorms/2026-03-31-track-item-pickups-requirements.md)

## Requirements Trace

- R1. Item boxes auto-placed at regular intervals along TrackIntel waypoint chain
- R2. Item boxes rendered as visible 3D objects on the track
- R3. Boxes respawn on ~10s cooldown with fade-out/fade-in
- R4. Driving through a box triggers an immediate powerup — no inventory
- R5. Powerup type selected randomly from weighted table
- R6. Visual + audio feedback on pickup
- R7. Speed Boost (60%): instant mini-boost via existing miniBoostTimer system
- R8. Shield Bubble (30%): absorbs next wall collision, lasts ~5s or until hit
- R9. Star/Invincibility (10%): max speed + no wall penalty for ~3s
- R10. Per-player item state in multiplayer
- R11. Powerup effects visible on remote players

## Scope Boundaries

- No offensive items — self-use only
- No item inventory or manual activation
- No editor placement — auto-placement only
- No position-based or drift-meter-based weighting — fixed random weights
- Shield does not protect against falling off track

## Context & Research

### Relevant Code and Patterns

- **TrackIntel.getDistributedPositions(count)** — Returns evenly-spaced `{ x, z, forward }` positions along the track loop. Ideal for item placement. Already exists and is tested.
- **Vehicle.miniBoostTimer / miniBoostTopSpeed** — Existing mini-boost system with automatic `effectiveTopSpeed` integration. Speed Boost powerup can set these directly.
- **Vehicle.effectiveTopSpeed** — `Math.max(base, nitro, miniBoost)` — already handles multiple speed sources.
- **contactListener.onContactAdded (main.js:966)** — Wall impact handler. Shield interception inserts a guard before the impact effects.
- **Sprite pool pattern (WallSparks, BoostBurst)** — Pre-allocated sprite pool with ring buffer emit, per-frame update with life/velocity/fade. Follow BoostBurst for pickup burst VFX.
- **HUD display state pattern** — `raceMode.getDisplayState()` returns an object consumed by `hud.update()`. Extend with powerup fields.
- **Per-player VFX pattern (DriftSparks, BoostFlame)** — One instance per player entry in PlayerManager, updated in the per-player loop.

### Institutional Learnings

- Boost physics should not mutate `debug.topSpeed` directly — use `effectiveTopSpeed` / `miniBoostTimer` instead.
- Constructor injection + display state flow is the established module integration pattern.

## Key Technical Decisions

- **Distance-based overlap for pickup detection, not physics contacts:** Item boxes don't need rigid bodies. A simple XZ distance check per frame (~5-8 boxes) is cheaper and avoids polluting the crashcat contact listener with non-wall contacts.
- **Reuse miniBoostTimer for Speed Boost:** The existing `effectiveTopSpeed = Math.max(base, nitro, miniBoost)` formula already handles this. No new speed override system needed.
- **New Vehicle fields for shield/star state:** `vehicle.shieldActive`, `vehicle.shieldTimer`, `vehicle.starActive`, `vehicle.starTimer`. These are simple boolean+timer pairs decremented in Vehicle.update().
- **ItemBoxManager as a scene-level system:** Single instance created in main.js, updated in the game loop. Manages box meshes, respawn timers, and pickup detection. Follows the same pattern as WallSparks/BoostBurst (scene-level, not per-player).
- **Simple cube geometry for item boxes:** Rotating `THREE.BoxGeometry` with emissive material. No GLB model needed for v1 — keeps it simple and avoids asset pipeline work.

## Open Questions

### Resolved During Planning

- **How to place item boxes at consistent intervals?** Use `TrackIntel.getDistributedPositions(N)` which already interpolates evenly along cumulative arc-length. Solves clustering on short segments.
- **How to handle Y position of item boxes?** Place at a fixed height above the track group Y offset. The track is mostly flat (GRID_SCALE=1.0, trackGroup.position.y=-0.5), so a constant Y works for v1. Ramps/bumps may need raycast placement later.
- **Where in the game loop to check pickups?** After `playerManager.update()` (step 4) and before boost feedback (step 5). This ensures vehicle positions are current before overlap checks.

### Deferred to Implementation

- **Exact respawn fade animation curve:** Linear opacity fade is sufficient; tune during implementation.
- **Shield visual representation:** Could be a semi-transparent sphere mesh parented to vehicle container, or a color tint on the vehicle material. Decide during Unit 3 based on what looks best.
- **Star visual representation:** Flashing emissive material or golden color tint. Decide during Unit 3.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
Item Pickup Flow:

  TrackIntel.getDistributedPositions(N)
         │
         ▼
  ItemBoxManager (scene-level)
  ├── boxes[]: { mesh, position, available, cooldownTimer }
  ├── update(dt, activeVehicles)
  │   ├── For each box: decrement cooldownTimer, fade in when ready
  │   └── For each vehicle × each available box:
  │       └── if XZ distance < pickupRadius:
  │           ├── Roll weighted random → powerupType
  │           ├── Apply powerup to vehicle (speed/shield/star)
  │           ├── Emit pickup VFX + audio
  │           └── Set box.available = false, start cooldown
  └── dispose()

Powerup State (on Vehicle):
  shieldActive: bool, shieldTimer: float  → checked in contactListener
  starActive: bool, starTimer: float      → checked in contactListener + effectiveTopSpeed
  miniBoostTimer: float (existing)        → reused for Speed Boost

Display State Extension:
  raceMode.getDisplayState() adds:
    shieldActive, starActive → consumed by HUD for indicator
```

## Implementation Units

- [x] **Unit 1: ItemBoxManager — placement, rendering, respawn**

  **Goal:** Create and render item boxes at evenly-distributed positions along the track. Handle respawn cooldown with fade-out/fade-in.

  **Requirements:** R1, R2, R3

  **Dependencies:** None

  **Files:**
  - Create: `js/ItemBoxManager.js`
  - Modify: `js/main.js` (instantiate, wire into game loop)

  **Approach:**
  - Call `trackIntel.getDistributedPositions(N)` to get world positions. N = `Math.floor(trackIntel.count / 3)` (every ~3 cells).
  - For each position, create a small `BoxGeometry` mesh with emissive material, spinning via `rotation.y += dt * 2`.
  - Track per-box state: `{ mesh, available: true, cooldownTimer: 0 }`.
  - On pickup (Unit 2): set `available = false`, `cooldownTimer = 10`, fade mesh opacity to 0.
  - Each frame: decrement timer, when timer hits 0 set `available = true`, fade opacity back to 1.
  - Y position: place at `trackGroup.position.y + 1.5` (floating above track surface).

  **Patterns to follow:**
  - WallSparks constructor pattern for mesh creation and scene attachment.
  - BoostBurst `dispose()` pattern for cleanup.

  **Test scenarios:**
  - Happy path: ItemBoxManager creates N meshes at distinct world positions when constructed with TrackIntel
  - Happy path: Box mesh rotates each frame when update() is called
  - Edge case: Track with only 3 cells still places at least 1 item box
  - Happy path: After pickup, box becomes unavailable and cooldown timer starts at 10s
  - Happy path: After 10s cooldown, box becomes available again

  **Verification:**
  - Item boxes visible on track, floating and spinning. Picking one up (Unit 2) causes it to disappear and reappear after ~10 seconds.

- [x] **Unit 2: Pickup detection and powerup application**

  **Goal:** Detect when a vehicle drives through an available item box. Roll a weighted random powerup and apply its effect to the vehicle.

  **Requirements:** R4, R5, R7, R8, R9

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/ItemBoxManager.js` (add pickup check in update)
  - Modify: `js/Vehicle.js` (add shieldActive/Timer, starActive/Timer fields, decrement in update)

  **Approach:**
  - In `ItemBoxManager.update(dt, activeVehicles)`, for each available box, check XZ distance to each vehicle's `spherePos`. Pickup radius ~1.5 units.
  - On overlap: roll random `Math.random()` against weights (0-0.6 = speed, 0.6-0.9 = shield, 0.9-1.0 = star).
  - **Speed Boost:** Set `vehicle.miniBoostTimer = 2.0`, `vehicle.miniBoostTopSpeed = 300`. Reuses existing effectiveTopSpeed math.
  - **Shield:** Set `vehicle.shieldActive = true`, `vehicle.shieldTimer = 5.0`. Vehicle.update decrements timer and clears flag when expired.
  - **Star:** Set `vehicle.starActive = true`, `vehicle.starTimer = 3.0`. Vehicle.update decrements timer. While active, `effectiveTopSpeed` includes star speed (350). ContactListener skips wall penalty.
  - Add new Vehicle fields in constructor: `shieldActive = false`, `shieldTimer = 0`, `starActive = false`, `starTimer = 0`.
  - Add timer decrement block in Vehicle.update() after the boost/drift section.

  **Patterns to follow:**
  - Vehicle.miniBoostTimer decrement pattern (Vehicle.js lines 619-631).
  - effectiveTopSpeed Math.max pattern (Vehicle.js line 676).

  **Test scenarios:**
  - Happy path: Vehicle within 1.5 units of available box triggers pickup
  - Happy path: Speed Boost sets miniBoostTimer and miniBoostTopSpeed on vehicle
  - Happy path: Shield sets shieldActive = true and shieldTimer = 5.0
  - Happy path: Star sets starActive = true and starTimer = 3.0
  - Edge case: Vehicle outside pickup radius does not trigger pickup
  - Edge case: Unavailable box (on cooldown) does not trigger pickup
  - Happy path: Shield timer decrements and clears shieldActive when expired
  - Happy path: Star timer decrements and clears starActive when expired
  - Happy path: Star active adds star speed to effectiveTopSpeed calculation

  **Verification:**
  - Driving through a box applies one of the three powerup effects. Speed boost is noticeably faster. Shield/star timers count down and expire.

- [x] **Unit 3: Shield and star wall-collision interception**

  **Goal:** Shield absorbs the next wall hit without speed loss. Star prevents all wall collision penalties during its duration.

  **Requirements:** R8, R9

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `js/main.js` (contactListener.onContactAdded guard)

  **Approach:**
  - At the top of `contactListener.onContactAdded`, after the `vehicle.rigidBody` check and before the ground-contact filter:
    - If `vehicle.starActive`: return early (no impact effects at all).
    - If `vehicle.shieldActive`: set `vehicle.shieldActive = false`, `vehicle.shieldTimer = 0`, play a shield-break sound, return early (no speed loss, no sparks, no shake).
  - Star does not consume itself on hit — it lasts the full 3 seconds regardless of wall contacts.

  **Patterns to follow:**
  - Existing early-return guards in contactListener (ground filter, speed filter, cooldown).

  **Test scenarios:**
  - Happy path: With shield active, wall hit clears shield but produces no sparks/shake/speed-loss
  - Happy path: With star active, wall hit produces no effects and star remains active
  - Happy path: After shield consumed, next wall hit produces normal impact effects
  - Edge case: Shield + star both active — star takes priority (shield not consumed)

  **Verification:**
  - Drive into a wall with shield: no impact effects, shield indicator disappears. Drive into wall with star: no effects, star persists.

- [x] **Unit 4: Pickup VFX and audio**

  **Goal:** Visual particle burst and audio chime when picking up an item box.

  **Requirements:** R6

  **Dependencies:** Unit 2

  **Files:**
  - Create: `js/ItemPickupVFX.js`
  - Modify: `js/Audio.js` (add playItemPickup method)
  - Modify: `js/main.js` (instantiate VFX, wire pickup callback)

  **Approach:**
  - **VFX:** Follow BoostBurst sprite pool pattern. Pool of 12 sprites with `AdditiveBlending`. On pickup, emit radial burst at box position. Color varies by powerup type: blue for speed, green for shield, gold for star.
  - **Audio:** Add `playItemPickup()` to Audio.js following the `playBoostWhoosh()` oscillator pattern. Short ascending tone (~0.15s).
  - Wire into ItemBoxManager: pass VFX and audio references, call on pickup.

  **Patterns to follow:**
  - BoostBurst.js for sprite pool VFX (pool size, emit pattern, update lifecycle).
  - Audio.js playBoostWhoosh() for procedural Web Audio chime.

  **Test scenarios:**
  - Happy path: Picking up a box emits a visible particle burst at the box location
  - Happy path: Picking up a box plays an audible chime
  - Happy path: Particle burst color matches powerup type (blue/green/gold)
  - Edge case: Rapid successive pickups don't crash (ring buffer wraps)

  **Verification:**
  - Pickup produces a satisfying burst of colored particles and a distinct chime sound.

- [x] **Unit 5: HUD powerup indicator**

  **Goal:** Show the active powerup type and remaining duration on the HUD during racing.

  **Requirements:** R6, R8, R9

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `js/HUD.js` (add powerup indicator element)
  - Modify: `js/RaceMode.js` (extend getDisplayState with powerup fields)

  **Approach:**
  - Extend `RaceMode.getDisplayState()` to include `shieldActive`, `starActive` from the local vehicle.
  - In HUD constructor, create a small indicator element (positioned near the boost bar). Shows powerup icon/text + a shrinking timer bar.
  - In `_updatePowerupIndicator(displayState)`, show/hide based on active state. Color-code: green for shield, gold for star. Speed boost is too brief (~2s) to need a HUD indicator.
  - Hide during non-racing states.

  **Patterns to follow:**
  - HUD._updateBoostBar() pattern for state-driven DOM element updates.
  - Boost bar color switching logic.

  **Test scenarios:**
  - Happy path: Shield pickup shows green indicator with "SHIELD" text
  - Happy path: Star pickup shows gold indicator with "STAR" text
  - Happy path: Indicator disappears when powerup timer expires
  - Happy path: Speed Boost does not show a HUD indicator (too brief)
  - Edge case: Picking up a new powerup while one is active replaces the indicator

  **Verification:**
  - Active shield/star shows a visible indicator near the boost bar that fades when the effect expires.

- [x] **Unit 6: Multiplayer powerup sync**

  **Goal:** Sync powerup visual effects to remote players so shield glow and star flash are visible.

  **Requirements:** R10, R11

  **Dependencies:** Units 2, 5

  **Files:**
  - Modify: `js/Vehicle.js` (extend getState/setTargetState with powerup fields)
  - Modify: `js/PlayerManager.js` (read powerup state for remote vehicle visuals)
  - Modify: `server.js` (relay new fields in world broadcast)

  **Approach:**
  - Add `shield` and `star` booleans to `Vehicle.getState()` return object.
  - Add `shield` and `star` to `Vehicle.setTargetState()` parameters. In `updateRemote()`, set `shieldActive`/`starActive` from target state.
  - In server.js world broadcast, include `shield` and `star` fields in the per-player object (same pattern as other state fields).
  - In PlayerManager.update(), apply visual indicators (underglow color change, material tint) to remote vehicles based on their `shieldActive`/`starActive` state.
  - Item box state is per-player (R10) — remote players picking up a box doesn't affect local box availability.

  **Patterns to follow:**
  - Existing `boost` field sync pattern in Vehicle.getState()/setTargetState().
  - Remote boost state application in Vehicle.updateRemote() (line 433-441).

  **Test scenarios:**
  - Happy path: Remote player with shield active shows visual indicator on their vehicle
  - Happy path: Remote player with star active shows distinct visual indicator
  - Happy path: Local player picking up a box doesn't affect box availability for remote players
  - Edge case: Player disconnects while powerup is active — no stale visual on reconnect

  **Verification:**
  - In multiplayer, other players' shield/star effects are visible on their vehicles.

## System-Wide Impact

- **Interaction graph:** ItemBoxManager is called from main.js game loop. Powerup state lives on Vehicle. ContactListener reads shield/star state. HUD reads display state. Network syncs powerup booleans.
- **Error propagation:** If TrackIntel has no waypoints (broken track), ItemBoxManager should create zero boxes gracefully.
- **State lifecycle risks:** Powerup timers must reset on race restart (Vehicle reset path in PlayerManager.setSpectating toggle).
- **API surface parity:** Network state broadcast gains two new boolean fields — backward compatible (old clients ignore unknown fields).
- **Unchanged invariants:** Drift stage machine, boost/nitro system, g-force camera, and existing particle systems are unchanged. Speed Boost reuses miniBoostTimer without modifying the drift-release grant path.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Item box Y position wrong on bump tiles | Use constant Y for v1; revisit with raycast placement if visually jarring |
| Speed Boost overwrites drift-release mini-boost | Both write to same miniBoostTimer — use Math.max on timer to preserve the longer effect |
| Network backward compatibility | New fields are additive booleans defaulting to false — old clients ignore them |
| Performance with many boxes | N is typically 5-8 boxes per track; distance checks are O(players × boxes) which is trivial |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-31-track-item-pickups-requirements.md](docs/brainstorms/2026-03-31-track-item-pickups-requirements.md)
- Related code: `js/TrackIntel.js` (getDistributedPositions), `js/Vehicle.js` (miniBoostTimer, effectiveTopSpeed), `js/BoostBurst.js` (VFX pattern)
- Related ideation: `docs/ideation/2026-03-31-open-v015-ideation.md` idea #5
