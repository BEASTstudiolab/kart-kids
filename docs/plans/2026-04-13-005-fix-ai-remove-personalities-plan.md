---
title: "fix: simplify AI by removing personality variance"
type: fix
status: completed
date: 2026-04-13
origin: direct request ("maybe the personalities have something to do with it? remove the personalities")
---

# fix: simplify AI by removing personality variance

## Overview

Collapse the AI roster onto a single safe baseline driver profile and remove personality-specific routing from steering, traffic behavior, combat/item decisions, and debug/UI labels.

## Problem Frame

The recent AI refactor improved route sampling and traffic response, but live testing still shows corner failures. At this point, one likely confounder is that the repo still runs multiple AI personalities with different:

- line offsets,
- look-ahead distances,
- traffic behavior,
- boost timing,
- stuck/recovery patience,
- and combat/item decision branches.

That makes runtime behavior harder to reason about and easier to misdiagnose. If one or two aggressive/drifty variants are still overcommitting corners, the pack can look “generally broken” even when the baseline controller is improving.

Before going deeper into AI pathing, the next clean experiment is to remove personality variance entirely and run every AI kart through one stable CPU driver. This lowers the moving-part count and gives us a clearer read on whether the remaining corner issue is core pathing or just profile diversity.

## Requirements Trace

- R1. All AI racers use the same controller tuning at runtime.
- R2. Remove personality-based steering/line/traffic variation from the driving stack.
- R3. Remove personality-based combat/item branching so behavior is consistent across all AI.
- R4. Downstream UI/debug/ranking surfaces stop implying multiple AI personalities.
- R5. Preserve the current AI driving-model refactor, race loop, and AI fill behavior.
- R6. Update regression coverage so tests validate the single-profile CPU model instead of personality differences.

## Scope Boundaries

- No new AI tuning pass beyond choosing one safe baseline profile.
- No redesign of TrackIntel, RaceMode, or multiplayer.
- No changes to player vehicle handling.
- No reintroduction of personalities under a different name in this pass.

## Context & Research

### Relevant Code and Patterns

- `js/AIProfiles.js` — currently exports `DEFAULT_PROFILE` plus `AI_PROFILES`.
- `js/AIController.js` — consumes per-profile tuning and profile name.
- `js/AIManager.js` — assigns profiles round-robin and exposes `profileName` in race data.
- `js/AICombatBehavior.js` — branches item/wrench/combat behavior by `profileName`.
- `js/DebugPanelSetup.js` — shows personality names in the debug UI.
- `js/RaceMode.js` — uses `profileName` as the AI display name in rankings.
- `tests/ai-track-following.test.mjs` and `tests/ai-traffic-cornering.test.mjs` — current AI regression surface.
- `docs/plans/2026-04-13-004-fix-ai-driving-model-plan.md` — current AI-driving refactor plan; this change intentionally simplifies one layer of that work.

### Current Observations

- `AIManager` still assigns `AI_PROFILES[index % AI_PROFILES.length]`, so the race remains heterogeneous even after the route/traffic refactor.
- `AICombatBehavior` still gives `aggressive`, `cautious`, and `strategist` special behavior branches.
- `RaceMode` and `DebugPanelSetup` still surface personality names, which reinforces the idea of intentionally varied AI behavior.
- The cleanest simplification is to keep one exported baseline profile and make every AI use it consistently.

### External Research Decision

No external research needed. This is a repo-local simplification and cleanup pass.

## Key Technical Decisions

- **Keep one explicit baseline AI config**: Preserve a single shared CPU profile object so tuning still has one home, but remove the roster of variants.
- **Use one stable AI display label**: Replace personality-derived names with a uniform CPU label in race/debug surfaces.
- **Flatten combat behavior to the default path**: Remove personality-name branches from `AICombatBehavior` so item/wrench decisions follow one consistent rule set.
- **Prefer deletion over dormant options**: If a personality surface is no longer used, remove it rather than leaving dead branches in place.
- **Preserve controller extensibility lightly**: It is acceptable for `AIController` to still accept a profile object internally if that keeps tests clean, but runtime should no longer vary it per AI.

## Deferred to Implementation

- Whether the safest baseline should be the current `DEFAULT_PROFILE` as-is or a lightly adjusted CPU profile derived from it.
- Whether the debug panel should hide the old personality line entirely or replace it with a simpler AI status label.
- Whether `AIController` should stop threading `profileName` into combat behavior entirely or just pass a constant label.

## Implementation Units

- [x] **Unit 1: Collapse runtime AI tuning to one baseline profile**

**Goal:** Remove round-robin personality assignment so every AI kart uses one shared CPU profile.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `js/AIProfiles.js`
- Modify: `js/AIManager.js`
- Modify: `js/AIController.js` only if runtime profile handling can be simplified safely

**Approach:**
- Replace `AI_PROFILES` with a single exported baseline profile (for example `CPU_AI_PROFILE`) or equivalent single-profile structure.
- Update `AIManager` to use that same profile for every spawned AI.
- Remove any runtime-only personality naming assumptions from the controller/manager path.

**Patterns to follow:**
- Existing `DEFAULT_PROFILE` object structure in `js/AIProfiles.js`
- Existing AIManager spawn ownership pattern

**Test scenarios:**
- Happy path: every spawned AI receives the same effective tuning profile.
- Edge case: AI count changes still spawn/despawn correctly without profile array indexing.

**Verification:**
- No runtime code path assigns different profiles by index anymore.

---

- [x] **Unit 2: Remove personality-based combat and UI/debug branches**

**Goal:** Eliminate non-driving behavior differences tied to old personality names.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AICombatBehavior.js`
- Modify: `js/DebugPanelSetup.js`
- Modify: `js/RaceMode.js`
- Modify: `js/AIManager.js`

**Approach:**
- Flatten `AICombatBehavior` onto the existing default decision path.
- Replace `profileName`-driven race/debug labels with a uniform CPU label.
- Remove personality display text from the debug panel or replace it with a non-personality AI summary.

**Patterns to follow:**
- Existing default branches already present in `js/AICombatBehavior.js`
- Existing race/debug label wiring in `js/RaceMode.js` and `js/DebugPanelSetup.js`

**Test scenarios:**
- Happy path: race ranking still renders AI labels cleanly.
- Happy path: debug UI no longer lists multiple personalities.
- Edge case: AI item/wrench behavior remains valid with no special profile names.

**Verification:**
- No remaining runtime branch depends on `aggressive`, `cautious`, `drifter`, or `strategist`.

---

- [x] **Unit 3: Update regression coverage for the single-profile model**

**Goal:** Bring tests in line with the simplified AI contract and keep the new driving-model coverage intact.

**Requirements:** R1, R2, R6

**Dependencies:** Units 1-2

**Files:**
- Modify: `tests/ai-track-following.test.mjs`
- Modify: `tests/ai-traffic-cornering.test.mjs`
- Modify: `tests/race-mode-position-leaderboard.test.mjs`

**Approach:**
- Remove expectations that depend on distinct AI personalities.
- Keep the cornering/traffic assertions focused on the shared CPU driver behavior.
- Update leaderboard/race-data tests to use the new uniform AI label.

**Patterns to follow:**
- Existing Node test style in the touched test files

**Test scenarios:**
- Happy path: AI driving tests still pass under the single-profile model.
- Happy path: leaderboard tests render the new AI label correctly.
- Edge case: no test still assumes round-robin personality assignment or profile-name variety.

**Verification:**
- Focused AI and leaderboard suites pass.

---

- [x] **Unit 4: Validate the simplified runtime behavior**

**Goal:** Confirm the single-profile simplification lands cleanly in the real race loop.

**Requirements:** R1, R5, R6

**Dependencies:** Unit 3

**Files:**
- Modify: `docs/plans/2026-04-13-005-fix-ai-remove-personalities-plan.md` checkboxes only

**Approach:**
- Re-run the focused AI tests.
- Do a local browser/race smoke to confirm AI still spawn and run under the simplified model.
- Use this pass to judge whether personalities were materially contributing to the remaining corner issue.

**Verification:**
- Focused tests pass.
- Runtime AI initializes and races with the uniform CPU profile.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Removing personalities hides a deeper controller bug without fixing it | Treat this as a simplification experiment and preserve current cornering regression coverage |
| Combat/item behavior becomes too bland or too eager | Use the existing default branch as the baseline rather than inventing a new behavior set |
| Downstream UI/tests still assume profile names | Update race/debug/test surfaces in the same pass |

## Verification

- Run focused tests:
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
  - `tests/race-mode-position-leaderboard.test.mjs`
  - `tests/track-intel-route-fidelity.test.mjs`
- Local browser smoke on the race page with AI enabled.

## Sources & References

- `docs/plans/2026-04-13-004-fix-ai-driving-model-plan.md`
- `docs/plans/2026-04-01-002-feat-ai-personality-profiles-plan.md`
- Relevant files:
  - `js/AIProfiles.js`
  - `js/AIManager.js`
  - `js/AIController.js`
  - `js/AICombatBehavior.js`
  - `js/DebugPanelSetup.js`
  - `js/RaceMode.js`
