---
date: 2026-03-30
topic: minimap
---

# Minimap

## Problem Frame

Players have no spatial awareness of the track layout or other players' positions. Racing feels like "follow the road" rather than strategic overtaking. A minimap transforms this with minimal effort since all track and player position data already exists.

## Requirements

- R1. 2D canvas overlay in the bottom-right corner showing the track layout from above.
- R2. Track cells rendered as connected path segments matching the grid layout.
- R3. Local player shown as a colored dot that updates every frame.
- R4. Remote players shown as colored dots using their existing interpolated positions.
- R5. Dot colors match vehicle colors.
- R6. Minimap visible during RACING state, hidden during IDLE/COUNTDOWN/FINISHED.

## Success Criteria

- Player can see the full track shape and their position on it at a glance.
- In multiplayer, all connected players are visible on the minimap.

## Scope Boundaries

- No rotation (map is always north-up, not vehicle-up).
- No zoom or resize.
- No track names or labels.
- No minimap during countdown or results — keep those screens clean.

## Next Steps

-> `/ce:plan` or directly to work — this is lightweight enough for either.
