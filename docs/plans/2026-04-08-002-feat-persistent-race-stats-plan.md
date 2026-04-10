---
title: "feat: Session-persistent race stats per track"
type: feat
status: active
date: 2026-04-08
---

# feat: Session-persistent race stats per track

## Overview

Add localStorage-backed persistence for best lap time, best total time, and race count per track. Show personal best on results screen and flash "NEW RECORD" when beaten.

## Problem Frame

Race results (bestLap, totalTime) are ephemeral — lost on page reload. Players have no sense of progression or improvement across sessions. GhostStorage already generates deterministic track hashes, and RaceMode already tracks the data. It just isn't persisted.

## Requirements Trace

- R1. Persist best lap time, best total time, and race count per trackId in localStorage
- R2. Show personal best comparison on the results screen
- R3. Flash "NEW RECORD" when a new best is achieved
- R4. Follow the existing localStorage versioning pattern from Settings.js

## Scope Boundaries

- Not adding a leaderboard UI or stats overview page
- Not persisting per-lap breakdowns (just best lap and best total)
- Not sharing stats across devices

## Key Technical Decisions

- **Separate storage module (RaceStats.js)**: Follows the pattern of GhostStorage.js — standalone module with static methods, keyed by trackId
- **Storage key format**: `race-stats:{trackId}` — parallels `ghost:{trackId}`
- **Schema versioning**: Include `_version: 1` in stored data, with migration stubs ready

## Implementation Units

- [ ] **Unit 1: RaceStats storage module**

**Goal:** Create RaceStats.js with save/load/query for per-track stats

**Requirements:** R1, R4

**Files:**
- Create: `js/RaceStats.js`

**Approach:**
- Static methods: `save(trackId, { totalTime, bestLap, laps })`, `load(trackId)` → `{ bestLap, bestTotal, raceCount, _version }`
- On save: compare against existing best, update if improved, increment raceCount
- Return `{ newBestLap: bool, newBestTotal: bool }` from save

- [ ] **Unit 2: Wire RaceStats into race finish**

**Goal:** Save stats when a race finishes

**Requirements:** R1

**Files:**
- Modify: `js/main.js` (import RaceStats, call save at finish)

**Approach:**
- After RaceMode transitions to finished state, call `RaceStats.save(trackId, results)`
- Pass the save result to HUD for display

- [ ] **Unit 3: Results screen NEW RECORD display**

**Goal:** Show personal best comparison and NEW RECORD flash on results screen

**Requirements:** R2, R3

**Files:**
- Modify: `js/HUD.js` (add personal best line and NEW RECORD indicator)

**Approach:**
- Add a "Previous Best" line below the existing results
- When newBestLap or newBestTotal is true, add pulsing "NEW RECORD!" text with CSS animation
