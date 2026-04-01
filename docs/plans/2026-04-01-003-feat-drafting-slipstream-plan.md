---
title: "feat: Drafting / slipstream speed boost"
type: feat
status: completed
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-drafting-slipstream-requirements.md
---

# Drafting / Slipstream Speed Boost

## Overview

Add a passive drafting mechanic: when any vehicle follows closely behind another and is roughly aligned, it receives a subtle speed boost (5-10%) that ramps up over ~1 second and decays over ~0.5 seconds. Visual feedback via faint speed-line particles behind the lead vehicle. Applies to all vehicles (player + AI). No active seeking behavior for AI.

## Problem Frame

Kart Kids has no inter-vehicle interaction beyond rubber-banding. Trailing positions are purely a deficit. Drafting adds a tactical layer where being behind becomes an opportunity, creates natural pack racing, and synergizes with the AI personality system — Aggressive AI that tailgates creates drafting opportunities. (see origin: docs/brainstorms/2026-04-01-drafting-slipstream-requirements.md)

## Requirements Trace

- R1. Draft detection: within ~3 units behind, forward dot > 0.8, within a cone behind the lead
- R2. Detection runs for all vehicles every frame
- R3. "Behind" means within a cone, not just proximity
- R4. 5-10% top speed increase, ramps over ~1s, decays over ~0.5s
- R5. Boost via a new `draftSpeedMultiplier` property (additive with rubber-banding)
- R6. Multiple vehicles can draft the same lead
- R7. Faint speed-line particles behind the lead vehicle
- R8. Subtle wind/whoosh audio when drafting
- R9. Feedback visible when player is drafting or being drafted
- R10. AI receives boost passively (no pathing changes)

## Scope Boundaries

- No active AI draft-seeking behavior
- No HUD indicator (speed lines are the feedback)
- No "draft break" mechanic
- No multi-chain bonus
- No changes to AI personality profiles or rubber-banding system

## Context & Research

### Relevant Code and Patterns

- **Vehicle.js:53** — `externalTopSpeedMultiplier` is owned by rubber-banding. Add a separate `draftSpeedMultiplier` property (default 1.0). Modify `effectiveTopSpeed` calc at line 709 to include it: `this.debug.topSpeed * (this.externalTopSpeedMultiplier || 1) * (this.draftSpeedMultiplier || 1)`
- **main.js:1175** — `allActiveVehicles` array built here. Drafting update runs right after this, consuming the array.
- **DriftSparks.js** — Reference pattern for per-vehicle particle VFX: constructor(scene), update(dt, vehicle), dispose(), sprite pool.
- **Audio.js** — Oscillator-based one-shot sounds (no loaded buffers). Wind whoosh can use filtered noise oscillator with gain modulation.
- **AIManager.js:145** — Rubber-banding sets `externalTopSpeedMultiplier`. Drafting sets `draftSpeedMultiplier` independently — no conflict.

### Institutional Learnings

- No `docs/solutions/` exists.

## Key Technical Decisions

- **New `draftSpeedMultiplier` property, not reusing `externalTopSpeedMultiplier`**: Rubber-banding owns `externalTopSpeedMultiplier` and resets it each frame for AI. A separate property avoids interference. Both multiply into the base-speed branch of `effectiveTopSpeed`: `this.debug.topSpeed * externalTopSpeedMultiplier * draftSpeedMultiplier`. **Intentionally**: the draft boost only affects cruising speed — during boost/star/mini-boost, `effectiveTopSpeed` resolves to `boostTopSpeed` (350) which already exceeds any draft-boosted cruising speed. This is correct: drafting during boost would be overpowered and the speed difference is the "slingshot" moment when you pull out of a draft to overtake.
- **DraftingSystem.js as a standalone module**: Contains the O(n^2) proximity check, per-vehicle draft state (intensity ramp/decay), and the speed multiplier application. Called from main.js like other per-frame systems. Keeps main.js from growing further.
- **Cone detection, not sphere**: "Behind" means the trailing vehicle's position projects into a cone behind the lead vehicle. The vector from lead to trailer points backward when the trailer is behind, so `dot(leadForward, leadToTrailer) < -0.5` (negative = behind). Combined with the alignment check `dot(leadForward, trailerForward) > 0.8` (both facing same direction), this prevents side-by-side vehicles from triggering drafts.
- **Speed lines as a localized particle effect**: A new `DraftLines.js` particle class following the DriftSparks pattern — emits faint directional streaks between the drafting pair. Not a post-processing screen effect (keeps it localized and cheap).
- **Generated noise buffer for audio, no asset file**: Web Audio `OscillatorNode` produces tones, not noise. Instead, create an `AudioBuffer` filled with random samples (white noise), play via `AudioBufferSourceNode` with `loop: true`, route through a `BiquadFilterNode` (bandpass, ~800-2000Hz for wind character) and a `GainNode`. The gain ramps with draft intensity using `linearRampToValueAtTime` to avoid clicks. This is a new audio pattern — existing Audio.js one-shots are fire-and-forget oscillators, and the engine sound uses a loaded .ogg buffer. The draft sound is a persistent generated-noise loop, managed as a long-lived node graph.

## Open Questions

### Resolved During Planning

- **Should drafting use `externalTopSpeedMultiplier`?** No — that's owned by rubber-banding. Use a separate `draftSpeedMultiplier` property. Both multiply together in `effectiveTopSpeed`.
- **Where in the game loop?** After `allActiveVehicles` is built (main.js:1177), before `raceMode.update()`. The drafting system consumes the same vehicle array.

### Deferred to Implementation

- **Exact cone angle and ramp/decay curves**: Start with cone dot > 0.5, distance < 3.0, ramp 1.0s, decay 0.5s, max multiplier 1.08. Tune from gameplay.
- **Speed line particle count and lifetime**: Start with 8-12 sprites per draft pair, 0.3s lifetime. Tune visually.

## Implementation Units

- [ ] **Unit 1: Create DraftingSystem.js — detection and speed modulation**

  **Goal:** Detect drafting pairs among all vehicles and apply speed multipliers with ramp/decay.

  **Requirements:** R1, R2, R3, R4, R5, R6, R10

  **Dependencies:** None

  **Files:**
  - Create: `js/DraftingSystem.js`
  - Modify: `js/Vehicle.js` (add `draftSpeedMultiplier` property, include in effectiveTopSpeed calc)

  **Approach:**
  - Export a `DraftingSystem` class with `update(dt, activeVehicles)` method
  - For each vehicle pair (O(n^2), n max 9): check if vehicle B is behind vehicle A using cone detection:
    - Compute lead vehicle's forward vector from quaternion
    - Compute direction from lead to trailer
    - Check: `dot(leadForward, leadToTrailer) < -0.5` (trailer is behind) AND `distance < 3.0` AND `dot(leadForward, trailerForward) > 0.8` (aligned)
  - Maintain a `Map<vehicle, { intensity, leadVehicle }>` of active drafts
  - At the start of each `update()`, reset `draftSpeedMultiplier` to 1.0 for all vehicles in `activeVehicles` (ensures cleanup on race reset without external callers)
  - Ramp intensity toward 1.0 at rate `dt / rampTime`, decay toward 0.0 at rate `dt / decayTime`
  - Apply: `vehicle.draftSpeedMultiplier = 1.0 + maxBoost * intensity` (maxBoost ~0.08 for 8%)
  - Export a `getActiveDrafts()` method that returns the internal draft state Map for consumption by DraftLines in Unit 3
  - On Vehicle.js: add `this.draftSpeedMultiplier = 1.0` in constructor, multiply into effectiveTopSpeed alongside externalTopSpeedMultiplier

  **Patterns to follow:**
  - AIManager rubber-banding pattern — per-vehicle speed multiplier set each frame
  - Module-level THREE.Vector3 temporaries for zero-allocation math (like AIController)

  **Test scenarios:**
  - Happy path: vehicle B directly behind vehicle A at distance 2.0 and aligned → draft intensity ramps to 1.0 over 1s
  - Happy path: draft intensity at 1.0 → draftSpeedMultiplier = 1.08 → effectiveTopSpeed increases by 8%
  - Happy path: vehicle B moves out of cone → intensity decays to 0 over 0.5s
  - Happy path: two vehicles draft the same lead simultaneously → both get independent boosts
  - Edge case: vehicle beside another (not behind) → no draft triggered despite proximity
  - Edge case: vehicle behind but facing opposite direction → no draft (alignment check fails)
  - Edge case: distance exactly at threshold (3.0) → draft barely active
  - Integration: draftSpeedMultiplier * externalTopSpeedMultiplier both affect effectiveTopSpeed correctly

  **Verification:**
  - Following closely behind any kart for 1 second produces a speed increase
  - Pulling away from the draft decays the boost smoothly
  - Side-by-side karts don't trigger drafting

- [ ] **Unit 2: Add DraftLines.js — speed-line particle VFX**

  **Goal:** Faint directional speed-line particles between drafting pairs.

  **Requirements:** R7, R9

  **Dependencies:** Unit 1 (needs draft state to know when to emit)

  **Files:**
  - Create: `js/DraftLines.js`

  **Approach:**
  - Follow the DriftSparks.js sprite-pool pattern: constructor(scene), update(dt, draftPairs), dispose()
  - Pool of 16-24 elongated sprites (thin, bright, short-lived ~0.3s)
  - When a draft is active, emit sprites between the lead vehicle's rear and the trailing vehicle's front
  - Sprites travel in the lead vehicle's forward direction, fade with alpha over lifetime
  - Intensity (emission rate + alpha) scales with draft intensity from Unit 1

  **Patterns to follow:**
  - DriftSparks.js — sprite pool, scene-attached particles, per-frame update

  **Test scenarios:**
  - Happy path: active draft produces visible speed-line particles between the two vehicles
  - Happy path: particles fade when draft ends (decay period)
  - Edge case: multiple simultaneous drafts produce independent particle streams

  **Verification:**
  - Speed lines appear when tailgating another kart
  - Lines disappear smoothly when pulling out of the draft

- [ ] **Unit 3: Wire DraftingSystem into main.js + audio feedback**

  **Goal:** Integrate drafting system into the game loop, add wind audio, wire VFX for all vehicles.

  **Requirements:** R2, R8, R9

  **Dependencies:** Units 1, 2

  **Files:**
  - Modify: `js/main.js`
  - Modify: `js/Audio.js`

  **Approach:**

  **main.js:**
  - Import DraftingSystem and DraftLines
  - Create instances during init (after scene is available)
  - In animate(): after allActiveVehicles is built, call `draftingSystem.update(dt, allActiveVehicles)`
  - Call `draftLines.update(dt, draftingSystem.getActiveDrafts())` in the VFX update section
  - Pass player's draft intensity to audio update

  **Audio.js:**
  - Add a wind whoosh using a generated noise AudioBuffer (fill with random samples), played via looping AudioBufferSourceNode, routed through BiquadFilter (bandpass ~800-2000Hz) and GainNode
  - Add `updateDraft(intensity)` method that modulates the noise gain from 0 to a subtle volume
  - Call from main.js after drafting update

  **Patterns to follow:**
  - Existing VFX wiring in main.js (smokeTrails, driftSparks, boostFlame, etc.)
  - Audio.js oscillator-based sounds pattern (playBoostWhoosh, etc.)

  **Test scenarios:**
  - Happy path: drafting behind a kart produces audible wind whoosh that ramps with intensity
  - Happy path: wind sound fades when draft is lost
  - Integration: full chain — vehicle follows another → DraftingSystem detects → speed boost applied → DraftLines emit → audio plays

  **Verification:**
  - Complete drafting experience: follow kart → see speed lines → hear wind → feel speed boost → pull out to overtake

## System-Wide Impact

- **Interaction graph:** DraftingSystem.update() reads vehicle positions and sets draftSpeedMultiplier. Vehicle.effectiveTopSpeed reads the multiplier. DraftLines reads draft state. Audio reads player draft intensity. No callbacks or events.
- **Error propagation:** If DraftingSystem fails, draftSpeedMultiplier stays at 1.0 (no effect). Safe degradation.
- **State lifecycle risks:** draftSpeedMultiplier must be reset to 1.0 on race reset. Add to AIManager.resetRace() and main.js race reset handler.
- **Unchanged invariants:** Rubber-banding via externalTopSpeedMultiplier is unaffected. AI personality profiles are unaffected. The input shape `{ x, z, touchActive, boost }` is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| O(n^2) proximity check with 9 vehicles | 9^2 = 81 iterations of simple dot products — trivially within budget |
| Draft boost stacking with rubber-banding creates runaway speeds | Max multiplier is 1.08 (8%). Combined with max rubber-band 1.3: 250 * 1.3 * 1.08 = 351. During boost/star, effectiveTopSpeed resolves to boostTopSpeed (350) which wins the Math.max — draft has no effect during boost. Draft only matters at cruising speed, which is the intended "slingshot" moment. |
| Speed lines VFX budget with 8 simultaneous drafts | Pool is capped at 16-24 sprites total (not per draft). Shared pool limits worst case. |
| Audio loop starts/stops cause clicks | Use gain ramp (not abrupt on/off) — same technique as existing engine sound |

## Sources & References

- Origin: [docs/brainstorms/2026-04-01-drafting-slipstream-requirements.md](docs/brainstorms/2026-04-01-drafting-slipstream-requirements.md)
- Related code: `js/Vehicle.js`, `js/AIManager.js`, `js/DriftSparks.js`, `js/Audio.js`, `js/main.js`
- Related PRs: #6 (AI personalities), #7 (quality presets)
