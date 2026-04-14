---
title: "fix: deepen AI runtime tuning with better debug introspection"
type: fix
status: completed
date: 2026-04-14
origin: direct user follow-up after initial AI humanization verification ("Do it")
---

# fix: deepen AI runtime tuning with better debug introspection

## Overview

Follow the initial AI humanization pass with a deeper runtime-oriented tuning pass. The core route-following controller is already stable, but the current live-debug surface is still too thin for responsible multi-race tuning: seeded styles are active, yet runtime debug reports `profile: Unknown`, and the local debug helper is awkward for repeating solo smokes across multiple built-in tracks. This pass improves introspection first, then uses that visibility to validate and lightly tune the AI across real races without regressing route fidelity.

## Problem Frame

The first humanization pass succeeded at the source-test and short-smoke level, but there are still two gaps before the AI can be confidently tuned by feel:

- the runtime debug state does not expose which seeded style each bot is using, because `AIManager` does not retain the generated profile on the racer object
- the existing `window.__kartDebug.startSoloRace()` helper launches solo races, but it is not ergonomic for repeated built-in-track validation by track id

That leaves the next tuning pass partly blind. If the user wants stronger confidence across multiple tracks and longer races, the debug/runtime tooling should make AI style differences inspectable and the solo-race workflow repeatable before applying any additional tuning.

## Requirements Trace

- R1. AI runtime debug should expose the actual seeded style/profile used by each bot.
- R2. The debug output should surface enough style metadata to make live tuning legible.
- R3. Local debug tooling should make it easy to launch solo races on specific built-in tracks for repeated smoke tests.
- R4. Any tuning refinements in this pass must preserve the current route-following and recovery stability.
- R5. Validation should cover more than one built-in track.
- R6. The pass should end with focused tests, runtime browser verification, and plan closeout.

## Scope Boundaries

- No broad redesign of the AI steering model.
- No new named AI personality roster.
- No multiplayer-specific tuning or network changes.
- No changes to player controls, HUD presentation, or track geometry.

## Context & Research

### Relevant Code and Patterns

- `js/AIProfiles.js` now creates seeded CPU runtime profiles via `createSeededCPUProfile()`.
- `js/AIManager.js` creates the runtime profile per AI but currently does not retain it on the racer object.
- `js/GameEngine.js` exports AI runtime debug state via `_getDebugAIState()` and exposes browser-friendly helpers under `window.__kartDebug`.
- `js/TrackRegistry.js` exposes built-in track ids and cells for deterministic solo launches.
- `tests/ai-profiles.test.mjs` and `tests/ai-controller-cornering.test.mjs` cover the newly added bounded style variation.
- Existing stability guardrails remain:
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
  - `tests/track-intel-route-fidelity.test.mjs`

### Current Observations

- Browser runtime smoke showed healthy AI behavior, but `window.__kartDebug.getAIState()` still reported `profile: "Unknown"` because the profile is not stored on each racer.
- The current debug helper can already start solo races, so the safest enhancement is to extend it to accept built-in track ids instead of creating a new parallel launch path.
- Since the first humanization pass already produced differentiated speeds/throttle values in a short smoke, this follow-up should prefer visibility and light tuning rather than widening the behavior bands aggressively.

### External Research Decision

No external research needed. This is a repo-local runtime-debug and tuning-validation pass.

## Key Technical Decisions

- **Improve introspection before retuning**: expose runtime style/profile data first so any tuning changes are observable in the same pass.
- **Reuse the existing browser debug surface**: extend `window.__kartDebug` rather than creating a second local-only tuning path.
- **Keep tuning conservative**: only adjust variation bands if the new multi-track validation still shows overly synchronized behavior.
- **Prefer multi-track validation over one longer single-track run**: this gives better confidence that the style layer is not overfit to the starter circuit.

## Deferred to Implementation

- Which exact style fields are most useful to surface in runtime debug. Start with profile name plus a compact style subset such as `lookAheadBlend`, `cornerEntryWidth`, `cornerApexTightness`, `cornerSpeedFactor`, and `boostCommitDot`.
- Whether the follow-up tuning needs any numeric changes after the improved visibility is in place.

## Implementation Units

- [x] **Unit 1: Surface seeded AI style/profile data in runtime debug**

**Goal:** Make the live AI state trustworthy for tuning by exposing the actual generated style per bot.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `js/AIManager.js`
- Modify: `js/GameEngine.js`
- Modify: `tests` as needed for the exposed debug contract

**Approach:**
- Retain the generated seeded profile on each AI racer record.
- Extend the AI debug export to include the runtime profile name and a compact style summary object.
- Keep the debug output stable and serialization-friendly for browser evaluation.

**Patterns to follow:**
- Existing `getAIDebugData()` / `_getDebugAIState()` export path
- Existing seeded profile creation in `js/AIProfiles.js`

**Test scenarios:**
- Happy path: AI debug state includes the stored runtime profile data instead of `Unknown`.
- Edge case: debug state still works when no AI are active.

**Verification:**
- Browser/runtime debug inspection shows real per-bot style metadata.

---

- [x] **Unit 2: Extend local solo-race debug tooling for repeatable multi-track AI validation**

**Goal:** Make it easy to run real local AI smokes across multiple built-in tracks.

**Requirements:** R3, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/TrackRegistry.js` only if an existing helper is insufficient

**Approach:**
- Extend the existing `window.__kartDebug.startSoloRace()` path so callers can specify a built-in `trackId`, with the helper resolving track cells before launch.
- Keep the helper backward-compatible with the current plain solo-start behavior.
- Avoid introducing a second code path separate from normal `startRace()`.

**Patterns to follow:**
- Existing `TrackRegistry` lookup helpers
- Existing `window.__kartDebug` debug helper pattern in `AppShell`

**Test scenarios:**
- Happy path: debug helper can launch a solo race on a specified built-in track id.
- Edge case: invalid track id falls back safely or errors clearly without crashing.

**Verification:**
- Browser smoke can launch at least two built-in tracks through the debug helper.

---

- [x] **Unit 3: Re-run runtime tuning on multiple tracks and adjust only if necessary**

**Goal:** Use the improved visibility to confirm the field feels varied across tracks without destabilizing the controller.

**Requirements:** R4, R5, R6

**Dependencies:** Units 1-2

**Files:**
- Modify: `js/AIProfiles.js` only if runtime observations justify a small tuning change
- Modify: AI tests if any tuning values or debug contracts change

**Approach:**
- Run repeatable local smokes on multiple built-in tracks.
- Inspect:
  - profile/style distribution in debug state
  - progress separation across a short dwell
  - reversals or recovery regressions
  - visible variation in speed/throttle bands
- Only tune the seeded variation bands if the pack still looks too synchronized after adding visibility.

**Patterns to follow:**
- Existing bounded seeded-profile approach from the previous pass

**Test scenarios:**
- Happy path: multiple tracks show stable AI with visible style differences.
- Edge case: no AI enter repeated reverse recovery after a short dwell on either track.
- Edge case: any tuning adjustments remain inside explicit safe bands.

**Verification:**
- Focused tests still pass and browser smokes remain healthy on multiple tracks.

---

- [x] **Unit 4: Review, browser verification, and plan closeout**

**Goal:** Finish the `lfg` loop with a durable verification record.

**Requirements:** R1-R6

**Dependencies:** Units 1-3

**Files:**
- Modify: `docs/plans/2026-04-14-007-fix-ai-runtime-tuning-pass-and-debug-introspection-plan.md` checkboxes only

**Approach:**
- Run focused tests and syntax checks for touched files.
- Run `git diff --check`.
- Perform browser/runtime validation on multiple built-in tracks.
- Record the final outcomes in this plan.

**Verification:**
- Tests pass, browser validation passes, and this plan is marked completed.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Debug improvements accidentally change gameplay code paths | Keep debug-only additions read-only and route all launches through existing `startRace()` |
| Multi-track validation reveals overfit tuning | Adjust only the smallest seeded bands needed, then rerun the focused suites |
| Runtime debug payload becomes noisy or brittle | Keep the exposed style summary compact and stable |

## Verification

- Focused tests around any touched AI/debug files
- `node --check` on touched modules
- `git diff --check`
- Browser validation on multiple built-in solo tracks

## Outcome

- Stored the seeded AI profile on each runtime racer and exposed a compact, rounded style summary in `window.__kartDebug.getAIState()`, so browser smokes now report `profile: "CPU"`, `profileSeed`, and per-bot style values instead of `Unknown`.
- Extended the existing debug solo-race helper to accept built-in `trackId` values through the normal `startRace()` path, which made repeatable multi-track smokes straightforward without introducing a second launcher.
- Re-ran the runtime pass on `starter-circuit` and `reverse-rush`. Both tracks stayed stable with `trackIntelValid: true`, `aiCount: 6`, `running: true`, and `reversingCount: 0` after short dwell windows.
- The new style data showed visible per-bot differences in lane offset, corner approach, and boost thresholds. No additional numeric tuning was required in this pass once the runtime debug surface became legible.

## Verification Results

- `node --test tests/ai-profiles.test.mjs tests/app-shell-menu-music.test.mjs tests/ai-controller-cornering.test.mjs tests/ai-track-following.test.mjs tests/ai-traffic-cornering.test.mjs tests/track-intel-route-fidelity.test.mjs`
- `node --check js/AIProfiles.js && node --check js/AIManager.js && node --check js/GameEngine.js && node --check js/ui/core/AppShell.js`
- `git diff --check`
- Browser smoke via `agent-browser` on `http://localhost:3000`
- Browser verification details:
  - `window.__kartDebug.setAICount(6)`
  - `window.__kartDebug.startSoloRace({ trackId: 'starter-circuit' })`
  - `window.__kartDebug.startSoloRace({ trackId: 'reverse-rush' })`
  - both races reported seeded style metadata for each AI bot and no browser errors during the smoke

## Sources & References

- `docs/plans/2026-04-14-006-fix-ai-humanize-racecraft-without-regressing-route-fidelity-plan.md`
- Relevant files:
  - `js/AIProfiles.js`
  - `js/AIManager.js`
  - `js/GameEngine.js`
  - `js/ui/core/AppShell.js`
  - `js/TrackRegistry.js`
