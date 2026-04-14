---
title: "fix: humanize AI racecraft without regressing route fidelity"
type: fix
status: completed
date: 2026-04-14
origin: direct user request ("improve the ai drivers. they are too robotic. need to make sure they don't break")
---

# fix: humanize AI racecraft without regressing route fidelity

## Overview

Make CPU racers feel less robotic while preserving the stability gains from the April 13 AI simplification passes. The goal is not to reintroduce broad personalities or noisy steering. It is to add tightly bounded variation in line choice, throttle commitment, steering response, and boost timing so the pack looks more alive without reopening the old corner-failure and route-loss regressions.

## Problem Frame

The current AI driving stack is playable, but it now reads as overly uniform:

- every CPU racer shares the same baseline profile
- line planning is deterministic aside from a small seed lane spread
- throttle and boost decisions are heavily flattened around route safety
- recent fixes intentionally removed personalities and cut back non-essential variation (see origin: `docs/plans/2026-04-13-005-fix-ai-remove-personalities-plan.md`)

That was the right reliability move, but the side effect is that the field can feel robotic. The next pass should reintroduce believable racecraft differences only where the current controller can safely absorb them, and it must keep the current route-following, corner slowdown, and recovery guardrails intact (see origin: `docs/plans/2026-04-13-007-fix-ai-target-debug-and-simplify-cornering-plan.md`).

## Requirements Trace

- R1. AI racers should feel less robotic during normal laps.
- R2. Variation must be bounded so AI still follows the route reliably.
- R3. Cornering safety must remain intact; no return to frequent walling or missed turns.
- R4. Recovery, traffic handling, and wrench-diversion behavior must continue to function.
- R5. Variation should read as racecraft, not random wobble.
- R6. The change needs focused regression coverage so we can prove the bots did not break.
- R7. Runtime verification should include at least one live race smoke, not only source-level tests.

## Scope Boundaries

- No redesign of `TrackIntel` geometry or waypoint generation.
- No new item-combat system or aggressive overtaking logic overhaul.
- No reintroduction of broad named personalities with large behavioral deltas.
- No player vehicle handling changes.
- No multiplayer ranking or HUD changes.

## Context & Research

### Relevant Code and Patterns

- `js/AIController.js` owns route sampling, lane planning, throttle/boost decisions, traffic response, recovery, and wrench diversion.
- `js/AIProfiles.js` currently exports one shared CPU baseline after personality removal.
- `js/AIManager.js` seeds each controller and already provides deterministic per-bot identity hooks.
- `tests/ai-controller-cornering.test.mjs` is the strongest regression surface for line-shape and braking behavior.
- `tests/ai-track-following.test.mjs` covers route recapture, boost gating, recovery, and wrench pursuit safety.
- `tests/ai-traffic-cornering.test.mjs` covers traffic-aware slowdown and corner stability.
- Recent context:
  - `docs/plans/2026-04-13-005-fix-ai-remove-personalities-plan.md`
  - `docs/plans/2026-04-13-006-fix-ai-wrench-diversion-plan.md`
  - `docs/plans/2026-04-13-007-fix-ai-target-debug-and-simplify-cornering-plan.md`

### Current Observations

- The controller already has one safe baseline and a small deterministic lane spread, which means there is a stable place to add bounded variation without reviving the old profile explosion.
- The strongest “robotic” feeling likely comes from synchronized throttle/boost behavior and nearly identical corner entry/apex choices.
- The safest variation surfaces are the ones already represented as scalar tuning values:
  - `cornerEntryWidth`
  - `cornerApexTightness`
  - `cornerSpeedFactor`
  - `trafficThrottleMin`
  - `turnThrottleDot`
  - `lookAheadBlend`
  - `boostEagerness`
- Unbounded steering noise would directly fight the simplification work from April 13, so it should stay out or remain near-zero.

### External Research Decision

No external research needed. This is a repo-local gameplay tuning and regression-hardening pass.

## Key Technical Decisions

- **Humanize with bounded style traits, not full personalities**: introduce small per-seed style modifiers around the current CPU baseline instead of reviving named archetypes.
- **Keep route fidelity primary**: style modifiers may influence target lane, throttle caps, and boost timing, but never bypass the current route recapture/recovery structure.
- **Prefer deterministic variety**: use seed-derived stable traits so each AI feels slightly different without per-frame randomness or jitter.
- **Bias variation into intent, not noise**: differences should read like “takes a wider entry” or “holds boost a little longer,” not “wiggles unpredictably.”
- **Guard the behavior with existing regression surfaces**: extend the current controller tests rather than inventing a looser verification story.

## Deferred to Implementation

- Exact size of each style modifier band. Start conservative and only widen if the field still looks too synchronized in runtime testing.
- Whether boost timing variation should be boolean (`boostEagerness`) or a small heading-threshold window.
- Whether traffic response needs a small “patience” trait in addition to throttle variation.

## Implementation Units

- [x] **Unit 1: Add bounded per-bot racecraft style traits on top of the CPU baseline**

**Goal:** Give each AI a small, deterministic style signature without recreating unstable personality variance.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `js/AIProfiles.js`
- Modify: `js/AIController.js`
- Modify: `js/AIManager.js`

**Approach:**
- Define a small style-variation layer derived from controller seed or AI index.
- Keep the exported CPU baseline as the center point, then derive bounded traits such as:
  - line bias amplitude
  - corner entry/apex aggression
  - throttle bravery / patience
  - boost commitment threshold
  - mild steering response variance if it stays inside safe limits
- Thread those traits into the controller in a way that remains deterministic and inspectable.

**Patterns to follow:**
- Existing seed-based lane spread in `js/AIController.js`
- Existing shared baseline profile shape in `js/AIProfiles.js`

**Test scenarios:**
- Happy path: two controllers with different seeds produce different but bounded style values.
- Edge case: no style value exceeds the configured safe band.
- Edge case: runtime AI spawning still uses one shared baseline plus deterministic seeded traits.

**Verification:**
- Source tests prove style traits vary by seed without reintroducing broad profile arrays.

---

- [x] **Unit 2: Thread the style traits into line, throttle, and boost decisions without weakening route recapture**

**Goal:** Make the variation visible in behavior while preserving the current safe controller core.

**Requirements:** R1, R2, R3, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: `tests/ai-controller-cornering.test.mjs`
- Modify: `tests/ai-track-following.test.mjs`

**Approach:**
- Apply style traits only to the existing safe scalar decisions:
  - corner entry/apex lane choice
  - desired speed factor or turn throttle cap
  - boost gating thresholds
  - possibly slight look-ahead weighting differences
- Keep recovery mode, wall escape, and route recapture unmodified or only minimally style-aware.
- Ensure the final target logic still flows through the same recapture and debug pathways.

**Patterns to follow:**
- Existing `_computeLanePlan()` and `desiredSpeedFactor` flow in `js/AIController.js`
- Existing debug-state exposure so runtime checks remain legible

**Test scenarios:**
- Happy path: style traits produce different lane offsets or throttle decisions between two otherwise identical controllers.
- Edge case: off-line AI still steers back to the route instead of widening outward.
- Edge case: hard-turn braking and boost suppression still hold under the new style traits.
- Edge case: wall recovery and reverse recovery remain intact.

**Verification:**
- Cornering and route-following tests pass with new assertions for bounded style diversity.

---

- [x] **Unit 3: Keep traffic and wrench behavior compatible with the new style layer**

**Goal:** Avoid making the pack more alive at the cost of reintroducing crowding regressions or off-line wrench dives.

**Requirements:** R2, R3, R4, R6

**Dependencies:** Unit 2

**Files:**
- Modify: `js/AIController.js`
- Modify: `tests/ai-traffic-cornering.test.mjs`
- Modify: `tests/ai-track-following.test.mjs`

**Approach:**
- Constrain any style influence in traffic situations so corners still favor slowdown over wild lateral moves.
- Preserve the existing wrench-diversion guardrails and ensure style variation does not widen the acceptable lure window too far.
- Keep the traffic/corner suppression path as the final authority when space is tight.

**Patterns to follow:**
- Existing `_computeTrafficResponse()` caps and turn-severity suppression
- Existing wrench-target filtering in `_selectWrenchTarget()`

**Test scenarios:**
- Happy path: trailing AI still slows behind a blocking kart in a sharp corner.
- Edge case: style variation does not create excessive lateral dodge in occupied corners.
- Edge case: AI still ignores off-line wrench bait on neighboring lanes.

**Verification:**
- Focused traffic and wrench-related regression suites still pass.

---

- [x] **Unit 4: Validate runtime feel and document completion**

**Goal:** Confirm the field looks less synchronized in a real race without losing playability.

**Requirements:** R1-R7

**Dependencies:** Units 1-3

**Files:**
- Modify: `docs/plans/2026-04-14-006-fix-ai-humanize-racecraft-without-regressing-route-fidelity-plan.md` checkboxes only

**Approach:**
- Run the focused AI test suites and syntax checks on touched modules.
- Launch a local race with AI and visually inspect:
  - corner entry spacing
  - pack synchronization on straights
  - boost timing variety
  - absence of renewed corner failures
- Use the existing AI target debug when helpful to confirm style variation is still driving believable final targets.

**Verification:**
- Focused tests pass.
- Local race smoke shows visible but controlled variety across AI karts.
- This plan document is marked completed.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Style variation reopens walling or missed-corner regressions | Keep all trait bands conservative and preserve recovery/route recapture as the controlling layer |
| The bots feel random rather than human | Use deterministic, seeded microvariation instead of frame noise |
| Pack traffic becomes less stable | Let traffic slowdown/corner suppression override style ambition |
| The difference is too subtle to matter | Verify in runtime with multiple AI and widen only the safest trait bands if needed |

## Verification

- Run focused tests:
  - `tests/ai-controller-cornering.test.mjs`
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
  - `tests/track-intel-route-fidelity.test.mjs`
- Run `node --check` on touched AI modules.
- Local race smoke with AI enabled and, if needed, AI target debug visible.

## Completion Notes

- Runtime AI now uses `createSeededCPUProfile()` to derive small deterministic variations around the shared CPU baseline instead of restoring broad personalities.
- The live controller now honors per-profile route blend and boost commit thresholds, which makes straight-line commitment and corner setup less synchronized across the pack.
- Focused verification completed on 2026-04-14:
  - `node --test tests/ai-profiles.test.mjs tests/ai-controller-cornering.test.mjs tests/ai-track-following.test.mjs tests/ai-traffic-cornering.test.mjs tests/track-intel-route-fidelity.test.mjs`
  - `node --check js/AIProfiles.js && node --check js/AIManager.js && node --check js/AIController.js`
  - `git diff --check`
  - headless `agent-browser` race smoke on `http://localhost:3000`
- Browser/runtime smoke results:
  - solo race launched with `aiCount: 6`
  - `window.__kartDebug.getState()` reported `trackIntelValid: true`, `running: true`, `aiCount: 6`
  - after a short dwell, AI state still showed `reversing: 0`, divergent `speed`/`inputZ` values, and separated `progress` values rather than one synchronized band
  - no page errors were reported during the smoke; console output was limited to existing animation logs

## Sources & References

- `docs/plans/2026-04-13-005-fix-ai-remove-personalities-plan.md`
- `docs/plans/2026-04-13-006-fix-ai-wrench-diversion-plan.md`
- `docs/plans/2026-04-13-007-fix-ai-target-debug-and-simplify-cornering-plan.md`
- Relevant files:
  - `js/AIController.js`
  - `js/AIManager.js`
  - `js/AIProfiles.js`
  - `tests/ai-controller-cornering.test.mjs`
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
