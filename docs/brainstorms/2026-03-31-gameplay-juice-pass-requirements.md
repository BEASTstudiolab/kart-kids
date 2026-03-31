---
date: 2026-03-31
topic: gameplay-juice-pass
---

# Gameplay Juice Pass

## Problem Frame

The kart racer has functional physics, racing, and multiplayer — but it feels like a tech demo. Key gameplay moments produce zero or minimal sensory feedback:

- **Wall impacts:** Sound plays, but the screen stays perfectly still.
- **Boost activation:** `topSpeed` changes silently. The underglow light exists but is hidden. No sound, no particles, no camera response.
- **Drifting:** A continuous float (`driftIntensity`) with no discrete states, no visual escalation, and no skill reward.
- **Speed variation:** Camera FOV and distance are static. 50 speed and 250 speed look identical through the lens.
- **Gamepad:** Input is read but no haptic feedback is sent.

This juice pass addresses all five gaps as one coherent layer, since the features share hooks (contact events, boost state, speed, drift intensity) and compose at key gameplay moments.

## Gameplay Moments Map

The juice pass fires at these moments — multiple systems respond to each:

```
Driving at speed    → Camera FOV widens, chase distance grows, haptic engine rumble
Drifting            → Escalating spark stages, smoke intensifies, body lean increases,
                      faster nitro fill, haptic buzz
Drift release (2+)  → Mini-boost (1-2s), spark burst
Wall impact         → Directional screen shake, wall spark particles, haptic spike
Boost activation    → FOV punch, particle burst, underglow ON, flame trail starts,
                      boost whoosh sound, haptic buzz
During boost        → Sustained FOV push (stacks with speed FOV), flame trail,
                      underglow stays lit, sustained haptic
Boost end           → FOV narrows back, flame trail fades, underglow OFF
```

## Requirements

**Camera — Speed-Reactive**

- R1. Lerp camera FOV from 40 (idle) toward ~55 at top speed, proportional to `|linearSpeed|`
- R2. Lerp chase distance from 6 toward ~8 at top speed
- R3. On boost activation, apply an additive FOV impulse (+10-15 degrees) that decays over ~300ms, on top of the speed-based FOV
- R4. Snap FOV and distance back faster on braking or collision than they ramp up (asymmetric easing)
- R5. Call `camera.updateProjectionMatrix()` each frame when FOV changes

**Camera — Screen Shake**

- R6. On wall impact (same event that triggers `audio.playImpact`), apply a camera position offset in the direction of the contact normal (`manifold.worldSpaceNormal`)
- R7. Shake magnitude scales with impact speed (the `speed` value already computed in `contactListener`)
- R8. Offset decays exponentially per frame (fast falloff, ~150-200ms to near-zero)
- R9. Clamp maximum shake amplitude to prevent motion sickness (max ~0.3 units displacement)

**Drift State Machine**

- R10. Discretize drift into stages based on *continuous* time above a threshold. New state on Vehicle: `driftStage` (0-3), `driftStageTimer` (seconds in current stage):
  - Stage 0: No drift (`driftIntensity` below threshold)
  - Stage 1: Light drift — white/blue sparks, entered after ~0.3s continuously above threshold
  - Stage 2: Medium drift — yellow sparks, entered after ~1.0s continuously in Stage 1 without dropping below threshold
  - Stage 3: Heavy drift — orange/red sparks, entered after ~1.5s continuously in Stage 2 without dropping below threshold
- R11. "Drift release" = `driftIntensity` drops below the threshold while at any stage. On release: if at Stage 2 or 3, grant mini-boost (R12) before resetting. Then reset `driftStage` to 0 and `driftStageTimer` to 0. Momentary dips reset — there is no grace period.
- R12. On drift release at Stage 2 or 3, grant a mini-boost: set a separate `miniBoostTimer` and `miniBoostTopSpeed` on Vehicle (~300 for Stage 2, ~350 for Stage 3, duration 1-2s). Mini-boost uses independent state from nitro boost — it does NOT directly mutate `debug.topSpeed`.
- R13. Each frame, effective top speed = `max(baseTopSpeed, nitroBoostTopSpeed if active, miniBoostTopSpeed if active)`. When any boost timer expires, recalculate from remaining active boosts. This prevents one boost's expiry from clobbering another.
- R14. During active drift (any stage), multiply the existing `boostDriftMultiplier` (currently 5) by an additional stage factor (e.g., Stage 1: 1x, Stage 2: 1.5x, Stage 3: 2x) for faster nitro meter fill
- R15. Body lean roll angle (`bodyLeanRoll` effect) intensifies per drift stage

**Particle Vocabulary**

- R16. **Wall sparks:** On local player's wall impact, emit a short burst of orange/yellow additive-blended sprites at the contact point, scattered outward from the contact normal. Short lifetime (~0.2s), affected by gravity. Local-player-only (remote player wall sparks are out of scope).
- R17. **Drift sparks:** Per-frame emission from rear wheels during drift, with color matching the current drift stage (white → yellow → orange). Small sprites, short lifetime, slight outward scatter.
- R18. **Boost flame trail:** During boost (nitro or mini-boost), emit a continuous flame-like particle trail from rear wheel positions. Hotter color than smoke (orange/red), additive blending, moderate lifetime (~0.3s).
- R19. **Boost activation burst:** On boost activation, emit a single radial burst of bright sparks behind the vehicle. Larger and more energetic than wall sparks.
- R20. Each particle type should be a standalone class following the same pattern as `SmokeTrails` (flat sprite array, ring-buffer emit index, per-frame update loop, sprite material clones). Do not pre-build a shared particle base class — extract a shared abstraction only if the implementations turn out nearly identical after all four are built.
- R21. Total active particle count across all emitters should stay under 200 sprites.

**Boost Activation Feedback**

- R22. Detect boost activation via a `wasBoostActive` flag on Vehicle, compared each frame in the game loop. On transition to true: enable the existing underglow light (a `PointLight` on the vehicle container). Change its color to a warm boost color (orange/amber, e.g., `0xff8800`) instead of the default cyan.
- R23. On transition to false: disable the underglow light, restore its color to default.
- R24. Play a boost activation sound using Web Audio oscillator synthesis (same pattern as `playBeep` in Audio.js). A short ascending frequency sweep (~0.3s).
- R25. The FOV punch (R3), particle burst (R19), boost sound (R24), and underglow toggle (R22) should all fire on the same frame. Use the single `wasBoostActive` transition check in the game loop to trigger all systems in one place, avoiding scattered independent transition detection.

**Gamepad Haptic Feedback**

- R26. Use `GamepadHapticActuator.playEffect()` when available; gracefully no-op when the API is absent. Store the active gamepad reference (or index) on each frame so haptic calls can be made from multiple sites (contact events, speed updates, boost activation).
- R27. Low continuous rumble proportional to `|linearSpeed|`. Since `playEffect()` is duration-based (not per-frame), re-trigger with updated intensity every ~100ms, not every frame.
- R28. Sharp impulse on wall impact, scaled by impact speed.
- R29. Sustained medium vibration during boost.
- R30. Brief pulse on drift stage transitions.

## Success Criteria

- A first-time player should feel a speed difference between idle and top speed without looking at the HUD
- Wall impacts should feel consequential — "I hit something" should register through camera, particles, sound, and haptics (if gamepad)
- Boost activation should feel like an event — a coordinated sensory "punch" across multiple channels
- Drifting should produce escalating visual feedback that communicates "keep holding this" and reward skillful release with a speed payoff
- All effects should compose cleanly when multiple events overlap (e.g., boost + wall hit + drift simultaneously)

## Scope Boundaries

- **In scope:** Camera FOV/distance/shake, drift state machine with mini-boost reward, particle types (wall sparks, drift sparks, boost flame, boost burst), boost visual/audio feedback, gamepad haptics
- **Out of scope:** Speed lines / radial blur, tire mark decals, hit-stop freeze frames, environment deformation, diegetic HUD, audio engine overhaul beyond boost sound, multiplayer-specific effects (drafting, proximity)
- **Not changing:** Existing engine audio pitch system, existing smoke trail behavior (SmokeTrails stays as-is alongside new particle types), existing body lean behavior (drift stages modulate the lean strength, not replace the system), physics constants

## Key Decisions

- **Drift reward = both mini-boost AND faster nitro fill:** Maximum reward for skilled drifting. Mini-boost is the immediate payoff; faster nitro fill is the strategic benefit. Risk of boost being too easy is mitigated by drift requiring sustained lateral sliding which slows the player.
- **Single implementation pass:** All 6 features built together so they compose properly from the start. Shared hooks (contact events, boost state, speed ratio) wire naturally when built as one layer.
- **Directional screen shake:** Uses the contact normal already available in `manifold.worldSpaceNormal` for shake direction. More immersive than random shake, trivially small additional cost.
- **Underglow color changes to warm orange during boost:** The existing cyan (0x00ffff) light doesn't communicate "boost." Orange/amber matches the flame trail and spark burst theme.

## Dependencies / Assumptions

- `manifold.worldSpaceNormal` in the contact listener provides a usable contact direction (verified: it does, and is already used to filter ground contacts)
- `GamepadHapticActuator` availability is browser-dependent; all haptic calls must be behind feature detection
- The sprite pool approach from SmokeTrails scales to 200 sprites without meaningful frame time cost on target hardware (browsers on desktop/mobile)

## Outstanding Questions

### Deferred to Planning

- [Affects R10][Technical] What exact `driftIntensity` threshold value should trigger Stage 1 entry? The current smoke threshold is 0.25; drift stages likely need a higher bar (~0.5-0.8) to avoid accidental triggering.
- [Affects R12][Technical] Exact mini-boost top speed values and duration per stage — the ranges here (300/350, 1-2s) need tuning in practice.
- [Affects R16][Technical] Should wall sparks use the existing `sprites/smoke.png` texture with a color tint, or a new small circle/dot texture? A tinted sprite is zero-asset-cost but may not read as "sparks."
- [Affects R20][Needs research] Optimal pool sizes per particle type — wall sparks need few (8-16), drift sparks need more (32-48), boost flame needs moderate (24-32). Exact sizes depend on emission rates.
- [Affects R24][Technical] Boost sound parameters (frequency sweep range, duration, waveform type). The `playBeep` pattern with a frequency sweep from 200→800Hz over 0.3s is a starting point.
- [Affects R16][Technical] Wall spark contact point extraction requires `getWorldSpaceContactPointOnA/B` from crashcat, which takes a manifold + contact index and needs body A/B identification to pick the wall-side point. Check `numContactPoints > 0` before extraction.
- [Affects R1-R5][Technical] `Camera.update()` currently takes `(dt, target, vehicleQuaternion)`. Speed-reactive FOV needs `linearSpeed` and `boostActive` — decide whether to pass vehicle state as additional params or pass the vehicle object.

## Next Steps

→ `/ce:plan` for structured implementation planning
