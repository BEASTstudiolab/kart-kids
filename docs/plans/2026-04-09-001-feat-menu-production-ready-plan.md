---
title: "feat: Menu System Production Ready — SPA Merge + Multiplayer Rooms"
type: feat
status: completed
date: 2026-04-09
origin: docs/brainstorms/2026-04-09-menu-production-ready-requirements.md
---

# feat: Menu System Production Ready — SPA Merge + Multiplayer Rooms

## Overview

Merge the menu system (`menu.html`) and game (`index.html`) into a single SPA with a persistent 3D canvas behind the menu, extend the existing WebSocket multiplayer with room-based matchmaking, replace all MockData with real data sources, and ship 13 functional pages.

## Problem Frame

Two separate HTML applications share one repo but no runtime. The menu has 23 pages of UI on mock data; the game has working multiplayer with no lobby UI. Players must currently know a server URL to play together. This initiative bridges the gap: one app, real data, room-based multiplayer with matchmaking, and a polished menu-to-race flow.

(see origin: docs/brainstorms/2026-04-09-menu-production-ready-requirements.md)

## Requirements Trace

- R1-R7: SPA merge — single app, AppShell lifecycle, persistent 3D canvas, Garage preview, GameEngine refactor, importmap unification, route consolidation
- R8-R10: Scope — 13 pages ship, 10 cut, dead link cleanup
- R11-R16: Multiplayer — keep WebSocket, room system, matchmaking, peer-auth, reconnect, single-player
- R17-R20: Persistence — localStorage for profile, loadout, stats
- R21-R25a: Game integration — race start/end via WebSocket, VehicleRegistry, track manifest, XSS sanitization
- R26-R31: UI polish — functional controllers, responsive, transitions, TopNav, loading states, nav map
- R32-R35: Multiplayer UI states — connecting, room full, disconnect, invalid code

## Scope Boundaries

- No Firebase, no third-party backend services
- No host-authoritative physics (peer-auth v1)
- No Character Select (1 character), no Party/Events/Challenges/Shop/Ranked/Season/Inbox/Tutorial/Discover
- editor.html stays separate (linked from Create Hub in new tab)
- Content gap accepted: 2 karts, 1 character ships. Content creation is a parallel workstream
- Garage preview shows kart only (turntable). Character is auto-selected (only 1 exists). No character picker in Garage.
- localStorage stats are untrusted. Display names unverified, no profanity filter

## Context & Research

### Relevant Code and Patterns

- **Controller/View pattern**: `PageControllerBase` lifecycle: `initialize() -> bindEvents() -> loadData() -> render(container) -> dispose()`. Controllers get services via injection, views own DOM only.
- **Settings.js persistence**: Single `kart-kids-settings` localStorage key, schema versioning with migration, `settings-changed` CustomEvent. Extend this pattern.
- **CSS injection**: Components use `_injectCSS()` with `_cssInjected` guard. Global tokens in `ui-theme.css`. BEM naming with `kk-` prefix.
- **Dispose pattern**: 15+ modules already have `dispose()`: ItemPickupVFX, DraftLines, BoostFlame, CharacterAnimator, DriftSparks, BoostBurst, WallSparks, TireMarks, ProjectileManager, RearviewMirror, DamageVFX, WreckManager, WrenchPickupManager, EventBus.
- **Network protocol**: JSON over WebSocket. Server->client: welcome, playerJoin, playerLeave, world (20Hz), raceCountdown, raceStart, playerLap. Client->server: state (20Hz), spectate, lapComplete.
- **Vehicle assignment**: Server assigns vehicleIndex/tint on connect. Menu-selected vehicles used locally only via VehicleRegistry + Settings. Remote players get server-assigned models.

### Institutional Learnings

- `removeVehicleBody()` teleports to Y=-1000 instead of destroying — crashcat likely has no world destroy API. **Decision: keep physics world alive between races, reset bodies.**
- PageRegistry.js is dead code — `registerAllPages` exported but never called. Delete it.
- Ghost recordings accumulate without limit in localStorage. Adding more persistence increases quota risk. Consider LRU eviction.
- Editor Live-Play ideation (2026-04-07) rated physics teardown as "High complexity" and 65% confidence. Our approach (keep world alive) sidesteps this.
- Controls.js has partial teardown awareness (`// Touch UI elements (for teardown/rebuild)` line 37) but no complete dispose().

## Key Technical Decisions

- **GameEngine as factory function, not class wrapper**: 6 module-scope declarations plus the entire 1270-line init() function body must move inside the factory closure. A class wrapper would still execute module-scope `const scene = new THREE.Scene()` on import. The factory returns `{ start, stop, getRenderer, getScene }`. Physics world and renderer persist; game-specific state (HUD, AI, items, combat) tears down. `registerAll()` is called exactly once during `createGameEngine()` — never inside `start()`, never at module scope. This is an invariant.
- **Separate Garage preview scene**: Garage uses its own `THREE.Scene` with turntable camera and neutral lighting. Shares the `WebGLRenderer` with the race scene (switch `renderer.render(garageScene, garageCamera)` vs `renderer.render(raceScene, raceCamera)`). Avoids fog/post-processing/physics interference.
- **Keep physics world alive**: crashcat `registerAll()` likely cannot be re-invoked. Between races, reset all bodies to spawn positions and zero velocities. Track colliders persist if same track; rebuild only on track change.
- **Room-scoped server rewrite**: Every server function (broadcast, tick, race state machine) becomes room-scoped. In-memory `Map<roomCode, Room>` where Room holds players, race state, tick interval. Rooms auto-destroy when empty.
- **AppShell._registerRoutes() is authoritative**: Delete PageRegistry.js. All route registration in one place.
- **Unified importmap resolves crashcat locally**: `node_modules/crashcat` instead of esm.sh CDN. Enables offline/LAN development. Pin to 0.0.3 (package.json version).

## Open Questions

### Resolved During Planning

- **main.js refactoring strategy**: Factory function that moves all module-scope state inside. Returns start/stop/getRenderer/getScene. Physics world persists.
- **Garage 3D preview**: Separate lightweight THREE.Scene, shared WebGLRenderer. Turntable camera, neutral lighting, no fog/post-processing.
- **crashcat teardown**: Keep physics world alive. Reset bodies between races. Rebuild track colliders only on track change.
- **Route registration**: AppShell._registerRoutes() authoritative. Delete PageRegistry.js.

### Deferred to Implementation

- Exact Controls.js dispose() implementation — needs runtime testing for touch listener cleanup
- Precise CSS transparency values for menu-over-canvas compositing — visual tuning at implementation time
- Track manifest content — depends on auditing which tracks exist as playable cell data
- localStorage quota management strategy — may need LRU ghost eviction, determine threshold during implementation

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Application Lifecycle (Single SPA):

[App Load] → AppShell.bootstrap()
  ├── Create WebGLRenderer (persists for app lifetime)
  ├── Create GaragePreviewScene (lightweight, turntable)
  ├── Register routes (13 pages + name modal)
  ├── Start router → Title page
  │
  ├── [Menu Browsing] renderer.render(garageScene) on Garage page
  │                    renderer idle or ambient scene on other pages
  │
  ├── [Race Start] GameEngine.start({ track, kart, mode, network })
  │   ├── Build race scene (reuse renderer)
  │   ├── Init physics world (or reset existing)
  │   ├── Load track colliders + models
  │   ├── Spawn vehicles (local + remote via PlayerManager)
  │   ├── Start game loop (requestAnimationFrame)
  │   ├── Hide menu UI (CSS display:none on .kk-app-shell)
  │   └── renderer.render(raceScene, raceCamera) each frame
  │
  ├── [Race End] GameEngine.stop()
  │   ├── Cancel animation frame
  │   ├── Dispose game-specific systems (HUD, AI, items, combat, VFX)
  │   ├── Reset physics bodies (teleport to Y=-1000)
  │   ├── Keep renderer + physics world alive
  │   ├── Show menu UI
  │   └── Navigate to Results page with race data
  │
  └── [Room System] server.js
      ├── rooms: Map<code, Room>
      ├── Room { players, host, raceState, tickInterval, trackId }
      ├── Messages: createRoom, joinRoom, leaveRoom, startRace (host-only)
      └── Matchmaking: findAvailableRoom() → join or create
```

## Implementation Units

### Phase 1: Foundation (Unblocks Everything)

- [ ] **Unit 1: Importmap Unification & Route Consolidation**

**Goal:** Single HTML entry point with unified importmap. One route registration system.

**Requirements:** R1, R6, R7

**Dependencies:** None

**Files:**
- Modify: `index.html` (absorb menu.html structure + unified importmap)
- Delete: `menu.html` (functionality absorbed into index.html)
- Delete: `js/ui/core/PageRegistry.js` (dead code)
- Modify: `js/ui/core/AppShell.js` (remove duplicate registration if needed)
- Test: Manual verification — app loads, routes resolve, no import errors

**Approach:**
- Start from `index.html` as the surviving HTML file. Add the `<div id="app-mount">` and menu CSS from menu.html.
- Unify importmap: keep three, three/addons/, three/webgpu from index.html. Add crashcat mapped to `./node_modules/crashcat/...` (local, not esm.sh CDN). Remove esm.sh reference.
- Resolve crashcat to 0.0.3 (package.json version). Note: this is a version bump from the current 0.0.2 CDN import. After switching, verify physics behavior is unchanged (vehicle drives, collisions work, no crashcat console errors). Check crashcat changelog for breaking changes between 0.0.2 and 0.0.3.
- Delete PageRegistry.js. Verify no imports reference it (grep for `PageRegistry`).
- AppShell._registerRoutes() remains the sole registration system.

**Patterns to follow:**
- Existing importmap structure in index.html lines 65-74

**Test scenarios:**
- Happy path: App loads at localhost:3000 with no console import errors
- Happy path: Hash routes (#/, #/home, #/garage) resolve to correct pages
- Edge case: Direct URL navigation to #/garage loads correctly (no stale menu.html reference)
- Error path: Attempting to import crashcat resolves from local node_modules, not CDN
- Integration: Physics regression after crashcat 0.0.2→0.0.3 bump — vehicle drives, track collisions work, no crashcat errors

**Verification:**
- Browser console shows no module resolution failures
- All 23 existing routes still resolve (even cut pages — those are removed in Unit 2)

---

- [ ] **Unit 2: Cut Pages Cleanup**

**Goal:** Remove all traces of 10 cut pages from routes, nav, and imports.

**Requirements:** R8, R9, R10

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/core/AppShell.js` (remove 10 cut route registrations + PARTY from TopNav)
- Modify: `js/ui/enums/RouteIds.js` (comment out or remove cut route constants)
- Audit: All `js/ui/pages/` views and controllers for references to cut RouteIds
- Test: Manual verification — no route resolves to cut pages, no nav links to cut pages

**Approach:**
- Remove route registrations for: PARTY, EVENTS, RANKED, CHARACTERS, CHALLENGES, SEASON, SHOP, DISCOVER, INBOX, TUTORIAL from AppShell._registerRoutes().
- Remove PARTY from TopNav nav items array (AppShell line 237).
- Comment out cut RouteIds in RouteIds.js (keep for future re-enablement, add `// CUT v1:` prefix).
- Grep all `js/ui/` files for references to cut RouteIds. Remove or redirect dead links.
- Do NOT delete page directories — code remains for future use per origin doc.

**Patterns to follow:**
- Existing route registration pattern in AppShell._registerRoutes()

**Test scenarios:**
- Happy path: Navigating to #/party, #/events, #/ranked returns fallback (Title or 404)
- Happy path: TopNav shows only PLAY MODES, GARAGE, CREATE, PROFILE (no PARTY)
- Edge case: No surviving page view contains a link or button targeting a cut RouteId
- Integration: Router fallback works for unknown hash routes

**Verification:**
- grep -r "RouteIds.PARTY\|RouteIds.EVENTS\|RouteIds.RANKED\|RouteIds.CHARACTERS\|RouteIds.CHALLENGES\|RouteIds.SEASON\|RouteIds.SHOP\|RouteIds.DISCOVER\|RouteIds.INBOX\|RouteIds.TUTORIAL" js/ui/ returns 0 matches in non-cut files

---

### Phase 2: GameEngine Refactor (Critical Path)

- [ ] **Unit 3: Extract GameEngine Factory from main.js**

**Goal:** Transform main.js from an auto-executing monolith into a factory that returns a startable/stoppable engine. Physics world and renderer persist; game-specific state tears down.

**Requirements:** R5 (acceptance criteria a-d)

**Dependencies:** Unit 1

**Files:**
- Create: `js/GameEngine.js` (new module — the factory)
- Modify: `js/main.js` (becomes thin wrapper calling GameEngine for backwards compat)
- Modify: `js/Physics.js` (expose world reset function)
- Test: `test-game-engine.html` (standalone test page for start/stop/restart)

**Approach:**
- Create `GameEngine.js` that exports `createGameEngine(rendererEl)` factory.
- Move all 6 module-scope declarations (scene, dirLight, hemiLight, fog, renderer, bloom/postFX) plus the entire 1270-line init() body inside the factory closure. The difficulty is the module-scoped state and closures that reference it (applyLighting, resize handler, applyPlayerTints), not the line count.
- `registerAll()` is called exactly once inside `createGameEngine()` — never inside `start()`, never at module scope. This is an invariant.
- The factory returns `{ start(config), stop(), getRenderer(), getScene(), isRunning() }`.
- `start(config)` takes `{ trackData, vehicleId, mode: 'solo'|'multiplayer', networkClient? }`. trackData is the decoded cells array (same format as TRACK_CELLS).
- `stop()`: (1) Store rAF ID from requestAnimationFrame and call cancelAnimationFrame(id). Move rAF call to end of animate() so it can be conditionally skipped via a `running` flag. (2) Dispose all game-specific subsystems via a listener registry pattern: array of `{target, event, handler}` populated during start(), iterated and cleared during stop(). This prevents listener accumulation across start/stop cycles. (3) Remove all game DOM elements via a container div (single parent for all HUD elements, removed in one call). Does NOT dispose renderer or physics world.
- Controls.js dispose() is NOT deferred — it is a prerequisite for stop(). The constructor currently adds keydown/keyup/gamepadconnected/gamepaddisconnected via anonymous arrow functions with no stored references. Must refactor the constructor to store handler references as instance properties, then implement dispose() that calls removeEventListener for each. This is constructor-level refactoring, not just adding a method.
- **contactListener recreation**: createContactListener() captures game-specific objects (vehicle, audio, cam, wallSparks, haptics, bodyToVehicle, combatManager) in closures. These are disposed during stop(). contactListener must be recreated during each start() with fresh references. The animate loop must use the current contactListener reference, not a closure-captured one from a previous start().
- **rAF architecture**: GameEngine exposes `update(dt)` method. For standalone/test mode (test-game-engine.html, main.js wrapper), an optional internal rAF loop calls `engine.update(dt)`. In production, AppShell's coordinator loop calls `engine.update(dt)` directly — GameEngine does NOT run its own rAF. This avoids building a self-scheduling loop in Unit 3 only to remove it in Unit 4. Note: when restructuring rAF, the FPS cap early-return path (line 1131) must still call requestAnimationFrame when in standalone mode, or the loop stalls on capped frames.
- Physics world persists. Add `resetPhysicsWorld(world)` to Physics.js that teleports all bodies to Y=-1000 and zeros velocities. For track colliders on track change: teleport old track collider body to Y=-10000 (store reference during buildTrackColliders), then build new colliders. Old colliders accumulate at depth but are functionally inert.
- Resize handler: add null guard for postFX (`if (postFX) postFX.resize(...)`) since postFX is disposed during stop() but resize handler persists with renderer.
- `main.js` becomes: `import { createGameEngine } from './GameEngine.js'; const engine = createGameEngine(document.body); engine.start({ trackData: getTrackFromURL(), mode: 'solo' });` — preserves standalone game behavior.
- Fix Garage controller registration in AppShell._registerRoutes(): change `new Page09GarageController(s)` to `new Page09GarageController({}, s)`. Audit Page11KartSelectController for the same issue.

**Patterns to follow:**
- Existing dispose() pattern across 15+ modules
- removeVehicleBody() teleport pattern in Physics.js
- Settings.js for reading vehicle/track config

**Test scenarios:**
- Happy path: GameEngine.start() initializes scene, game loop runs, vehicle responds to input
- Happy path: GameEngine.stop() cancels animation frame, disposes HUD/AI/items, removes game DOM elements
- Happy path: GameEngine.start() again after stop() — game runs normally, no duplicate listeners
- Edge case: Importing GameEngine.js has zero side effects — no scene created, no DOM modified
- Edge case: stop() followed by start() with a different track loads new track colliders, old colliders teleported to depth
- Edge case: contactListener is fresh on second start() — no stale references to disposed objects
- Error path: start() called while already running returns error or is no-op
- Integration: Renderer persists across stop/start — no WebGL context loss
- Integration: Run 10+ track changes in sequence, measure updateWorld() tick duration — verify no broadphase degradation from accumulated inert bodies

**Verification:**
- test-game-engine.html can start a race, stop it, start another race 3 times without memory growth (check Performance tab heap snapshots)
- `import('./GameEngine.js')` alone produces no console output and modifies no DOM

---

### Phase 3: SPA Merge

- [ ] **Unit 4: AppShell + GameEngine Integration**

**Goal:** AppShell controls the GameEngine lifecycle. Menu UI composites over persistent 3D canvas.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 3

**Files:**
- Modify: `index.html` (AppShell bootstrap replaces direct GameEngine start)
- Modify: `js/ui/core/AppShell.js` (add GameEngine lifecycle management, canvas layering)
- Note: GameEngine is injected directly into the AppShell service bag (no AppShell.startRace/endRace intermediary). AppShell owns startRace()/endRace() methods that wrap GameEngine.start()/stop() with UI toggling and navigation.
- Modify: `js/ui/ui-theme.css` (add canvas layer styles, transparent page backgrounds)

**Approach:**
- AppShell.bootstrap() creates the GameEngine but does NOT start a race. The renderer's canvas is positioned behind the menu DOM (z-index layering: canvas at 0, .kk-app-shell at 1+).
- GameEngine is injected into the service bag directly. AppShell adds `startRace(config)` and `endRace(results)` methods. startRace hides .kk-app-shell (display:none), calls engine.start(). endRace calls engine.stop(), shows .kk-app-shell, navigates to Results. No AppShell.startRace/endRace intermediary — controllers call `this._services.startRace(config)` directly.
- CSS: .kk-page-container and all page backgrounds become transparent or semi-transparent (rgba with alpha). Canvas shows through as ambient 3D background.
- **Single render loop coordinator**: AppShell owns one persistent rAF loop that delegates to the current render mode: idle/ambient scene, Garage turntable preview, or race (GameEngine). GaragePreview and GameEngine expose `update(dt)` methods called by AppShell's loop — they do NOT run their own rAF. This prevents concurrent render calls fighting over the canvas.
- The idle/ambient scene renders a slowly rotating camera over neutral environment when no race is active and Garage is not visible.

**Patterns to follow:**
- AppShell service bag injection pattern
- Existing z-index layering in ui-theme.css (base=0, panel=10, topnav=100, modal=500, toast=600)

**Test scenarios:**
- Happy path: App loads showing menu with 3D canvas visible behind transparent pages
- Happy path: Starting a race hides menu, canvas goes fullscreen with game
- Happy path: Race ends, menu restores over canvas
- Edge case: Navigating between menu pages while canvas renders — no flicker, no WebGL errors
- Error path: GameEngine.start() fails (e.g., track load error) — menu UI restores with error toast

**Verification:**
- Full race loop: Title → Home → Quick Play → Race → Results → Home — all within one page load, no full-page navigation

---

- [ ] **Unit 5: Garage 3D Preview**

**Goal:** Garage page shows turntable 3D preview of selected kart using a separate lightweight scene.

**Requirements:** R4

**Dependencies:** Unit 4

**Files:**
- Create: `js/ui/GaragePreview.js` (lightweight THREE.Scene + turntable camera)
- Modify: `js/ui/pages/page09-garage/Page09GarageController.js` (integrate preview)
- Modify: `js/ui/pages/page09-garage/Page09GarageView.js` (add preview container)

**Approach:**
- GaragePreview creates its own THREE.Scene with neutral background, ambient + directional light, no fog, no post-processing.
- Turntable: auto-rotate camera around kart model at fixed distance. No user interaction for v1 (keep it simple).
- On kart selection change, load new model into preview scene, dispose old.
- Shares WebGLRenderer from GameEngine (renderer.render(garageScene, garageCam) called in a separate rAF loop or by the AppShell idle loop).
- Dispose preview when navigating away from Garage.

**Patterns to follow:**
- ModelLoader.js for GLB loading
- Vehicle.js init() for model setup

**Test scenarios:**
- Happy path: Garage page shows kart rotating on neutral background
- Happy path: Selecting different kart swaps the preview model
- Edge case: Navigating away from Garage disposes preview scene — no orphaned rAF
- Edge case: Returning to Garage re-creates preview without WebGL errors

**Verification:**
- Kart model visible and rotating on Garage page. Switching karts updates the preview.

---

### Phase 4: Server Room System

- [ ] **Unit 6: Room-Scoped Server Rewrite**

**Goal:** server.js manages multiple rooms with per-room state, broadcast, tick, and race lifecycle.

**Requirements:** R12, R13, R14, R15, R21

**Dependencies:** None (can parallel with Phase 2-3)

**Files:**
- Modify: `server.js` (rewrite multiplayer logic to be room-scoped)
- Create: `js/Room.js` or inline Room class in server.js (room state container)

**Approach:**
- `rooms: Map<string, Room>` where Room contains: `{ code, players: Map, host, raceState, trackId, tickInterval, disconnectedSessions: Map }`.
- New message types: `createRoom` (returns roomCode), `joinRoom` (by code), `leaveRoom`, `findRoom` (matchmaking — returns available room or creates new one).
- `startRace` message: server validates sender is host, then broadcasts raceCountdown to room.
- All existing messages (state, world, raceCountdown, raceStart, playerLap, spectate) become room-scoped — broadcast only to room members.
- Tick interval per room (20Hz). Stops when room is empty or race ends.
- Matchmaking: `findRoom` checks rooms with available slots and raceState=idle. Joins first match or creates new room.
- Reconnect: on welcome, server sends session token (UUID). Client stores in localStorage (not sessionStorage — sessionStorage doesn't survive mobile tab eviction) with timestamp. `disconnectedSessions: Map<token, {playerId, roomCode, timestamp}>`. Server starts 30s setTimeout on disconnect; on expiry, deletes from map and broadcasts playerLeave. On reconnect, client sends token; server validates token + TTL + room existence, restores player.
- Rooms auto-destroy when empty (all players left + no disconnected sessions).
- Max 8 players per room.
- Vehicle selection: extend joinRoom payload with `{ roomCode, vehicleId }`. Server stores vehicleId in player record. welcome echoes back vehicleId. Other clients receive playerJoin with vehicleId and render the correct model via VehicleRegistry.
- **Backward compatibility for parallel development**: clients that connect without sending createRoom/joinRoom are auto-placed in a default room. This preserves the Unit 3 main.js wrapper's standalone behavior while the room system is being developed. Remove this fallback after Unit 7 (client room integration) is complete.

**Patterns to follow:**
- Existing server.js message dispatch pattern (switch on msg.type)
- Existing 20Hz tick pattern

**Test scenarios:**
- Happy path: Client sends createRoom, receives roomCode. Second client joins with joinRoom + code, both receive playerJoin.
- Happy path: Host sends startRace, all room members receive raceCountdown/raceStart.
- Happy path: findRoom with no available rooms creates a new one. findRoom with available room joins it.
- Edge case: Non-host sends startRace — server rejects, no countdown.
- Edge case: Player disconnects mid-race, reconnects within 30s with token — restored to room.
- Edge case: Player disconnects, grace period expires — removed from room, other players get playerLeave.
- Edge case: All players leave — room destroyed, tick stopped.
- Error path: joinRoom with invalid code — server sends error message.
- Error path: joinRoom on full room (8 players) — server sends roomFull error.
- Integration: Two rooms running simultaneously — ticks and broadcasts don't leak between rooms.

**Verification:**
- Two browser tabs can create/join a room, race together, and see results. A third tab can create a separate room without interference.

---

- [ ] **Unit 7: Client-Side Room Integration**

**Goal:** Network.js and menu pages use the room system for matchmaking and lobby coordination.

**Requirements:** R13, R16, R32-R35

**Dependencies:** Unit 6, Unit 4

**Files:**
- Modify: `js/Network.js` (add createRoom, joinRoom, findRoom, startRace methods + reconnect with localStorage token)
- Modify: `js/ui/pages/page03-quick-play/Page03QuickPlayController.js` (auto-matchmaking via findRoom)
- Modify: `js/ui/pages/page05-lobby/Page05LobbyController.js` (room creation, joining, member list, track picker, start race)
- Modify: `js/ui/pages/page05-lobby/Page05LobbyView.js` (room code display, member list UI, track picker UI)

**Approach:**
- NetworkClient gets new methods: `createRoom()`, `joinRoom(code)`, `findRoom()`, `startRace(trackId)`.
- Add reconnect flow: on welcome, store session token in localStorage with timestamp (not sessionStorage — doesn't survive mobile tab eviction). On disconnect, attempt reconnect with token if within TTL.
- Quick Play controller: call `findRoom()`, show connecting spinner (R32), on success navigate to Lobby with room context.
- Lobby controller: show room code (shareable), member list from onPlayerJoin/Leave, track picker from track manifest, "Start Race" button (visible only to host). Handle room full (R33), invalid code (R35).
- Single-player fallback (R16): if WebSocket connect fails or player chooses Solo from Play Modes, skip network entirely. Call GameEngine.start({ mode: 'solo' }).

**Patterns to follow:**
- Existing NetworkClient callback pattern (onWelcome, onPlayerJoin, etc.)
- Controller/View pattern from PageControllerBase

**Test scenarios:**
- Happy path: Quick Play → connecting spinner → auto-joined room → Lobby with other players
- Happy path: Lobby shows room code, member list updates on join/leave, host sees Start Race button
- Happy path: Host selects track from picker, clicks Start Race → all clients enter race
- Edge case: Quick Play with no server → error toast → fallback to Play Modes
- Edge case: Room full → toast notification → return to Quick Play
- Edge case: Invalid room code → inline error under code input
- Edge case: Mid-race disconnect → overlay with countdown → reconnect restores to race
- Integration: Play Modes → Solo Race → bypasses network, races against AI locally

**Verification:**
- Full multiplayer flow: Quick Play → Lobby → Race → Results → Play Again, across two browser tabs.

---

### Phase 5: Data Migration

- [ ] **Unit 8: VehicleRegistry Extension & Track Manifest**

**Goal:** Real data sources for kart selection and track selection.

**Requirements:** R23, R24, R25

**Dependencies:** None (can parallel)

**Files:**
- Modify: `js/VehicleRegistry.js` (add stats, display names, character data)
- Create: `js/TrackRegistry.js` (static TRACKS array, following VehicleRegistry pattern)

**Approach:**
- VehicleRegistry: extend PLAYER_VEHICLES entries with `{ id, label, path, characterOffset, stats: { speed, handling, acceleration, weight, boost } }`. Add a PLAYER_CHARACTERS array (currently just 1 entry). Export `getAllVehicles()`, `getVehicleStats(id)`, `getAllCharacters()`.
- TrackRegistry.js: static TRACKS array following VehicleRegistry pattern. Each entry: `{ id, name, difficulty, cells }` where cells is the decoded cells array (same format as TRACK_CELLS). No async fetch, no JSON file, no cache — just a static export. Audit current track data (TRACK_CELLS in Track.js, URL-encoded tracks, editor saves) to determine available tracks and populate the array.
- Export `getTracks()`, `getTrackById(id)`, `getRandomTrack()`.

**Patterns to follow:**
- Existing VehicleRegistry.js structure
- Settings.js for data shape conventions

**Test scenarios:**
- Happy path: `getAllVehicles()` returns 2 karts with full stats
- Happy path: `getTracks()` returns array of tracks from static export
- Edge case: `getTrackById('nonexistent')` returns null/undefined

**Verification:**
- Console: `VehicleRegistry.getAllVehicles()` returns 2 entries with stats. `TrackRegistry.getTracks()` returns available tracks.

---

- [ ] **Unit 9: localStorage Persistence Layer**

**Goal:** Player profile, loadout, and race stats persist across sessions.

**Requirements:** R17, R18, R19

**Dependencies:** None (can parallel)

**Files:**
- Modify: `js/Settings.js` (add profile, loadout, stats fields + schema migration)

**Approach:**
- Extend Settings.js SCHEMA_VERSION to 3. Current v2 schema contains: handedness, accelerometer, cameraMode, quality, vehicleId, characterId, ghostEnabled, characterAccessories. Migration v2→v3 preserves all v2 fields, adds new fields in separate namespaces to avoid collisions: `profile: { displayName: null, avatarChoice: null }`, `loadout: { selectedKartId: PLAYER_VEHICLES[0].id }`, `stats: { totalRaces: 0, wins: 0, bestTimes: {} }`.
- `isFirstRun()`: returns true if displayName is null.
- Profile page reads raceStats. Garage reads/writes selectedKartId. Name modal reads/writes displayName + avatarChoice.
- Broadcast `settings-changed` CustomEvent on updates so UI reacts.

**Patterns to follow:**
- Existing Settings.js schema migration (v0→v1→v2)
- Existing `settings-changed` CustomEvent pattern

**Test scenarios:**
- Happy path: First load — displayName is null, isFirstRun() returns true
- Happy path: Set displayName → persists across page reload
- Happy path: Select kart → selectedKartId persists
- Happy path: Complete a race → raceStats.totalRaces increments, persists
- Edge case: Schema migration from v2 — existing settings preserved, new fields initialized
- Edge case: localStorage cleared — treated as first run
- Error path: localStorage quota exceeded — set() fails gracefully (try/catch, no crash)

**Verification:**
- Settings data survives page reload. Schema migration runs on first load after upgrade.

---

- [ ] **Unit 10: MockData Removal — Per-Page Migration**

**Goal:** All 13 surviving pages use real data sources instead of MockData.

**Requirements:** R26

**Dependencies:** Units 8, 9

**Files:**
- Modify: 13 page controllers (Title, Home, Quick Play, Play Modes, Lobby, Garage, Kart Select, Results, Pause, Profile, Settings, Create Hub + name modal)
- Modify: `js/ui/repositories/mocks/MockData.js` (delete or deprecate)

**Approach:**
- Map each page's MockData dependencies to real sources:
  - **Title**: No data needed (static splash)
  - **Home**: Player name from Settings, basic stats from Settings.raceStats
  - **Quick Play**: No MockData (matchmaking via NetworkClient)
  - **Play Modes**: Static mode list (Solo Race, Quick Play, Private Lobby) — hardcode in controller, not MockData
  - **Lobby**: Players from NetworkClient events, tracks from TrackRegistry, room code from NetworkClient
  - **Garage/Kart Select**: Karts from VehicleRegistry, selected from Settings.selectedKartId
  - **Results**: Race data from AppShell.startRace/endRace.endRace() payload, write stats to Settings
  - **Pause**: Static options (Resume, Settings, Quit)
  - **Profile**: Stats from Settings.raceStats, name from Settings.displayName
  - **Settings**: Existing Settings.js (already real data)
  - **Create Hub**: Static content (link to editor.html)
- Build 3 PlaceholderController replacements: Profile, Create Hub (Settings already has a real controller per PageRegistry, verify).
- Delete MockData.js when all imports are removed.

**Patterns to follow:**
- Existing controller loadData() / render() pattern
- Settings.js get/set pattern

**Test scenarios:**
- Happy path: Each page renders with real data — no "lorem ipsum" or mock names visible
- Happy path: Garage shows 2 karts from VehicleRegistry with real stats
- Happy path: Profile shows actual race stats from localStorage
- Edge case: First run (no stats) — Profile shows zeroes, not errors
- Edge case: No network — pages that depend on WebSocket show appropriate empty/offline states
- Integration: grep for "MockData" in js/ui/ returns 0 matches after migration

**Verification:**
- `grep -r "MockData" js/ui/` returns 0 results. All 13 pages render without errors.

---

### Phase 6: UI Polish

- [ ] **Unit 11: TopNav, Navigation Map & Name Modal**

**Goal:** Real TopNav with correct links. First-run name entry modal. Navigation between all 13 pages works per R31.

**Requirements:** R17, R29, R31

**Dependencies:** Units 4, 9

**Files:**
- Modify: `js/ui/core/AppShell.js` (replace TopNav placeholder with real nav items, add name modal trigger)
- Create: `js/ui/components/NameEntryModal.js` (first-run name + avatar picker)
- Modify: `js/ui/pages/page04-play-modes/Page04PlayModesController.js` (add Solo Race + Multiplayer options)

**Approach:**
- TopNav links: PLAY MODES, GARAGE, CREATE, PROFILE. Active route highlighted via existing `_updateTopNavActiveRoute()`.
- Name modal: triggered on first app load if `Settings.isFirstRun()`. Uses existing ModalService for focus trapping. Collects display name (text input, max 20 chars, sanitized) + avatar choice (predefined set). Saves to Settings.
- Play Modes page: two options — "Solo Race" (→ track pick inline or via Lobby-like UI, then GameEngine.start solo) and "Multiplayer" (→ choice of Quick Play or Private Lobby).

**Patterns to follow:**
- Existing ModalService/ConfirmationDialog pattern
- Existing TopNav _createTopNav() structure
- Settings.js get/set for persistence

**Test scenarios:**
- Happy path: First visit → name modal appears → enter name → modal closes → name persists
- Happy path: Return visit → no modal, straight to Title/Home
- Happy path: TopNav shows 4 links, active link highlighted on route change
- Happy path: Play Modes → Solo Race → track pick → race starts against AI
- Happy path: Play Modes → Multiplayer → Quick Play or Private Lobby options
- Edge case: Name modal — empty name submission blocked
- Edge case: Name with HTML tags → sanitized to plain text via textContent
- Integration: Full nav flow per R31 — Home → Garage → Kart Select → back → Play Modes → Solo Race → Results → Home

**Verification:**
- Complete navigation flow works per R31 nav map. Name entry persists across sessions.

---

- [ ] **Unit 12: Loading States, Multiplayer UI States & CSS Polish**

**Goal:** Loading indicator for race start. Multiplayer error/status UI. Transparent menu CSS over 3D canvas.

**Requirements:** R25a, R27, R28, R30, R32-R35

**Dependencies:** Units 4, 7

**Files:**
- Create: `js/ui/components/LoadingOverlay.js` (race loading progress)
- Create: `js/ui/components/DisconnectOverlay.js` (mid-race disconnect with countdown)
- Modify: `js/ui/ui-theme.css` (transparent backgrounds, canvas layering)
- Modify: Various page views (sanitize all player-sourced strings with textContent)

**Approach:**
- LoadingOverlay: shown between "Start Race" and game loop start. Spinner + "Loading track..." text. Cancel button returns to Lobby. Error state shows toast and returns to Lobby.
- DisconnectOverlay: shown on mid-race disconnect. Countdown timer (30s). On reconnect, overlay dismisses. On timeout, navigate to Home with error toast.
- CSS: `.kk-page-container` background → `transparent`. `.kk-app-shell` → `background: transparent`. Individual page backgrounds → `rgba(10, 10, 10, 0.85)` for readability over canvas. Canvas positioned at `z-index: 0`, menu shell at `z-index: 1`.
- XSS: audit all views that render player names (Lobby member list, Results page). Use textContent for all player-sourced strings from WebSocket. Add `sanitizePlayerName(str)` utility: trim, max 20 chars, strip HTML.
- Responsive: ensure minimum 44x44px touch targets on buttons/links. Test on mobile viewport.

**Patterns to follow:**
- Existing Toast component for notifications
- Existing ModalDialog for overlays
- ui-theme.css z-index conventions

**Test scenarios:**
- Happy path: Race start shows loading overlay → loading completes → overlay disappears → race starts
- Happy path: Menu pages are semi-transparent, 3D canvas visible behind them
- Edge case: Race loading cancelled → returns to Lobby, no orphaned game state
- Edge case: Asset load failure → error toast, returns to Lobby
- Edge case: Mid-race disconnect → overlay with countdown → reconnect dismisses overlay
- Edge case: Disconnect timeout → navigate to Home with "Connection lost" toast
- Edge case: Player name with `<script>` tag → rendered as plain text, no XSS
- Integration: Mobile viewport (375px width) → touch targets ≥ 44x44px, no horizontal overflow

**Verification:**
- 3D canvas visible behind all menu pages. Loading overlay appears and dismisses correctly. No XSS possible via display names.

---

## System-Wide Impact

- **Interaction graph:** AppShell → AppShell.startRace/endRace → GameEngine → Physics/PlayerManager/Network. Menu controllers read from Settings, VehicleRegistry, TrackRegistry, NetworkClient. Server.js rooms emit events consumed by NetworkClient callbacks consumed by controllers.
- **Error propagation:** WebSocket errors → NetworkClient.onDisconnect → AppShell.startRace/endRace handles (if racing: show disconnect overlay; if in menu: show toast). GameEngine.start() errors → AppShell.startRace/endRace catches → shows toast, restores menu.
- **State lifecycle risks:** Physics world persists — bodies must be fully reset between races. Renderer context shared between garage preview and race — must not be disposed. localStorage writes on every Settings.set() — quota risk from ghost recordings.
- **API surface parity:** WebSocket protocol extended with room messages (createRoom, joinRoom, findRoom, startRace). Existing messages unchanged but room-scoped. Vehicle selection extends welcome message.
- **Integration coverage:** Full race loop (menu → matchmaking → lobby → race → results → menu) is the primary integration test. Must test with 2+ browser tabs for multiplayer. Single-player path must work without server.
- **Unchanged invariants:** Editor (editor.html) is untouched. Track file format unchanged. Vehicle physics unchanged. AI behavior unchanged. Ghost replay unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|-----------|
| Phase 2 + Phase 4 run in parallel with no integration checkpoint | Unit 7 depends on both. Add an integration checkpoint: before starting Unit 7, verify that Unit 3's standalone mode works with Unit 6's backward-compat server. Run a manual 2-player test. |
| main.js refactor (R5) is highest-risk, blocks Phase 3-6 | Phase 2 is isolated — can be developed and tested standalone before integration. Keep physics world alive to avoid crashcat teardown risk. |
| crashcat registerAll() may not support re-invocation | Decision: keep world alive, reset bodies. Avoids the issue entirely. |
| Server room rewrite is a full rewrite of multiplayer logic | Can be developed in parallel with Phase 2-3. Existing standalone game (main.js wrapper) continues working during development. |
| Content gap (2 karts, 1 character) | Acknowledged and accepted. Garage/Kart Select will show limited options. Content creation is a parallel workstream. |
| localStorage quota from ghost recordings + new persistence | Deferred: monitor quota usage. If needed, add LRU ghost eviction in a follow-up. |
| WebGL context loss during long menu browsing sessions | Three.js handles context loss/restore. Renderer persists — should recover automatically. Monitor during testing. |
| Mobile performance with 3D canvas always rendering | Use requestAnimationFrame only when canvas is visible. Reduce render quality on mobile via existing adaptive quality system. |

## Documentation / Operational Notes

- server.js room system changes the deployment model: server now manages room state, not just relay. Monitor memory usage if many rooms accumulate.
- New WebSocket message types (createRoom, joinRoom, etc.) are breaking changes for any existing clients. Since the game is pre-release, this is acceptable.
- The track manifest (data/tracks.json) is a new file that must be maintained alongside track creation.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-09-menu-production-ready-requirements.md](docs/brainstorms/2026-04-09-menu-production-ready-requirements.md)
- Related code: js/main.js, js/Network.js, js/PlayerManager.js, server.js, js/ui/core/AppShell.js, js/Settings.js, js/VehicleRegistry.js, js/Physics.js
- Menu architecture: js/ui/core/PageControllerBase.js, js/ui/core/RouterService.js
- Existing dispose patterns: js/DriftSparks.js, js/BoostFlame.js, js/TireMarks.js, js/ProjectileManager.js, js/WreckManager.js
