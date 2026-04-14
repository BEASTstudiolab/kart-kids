---
title: "fix: make AI racecraft visible in the opening seconds"
type: fix
status: completed
date: 2026-04-14
origin: direct user follow-up via /lfg after local feel check ("doesnt seem to have changed the driving. atleast at the start")
---

# fix: make AI racecraft visible in the opening seconds

## Overview

Follow the broader AI racecraft pass with a targeted launch-phase refinement so the new behavior is obvious right after the countdown. The previous work added overtakes, aggression, and bounded mistakes, but most of that expression currently appears later in the lap. This pass makes the start itself feel more alive through launch reaction differences, opening lane claims, and early racecraft intent that remains bounded and stable.

## Problem Frame

The latest AI changes are live locally, but the user still does not feel much difference at race start. The likely cause is architectural: AI controllers stay dormant through countdown and only begin expressing behavior once `raceState === 'racing'`, which means the opening moment still looks too synchronized.

That creates a perception problem even if mid-lap behavior is improved. If the first seconds of a race still show a uniform pack launch, the feature reads as "not changed" in live play. This pass is about making the opening phase carry the new personality and racecraft immediately without destabilizing the pack.

## Requirements Trace

- R1. AI should feel more differentiated immediately after the countdown ends.
- R2. Opening behavior should include visible start variance such as reaction timing, lane claims, or launch commitment.
- R3. Launch-phase changes must remain deterministic per seed/profile.
- R4. Start behavior must not create broken pileups, repeated reverse states, or route-fidelity regressions.
- R5. Runtime debug should make opening-phase state inspectable.
- R6. The pass should end with focused tests, review/autofix, todo resolution, and browser verification.

## Scope Boundaries

- No full rewrite of the countdown or RaceMode system.
- No broad vehicle physics rebalance.
- No multiplayer-specific networking changes.
- No HUD/UI redesign beyond debug visibility if needed.

## Context & Research

### Relevant Code and Patterns

- `js/AIManager.js` currently keeps AI controller updates dormant until `raceState === 'racing'`.
- `js/AIController.js` now contains seeded aggression, overtake, and mistake systems, but those mostly manifest after the field is already moving.
- `js/RaceMode.js` owns the countdown-to-racing transition and does not currently expose a dedicated AI launch-prep hook.
- Existing AI tests already cover traffic, cornering, seeded variation, and bounded mistakes, which makes them a good place to add opening-phase expectations.

### Current Observations

- Browser verification showed the previous pass working later in races, but not strongly enough in the first seconds to satisfy the user.
- The simplest safe improvement is to precompute a seeded launch profile on controller reset and apply it during a short opening window after the race begins.
- That opening window can shape reaction delay, lane bias, and launch commitment without needing countdown-time controller updates.

### External Research Decision

No external research needed. This is a repo-local gameplay expression pass.

## Key Technical Decisions

- **Use a short opening-phase controller overlay**: avoid changing countdown update flow and instead express launch variation during the first seconds after racing begins.
- **Keep launch traits seeded and profile-driven**: use the existing profile system so start behavior stays deterministic and debuggable.
- **Prioritize lane claims and reaction timing over chaos**: the opening should feel alive, not random.
- **Expose launch state in debug**: if this pass still feels too soft, the next tuning pass should be data-driven.

## Deferred to Implementation

- Which launch traits should live in `AIProfiles.js` versus derived from existing aggression values.
- Exact launch window duration and reaction-delay bounds.
- Which launch-state fields to export in debug.

## Implementation Units

- [x] **Unit 1: Add seeded launch traits to AI profiles or controller state**

**Goal:** Give each AI a deterministic opening identity.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `js/AIProfiles.js`
- Modify: tests for bounded seed behavior if new profile fields are added

**Approach:**
- Add or derive launch reaction delay, opening lane claim, and launch assertiveness from seeded profile values.
- Keep ranges tight enough to create visible variation without grid chaos.

**Verification:**
- Profile/controller tests can prove the launch traits are deterministic and bounded.

---

- [x] **Unit 2: Apply a bounded opening-phase overlay in the AI controller**

**Goal:** Make the first seconds of the race visibly different across bots.

**Requirements:** R1-R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/GameEngine.js` debug output if needed
- Modify: tests for launch behavior

**Approach:**
- Track a short launch-phase timer after reset/race start.
- During that window, apply seeded reaction delay, early lane commitment, and launch throttle assertiveness on top of the existing route controller.
- Export launch-phase state to debug so live browser checks can confirm it is active.

**Verification:**
- Tests prove aggressive and cautious bots diverge immediately at race start without losing safe routing.

---

- [x] **Unit 3: Review, focused verification, and browser validation**

**Goal:** Confirm the local start now feels different and the behavior is inspectable.

**Requirements:** R1-R6

**Dependencies:** Units 1-2

**Files:**
- Modify: this plan file for completion only

**Approach:**
- Run focused AI tests and syntax checks.
- Run `git diff --check`.
- Run browser verification on built-in tracks with attention to the first seconds after `GO`.
- Record whether launch-phase debug confirms visible separation.

**Verification:**
- Tests pass, browser verification passes, and this plan is marked complete.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Start variance causes pileups or false regressions | Keep reaction delay and lane-bias bands tight and short-lived |
| Launch behavior masks the main route logic for too long | Limit the opening overlay to a brief timer and let normal controller logic take over quickly |
| The change still feels too subtle | Export launch debug state and validate in browser so tuning can continue from facts, not guesses |

## Verification

- Focused AI/controller/profile tests
- `node --check` on touched modules
- `git diff --check`
- Browser verification of launch-phase behavior on local tracks

## Outcome

- Added seeded start-delay and launch-assertiveness tuning that stays deterministic per bot but reads more clearly in the first visible seconds after `GO`.
- Strengthened the launch throttle floor so assertive AI no longer get visually pinned by opening-pack drag as soon as they begin rolling.
- Added regression coverage for the exact failure mode the user reported: assertive AI launches should still hold strong throttle under opening traffic.

## Verification Results

- `node --test tests/ai-profiles.test.mjs tests/ai-controller-cornering.test.mjs tests/ai-traffic-cornering.test.mjs tests/ai-track-following.test.mjs tests/track-intel-route-fidelity.test.mjs`
- `node --check js/AIProfiles.js && node --check js/AIController.js && node --check js/AIManager.js && node --check js/GameEngine.js`
- `git diff --check`
- Browser verification on `http://localhost:3000` with `8` AI on `starter-circuit`:
  - early launch sample moved from the earlier soft `~0.62-0.65` band to `~0.83-0.87` throttle while launch mode was active
  - launch lane bias and overtake/traffic mode separation were visible in debug during the opening seconds
  - follow-up sample showed `launchActiveCount: 0`, confirming the push fades back into normal race logic cleanly
- Todo scan: no todo files existed in `.context/compound-engineering/todos` or `todos`

## Sources & References

- `docs/plans/2026-04-14-008-fix-ai-overtaking-mistakes-and-aggression-pass-plan.md`
- Relevant files:
  - `js/AIController.js`
  - `js/AIProfiles.js`
  - `js/AIManager.js`
  - `js/GameEngine.js`
  - `tests/ai-controller-cornering.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
