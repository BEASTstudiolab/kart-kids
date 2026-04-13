---
title: "fix: add live AI target debug and simplify cornering for playable CPU driving"
type: fix
status: completed
date: 2026-04-13
origin: direct request after in-race route overlay review ("debug and fix it till we have clean driving")
---

# fix: add live AI target debug and simplify cornering for playable CPU driving

## Overview

Instrument the AI's actual steering target in race debug, then simplify the driving controller so CPU karts prioritize staying on the route and surviving corners over personality-like variation or clever lane behavior.

## Problem Frame

The in-race green route overlay proved that the displayed `TrackIntel` path is not the same thing as the final point the AI steers toward. Visual playtesting still shows bots driving wide into walls and bunching at repeated corners even after several targeted fixes.

The current controller has accumulated multiple interacting influences:

- route look-ahead blending
- lateral line offsets
- traffic bias
- wall escape bias
- optional wrench diversion
- profile-driven noise and sensitivity

Those layers make it hard to see which target the AI is actually chasing and hard to reason about why a bot misses a corner. The user explicitly prefers simplifying the driving model if that is what it takes to get reliable, playable AI.

## Requirements Trace

- R1. Add a live in-race debug view for each AI kart's actual steering target, not just the shared route path.
- R2. Expose enough controller state to distinguish route following from avoidance/recovery overrides.
- R3. Simplify the controller toward a more stable "stay on the path and make the corner" behavior.
- R4. Reduce or remove non-essential variation if it harms reliability.
- R5. Add regression coverage for the cornering behavior we are simplifying.
- R6. Preserve existing race startup and debug menu behavior.

## Scope Boundaries

- No redesign of `TrackIntel` route generation in this pass.
- No new AI combat, item, or personality systems.
- No full vehicle physics overhaul.
- No UI work outside the existing in-race debug surface.

## Context & Research

### Relevant Code and Patterns

- `js/AIController.js` - builds the final steering/throttle inputs from route samples and local recovery logic.
- `js/AIManager.js` - owns AI instances and is the clean place to collect per-bot debug snapshots.
- `js/DebugPanelSetup.js` - already hosts race debug toggles and the green route overlay.
- `js/GameEngine.js` - creates scene debug groups and passes references into the debug panel.
- `tests/ai-track-following.test.mjs` - focused controller-level regression surface.
- `tests/ai-traffic-cornering.test.mjs` - current cornering and pack behavior regression surface.
- `tests/track-intel-route-fidelity.test.mjs` - route-shape fidelity guardrail.

### Current Observations

- The green route path is only the base `TrackIntel` loop; it does not show the final per-frame steering target.
- The controller still blends multiple biases before computing steering, so a bot can visibly depart from the green route while still "using" it.
- The user reports the next corner keeps failing after each localized fix, which is a strong sign the shared steering model itself needs simplification.

### External Research Decision

No external research needed. This is a repo-local gameplay/controller debugging pass.

## Key Technical Decisions

- **Debug the real target first**: add live target rays/dots so every future fix can be tied to what the controller actually asked the vehicle to do.
- **Prefer reliability over variety**: if lateral offsets, noise, or traffic bias are hurting consistency, flatten or remove them for CPU playability.
- **Keep recovery explicit**: preserve simple wall/stuck recovery, but make it legible in debug state rather than allowing hidden steering overrides.
- **Test the simplified model directly**: add regression coverage that asserts stronger route recapture and safer corner throttle behavior.

## Deferred to Implementation

- Whether the live debug should show only the final target or both the raw route target and final adjusted target.
- Whether the best simplification is removing lateral offsets/noise entirely or keeping tiny bounded versions.
- Whether traffic avoidance should remain active in corners or be heavily suppressed there.

## Implementation Units

- [x] **Unit 1: Add per-AI steering target debug in race**

**Goal:** Make the actual steering target visible in the live debug view so corner failures can be reasoned about frame-to-frame.

**Requirements:** R1, R2, R6

**Dependencies:** None

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/AIManager.js`
- Modify: `js/DebugPanelSetup.js`
- Modify: `js/GameEngine.js`

**Approach:**
- Capture a small controller debug snapshot each frame with route target, final target, and current mode hints.
- Add a race debug toggle for per-AI target rays/dots, following the existing route overlay pattern.
- Keep the overlay lightweight and easy to disable.

**Test scenarios:**
- Happy path: debug state exists for active AI after controller update.
- Edge case: missing `TrackIntel` or zero AI does not crash the overlay.
- Integration: enabling/disabling the overlay in race does not affect normal gameplay.

**Verification:**
- Race debug menu exposes the new toggle and scene groups update without runtime errors.

---

- [x] **Unit 2: Simplify the AI steering model around route fidelity**

**Goal:** Reduce controller complexity so AI karts consistently target a stable line through corners instead of accumulating conflicting biases.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/AIProfiles.js` if a flatter baseline profile is still needed

**Approach:**
- Separate raw route target selection from optional overrides and cap the number of active steering influences.
- Bias the controller toward route recapture and earlier corner slowdown instead of lane variation.
- Remove or sharply reduce non-essential steering noise and lateral offset if they are not helping.

**Patterns to follow:**
- Existing `TrackIntel.sampleAhead()` / `estimateTurnSeverity()` usage
- Existing stuck/wall recovery structure in `AIController`

**Test scenarios:**
- Happy path: AI targets the sampled route ahead when unobstructed.
- Edge case: sharp corners reduce throttle earlier and do not request boost.
- Edge case: off-line AI steers back toward the route instead of continuing outward.
- Edge case: recovery logic does not permanently override route-following once clear.

**Verification:**
- Focused AI tests pass and show the simplified controller honoring route recapture and corner slowdown.

---

- [x] **Unit 3: Rebalance corner traffic behavior for playability**

**Goal:** Keep traffic avoidance from destabilizing the simplified route-following model in tight corners.

**Requirements:** R2, R3, R4, R5

**Dependencies:** Unit 2

**Files:**
- Modify: `js/AIController.js`
- Modify: `tests/ai-traffic-cornering.test.mjs`

**Approach:**
- Limit traffic lateral bias during high turn severity.
- Favor speed reduction or mild following behavior over aggressive lane changes when route space is tight.
- Keep the logic simple enough to read from the new debug output.

**Test scenarios:**
- Happy path: trailing AI slows behind corner traffic rather than steering deep off-line.
- Edge case: occupied corners do not push bots into walls through excessive lateral bias.
- Integration: pack behavior remains stable with multiple AI in a cornering scenario.

**Verification:**
- Traffic-cornering regressions pass and reflect the simplified behavior.

---

- [x] **Unit 4: Validate the simplified driving loop**

**Goal:** Confirm the new controller is stable enough for playable local racing and that the debug tools remain useful.

**Requirements:** R1, R5, R6

**Dependencies:** Unit 3

**Files:**
- Modify: `docs/plans/2026-04-13-007-fix-ai-target-debug-and-simplify-cornering-plan.md` checkboxes only

**Approach:**
- Run focused tests and syntax checks on touched files.
- Do a local browser race smoke with route and target debug enabled.
- Use the live overlay to spot-check whether the final target stays believable through the failing corners.

**Verification:**
- Focused tests pass.
- Race boots locally with no new debug/runtime regressions.
- Visual debug now makes the controller's behavior legible during cornering.
- Headless browser validation could confirm overlay toggles and clean startup, but not a trustworthy full moving-lap verdict because Chromium stayed heavily throttled in top-down mode.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Simplification makes AI too robotic | Prefer a stable baseline first; reintroduce variation only after route fidelity is reliable |
| Traffic handling regresses into rear-end trains | Allow speed adaptation before lateral dodging, and cover it with pack tests |
| Debug overlay itself becomes noisy | Keep it opt-in and render only the minimal useful geometry |
| The root cause is actually route geometry, not steering | Preserve `track-intel-route-fidelity` coverage while focusing this pass on final-target behavior |

## Verification

- Run focused tests:
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
  - `tests/track-intel-route-fidelity.test.mjs`
- Run `node --check` on touched modules.
- Local browser smoke on race startup with AI enabled and debug overlays toggled.

## Sources & References

- `js/AIController.js`
- `js/AIManager.js`
- `js/DebugPanelSetup.js`
- `js/GameEngine.js`
- `tests/ai-track-following.test.mjs`
- `tests/ai-traffic-cornering.test.mjs`
