---
date: 2026-04-13
topic: open-ideation
focus: open-ended
---

# Ideation: Kart Kids Open Improvements (Session 15)

## Codebase Context

Browser-based kart racer built with three.js + crashcat, now split across a modern menu shell (`js/ui/`, `AppShell`) and a modular Track Editor v2 (`js/track-editor/`). Core gameplay systems are real and substantial: race runtime, URL-loaded v4 tracks, local settings/stats, share links, and test drive all exist. The biggest gaps are at the seams between those systems: Discover is still driven by `MockData`, the route-based results page still renders placeholders, kart test drive is a stub, `TrackRegistry` only exposes one official track, and track persistence is fragmented between `TrackSaves.js` (`racing-editor-saved-tracks`) and `ProjectStorageService.js` (`kk-editor-saved-tracks` + `kk-project-*`). Repo docs and entrypoint references have also drifted in places (`ONBOARDING.md`, `menu.html` references) from the current architecture.

## Ranked Ideas

### 1. Track Library 1.0
**Description:** Introduce a unified local-first track repository that normalizes official tracks, editor saves, imported/shared `#track=v4:` links, and selected/recent tracks behind one app-facing API. The goal is not a backend platform in v1; it is one consistent source of truth for track metadata, payloads, and provenance inside the client.
**Rationale:** Track flow is the most fragmented high-leverage loop in the repo. Today TRACKS, race launch, editor save/load, share links, and future Discover behavior all touch different storage conventions and lookup rules. A single track library would let the product behave like one system instead of a collection of nearby one-offs.
**Downsides:** Touches several surfaces at once and needs clear scoping to avoid turning into a premature UGC platform. Requires care around migration from the current split localStorage keys.
**Confidence:** 92%
**Complexity:** Medium
**Status:** Explored

### 2. Discover With Real Tracks, Not MockData
**Description:** Rewire Discover to surface real local/official track data instead of static mock content, then make "Play Now" launch the selected track. Start with official tracks, saved/imported tracks, favorites, and recents rather than inventing a full online community feed.
**Rationale:** The Discover UI already exists, but it currently advertises a capability the product does not actually have. Replacing mocks with real track inventory would make the menu feel honest and useful while reusing a lot of already-built UI.
**Downsides:** Depends on stronger track data plumbing first or it will become another special-case consumer with ad hoc rules. Naming/positioning may need to shift if the page is no longer truly "community" focused.
**Confidence:** 88%
**Complexity:** Medium
**Status:** Unexplored

### 3. Post-Race Debrief That Advances the Loop
**Description:** Feed real race results into the route-based results experience, persist wins/best-times cleanly, and use the debrief screen to push the next meaningful action: rematch, replay same track, beat personal best, or return to garage. Make the post-race flow feel like progression rather than a temporary modal.
**Rationale:** The runtime already knows real lap/time data, but the route-based results page is still placeholder-driven. Closing that gap would make racing feel materially more complete and would give existing `Settings` stats a proper home in the loop.
**Downsides:** There are already two results concepts in the repo (overlay and route page), so this needs a product decision about which experience becomes canonical. Extra polish opportunities can easily sprawl if not tightly scoped.
**Confidence:** 86%
**Complexity:** Low-Medium
**Status:** Unexplored

### 4. Garage Test Drive + Compare Loop
**Description:** Turn the existing kart test-drive placeholders into a real evaluation loop: launch the selected kart onto the selected track, provide quick restart/return behavior, and let players feel differences immediately after browsing the garage. Optimize for "inspect, drive, swap, drive again" rather than a one-way button.
**Rationale:** Kart choice currently risks feeling cosmetic because the menu promises a test drive but does not deliver it. This is a low-ceremony way to make selection feel mechanical and rewarding using systems the repo already has.
**Downsides:** Needs product clarity on whether the kart picker should temporarily override equipped loadout or require confirm-first behavior. If handling is still too homogeneous, exposing test drive may reveal that balance work is needed next.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 5. Official Track Pack Pipeline
**Description:** Create a lightweight path for promoting editor-authored v4 tracks into curated official content with metadata, minimaps/thumbnails, and clean registration in `TrackRegistry`. Treat the editor as a content pipeline for the shipped game, not only a user toy.
**Rationale:** `TrackRegistry` currently ships only one official track, which makes the menu and race flows feel thinner than the editor’s capabilities suggest. A promotion pipeline compounds future content output and gives the team a low-friction way to expand the game’s curated surface area.
**Downsides:** Needs a simple editorial workflow so this does not become manual copy-paste chaos. Without a stronger track metadata contract, official content can drift from user-save/share formats.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 6. Architecture Drift Guard
**Description:** Add a lightweight architecture snapshot/check process that keeps onboarding docs, entrypoints, and product docs aligned with the real repo structure. Aim to catch stale references like legacy editor paths or `menu.html` redirects before they confuse future work.
**Rationale:** The repo has evolved quickly, and some docs still describe an older architecture. Small drift today becomes planning friction, onboarding confusion, and false assumptions in later sessions.
**Downsides:** Mostly team-facing value, so it should stay lightweight and not become documentation bureaucracy. It improves leverage indirectly rather than through a visible player feature.
**Confidence:** 84%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Standalone shared-link import modal | Better absorbed into the stronger Track Library concept than built as a separate surface |
| 2 | Local favorites/bookmarks system | Useful, but secondary until real track inventory is unified |
| 3 | Tutorial/practice mode overhaul | Interesting, but more design-heavy than the current leverage points justify |
| 4 | Recent tracks strip on PLAY | Good polish, but too narrow compared with fixing the underlying track data contract |
| 5 | Replace all MockData everywhere | Too broad; better to attack the highest-value mocked flows first |
| 6 | Analytics dashboard/adapter | Low player-facing value relative to product loop improvements |
| 7 | Embed the editor inside the main SPA | Too expensive for v1 compared with simpler flow improvements |
| 8 | Narrow entrypoint cleanup only | Real issue, but better treated as one part of the broader drift-guard idea |

## Session Log

- 2026-04-13: Initial ideation — 14 candidates generated, 6 survived adversarial filtering
- 2026-04-13: Began brainstorming idea 1 (Track Library 1.0); initial conclusion: v1 can remain local-first and does not require a database
