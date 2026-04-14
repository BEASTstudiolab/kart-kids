---
title: "fix: add AI overtaking, bounded mistakes, and aggression variation"
type: fix
status: completed
date: 2026-04-14
origin: direct user request via /lfg ("do all of those")
---

# fix: add AI overtaking, bounded mistakes, and aggression variation

## Overview

Follow the initial humanization and runtime-debug passes with the next real feel upgrade: make AI drivers choose and commit to passes more like racers, introduce small recoverable mistakes so they do not look machine-perfect, and differentiate aggression per bot without reopening the route-fidelity regressions that were just stabilized.

## Problem Frame

The current AI are stable and visibly less synchronized than before, but they still feel too robotic for three reasons:

- traffic response is mostly defensive, so AI slow down around blockers instead of showing enough lane-commit and pass intent
- steering and throttle choices are still too clean over time, so bots rarely make the kind of small recoverable errors a human driver would
- seeded variation affects line and pace, but not enough of each bot's racecraft identity, so the field still feels flatter than it should

The goal of this pass is to add more believable behavior without making the AI sloppy or brittle. Any new variation must stay bounded, deterministic per seed, and compatible with the current recovery and route-following safeguards.

## Requirements Trace

- R1. AI should show overtaking intent instead of only reducing speed behind traffic.
- R2. Overtaking should be lane-aware and should not cause unstable corner-cutting in hard turns.
- R3. AI should make occasional small mistakes and recover from them without entering broken oscillation or repeated reverse states.
- R4. Each AI should expose stronger aggression-style differences while remaining deterministic per seed.
- R5. Existing route fidelity, traffic safety, and recovery stability must remain intact.
- R6. The pass should end with focused tests, review/autofix, todo resolution, browser verification, and plan closeout.

## Scope Boundaries

- No rewrite of the full route-planning model.
- No multiplayer-specific combat or rubber-band redesign.
- No new named roster UI or player-facing bot personalities.
- No item-balance redesign.

## Context & Research

### Relevant Code and Patterns

- `js/AIController.js` already supports seeded lane spread, corner entry/apex planning, traffic occupancy checks, and safe reverse recovery.
- `js/AIProfiles.js` already provides bounded seeded CPU style generation and runtime style summaries.
- `js/AIManager.js` stores the seeded profile and debug style summary per AI racer.
- `tests/ai-controller-cornering.test.mjs` covers hard-turn lane shaping, braking, seeded line spread, and recovery behavior.
- `tests/ai-traffic-cornering.test.mjs` covers traffic slowdown and corner-safety behavior.
- `tests/track-intel-route-fidelity.test.mjs` and `tests/ai-track-following.test.mjs` protect the existing route model.

### Current Observations

- The controller already has the pieces for route-aware passing, but traffic handling collapses mostly into throttle suppression plus a bounded lateral bias.
- The seeded profile system is the safest place to add aggression and mistake tendencies because it keeps per-bot behavior deterministic.
- The biggest regression risk is allowing aggressive lane changes inside hard corners or turning "mistakes" into erratic steering noise.

### External Research Decision

No external research needed. This is a repo-local gameplay-tuning pass.

## Key Technical Decisions

- **Build on the seeded profile system**: express aggression, pass commitment, and mistake cadence as bounded per-seed profile values rather than ad hoc randomness.
- **Keep overtakes route-aware**: prefer lane commitments on straights and gentle bends, and continue suppressing hard traffic dodges in sharp corners.
- **Use bounded mistake windows, not constant wobble**: short-lived humanizing moments should slightly alter throttle or targeting, then decay cleanly.
- **Keep debug visibility first-class**: new racecraft state should be inspectable in debug so follow-up tuning is grounded.

## Deferred to Implementation

- The exact profile fields needed for aggression and mistake behavior.
- Whether aggression should influence boost thresholds, traffic patience, overtake lane bias, or all three.
- Which pieces of the new racecraft state are most useful to surface in debug.

## Implementation Units

- [x] **Unit 1: Extend seeded AI profiles with aggression and mistake parameters**

**Goal:** Give each AI a deterministic racecraft identity that can drive overtakes and bounded mistakes.

**Requirements:** R3, R4

**Dependencies:** None

**Files:**
- Modify: `js/AIProfiles.js`
- Modify: tests for profile bounds and summaries

**Approach:**
- Add bounded seeded fields for aggression, pass commitment, traffic patience, and mistake cadence/severity.
- Extend the compact runtime style summary with the most important racecraft fields.
- Keep all values inside explicit safe ranges.

**Verification:**
- Profile tests prove values remain deterministic and bounded.

---

- [x] **Unit 2: Add route-aware overtaking intent to the AI controller**

**Goal:** Make AI commit to believable passes on passable sections instead of only lifting behind traffic.

**Requirements:** R1, R2, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: AI controller traffic/cornering tests

**Approach:**
- Add a lane-commit overtake planner that activates when a blocker is ahead and the section is safe enough.
- Let aggression influence how quickly a bot commits to a pass and how much throttle it preserves while passing.
- Preserve the existing sharp-corner suppression so overtakes do not become wild dive-bombs in tight bends.

**Verification:**
- Tests show AI prefers a passable lane on straights and still backs off in sharp-corner traffic.

---

- [x] **Unit 3: Add bounded small-mistake windows and clean recovery behavior**

**Goal:** Break up robotic perfection with occasional believable errors that never look broken.

**Requirements:** R3, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: controller tests as needed

**Approach:**
- Add deterministic short-lived mistake windows that slightly soften throttle, widen an entry, miss a perfect apex, or delay a boost decision.
- Keep mistakes disabled during recovery, wall escape, and high-risk corner states.
- Ensure the controller naturally settles back to its normal target after the mistake window closes.

**Verification:**
- Tests prove mistakes stay bounded and do not trigger unstable reverse/recovery behavior.

---

- [x] **Unit 4: Review, focused verification, and browser validation**

**Goal:** Close the `/lfg` loop with proof that the feature improved feel without reopening stability issues.

**Requirements:** R1-R6

**Dependencies:** Units 1-3

**Files:**
- Modify: this plan file for completion only

**Approach:**
- Run focused AI/profile/route tests and syntax checks.
- Run `git diff --check`.
- Run browser verification on multiple built-in tracks with debug inspection.
- Record whether any additional numeric tuning was needed after implementation.

**Verification:**
- Tests pass, browser smokes pass, and the plan is marked complete.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Aggression makes bots cut across corners unsafely | Gate overtake commitments by turn severity and keep sharp-corner suppression in place |
| Mistakes look like bugs instead of human variance | Use short bounded windows with low amplitude and disable them during recoveries |
| New profile fields become unbounded or hard to tune | Keep every new field inside explicit ranges and expose them in debug summaries |

## Verification

- Focused tests around AI profiles, controller behavior, and route fidelity
- `node --check` on touched modules
- `git diff --check`
- Browser validation on multiple built-in solo tracks

## Outcome

- Extended the seeded CPU profile model with aggression, overtake commitment, traffic patience, mistake rate, and mistake severity so each bot now carries a broader racecraft identity instead of only line and pace variation.
- Added route-aware overtake commitment in `AIController`, allowing bots to hold a pass direction and preserve more throttle on straights and gentler bends while still suppressing unsafe lateral moves in hard corners.
- Added bounded short-lived hesitation and wide-line mistake windows with automatic settle-back behavior, and explicitly disabled those windows during recovery and wall-escape states.
- Extended the runtime debug surface so browser inspection now exposes overtake and mistake activation alongside the existing per-bot style summary.

## Verification Results

- `node --test tests/ai-profiles.test.mjs tests/ai-controller-cornering.test.mjs tests/ai-traffic-cornering.test.mjs tests/ai-track-following.test.mjs tests/track-intel-route-fidelity.test.mjs`
- `node --check js/AIProfiles.js && node --check js/AIController.js && node --check js/AIManager.js && node --check js/GameEngine.js`
- `git diff --check`
- No todo files existed in `.context/compound-engineering/todos/` or `todos/`, so there was nothing to resolve in the todo-resolve step.
- Browser verification via `agent-browser` on `http://localhost:3000` with `window.__kartDebug.setAICount(8)`:
  - `reverse-rush`: live debug showed `overtakeCount: 1`, `mode: "overtake"` on one AI, `trackIntelValid: true`, `running: true`, and `reversingCount: 0`
  - `starter-circuit`: live debug showed `mistakeCount: 1`, `mode: "mistake-hesitate"` on one AI, `trackIntelValid: true`, and `reversingCount: 0`
  - browser errors: none

## Sources & References

- `docs/plans/2026-04-14-006-fix-ai-humanize-racecraft-without-regressing-route-fidelity-plan.md`
- `docs/plans/2026-04-14-007-fix-ai-runtime-tuning-pass-and-debug-introspection-plan.md`
- Relevant files:
  - `js/AIProfiles.js`
  - `js/AIController.js`
  - `js/AIManager.js`
  - `tests/ai-profiles.test.mjs`
  - `tests/ai-controller-cornering.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
