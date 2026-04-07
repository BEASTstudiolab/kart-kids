---
date: 2026-04-07
topic: ghost-replay
---

# Ghost Replay System

## Problem Frame

Time trials lack a competitive reference point. Players complete laps with no way to compare against their previous best run. A ghost replay — a translucent vehicle replaying the player's best lap inputs — makes improvement visible and time trials meaningful.

## Requirements

**Recording**
- R1. Record per-frame control inputs (`x`, `z`, `boost`, `drift`, `gas`, `brake`) and `dt` during each completed lap
- R2. Store recordings as compact typed arrays (Float32Array for analog values, Uint8 flags for booleans) to minimize memory
- R3. Only retain the best (fastest) lap recording per track; discard slower runs automatically

**Playback**
- R4. Replay ghost by feeding recorded inputs + dt into a second Vehicle instance each frame
- R5. Render the ghost vehicle as translucent (opacity ~0.3), no shadow, no collision
- R6. Ghost vehicle uses the same model as the player's selected vehicle with a tint/transparency shader
- R7. Ghost loops its recording continuously while the player races

**Persistence**
- R8. Persist best-lap recordings in localStorage keyed by track identifier
- R9. Cap stored replay size — discard if a single replay exceeds 500KB (prevents localStorage quota issues on long tracks)

**UI**
- R10. Toggle ghost visibility via a checkbox in the pause menu or pre-race settings
- R11. Show ghost lap time as a reference during the race (small HUD element)

## Success Criteria

- Player completes a lap, starts a new lap, and sees a translucent ghost vehicle replaying their previous best
- Ghost stays in sync with its recorded inputs (no visible drift over a full lap)
- Replay persists across browser sessions for the same track

## Scope Boundaries

- Single-player time trial mode only — no multiplayer ghost sharing
- No server-side storage — localStorage only
- No ghost for AI opponents — player ghost only
- No replay scrubbing or playback controls
- Determinism is best-effort: if physics produce minor drift from floating-point variance, accept it (ghost is a visual reference, not a competitive arbiter)

## Key Decisions

- **Input recording over state recording**: Recording inputs is ~10x smaller than recording full vehicle state each frame. Accepted trade-off: minor physics drift over long replays due to floating-point non-determinism.
- **localStorage over IndexedDB**: Simpler API, sufficient for single-replay-per-track storage at <500KB each. IndexedDB would only matter if storing multiple replays or sharing them.
- **Best-lap-only**: Storing only the fastest lap keeps storage bounded and avoids a replay management UI.

## Outstanding Questions

### Deferred to Planning
- [Affects R4][Technical] Does Vehicle.js need any modifications to accept external input without side effects (e.g., audio, particles)?
- [Affects R2][Needs research] Optimal typed array layout — interleaved vs separate arrays for inputs and dt
- [Affects R6][Technical] Best approach for translucent ghost material — clone material with opacity, or dedicated ghost shader?

## Next Steps

-> /ce:plan for structured implementation planning
