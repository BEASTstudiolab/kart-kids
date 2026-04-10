---
title: "refactor: Race Mode User Journeys"
type: refactor
status: completed
date: 2026-04-10
origin: docs/brainstorms/2026-04-10-race-mode-flows-requirements.md
---

# refactor: Race Mode User Journeys

## Overview

Restructure the three race modes (SOLO/ONLINE/PRIVATE -> RACE/FREE PLAY/PARTY) with clear naming, mode-appropriate track selection, a shared TrackBrowser component, and dynamic PLAY screen layout that shows/hides the track browser based on mode.

## Problem Frame

The three race modes have unclear naming, identical UI regardless of mode, and confusing flows. RACE mode shows track selection that's irrelevant (server picks the track). FREE PLAY and PARTY need a full track browser but only get a compact card. The TRACKS tab conflates track management with race selection.

(see origin: docs/brainstorms/2026-04-10-race-mode-flows-requirements.md)

## Requirements Trace

- R1. Rename display labels: RACE / FREE PLAY / PARTY. Internal IDs stay `solo`, `online`, `private`.
- R2. Chip strip (all 3 visible) replaces cycling button.
- R3. RACE is default mode.
- R4. RACE: no track selection, server auto-selects from official pool.
- R5. RACE: transient matchmaking overlay with cancel.
- R6. RACE: minimal UI — chip strip + PLAY only.
- R7-R10. FREE PLAY: inline track browser, both official + custom tracks, default always pre-selected.
- R11-R15. PARTY: same track browser as FREE PLAY + room creation + join flow + LobbyOverlay with track data.
- R16-R18. Dynamic layout: RACE = minimal, FREE PLAY/PARTY = track browser visible.
- R19. Matchmaking failure: 30s timeout, toast with fallback suggestion.
- R20-R24. TRACKS tab = workshop only (manage, create, edit, delete, share).

## Scope Boundaries

- Minimal networking changes only (LobbyOverlay gains track parameter, startRace sends cell data).
- No new track editor features.
- No changes to GameEngine or race logic.
- Mobile: track browser stacks to single column. Full responsive polish deferred.

## Key Technical Decisions

- **Extract TrackBrowser component from TracksPanel**: The track browse/select UI (detail panel + carousel rows + minimap + card rendering) becomes a standalone component. TracksPanel composes it and adds workshop actions (delete/share/create). RacePanel embeds it for FREE PLAY/PARTY. This avoids code duplication.
- **CSS class toggle for dynamic layout**: RacePanel adds/removes `kk-race-panel--browse` class. When absent (RACE mode), track browser is `display: none`. When present, track browser renders to the left of the controls column. Simple, no DOM rebuild.
- **Chip strip replaces cycling button**: Restores the original chip strip pattern from before the Fortnite layout refactor. 3 buttons in a group, active one highlighted. Already had this pattern — just needs the new labels.
- **Internal mode IDs unchanged**: `solo`, `online`, `private` stay as-is. Only `MODE_LABELS` map changes. Zero migration risk.
- **LobbyOverlay.show() gains track parameter**: `show(networkClient, trackData)`. Passes cell data (not trackId) to server in startRace, since custom tracks only exist in host's localStorage.

## Open Questions

### Resolved During Planning

- **TrackBrowser extraction boundary**: Browse/select/minimap/cards are shared. Delete/share/create actions stay in TracksPanel. TrackBrowser emits an `onTrackSelected(trackId)` callback. Parent manages Settings persistence.
- **CHANGE button removal**: The existing CHANGE button (navigates to TRACKS tab) is removed. Track selection happens inline via the TrackBrowser in FREE PLAY/PARTY mode.
- **Join flow UI**: PARTY chip shows a JOIN button below PLAY when PARTY is active. Tapping opens a room code input modal via ModalService.

### Deferred to Implementation

- Exact TrackBrowser constructor API shape — determine during extraction
- Whether chip strip needs mobile-specific sizing

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
Mode: RACE (online)           Mode: FREE PLAY / PARTY
┌──────────────────────┐      ┌────────────────────────────────────────┐
│                      │      │  TrackBrowser        │  Controls      │
│   3D Lobby Scene     │      │  ┌──────────┐       │  ┌──────────┐  │
│                      │      │  │ Detail    │       │  │RACE      │  │
│                      │      │  │ Panel     │       │  │FREE PLAY │  │
│                      │      │  │ + Minimap │       │  │PARTY     │  │
│                      │      │  └──────────┘       │  └──────────┘  │
│   ┌──────────┐       │      │  ┌──────────┐       │                │
│   │RACE      │       │      │  │ Official │       │  ┌──────────┐  │
│   │FREE PLAY │       │      │  │ Carousel │       │  │  PLAY!   │  │
│   │PARTY     │       │      │  └──────────┘       │  └──────────┘  │
│   └──────────┘       │      │  ┌──────────┐       │                │
│   ┌──────────┐       │      │  │ My Tracks│       │  ┌──────────┐  │
│   │  PLAY!   │       │      │  │ Carousel │       │  │   JOIN   │  │
│   └──────────┘       │      │  └──────────┘       │  └──────────┘  │
└──────────────────────┘      └────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Extract TrackBrowser Component**

**Goal:** Extract the browse/select/minimap UI from TracksPanel into a reusable TrackBrowser component.

**Requirements:** R7, R8, R10, R16-R18

**Dependencies:** None

**Files:**
- Create: `js/ui/components/TrackBrowser.js`
- Modify: `js/ui/panels/TracksPanel.js`

**Approach:**
- Move from TracksPanel into TrackBrowser: detail panel DOM, carousel rows (official + my tracks), card rendering, minimap rendering, arrow navigation, card click -> select behavior
- TrackBrowser constructor: `(container, { onTrackSelected, showManageActions })`. `onTrackSelected` defaults to no-op if null/undefined. When `showManageActions` is false, cards don't show delete/share/edit icons
- TrackBrowser exposes: `show()`, `hide()`, `refresh()`, `getSelectedTrackId()`, `dispose()`
- TracksPanel becomes a thin wrapper: creates TrackBrowser with `showManageActions: true`, adds CREATE TRACK card at end of my tracks row
- TrackBrowser manages its own CSS injection via the existing `_injectCSS` static pattern
- Move the existing CSS for detail panel, carousel, cards, badges, arrows into TrackBrowser. Keep the `.kk-tracks__*` CSS prefix to avoid a large rename — the prefix refers to "tracks" the concept, not TracksPanel the class
- TracksPanel keeps its opaque background and workshop-specific CSS

**Patterns to follow:**
- Existing `_injectCSS()` static guard pattern (TracksPanel, RacePanel, GaragePanel)
- Panel constructor pattern: `(container, services/options)`
- Card rendering pattern from TracksPanel._buildOfficialCard / _buildUserCard

**Test scenarios:**
- Happy path: TrackBrowser renders detail panel + two carousel rows (official, my tracks)
- Happy path: Clicking a card calls onTrackSelected with correct trackId
- Happy path: Detail panel updates when a different card is clicked
- Happy path: Minimap renders on detail panel and card thumbnails
- Edge case: No user tracks — my tracks row shows empty state
- Edge case: showManageActions=false hides delete/share/edit icons on cards
- Integration: TracksPanel still renders correctly after extraction (composes TrackBrowser)

**Verification:**
- TrackBrowser renders independently. TracksPanel uses it and still works. No visual regression on TRACKS tab.

---

- [ ] **Unit 2: Chip Strip + Mode Labels**

**Goal:** Replace the cycling mode button with a chip strip showing all 3 modes, with new display labels.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- Replace single `_modeToggle` button with a chip strip container + 3 chip buttons
- Reuse the chip strip CSS pattern from the original RacePanel (before Fortnite layout) — `.kk-race-panel__chips` and `.kk-race-panel__chip` classes
- Update `MODE_LABELS`: `{ solo: 'FREE PLAY', online: 'RACE', private: 'PARTY' }`
- Active chip gets `--active` class with orange glow
- Click handler calls `_setMode(modeId)` instead of `_cycleMode()`
- Remove `_cycleMode()`, add `_setMode(modeId)` which updates services.selectedMode and toggles chip active state
- Chip strip goes inside the right-bottom controls column (same position as current toggle)

**Patterns to follow:**
- Original chip strip from RacePanel (pre-Fortnite refactor, still in git history)
- Existing `.kk-race-panel__chip--active` CSS pattern

**Test scenarios:**
- Happy path: All 3 chips visible with labels RACE, FREE PLAY, PARTY
- Happy path: Tapping a chip selects it (active class + aria-pressed)
- Happy path: services.selectedMode updates to correct internal ID (solo/online/private)
- Edge case: Default mode (online/RACE) is highlighted on first load

**Verification:**
- Three chips visible, correct labels, active state works, internal IDs unchanged.

---

- [ ] **Unit 3: Dynamic PLAY Screen Layout**

**Goal:** Show/hide the TrackBrowser on the PLAY screen based on selected mode. RACE = minimal, FREE PLAY/PARTY = track browser visible.

**Requirements:** R4, R6, R7, R8, R16-R19

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- RacePanel creates a TrackBrowser instance in `_build()`, mounted in a container div to the left of the controls column
- Add CSS class `kk-race-panel--browse` on the panel root when mode is FREE PLAY or PARTY
- When `--browse` is absent: track browser container is `display: none`, controls column takes full width (current minimal layout)
- When `--browse` is present: two-column layout — track browser left, controls right
- `_setMode()` toggles the class and calls `trackBrowser.show()` / `trackBrowser.hide()`
- TrackBrowser `onTrackSelected` callback persists to Settings and updates the selected state
- Remove the old track info card (track name + CHANGE button + minimap) — replaced by TrackBrowser
- RACE mode ignores Settings.selectedTrackId — matchmaking flow uses server-provided track
- Add matchmaking timeout handling (R19): existing `findRoom()` has a 10s timeout — update to 30s, and on timeout/failure dismiss overlay + show toast "No match found — try again or play Free Play"

**Patterns to follow:**
- CSS class toggle pattern (used throughout — `kk-panel--active`, `kk-chip--active`)
- TrackBrowser API from Unit 1

**Test scenarios:**
- Happy path: RACE mode shows only chip strip + PLAY button, no track browser
- Happy path: Switching to FREE PLAY shows track browser with detail panel + carousels
- Happy path: Switching back to RACE hides track browser
- Happy path: Selecting a track in FREE PLAY persists to Settings
- Happy path: PARTY mode shows identical track browser to FREE PLAY
- Integration: Track selected in browser -> tap PLAY -> race starts with that track
- Error path: RACE mode matchmaking timeout (30s) dismisses overlay + shows fallback toast

**Verification:**
- RACE mode is minimal. FREE PLAY/PARTY show full track browser. Mode switching toggles layout dynamically.

---

- [ ] **Unit 4: PARTY Join Flow + LobbyOverlay Track Data**

**Goal:** Add JOIN button for PARTY mode guests, pass host-selected track to LobbyOverlay and server. Support both host and guest paths in LobbyOverlay.

**Requirements:** R11-R15

**Dependencies:** Unit 3

**Files:**
- Modify: `js/ui/panels/RacePanel.js`
- Modify: `js/ui/overlays/LobbyOverlay.js`

**Approach:**
- RacePanel: when PARTY mode is active, show a JOIN button below PLAY. Tapping opens a room code input modal via `services.modal.open()` with a text input field. On submit, calls `NetworkClient.joinRoom(code, vehicleId)`
- RacePanel._startPrivateLobby(): pass the resolved track data to `this._lobbyOverlay.show(this._network, trackData)`
- LobbyOverlay.show() signature: `show(networkClient, { trackData, isHost })`. Stores `this._trackData` and `this._isHost`
- Host path (isHost=true): createRoom(), show track info, enable START button
- Guest path (isHost=false): joinRoom(code) already called by RacePanel before show(), LobbyOverlay shows waiting state with no START button, displays host's track when received from server
- LobbyOverlay: display track name + minimap to all lobby members (host and joiners see the same track)
- LobbyOverlay._handleStart(): pass `this._trackData` to `this._network.startRace(trackData)` instead of null
- NetworkClient.startRace(): send full cell data in the message payload (not just trackId), since custom tracks only exist in host localStorage

**Patterns to follow:**
- NameEntryModal pattern for the join code input modal (lazy-import + ModalService)
- LobbyOverlay existing createRoom/connect flow
- LoadingOverlay cancel pattern for matchmaking timeout

**Test scenarios:**
- Happy path: PARTY mode shows JOIN button below PLAY
- Happy path: Tapping JOIN opens room code input modal
- Happy path: Entering valid code joins room and shows LobbyOverlay
- Happy path: LobbyOverlay shows host-selected track name + minimap
- Happy path: Host START sends track cell data to server
- Error path: Invalid room code shows error toast
- Edge case: JOIN button hidden in RACE and FREE PLAY modes
- Happy path: Guest joins room -> sees LobbyOverlay in waiting state (no START button)
- Happy path: Guest sees host-selected track name in lobby

**Verification:**
- Guests can join via code. Host's track selection visible to all lobby members. Track data sent to server on START.

---

- [ ] **Unit 5: TRACKS Tab Workshop Repurpose**

**Goal:** Repurpose TRACKS tab from track selection to track management workshop.

**Requirements:** R20-R24

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/panels/TracksPanel.js`

**Approach:**
- TracksPanel creates TrackBrowser with `showManageActions: true` and `onTrackSelected: null` (clicking a card shows management actions, not race selection)
- Remove the cyan "SELECTED" badge and selection highlight from cards on TRACKS tab
- Track card click opens an action sheet or reveals inline action buttons (edit, share, delete) instead of selecting for racing
- Official tracks show as view-only — no edit/delete icons, only browse
- Keep CREATE TRACK card at end of my tracks row
- Keep share (copy link) and delete (with confirmation) functionality as-is

**Patterns to follow:**
- Existing TracksPanel delete/share/edit action handlers
- Existing card action icon button pattern (`.kk-tracks__icon-btn`)

**Test scenarios:**
- Happy path: TRACKS tab shows track cards without selection highlight
- Happy path: Clicking a user track card reveals management actions (edit, share, delete)
- Happy path: Official tracks show as view-only (no edit/delete buttons)
- Happy path: CREATE TRACK card opens editor
- Edge case: Deleting a track refreshes the list
- Integration: Changes on TRACKS tab (delete) reflected when switching to PLAY tab track browser

**Verification:**
- TRACKS tab is a workshop. No selection for racing. Management actions work. Official tracks are view-only.

## System-Wide Impact

- **Interaction graph:** RacePanel now composes TrackBrowser. TracksPanel also composes TrackBrowser. Both share the component but with different options. LobbyOverlay gains a track data parameter affecting the startRace message flow.
- **State lifecycle:** Settings.selectedTrackId is written by TrackBrowser (via onTrackSelected callback in RacePanel), read by RacePanel._startSoloRace() and _startPrivateLobby(). RACE mode ignores it entirely.
- **Network protocol change:** `startRace` message payload changes from `{ type: 'startRace', trackId }` to include full cell data for custom tracks. Server must handle the new shape. This is the only protocol change.
- **Unchanged invariants:** GameEngine, Physics, Vehicle, Camera, Settings schema, TrackRegistry, TrackCodec — all untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| TrackBrowser extraction may break TracksPanel | Unit 1 verifies TracksPanel still renders correctly after extraction |
| Two-column layout may not fit on tablets | Scope boundary: stacks to single column below 768px. Full responsive polish deferred |
| Custom track cell data in startRace message may be large | Track cells are typically <50 entries, encoded to ~200 bytes. Not a concern |
| Matchmaking with no players fails on first use | R19 specifies 30s timeout + fallback toast. User explicitly chose to keep RACE as default |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-10-race-mode-flows-requirements.md](docs/brainstorms/2026-04-10-race-mode-flows-requirements.md)
- TrackBrowser source: js/ui/panels/TracksPanel.js
- Chip strip pattern: js/ui/panels/RacePanel.js (pre-Fortnite version in git history)
- LobbyOverlay: js/ui/overlays/LobbyOverlay.js
- TrackMinimap: js/ui/components/TrackMinimap.js
- Prior layout plan: docs/plans/2026-04-09-004-refactor-fortnite-layout-plan.md (completed)
