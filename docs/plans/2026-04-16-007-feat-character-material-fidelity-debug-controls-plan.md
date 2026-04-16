---
title: "feat: Add Character Material Fidelity Controls To Menu Debug"
type: feature
status: active
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-16-003-refactor-unify-character-and-garage-customizer-layouts-plan.md
  - docs/plans/2026-04-16-004-refactor-design-system-tokenize-core-ui-and-reduce-inline-css-plan.md
---

# feat: Add Character Material Fidelity Controls To Menu Debug

## Overview

Expose live character material fidelity controls in the menu debug tooling so the user can tune balaclava texture sharpness and normal response while previewing the current pilot.

The key request is to make it possible to increase perceived fidelity on character surfaces, especially the balaclava, without hard-coding blind guesses into the material setup.

## Problem Frame

The codebase already has two relevant pieces:

- `js/ui/LobbyScene.js` includes a rich menu debug panel with scene and texture controls for lobby materials
- `js/PlayerAppearance.js` reapplies character appearance by cloning original materials when tint or balaclava selection changes

The gap is that character materials are not currently surfaced in the debug panel, and any one-off material changes applied only to current clones would be lost the next time appearance is reapplied.

So the right solution is not “add a random slider somewhere.” It is:

1. add character-material controls to the menu debug panel where the user is already tuning look-dev
2. apply those overrides to the character material source/originals as well as the current live material so they survive appearance refreshes

## Requirements Trace

- R1: The debug tooling should expose live character material controls in the menu preview
- R2: The balaclava material should support a fidelity-focused texture control, such as anisotropy, that can make it read sharper
- R3: The balaclava material should support live normal tuning in debug
- R4: Changes should remain applied when appearance is refreshed or the balaclava selection changes in the same session
- R5: Existing character appearance/tint behavior must keep working
- R6: The solution should be scoped to debug tooling and not clutter the player-facing customization UI

## Scope Boundaries

- In scope:
  - `js/ui/LobbyScene.js`
  - optional tiny helper additions if needed inside `js/PlayerAppearance.js`
  - a focused test that locks in the new character debug surface contract
- Out of scope:
  - redesigning the public customizer UI for end users
  - persisting debug values as shipping settings unless clearly needed
  - changing race runtime debug menus

## Assumptions

- The menu/lobby preview is the right place to tune character look-dev because that is where the current pilot is displayed continuously
- Session-local debug overrides are sufficient for now; copyable values are more important than persistence
- “Higher fidelity” in this context maps best to texture anisotropy plus normal tuning, especially on the balaclava material

## Local Research Summary

### Existing debug seam

- `js/ui/LobbyScene.js` already builds a custom debug panel with `SCENE` and `TEXTURES` tabs
- The `TEXTURES` tab already exposes normal, AO, roughness, metalness, base-map, opacity, and env-map controls for lobby materials

### Existing character appearance seam

- `js/PlayerAppearance.js` stores original materials on each mesh using `_kkOriginalMaterial`
- Appearance reapplication clones from the original material when a tint is active
- That means debug tweaks must touch the original material source and current live material state if they need to survive reapplication

### Character material target

- The character GLTF exposes a balaclava material named `Masks Batch`
- That material already has a base-color texture and normal map, making it a strong candidate for anisotropy and normal-strength tuning

## External Research Decision

No external research is needed.

This is a local rendering/debugging workflow improvement using existing three.js patterns already present in the project.

## Key Technical Decisions

- **Extend `LobbyScene` debug tooling** rather than adding a separate debug surface elsewhere.
- **Treat balaclava fidelity as a material override profile** instead of mutating ad hoc mesh instances.
- **Use anisotropy as the main “texture fidelity” control** because it meaningfully improves texture clarity on angled surfaces and matches the user’s goal.
- **Store debug override state in `LobbyScene`** and reapply it whenever the character bundle or appearance is refreshed.
- **Keep the first implementation targeted to character materials, with balaclava first**, rather than overgeneralizing across all preview materials immediately.

## Open Questions

### Resolved During Planning

- The debug control belongs in the menu preview tooling, not the shipping customizer UI
- The override must survive appearance refreshes, so it cannot only touch transient cloned materials

### Deferred to Implementation

- Whether to expose all character materials immediately or start with balaclava-focused controls plus any easy adjacent materials
- Whether normal tuning should be one strength slider or explicit X/Y sliders

## High-Level Technical Design

```text
LobbyScene Character Debug
├── debug state
│   └── per-material override config
├── character material collector
│   └── current/original material handles
├── reapply hook
│   ├── bundle load
│   └── appearance refresh
└── debug UI
    └── character material controls
        ├── balaclava texture fidelity (anisotropy)
        └── balaclava normal tuning
```

## Implementation Units

- [ ] **Unit 1: Character material override state in `LobbyScene`**

**Goal:** Track debug overrides for character materials and reapply them safely across appearance refreshes.

**Requirements:** R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `js/ui/LobbyScene.js`

**Approach:**
- Add a small debug override state for character materials
- Add helper(s) to collect current/original character materials and apply texture/material overrides to both
- Reapply overrides after character bundle load and after appearance changes

**Patterns to follow:**
- existing `LobbyScene` material debug patterns
- original-material preservation in `js/PlayerAppearance.js`

**Test scenarios:**
- Happy path: applying a balaclava debug override updates the live material
- Edge case: appearance reapply path still preserves the override

**Verification:**
- Switching balaclavas or recoloring the mask does not wipe the debug tuning

---

- [ ] **Unit 2: Character debug controls in the menu preview panel**

**Goal:** Surface balaclava fidelity and normal controls in the existing menu debug panel.

**Requirements:** R1, R2, R3, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/LobbyScene.js`

**Approach:**
- Add a `CHARACTER` tab or equivalent character-material section in the existing debug panel
- Expose at least:
  - balaclava texture anisotropy/fidelity
  - balaclava normal tuning
- Keep the controls clearly debug-scoped and developer-oriented

**Patterns to follow:**
- existing slider/toggle construction in `LobbyScene` debug panel

**Test scenarios:**
- Happy path: the debug panel exposes character material controls
- Edge case: controls degrade safely if the character model or target material is not loaded yet

**Verification:**
- User can tune the balaclava live from the menu debug panel

---

- [ ] **Unit 3: Contract coverage and review**

**Goal:** Lock in the new character debug surface with lightweight verification.

**Requirements:** R1, R4, R5

**Dependencies:** Units 1-2

**Files:**
- Add or modify: a focused test under `tests/`

**Approach:**
- Prefer a structural/contract test over brittle rendered assertions
- Verify that `LobbyScene` declares the character debug surface and fidelity hooks

**Test scenarios:**
- Happy path: the character debug tab/controls are present in source
- Edge case: the implementation includes a reapply path for character material overrides

**Verification:**
- The new debug controls are less likely to drift or vanish in later UI refactors

## Risks and Mitigations

- **Risk:** Appearance refreshes may replace current tinted materials and wipe debug changes.
  - **Mitigation:** Apply overrides to source/original material handles as well as current material instances, then reapply after appearance updates.

- **Risk:** Character materials may not be loaded when the debug panel is first opened.
  - **Mitigation:** Mirror the existing deferred/polling pattern used by the texture debug tab or rebuild the character section on demand.

- **Risk:** Anisotropy caps vary by device/GPU.
  - **Mitigation:** Clamp the debug slider to `renderer.capabilities.getMaxAnisotropy()`.

## Verification Strategy

- Run syntax checks on touched files
- Add a targeted structural test for the new character debug controls
- Browser-check the menu debug panel and confirm live balaclava tuning works on the current preview
