---
title: "feat: Add camera G-force lean and FOV effects"
type: feat
status: completed
date: 2026-03-31
deepened: 2026-03-31
origin: docs/brainstorms/2026-03-31-camera-g-force-requirements.md
---

# feat: Add camera G-force lean and FOV effects

## Overview

Add dynamic camera roll (lean) and FOV changes during cornering and boost in chase camera mode. The camera leans into turns and narrows FOV during drifting, then briefly widens FOV on boost activation. Pure camera animation — zero game logic changes.

## Problem Frame

The camera is static during cornering and boost. Players don't feel speed or drift through the camera. Console kart racers use camera lean and FOV shifts to make speed visceral. This is the cheapest, highest-impact feel improvement: one lerp per frame per effect, no new systems. (see origin: docs/brainstorms/2026-03-31-camera-g-force-requirements.md)

## Requirements Trace

- R1. Camera leans 3-5 degrees into turn, scaled from vehicle body lean signal
- R2. FOV narrows from 40 to ~32 during cornering, proportional to lean intensity
- R3. Smooth interpolation with asymmetric rates (fast attack, slow release); updateProjectionMatrix() after FOV changes
- R4. Boost activation: one-shot FOV widen to ~48-50, decays over ~0.5s; requires edge detection via prevBoostActive
- R5. Boost/cornering FOV priority: `max(boostFOV, corneringFOV)` during punch decay
- R6. Debug panel toggle to disable all effects; default ON
- R7. Chase camera only; reset FOV and roll to base when switching to isometric
- R8. No DOF/bokeh; no new post-processing passes

## Scope Boundaries

- No depth-of-field or new post-processing passes
- No isometric mode changes
- No game logic, physics, or vehicle behavior changes

## Context & Research

### Relevant Code and Patterns

- **Camera.js** — `update(dt, target, vehicleQuaternion)` at line 95. Chase mode block: lines 97-118. `lookAt()` at line 118 resets camera orientation every frame — **roll must be applied after lookAt**.
- **Vehicle.js** — Body lean computed at `updateBody()` line 627-630: `-(inputX / bodyLeanRoll) * linearSpeed`. Peak raw signal: ~0.2 rad (~11.5 deg). `boostActive` is a boolean, true for entire boost duration.
- **main.js** — Camera call site at line 1040: `cam.update(dt, followVehicle.spherePos, followVehicle.container.quaternion)`. `followVehicle` resolved at line 1030. Debug panel uses `addCheckbox()` (line 508) and `addSlider()` (line 529). Camera sliders already exist at lines 771-772.
- **Smoothing pattern** — Codebase uses `1 - Math.exp(-rate * dt)` for framerate-independent smoothing (Camera.js line 110). Use the same pattern for FOV and roll interpolation.
- **Data passing pattern** — Subsystems receive individual scalar values (e.g., `audio.update(dt, vehicle.linearSpeed, input.z, vehicle.driftIntensity)`). Expand `cam.update()` with a vehicle state object to pass the 4 needed values.

## Key Technical Decisions

- **Roll after lookAt**: `lookAt()` resets camera orientation every frame. Camera roll (`camera.rotation.z`) must be set after the `lookAt()` call at the end of the chase-mode block. This is the only viable insertion point. (see origin: Key Decisions — chase camera only)
- **Vehicle state object parameter**: Expand `cam.update()` with a 4th parameter `vehicleState = {}` containing `{ inputX, linearSpeed, boostActive, bodyLeanRoll }`. Consistent with origin doc dependency decision. Degrades gracefully — when omitted (isometric, spectator-with-no-target), no effects apply.
- **Exponential smoothing, not linear lerp**: Match the codebase's existing `1 - Math.exp(-rate * dt)` pattern for framerate-independent smoothing. Asymmetric rates: use the attack rate when the target is farther from zero, release rate when closer.
- **Boost edge detection via prevBoostActive**: Track `this._prevBoostActive` on the Camera instance. On rising edge, set `this._boostDelta = 8` (the offset above baseFOV). Each frame, decay toward 0. (see origin: R4)
- **Additive FOV offsets, not max()**: FOV is computed as `baseFOV + boostDelta - corneringDelta` where `boostDelta` starts at +8 and decays to 0, and `corneringDelta` ranges from 0 to 8. This avoids the steady-state bug where `max(boostPunchFOV, corneringFOV)` would prevent cornering narrowing from ever taking effect (since boostPunchFOV decays to baseFOV=40, always beating cornering's 32-40 range).
- **Rotation order dependency**: The roll-after-lookAt approach relies on the camera keeping its default `XYZ` Euler rotation order (where Z = roll). The codebase sets `YXZ` on vehicle body nodes. Implementation should include a comment documenting this dependency.
- **Toggle-off transition**: When `gforceEnabled` transitions from true to false, do a one-shot reset (FOV=40, roll=0, updateProjectionMatrix), then skip the entire G-force block on subsequent frames. Avoids per-frame reset cost when disabled.

## Open Questions

### Resolved During Planning

- **How to apply camera roll without lookAt overwriting it**: Apply `camera.rotation.z` after `lookAt()` at the end of the chase-mode block. lookAt sets the full quaternion but roll is the z-component; writing to rotation.z after lookAt is the standard Three.js approach for camera roll.
- **How to handle mode switching (R7)**: In the isometric/spectator branch of `update()`, unconditionally reset `camera.fov = baseFOV`, `camera.rotation.z = 0`, and call `updateProjectionMatrix()`. This prevents chase-mode distortion from leaking.
- **Lean signal mapping**: Raw signal peaks at ~0.2 rad. Scale by 0.35 to reach 3-5 degree target. FOV mapping: `targetFOV = baseFOV - 8 * clamp(abs(leanSignal) / 0.2, 0, 1)`.

### Deferred to Implementation

- Exact lerp rate constants — start with attack=10, release=4, tune from playtesting
- Exact boost punch FOV target — start with 48, tune from feel
- Whether spectated remote vehicles produce any lean (remote `inputX` is always 0, so lean will be zero for spectated vehicles — acceptable behavior)

## Implementation Units

- [x] **Unit 1: Cornering camera lean and FOV narrowing**

  **Goal:** Add camera roll lean and FOV narrowing during cornering in chase camera mode, with smooth interpolation and mode-switch reset.

  **Requirements:** R1, R2, R3, R7

  **Dependencies:** None

  **Files:**
  - Modify: `js/Camera.js`
  - Modify: `js/main.js` (call site only — expand `cam.update()` arguments)

  **Approach:**
  - Add G-force state properties to Camera constructor: `gforceEnabled = true`, `_prevGforceEnabled = true`, `_currentRoll = 0`, `_currentFOV = 40`, `baseFOV = 40`, `_prevBoostActive = false`, `_boostDelta = 0`. Add tuning constants: `rollIntensity = 0.35`, `fovNarrowMax = 8`, `boostPunchAmount = 8`, `attackRate = 10`, `releaseRate = 4`.
  - Expand `update()` signature: `update(dt, target, vehicleQuaternion, vehicleState = {})`.
  - In the chase-mode block, after the existing `lookAt()` call: compute lean signal from `vehicleState.inputX`, `vehicleState.linearSpeed`, `vehicleState.bodyLeanRoll`. Apply asymmetric exponential smoothing to roll and FOV. Set `camera.rotation.z` and `camera.fov`. Call `updateProjectionMatrix()`.
  - In the isometric/else branch: reset `camera.fov = baseFOV`, `camera.rotation.z = 0`, call `updateProjectionMatrix()`.
  - Guard all effects with `if (this.gforceEnabled)`. On the transition from enabled to disabled (`_prevGforceEnabled && !gforceEnabled`), do a one-shot reset (FOV=baseFOV, roll=0, updateProjectionMatrix). On subsequent disabled frames, skip the entire block. Track `_prevGforceEnabled` at end of frame.
  - Add a comment on the roll assignment noting the dependency on camera's default `XYZ` Euler rotation order.
  - Update the `cam.update()` call in main.js to pass vehicle state: `cam.update(dt, followVehicle.spherePos, followVehicle.container.quaternion, { inputX: followVehicle.inputX, linearSpeed: followVehicle.linearSpeed, boostActive: followVehicle.boostActive, bodyLeanRoll: followVehicle.debug.bodyLeanRoll })`.

  **Patterns to follow:**
  - Exponential smoothing: `1 - Math.exp(-rate * dt)` from Camera.js line 110
  - Body lean expression: Vehicle.js line 627-630

  **Test scenarios:**
  - Happy path: Full-speed left turn produces visible leftward camera roll (rotation.z < 0) and FOV < 40
  - Happy path: Straight driving at speed produces no lean (rotation.z ≈ 0) and FOV = 40
  - Happy path: Releasing steering input smoothly returns roll and FOV to base (slower than attack)
  - Edge case: Switching from chase to isometric mid-corner resets FOV to 40 and roll to 0 immediately
  - Edge case: No vehicle state passed (undefined) → no effects, no errors

  **Verification:**
  - Visual: cornering at speed produces smooth camera lean and tunnel-vision FOV narrow
  - Visual: switching modes mid-corner shows clean reset with no residual distortion

- [x] **Unit 2: Boost FOV punch**

  **Goal:** Add a one-shot FOV widen on boost activation that decays back to base, with correct priority against cornering FOV.

  **Requirements:** R4, R5

  **Dependencies:** Unit 1 (G-force state properties and FOV infrastructure)

  **Files:**
  - Modify: `js/Camera.js`

  **Approach:**
  - In the chase-mode G-force block: after computing cornering delta, check for boost rising edge (`vehicleState.boostActive && !this._prevBoostActive`). On rising edge, set `_boostDelta = boostPunchAmount` (default 8). Each frame, decay `_boostDelta` toward 0 using exponential smoothing (rate ~6, faster than release rate). Compute final FOV as `baseFOV + _boostDelta - corneringDelta`. Update `_prevBoostActive` at end of frame.
  - The additive offset approach handles the priority correctly: during boost punch, the positive boost delta dominates. As it decays to 0, the negative cornering delta takes over naturally. During boost+cornering, the offsets combine (e.g., `40 + 6 - 8 = 38`), giving a smooth transition.

  **Patterns to follow:**
  - Same exponential smoothing pattern as Unit 1

  **Test scenarios:**
  - Happy path: Activating boost on a straight produces a visible FOV widen (FOV > 40) that decays back to 40 within ~0.5s
  - Happy path: Activating boost while cornering → FOV combines both offsets (boost widen partially counteracts cornering narrow), then as boost decays, cornering narrowing becomes dominant
  - Edge case: Multiple rapid boost activations each produce a fresh punch (edge detection resets on each rising edge)
  - Edge case: Boost activates while G-force is disabled → no FOV change

  **Verification:**
  - Visual: boost activation produces a perceptible speed-rush FOV widen that smoothly returns to normal
  - Visual: cornering during boost shows the punch-then-narrow transition

- [x] **Unit 3: Debug panel toggle and tuning sliders**

  **Goal:** Add an accessibility toggle and tuning sliders to the debug panel for G-force effects.

  **Requirements:** R6

  **Dependencies:** Unit 1 (gforceEnabled property)

  **Files:**
  - Modify: `js/main.js` (debug panel section)

  **Approach:**
  - Add a "Camera G-Force" section header in the debug panel, following the existing pattern (header div → checkboxes/sliders).
  - Add checkbox: "G-Force Effects" (default: checked) → sets `cam.gforceEnabled`.
  - Add sliders: "Roll Intensity" (0-1, default 0.35), "FOV Narrow" (0-16, default 8), "Boost Punch FOV" (40-60, default 48). Wire each to the corresponding Camera property.
  - Place after the existing camera sliders section (~line 772).

  **Patterns to follow:**
  - `addCheckbox()` at main.js line 508
  - `addSlider()` at main.js line 529
  - Existing camera slider section at main.js lines 771-772

  **Test scenarios:**
  - Happy path: Unchecking the toggle disables all camera lean and FOV effects immediately
  - Happy path: Adjusting roll intensity slider changes the lean magnitude in real time
  - Edge case: Toggling off mid-corner resets camera to static behavior cleanly

  **Verification:**
  - Debug panel shows the G-Force section with toggle and sliders
  - Toggle off → camera behaves identically to pre-feature behavior

## System-Wide Impact

- **Interaction graph:** Camera.js reads vehicle state but does not write to it. No callbacks, no bidirectional coupling. The only change to main.js is expanding one function call's arguments.
- **Error propagation:** If vehicleState is undefined or missing properties, effects default to zero (no lean, base FOV). No error thrown.
- **State lifecycle risks:** None. All G-force state is per-frame or per-Camera-instance. No persistence, no network sync.
- **API surface parity:** No other systems need this change.
- **Unchanged invariants:** Vehicle physics, boost behavior, input handling, network sync, post-processing pipeline — all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Roll after lookAt may interact unexpectedly with zoom or smooth follow | Roll is applied to `camera.rotation.z` only, which is independent of position smoothing. Test at extreme zoom levels. |
| FOV updateProjectionMatrix() every frame could affect performance | Matrix recomputation is 4x4 math — negligible. Already done on resize. Verified in research. |
| Asymmetric lerp rates may feel wrong | Tuning constants exposed via debug sliders for real-time adjustment. |
| Camera rotation order changed from `XYZ` default breaks roll | Document the `XYZ` dependency with a comment. Codebase uses `YXZ` on vehicle nodes but camera keeps default. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-31-camera-g-force-requirements.md](docs/brainstorms/2026-03-31-camera-g-force-requirements.md)
- Related code: `js/Camera.js` (full file), `js/Vehicle.js` (updateBody, boost logic), `js/main.js` (camera call site, debug panel)
