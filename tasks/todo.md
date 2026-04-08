# Kart Kids — Todo

## Review Fixes (Applied 2026-03-31)

- [x] P1: Preserve Y velocity in Vehicle.js drive force
- [x] P1: Add brake speed cutoff to prevent infinite creep
- [x] P1: Update CLAUDE.md to match GRID_SCALE = 1.0
- [x] P2: Adaptive ray origin height for elevation changes
- [x] P2: Wall sparks & boost burst emit at ground level
- [x] P2: Rate-limit DriftSparks emission (~30/sec)
- [x] P2: Use `??` instead of `||` for camera g-force defaults

## Deferred Review Items

- [ ] P1-3: Triangle mesh colliders built from visual meshes — if models gain LODs or decorative geometry, phantom collisions will appear. Consider separate collision meshes or filtering by mesh name convention.
- [ ] P2-8: Single player can start race alone via RaceLobby (`zoneCount >= 1`). Decide if this is intentional or if solo should go through countdown differently.
- [ ] P3-10: `window.isMobile` global — pass through constructor/config instead of polluting global scope.
- [x] P3-11: `Haptics.js` polls `navigator.getGamepads()` every frame — cache on `gamepadconnected` event instead. (PR #130)
- [ ] P3-12: `Audio.js` boost whoosh bypasses Three.js spatial audio — connects directly to `ctx.destination`. Fine for local player, wrong if ever used for remote players.
