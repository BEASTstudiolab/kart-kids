---
date: 2026-04-10
topic: race-mode-flows
---

# Race Mode User Journeys (v2)

## Problem Frame

The three play modes need clear, distinct flows that match player expectations. The original design used a chip strip + shared PLAY button, but this has been replaced with three separate stacked buttons (RACE, FREE PLAY, PARTY). Each button should immediately do the right thing for its mode.

The PARTY flow is the main issue: picking a track *before* having a room feels backwards. Players expect to set up a room first, then configure it.

## Requirements

**Play Screen Layout**

- R1. Three stacked HudButtons on the play screen: RACE, FREE PLAY, PARTY. Each directly triggers its mode's flow.
- R2. No chip strip, no shared PLAY button, no mode selection step.

**RACE Mode (Online Matchmaking)**

- R3. RACE is the fastest path to playing. One tap.
- R4. Flow: tap RACE -> "Finding match..." overlay (with cancel) -> race starts.
- R5. No track selection. Track is auto-selected from official tracks.
- R6. If matchmaking fails, fallback to solo race with AI fill on default track.

**FREE PLAY Mode (Solo)**

- R7. Flow: tap FREE PLAY -> TrackSelectOverlay (pick track) -> solo race starts.
- R8. Both official and custom tracks available in the overlay.
- R9. A default track is always pre-selected. Start button is never disabled.

**PARTY Mode (Private Lobby)**

- R10. Flow: tap PARTY -> room is created immediately -> lobby page appears.
- R11. Lobby page shows: room code (with copy button), player list, collapsed track picker, START button (host only).
- R12. Track picker: a default track is pre-selected and shown as a compact card/row. Host taps it to expand and browse/change track. Guests see the selected track but cannot change it.
- R13. "Or join an existing room" link on the lobby page. Tapping it reveals an inline code input. Entering a valid code switches to guest mode (joins that room, hides START button and track picker editing).
- R14. Host tapping START sends track cell data to the server (not trackId, since custom tracks only exist in host localStorage).
- R15. Invalid/full room on join shows error toast.

**TRACKS Tab**

- R16. TRACKS tab is for track management (create/edit/delete/share), not for selecting a track to race.
- R17. Official tracks appear as view-only on TRACKS tab.

## Success Criteria

- RACE: one tap to matchmaking, no decisions required.
- FREE PLAY: one tap to track picker, pick and go.
- PARTY: one tap to a lobby with room code visible. Track selection is inside the lobby, not a prerequisite.
- A new player understands what each button does without explanation.

## Scope Boundaries

- No changes to RACE or FREE PLAY flows (already working).
- PARTY lobby is the main change: move from overlay to a proper lobby page/view.
- No matchmaking logic changes.
- No new track editor features.
- No changes to GameEngine or race logic.

## Key Decisions

- **Three separate buttons over chip strip**: Each mode is a direct action, not a setting. More obvious, fewer steps.
- **Lobby-first for PARTY**: Room is created on tap. Track selection lives inside the lobby as a collapsed section. Feels natural — set up the room, then configure it.
- **Join lives inside the lobby**: "Or join an existing room" link in the lobby page. No separate JOIN button on the home screen.
- **FREE PLAY keeps the overlay**: Solo doesn't need a lobby page. Track select overlay is sufficient and already works.
- **Collapsed track picker**: Default track pre-selected. Host expands to change. Keeps lobby clean without hiding the option.

## Outstanding Questions

### Deferred to Planning

- [Affects R10-R13][Technical] Determine whether to build the lobby as a new page (route-based) or keep it as the existing LobbyOverlay with the new collapsed track picker. The overlay already has most of the infrastructure.
- [Affects R12][Technical] Collapsed track picker component — reuse TrackSelectOverlay inline or build a simpler compact picker for the lobby context.

## Next Steps

-> /ce:plan for structured implementation planning
