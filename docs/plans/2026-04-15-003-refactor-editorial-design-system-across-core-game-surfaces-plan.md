---
title: "refactor: Editorial Design System Across Core Game Surfaces"
type: refactor
status: active
date: 2026-04-15
origin: conversation-2026-04-15
---

# refactor: Editorial Design System Across Core Game Surfaces

## Overview

Extend the editorial `Marginal`-style design language from the current menu shell into the rest of the core player-facing game experience: boot/title entry, menu overlays, lobby and results transitions, in-race HUD, in-race settings/debug utilities, and shared feedback surfaces.

This work should turn the game into one coherent product visually instead of a modern editorial menu glued on top of an older ad-hoc HUD stack.

## Problem Frame

The current UI now has two strong but disconnected visual systems:

- The newer editorial menu shell built around clipped cards, cream/red utility surfaces, monospace labeling, and floating chrome
- A large set of older runtime surfaces built directly with inline style strings in `HUD.js`, `HUDDamage.js`, `Speedometer.js`, `SettingsMenu.js`, and related overlays

That split is most visible when moving from the menu into gameplay:

- Menu tabs and overlays feel authored and intentional
- Gameplay HUD, settings, countdown, results, and debug surfaces still feel like legacy tooling

The user’s request is to “bring this design to all surfaces in the game,” so this pass should treat the current editorial shell as the design anchor and roll it through the rest of the core game loop.

## Assumptions

- “All surfaces in the game” means the core player-facing experience reachable from the main app and race loop:
  - title / first-run entry
  - menu shell and tabs
  - settings / modal / toast / dialog surfaces
  - lobby / loading / results / pause transitions
  - in-race HUD and in-race utility menus
- Standalone workbench-style tools are not part of this pass:
  - separate editor/workshop tooling
  - standalone test harnesses
  - public track landing pages outside the core game loop
- Developer-only surfaces should be visually subordinate to player-facing UI, not given equal emphasis

## Requirements Trace

- R1: Use the current editorial menu system as the visual source of truth for the broader game UI
- R2: Apply that system across the core player loop, not just the menu panels
- R3: Reuse or extend existing shared components and tokens instead of creating a second parallel system
- R4: Preserve current gameplay flows and controls while restyling the surfaces around them
- R5: Keep settings and debug utilities compact and secondary to the main experience
- R6: Keep gameplay HUD highly legible during motion and combat
- R7: Maintain full-screen staging and avoid floating chrome collisions with panel or HUD content
- R8: Keep the race start / lobby / results / pause journey visually consistent with the new shell
- R9: Preserve responsiveness and mobile accessibility for the surfaces already used in game

## Scope Boundaries

- In scope:
  - `js/ui/` shell, panels, shared components, and modal/overlay surfaces used by the main app
  - in-race DOM HUD surfaces mounted by `GameEngine`
  - in-race settings and debug utilities
  - first-run/title/name entry surfaces
  - toast/confirmation/disconnect/loading feedback layers
- Out of scope:
  - standalone editor-only workbench pages and overlays not part of the core game loop
  - public published-track pages outside the main game shell
  - vehicle physics, networking rules, race logic, or camera behavior changes except where UI mounting requires light wiring
  - reauthoring 3D scenes or environment art

## Context & Research

### Surface Inventory

The core player-facing surfaces currently split into two main families:

- **Editorial shell surfaces**
  - `js/ui/core/AppShell.js`
  - `js/ui/ui-theme.css`
  - `js/ui/panels/RacePanel.js`
  - `js/ui/panels/CharacterPanel.js`
  - `js/ui/panels/GaragePanel.js`
  - `js/ui/panels/TracksPanel.js`
  - `js/ui/panels/ProfilePanel.js`
  - `js/ui/overlays/ResultsOverlay.js`
  - `js/ui/overlays/LobbyOverlay.js`
  - `js/ui/components/MarginalPanelCard.js`
  - `js/ui/components/MarginalPanelHeader.js`
  - `js/ui/components/MarginalActionCard.js`

- **Legacy runtime/gameplay surfaces**
  - `js/HUD.js`
  - `js/HUDDamage.js`
  - `js/Speedometer.js`
  - `js/SettingsMenu.js`
  - `js/DebugMenu.js`
  - `js/GameEngine.js`
  - `js/RaceLobby.js`

### Existing Patterns to Build On

- The newer menu work already established reusable editorial primitives:
  - clipped card geometry
  - cream / red / ink palette
  - monospace micro-labels + bold display numerics
  - floating utility pills and compact nav buttons
- `js/ui/ui-theme.css` already holds the best place for shared tokens and shell-level layout spacing
- `GameEngine` already centralizes runtime DOM mounting through `#game-hud-container`, which is the correct seam for a HUD-wide styling rollout
- Existing tests already cover several affected areas:
  - `tests/e2e/navigation.spec.js`
  - `tests/e2e/first-run.spec.js`
  - `tests/e2e/profile-settings.spec.js`
  - `tests/hud-race-position.test.mjs`
  - `tests/race-mode-position-leaderboard.test.mjs`
  - `tests/loading-overlay.test.mjs`
  - `tests/app-shell-menu-music-widget.test.mjs`

### Structural Weaknesses Today

- Many runtime surfaces are still built with one-off inline style strings, which makes cross-surface consistency difficult
- Gameplay HUD elements append directly to `document.body` instead of cleanly sharing a themed surface vocabulary
- Settings and debug surfaces still read as tooling rather than part of the game’s authored UI
- Some overlay and modal surfaces still use older neutral styling that no longer matches the shell

## Key Technical Decisions

- **The current editorial shell is the design anchor**: Do not invent a new look for gameplay. Extend the existing `Marginal` language into runtime surfaces.
- **Create one shared cross-surface styling layer**: Move repeated editorial primitives into shared tokens/helpers so both `js/ui/*` components and runtime HUD modules can consume the same system.
- **Refactor runtime HUD surfaces without changing their behavioral contracts**: `HUD`, `HUDDamage`, `Speedometer`, and `SettingsMenu` keep their responsibilities and data flow; this pass changes presentation, structure, and theming, not gameplay rules.
- **Use `#game-hud-container` as the runtime integration seam**: New runtime surfaces should mount inside the existing HUD container whenever possible instead of appending ad-hoc elements directly to `document.body`.
- **Developer surfaces remain subordinate**: `DebugMenu` and other debug affordances should visually harmonize with the system, but stay smaller and lower-priority than player-facing surfaces.
- **Roll out by surface family, not by file ownership**: Shared primitives first, then shell/overlay surfaces, then runtime HUD/utility surfaces, then transition polish and regression cleanup.

## Open Questions

### Resolved During Planning

- The pass will target the **core game loop**, not standalone tools
- Existing editorial menu primitives are sufficient as the starting point; this is a rollout and consolidation effort, not a brand-new design-system invention
- In-race HUD readability takes priority over pure visual fidelity when the two are in tension

### Deferred to Implementation

- Exact component/helper extraction boundary between `js/ui/components/*` and runtime HUD modules
- Whether some runtime surfaces should remain inline-styled internally but consume shared CSS classes/tokens
- Final density tuning for mobile HUD layouts and touch-safe utility buttons

## High-Level Technical Design

> This is directional guidance for the rollout shape, not implementation code.

```text
Editorial Design Foundation
├── shared tokens in js/ui/ui-theme.css
├── reusable editorial DOM primitives
│   ├── cards
│   ├── pills
│   ├── stat rows / micro-labels
│   └── meters / badges
│
├── shell + overlay surfaces
│   ├── AppShell floating chrome
│   ├── menu panels
│   ├── modal / loading / disconnect / confirmation surfaces
│   └── title / name-entry / settings surfaces
│
└── runtime surfaces
    ├── HUD countdown / race HUD / leaderboard / lobby prompt / results
    ├── damage + item + health cluster
    ├── speedometer
    ├── in-race settings
    └── debug utilities
```

## Implementation Units

- [ ] **Unit 1: Shared Editorial Surface Foundation**

**Goal:** Promote the current editorial menu language into a reusable design foundation consumable by both SPA UI and runtime HUD surfaces.

**Requirements:** R1, R3, R6, R7

**Dependencies:** None

**Execution note:** Standard implementation, but keep the extraction boundary conservative. Do not over-abstract until two or more surface families truly share the same markup needs.

**Files:**
- Modify: `js/ui/ui-theme.css`
- Modify: `js/ui/components/MarginalPanelCard.js`
- Modify: `js/ui/components/MarginalPanelHeader.js`
- Modify: `js/ui/components/MarginalActionCard.js`
- Create: `js/ui/components/EditorialHudPrimitives.js`
- Test: `tests/unit/editorial-surface-primitives.spec.js`

**Approach:**
- Add shared surface tokens for:
  - floating utility pills
  - clipped runtime cards
  - label/value typography
  - editorial border treatments
  - HUD-safe spacing and z-index coordination
- Keep the current `Marginal*` components as the public design vocabulary for the SPA shell
- Add lightweight DOM factories/helpers for runtime HUD surfaces that cannot cleanly reuse the full panel components
- Avoid duplicating palette and spacing decisions between `js/ui/*` and `js/*` runtime modules

**Patterns to follow:**
- Existing editorial component patterns in `js/ui/components/MarginalPanelCard.js` and `js/ui/components/MarginalPanelHeader.js`
- Existing global token placement in `js/ui/ui-theme.css`

**Test scenarios:**
- Happy path: editorial helper output renders expected labels, values, and variant classes
- Happy path: shared utility pill styles support active/inactive states
- Edge case: runtime helper output works without requiring `AppShell`
- Edge case: shared tokens do not regress existing menu panel rendering

**Verification:**
- Shared primitives support both shell surfaces and runtime HUD without introducing a second token set

---

- [ ] **Unit 2: Shell, Title, and Overlay Surface Rollout**

**Goal:** Finish carrying the editorial system through the non-race shell and transition surfaces so the pre-race journey is visually coherent end-to-end.

**Requirements:** R1, R2, R4, R5, R7, R8

**Dependencies:** Unit 1

**Execution note:** Standard implementation.

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/components/NameEntryModal.js`
- Modify: `js/ui/components/LoadingOverlay.js`
- Modify: `js/ui/components/ConfirmationDialog.js`
- Modify: `js/ui/components/DisconnectOverlay.js`
- Modify: `js/ui/components/ModalDialog.js`
- Modify: `js/ui/overlays/ResultsOverlay.js`
- Modify: `js/ui/overlays/LobbyOverlay.js`
- Modify: `js/ui/pages/page01-title/Page01TitleView.js`
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Test: `tests/e2e/navigation.spec.js`
- Test: `tests/e2e/first-run.spec.js`
- Test: `tests/e2e/profile-settings.spec.js`
- Test: `tests/loading-overlay.test.mjs`

**Approach:**
- Align modal and overlay chrome with the current editorial shell:
  - clipped cards
  - tighter monospace labeling
  - cream/red/ink palette hierarchy
  - compact utility controls
- Bring first-run and title/name-entry flow into the same visual language as the main menu
- Make lobby/results/loading/disconnect/confirmation surfaces feel like siblings of the menu rather than separate products
- Preserve accessibility, focus management, and current modal behavior

**Patterns to follow:**
- Current menu shell patterns in `js/ui/core/AppShell.js`
- Existing overlay lifecycle patterns in `js/ui/overlays/ResultsOverlay.js` and `js/ui/overlays/LobbyOverlay.js`

**Test scenarios:**
- Happy path: first-run name entry still opens and completes successfully
- Happy path: settings modal still opens from the top-right utility pill
- Happy path: lobby/results/loading surfaces still render and dismiss correctly
- Edge case: focus trapping and close controls remain intact on styled modals
- Edge case: overlay styling does not collide with floating shell chrome

**Verification:**
- The title-to-menu-to-lobby/results journey reads as one coherent editorial system

---

- [ ] **Unit 3: Gameplay HUD Editorial Rollout**

**Goal:** Rebuild the main in-race HUD surfaces into the same editorial system while preserving gameplay readability and current race-state behavior.

**Requirements:** R1, R2, R4, R6, R8

**Dependencies:** Unit 1

**Execution note:** Characterization-first around visual/state behavior. Preserve existing state transitions for countdown, lap/time, leaderboard, lobby prompts, boost, drift, and results while restyling.

**Files:**
- Modify: `js/HUD.js`
- Modify: `js/HUDDamage.js`
- Modify: `js/Speedometer.js`
- Modify: `js/GameEngine.js`
- Test: `tests/hud-race-position.test.mjs`
- Test: `tests/race-mode-position-leaderboard.test.mjs`
- Test: `tests/unit/editorial-runtime-hud.spec.js`

**Approach:**
- Move core HUD surfaces away from fully ad-hoc inline styles into shared editorial classes/primitives
- Restyle:
  - countdown
  - top race HUD
  - player position badge
  - top-three leaderboard
  - lobby prompt
  - finish/results block
  - boost and drift feedback
  - bottom-left damage/item/HP cluster
  - bottom-right speedometer
- Mount HUD DOM inside the existing HUD container where practical so teardown remains centralized
- Maintain strong contrast and minimal animation clutter during gameplay

**Patterns to follow:**
- Existing runtime HUD responsibilities in `js/HUD.js`, `js/HUDDamage.js`, and `js/Speedometer.js`
- Existing centralized runtime DOM mounting in `js/GameEngine.js`

**Test scenarios:**
- Happy path: countdown still appears and updates correctly
- Happy path: lap/time and leaderboard continue to update with race state
- Happy path: speedometer still updates speed/unit correctly
- Happy path: damage HUD still updates quadrants, HP, and held item slot
- Edge case: HUD teardown on race stop still removes runtime DOM cleanly
- Edge case: HUD remains readable at high speed and under boost/drift state changes

**Verification:**
- Entering a race no longer visually drops into a legacy HUD style

---

- [ ] **Unit 4: In-Race Utility and Developer Surface Rollout**

**Goal:** Bring in-race settings and developer utilities into the same system, while keeping them clearly secondary to gameplay.

**Requirements:** R4, R5, R6, R9

**Dependencies:** Unit 1

**Execution note:** Standard implementation.

**Files:**
- Modify: `js/SettingsMenu.js`
- Modify: `js/DebugMenu.js`
- Modify: `js/ui/LobbyScene.js`
- Modify: `js/ui/core/AppShell.js`
- Test: `tests/e2e/profile-settings.spec.js`
- Test: `tests/unit/settings-menu-editorial.spec.js`

**Approach:**
- Restyle the in-race hamburger/settings panel into the editorial utility language
- Reduce the visual gap between menu settings and in-race settings
- Bring debug controls into a matching but clearly subordinate developer variant
- Preserve existing interaction affordances, especially touch targets and modal layering

**Patterns to follow:**
- Current top-right utility pill patterns in `js/ui/core/AppShell.js`
- Existing runtime menu construction in `js/SettingsMenu.js` and `js/DebugMenu.js`

**Test scenarios:**
- Happy path: in-race settings still open, close, and persist changes
- Happy path: debug panel still opens in local/dev builds
- Edge case: interacting with settings/debug does not leak clicks into gameplay
- Edge case: utility surfaces do not overlap or visually fight the gameplay HUD

**Verification:**
- In-race settings/debug feel like part of the same product as the menu shell

---

- [ ] **Unit 5: Transition Polish and Regression Sweep**

**Goal:** Unify remaining feedback surfaces and verify that the new system holds together across the full menu-to-race-to-results loop.

**Requirements:** R2, R5, R7, R8, R9

**Dependencies:** Units 2, 3, 4

**Execution note:** Standard implementation with heavy browser verification.

**Files:**
- Modify: `js/ui/components/Toast.js`
- Modify: `js/ui/overlays/TrackSelectOverlay.js`
- Modify: `js/ui/overlays/ResultsOverlay.js`
- Modify: `js/RaceLobby.js`
- Test: `tests/e2e/play-modes.spec.js`
- Test: `tests/e2e/ui-surface-regression.spec.js`

**Approach:**
- Harmonize smaller feedback layers that can still break the illusion:
  - toasts
  - track select overlay
  - lobby-ready prompts
  - results restart affordances
- Run a visual regression sweep across:
  - first-run
  - menu tabs
  - settings
  - race HUD
  - pause/settings in race
  - results / return to menu

**Patterns to follow:**
- The completed editorial surface foundation from Units 1-4

**Test scenarios:**
- Happy path: main menu -> race -> results -> menu return remains functional
- Happy path: track select / lobby / results continue to work after restyling
- Edge case: toast and loading feedback remain readable over light and dark backgrounds
- Edge case: no shell chrome overlaps gameplay transition surfaces

**Verification:**
- The full core player loop feels visually continuous from boot to race finish

## Risks

- Runtime HUD restyling can accidentally reduce readability under motion if decorative treatment overtakes clarity
- Moving gameplay surfaces toward shared primitives can create teardown leaks if DOM ownership is blurred between `GameEngine` and individual HUD modules
- Overlay/pill rollout can create z-index collisions between shell chrome, HUD, modals, and dev utilities
- In-race settings and debug surfaces have touch/input implications that must remain stable after visual changes

## Test Plan

- Run unit checks for shared UI helpers and runtime HUD behavior
- Run targeted existing tests that cover navigation, settings, menu music, HUD position/leaderboard, and loading overlays
- Run browser verification across:
  - first-run/title
  - PLAY / CHARACTER / GARAGE / TRACKS / PROFILE
  - settings modal
  - race start + HUD
  - pause/settings while racing
  - results return flow
- Capture screenshots for menu, HUD, and overlay surfaces before calling the pass complete

## Exit Criteria

- The editorial design system clearly spans both menu and gameplay surfaces
- In-race HUD no longer reads as a separate legacy UI stack
- Settings, debug, lobby, results, and feedback layers visually belong to the same product
- Core flows remain behaviorally intact
- The rollout covers the core player-facing game loop without introducing a second design system
