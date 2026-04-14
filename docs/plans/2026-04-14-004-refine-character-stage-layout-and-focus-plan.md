---
title: "feat: refine character tab stage layout and category camera focus"
type: feat
status: completed
date: 2026-04-14
origin: direct user request (2026-04-14)
---

# feat: refine character tab stage layout and category camera focus

## Overview

Refine the shared menu-preview system so the character tab uses the lobby rider as the primary stage instead of an embedded preview card. Extend category-specific camera presets beyond masks so accessories, shirts, and pants also steer the shared `LobbyScene` to a more useful framing.

## Problem Frame

The first pass added shared menu preview presets and removed the menu orbit, but the tabbed character page still renders a central “Live Preview” card that duplicates the shared lobby rider and visually competes with it. That makes the tab feel crowded and undermines the new contextual camera work. On top of that, only `Masks` currently gets special framing; `Accessories`, `Shirts`, and `Pants` still fall back to the generic body preset even though those tasks benefit from tighter, more specific staging.

## Requirements Trace

- R1. The tabbed character page no longer renders the embedded `HeroPreviewPanel` live preview card.
- R2. The tabbed character page layout is rebalanced so the shared lobby rider remains the focal point in the open stage area.
- R3. Overlay/standalone character flows keep their embedded preview behavior unless explicitly changed.
- R4. The character tab still exposes the existing category drawers, save/reset flow, and summary/status information after the layout change.
- R5. `Masks` continues to drive a face-focused preset.
- R6. `Accessories` gets an upper-body/accessory-focused preset.
- R7. `Shirts` gets a torso-focused preset.
- R8. `Pants` gets a lower-body-focused preset.
- R9. `Palette` continues to use a broader character/body framing.
- R10. Switching away from the character tab still releases preview control cleanly.

## Scope Boundaries

- No redesign of the garage tab in this pass.
- No changes to the race, profile, or party lobby scenes beyond shared preset additions in `LobbyScene`.
- No new authored assets, animations, or route changes.
- No changes to the legacy routed character page beyond preserving its current preview behavior.

## Context & Research

### Relevant Code and Patterns

- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js` supports host-mode-specific configuration and currently builds the embedded preview card unconditionally.
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js` already maps open categories to shared menu preview presets and can be extended with more granular category routing.
- `js/ui/panels/CharacterPanel.js` hosts the character controller in tab mode, so the tab mode can safely diverge from overlay mode without affecting the legacy route.
- `js/ui/LobbyScene.js` already owns named menu preview presets and smooth transitions from the prior feature pass.
- `tests/character-select-preview-focus.test.mjs` already covers the preset-routing contract at the controller level and is the right place to pin the added categories.
- `tests/lobby-assets.test.mjs` already provides source-level regression checks for `LobbyScene`.

## Key Technical Decisions

- **Keep the tab/overlay split explicit**: use configuration on `Page10CharacterSelectView` so tab mode can drop the embedded preview while overlay mode keeps it.
- **Use a stage layout, not a replacement inline preview**: the open middle of the character tab should intentionally reveal the shared lobby rider instead of rendering another canvas.
- **Map categories to intent-specific presets**: masks => face, accessories => upper-body, shirts => torso, pants => lower-body, palette => general body.
- **Preserve save/state information while compressing visual clutter**: the right-hand status rail can remain, but the central preview card should go away in tab mode.

## Open Questions

### Resolved During Planning

- **Should we remove the embedded preview everywhere?** No. Only tab mode should change in this pass.
- **Should accessories/shirts/pants reuse the generic body preset?** No. The user explicitly asked for category-specific focus beyond masks.

### Deferred to Implementation

- Exact numeric preset tuning for accessories/shirts/pants. Start from the current character-body preset and refine in-browser until each category reads clearly.
- Whether the right-side details rail should be visually slimmed further after the preview card removal. A light pass is fine if needed to keep the stage open.

## Implementation Units

- [x] **Unit 1: Add character-category presets to LobbyScene**

**Goal:** Extend the shared menu preview system with explicit presets for accessories, shirts, and pants.

**Requirements:** R5, R6, R7, R8, R9, R10

**Dependencies:** None

**Files:**
- Modify: `js/ui/LobbyScene.js`
- Modify: `tests/lobby-assets.test.mjs`

**Approach:**
- Add new preset IDs and target values for:
  - `character-accessories`
  - `character-shirt`
  - `character-pants`
- Preserve the existing `play`, `character-body`, `character-face`, and `garage-kart` presets.
- Keep the same interpolation and shared preview flow from the previous pass.

**Patterns to follow:**
- Existing preset definitions and interpolation logic in `js/ui/LobbyScene.js`

**Test scenarios:**
- Happy path: the new preset IDs are defined in source.
- Happy path: the shared scene can still switch among the character presets without breaking default/play behavior.

**Verification:**
- Focused tests pass and browser verification shows distinct framing changes for the new categories.

---

- [x] **Unit 2: Route character categories to the new presets**

**Goal:** Make the character controller choose better lobby framing for each category.

**Requirements:** R5, R6, R7, R8, R9, R10

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `tests/character-select-preview-focus.test.mjs`

**Approach:**
- Extend `_getMenuPreviewFocusPreset()` so:
  - `masks` => `character-face`
  - `accessories` => `character-accessories`
  - `shirts` => `character-shirt`
  - `pants` => `character-pants`
  - `palette` => `character-body`
- Preserve the active-tab guard from the current implementation.

**Patterns to follow:**
- Existing category-to-preset mapping in `Page10CharacterSelectController`

**Test scenarios:**
- Happy path: each category resolves to the expected preset.
- Edge case: inactive character tabs still do not steal preview focus.

**Verification:**
- Controller tests pass and the browser shows the correct preset ID for each category.

---

- [x] **Unit 3: Remove the tab-mode embedded preview and rebalance the layout**

**Goal:** Make the shared lobby rider the star of the character tab by removing the duplicate live preview panel in tab mode.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`

**Approach:**
- Add a tab-mode config flag so the embedded preview card is omitted only in tab mode.
- Update the tab-mode layout/CSS so the left customizer panel and right status rail frame an open center stage.
- Update copy/selection rendering so it no longer assumes the embedded preview card exists in tab mode.
- Avoid creating `CharacterPreviewScene` when no embedded preview panel is rendered.

**Patterns to follow:**
- Existing host-mode configuration in the character controller/view
- Existing optional chaining around preview panel interactions

**Test scenarios:**
- Happy path: tab mode renders without the embedded preview panel.
- Happy path: overlay mode still renders the embedded preview panel.
- Edge case: tab mode still renders/save-updates summary and status information without errors.

**Verification:**
- Browser verification shows the lobby rider unobstructed in the middle of the character tab.

---

- [x] **Unit 4: Review, browser verification, and plan closeout**

**Goal:** Confirm the refined character-stage layout and new category presets work together cleanly.

**Requirements:** R1-R10

**Dependencies:** Units 1-3

**Files:**
- Update plan progress in this document

**Approach:**
- Run focused tests for lobby presets, controller routing, and any layout coverage added.
- Browser-check:
  - CHARACTER palette => body preset
  - CHARACTER masks => face preset
  - CHARACTER accessories => accessories preset
  - CHARACTER shirts => shirt preset
  - CHARACTER pants => pants preset
  - tab layout without embedded live preview card

**Verification:**
- Tests pass, browser verification passes, and this plan is marked completed.

## Outcome

- Added explicit shared-stage presets for `character-accessories`, `character-shirt`, and `character-pants` in `LobbyScene`.
- Routed tabbed character categories to those presets while keeping the inactive-tab guard intact.
- Removed the duplicate embedded preview card in tab mode, replaced it with a lightweight live-stage hint, and updated copy so the shared lobby rider is the focal point.
- Preserved overlay-mode embedded preview behavior.

## Verification Notes

- `node --test tests/app-shell-menu-music.test.mjs tests/app-shell-menu-music-widget.test.mjs tests/menu-music-player.test.mjs tests/lobby-assets.test.mjs tests/character-select-preview-focus.test.mjs tests/character-select-layout.test.mjs`
- `git diff --check`
- Browser verification via `agent-browser` on `http://localhost:3000`
- Confirmed the character tab no longer renders the embedded preview panel in tab mode.
- Confirmed the shared lobby stage preset IDs switch as expected:
  - `palette` => `character-body`
  - `masks` => `character-face`
  - `accessories` => `character-accessories`
  - `shirts` => `character-shirt`
  - `pants` => `character-pants`
- Captured a verification screenshot at `/tmp/character-tab-shared-stage.png`
- Todo sweep: no files were present in `.context/compound-engineering/todos/` or `todos/`
