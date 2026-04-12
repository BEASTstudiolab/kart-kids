---
date: 2026-04-12
topic: party-join-name-sync
---

# Party Join & Name Sync Bugs

## Problem Frame

Players cannot join a room created by another player — the server rejects with "Already in a room". Additionally, player display names never sync to other clients, so remote players always appear as "Player 2", "Player 3", etc.

Both bugs block the core multiplayer party flow.

## Requirements

**Room Join**
- R1. A player joining a room by code must not be blocked by the 200ms auto-join default-room timeout — the auto-join must be gated so it does not fire when a client intends to join a specific room
- R2. If a player is already in the default room when they attempt to join a specific room, the server must cleanly transition them (leave default → join target) without requiring client-side workarounds

**Name Sync**
- R3. The client must send its display name to the server when joining a room (via `createRoom`, `joinRoom`, or `findRoom`)
- R4. The server must include the player's display name in the `playerJoin` broadcast and in the `existingPlayers` array of the `welcome` message
- R5. The lobby UI must render synced display names for remote players instead of falling back to "Player N"

## Success Criteria

- Two clients can reliably create and join the same room by code without "Already in a room" errors
- Each player's chosen display name appears correctly in all other players' lobby member lists

## Scope Boundaries

- No changes to the party page (page 06) — it is mock-only and out of scope
- No friend system or presence features
- No name uniqueness enforcement — duplicates are fine
- Existing `sanitizePlayerName()` is sufficient for XSS protection on received names

## Key Decisions

- Auto-join gating (R1/R2): The 200ms auto-join timeout is the root cause of the join failure — it must be reworked, not worked around on the client side
- Name field location: Display name travels in the join message payload, not as a separate protocol message — keeps the protocol simple

## Next Steps

→ `/ce:plan` for structured implementation planning
