---
date: 2026-04-01
topic: drafting-slipstream
---

# Drafting / Slipstream Boost

## Problem Frame

Kart racing games reward positioning awareness through drafting — following closely behind another kart reduces air resistance and grants a speed boost. Kart Kids currently has no inter-vehicle interaction beyond rubber-banding. Drafting adds a tactical layer where trailing positions become an opportunity rather than just a deficit, and creates natural pack racing dynamics with the AI personality system.

## Requirements

**Detection**
- R1. A vehicle is "drafting" when it is within a configurable distance behind another vehicle (~3 world units) and roughly aligned with the lead vehicle's direction (dot product of forward vectors > 0.8)
- R2. Draft detection runs for all vehicles (player + AI) every frame
- R3. "Behind" means the trailing vehicle's position is within a cone behind the lead vehicle, not just proximity

**Speed Boost**
- R4. Drafting grants a 5-10% top speed increase that ramps up over ~1 second and decays over ~0.5 seconds when the draft is lost
- R5. The boost applies via the existing `externalTopSpeedMultiplier` channel (additive with rubber-banding, not replacing it)
- R6. Multiple vehicles can draft the same lead vehicle simultaneously

**Visual & Audio Feedback**
- R7. Faint directional speed lines appear behind the lead vehicle when a draft is active (particle effect, not post-processing)
- R8. Subtle wind/whoosh audio cue that ramps with draft strength
- R9. Feedback is visible to the player when they are drafting or being drafted

**AI Integration**
- R10. AI racers receive the drafting speed boost automatically when the detection criteria are met (no AI behavior changes needed — drafting is passive)

## Success Criteria

- Trailing behind any kart for ~1 second on a straight produces a noticeable speed increase
- Pulling out of a draft to overtake feels like a "slingshot" moment
- Pack racing emerges naturally — karts bunch up on straights
- No perceptible frame impact with 8 AI + player (9 vehicles, O(n^2) proximity checks on a small n)

## Scope Boundaries

- No active AI draft-seeking behavior (AI doesn't change pathing to get behind another kart)
- No drafting UI indicator on HUD (the speed lines are the feedback)
- No "draft break" mechanic (items don't disrupt drafts)
- No multi-chain drafting bonus (3 karts in a line don't get extra boost)

## Key Decisions

- **Passive detection, not an input**: Drafting is automatic — no button press. If you're in position, you get the boost. This matches the "subtle tactical edge" feel.
- **Particle-based speed lines, not post-processing**: Speed lines as a lightweight particle system (like existing SmokeTrails) keeps the effect localized to the draft pair rather than affecting the whole screen.
- **Additive with rubber-banding**: `externalTopSpeedMultiplier` is already used by rubber-banding. Drafting adds a separate multiplier so both systems coexist without interference.

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Technical] Exact cone angle and distance thresholds — needs playtesting
- [Affects R7][Technical] Whether to create a new DraftLines particle class or reuse/extend SmokeTrails
- [Affects R5][Technical] Whether to use a separate `draftSpeedMultiplier` property or combine with `externalTopSpeedMultiplier`

## Next Steps

→ `/ce:plan` for structured implementation planning
