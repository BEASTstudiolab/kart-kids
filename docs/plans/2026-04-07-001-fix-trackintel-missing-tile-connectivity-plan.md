---
title: "fix: Add missing tile connectivity to TrackIntel"
type: fix
status: active
date: 2026-04-07
origin: docs/brainstorms/2026-03-30-track-intelligence-layer-requirements.md
---

# fix: Add missing tile connectivity to TrackIntel

## Overview

TrackIntel's `BASE_CONNECTIVITY` table only defines edges for straights, finish, corner-1x1, and elevation tiles. All other tile types (bridges, tunnels, jumps, chicanes, junctions) produce a `"Unknown piece type"` warning and return `null`, breaking the connectivity walk for any track using these pieces.

## Problem Frame

The editor and codec support 15+ tile types, but TrackIntel only knows about 12 (the original set). Any editor-created track using bridges, tunnels, jumps, or chicanes will fail to produce a waypoint sequence, breaking AI pathfinding and race position tracking.

## Requirements Trace

- R1. Auto-detect cell connectivity by walking the grid from the finish cell
- R3. Work with any valid closed-loop track (hardcoded, editor, procedural)

## Scope Boundaries

- No junction branching support (junctions use bump/null behavior per original design)
- No multi-cell curve connectivity (curves decompose into corner + straight cells already handled)
- No changes to the walk algorithm itself

## Context & Research

### Relevant Code and Patterns

- `js/TrackIntel.js:24-42` — `BASE_CONNECTIVITY` table, the only file to modify
- `js/editor/AutoTile.js:9-27` — `getCellExits()` confirms all non-corner tiles follow N/S or E/W exit pattern based on orientation
- `js/TrackCodec.js:3-21` — canonical tile type list (16 entries)
- `js/editor/editor-main.js:458-462` — special tile palette confirms all tile types in the game

### Tile Connectivity Analysis

From `getCellExits()` in AutoTile.js, all tiles except corners use orientation-only exits:
- Orient 0/10 (0deg/180deg): N+S exits
- Orient 16/22 (90deg/270deg): E+W exits

This means bridges, tunnels, jumps, and chicanes all have `['N', 'S']` base connectivity — identical to straights. The rotation logic in `getOpenEdges()` already handles orient-based rotation.

Junctions (Y, T, 4way) have 3+ exits which breaks the linear walk assumption. Per the original requirements ("assumes all tracks form a single closed loop, no branches"), these should use `null` connectivity (bump behavior) — find non-previous neighbors, error if ambiguous.

## Key Technical Decisions

- **Straight-through tiles get `['N', 'S']`**: Bridges, tunnels, jumps, and chicanes follow the same connectivity pattern as straights. Confirmed by `getCellExits()` which does not special-case them.
- **Junctions get `null` (bump behavior)**: Matches the existing bump piece pattern — scan all neighbors, skip previous, error if ambiguous. This is correct: in a valid closed loop, a junction should have exactly 2 connected neighbors.

## Implementation Units

- [ ] **Unit 1: Add missing BASE_CONNECTIVITY entries**

**Goal:** Add connectivity entries for all 13 missing tile types so TrackIntel can walk any track the editor can produce.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `js/TrackIntel.js`

**Approach:**
- Add N/S entries for: `trk-bridge-entry`, `trk-bridge-mid`, `trk-tunnel-entry`, `trk-tunnel-mid`, `trk-tunnel-exit`, `trk-tunnel-open`, `trk-jump-short`, `trk-jump-long`, `trk-chicane-3x3-l`
- Add `null` entries for: `trk-junction-y`, `trk-junction-t`, `trk-junction-4way`
- Curve types (`trk-curve-*`) are not stored in cell arrays — they are visual overlays on corner+straight cells — so no entries needed

**Patterns to follow:**
- Existing elevation tile entries in `BASE_CONNECTIVITY` (lines 29-41) — same `['N', 'S']` pattern with grouped comments

**Test scenarios:**
- Happy path: TrackIntel walk succeeds on a track containing bridge-entry + bridge-mid cells
- Happy path: TrackIntel walk succeeds on a track containing tunnel-entry through tunnel-exit cells
- Happy path: TrackIntel walk succeeds on a track containing jump-short and jump-long cells
- Edge case: Junction tile with exactly 2 connected neighbors walks successfully (bump behavior)
- Error path: Junction tile with 3 connected neighbors throws ambiguity error (consistent with existing bump behavior)

**Verification:**
- No "Unknown piece type" warnings for any tile type in TrackCodec's tile list
- TrackIntel constructs successfully for tracks using any combination of supported tiles

## System-Wide Impact

- **Interaction graph:** TrackIntel is consumed by AIController, RaceMode, and Minimap. All benefit from supporting more tile types.
- **Unchanged invariants:** Walk algorithm, waypoint format, and all public API signatures remain identical.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Chicane might not be purely N/S | Confirmed by `getCellExits()` — it follows the default straight path |
