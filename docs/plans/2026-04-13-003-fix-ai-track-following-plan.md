---
title: "fix: stabilize AI track following"
type: fix
status: active
date: 2026-04-13
origin: direct request ("AI drivers are not driving on the track correctly")
deepened: 2026-04-13
---

# fix: stabilize AI track following

## Overview

Diagnose and fix the current AI driving behavior so AI karts stay on the intended racing line again instead of steering off the drivable route or getting hung up in corners.

## Problem Frame

The current AI stack is split between `TrackIntel` waypoint generation and `AIController` target selection. `TrackIntel` now emits dense sub-tile waypoint paths, while `AIController` layers profile-specific look-ahead, lateral offsets, noise, throttle reduction, and boost timing on top. The result is that AI racers are no longer reliably following the track.

Recent code inspection suggests the failure is likely in the contract between these layers, not in race-mode wiring:

- `AIController` recomputes the "nearest waypoint" from a full scan every frame rather than preserving route continuity.
- `AIController` computes throttle and boost gating from the pre-offset target direction, then changes the steering target with profile lateral offsets.
- The repo currently has no local AI path-following regression tests, so behavior drift can slip through unnoticed.

The first pass tightened route continuity and final-target throttle/boost math, but live testing still reports AI stalling in corners. The remaining work needs to reproduce the dynamic corner-stall itself, not just static target-selection mistakes.

Implementation should confirm the exact root cause with characterization coverage first, then tighten the controller/TrackIntel contract or corner recovery logic with the smallest behavioral fix that restores lane-keeping and corner exit behavior.

## Requirements Trace

- R1. AI racers stay on the drivable route for official tracks under normal race conditions.
- R2. AI steering target selection preserves forward route continuity and does not snap unpredictably to the wrong local waypoint/segment.
- R3. Personality differences (aggressive/cautious/drifter/strategist) may change line choice, but must not push AI off-track as a normal outcome.
- R4. The fix must preserve existing AI spawn, race-mode, and rubber-banding flows.
- R5. Add automated regression coverage for the causal chain that failed.

## Scope Boundaries

- No redesign of the AI personality system.
- No changes to multiplayer, lobby, or race-mode flow logic.
- No new TrackIntel feature set beyond what is required for correct AI path following.
- No item/combat tuning unless investigation proves it directly affects the steering failure.

## Context & Research

### Relevant Code and Patterns

- `js/AIController.js` — per-frame steering, throttle, boost, and profile offset logic.
- `js/AIManager.js` — spawns AI controllers, updates them each frame, and already stores per-AI segment hints for race progress.
- `js/TrackIntel.js` — generates dense waypoint loops and exposes `getProgress()` plus nearest-waypoint lookup.
- `js/AIProfiles.js` — look-ahead distance, lateral offset, throttle, and boost tuning inputs that directly shape lane-keeping behavior.
- `docs/plans/2026-04-07-001-fix-trackintel-missing-tile-connectivity-plan.md` — prior TrackIntel fix; useful for preserving current connectivity assumptions while tightening AI behavior.
- `docs/plans/2026-04-01-002-feat-ai-personality-profiles-plan.md` — prior decision record for personality-driven offsets and look-ahead behavior.

### Current Observations

- `TrackIntel.getProgress()` already supports a windowed/hinted search, but `getNearestWaypoint()` still does a full scan with no continuity hint.
- `AIController.update()` computes `dot` before applying profile lateral offset, then uses that stale value for throttle reduction and boost eagerness.
- Official tracks currently produce 141 waypoints from 61 cells, so controller math is operating against a much denser route than the original cell-center-only assumption.
- The local test suite has no AI-specific track-following regression coverage today; current nearby tests only cover orientation/collider/ground-ray behavior.
- Follow-up user report after the first fix pass: AI no longer just drifts off-route; it still gets stuck in corners during live driving. This points to a dynamic controller/physics interaction still missing from the current regression suite.

## Key Technical Decisions

- **Characterization-first execution**: Treat this as a behavioral regression. Reproduce it in deterministic tests before changing controller math.
- **Controller/TrackIntel contract is the primary seam**: The first fix target is the waypoint continuity and targeting contract, not race orchestration.
- **Preserve personality variety, constrain unsafe math**: Keep profile inputs and visible line differences, but ensure target offsets cannot desynchronize steering from throttle/boost decisions.
- **Prefer deterministic math helpers over ad hoc tuning**: If the root cause is confirmed in route continuity or target projection, fix it at the math/helper level rather than masking it with arbitrary profile nerfs.
- **Dynamic corner recovery is now in scope**: If live AI still stalls after the route-targeting fix, add characterization around corner entry/exit progression and repair the recovery/look-ahead logic rather than guessing at profile constants.

## Deferred to Implementation

- Whether the final root cause is:
  - stale pre-offset throttle/boost math in `AIController`,
  - lack of segment-hinted nearest-waypoint continuity in `TrackIntel`,
  - dynamic corner-stall behavior in the controller/recovery loop,
  - or multiple issues acting together.
- Whether the smallest safe fix needs only `AIController.js`, or also a small `TrackIntel.js` API expansion for hinted nearest-waypoint lookup.
- Whether any profile constant needs minor retuning after the math fix lands, or whether the real gap is stuck/reverse handling around corners.

## Implementation Units

- [ ] **Unit 1: Reproduce and characterize the failure**

**Goal:** Create deterministic regression coverage that captures the current AI path-following failure before changing any production math.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Execution note:** Characterization-first. If a new test passes unexpectedly, do not proceed to implementation until the failing scenario is tightened.

**Files:**
- Create: `tests/ai-track-following.test.mjs`
- Create: `tests/track-intel-route-fidelity.test.mjs` if the failure localizes more naturally to waypoint continuity than to controller outputs

**Approach:**
- Build a deterministic AI harness around `TrackIntel` + `AIController` using official track data and stable profile inputs.
- Capture at least one failing scenario where the controller chooses an unsafe target or produces steering/throttle that drives the kart away from the intended route.
- Extend the harness to cover dynamic corner progression so “gets stuck on corners” is reproducible in code, not just by visual playtesting.
- Prefer unit/integration-style math tests over browser-only reproduction so the bug becomes regression-protected.

**Patterns to follow:**
- Existing plain Node test style in `tests/track-orientation-regression.test.mjs`
- Existing TrackIntel usage pattern in `js/AIManager.js` and `js/GameEngine.js`

**Test scenarios:**
- Happy path: a centerline-following/default-profile AI sample keeps selecting forward-progress waypoints on `starter-circuit`
- Edge case: a profile with non-zero lateral offset still selects a target on the correct forward route branch through a corner
- Edge case: near two spatially close but route-distant waypoints, the AI/controller contract keeps route continuity rather than snapping backward or across the loop
- Error path: a failing characterization test documents the current off-track behavior before the fix
- Error path: a failing characterization test documents the current corner-stall behavior before the fix

**Verification:**
- At least one new automated test fails on the current code for the right reason
- The failing assertion clearly identifies whether the defect is in route continuity, steering target math, or throttle/boost coupling

---

- [ ] **Unit 2: Fix controller/TrackIntel route-following math**

**Goal:** Restore stable AI lane-keeping and corner exit behavior by correcting the specific contract failure confirmed in Unit 1.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1

**Execution note:** Minimal fix. Change only the math/helpers required to satisfy the characterization coverage.

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/TrackIntel.js`
- Modify: `js/AIProfiles.js` only if a profile default must be adjusted after the math fix

**Approach:**
- If route continuity is the issue, add or adapt a hinted nearest-route query in `TrackIntel` and have `AIController` advance its route hint instead of full-rescanning blindly each frame.
- If steering/throttle coupling is the issue, recompute the target direction after lateral offsets before deriving throttle and boost gating.
- If the remaining issue is corner-stall behavior, adjust the look-ahead / recovery logic so an AI that slows for a corner still makes forward progress through the turn instead of oscillating or reversing unnecessarily.
- Keep the output contract unchanged: `{ x, z, touchActive, boost, drift, useItem }`.

**Patterns to follow:**
- `TrackIntel.getProgress()` windowed hint search for continuity-preserving lookup
- `AIController`’s existing reusable-vector/no-allocation pattern
- `AIProfiles.js` default-profile fallback structure

**Test scenarios:**
- Happy path: official-track AI target selection remains monotonic/forward through successive updates
- Happy path: AI with `Aggressive` and `Drifter` offsets still reduces speed appropriately when the offset target sharpens the corner
- Edge case: route continuity survives close parallel waypoint geometry without snapping to a wrong local nearest point
- Edge case: boost eagerness decisions use the final driving target, not a stale pre-offset heading
- Edge case: repeated updates through a tight corner continue making forward route progress instead of stalling near the apex

**Verification:**
- Unit 1 characterization tests pass
- No regressions in the surrounding TrackIntel/orientation/ground-ray test set

---

- [ ] **Unit 3: Validate runtime behavior in the race loop**

**Goal:** Confirm the fixed math behaves correctly when driven by the real AIManager/race loop, not just isolated controller tests.

**Requirements:** R1, R3, R4, R5

**Dependencies:** Unit 2

**Execution note:** Runtime verification after logic is fixed, not before.

**Files:**
- Modify: `js/AIManager.js` only if the confirmed fix needs route-hint handoff or another integration-level adjustment
- Modify: `tests/ai-track-following.test.mjs` or create a second integration-focused AI test if Unit 2 exposes a runtime-only gap

**Approach:**
- Verify the fixed controller behavior under `AIManager.update()` with real profiles and official tracks.
- Verify the fixed controller behavior under `AIManager.update()` with real profiles and official tracks, with explicit attention to corner entry/exit progression.
- Only touch `AIManager.js` if Unit 2 proves the runtime loop needs to preserve or seed extra route-following state.
- Use a short local race smoke test after the automated coverage passes.

**Patterns to follow:**
- Existing AIManager spawn/update lifecycle
- Existing race-loop consumption pattern in `js/GameEngine.js`

**Test scenarios:**
- Happy path: multiple AI profiles can update for successive frames without diverging off-route immediately
- Edge case: reverse track / mirrored official track still produces stable route following
- Edge case: AI does not freeze or churn in place at the official track’s first major corners
- Integration: AIManager + TrackIntel + AIController cooperate without breaking lap/progress bookkeeping

**Verification:**
- Automated AI/TrackIntel regression tests pass
- Manual local race check shows AI remaining on the route for the opening corners/lap on official tracks

## System-Wide Impact

- **Interaction graph:** `TrackIntel` → `AIController` → `AIManager` → `GameEngine` race loop. The likely fix is contained entirely within this chain.
- **Unchanged invariants:** AI spawn counts, race-mode AI fill behavior, item/combat hooks, and network flow remain unchanged.
- **Primary risk surface:** Tightening route continuity without freezing personality variation or creating over-conservative AI.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Fix masks the symptom by dulling AI profiles instead of correcting route math | Require characterization coverage that proves the causal chain before tuning any profile |
| Hinted nearest-waypoint logic introduces route-lock bugs after crashes or respawns | Include off-line / re-entry scenarios in AI path-following tests |
| Corner fix overcorrects and makes AI too slow or too rigid | Validate corner progression with multiple profiles and keep profile tuning as a last resort |
| Recomputing throttle/boost from final target changes race pace too much | Validate against all personality profiles and keep profile constants adjustable only if needed |
| Runtime behavior still diverges despite passing isolated tests | Finish with AIManager/race-loop verification, not just controller unit tests |

## Verification

- Run the new AI/TrackIntel regression tests directly with `node --test`
- Re-run nearby regression coverage:
  - `tests/track-orientation-regression.test.mjs`
  - `tests/track-collider-split.test.mjs`
  - `tests/vehicle-ground-ray-filter.test.mjs`
- Local runtime check in `index.html`: start a race with AI enabled and verify AI stays on the official track through the opening corners and first lap

## Sources & References

- Prior AI personality plan: `docs/plans/2026-04-01-002-feat-ai-personality-profiles-plan.md`
- Prior TrackIntel connectivity fix: `docs/plans/2026-04-07-001-fix-trackintel-missing-tile-connectivity-plan.md`
- Relevant implementation files:
  - `js/AIController.js`
  - `js/AIManager.js`
  - `js/TrackIntel.js`
  - `js/AIProfiles.js`
