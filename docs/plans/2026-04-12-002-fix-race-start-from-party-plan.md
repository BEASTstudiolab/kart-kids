---
title: "fix: Race start from party lobby — vehicle resolution, multiplayer init, countdown sync"
type: fix
status: completed
date: 2026-04-12
origin: docs/brainstorms/2026-04-12-race-start-from-party-requirements.md
---

# fix: Race start from party lobby

## Overview

When the host clicks Start Race in the party lobby, the race launches in single-player mode with default vehicles because: (1) vehicleId is never forwarded to _createVehicle, (2) customCells triggers the solo path even with a network, (3) the countdown starts before clients finish loading. Four units fix the data flow from lobby through to race.

## Problem Frame

See origin: `docs/brainstorms/2026-04-12-race-start-from-party-requirements.md`

## Requirements Trace

- R1. Local player's selected vehicle used in race
- R2. Remote players show their chosen karts (not trucks)
- R3. initLocalPlayer forwards vehicleId to _createVehicle
- R4. config.network enters multiplayer mode regardless of trackData
- R5. Skip welcome wait when lobby already connected
- R6. Existing players spawned from welcome.existingPlayers
- R9. Server waits for all players to report loaded before countdown
- R10. Client sends raceLoaded after engine finishes loading
- R11. Server countdown gated on raceLoaded with timeout

## Scope Boundaries

- No party lobby changes (already shipped)
- No AI fill, spectator, or new race modes
- No retry/reconnect on raceLoaded timeout
- Legacy solo and online matchmaking paths must remain working

## Context & Research

### Relevant Code and Patterns

- `PlayerManager.initLocalPlayer(welcomeData)` — line 78: calls `_createVehicle(welcomeData.vehicleIndex, ...)` without passing vehicleId as 7th arg
- `PlayerManager.addRemotePlayer(joinData)` — line 118: same gap, calls `_createVehicle(joinData.vehicleIndex, ..., true)` without vehicleId
- `PlayerManager._createVehicle(vehicleIndex, characterIndex, tint, position, angle, isRemote, vehicleId)` — line 315: has three branches. First (`!isRemote && vehicleId`) is the correct path. Third (`else`) falls back to truck models via `VEHICLE_MODEL_NAMES[vehicleIndex % 4]`
- `GameEngine.start()` — line 681: `if ((customCells || config.mode === 'solo') && !config.network)` already fixed to check for network
- `GameEngine.start()` — line 690: config.network fast-path already passes `lastWelcome` to initLocalPlayer
- `server.js startRoomRaceCountdown()` — line 201: starts countdown immediately, no loaded-gate
- `server.js startRace handler` — line 759: stores trackData, calls startRoomRaceCountdown

## Key Technical Decisions

- **Forward vehicleId in both initLocalPlayer and addRemotePlayer**: One-line fix each. The `_createVehicle` method already supports vehicleId — it's just never passed.
- **Remote players also use vehicleId path**: Modify the `_createVehicle` condition from `!isRemote && vehicleId` to just `vehicleId`. Remote players with a vehicleId should get that kart, not a truck.
- **raceLoaded gate on server**: Add a `room.loadedPlayers` Set. When all players in the set, or 15s timeout, start countdown. Simple, no new state machine states needed — just a gate before `startRoomRaceCountdown`.
- **Client sends raceLoaded**: Network.js gets a `sendRaceLoaded()` method. GameEngine calls it after physics init completes (end of `start()`).

## Open Questions

### Resolved During Planning

- **Does addRemotePlayer need vehicleId fix?** Yes — confirmed at line 118, same gap as initLocalPlayer. Both need the 7th argument.
- **raceLoaded timeout?** 15 seconds. Model loads are <3s on localhost, but slow mobile connections may take longer. 15s is generous without being absurdly long.

## Implementation Units

- [ ] **Unit 1: Forward vehicleId in PlayerManager**

  **Goal:** Both initLocalPlayer and addRemotePlayer pass vehicleId to _createVehicle, and _createVehicle uses it for remote players too.

  **Requirements:** R1, R2, R3

  **Dependencies:** None

  **Files:**
  - Modify: `js/PlayerManager.js`

  **Approach:**
  - `initLocalPlayer` (line 81): add `false, welcomeData.vehicleId` as 6th and 7th args to `_createVehicle`
  - `addRemotePlayer` (line 118): add `joinData.vehicleId` as 7th arg to `_createVehicle`
  - `_createVehicle` (line 319): change condition from `!isRemote && vehicleId` to just `vehicleId` so remote players with a vehicleId also get the correct kart model

  **Patterns to follow:**
  - Existing vehicleId lookup at `_createVehicle` line 319-325

  **Test scenarios:**
  - Happy path: Local player with vehicleId 'kart-6' spawns with kart-6 model, not default
  - Happy path: Remote player with vehicleId 'kart-1' spawns with kart-1 model, not truck
  - Edge case: Remote player with no vehicleId (legacy) falls back to VEHICLE_MODEL_NAMES truck
  - Edge case: Local player with vehicleId but vehicleIndex as string — vehicleId path takes priority

  **Verification:**
  - Both players see each other's selected karts in the race, not trucks

- [ ] **Unit 2: Add raceLoaded gate on server**

  **Goal:** Server waits for all players to send `raceLoaded` before starting the 3-2-1 countdown.

  **Requirements:** R9, R11

  **Dependencies:** None (parallel with Unit 1)

  **Files:**
  - Modify: `server.js`

  **Approach:**
  - In `startRace` handler (line 786): instead of calling `startRoomRaceCountdown(room)` directly, set `room.raceState = 'loading'` and broadcast `{ type: 'raceLoading', trackData, trackId }` (replaces the immediate countdown)
  - Add `room.loadedPlayers = new Set()` when entering loading state
  - Add `raceLoaded` message handler: add player to `room.loadedPlayers`, check if all players loaded, if so call `startRoomRaceCountdown(room)`
  - Add 15s timeout: `room.loadingTimeout = setTimeout(() => startRoomRaceCountdown(room), 15000)` — starts countdown even if not all players report
  - Clear timeout when all loaded or when room resets

  **Patterns to follow:**
  - Existing `startRoomRaceCountdown` and `resetRoomRace` patterns in server.js

  **Test scenarios:**
  - Happy path: Both players send raceLoaded → countdown starts
  - Edge case: One player disconnects during loading → timeout fires after 15s, countdown starts with remaining player
  - Edge case: All players load before timeout → timeout is cleared
  - Happy path: raceState transitions idle → loading → countdown → racing

  **Verification:**
  - Countdown doesn't start until both players' game engines are ready

- [ ] **Unit 3: Client sends raceLoaded + handles raceLoading**

  **Goal:** GameEngine sends `raceLoaded` to server after finishing model/physics init. Client handles the new `raceLoading` message to start loading.

  **Requirements:** R10, R4, R5, R6

  **Dependencies:** Unit 2 (server expects raceLoaded)

  **Files:**
  - Modify: `js/Network.js` (add sendRaceLoaded method)
  - Modify: `js/GameEngine.js` (call sendRaceLoaded at end of start, handle raceLoading)
  - Modify: `js/ui/overlays/LobbyOverlay.js` (handle raceLoading instead of raceStart for transition)

  **Approach:**
  - `Network.js`: add `sendRaceLoaded() { this._transport.send({ type: 'raceLoaded' }); }`
  - `GameEngine.start()`: after physics init and player setup complete, call `_network.sendRaceLoaded()` if multiplayer
  - `LobbyOverlay._handleRaceStart`: The lobby currently transitions on `raceStart`. With the new flow, the server sends `raceLoading` first (with trackData), then `raceCountdown`, then `raceStart`. The lobby should transition on `raceLoading` (start loading the game), not wait for `raceStart` (which now comes after countdown).
  - Wire `network.onRaceLoading` in LobbyOverlay to trigger the race load transition with trackData

  **Patterns to follow:**
  - Existing `sendSpectate` pattern in Network.js for fire-and-forget messages
  - Existing `_handleRaceStart` flow in LobbyOverlay for the transition

  **Test scenarios:**
  - Happy path: Host clicks Start → server sends raceLoading → both clients start loading → both send raceLoaded → server starts countdown → clients see 3-2-1 → GO
  - Edge case: Client loads fast, sees "Waiting for players" until all loaded
  - Edge case: Slow client loads after 15s timeout → joins race already in countdown

  **Verification:**
  - No race starts before both players have loaded
  - Both players see the same track and each other's karts

## System-Wide Impact

- **Interaction graph:** LobbyOverlay now listens for `raceLoading` instead of (or in addition to) `raceStart`. Server gets a new `raceLoaded` handler and `loading` state. GameEngine sends `raceLoaded` at end of init.
- **Error propagation:** If `raceLoaded` fails to send, the 15s timeout ensures the race still starts.
- **State lifecycle:** New server room state `loading` between `idle` and `countdown`. Must be handled in `resetRoomRace`.
- **Unchanged invariants:** Solo mode, editor, legacy online matchmaking all unaffected. The vehicleId fix is backward-compatible (falls back to existing behavior when vehicleId is absent).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| vehicleId change breaks remote player truck models | Guard: only use vehicleId path when vehicleId is truthy, else fall back to existing VEHICLE_MODEL_NAMES |
| raceLoading message breaks legacy clients | Legacy matchmaking uses default room auto-countdown, not the host startRace flow |
| 15s timeout too short for slow mobile | Can be tuned later; 15s is 5x the typical load time |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-12-race-start-from-party-requirements.md](docs/brainstorms/2026-04-12-race-start-from-party-requirements.md)
- PlayerManager: `js/PlayerManager.js:78-118, 315-342`
- GameEngine multiplayer init: `js/GameEngine.js:681-743`
- Server race state: `server.js:201-236, 759-788`
- LobbyOverlay race transition: `js/ui/overlays/LobbyOverlay.js:826-900`
