---
title: "fix: unify bootstrap loading overlay with the runtime loader"
type: fix
status: proposed
date: 2026-04-16
origin: docs/plans/2026-04-16-002-fix-loading-flow-smoothness-and-progress-plan.md
---

# fix: unify bootstrap loading overlay with the runtime loader

## Overview

Finish the loading-flow work by removing the last old-style bootstrap loader and routing first-load progress through the same editorial loading surface used for race start. The immediate goals are:

- stop showing the stale `index.html` loading skin that no longer matches the menu UI
- make the first-load bar visibly advance during shell bootstrap instead of sitting at `0%`
- keep startup and race loading visually unified so users perceive one coherent loading system

This is a follow-on implementation pass from `docs/plans/2026-04-16-002-fix-loading-flow-smoothness-and-progress-plan.md`, focused specifically on the still-unfixed bootstrap path.

## Problem Frame

The repo now has a good runtime loading overlay for race start, but the initial page boot still uses the legacy static DOM loader:

- `index.html` still renders `#loading-overlay`, `#loading-title`, `#loading-bar`, and `#loading-text` with the old visual treatment
- `await app.bootstrap()` now waits for the first coherent menu preview, which means the legacy bootstrap overlay can stay on screen for meaningful time, making the mismatch much more visible
- that static bootstrap bar never receives real progress updates, so users see an old bar that often looks frozen even while the app is doing real work
- the result is inconsistent UX: first load looks older and rougher than the current menu system, while in-race load uses the newer editorial overlay

The remaining gap is not startup duration by itself; it is that the app still presents startup through an obsolete, mostly non-functional loader.

## Requirements Trace

- BL1: Initial app bootstrap must use the same editorial loading visual language as the runtime loading overlay
- BL2: The bootstrap progress bar must advance during real shell startup instead of remaining static
- BL3: Bootstrap completion must still wait for the first coherent menu preview before fading out
- BL4: Runtime race loading must continue to use the same shared loading surface without regression
- BL5: The implementation must preserve existing startup safety in `index.html` and not introduce a blank-screen gap before the overlay appears

## Scope Boundaries

- In scope:
  - `index.html` bootstrap loading markup and script
  - `js/ui/core/AppShell.js` bootstrap progress reporting
  - `js/ui/components/LoadingOverlay.js` reuse or bootstrap-specific configuration support
  - `js/ui/LobbyScene.js` startup readiness/progress hooks if needed to drive bootstrap progress honestly
  - tests covering bootstrap loader behavior and loading-surface consistency
- Out of scope:
  - broader menu redesign
  - race-start loading phase redesign beyond preserving the current shared loader
  - asset pipeline changes or deeper load-time optimization

## Assumptions

- The runtime `LoadingOverlay` introduced in the earlier loading pass is the correct base component for both bootstrap and race-start loading
- It is acceptable for bootstrap progress to be phase-weighted rather than byte-perfect as long as the bar visibly advances on real milestones
- The best UX outcome is one shared loading surface with lifecycle-specific state, not two separate loaders that merely look similar

## Plan Depth

Standard

This work is bounded, but it touches startup orchestration, UI consistency, and first-load readiness signaling across multiple layers.

## Context & Research

### Origin document carry-forward

From `docs/plans/2026-04-16-002-fix-loading-flow-smoothness-and-progress-plan.md`:

- loading should be owned by the runtime instead of a one-shot static DOM node
- the loading surface should match the editorial shell, not a throwaway default loader
- menu preview readiness should be part of when the app considers first load complete

### Local research summary

#### Current bootstrap path

- `index.html`
  - still renders the old full-screen loader markup directly in HTML
  - still defines bespoke bootstrap-only loader CSS in the page
  - waits for `await app.bootstrap()` and then fades the static overlay out
- `js/ui/core/AppShell.js`
  - now waits for `this._waitForInitialMenuPreview()` on returning-player boot
  - does not expose bootstrap progress callbacks to the host page
- `js/ui/LobbyScene.js`
  - now coordinates initial preview readiness, but it does not yet expose granular startup progress for the bootstrap bar

#### Current shared loading surface

- `js/ui/components/LoadingOverlay.js`
  - already matches the current editorial UI language
  - already supports phase labels, detail copy, determinate progress, and indeterminate fallback
- `js/ui/core/AppShell.js`
  - already uses `LoadingOverlay` for runtime race start
- this means the visual system and API are already present; the remaining issue is bootstrap ownership and progress wiring

### Existing patterns to follow

- shared UI component ownership in `js/ui/components/`
- `AppShell` as the orchestration layer for lifecycle state
- current editorial typography, mono labels, and angular panel shapes already used across the menu system

## External Research Decision

No external research is needed.

This is an internal consistency and startup-orchestration issue inside an already-established UI architecture.

## Key Technical Decisions

- **Retire the bespoke `index.html` loader skin**
  - First load should render through the same visual component model as runtime load, or through host-page markup that mirrors it exactly from shared config
  - The page should stop owning an independent old-style loader design

- **Let bootstrap report progress explicitly**
  - `AppShell.bootstrap()` should surface milestone updates so the host script can update the loader while the shell mounts, services initialize, and the first menu preview becomes ready
  - These updates should be meaningful milestones, not fake animation-only progress

- **Treat first preview readiness as part of bootstrap progress**
  - The loader should not hit `100%` until the initial menu scene is genuinely ready to reveal
  - Waiting on `whenInitialRevealReady()` should be reflected in the progress copy or phase label, not hidden behind a frozen bar

- **Keep bootstrap and race load on the same API**
  - Avoid creating a second loader component or second progress-update model
  - The same `LoadingOverlay` state shape should work for both startup and race start

## Open Questions

### Resolved During Planning

- The old look is coming from `index.html`, not from the newer runtime `LoadingOverlay`
- The bootstrap bar appears broken because it still has no progress source even though bootstrap now waits longer
- The most direct fix is to unify bootstrap on the shared loader rather than restyling the static HTML in isolation

### Deferred to Implementation

- Whether bootstrap should instantiate `LoadingOverlay` directly in `index.html` or receive one from `AppShell`
- Whether initial preview progress should be surfaced as coarse phase steps or a finer-grained preview-load signal

## High-Level Technical Design

```text
First Load
index.html host script
  -> create shared loading surface
  -> pass bootstrap progress callback into AppShell
  -> AppShell emits phases:
       shell setup
       service wiring
       3D preview startup
       first preview ready
  -> overlay reaches 100%
  -> fade/remove overlay

Race Start
AppShell.startRace()
  -> reuse shared loading surface API
  -> GameEngine emits race phases
  -> overlay hides on success or error
```

## Implementation Units

- [ ] **Unit 1: Replace the old bootstrap loader with the shared loading surface**

**Goal:** Remove the remaining legacy bootstrap loading UI and present first load through the same editorial loader used elsewhere.

**Requirements:** BL1, BL4, BL5

**Files:**
- Modify: `index.html`
- Modify: `js/ui/components/LoadingOverlay.js`
- Modify: `js/ui/core/AppShell.js`
- Test: `tests/loading-overlay.test.mjs`

**Approach:**
- Stop relying on the old `#loading-title` / `#loading-bar` / `#loading-text` visual treatment
- Reuse `LoadingOverlay` directly for bootstrap, or make host-page markup mirror it from the same source of truth
- Ensure bootstrap hide/remove behavior remains safe and does not flash blank content between states

**Patterns to follow:**
- `js/ui/components/LoadingOverlay.js`
- existing runtime loader orchestration in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: bootstrap loader renders with the shared editorial structure and hides cleanly after bootstrap completes
- Edge case: bootstrap overlay teardown remains safe if the app becomes ready before the fade/remove completes
- Regression: runtime race loader still renders with the same component API after bootstrap changes

**Verification:**
- There is no visible old-style bootstrap loader left in the app

- [ ] **Unit 2: Drive the bootstrap progress bar from real startup milestones**

**Goal:** Make the first-load progress bar visibly advance during actual app startup work.

**Requirements:** BL2, BL3, BL5

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/LobbyScene.js`
- Modify: `index.html`
- Test: `tests/app-shell-menu-music.test.mjs`
- Test: `tests/e2e/navigation.spec.js`

**Approach:**
- Add bootstrap progress reporting to `AppShell.bootstrap()`
- Emit phase-weighted progress as shell setup and preview startup complete
- Reflect the wait for `whenInitialRevealReady()` in the loader rather than leaving the bar static
- Keep the final fade-out gated on real readiness

**Patterns to follow:**
- current progress state shape already used by `LoadingOverlay.setState()`
- readiness coordination already present in `js/ui/LobbyScene.js`

**Test scenarios:**
- Happy path: bootstrap emits progress updates before the overlay is removed
- Happy path: first returning-player load reaches completion only after initial menu preview readiness
- Edge case: bootstrap progress remains monotonic and does not jump backwards across phases
- Regression: direct race-start flow still hides the menu and uses runtime progress correctly

**Verification:**
- On first visible load, the progress bar advances and the phase/detail copy updates instead of remaining static

## Dependencies & Sequencing

1. Unify bootstrap onto the shared loading surface first so there is one loading UI to drive.
2. Add bootstrap milestone reporting from `AppShell` and preview readiness progress from `LobbyScene`.
3. Update tests and browser verification for both first load and race start.

## Validation Strategy

- Syntax checks for modified JS files
- Targeted unit tests:
  - `tests/loading-overlay.test.mjs`
  - `tests/app-shell-menu-music.test.mjs`
- Browser verification:
  - `tests/e2e/navigation.spec.js` when local browser tooling is available
  - `agent-browser` first-load and solo-race manual verification as a fallback

## Risks & Mitigations

- **Risk:** Bootstrap loader appears too late, causing a blank flash
  - **Mitigation:** Keep host-page bootstrap control in `index.html`; only swap the loader implementation, not the host script’s responsibility to show something immediately

- **Risk:** Bootstrap and race paths drift again after this refactor
  - **Mitigation:** Keep both flows on the same loader state API and component

- **Risk:** Preview readiness remains opaque, so the bar still feels frozen near the end
  - **Mitigation:** Emit a dedicated “preparing preview” phase and, if needed, finer-grained progress from `LobbyScene`

## Exit Criteria

- First load no longer shows the old static loader design
- The bootstrap loader uses the same editorial language as the runtime race loader
- The progress bar visibly updates during startup and reaches completion only when the first coherent menu preview is ready
- Existing runtime race loading remains functional after the bootstrap unification
