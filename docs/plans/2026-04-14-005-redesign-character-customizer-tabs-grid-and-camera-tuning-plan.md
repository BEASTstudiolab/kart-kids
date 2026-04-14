---
title: "feat: redesign character customizer tabs, option grid, and camera tuning"
type: feat
status: completed
date: 2026-04-14
origin: direct user request (2026-04-14)
---

# feat: redesign character customizer tabs, option grid, and camera tuning

## Overview

Reshape the character customizer into a cleaner left-rail workflow that feels more like a focused control deck than a long stack of drawers. Replace the accordion-plus-carousel interaction with top category tabs and a multi-column option grid, remove the floating `Live Stage` copy card, and surface live camera sliders that tune the actual shared lobby stage the user is looking at.

## Problem Frame

The current character tab is headed in the right direction, but three pieces are still fighting the experience:

1. The floating `Live Stage` card still overlays the hero and adds copy without helping selection.
2. The customizer itself is still organized like stacked drawers with a strip-style chooser, which makes scanning options slower than it needs to be.
3. The only camera tuning hooks currently live in the old character-preview path, but the user now cares about the shared lobby rider framing instead.

That leaves the UI visually simpler than before, but not yet truly direct. The next pass should make the stage cleaner, the option browsing denser, and the camera tweakable in the actual surface being tuned.

## Requirements Trace

- R1. Remove the floating `Live Stage` overlay card from the character customizer.
- R2. The character customizer uses category tabs at the top instead of a long accordion stack.
- R3. Only one category’s controls/options are shown at a time through the active tab.
- R4. Item options render in a dense responsive grid that targets four columns on desktop instead of a horizontal strip/carousel.
- R5. Existing categories remain available: `Palette`, `Masks`, `Accessories`, `Shirts`, and `Pants`.
- R6. Color controls remain available inside the active category.
- R7. Character selections still apply immediately with no explicit save/reset footer.
- R8. Camera tuning sliders are visible in the character customizer.
- R9. Camera tuning updates the shared `LobbyScene` framing, not only the removed embedded preview path.
- R10. Existing category-specific focus presets still work when switching categories.
- R11. The character tab remains usable on mobile/narrow widths after the tab/grid redesign.

## Scope Boundaries

- No redesign of the garage tab in this pass.
- No changes to track browsing, party lobby, or race HUD surfaces.
- No new content assets, icons, or animation files.
- No attempt to permanently serialize per-category camera tweaks in this pass unless the implementation makes that trivial and safe.
- No restoration of the old embedded `CharacterPreviewScene` panel.

## Context & Research

### Relevant Code and Patterns

- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js` currently owns the character customizer layout and still uses accordion category sections, carousel interactions, and a floating `Live Stage` callout.
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js` already supports immediate-apply selection state and category-based shared preview focus routing.
- `js/ui/LobbyScene.js` already owns preview presets for `play`, `character-body`, `character-face`, `character-accessories`, `character-shirt`, `character-pants`, and `garage-kart`.
- `js/ui/LobbyScene.js` also already exposes internal preview-pose state, so it is the right home for a lightweight “temporary camera tweak override” API.
- `js/ui/core/AppShell.js` already brokers shared menu preview focus through `setMenuPreviewFocus`, so it is a natural place to expose a shared camera-tuning service into the character tab.
- `tests/character-select-preview-focus.test.mjs` currently pins category routing and immediate-apply behavior.
- `tests/character-select-layout.test.mjs` currently pins the simplified shared-stage layout.
- `tests/lobby-assets.test.mjs` currently pins `LobbyScene` preset source behavior.
- `tests/e2e/character-tab.spec.js` contains older character-tab expectations and should be updated if its assertions still matter to this surface.

## Key Technical Decisions

- **Drive the real menu stage, not a dead preview path**: camera sliders should call into `LobbyScene` so the user is tuning the live hero they actually see behind the UI.
- **Replace accordions with single-active tabs**: tabs simplify scanning and remove the need to manage multiple open drawers.
- **Replace carousel strips with a grid**: a four-column desktop grid is faster to compare than drag-to-scroll strips for short-to-medium option sets.
- **Keep immediate apply**: the user explicitly rejected a save/reset flow, so layout cleanup should preserve direct selection.
- **Keep preset-based focus as the baseline**: category tabs should still snap to the category preset first, then camera sliders can fine-tune from that live baseline.

## Open Questions

### Resolved During Planning

- **Should the `Live Stage` card remain as contextual copy?** No. The user explicitly wants it removed.
- **Should save/reset return in another form?** No. Selections should remain immediate.
- **Should the camera sliders target the old `CharacterPreviewScene` controls?** No. They need to tune the shared lobby stage.

### Deferred to Implementation

- Exact slider set for the shared stage. Start with the existing tuning vocabulary (`look target`, `camera offset`) and only add more if needed.
- Exact grid breakpoint behavior on narrow widths. Target four columns on desktop, then gracefully reduce on smaller screens.
- Whether the camera tuning UI should be always visible or collapsible once the tabbed layout is in place. A compact inline block is acceptable if it keeps the customizer readable.

## Implementation Units

- [x] **Unit 1: Add shared-stage camera tuning hooks to `LobbyScene`**

**Goal:** Let the character tab tweak the actual lobby preview framing in real time.

**Requirements:** R8, R9, R10

**Dependencies:** None

**Files:**
- Modify: `js/ui/LobbyScene.js`
- Modify: `js/ui/core/AppShell.js`
- Modify: `tests/lobby-assets.test.mjs`

**Approach:**
- Add a small public API on `LobbyScene` for preview camera tweaking on top of the current preset targets.
- Keep preset selection as the baseline, then apply live offset overrides for look/camera position while the user drags sliders.
- Expose that API through the AppShell service bag so the character tab can use it without reaching into private fields.

**Patterns to follow:**
- Existing `setPreviewPreset()` flow in `js/ui/LobbyScene.js`
- Existing shared-service injection pattern in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: setting a category preset still updates the base preset ID.
- Happy path: applying a camera tweak updates the target preview pose on top of the preset.
- Edge case: switching categories keeps preset routing intact while preserving or intentionally resetting tweak state, depending on the chosen UX.

**Verification:**
- Focused source tests pass and the browser shows live camera slider impact on the shared menu stage.

---

- [x] **Unit 2: Replace the character accordion with top tabs and per-tab content**

**Goal:** Make the customizer easier to scan and operate without vertical drawer stacking.

**Requirements:** R2, R3, R5, R6, R7, R10, R11

**Dependencies:** None

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `tests/character-select-preview-focus.test.mjs`
- Modify: `tests/character-select-layout.test.mjs`

**Approach:**
- Replace the current accordion/toggle rendering with a single active tab row.
- Render only the active category’s color controls and items.
- Preserve the existing category IDs and controller mapping so preview focus behavior survives the layout change.
- Keep immediate-apply behavior and remove any leftover copy that implies drafting/saving.

**Patterns to follow:**
- Existing category state in `Page10CharacterSelectController`
- Existing shared-stage layout direction already established in `Page10CharacterSelectView`

**Test scenarios:**
- Happy path: category tabs render and switch the visible content.
- Happy path: category switching still drives the expected preview preset.
- Edge case: inactive character tabs still do not steal preview focus.

**Verification:**
- Focused tests pass and the browser shows tabbed category navigation with only one active section at a time.

---

- [x] **Unit 3: Replace strip-style option browsing with a responsive 4-column grid**

**Goal:** Make option selection denser and easier to compare at a glance.

**Requirements:** R4, R5, R6, R11

**Dependencies:** Unit 2

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `tests/character-select-layout.test.mjs`
- Modify: `tests/e2e/character-tab.spec.js`

**Approach:**
- Remove carousel-only assumptions from the category item renderer.
- Render items in a responsive option grid with a desktop target of four columns.
- Keep item active state and meta text visible without requiring horizontal scrolling.
- Remove now-unused carousel interaction code if it is no longer needed anywhere in this view.

**Patterns to follow:**
- Existing item-card styling and active-state semantics in `Page10CharacterSelectView`

**Test scenarios:**
- Happy path: masks/accessories/shirts/pants items render in the grid.
- Happy path: selecting an item from the grid updates appearance immediately.
- Edge case: narrow layouts reduce the number of columns without breaking item selection.

**Verification:**
- Browser verification shows dense grid layout on desktop and stable responsive behavior on narrower widths.

---

- [x] **Unit 4: Remove leftover stage overlay copy and integrate camera controls into the new layout**

**Goal:** Keep the hero visually clean while still making camera tuning accessible.

**Requirements:** R1, R8, R9, R11

**Dependencies:** Units 1-2

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `tests/character-select-layout.test.mjs`

**Approach:**
- Remove the `Live Stage` card entirely.
- Place camera sliders inside the customizer panel in a compact, intentional block so they support the stage without covering it.
- Reuse the existing slider vocabulary/readout style where possible, but retarget the handlers to shared-stage tuning.

**Patterns to follow:**
- Existing camera-debug slider rendering helpers in `Page10CharacterSelectView`
- Existing controller event plumbing for camera slider changes

**Test scenarios:**
- Happy path: no `Live Stage` card remains in the rendered character view.
- Happy path: camera slider controls are visible and interactive.
- Edge case: camera controls do not create layout overlap with the active option grid.

**Verification:**
- Browser verification shows a clean stage with no overlay copy and functioning inline camera sliders.

---

- [x] **Unit 5: Review, browser verification, and plan closeout**

**Goal:** Confirm the redesigned customizer works end-to-end and document the completed pass.

**Requirements:** R1-R11

**Dependencies:** Units 1-4

**Files:**
- Update plan progress in this document

**Approach:**
- Run focused tests for shared-stage presets/tuning, character tab routing, and layout coverage.
- Browser-check:
  - category tabs render at the top of the customizer
  - no `Live Stage` overlay card remains
  - active category shows a dense option grid
  - camera sliders visibly move the shared lobby framing
  - selections still apply immediately

**Verification:**
- Tests pass, browser verification passes, and this plan is marked completed.

## Completion Notes

- Shared preview tuning now lives in `LobbyScene` and is exposed through `AppShell`, so character-tab sliders tune the real menu stage instead of a removed embedded preview.
- The character customizer now uses top tabs, single-active-category content, and a responsive 4-column option grid on desktop with immediate-apply selection.
- The floating `Live Stage` overlay, empty right panel, and save/reset footer remain removed; camera tuning now sits inside the left customizer panel.
- Verification completed on 2026-04-14 with focused source tests, `git diff --check`, and a live `agent-browser` pass on `http://localhost:3000/#/characters`.
