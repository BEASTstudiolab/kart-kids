---
title: "feat: garage character customizer synced to lobby and race"
type: feat
status: active
date: 2026-04-13
origin: direct user request (2026-04-13)
---

# feat: garage character customizer synced to lobby and race

## Overview

Add a real character customizer to the live `GARAGE` tab so players can tune their driver's look, see the result immediately on the 3D kart preview, and carry that same appearance into the private party lobby and the race scene. The implementation should use the current tab/panel architecture, not the older routed `/garage` and `/characters` pages.

## Problem Frame

The repo already has partial character customization primitives (`charSkinColor`, `characterColor`, `charAccessories`) and local in-race application logic, but there is no live garage UI for them in the shipping tabbed flow, and the lobby scenes/network payloads do not treat character appearance as first-class player data. The result is a broken fantasy: players can technically customize parts of the driver, but they cannot do it from the main garage experience or trust that others will see the result in social spaces.

## Requirements Trace

- R1. The live `GARAGE` tab exposes real character customization controls inside `js/ui/panels/GaragePanel.js`.
- R2. Players can change at least skin tone, outfit/accent tint, and accessory visibility from that garage UI.
- R3. Character customization persists across refreshes via `Settings.js`.
- R4. Garage changes apply live to the local 3D menu preview without requiring a page reload.
- R5. The local player's customized appearance is shown in the 3D party lobby scene.
- R6. Other players in the same private room receive and render that customized appearance in the party lobby.
- R7. The same appearance data is available to the in-race player spawn path so private/multiplayer race visuals stay aligned with the lobby.
- R8. Existing kart selection, kart stats, and race-start flows remain intact.

## Scope Boundaries

- No new authored character models, unlock systems, shops, or inventory backends.
- No new emote, wheel, or preset systems beyond the current garage scope.
- No resurrection of the legacy routed `Page09Garage*` / `Page10CharacterSelect*` flow.
- No per-frame network sync for cosmetics; appearance only needs to travel in room/join/race bootstrap payloads.
- No gameplay-stat changes, collision changes, or physics tuning tied to cosmetics.

## Context & Research

### Relevant Code and Patterns

- `js/ui/panels/GaragePanel.js` is the active garage UI in the tabbed shell. It currently handles kart browsing/equip only.
- `js/ui/core/AppShell.js` is the active menu orchestrator. It keeps the lobby scene running behind menu tabs and creates the party lobby scene on demand.
- `js/ui/LobbyScene.js` is the live menu hero scene. It already loads a kart and seated character for the local player, but it does not apply the saved appearance model.
- `js/ui/PartyLobbyScene.js` is the live private-lobby 3D scene. It already loads local and remote karts plus seated characters, but only supports kart IDs and tint variants.
- `js/GameEngine.js` already contains local-only character customization logic (`applyCharacterCustomization`, `applyPlayerTints`) that can be factored into a shared helper instead of duplicated across scenes.
- `js/Settings.js` already persists the primitive appearance fields at top level. Reusing those keys is lower-risk than inventing a wholly new schema and rewriting every consumer.
- `js/Network.js` and `server.js` already carry player identity and kart selection through room creation/join/start flows. Appearance data can ride in the same bootstrap messages.
- `js/PlayerManager.js` is the right place to apply remote appearance data when remote vehicles are created for race scenes.

### Institutional Learnings

- The current app uses the tabbed `RacePanel` / `GaragePanel` / `TracksPanel` / `ProfilePanel` architecture; older routed page controllers are reference-only.
- Renderer sharing across `GameEngine`, `LobbyScene`, `PartyLobbyScene`, and `GaragePreview` is already established, so this feature should extend scene APIs rather than create a new rendering stack.
- Private-lobby member visuals are already instantiated once on join and on room bootstrap. That makes room payload sync a better fit than a continuous cosmetic replication system.

## Key Technical Decisions

- **Create a shared appearance helper instead of keeping GameEngine-only logic**: Move normalization and material/accessory application into a reusable module (for example `js/PlayerAppearance.js`) so the same rules are used by the garage preview, menu lobby, party lobby, and in-race vehicle spawn.

- **Keep the existing persisted keys, wrap them with helper APIs**: The current saved fields (`vehicleColor`, `characterColor`, `charSkinColor`, `charAccessories`) already exist and drive the local runtime. The plan should preserve them, add normalization/serialization helpers, and only expand `Settings.js` with small convenience methods when needed.

- **Implement the customizer in `GaragePanel`, not the legacy routes**: The shipping UI is the persistent tabbed shell. The feature should extend that surface directly so it is reachable from the normal menu flow and inherits the established visual language.

- **Use room bootstrap payloads for cosmetic sync**: Send a compact `appearance` object during `createRoom`, `joinRoom`, `findRoom`, `welcome`, `existingPlayers`, `playerJoin`, and race bootstrap payloads. Do not add cosmetic data to the 20 Hz world-state stream.

- **Apply appearance at model attach time and on local settings changes**: Scenes should reapply appearance after async GLTF loads complete. Local garage edits should also trigger immediate preview refresh through existing `settings-changed` events.

- **Treat the 3D scenes as the lobby loadout proof, not the overlay text**: The party lobby’s visual confirmation should come from the seated driver model in `PartyLobbyScene`. The overlay can remain mostly name/room focused unless a minimal summary materially improves clarity.

## Open Questions

### Resolved During Planning

- **Should this use the old page-routed garage?** No. The tabbed shell is the active product surface.
- **Should cosmetics be synced continuously?** No. Bootstrap/join/start payload sync is sufficient for this scope.
- **Should settings be rewritten into a brand new schema?** No. Reuse current fields and normalize them through a shared helper to reduce migration risk.

### Deferred to Implementation

- Exact accessory control layout in the garage panel: chips, toggles, or compact rows. The implementation should choose the option that fits the existing overlay aesthetic without overcrowding mobile layouts.
- Whether the lobby overlay should show a small textual appearance summary in addition to the 3D scene. This is optional unless visual verification shows ambiguity.

## Implementation Units

- [ ] **Unit 1: Shared appearance model + persistence helpers**

**Goal:** Centralize character appearance normalization, serialization, and application so every surface uses the same rules.

**Requirements:** R2, R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**
- Create: `js/PlayerAppearance.js`
- Modify: `js/Settings.js`
- Modify: `tests/unit/settings.spec.js`
- Create: `tests/player-appearance.test.mjs`

**Approach:**
- Extract the accessory definitions and material/mesh targeting rules from `js/GameEngine.js` into a shared module.
- Add helpers to:
  - build a normalized appearance object from `Settings`
  - sanitize incoming room payload appearance data
  - apply vehicle/body tint + character tint + skin material overrides + accessory visibility/color to a loaded model/vehicle
- Keep existing saved keys intact; add only thin `Settings` helpers if they materially simplify panel code or tests.

**Patterns to follow:**
- `js/GameEngine.js` existing tint/customization application logic
- `tests/unit/settings.spec.js` schema migration and event assertions

**Test scenarios:**
- Happy path: default settings normalize into a complete appearance object with all expected accessory keys.
- Happy path: persisted appearance fields round-trip through `Settings`.
- Edge case: partial or malformed incoming appearance payload falls back to safe defaults instead of throwing.
- Edge case: accessory color reset returns to the original material rather than leaving cloned overrides behind.

**Verification:**
- Helper tests pass and a local manual smoke test confirms no visual regressions in the existing local race customization path.

---

- [ ] **Unit 2: Local menu scene preview support**

**Goal:** Make the existing menu scenes render the saved appearance consistently for the local player.

**Requirements:** R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/LobbyScene.js`
- Modify: `js/ui/PartyLobbyScene.js`
- Modify: `js/ui/core/AppShell.js`

**Approach:**
- Teach `LobbyScene` to apply the normalized local appearance after loading the seated character and after kart swaps.
- Teach `PartyLobbyScene.setLocalKart()` to accept/apply local appearance instead of only a kart ID.
- Ensure scene APIs are compatible with the current AppShell flow, which swaps render modes and reuses the same renderer.

**Patterns to follow:**
- Existing async load-generation guards in `js/ui/LobbyScene.js`
- Existing party lobby slot/kart lifecycle in `js/ui/PartyLobbyScene.js`

**Test scenarios:**
- Happy path: switching into the GARAGE or PLAY tab shows the selected kart with the saved local character appearance.
- Edge case: changing appearance fields while the menu scene is already active updates the visible preview without requiring a fresh scene instance.
- Edge case: stale async scene loads do not overwrite a newer appearance selection.

**Verification:**
- Visual verification in the browser shows the same local appearance across the menu hero and the garage preview state.

---

- [ ] **Unit 3: Live GaragePanel character customizer**

**Goal:** Add a real character customization console to the active garage tab without breaking the current kart browsing/equip flow.

**Requirements:** R1, R2, R3, R4, R8

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `js/ui/panels/GaragePanel.js`
- Modify: `tests/e2e/profile-settings.spec.js`
- Create: `tests/e2e/garage-customizer.spec.js`

**Approach:**
- Preserve the current central kart hero, equip button, carousel, and stat panel.
- Add a left-side character styling console with:
  - skin tone control
  - outfit/accent color control
  - accessory toggles and, where useful, color pickers
  - a concise “current loadout” or “style summary” readout
- Wire controls directly to persisted settings and immediately refresh the menu scene preview.
- Ensure the layout remains usable on mobile widths and does not trap pointer events over the 3D scene.

**Patterns to follow:**
- Existing GaragePanel overlay composition and accent treatment
- Existing settings UI patterns from `js/SettingsMenu.js` for color rows and toggle behavior

**Test scenarios:**
- Happy path: opening the GARAGE tab exposes visible character styling controls.
- Happy path: adjusting a control persists to localStorage and remains after reload.
- Happy path: toggling an accessory updates the saved payload and visual state.
- Edge case: reset/empty color values serialize back to the default empty-string form expected by existing runtime code.

**Verification:**
- Browser verification shows live preview updates in the GARAGE tab and persistence across reload.

---

- [ ] **Unit 4: Private lobby + race bootstrap appearance sync**

**Goal:** Propagate appearance data through room creation/join/start flows so other players see the same customized driver in the private lobby and race scene.

**Requirements:** R5, R6, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `js/Network.js`
- Modify: `server.js`
- Modify: `js/ui/overlays/LobbyOverlay.js`
- Modify: `js/ui/panels/RacePanel.js`
- Modify: `js/PlayerManager.js`
- Modify: `js/GameEngine.js`
- Modify: `tests/unit/server-rooms.spec.js`

**Approach:**
- Include sanitized `appearance` data when the client creates/joins/finds rooms.
- Persist that appearance server-side alongside `vehicleId` and player name.
- Return appearance in `welcome`, `existingPlayers`, `playerJoin`, reconnect, and race-start payloads.
- Update `LobbyOverlay` and `PartyLobbyScene` to pass remote appearance into remote kart instantiation.
- Update `PlayerManager` / race bootstrap so remote spawned vehicles apply the same appearance during actual gameplay, not just the lobby.

**Patterns to follow:**
- Existing room payload flow in `js/Network.js` and `server.js`
- Existing `existingPlayers` handling in `LobbyOverlay` and `GameEngine`
- Existing remote vehicle creation flow in `PlayerManager.addRemotePlayer()`

**Test scenarios:**
- Happy path: a room host receives their own appearance back in welcome/bootstrap data.
- Happy path: joining a room returns existing players with appearance payloads.
- Happy path: `playerJoin` broadcasts include appearance for late joiners.
- Happy path: remote player vehicles in the race apply the provided appearance once spawned.
- Edge case: missing appearance payload from an older client still produces a valid fallback character.

**Verification:**
- Two-client browser verification shows remote cosmetics in the private lobby and a follow-on race.

---

- [ ] **Unit 5: Cleanup, compatibility, and regression hardening**

**Goal:** Remove duplicated local-only customization logic, preserve current flows, and close obvious regressions.

**Requirements:** R3, R4, R7, R8

**Dependencies:** Units 1-4

**Files:**
- Modify: `js/GameEngine.js`
- Modify: any touched scene/panel/network files as needed
- Update plan progress checkboxes in this document

**Approach:**
- Replace duplicated GameEngine-only appearance functions with calls into the shared helper.
- Verify no existing kart selection, party flow, or local-race startup paths still depend on the old helper locations.
- Keep the branch-safe diffs in mind because `js/GameEngine.js`, `js/PlayerManager.js`, `js/ui/overlays/LobbyOverlay.js`, `js/ui/panels/RacePanel.js`, and `server.js` already contain unrelated in-progress changes in this worktree.

**Patterns to follow:**
- Existing `settings-changed` event usage in `GameEngine`
- Existing AppShell render-mode ownership rules

**Test scenarios:**
- Happy path: solo race still starts correctly after customizing the character.
- Happy path: private lobby still opens/closes correctly after the appearance sync changes.
- Edge case: multiplayer fallback-to-solo path still works when no room is found.
- Edge case: older saved settings with no appearance overrides still render a valid default character.

**Verification:**
- Targeted unit tests pass, browser smoke tests pass, and no regressions are observed in local race start, private lobby start, or garage tab browsing.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Async GLTF loads reapply stale appearance after the player changes settings | Reuse generation guards and pass normalized appearance snapshots into async completion handlers |
| Shared helper unintentionally changes local in-race visuals | Characterize the existing behavior in helper tests and migrate GameEngine to the shared helper only after parity is verified |
| Room payload growth or malformed client input destabilizes the server | Keep the appearance payload compact, sanitize on both client and server, and fall back safely when data is missing |
| Garage overlay becomes too dense on mobile | Keep controls compact, let the 3D scene remain the hero, and verify on a narrow viewport before declaring complete |
| Dirty worktree conflicts in core files | Read nearby diffs first, patch narrowly, and avoid reverting unrelated changes |

## Verification Strategy

- Unit: `tests/unit/settings.spec.js`
- Unit: `tests/player-appearance.test.mjs`
- Unit/integration: `tests/unit/server-rooms.spec.js`
- Browser: `tests/e2e/profile-settings.spec.js`
- Browser: `tests/e2e/garage-customizer.spec.js`
- Manual visual pass: GARAGE tab, PLAY tab hero, PARTY lobby, then race start from party
