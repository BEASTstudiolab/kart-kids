---
title: "refactor: Design System Tokenize Core UI and Reduce Inline CSS"
type: refactor
status: active
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-15-003-refactor-editorial-design-system-across-core-game-surfaces-plan.md
  - docs/plans/2026-04-15-004-refactor-ui-design-system-consolidation-and-typography-normalization-plan.md
  - docs/plans/2026-04-16-003-refactor-unify-character-and-garage-customizer-layouts-plan.md
---

# refactor: Design System Tokenize Core UI and Reduce Inline CSS

## Overview

Bring the current UI closer to a real shared design system by centralizing editorial shell tokens and utility classes in `js/ui/ui-theme.css`, then migrating the most user-facing shell surfaces away from local one-off styling decisions.

This is not a brand-new visual redesign. It is a cleanup and consolidation pass so the current visual language becomes maintainable:

- one shared editorial token layer
- fewer panel-local design decisions
- less DOM-level style mutation on shell pages
- clearer separation between core product UI and runtime/debug tooling

## Problem Frame

The current answer to "do we have a unified design system?" is **not fully**.

The repo already has meaningful shared foundations:

- global tokens in `js/ui/ui-theme.css`
- editorial runtime helpers in `js/ui/components/EditorialRuntimeTheme.js`
- shared panel primitives such as `js/ui/components/MarginalPanelCard.js` and `js/ui/components/MarginalPanelHeader.js`

But those foundations are not yet consistently applied across the whole UI:

- shell pages still inject large page-local style blocks with typography and surface rules that duplicate the global system
- several views still use direct `style.*` mutation or `style.cssText`
- some panels define editorial palette aliases locally instead of inheriting a single canonical token layer
- debug and runtime utility surfaces still account for a large share of the remaining inline styling debt

That means the product can look coherent in screenshots while still being expensive to evolve in code.

## Requirements Trace

- R1: Establish one clear shared source of truth for editorial palette, typography, and repeated shell-surface treatments
- R2: Reduce inline CSS drift in core player-facing UI surfaces instead of adding more page-local styling
- R3: Keep existing visual direction intact; this pass is consolidation, not a restyle
- R4: Prioritize the active shell/menu experience over debug-only and runtime-only tooling
- R5: Reuse existing shared components where possible instead of introducing a parallel design system
- R6: Make it easier for future panels to compose shared classes and tokens instead of hardcoding sizes/colors
- R7: Leave runtime/debug HUD debt explicitly scoped so the shell cleanup does not pretend the entire game is solved

## Scope Boundaries

- In scope:
  - `js/ui/ui-theme.css`
  - existing editorial shared components used by the shell
  - active shell pages and views with obvious local style duplication
  - shell-level utility/layout classes that reduce repeated styling choices
  - small static tests that assert the shared-system contract exists
- Out of scope:
  - full runtime HUD and combat HUD cleanup in `js/HUD.js`, `js/HUDDamage.js`, and `js/GameEngine.js`
  - wholesale migration of all CSS-in-JS style injection across the entire repo
  - major layout redesigns of working menu flows
  - track editor and other tool-only surfaces

## Assumptions

- The current editorial shell direction is the intended visual source of truth
- The highest-value cleanup is in the menu/shell surfaces the player sees before and between races
- Runtime/debug surfaces should be harmonized later, but they should not block a worthwhile shell-level cleanup now
- A useful pass can centralize common shell treatments without converting every view into standalone `.css` files in one turn

## Local Research Summary

### Existing shared foundation

- `js/ui/ui-theme.css` already defines:
  - global palette tokens
  - font families
  - semantic text sizing
  - spacing, shadows, motion, and z-index layers
- `js/ui/components/EditorialRuntimeTheme.js` already defines runtime editorial utility classes such as:
  - `kk-rt-card`
  - `kk-rt-pill`
  - `kk-rt-btn`
  - `kk-rt-label`
  - `kk-rt-value`
- menu/editorial shared components already exist:
  - `js/ui/components/MarginalPanelCard.js`
  - `js/ui/components/MarginalPanelHeader.js`
  - `js/ui/components/MarginalMusicCard.js`

### Current consistency gaps

- `js/ui/pages/page04-play-modes/Page04PlayModesView.js`
  - carries a full local style block for repeated button/list/back-control treatments
- `js/ui/pages/page16-create-hub/Page16CreateHubView.js`
  - carries substantial local typography/surface definitions that overlap global tokens
- `js/ui/pages/page02-home/Page02HomeView.js`
  - already behaves more like the intended baseline and is a useful reference surface
- `js/ui/core/AppShell.js`
  - still contains a meaningful amount of direct style mutation for shell utility pieces

### Remaining inline-style hotspots by count

The highest inline-style hotspots are still:

- `js/HUD.js`
- `js/ui/LobbyScene.js`
- `js/ui/core/AppShell.js`
- `js/DebugPanelSetup.js`
- `js/ui/pages/page08-ranked/Page08RankedView.js`
- `js/ui/overlays/LobbyOverlay.js`

That confirms the product is in a transition state: the shared system exists, but it has not yet replaced older styling patterns everywhere.

## External Research Decision

No external research is needed.

This is an internal architecture and consolidation problem inside an already-established local UI system. The relevant answers are in the current codebase, not framework docs.

## Key Technical Decisions

- **`js/ui/ui-theme.css` remains the single canonical token file** for cross-surface colors, typography, spacing, and shared editorial utility classes.
- **Shared shell utility classes should carry repeated treatments** such as section labels, large action values, editorial pills, back buttons, selection rows, and common viewport shells.
- **Core shell pages should consume shared classes/tokens before inventing new local styles**. Unique layout can stay page-owned; repeated design language should not.
- **This pass will focus on shell/menu surfaces first**. Runtime/debug cleanup remains a follow-on effort rather than being partially and dangerously mixed into this pass.
- **Static regression tests are acceptable for the design-system contract** where behavior is mostly structural/stylistic.

## Open Questions

### Resolved During Planning

- The current system is partially unified, not fully unified
- The design-system cleanup should target the shell first, not the whole runtime HUD
- Inline-style debt should be reduced by expanding shared utilities, not by spreading more per-page CSS

### Deferred to Implementation

- Whether `AppShell` should get a broader utility extraction in this pass or a narrower cleanup around the most obvious shell controls
- Which runtime/debug hotspots should be next after the shell pass lands

## High-Level Technical Design

```text
Global Token Layer
└── js/ui/ui-theme.css
    ├── editorial palette aliases
    ├── editorial semantic type roles
    ├── shared shell utility classes
    └── common interaction/state styles

Shared Components
├── MarginalPanelCard
├── MarginalPanelHeader
└── other shell/editorial components consuming shared tokens

Consumer Surfaces
├── page02-home (reference)
├── page04-play-modes
├── page16-create-hub
└── selected shell-level utility surfaces
```

## Implementation Units

- [ ] **Unit 1: Expand the shared shell design-system contract**

**Goal:** Make `js/ui/ui-theme.css` the real home for repeated editorial shell treatments instead of leaving them fragmented inside individual page views.

**Requirements:** R1, R3, R5, R6

**Dependencies:** None

**Files:**
- Modify: `js/ui/ui-theme.css`
- Modify: `js/ui/components/MarginalPanelCard.js`
- Test: `tests/unit/editorial-design-system-contract.test.mjs`

**Approach:**
- Add or normalize shared editorial aliases/utilities for:
  - section labels
  - hero/value text
  - editorial pills
  - shell-safe button treatments
  - shared viewport/body wrappers where repeated
- Ensure shared card components consume canonical token names instead of panel-local assumptions where practical
- Keep the scope focused on shell-facing primitives rather than full runtime HUD primitives

**Patterns to follow:**
- `js/ui/ui-theme.css`
- `js/ui/components/EditorialRuntimeTheme.js`
- `js/ui/components/MarginalPanelCard.js`

**Test scenarios:**
- Happy path: shared editorial token names and utility classes exist in `ui-theme.css`
- Happy path: `MarginalPanelCard` uses shared editorial tokens rather than hardcoded standalone values where touched
- Edge case: existing editorial card variants still expose cream/red/outline states

**Verification:**
- Shared typography/color classes needed by multiple shell pages live in `ui-theme.css`
- The shared card primitive still renders with the same variants

---

- [ ] **Unit 2: Move core shell pages onto the shared utilities**

**Goal:** Reduce page-local styling drift in the active shell by moving repeated treatments in `page04-play-modes` and `page16-create-hub` onto shared design-system utilities.

**Requirements:** R2, R3, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/pages/page04-play-modes/Page04PlayModesView.js`
- Modify: `js/ui/pages/page16-create-hub/Page16CreateHubView.js`
- Test: `tests/e2e/play-modes.spec.js`
- Test: `tests/unit/editorial-design-system-contract.test.mjs`

**Approach:**
- Replace repeated local typography/surface decisions with shared classes and global tokens where the structure is common
- Keep unique page layout CSS in place where it is actually specific to the page
- Reduce direct styling for common controls such as back buttons, labels, selection rows, and editorial stat treatments

**Patterns to follow:**
- `js/ui/pages/page02-home/Page02HomeView.js`
- `js/ui/components/MarginalPanelCard.js`
- `js/ui/components/MarginalPanelHeader.js`

**Test scenarios:**
- Happy path: play modes still renders its mode selection and solo picker states
- Happy path: create hub still renders its shell sections and top tabs
- Edge case: shared classes are referenced by these views instead of duplicating the same typography/surface rules locally

**Verification:**
- The targeted shell pages rely more on shared design-system classes and fewer one-off visual rules

---

- [ ] **Unit 3: Clarify the boundary between shell system work and remaining runtime/debug debt**

**Goal:** Leave the repo in a more honest architectural state by explicitly reducing shell debt now and identifying runtime/debug hotspots as follow-on work instead of silent drift.

**Requirements:** R4, R7

**Dependencies:** Units 1-2

**Files:**
- Modify: `docs/plans/2026-04-16-004-refactor-design-system-tokenize-core-ui-and-reduce-inline-css-plan.md`

**Approach:**
- Update the plan checkboxes and note what was actually consolidated
- Keep the outstanding runtime/debug hotspots visible for later passes

**Patterns to follow:**
- Existing plan progress style in `docs/plans/*.md`

**Test scenarios:**
- Not applicable beyond implementation verification

**Verification:**
- The result clearly distinguishes “shared shell design system improved” from “entire UI is fully unified”

## Verification

- `node --test tests/unit/editorial-design-system-contract.test.mjs`
- `node --check js/ui/pages/page04-play-modes/Page04PlayModesView.js`
- `node --check js/ui/pages/page16-create-hub/Page16CreateHubView.js`
- Browser-check the active menu shell on the local dev server after implementation

