---
date: 2026-03-31
topic: camera-g-force
---

# Camera G-Force Lean & FOV Effects

## Problem Frame

Kart Kids communicates speed through HUD numbers and particle trails, but the camera itself is static during cornering and boost. Players don't *feel* the Tokyo drift sensation through the camera. Console kart racers use camera lean, FOV shifts, and motion cues to make speed visceral — Kart Kids has none of these. This is the cheapest, highest-impact feel improvement available: zero game logic changes, pure camera animation.

## Requirements

**Cornering Effects (chase camera only)**

- R1. During cornering, the camera leans into the turn direction by up to 3-5 degrees. The input signal is the vehicle's body lean expression `-(inputX / bodyLeanRoll) * linearSpeed`, which peaks at ~0.2 radians (~11.5 degrees). This must be scaled down to the 3-5 degree target range (initial multiplier: ~0.35 of the raw signal).
- R2. During cornering, the camera FOV narrows from the base 40 degrees down to approximately 32 degrees, proportional to the absolute lean intensity normalized to [0, 1] (where 0 = no lean, 1 = maximum lean at full speed + full steering). Formula: `targetFOV = baseFOV - 8 * clamp(abs(leanSignal) / maxLeanSignal, 0, 1)`.
- R3. Both lean and FOV changes are smoothly interpolated (lerp) to avoid jarring snaps. The attack rate (leaning in) should be faster than the release rate (returning to neutral) to feel responsive entering a turn and smooth exiting. `camera.updateProjectionMatrix()` must be called after any FOV change for it to take effect.

**Boost Effects (chase camera only)**

- R4. When boost activates (`boostActive` transitions from false to true), the camera FOV briefly widens from base 40 to approximately 48-50 degrees as a "speed punch," then smoothly returns to base over ~0.5s. Camera must track `prevBoostActive` to detect the rising edge — reading `boostActive` every frame without edge detection would produce a sustained widen instead of a punch.
- R5. The boost FOV widen is a one-shot punch on activation, not sustained. FOV is computed as additive offsets: `baseFOV + boostDelta - corneringDelta` where boostDelta starts at +8 and decays to 0, and corneringDelta ranges from 0 to 8. During the punch, boost's positive offset partially counteracts cornering's negative offset. As the punch decays, cornering narrowing takes over naturally.

**Accessibility**

- R6. A toggle in the settings or debug panel disables all camera G-force effects (lean + FOV changes), returning the camera to its current static behavior. Default: effects ON.

**Scope exclusions**

- R7. Effects apply only in chase camera mode. Isometric mode is unchanged. When switching from chase to isometric mode (T key), FOV and camera roll must reset to base values (FOV=40, roll=0) immediately to prevent isometric view inheriting a distorted state.
- R8. No depth-of-field or bokeh effects. No new post-processing passes.

## Success Criteria

- Cornering at speed produces a visible, smooth camera lean and FOV narrowing that communicates the drift's intensity without any HUD change.
- Boost activation produces a perceptible "speed rush" FOV punch.
- Disabling the accessibility toggle returns the camera to identical pre-feature behavior.
- No measurable frame-rate impact (effects are one lerp per frame each).

## Key Decisions

- **FOV + lean only, no DOF**: Depth-of-field would require adding a BokehPass to the post-processing pipeline. Deferred to a future polish pass.
- **Chase camera only**: Isometric mode is a static overhead view where lean would look visually wrong.
- **Boost FOV is a punch, not sustained**: A sustained wide FOV during boost would conflict with cornering FOV narrow if the player drifts during boost.
- **Asymmetric lerp rates**: Faster attack than release matches the physical sensation of being thrown into a turn and gradually settling out.

## Dependencies / Assumptions

- Camera.js `update()` already receives `vehicleQuaternion` and `dt` — no new data pipeline needed.
- Vehicle state will be passed to Camera by expanding the `camera.update()` call in main.js to include a vehicle state object: `cam.update(dt, target, quaternion, { inputX, linearSpeed, boostActive, bodyLeanRoll })`. This avoids coupling Camera to Vehicle's internal structure while keeping the call site explicit. The call site at main.js already has direct access to `followVehicle`.

## Outstanding Questions

### Deferred to Planning
- [Affects R1, R3][Technical] Exact lerp rates for attack/release — needs playtesting. Start with attack=10, release=4 as initial values and tune from there.
- [Affects R1, R2][Technical] Exact lean-to-camera scaling multiplier and FOV mapping constants — start with values in R1/R2, tune from there.

## Next Steps

-> /ce:plan for structured implementation planning
