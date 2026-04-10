---
title: "refactor: UX Tab Bar Overhaul — 2-Click-to-Race"
type: refactor
status: completed
date: 2026-04-09
origin: docs/brainstorms/2026-04-09-ux-flow-overhaul-requirements.md
---

# refactor: UX Tab Bar Overhaul — 2-Click-to-Race

## Overview

Replace the TopNav + hash-routed pages navigation with a bottom tab bar (RACE, GARAGE, CREATE, PROFILE), consolidate 12 pages into 4 tab panels + overlays, and deliver a kart-forward main menu where returning players race in 1 tap.

## Problem Frame

The current menu has 12 routed pages with 4-5 clicks to race. Navigation is disconnected — Garage is separate from racing, Play Modes is an intermediary, Quick Play lands in a Lobby. This refactor collapses the navigation into a tab bar with the 3D kart as the hero element and a RACE button as the dominant action.

(see origin: docs/brainstorms/2026-04-09-ux-flow-overhaul-requirements.md)

## Requirements Trace

- R1: Title screen auto-skip for returning players, name modal for first-run
- R2-R3: Kart-forward main menu with 3D preview hero + RACE button
- R4-R5a: Mode chips (SOLO default, ONLINE, PRIVATE) with per-mode RACE behavior
- R6-R8: Bottom tab bar (RACE, GARAGE, CREATE, PROFILE), replaces TopNav
- R9-R12: Tab content panels for each tab
- R13: Eliminate Home, Play Modes, Quick Play, Kart Select as separate pages
- R14-R17: Lobby as overlay, Results as overlay, Pause unchanged, Settings as modal
- R17a-R17c: Tab bar visibility rules (hidden during race/overlays)
- R18-R23: Navigation flows per mode

## Scope Boundaries

- Navigation architecture replacement — significant rework of same-day code, accepted
- No new game modes or multiplayer features
- 3D preview, room system, GameEngine unchanged
- Track selection auto (random) for Solo/Online. Manual track selection deferred.
- No onboarding tutorial beyond name modal

## Context & Research

### Relevant Code and Patterns

- **AppShell.js** — owns the render loop, services bag, route registration, GameEngine lifecycle. The tab bar replaces its TopNav and route-based navigation.
- **RouterService.js** — hash-based routing with controller lifecycle (initialize→bindEvents→loadData→render→dispose). Tab panels need a different lifecycle — persistent across tab switches, not destroyed.
- **GaragePreview.js** — already built, shares WebGLRenderer, exposes update(dt). Wired via AppShell's setRenderMode.
- **PageControllerBase.js** — the base class for page controllers. Tab panel controllers can reuse its structure but won't be managed by RouterService.
- **ModalService.js** — handles focus-trapped overlays with scroll lock. Results overlay can use this. **LobbyOverlay cannot** — ModalService's focus trap and scroll lock prevent tab bar interaction underneath. Lobby must be a non-modal positioned panel instead.
- **Existing components** — CTAButton, CardGrid, Toast, ProgressBar all reusable in tab panels.
- **Page controllers to extract logic from**: Page02Home (nav rail, quick play CTA), Page04PlayModes (mode selection, track picker, startRace), Page03QuickPlay (matchmaking), Page05Lobby (room management), Page09Garage (kart stats), Page11KartSelect (kart grid, equip).

## Key Technical Decisions

- **Tab panels managed by AppShell, not RouterService**: RouterService destroys controllers on navigation — incompatible with persistent tabs. AppShell will own a TabManager that creates all 4 tab panels on bootstrap and shows/hides them. RouterService still handles overlay routes (Results, Pause) but not tab navigation.
- **Shared mode state**: The selected mode chip (SOLO/ONLINE/PRIVATE) is stored on AppShell (or a lightweight state object in the services bag). GARAGE tab's RACE button reads from it. Mode persists across tab switches.
- **Lobby as non-modal positioned panel**: LobbyOverlay is a slide-up panel positioned above tab content but below tab bar. Does NOT use ModalService (focus trap + scroll lock block tab bar interaction). Tab bar remains clickable underneath.
- **Results as ModalService overlay**: Results uses ModalService (full focus trap is fine — tab bar is hidden during results per R17b). AppShell.endRace() must be rewritten atomically with ResultsOverlay — the existing endRace navigates via RouterService to RESULTS route which must be replaced, not left as a broken intermediate state.
- **Router fallback to RACE tab**: Extend RouterService.setFallback() to accept either a route string (existing) or a callback function. Pass `() => this.switchTab('race')` as the fallback. This handles removed routes (#/home, #/play) and direct URL entry. Also change NavigationService.setRoot() from RouteIds.HOME (being removed) to RouteIds.TITLE, or remove the setRoot call entirely since tab navigation bypasses the back stack.
- **services.selectedMode initialized in constructor**: `services.selectedMode = 'solo'` set in AppShell constructor alongside other services bag properties. Eliminates nil path if user navigates to GARAGE before touching RacePanel.
- **RACE tab render mode is 'garage'**: Both RACE and GARAGE tabs use setRenderMode('garage') so the kart turntable animates. Only CREATE and PROFILE use 'idle' (dimmed/static). This keeps the kart hero alive on the main menu.
- **RacePanel creates its own NetworkClient**: Same pattern as Page03QuickPlayController. Not injected via services bag — instantiated on demand when ONLINE mode is selected.
- **Dead page cleanup in Unit 6**: All page controller pairs whose logic has been extracted into panels/overlays are explicitly listed for route removal. Page directories remain for reference but routes are deregistered.
- **Title screen becomes a conditional splash**: If Settings.isFirstRun(), show name modal then fade to RACE tab. If returning player, skip entirely — AppShell bootstraps directly to RACE tab.

## Open Questions

### Resolved During Planning

- **Tab panel lifecycle**: Panels are created once in AppShell.bootstrap(). show()/hide() via CSS display. Panels are NOT disposed on tab switch — they persist. Panel interface: constructor(container, services), show(), hide(), dispose().
- **RouterService coexistence**: RouterService still handles Pause route. Tab navigation bypasses it. A catch-all fallback route calls AppShell.switchTab('race') for unknown hashes.
- **Mode chip wiring**: RacePanel creates its own NetworkClient on demand (same pattern as QuickPlayController). SOLO calls services.startRace(). ONLINE calls networkClient.findRoom(). PRIVATE shows LobbyOverlay.
- **LobbyOverlay is non-modal**: Cannot use ModalService (focus trap blocks tab bar). Built as a positioned panel with custom z-index.
- **RACE tab render mode**: setRenderMode('garage') so kart turntable animates. Not 'idle'.
- **endRace rewrite**: Must happen atomically with ResultsOverlay creation (Unit 5). Keep RESULTS route until Unit 5 replaces it.
- **services.selectedMode**: Initialized to 'solo' in AppShell constructor.
- **URL hash during tabs**: Tabs do not change the hash. Hash stays at whatever the last route was. Refresh during GARAGE tab still loads the app (catch-all route → RACE tab).

### Deferred to Implementation

- Exact CSS for tab bar (height, icon vs text, active state styling) — visual tuning
- Animation/transition between tab panels (instant swap vs crossfade) — visual tuning
- 3D canvas content on CREATE and PROFILE tabs (dimmed kart vs neutral) — visual tuning

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
AppShell (owns everything)
├── TabBar (bottom, persistent)
│   ├── RACE tab button
│   ├── GARAGE tab button
│   ├── CREATE tab button
│   └── PROFILE tab button
├── TabPanelContainer (swaps visibility)
│   ├── RacePanel (kart preview + RACE btn + mode chips)
│   ├── GaragePanel (kart grid + stats + equip + RACE shortcut)
│   ├── CreatePanel (editor link card)
│   └── ProfilePanel (stats + settings gear)
├── OverlayContainer (above tabs, managed by ModalService)
│   ├── LobbyOverlay (PRIVATE mode — room code, members, start)
│   ├── ResultsOverlay (post-race — RACE AGAIN / QUIT)
│   ├── MatchmakingOverlay (ONLINE — spinner + cancel)
│   └── SettingsModal (from PROFILE gear icon)
├── GameEngine (3D canvas behind everything)
└── GaragePreview (turntable, shared renderer)

Tab switch: TabBar click → AppShell.switchTab(name) → hide all panels, show target, update render mode
RACE button: reads mode chip → SOLO: engine.start() | ONLINE: findRoom() | PRIVATE: show LobbyOverlay
```

## Implementation Units

- [ ] **Unit 1: Tab Bar + Tab Manager + Panel Shell in AppShell**

**Goal:** Bottom tab bar UI, tab switching logic, 4 panel containers, and CreatePanel (trivially small — static card with editor link). Returning player title skip.

**Requirements:** R1, R6, R7, R8, R11, R17a-R17c

**Dependencies:** None

**Files:**
- Modify: `js/ui/core/AppShell.js` (replace TopNav with inline tab bar, add switchTab, create panel containers, CreatePanel inline, title skip for returning players, catch-all fallback route, initialize services.selectedMode='solo')
- Modify: `js/ui/ui-theme.css` (tab bar styles, panel container styles)
- Modify: `tests/e2e/navigation.spec.js` (update TopNav assertions to tab bar)
- Modify: `tests/e2e/first-run.spec.js` (update for title skip)
- Test: `tests/e2e/tab-navigation.spec.js`

**Approach:**
- Evaluate reusing the existing js/ui/components/Tabs.js component (has ARIA, keyboard nav, panel switching, kk:tabs:change event). If its internal panel management fits (panels are created by Tabs component), use it positioned at the bottom via CSS. If it needs external panel content management, build tab bar inline in _createTabBar() following the TopNav pattern.
- Either way: 4 tabs (RACE, GARAGE, CREATE, PROFILE) with labels, aria attributes, keyboard navigation.
- Remove the hashchange listener for _syncTopNavVisibility (TopNav is gone). Add analytics.trackPageView() calls to switchTab() instead.
- Change NavigationService.setRoot() from RouteIds.HOME to RouteIds.TITLE (HOME being removed). Extend RouterService.setFallback() to accept a callback: `() => this.switchTab('race')`.
- AppShell.bootstrap() creates 4 panel container divs inside .kk-page-container. CreatePanel content (editor card + LAUNCH button) built inline — it's ~15 lines of DOM.
- switchTab(name): hide all panels (display:none), show target (display:block), update tab bar active state, update render mode ('garage' for RACE/GARAGE tabs, 'idle' for CREATE/PROFILE).
- Remove _createTopNav() and TOPNAV_HIDDEN_ROUTES.
- Tab bar visibility: startRace() hides tab bar, endRace() restores it. Independent of shell display:none.
- Catch-all fallback route: register a wildcard in RouterService that calls switchTab('race').
- Title skip: if !Settings.isFirstRun(), skip router initial dispatch, directly show RACE tab.
- Initialize services.selectedMode = 'solo' in constructor.
- Update navigation.spec.js and first-run.spec.js for new tab bar assertions and title skip.

**Patterns to follow:**
- Existing _createTopNav() inline DOM pattern in AppShell
- Existing _injectCSS() pattern for component CSS

**Test scenarios:**
- Happy path: App loads, tab bar visible with 4 tabs, RACE tab active by default
- Happy path: Clicking GARAGE tab switches panel content, GARAGE becomes active
- Happy path: CREATE tab shows editor card with LAUNCH button
- Happy path: Returning player skips title, sees RACE tab immediately
- Edge case: Tab bar hidden during race, restored after endRace
- Edge case: Navigating to #/home (removed route) → catch-all shows RACE tab
- Integration: GaragePreview render mode activates on RACE/GARAGE tabs, idle on others

**Verification:**
- 4 tabs render and switch. CREATE tab has editor link. Returning player lands on RACE tab. Removed routes fall back to RACE tab.

---

- [ ] **Unit 2: RacePanel — Kart Hero + Mode Chips + RACE Button**

**Goal:** The RACE tab content: 3D kart preview as hero, mode chips, RACE button.

**Requirements:** R2, R3, R4, R5, R5a, R9

**Dependencies:** Unit 1

**Files:**
- Create: `js/ui/panels/RacePanel.js`
- Modify: `js/ui/core/AppShell.js` (create RacePanel in bootstrap, mount in RACE tab container)
- Test: `tests/e2e/race-panel.spec.js`

**Approach:**
- RacePanel creates DOM: transparent content area (3D canvas shows through), mode chip strip (SOLO | ONLINE | PRIVATE), large RACE button.
- Mode chips: 3 buttons in a button group. Active chip has selected styling. Default: SOLO (per R5a). Selection stored on AppShell services bag as `services.selectedMode`.
- RACE button click: reads selectedMode, dispatches to appropriate handler:
  - SOLO: calls services.startRace({ mode: 'solo', trackData: TrackRegistry.getRandomTrack().cells, vehicleId: Settings.getSelectedKartId() })
  - ONLINE: shows matchmaking overlay (LoadingOverlay with cancel), calls NetworkClient.findRoom(), on success starts race
  - PRIVATE: shows LobbyOverlay via ModalService
- Extract relevant logic from Page04PlayModesController (mode selection, solo startRace) and Page03QuickPlayController (matchmaking flow).
- Kart preview: GaragePreview is already rendering via AppShell's render loop. RacePanel just ensures the transparent content area lets the canvas show through.

**Patterns to follow:**
- Page04PlayModesView for mode card styling
- Existing CTAButton component for RACE button
- Existing LoadingOverlay for matchmaking spinner

**Test scenarios:**
- Happy path: RACE tab shows mode chips with SOLO selected by default
- Happy path: Tapping SOLO chip + RACE button starts a solo race
- Happy path: Switching to ONLINE chip changes the active state
- Edge case: ONLINE matchmaking fails → error toast, offer retry
- Edge case: Mode selection persists across tab switches
- Integration: RACE button calls services.startRace() which hides tab bar and starts GameEngine

**Verification:**
- Mode chips toggle, RACE button starts a race in the selected mode. Solo race launches successfully.

---

- [ ] **Unit 3: GaragePanel — Kart Grid + Stats + Equip**

**Goal:** The GARAGE tab content: kart selection grid, stats display, equip button, secondary RACE button.

**Requirements:** R10, R22

**Dependencies:** Unit 1

**Files:**
- Create: `js/ui/panels/GaragePanel.js`
- Modify: `js/ui/core/AppShell.js` (create GaragePanel, mount in GARAGE tab container)
- Test: `tests/e2e/garage-panel.spec.js`

**Approach:**
- GaragePanel creates DOM: kart thumbnail grid (top or bottom), stats bars for selected kart, EQUIP button, secondary RACE button.
- Grid shows all karts from VehicleRegistry.getAllVehicles(). Currently equipped kart has a highlight border.
- Tapping a thumbnail: updates 3D preview via GaragePreview.setKart(kartId), shows stats for that kart.
- EQUIP button: saves to Settings.setSelectedKartId(), shows confirmation toast, updates equipped highlight.
- Secondary RACE button: reads services.selectedMode from RACE tab, starts race (same logic as RacePanel).
- Stats: read from VehicleRegistry.getVehicleStats(). Display as progress bars (reuse ProgressBar component).
- Extract logic from Page09GarageController (stats display) and Page11KartSelectController (grid, equip).

**Patterns to follow:**
- Page11KartSelectView thumbnail grid layout
- Page09GarageView stat bars with ProgressBar component
- GaragePreview.setKart() for 3D model swap

**Test scenarios:**
- Happy path: GARAGE tab shows 8 kart thumbnails in a grid
- Happy path: Tapping a kart shows its stats and updates 3D preview
- Happy path: EQUIP button saves selection, shows toast
- Happy path: Secondary RACE button starts race with equipped kart
- Edge case: Currently equipped kart has visual highlight in grid
- Edge case: Switching to RACE tab shows the newly equipped kart in preview

**Verification:**
- 8 karts in grid, tapping updates preview, equip persists, RACE button works from GARAGE tab.

---

- [ ] **Unit 4: ProfilePanel**

**Goal:** PROFILE tab content: player stats, name, settings gear.

**Requirements:** R12, R17

**Dependencies:** Unit 1

**Files:**
- Create: `js/ui/panels/ProfilePanel.js`
- Modify: `js/ui/core/AppShell.js` (create ProfilePanel, mount in PROFILE tab container)
- Modify: `tests/e2e/profile-settings.spec.js` (update for tab-based profile)
- Test: `tests/e2e/profile-panel.spec.js`

**Approach:**
- ProfilePanel: player name (from Settings.getDisplayName()), race stats summary (total races, wins, best times from Settings.getStats()), gear icon that opens Settings modal via ModalService. Extract from Page12ProfileController/View.
- Settings modal: reuse Page21SettingsController/View as the modal content. Open via ModalService from the gear icon click.
- CreatePanel is already built inline in Unit 1 (trivially small).

**Patterns to follow:**
- Page12ProfileView for stats layout
- ModalService.open() for settings modal

**Test scenarios:**
- Happy path: PROFILE tab shows player name and race stats
- Happy path: Gear icon opens settings modal
- Edge case: New player (no stats) shows zeroes
- Edge case: Settings modal closes and returns to PROFILE tab

**Verification:**
- PROFILE tab renders stats. Settings modal opens/closes.

---

- [ ] **Unit 5: LobbyOverlay + ResultsOverlay**

**Goal:** PRIVATE mode lobby and post-race results as overlays instead of routed pages.

**Requirements:** R14, R15, R23

**Dependencies:** Unit 2 (RacePanel triggers lobby)

**Files:**
- Create: `js/ui/overlays/LobbyOverlay.js`
- Create: `js/ui/overlays/ResultsOverlay.js`
- Modify: `js/ui/core/AppShell.js` (endRace shows ResultsOverlay instead of navigating to Results route)
- Test: `tests/e2e/overlays.spec.js`

**Approach:**
- **LobbyOverlay**: Non-modal positioned panel (NOT ModalService — focus trap blocks tab bar). Slide-up from bottom, positioned above tab content but below tab bar. Room code (with copy), member list, host START. Extracts from Page05LobbyController. Tab bar clickable underneath (R17c). Closed on cancel or race start.
- **ResultsOverlay**: Uses ModalService (full modal is fine — tab bar hidden per R17b). Shows results, RACE AGAIN + QUIT buttons. Per-mode behavior per R23.
- **endRace rewrite**: AppShell.endRace() rewritten in this unit — replaces the existing `this._navigation.push(RouteIds.RESULTS)` with showing ResultsOverlay directly. RESULTS route deregistered here (not in Unit 6). This must be atomic — endRace and ResultsOverlay ship together.

**Patterns to follow:**
- Page05LobbyController/View for room management logic
- Page19ResultsController/View for results display
- ModalService overlay pattern for focus management

**Test scenarios:**
- Happy path: PRIVATE mode RACE → lobby overlay appears with room code
- Happy path: Results overlay shows after race ends with RACE AGAIN + QUIT
- Happy path: QUIT returns to RACE tab
- Edge case: Tab bar clickable under lobby overlay (R17c)
- Edge case: Tab bar hidden under results overlay (R17b)
- Integration: RACE AGAIN in SOLO mode immediately starts new race without showing RACE tab

**Verification:**
- Lobby overlay manages a room. Results overlay appears post-race. RACE AGAIN and QUIT work per mode.

---

- [ ] **Unit 6: Route Cleanup + Dead Page Deregistration**

**Goal:** Remove all route registrations for pages absorbed into tabs/overlays. Clean up dead references.

**Requirements:** R13

**Dependencies:** Units 1-5

**Files:**
- Modify: `js/ui/core/AppShell.js` (remove route registrations for absorbed pages)
- Modify: `js/ui/enums/RouteIds.js` (mark absorbed routes as deprecated)
- Test: `tests/e2e/tab-navigation.spec.js` (verify removed routes fall back to RACE tab)

**Approach:**
- Remove route registrations for pages whose logic is now in panels/overlays:
  - HOME (→ RacePanel), QUICK_PLAY (→ RacePanel), PLAY (→ RacePanel), KARTS (→ GaragePanel)
  - GARAGE (→ GaragePanel), PROFILE (→ ProfilePanel), CREATE (→ CreatePanel in Unit 1)
  - RESULTS (→ ResultsOverlay, already deregistered in Unit 5)
  - LOBBY (→ LobbyOverlay, deregistered here)
- Keep routes for: TITLE (first-run only), PAUSE (in-race overlay), SETTINGS (modal fallback)
- Mark deregistered RouteIds with `// ABSORBED into tab/overlay` comments
- Page controller directories remain in repo for reference — not deleted
- Catch-all fallback (from Unit 1) handles any direct navigation to removed hashes

**Test scenarios:**
- Happy path: All removed routes (#/home, #/play, #/quick-play, #/karts, #/garage, #/profile, #/lobby) fall back to RACE tab
- Happy path: #/pause still works during race
- Edge case: Deep-linked #/settings still opens (either as route or redirects to PROFILE tab + settings modal)

**Verification:**
- No route registration for absorbed pages. All hashes either work (pause/settings) or fall back to RACE tab. E2E tests pass.

## System-Wide Impact

- **Interaction graph:** TabBar → AppShell.switchTab() → panel show/hide + render mode change. RacePanel → mode chips → startRace/findRoom/LobbyOverlay. GaragePanel → GaragePreview.setKart() + Settings.setSelectedKartId(). ResultsOverlay → RACE AGAIN triggers startRace or LobbyOverlay.
- **Error propagation:** Matchmaking failures in RacePanel show toast via NotificationService. GameEngine.start() failures restore tab bar and show toast (existing pattern from production-ready plan).
- **State lifecycle risks:** Mode chip selection must persist across tab switches (stored on services bag, not panel-local). GaragePreview must update when returning to RACE tab after equipping a new kart in GARAGE.
- **Unchanged invariants:** GameEngine lifecycle, WebSocket room system, server.js, Settings.js, VehicleRegistry, TrackRegistry, Network.js — all untouched. Only the menu UI layer changes.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| RouterService conflict with TabManager | TabManager bypasses RouterService for tab navigation. RouterService only handles Pause route. Test both work simultaneously. |
| Existing E2E tests break | E2E test updates are co-located with each unit. Run full suite after each unit. |
| Same-day rework of page controllers | Accepted cost per origin doc. Page controller logic is extracted into panels, not thrown away. |
| GaragePreview render mode coordination | Already works — AppShell.setRenderMode('garage') / 'idle' is proven. TabManager calls it on tab switch. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-09-ux-flow-overhaul-requirements.md](docs/brainstorms/2026-04-09-ux-flow-overhaul-requirements.md)
- Supersedes navigation model from: [docs/brainstorms/2026-04-09-menu-production-ready-requirements.md](docs/brainstorms/2026-04-09-menu-production-ready-requirements.md)
- Related code: js/ui/core/AppShell.js, js/ui/components/TabBar.js (new), js/ui/panels/ (new directory)
- Existing patterns: js/ui/components/TopNav (being replaced), js/ui/core/ModalService.js (for overlays)
