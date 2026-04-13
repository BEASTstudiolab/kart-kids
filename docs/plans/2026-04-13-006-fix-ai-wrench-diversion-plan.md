---
title: "fix: stop AI wrench-seeking from pulling off the race line"
type: fix
status: completed
date: 2026-04-13
origin: direct request after visual debug review ("is it coded that the cpu drivers go for the powerups?")
---

# fix: stop AI wrench-seeking from pulling off the race line

## Overview

Investigate whether AI pickup logic is overriding route-following, then constrain that behavior so CPU racers stay committed to the race line instead of steering into barriers or adjacent lanes.

## Problem Frame

The new in-race route-path overlay shows cases where AI karts are visibly not following the displayed `TrackIntel` path. The user hypothesis was that the bots might be steering toward powerups instead of the route.

Repo inspection shows:

- `ItemBoxManager` only checks pickups against the local player vehicle, not AI.
- AI are granted random held items in `GameEngine`, but do not steer toward item boxes to collect them.
- AI do override steering toward repair wrenches when damaged.
- That wrench target is currently selected by raw nearest world-space distance.

On tracks with parallel lanes, crossovers, or nearby segments separated by barriers, “nearest by Euclidean distance” can point to a wrench on the wrong lane or behind a wall. That matches the observed symptom: bots abandon the green route path and drive into the wall trying to cut straight to a pickup they cannot reach directly.

## Requirements Trace

- R1. AI must not steer toward item boxes/powerup boxes, because those are not part of AI pathing.
- R2. AI wrench-seeking must only consider route-compatible targets, not arbitrary nearest world-space pickups.
- R3. Cornering and wall-recovery must stay higher priority than optional pickup seeking.
- R4. Add regression coverage for the “parallel lane / across barrier” pickup case.
- R5. Keep the current route-path debug overlay and driving-model refactor intact.

## Scope Boundaries

- No redesign of the full AI driving model.
- No new pickup type behavior beyond wrench-seeking constraints.
- No overhaul of combat/item grant rules.
- No multiplayer or race-mode changes.

## Context & Research

### Relevant Code and Patterns

- `js/AIController.js` — computes route target, then optionally overrides steering toward a wrench.
- `js/AICombatBehavior.js` — decides when AI seek wrenches and currently chooses the nearest one.
- `js/WrenchPickupManager.js` — exposes available wrench positions.
- `js/ItemBoxManager.js` — confirms item boxes are only collected by the local player.
- `js/GameEngine.js` — passes wrench positions into AI and grants AI random held items.
- `tests/ai-track-following.test.mjs` — current steering/cornering regression surface.
- `tests/ai-traffic-cornering.test.mjs` — current local lane/traffic regression surface.

### Current Observations

- `ItemBoxManager.update()` checks pickup radius against `localVehicle` only.
- `GameEngine` gives AI held items randomly; there is no AI navigation toward item boxes.
- `AIController` calls `AICombatBehavior.getNearestWrench()` and directly steers at that world position.
- `AICombatBehavior.getNearestWrench()` currently uses only Euclidean distance, with no notion of route progress, lane, barrier separation, corner severity, or local forward corridor.

### External Research Decision

No external research needed. This is a repo-local bug investigation and fix.

## Key Technical Decisions

- **Treat item-box chasing as disproven**: keep the fix focused on wrench-seeking, not item boxes.
- **Keep wrench-seeking optional and subordinate**: pickup pursuit should never beat survival and route fidelity in corners or wall-recovery.
- **Use route-relative filtering, not raw distance**: only allow wrench targets that are plausibly ahead on the current path corridor.
- **Add a characterization regression**: protect against the exact “adjacent parallel lane” failure mode seen in debug.

## Deferred to Implementation

- Whether the best filter lives in `AICombatBehavior.getNearestWrench()` or a new `AIController` helper.
- Whether to gate wrench seeking only by spatial corridor, or by both corridor and turn severity.
- Whether a same-lane “ahead only” heuristic is sufficient, or whether route-progress scoring is also needed.

## Implementation Units

- [x] **Unit 1: Document and isolate the actual pickup-diversion source**

**Goal:** Confirm in code that item boxes are not the steering issue, and identify wrench-seeking as the real steering override.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Read: `js/ItemBoxManager.js`
- Read: `js/GameEngine.js`
- Read: `js/AIController.js`
- Read: `js/AICombatBehavior.js`

**Approach:**
- Preserve the repo understanding in this plan and in final explanation.
- Use that finding to scope the fix to wrench targeting rather than item-box logic.

**Verification:**
- Implementation work targets wrench-seeking only; no item-box steering code is introduced.

---

- [x] **Unit 2: Constrain AI wrench-seeking to route-compatible targets**

**Goal:** Prevent damaged AI from cutting across walls or parallel lanes for a wrench.

**Requirements:** R2, R3, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/AIController.js`
- Modify: `js/AICombatBehavior.js`

**Approach:**
- Replace raw nearest-wrench pursuit with filtering/ranking based on the current route direction and local corridor.
- Keep wrench-seeking disabled when the kart is already in a sharp corner, traffic pinch, or wall-recovery state.
- Fall back to normal route-following if no safe wrench target qualifies.

**Patterns to follow:**
- Existing route-sample usage in `AIController`
- Existing combat behavior separation in `AICombatBehavior`

**Test scenarios:**
- Happy path: a wrench directly ahead on the route can still be targeted.
- Edge case: a closer wrench on a neighboring lane or across a barrier is ignored.
- Edge case: sharp-corner / wall-recovery states do not get overridden by wrench pursuit.

**Verification:**
- Steering override only occurs for route-compatible wrench targets.

---

- [x] **Unit 3: Add regression coverage for pickup-diversion cases**

**Goal:** Lock in the fix so future AI tweaks do not reintroduce lane-cutting toward pickups.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 2

**Files:**
- Modify: `tests/ai-track-following.test.mjs`
- Modify: `tests/ai-traffic-cornering.test.mjs` if helpful

**Approach:**
- Add a focused regression where a damaged AI sees a wrench that is spatially close but not route-compatible.
- Assert the controller keeps following the route instead of steering toward the blocked pickup.

**Verification:**
- Focused AI tests pass and cover the new failure mode.

---

- [x] **Unit 4: Validate runtime behavior after the pickup fix**

**Goal:** Confirm the game still boots cleanly and AI startup works after the targeting change.

**Requirements:** R4, R5

**Dependencies:** Unit 3

**Files:**
- Modify: `docs/plans/2026-04-13-006-fix-ai-wrench-diversion-plan.md` checkboxes only

**Approach:**
- Run focused AI tests and syntax checks.
- Do a browser smoke on local race startup with AI enabled.

**Verification:**
- Tests pass.
- Local race startup still initializes AI with no new runtime errors.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wrench-seeking becomes too conservative and effectively never triggers | Allow clearly ahead, same-corridor wrenches to remain eligible |
| Fix masks a deeper core steering bug | Keep the scope narrow and leave route/corner regressions intact |
| Controller logic grows too tangled | Prefer one helper for wrench target selection over scattering conditions |

## Verification

- Run focused tests:
  - `tests/ai-track-following.test.mjs`
  - `tests/ai-traffic-cornering.test.mjs`
  - `tests/track-intel-route-fidelity.test.mjs`
- Run `node --check` on touched modules.
- Local browser smoke on race startup with AI enabled.

## Sources & References

- `js/AIController.js`
- `js/AICombatBehavior.js`
- `js/ItemBoxManager.js`
- `js/WrenchPickupManager.js`
- `js/GameEngine.js`
