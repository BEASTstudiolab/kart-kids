---
date: 2026-04-13
topic: track-publishing-spotlight-mvp
---

# Track Publishing + Spotlight MVP

## Problem Frame

Kart Kids already supports local track creation, local saves, and payload-based share links, but it does not yet support a shared track platform. The current project only ships one official track in `js/TrackRegistry.js`, stores user tracks locally, and serves the app from `server.js` without shared persistence or public track pages.

The MVP goal is not a full open UGC marketplace. It is a friend-share-first track platform with a small editorial surface:

- creators can publish a track and get a permanent public link
- anyone with that link can open the track page and race it
- players can save shared tracks into their own library for normal party hosting
- staff can spotlight favorite published tracks inside the game

This creates real shared track persistence from day one without turning the in-game TRACKS page into a giant public catalog.

```text
Creator builds track
  -> Publish
  -> Permanent public track page
     -> Visitor plays solo
     -> Visitor saves snapshot to My Saved
        -> Host starts party
        -> Host selects saved track
        -> Friends join by room code / invite

Published track
  -> May be staff-selected for Spotlight
  -> Spotlight uses a reviewed snapshot, not the creator's latest live version
```

## Requirements

**Publishing + Identity**
- R1. The product must support backend-backed published tracks from day one. A published track receives a permanent public URL that remains stable across later creator updates.
- R2. Publishing requires a track title and uses the player’s existing profile display name as the creator name. The creator name is not overridden per track in MVP.
- R3. Publishing is immediate after the track passes publish validation. Public availability does not wait for manual staff review.
- R4. Publish validation uses a dedicated publish ruleset, not the editor’s raw warning model. The publish bar must require the track to be playable and minimally party-ready for at least 2 racers.
- R5. Publishing does not require player accounts. Each published track issues a secret manage link that allows the creator to update or unpublish that live track later.

**Public Track Experience**
- R6. The permanent public URL opens a track landing page, not a direct race boot. The page must show the current live track, title, creator name, and actions to play solo and save the track into the visitor’s library.
- R7. The public track URL always resolves to the creator’s latest live version.
- R8. Updating a published track replaces the live public version in place without changing the public URL.
- R9. If a creator unpublishes a track, the public page stops being available for future sharing, but previously saved player snapshots remain usable.

**In-Game TRACKS Page**
- R10. The in-game TRACKS page uses four distinct rows: `Official`, `Spotlight`, `My Published`, and `My Saved`.
- R11. MVP launches with 2 official tracks in the `Official` row.
- R12. `Spotlight` is a staff-curated shelf, not a browsable public catalog. It may launch empty and fill over time.
- R13. `My Published` is a management surface for the player’s own live published tracks. Selecting one opens a manage-oriented view with the live track status, public link access, and creator actions to update or unpublish, rather than treating it as the primary playable library.
- R14. `My Saved` is the playable personal library. It holds snapshots imported from public links plus the player’s own auto-saved playable copies.

**Saving + Snapshot Behavior**
- R15. A visitor can save any public track into `My Saved` from the public track page.
- R16. Saving a public track creates a snapshot copy. Saved snapshots do not auto-update when the original creator later edits the live published track.
- R17. When a player publishes or updates one of their own live tracks, the product automatically creates or refreshes that player’s own playable snapshot in `My Saved`.

**Play + Party Flow**
- R18. A public track page must support solo play directly from the current live version.
- R19. Multiplayer use of a shared track flows through the normal party host flow. The host first saves the track, then starts a party, then chooses from `My Saved`. Friends join using the existing room code / invite flow.
- R20. MVP does not require direct party creation from the public track page itself.

**Spotlight + Editorial Control**
- R21. Staff can spotlight any published track without requiring a creator submission workflow for Spotlight.
- R22. Spotlight freezes the staff-approved version. Later creator edits do not silently change the in-game Spotlight version until staff explicitly re-approve or replace it.
- R23. Staff can take down a published track from public availability. Takedown removes public access and Spotlight presence, but does not invalidate player snapshots already saved into `My Saved`.

## Success Criteria

- A creator can publish a track, receive one permanent public URL, and share it immediately.
- A player who opens a shared track can either play it solo or save it into `My Saved` and later use it in the normal party host flow.
- The in-game TRACKS page cleanly separates curated content (`Official`, `Spotlight`) from personal track surfaces (`My Published`, `My Saved`).
- Staff can feature standout tracks in Spotlight without exposing an open public catalog inside the game.
- Creator edits keep the live public link current while preserving stability for Spotlight snapshots and player-saved copies.

## Scope Boundaries

- No open in-game browse surface for all published community tracks in MVP.
- No account system, login requirement, or creator profile management in MVP.
- No creator-defined Spotlight submission flow in MVP.
- No automatic update prompt for already-saved snapshots in `My Saved`.
- No requirement to start a private party directly from the public track page.
- No guarantee that Spotlight is populated at launch.
- No ratings, comments, or community moderation features beyond staff curation/takedown.

## Key Decisions

- **Friend-share first, not public catalog first**: The core loop is “make a track -> share it -> race it,” with a curated Spotlight instead of an open in-game marketplace.
- **Backend-first is justified here**: Permanent public URLs, live published versions, Spotlight curation, and staff takedown all require shared server-side persistence beyond local saves.
- **No accounts in MVP**: Creator ownership is handled through secret manage links to keep the creator flow lightweight.
- **Live links and frozen snapshots can coexist**: The public URL tracks the creator’s latest live version, while `My Saved` and Spotlight preserve explicit snapshots for stability.
- **TRACKS is mixed-purpose but clearly separated**: Official and Spotlight serve discovery; My Published and My Saved serve ownership and play.

## Alternatives Considered

- **Local-only track library**: Rejected because the MVP promise includes permanent public links and staff Spotlight curation, both of which require shared persistence.
- **Open in-game public catalog**: Rejected for MVP because it adds browse, moderation, and discovery complexity beyond the user’s main desired loop.
- **Account-based creator platform**: Rejected for MVP because it expands scope significantly without being necessary for friend sharing.

## Dependencies / Assumptions

- `server.js` currently provides static file serving plus room-based WebSocket multiplayer, but no shared track persistence or public track pages. New backend capability is required for this MVP.
- `js/GameEngine.js` already supports loading track payloads from a shared `#track=v4:` style link. Planning may reuse that interchange model or evolve it, but the published-track experience must remain compatible with the existing game runtime.
- `js/track-editor/services/ValidationService.js` currently mixes hard failures with softer quality warnings. Planning will need a dedicated publish-validation mapping that reflects the MVP’s “playable + minimally party-ready” rule.

## Outstanding Questions

### Deferred to Planning
- [Affects R4][Technical] What exact validation conditions count as publish blockers versus non-blocking quality warnings?
- [Affects R5][Technical] What security, expiry, rotation, and recovery behavior should secret manage links have in MVP?
- [Affects R6][Technical] Should the public track landing page be implemented as a new standalone route/page or integrated into the existing app shell flow?
- [Affects R14][Technical] What stored snapshot format should `My Saved` use for imported published tracks so it stays stable even after the live version changes?
- [Affects R23][Needs research] What minimal staff tooling is needed to manage Spotlight selection and public takedown safely in MVP?

## Next Steps

-> /ce:plan for structured implementation planning
