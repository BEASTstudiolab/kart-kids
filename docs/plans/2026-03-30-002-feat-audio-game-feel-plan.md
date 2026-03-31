---
title: "feat: Procedural engine audio and camera shake on collision"
type: feat
status: active
date: 2026-03-30
origin: docs/brainstorms/2026-03-30-audio-game-feel-requirements.md
---

# feat: Procedural Engine Audio + Camera Shake

## Overview

Replace the file-based engine sound with Web Audio oscillators mapped to vehicle speed, and add camera shake on collisions. Both changes target moment-to-moment game feel.

## Problem Frame

Collisions feel weightless (no visual feedback) and the engine sound can't be tuned in real-time. (see origin: docs/brainstorms/2026-03-30-audio-game-feel-requirements.md)

## Requirements Trace

- R1. Procedural engine via Web Audio oscillators, frequency mapped to speed, volume to throttle
- R2. Two oscillator layers (base + detuned overtone)
- R3. Smooth transitions — no clicks/pops, use gain ramping and frequency lerping
- R4. Keep skid.ogg and impact.ogg unchanged
- R5. Camera shake on collision — subtle, snappy, ~0.2s burst
- R6. Fixed shake intensity (not speed-proportional)
- R7. Rapid exponential decay

## Scope Boundaries

- No changes to skid or impact audio
- No screen flash or post-processing on collision
- No per-vehicle audio differentiation
- No mobile haptics

## Context & Research

### Relevant Code and Patterns

- **Audio.js** — `GameAudio` class. `init(camera)` creates `THREE.AudioListener`, loads engine/skid/impact files. `update(dt, speed, throttle, driftIntensity)` lerps volume/pitch. `playBeep()` already demonstrates raw Web Audio oscillator creation via `listener.context`. The engine sound uses `THREE.Audio` with `setBuffer/setLoop/setVolume/setPlaybackRate`.
- **Camera.js** — `Camera` class. `update(dt, target, vehicleQuaternion)` sets `this.camera.position` via `copy()` each frame in chase mode. Position is overwritten every frame — safe to add a temporary offset after the normal position computation.
- **main.js:contactListener** — `onContactAdded(bodyA, bodyB)` fires on physics collisions, already computes `impactVelocity` and calls `audio.playImpact()`. This is the integration point for camera shake.

### Institutional Learnings

None — no `docs/solutions/` exists.

## Key Technical Decisions

- **Sawtooth + triangle waveforms:** Sawtooth for the base oscillator (rich harmonics, engine-like buzz). Triangle for the detuned overtone (smoother, adds body without harshness). Both are natively supported by `OscillatorNode.type`.
- **Direct camera position offset for shake:** After `Camera.update()` computes the normal position, add a small random XYZ offset that decays exponentially. The camera position is recomputed from scratch each frame, so the offset never accumulates.
- **Replace engine THREE.Audio, keep oscillators on listener.context:** Remove the `engine.ogg` loader and `THREE.Audio` for engine. Create two `OscillatorNode`s connected through `GainNode`s to `listener.context.destination`. This matches the pattern already used in `playBeep()`.

## Open Questions

### Resolved During Planning

- **Oscillator waveform (R1):** Sawtooth base + triangle overtone. Sawtooth has the harmonic richness of an engine; triangle adds warmth without harshness.
- **Camera shake integration (R5):** Direct position offset on `this.camera.position` after the normal update. Applied in Camera.js via a `shake(intensity)` method and per-frame decay in `update()`.

### Deferred to Implementation

- **Exact frequency range:** Start with 80-400Hz for base, 160-800Hz for overtone. Tune by ear during testing.
- **Exact shake offset magnitude:** Start with 0.08 units. Tune visually.

## Implementation Units

- [ ] **Unit 1: Procedural Engine Audio**

  **Goal:** Replace engine.ogg with two Web Audio oscillators that respond to vehicle speed and throttle.

  **Requirements:** R1, R2, R3, R4

  **Dependencies:** None

  **Files:**
  - Modify: `js/Audio.js`

  **Approach:**
  - Remove the `engine.ogg` loader and `this.engineSound` (`THREE.Audio` instance)
  - In `init()`, after creating the listener, create two `OscillatorNode`s (sawtooth + triangle) each routed through a `GainNode` to `listener.context.destination`
  - Store references to oscillators and gains as instance properties
  - Start oscillators with gain at 0 (silent until audio context unlocked)
  - In `update()`, replace the engine pitch/volume section: lerp oscillator frequencies toward target based on `speedFactor`, lerp gain toward target based on `throttleFactor`
  - Use `setTargetAtTime` or direct value assignment with lerping for smooth transitions (no clicks)
  - Detune the second oscillator by ~7 cents for natural texture
  - Keep `checkReady()` — but now only check skid buffer (engine no longer needs a buffer)
  - Keep `startSounds()` — start oscillators when audio unlocks, start skid loop as before

  **Patterns to follow:**
  - `playBeep()` in Audio.js for raw Web Audio oscillator creation pattern
  - Existing `update()` lerping pattern for smooth transitions

  **Test scenarios:**
  - Happy path: At speed=0, engine oscillators are near-silent (gain ~0). At speed=1, frequency is at upper range and gain is audible.
  - Happy path: Throttle input increases gain smoothly, releasing throttle decreases gain smoothly.
  - Edge case: Audio context suspended (not yet unlocked) — oscillators created but silent, no errors thrown.
  - Edge case: Speed changes rapidly (dt spike) — frequency lerps smoothly, no audible clicks.

  **Verification:**
  - Drive the kart. Engine sound pitch rises with speed, falls when braking. No clicks or pops. Skid and impact sounds still work.

- [ ] **Unit 2: Camera Shake on Collision**

  **Goal:** Add a short, snappy camera shake when the vehicle hits a wall or another player.

  **Requirements:** R5, R6, R7

  **Dependencies:** None (independent of Unit 1)

  **Files:**
  - Modify: `js/Camera.js`
  - Modify: `js/main.js`

  **Approach:**
  - Add shake state to Camera: `_shakeIntensity` (float, starts at 0), `_shakeDecay` (constant, ~12-15 for fast exponential falloff)
  - Add `shake(intensity)` method that sets `_shakeIntensity = intensity`
  - In `update()`, after computing the final camera position, apply a random offset: `camera.position.x += (Math.random() - 0.5) * _shakeIntensity` (same for y and z). Then decay: `_shakeIntensity *= Math.exp(-_shakeDecay * dt)`
  - In `main.js`, inside `contactListener.onContactAdded`, after `audio.playImpact()`, call `cam.shake(0.08)`

  **Patterns to follow:**
  - `contactListener.onContactAdded` in main.js for the collision hook
  - Camera.update() position computation pattern

  **Test scenarios:**
  - Happy path: Hit a wall → camera jitters briefly → returns to smooth follow within ~0.2s.
  - Happy path: No collision → no shake, camera follows smoothly as before.
  - Edge case: Multiple rapid collisions → shake intensities don't stack unboundedly (each `shake()` call resets to the fixed intensity, doesn't add).
  - Edge case: Shake during spectator or isometric mode — offset still applies to camera.position.

  **Verification:**
  - Drive into a wall. See a brief camera jolt. Camera returns to normal quickly. Feels snappy, not nauseating.

## System-Wide Impact

- **Interaction graph:** Audio.js engine section is fully replaced; skid and impact paths unchanged. Camera.js gains shake state. main.js contactListener gains one additional call.
- **Unchanged invariants:** Skid audio, impact audio, camera follow behavior (aside from brief shake offset), all other game systems.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Oscillator engine sounds harsh or buzzy | Tune frequency range and gain curves during implementation. Can always revert to engine.ogg by restoring the loader. |
| Camera shake feels too much or too little | Single constant (0.08) — easy to tune. |
| Audio context timing issues with oscillator start | Match existing `playBeep()` pattern which already handles this. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-30-audio-game-feel-requirements.md](docs/brainstorms/2026-03-30-audio-game-feel-requirements.md)
- Related code: `js/Audio.js`, `js/Camera.js`, `js/main.js:contactListener`
