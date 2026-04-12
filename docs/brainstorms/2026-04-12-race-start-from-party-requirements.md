---
date: 2026-04-12
topic: race-start-from-party
---

# Race Start from Party Lobby

## Problem Frame

When the host clicks Start Race in the party lobby, the race launches but players don't see each other and their selected vehicles are ignored. The GameEngine's multiplayer init was built for the legacy matchmaking flow and doesn't handle the lobby-first party path where the network is already connected, vehicles are identified by string IDs (not numeric indices), and track data comes from the lobby config.

## Requirements

**Vehicle Resolution**
- R1. The local player's selected vehicle (string ID like `kart-6`) must be used when spawning their kart in the race, not the server's `vehicleIndex`
- R2. Remote players' karts must use their `vehicleId` from `playerJoin`/`existingPlayers` messages, not fall back to truck models via the numeric `VEHICLE_MODEL_NAMES` array
- R3. `PlayerManager.initLocalPlayer()` must forward `welcomeData.vehicleId` to `_createVehicle` so the correct model lookup path is used

**Multiplayer Race Init**
- R4. When the party lobby passes `config.network` to GameEngine, the engine must enter multiplayer mode and wire up player join/leave/world update handlers — regardless of whether `trackData` (custom cells) is present
- R5. The engine must not wait for a `welcome` message when it already has one from the lobby connection — use `network.lastWelcome` for player init
- R6. Existing players from `welcome.existingPlayers` must be spawned as remote players when the race loads

**Track Sync**
- R7. The host's selected track data must be delivered to all clients via the `raceStart` server broadcast — this already works (server stores `room.trackData` from the host's `startRace` message)
- R8. Both the host and guest must load the same track cells from the `raceStart` message, not fall back to different random tracks

**Countdown Sync**
- R9. The server must wait for all players in the room to report "loaded" before starting the 3-2-1 countdown
- R10. Each client sends a `raceLoaded` message to the server after GameEngine finishes loading models and physics
- R11. The server starts the countdown only when all connected players have sent `raceLoaded` (or after a timeout to handle disconnected players)

## Success Criteria

- Host clicks Start Race → both players load the same track, see each other's chosen karts, and race together
- The 3-2-1 countdown doesn't begin until all players have finished loading
- The existing solo and legacy online matchmaking flows are unaffected

## Scope Boundaries

- No changes to the party lobby itself (join, names, kart display — already shipped)
- No new race modes or game types
- No spectator mode changes
- No AI fill for party races (defer to separate feature)
- `raceLoaded` timeout should be simple (e.g., 15s) — no retry or reconnect logic

## Key Decisions

- **Use vehicleId (string) as the primary vehicle identifier throughout**: The server already stores and broadcasts `vehicleId`. The `vehicleIndex` numeric field is a legacy artifact from before the kart registry existed. `_createVehicle` already has the `vehicleId` lookup path — it's just not being called.
- **Wait-for-loaded before countdown**: Prevents the jarring experience of spawning into a race that's already counting down or started. Simple server-side gate with a timeout fallback.

## Dependencies / Assumptions

- Party lobby join flow works (shipped in previous commit)
- `network.lastWelcome` stores the most recent welcome message (shipped)
- `config.network` passthrough to GameEngine works (shipped)

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Needs research] Does `addRemotePlayer` in PlayerManager correctly handle `vehicleId` from `joinData`, or does it also need the same fix as `initLocalPlayer`?
- [Affects R11][Technical] What timeout value for `raceLoaded`? 15s seems reasonable but may need tuning based on model load times on slow connections.

## Next Steps

-> `/ce:plan` for structured implementation planning
