---
title: "feat: menu music visualizer"
type: feature
status: active
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-15-004-refactor-ui-design-system-consolidation-and-typography-normalization-plan.md
  - docs/brainstorms/2026-04-09-menu-production-ready-requirements.md
---

# feat: menu music visualizer

## Overview

Add a live visualizer to the menu music player so the current music card shows a reactive picture of what is playing instead of only text and transport controls.

## Problem Frame

The menu music surface in the PLAY tab already exposes track title, playback status, and transport controls through a shared `MenuMusicPlayer` and `MarginalMusicCard`, but it gives no visual indication of the playing audio itself. The user wants a visible audio-reactive treatment for the current song, ideally on the existing music card rather than as a separate system.

## Planning Bootstrap

- Intended behavior: the menu music card should show a compact animated visual that reacts to the current track while it plays
- Scope boundary: this is for the shared menu music player, not in-race SFX/HUD audio
- Success criteria: when a track is playing, the card visibly reacts; when paused, unavailable, or blocked, the surface falls back cleanly without errors
- Assumption: the requested “audio player of the track” refers to the existing menu music card powered by `MenuMusicPlayer`

## Requirements Trace

- R1: Add a visible audio-reactive element to the existing menu music card
- R2: Reuse the shared `MenuMusicPlayer` rather than introducing a second audio pipeline
- R3: Keep the visualizer resilient when Web Audio analysis is unavailable, blocked, or paused
- R4: Preserve the current menu music card controls and shell integration
- R5: Add targeted tests for the new player/card behavior

## Scope Boundaries

- In scope:
  - menu music analyser plumbing
  - visualizer rendering inside the existing music card
  - graceful paused/error/unavailable states
  - targeted Node tests and browser verification
- Out of scope:
  - in-race audio HUD changes
  - beat detection, waveform export, or track timeline scrubbing
  - replacing the current music player transport flow

## Local Research Summary

- `js/ui/audio/MenuMusicPlayer.js` owns the shared HTML audio element, playlist, subscription model, and playback lifecycle
- `js/ui/components/MarginalMusicCard.js` renders the existing menu music UI and already subscribes to player state
- `js/ui/core/AppShell.js` creates one `MenuMusicPlayer` instance and mounts one `MarginalMusicCard` into `RacePanel`
- `js/ui/panels/RacePanel.js` provides the host slot for the card but does not own music state
- `tests/app-shell-menu-music-widget.test.mjs` already covers card rendering and control wiring
- `tests/app-shell-menu-music.test.mjs` already covers shell/player lifecycle behavior

## External Research Decision

No external research is needed.

The feature is built on local browser primitives and the existing repository architecture, and the current codebase already defines the exact player/card boundaries that the implementation should follow.

## Key Technical Decisions

- **Put audio analysis in `MenuMusicPlayer`, not in the card.**
  The player already owns the underlying audio element, so analysis belongs beside playback state and can be shared with any future UI surface.
- **Expose small normalized visualizer samples through the existing subscription state.**
  This keeps `MarginalMusicCard` simple and testable without needing to poke directly into Web Audio nodes.
- **Use a DOM/CSS bar visualizer instead of a canvas-first renderer.**
  A small bar strip fits the current editorial card language, degrades well in tests, and is easier to verify with fake DOM state.
- **Fall back to a deterministic idle/flat state when analysis is unavailable.**
  The visualizer must never break playback or card rendering when audio contexts are blocked or unsupported.

## Implementation Units

- [ ] **Unit 1: Add analyser-backed visualizer state to the shared player**

**Goal:** Extend the shared menu music player so subscribers receive compact, normalized visualizer data derived from the current audio stream when available.

**Requirements:** R2, R3, R5

**Dependencies:** None

**Files:**
- Modify: `js/ui/audio/MenuMusicPlayer.js`
- Test: `tests/app-shell-menu-music.test.mjs`

**Approach:**
- Add a lazy Web Audio analyser path around the existing audio element
- Normalize the analyser output into a small fixed-size sample set suitable for card rendering
- Include that sample set and analyser availability flags in `getState()`
- Keep playback working even if the analyser path cannot initialize or resume

**Patterns to follow:**
- Existing `MenuMusicPlayer.subscribe()` and `getState()` shape
- Existing shell/player lifecycle tests in `tests/app-shell-menu-music.test.mjs`

**Test scenarios:**
- Happy path: player state includes normalized visualizer samples when analysis succeeds
- Edge case: unsupported or failed analyser setup leaves playback state intact and exposes a safe fallback sample set
- Edge case: pausing/deactivating stops the reactive state from falsely reporting active playback

**Verification:**
- Player subscribers can render a stable visualizer without accessing raw audio nodes directly

---

- [ ] **Unit 2: Render the visualizer inside the music card**

**Goal:** Add a compact reactive visual surface to the existing music card that reflects the player samples and matches the current editorial UI.

**Requirements:** R1, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/components/MarginalMusicCard.js`
- Test: `tests/app-shell-menu-music-widget.test.mjs`

**Approach:**
- Add a visualizer strip or bar field inside the card body
- Render sample magnitudes into DOM-driven bars with paused/error/unavailable styling
- Keep the current title/status/controls layout intact

**Patterns to follow:**
- Existing `MarginalMusicCard` inline CSS injection style
- Existing `MarginalPanelCard` composition

**Test scenarios:**
- Happy path: card renders a visualizer with active bars for a playing track
- Edge case: card shows a flat/inactive visualizer when paused or unavailable
- Edge case: error state styling does not remove the visualizer container or break the controls

**Verification:**
- The music card visibly communicates playback activity without changing how transport buttons work

---

- [ ] **Unit 3: Verify the integrated menu surface**

**Goal:** Confirm the shared shell still mounts the music card correctly and the visualizer appears on the actual PLAY surface.

**Requirements:** R4, R5

**Dependencies:** Units 1-2

**Files:**
- Modify: verification is read-only for source files
- Test: `tests/app-shell-menu-music.test.mjs`
- Test: `tests/app-shell-menu-music-widget.test.mjs`

**Approach:**
- Re-run targeted menu music tests
- Use browser verification on the PLAY panel to confirm the visualizer is visible in the mounted card

**Patterns to follow:**
- Existing AppShell menu music integration path in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: the PLAY panel still mounts the shared music card with working controls
- Happy path: browser verification shows the visualizer surface on the actual card
- Edge case: autoplay-blocked or unavailable playback states still render safely

**Verification:**
- The feature works in the real mounted shell, not only in isolated component tests

## Risks and Mitigations

- **Risk:** Web Audio analysis can be blocked or unavailable depending on browser state.
  - **Mitigation:** Make analyser setup lazy and optional, and always provide safe fallback samples.

- **Risk:** A continuously updating visualizer could create noisy re-render churn.
  - **Mitigation:** Keep the sample set small and update only the minimal DOM needed for the card.

- **Risk:** Card layout changes could crowd the existing title/status/controls.
  - **Mitigation:** Use a compact strip visualization that fits the existing card footprint.

## Verification Strategy

- Run targeted Node tests for the player and card
- Verify the updated music card in the mounted PLAY panel via browser tooling
- Confirm the final diff stays limited to the player/card/test surfaces needed for the feature
