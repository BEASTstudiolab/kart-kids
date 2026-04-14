---
title: "feat: contextual menu preview camera presets"
type: feat
status: completed
date: 2026-04-14
origin: direct user request (2026-04-14)
---

# feat: contextual menu preview camera presets

## Overview

Turn the shared menu `LobbyScene` into a context-aware preview camera system. The menu should use the newly supplied base framing as its default look, then shift camera position, look target, and kart rotation for specific menu tasks such as editing balaclavas in the character tab or tuning kart paint in the garage tab.

## Problem Frame

The current menu scene is a single static framing reused across PLAY, CHARACTER, GARAGE, and PROFILE. That is good for a default hero shot, but it is not good enough for actual customization work. When the user is editing a balaclava, they need a close facial framing. When they are adjusting kart paint, they need the camera to settle on the kart body instead of the full character pose. Right now those flows reuse the same scene without any notion of preview focus.

## Requirements Trace

- R1. The live shared menu `LobbyScene` adopts the new default base settings provided by the user:
  - `KART_POS = new THREE.Vector3( 0.00, 0.40, 1.50 );`
  - `KART_SCALE = 1.15;`
  - `KART_ROT_Y_DEG = 1436;`
  - `kart-1` default seat offset resolves to `{ x: -0.22, y: -0.06, z: -0.07 }`
  - `CAM_POS = new THREE.Vector3( 0.00, 2.30, 5.70 );`
  - `LOOK_AT = new THREE.Vector3( 0.00, 0.00, 0.40 );`
  - `CAM_FOV = 70;`
  - current fog, ambient, dir light, rim light, bloom, and emissive defaults remain as the new baseline
- R2. `LobbyScene` supports named preview camera presets rather than a single hardcoded framing.
- R3. The active tab can request different preview focus presets without rebuilding the scene.
- R4. The character tab uses a face-focused preset while editing masks/balaclavas.
- R5. The character tab uses a broader character-focused preset for palette/body customization.
- R6. The garage tab uses a kart/body-focused preset while interacting with kart paint controls.
- R7. The PLAY/default menu state returns to the user’s supplied base preset.
- R8. Preset changes transition smoothly enough to feel intentional rather than jumping harshly.
- R9. Existing rider animation, appearance syncing, and selected-kart updates remain intact.

## Scope Boundaries

- No new separate preview scene for the character tab or garage tab.
- No changes to the race camera system.
- No changes to the party lobby scene unless implementation reveals a shared helper worth extracting.
- No redesign of character-tab or garage-tab layouts beyond wiring preview-focus changes.
- No authored cinematic transitions; lightweight interpolation inside `LobbyScene` is sufficient.

## Context & Research

### Relevant Code and Patterns

- `js/ui/LobbyScene.js` is the live shared menu preview scene used behind the tabbed shell. It is the correct place for menu preview presets.
- `js/ui/core/AppShell.js` owns the singleton `LobbyScene` and passes services into the active panels/controllers. It is the right place to expose a shared preview-focus API.
- `js/ui/panels/CharacterPanel.js` hosts `Page10CharacterSelectController` inside the tabbed shell.
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js` already knows the currently open category (`palette`, `masks`, `accessories`, `shirts`, `pants`) and updates live draft appearance, making it the natural place to request focus changes such as “zoom to balaclava.”
- `js/ui/panels/GaragePanel.js` already knows when `vehicleColor` controls are active and when the garage tab shows/hides, making it the natural place to request kart-body preview framing.
- `tests/lobby-assets.test.mjs` already pins `LobbyScene` source-level defaults and behavior, so it should be extended for the new baseline constants and preset support.

## Key Technical Decisions

- **Keep one menu scene, add preset state**: `LobbyScene` should own a small preset system (default/play, character-face, character-body, kart-paint) instead of spawning multiple scenes.
- **Expose preview focus through AppShell services**: add a service such as `setMenuPreviewFocus(presetId)` so tabs/controllers can request focus changes without directly mutating `LobbyScene` internals.
- **Use controller state, not DOM heuristics**: the character controller already knows when `masks` is open; the garage panel already knows when paint controls are active. That is more reliable than trying to infer intent from focus or CSS selectors.
- **Transition camera values instead of snapping**: interpolate camera position, look target, FOV, and kart rotation over time so changing tabs/categories feels polished and readable.
- **Treat the user-provided numbers as the new source of truth baseline**: preset offsets should layer on top of those new defaults, not replace them with unrelated historical values.

## Open Questions

### Resolved During Planning

- **Should this use different preview scenes for each tab?** No. The shared menu scene should stay authoritative.
- **Should tab-specific framing be hard-switched in AppShell only?** No. AppShell should expose the API, but each tab/controller should choose the right preset based on user intent.
- **Should the new user-provided camera/kart numbers replace the old defaults immediately?** Yes. They are the new baseline for the menu preview.

### Deferred to Implementation

- Exact per-preset numeric framing for face and kart paint. Implementation should start from the new baseline and tune to a good visual result in-browser.
- Whether color scrubbing should temporarily force a kart-paint preset only while the input is active, or throughout the whole garage tab. A simple always-on garage preset is acceptable if it reads well; otherwise make the paint row opt-in.

## Implementation Units

- [x] **Unit 1: Rebase LobbyScene on the new default menu framing and add preset state**

**Goal:** Replace the hardcoded menu scene defaults with the new baseline values and teach `LobbyScene` about named preview presets.

**Requirements:** R1, R2, R7, R8, R9

**Dependencies:** None

**Files:**
- Modify: `js/ui/LobbyScene.js`
- Modify: `tests/lobby-assets.test.mjs`

**Approach:**
- Update the base constants in `LobbyScene` to the supplied default camera, kart, and lighting values.
- Introduce a small preset configuration model covering at least:
  - `default` / `play`
  - `character-face`
  - `character-body`
  - `garage-kart`
- Track current vs target camera pose and kart rotation inside the scene.
- Interpolate toward the target preset in `update(dt)` while preserving the rider animation mixer update.

**Patterns to follow:**
- Existing `LobbyScene` constant-driven tuning approach
- Existing `CharacterPreviewScene` camera framing mindset for face/body readability

**Test scenarios:**
- Happy path: source constants reflect the new user-provided baseline values.
- Happy path: `LobbyScene` exposes named preset support in source.
- Happy path: the rider animation still updates while preset interpolation is active.
- Edge case: the scene can return to the default preset after a specialized focus preset.

**Verification:**
- Focused tests pass and browser verification shows the new default PLAY framing.

---

- [x] **Unit 2: Expose preview-focus control through AppShell services**

**Goal:** Give tabs and controllers a stable way to request menu preview focus changes.

**Requirements:** R3, R7, R8

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: related app-shell tests if needed

**Approach:**
- Add a service like `setMenuPreviewFocus(presetId)` that delegates into `LobbyScene`.
- Ensure `switchTab()` restores the expected baseline presets:
  - `PLAY` => default/play
  - `CHARACTER` => character-body unless the controller requests face focus
  - `GARAGE` => garage-kart or default based on the chosen implementation
  - other menu tabs => default unless a specific need emerges

**Patterns to follow:**
- Existing AppShell service-bag ownership
- Existing tab-switch render-mode syncing in `switchTab()`

**Test scenarios:**
- Happy path: switching tabs routes the shared menu scene to the expected preset.
- Edge case: calling the service before `LobbyScene` is initialized does not throw.

**Verification:**
- AppShell-level tests pass and manual tab switching reflects preset changes.

---

- [x] **Unit 3: Character tab requests face/body preview focus from category state**

**Goal:** Make mask editing zoom to the balaclava/head area and broader body edits use a more appropriate character framing.

**Requirements:** R4, R5, R8, R9

**Dependencies:** Units 1-2

**Files:**
- Modify: `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- Modify: `js/ui/panels/CharacterPanel.js` if needed for show/hide reset
- Add/modify tests covering controller focus requests if practical

**Approach:**
- When the open category is `masks`, request `character-face`.
- When the category is `palette`, `accessories`, `shirts`, or `pants`, request `character-body`.
- Restore the default or tab-level fallback when the controller becomes inactive/disposes.

**Patterns to follow:**
- Existing `_handleCategoryOpen()` / `_syncView()` flow in `Page10CharacterSelectController.js`
- Existing `setActive()` lifecycle in `CharacterPanel`

**Test scenarios:**
- Happy path: opening `masks` requests face focus.
- Happy path: opening `palette` requests a broader character framing.
- Edge case: hiding the character tab releases the scene back to the non-character preset.

**Verification:**
- Browser verification shows the head filling more of the frame while mask editing.

---

- [x] **Unit 4: Garage tab requests kart-focused preview framing for paint editing**

**Goal:** Make the garage tab show the kart body more clearly during paint customization and keep the preview aligned with the selected kart.

**Requirements:** R6, R8, R9

**Dependencies:** Units 1-2

**Files:**
- Modify: `js/ui/panels/GaragePanel.js`
- Add/modify tests if practical

**Approach:**
- Request `garage-kart` when the garage tab shows.
- If needed after browser verification, strengthen that request specifically on kart-paint input interaction so the camera settles on the body while color is being adjusted.
- Preserve the existing selected-kart syncing and appearance updates.

**Patterns to follow:**
- Existing `show()` / `hide()` lifecycle in `GaragePanel`
- Existing `vehicleColor` settings updates and `lobbyScene.setKart()` calls

**Test scenarios:**
- Happy path: showing the garage tab requests the kart-focused preset.
- Happy path: changing kart paint keeps the preview on the kart-focused framing.
- Edge case: leaving the garage tab restores the default or next-tab preset.

**Verification:**
- Browser verification shows the kart body framed more prominently during garage paint work.

---

- [x] **Unit 5: Review, browser verification, and plan closeout**

**Goal:** Confirm the new baseline plus contextual focus behavior behaves well in the real menu.

**Requirements:** R1-R9

**Dependencies:** Units 1-4

**Files:**
- Update plan progress in this document
- Modify tests touched above as needed

**Approach:**
- Run focused automated tests.
- Run browser verification on the live menu:
  - PLAY default framing
  - CHARACTER mask focus
  - CHARACTER palette/body focus
  - GARAGE kart paint focus
- Check for console/page errors.

**Patterns to follow:**
- Existing local browser verification workflow used for recent menu scene changes

**Test scenarios:**
- Happy path: each tab/context lands on the intended preset.
- Edge case: preset changes do not stop rider animation or break selected-kart sync.

**Verification:**
- Tests pass, browser verification passes, and this plan is marked completed.
