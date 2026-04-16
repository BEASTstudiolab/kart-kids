---
title: "refactor: Unify Character and Garage Customizer Typography"
type: refactor
status: active
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-16-003-refactor-unify-character-and-garage-customizer-layouts-plan.md
  - docs/plans/2026-04-16-004-refactor-design-system-tokenize-core-ui-and-reduce-inline-css-plan.md
---

# refactor: Unify Character and Garage Customizer Typography

## Overview

Finish the customizer unification work by putting `Character` and `Garage` on one shared customizer typography and control system.

The current shell/layout work made the two tabs feel like siblings spatially, but the text system still diverges:

- `Garage` uses a hand-authored editorial customizer scale
- `Character` still inherits a mostly generic page-local type scale from `Page10CharacterSelectView`

This pass should make both tabs feel like one product surface, not two different UI kits inside the same shell.

## Problem Frame

The user is seeing a real inconsistency: text styles in `Character` and `Garage` do not match even though both tabs are customization flows.

Local research shows the mismatch is structural:

- `js/ui/panels/GaragePanel.js` directly defines customizer-specific typography for builder labels, large titles, copy blocks, controls, and stat labels
- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js` still defines its own font stack, font weights, radii, and type sizes using generic `font-ui` / `font-display` styles and rounded panel defaults
- `js/ui/panels/CharacterPanel.js` only partially overrides that page-level view, so Character ends up as a hybrid of old page styles and the new editorial shell

So the issue is not just "a few labels look off." The Character builder is still authored as a different typographic system than Garage.

## Requirements Trace

- R1: `Character` and `Garage` must share one customizer typography hierarchy
- R2: Shared customizer labels, body copy, section titles, control text, and meta text should come from common tokens or utility classes
- R3: `Character` should stop relying on the old page-local rounded/generic typography defaults in tab mode
- R4: The current editorial visual direction stays intact
- R5: Existing category/item/color behavior in Character must remain intact
- R6: Existing kart paint/stat behavior in Garage must remain intact
- R7: The customizer shell should still feel responsive and readable on mobile

## Scope Boundaries

- In scope:
  - `js/ui/ui-theme.css`
  - `js/ui/panels/CharacterPanel.js`
  - `js/ui/panels/GaragePanel.js`
  - `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
  - tests covering character layout/markup assumptions and a small shared customizer contract
- Out of scope:
  - changing Character or Garage data models
  - redesigning the whole shell again
  - runtime HUD typography
  - changing non-customizer tabs

## Assumptions

- The Garage customizer is the better expression of the intended editorial direction, but some of its type rules should be normalized into shared tokens instead of staying panel-local
- Character tab mode is the primary place where the generic page styles need to be neutralized
- A good solution is a shared customizer text/control layer, not more one-off overrides in `CharacterPanel`

## Local Research Summary

### Root cause

- `Page10CharacterSelectView.js` still defines:
  - rounded panels
  - generic `font-ui` labels and body copy
  - its own item, detail, and tab button type scale
- `CharacterPanel.js` overrides some colors and font families, but not the whole scale and control language
- `GaragePanel.js` defines a more editorialized system:
  - mono micro-labels
  - large display title
  - compact mono copy
  - angular zero-radius control rows and buttons

### Most relevant files

- `js/ui/ui-theme.css`
- `js/ui/panels/CharacterPanel.js`
- `js/ui/panels/GaragePanel.js`
- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- `tests/character-select-layout.test.mjs`
- `tests/e2e/character-tab.spec.js`

## External Research Decision

No external research is needed.

This is a local design-system consistency problem inside an existing codebase with established customizer patterns.

## Key Technical Decisions

- **Create a shared customizer typography layer** in `js/ui/ui-theme.css` for the builder surfaces rather than keeping Garage as a private style source.
- **Character tab mode should opt into a customizer variant** instead of relying on `CharacterPanel` to brute-force individual selectors into place.
- **Page10CharacterSelectView keeps behavior ownership** for categories, items, and color controls, but it should expose a cleaner styling seam for tab/customizer mode.
- **Garage should be normalized onto the same shared tokens** where its current sizes and labels map to the same semantic roles.

## Open Questions

### Resolved During Planning

- The mismatch is real and rooted in separate typography systems, not user perception
- The right fix is shared customizer tokens plus Character tab-mode cleanup

### Deferred to Implementation

- Whether the cleanest seam is a `page-character-select--customizer` modifier, CSS variables, or both
- How much Garage should move to shared utility classes versus staying panel-local with shared vars

## High-Level Technical Design

```text
Customizer Design Layer
├── js/ui/ui-theme.css
│   ├── shared customizer text tokens
│   ├── shared builder/control utility classes
│   └── shared angular control treatments
│
├── Character
│   ├── Page10CharacterSelectView customizer mode
│   ├── CharacterPanel consumes shared tokens
│   └── inspector deck stays editorial
│
└── Garage
    ├── GaragePanel maps its builder typography to the same tokens
    └── control rows/buttons align with Character
```

## Implementation Units

- [ ] **Unit 1: Shared customizer typography contract**

**Goal:** Define one shared set of customizer text and control roles for builder-side surfaces.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Modify: `js/ui/ui-theme.css`
- Test: `tests/unit/customizer-typography-contract.test.mjs`

**Approach:**
- Add shared customizer tokens and/or utility classes for:
  - eyebrow labels
  - large builder titles
  - compact builder copy
  - section labels
  - control labels/meta text
  - angular button/tab/control row treatments
- Keep the token layer semantic so both tabs can consume it

**Patterns to follow:**
- existing editorial token naming in `js/ui/ui-theme.css`
- current Garage customizer scale where it already feels right

**Test scenarios:**
- Happy path: shared customizer tokens/classes exist in the theme
- Edge case: shared roles are expressed semantically rather than as per-page names

**Verification:**
- Both tabs can reference one canonical customizer text/control layer

---

- [ ] **Unit 2: Character customizer mode normalization**

**Goal:** Make Character tab mode consume the shared customizer typography and angular control system.

**Requirements:** R1, R2, R3, R5, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Modify: `js/ui/panels/CharacterPanel.js`
- Test: `tests/character-select-layout.test.mjs`
- Test: `tests/e2e/character-tab.spec.js`

**Approach:**
- Introduce a tab/customizer-specific styling mode in `Page10CharacterSelectView`
- Replace the remaining generic rounded/page-like text and control styles with shared customizer roles
- Reduce the amount of per-selector typography patching in `CharacterPanel`

**Patterns to follow:**
- Garage builder treatments for label/title/copy hierarchy
- existing Character tab behavior and category/item rendering

**Test scenarios:**
- Happy path: character tab still renders the expected category tabs, color rows, and item grid
- Edge case: masks tab still only shows main tint
- Edge case: thumbnail categories still render thumbnails and active state
- Edge case: tab mode still hides redundant page header chrome

**Verification:**
- Character builder typography and control styling visually align with Garage

---

- [ ] **Unit 3: Garage typography normalization**

**Goal:** Align Garage builder text/control styling with the shared customizer contract instead of keeping its own parallel scale.

**Requirements:** R1, R2, R4, R6, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/panels/GaragePanel.js`
- Test: `tests/unit/customizer-typography-contract.test.mjs`

**Approach:**
- Map Garage builder labels, copy, buttons, and summary text onto the new shared customizer roles
- Preserve existing Garage behavior and layout

**Patterns to follow:**
- current Garage layout
- shared customizer roles from Unit 1

**Test scenarios:**
- Happy path: Garage still renders the builder, summary, and stat surfaces
- Edge case: Character/Garage can now be compared without obvious text hierarchy drift

**Verification:**
- Garage and Character read as the same customization suite typographically

## Verification

- `node --check js/ui/panels/CharacterPanel.js`
- `node --check js/ui/panels/GaragePanel.js`
- `node --check js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- `node --test tests/character-select-layout.test.mjs`
- `node --test tests/unit/customizer-typography-contract.test.mjs`
- Browser-check `/#/characters` and `/#/garage`

