---
title: "refactor: rebuild settings around the profile panel structure"
type: refactor
status: proposed
date: 2026-04-16
origin: user request
---

# refactor: rebuild settings around the profile panel structure

## Overview

Re-approach the settings surface so it feels coherent with the rest of the current UI system, especially the cleaner profile page. The goal is not to simply restyle the existing settings page; it is to simplify the structure, remove redundant chrome, and make the controls easier to scan and use inside both the modal and routed page contexts.

## Problem Frame

The current settings experience is messy for two related reasons:

- `js/ui/pages/page21-settings/Page21SettingsView.js` behaves like a full standalone page squeezed into a modal, with duplicated framing, a custom tab rail, oversized editorial cards, and too much explanatory copy competing with the controls
- `js/ui/core/AppShell.js` opens settings in a modal that already has a title and close affordance, while the settings view itself renders a second back-oriented header, creating awkward duplicated navigation
- the settings structure does not follow the cleaner pattern used by the current profile surface, which makes profile feel organized while settings feels improvised
- functionality is harder to trust because the surface hierarchy is noisy: controls are buried inside decorative cards rather than grouped into obvious, direct settings lanes

The user’s requested direction is to take structure from the better profile surface and use that as the basis for a cleaner settings implementation.

## Requirements Trace

- RS1: Settings must take visual and structural direction from the current profile surface
- RS2: The modal settings experience must remove redundant or messy framing
- RS3: Core settings controls must remain functional for apply and reset flows
- RS4: Settings sections must be easier to scan, switch, and understand
- RS5: The routed settings page and modal settings page must continue to work from the same implementation

## Scope Boundaries

- In scope:
  - `js/ui/pages/page21-settings/Page21SettingsView.js`
  - `js/ui/pages/page21-settings/Page21SettingsController.js`
  - `js/ui/core/AppShell.js`
  - shared UI components used to align settings with the profile structure
  - settings-related tests and browser verification
- Out of scope:
  - changing the underlying `js/Settings.js` storage schema
  - moving profile/garage/character responsibilities back into settings
  - broader redesign of every modal in the app

## Assumptions

- The existing controller persistence logic is broadly correct and can be preserved while the view structure is rebuilt
- The main UX issue is surface architecture and control grouping, not the existence of the setting values themselves
- The most direct way to align with profile is to reuse the same `MarginalPanelHeader`, `MarginalPanelCard`, and shared tab vocabulary rather than iterating further on the current custom rail layout

## Plan Depth

Standard

This is a bounded UI refactor, but it touches layout structure, modal integration, event wiring, and verification.

## Context & Research

### Local findings

- `js/ui/panels/ProfilePanel.js`
  - uses `MarginalPanelHeader` and `MarginalPanelCard`
  - presents a simple top summary row plus one larger supporting card
  - keeps actions obvious and localized
- `js/ui/pages/page21-settings/Page21SettingsView.js`
  - builds its own page-specific header, custom vertical tab rail, and multiple large cards
  - duplicates “back” style navigation even when rendered inside the settings modal
  - mixes structure, copy, and control presentation too heavily
- `js/ui/core/AppShell.js`
  - opens settings in a modal with title `Settings`, then mounts the full page view inside the modal body
  - already applies settings-specific modal classes, so the modal shell can be refined along with the view
- `js/ui/components/Tabs.js`
  - provides a cleaner shared tab pattern than the settings page’s bespoke rail model

### Existing patterns to follow

- `js/ui/panels/ProfilePanel.js`
- `js/ui/components/MarginalPanelHeader.js`
- `js/ui/components/MarginalPanelCard.js`
- `js/ui/components/Tabs.js`

## External Research Decision

No external research is needed.

This is an internal UI architecture cleanup based on established in-repo patterns.

## Key Technical Decisions

- **Rebuild settings around profile-like layout primitives**
  - Use the same high-level composition language as profile: a strong header, a compact summary row, and one main content region
  - Prefer fewer, more purposeful cards over many decorative ones

- **Replace the custom settings rail with the shared tabs system**
  - The current bespoke tab rail makes settings feel like a disconnected legacy page
  - Shared tabs will reduce custom logic and visually align the surface with other structured areas

- **Treat modal framing as part of the problem**
  - The settings page should not render redundant navigation chrome when it is already living inside a modal shell
  - The modal header and page header need one coherent ownership model

- **Keep controller persistence stable while simplifying the view**
  - Preserve `Page21SettingsController` value mapping and persistence unless a small cleanup is necessary
  - Focus the refactor on structure, grouping, and presentation first

## Open Questions

### Resolved During Planning

- The profile panel is the right in-repo reference for structural direction
- The current settings messiness comes from duplicated framing and overloaded card layout more than from missing feature coverage
- The modal-specific experience should be cleaned up along with the view, not treated as separate polish

### Deferred to Implementation

- Whether the modal should hide its built-in title/header entirely for settings, or keep the close affordance while visually minimizing the shell
- Whether to expose a compact section summary card that updates with the active settings tab

## High-Level Technical Design

```text
Settings Surface
  Header (profile-style)
    -> title / subtitle / compact badge
  Summary row
    -> system status / quick actions
  Main settings workspace
    -> shared horizontal tabs
    -> single active content card or lane
    -> grouped controls with lighter copy
  Action footer
    -> reset / apply

Modal integration
  AppShell settings modal
    -> reduce duplicate modal/page framing
    -> preserve close behavior
```

## Implementation Units

- [ ] **Unit 1: Rebuild the settings view structure using profile-style primitives**

**Goal:** Make settings feel organized and current instead of like a page jammed into a modal.

**Requirements:** RS1, RS4, RS5

**Files:**
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`
- Modify: `js/ui/components/MarginalPanelHeader.js` if small flexibility hooks are needed
- Modify: `js/ui/components/MarginalPanelCard.js` if small flexibility hooks are needed

**Approach:**
- Replace the current custom settings page scaffolding with a profile-like composition
- Use shared tabs instead of the bespoke rail model
- Reduce decorative copy and put the emphasis back on controls
- Keep all existing control ids so controller persistence logic continues to map correctly

**Test scenarios:**
- Happy path: settings renders with a clean header, clear section switcher, and visible active control groups
- Happy path: switching sections still updates the visible panel correctly
- Regression: existing control ids still map through `getAllValues()` / `setAllValues()`

- [ ] **Unit 2: Clean up modal-specific framing and navigation**

**Goal:** Remove redundant navigation and make the modal-hosted settings surface feel intentional.

**Requirements:** RS2, RS5

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/pages/page21-settings/Page21SettingsView.js`

**Approach:**
- Decide one clear owner for settings modal framing
- Avoid showing both modal title chrome and an internal back-heavy page header in a way that feels duplicated
- Preserve close and focus behavior from `ModalService`

**Test scenarios:**
- Happy path: opening settings from profile shows one coherent modal surface
- Happy path: closing settings returns cleanly to the underlying shell
- Regression: routed settings still remains usable outside the modal context

- [ ] **Unit 3: Verify persistence and polish the new settings flows**

**Goal:** Ensure the cleaner UI still actually works.

**Requirements:** RS3, RS4, RS5

**Files:**
- Modify: `js/ui/pages/page21-settings/Page21SettingsController.js` if small view-integration cleanup is needed
- Modify: `tests/e2e/profile-settings.spec.js`
- Add or modify focused UI tests if practical

**Approach:**
- Keep the controller persistence contract intact
- Update tests to match the new settings structure instead of the outdated legacy expectations
- Verify apply/reset plus a few representative control changes through browser testing

**Test scenarios:**
- Happy path: apply saves changed values and they persist across reopen/reload
- Happy path: reset returns settings to defaults
- Happy path: tab switching works in the new layout
- Regression: settings opened from profile still works inside the modal

## Risks & Mitigations

- **Risk:** A large view rewrite could accidentally break value wiring
  - **Mitigation:** keep control ids stable and leave controller normalization logic intact where possible

- **Risk:** Modal cleanup could regress close/focus behavior
  - **Mitigation:** limit modal changes to settings-specific classes and verify with browser testing

- **Risk:** The redesign could become another over-designed dashboard
  - **Mitigation:** keep the profile surface as the structural reference and bias toward fewer layers, fewer cards, and clearer control grouping

## Verification Plan

- `node --check js/ui/pages/page21-settings/Page21SettingsView.js js/ui/pages/page21-settings/Page21SettingsController.js js/ui/core/AppShell.js`
- targeted tests for settings/profile surface changes
- browser verification for modal open, section switching, apply/reset, and persistence
