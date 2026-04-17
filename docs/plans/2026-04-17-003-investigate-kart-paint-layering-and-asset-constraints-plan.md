---
title: "investigate: characterize kart paint layering and asset constraints"
type: investigation
status: completed
date: 2026-04-17
---

# investigate: characterize kart paint layering and asset constraints

## Overview

Trace why kart paint customization reads like a color layered over pre-painted body art instead of a clean recolor. The goal of this pass is to confirm the real render/data constraint, codify it in automated coverage, and add a small reusable inspection surface so future paint-fix work starts from facts instead of guesswork.

## Problem Frame

The current garage/menu paint flow updates `vehicleColor` live and re-applies vehicle appearance correctly, but the visible result still feels wrong: custom colors appear to multiply over an existing baked hue. Local code inspection already shows the runtime paint path is simple `material.color` tinting on the kart body mesh, so if the kart assets ship with colored `baseColorTexture` maps, the tint will multiply those pixels instead of replacing them.

The risk here is misdiagnosing a content-pipeline limitation as a UI/event bug. Before attempting a shader rewrite or destructive texture workaround, we need characterization that answers:

- which kart meshes are actually being tinted
- which materials/textures those meshes use
- whether the texture data already contains baked body color
- whether the current runtime path preserves the texture while only changing `material.color`

## Requirements Trace

- R1. Confirm the exact runtime code path used for kart paint application in menu, garage, and in-race vehicle creation.
- R2. Add automated characterization proving whether custom paint is multiplicative over textured base color rather than a true replacement tint.
- R3. Inspect the shipped kart GLTF/material setup and lock down whether body meshes rely on colored `baseColorTexture` assets with no separate paint mask/neutral albedo.
- R4. Add a reusable local inspection helper or test utility so future paint work can query kart paintability without manually opening GLTF files.
- R5. Preserve current live paint syncing behavior; this pass is not allowed to silently change the visual paint model without an intentional follow-up decision.
- R6. Verify the characterization against the live app in the garage/menu preview.

## Scope Boundaries

- Do not redesign the garage UI or the settings schema.
- Do not ship a speculative shader/material rewrite in this pass.
- Do not repaint or re-export vehicle textures from Blender here.
- Do not change unrelated character appearance or menu camera logic.

## Context & Research

### Relevant Code and Patterns

- `js/PlayerAppearance.js` owns `applyVehicleAppearance()`, which currently clones the original material and applies the selected `vehicleColor` through `material.color`.
- `js/Vehicle.js`, `js/ui/LobbyScene.js`, and `js/ui/PartyLobbyScene.js` each resolve a kart `body` mesh and pass only that body root into the shared appearance helper.
- `js/ui/panels/GaragePanel.js` writes `vehicleColor` on color-input `input` events and syncs the menu preview immediately.
- `models/vehicles/BaseRaceKart*.gltf` define the shipped kart body materials and referenced textures.

### Local Findings

- Kart paint is already scoped to the `Body` mesh (or `body.*` variants), not the entire kart hierarchy.
- The current runtime path does not replace or disable the kart `baseColorTexture`; it clones the original material and changes `material.color`.
- The shipped kart GLTFs use textured materials such as `cars_car 1_BaseColor.1001.webp` and `cars_car 2_BaseColor.1001.webp`.
- Visual inspection of `models/vehicles/textures/cars_car 1_BaseColor.1001.webp` and `cars_car 2_BaseColor.1001.webp` shows strong baked yellow/green/purple body color in the source texture itself.

### Implication

Given the current asset setup, runtime tinting is multiplicative by design: `material.color` multiplies the already-colored base texture. Without a neutral albedo, a paint mask, or a custom shader that separates paintable regions, the renderer cannot produce a clean body recolor from the current assets alone.

## Key Technical Decisions

- **Treat this as a characterization-first investigation, not a blind visual fix.**
  Rationale: the strongest current evidence points to an asset/material constraint rather than a broken event path.

- **Add a reusable kart-paint inspection helper.**
  Rationale: we should be able to answer “is this kart paintable with a simple tint?” programmatically for every vehicle.

- **Add tests against real kart asset metadata.**
  Rationale: the root cause lives partly in shipped GLTF content, so a pure mock-only test would miss the important constraint.

- **Preserve current tint behavior in this pass.**
  Rationale: changing the live paint algorithm without a mask/asset plan risks trading one incorrect look for another and muddying the investigation.

## Implementation Units

### Unit 1: Add a kart paint inspection helper

**Goal**

Create a small utility that describes the paint-relevant structure of a kart model or GLTF metadata: body mesh names, material names, presence of `baseColorTexture`, texture source URIs, and whether the current runtime path is texture-preserving tint multiplication.

**Files**

- `js/vehicle/vehiclePaintInspection.js`
- `tests/vehicle-paint-inspection.test.mjs`

**Patterns to Follow**

- Existing small pure helpers under `js/vehicle/` and `js/ui/utils/`
- Existing node-based tests that assert asset metadata in `tests/*.test.mjs`

**Approach**

- Add helper functions that can:
  - identify paintable/body meshes by current naming conventions
  - inspect material definitions from GLTF JSON or live scene nodes
  - report whether paint uses a colored texture map plus `material.color` multiplication
- Keep the helper pure and side-effect free so it can be used in tests and local debugging.

**Test Scenarios**

- A body mesh with a textured base color map is reported as texture-backed paint.
- A material without `baseColorTexture` is reported as flat-color tintable.
- The helper recognizes current body-node naming patterns (`Body`, `body.002`, etc.).

**Verification**

- `node --test tests/vehicle-paint-inspection.test.mjs`

### Unit 2: Characterize the shipped kart assets and runtime paint path

**Goal**

Prove, with automated coverage, that the shipped kart assets currently rely on colored body textures and that `applyVehicleAppearance()` preserves those textures while changing only `material.color`.

**Files**

- `tests/player-appearance.test.mjs`
- `tests/vehicle-paint-inspection.test.mjs`
- `models/vehicles/BaseRaceKart1.gltf`
- `models/vehicles/BaseRaceKart2.gltf`
- `models/vehicles/BaseRaceKart3.gltf`

**Patterns to Follow**

- Existing characterization-style assertions in `tests/lobby-assets.test.mjs`
- Existing appearance helper tests in `tests/player-appearance.test.mjs`

**Approach**

- Extend appearance tests so they assert that vehicle tinting clones the material but preserves the original texture map.
- Add asset-backed tests that parse representative kart GLTF files and verify:
  - the body mesh exists
  - the body material references a `baseColorTexture`
  - the texture source points at the shipped colored vehicle texture set
- Keep the assertions precise enough that future asset or shader work can intentionally update them.

**Test Scenarios**

- `applyVehicleAppearance()` preserves the original `map` while updating `material.color`.
- Kart 1/2/3 body materials each point at a `BaseColor` texture asset.
- Body mesh detection works across current naming variants.

**Verification**

- `node --test tests/player-appearance.test.mjs tests/vehicle-paint-inspection.test.mjs`

### Unit 3: Verify the live garage/menu story and capture the conclusion

**Goal**

Use the running app to confirm that the live behavior matches the characterized constraints and leave a clear summary for future paint-fix work.

**Files**

- browser verification only for production code unless a tiny helper export is needed

**Patterns to Follow**

- Existing local browser verification flow on `http://localhost:3000`
- Existing `window.__kartDebug` usage for menu scene inspection

**Approach**

- Verify in-browser that changing `vehicleColor` updates runtime state live.
- Confirm that the visible kart still reflects baked hue interaction consistent with the asset-backed diagnosis.
- Record the conclusion in the final handoff so a follow-up fix can choose between:
  - asset re-export with neutral paint textures
  - adding paint masks
  - introducing a custom shader/material mix path

**Test Scenarios**

- Live garage color input changes `vehicleColor` immediately.
- Visible kart output still reflects multiplicative tint over textured body art.

**Verification**

- browser verification on `http://localhost:3000`

## Risks and Mitigations

- **Risk: we mistake a runtime bug for a content issue.**
  Mitigation: cover both the runtime helper path and the real GLTF asset metadata in tests.

- **Risk: representative assets do not cover all karts.**
  Mitigation: start with the shared texture families used by current karts and structure the helper so coverage can expand easily.

- **Risk: a future fix changes paint behavior but not the characterization docs/tests.**
  Mitigation: keep the new helper/tests explicit so they fail loudly when the paint model changes.

## Sequencing

1. Add the kart paint inspection helper.
2. Add focused tests for helper logic and `applyVehicleAppearance()`.
3. Add asset-backed characterization for representative kart GLTF files.
4. Run targeted tests.
5. Verify the live garage/menu behavior in the browser.
6. Run review/autofix and workflow cleanup.
