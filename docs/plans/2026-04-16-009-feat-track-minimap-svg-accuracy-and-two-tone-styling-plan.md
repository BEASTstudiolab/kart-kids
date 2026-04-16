---
title: "feat: Track Minimap SVG Accuracy And Two-Tone Styling"
type: feat
status: active
date: 2026-04-16
origin: docs/brainstorms/2026-03-30-minimap-requirements.md
related:
  - docs/plans/2026-04-09-004-refactor-fortnite-layout-plan.md
---

# feat: Track Minimap SVG Accuracy And Two-Tone Styling

## Overview

Replace the menu/library track minimap thumbnail renderer with a shape-aware SVG renderer that matches the actual race pieces more closely, especially for multi-cell turns, while exposing a palette API so the same minimap can render in different two-tone looks such as red-on-white instead of orange-on-black.

## Problem Frame

The original minimap requirements called for connected track segments rather than disconnected grid blobs (see origin: `docs/brainstorms/2026-03-30-minimap-requirements.md`). Local research shows the current implementation in `js/ui/components/TrackMinimap.js` renders each saved cell as a rounded square on a black canvas and colors by tile category. That shortcut was explicitly accepted in the older track-browser plan, but it now produces misleading previews: 3x3 curves and other larger pieces collapse into single dots, the resulting silhouettes do not match the actual racetrack, and the palette is effectively hard-coded to bright colored dots on dark backgrounds.

The user wants to keep the lightweight graphic feel of the current dots while making the overall minimap faithful to the built track and easy to restyle, ideally via SVG so palette swaps are cheap.

## Requirements Trace

- R1. Preserve the original minimap goal of showing the full track shape at a glance.
- R2. Replace per-cell square rendering with minimap geometry that reflects the actual visual footprint of track pieces, including 3x3 turns.
- R3. Keep the lightweight “dot/marker” visual language rather than switching to a photoreal or texture-heavy preview.
- R4. Render the track-library/public-page minimaps as SVG so colors and presentation can be restyled without repainting canvas pixels.
- R5. Support at least a simple two-tone palette model where track marks and background can be configured independently.
- R6. Update existing menu/library/public-track call sites without breaking track selection or published-track views.
- R7. Add automated coverage for geometry fidelity and palette output so future tile additions do not silently regress the minimap shape.

## Scope Boundaries

- In scope:
  - `js/ui/components/TrackMinimap.js`
  - minimap call sites in menu/library/public-track UI that consume `renderMinimap(...)`
  - focused tests for minimap geometry and palette output
- Out of scope:
  - replacing the in-race runtime minimap in `js/Minimap.js`
  - redesigning the editor overlay minimap in `js/track-editor/ui/MinimapRenderer.js`
  - rendering full 3D thumbnails or loading GLTF meshes just to draw track previews

## Context & Research

### Relevant Code and Patterns

- `js/ui/components/TrackMinimap.js` is the current pure helper and already owns the browser/public-track preview path.
- `js/ui/components/TrackBrowser.js`, `js/ui/components/TrackLibraryBrowser.js`, and `js/ui/public-track/PublishedTrackPage.js` append the rendered element directly, so they can accept SVG as long as layout selectors stop assuming `canvas`.
- `js/TrackOrientation.js` already contains the domain knowledge needed to normalize legacy 3x3 curve cells into their effective footprint for track-intelligence consumers.
- `js/TrackModelConfig.js` is the authoritative catalog of piece families and tells us which tiles are multi-cell curves, junctions, chicanes, finish pieces, and 1x1 segments.
- `docs/plans/2026-04-09-004-refactor-fortnite-layout-plan.md` documents the old simplification and is useful as a regression boundary: the new work should intentionally remove the “single square per cell is acceptable” assumption.

### Institutional Learnings

- No relevant `docs/solutions/` entry exists for minimap rendering in this repo, so the plan should stay grounded in existing runtime patterns and targeted tests.

### External References

- No external research is needed.

This work is local to the current UI renderer and the repo already contains the track-shape conventions that should drive the minimap output.

## Key Technical Decisions

- **Switch the track-preview renderer from canvas to SVG**: the preview surfaces are static images, so SVG gives us cheap palette control, crisp scaling, and a natural way to expose background/track colors.
- **Model the minimap as composed primitives, not raw cell rectangles**: each tile family should emit one or more normalized SVG shapes that describe the track footprint, allowing wide turns and other multi-cell pieces to read correctly.
- **Normalize legacy multi-cell track records before drawing**: use the existing legacy-curve expansion knowledge from `js/TrackOrientation.js` so older saved tracks gain the same footprint fidelity as new data.
- **Keep the API lightweight and backwards-compatible in spirit**: preserve `renderMinimap(cells, width, height)` as the main entry point, but allow an optional styling object for palette overrides.
- **Prefer two-tone output with minimal semantic accents**: the default look should be mostly “background + track”, with any optional finish/start accent kept narrow and easy to disable if a fully flat palette is desired later.

## Open Questions

### Resolved During Planning

- SVG is the right output format for the menu/library/public-track previews because they are static and benefit directly from CSS-style palette flexibility.
- The existing runtime minimap should stay separate; this request is specifically about preview imagery rather than the live HUD overlay.

### Deferred to Implementation

- Whether finish/start should remain a distinct accent in the default palette or collapse fully into the main track color.
- Whether the SVG should expose palette through inline attributes only or also stamp CSS custom properties for easier downstream skinning.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
input cells
  -> normalize legacy footprint cells
  -> classify tile family + orientation
  -> emit normalized minimap primitives
       - line capsule / rounded rect
       - quarter-turn arc / elbow
       - multi-cell sweep for 2x2 or 3x3 turns
       - optional finish marker accent
  -> compute overall bounds from emitted primitives
  -> fit into requested viewport with padding
  -> build SVG with configurable palette
```

## Implementation Units

- [ ] **Unit 1: Build a shape-aware SVG minimap renderer**

**Goal:** Replace the square-per-cell preview with SVG output that reflects actual track piece footprints, including multi-cell curves.

**Requirements:** R1, R2, R4, R5

**Dependencies:** None

**Files:**
- Modify: `js/ui/components/TrackMinimap.js`

**Approach:**
- Refactor the renderer so it produces `SVGSVGElement` output instead of a canvas.
- Introduce a small internal geometry layer that converts track cells into normalized primitives based on tile family and orientation.
- Reuse `js/TrackOrientation.js` normalization logic where needed so legacy 3x3 curve representations expand into their real occupied footprint before rendering.
- Fit the emitted primitives into the requested width/height while preserving aspect ratio and padding.

**Patterns to follow:**
- `js/TrackOrientation.js`
- `js/TrackModelConfig.js`

**Test scenarios:**
- Happy path: a simple straight/corner loop renders as a connected track silhouette rather than isolated squares.
- Edge case: a `trk-curve-3x3-wide-l` cell renders with a visibly larger sweep than a 1x1 corner.
- Edge case: legacy saved 3x3 curve data expands into the same minimap footprint as its normalized equivalent.
- Error path: empty or null cells still return a valid empty-state SVG without throwing.

**Verification:**
- Track previews look recognizably like the actual routes, especially on wide turns and larger footprint pieces.

---

- [ ] **Unit 2: Add palette controls and update preview call sites**

**Goal:** Make the new SVG minimap themeable across track browser, library, and published-track surfaces.

**Requirements:** R3, R4, R5, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/components/TrackMinimap.js`
- Modify: `js/ui/components/TrackBrowser.js`
- Modify: `js/ui/components/TrackLibraryBrowser.js`
- Modify: `js/ui/public-track/PublishedTrackPage.js`

**Approach:**
- Add an optional renderer options object for palette selection and simple defaults.
- Update any layout/style selectors that currently target `canvas` specifically so SVG fills the same containers cleanly.
- Set the initial default palette to a cleaner two-tone look while keeping the door open for alternate combinations such as red track on white background.

**Patterns to follow:**
- Existing append-only UI composition in `js/ui/components/TrackBrowser.js`
- Existing card/detail minimap containers in `js/ui/components/TrackLibraryBrowser.js`

**Test scenarios:**
- Happy path: default track browser detail and card previews still render in their containers.
- Happy path: published track page renders the new SVG preview at hero size.
- Edge case: a palette override produces different background and track colors without changing geometry.
- Integration: existing callers that only pass `(cells, width, height)` still receive a renderable DOM node.

**Verification:**
- The same minimap renderer can support alternate looks such as red-on-white without code duplication.

---

- [ ] **Unit 3: Lock geometry and palette behavior with focused tests**

**Goal:** Add automated coverage that protects the new renderer from regressing back to misleading footprints.

**Requirements:** R2, R5, R7

**Dependencies:** Units 1-2

**Files:**
- Add: `tests/track-minimap.test.mjs`

**Approach:**
- Test the renderer at the DOM/string level instead of screenshot-pixel level.
- Assert for structural SVG markers that prove wide-curve footprints, bounds fitting, and palette propagation.
- Keep fixtures small and targeted so new tile families can be added incrementally without brittle snapshots.

**Patterns to follow:**
- Existing lightweight DOM/unit tests under `tests/`

**Test scenarios:**
- Happy path: renderer returns an `<svg>` root with expected sizing metadata.
- Edge case: wide-curve tracks occupy more than a single-cell footprint in the emitted geometry.
- Edge case: legacy 3x3 curve fixtures match normalized fixtures after rendering prep.
- Edge case: custom palette values appear in the SVG output or element attributes used for styling.

**Verification:**
- The minimap renderer has fast feedback coverage for both shape fidelity and styling hooks.

## System-Wide Impact

- **Interaction graph:** `TrackMinimap` feeds preview surfaces in the main tracks browser, the shared track library browser, and the public published-track page.
- **Error propagation:** malformed or empty cell arrays should degrade to an empty SVG instead of breaking page rendering.
- **State lifecycle risks:** because previews are rebuilt on selection changes, the renderer must remain allocation-light and side-effect free.
- **API surface parity:** the function name and basic `(cells, width, height)` calling pattern remain stable so existing consumers only need styling/container updates.
- **Integration coverage:** unit tests will not prove visual fit inside every surface, so browser verification is still required for the card, detail, and public hero variants.
- **Unchanged invariants:** track selection, publishing metadata, and in-race HUD minimap behavior do not change in this task.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| SVG geometry becomes too bespoke to maintain when new tile families are added | Centralize tile-family classification and keep primitive generation table-driven where practical |
| Legacy saved curves render differently from runtime track-intel expectations | Reuse `js/TrackOrientation.js` normalization rules instead of inventing separate minimap-only expansion logic |
| Swapping from canvas to SVG breaks container styling in cards or hero views | Update selector assumptions during the same pass and verify all existing call sites in-browser |
| A fully two-tone palette makes the start/finish harder to spot | Keep finish/start accent optional and narrow so the default can stay readable without locking the design into multicolor dots |

## Documentation / Operational Notes

- If the palette API lands cleanly, future UI passes can expose theme-level minimap presets without revisiting geometry logic.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-03-30-minimap-requirements.md`
- Related plan: `docs/plans/2026-04-09-004-refactor-fortnite-layout-plan.md`
- Related code: `js/ui/components/TrackMinimap.js`
- Related code: `js/TrackOrientation.js`
- Related code: `js/TrackModelConfig.js`
