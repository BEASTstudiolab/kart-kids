---
title: "fix: Party join blocked by auto-join + player names not synced"
type: fix
status: completed
date: 2026-04-12
origin: docs/brainstorms/2026-04-12-party-join-name-sync-requirements.md
---

# fix: Party join blocked by auto-join + player names not synced

## Overview

Two bugs block multiplayer party flow: (1) the server's 200ms auto-join timeout fires before clients send `createRoom`/`joinRoom`/`findRoom`, so the `hasJoinedRoom` guard rejects them with "Already in a room"; (2) player display names are never sent over the wire, so remote players always appear as "Player N".

## Problem Frame

See origin: `docs/brainstorms/2026-04-12-party-join-name-sync-requirements.md`

## Requirements Trace

- R1. Auto-join must not block explicit room joins
- R2. Server must cleanly transition a player from default room to a specific room
- R3. Client must send display name when joining
- R4. Server must include display name in `playerJoin` broadcast and `welcome.existingPlayers`
- R5. Lobby UI must render synced display names

## Scope Boundaries

- No changes to party page (page 06) — mock-only
- No name uniqueness enforcement
- No friend/presence features
- Existing `sanitizePlayerName()` is sufficient for XSS protection

## Context & Research

### Relevant Code and Patterns

- `server.js:468-500` — Auto-join timeout: sets `hasJoinedRoom = true` after 200ms, calls `addPlayerToRoom` for default room
- `server.js:521-538` — `createRoom` handler: guards on `hasJoinedRoom`, calls `clearTimeout(autoJoinTimeout)` — but too late if timeout already fired
- `server.js:542-572` — `joinRoom` handler: same guard pattern, same race
- `server.js:576-612` — `findRoom` handler: same
- `server.js:337-410` — `addPlayerToRoom()`: builds player object (no `name` field), sends `welcome` with `existingPlayers` (no `name`), broadcasts `playerJoin` (no `name`)
- `js/Network.js:329-405` — Client `createRoom()`, `joinRoom()`, `findRoom()` — none send a `name` field
- `js/Settings.js:143-155` — `getDisplayName()` / `setDisplayName()` — local-only storage
- `js/ui/overlays/LobbyOverlay.js:801` — Fallback: `msg.name ?? 'Player ${this._members.length + 1}'`
- `js/ui/pages/page05-lobby/Page05LobbyController.js:321` — Same fallback pattern

## Key Technical Decisions

- **Cancel auto-join instead of leaveRoom + rejoin**: The cleanest fix is to `clearTimeout(autoJoinTimeout)` at the top of each room handler *before* the `hasJoinedRoom` guard. The 200ms race is the bug — if the timeout fires first, the guard blocks the real join. Moving the `clearTimeout` above the guard eliminates the race entirely. R2 becomes unnecessary because the player never enters the default room in the first place.
- **Name as a field on the player object**: Store `name` on the server-side player record (alongside `vehicleIndex`, `tint`, etc.) and include it in `welcome.existingPlayers` and `playerJoin` broadcasts. No separate message type needed.

## Open Questions

### Resolved During Planning

- **Should auto-join be removed entirely?** No — it provides backward compatibility for clients that connect without sending a room message (e.g., old bookmarks, direct URL). The 200ms delay is fine; the bug is that `clearTimeout` runs after the guard instead of before it.
- **Max name length on server?** Clamp to 20 chars server-side to match `sanitizePlayerName()` in the client.

### Deferred to Implementation

- None

## Implementation Units

- [ ] **Unit 1: Fix auto-join race in server room handlers**

  **Goal:** Ensure `clearTimeout(autoJoinTimeout)` runs before the `hasJoinedRoom` guard in `createRoom`, `joinRoom`, and `findRoom` handlers.

  **Requirements:** R1, R2

  **Dependencies:** None

  **Files:**
  - Modify: `server.js`

  **Approach:**
  In each of `createRoom`, `joinRoom`, `findRoom` handlers: move `clearTimeout(autoJoinTimeout)` to be the first line of the case block, before the `if (hasJoinedRoom)` guard. This way, even if the timeout hasn't fired yet, it gets cancelled; and if the timeout already fired, `hasJoinedRoom` is `true` but we need to handle that — so also reset `hasJoinedRoom` to `false` after clearing the timeout when the player is in the default room, and call `removePlayerFromRoom` to leave the default room first. Actually, the simpler approach: just move `clearTimeout` above the guard. If the timeout already fired (200ms race lost), the player is in the default room with `hasJoinedRoom = true`. In that case, instead of rejecting, leave the default room and proceed. So: `clearTimeout` first, then if `hasJoinedRoom && clientInfo`, leave current room and reset `hasJoinedRoom = false`, then proceed with the join.

  **Patterns to follow:**
  - Existing `leaveRoom` handler at `server.js:614-628` for room departure logic

  **Test scenarios:**
  - Happy path: Client sends `joinRoom` within 200ms — joins successfully, no error
  - Happy path: Client sends `createRoom` within 200ms — creates and joins, no error
  - Edge case: Client sends `joinRoom` after 200ms (auto-join already fired) — server leaves default room, joins target room, no error
  - Edge case: Client sends `findRoom` — same behavior as above

  **Verification:**
  - Two browser tabs: Tab A creates room, Tab B joins by code — no "Already in a room" error

- [ ] **Unit 2: Add name to multiplayer protocol**

  **Goal:** Client sends display name in room join messages; server stores it on the player record and includes it in `playerJoin` broadcasts and `welcome.existingPlayers`.

  **Requirements:** R3, R4

  **Dependencies:** None (can be done in parallel with Unit 1)

  **Files:**
  - Modify: `server.js` (player record in `addPlayerToRoom`, `welcome` message, `playerJoin` broadcast)
  - Modify: `js/Network.js` (`createRoom`, `joinRoom`, `findRoom` — add `name` field from `Settings.getDisplayName()`)

  **Approach:**
  - Client side: In `Network.js`, import or accept a name parameter and include `name` in the message payload for `createRoom`, `joinRoom`, and `findRoom`. The caller already has access to `Settings` — pass the name through.
  - Server side: Accept `msg.name` in each handler, clamp to 20 chars, pass to `addPlayerToRoom`. Store `name` on the player object. Include `name` in the `existingPlayers` array entries and in the `playerJoin` broadcast.

  **Patterns to follow:**
  - Existing `vehicleId` field flows the same way: client sends it in the message, server passes it to `addPlayerToRoom`, stored on player, included in broadcasts

  **Test scenarios:**
  - Happy path: Player A creates room with name "Alice", Player B joins — B's `welcome.existingPlayers[0]` contains `name: "Alice"`
  - Happy path: Player B joins — A receives `playerJoin` with `name: "Bob"`
  - Edge case: Player joins with no name set — server stores empty string or null, client falls back gracefully
  - Edge case: Player sends name longer than 20 chars — server clamps to 20

  **Verification:**
  - Console-log or network inspector shows `name` field in `welcome` and `playerJoin` messages

- [ ] **Unit 3: Render synced names in lobby UI**

  **Goal:** Lobby overlay and lobby page controller use the synced `name` field from network messages instead of falling back to "Player N".

  **Requirements:** R5

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `js/ui/overlays/LobbyOverlay.js` (line ~801, `playerJoin` handler)
  - Modify: `js/ui/pages/page05-lobby/Page05LobbyController.js` (line ~321, `playerJoin` handler)

  **Approach:**
  - Both files already have `msg.name ?? 'Player N'` fallback — once Unit 2 populates `msg.name`, the existing code will render it correctly. Verify and adjust if the fallback logic needs updating for `existingPlayers` in the `welcome` handler as well.
  - Check the `welcome` handler in both files to ensure `existingPlayers` entries also use the `name` field.

  **Patterns to follow:**
  - Existing fallback pattern: `msg.name ?? 'Player ${n}'` — keep as safety net

  **Test scenarios:**
  - Happy path: Two players in lobby — each sees the other's chosen display name
  - Happy path: `existingPlayers` on late join — new player sees all existing players' names
  - Edge case: Player with no name set — displays "Player N" fallback

  **Verification:**
  - Two browser tabs in lobby: each shows the other player's actual display name, not "Player 2"

## System-Wide Impact

- **Interaction graph:** Only `server.js` WebSocket handlers and `Network.js` client methods change. No middleware, observers, or callbacks affected.
- **Error propagation:** The "Already in a room" error path changes from rejection to graceful transition — existing error handlers in UI remain unchanged.
- **State lifecycle risks:** The auto-join fix introduces a brief window where a player leaves the default room and joins a new one — ensure `connectedClients` map is updated atomically.
- **API surface parity:** The `reconnect` handler also has the `hasJoinedRoom` guard — verify it doesn't need the same fix (it already calls `clearTimeout`, and reconnect is a different flow).
- **Unchanged invariants:** The 20Hz tick loop, race state machine, spectator logic, and all other WebSocket message types are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Auto-join removal breaks legacy direct-URL clients | Auto-join is preserved — only the guard ordering changes |
| Name field missing causes UI regression | Existing `?? 'Player N'` fallback remains as safety net |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-12-party-join-name-sync-requirements.md](docs/brainstorms/2026-04-12-party-join-name-sync-requirements.md)
- Server room logic: `server.js:337-650`
- Client network: `js/Network.js:329-405`
- Lobby UI: `js/ui/overlays/LobbyOverlay.js`, `js/ui/pages/page05-lobby/Page05LobbyController.js`
