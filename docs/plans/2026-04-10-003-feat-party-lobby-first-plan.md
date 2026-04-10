---
title: "feat: Party lobby-first flow with inline track picker"
type: feat
status: completed
date: 2026-04-10
origin: docs/brainstorms/2026-04-10-race-mode-flows-requirements.md
---

# feat: Party lobby-first flow with inline track picker

## Overview

Rework the PARTY mode flow so tapping PARTY immediately creates a room and shows the lobby — with track selection as a collapsed section inside the lobby, not a prerequisite step.

## Problem Frame

Currently PARTY forces track selection *before* creating a room. This feels backwards — players expect to set up a room first, then configure it. The lobby should appear immediately with a room code, and track selection should be an optional configuration step within the lobby. (see origin: docs/brainstorms/2026-04-10-race-mode-flows-requirements.md)

## Requirements Trace

- R10. Flow: tap PARTY -> room is created immediately -> lobby appears.
- R11. Lobby shows: room code (with copy), player list, collapsed track picker, START button (host only).
- R12. Track picker: default track pre-selected, shown as compact card. Host taps to expand/change. Guests see but can't change.
- R13. "Or join an existing room" link reveals inline code input. Valid code switches to guest mode.
- R14. Host START sends track cell data to server (not trackId).
- R15. Invalid/full room on join shows error toast.

## Scope Boundaries

- RACE and FREE PLAY flows are unchanged (already working).
- No matchmaking logic changes.
- No new track editor features.
- No changes to GameEngine or race logic.
- LobbyOverlay remains an overlay (not a new route-based page).

## Context & Research

### Relevant Code and Patterns

- `js/ui/overlays/LobbyOverlay.js` — Already has room code display, member list, host/guest logic, network wiring, join-existing-room inline input. This is the primary file to modify.
- `js/ui/overlays/TrackSelectOverlay.js` — Full-screen track picker with TrackBrowser. Returns `{ name, cells, decoCells, source }` via `onConfirm` callback.
- `js/ui/panels/RacePanel.js` — `_handleParty()` currently calls `_openTrackSelect()` then `_startPrivateLobby(track)`. Needs to skip track selection and go straight to lobby.
- `js/TrackRegistry.js` — `getTracks()` returns `Track[]` with `{ id, name, difficulty, cells, decoCells }`. `getRandomTrack()` returns a single random track for defaults.
- `js/ui/components/TrackBrowser.js` — Carousel component used by TrackSelectOverlay and TracksPanel. Could be reused but is overkill for a collapsed card.

### Institutional Learnings

- LobbyOverlay already handles the join-existing-room flow (added this session).
- TrackSelectOverlay is a self-contained overlay that calls `onConfirm(trackData)` — easy to open from within the lobby.

## Key Technical Decisions

- **Keep LobbyOverlay, don't create a new page**: The overlay already has ~90% of the infrastructure (room code, member list, host/guest, network wiring, join flow). A route-based page would duplicate all of this. Adding a compact track card to the existing overlay is the minimal change.

- **Compact track card + TrackSelectOverlay on tap**: Rather than embedding a full TrackBrowser inside the lobby (heavy, overkill), show a small card with the selected track name. Tapping it opens TrackSelectOverlay as a child overlay. When the user confirms a track, the card updates. This reuses existing components with zero new UI complexity.

- **Default track auto-selected on lobby open**: Use `getRandomTrack()` or the first official track as default. The lobby always has a valid track — START is never disabled.

## Open Questions

### Resolved During Planning

- **Overlay vs page?** Keep LobbyOverlay. It already has the infrastructure. Adding a track card is simpler than building a new page.
- **Track picker component?** Compact card in lobby + open TrackSelectOverlay on tap. Reuses existing overlay, no new browsing UI needed.

### Deferred to Implementation

- Exact CSS for the compact track card (sizing, spacing within LobbyOverlay's layout).

## Implementation Units

- [ ] **Unit 1: Change RacePanel PARTY flow — lobby first, no track selection**

**Goal:** Make PARTY button go directly to the lobby overlay with a default track, skipping the track selection step.

**Requirements:** R10

**Dependencies:** None

**Files:**
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- Change `_handleParty()` to skip `_openTrackSelect()` and instead call `_startPrivateLobby()` directly with a default track from `getRandomTrack()`.
- The lobby opens immediately with a pre-selected track. Host can change it later via the track card (Unit 2).

**Patterns to follow:**
- Existing `_handleOnlineRace()` pattern — direct action, no intermediate step.
- `getRandomTrack()` already used in matchmaking fallback.

**Test scenarios:**
- Happy path: Tapping PARTY immediately shows LobbyOverlay with a room code and default track — no track selection overlay appears first.
- Happy path: LobbyOverlay receives valid trackData from the default track.

**Verification:**
- PARTY button opens lobby overlay directly. No TrackSelectOverlay flashes before it.

---

- [ ] **Unit 2: Add compact track card to LobbyOverlay**

**Goal:** Show the selected track as a compact card in the lobby. Host can tap to change it via TrackSelectOverlay.

**Requirements:** R11, R12

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/overlays/LobbyOverlay.js`

**Approach:**
- Add a compact track card element between the room code row and the members section. Shows track name and a "Change" indicator for hosts.
- Host tapping the card opens TrackSelectOverlay. On confirm, update `this._trackData` and refresh the card display.
- Guests see the track name but the card is not interactive (no tap handler, no "Change" indicator).
- Reuse existing `_trackInfoEl` section (already in the DOM) — restyle it as the compact card and add the tap-to-change behavior.

**Patterns to follow:**
- `TrackSelectOverlay.show(onConfirm)` pattern — already used by RacePanel.
- Existing `_updateTrackInfo()` method in LobbyOverlay for rendering track name.

**Test scenarios:**
- Happy path: Host sees compact track card with track name and "Change" label.
- Happy path: Host taps card, TrackSelectOverlay opens, selects new track, card updates with new track name.
- Happy path: Guest sees track name but card is not tappable.
- Edge case: If host changes track after guests have joined, the card updates locally (server sync of track data happens on START, not on change).

**Verification:**
- Lobby shows track name in a compact card. Host can tap to change. Guest sees but cannot change.

---

- [ ] **Unit 3: Ensure join-existing-room flow hides track card editing**

**Goal:** When a host switches to guest mode via "join existing room", hide the track change affordance and START button.

**Requirements:** R13, R15

**Dependencies:** Unit 2

**Files:**
- Modify: `js/ui/overlays/LobbyOverlay.js`

**Approach:**
- `_handleJoinExisting()` already hides START button and join controls. Extend it to also disable the track card's tap-to-change behavior (remove click listener or hide "Change" indicator).
- Track card should still show the track name (read-only) if the server provides it, or hide entirely if not.
- Error handling for invalid/full room already shows error toast via `_handleJoinExisting()`.

**Patterns to follow:**
- Existing `_handleJoinExisting()` method — already switches host controls to guest mode.

**Test scenarios:**
- Happy path: Host taps "join existing room", enters valid code, track card becomes read-only (no "Change" label), START button hidden.
- Error path: Invalid room code shows error toast, lobby state unchanged.
- Error path: Full room shows error toast, lobby state unchanged.

**Verification:**
- After joining an existing room, the lobby is fully in guest mode — no START, no track editing, no join link.

## System-Wide Impact

- **Interaction graph:** RacePanel -> LobbyOverlay -> TrackSelectOverlay (new child relationship). TrackSelectOverlay was previously only opened from RacePanel.
- **Error propagation:** Room creation errors already handled by LobbyOverlay. Track selection errors don't propagate (overlay just closes on cancel).
- **State lifecycle risks:** If host changes track and then network disconnects, the track selection is lost. This is acceptable — the lobby hides on disconnect anyway.
- **Unchanged invariants:** RACE and FREE PLAY flows are completely untouched. NetworkClient API, GameEngine.startRace(), TrackSelectOverlay public API all remain the same.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| TrackSelectOverlay z-index conflict with LobbyOverlay | TrackSelectOverlay is z-index 45, LobbyOverlay is 40. TrackSelectOverlay already renders above — no change needed. |
| Default track might not exist if TrackRegistry is empty | `getRandomTrack()` already handles this — returns first built-in track. TrackRegistry always has at least one track. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-10-race-mode-flows-requirements.md](docs/brainstorms/2026-04-10-race-mode-flows-requirements.md)
- Related code: `js/ui/overlays/LobbyOverlay.js`, `js/ui/overlays/TrackSelectOverlay.js`, `js/ui/panels/RacePanel.js`
