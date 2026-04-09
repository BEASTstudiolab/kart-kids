---
title: "feat: TRACKS Tab — Browse, Select, Share Tracks"
type: feat
status: active
date: 2026-04-09
origin: docs/brainstorms/2026-04-09-tracks-tab-requirements.md
---

# feat: TRACKS Tab — Browse, Select, Share Tracks

## Overview

Replace the CREATE tab with a TRACKS tab that lets players browse built-in tracks, view their editor-created tracks, select a track for racing, and share custom tracks via link. The selected track feeds into the RACE button behavior.

## Problem Frame

The CREATE tab is a dead-end link to editor.html. Meanwhile there's no way to browse, select, or manage tracks. The editor already saves tracks to localStorage and can generate shareable play URLs, but none of this is surfaced in the menu UI.

(see origin: docs/brainstorms/2026-04-09-tracks-tab-requirements.md)

## Requirements Trace

- R1: Replace CREATE with TRACKS tab in tab bar
- R2: Selected track saved to Settings.js (localStorage)
- R3: Built-in tracks section + My Tracks section + Make Your Own button
- R4: Track cards with name, difficulty, SELECT action
- R5: Selected track used when tapping RACE
- R7: Share button copies play URL to clipboard
- R8: Track preview card on RACE tab
- R9-R11: Track usage per mode (Solo: player's track, Online: built-in only, Private: host's track)
- R12-R13: My Tracks from editor's localStorage, with SHARE/EDIT/DELETE actions

## Scope Boundaries

- No server-side track storage. All user tracks in localStorage.
- No track thumbnails for v1 — text-only cards. Thumbnails deferred.
- No track rating or social features.
- Editor stays separate (editor.html).
- Online matchmaking uses built-in tracks only.

## Context & Research

### Relevant Code and Patterns

- **Editor persistence**: `js/editor/Persistence.js` exports `getSavedTracks()` (returns `[{ name, cells, pieces, date }]`), `deleteNamedTrack(name)`. Tracks stored under `racing-editor-saves` localStorage key.
- **TrackCodec**: `js/TrackCodec.js` has `encodeCells()` / `decodeCells()` for URL-safe track encoding.
- **ShareLinkService**: `js/track-editor/services/ShareLinkService.js` generates play URLs: `index.html#map=encoded`.
- **TrackRegistry**: `js/TrackRegistry.js` has built-in tracks with `getTracks()`, `getTrackById()`.
- **GaragePanel**: `js/ui/panels/GaragePanel.js` is the pattern to follow — arrow browsing, absolute-positioned overlays, same panel lifecycle.
- **Settings.js**: Already has `loadout.selectedKartId` — add `loadout.selectedTrackId` following same pattern.

## Key Technical Decisions

- **Read editor saves directly**: TRACKS tab imports `getSavedTracks()` from `js/editor/Persistence.js` to read user-created tracks. No duplication of storage.
- **Share URL generation inline**: Instead of importing ShareLinkService (which needs a TrackProject), generate play URLs directly using `encodeCells()` from TrackCodec + `window.location.origin`.
- **Track selection in Settings**: Add `selectedTrackId` to Settings.js loadout namespace. Default: first built-in track. Convention: built-in tracks use their registry ID (e.g., `'starter-circuit'`). User tracks use `'user:'` prefix + track name (e.g., `'user:My Cool Track'`). This prevents namespace collisions.
- **RACE tab reads selected track**: RacePanel reads `Settings.getSelectedTrackId()` at race-launch time. If prefix is `'user:'`, look up in `getSavedTracks()` by name and decode cells. Otherwise look up in TrackRegistry.
- **switchTab exposed on service bag**: Add `switchTab: (name) => this.switchTab(name)` to AppShell's services object so panels can trigger tab navigation (e.g., tapping track card on RACE tab → TRACKS tab).
- **Import TrackCodec directly, not Track.js**: Panels that need `decodeCells()` import from `TrackCodec.js` directly to avoid pulling in the heavy Track.js module tree.
- **TracksPanel refreshes on show()**: `show()` re-reads `getSavedTracks()` so new tracks created in editor.html (separate tab) appear immediately.

## Open Questions

### Resolved During Planning

- **Editor localStorage format**: `getSavedTracks()` returns `[{ name, cells (encoded string), pieces, date }]`. Cells are already encoded via TrackCodec. To use in a race, call `decodeCells(track.cells)`.
- **How to generate share URL without ShareLinkService**: `const url = window.location.origin + '/index.html#map=' + track.cells;` — the cells field is already encoded.

### Deferred to Implementation

- Exact visual styling of track cards — match the gaming aesthetic (HUD borders, glow effects)
- Whether to add track difficulty to editor saves (currently not saved, only built-in tracks have difficulty)

## Implementation Units

- [ ] **Unit 1: Settings.js — Add selectedTrackId**

**Goal:** Persist selected track in localStorage.

**Requirements:** R2, R5

**Dependencies:** None

**Files:**
- Modify: `js/Settings.js`

**Approach:**
- Add `selectedTrackId: 'starter-circuit'` to the `loadout` namespace in DEFAULTS
- Bump SCHEMA_VERSION to 4 (migration from v3 adds selectedTrackId with default)
- Add `getSelectedTrackId()` / `setSelectedTrackId(id)` convenience methods
- Follow existing `getSelectedKartId` / `setSelectedKartId` pattern exactly

**Patterns to follow:**
- Existing Settings.js v2→v3 migration and loadout namespace

**Test scenarios:**
- Happy path: `getSelectedTrackId()` returns 'starter-circuit' by default
- Happy path: `setSelectedTrackId('my-track')` persists across page reload
- Edge case: v3 schema migrates to v4 preserving all existing fields

**Verification:**
- Settings stores and retrieves selectedTrackId correctly.

---

- [ ] **Unit 2: TracksPanel — Browse + Select + Share**

**Goal:** Build the TRACKS tab panel content with built-in tracks, user tracks, and track management.

**Requirements:** R3, R4, R7, R12, R13

**Dependencies:** Unit 1

**Files:**
- Create: `js/ui/panels/TracksPanel.js`
- Modify: `js/ui/core/AppShell.js` (swap CREATE panel for TRACKS panel, update TAB_DEFS)

**Approach:**
- TracksPanel layout (absolute-positioned overlay like GaragePanel):
  - "OFFICIAL TRACKS" section: cards from TrackRegistry.getTracks()
  - "MY TRACKS" section: cards from getSavedTracks() (imported from editor/Persistence.js)
  - "MAKE YOUR OWN" button at bottom: opens editor.html in new tab
- Each track card shows: name, difficulty badge (for built-in) or piece count + date (for user tracks), SELECT button
- Selected track has highlight border (like equipped kart)
- User track cards additionally show: SHARE button (copies play URL to clipboard, toast "Link copied!"), EDIT button (opens editor.html?load=name), DELETE button (confirmation dialog, calls deleteNamedTrack)
- Update AppShell: change TAB_DEFS from 'create' to 'tracks', create TracksPanel in bootstrap, wire show/hide

**Patterns to follow:**
- GaragePanel structure and _injectCSS pattern
- HudButton for SELECT/MAKE YOUR OWN buttons
- Toast via services.notification.show()

**Test scenarios:**
- Happy path: TRACKS tab shows built-in track(s) from TrackRegistry
- Happy path: TRACKS tab shows user-saved tracks from editor localStorage
- Happy path: Selecting a track saves to Settings.setSelectedTrackId()
- Happy path: SHARE copies URL to clipboard, shows toast
- Happy path: DELETE removes track after confirmation
- Edge case: No user tracks — "My Tracks" section shows "No tracks yet" message with prominent Make Your Own CTA
- Edge case: EDIT opens editor.html with track name in URL params

**Verification:**
- Built-in + user tracks display. Select/share/edit/delete all work. Selected track persists.

---

- [ ] **Unit 3: RacePanel — Track preview card + use selected track**

**Goal:** Show selected track on RACE tab and use it when racing.

**Requirements:** R8, R9, R10, R11

**Dependencies:** Units 1, 2

**Files:**
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- Add a small track preview card next to the mode chips. Shows track name + difficulty/source badge. Tapping it calls services.switchTab('tracks').
- _startSoloRace(): read selectedTrackId from fresh Settings. Look up in TrackRegistry first, then in getSavedTracks(). Decode cells if from user track. Pass to startRace().
- _startOnlineMatchmaking(): ignore player's track selection — server picks built-in track.
- _startPrivateLobby(): host's selected track is sent via room system (encode cells into room message).
- show(): refresh the track preview card (track may have changed in TRACKS tab).

**Patterns to follow:**
- Existing mode chip strip layout
- Fresh `new Settings()` at race-launch time (stale-settings fix pattern)

**Test scenarios:**
- Happy path: RACE tab shows selected track name
- Happy path: Solo race uses the player's selected track
- Happy path: Tapping track card switches to TRACKS tab
- Edge case: Selected track was deleted — falls back to first built-in track
- Edge case: Online mode ignores custom track selection

**Verification:**
- Track name visible on RACE tab. Solo uses selected track. Track card navigates to TRACKS tab.

---

- [ ] **Unit 4: Tab bar label update + cleanup**

**Goal:** Update tab bar from CREATE to TRACKS. Remove old CreatePanel references.

**Requirements:** R1

**Dependencies:** Unit 2

**Files:**
- Modify: `js/ui/core/AppShell.js` (TAB_DEFS label, remove _buildCreatePanelContent)

**Approach:**
- Change TAB_DEFS entry from `{ id: 'create', label: 'CREATE' }` to `{ id: 'tracks', label: 'TRACKS' }`
- Remove the _buildCreatePanelContent() method (editor link now lives inside TracksPanel)
- Update switchTab render mode: TRACKS tab uses 'idle' (no kart preview needed)

**Patterns to follow:**
- Existing TAB_DEFS structure

**Test scenarios:**
- Happy path: Tab bar shows TRACKS instead of CREATE
- Happy path: Old CREATE tab references don't break anything

**Verification:**
- Tab bar reads RACE | GARAGE | TRACKS | PROFILE. No dead references.

## System-Wide Impact

- **Interaction graph:** TracksPanel reads from editor's localStorage (cross-module data dependency). RacePanel reads selectedTrackId from Settings at race-launch. Private lobby must send track cells via room system.
- **State lifecycle risks:** User deletes a track that is currently selected → must handle gracefully (fall back to default).
- **Unchanged invariants:** Editor saves, TrackCodec, TrackRegistry, GameEngine — all untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Editor localStorage format changes | getSavedTracks() is the abstraction — if format changes, only Persistence.js needs updating |
| No track thumbnails makes cards look plain | Use the gaming glow effects (HUD borders, accent colors) to make text-only cards feel premium |
| Private lobby track sharing not fully wired | Deferred — for v1, private lobby uses built-in tracks only. Custom track sharing in private lobbies is a follow-up |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-09-tracks-tab-requirements.md](docs/brainstorms/2026-04-09-tracks-tab-requirements.md)
- Editor persistence: js/editor/Persistence.js
- Track encoding: js/TrackCodec.js
- Share link pattern: js/track-editor/services/ShareLinkService.js
- Panel pattern: js/ui/panels/GaragePanel.js
