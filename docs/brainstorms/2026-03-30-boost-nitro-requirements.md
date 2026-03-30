---
date: 2026-03-30
topic: boost-nitro
---

# Boost / Nitro System

## Problem Frame

The game has no skill-expression mechanic beyond steering. A boost meter that rewards drifting gives players a reason to take risks on corners and creates overtaking opportunities.

## Requirements

**Boost Meter**
- R1. Boost meter fills passively at a rate of ~20 seconds from empty to full
- R2. While drifting, the meter fills at 5x the passive rate (~4 seconds to full)
- R3. Meter is a 0-1 value, only activatable when completely full

**Boost Activation**
- R4. Space bar (keyboard) activates boost when meter is full
- R5. On activation, the meter drains instantly (one shot, not gradual)
- R6. Boost lasts 3-5 seconds (tunable constant)
- R7. During boost, top speed increases from 150 to 300 and acceleration increases proportionally
- R8. When boost duration expires, top speed and acceleration return to normal

**HUD**
- R9. Display a visible boost meter bar in the HUD showing current fill level
- R10. Visual indication when boost is ready to activate (full meter)
- R11. Visual indication when boost is active (draining/active state)

## Success Criteria

- Drifting through a corner noticeably fills the meter faster than driving straight
- Activating boost creates a dramatic speed increase that feels impactful
- A skilled player who drifts well gets 3-4x more boosts per race than one who doesn't drift

## Scope Boundaries

- No multiple boost levels or staged charging (single full-or-nothing activation)
- No boost-specific visual effects on the vehicle (particles, speed lines) — use existing underglow/smoke systems if easy, otherwise skip
- No gamepad button mapping (keyboard space bar only for now)
- No multiplayer sync of boost state (local only — remote players just see the speed change)

## Key Decisions

- **20s passive fill**: Slow enough that drifting is almost required for competitive boost usage
- **Instant drain**: No partial boost — you save it for the right moment, then use it all
- **150 → 300 top speed**: 2x multiplier for dramatic feel. Tunable if too aggressive.

## Dependencies / Assumptions

- Vehicle.js already tracks `driftIntensity` — can be used to detect drifting state
- Vehicle.js `debug.topSpeed` is currently 150 — boost overrides this temporarily
- HUD.js already renders DOM overlay elements — boost meter follows the same pattern

## Outstanding Questions

### Deferred to Planning
- [Affects R7][Technical] How should acceleration scaling work during boost? Linear scale with top speed, or separate tunable?
- [Affects R4][Technical] Should touch controls get a boost button? (Out of scope for now, but worth noting the hook point)

## Next Steps

→ `/ce:plan` for structured implementation planning
