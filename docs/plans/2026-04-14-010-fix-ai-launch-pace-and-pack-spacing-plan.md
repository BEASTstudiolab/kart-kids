---
title: "fix: push AI to proper racing launch pace and reduce early pack bunching"
type: fix
status: completed
date: 2026-04-14
origin: direct user follow-up via /lfg after local playtest ("they need to go 100 like proper racing, and they are bunching up too much still")
---

# fix: push AI to proper racing launch pace and reduce early pack bunching

## Overview

Follow the launch-expression pass with a tighter gameplay tuning pass that makes AI leave the line like racers instead of a hesitant pack. The immediate goals are to preserve the new seeded start variance while pushing assertive bots closer to full launch throttle and reducing the amount of same-lane compression that still makes the opening field clump together.

## Problem Frame

The recent AI work is now visible at the start, but the live local playtest still shows two feel problems:

1. The AI do not accelerate hard enough to read as proper racing off the line.
2. The field still bunches too tightly in the first seconds, which flattens the new personality work and makes the launch look crowded rather than competitive.

This is no longer a question of whether the systems exist. The systems are live, but the current tuning still over-protects the opening pack. The next pass should make the AI launch harder and claim space earlier while keeping route fidelity, corner safety, and recovery stability intact.

## Requirements Trace

- R1. Assertive AI should launch at near-full race pace in the first visible seconds after `GO`.
- R2. Opening-pack spacing should improve so the field does not collapse into a single compressed line.
- R3. Seeded variation should still matter: some bots should hesitate or tuck in slightly, but the whole pack should no longer feel underpowered.
- R4. The pass must not regress route following, start stability, or wall/reverse recovery.
- R5. Runtime debug should make launch pace and pack-spacing state inspectable in local verification.
- R6. The work must finish with focused tests, review/autofix, todo resolution, and browser verification.

## Scope Boundaries

- No vehicle physics rewrite.
- No changes to player kart acceleration.
- No multiplayer synchronization changes.
- No broad AI cornering rewrite beyond what is needed to keep the launch safe.

## Context & Research

### Relevant Prior Work

- `docs/plans/2026-04-14-008-fix-ai-overtaking-mistakes-and-aggression-pass-plan.md`
- `docs/plans/2026-04-14-009-fix-ai-opening-seconds-launch-expression-plan.md`

### Relevant Code and Patterns

- `js/AIController.js` already contains:
  - launch-phase throttle floor and reaction timing
  - traffic occupancy and throttle-cap logic
  - lane bias, overtake commitment, and debug state export
- `js/AIProfiles.js` already carries seeded aggression, traffic patience, launch assertiveness, and lane-commit values.
- `tests/ai-controller-cornering.test.mjs` already verifies launch differentiation and safe controller behavior.
- `tests/ai-traffic-cornering.test.mjs` already verifies traffic slowing and straight-line passing behavior.
- `js/GameEngine.js` already exposes launch/overtake debug fields through `window.__kartDebug.getAIState()`.

### Current Observations

- The previous pass moved launch throttle out of the soft `~0.62-0.65` range and into the `~0.83-0.87` range, but the user still perceives the opening pace as too tame.
- The remaining feel issue appears to come from conservative traffic compression and insufficient opening-space creation, not from missing launch systems.
- The safest next step is to separate "launch spacing protection" from the generic traffic cap so opening traffic can spread out faster instead of forcing the entire field to behave like a blocked train.

### External Research Decision

The codebase already has strong current local patterns for AI launch, traffic response, overtaking, and debug introspection. Proceeding without external research.

## Key Technical Decisions

- **Push launch pace through a dedicated opening-race floor, not a broad global speed buff**: this targets the real feel problem without making mid-lap traffic logic reckless.
- **Reduce early bunching with spacing-aware traffic response, not random lane chaos**: the field should fan out on purpose, not wobble unpredictably.
- **Keep seed-driven hesitation, but narrow it to a minority behavior**: a few cautious starts help sell personality, but the average pack should still look fast.
- **Preserve visibility through debug**: local inspection should clearly show launch pace and spacing response during the first seconds.

## Deferred to Implementation

- Whether opening spacing should be represented as an explicit launch-separation state or as a modifier layered onto traffic response.
- Exact launch throttle floor and spacing thresholds after live tuning.
- Whether debug needs one new field for spacing pressure/separation in addition to the current launch and traffic state.

## Implementation Units

- [x] **Unit 1: Rebalance seeded launch pace toward proper race starts**

**Goal:** Ensure assertive AI leave the line at near-full racing pace while preserving bounded seeded hesitation.

**Requirements:** R1, R3, R4

**Dependencies:** None

**Files:**
- Modify: `js/AIProfiles.js`
- Modify: `js/AIController.js`
- Modify: `tests/ai-profiles.test.mjs`
- Modify: `tests/ai-controller-cornering.test.mjs`

**Approach:**
- Tighten the launch profile ranges so the average bot is faster and only the more cautious seeds visibly delay.
- Raise or better preserve the opening throttle floor so launch pace reads as committed racing rather than polite acceleration.
- Keep the launch window short-lived enough that cornering logic still takes over cleanly.

**Test Scenarios:**
- Verify seeded launch traits remain deterministic and bounded.
- Verify aggressive and cautious launch profiles still diverge visibly.
- Verify assertive launch throttle remains near-full in the early opening window.

---

- [x] **Unit 2: Reduce same-lane bunching with opening-pack spacing logic**

**Goal:** Make the field spread and commit to lanes earlier so opening traffic looks competitive rather than compressed.

**Requirements:** R2, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/GameEngine.js`
- Modify: `tests/ai-traffic-cornering.test.mjs`

**Approach:**
- Split opening-pack compression from generic traffic slowdown.
- Increase early lane claim / pass-side commitment when a blocker is close and the route is still safe.
- Allow stronger launch pace under manageable opening occupancy so bots do not all collapse behind the nearest kart.
- Export any additional spacing state needed for debugging if current fields are insufficient.

**Test Scenarios:**
- Verify an assertive AI can maintain strong opening throttle under nearby launch traffic without entering recovery or reverse.
- Verify off-lane traffic still allows near-full pace.
- Verify sharp-corner traffic still slows the AI appropriately and does not trigger reckless lane changes.

---

- [x] **Unit 3: Review, focused verification, and browser validation**

**Goal:** Confirm the AI now launch like racers and spread more convincingly in local play.

**Requirements:** R1-R6

**Dependencies:** Units 1-2

**Files:**
- Modify: this plan file for completion only

**Approach:**
- Run focused AI tests and syntax checks.
- Run `git diff --check`.
- Browser-verify the local opening seconds on at least one built-in track with enough AI to expose pack compression.
- Record the observed launch throttle band and spacing behavior.

**Verification:**
- Tests pass, browser verification passes, and this plan is marked complete.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI launch too hard and collide into the first corner | Keep the stronger pace confined to the safe opening window and preserve turn-severity suppression |
| Reduced bunching becomes erratic swerving | Favor stable lane claims and occupancy-aware spacing over random lateral noise |
| Faster starts mask real route bugs | Keep route-fidelity and recovery tests in the focused suite |

## Verification

- Focused AI/controller/profile tests
- `node --check` on touched modules
- `git diff --check`
- Browser verification of launch pace and pack spacing on local tracks

## Outcome

- Raised the seeded launch baseline so the average AI leaves the line much more aggressively while preserving some deterministic hesitation for the more cautious profiles.
- Split early pack spacing from generic traffic slowdown so opening traffic can fan out and commit to pass lanes instead of immediately collapsing into a single compressed queue.
- Added a launch-only turn-severity relaxation layer so the route model no longer treats the grid like a max-severity corner entry in the first visible seconds after `GO`.
- Extended runtime debug with `effectiveTurnSeverity` and `spacingPressure` so local verification can tell whether pace or spacing is limiting the opening feel.

## Verification Results

- `node --test tests/ai-profiles.test.mjs tests/ai-controller-cornering.test.mjs tests/ai-traffic-cornering.test.mjs tests/ai-track-following.test.mjs tests/track-intel-route-fidelity.test.mjs`
- `node --check js/AIProfiles.js && node --check js/AIController.js && node --check js/GameEngine.js`
- `git diff --check`
- Local browser verification on `http://localhost:3000` with `8` AI on `starter-circuit`:
  - opening launch sample moved into roughly `0.89-0.92` throttle with early `overtake` behavior active across much of the pack
  - opening traffic now reports non-zero `spacingPressure`, and several bots commit visible lane input instead of only tucking into traffic mode
  - raw `turnSeverity` remained `1` at the grid, but launch-specific `effectiveTurnSeverity` dropped to roughly `0.02-0.12`, which is what allowed the stronger race-start shove
- Autofix review pass found no additional blocker after the final tuning loop and focused regressions
- Todo scan: no todo files existed in `.context/compound-engineering/todos` or `todos`

## Sources & References

- `docs/plans/2026-04-14-008-fix-ai-overtaking-mistakes-and-aggression-pass-plan.md`
- `docs/plans/2026-04-14-009-fix-ai-opening-seconds-launch-expression-plan.md`
- Relevant files:
  - `js/AIController.js`
  - `js/AIProfiles.js`
  - `js/AIManager.js`
  - `js/GameEngine.js`
  - `tests/ai-controller-cornering.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
