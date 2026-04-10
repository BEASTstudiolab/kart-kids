---
title: "fix: Multiplayer Race Auto-Start — Skip RaceLobby"
type: fix
status: completed
date: 2026-04-10
---

# fix: Multiplayer Race Auto-Start — Skip RaceLobby

## Overview

When entering a multiplayer race (RACE or PARTY mode with active network connection), the race stays in `idle` state and the `RaceLobby` zone-based dwell/ready system activates, showing "Entering lobby..." messages. The race should auto-start with a countdown immediately, just like it does in non-multiplayer mode.

## Problem Frame

Commit `4e46e4d` added auto-start logic that skips `RaceLobby` for non-multiplayer races (`!_multiplayer`). However, when `_multiplayer === true`, the auto-start is skipped entirely. The code expects the server to send `onRaceCountdown` messages to drive the race start, but the server never sends them (or the room isn't fully set up). The result: `_raceMode` stays in `idle`, `RaceLobby.update()` runs every frame (line 1662), and the player sees lobby prompts instead of a countdown.

## Requirements Trace

- R1. Multiplayer races (both `online` and `private` modes) must auto-start with countdown, same as non-multiplayer
- R2. AI fill behavior for multiplayer `online` mode must be preserved
- R3. The `RaceLobby` zone-based system should not activate for any race mode (it's a leftover from an earlier design)

## Scope Boundaries

- No changes to `RaceLobby.js` itself — just stop calling it
- No changes to HUD lobby rendering — it simply won't receive `lobbyActive` state
- No server-side changes
- No changes to `RaceMode.js` countdown/state machine

## Context & Research

### Relevant Code and Patterns

- `js/GameEngine.js:728-767` — The `if (!_multiplayer)` / `else if (mode === 'online')` branching that causes the bug
- `js/GameEngine.js:752-759` — The working auto-start pattern for non-multiplayer (setTimeout + raceMode.start)
- `js/GameEngine.js:1662-1664` — Game loop runs `_raceLobby.update()` when `_raceMode.state === 'idle'`
- `js/RaceLobby.js` — Zone-based dwell/ready system that shows "Entering lobby..."
- `js/HUD.js:267-280` — `_updateLobby()` renders lobby panel when `lobbyState.inZone` is true

## Key Technical Decisions

- **Unify auto-start for all modes**: Remove the `if (!_multiplayer)` gate on auto-start. All modes (solo, online, private) should auto-start with the same 500ms delay + `_raceMode.start()` pattern. The server-driven countdown path (`onRaceCountdown`) can remain wired up but is no longer the sole start mechanism for multiplayer.
- **Keep AI fill for multiplayer online**: The `else if (mode === 'online')` branch at line 761 sets AI count for multiplayer. This logic must be preserved but moved before the unified auto-start block.

## Open Questions

### Resolved During Planning

- **Should we remove RaceLobby entirely?** No — just ensure it never activates. It's dead code now but removing it is a separate cleanup task.
- **What about server-driven countdown?** Keep the `onRaceCountdown`/`onRaceStart` handlers wired up. If a real server eventually drives the countdown, `_raceMode.networkDriven = true` will be set and the local auto-start's `_raceMode.start()` will effectively be a no-op since the state already advanced.

### Deferred to Implementation

- Whether `_raceMode.start()` is safely idempotent if both local auto-start and server countdown fire

## Implementation Units

- [ ] **Unit 1: Unify Auto-Start in GameEngine**

**Goal:** Make all race modes (multiplayer or not) auto-start with countdown, preserving AI fill logic.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `js/GameEngine.js` (lines 725-767)

**Approach:**
- Restructure the AI fill + auto-start block so AI count is determined first (for all modes), then auto-start always fires
- For `mode === 'online'`: set AI count to `8 - playerCount` regardless of `_multiplayer`
- For `mode === 'solo'` or `mode === 'private'`: AI count stays 0
- After AI setup, always run the auto-start setTimeout (currently lines 752-759) — no `_multiplayer` gate
- The existing `onRaceCountdown`/`onRaceStart` handlers at line 778+ remain untouched

**Patterns to follow:**
- Existing auto-start pattern at lines 752-759 (setTimeout, teleportToGrid, raceMode.start, aiManager.startRace)

**Test scenarios:**
- Happy path: Solo/free-play race auto-starts with countdown (existing behavior preserved)
- Happy path: Online multiplayer race auto-starts with countdown instead of showing lobby
- Happy path: Private/party multiplayer race auto-starts with countdown instead of showing lobby
- Happy path: Online mode fills AI slots (8 - playerCount) in both multiplayer and non-multiplayer
- Edge case: Private mode has 0 AI regardless of multiplayer state
- Integration: HUD never shows "Entering lobby..." because raceMode transitions out of `idle` before RaceLobby can activate

**Verification:**
- Start a race in any mode → countdown begins immediately, no lobby prompts shown

## System-Wide Impact

- **RaceLobby**: Effectively becomes dead code — `_raceMode.state` will never be `idle` long enough for `_raceLobby.update()` to produce visible state
- **HUD**: `_updateLobby()` will receive `lobbyState.inZone = false` because the race transitions to `countdown` before the player dwells in the zone
- **Network handlers**: `onRaceCountdown`/`onRaceStart` remain wired but are harmless — if server sends countdown messages, they'll call `setCountdown()` which is safe during or after local countdown
- **Unchanged invariants**: RaceMode state machine, HUD rendering, RaceLobby internals, PlayerManager, AIManager

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `_raceMode.start()` called twice (local + server) | RaceMode state machine only transitions forward — calling start when already in countdown/racing is a no-op |
| RaceLobby becomes dead code | Acceptable — separate cleanup task if desired |

## Sources & References

- Commit `4e46e4d`: fix(race): auto-start race for non-multiplayer — skip RaceLobby dwell/ready
- `js/GameEngine.js` lines 725-800
- `js/RaceLobby.js`
- `js/HUD.js` lines 267-305
