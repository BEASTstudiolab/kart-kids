---
title: "feat: Add live race position and top-three leaderboard HUD"
type: feat
status: completed
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-race-position-top-three-hud-requirements.md
---

# feat: Add live race position and top-three leaderboard HUD

## Overview

Add a racing-only HUD layer that shows the local player's current place plus a live top-three leaderboard. Reuse the existing race-state loop, AI race data, and multiplayer lap broadcasts so the HUD is accurate in solo, AI, and multiplayer races without inventing a second ranking system.

## Problem Frame

RaceMode already tracks the local player's numeric position, but the runtime HUD never exposes it to the player. That leaves races feeling harder to read, especially once AI opponents and multiplayer rooms are in play. This plan turns the existing race-state machinery into a player-facing leaderboard while preserving the product decisions from the origin requirements: strict top three, separate player place, racing-only visibility, real racer names when available, and accurate cross-lap multiplayer ordering. (see origin: `docs/brainstorms/2026-04-13-race-position-top-three-hud-requirements.md`)

## Requirements Trace

- R1. Show the local player's current place throughout `RACING`
- R2. Format the local player's place as an ordinal label
- R3. Keep the player-place badge visible when the player is outside the top three
- R4. Show a compact top-right live top-three leaderboard
- R5. Each leaderboard row shows placement plus racer name
- R6. Keep the leaderboard strict to the actual top three rather than swapping in the local player
- R7. Render only the positions that exist when fewer than three racers are present
- R8. Use one ordering model for both the badge and the leaderboard
- R9. Rank remote human racers correctly across laps in multiplayer
- R10. Use real racer identity labels when a display name is available
- R11. Fall back to a stable non-empty label when a racer name is unavailable
- R12. Show the new race-position UI only during `RACING`
- R13. Keep the new HUD elements from obscuring the minimap, lap/time HUD, or boost meter
- R14. Keep the new HUD readable on desktop and touch-oriented layouts

## Scope Boundaries

- No countdown, idle, or finished-state leaderboard behavior
- No gaps, lap splits, speed, or other extra stats in leaderboard rows
- No results-screen redesign
- No spectator-specific leaderboard behavior
- No server protocol changes unless implementation proves the current client-visible race data is insufficient

## Context & Research

### Relevant Code and Patterns

- `js/RaceMode.js` already owns local race timing and current place. `getDisplayState()` exposes `position`, while `_updatePosition()` currently ranks AI by `lap + progress` and remote humans by progress only.
- `js/GameEngine.js` already updates `RaceMode` once per frame, wires `NetworkClient` race callbacks, and consumes `displayState.position` for item-box weighting. `onPlayerLap` is currently a no-op, which is the cleanest seam for remote lap tracking.
- `js/HUD.js` is the established runtime HUD pattern: programmatic DOM creation, inline `style.cssText`, state-driven `update()` rendering, and fixed-position overlays that coexist with the minimap and boost meter.
- `js/PlayerManager.js` already receives remote join payloads with `id`, `vehicle`, and `name`, but it discards the name after spawning the vehicle. That makes it the right place to preserve human-racer identity for the race HUD.
- `js/AIManager.js` already exposes per-AI `profileName` through `getAIRaceData()`, which gives the leaderboard a usable AI label source immediately.
- `js/Settings.js` already exposes the local display name, which is the lowest-friction source for naming the local racer in solo and multiplayer HUD rows.
- `js/Network.js` and `server.js` already carry the multiplayer signals this feature needs: `welcome` / `playerJoin` / `raceLoading.players` include racer names, and `playerLap` broadcasts remote lap completions by player id.
- `js/ui/overlays/LobbyOverlay.js` already uses `Player N` fallback labels for unnamed remote players. Reusing that fallback behavior will keep race HUD naming consistent with lobby naming.
- `js/ui/pages/page12-profile/Page12ProfileView.js` already has a simple first/second/third visual treatment for position chips that can inform podium styling without introducing a new visual language.

### Institutional Learnings

- No `docs/solutions/` entries exist for this area yet.

## Key Technical Decisions

- **Keep ranking client-side and reuse existing network messages:** The server already broadcasts the signals needed for names and remote lap counts. This feature should extend the client data contract before adding new protocol surface.
- **Make `RaceMode` the single source of truth for leaderboard state:** The same ranked entry list should drive the local place badge, top-three panel, and existing item-box position weighting. That avoids desynchronization between gameplay balance and HUD presentation.
- **Promote human-racer metadata out of `PlayerManager`:** `PlayerManager` already owns the active human vehicles, so it should also own the stable id-to-name/fallback mapping that `RaceMode` consumes during ranking.
- **Resolve name precedence at the client edge:** Use the best-known identity in this order: explicit local display name when available, synced remote player name, AI profile name, then a stable fallback label such as `PLAYER 2`. This keeps the HUD readable even when name data is delayed.
- **Treat layout tuning as visual polish, not product scope:** The plan will define the structural HUD surfaces and readability constraints, but final offsets and spacing can be tuned during browser verification as long as the required visibility rules hold.

## Open Questions

### Resolved During Planning

- **Do we need a server change for multiplayer ranking?** No by default. The current protocol already exposes `playerLap`, `welcome`, `playerJoin`, and `raceLoading.players`, which is enough to build correct client-side cross-lap ranking unless implementation proves otherwise.
- **Which name wins if data is missing?** Use the strongest currently available label and never render a blank row. Local player rows may fall back to `YOU` if no local display name is available in solo mode.

### Deferred to Implementation

- **Exact HUD offsets on smaller touch layouts:** The readability requirement is fixed, but the final top-right panel width, badge placement, and truncation thresholds should be tuned during browser verification.
- **Whether to visually accent the local player's row when they are inside the top three:** This is presentation polish, not a product requirement, and can be decided during implementation without changing behavior.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
flowchart LR
  A[welcome / playerJoin / raceLoading.players] --> B[PlayerManager stores human racer metadata]
  C[playerLap] --> D[RaceMode remote lap map]
  B --> E[human race data]
  F[AIManager.getAIRaceData()] --> G[RaceMode unified ranking]
  E --> G
  H[local vehicle + local lap] --> G
  G --> I[displayState.position]
  G --> J[displayState.positionLabel]
  G --> K[displayState.leaders]
  I --> L[ItemBoxManager weighting]
  J --> M[HUD player-place badge]
  K --> N[HUD top-right leaderboard]
```

## Implementation Units

- [x] **Unit 1: Human racer metadata surface**

**Goal:** Preserve local and remote human racer identity data in the runtime player layer and expose a ranking-friendly roster for race systems.

**Requirements:** R5, R10, R11

**Dependencies:** None

**Files:**
- Modify: `js/PlayerManager.js`
- Modify: `js/GameEngine.js`
- Test: `tests/player-manager-race-data.test.mjs`

**Approach:**
- Extend the `PlayerManager` player records so they retain a stable display label alongside `vehicle` and `spectating` state instead of discarding `joinData.name`.
- Ensure the local player also has a non-empty race label sourced from existing runtime inputs (`Settings`, network welcome/config, or a local fallback) so the HUD can name the local racer consistently.
- Add a read-only helper surface that returns active human race data in a form `RaceMode` can consume without digging through raw player internals. The roster should include at least racer id, active vehicle, and resolved display label / fallback label.
- Keep fallback labels stable for the lifetime of a race session so unnamed remote racers do not flicker between labels as entries are added or removed.

**Patterns to follow:**
- `js/PlayerManager.js` player record lifecycle and active-vehicle caching
- `js/Settings.js` display-name getter as the existing local identity source
- `js/ui/overlays/LobbyOverlay.js` fallback naming pattern for unnamed remote members
- `js/GameEngine.js` network-backed player initialization path using `config.network`, `lastWelcome`, and `config.players`

**Test scenarios:**
- Happy path: initializing a local player produces a human-race entry with a non-empty label and matching vehicle reference
- Happy path: `existingPlayers` and later `playerJoin` events preserve synced remote names in the human-race data surface
- Edge case: a remote racer with no provided name receives a stable fallback label that remains unchanged across repeated reads
- Integration: removing a remote player removes their human-race entry and does not corrupt the remaining racers' labels

**Verification:**
- The game loop can query `PlayerManager` for active human race entries and receives stable ids, vehicles, and display labels for every non-spectating human racer.

- [x] **Unit 2: Unified ranking and leaderboard state in RaceMode**

**Goal:** Replace the split ranking logic with one leaderboard model that ranks local, AI, and remote human racers consistently and exposes HUD-ready race-position data.

**Requirements:** R1, R2, R3, R6, R7, R8, R9, R10, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `js/RaceMode.js`
- Modify: `js/GameEngine.js`
- Test: `tests/race-mode-position-leaderboard.test.mjs`

**Approach:**
- Add a `RaceMode`-owned remote lap-tracking surface keyed by remote player id and fed from the existing `playerLap` network callback in `js/GameEngine.js`.
- Change the per-frame ranking input from generic `activeVehicles` to explicit human-race data plus AI race data so `RaceMode` can rank humans by id, vehicle, lap, and display label instead of blind vehicle objects.
- Build one ranked entry list per frame using the same comparison model for every racer type: local lap + progress, AI lap + progress, remote lap + progress. Preserve elimination filtering so removed racers do not remain in the order.
- Publish the results through `getDisplayState()` as a numeric `position`, a preformatted ordinal `positionLabel`, and a `leaders` array containing only the current podium rows in sorted order.
- Keep `displayState.position` numeric and backward-compatible so downstream item-balance logic continues to work without special casing.
- Clear remote lap state and cached leaderboard state on race start/reset so stale multiplayer data cannot leak into the next race.

**Execution note:** Implement this unit test-first. The ranking model is now shared between gameplay balancing and the visible HUD, so regressions here will be user-facing and mechanical at the same time.

**Patterns to follow:**
- `js/RaceMode.js` existing `getDisplayState()` cache and `_updatePosition()` ranking path
- `js/AIManager.js` `getAIRaceData()` structure
- `js/Network.js` `onPlayerLap` callback seam and `server.js` `playerLap` broadcast semantics

**Test scenarios:**
- Happy path: a solo race with AI returns the correct local position, ordinal label, and top-three rows when racers are ordered by lap plus track progress
- Happy path: a remote human racer on a higher lap ranks ahead of a racer with better same-lap progress
- Happy path: when the local player is outside the top three, the `leaders` array still contains only places 1-3 while `position` reflects the local player's true place
- Edge case: races with one or two total racers return only the existing leaderboard rows and never include placeholders
- Edge case: duplicate or stale `playerLap` updates do not move a remote racer backward in the ranking model
- Integration: `displayState.position` and `displayState.leaders[0..2]` remain internally consistent so item-box weighting and HUD rendering observe the same order

**Verification:**
- In multiplayer simulations, racers on different laps are ordered correctly and `RaceMode.getDisplayState()` contains enough data for the HUD without any extra ranking logic in the view layer.

- [x] **Unit 3: Race HUD position badge and top-three panel**

**Goal:** Render the new player-place badge and top-right leaderboard in the runtime HUD while preserving the readability of the existing race HUD.

**Requirements:** R1, R3, R4, R5, R6, R7, R12, R13, R14

**Dependencies:** Unit 2

**Files:**
- Modify: `js/HUD.js`
- Test: `tests/hud-race-position.test.mjs`

**Approach:**
- Add two new HUD surfaces to `js/HUD.js`: a dedicated player-place badge and a reusable top-right leaderboard panel with row nodes that can be updated from `displayState.leaders`.
- Update `HUD.update()` so the new elements render only during `racing`, hide during idle/countdown/finished, and continue to coexist with the current lap/time HUD, minimap, and boost meter.
- Render only the leaders that exist, trim or clamp long names rather than letting rows overflow, and keep the player-place badge visible even when the player also appears inside the top three.
- Add light responsive adjustments for narrow layouts so the panel width, badge placement, and text sizing remain readable on touch-oriented screens without blocking the minimap or center HUD.

**Execution note:** Browser verification matters for this unit even after automated tests pass. The automated tests should prove state wiring and visibility rules; the final layout pass should prove readability and non-overlap.

**Patterns to follow:**
- `js/HUD.js` fixed-position DOM overlay and `style.cssText` pattern
- `js/ui/pages/page07-events/Page07EventsView.js` top-right leaderboard/sidebar composition
- `js/ui/pages/page12-profile/Page12ProfileView.js` first/second/third position chip styling cues

**Test scenarios:**
- Happy path: in `racing` state, the HUD shows the player-place badge plus the expected leaderboard rows from `displayState.leaders`
- Happy path: when the local player is first, the leaderboard still shows the normal podium rows and the separate player badge remains visible
- Edge case: countdown, idle, and finished states hide the new elements completely
- Edge case: one- and two-racer fields render only the available rows and do not leave empty placeholders behind
- Edge case: a long racer name is visually clamped or truncated so the top-right panel stays within its intended width
- Integration: the new elements can render alongside the existing lap/time HUD fields in `racing` state without disabling the existing boost and powerup indicators

**Verification:**
- In a live race, the player-place badge and top-right leaderboard remain readable on desktop and touch layouts without covering the minimap, lap/time panel, or boost meter.

## System-Wide Impact

- **Interaction graph:** `NetworkClient.onPlayerLap` feeds `GameEngine`, which feeds `RaceMode`; `PlayerManager` supplies human racer metadata; `AIManager` supplies AI race data; `RaceMode.getDisplayState()` feeds both `HUD` and the existing item-box weighting path.
- **Error propagation:** Missing or late racer names should degrade to stable fallback labels instead of blank UI. Missing remote lap updates should only affect that racer's ordering, not break the HUD render path.
- **State lifecycle risks:** Remote lap maps, cached leaderboard rows, and fallback labels must reset cleanly on race restart, countdown restart, player leave, and room transitions so stale racers do not linger in the HUD.
- **API surface parity:** `displayState.position` is already used outside the HUD. Any leaderboard expansion must preserve that numeric field so existing gameplay systems continue to behave.
- **Integration coverage:** Unit tests will not fully prove real-time multiplayer ordering. A manual two-client pass is required to confirm `playerLap` events and live world-state updates stay aligned through lap transitions.
- **Unchanged invariants:** Countdown flow, results overlay, lobby UI, and server room protocol should remain behaviorally unchanged by this feature unless implementation reveals a missing client-side signal.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Remote lap state persists across restarts or disconnects and corrupts the next race | Clear remote lap tracking on `start()`, `reset()`, and player-removal paths; verify with restart/disconnect scenarios |
| HUD overlap on narrow layouts makes the leaderboard unreadable | Keep the new panel compact, add width/text clamping, and require browser verification on both desktop and touch-sized viewports |
| Local/leaderboard ordering diverges from item-box weighting | Derive all three surfaces from one `RaceMode` ranking model and add explicit integration tests around `displayState.position` + `leaders` consistency |
| Missing local display name in solo mode produces an awkward top-three row | Resolve local label precedence up front and fall back to `YOU` only when a real local display name is unavailable |

## Documentation / Operational Notes

- No rollout or server deployment plan is expected if the implementation stays within the current client-visible race protocol.
- If implementation reveals a true protocol gap, return to planning or explicitly append a follow-up unit rather than making an ad hoc server change.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-13-race-position-top-three-hud-requirements.md](docs/brainstorms/2026-04-13-race-position-top-three-hud-requirements.md)
- Related code: `js/RaceMode.js`, `js/HUD.js`, `js/GameEngine.js`, `js/PlayerManager.js`, `js/AIManager.js`, `js/Network.js`, `server.js`
- Related plan: [docs/plans/2026-03-30-001-feat-race-state-machine-hud-plan.md](docs/plans/2026-03-30-001-feat-race-state-machine-hud-plan.md)
