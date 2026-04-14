---
title: "feat: animate the home menu rider seated on the kart"
type: feat
status: completed
date: 2026-04-14
origin: direct user request (2026-04-14)
---

# feat: animate the home menu rider seated on the kart

## Overview

Make the main menu's shared 3D lobby scene show the player character seated on the selected kart using the animated garage idle clip, so the home/menu experience feels like the same posed rider the user sees in the character menu instead of a static frozen driving pose.

## Problem Frame

The active product surface no longer uses the legacy routed `HOME` page as its primary shell. The visible main menu experience is the tabbed shell backed by `js/ui/LobbyScene.js`. That scene already mounts the selected kart and attaches the player character to the seat anchor, but it plays the separate driving clip and freezes it on frame zero. The result is close to the right fantasy but misses the livelier seated animation the character menu already has.

## Requirements Trace

- R1. The main menu lobby scene keeps the character seated on the selected kart.
- R2. The seated rider uses the same garage idle animation asset already used by the character preview.
- R3. The menu rider stays animated instead of freezing on the first frame.
- R4. Existing menu kart attachment, appearance application, and render-loop behavior remain intact.

## Scope Boundaries

- No changes to the private party lobby scene.
- No changes to the legacy routed `Page02Home*` reference pages unless implementation reveals a direct dependency.
- No new authored animation assets or retuning of kart seat offsets beyond what is needed to keep the rider seated correctly.
- No redesign of the menu layout or shell controls.

## Context & Research

### Relevant Code and Patterns

- `js/ui/LobbyScene.js` is the live shared menu scene used behind the PLAY, CHARACTER, GARAGE, and PROFILE tabs.
- `js/ui/LobbyScene.js` already attaches the character to the kart `seat_anchor`, applies player appearance, and advances a `THREE.AnimationMixer` in `update(dt)`.
- `js/ui/CharacterPreviewScene.js` already loads `CHARACTER_GARAGE_IDLE_ANIMATION_PATH` and plays it as the canonical garage/menu character animation.
- `js/CharacterCustomization.js` exports `CHARACTER_GARAGE_IDLE_ANIMATION_PATH`, which is the lowest-risk source of truth for the asset path.
- `tests/lobby-assets.test.mjs` already performs source-level regression checks for `LobbyScene`, so it is a natural place to pin the new animation choice.

## Key Technical Decisions

- **Change `LobbyScene`, not the legacy home page controller**: the tabbed shell is the real main screen, so the live 3D background scene is the right integration point.
- **Reuse `CHARACTER_GARAGE_IDLE_ANIMATION_PATH`**: importing the existing constant avoids hardcoding another copy of the asset path and keeps the seated menu presentation aligned with the character preview.
- **Keep the animation live**: the menu render loop already updates the lobby mixer every frame, so the simplest and most truthful behavior is to let the garage idle clip keep playing instead of pausing it.

## Open Questions

### Resolved During Planning

- **Should this target the shared menu scene or only the old `/home` page?** The shared menu scene.
- **Should we keep the old driving pose and just unfreeze it?** No. The request explicitly points at the garage idle pose, so the lobby should use that clip instead.

### Deferred to Implementation

- Exact seat offset compatibility with the garage idle clip. If the existing offsets are slightly off, implementation can make a minimal adjustment only where necessary.

## Implementation Units

- [x] **Unit 1: Switch the live menu rider to the garage idle clip**

**Goal:** Make the shared menu `LobbyScene` use the animated garage idle clip while keeping the rider attached to the selected kart.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `js/ui/LobbyScene.js`

**Approach:**
- Import `CHARACTER_GARAGE_IDLE_ANIMATION_PATH` from `js/CharacterCustomization.js`.
- Replace the hardcoded driving animation path with that shared constant.
- Remove the freeze-on-first-frame behavior so the menu rider keeps animating while the lobby scene is active.
- Preserve the existing seat-anchor attach flow, appearance application, async generation guards, and render-loop mixer updates.

**Patterns to follow:**
- `js/ui/CharacterPreviewScene.js` idle animation loading and mixer setup
- Existing `LobbyScene` async load guards and appearance timing

**Test scenarios:**
- Happy path: the lobby scene source points at the shared garage idle animation constant.
- Happy path: the lobby animation action is started without immediately pausing on the first frame.
- Edge case: if the animation loads after the character mesh, the scene still binds and plays it using the existing async flow.

**Verification:**
- Targeted tests pass and browser verification shows the menu rider seated and animated on the main PLAY screen.

---

- [x] **Unit 2: Add a focused regression test for the menu rider animation choice**

**Goal:** Prevent the shared menu scene from silently reverting to the old frozen driving pose.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `tests/lobby-assets.test.mjs`

**Approach:**
- Extend the existing `LobbyScene` source checks to assert that the garage idle constant is imported/used and that the scene no longer pauses the action immediately after starting it.

**Patterns to follow:**
- Existing source-level assertions in `tests/lobby-assets.test.mjs`

**Test scenarios:**
- Happy path: `LobbyScene` references `CHARACTER_GARAGE_IDLE_ANIMATION_PATH`.
- Happy path: `LobbyScene` does not contain the old `action.paused = true;` freeze behavior.

**Verification:**
- `node --test tests/lobby-assets.test.mjs`
