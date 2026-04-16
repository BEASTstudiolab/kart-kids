---
title: "refactor: settings surface architecture and quick/system split"
type: refactor
status: proposed
date: 2026-04-16
origin: conversation-2026-04-16
supersedes:
  - docs/plans/2026-04-15-004-refactor-ui-design-system-consolidation-and-typography-normalization-plan.md
---

# refactor: settings surface architecture and quick/system split

## Overview

Replace the current clunky settings experience with one coherent settings system that supports two contexts:

- a lightweight in-race `Quick Settings` surface for immediate control changes
- a fuller shell-level `System Settings` surface for preferences, accessibility, audio, display, and privacy

This pass is also responsible for restarting the local game server and validating the updated settings flows on the live app.

## Problem Frame

The current settings UX is overloaded and internally inconsistent:

- shell settings exist as both a routed page and a modal using the same view
- the in-race settings menu is a separate product with a different information architecture
- settings currently mix true preferences with profile editing, appearance customization, and developer utilities
- the present layout uses dashboard-like hero cards and equal-weight columns even when users just need fast, readable controls

The result is visually impressive but cognitively heavy. The user wants the settings experience rethought, simplified, and brought into the same editorial design language without preserving the current clutter.

## Requirements Trace

- R1: Split settings into `Quick Settings` and `System Settings` with shared visual language but different scope
- R2: Keep in-race settings focused on only race-relevant controls
- R3: Remove profile editing, appearance customization, and debug tooling from the main settings IA
- R4: Reduce shell-level settings categories to a tighter, more readable structure
- R5: Replace the current dashboard-style two-column hero treatment with a clearer settings-first layout
- R6: Preserve the editorial design direction already established in the shell
- R7: Keep all settings entry points consistent so players are not learning multiple settings products
- R8: Restart the local game server after implementation and verify the live app on port 3000

## Scope Boundaries

- In scope:
  - shell settings route/modal architecture
  - in-race settings menu architecture
  - relocation of non-settings content out of settings
  - settings-specific layout and component changes
  - live local server restart and smoke verification
- Out of scope:
  - broader gameplay HUD restyling outside quick settings
  - unrelated menu panel redesigns unless required by content relocation
  - editor-only tooling and track-editor settings

## Assumptions

- The editorial shell introduced in recent UI work remains the visual direction
- `Profile`, `Garage`, and `Character` surfaces are the correct homes for identity and customization
- Developer/debug surfaces should remain available, but not as first-class settings content
- The user values fast comprehension over preserving the current settings card layout

## Local Research Summary

### Current settings surfaces

- `js/ui/pages/page21-settings/Page21SettingsView.js`
  - currently acts as a broad, multi-tab shell settings dashboard
- `js/ui/core/AppShell.js`
  - registers `/settings` as a route and also mounts the same controller in a modal
- `js/SettingsMenu.js`
  - provides a separate in-race settings overlay
- `js/GameEngine.js`
  - injects additional vehicle, character, ghost, rearview, and debug sections into the in-race menu

### Current problems confirmed in code

- shell and runtime settings are duplicated rather than sharing a scoped model
- appearance and profile content currently live in settings despite having better homes elsewhere
- debug access is mixed into the user-facing settings IA
- current page-level settings layout makes action controls compete with oversized summary cards

### Related surfaces likely affected

- `js/ui/panels/ProfilePanel.js`
- `js/ui/panels/GaragePanel.js`
- `js/ui/panels/CharacterPanel.js`
- `js/ui/pages/page22-pause/Page22PauseView.js`

## External Research Decision

No external research is needed.

This is a product-architecture and local UI-system cleanup inside an established app shell. The codebase already contains the relevant shell, modal, and editorial UI patterns.

## Key Technical Decisions

- **One settings system, two densities**: build around shared settings vocabulary/components, then scope content differently for `Quick` vs `System`
- **System settings stays shell-owned**: shell-level settings remains the canonical home for preferences and should be the source of truth for modal and route entry points
- **Quick settings is a subset, not a fork**: the in-race panel should reuse shared row/group patterns but expose only race-critical options
- **Non-settings content moves out**:
  - display name -> `Profile`
  - appearance colors -> `Garage` / `Character`
  - debug -> shell/game developer utility entry point
- **Settings layout becomes task-first**: use a left rail or sectional index plus one primary settings column, with any summary/status card kept secondary
- **Immediate apply over heavy form submission**: prefer live persistence with lightweight success feedback instead of relying on a large action-footer pattern
- **Route and modal consistency matter more than preserving current composition**: if the standalone route and modal need different wrappers, they should still render the same underlying settings information architecture

## Open Questions

### Resolved During Planning

- The current settings UI is too dense and mixed-purpose to keep iterating in place
- The right split is `Quick Settings` in race and `System Settings` outside race
- Settings should stop owning profile, appearance, and debug content

### Deferred to Implementation

- Whether the shell settings surface should use a true left rail or a compact segmented header rail
- Whether `Apply Changes` should be removed entirely or retained only for a narrow subset of sensitive settings
- Whether pause-menu settings should open quick settings directly or jump to full system settings

## High-Level Technical Design

```text
Settings System
├── Shared settings groups / rows / summary primitives
│
├── Shell: System Settings
│   ├── Race
│   ├── Controls
│   ├── Audio
│   ├── Display
│   ├── Accessibility
│   └── Privacy / About
│
└── Runtime: Quick Settings
    ├── Audio
    ├── Camera / HUD
    ├── Controls
    ├── Accessibility safety toggles
    └── Resume / exit / full settings link
```

## Implementation Units

- [ ] **Unit 1: Rebuild shell settings IA and layout**

**Goal:** Turn shell settings into a focused, readable preferences surface instead of a dashboard-style dumping ground.

**Requirements:** R1, R3, R4, R5, R6, R7

**Files:**
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Modify: `js/ui/pages/page21-settings/Page21SettingsController.js`
- Modify: `js/ui/ui-theme.css`
- Modify: `js/ui/core/AppShell.js`
- Test: `tests/e2e/profile-settings.spec.js`

**Approach:**
- Collapse the existing category sprawl into a tighter group structure
- Replace the equal-weight two-column dashboard with a settings-first composition
- Ensure both route and modal entry paths render the same IA cleanly
- Rework or remove the large action-footer pattern if immediate apply is adopted

**Test scenarios:**
- Opening settings from shell settings button renders the new IA correctly
- Direct `/settings` route shows the same category structure without broken navigation
- Changing representative options persists correctly and updates dependent UI

- [ ] **Unit 2: Split runtime quick settings from shell system settings**

**Goal:** Keep the in-race menu fast, minimal, and contextual.

**Requirements:** R1, R2, R6, R7

**Files:**
- Modify: `js/SettingsMenu.js`
- Modify: `js/GameEngine.js`
- Modify: `js/ui/pages/page22-pause/Page22PauseView.js`
- Test: `tests/e2e/navigation.spec.js`

**Approach:**
- Reduce runtime settings content to race-relevant controls only
- Remove injected sections that belong to shell/profile/customization flows
- Provide a clear path from quick settings to full system settings when needed

**Test scenarios:**
- Opening in-race settings exposes only the quick subset
- Quick changes apply live during runtime
- Pause/settings flow still works correctly without surfacing the old full settings clutter

- [ ] **Unit 3: Relocate profile, customization, and debug responsibilities**

**Goal:** Move non-settings concerns to the surfaces where users already expect them.

**Requirements:** R3, R6, R7

**Files:**
- Modify: `js/ui/panels/ProfilePanel.js`
- Modify: `js/ui/panels/GaragePanel.js`
- Modify: `js/ui/panels/CharacterPanel.js`
- Modify: `js/DebugMenu.js`
- Modify: `js/DebugPanelSetup.js`
- Test: `tests/e2e/character-tab.spec.js`

**Approach:**
- Keep display-name editing with profile
- Keep appearance and livery editing with garage/character flows
- Keep debug accessible through developer-oriented entry points instead of user settings IA

**Test scenarios:**
- Profile still exposes display-name editing after settings removal
- Garage/character customization still works after settings removal
- Debug access remains available without polluting the player-facing settings structure

- [ ] **Unit 4: Restart local server and verify live settings flows**

**Goal:** Ensure the updated app is visible and usable in the local dev environment.

**Requirements:** R8

**Files:**
- Modify: `server.js` only if restart work uncovers a startup regression
- Test: `tests/e2e/profile-settings.spec.js`

**Approach:**
- Stop any stale local server process
- Restart the local game server on port 3000
- Smoke-test the main settings entry points against the live app

**Test scenarios:**
- Local server responds successfully after restart
- Shell settings entry opens the updated settings surface
- Runtime quick settings opens without console/runtime failures

## Risks and Mitigations

- **Risk:** Removing content from settings could make some controls feel “lost”
  - **Mitigation:** Only move controls to surfaces where they are already conceptually anchored and add clear entry affordances where needed
- **Risk:** Route/modal/settings-menu divergence persists under the hood
  - **Mitigation:** Treat shared IA and shared group definitions as first-class implementation targets, not just visual cleanup
- **Risk:** Quick settings becomes too minimal
  - **Mitigation:** Preserve a clear link to full settings and validate against actual in-race needs

## Definition of Done

- Shell settings reads as one coherent preferences product
- In-race settings is clearly a quick-access subset, not a second settings app
- Profile, appearance, and debug content are no longer crowding the settings IA
- Local server is restarted successfully and the updated settings flows are live on port 3000
