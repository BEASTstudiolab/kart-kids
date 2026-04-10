---
title: "feat: 3D party lobby with karts on starting tile"
type: feat
status: completed
date: 2026-04-10
origin: docs/brainstorms/2026-04-10-3d-party-lobby-requirements.md
---

# feat: 3D party lobby with karts on starting tile

## Overview

When players tap PARTY, they see the `trk-finish` starting tile rendered in 3D with their kart parked on it. As friends join, their karts appear alongside. The lobby UI (room code, player list, track picker) overlays the 3D scene. START fades to the full race.

## Problem Frame

The PARTY lobby is a flat UI overlay with no visual personality. Rendering a 3D starting grid with karts gives players social presence — you can *see* friends arrive — and makes the wait feel like a pre-race moment rather than a loading screen. (see origin: docs/brainstorms/2026-04-10-3d-party-lobby-requirements.md)

## Requirements Trace

- R1. Render `trk-finish` tile as 3D environment behind lobby UI.
- R2. Local player's kart appears parked on the tile.
- R3. Remote player karts appear as they join.
- R4. Karts removed when players leave.
- R5. Fixed cinematic camera showing the full tile.
- R6. Basic lighting (ambient + directional).
- R7. Lobby UI overlays the 3D scene (transparent background).
- R8. LobbyOverlay background becomes transparent.
- R9. START triggers fade to black, then full race loads.
- R10. Karts are static — no driving, no physics.
- R11. Grid positions: center first, then alternate left/right.

## Scope Boundaries

- PARTY mode only. RACE and FREE PLAY unchanged.
- No driving, physics, or idle animations on karts.
- No network sync of kart positions — placement is deterministic by join order.
- No custom decorations on the starting tile.
- No orbit or player-controlled camera.

## Context & Research

### Relevant Code and Patterns

- `js/ui/LobbyScene.js` — Existing 3D lobby scene. Creates own THREE.Scene, PerspectiveCamera, loads `lobby.glb`, shares renderer from GameEngine. Has `setKart(kartId)` to load/display a vehicle. Called from AppShell render loop in `'lobby'` mode. **This is the primary pattern to follow.**
- `js/ui/core/AppShell.js` — Render loop switches between modes (`race`, `lobby`, `garage`). LobbyScene is already integrated. The new PartyLobbyScene can follow the same pattern.
- `js/ModelLoader.js` — GLTFLoader with THREE.Cache enabled. Track tile models loaded as `models/trk-finish`. Vehicle models loaded from VehicleRegistry paths.
- `js/VehicleRegistry.js` — Maps vehicle IDs to model paths, color tints, character offsets.
- `js/Track.js` — `computeSpawnPosition(cells)` calculates spawn position on finish tile. Per-cell world coords: `(gx + 0.5) * CELL_RAW`.
- `js/ui/overlays/LobbyOverlay.js` — Current lobby overlay. Needs transparent background. Already has `onPlayerJoin`/`onPlayerLeave` network callbacks that can trigger kart add/remove.

### Institutional Learnings

- LobbyScene already handles kart + character model loading with `setKart(kartId)`. The same pattern (load vehicle from VehicleRegistry, clone character, attach to seat_anchor) can be reused.
- Renderer sharing is well-established — single WebGLRenderer shared across GameEngine, LobbyScene, GaragePreview.
- Vehicle color tint variants (green, purple, red) are already implemented for differentiating karts.

## Key Technical Decisions

- **New PartyLobbyScene class, don't modify LobbyScene**: LobbyScene has a specific purpose (home menu background with turntable kart). The party lobby needs different content (starting tile + multiple karts in grid positions). A new class following the same pattern keeps both clean.

- **Remote karts use base vehicle + color tints**: The `onPlayerJoin` network message doesn't include `vehicleId`. Rather than extending the network protocol (scope creep), use the base vehicle model with color tint variants (already implemented in ModelLoader) to differentiate remote players. Local player uses their selected kart.

- **Deterministic grid placement**: Karts placed at fixed grid positions on the starting tile based on join order. Center position first, then alternate left/right. No network coordination needed — each client computes the same layout from the member list order.

- **AppShell render mode**: Add a `'party-lobby'` render mode to the AppShell loop (or reuse `'lobby'` mode with a conditional). PartyLobbyScene.update(dt) called when active.

- **Fade transition via CSS overlay**: A simple CSS fade-to-black overlay on START, then switch to race mode. Matches the "quick fade/cut" decision from brainstorm.

## Open Questions

### Resolved During Planning

- **How to load trk-finish**: GLTFLoader with path `models/trk-finish`. THREE.Cache handles dedup.
- **Remote player vehicle models**: Use base vehicle + color tint variants. No network protocol changes.
- **Render loop integration**: New render mode or conditional in existing `'lobby'` mode, following LobbyScene pattern.

### Deferred to Implementation

- Exact camera position/angle for the starting tile view — needs visual iteration.
- Exact grid positions for karts on the 30-unit-wide tile — needs visual iteration.
- Character model attachment for remote karts — may simplify to vehicle-only (no character) if loading is too heavy.

## Implementation Units

- [ ] **Unit 1: Create PartyLobbyScene class**

**Goal:** New 3D scene class that renders the `trk-finish` tile with basic lighting and a fixed camera.

**Requirements:** R1, R5, R6

**Dependencies:** None

**Files:**
- Create: `js/ui/PartyLobbyScene.js`

**Approach:**
- Follow LobbyScene pattern: constructor takes shared renderer, creates own THREE.Scene, PerspectiveCamera, ambient + directional lights.
- Load `trk-finish` model via GLTFLoader, place at origin.
- Fixed camera positioned to show the full 3x1 tile from a slightly elevated angle.
- Expose `update(dt)` method that calls `renderer.render(scene, camera)`.
- Expose `dispose()` for cleanup.

**Patterns to follow:**
- `js/ui/LobbyScene.js` constructor, lighting setup, update/dispose lifecycle.
- `js/ModelLoader.js` GLTFLoader usage with THREE.Cache.

**Test scenarios:**
- Happy path: PartyLobbyScene created with renderer -> scene contains trk-finish model and lights.
- Happy path: update(dt) renders without error.
- Edge case: dispose() cleans up scene, geometry, materials.

**Verification:**
- Instantiating PartyLobbyScene and calling update() renders the starting tile on screen.

---

- [ ] **Unit 2: Add local player kart to PartyLobbyScene**

**Goal:** Load and display the local player's selected kart on the starting tile.

**Requirements:** R2, R10, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/PartyLobbyScene.js`

**Approach:**
- Add `setLocalKart(kartId)` method following LobbyScene.setKart() pattern.
- Load vehicle model from VehicleRegistry, clone, place at center grid position on the tile.
- Kart is static — no physics, no animation, just positioned and rotated to face the "racing direction."
- Store kart in a managed collection keyed by a slot ID.

**Patterns to follow:**
- `LobbyScene.setKart(kartId)` — model loading, cloning, scene graph attachment.
- `VehicleRegistry.getVehicleById()` — resolving vehicle ID to model path.

**Test scenarios:**
- Happy path: setLocalKart('kart-1') -> kart model appears at center position on the tile.
- Edge case: setLocalKart with invalid ID -> falls back to base vehicle model.

**Verification:**
- Local player's kart is visible on the starting tile, parked at center position.

---

- [ ] **Unit 3: Add/remove remote player karts**

**Goal:** When players join/leave the lobby, add/remove their karts from the scene.

**Requirements:** R3, R4, R10, R11

**Dependencies:** Unit 2

**Files:**
- Modify: `js/ui/PartyLobbyScene.js`

**Approach:**
- Add `addRemoteKart(playerId)` and `removeKart(playerId)` methods.
- Remote karts use the base vehicle model with color tint variants (green, purple, red — already implemented in ModelLoader's clone-with-tint pattern).
- Grid placement: maintain an ordered list of slots. Slot 0 = center (local player). Slots 1+ alternate left/right of center across the tile width.
- `removeKart(playerId)` removes the kart from scene and frees the slot.

**Patterns to follow:**
- ModelLoader color tint cloning pattern for vehicle variants.
- LobbyScene._kartGroup management for scene graph add/remove.

**Test scenarios:**
- Happy path: addRemoteKart('player-2') -> second kart appears to the left of center.
- Happy path: addRemoteKart('player-3') -> third kart appears to the right of center.
- Happy path: removeKart('player-2') -> kart removed from scene.
- Edge case: Adding 6+ karts -> positions fill across tile width without overlapping.

**Verification:**
- Multiple karts visible on the starting tile in grid formation. Removing a player removes their kart.

---

- [ ] **Unit 4: Wire PartyLobbyScene into AppShell and RacePanel**

**Goal:** Create and manage PartyLobbyScene lifecycle from the PARTY flow. Wire network join/leave events to kart add/remove.

**Requirements:** R1, R3, R4, R7

**Dependencies:** Unit 3

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/panels/RacePanel.js`
- Modify: `js/ui/overlays/LobbyOverlay.js`

**Approach:**
- AppShell: create PartyLobbyScene on demand (lazy, like GaragePreview). Add to render loop — when PARTY lobby is active, call partyLobbyScene.update(dt).
- RacePanel._handleParty(): after creating LobbyOverlay, also create/show PartyLobbyScene with local player's kart.
- LobbyOverlay: extend onPlayerJoin/onPlayerLeave callbacks to also call partyLobbyScene.addRemoteKart()/removeKart(). Pass the scene reference via services bag or direct injection.
- On LobbyOverlay.hide() or race start: dispose PartyLobbyScene.

**Patterns to follow:**
- AppShell._startRenderLoop() mode switching pattern.
- LobbyOverlay network callback wiring (_wireNetworkEvents).

**Test scenarios:**
- Integration: Tap PARTY -> PartyLobbyScene created, renders behind LobbyOverlay with local kart.
- Integration: Remote player joins -> onPlayerJoin fires -> kart appears in scene.
- Integration: Remote player leaves -> onPlayerLeave fires -> kart removed from scene.
- Integration: LobbyOverlay.hide() -> PartyLobbyScene disposed, render mode switches back.

**Verification:**
- Full PARTY flow shows 3D scene with karts behind the lobby overlay. Join/leave events update the scene.

---

- [ ] **Unit 5: Make LobbyOverlay background transparent**

**Goal:** The lobby overlay renders on top of the 3D scene with a transparent/semi-transparent background.

**Requirements:** R7, R8

**Dependencies:** Unit 4

**Files:**
- Modify: `js/ui/overlays/LobbyOverlay.js`

**Approach:**
- Change `.kk-lobby-overlay` background from solid `var(--color-bg-surface)` to semi-transparent (e.g., `rgba(26, 26, 46, 0.7)` with backdrop-blur).
- Add text shadows or subtle dark backing to ensure room code, player names, and buttons remain readable over the 3D scene.
- Only apply transparency when PartyLobbyScene is active (add a modifier class like `kk-lobby-overlay--3d`).

**Patterns to follow:**
- Existing `backdrop-filter: blur(8px)` pattern used in RacePanel chip strip CSS.

**Test scenarios:**
- Happy path: LobbyOverlay with `--3d` class -> 3D scene visible through semi-transparent background.
- Happy path: Without `--3d` class -> solid background (normal behavior for non-3D contexts).
- Edge case: Text remains readable over bright 3D scene areas.

**Verification:**
- 3D starting tile with karts visible through the lobby overlay. All text and buttons clearly readable.

---

- [ ] **Unit 6: Fade transition on START**

**Goal:** When host presses START, fade to black before transitioning to the full race.

**Requirements:** R9

**Dependencies:** Unit 4

**Files:**
- Modify: `js/ui/overlays/LobbyOverlay.js`

**Approach:**
- On START, append a full-screen black overlay element with CSS transition (opacity 0 -> 1 over ~300ms).
- After fade completes, trigger the existing race start flow (services.startRace).
- The race loading will naturally replace the scene. PartyLobbyScene gets disposed during this transition.

**Patterns to follow:**
- Existing LoadingOverlay show/hide pattern for full-screen overlays.

**Test scenarios:**
- Happy path: Host presses START -> screen fades to black -> race starts.
- Happy path: Fade duration is ~300ms (not jarring, not slow).

**Verification:**
- Clean fade-to-black transition between lobby and race. No visual pop or flash.

## System-Wide Impact

- **Interaction graph:** RacePanel -> PartyLobbyScene (new) + LobbyOverlay. LobbyOverlay network callbacks -> PartyLobbyScene kart management. AppShell render loop gains new mode/conditional.
- **Error propagation:** Model load failures for trk-finish or vehicles should not block the lobby — fall back to lobby without 3D (existing solid-background overlay still works).
- **State lifecycle risks:** PartyLobbyScene must be disposed when leaving the lobby (hide, disconnect, race start). Leaking the scene would waste GPU memory.
- **Unchanged invariants:** LobbyScene (home menu), GaragePreview, GameEngine, race flow, RACE mode, FREE PLAY mode — all completely untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| trk-finish model may not be pre-loaded when lobby opens | GLTFLoader is async — show lobby overlay immediately, add tile to scene when loaded. Brief moment of empty background is acceptable. |
| Multiple vehicle models loading simultaneously could be slow | Remote karts use base vehicle + color tints (single model, multiple clones). Only local player loads their custom kart. |
| PartyLobbyScene not disposed properly → GPU memory leak | Explicit dispose() in LobbyOverlay.hide() and race start path. Follow LobbyScene.dispose() pattern. |
| Transparent overlay may be hard to read over bright 3D scene | backdrop-blur + text-shadow + semi-transparent dark backing. Tested in Unit 5. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-10-3d-party-lobby-requirements.md](docs/brainstorms/2026-04-10-3d-party-lobby-requirements.md)
- Related code: `js/ui/LobbyScene.js`, `js/ui/core/AppShell.js`, `js/ModelLoader.js`, `js/VehicleRegistry.js`, `js/Track.js`
