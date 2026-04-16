---
title: "chore: isolate menu ui and drop race runtime changes"
type: chore
status: completed
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-15-002-refactor-bottom-left-nav-and-race-cards-plan.md
  - docs/plans/2026-04-15-003-refactor-editorial-design-system-across-core-game-surfaces-plan.md
  - docs/plans/2026-04-16-001-refactor-settings-surface-architecture-plan.md
---

# chore: isolate menu ui and drop race runtime changes

## Overview

Trim the current UI branch down to menu-facing work only.

The user wants to keep the shell, PLAY menu, character/garage/tracks/profile/settings, lobby/loading, and related menu-facing customizer work, while removing the in-race runtime UI pass and other gameplay-page changes.

## Problem Frame

The current working tree mixes two different scopes:

- menu-facing UI work:
  - shell layout
  - PLAY panel composition
  - customizer tabs
  - settings route/modal work
  - loading, name entry, lobby, and other menu-adjacent surfaces
- gameplay/runtime UI work:
  - `GameEngine` HUD mounting
  - `HUD`, `HUDDamage`, `Speedometer`
  - in-race quick settings and pause surfaces
  - post-race/results visual restyling
  - a new `page24` runtime-focused route

That mixed scope makes future integration harder and no longer matches the user’s intent. The branch should only carry the menu-side work.

## Requirements Trace

- R1: Keep current menu-facing UI work intact
- R2: Remove current in-race gameplay-page UI changes from the working tree
- R3: Remove runtime-only experimental route/artifact changes that are no longer wanted
- R4: Leave the repo in a consistent state with no dead references to removed race/runtime pages
- R5: Re-verify menu-facing behavior coverage after the cleanup

## Scope Boundaries

- In scope:
  - reverting local gameplay/runtime UI edits
  - deleting runtime-only experimental files introduced by the current branch
  - patching shared shell/router files when needed so removed runtime artifacts are no longer referenced
  - rerunning focused menu-facing verification
- Out of scope:
  - merging `origin/master`
  - redesigning menu features further
  - changing gameplay logic unrelated to reverting the unwanted UI pass
  - cleaning unrelated generated artifacts beyond what this cleanup requires

## Assumptions

- `RacePanel` is part of the menu-facing PLAY surface and should stay
- `TrackSelectOverlay` and `LobbyOverlay` remain part of the menu/pre-race journey and should stay
- `ResultsOverlay`, `HUD`, pause, speedometer, and in-race quick settings are part of the runtime/gameplay scope and should be removed from this branch
- the `page24` marginal-velocity route is an unwanted runtime experiment and should be removed

## Local Research Summary

### Keep-side menu surfaces

Current menu-heavy changes are concentrated in:

- `js/ui/core/AppShell.js`
- `js/ui/panels/RacePanel.js`
- `js/ui/panels/CharacterPanel.js`
- `js/ui/panels/GaragePanel.js`
- `js/ui/panels/ProfilePanel.js`
- `js/ui/panels/TracksPanel.js`
- `js/ui/pages/page21-settings/*`
- `js/ui/pages/page10-character-select/*`
- `js/ui/components/LoadingOverlay.js`
- `js/ui/components/NameEntryModal.js`
- `js/ui/LobbyScene.js`
- menu-focused tests such as:
  - `tests/e2e/profile-settings.spec.js`
  - `tests/e2e/character-tab.spec.js`
  - `tests/loading-overlay.test.mjs`
  - `tests/app-shell-menu-music.test.mjs`

### Drop-side runtime surfaces

Current gameplay/runtime changes are concentrated in:

- `js/GameEngine.js`
- `js/HUD.js`
- `js/HUDDamage.js`
- `js/Speedometer.js`
- `js/SettingsMenu.js`
- `js/ui/pages/page22-pause/Page22PauseController.js`
- `js/ui/pages/page22-pause/Page22PauseView.js`
- `js/ui/overlays/ResultsOverlay.js`

### Runtime-only experimental artifacts

- `js/ui/pages/page24-marginal-velocity/`
- `PageIds.MARGINAL_VELOCITY`
- `RouteIds.MARGINAL_VELOCITY`
- `AppShell` route wiring for `page24`

## External Research Decision

No external research is needed.

This is a local-branch scope cleanup based entirely on the current working tree and existing plan documents.

## Key Technical Decisions

- **Use the menu/runtime split already visible in the plan history.**
  Existing plan docs clearly separate menu-shell work from in-race/runtime work, so the cleanup should follow that boundary instead of inventing a new one.
- **Revert whole runtime-facing files when the scope is clearly wrong.**
  Files like `HUD.js` and `Speedometer.js` should go back to `HEAD` rather than trying to preserve partial styling edits.
- **Patch shared files only where necessary to remove dead runtime references.**
  Shared files such as `AppShell.js`, `PageIds.js`, and `RouteIds.js` should keep the menu work while dropping `page24` and other unwanted runtime-only hooks.
- **Keep menu-facing test changes.**
  Menu/settings/customizer/loading tests should stay unless they directly cover removed runtime surfaces.

## Open Questions

### Resolved During Planning

- `RacePanel` stays because it is the PLAY tab in the menu shell
- `page22` pause and runtime HUD files go because they are gameplay-facing, not menu-facing
- `page24` marginal-velocity should be removed with its route wiring

### Deferred to Implementation

- Whether any `AppShell` helper added for runtime debugging becomes unused after `page24` removal
- Whether `tests/e2e/navigation.spec.js` still reflects the intended loading behavior after the runtime cleanup

## High-Level Technical Design

```text
Menu-Only Cleanup
├── Revert runtime/gameplay UI files to HEAD
├── Delete page24 runtime experiment files
├── Remove shared route/router references to page24
└── Re-verify menu-facing tests and diff scope
```

## Implementation Units

- [x] **Unit 1: Revert runtime gameplay-page UI files**

**Goal:** Remove the in-race/gameplay UI pass from the working tree while leaving menu-facing surfaces alone.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `js/GameEngine.js`
- Modify: `js/HUD.js`
- Modify: `js/HUDDamage.js`
- Modify: `js/Speedometer.js`
- Modify: `js/SettingsMenu.js`
- Modify: `js/ui/pages/page22-pause/Page22PauseController.js`
- Modify: `js/ui/pages/page22-pause/Page22PauseView.js`
- Modify: `js/ui/overlays/ResultsOverlay.js`

**Approach:**
- Restore the unwanted runtime/gameplay files to their `HEAD` state
- Avoid touching menu-facing files during the revert
- Recheck `git diff --name-only` afterward to confirm these runtime files are gone from the local change set

**Patterns to follow:**
- keep/revert boundary from:
  - `docs/plans/2026-04-15-003-refactor-editorial-design-system-across-core-game-surfaces-plan.md`
  - `docs/plans/2026-04-16-001-refactor-settings-surface-architecture-plan.md`

**Test scenarios:**
- Happy path: reverted runtime files no longer appear in the working-tree diff
- Edge case: reverting runtime settings/pause files does not disturb shell settings files under `js/ui/pages/page21-settings/`

**Verification:**
- Only menu-side files remain modified after the revert pass

---

- [x] **Unit 2: Remove runtime-only route artifacts**

**Goal:** Delete the unwanted `page24` runtime experiment and any references to it.

**Requirements:** R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/enums/PageIds.js`
- Modify: `js/ui/enums/RouteIds.js`
- Delete: `js/ui/pages/page24-marginal-velocity/Page24MarginalVelocityController.js`
- Delete: `js/ui/pages/page24-marginal-velocity/Page24MarginalVelocityView.js`
- Delete: `js/ui/pages/page24-marginal-velocity/MarginalVelocityScene.js`

**Approach:**
- Remove `page24` constants and route wiring
- Delete the runtime experiment files from the working tree
- Verify there are no remaining imports or route registrations for the removed page

**Patterns to follow:**
- existing route/page wiring in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: no `Page24MarginalVelocity*` references remain
- Edge case: removing `page24` does not break the remaining menu route registration block

**Verification:**
- `rg "MarginalVelocity|MARGINAL_VELOCITY"` only returns historical docs or intentionally retained non-route references

---

- [x] **Unit 3: Verify menu-only diff and focused menu coverage**

**Goal:** Confirm the remaining branch scope is menu-facing and still coherent.

**Requirements:** R1, R4, R5

**Dependencies:** Units 1-2

**Files:**
- Modify: this plan file progress checkboxes only if needed
- Test: `tests/e2e/profile-settings.spec.js`
- Test: `tests/e2e/character-tab.spec.js`
- Test: `tests/loading-overlay.test.mjs`

**Approach:**
- Inspect the remaining diff to confirm the cleanup removed the runtime files
- Run focused menu/settings/customizer/loading checks
- Use browser verification only on menu surfaces, not gameplay routes

**Patterns to follow:**
- existing menu-focused coverage already present in `tests/e2e/` and `tests/`

**Test scenarios:**
- Happy path: settings route still renders after the cleanup
- Happy path: character/customizer menu path still works
- Happy path: loading overlay expectations still match the current menu bootstrap
- Edge case: no deleted runtime route is accidentally linked from the menu shell

**Verification:**
- The remaining local branch can be described as “menu UI work” without caveats

## Risks and Mitigations

- **Risk:** Shared files like `AppShell.js` can accidentally lose wanted menu work during runtime cleanup.
  - **Mitigation:** Use targeted edits only for runtime route removal; revert whole files only when they are clearly gameplay-facing.

- **Risk:** Settings work spans both shell and runtime contexts.
  - **Mitigation:** Keep `page21` shell settings changes and revert only `SettingsMenu` plus `page22` pause surfaces.

- **Risk:** Removing `page24` leaves dead constants or imports behind.
  - **Mitigation:** Search for route/page references after deletion and patch the shared files in the same pass.

## Verification Strategy

- Re-run `git diff --name-only` and confirm runtime files are no longer in the active diff
- Search for removed runtime-route references
- Run focused menu/settings/customizer/loading checks rather than gameplay HUD tests
