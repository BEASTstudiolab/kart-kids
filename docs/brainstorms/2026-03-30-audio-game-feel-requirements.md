---
date: 2026-03-30
topic: audio-game-feel
---

# Audio-Driven Game Feel

## Problem Frame

The game has working file-based audio (engine, skid, impact) but collisions feel weightless — there's no visual feedback when hitting walls or other players. The engine sound is tied to an audio file that can't be tuned in real-time. Replacing the engine with procedural synthesis and adding camera shake transforms the moment-to-moment feel from "tech demo" to "game."

## Requirements

**Procedural Engine Audio**
- R1. Replace the file-based engine sound (engine.ogg) with a Web Audio oscillator-based engine. Base frequency mapped to vehicle speed, volume to throttle.
- R2. Engine sound has at least two oscillator layers (base + detuned overtone) for texture.
- R3. Smooth transitions — no clicks or pops when speed changes. Use gain ramping and frequency lerping.
- R4. Keep the existing skid.ogg and impact.ogg file-based sounds — only replace the engine loop.

**Camera Shake**
- R5. Camera shakes on wall/player collisions. Subtle and snappy — short burst (~0.2s), small position offset.
- R6. Shake intensity is fixed (not proportional to speed) to keep it simple and consistent.
- R7. Shake decays rapidly (exponential falloff) so it doesn't linger.

## Success Criteria

- Engine sound pitch rises and falls smoothly with speed, no audio file dependency.
- Hitting a wall produces a visible camera jolt + the existing impact sound.
- The game feels noticeably more alive with both changes combined.

## Scope Boundaries

- No changes to skid or impact audio — keep existing files.
- No screen flash or post-processing effects on collision.
- No per-vehicle audio differentiation (all vehicles sound the same).
- No mobile vibration/haptics.

## Key Decisions

- **Replace engine.ogg, don't layer:** Simpler, zero asset dependency, fully tunable.
- **Fixed shake intensity:** Avoids tuning complexity. One shake feel for all collisions.
- **Keep skid + impact files:** They already work well; no reason to synthesize them.

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Needs research] Best oscillator waveform for a kart engine feel — sawtooth, triangle, or custom periodic wave?
- [Affects R5][Technical] How to apply shake offset to Camera.js — direct position offset on the camera, or offset on the follow target?

## Next Steps

-> `/ce:plan` or directly to work
