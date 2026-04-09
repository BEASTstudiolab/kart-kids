---
date: 2026-04-09
topic: tracks-tab-create-flow
---

# Tracks Tab + Track Ecosystem

## Problem Frame

The CREATE tab is a dead-end link to editor.html — it wastes 25% of the tab bar on a single outbound link. Meanwhile there's no way to browse, select, or manage tracks from the menu. The editor can already create tracks and generate shareable play links (ShareLinkService + TrackCodec), but this infrastructure isn't surfaced in the UI. Players need a place to pick tracks, browse their creations, and share with friends.

## Requirements

**Tab Bar Change**

- R1. Replace the CREATE tab with a TRACKS tab. Tab bar becomes: RACE | GARAGE | TRACKS | PROFILE.
- R2. TRACKS tab shows the player's track selection. The selected track is saved to localStorage (same Settings.js pattern as kart selection).

**Tracks Tab Content**

- R3. TRACKS tab layout: "Built-in Tracks" section at top showing official tracks (from TrackRegistry). "My Tracks" section below showing user-created tracks saved from the editor. "Make Your Own" button at bottom opens editor.html in a new tab.
- R4. Each track card shows: track name, difficulty badge, and a SELECT action. Selected track has a highlight/equipped state (like the kart in GARAGE).
- R5. The currently selected track is used when the player taps RACE. Persists in localStorage across sessions.

**Track Sharing**

- R6. ShareLinkService already generates play URLs (`index.html#map=encoded`). When a friend clicks a share link, the game loads with that track. This already works — no new work needed, just preserve it.
- R7. My Tracks cards have a SHARE button that copies the play URL to clipboard (using ShareLinkService.generatePlayUrl pattern). Toast confirmation "Link copied!"

**Track Selection in Race Flow**

- R8. RACE tab shows a small track preview card next to the mode chips. Shows selected track name + difficulty badge. Tapping it jumps to TRACKS tab.
- R9. Solo mode: uses the player's selected track (from TRACKS tab). If no track selected, defaults to first built-in track.
- R10. Online matchmaking: always uses built-in tracks (server selects randomly). Player's custom track selection is ignored.
- R11. Private lobby: host picks from built-in tracks + their My Tracks. The track data is encoded and sent to all clients via the existing room system. Clients don't need to have the track saved locally.

**My Tracks Storage**

- R12. User-created tracks are saved by the editor to localStorage (editor already does this via Persistence.js / ProjectStorageService). The TRACKS tab reads from the same localStorage entries.
- R13. My Tracks shows: track name, date created/modified, and actions (SELECT, SHARE, EDIT, DELETE). EDIT opens editor.html with the track loaded. DELETE removes from localStorage with confirmation.

## Success Criteria

- Player can browse built-in + custom tracks, select one, and race on it — all from the tab bar without leaving the app.
- Selected track persists across sessions and is used in Solo/Private races.
- Share link lets friends play a custom track with one click.
- CREATE tab replaced with useful TRACKS tab — no dead-end links.

## Scope Boundaries

- No server-side track storage or UGC discovery platform. All user tracks are localStorage only.
- No track thumbnails/previews for v1 — text-only cards with name + difficulty. Thumbnails deferred.
- No track rating, comments, or social features.
- Editor stays as a separate page (editor.html) — not merged into the SPA.
- Online matchmaking uses built-in tracks only — custom tracks not supported in matchmaking.

## Key Decisions

- **TRACKS replaces CREATE in tab bar**: CREATE was a dead-end link. TRACKS is a full browsing/selection experience with the editor accessible from within it.
- **Built-in + My Tracks in one tab**: Two sections with clear separation. Official tracks are curated, user tracks are personal creations.
- **Custom tracks in Solo + Private only**: Avoids the "other players don't have this track" problem in matchmaking. Private lobby hosts share track data via the room system.
- **Track selection as part of loadout**: Like kart selection, track choice persists in Settings.js and feeds into the RACE button behavior.

## Dependencies / Assumptions

- Editor's Persistence.js / ProjectStorageService already saves tracks to localStorage — TRACKS tab reads from the same store.
- ShareLinkService + TrackCodec already handle track encoding/sharing — reuse, don't rebuild.
- TrackRegistry has built-in tracks (currently 1: starter-circuit). More can be added.
- Private lobby track sharing requires encoding the track cells into a room message. The room system already broadcasts track ID — extend to broadcast encoded cells for custom tracks.

## Outstanding Questions

### Deferred to Planning

- [Affects R12][Technical] What localStorage keys does the editor use for saved tracks? The TRACKS tab needs to read them. Check Persistence.js and ProjectStorageService.
- [Affects R11][Technical] How should custom track data be sent to Private lobby clients? Encode cells into a room message, or send a share link they auto-load?
- [Affects R4][Technical] Can we generate simple track thumbnails (e.g., a top-down canvas render of the track layout)? This would significantly improve the track cards. Defer if complex.

## Next Steps

-> `/ce:plan` for structured implementation planning.
