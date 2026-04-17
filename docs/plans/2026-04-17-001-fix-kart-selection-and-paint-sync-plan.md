---
title: "fix: Sync latest origin/master and repair kart selection + paint persistence"
type: fix
status: active
date: 2026-04-17
---

# fix: Sync latest origin/master and repair kart selection + paint persistence

## Overview

Sync the local checkout to the latest remote default branch, then fix the menu customization flow so kart choice and kart paint stay consistent across Garage, Karts, lobby, quick play, and race boot. The user explicitly wants the result pushed directly back to the default branch after verification.

## Problem Frame

The repository's remote default branch is `master`, not `main`. The current branch (`codex/menu-music-visualizer`) is an ancestor of `origin/master`, so the requested "force pull" is functionally a sync onto the latest `origin/master`, not a destructive overwrite of unique branch-only commits.

The customization bug is rooted in split persistence:

- newer menu surfaces write kart choice to `loadout.selectedKartId`
- older runtime paths still read or listen to the legacy top-level `vehicleModel`

That split can make the chosen kart, its live preview, or its applied paint appear stale or inconsistent depending on which flow the player used last.

## Requirements Trace

- R1. Update the local checkout to the latest `origin/master` before making the fix.
- R2. Keep the user's requested direct-to-default-branch workflow intact, while avoiding unnecessary loss of local untracked artifacts.
- R3. Make kart selection persist consistently regardless of whether the user changes it from Garage, the Karts page, or the in-race/settings menu.
- R4. Keep kart paint/color customization applying to the currently selected kart across menu and race-entry flows.
- R5. Preserve compatibility with code that still reads or listens to `vehicleModel`.
- R6. Add focused regression coverage for the settings sync and the relevant menu/race flows.
- R7. Validate the fix in a browser before pushing back to `master`.

## Scope Boundaries

- Do not redesign the Garage, Karts, or settings UI.
- Do not change vehicle paint from global-per-player to per-kart storage.
- Do not alter multiplayer protocol payloads unless the existing settings compatibility fix proves insufficient.
- Do not refactor the entire settings system; only normalize the kart-selection compatibility layer needed for this bug.

## Context & Research

### Relevant Code and Patterns

- `js/Settings.js` owns persisted settings, schema migrations, and `settings-changed` dispatches.
- `js/ui/panels/GaragePanel.js` and `js/ui/pages/page11-kart-select/Page11KartSelectController.js` persist kart choice via `setSelectedKartId()`.
- `js/ui/pages/page03-quick-play/Page03QuickPlayController.js`, `js/ui/pages/page05-lobby/Page05LobbyController.js`, and `js/GameEngine.js` still contain legacy `vehicleModel` reads/listeners.
- `tests/unit/settings.spec.js` already covers settings defaults and migrations, making it the right place for compatibility regression tests.
- `tests/e2e/play-modes.spec.js` and `tests/e2e/garage.spec.js` already exercise the affected menu surfaces and can be extended with targeted seeded-localStorage scenarios.

### Repo State

- `origin/HEAD` points to `origin/master`.
- `codex/menu-music-visualizer` is behind `origin/master` and appears on the direct ancestry path, so syncing to `origin/master` should not discard unique commits from this branch.
- The worktree currently contains untracked local artifacts (`.agents/`, `.context/`, `browser-inspector/`, plan docs). They should be left alone unless a branch switch would overwrite them.

## Key Technical Decisions

- **Sync onto `origin/master` before code changes.**
  Rationale: the user explicitly asked for the latest default-branch state first, and the current branch ancestry makes this low-risk.

- **Centralize kart-selection compatibility inside `Settings`.**
  Rationale: both new and legacy callers should remain correct without requiring a sweeping refactor across the codebase.

- **Mirror both stored values and both change events.**
  Rationale: persistence alone is not enough; listeners that still watch `vehicleModel` need to react when newer flows call `setSelectedKartId()`.

- **Update the obvious runtime callers to prefer `getSelectedKartId()`.**
  Rationale: fixing the root compatibility layer is necessary, but cleaning up the main call sites reduces the chance of future regressions.

- **Use focused regression coverage instead of broad menu rewrites.**
  Rationale: this is a behavior-fix task, not a UX redesign.

## Implementation Units

### Unit 1: Align the checkout with the latest default branch

**Goal**

Move the working checkout to the latest `origin/master` before implementation, while preserving non-conflicting untracked local artifacts.

**Files**

- no product files; repository state only

**Approach**

- Fetch `origin` and confirm the current branch is an ancestor of `origin/master`.
- Switch to local `master` (or create/reset it if needed) and sync it to `origin/master`.
- Prefer a clean reset/fast-forward onto `origin/master` because the user explicitly requested a forced latest-default-branch sync.

**Verification**

- `git status --short --branch`
- `git rev-parse HEAD`
- `git rev-parse origin/master`

### Unit 2: Normalize kart-selection persistence and event compatibility

**Goal**

Ensure `loadout.selectedKartId` and `vehicleModel` stay synchronized on load and on every write path.

**Files**

- `js/Settings.js`
- `tests/unit/settings.spec.js`

**Patterns to Follow**

- Existing schema-migration and normalization flow in `js/Settings.js`
- Existing settings persistence/event tests in `tests/unit/settings.spec.js`

**Approach**

- Add a small normalization step after settings load that resolves one canonical selected kart id and writes it back to both `loadout.selectedKartId` and `vehicleModel`.
- Update `setSelectedKartId()` so it persists both fields.
- Update generic settings writes for `vehicleModel` so legacy callers also update `loadout.selectedKartId`.
- Dispatch both `loadout.selectedKartId` and `vehicleModel` change events whenever kart selection changes through either path.

**Test Scenarios**

- Fresh defaults initialize both `loadout.selectedKartId` and `vehicleModel` to `kart-1`.
- Stored legacy-only data with `vehicleModel` backfills `loadout.selectedKartId`.
- Stored loadout-only data backfills `vehicleModel`.
- `setSelectedKartId()` persists both fields and emits both change events.
- `set( 'vehicleModel', ... )` persists both fields and keeps `getSelectedKartId()` accurate.

**Verification**

- `node --test tests/unit/settings.spec.js`

### Unit 3: Update runtime entry points to use the normalized selected kart

**Goal**

Make the main menu/race-entry paths consume the same selected kart state that Garage and Karts already write.

**Files**

- `js/GameEngine.js`
- `js/ui/pages/page03-quick-play/Page03QuickPlayController.js`
- `js/ui/pages/page05-lobby/Page05LobbyController.js`
- `tests/e2e/play-modes.spec.js`
- `tests/e2e/garage.spec.js`

**Patterns to Follow**

- Existing `Settings#getSelectedKartId()` usage in `js/ui/pages/page04-play-modes/Page04PlayModesController.js`
- Existing Playwright seeding pattern in `tests/e2e/play-modes.spec.js`

**Approach**

- Replace direct reads of `vehicleModel` with `getSelectedKartId()` in the main quick-play and lobby entry paths.
- Update GameEngine's initial selected-vehicle boot path to use the normalized selected kart id.
- Keep the in-race settings menu functional through the compatibility layer instead of rewriting the generic menu widget.

**Test Scenarios**

- A seeded settings object that only defines `loadout.selectedKartId` still drives the selected kart used by play/lobby flows.
- Garage/Karts selection persists in storage in a way that both legacy and new readers can consume.
- Changing the selected kart does not clear or regress `vehicleColor`.

**Verification**

- `npx playwright test tests/e2e/play-modes.spec.js tests/e2e/garage.spec.js`

### Unit 4: Browser verification and release push

**Goal**

Confirm the fix in a running browser session, then push the validated change back to `master`.

**Files**

- no new product files expected unless verification exposes a small follow-up fix

**Approach**

- Run the app locally from the synced `master` checkout.
- Verify Garage paint changes and kart selection persist through the relevant menu flow.
- Re-run review/autofix before the final push.
- Push directly to `master` only after the checkout, tests, and browser verification are green.

**Verification**

- Manual browser check covering Garage, Karts, and race-entry flow
- Final `git status --short`

## Risks and Mitigations

- **Risk: legacy listeners still miss updates.**
  Mitigation: mirror both stored fields and both event keys, not just one or the other.

- **Risk: syncing to `master` collides with untracked local artifacts.**
  Mitigation: inspect the worktree before checkout/reset and only preserve/remove artifacts when a real path conflict exists.

- **Risk: paint behavior is blamed on kart selection when the actual bug is event propagation.**
  Mitigation: verify both storage and live UI reactions during browser testing.

## Sequencing

1. Sync checkout to latest `origin/master`.
2. Implement settings compatibility and runtime read-path fixes.
3. Add/update regression tests.
4. Run unit tests, e2e tests, and browser verification.
5. Run review/autofix.
6. Push directly to `master`.
