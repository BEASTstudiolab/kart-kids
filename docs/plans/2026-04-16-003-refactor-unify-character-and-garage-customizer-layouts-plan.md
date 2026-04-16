---
title: "refactor: Unify Character and Garage Customizer Layouts"
type: refactor
status: active
date: 2026-04-16
origin: conversation-2026-04-16
---

# refactor: Unify Character and Garage Customizer Layouts

## Overview

Bring the `Character` and `Garage` tabs onto one shared customization-surface layout so they feel like two modes of the same system instead of two unrelated screens that happen to use the same editorial colors.

The target interaction is a full-screen customizer shell with:

- a shared top editorial header
- a persistent left-side cream builder/control surface
- a compact right-side inspector/status deck
- the existing 3D/menu stage living behind or between those surfaces

`Garage` already approximates that structure, so this pass should make it the layout anchor and pull `Character` into the same framing model.

## Problem Frame

The current `Character` and `Garage` tabs are both customization experiences, but their layouts communicate different products:

- `Garage` is a staged editor with a left builder panel, a right status deck, and a full-screen preview context
- `Character` is still essentially a standalone embedded page with a single large sidebar and no matching inspector deck

That mismatch makes the customization flow feel fragmented:

- switching between tabs feels like switching apps instead of changing customization mode
- the visual system is shared, but the spatial model is not
- `Character` feels flatter and less integrated into the live menu stage than `Garage`

The user request is to match these layouts because both tabs are doing customization work and should therefore feel unified.

## Requirements Trace

- R1: `Character` and `Garage` must share the same high-level layout model
- R2: The existing editorial design system remains the visual language
- R3: The tabs must stay full-screen and preserve the live stage/menu preview context
- R4: Existing customization behavior must remain intact
- R5: Reusable layout structure should be extracted where it reduces duplication
- R6: `Character` must retain its current category controls, grid behavior, and preview-focus behavior
- R7: `Garage` must retain its kart selection, paint controls, and stat visibility
- R8: Mobile behavior must remain functional and readable

## Scope Boundaries

- In scope:
  - `js/ui/panels/CharacterPanel.js`
  - `js/ui/panels/GaragePanel.js`
  - `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
  - `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
  - shared UI helpers or tokens needed to support a common customizer shell
  - tests covering layout and behavior regressions for the character tab
- Out of scope:
  - changing actual customization data models
  - adding new garage/character feature sets
  - changing menu preview camera rules except where the existing focus logic needs to keep working
  - broad shell navigation redesign outside these two tabs

## Context & Research

### Relevant Current Files

- `js/ui/panels/GaragePanel.js`
- `js/ui/panels/CharacterPanel.js`
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- `js/ui/components/MarginalPanelHeader.js`
- `js/ui/ui-theme.css`
- `tests/character-select-layout.test.mjs`
- `tests/e2e/character-tab.spec.js`

### Current Structural Difference

- `GaragePanel` already creates:
  - a full-screen `kk-garage__interface`
  - a left builder panel mounted into the stage
  - a right-side `kk-garage__deck`
  - a bottom selector rail
- `CharacterPanel` currently creates:
  - a header
  - one stage wrapper
  - the embedded `Page10CharacterSelectView`, which internally renders a single large sidebar

### Patterns To Follow

- Use the current `GaragePanel` shell as the composition reference rather than inventing a third variation
- Preserve the `Page10CharacterSelectController` tab-mode behavior and menu preview focus logic
- Keep typography/tokens aligned with the existing editorial shell and recent settings/customizer work

## Key Technical Decisions

- **Garage becomes the layout anchor**: The shared customizer shell will follow the `Garage` spatial model, because it already expresses the desired “builder + inspector + stage” pattern.
- **Extract layout primitives conservatively**: Create a small shared customizer-shell layer only if it meaningfully reduces duplication between `CharacterPanel` and `GaragePanel`; do not over-abstract the entire content rendering model.
- **Character content stays controller-driven**: The existing `Page10CharacterSelectController/View` remain the behavior owners for category tabs, color controls, item grids, and preview focus.
- **Character gets an inspector deck**: Add a compact right-side summary/status surface so the tab matches Garage’s information hierarchy.
- **Tab-mode config should drive presentation where possible**: If the embedded character view needs different copy or reduced internal chrome to sit cleanly inside the shared shell, prefer configuration over branching the page into a second bespoke implementation.

## Open Questions

### Resolved During Planning

- The unification should happen by adapting `Character` toward the `Garage` shell, not by flattening `Garage`
- The work is a layout/system pass, not a feature expansion pass

### Deferred to Implementation

- Whether a dedicated shared component is warranted or whether shared CSS/token helpers are enough
- The exact contents of the new `Character` inspector deck (summary, active category, selection state, or live hints)

## High-Level Technical Design

```text
Customizer Shell
├── shared editorial header
├── shared full-screen interface grid
│   ├── left builder surface
│   ├── center/live stage
│   └── right inspector deck
│
├── Garage content
│   ├── kart paint builder
│   ├── stat deck
│   └── kart rail
│
└── Character content
    ├── existing category + item controls
    ├── shared shell framing
    └── new right-side inspector summary
```

## Implementation Units

- [ ] **Unit 1: Shared Customizer Shell Alignment**

**Goal:** Define a common outer-shell layout model used by both `CharacterPanel` and `GaragePanel`.

**Requirements:** R1, R2, R3, R5, R8

**Dependencies:** None

**Execution note:** Standard implementation.

**Files:**
- Modify: `js/ui/panels/GaragePanel.js`
- Modify: `js/ui/panels/CharacterPanel.js`
- Modify: `js/ui/ui-theme.css`
- Optional create: `js/ui/components/MarginalCustomizerShell.js`

**Approach:**
- Identify the minimum shared grid/staging structure between the two panels
- Extract or normalize:
  - outer full-screen panel spacing
  - header placement
  - left builder surface dimensions
  - right deck positioning
  - responsive collapse behavior
- Keep each panel’s domain-specific content owned locally

**Patterns to follow:**
- `js/ui/panels/GaragePanel.js`
- `js/ui/components/MarginalPanelHeader.js`

**Test scenarios:**
- Happy path: both tabs render inside a full-height customization shell
- Edge case: mobile layout collapses to a single-column readable stack
- Edge case: no shared extraction introduces a new competing token vocabulary

**Verification:**
- `Character` and `Garage` read as sibling surfaces with matching composition

---

- [ ] **Unit 2: Character Tab Layout Migration**

**Goal:** Move `Character` from a single embedded sidebar layout into the shared customizer shell while preserving current character editing behavior.

**Requirements:** R1, R3, R4, R6, R8

**Dependencies:** Unit 1

**Execution note:** Preserve behavior first. Layout changes must not break category navigation, thumbnail rendering, or preview focus handoff.

**Files:**
- Modify: `js/ui/panels/CharacterPanel.js`
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Test: `tests/character-select-layout.test.mjs`
- Test: `tests/e2e/character-tab.spec.js`

**Approach:**
- Update tab-mode config and/or wrapper styling so the character controls sit as the left builder surface
- Add a right-side inspector card/deck summarizing the active category and current selection state
- Keep the content grid and item rendering behavior intact
- Preserve menu preview focus updates when categories change

**Patterns to follow:**
- Existing tab-mode character config in `Page10CharacterSelectController.js`
- Current Garage shell structure in `js/ui/panels/GaragePanel.js`

**Test scenarios:**
- Happy path: character tab still renders five category tabs and the expected option grids
- Happy path: switching categories still updates active tab state and preview focus behavior
- Edge case: masks tab still shows only the main tint control
- Edge case: thumbnail-based categories still render visible thumbnails
- Edge case: tab mode still suppresses redundant internal page header chrome

**Verification:**
- Character uses the same shell composition as Garage without losing any current customization interactions

---

- [ ] **Unit 3: Garage Shell Cleanup**

**Goal:** Adjust Garage where needed so it participates cleanly in the shared customizer system rather than remaining a one-off implementation.

**Requirements:** R1, R2, R4, R7, R8

**Dependencies:** Unit 1

**Execution note:** Standard implementation.

**Files:**
- Modify: `js/ui/panels/GaragePanel.js`
- Optional test: `tests/e2e/navigation.spec.js`

**Approach:**
- Normalize Garage shell structure against the shared model
- Keep the existing kart style panel, stats deck, and carousel, but align naming/spacing/responsive behavior with the Character shell
- Ensure the Character cross-link still works

**Patterns to follow:**
- Existing Garage interactions
- Shared shell decisions from Unit 1

**Test scenarios:**
- Happy path: garage still shows kart paint controls, stats, and selector rail
- Edge case: switching back and forth between `Character` and `Garage` does not break staging or panel visibility
- Edge case: responsive layout preserves access to builder controls and deck content

**Verification:**
- Garage and Character feel like two modes of a single customization suite

## Test Strategy

- Static/code-level:
  - `node --check js/ui/panels/CharacterPanel.js`
  - `node --check js/ui/panels/GaragePanel.js`
  - `node --check js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
  - `node --check js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Targeted tests:
  - `tests/character-select-layout.test.mjs`
  - `tests/e2e/character-tab.spec.js`
- Visual/browser verification:
  - open both `#/characters` and `#/garage`
  - compare shell composition, responsive layout, and navigation between the two tabs

## Risks & Mitigations

- **Risk:** Character layout cleanup accidentally breaks current category/grid behavior
  - **Mitigation:** Keep controller behavior intact and cover layout changes with the existing character layout/e2e tests
- **Risk:** Shared abstraction adds unnecessary complexity
  - **Mitigation:** Extract only the outer shell if duplication is real; keep domain-specific panels local
- **Risk:** The new right-side Character deck duplicates information or crowds the stage
  - **Mitigation:** Keep the inspector compact and summary-oriented

## Definition of Done

- `Character` and `Garage` share the same top-level customization composition
- Existing character and garage interactions still work
- Responsive behavior remains usable
- Targeted tests pass
- Visual verification confirms the two tabs feel like a unified customization suite
