---
date: 2026-03-31
topic: track-item-pickups
---

# Track Item Pickups

## Problem Frame

Kart Kids has a race loop, drift mechanics, and boost system, but the track itself is inert — driving skill is the only variable. There are no interactive elements on the track surface to create moment-to-moment decisions or surprise. Self-use powerup pickups add strategic variety to racing lines without requiring AI opponents or offensive item mechanics.

## Requirements

**Item Box Placement**
- R1. Item boxes are placed automatically at regular intervals along the TrackIntel waypoint chain (e.g., every 3rd waypoint). Works on any track including custom and future procedural tracks.
- R2. Item boxes are rendered as visible 3D objects on the track surface (spinning box or floating cube, visually distinct from track geometry).
- R3. Item boxes respawn on a ~10-second cooldown after being collected. They fade out on pickup and fade back in when available.

**Pickup Behavior**
- R4. Driving through an item box triggers an immediate self-use powerup effect — no inventory, no holding, no manual activation.
- R5. Powerup type is selected randomly from a weighted table on each pickup.
- R6. A brief visual + audio cue plays on pickup (particle burst, chime sound).

**Powerup Types**
- R7. **Speed Boost** (common, ~60% weight): Instant burst of speed equivalent to a stage-2 mini-boost. Uses the existing miniBoostTimer/miniBoostTopSpeed system.
- R8. **Shield Bubble** (medium, ~30% weight): Absorbs the next wall collision without speed loss. Visual indicator (colored glow or bubble around kart). Lasts ~5 seconds or until a wall hit, whichever comes first.
- R9. **Star / Invincibility** (rare, ~10% weight): Max speed + no wall collision speed penalty for ~3 seconds. Distinct visual (flashing kart or golden glow) and audio (ascending tone or jingle).

**Multiplayer**
- R10. In multiplayer, item box state (collected/available) is per-player — one player collecting a box does not affect others.
- R11. Item box state syncs via the existing 20Hz WebSocket broadcast. Active powerup effects (shield glow, star flash) are visible on remote players.

## Success Criteria

- Solo player encounters 3-5 item boxes per lap on the default track
- Each powerup type has a noticeable, distinct effect on gameplay
- Picking up an item feels rewarding (audio + visual feedback)
- Items don't break the existing drift/boost skill loop — they complement it

## Scope Boundaries

- No offensive items (projectiles, traps, etc.) — self-use only
- No item inventory or manual activation — instant trigger on pickup
- No editor placement — auto-placement only for v1
- No position-based or drift-meter-based item weighting — pure random with fixed weights
- Shield does not protect against falling off track

## Key Decisions

- **Self-use only:** No AI opponents exist yet. Self-use powerups provide value in both solo and multiplayer without requiring target selection or projectile physics.
- **Random weighted tier:** Simplest implementation. Drift-meter gating or position-based weighting are future enhancements.
- **Auto-placement via TrackIntel:** Ensures every track has items without requiring editor changes or manual placement data in track URLs.
- **Per-player item state:** In multiplayer, boxes are independently available to each player. Avoids the complexity of shared-state item contention and ensures fairness.
- **Instant trigger:** No inventory UI, no held-item display, no activation button. Reduces scope and keeps the controls simple.

## Dependencies / Assumptions

- TrackIntel waypoint chain is stable and available for all track configurations
- Existing mini-boost system (miniBoostTimer, miniBoostTopSpeed) can be reused for Speed Boost powerup
- Wall collision contact listener in main.js can be extended to check for active shield

## Outstanding Questions

### Deferred to Planning
- [Affects R2][Needs research] What 3D representation works best for item boxes? Options: simple cube geometry, sprite, or GLB model. Consider performance with many boxes on track.
- [Affects R3][Technical] How to implement per-box cooldown timer efficiently — per-box state array or pooled approach?
- [Affects R8][Technical] How to suppress wall collision speed loss during shield — intercept in contactListener or in Vehicle.js?
- [Affects R10][Technical] What minimal data needs to be added to the 20Hz network broadcast for item state sync?

## Next Steps

-> /ce:plan for structured implementation planning
