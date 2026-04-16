---
title: "feat: balaclava option thumbnails in the character customizer"
type: feat
status: completed
date: 2026-04-15
origin: direct user request (2026-04-15), with context from docs/plans/2026-04-14-005-redesign-character-customizer-tabs-grid-and-camera-tuning-plan.md and docs/plans/2026-04-13-004-feat-character-garage-customizer-plan.md
---

# feat: balaclava option thumbnails in the character customizer

## Overview

Replace the text-only balaclava option cards in the character customizer with generated visual thumbnails so mask selection is faster and more expressive. The implementation should generate the thumbnails from the existing character model, cache them for reuse, and feed them into the existing tabbed 4-column customizer grid without breaking immediate-apply behavior.

## Problem Frame

The `Masks` category currently renders each balaclava as a text tile (`Balaclava Pig`, `Balaclava Wolf`, and so on). That works functionally, but it is slow to scan and weak for a cosmetic picker where the player wants quick visual recognition. The repo already has a polished customizer layout, a face-focused stage camera, and a proven offscreen thumbnail rendering pattern in the track editor. What is missing is a small image pipeline for the mask variants themselves.

The goal here is not to build a new authored art pipeline or to redesign the whole character page again. It is to make the existing balaclava picker visual, reliable, and cheap to maintain by generating previews from the assets we already ship.

## Requirements Trace

- R1. The `Masks` category in the character customizer shows a visual thumbnail for each balaclava option instead of a text-only card.
- R2. Thumbnail generation uses the shipped character model and existing balaclava meshes; no manual thumbnail authoring step is required.
- R3. Thumbnail generation is cached so the customizer does not re-render every balaclava on every interaction.
- R4. The selected balaclava still applies immediately when the user clicks a mask option.
- R5. If thumbnail generation fails or is still loading, the mask picker remains usable with a safe text fallback.
- R6. Thumbnail cards remain accessible through `aria-label`s and visible selected-state styling.
- R7. The rest of the character customizer categories (`Palette`, `Accessories`, `Shirts`, `Pants`) keep their current behavior.
- R8. The implementation works in the current non-bundled browser runtime used by the repo.

## Scope Boundaries

- No new manually-authored PNG thumbnail asset set committed to the repo in this pass.
- No redesign of non-mask customizer categories beyond any small shared card styling needed to support image tiles cleanly.
- No changes to the live shared menu stage camera presets.
- No persistence of thumbnail data into `localStorage`; in-memory caching is sufficient for this pass.
- No new server endpoints, build tooling, or external asset pipeline.

## Context & Research

### Relevant Code and Patterns

- `js/CharacterCustomization.js` is the source of truth for `BALACLAVA_OPTIONS` and each balaclava mesh name.
- `js/PlayerAppearance.js` already knows how to apply a selected balaclava to a loaded character root by toggling mask mesh visibility.
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js` builds the category/item view models for the customizer and is the right place to add thumbnail metadata to mask items.
- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js` renders the existing 4-column option grid and is the right place to render image-backed mask cards while preserving current selection events and accessibility semantics.
- `js/ui/CharacterPreviewScene.js` shows the repo’s existing pattern for loading the character GLTF in UI code.
- `js/track-editor/ui/TileThumbnailRenderer.js` provides a proven offscreen Three.js thumbnail-rendering pattern that can be adapted for balaclava previews.
- `tests/character-customization.test.mjs` and `tests/character-asset-config.test.mjs` already pin balaclava mesh naming and asset integrity.
- `tests/character-select-layout.test.mjs` and `tests/character-select-preview-focus.test.mjs` already cover the customizer’s tabbed/grid structure and immediate-apply behavior.

### External Research Decision

Skipped. The repo already has strong local patterns for:
- loading the character GLTF in UI code
- applying balaclava selection to a model
- rendering offscreen image thumbnails with Three.js

That is enough to plan and implement this safely without external documentation.

## Key Technical Decisions

- **Generate thumbnails at runtime from the shipped character model**: this keeps the balaclava catalog self-maintaining. Adding a new balaclava option should not require hand-authoring a new image file.
- **Use a dedicated thumbnail service with in-memory caching**: a small balaclava thumbnail module can own model loading, per-option rendering, and promise/data URL caching so the controller/view stay simple.
- **Render head-only or mask-focused previews, not full-body cards**: the thumbnail should emphasize the mask silhouette and face detail rather than a full seated character composition.
- **Keep text as fallback and accessibility support, not the primary visual**: the mask picker should become image-first, but still expose names through `aria-label`s and safe fallback copy if thumbnails are unavailable.
- **Do not push thumbnail rendering into the shared menu stage**: the live stage is for the hero preview. Mask thumbnails should be generated offscreen so they do not disturb menu camera state or UI performance.

## Open Questions

### Resolved During Planning

- **Should this use committed static image assets?** No. The easiest maintainable path is generation from the existing model.
- **Should non-mask categories also get thumbnails in this pass?** No. The request is specifically about balaclavas/masks.
- **Should the generated thumbnails be persisted across sessions?** No. In-memory caching is enough for this pass.

### Deferred to Implementation

- Exact visual treatment for labels beneath mask thumbnails. The picker should be image-first; a compact caption is acceptable if it improves recognition without reverting to text-only cards.
- Exact thumbnail framing values. Start with a mask/head-focused composition and tune only if the first render is too zoomed-out or inconsistent across variants.

## Implementation Units

- [x] **Unit 1: Add a reusable balaclava thumbnail generation service**

**Goal:** Generate and cache image previews for every balaclava option from the existing character asset.

**Requirements:** R1, R2, R3, R5, R8

**Dependencies:** None

**Files:**
- Create: `js/ui/character/BalaclavaThumbnailRenderer.js`
- Modify: `js/CharacterCustomization.js`
- Modify: `tests/character-asset-config.test.mjs`

**Approach:**
- Create a small offscreen Three.js renderer dedicated to balaclava thumbnails.
- Load `models/${ CHARACTER_MODEL_PATH }` once, clone the character root per render, and use the existing balaclava-selection helper to show only the target mask.
- Frame the render tightly around the mask/head area with stable lighting and transparent background.
- Cache in-flight and completed thumbnail results by balaclava ID so repeated customizer opens reuse work instead of rerendering everything.

**Patterns to follow:**
- `js/track-editor/ui/TileThumbnailRenderer.js`
- `js/ui/CharacterPreviewScene.js`
- `js/CharacterCustomization.js` mesh-name helpers

**Test scenarios:**
- Happy path: requesting thumbnails for known balaclava IDs resolves to image data URLs (or cached equivalents).
- Happy path: repeated requests for the same balaclava reuse cached work instead of creating duplicate renders.
- Edge case: unknown balaclava IDs fall back safely instead of throwing.
- Edge case: missing mesh names or GLTF load failures resolve to a usable fallback state rather than breaking the customizer.

**Verification:**
- Focused tests pass and a small script/manual check confirms generated previews exist for representative options like `balaclava-basic`, `balaclava-pig`, and `balaclava-robot`.

---

- [x] **Unit 2: Feed thumbnail metadata into the mask-category view model**

**Goal:** Make the character customizer controller expose thumbnail state for balaclava items while leaving other categories unchanged.

**Requirements:** R1, R3, R4, R5, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `tests/character-select-preview-focus.test.mjs`

**Approach:**
- Extend the mask item view model to include thumbnail fields such as `thumbnailSrc`, `thumbnailState`, or equivalent metadata.
- Trigger thumbnail loading for balaclava items when the controller initializes or when the masks category is first needed.
- Keep immediate-apply selection flow untouched so clicking a mask option still updates appearance immediately.
- Preserve non-mask categories as text/meta tiles unless their data model already tolerates the new optional thumbnail field.

**Patterns to follow:**
- Existing category/item mapping in `Page10CharacterSelectController`
- Existing immediate-apply flow used by `_handleItemActivate()`

**Test scenarios:**
- Happy path: mask category items expose thumbnail metadata while other categories remain stable.
- Happy path: selecting a mask still persists immediately.
- Edge case: thumbnail failures do not block mask selection or focus routing.

**Verification:**
- Controller-focused tests pass and the browser shows mask options rendering without regressions to selection behavior.

---

- [x] **Unit 3: Render thumbnail-first balaclava option cards in the customizer grid**

**Goal:** Turn the mask picker from text-only cards into image-backed selectable tiles.

**Requirements:** R1, R5, R6, R7

**Dependencies:** Unit 2

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Modify: `tests/character-select-layout.test.mjs`
- Modify: `tests/e2e/character-tab.spec.js`

**Approach:**
- Add optional thumbnail markup to the existing item-grid renderer so mask items can show an image region, loading/fallback state, and active styling.
- Keep `aria-label`s based on the balaclava name and current selected/available state.
- Style mask cards so the image is the primary affordance and the fallback text does not dominate the card.
- Avoid regressing the existing responsive 4-column layout.

**Patterns to follow:**
- Existing item-card grid rendering in `Page10CharacterSelectView`
- Existing selected-state and accessibility semantics on option buttons

**Test scenarios:**
- Happy path: the masks grid renders image-backed cards when thumbnail data is available.
- Happy path: selected styling remains obvious on image cards.
- Edge case: loading/fallback state still renders a usable option button if the image is not ready.
- Edge case: layout still reduces cleanly on narrower widths.

**Verification:**
- Browser verification shows thumbnails on the masks tab and no regressions to tab switching or selection.

---

- [x] **Unit 4: Review, browser verification, and plan closeout**

**Goal:** Validate the new thumbnail picker end-to-end and record the completed pass.

**Requirements:** R1-R8

**Dependencies:** Units 1-3

**Files:**
- Modify: `docs/plans/2026-04-15-001-feat-balaclava-option-thumbnails-plan.md`

**Approach:**
- Run focused tests for the new thumbnail service and the affected character customizer units.
- Run a browser pass on the character tab with the mask picker visible.
- Mark implementation units complete and note any follow-up polish opportunities discovered during verification.

**Test scenarios:**
- Happy path: the character tab loads, the masks category shows thumbnails, and selection still updates the shared stage.
- Edge case: a hard refresh or first-load visit still eventually renders the thumbnail cards without leaving the picker blank.

**Verification:**
- Focused automated tests pass, browser verification passes, and this plan is updated to `status: completed` once the work is done.

## Dependencies & Sequence

1. Build the thumbnail service first so the UI work has real image data to consume.
2. Extend the controller’s mask item model to expose thumbnail state.
3. Update the view to render image-backed cards without regressing the existing grid.
4. Run review, browser verification, and plan closeout.

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Offscreen thumbnail generation is too slow on first load | The masks tab feels blank or laggy | Cache in-flight results, lazy-load only when needed, and keep text fallback visible until an image is ready |
| Character GLTF complexity makes thumbnails inconsistent across masks | Thumbnails feel noisy or clipped | Use stable camera/light settings and tune around the head/mask region instead of fitting the full character each time |
| Rendering logic leaks WebGL resources | Repeated customizer visits degrade performance | Centralize renderer ownership in one service and expose a clear cleanup path if needed |
| Thumbnail generation fails in some browser/device cases | Mask picker becomes unusable | Preserve text fallback and selection behavior independent of thumbnail success |

## Verification Strategy

- Automated:
  - `tests/character-asset-config.test.mjs`
  - `tests/character-select-preview-focus.test.mjs`
  - `tests/character-select-layout.test.mjs`
  - `tests/e2e/character-tab.spec.js`
  - new focused unit test for the balaclava thumbnail service
- Manual:
  - Open the character tab locally
  - Switch to `Masks`
  - Confirm image-backed cards appear
  - Confirm clicking a thumbnail applies the correct balaclava immediately
  - Confirm refresh/reopen still yields usable mask cards even if thumbnails regenerate
