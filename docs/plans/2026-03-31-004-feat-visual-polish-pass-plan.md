---
title: "feat: Visual polish pass — tire marks + spring-physics UI"
type: feat
status: completed
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-visual-polish-pass-requirements.md
---

# feat: Visual polish pass — tire marks + spring-physics UI

## Overview

Two visual polish features: (1) persistent tire mark ribbons from rear wheels during drifts, and (2) damped spring animations on all HUD element transitions. Both address the gap between gameplay depth and visual feedback quality.

## Problem Frame

Drifting produces sparks but leaves no trace on the track. HUD elements appear/disappear instantly with no animation weight. (see origin: docs/brainstorms/2026-03-31-visual-polish-pass-requirements.md)

## Requirements Trace

- R1. Rear wheels leave visible marks during drifts and heavy braking
- R2. Marks persist for the entire race
- R3. Mark width scales with drift intensity
- R4. Marks rendered as ribbon geometry
- R5. Visible for all players in multiplayer
- R6. Marks clear on race restart
- R7. All HUD value changes animate with damped spring physics
- R8. Affected: countdown, lap counter, boost bar, powerup indicator, race time, results
- R9. Spring magnitude responds to change size
- R10. Consistent spring parameters across all elements

## Scope Boundaries

- No marks during normal straight-line driving
- No surface-type coloring (all marks dark gray)
- No per-player mark colors
- Spring UI is DOM CSS transforms, not WebGL
- No spring on non-HUD elements

## Key Technical Decisions

- **Ribbon geometry via BufferGeometry with ring buffer (4000 segments per player):** Each segment is a quad between the current and previous wheel positions, width scaled by driftIntensity. Ring buffer prevents unbounded growth while handling any race length.
- **Per-player TireMarks in PlayerManager:** Follow the DriftSparks pattern — one instance per player entry, updated in the per-player loop. Gives remote players marks too.
- **Reusable SpringAnimator class:** A ~25 line damped harmonic oscillator utility. Each HUD element gets its own spring instance. Spring drives CSS `transform: scale()` and/or `translateY()`.
- **Spring on value change, not every frame:** Springs activate when the target value changes, then settle. No per-frame cost when at rest.

## Open Questions

### Resolved During Planning

- **Ring buffer size:** 4000 segments per player — handles a 3-lap race with continuous drifting at 60fps.
- **Remote player marks:** Yes, via PlayerManager per-player pattern (same as DriftSparks).
- **Spring utility location:** New `js/SpringAnimator.js` — reusable across HUD elements.

### Deferred to Implementation

- **Exact mark opacity/color values:** Tune visually during implementation.
- **Spring stiffness/damping constants:** Start with k=150, d=12 (snappy with slight overshoot), tune by feel.

## Implementation Units

- [ ] **Unit 1: TireMarks ribbon geometry**

  **Goal:** Create a ribbon mesh that extrudes along rear wheel ground contact paths during drifts.

  **Requirements:** R1, R2, R3, R4, R6

  **Dependencies:** None

  **Files:**
  - Create: `js/TireMarks.js`

  **Approach:**
  - Pre-allocate a BufferGeometry with 4000 * 6 vertices (2 triangles per segment quad). Use a write index that wraps.
  - Each frame during drift (vehicle.driftStage > 0), sample both rear wheel world positions via `getWorldPosition()`. Emit a quad between previous and current positions.
  - Quad width = base width (0.04) * clamp(driftIntensity, 0.5, 2.0) for R3.
  - Material: `MeshBasicMaterial` with dark gray color (0x222222), opacity 0.6, transparent, depthWrite false.
  - `clear()` method zeros the write index and hides all geometry — called on race restart for R6.
  - `dispose()` removes mesh from scene and disposes geometry/material.

  **Patterns to follow:**
  - DriftSparks.js for per-player lifecycle and wheel world position sampling.
  - Three.js BufferGeometry with dynamic draw range for ring-buffer rendering.

  **Test scenarios:**
  - Happy path: Drifting around a corner produces visible dark marks on the track surface
  - Happy path: Mark width is wider during intense drifts than gentle drifts
  - Happy path: Marks persist after the kart drives away
  - Edge case: Ring buffer wraps — oldest marks disappear when buffer is full
  - Happy path: clear() removes all visible marks

  **Verification:**
  - After drifting through a corner, dark tire marks are visible on the track behind the kart. After 3 laps, the racing line is visually drawn on the track.

- [ ] **Unit 2: Wire TireMarks into PlayerManager**

  **Goal:** Create per-player TireMarks instances and update them in the player loop. Clear on race restart.

  **Requirements:** R5, R6

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/PlayerManager.js` (add TireMarks per player, update in loop, dispose on remove)
  - Modify: `js/main.js` (clear marks on race restart if needed)

  **Approach:**
  - Add `tireMarks: new TireMarks(scene)` to each player entry alongside smokeTrails/driftSparks/boostFlame.
  - In the per-player update loop, call `entry.tireMarks.update(dt, entry.vehicle)`.
  - On `removeRemotePlayer`, call `entry.tireMarks.dispose()`.
  - On race restart (setSpectating toggle), call `entry.tireMarks.clear()`.

  **Patterns to follow:**
  - DriftSparks integration pattern in PlayerManager (constructor, update loop, dispose, spectate toggle).

  **Test scenarios:**
  - Happy path: Local player leaves tire marks during drifts
  - Happy path: Remote player's drifts also produce visible tire marks
  - Happy path: Race restart clears all tire marks
  - Edge case: Player disconnect disposes tire marks cleanly

  **Verification:**
  - In multiplayer, both local and remote player drifts leave visible tire marks. Restarting the race clears all marks.

- [ ] **Unit 3: SpringAnimator utility**

  **Goal:** Create a reusable damped spring animator for driving HUD element transitions.

  **Requirements:** R7, R9, R10

  **Dependencies:** None

  **Files:**
  - Create: `js/SpringAnimator.js`

  **Approach:**
  - Damped harmonic oscillator: `acceleration = -k * (position - target) - d * velocity`. Semi-implicit Euler integration.
  - Constructor takes `stiffness` (default 150) and `damping` (default 12).
  - `setTarget(value)` — sets the target rest position. The delta between old and new target determines bounce magnitude (R9).
  - `update(dt)` — advances the spring. Returns current value. When velocity and displacement are below threshold (0.001), snaps to target (at rest).
  - `isAtRest()` — returns true when settled.
  - `reset(value)` — instantly sets position and target with zero velocity.

  **Patterns to follow:**
  - Simple utility class pattern like the existing `lerpAngle` function in Vehicle.js — pure math, no dependencies.

  **Test scenarios:**
  - Happy path: Setting a new target causes the value to overshoot then settle
  - Happy path: Larger target delta produces larger overshoot (R9)
  - Happy path: Spring eventually reaches rest (isAtRest returns true)
  - Edge case: Very small target change settles quickly without visible bounce

  **Verification:**
  - SpringAnimator produces smooth overshoot-settle curves when target changes, and rests cleanly without jitter.

- [ ] **Unit 4: Apply spring animations to HUD elements**

  **Goal:** Replace instant value changes in HUD with spring-driven CSS animations.

  **Requirements:** R7, R8, R10

  **Dependencies:** Unit 3

  **Files:**
  - Modify: `js/HUD.js` (create SpringAnimator instances, apply to element transforms)

  **Approach:**
  - Create SpringAnimator instances for: countdown number (scale), lap counter (scale), boost bar fill (scaleX — not the width%, apply spring to a wrapper transform), powerup indicator (scale on appear/disappear), results text (translateY on slide-in).
  - In `update()`, call each spring's `update(dt)` and apply the resulting value as a CSS transform.
  - For countdown: on number change, set spring target to 1.0 from an initial 1.4 (scale punch in then settle).
  - For lap counter: spring target 1.0 from 1.3 on lap change.
  - For powerup indicator: spring target 1.0 from 0 on appear, spring to 0 on disappear.
  - HUD needs `dt` passed into `update()` — extend the call signature if not already present.

  **Patterns to follow:**
  - Existing HUD `_updateBoostBar` pattern for state-driven DOM updates.
  - Existing countdown `countPunch` CSS animation — replace with spring-driven scale.

  **Test scenarios:**
  - Happy path: Countdown numbers bounce in with overshoot when they change
  - Happy path: Lap counter bounces when lap increments
  - Happy path: Powerup indicator springs in on pickup and springs out on expiry
  - Happy path: All spring animations use consistent stiffness/damping
  - Edge case: Rapid successive changes (e.g., countdown 3→2→1→GO) each trigger their own spring

  **Verification:**
  - Every HUD element change has a visible, satisfying overshoot-settle animation. The feel is consistent and cohesive, not noisy.

## System-Wide Impact

- **Interaction graph:** TireMarks is per-player in PlayerManager, same lifecycle as DriftSparks. SpringAnimator is consumed only by HUD.js. No cross-system dependencies.
- **State lifecycle:** Tire marks clear on race restart via PlayerManager.setSpectating. Spring states reset when HUD transitions between race states.
- **Performance:** Tire mark ribbon geometry is one draw call per player with a bounded vertex count. Springs are pure math with no DOM cost when at rest.
- **Unchanged invariants:** DriftSparks, BoostFlame, and all existing particle systems are unchanged. HUD layout and positioning remain the same — only transitions change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tire mark geometry z-fighting with track surface | Set renderOrder or slight Y offset (0.01) above track |
| Spring animations feel too bouncy or distracting | Tunable k/d constants, start conservative (k=150, d=12) |
| HUD.update() needs dt but may not receive it | Check call signature — extend if needed |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-31-visual-polish-pass-requirements.md](docs/brainstorms/2026-03-31-visual-polish-pass-requirements.md)
- Related code: `js/DriftSparks.js` (per-player VFX pattern), `js/HUD.js` (DOM update pattern), `js/PlayerManager.js` (per-player lifecycle)
- Related ideation: `docs/ideation/2026-03-31-open-v015-round2-ideation.md` ideas #4, #9
