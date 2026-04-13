---
title: "fix: spread multiplayer racers across the starting grid"
type: fix
status: active
date: 2026-04-13
origin: direct user request (2026-04-13)
---

# fix: spread multiplayer racers across the starting grid

## Overview

Make multiplayer race spawns deterministic and non-overlapping by assigning each human racer a stable starting-grid slot and spawning both local and remote karts from that shared slot data instead of the current per-client offset guess.

## Problem Frame

The current multiplayer spawn flow is inconsistent in two ways:

- `js/PlayerManager.js` spawns the local racer at the raw finish-line origin while remote racers are offset client-side.
- Those remote offsets are derived from the local `players.size`, so different clients can disagree about which racer belongs in which lane.
- `_computeSpawnOffset()` only uses four lateral lanes and wraps after index 3, so larger rooms can still overlap racers on the same exact position.

This creates stacked starts or divergent grid layouts between clients, which is especially visible in private/multiplayer races.

## Requirements Trace

- R1. Human racers in multiplayer races spawn in unique positions instead of stacking on the same spot.
- R2. The same player should occupy the same starting-grid slot on every client.
- R3. Grid placement should support the room limit without wrapping two racers onto the same lane.
- R4. Existing solo spawn behavior and non-race room flows remain intact.
- R5. Add regression coverage for slot propagation and grid-position calculation.

## Scope Boundaries

- No changes to solo spawning, AI spawning randomness, or respawn checkpoint logic.
- No redesign of lobby UI or room membership presentation.
- No server-authoritative movement system; this is only about initial multiplayer spawn placement.

## Context & Research

### Relevant Code and Patterns

- `server.js` already assigns each room member a stable join-order index (`joinCounter`) and fans player metadata out through `welcome`, `existingPlayers`, `playerJoin`, reconnect, and `raceLoading` payloads.
- `js/PlayerManager.js` owns local and remote human vehicle creation, so it is the right place to compute per-player starting poses.
- `js/GameEngine.js` already passes `lastWelcome` and `raceLoading.players` into `PlayerManager`, so adding a spawn-slot field to those payloads fits the existing bootstrap flow.
- `js/AIManager.js` already contains a row-and-column grid placement pattern that confirms multi-row start placement is an established local convention.

### External Research Decision

No external research is needed. This is a repo-local networking and spawn-layout fix.

## Key Technical Decisions

- **Use a server-assigned slot, not client-derived roster order**: The server already has stable room membership order. Reusing that avoids each client inventing its own grid assignment.
- **Spawn the local racer from the same slot system as remotes**: The local kart must stop using the raw base spawn when in multiplayer, otherwise every client still believes its own kart owns the center slot.
- **Use a multi-row grid instead of a one-row wraparound**: Room sizes above four players need longitudinal staggering so slots 4+ do not overlap slots 0-3.
- **Keep slot math in `PlayerManager`**: The server should distribute slot identity, while the client remains responsible for converting slot index + track spawn anchor into world coordinates.

## Deferred to Implementation

- Exact row spacing and lane spacing can follow current kart width/finish-tile constraints as long as collisions at race start are avoided.
- Whether spectate re-entry should restore players to their assigned starting slot or the raw spawn anchor can be handled pragmatically if touched by the refactor.

## Implementation Units

- [ ] **Unit 1: Propagate deterministic spawn-slot metadata through room messages**

**Goal:** Give every client the same slot index for every player in a room.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `server.js`
- Modify: `tests/unit/server-rooms.spec.js`

**Approach:**
- Store a `spawnSlot` on each room player using the existing stable join-order counter.
- Include `spawnSlot` in `welcome`, `existingPlayers`, `playerJoin`, reconnect `welcome`, and `raceLoading.players` payloads.
- Add regression assertions proving the server emits consistent slot data for both the joining player and existing roster members.

**Patterns to follow:**
- Existing room payload fan-out in `server.js`
- Existing WebSocket integration assertions in `tests/unit/server-rooms.spec.js`

**Test scenarios:**
- Happy path: host welcome payload includes `spawnSlot: 0`.
- Happy path: second player receives `spawnSlot: 1`, and the host receives the same value in `playerJoin`.
- Edge case: `raceLoading.players` preserves each remote player's assigned slot.

**Verification:**
- Server room tests pass with explicit spawn-slot assertions.

---

- [ ] **Unit 2: Use shared starting-grid slots for local and remote human spawns**

**Goal:** Spawn all human racers from the same deterministic multi-row grid layout.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/PlayerManager.js`
- Modify: `tests/player-manager-race-data.test.mjs`

**Approach:**
- Replace the current lateral-only `_computeSpawnOffset()` logic with a helper that converts `spawnSlot` into a row/column grid pose relative to `spawnPosition` and `spawnAngle`.
- Use that helper for both `initLocalPlayer()` and `addRemotePlayer()` so local and remote vehicles share the exact same grid contract.
- Keep single-player fallback behavior unchanged by defaulting missing slot data to `0`.
- If needed while touching the flow, reuse the computed per-player spawn pose for spectate restoration instead of the raw base spawn.

**Patterns to follow:**
- Grid layout vector math in `js/AIManager.js`
- Existing label/helper tests in `tests/player-manager-race-data.test.mjs`

**Test scenarios:**
- Happy path: slot `0` resolves to the base grid anchor and slot `1` resolves to a distinct neighboring lane.
- Happy path: slot `4` moves to a second row instead of overlapping slot `0`.
- Edge case: missing slot metadata falls back safely to slot `0`.

**Verification:**
- PlayerManager tests pass and a multiplayer smoke test shows racers spread along the starting line instead of stacking.
