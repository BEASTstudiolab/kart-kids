---
date: 2026-04-10
topic: race-mode-ai-fill
---

# RACE Mode AI Fill

## Problem Frame

RACE mode (online matchmaking) will often find zero or few players, especially early in the game's life. Without opponents the race feels empty and the matchmaking timeout just leads to failure. The game already has a full AI system (AIManager with AIController, TrackIntel pathfinding, rubber-banding, up to 8 AI drivers). We should use it to guarantee every RACE always has a full grid.

## Requirements

- R1. RACE mode targets an 8-racer grid: 1 player + up to 7 others (human or AI).
- R2. Matchmaking runs for up to 30s trying to find real players. After timeout (or once enough players are found), fill remaining empty slots with AI drivers.
- R3. AI count = 8 - (total human players in the race). If matchmaking finds 3 players, spawn 5 AI.
- R4. FREE PLAY mode has no AI opponents — solo practice only.
- R5. PARTY mode has no AI opponents — only human players in the room.
- R6. The existing AIManager.setCount() API is used to spawn AI. No new AI system needed.
- R7. AI fill happens at race start time, after matchmaking resolves — not during the matchmaking queue.

## Success Criteria

- RACE mode always starts with 8 racers on the grid regardless of player count.
- FREE PLAY and PARTY are unaffected (no AI spawned).
- Existing aiCount debug setting still works for development.

## Scope Boundaries

- No changes to AI behavior, pathfinding, or difficulty.
- No changes to matchmaking/networking logic itself — just the AI fill after matchmaking resolves.
- No mid-race player-for-AI swapping.

## Key Decisions

- **8-racer grid**: Matches AIManager's existing 8-slot capacity. Full grid feels competitive.
- **30s matchmaking then fill**: Gives real players a chance to join before falling back to AI. Aligns with the existing 30s findRoom timeout.
- **No AI in FREE PLAY or PARTY**: FREE PLAY is practice, PARTY is friends-only. Keeps modes distinct.
- **Fill at race start, not during queue**: Simpler — no need to track partial AI spawning or AI-to-player swaps.

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Where does the AI fill logic live — in GameEngine.start() based on the mode and player count, or in RacePanel before calling startRace()?
- [Affects R3][Technical] How does the server communicate the player count to the client so it knows how many AI to spawn?

## Next Steps

-> /ce:plan for structured implementation planning
