---
title: "feat: RACE Mode AI Fill"
type: feat
status: active
date: 2026-04-10
origin: docs/brainstorms/2026-04-10-race-mode-ai-fill-requirements.md
---

# feat: RACE Mode AI Fill

## Overview

After matchmaking resolves in RACE mode, fill remaining grid slots with AI drivers so every race has 8 racers. FREE PLAY and PARTY modes are unaffected (no AI spawned).

## Problem Frame

RACE mode matchmaking will often find few or zero other players. Without opponents the race feels empty. The game already has AIManager with up to 8 AI slots — we just need to wire it to the mode and player count.

(see origin: docs/brainstorms/2026-04-10-race-mode-ai-fill-requirements.md)

## Requirements Trace

- R1. 8-racer grid: player + up to 7 AI.
- R2. Matchmaking runs 30s, then fill remaining with AI.
- R3. AI count = 8 - human players.
- R4. No AI in FREE PLAY.
- R5. No AI in PARTY.
- R6. Use existing AIManager.setCount().
- R7. AI fill at race start, after matchmaking resolves.

## Scope Boundaries

- No changes to AI behavior, pathfinding, or difficulty.
- No mid-race player-for-AI swapping.
- No changes to matchmaking networking.

## Key Technical Decisions

- **AI fill in GameEngine.start()**: The config object already carries `mode`. After AIManager is created (line 722), call `setCount()` based on mode and player count. This is the simplest integration point — no new files, no new APIs.
- **Player count from config**: For solo mode, playerCount is always 1. For online, the server knows how many players joined — pass this in the config as `playerCount`. For private, no AI fill.
- **Default aiCount setting ignored in RACE mode**: The existing `aiCount` debug setting (Settings menu) still works for development, but RACE mode overrides it with the calculated fill count.

## Open Questions

### Resolved During Planning

- **Where does AI fill logic live?** In GameEngine.start(), right after AIManager is created (line 722). The config already has `mode` — add `playerCount` to the config for online races.
- **How does the client know the player count?** For online races, the server's raceStart message includes the player list. RacePanel passes `playerCount` in the startRace config based on the matchmaking result.

### Deferred to Implementation

- Exact field name in the matchmaking result for player count — check what `findRoom()` returns.

## Implementation Units

- [ ] **Unit 1: AI Fill in GameEngine.start()**

**Goal:** After AIManager is created, set the AI count based on mode and player count. RACE = fill to 8, FREE PLAY = 0, PARTY = 0.

**Requirements:** R1, R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**
- Modify: `js/GameEngine.js`

**Approach:**
- After line 723 (`_aiManager.totalLaps = 3`), add mode-based AI fill logic
- Read `config.mode` and `config.playerCount` (default 1)
- If mode is `'online'` (RACE): `_aiManager.setCount(8 - playerCount)`
- If mode is `'solo'` (FREE PLAY): `_aiManager.setCount(0)`
- If mode is `'private'` (PARTY): `_aiManager.setCount(0)`
- If no mode specified (legacy/debug): fall back to existing Settings `aiCount` behavior
- The existing `aiCount` settings listener (line 1144) continues to work for debug overrides

**Patterns to follow:**
- Existing `_aiManager.setCount(value)` call at line 1146
- Existing `config.mode` usage in the startRace config pattern

**Test scenarios:**
- Happy path: RACE mode with 1 player → 7 AI spawned
- Happy path: RACE mode with 3 players → 5 AI spawned
- Happy path: FREE PLAY mode → 0 AI spawned
- Happy path: PARTY mode with 2 players → 0 AI spawned
- Edge case: RACE mode with 8 players → 0 AI spawned
- Edge case: No mode specified → falls back to Settings aiCount

**Verification:**
- RACE mode always produces 8 total racers. FREE PLAY and PARTY have zero AI.

---

- [ ] **Unit 2: Pass playerCount in startRace Config**

**Goal:** When starting an online race, include the player count in the config so GameEngine knows how many AI to spawn.

**Requirements:** R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- In `_startOnlineMatchmaking()`, after `findRoom()` resolves, determine the player count from the result
- Pass `playerCount` in the `startRace()` config: `{ mode: 'online', trackData, vehicleId, playerCount, roomCode, network }`
- For solo mode, playerCount is implicitly 1 (GameEngine defaults to 1 if not provided)
- For party mode, playerCount doesn't matter (AI fill is skipped)

**Patterns to follow:**
- Existing `startRace()` config shape in RacePanel._startOnlineMatchmaking()

**Test scenarios:**
- Happy path: Online matchmaking result includes player count → passed to startRace config
- Edge case: findRoom result has no player count info → default to 1

**Verification:**
- Online race config includes playerCount. GameEngine receives it and spawns correct AI count.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-10-race-mode-ai-fill-requirements.md](docs/brainstorms/2026-04-10-race-mode-ai-fill-requirements.md)
- AIManager: js/AIManager.js (setCount, 8-slot capacity)
- GameEngine: js/GameEngine.js (line 722 — AIManager creation, line 1144 — aiCount setting)
- RacePanel: js/ui/panels/RacePanel.js (_startOnlineMatchmaking)
