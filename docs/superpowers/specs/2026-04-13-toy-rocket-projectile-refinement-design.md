---
date: 2026-04-13
topic: toy-rocket-projectile-refinement-design
---

# Toy Rocket Projectile Refinement

## Problem Frame

The VFX test page now has a working `toy-rocket-missile` projectile effect, but the first pass is still optimized for speed of delivery rather than long-term flexibility or final visual quality.

Three gaps remain:

- The rocket body is drawn inline inside the shared projectile renderer, so the future artist-delivered mesh would require surgery inside the same smoke/halo orchestration code.
- The rear trail smoke is readable, but it is still too soft, too bright, and too large to feel convincing as a propelled missile exhaust.
- The perpendicular smoke halos currently read more like thin stylized rings than thick ploom collars with real smoky mass.

The desired outcome is not a full 3D rewrite of the VFX page. The page should stay a 2D canvas-driven projectile test scene for now. The refinement should instead:

- make the rocket body renderer swappable
- keep projectile motion and plume orchestration shared
- deepen the smoke language so the effect feels richer without losing the playful toy-rocket silhouette

## Design Summary

Refactor the projectile effect so `drawProjectile` becomes a shared orchestrator and the rocket body becomes a pluggable body-render function.

The shared projectile system continues to own:

- pose and motion
- corkscrew timing
- nozzle position
- rear smoke trail
- smoke halo generation
- layer ordering
- replay / autoplay / JSON export behavior

The body renderer becomes an implementation detail selected by projectile mode or effect id. The shipped renderer remains the current 2D toy rocket. A future mesh-backed renderer should be able to replace only the rocket body draw step while leaving all smoke, halos, motion, controls, and exported settings unchanged.

Visually, the updated smoke direction is **stylized-but-better**, not hard realism:

- rear smoke becomes smaller, darker, denser near the nozzle, and less glowy overall
- smoke trails taper and break up more convincingly as they travel away from the rocket
- smoke halos become thicker, wider, and softer, with more particulate mass so they read like ploom collars instead of clean energy bands

Add one new public control, `smokeWeight`, that drives both the trail and the halos together so the overall plume can be tuned from lighter to heavier without adding multiple overlapping smoke controls.

## Requirements

**Architecture**

- R1. Keep the projectile effect as a 2D canvas effect on the existing VFX test page. Do not convert the page into a hybrid 2D/3D stage in this iteration.
- R2. Split projectile body rendering from projectile plume orchestration.
- R3. `drawProjectile` must remain the shared coordinator for pose, smoke, halos, render ordering, and nozzle glow.
- R4. The rocket body must be selected through a pluggable renderer hook keyed by projectile mode or effect id.
- R5. The shipped default renderer remains the current toy-rocket body drawn in canvas primitives.
- R6. A future artist mesh integration must be able to replace only the body-render step without changing smoke, halos, motion, autoplay, JSON export, or projectile state ownership.

**Smoke Trail**

- R7. Rear exhaust smoke must become smaller than the current pass at default settings.
- R8. Rear exhaust smoke must use darker greys and less warm glow overall.
- R9. The densest smoke must remain near the nozzle, with softer breakup as the trail ages.
- R10. Trail motion should stay stylized, but particle overlap and tapering should make it feel more convincing than the current soft blob chain.
- R11. The trail must still clearly emit from the nozzle position rather than the rocket center.

**Smoke Halos**

- R12. Smoke halos must become thicker and expand wider than the current pass at default settings.
- R13. Halos must read as smoky ploom collars, not thin clean rings.
- R14. Halo visuals should include softer edges and more particulate-looking mass while preserving the current “passes through the body” illusion.
- R15. The current split draw order must remain: back-half halo behind the rocket body, front-half halo in front.

**Controls**

- R16. Add a projectile-specific slider named `smokeWeight`.
- R17. `smokeWeight` must affect both the rear trail smoke and the smoke halos together.
- R18. `trailDensity` remains the emission/rate control; `haloFrequency` remains the spawn/timing control; `smokeWeight` controls plume mass, darkness, softness, and thickness.
- R19. Copied JSON for `toy-rocket-missile` must include `smokeWeight`.

**Compatibility**

- R20. Existing projectile controls `spin`, `trailDensity`, and `haloFrequency` remain intact.
- R21. Existing `toy-rocket-missile` motion identity remains intact: centered showroom flight loop, medium corkscrew roll, and current general pose language.
- R22. Existing page-level behaviors remain intact: replay, autoplay cadence, tab navigation, narrow-screen layout, and effect selector count.

## Success Criteria

- The rocket body code path is clearly swappable without touching trail or halo logic.
- The default toy rocket still looks the same in silhouette and motion, aside from the refined plume quality.
- Rear smoke looks smaller, darker, and less glowy than before.
- Halo collars feel thicker, wider, and smokier than before.
- One `smokeWeight` slider can meaningfully push the whole plume lighter or heavier.
- The projectile tab still exports a coherent JSON payload and the test page remains stable.

## Scope Boundaries

- **In scope:** Projectile body-render hook, smoke trail retune/rework, halo retune/rework, new `smokeWeight` control, JSON/test updates.
- **Out of scope:** Loading the future artist mesh, converting the VFX page to WebGL/Three.js body rendering, adding a general plugin system for all effect types, or redesigning the rest of the VFX page architecture.
- **Not changing:** The rocket’s general flight path, the effect count, or the broader VFX page layout.

## Key Decisions

- **Mesh-ready hook over true mesh preview now:** The body becomes swappable today, but the page stays 2D canvas-driven until the real asset exists.
- **Smoke stays stylized-but-better:** The effect should feel more convincing without drifting out of the toy/arcade visual family.
- **One coherent weight control:** `smokeWeight` drives both the rear trail and halos so the plume feels unified.
- **Shared orchestrator stays in charge:** Motion and plume behavior remain centralized; only the body draw step is abstracted.

## Dependencies / Assumptions

- The future artist delivery is a rocket mesh intended to replace only the body silhouette, not the trail/halo simulation.
- The current `toy-rocket-missile` effect remains the only projectile mode that needs the pluggable body renderer immediately.
- The current Playwright VFX tests are the right level of automated coverage for the public surface of this change.

## Outstanding Questions

### Deferred to Planning

- [Affects R4-R6][Technical] What is the minimal renderer-hook shape that keeps today’s patch small while still making a future mesh swap straightforward? A simple lookup table plus `renderBody(context, pose, effect, state, scale)` is the likely baseline.
- [Affects R16-R19][Technical] What default/min/max values should `smokeWeight` use so the control has useful range without making the effect unreadable?
- [Affects R7-R15][Tuning] How much of the smoke improvement should come from spawn logic vs update behavior vs draw treatment so the default look improves without making the sliders feel redundant?
- [Affects R22][Testing] Should automated coverage remain focused on DOM/control/export behavior only, or should a lightweight visual regression/screenshot assertion be added later for projectile tuning?

## Next Steps

-> Write the implementation plan for the toy-rocket projectile refinement once this spec is reviewed and approved
