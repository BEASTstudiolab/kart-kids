---
title: "refactor: move settings from squeezed modal to a full-screen route"
type: refactor
status: proposed
date: 2026-04-16
origin: direct request after the modal settings pass
---

# refactor: move settings from squeezed modal to a full-screen route

## Overview

Promote settings from the current squeezed modal treatment into a true full-screen routed surface. The goal is to keep the cleaner structure we just established, but stop presenting it as a constrained modal or transparent overlay on top of the lobby scene. Settings should feel like its own authored page, not a sheet pushed into the existing menu layout.

## Problem Frame

The current settings implementation improved the information architecture, but the framing is still wrong for what the user wants:

- `js/ui/core/AppShell.js` still opens settings from the shell gear and profile through `_openSettingsModal()`, which constrains the page into a modal box
- the routed settings page already exists, but it still renders inside a transparent shell container with the lobby scene visible behind it
- `js/ui/ui-theme.css` defines `.kk-page-container` as transparent and `.kk-panel--active` as menu-over-canvas staging, which is the opposite of the requested “not overlaying the lobby” behavior
- the user explicitly wants settings to be full-screen rather than squeezed into the shell layout, and is open to a full page instead of an overlay

There is an older requirements/documentation thread that treated settings as a modal, but the current user instruction supersedes that direction for this implementation pass.

## Requirements Trace

- FS1: Settings opens as a full-screen player-facing surface, not a squeezed modal
- FS2: Settings must not visually ride on top of the lobby background or transparent page container treatment
- FS3: Existing settings controls, tab sections, apply flow, and reset flow must keep working
- FS4: Global entry points that currently open the modal must route into the full-screen settings experience
- FS5: Back/close behavior must return the player cleanly to the prior menu or pause context

## Scope Boundaries

- In scope:
  - `js/ui/core/AppShell.js`
  - `js/ui/pages/page21-settings/Page21SettingsController.js`
  - `js/ui/pages/page21-settings/Page21SettingsView.js`
  - `js/ui/ui-theme.css`
  - settings entry points that currently rely on `services.openSettings`
  - settings-related browser verification and e2e coverage
- Out of scope:
  - changing the settings storage schema in `js/Settings.js`
  - redesigning the settings content model again
  - reworking unrelated overlays such as results, lobby, or pause beyond what is needed for settings routing

## Assumptions

- The recent settings content/layout refactor is directionally correct and should be preserved rather than discarded
- A full-screen routed settings page is a better fit than a larger modal because the user explicitly does not want the lobby showing behind it
- The menu shell may still remain mounted, but settings should visually and behaviorally take over the screen while active
- Title and pause flows that already navigate to `RouteIds.SETTINGS` should continue to do so, with their experience improved by the full-screen treatment

## Plan Depth

Standard

This is a bounded UI/routing refactor, but it affects global entry points, shell state, fullscreen staging, and verification.

## Context & Research

### Origin context

- Current user request: settings should be full-screen instead of squeezed into the page layout, ideally as an overlay or new full page, and it should not sit on top of the lobby
- Recent prior plan: `docs/plans/2026-04-16-006-refactor-settings-surface-using-profile-panel-structure-plan.md`
  - useful as implementation context for the current settings structure
  - no longer authoritative for modal framing

### Local findings

- `js/ui/core/AppShell.js`
  - `services.openSettings` currently points at `_openSettingsModal()`
  - shell gear button also directly calls `_openSettingsModal()`
  - `RouteIds.SETTINGS` is already registered as a routed page controller
  - `showPartyLobby()` demonstrates an existing pattern where AppShell hides page/shell chrome for a dedicated full-screen mode
- `js/ui/panels/ProfilePanel.js`
  - profile’s “Open Settings” button calls `this._services.openSettings?.()`, so switching the service contract is enough to move that entry point off the modal
- `js/ui/pages/page01-title/Page01TitleController.js`
  - already routes to `RouteIds.SETTINGS`, including deep links like `#accessibility`
- `js/ui/pages/page22-pause/Page22PauseController.js`
  - already routes to `RouteIds.SETTINGS`
- `js/ui/ui-theme.css`
  - `.kk-page-container` is intentionally transparent so the 3D menu canvas shows through
  - `.kk-panel--active` assumes menu-over-canvas staging
  - those defaults are directly at odds with a true full-screen settings page
- `js/ui/pages/page21-settings/Page21SettingsView.js`
  - now has better internal structure, but still supports modal-vs-page branches and a transparent-root assumption inherited from the current shell

### Existing patterns to follow

- `js/ui/core/AppShell.js`
- `js/ui/core/RouterService.js`
- `js/ui/core/NavigationService.js`
- `js/ui/panels/ProfilePanel.js`
- `js/ui/pages/page21-settings/Page21SettingsView.js`
- `js/ui/ui-theme.css`

## External Research Decision

No external research is needed.

This is a local shell/routing decision in an already-established codebase.

## Key Technical Decisions

- **Use the existing `/settings` route as the canonical settings experience**
  - The route already exists and is already used by title/pause flows
  - Promoting it to the primary path is lower-risk than inventing a second full-screen overlay system

- **Retire modal-first settings access from the shell**
  - `services.openSettings` and the top-right gear should navigate to `RouteIds.SETTINGS`
  - This avoids maintaining two different settings framings for the same surface

- **Treat full-screen settings as a shell mode, not just a styled page**
  - The shell should expose a settings-active state so settings can suppress or visually escape the normal menu staging
  - This is the cleanest way to stop the page from feeling like content rendered “under” the tab chrome and lobby preview

- **Make settings visually opaque and independent from the lobby**
  - Settings should own its own background surface
  - The menu canvas/lobby preview should not remain the visible backdrop for the page
  - If practical during implementation, menu render mode should drop away from `lobby` while the route is active

- **Preserve the improved settings IA**
  - Keep the current grouped controls, tabs, and content hierarchy
  - This pass is about stage/framing and routing, not re-solving the settings layout from scratch

## Open Questions

### Resolved During Planning

- A full-screen route is the best interpretation of the user request
- The route should become the single canonical settings surface for shell/profile/title/pause access
- The current transparent page container and modal entry path are the two main causes of the “squeezed over lobby” feeling

### Deferred to Implementation

- Whether shell tabs/profile/settings utility buttons should stay visible above fullscreen settings, or be hidden entirely while the route is active
- Whether to pause the menu lobby renderer fully (`idle`) or simply hide it behind an opaque settings stage
- Whether `Page21SettingsView` should keep a `modalMode` branch temporarily for backward compatibility or remove it outright in this pass

## High-Level Technical Design

```text
Settings Entry
  profile button / shell gear / title / pause
    -> navigate(RouteIds.SETTINGS)

Shell While Settings Route Active
  AppShell route-aware settings state
    -> fullscreen settings class on shell/page container
    -> optional tab chrome suppression
    -> optional renderMode shift away from lobby

Settings Page
  full-screen opaque stage
    -> own background
    -> current structured settings content
    -> route-native back action
```

## Implementation Units

- [ ] **Unit 1: Switch settings entry points from modal opening to routed fullscreen navigation**

**Goal:** Ensure the main menu and profile stop opening a constrained settings modal.

**Requirements:** FS1, FS4, FS5

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/panels/ProfilePanel.js`
- Modify: `tests/e2e/profile-settings.spec.js`

**Approach:**
- Replace `_openSettingsModal()` shell usage with route navigation through `RouteIds.SETTINGS`
- Update `services.openSettings` to use routed navigation instead of modal mounting
- Preserve the existing direct route-based callers in title and pause
- Keep back-stack semantics clean so route back returns to the prior context

**Test scenarios:**
- Happy path: clicking the top-right settings button navigates to `/#/settings`
- Happy path: clicking profile’s “Open Settings” navigates to `/#/settings`
- Regression: title and pause entry paths still navigate into settings successfully
- Regression: leaving settings via back returns to the previously active route/tab context

- [ ] **Unit 2: Give the settings route true fullscreen staging instead of transparent menu-over-lobby composition**

**Goal:** Make settings feel like its own screen and not a sheet over the 3D lobby.

**Requirements:** FS1, FS2, FS5

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/ui-theme.css`
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Modify: `js/ui/pages/page21-settings/Page21SettingsController.js`

**Approach:**
- Add a route/shell state for fullscreen settings
- Make the settings route own an opaque, full-viewport stage instead of inheriting transparent page container styling
- Decide whether shell chrome remains visible, minimized, or hidden while settings is active
- If implementation is straightforward, suppress the visible lobby render context while settings is active so the page is not just “covering” it cosmetically

**Test scenarios:**
- Happy path: `/#/settings` renders as a full-screen page rather than a centered modal-sized block
- Happy path: the lobby background is not visible through the settings surface
- Happy path: back control remains obvious and usable in the fullscreen layout
- Regression: returning from settings restores the normal shell/menu state

- [ ] **Unit 3: Preserve the current settings content and state wiring inside the fullscreen route**

**Goal:** Keep the improved settings IA while adapting it to a route-native full-screen context.

**Requirements:** FS3, FS5

**Files:**
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Modify: `js/ui/pages/page21-settings/Page21SettingsController.js`

**Approach:**
- Remove or reduce modal-specific assumptions in the view
- Keep current control ids, tab ids, and grouped settings content stable
- Preserve apply/reset behavior and section summary behavior
- Ensure the back action is clearly route-native, not modal-close-native

**Test scenarios:**
- Happy path: apply still persists changed values
- Happy path: reset still restores defaults
- Happy path: tab switching still updates the visible panel and summary state
- Regression: hash deep links such as `/#/settings#accessibility` still land on the expected tab

- [ ] **Unit 4: Refresh tests and browser verification for fullscreen settings behavior**

**Goal:** Lock the new fullscreen settings flow in with verification that matches the user’s requested framing.

**Requirements:** FS1, FS2, FS3, FS4, FS5

**Files:**
- Modify: `tests/e2e/profile-settings.spec.js`
- Add or modify any focused app-shell/settings tests if practical

**Approach:**
- Replace modal-specific assumptions with route/fullscreen expectations
- Verify route navigation, fullscreen staging, tab interaction, and persistence
- Use browser verification to confirm the page does not present as a squeezed modal over the lobby

**Test scenarios:**
- Happy path: settings opens fullscreen from the shell gear
- Happy path: settings opens fullscreen from profile
- Happy path: display-setting changes save and persist
- Regression: no modal-only settings shell is required for normal menu usage

## Risks & Mitigations

- **Risk:** Switching from modal to route could break back navigation from menu contexts
  - **Mitigation:** route all entry points through `NavigationService.push()` semantics and verify back explicitly

- **Risk:** Hiding shell chrome or changing render mode could cause state restoration bugs when leaving settings
  - **Mitigation:** treat settings-active as an explicit AppShell mode/class and restore via symmetric teardown

- **Risk:** The fullscreen route could drift away from the recent settings design work
  - **Mitigation:** preserve the current grouped-content structure and only rework framing/staging where needed

- **Risk:** Older docs/plans assumed modal settings
  - **Mitigation:** follow the explicit current user request and document that this pass supersedes the modal framing for settings

## Verification Plan

- `node --check js/ui/pages/page21-settings/Page21SettingsView.js`
- `node --check js/ui/pages/page21-settings/Page21SettingsController.js`
- `node --check js/ui/core/AppShell.js`
- `git diff --check`
- Focused browser verification:
  - open settings from the shell gear
  - open settings from profile
  - confirm fullscreen staging and no visible lobby background bleed
  - confirm back navigation returns correctly
  - confirm at least one saved setting persists

## Exit Criteria

- Settings no longer opens as a squeezed modal from the normal menu shell
- Settings presents as a full-screen routed surface
- The lobby background is no longer the visible backdrop of the settings page
- Apply/reset and tab switching still work
- Browser verification confirms the route behaves like a dedicated settings screen
