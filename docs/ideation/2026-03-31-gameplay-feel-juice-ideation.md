---
date: 2026-03-31
topic: gameplay-feel-juice
focus: camera effects, particles, screen shake, audio feedback, animation polish
---

# Ideation: Gameplay Feel & Juice

## Codebase Context

- **Project shape:** Three.js + crashcat physics kart racer, ported from Godot 4.6 Kenney starter kit. 18 JS modules, no bundler, no TypeScript.
- **Current features:** Race state machine + HUD (lap timing, countdown, finish line), WebSocket multiplayer (4 players), track editor, 4 vehicle colors, touch/keyboard/gamepad input, smoke trail particles, day/night lighting, bloom post-processing, boost/nitro system (250 base top speed), raycast physics.
- **Existing feel systems:** Body lean pitch/roll in `updateBody()`, wheel spin in `updateWheels()`, engine audio with pitch shift (0.25-3.0 playback rate), smoke trails gated on `driftIntensity > 0.25`, impact audio with velocity-scaled volume, bloom post-processing.
- **Key gaps:** No screen shake, no visual boost activation feedback (underglow light exists but `visible: false`), no drift reward mechanic, no distinct particle types beyond smoke, no gamepad haptics, camera FOV/distance is static.
- **Past learnings:** Boost physics scales with topSpeed (set once, not every frame). Line-segment crossing for spatial triggers. Constructor injection + display state flow for module integration.

## Ranked Ideas

### 1. Drift State Machine with Spark Particles + Visual Drift Package
**Description:** Discretize the existing `driftIntensity` float into escalating drift stages with visual feedback. Stage 1: white sparks, Stage 2: yellow sparks, Stage 3: orange sparks. Releasing drift at Stage 2+ grants a mini-boost. Body lean angle intensifies per stage. Existing infrastructure: `driftIntensity`, body lean in `updateBody()`, smoke particles, boost system.
**Rationale:** The only idea that creates a new gameplay mechanic, not just polish. Gives players a skill to master and a reason to drift intentionally. Every great kart racer has this.
**Downsides:** Requires tuning slip-angle thresholds for "fun drift" vs. "out of control spin." Crashcat sphere physics may not produce satisfying lateral slide feel.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Explored

### 2. Screen Shake on Wall Impacts
**Description:** When `contactListener.onContactAdded` fires a wall impact (already triggers `audio.playImpact`), add a camera position offset with exponential decay. Magnitude scales with impact velocity. ~5 lines in Camera.js.
**Rationale:** Most universally effective juice technique. Wall collisions currently produce sound but zero visual consequence. Both critics kept unanimously.
**Downsides:** Can cause motion sickness if overdone. Need sensible clamp.
**Confidence:** 95%
**Complexity:** Low
**Status:** Explored

### 3. Boost Activation Feedback
**Description:** When `boostActive` transitions true: (1) camera FOV punch out 10-15 degrees then snap back, (2) particle burst from rear, (3) enable existing underglow light, (4) whoosh sound. During boost: continuous flame trail. Build incrementally.
**Rationale:** Boost is the biggest moment in a race (20s fill, 4s duration) and has literally zero player feedback. The underglow light exists but is permanently hidden. Fixes a critical missing feature.
**Downsides:** Multi-system coordination can become scope creep. Must build incrementally.
**Confidence:** 90%
**Complexity:** Low-Medium
**Status:** Explored

### 4. Particle Burst Vocabulary
**Description:** Expand Particles.js from drift-smoke-only to distinct effects: orange sparks on wall scrapes, dust puffs on hard braking, flame jet during boost. Each is a parameterized variant of the existing emitter with different color, lifetime, gravity.
**Rationale:** Currently every event looks the same (smoke). Diverse particles let players read events from peripheral vision. Builds on existing infrastructure.
**Downsides:** Multiple simultaneous emitters could impact performance. Need particle budget cap.
**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Explored

### 5. Speed-Reactive Camera (FOV + Chase Distance)
**Description:** Lerp camera FOV from 40 to ~55 at top speed, chase distance from 6 to ~8. During boost, push further. Snap back on braking/collision. All values already accessible in Camera.js and Vehicle.js.
**Rationale:** Standard way to communicate speed through camera. Primary use case is differentiating boost from normal speed.
**Downsides:** Short tracks limit the effect window. Less impactful without longer straights.
**Confidence:** 80%
**Complexity:** Low
**Status:** Explored

### 6. Gamepad Haptic Feedback
**Description:** Gamepad Vibration API: low rumble proportional to speed, sharp spike on impact, buzz during boost. ~10 lines in Controls.js. Graceful degradation when unavailable.
**Rationale:** Bypasses visual fatigue. Very few web games do this — surprise quality signal. Minimal effort.
**Downsides:** Spotty browser support (Chrome/Edge mainly). Keyboard/touch players won't benefit.
**Confidence:** 70%
**Complexity:** Low
**Status:** Explored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Camera as Emotion Engine | Full cinematography system for 3 cell types; cost vastly exceeds payoff |
| 2 | Persistent Tire Mark Decals | Projected decals architecturally heavy in raw Three.js; clashes with Kenney style |
| 3 | Speed Lines & Peripheral Blur | Needs shader pass or cheap CSS overlay; narrow usage window |
| 4 | Procedural Kart Body Animation | Body lean and wheel spin already exist; squash-stretch looks wrong on rigid low-poly |
| 5 | Dynamic Engine Audio (full system) | Core pitch system already built; remaining work is tuning, not a feature |
| 6 | Hit-Stop Freeze Frames | Wall scrapes too frequent; freezing physics feels like lag |
| 7 | Dynamic Particle Intensity | Already gated on driftIntensity; one-liner tuning task |
| 8 | Environment Juice — Track Deforms | Per-vertex animation on instanced GLBs is architecturally invasive |
| 9 | Diegetic HUD | 3D text in Three.js is painful; worse readability than DOM overlay |
| 10 | Unified Effect Bus | Premature architecture for single developer |
| 11 | Track-Segment Contextual Effects | Only 3 cell types; repetitive by lap 2 |
| 12 | Multiplayer Drafting / Slipstream | Network jitter makes proximity detection unreliable |
| 13 | Comeback Rage Mode | Cosmetic "you're losing" without mechanical catch-up is patronizing |
| 14 | Parallax Speed Lines from Track Edges | Over-engineered; spawns ribbons near invisible collision boxes |
| 15 | Track-Aware Juice Layer (cross-cut) | Combines premature architecture with shallow content |
| 16 | Impact Feel Stack (cross-cut) | Screen shake good; hit-stop bad for racing; bundling doesn't fix weak half |

## Session Log
- 2026-03-31: Fresh ideation on gameplay feel & juice — 48 raw ideas from 6 agents, 25 after dedupe + 3 cross-cuts, 6 survived adversarial filtering from 2 critique agents
- 2026-03-31: All 6 survivors selected for brainstorming
