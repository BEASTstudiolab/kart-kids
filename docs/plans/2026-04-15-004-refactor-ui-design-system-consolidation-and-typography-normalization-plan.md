---
title: "refactor: UI Design System Consolidation and Typography Normalization"
type: refactor
status: proposed
date: 2026-04-15
origin: conversation-2026-04-15
supersedes:
  - docs/plans/2026-04-15-002-refactor-bottom-left-nav-and-race-cards-plan.md
  - docs/plans/2026-04-15-003-refactor-editorial-design-system-across-core-game-surfaces-plan.md
---

# refactor: UI Design System Consolidation and Typography Normalization

## Overview

Consolidate the current editorial UI rollout into a cleaner system with fewer one-off panel styles, clearer shared typography rules, and explicit reusable components for recurring surfaces such as the music player.

This pass is not about inventing a new look. It is about making the existing look sustainable:

- one font system
- one text scale
- shared card/header/action primitives
- fewer panel-local style forks
- no embedded music widget hiding inside the `System Logs` card

## Problem Frame

The current menu and recent runtime UI work already have a strong visual direction, but the implementation is drifting toward the same failure mode as the older UI:

- repeated font declarations and panel-local `@import` blocks
- per-surface hardcoded text sizes with no clear semantic hierarchy
- component-like surfaces rebuilt with slightly different markup and CSS in each panel
- raw DOM dock markup for menu music instead of a first-class reusable card
- large files such as `js/ui/panels/GaragePanel.js` and `js/ui/panels/TracksPanel.js` absorbing both layout logic and design-system decisions

The user’s request is to stop UI bloat before it spreads further:

- avoid inline/one-off styling drift
- use real reusable components
- unify fonts and text styles across the game
- keep the home screen’s text hierarchy as the style reference
- give the music player its own card instead of nesting it under `System Logs`

## Requirements Trace

- R1: Remove repeated per-panel font imports and font-family forks; define one clear shared font system
- R2: Normalize editorial text sizing so labels, values, titles, and body copy follow one semantic scale across menu and settings surfaces
- R3: Replace repeated near-duplicate UI markup with reusable components or shared primitives where the structure is materially the same
- R4: Keep the current editorial visual language; this is a consolidation pass, not a redesign reset
- R5: Give the menu music player its own card, visually separate from `System Logs`
- R6: Use the home screen text treatment as the practical reference for sane sizing and hierarchy
- R7: Reduce codebase bloat by moving design-system decisions into shared layers rather than expanding panel-local CSS
- R8: Keep shell and panel behavior unchanged unless required by the new component boundaries
- R9: Ensure settings surfaces participate in the same font/text system rather than remaining a typographic outlier

## Scope Boundaries

- In scope:
  - shared shell/menu design tokens and typography
  - editorial components in `js/ui/components/*`
  - `AppShell` menu music mounting and shell-level UI plumbing
  - current active shell panels:
    - `js/ui/panels/RacePanel.js`
    - `js/ui/panels/CharacterPanel.js`
    - `js/ui/panels/GaragePanel.js`
    - `js/ui/panels/TracksPanel.js`
    - `js/ui/panels/ProfilePanel.js`
  - active settings view(s) that still use divergent font/text rules
- Out of scope:
  - full gameplay HUD/runtime restyling beyond the shared typography groundwork
  - editor-only tooling or legacy non-shipping routes unless touched by the shared token extraction
  - feature behavior changes to race start, matchmaking, party flow, or track selection logic

## Assumptions

- The current bottom-left nav and editorial shell composition remain the active design direction
- The home screen hierarchy using `--font-display`, `--font-ui`, and existing global text tokens is the preferred baseline for readable scale
- The menu music player should remain shell-owned for state/lifecycle, but its rendered surface should become a reusable UI component
- The most valuable “throughout the game” win in this pass is consistency across active menu/settings/player-facing shell surfaces, with runtime HUD cleanup continuing from the same foundation

## Local Research Summary

### Relevant current plans

- `docs/plans/2026-04-15-003-refactor-editorial-design-system-across-core-game-surfaces-plan.md`
  - establishes the editorial shell as the design anchor for broader UI work
- `docs/plans/2026-04-15-002-refactor-bottom-left-nav-and-race-cards-plan.md`
  - establishes the current shell composition, bottom-left nav, and menu music relocation

### Current implementation patterns

- Shared editorial components already exist:
  - `js/ui/components/MarginalPanelCard.js`
  - `js/ui/components/MarginalPanelHeader.js`
  - `js/ui/components/MarginalActionCard.js`
  - `js/ui/components/EditorialRuntimeTheme.js`
- The global UI token layer already exists in `js/ui/ui-theme.css`
- `AppShell` still owns menu music state and renders a dock element via `_createMenuMusicDock()`
- `RacePanel` currently hosts the dock inside the `System Logs` card through `attachMenuMusicDock()`

### Current consistency problems

- Repeated panel-local font imports and editorial font variables:
  - `js/ui/panels/RacePanel.js`
  - `js/ui/panels/CharacterPanel.js`
  - `js/ui/panels/TracksPanel.js`
  - `js/ui/panels/GaragePanel.js`
- Settings and overlay surfaces still use mixed direct font fallbacks and local size choices:
  - `js/ui/pages/page21-settings/Page21SettingsView.js`
  - `js/ui/overlays/LobbyOverlay.js`
  - `js/ui/overlays/TrackSelectOverlay.js`
  - `js/ui/overlays/ResultsOverlay.js`
- Inline or ad-hoc style usage still exists in multiple player-facing and runtime modules:
  - `js/ui/pages/page04-play-modes/Page04PlayModesView.js`
  - `js/DebugPanelSetup.js`
  - `js/GameEngine.js`
  - `js/HUD.js`
  - `js/HUDDamage.js`

### Reference surface

- `js/ui/pages/page02-home/Page02HomeView.js` uses the global font tokens and already reads closer to the desired sizing discipline than the newer panel-local editorial typography.

### Institutional learnings

- No relevant `docs/solutions/` entries were found for this UI-design-system topic.

## External Research Decision

No external research is needed for this pass.

The codebase already contains strong local patterns for:

- shell composition
- editorial cards and headers
- shared CSS token ownership in `js/ui/ui-theme.css`
- menu music lifecycle ownership in `AppShell`

This is a consolidation/refactor problem inside an established local UI architecture, not a framework- or standards-uncertainty problem.

## Key Technical Decisions

- **Global typography is the source of truth**: `js/ui/ui-theme.css` becomes the single home for editorial font-family aliases, semantic text sizes, and shared hierarchy tokens. Panel-local `@import` and per-file font declarations should be removed where possible.
- **Home screen hierarchy is the readability baseline**: normalize oversized panel headings and labels against the global `--font-display`, `--font-ui`, `--font-mono`, and shared text-size tokens already used successfully by the home screen.
- **Shared component extraction wins over panel-local copy/paste**: when two or more surfaces share the same card or header structure, extract or extend a component instead of preserving slightly different local builds.
- **Music player becomes a component, not a dock fragment**: `AppShell` should keep `MenuMusicPlayer` state ownership, but the rendered UI becomes a reusable `MarginalMusicCard`-style component mounted into `RacePanel`.
- **Panel CSS should consume tokens, not redefine the design system**: panel files may still own layout CSS, but typography, card geometry, and common label/value styles should come from shared classes or vars.
- **Settings counts as first-class product UI**: active settings surfaces should be brought onto the same font/text rules rather than left as a stylistic exception.
- **Do not over-abstract markup that is truly unique**: only extract repeated structures. Unique layout composition can remain panel-owned if it consumes the shared vocabulary.

## Open Questions

### Resolved During Planning

- The music player should be visually separate from `System Logs`
- The current problem is maintainability and consistency, not the overall visual direction
- Typography unification should follow the existing home-screen/global token system instead of leaving panels on a separate Inter-based branch

### Deferred to Implementation

- Whether the best extraction is a dedicated `MarginalTypography` helper module, shared CSS utility classes, or both
- Which legacy overlays beyond active menu/settings surfaces should be normalized in this pass versus the next runtime HUD pass
- Whether `EditorialRuntimeTheme.js` should be expanded and retained or collapsed into `ui-theme.css` plus component-local rules

## High-Level Technical Design

```text
Global UI Foundation
├── js/ui/ui-theme.css
│   ├── font aliases
│   ├── semantic text scale
│   ├── editorial type roles
│   └── shared card/action utility vars
│
├── shared components
│   ├── MarginalPanelHeader
│   ├── MarginalPanelCard
│   ├── MarginalActionCard
│   └── MarginalMusicCard (new)
│
└── consumer surfaces
    ├── AppShell
    ├── RacePanel
    ├── CharacterPanel
    ├── GaragePanel
    ├── TracksPanel
    ├── ProfilePanel / settings
    └── selected overlays using divergent typography
```

## Implementation Units

- [ ] **Unit 1: Establish One Shared Editorial Typography Layer**

**Goal:** Move the editorial font and text hierarchy into a single shared token layer and stop panel-local font setup drift.

**Requirements:** R1, R2, R4, R6, R7, R9

**Dependencies:** None

**Files:**
- Modify: `js/ui/ui-theme.css`
- Modify: `js/ui/components/MarginalPanelHeader.js`
- Modify: `js/ui/components/MarginalPanelCard.js`
- Modify: `js/ui/components/MarginalActionCard.js`
- Modify: `js/ui/components/EditorialRuntimeTheme.js`
- Test: `tests/app-shell-menu-music-widget.test.mjs`

**Approach:**
- Add shared editorial aliases/tokens in `ui-theme.css` for:
  - display hero
  - display section title
  - stat/value headline
  - eyebrow/label/meta text
  - mono body copy
- Route editorial components through those tokens instead of local hardcoded font-size values where possible
- Remove repeated panel-local `@import` font blocks and inline editorial font variable definitions in favor of the shared layer
- Keep the existing visual flavor, but normalize sizes against the home-screen scale so large text does not randomly overshoot

**Patterns to follow:**
- Existing global token ownership in `js/ui/ui-theme.css`
- Home-screen text usage in `js/ui/pages/page02-home/Page02HomeView.js`

**Test scenarios:**
- Happy path: panel headers and cards still render after font-import removal
- Happy path: editorial components resolve display/mono fonts through global tokens
- Edge case: existing non-editorial pages that use `--font-display` / `--font-ui` remain visually stable
- Edge case: shared components do not regress color/variant handling

**Verification:**
- No active shell panel contains its own font import block for editorial fonts
- Editorial text sizes map to shared semantic tokens instead of arbitrary local numbers

---

- [ ] **Unit 2: Extract a Dedicated Music Card Component**

**Goal:** Replace the raw shell music dock with a reusable card component and render it as its own surface in PLAY instead of nesting it under `System Logs`.

**Requirements:** R3, R5, R7, R8

**Dependencies:** Unit 1

**Files:**
- Create: `js/ui/components/MarginalMusicCard.js`
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/panels/RacePanel.js`
- Test: `tests/app-shell-menu-music-widget.test.mjs`

**Approach:**
- Move the visible music-player DOM/render logic out of `AppShell._createMenuMusicDock()`
- Create a reusable component that:
  - subscribes to the shared `MenuMusicPlayer`
  - owns the card DOM and controls
  - uses the same editorial card + text primitives as the rest of the menu
- Keep `AppShell` responsible only for:
  - player lifecycle
  - volume sync
  - initial component construction and mount handoff
- Update `RacePanel` so the music player sits in its own card near the logs rail rather than as a child slot inside the logs card

**Patterns to follow:**
- `MarginalPanelCard` surface structure
- Existing menu music state/update flow in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: music card renders current track, status, play/pause, and next controls
- Happy path: PLAY panel shows `System Logs` and music as separate surfaces
- Edge case: no playlist available shows the empty/error state without throwing
- Edge case: toggling tracks still updates the mounted component after tab switches

**Verification:**
- No music widget is rendered inside the `System Logs` card
- PLAY shows a dedicated music card with working controls

---

- [ ] **Unit 3: Normalize Active Shell Panels Around Shared Type Roles**

**Goal:** Reduce panel-level typography drift and repeated near-duplicate markup across active menu surfaces.

**Requirements:** R2, R3, R4, R6, R7, R8

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/panels/RacePanel.js`
- Modify: `js/ui/panels/CharacterPanel.js`
- Modify: `js/ui/panels/GaragePanel.js`
- Modify: `js/ui/panels/TracksPanel.js`
- Modify: `js/ui/panels/ProfilePanel.js`

**Approach:**
- Audit current panel-local large titles, labels, and copy against the new semantic type roles
- Replace repeated label/value/card micro-patterns with shared classes or small helpers where the structure matches
- Remove the most obvious panel-specific “randomly bigger” text sizes that break hierarchy
- Keep each panel’s unique layout, but route the visual language through the same shared typography system

**Patterns to follow:**
- Existing `MarginalPanelCard` / `MarginalPanelHeader` usage
- Current active shell layout and spacing rules in `AppShell` and `ui-theme.css`

**Test scenarios:**
- Happy path: PLAY / CHARACTER / GARAGE / TRACKS / PROFILE all render with stable hierarchy after token normalization
- Happy path: active/selected cards still preserve emphasis without needing oversized type
- Edge case: bottom nav and top-right settings pill do not collide with newly normalized panel headers
- Edge case: mobile breakpoints still keep headings readable without overgrowth

**Verification:**
- Active shell panels share a visibly coherent text hierarchy
- Repeated UI micro-structures are not duplicated with slight CSS forks

---

- [ ] **Unit 4: Bring Settings Onto the Same Design System**

**Goal:** Make settings a first-class member of the editorial system with the same font and text rules as the main shell.

**Requirements:** R1, R2, R4, R9

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Modify: `js/SettingsMenu.js`
- Modify: `js/ui/overlays/ResultsOverlay.js`
- Modify: `js/ui/overlays/LobbyOverlay.js`
- Modify: `js/ui/overlays/TrackSelectOverlay.js`
- Test: `tests/e2e/profile-settings.spec.js`

**Approach:**
- Replace direct fallback font declarations and isolated large-title sizing with shared typography tokens
- Normalize settings section headers, tab labels, badges, and form/meta copy to the same hierarchy as the rest of the shell
- Only touch overlays where the font/text system is clearly diverging from the active shell

**Patterns to follow:**
- Shared typography tokens from Unit 1
- Existing settings modal/page behavior and profile-settings tests

**Test scenarios:**
- Happy path: settings opens with the same editorial hierarchy as the rest of the menu
- Happy path: overlay titles and badges remain readable and stylistically consistent
- Edge case: button focus/hover states still work after typography class changes
- Edge case: modal sizing does not break when title scales are reduced or normalized

**Verification:**
- Settings no longer reads like a separate typographic system
- Active overlays use the same font language as the menu shell

---

- [ ] **Unit 5: Strip Obvious Styling Drift Without Expanding Scope**

**Goal:** Remove the highest-value remaining inline/ad-hoc UI styling in the touched surfaces without turning this pass into a full HUD rewrite.

**Requirements:** R3, R7, R8, R9

**Dependencies:** Units 1-4

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/panels/RacePanel.js`
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Modify: `js/ui/components/MarginalMusicCard.js`
- Test: `tests/e2e/navigation.spec.js`

**Approach:**
- Remove remaining touched-surface inline style fragments where a shared class or component boundary is more appropriate
- Keep the cleanup focused on files already in scope; do not balloon into all legacy runtime HUD modules in one pass
- Leave runtime-only legacy HUD cleanup for the broader editorial rollout unless directly touched here

**Patterns to follow:**
- Existing component-scoped static CSS injection pattern
- Shared global token usage from `ui-theme.css`

**Test scenarios:**
- Happy path: touched surfaces render without depending on one-off inline style strings
- Edge case: shell utility mounts and tab switching still work after DOM boundary cleanup
- Edge case: no regression in menu navigation or settings access

**Verification:**
- Touched menu/settings surfaces rely on components/shared CSS rather than ad-hoc inline styling
- The pass reduces, rather than increases, surface-specific UI code

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Typography normalization accidentally shrinks or flattens emphasis too much | Use the home screen as the sizing sanity check and verify visually in browser after each panel pass |
| Refactoring music UI breaks player state updates | Keep `MenuMusicPlayer` ownership in `AppShell`; only move the rendered component boundary |
| Shared-component extraction causes panels to lose unique layout character | Extract only micro-structures and typography rules, not whole panel compositions |
| Settings/overlay normalization expands scope too far | Limit implementation to active player-facing shell/settings surfaces with visible divergence |

## Verification Strategy

- Static checks:
  - `node --check` for each changed JS module
- Browser verification:
  - PLAY tab shows separate `System Logs` and music cards
  - CHARACTER / GARAGE / TRACKS / PROFILE headings and labels share a coherent hierarchy
  - settings modal/page uses the same typography system
- Existing automated coverage to reuse:
  - `tests/app-shell-menu-music-widget.test.mjs`
  - `tests/e2e/navigation.spec.js`
  - `tests/e2e/profile-settings.spec.js`

## Implementation Notes

- Prefer reducing duplication even if it means a small shared helper file is added
- Prefer semantic token names over more raw numeric size variables in panel files
- Do not create a second editorial font branch; the point of this pass is convergence
