---
title: "fix: rework AI driving model for corners and traffic"
type: fix
status: active
date: 2026-04-13
origin: direct request ("drivers are bunching up on the next corner; fundamentally AI driving is not correct")
---

# fix: rework AI driving model for corners and traffic

## Overview

Replace the current "single blended waypoint target + heading-dot throttle" AI driving model with a more correct route follower that can anticipate corner severity, recover from wall pressure, and avoid accordion bunching in traffic.

## Problem Frame

The recent AI fixes improved specific failures, but the symptom simply moved from one corner to the next. That is a strong signal that the problem is not one bad waypoint or one missing recovery tweak. The current AI still drives like a reactive target seeker:

- `TrackIntel` provides dense waypoints and progress, but not a richer notion of upcoming path shape.
- `AIController` chooses one forward target, then derives steering and throttle from immediate heading error.
- Personality offsets, wall recovery, and stuck reversal are layered on top of that reactive base.
- Traffic response is effectively missing; AI mostly discovers congestion after contact or wall pressure already exists.

That stack can survive straights and isolated bends, but it breaks down in chained corners and packed race starts. The result is wall-pin cascades, corner accordion behavior, and bunching that migrates around the lap as each local symptom is patched.

This plan treats the issue as a driving-model problem, not a tuning problem.

## Requirements Trace

- R1. AI racers stay on the drivable route through the official tracks' opening corners under normal 8-racer race starts.
- R2. AI steering and throttle must account for upcoming corner severity, not just current heading error.
- R3. AI that gets squeezed by a wall or slowed by traffic must recover and rejoin without repeatedly steering back into the barrier.
- R4. Traffic interaction must reduce accordion bunching and repeated wall contact at corner entry/exit.
- R5. Personality differences remain visible, but they operate inside a safety-constrained driving model.
- R6. Add deterministic regression coverage for single-kart cornering, wall recovery, and pack/traffic scenarios.
- R7. Preserve existing race orchestration contracts: `AIManager`, `RaceMode`, AI fill, lap tracking, and multiplayer flows.

## Scope Boundaries

- No navmesh, spline editor, or fully separate authored racing-line system.
- No redesign of RaceMode, lobby, or multiplayer networking.
- No changes to player vehicle handling beyond lightweight telemetry/hooks already exposed to AI.
- No combat/item strategy rewrite except where existing AI references are reused for traffic awareness.
- No profile explosion; personalities stay data-driven and few in number.

## Context & Research

### Relevant Code and Patterns

- `js/AIController.js` — current per-frame steering/throttle/boost/recovery logic.
- `js/AIManager.js` — AI lifecycle, rubber-banding, race progress, and racer struct ownership.
- `js/TrackIntel.js` — route generation, progress projection, nearest-waypoint queries, and cumulative distance data.
- `js/WaypointTemplates.js` and `js/TrackOrientation.js` — path geometry quality for corner pieces and legacy curve normalization.
- `js/Vehicle.js` and `js/vehicle/VehicleGroundRaycast.js` — wall proximity, repulsion, curb drag, and off-track detection signals already available at runtime.
- `js/TileTester.js` — existing deterministic wall-scrape harness pattern that can be reused or adapted for AI-specific diagnostics.
- `docs/plans/2026-04-13-003-fix-ai-track-following-plan.md` — prior narrow fix plan; useful background, but this follow-up needs a broader model shift.
- `docs/plans/2026-04-01-002-feat-ai-personality-profiles-plan.md` — defines the current profile-based personality layer that should survive this refactor.
- `docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md` — original TrackIntel intent; useful for keeping new path queries aligned with the shared track-intelligence role.

### Current Observations

- `AIController` still fundamentally relies on a single blended forward target and uses heading alignment as its main speed signal.
- `TrackIntel` exposes progress and dense waypoints, but no distance-ahead sampling or turn-severity helper, so corner anticipation is indirect and fragile.
- `Vehicle` already computes wall proximity and repulsion, but AI only consumes that late as a local escape nudge.
- `GameEngine` already feeds all active vehicles into AI combat refs, which gives a clean existing path for lightweight traffic-aware decisions without inventing a new global registry.
- Live reports after successive fixes show corner failure migrating rather than disappearing, which is consistent with a systemic controller model gap.

### External Research Decision

The repo already contains the relevant local patterns and constraints for this issue, so I am proceeding without external research. This is a repo-specific driving/control problem, not a framework-knowledge gap.

## Key Technical Decisions

- **Split the AI driver into route, speed, and local-response concerns**: The controller should separately answer "where should I be on the route?", "how fast should I approach the next section?", and "what do I do about nearby cars/walls right now?".
- **Sample ahead by route distance, not just waypoint count**: Fixed waypoint offsets become inconsistent as template density changes. The new contract should be distance/progress based.
- **Throttle from path shape, not only target heading**: Upcoming curvature/turn severity should set a desired speed envelope before the kart reaches the wall.
- **Treat wall recovery as fallback, not the main cornering model**: Escaping a wall is still needed, but it should not be the primary way AI negotiates tight corners.
- **Traffic response should prefer yielding or lane bias before contact**: The controller should detect occupied route space ahead and soften speed / lane choices before a pile-up forms.
- **Personality operates after safety planning**: Aggressive/cautious/drifter/strategist profiles may choose line bias and assertiveness, but not bypass core corner/traffic safety constraints.
- **Characterization-first execution**: The first goal is to encode the current bunching behavior in deterministic tests and diagnostic scenarios, then refactor under that coverage.

## Deferred to Implementation

- Whether the new route contract lands as additional `TrackIntel` helpers, a small route-state wrapper inside `AIController`, or both.
- Whether `WaypointTemplates.js` still needs another geometry adjustment once distance-ahead sampling is in place.
- Whether traffic response can live entirely inside `AIController` using existing combat refs, or whether `AIManager` should supply a thinner traffic-specific projection helper.
- Whether the best integration test shape is pure Node harness, `TileTester`-style deterministic runtime scenarios, or a combination of both.

## Implementation Units

- [x] **Unit 1: Characterize the systemic driving failure**

**Goal:** Reproduce the current corner-bunching behavior in deterministic coverage so the refactor is grounded in real failure cases instead of ad hoc tuning.

**Requirements:** R1, R4, R6

**Dependencies:** None

**Execution note:** Characterization-first. Do not refactor the controller until the failing behaviors are represented by automated tests or deterministic diagnostic scenarios.

**Files:**
- Modify: `tests/ai-track-following.test.mjs`
- Modify: `tests/track-intel-route-fidelity.test.mjs`
- Create: `tests/ai-traffic-cornering.test.mjs`
- Modify: `js/TileTester.js` only if a deterministic runtime scenario materially improves diagnosis

**Approach:**
- Extend the current AI regression harness from "single unsafe target" checks into short update-sequence scenarios.
- Add representative official-track corner cases, especially chained bends and the packed opening-lap entry conditions that trigger bunching.
- Add a traffic scenario with a slower or blocked lead kart so bunching can be measured before wall contact.
- Reuse the `TileTester` wall-scrape metrics pattern if runtime metrics are helpful, but keep primary regression coverage in Node tests.

**Patterns to follow:**
- Plain Node test structure in `tests/track-orientation-regression.test.mjs`
- Existing AI regression style in `tests/ai-track-following.test.mjs`
- Deterministic scenario metrics style in `js/TileTester.js`

**Test scenarios:**
- Happy path: a lone AI negotiates the starter circuit's opening corners while maintaining forward route progress.
- Edge case: a lone AI through the right-side chained bend does not pin itself to the barrier.
- Edge case: a wall-scrape recovery scenario returns to the route instead of oscillating at the wall.
- Edge case: two or more AI entering the same corner do not all maintain full entry speed into a bottleneck.
- Error path: the pre-refactor controller reproduces a bunching or repeated wall-pressure failure in at least one deterministic scenario.

**Verification:**
- At least one new regression fails on the current driving model for the right reason.
- The failing assertions distinguish route-following error from traffic/spacing error.

---

- [x] **Unit 2: Expand TrackIntel to support distance-ahead route sampling**

**Goal:** Give the controller a stable route-state API for tangent/target lookup and turn-severity estimation.

**Requirements:** R1, R2, R6, R7

**Dependencies:** Unit 1

**Execution note:** Add the smallest API surface that makes the controller deterministic and path-shape-aware; do not turn TrackIntel into a generic pathfinding framework.

**Files:**
- Modify: `js/TrackIntel.js`
- Modify: `tests/track-intel-route-fidelity.test.mjs`

**Approach:**
- Add helpers that sample route position/forward by progress or distance ahead, using the existing cumulative distance data.
- Add a lightweight turn-severity / curvature estimate derived from nearby route samples rather than raw tile type guesses.
- Preserve existing `getProgress()` / `getNearestWaypoint()` contracts so current consumers keep working.
- Keep any new data derived from the existing waypoint loop; no authored lane data or new route assets.

**Patterns to follow:**
- Existing cumulative distance and projection helpers in `js/TrackIntel.js`
- Shared TrackIntel role defined in `docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md`

**Test scenarios:**
- Happy path: sampling ahead by distance returns monotonic positions/forwards along the loop.
- Happy path: wrap-around sampling near the finish line remains continuous.
- Edge case: turn-severity is low on straights and higher on known official-track corners.
- Edge case: route sampling stays stable across dense corner templates and legacy curve proxies.

**Verification:**
- New TrackIntel helper tests pass.
- Existing progress/nearest-waypoint tests continue to pass unchanged.

---

- [x] **Unit 3: Rebuild AIController around route-state + speed planning**

**Goal:** Replace the reactive target-only driver with a controller that anticipates turns and plans safer corner-entry speed.

**Requirements:** R1, R2, R3, R5, R7

**Dependencies:** Unit 2

**Execution note:** This is the core refactor. Prefer a clearer controller model over preserving every incidental quirk of the current math.

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/AIProfiles.js` only if profile fields need to shift from waypoint-count tuning toward distance/line/assertiveness tuning
- Modify: `tests/ai-track-following.test.mjs`

**Approach:**
- Build a small route-state step inside `AIController` that:
  - projects the kart to route progress,
  - samples one or more forward points by distance,
  - estimates upcoming turn severity,
  - computes a desired lane target,
  - derives steering and desired speed from those signals.
- Make corner-entry speed primarily a function of upcoming turn severity and recovery state, not just current target dot product.
- Keep wall recovery and stuck reversal as fallbacks for bad states, but stop relying on them as normal cornering behavior.
- Clamp or collapse personality line offsets when turn severity or wall pressure says the safe envelope is narrower.

**Patterns to follow:**
- Current reusable-vector / low-allocation style in `js/AIController.js`
- Data-driven profile pattern in `js/AIProfiles.js`

**Test scenarios:**
- Happy path: a lone AI reduces speed before high-severity corners without contacting the wall.
- Happy path: aggressive/cautious/drifter profiles still produce visibly different inputs or line bias.
- Edge case: wall recovery overrides line bias until the kart clears the barrier.
- Edge case: chained corners continue making forward route progress without repeated stuck recovery.
- Edge case: boost logic respects the new safe-speed planner and does not fire into recovery states.

**Verification:**
- Unit 1 characterization tests pass.
- Existing AI personality expectations continue to hold at a high level.

---

- [x] **Unit 4: Add local traffic response to reduce corner bunching**

**Goal:** Prevent the pack from blindly following the same corner-entry target and speed when another kart already occupies that space.

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** Unit 3

**Execution note:** Keep traffic response local and lightweight; this is spacing/avoidance, not full multi-agent planning.

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/AIManager.js` only if a cleaner per-frame traffic data handoff is needed
- Modify: `js/GameEngine.js` only if a missing runtime reference blocks the design
- Modify: `tests/ai-traffic-cornering.test.mjs`

**Approach:**
- Reuse the active-vehicle references already supplied for AI combat decisions.
- Project nearby vehicles onto route progress and detect occupied space ahead within a short lookahead window.
- When a slower or blocked kart is ahead, prefer:
  - softer entry speed,
  - temporary lane bias if space exists,
  - and only then fallback recovery if contact still happens.
- Keep the response cheap and deterministic; avoid introducing a heavyweight crowd system.

**Patterns to follow:**
- Existing all-vehicle reference flow from `js/GameEngine.js` into `AIController.setCombatRefs()`
- Existing AIManager ownership of per-AI runtime state

**Test scenarios:**
- Happy path: a trailing AI slows behind a blocked lead kart instead of immediately walling itself.
- Happy path: two AI with different profile offsets can take slightly different lines into the same corner.
- Edge case: traffic response remains stable during race start bunching with multiple nearby karts.
- Edge case: local avoidance does not corrupt lap/progress bookkeeping.

**Verification:**
- Traffic characterization tests pass.
- AI pack behavior no longer reproduces the deterministic corner-bunching scenario from Unit 1.

---

- [x] **Unit 5: Validate runtime behavior and leave diagnostic hooks**

**Goal:** Confirm the new driving model behaves in the real race loop and leave behind enough diagnostics to catch regressions without relying on gut feel.

**Requirements:** R1, R4, R6, R7

**Dependencies:** Unit 4

**Execution note:** End with both automated verification and an intentionally repeatable local smoke path.

**Files:**
- Modify: `js/TileTester.js` if a reusable AI-corner diagnostic mode is warranted
- Modify: `docs/plans/2026-04-13-004-fix-ai-driving-model-plan.md` checkboxes only

**Approach:**
- Run the full focused AI/TrackIntel test set after the refactor.
- Do a local race smoke on `starter-circuit` with AI enabled and verify the opening corners plus the previously failing bend.
- If practical, leave a lightweight repeatable debug scenario or metric log for future AI corner regressions.

**Patterns to follow:**
- Existing local smoke expectations in earlier AI fix plans
- Existing deterministic debug scenario style in `js/TileTester.js`

**Test scenarios:**
- Happy path: 8-racer official-track start clears the opening corners without a visible pile-up.
- Edge case: the previously failing chained bend remains stable after one or more laps.
- Edge case: runtime AI updates remain compatible with lap counting, rubber-banding, and item/combat refs.

**Verification:**
- Focused AI/TrackIntel regression suite passes.
- Manual local smoke no longer shows the current corner-bunching failure.

## System-Wide Impact

- **Interaction graph:** `TrackIntel` route state → `AIController` steering/speed planner → `AIManager` runtime ownership → `GameEngine` race loop.
- **Unchanged invariants:** AI fill, lap/race progress, multiplayer orchestration, and the output input-shape contract from AI to Vehicle remain intact.
- **Primary change surface:** the meaning of AI look-ahead and speed planning becomes route-shape-aware rather than waypoint-count/heading-dot-driven.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Refactor becomes another tuning pass instead of a model correction | Require characterization tests first and keep the design centered on route-state + speed planning |
| Traffic response adds instability or oscillation | Keep it local, deterministic, and subordinate to route progress |
| Personality differences disappear under safety clamps | Preserve line/assertiveness inputs after the safety planner rather than removing them |
| New TrackIntel helpers accidentally break other consumers | Preserve existing APIs and add tests around old progress/nearest behavior |
| Runtime behavior still differs from tests | Finish with a repeatable local smoke path and, if needed, a retained diagnostic scenario |

## Verification

- Run focused AI tests with `node --test` over:
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
  - `tests/track-intel-route-fidelity.test.mjs`
  - `tests/track-orientation-regression.test.mjs`
- Re-run nearby vehicle safety coverage if touched:
  - `tests/track-collider-split.test.mjs`
  - `tests/vehicle-ground-ray-filter.test.mjs`
- Local smoke on `index.html` / `#/play` with AI enabled, verifying the opening corners and the previously failing bend on official tracks.

## Sources & References

- `docs/plans/2026-04-13-003-fix-ai-track-following-plan.md`
- `docs/plans/2026-04-01-002-feat-ai-personality-profiles-plan.md`
- `docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md`
- Relevant implementation files:
  - `js/AIController.js`
  - `js/AIManager.js`
  - `js/TrackIntel.js`
  - `js/AIProfiles.js`
  - `js/Vehicle.js`
  - `js/vehicle/VehicleGroundRaycast.js`
  - `js/TileTester.js`
