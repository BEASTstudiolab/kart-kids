---
date: 2026-04-13
topic: race-position-top-three-hud
---

# Race Position + Top-Three HUD

## Problem Frame

Race mode already tracks the local player's lap and live position, but the game does not show that information in the in-race HUD. Players have no quick way to tell whether they are leading, how far down the field they are, or who currently holds the top spots.

That gap is especially noticeable once AI and multiplayer races are active. A race feels less readable and less competitive when players cannot see their own standing or the leaders at a glance.

## Requirements

**Player Position HUD**
- R1. During `RACING`, the HUD must show the local player's current race position at all times in a dedicated in-race UI element.
- R2. The local player's position display must use ordinal race placement language that reads clearly at a glance (for example, `1ST`, `2ND`, `5TH`).
- R3. The local player's position display must remain visible even when the player is outside the top three.

**Top-Three Leaderboard**
- R4. During `RACING`, the HUD must show a compact live leaderboard panel in the top-right corner containing the current top three race positions.
- R5. Each leaderboard row must show the placement and the racer's display name (for example, `#1 ALEX`).
- R6. The leaderboard must always represent the actual top three racers in order and must not replace one of those rows with the local player when the local player is outside the top three.
- R7. If fewer than three racers are present in the race, the leaderboard must render only the positions that exist rather than showing placeholder entries.

**Race Ranking Correctness**
- R8. Race ranking for the player-position badge and top-three leaderboard must use the same ordering logic so both HUD surfaces always agree.
- R9. Multiplayer ranking must be accurate across laps, not just within the current lap segment, so remote human racers cannot appear ahead or behind incorrectly after crossing the finish line.
- R10. Solo, AI, and multiplayer races must all use real racer identity labels in the leaderboard rather than anonymous placeholders when a display name is available.
- R11. If a racer's real display name is not yet available at render time, the leaderboard must show a stable non-empty fallback label for that racer until the synced name arrives.

**Visibility and State Rules**
- R12. This race-position UI is visible only during `RACING`.
- R13. The new HUD elements must coexist with the current race HUD without obscuring the minimap, lap/time display, or boost meter.
- R14. The new HUD elements must remain readable on the currently supported gameplay layouts, including desktop and touch-oriented play.

## Success Criteria

- A player can enter a race and immediately see both their own live place and the current top three without opening another screen.
- When the player is outside the top three, the top-right leaderboard still shows the real leaders while the player's own place remains visible separately.
- In multiplayer, the leaderboard order stays correct when racers are on different laps.
- The HUD feels additive rather than cluttered and remains easy to scan during active driving.

## Scope Boundaries

- No expansion beyond a top-three leaderboard in this pass.
- No lap, gap, speed, or other extra stats inside the leaderboard rows.
- No countdown-state, idle-state, or finished-state display for this position UI.
- No results-screen or post-race leaderboard redesign in this feature.
- No spectator-specific leaderboard behavior in this pass.

## Key Decisions

- **Strict top three plus separate player place:** The leaderboard stays focused on race leaders, while the player's own standing remains readable even when they are not in contention for the podium.
- **Top-right placement:** This is the cleanest fit with the existing HUD layout and avoids crowding the top-center lap/time display.
- **Multiplayer correctness is part of v1:** A fast-but-wrong remote ranking would undermine trust in the HUD, so accurate cross-lap ordering is part of the feature rather than a follow-up.
- **Real names in v1:** The leaderboard should feel like a real race HUD, so the feature includes proper racer naming for AI and multiplayer rather than generic labels.
- **Racing-only visibility:** Keeping the UI off during countdown and post-finish states avoids extra HUD noise and keeps the feature focused on live competition.

## Dependencies / Assumptions

- `js/RaceMode.js` already exposes the local player's current position, so this feature extends an existing race-state concept rather than inventing a new one.
- Accurate multiplayer ranking and race-time naming likely require additional race data to flow into the active leaderboard logic; the exact data path is a planning detail.

## Outstanding Questions

### Deferred to Planning
- [Affects R4-R14][Technical] What is the cleanest UI composition approach in `js/HUD.js` for adding a top-right leaderboard and separate player-place badge without duplicating race-state formatting logic?
- [Affects R8-R11][Technical] What race-time data contract should feed `js/RaceMode.js` so remote human racers include enough lap/progress/name information for accurate multiplayer ordering?
- [Affects R10-R11][Needs research] Which remote display name source should take precedence during race HUD rendering if multiplayer name data arrives late or changes after race start?

## Next Steps

-> `/ce:plan` for structured implementation planning
