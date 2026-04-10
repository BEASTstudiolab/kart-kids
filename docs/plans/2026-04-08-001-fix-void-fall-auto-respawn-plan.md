---
title: "fix: Auto-respawn when vehicle falls into void"
type: fix
status: active
date: 2026-04-08
---

# fix: Auto-respawn when vehicle falls into void

## Overview

Lower the kill-plane raycast threshold in Vehicle.js so that vehicles landing on the safety-net ground plane (Y=-5) trigger an automatic respawn instead of sliding around in the void.

## Problem Frame

A static physics body at Y=-5 catches vehicles that fall off the track, but the respawn kill-plane check uses `groundHeight < -10` — below the safety net. Vehicles land on the invisible floor at Y=-5 and slide around with no way to return to the track except reloading.

## Requirements Trace

- R1. Vehicles that fall off the track must automatically respawn at the nearest checkpoint
- R2. Respawn must not loop (vehicle must not immediately re-trigger respawn after teleporting back)
- R3. AI vehicles must also benefit from the same auto-recovery

## Scope Boundaries

- Not changing the safety-net body position or physics properties
- Not adding new contact detection — using the existing raycast-based groundHeight approach
- Not changing VehicleRespawn.execute() behavior

## Context & Research

### Relevant Code and Patterns

- `Vehicle.js:903-906` — existing respawn trigger: `groundHeight < -10 || flipRespawn || offTrackTimer > grace`
- `main.js:309-318` — safety-net static body at Y=-5, `friction: 5.0`
- `VehicleRespawn.js` — `execute(v)` teleports to checkpoint, zeros velocity, starts invulnerability
- `VehicleStateMachine.js` — transitions to `RESPAWNING` state when `respawnRequested` is true, prevents re-trigger during active respawn

## Key Technical Decisions

- **Raise kill-plane threshold from -10 to -3:** The safety net sits at Y=-5. Track surface is at Y=0+. A threshold of -3 catches vehicles before they reach the safety net, triggering respawn while still airborne in the void. This is simpler than tagging the anonymous safety-net physics body and adding contact detection. The -3 value gives enough clearance that normal track elevation variations (ramps go up, not down) won't false-trigger.

## Implementation Units

- [ ] **Unit 1: Raise kill-plane threshold**

**Goal:** Make vehicles respawn when they fall below the track into the void

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `js/Vehicle.js` (kill-plane threshold constant)

**Approach:**
- Change `groundHeight < -10` to `groundHeight < -3` in the respawn trigger check (~line 903)
- Extract the magic number to a named constant `KILL_PLANE_Y` for clarity

**Patterns to follow:**
- Existing constant extraction pattern in Vehicle.js (e.g., `BOOST_FILL_TIME`, other named constants)

**Test scenarios:**
- Happy path: Vehicle falling off track with groundHeight at -4 triggers respawnRequested = true
- Edge case: Vehicle on a ramp at Y=2 does NOT trigger respawn (groundHeight > -3)
- Edge case: Vehicle at exact threshold Y=-3 does trigger respawn

**Verification:**
- In-game: drive off the edge of a track with no guardrails. Vehicle should respawn at the nearest checkpoint within ~1 second instead of falling into the void.
- AI vehicles that fall off should also respawn automatically.

## System-Wide Impact

- **Interaction graph:** The change only affects the `respawnRequested` condition in Vehicle.js. VehicleStateMachine, VehicleRespawn, and all downstream systems (invulnerability, health reset, drift reset) work unchanged.
- **State lifecycle risks:** None — the RESPAWNING state already prevents re-trigger loops (R2 satisfied by existing state machine).
- **Unchanged invariants:** VehicleRespawn.execute(), safety-net body, ContactHandler collision routing all remain unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| False respawn on deep track features | Track tiles are at Y=0+; lowest elevation is ground level. -3 threshold provides 3 units of clearance below any valid track surface. |
