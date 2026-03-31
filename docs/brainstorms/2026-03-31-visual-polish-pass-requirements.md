---
date: 2026-03-31
topic: visual-polish-pass
---

# Visual Polish Pass: Tire Marks + Spring-Physics UI

## Problem Frame

Kart Kids has strong gameplay systems (drift, boost, items) but the visual presentation doesn't match. Drifting produces sparks but leaves no trace on the track. HUD elements appear and disappear instantly with no animation weight. These two features address the gap between gameplay depth and visual feedback quality.

## Requirements

**Tire Marks / Skid Decals**
- R1. Rear wheels leave visible dark marks on the track surface during drifts (driftStage > 0) and heavy braking.
- R2. Marks persist for the entire race, building up a visual record of the racing line.
- R3. Mark width scales with drift intensity / slip angle — wider marks during harder drifts.
- R4. Marks render as ribbon geometry extruded along the rear wheel ground contact path.
- R5. Marks are visible for all players (local + remote) in multiplayer.
- R6. All marks clear on race restart.

**Spring-Physics UI**
- R7. All HUD value changes animate with damped spring physics instead of instant/CSS easing.
- R8. Affected elements: countdown numbers, lap counter, boost bar fill, powerup indicator, race time, race results.
- R9. Spring magnitude responds to the size of the change — a 1st-to-5th position jump bounces harder than 3rd-to-4th.
- R10. Spring parameters are consistent across all HUD elements (same stiffness/damping, different rest positions).

## Success Criteria

- Drifting around a corner leaves a visible trail on the track behind the kart
- After 3 laps, the player can see their racing line drawn on the track
- Every HUD number/bar change has a satisfying overshoot-settle animation
- The polish feels cohesive, not noisy

## Scope Boundaries

- No tire marks on non-drift driving (normal straight-line driving)
- No surface-type coloring for marks (all marks are dark gray/black for v1)
- No per-player mark colors in multiplayer (all marks same color)
- Spring UI is DOM-based CSS transforms, not canvas/WebGL rendering
- No spring animations on non-HUD elements (menus, debug panel)

## Key Decisions

- **Persist whole race:** Marks stay until reset. Players see their line improve lap over lap. More geometry but bounded by race length.
- **Spring everything:** Consistent spring feel across all HUD elements, not selective. The consistency IS the polish.
- **Ribbon geometry for marks:** Not projected decals (too heavy in raw Three.js). Ribbon mesh extruded along wheel paths is cheaper and matches the existing VFX approach.

## Outstanding Questions

### Deferred to Planning
- [Affects R4][Technical] Ring buffer size for ribbon geometry — how many segments before oldest start being overwritten? Or grow unbounded for a 3-lap race?
- [Affects R5][Technical] Should remote player tire marks use their interpolated wheel positions, or skip remote marks for v1?
- [Affects R7][Technical] Should spring state live in HUD.js or in a reusable SpringAnimator utility class?

## Next Steps

-> /ce:plan for structured implementation planning
