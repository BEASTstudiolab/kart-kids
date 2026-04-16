---
title: "fix: smooth loading flow and surface real progress"
type: fix
status: proposed
date: 2026-04-16
origin: docs/brainstorms/2026-04-09-menu-production-ready-requirements.md
---

# fix: smooth loading flow and surface real progress

## Overview

Smooth out the current loading experience across both the menu preview and race start flow. The immediate goals are:

- stop revealing menu assets in a visibly staggered order
- replace the dead one-shot `index.html` loading overlay with a reusable loading surface that survives past initial bootstrap
- expose honest, phase-based loading progress during race start instead of silently doing most work after the bar disappears

This plan extends the earlier menu-production-ready work, specifically the loading requirement in `R30`, with implementation detail for the current merged `index.html` + `AppShell` architecture.

## Problem Frame

The current app has two different loading systems, and neither matches the user experience we want:

- the page bootstrap overlay in `index.html` fades out immediately after `AppShell.bootstrap()`, so it is gone long before `GameEngine.start()` begins a race load
- `GameEngine.start()` still queries `#loading-overlay`, `#loading-bar`, and `#loading-text`, but by that point the DOM node has already been removed, so the game-load progress UI is effectively dead
- the menu hero/lobby preview loads its environment and rider stack via separate async chains, which causes visible pop-in: kart first, then character, then environment (or similar ordering depending on timing)
- `loadModels()` reports progress only for the GLTF phase; the rest of race startup (track build, collider generation, player/network init, mode setup) happens without surfaced progress, so the current percentage is incomplete even when it appears

The result is a loading experience that feels both rough and dishonest: users see assets appear one by one, and the race-start bar is either missing or only covers part of the work.

## Requirements Trace

- LR1: Menu preview assets must reveal as one cohesive scene instead of visibly streaming in piece-by-piece
- LR2: Race start must show a live loading surface for the full startup lifecycle, not just initial page bootstrap
- LR3: Progress messaging must cover the meaningful startup phases users wait on, not just model fetches
- LR4: Loading UI must preserve existing cancel/error behavior where applicable
- LR5: The updated loading visuals must fit the existing editorial UI system rather than introducing a generic throwaway loader
- LR6: The solution must work for solo and multiplayer race starts
- LR7: The earlier menu-production-ready requirement `R30` remains satisfied and becomes accurate in the merged SPA architecture

## Scope Boundaries

- In scope:
  - `index.html` bootstrap loading behavior
  - race-start loading overlay lifecycle
  - menu/lobby preview asset reveal coordination
  - progress instrumentation for `GameEngine.start()`
  - updates to existing loading tests and relevant e2e coverage
- Out of scope:
  - deep optimization of every asset load in the project
  - new backend/server loading APIs
  - replacing the underlying GLTF asset set
  - broader menu redesign beyond loading-state presentation

## Assumptions

- The current `AppShell` + `GameEngine` split remains the right runtime architecture
- The existing `LoadingOverlay` component is the right foundation for race-start loading UI, but it needs to become determinate/progress-aware
- The menu preview should preserve the current editorial visual language and 3D lobby direction
- A small amount of intentional holdback before reveal is preferable to immediate but visibly fragmented asset pop-in

## Plan Depth

Standard

This work crosses menu UI, shared loading UI, and game startup sequencing, but it stays within the existing architecture and does not require a new subsystem or backend contract.

## Context & Research

### Origin document carry-forward

From `docs/brainstorms/2026-04-09-menu-production-ready-requirements.md`:

- `R30` already requires a loading state for race start, including progress indicator, error handling, and cancel behavior
- the merged SPA architecture means race loading must now work through `AppShell`/`GameEngine`, not just initial page load
- menu pages and 3D preview are expected to feel polished rather than transitional or obviously stitched together

### Local research summary

#### Current race loading flow

- `index.html`
  - creates `#loading-overlay`, `#loading-bar`, and `#loading-text`
  - calls `app.bootstrap()`
  - immediately fades and removes the overlay after bootstrap completes
- `js/GameEngine.js`
  - still looks up those same DOM IDs during `start()`
  - updates progress only inside the `loadModels()` callback
  - dismisses `#loading-overlay` at the end of start even though it was already removed during bootstrap
- `js/ModelLoader.js`
  - already exposes a per-model `onProgress(loaded, total, name)` hook
  - loads vehicles/character/decor plus only the track tiles actually needed

#### Current menu preview flow

- `js/ui/LobbyScene.js`
  - starts environment loading in the constructor via `GLTFLoader.load()`
  - loads the selected kart in `setKart()`
  - nests character loading under kart loading
  - then nests animation loading under character loading
  - adds pieces to the scene as each asset arrives, causing visible staggered reveal
- `js/ui/core/AppShell.js`
  - shows the lobby scene behind most tabs as soon as it is available
  - has no coordinated “menu preview ready” gate beyond `lobbyScene.ready`

#### Existing loading UI foundation

- `js/ui/components/LoadingOverlay.js`
  - already supports show/hide/error/cancel behavior
  - does not yet support determinate progress, phase labels, or progress-bar rendering
- `tests/loading-overlay.test.mjs`
  - already covers lifecycle safety and is the correct unit-test home for overlay behavior changes

### Existing patterns to follow

- Shared UI components with injected CSS and focused unit tests
- AppShell-owned orchestration for screen lifecycle and overlays
- Existing editorial shell styles and mono/display typography in the menu system
- GLTF loading via `GLTFLoader.loadAsync()` or promise-wrapped loaders where coordination matters

## External Research Decision

No external research is needed.

This is an internal loading-orchestration and UX-truthfulness issue in an already-established codebase. The repo already contains the relevant loading hooks, overlay component, and menu preview architecture.

## Key Technical Decisions

- **Promote loading UI ownership to AppShell/runtime, not static HTML only**
  - The static bootstrap overlay in `index.html` should only cover first paint / shell bootstrap
  - Race-start loading must move onto a reusable runtime-managed overlay so it can appear every time `startRace()` runs

- **Treat race loading as phased progress, not a single file-download percentage**
  - Surface meaningful phases such as:
    - preparing race
    - loading models
    - building track
    - syncing players / finalizing start
  - Model progress remains useful, but it should be nested under a broader startup progress model instead of pretending to be the whole process

- **Gate menu preview reveal on a coherent readiness threshold**
  - Do not attach visible lobby preview pieces to the scene one at a time if that creates user-visible pop-in
  - Prefer promise-based coordination so the environment + selected kart + rider are considered ready before the preview is revealed

- **Keep bootstrap and race loading visually related but lifecycle-distinct**
  - The initial page overlay and in-app race loading overlay can share language and component primitives
  - They should not share a single fragile DOM node that is created once and then removed permanently

- **Use determinate progress when the signal is real, indeterminate when it is not**
  - The bar should advance on actual measurable work
  - For phases without granular counts, use weighted phase completion or indeterminate treatment rather than fake exact percentages

## Open Questions

### Resolved During Planning

- The current loading bar does not run during race load because the bootstrap overlay is removed too early
- The menu pop-in problem should be solved by coordinated reveal, not just by styling tweaks
- The correct UX direction is a real reusable loading surface with progress support, not a second ad hoc DOM overlay

### Deferred to Implementation

- Exact weighting values for each race-start phase
- Whether the initial bootstrap overlay should be fully replaced by the shared `LoadingOverlay` component or only visually aligned with it
- Whether menu preview reveal should use opacity gating on the scene container, object visibility gating inside `LobbyScene`, or a small shell-level veil

## High-Level Technical Design

```text
Boot Flow
index.html bootstrap overlay
  -> AppShell bootstrap
  -> fade out once shell + first menu state are ready

Menu Preview Flow
LobbyScene preload group
  -> environment promise
  -> selected kart promise
  -> rider + animation promise
  -> reveal preview only after readiness threshold is met

Race Start Flow
AppShell.startRace()
  -> show runtime LoadingOverlay
  -> engine.start({ onLoadingProgress })
       -> phase: preparing
       -> phase: loading-models (granular counts)
       -> phase: building-track
       -> phase: syncing-race-state
       -> phase: ready
  -> hide overlay on success
  -> show error/cancel path on failure
```

## Implementation Units

- [ ] **Unit 1: Make loading UI reusable and progress-aware**

**Goal:** Upgrade the existing loading overlay so it can represent both indeterminate and determinate loading states during runtime.

**Requirements:** LR2, LR3, LR4, LR5

**Files:**
- Modify: `js/ui/components/LoadingOverlay.js`
- Test: `tests/loading-overlay.test.mjs`

**Approach:**
- Extend `LoadingOverlay` with:
  - phase/message updates
  - optional determinate progress value
  - optional sublabel or progress detail text
  - striped/indeterminate fallback when precise counts are unavailable
- Preserve existing error and cancel affordances
- Keep the visual language aligned with the current editorial system instead of introducing a separate loader design

**Patterns to follow:**
- `js/ui/components/ProgressBar.js`
- `js/ui/components/LoadingOverlay.js`

**Test scenarios:**
- Happy path: overlay can show, update message/progress, and hide cleanly
- Happy path: overlay can switch between determinate and indeterminate states without breaking DOM structure
- Error path: overlay still transitions correctly into error mode after progress updates
- Edge case: hide/dispose remain safe even if progress updates or timeout cleanup are pending

**Verification:**
- Loading overlay exposes a stable API that AppShell/GameEngine can call during race startup

- [ ] **Unit 2: Remove menu preview pop-in by coordinating asset reveal**

**Goal:** Make the menu/lobby preview appear as a cohesive scene instead of revealing environment, kart, and rider in visibly separate steps.

**Requirements:** LR1, LR5

**Files:**
- Modify: `js/ui/LobbyScene.js`
- Modify: `js/ui/core/AppShell.js`
- Test: `tests/lobby-assets.test.mjs`
- Test: `tests/e2e/garage.spec.js`

**Approach:**
- Refactor the `LobbyScene` asset-loading path toward promises / readiness tracking rather than nested immediate reveals
- Track readiness for:
  - lobby environment
  - selected kart model
  - seated rider / animation setup
- Gate visible reveal until the minimum coherent set is ready
- Ensure switching tabs or changing selected kart does not briefly show half-built scene state

**Patterns to follow:**
- `js/ModelLoader.js`
- existing readiness usage in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: first menu preview reveal waits until required assets are ready
- Happy path: changing selected kart swaps preview cleanly without flashing incomplete intermediate state
- Edge case: stale async loads from older selections do not reveal outdated assets
- Error path: failed preview asset load degrades gracefully without leaving the scene half-visible

**Verification:**
- Menu preview feels like one reveal instead of sequential pop-in during live browser verification

- [ ] **Unit 3: Instrument full race-start progress and route it through AppShell**

**Goal:** Show accurate, visible progress for the full race-start lifecycle every time a race begins.

**Requirements:** LR2, LR3, LR4, LR6, LR7

**Files:**
- Modify: `js/GameEngine.js`
- Modify: `js/ModelLoader.js`
- Modify: `js/ui/core/AppShell.js`
- Modify: `index.html`
- Test: `tests/e2e/navigation.spec.js`
- Test: `tests/e2e/play-modes.spec.js`

**Approach:**
- Remove `GameEngine.start()`’s dependence on `#loading-overlay` / `#loading-bar` / `#loading-text`
- Introduce a progress callback contract from AppShell into `GameEngine.start()`
- Break startup into user-meaningful phases and surface them through the runtime overlay
- Continue using granular `loadModels()` progress within the “loading models” phase
- Keep cancel/error handling wired through the same overlay path where appropriate
- Reduce `index.html`’s bootstrap overlay responsibility to initial shell bootstrap only so it no longer conflicts with race-start loading

**Patterns to follow:**
- `js/ui/panels/RacePanel.js`
- `js/ui/components/LoadingOverlay.js`
- `js/ModelLoader.js`

**Test scenarios:**
- Happy path: starting a solo race shows loading UI through model load, track build, and final ready state
- Happy path: starting a multiplayer/online race uses the same overlay path and does not regress matchmaking flow
- Edge case: startup failure restores menu UI and shows a useful error state
- Edge case: subsequent races still show the loader correctly after initial bootstrap overlay is gone
- Integration: `index.html` first-load overlay no longer blocks or conflicts with runtime race-start loading

**Verification:**
- A race started from the menu shows visible progress rather than silently stalling after menu dismissal

- [ ] **Unit 4: Browser verification and polish pass**

**Goal:** Validate that the new loading UX reads clearly and that the revised flow feels smoother in practice.

**Requirements:** LR1-LR7

**Files:**
- Test: `tests/e2e/navigation.spec.js`
- Test: `tests/e2e/garage.spec.js`
- Test: `tests/e2e/play-modes.spec.js`

**Approach:**
- Verify initial app boot, menu preview reveal, and race start in a live browser session
- Capture any final copy/timing polish needed so the loading states feel intentional rather than purely technical

**Test scenarios:**
- Happy path: app boot transitions cleanly from bootstrap overlay into menu
- Happy path: menu preview reveal is visually cohesive
- Happy path: race start presents visible progress and exits cleanly into gameplay

**Verification:**
- Live browser run on local port `3000` with screenshots or observations captured during implementation

## Dependencies and Sequencing

1. Unit 1 first, because the runtime loading surface needs the right API before AppShell/GameEngine can use it
2. Unit 2 can proceed after Unit 1 and mostly stays on the menu-preview side
3. Unit 3 depends on Unit 1 and should land after the shared loading API is stable
4. Unit 4 finishes the pass after implementation is complete

## Risks and Mitigations

- **Risk:** Progress percentages still feel fake if phase weighting is poor
  - **Mitigation:** Keep exact counts only where they are real, use broader phase messaging elsewhere

- **Risk:** Menu preview gating could make first reveal feel slower
  - **Mitigation:** Prefer a short intentional veil over obvious pop-in; keep the readiness threshold minimal but coherent

- **Risk:** Loading orchestration changes could regress solo or multiplayer race start
  - **Mitigation:** Verify both paths and keep `GameEngine.start()` focused on reporting progress rather than owning overlay DOM directly

## Acceptance Criteria

- The menu preview no longer visibly assembles itself asset-by-asset on first reveal
- Starting a race from the menu always shows a live loading surface, even after the initial page bootstrap overlay is gone
- The loading UI presents meaningful phase/message updates during race startup
- Errors still surface cleanly, and loading UI teardown remains safe
- The implementation preserves the existing editorial shell language and does not introduce a mismatched loader
