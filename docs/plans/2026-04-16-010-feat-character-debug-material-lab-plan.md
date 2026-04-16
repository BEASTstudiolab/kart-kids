---
title: Character Debug Material Lab
status: active
created: 2026-04-16
owner: Codex
tags:
  - debug
  - ui
  - character
  - materials
---

# Character Debug Material Lab

## Problem Frame

The current lobby debug surface only exposes a narrow balaclava-focused fidelity control. That is useful for initial normal-map tuning, but it is too limiting for dialing in the full rider presentation. We need a broader character material tuning surface that lets the team inspect and tweak all relevant rider materials live, then export those values in a copyable format for later implementation.

## Requirements Trace

- Expand the lobby `CHARACTER` debug tab beyond the balaclava-only controls.
- Expose as many practical character material parameters as possible, especially fidelity-related texture and shading controls.
- Keep the controls stable across appearance refreshes, mask swaps, and other menu changes.
- Add a copy/export action so the user can hand tuned values back for implementation.
- Preserve the existing menu-shell debug entry and current lobby debug flow.

## Scope Boundaries

### In Scope

- Lobby/menu character preview debug UI in `js/ui/LobbyScene.js`
- Runtime application of character material overrides to the seated rider preview
- Export/copy formatting for tuned character material values
- Contract tests covering the new debug hooks

### Out of Scope

- Persisting debug values into user settings
- Applying these debug overrides during live races
- Authoring new textures or changing source art assets
- Reworking the full debug panel visual design beyond what is needed for the new controls

## Research Summary

- `js/ui/LobbyScene.js` already owns the menu-facing lobby debug panel and re-applies player appearance each time the rider preview changes.
- `js/PlayerAppearance.js` can replace materials with fresh clones during appearance updates, so debug tuning must be stored as durable state and reapplied after each `_applyAppearance()` call.
- `models/characters/Kart_Beast_Rest-Armature.gltf` contains a compact set of named rider materials, including `Masks Batch`, `Nylon Black.002`, `Washed_Denim.002`, `Business.002`, `Test Skin`, `Eyes.001`, and others. This makes a material-name keyed override map viable.
- Existing lobby texture debug patterns in `LobbyScene` already provide reusable slider/toggle construction patterns and clipboard copy behavior we can extend.

## Design Thesis

- Visual thesis: keep the current raw debug-tool feel, but make the character tab read like a serious material lab rather than a one-off mask tweak panel.
- Content plan: overview/export controls first, then one block per rider material with grouped fidelity, shading, map-toggle, and surface controls.
- Interaction plan: long-scroll inspector with fast copy/reset actions; no extra chrome beyond lightweight material headers and grouped control sections.

## Technical Decisions

1. Use a material-name keyed debug state map instead of one-off balaclava state.
   - Rationale: it survives cloned material replacement and scales naturally to every rider material.

2. Snapshot original live material values the first time each material name is encountered.
   - Rationale: reset/export behavior should reflect the actual authored defaults, not hard-coded guesses.

3. Generate the `CHARACTER` tab from the available live character materials instead of maintaining a hand-authored list.
   - Rationale: this keeps the tool resilient if rider materials change and exposes "more the better" controls without repeated manual wiring.

4. Export the tuned values as structured JSON-like text grouped by material name.
   - Rationale: the user wants something easy to paste back into a follow-up implementation request.

## Implementation Units

### Unit 1: Generalize Character Material Debug State

- Goal: replace the balaclava-only material override state with a richer, reusable per-material state model.
- Files:
  - `js/ui/LobbyScene.js`
- Approach:
  - Introduce a material state snapshot format that stores adjustable scalar, color, boolean, and texture-fidelity values per material name.
  - Capture baseline/original material values from the current live material the first time it is seen.
  - Keep override application centralized so `_applyAppearance()` and any refresh path reapply the same tuned state.
- Patterns to follow:
  - `js/ui/LobbyScene.js` existing `_applyCharacterMaterialDebugOverrides()`
  - `js/ui/LobbyScene.js` shared debug helper builders in `_createDebugPanel()`
- Verification:
  - `node --check js/ui/LobbyScene.js`

### Unit 2: Build a Full Character Material Inspector UI

- Goal: expose a wider tuning surface for every live rider material in the `CHARACTER` tab.
- Files:
  - `js/ui/LobbyScene.js`
- Approach:
  - Replace the single balaclava block with a dynamic inspector that iterates all character materials.
  - For each material, expose applicable controls such as texture fidelity, map toggles, normal strength, AO intensity, roughness, metalness, env-map intensity, opacity, double-sided, wireframe, and color/emissive channels where supported.
  - Add reset actions at both per-material and whole-character levels where practical.
- Patterns to follow:
  - `js/ui/LobbyScene.js` `TEXTURES` tab section layout and copy button behavior
  - `js/ui/LobbyScene.js` `addSlider`, `addToggle`, and action button helpers
- Test scenarios:
  - When the current rider has multiple materials, each material renders a dedicated control block in the `CHARACTER` tab.
  - Material controls remain available after changing appearance, since the inspector reuses stored state instead of stale material references.
  - The tab still works when a material has no normal map or no base map; controls should degrade gracefully instead of erroring.
- Verification:
  - `node --check js/ui/LobbyScene.js`

### Unit 3: Add Export/Copy Support for Character Tuning

- Goal: let the user copy the current material tuning payload for follow-up implementation.
- Files:
  - `js/ui/LobbyScene.js`
- Approach:
  - Add a prominent copy/export action in the `CHARACTER` tab.
  - Serialize the current character debug state into a readable, grouped payload keyed by material name and parameter.
  - Keep the output stable and human-scannable so the user can paste it back into chat.
- Patterns to follow:
  - `js/ui/LobbyScene.js` existing scene/texture clipboard helpers
- Test scenarios:
  - Export output includes all tuned materials, not just the balaclava.
  - Export output includes fidelity-related fields and core surface controls.
- Verification:
  - Contract test assertions for the copy button/export strings

### Unit 4: Extend Contract Coverage

- Goal: lock in the new character debug lab structure with focused tests.
- Files:
  - `tests/lobby-assets.test.mjs`
- Approach:
  - Expand the existing lobby debug assertions to cover the generalized character inspector, export controls, and material lab hooks.
  - Keep tests lightweight and structural, matching the existing style in this suite.
- Patterns to follow:
  - `tests/lobby-assets.test.mjs`
- Verification:
  - `node --test tests/lobby-assets.test.mjs`

## Dependencies and Sequence

1. Generalize the character debug state model first.
2. Build the dynamic material inspector on top of that state.
3. Add export/reset affordances once the inspector shape is stable.
4. Extend contract tests after the final UI/API surface is settled.

## Risks and Mitigations

- Risk: appearance refreshes replace materials and silently drop tuned state.
  - Mitigation: always reapply state after `_applyAppearance()` and collect materials by name instead of holding direct references.

- Risk: the inspector becomes too noisy to use.
  - Mitigation: keep controls grouped by material and by section, and add clear copy/reset affordances so the density still feels purposeful.

- Risk: materials without certain maps produce broken toggles.
  - Mitigation: guard control generation and override application based on live material capabilities.

## Verification Plan

- `node --check js/ui/LobbyScene.js`
- `node --test tests/lobby-assets.test.mjs`
- Browser verification in the running app:
  - open the top-right `DEBUG` button
  - switch to `CHARACTER`
  - confirm multiple rider material sections render
  - confirm the export button copies a material payload

