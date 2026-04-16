---
title: "refactor: Align Tracks Panel With Shared Customizer Shell"
type: refactor
status: active
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-16-003-refactor-unify-character-and-garage-customizer-layouts-plan.md
  - docs/plans/2026-04-16-005-refactor-unify-character-garage-customizer-typography-plan.md
  - docs/plans/2026-04-16-004-refactor-design-system-tokenize-core-ui-and-reduce-inline-css-plan.md
---

# refactor: Align Tracks Panel With Shared Customizer Shell

## Overview

Bring the `Tracks` tab into the same UI family as `Character` and `Garage`.

Today the tab uses the editorial colors, but its composition still feels like a separate product: a browser-first stage with a detached bottom-right card. This pass should make `Tracks` read as the route customizer sibling to the other two tabs, with a shared builder surface, shared typography, and the same right-side inspector cadence.

## Problem Frame

The user is seeing a structural mismatch, not just a style mismatch.

Local research shows:

- `js/ui/panels/CharacterPanel.js` uses a top-left cream builder surface over the stage plus a right inspector deck
- `js/ui/panels/GaragePanel.js` uses the same shell pattern with shared customizer text roles
- `js/ui/panels/TracksPanel.js` instead mounts `TrackLibraryBrowser` as a wide stage browser and pushes a compact selected-route card to the lower-right

So even though the tab shares some editorial colors and cards, it still feels random relative to the other customizer tabs.

## Requirements Trace

- R1: `Tracks` should use the same broad shell model as `Character` and `Garage`
- R2: Route browsing should live inside a builder-like surface instead of feeling like a standalone app
- R3: The selected-track inspector and utility actions should live in a right-side deck aligned with the existing customizer tabs
- R4: Track browsing behavior and data sources must remain intact
- R5: Shared typography and control sizing should come from the existing design-system/customizer tokens where possible
- R6: Mobile behavior should remain readable and scrollable

## Scope Boundaries

- In scope:
  - `js/ui/panels/TracksPanel.js`
  - `js/ui/components/TrackLibraryBrowser.js` only if a small styling seam is needed
  - optional shared theme token touch-up in `js/ui/ui-theme.css`
  - a focused test covering the Tracks shell contract
- Out of scope:
  - changing track data sources or APIs
  - redesigning public track pages or the track editor
  - changing race setup overlays outside the main shell

## Assumptions

- The `TrackLibraryBrowser` interaction model is still useful, but it should be visually rehoused rather than discarded
- The best match is: top-left cream route-builder surface, right-side live inspector deck, full-screen shell continuity
- `Tracks` does not need to become identical to `Character` or `Garage`; it needs to feel authored from the same system

## Local Research Summary

### Current divergence

- `TracksPanel` uses a unique interface grid and hides the browser detail pane, which leaves the main browser as a generic content slab
- The right-side deck is underpowered and currently only mounts the selected-route card in `_build()`
- `_buildEditorCard()` already exists and can be reused once the deck is treated as a real inspector column

### Patterns to follow

- `CharacterPanel` stage composition: builder surface mounted over the stage with a right deck
- `GaragePanel` customizer text hierarchy: eyebrow, title, copy, section labels, compact action text
- existing shared tokens in `js/ui/ui-theme.css` for customizer type sizes and builder/deck widths

## External Research Decision

No external research is needed.

This is an existing-app design-system alignment task and the codebase already contains the exact sibling patterns to follow.

## Key Technical Decisions

- **Adopt the customizer shell composition for Tracks** rather than inventing a new hybrid layout.
- **Turn the browser into the route builder surface** by placing it inside a cream clipped panel on the stage.
- **Promote the right deck into a proper inspector column** by mounting both the selected-route card and the route-control utility card.
- **Map Tracks typography to the existing customizer token layer** instead of keeping a separate micro-scale.
- **Preserve TrackLibraryBrowser behavior ownership** so this remains a shell refactor, not a data-model rewrite.

## Open Questions

### Resolved During Planning

- The mismatch is primarily layout/composition, not missing data
- The right answer is to align Tracks to the customizer shell instead of making Character/Garage more browser-like

### Deferred to Implementation

- Whether `TrackLibraryBrowser` needs any small markup hooks for cleaner shell-level styling
- Whether the selected-route card should remain cream or shift to outline once the builder panel becomes cream

## High-Level Technical Design

```text
Tracks Customizer Shell
├── Header
├── Stage
│   └── Route builder panel (cream)
│       ├── eyebrow / title / copy
│       └── TrackLibraryBrowser rails
└── Inspector deck (right)
    ├── selected route card
    └── route control / library ops card
```

## Implementation Units

- [ ] **Unit 1: Tracks shell layout alignment**

**Goal:** Make the Tracks panel adopt the same shell composition used by Character and Garage.

**Requirements:** R1, R2, R3, R6

**Dependencies:** None

**Files:**
- Modify: `js/ui/panels/TracksPanel.js`

**Approach:**
- Rework the stage to host a clipped cream builder surface
- Keep the header/deck structure consistent with the sibling tabs
- Mount the utility card in the right deck so the panel has the same inspector rhythm

**Patterns to follow:**
- `js/ui/panels/CharacterPanel.js`
- `js/ui/panels/GaragePanel.js`

**Test scenarios:**
- Happy path: Tracks renders a builder surface and a right-side deck
- Edge case: mobile collapses into a readable vertical stack

**Verification:**
- Tracks reads as the same product family as Character and Garage at first glance

---

- [ ] **Unit 2: Track browser typography and builder-surface styling**

**Goal:** Normalize the Tracks text hierarchy and control sizing onto the shared customizer/editorial system.

**Requirements:** R2, R5, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/panels/TracksPanel.js`
- Modify: `js/ui/components/TrackLibraryBrowser.js` if needed
- Modify: `js/ui/ui-theme.css` only if one small shared token/seam is missing

**Approach:**
- Apply existing customizer semantic roles to builder eyebrow/title/copy and rail headings
- Keep browser cards angular and editorial, but tuned to the same sizing rhythm as the customizer tabs
- Reduce bespoke sizing where shared token roles already exist

**Patterns to follow:**
- `js/ui/panels/GaragePanel.js`
- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`

**Test scenarios:**
- Happy path: route browser headings/cards/actions render with shared typography rhythm
- Edge case: long route names still truncate or wrap cleanly inside the new builder panel

**Verification:**
- The tab no longer feels like a separate UI kit

---

- [ ] **Unit 3: Tracks shell contract verification**

**Goal:** Add lightweight coverage for the new shell shape and review the refactor for regressions.

**Requirements:** R3, R4, R6

**Dependencies:** Units 1-2

**Files:**
- Add or modify: a focused test under `tests/`

**Approach:**
- Prefer a small structural/contract test over brittle pixel assertions
- Verify both selection and utility inspector surfaces are mounted

**Test scenarios:**
- Happy path: Tracks panel builds both builder and deck surfaces
- Edge case: selection state still updates without the old inline detail pane

**Verification:**
- The refactor preserves behavior while standardizing layout

## Risks and Mitigations

- **Risk:** The track browser may feel cramped when placed in a cream builder panel.
  - **Mitigation:** Use the existing customizer builder width token as a floor, then allow the panel to widen within a capped range for the browser use case.

- **Risk:** Styling `TrackLibraryBrowser` from the panel may become too selector-heavy.
  - **Mitigation:** Add one or two narrow styling seams in the browser component if needed instead of piling on overrides.

- **Risk:** The new deck composition could duplicate too much information.
  - **Mitigation:** Keep the right deck focused on selected-route state and route ops, while the builder surface owns browsing.

## Verification Strategy

- Run syntax checks on touched UI files
- Run targeted tests for any new or updated shell-contract coverage
- Browser-check the Tracks tab in the running app to confirm the new shell reads consistently with Character and Garage
