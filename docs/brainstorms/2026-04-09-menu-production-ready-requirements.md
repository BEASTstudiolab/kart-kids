---
date: 2026-04-09
topic: menu-production-ready
---

# Menu System — Production Ready (v3 — Final)

## Problem Frame

The menu system (`menu.html`) is a well-structured UI shell with 23 pages, MVC architecture, lazy-loaded routes, and accessibility support — but it runs entirely on hardcoded mock data, has no connection to the actual game (`index.html`), and no persistence. The game already has working WebSocket multiplayer (Network.js, PlayerManager.js) with 20Hz state sync, race protocol, and spectating — but no lobby UI, no matchmaking, and no room system. To ship a playable product, the menu and game must merge into a single application, the existing multiplayer must be extended with rooms/matchmaking, and mock data must be replaced with real data.

## Requirements

**Architecture — Single SPA Merge**

- R1. Merge `menu.html` and `index.html` into a single application. The three.js canvas runs persistently behind the menu UI (3D background lobby style).
- R2. AppShell manages the full application lifecycle: menu navigation, 3D scene state, race start/stop, and post-race return to menu.
- R3. The three.js canvas renders behind all menu pages. During races, the menu UI hides and the canvas goes fullscreen. On race end, the menu UI restores over the canvas.
- R4. Garage page shows a live 3D preview of the selected character and kart (turntable rotation on a neutral background). Lobby shows player names/readiness, not a 3D preview.
- R5. The existing `main.js` game loop must be refactored into a startable/stoppable module. It currently auto-runs on import with module-scoped state and no cleanup path. This is the critical-path prerequisite for R1-R4. Acceptance criteria: (a) GameEngine.start(config) initializes scene and game loop, (b) GameEngine.stop() tears down listeners, cancels animation frames, disposes GPU resources, (c) can start/stop/restart without memory leaks, (d) module import has no side effects.
- R6. Unify the importmaps from `index.html` (includes crashcat, three/webgpu) and `menu.html` (three only) into a single importmap for the merged application. Resolve crashcat version mismatch (0.0.2 CDN vs 0.0.3 package.json).
- R7. Consolidate the two competing route registration systems: AppShell._registerRoutes() and PageRegistry.js. One must be authoritative.

**Scope — 13 Pages Ship, 10 Cut**

- R8. Ship these 13 pages: Title, Home, Quick Play, Play Modes, Lobby, Results, Pause, Garage, Kart Select, Profile, Create Hub, Settings, and a first-run Name Entry modal (not a full page).
- R9. Cut these 10 pages: Shop (15), Season Pass (14), Ranked (08), Inbox (20), Tutorial (23), Discover (18), Party (06), Events (07), Challenges (13), Character Select (10 — only 1 character exists; selection is a no-op).
- R10. Cut pages should have no nav entry points, no route registrations, and no dead links. Explicitly: remove Party from TopNav links, deregister all cut routes from both AppShell and PageRegistry, audit all views for cut RouteId references.

**Multiplayer — Extend Existing WebSocket System**

- R11. Keep the existing Network.js (WebSocketTransport, 20Hz state sync) and PlayerManager.js (remote player lifecycle, interpolation, spectating) as the multiplayer foundation. Do not replace with a third-party SDK.
- R12. Rewrite server.js multiplayer logic to be room-scoped. Currently all state (players Map, broadcast, tick, race countdown) is global. The room system requires: room creation (returns room code), room joining (by code), room listing for matchmaking, per-room player tracking, per-room broadcast, per-room race state machine, max player count (e.g., 8), and a host player (room creator). Host-only "start race" message type — server validates sender is host.
- R13. Quick Play uses auto-matchmaking: server assigns the player to an available room or creates a new one. Lobby page supports private rooms via shareable room codes.
- R14. The existing race protocol (onRaceCountdown, onRaceStart, onPlayerLap) remains peer-authoritative. Each client runs its own physics. This is the current working model — no host-authority refactor needed for v1.
- R15. Add reconnect handling: client receives a session token on welcome and stores it in sessionStorage. Server holds disconnected sessions in a separate map keyed by token for a grace period (e.g., 30 seconds). On reconnect, client sends token; server restores the player to their room. Other clients receive position updates on next tick. If grace period expires, player is removed.
- R16. Single-player mode must continue to work. PlayerManager.initSinglePlayer() already supports this. If no server is reachable or player chooses solo, race against AI locally. Play Modes page offers a "Solo Race" option that bypasses matchmaking — player picks a track, picks a kart, races against AI.

**Persistence — localStorage**

- R17. Player profile (display name, avatar choice) persists in localStorage. First-run: show a name entry modal (not a full page). Returning users skip it.
- R18. Player loadout (selected kart) persists in localStorage. Extend the existing `Settings.js` pattern.
- R19. Local race stats (total races, wins, best times) stored in localStorage. Profile page reads from this.
- R20. No backend persistence for first release. Cross-device sync deferred.

**Game Integration**

- R21. When host clicks "Start Race" in Lobby, server broadcasts race countdown to all clients. All clients hide menu UI and start the race with the selected track and kart configuration. This uses the existing onRaceCountdown/onRaceStart protocol.
- R22. When a race ends, results (positions, times) are displayed on the Results page. Local stats updated in localStorage. Results page offers: Play Again (return to Lobby with same room), Return to Home.
- R23. Kart Select page reads available karts from VehicleRegistry.js (extended with stats), not from MockData.
- R24. VehicleRegistry.js must be extended to include: display names, model paths, and gameplay stats (speed, handling, acceleration, etc.) for all available karts. This is the single source of truth replacing MockData for vehicles.
- R25. A track manifest (JSON file) must exist for track selection. Format: `{id, name, difficulty, cellDataPath, thumbnailPath}`. Lobby page includes a track picker (host selects track before starting race). Quick Play auto-selects a random track from the manifest. Server broadcasts selected track ID to all clients; clients load track by ID.
- R25a. All player-sourced strings received via WebSocket (display names, room names) must be sanitized before DOM insertion. Use textContent, not innerHTML. Validate length (max 20 chars) and strip HTML/script tags.

**UI Polish**

- R26. All 13 surviving pages must have functional controllers and views with real data binding. All 13 surviving pages currently import MockData and require data source migration. Pages confirmed on PlaceholderController: Profile, Settings, Create Hub. Pages with real controllers needing MockData replacement: Title, Home, Quick Play, Play Modes, Lobby, Garage, Kart Select, Results, Pause.
- R27. Responsive layout: playable on desktop and mobile. Minimum touch target 44x44px for menu UI.
- R28. Page transitions: no flash of white/empty content. Menu pages need transparent/semi-transparent backgrounds to composite over the 3D canvas.
- R29. Replace TopNav placeholder with real TopNav. Contents: PLAY MODES, GARAGE, CREATE, PROFILE. Active route highlighted.
- R30. Loading state for race start: progress indicator during track/model loading, error handling if assets fail, cancel button returns to Lobby.
- R31. Navigation map: Home is the hub (Quick Play, Play Modes, Garage, Profile, Create Hub, Settings). Play Modes offers: Solo Race (track pick → race with AI) and Multiplayer (→ Quick Play or Lobby). Kart Select is a child of Garage. Lobby includes track picker (host selects). Pause offers Resume, Settings, Quit to Menu. Results offers Play Again, Return to Home.

**Multiplayer UI States**

- R32. Connecting/matchmaking: loading spinner with cancel affordance.
- R33. Room full: toast notification, return to Quick Play or manual room code entry.
- R34. Mid-race disconnect: overlay with reconnect countdown timer. If reconnect fails, return to Home with error toast.
- R35. Invalid/expired room code: inline error on Lobby page room code input.

## Success Criteria

- A player can open the app, enter a name (first run only), pick a kart in the Garage, start a Quick Play match (auto-matchmaking) or create/join a private Lobby, race against other players in real-time, see results, and return to the menu — all within a single page load.
- Single-player works: a player can race solo against AI without any server connection.
- Multiplayer works: 2-8 players can race together with state synced via WebSocket at 20Hz.
- Player loadout, name, and stats persist across sessions via localStorage.
- No page shows mock/placeholder data. Pages display data from VehicleRegistry, track manifest, WebSocket state, and localStorage.
- The 3D canvas is visible behind menu pages and shows the selected kart in Garage (turntable preview).
- Cut pages are completely unreachable from the UI — no routes registered, no nav links, no dead references.

## Scope Boundaries

- No real-money transactions or shop.
- No ranked matchmaking or ELO system.
- No season pass or battle pass.
- No in-app messaging/inbox.
- No tutorial flow.
- No UGC discovery/sharing platform.
- No Firebase or third-party backend services.
- No Party page — Lobby handles room coordination.
- No Events or Challenges — need backend scheduling and game design.
- No friends list — players share room codes.
- No Character Select — only 1 character exists. Deferred until 2+ characters are authored.
- The existing `editor.html` track editor remains a separate page linked from Create Hub (opens in new tab). Not merged into SPA.
- No host-authoritative physics — peer-authoritative (each client runs physics) is the v1 model. Server-authoritative deferred to when anti-cheat matters.
- Display names are unverified and locally stored. No profanity filter in v1.
- localStorage stats are client-editable and untrusted. Server-validated stats deferred.

## Key Decisions

- **Keep existing WebSocket multiplayer over Playroom Kit**: The game already has working 20Hz state sync, race protocol, spectating, and single-player fallback via Network.js + PlayerManager.js. Replacing this with Playroom Kit would require rebuilding all game-specific networking for uncertain compatibility with the no-bundler architecture. Instead, extend server.js with room codes and matchmaking.
- **localStorage over Firebase for persistence**: No backend needed for single-device stats and loadout. `Settings.js` pattern already exists. Firebase deferred until cross-device sync is justified.
- **Single SPA merge**: Eliminates load-time handoff, enables 3D lobby background, simplifies state sharing.
- **3D background lobby**: The three.js renderer is already built — reuse it for menu ambiance and Garage preview.
- **Cut 10 pages (~43%)**: Original scope of 23 reduced to 13. Character Select cut (1 character), Party replaced by Lobby, Events/Challenges need backend.
- **Track Editor stays separate**: Has its own three.js scene and 8 ES modules. Create Hub links to editor.html in new tab.
- **Peer-authoritative networking**: Each client runs physics. Simpler, already working, acceptable for casual play. Server-authoritative deferred.
- **Name entry as modal, not page**: First-run name/avatar picker is a modal on Title screen, not a separate routed page. Reduces page count and avoids duplicating Playroom-style profile UI.

## Dependencies / Assumptions

- The existing three.js game loop in `main.js` must be refactored (R5). This is the highest-risk, highest-effort task. ~1532 lines, 51 imports, 15+ module-scoped mutable variables (scene, renderer, lights, fog, bloom pass created at module scope — not inside init()). A simple class wrapper is insufficient; all module-scope initialization must move inside a factory/start function. The difficulty is the module-scoped state, not the line count.
- VehicleRegistry.js must be extended with stats (R24). Current: 2 karts (no stats), 1 character.
- A track manifest must be created (R25). Current: tracks are hardcoded cell data or URL-encoded.
- Content gap: only 2 kart models and 1 character model exist. Shipped Garage/Kart Select will show 2 options. Content creation is a parallel workstream.
- Importmaps from index.html and menu.html must be unified (R6). Crashcat version discrepancy must be resolved.
- The two route registration systems must be consolidated (R7).
- server.js WebSocket server must be rewritten with room-scoped logic (R12). Currently all state is global — a single players Map, one broadcast function, one race state machine. Every server function must become room-scoped.
- crashcat (WASM physics) teardown capability must be verified before R5 implementation. If crashcat's registerAll() is a one-shot global init that cannot be re-invoked, the start/stop/restart model must keep the physics world alive between races and reset bodies instead.
- crashcat CDN import (esm.sh) blocks offline/LAN development. The unified importmap should resolve crashcat to a local node_modules path.
- PageRegistry.js is dead code (registerAllPages is exported but never called). Delete it during R7 consolidation. AppShell._registerRoutes() is the authoritative system.

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Technical] What is the refactoring strategy for main.js? Wrap in a class? Extract a GameEngine module? What gets torn down between races vs. persisted for the lobby 3D background?
- [Affects R4][Technical] Garage 3D preview: separate lightweight scene (turntable camera, neutral lighting, no fog/post-processing) or a mode within the race scene? Separate scene is simpler but duplicates renderer setup.
- [Affects R28][Technical] CSS strategy for transparent menu pages over the 3D canvas. Current menu.html has opaque #0a0a0a background on every element.
- [Affects R25][Needs research] What tracks currently exist as playable cell data? How many ship-ready tracks are available for the manifest?
- [Affects R12][Technical] Room system design for server.js: in-memory room map, room lifecycle (create/join/leave/destroy), matchmaking algorithm (fill existing rooms first).

## Next Steps

-> `/ce:plan` for structured implementation planning.
