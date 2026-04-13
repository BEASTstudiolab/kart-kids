---
date: 2026-04-13
topic: explosion-fx-design
---

# Hybrid Arcade Combat Explosion FX

## Problem Frame

Kart Kids already has a good gameplay-feedback base for impacts and moment-to-moment juice:

- Pooled sprite-style effects such as smoke, boost bursts, boost flames, and wall sparks
- Camera shake, impact audio, and haptics wired through gameplay hooks
- A VFX test range for tuning look and timing

What it does not have yet is a coherent explosion language for weapon- and hazard-scale combat moments. If mine detonations, bomb blasts, missile strikes, and energy shockwaves are all built ad hoc, they will drift apart visually and be harder to tune, budget, and reuse. If they are built as particle-only effects, the largest hits may lack a strong readable core. If they are built as shader-only effects, they risk becoming visually similar, overly abstract, and more fragile around transparency sorting and ground contact.

The desired direction is a single reusable explosion system built around a hybrid stack:

- a shader-driven mesh core or ring for the primary silhouette
- pooled particles for sparks, debris, smoke, and streaks
- existing feedback channels for shake, sound, and haptics

The first shipped family consists of four effects:

- Mine
- Bomb
- Missile strike
- Purple/blue pulsing shockwave emitter

The chosen visual direction is **Hybrid Arcade Combat**, and the chosen hierarchy is that **missile strike is the biggest hero hit**.

## Design Summary

Build one `ExplosionFXManager` that owns pooled effect layers and exposes a small runtime API such as:

```js
spawnEffect( {
	type,
	position,
	normal,
	direction,
	intensity,
	anchored,
	localPlayerInvolved,
} );
```

Each effect is defined as a preset timeline rather than a custom code path. Presets combine:

- a core mesh or ring timeline
- one or more particle bursts or sustained emitters
- optional aftermath layers such as smoke or pulsing energy
- optional feedback routing for camera shake, haptics, and audio

This keeps gameplay code thin, keeps effect tuning centralized, and matches the existing pooled VFX architecture already present in the project.

## Requirements

**Architecture**

- R1. Implement a single reusable `ExplosionFXManager` rather than four bespoke one-off explosion classes
- R2. The manager must own pooled `mesh layers` for blast cores and shockwave rings
- R3. The manager must own pooled `particle layers` for sparks, debris, smoke, and streak/trail elements
- R4. Gameplay systems must trigger effects through a small event-style API such as `spawnEffect({ type, position, normal, direction, intensity })`, not by constructing effect internals directly
- R5. Effect behavior must be preset-driven. Mine, bomb, missile strike, and pulse shockwave should be data/config variants over the same runtime system
- R6. The default explosion recipe should be hybrid: mesh-led silhouette plus particles. Do not treat particles or shader geometry as the exclusive solution for all four effects

**Mesh Layer Rules**

- R7. The mesh layer must provide the main readable silhouette for large moments such as bomb and missile strike
- R8. Mesh forms should stay simple and stylized: expanding sphere, dome, disc, or ring. Avoid complex volumetric simulation or multi-pass distortion as a first implementation
- R9. Grounded explosive effects should bias toward domes, flattened spheres, or horizontal rings so they sit cleanly on the track instead of reading like floating bubbles
- R10. The purple/blue shockwave emitter should use ring- and pulse-led mesh language instead of a fiery blast-ball silhouette

**Particle Layer Rules**

- R11. Particles must provide the messy secondary read: sparks, embers, debris, smoke, ingress streaks, or pulse motes
- R12. Particle implementations should follow the project's current pooled/ring-buffer style rather than introducing a general-purpose GPU particle framework
- R13. Particle layers must be independently optional per preset so quality settings can reduce smoke/debris without removing the core read of the effect

**Effect Presets**

- R14. Provide four shipped presets: `mine`, `bomb`, `missileStrike`, and `pulseShockwave`
- R15. Each preset must define its own timeline values for flash, mesh scale/opacity, particle bursts, aftermath, and feedback strengths
- R16. Each preset must be triggerable from both gameplay code and a tuning/test harness

**Mine**

- R17. Mine must read as a compact, fast ground pop rather than a large spherical detonation
- R18. Mine must use a small hot core, a short low shock ring, and a tight spark burst
- R19. Mine may use a little smoke, but smoke should remain secondary and short-lived
- R20. Mine should feel sharp and dangerous without competing with bomb or missile on spectacle

**Bomb**

- R21. Bomb must read as a rounder, fuller explosive blast than mine
- R22. Bomb must use a stronger blast core and broader smoke bloom than mine
- R23. Bomb must feel more dangerous and more spatially wide than mine, but remain clearly below missile strike in hero intensity
- R24. Bomb should favor radial expansion and debris fan-out over directional ingress storytelling

**Missile Strike**

- R25. Missile strike must be the largest hero hit in this first effect family
- R26. Missile strike must include directional storytelling, such as an incoming streak, impact slash, or debris fan biased by the strike direction
- R27. Missile strike must use the largest core mesh, the brightest flash, and the strongest feedback values in the set
- R28. Missile strike should include a stronger aftermath than mine or bomb, such as a taller smoke bloom, broader ember spread, or slightly longer decay
- R29. Missile strike must still remain readable from chase-camera distance during active driving, not only in a static test scene

**Pulse Shockwave**

- R30. Pulse shockwave must read as energy, not fire
- R31. Pulse shockwave must use purple/blue pulsing rings and energy cores as its primary visual language
- R32. Pulse shockwave should use little or no smoke by default so it remains visually distinct from mine, bomb, and missile strike
- R33. Pulse shockwave must support a pulsing emitter behavior, not just a one-shot detonation
- R34. Pulse shockwave should be usable either as an anchored emitter or as a one-shot pulse if gameplay needs both later

**Runtime Flow**

- R35. Gameplay integration must be event-driven: weapon/hazard logic emits a spawn request, and the VFX manager resolves the full effect stack
- R36. Effects must accept world position and support normal/direction hints so ground-hugging blasts and directional strikes can orient cleanly
- R37. Missile strike must accept an incoming direction so ingress streaks and directional debris can align to the attack
- R38. The system must support both one-shot effects and anchored/pulsing effects without needing separate managers

**Feedback Integration**

- R39. Local-player camera shake, impact audio, and haptics should remain coordinated with the effect system, using the same kind of hook points already used for impacts and combat feedback
- R40. Local-only feedback should be stronger than remote-player feedback, or remote instances may skip shake/haptics entirely
- R41. Feedback must be preset-specific so mine, bomb, missile strike, and pulse shockwave can each carry different perceived weight

**Performance And Quality**

- R42. All mesh layers and particle layers must be pooled. Do not allocate new scene objects per detonation during normal gameplay
- R43. Each preset must have a defined mesh budget and particle budget
- R44. If too many effects overlap, the system should drop lower-priority secondary layers first, especially smoke and debris, before dropping the core silhouette
- R45. Lower graphics settings should preserve the main blast core/ring and reduce smoke/debris counts before affecting primary readability
- R46. The total system must remain stable under repeated overlapping detonations without visible allocation spikes or unacceptable frame-time spikes

## Success Criteria

- A player can instantly distinguish mine, bomb, missile strike, and pulse shockwave at race speed
- Missile strike is the clear hero hit of the set
- Bomb feels larger and fuller than mine, but does not outshine missile strike
- Pulse shockwave reads as purple/blue energy rather than as a recolored fire explosion
- Large hits have a strong readable center shape because the mesh layer carries the primary silhouette
- Repeated detonations still perform well because layers are pooled and secondary layers degrade first

## Scope Boundaries

- **In scope:** Hybrid explosion system architecture, preset definitions for four effects, pooled mesh/particle layer design, feedback integration points, performance rules, tuning workflow expectations
- **Out of scope:** Full GPU particle framework, volumetric fluid simulation, screen-space distortion heavy enough to require a dedicated post pipeline redesign, destruction physics, environment decals, crater generation, or dynamic terrain deformation
- **Not decided here:** The exact gameplay rules for weapons/items themselves, damage numbers, explosion radius balance, or the final event names emitted by future weapon systems

## Key Decisions

- **Hybrid stack over single-tech solution:** Meshes provide the readable hero silhouette; particles provide the juice and mess
- **Missile strike is the hero hit:** Bomb and mine are intentionally scaled below it
- **Pulse shockwave gets separate visual language:** Blue/purple energy rings with minimal smoke prevents it from collapsing into "explosion but tinted"
- **Preset-driven runtime:** One manager plus four presets keeps tuning centralized and prevents copy-paste VFX logic
- **Protect readability under load:** Drop smoke/debris first, not the main blast core

## Dependencies / Assumptions

- Existing particle-style systems such as smoke, wall sparks, boost burst, and boost flame establish an accepted pooled implementation pattern
- Existing feedback hooks for camera shake, combat, and impact audio can be reused or mirrored for these new effects
- The current chase camera distance is the main gameplay readability constraint, so effect readability must be validated from that framing
- The existing VFX test range can be extended or mirrored for preset tuning, rather than requiring a brand-new tooling stack

## Outstanding Questions

### Deferred to Planning

- [Affects R8-R10][Technical] Which exact mesh primitives should ship first: sphere, dome, horizontal ring, vertical ring, or disc? The design requires simple forms, but the initial primitive set should stay minimal
- [Affects R12][Technical] Should particle implementations extend the current 3D scene VFX classes directly, or should a small shared helper be extracted once the first two presets prove out their common structure?
- [Affects R15][Technical] Where should preset definitions live so they are editable, testable, and easy to compare side by side?
- [Affects R16][Technical] Should the existing VFX test range be upgraded to render these effects in a 3D scene, or should a new tuning harness be introduced for mesh-plus-particle presets?
- [Affects R37][Technical] What is the minimum parameter set every preset should accept? `position`, `normal`, `direction`, `intensity`, and `localPlayerInvolved` is a likely starting point
- [Affects R43-R46][Needs tuning] What exact particle and mesh budgets hold 60fps on the target hardware during worst-case overlap scenarios?
- [Affects R39-R41][Technical] Which gameplay systems should own the final shake/audio trigger authority when both explosion VFX and direct combat hooks can fire on the same frame?

## Next Steps

→ Write the implementation plan for the hybrid explosion FX system once the spec is reviewed and approved
