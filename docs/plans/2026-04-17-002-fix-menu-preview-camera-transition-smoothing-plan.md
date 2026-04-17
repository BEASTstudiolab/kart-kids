---
title: "fix: restore smooth shared menu preview camera transitions"
type: fix
status: active
date: 2026-04-17
---

# fix: restore smooth shared menu preview camera transitions

## Overview

Repair the shared menu preview camera so moving between PLAY, CHARACTER focus states, and GARAGE reads as a deliberate animated transition instead of a hard snap. The fix should preserve the existing preset system and camera-debug tuning surface while making the motion path feel consistently interpolated again.

## Problem Frame

The shared menu preview already exposes contextual presets through `LobbyScene.setPreviewPreset()` and `AppShell.setMenuPreviewFocus()`, but the current behavior is reading as a cut instead of a transition in live use. Local inspection shows that `js/ui/LobbyScene.js` still uses frame-to-frame exponential damping, so the regression is not a missing call path; it is a motion-model problem.

The current preset change flow updates the target pose immediately and lets the render loop chase it with a high damping speed. That implicit chase is hard to reason about, difficult to test directly, and visually abrupt enough that preset changes can feel like a snap rather than a purposeful move.

## Requirements Trace

- R1. Preview camera changes between menu presets should visibly animate from the current pose to the next pose.
- R2. The transition should work for both top-level tab changes (`PLAY`, `CHARACTER`, `GARAGE`) and character sub-focus changes (`palette`, `masks`, `accessories`, `shirts`, `pants`, `feet`).
- R3. `immediate` preview updates must still be supported for debug/explicit snap use cases.
- R4. Camera-debug tuning (`setPreviewTuning`, `resetPreviewTuning`) must remain compatible with the smoother motion model.
- R5. Add automated regression coverage for the transition behavior instead of relying only on source-string assertions.
- R6. Verify the result in a browser on the live app.

## Scope Boundaries

- Do not redesign menu layouts, preset coordinates, or character category mapping.
- Do not change the selected preset IDs or the `AppShell` tab routing model unless needed for the transition fix.
- Do not alter unrelated lobby scene rendering, kart loading, or character appearance behavior.
- Do not remove the existing `immediate` option from preview helpers.

## Context & Research

### Relevant Code and Patterns

- `js/ui/LobbyScene.js` owns the shared menu preview preset state, target pose computation, and per-frame update loop.
- `js/ui/core/AppShell.js` routes tab and helper-driven focus changes into `LobbyScene.setPreviewPreset()` and `setPreviewTuning()`.
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js` drives category-specific preview focus changes while the character tab is active.
- `tests/lobby-assets.test.mjs` and `tests/app-shell-menu-music.test.mjs` already protect preview preset wiring and `AppShell` delegation, but they currently verify structure more than runtime transition behavior.

### Live Reproduction Notes

- Browser inspection against `http://localhost:3000` confirms that preset changes are still reaching `window.__kartDebug.app._lobbyScene`.
- The current implementation changes `_targetCameraPos`, `_targetLookAt`, `_targetFov`, and `_targetKartRotationY` immediately, then relies on the render loop to damp toward those targets.
- Because that motion is implicit and fairly aggressive, the resulting camera move does not reliably read as a smooth transition to the user.

### Institutional Learnings

- No dedicated `docs/solutions/` entry was found for menu preview transition smoothing.
- Existing plan history around menu preview work favors small, focused behavior fixes over large scene rewrites.

## Key Technical Decisions

- **Replace implicit preset chasing with an explicit preview-pose transition state.**
  Rationale: a start/target/duration transition is easier to tune, easier to test, and more reliably cinematic than relying on a fixed damping constant alone.

- **Extract transition math into a small pure helper module.**
  Rationale: the transition rules should be unit-testable without needing a live `THREE.WebGLRenderer` or full `LobbyScene` instance.

- **Retarget transitions from the current in-flight pose, not the previous preset origin.**
  Rationale: rapid tab/category changes should feel continuous rather than restarting from stale preset coordinates.

- **Keep `immediate` as an explicit bypass.**
  Rationale: existing debug hooks and any future snap-to-state flows still need deterministic immediate application.

- **Add behavior tests, not only source-string tests.**
  Rationale: this bug is about runtime feel and state evolution, so regression coverage should assert interpolation semantics directly.

## Implementation Units

### Unit 1: Introduce a testable preview-pose transition helper

**Goal**

Create a small pure helper that owns preview pose transition state and interpolation rules.

**Files**

- `js/ui/utils/menuPreviewPoseTransition.js`
- `tests/menu-preview-pose-transition.test.mjs`

**Patterns to Follow**

- Existing small utility modules under `js/ui/utils/`
- Existing node-based unit tests in `tests/*.test.mjs`

**Approach**

- Define a helper that can:
  - capture a start pose from the current live pose
  - accept a new target pose with optional immediate application
  - advance transition progress over time with a clear easing rule
  - expose the resolved current pose snapshot for rendering
- Keep the pose shape aligned with `LobbyScene` needs: camera position, look-at, FOV, and kart rotation.

**Test Scenarios**

- Starting a non-immediate transition keeps the current pose at the start value and sets a different target.
- Advancing time moves the pose partway toward the target rather than snapping.
- Advancing past the full duration resolves exactly to the target pose.
- Retargeting mid-transition starts the next move from the live interpolated pose, not the original start pose.
- Immediate updates snap directly to the target and clear any in-flight transition.

**Verification**

- `node --test tests/menu-preview-pose-transition.test.mjs`

### Unit 2: Integrate explicit transitions into the shared lobby preview scene

**Goal**

Make `LobbyScene` use the helper for preset and tuning changes while preserving existing public methods.

**Files**

- `js/ui/LobbyScene.js`
- `tests/lobby-assets.test.mjs`

**Patterns to Follow**

- Existing `setPreviewPreset()`, `setPreviewTuning()`, and `resetPreviewTuning()` public API in `js/ui/LobbyScene.js`
- Existing pose application flow in `_applyPreviewPose()`

**Approach**

- Replace the current direct current/target damping path with helper-managed pose transitions.
- Start a new transition whenever presets or tuning change without `immediate: true`.
- Preserve the current `immediate` branch by snapping the live pose immediately.
- Keep `getResolvedPreviewPose()` reporting the target pose for debug/UI consumers unless the helper API suggests a clearer split.

**Test Scenarios**

- `setPreviewPreset()` without `immediate` creates a transition instead of snapping the live pose.
- `setPreviewPreset()` with `immediate` still snaps immediately.
- `setPreviewTuning()` and `resetPreviewTuning()` follow the same motion rules.
- Existing source-level preset coverage remains aligned with the new implementation shape where still useful.

**Verification**

- `node --test tests/lobby-assets.test.mjs`

### Unit 3: Verify integration surfaces and browser behavior

**Goal**

Confirm that `AppShell` and the character tab still drive the preview correctly, then verify the smoother motion in the live app.

**Files**

- `tests/app-shell-menu-music.test.mjs`
- browser verification only for production code unless a small test-only helper is needed

**Patterns to Follow**

- Existing preview helper delegation tests in `tests/app-shell-menu-music.test.mjs`
- Existing `window.__kartDebug` browser inspection hook for live verification

**Approach**

- Keep `AppShell` delegation API stable so downstream panels/controllers do not need refactors.
- Extend tests only where necessary to reflect any new transition-related expectations or helper calls.
- In the browser, verify:
  - `PLAY -> CHARACTER`
  - `CHARACTER palette -> masks -> accessories`
  - `CHARACTER -> GARAGE`
  each visibly travels between poses instead of reading like a cut.

**Test Scenarios**

- `AppShell.setMenuPreviewFocus()` still forwards preset ids and options unchanged.
- `AppShell` preview tuning helpers remain compatible with the updated `LobbyScene`.
- Live browser flow shows camera motion over time instead of an immediate snap.

**Verification**

- `node --test tests/app-shell-menu-music.test.mjs`
- browser verification on `http://localhost:3000`

## Risks and Mitigations

- **Risk: transition state drifts or leaves the camera between poses.**
  Mitigation: resolve to exact target values at transition completion and cover this in unit tests.

- **Risk: rapid preset changes restart awkwardly.**
  Mitigation: always seed the next transition from the current interpolated live pose.

- **Risk: debug helpers or current callers depend on immediate snapping.**
  Mitigation: keep `immediate` behavior intact and preserve the existing public method signatures.

- **Risk: browser verification is subjective without stronger tests.**
  Mitigation: add pure helper behavior tests so the browser pass validates feel, not core correctness alone.

## Sequencing

1. Add the preview pose transition helper and unit tests.
2. Integrate the helper into `LobbyScene`.
3. Update any affected scene/delegation tests.
4. Run targeted tests.
5. Verify the motion in the browser.
6. Run review/autofix and any residual cleanup required by the workflow.
