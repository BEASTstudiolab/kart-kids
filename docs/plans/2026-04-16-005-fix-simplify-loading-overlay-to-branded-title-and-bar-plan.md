---
title: "fix: simplify the shared loading overlay to branded title and progress bar"
type: fix
status: proposed
date: 2026-04-16
origin: docs/plans/2026-04-16-004-fix-bootstrap-loading-overlay-unify-ui-plan.md
---

# fix: simplify the shared loading overlay to branded title and progress bar

## Overview

Refine the newly unified loading experience so it is visually minimal: show only the `KART KIDS` brand in the project display font plus a working progress bar. Keep the existing shared loader architecture and real bootstrap/race progress updates, but remove the extra visible phase, message, detail, and spinner chrome during normal loading.

## Problem Frame

The current shared loading overlay is functionally correct, but it still reads like a dense editorial card:

- `js/ui/components/LoadingOverlay.js` shows phase, large message, detail copy, spinner, and progress value during normal loading
- the visual treatment is more complex than the user now wants for boot and race loading
- the progress logic is already working for both bootstrap and race loading, so the remaining gap is presentation, not plumbing

The goal is to preserve the real loading signals while making the surface feel lighter and more branded.

## Requirements Trace

- SL1: Normal loading states must show `KART KIDS` in the current display font
- SL2: Normal loading UI must visually reduce to the brand title plus a progress bar
- SL3: Bootstrap and race loading must continue to use the same shared overlay component
- SL4: Real progress updates must continue to drive the loading bar
- SL5: Error state and cancel/return behavior must remain functional and understandable

## Scope Boundaries

- In scope:
  - `js/ui/components/LoadingOverlay.js`
  - any bootstrap or race integration touch-ups needed to fit the simplified loader
  - regression tests for the simplified loading surface
- Out of scope:
  - changing the underlying bootstrap milestone math
  - changing the race asset loading sequence
  - broader menu branding or typography work outside the loader

## Assumptions

- The user wants the simplification applied to the shared loader surface, not just one specific load path
- Loading progress can remain available through accessibility attributes even if progress text is no longer visually emphasized
- Error states may still need slightly more copy than normal loading states so failures remain understandable

## Plan Depth

Lightweight

The architecture is already in place; this pass is focused on simplifying presentation without regressing shared behavior.

## Context & Research

### Carry-forward from origin

- Bootstrap loading already routes through the shared `LoadingOverlay`
- `AppShell` and `LobbyScene` now emit real progress updates for first load and race start
- the remaining problem is that the overlay still looks busier than needed

### Local findings

- `js/ui/components/LoadingOverlay.js` currently renders spinner, phase, detail, visible progress text, and action controls in the normal loading state
- the display font is already standardized through `var(--font-display)` / `var(--font-editorial-display)` in `js/ui/ui-theme.css`
- the bootstrap and race paths already depend on `LoadingOverlay.setState()`, so the safest change is visual simplification inside the component rather than introducing a second loader variant

## Key Technical Decisions

- **Keep one shared loader component**
  - Do not fork bootstrap and race into different loaders
  - Simplify `LoadingOverlay` itself so both paths inherit the new look automatically

- **Use fixed brand-forward loading content**
  - Show `KART KIDS` as the visible headline during non-error loading
  - Reduce the visible UI to the title and progress bar, while allowing hidden/internal state updates to continue driving the bar and accessibility text

- **Preserve richer copy for failure handling when needed**
  - Error state can still surface explanatory text and return action
  - Normal loading should stay minimal

## Implementation Units

- [ ] **Unit 1: Simplify the shared loading overlay presentation**

**Goal:** Make the visible loading UI minimal while preserving shared behavior.

**Requirements:** SL1, SL2, SL3, SL5

**Files:**
- Modify: `js/ui/components/LoadingOverlay.js`
- Test: `tests/loading-overlay.test.mjs`

**Approach:**
- Remove the normal-state spinner and verbose copy from the visible composition
- Keep the branded title visible in the display font
- Retain error controls and error text for failure states
- Keep progress semantics and ARIA state intact even if some text becomes visually hidden or unused

**Patterns to follow:**
- typography tokens in `js/ui/ui-theme.css`
- existing shared loading API in `js/ui/components/LoadingOverlay.js`

**Test scenarios:**
- Happy path: normal loading shows the branded title and progress bar
- Edge case: determinate and indeterminate progress still update correctly
- Regression: error state still reveals actionable failure UI

- [ ] **Unit 2: Verify bootstrap and race integration still work with the simplified loader**

**Goal:** Confirm the working progress plumbing survives the visual simplification.

**Requirements:** SL3, SL4, SL5

**Files:**
- Modify: `index.html` if bootstrap defaults need cleanup
- Modify: `js/ui/core/AppShell.js` only if configuration becomes redundant
- Test: `tests/app-shell-menu-music.test.mjs`
- Test: `tests/e2e/navigation.spec.js`

**Approach:**
- Leave the bootstrap and race progress reporters intact unless the simplified surface makes some default copy redundant
- Verify the shared loader still mounts, updates, and hides cleanly in both paths

**Patterns to follow:**
- bootstrap integration in `index.html`
- runtime loading orchestration in `js/ui/core/AppShell.js`

**Test scenarios:**
- Happy path: bootstrap still uses the shared loader and removes it after startup
- Happy path: race loading still drives overlay state without regression
- Regression: no legacy loader DOM returns

## Risks & Mitigations

- **Risk:** Removing visible copy could make loading feel ambiguous
  - **Mitigation:** keep the bar responsive and preserve accessible progress metadata

- **Risk:** Simplifying the component could accidentally break error handling
  - **Mitigation:** keep error-specific UI paths covered by tests and preserve action buttons for failure state

## Verification Plan

- `node --check js/ui/components/LoadingOverlay.js js/ui/core/AppShell.js`
- `node --test tests/loading-overlay.test.mjs tests/app-shell-menu-music.test.mjs`
- browser verification on local dev server to confirm the simplified overlay appears and clears cleanly
