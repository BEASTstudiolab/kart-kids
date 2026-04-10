---
date: 2026-04-10
topic: 3d-party-lobby
---

# 3D Party Lobby

## Problem Frame

The PARTY lobby is currently a flat UI overlay with text (room code, player list). It works but feels lifeless. Players waiting for friends have nothing to look at. Rendering the starting tile as a 3D environment with karts parked on it gives the lobby a sense of place and social presence — you can *see* your friends arrive.

## Requirements

**3D Lobby Scene**

- R1. When PARTY mode opens the lobby, render the `trk-finish` (3x1 starting tile) as a 3D environment behind the lobby UI.
- R2. The local player's kart appears parked on the starting tile in a grid position.
- R3. As remote players join the lobby, their karts appear on the tile in additional grid positions (like a pre-race lineup).
- R4. When a player leaves the lobby, their kart is removed from the scene.
- R5. Camera is fixed — positioned to show the full starting tile with parked karts at a cinematic/slightly elevated angle.
- R6. Basic lighting: ambient + directional (matching existing LobbyScene pattern).

**UI Overlay**

- R7. The existing lobby UI (room code, player list, track picker, START button, join link) renders on top of the 3D scene as a transparent overlay.
- R8. The lobby overlay background becomes transparent/semi-transparent so the 3D scene shows through.

**Transition**

- R9. When the host presses START, a quick fade to black transitions to the full race (normal race loading flow). No fancy camera animation.

**Kart Placement**

- R10. Karts are static/parked. No driving, no physics, no network position sync.
- R11. Grid positions: karts line up side-by-side across the width of the starting tile (up to the max player count). First position is center, additional karts alternate left/right.

## Success Criteria

- Opening PARTY shows a 3D scene with your kart on the starting tile behind the lobby UI.
- When a friend joins, their kart visually appears on the tile.
- The lobby UI remains fully functional on top of the 3D scene.
- START transitions cleanly to the full race via fade.

## Scope Boundaries

- PARTY mode only. RACE matchmaking and FREE PLAY are unchanged.
- Karts are static — no driving, no physics, no idle animations.
- No network sync of kart positions — placement is deterministic based on join order.
- No custom environments or decorations on the starting tile beyond the tile model itself.
- Camera is fixed — no orbit or player-controlled camera.

## Key Decisions

- **Static karts**: Keeps complexity minimal. No physics, no position sync. Like a pre-race grid photo.
- **Reuse LobbyScene pattern**: Existing LobbyScene already shares the renderer and creates a separate THREE.Scene with its own camera and lights. Same pattern, different content.
- **Quick fade transition**: Simple, reliable. Avoids complex camera-pull-back choreography.
- **PARTY only**: Smallest useful scope. Can extend to RACE later if desired.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] How to load the `trk-finish` model in the lobby scene — clone from Track.js model cache or load independently via ModelLoader.
- [Affects R3][Technical] How to spawn remote player karts — need their vehicle model ID from the network join message. Currently `onPlayerJoin` provides `playerId` and `name` but may not include `vehicleId`.
- [Affects R5][Technical] Exact camera position and angle for the starting tile view — needs experimentation during implementation.
- [Affects R8][Technical] Making LobbyOverlay background transparent while keeping text readable — may need text shadow or backdrop-blur adjustments.

## Next Steps

-> /ce:plan for structured implementation planning
