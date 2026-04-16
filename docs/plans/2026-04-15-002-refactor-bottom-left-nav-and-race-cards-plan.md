---
title: "refactor: Bottom-Left Nav + Editorial Race Cards"
type: refactor
status: proposed
date: 2026-04-15
origin: conversation-2026-04-15
---

# refactor: Bottom-Left Nav + Editorial Race Cards

## Overview

Recompose the main menu shell so the global tab navigation lives in the bottom-left, the top-right pill becomes the dedicated settings control, the music player moves into the PLAY panel under `System Logs`, and the mode choices (`Race`, `Free Play`, `Party`) become editorial action cards on the bottom-right.

This removes the remaining top-bar shell language and lets the PLAY, CHARACTER, GARAGE, TRACKS, and PROFILE tabs share one clearer design system anchored around the new editorial menu style.

## Problem Frame

The current shell still carries two competing layouts:

- A shell-level tab strip across the top
- A PLAY panel that already speaks the stronger editorial design language

That split makes the app feel like the shell and the tab content belong to different products. The top navigation also consumes vertical space and forces the tab panels to render beneath it, which weakens the full-screen staging the user wants.

The new composition should treat the whole menu as a full-viewport editorial control surface:

- No top bar
- Tab cluster anchored bottom-left
- Settings in the top-right pill
- PLAY modes promoted into content cards, not shell tabs
- Music integrated into the PLAY panel instead of floating at shell level

## User Requirements

- R1: Remove the top navigation bar entirely
- R2: Move global tabs (`PLAY`, `CHARACTER`, `GARAGE`, `TRACKS`, `PROFILE`) to the bottom-left
- R3: Make the global tabs smaller, closer in scale to the compact editorial buttons already used in the menu
- R4: Keep the main tab panels true full-screen (`100vh` / `100vw`) instead of rendering below a persistent top bar
- R5: Use the top-right pill as the settings button
- R6: Move the music player under `System Logs`
- R7: Turn `Race`, `Free Play`, and `Party` into content cards on the bottom-right of PLAY
- R8: Preserve the editorial visual system across the other tabs so the app feels unified
- R9: Keep menu debug affordances out of the main layout and attach them to the settings area

## Scope Boundaries

- In scope: shell layout, PLAY panel composition, music player relocation, shared editorial navigation/button/card styling, settings/debug placement
- In scope: adapting CHARACTER, GARAGE, TRACKS, and PROFILE to sit correctly inside the revised shell
- Out of scope: changing underlying race-start logic, party networking, track data, or game-engine camera behavior
- Out of scope: redesigning the settings modal internals unless required for the top-right trigger hookup

## Relevant Code

- `js/ui/core/AppShell.js`
  Owns shell DOM, tab buttons, panel containers, settings/debug utilities, and menu music dock
- `js/ui/ui-theme.css`
  Holds global shell tokens and layout styles shared across tabs
- `js/ui/panels/RacePanel.js`
  Owns the PLAY view, current editorial cards, `System Logs`, and mode actions
- `js/ui/panels/CharacterPanel.js`
  Editorial tab using the current shell chrome and spacing
- `js/ui/panels/GaragePanel.js`
  Editorial tab using the current shell chrome and spacing
- `js/ui/panels/TracksPanel.js`
  Editorial tab using the current shell chrome and spacing
- `js/ui/panels/ProfilePanel.js`
  Existing settings entry-point behavior and profile card layout
- `js/ui/LobbyScene.js`
  Current debug affordance injection that should align with the top-right utility zone

## Key Decisions

- Global navigation remains shell-owned in `AppShell`, but it becomes a compact bottom-left cluster instead of a top bar
- PLAY-mode choices are no longer shell tabs or footer buttons; they become bottom-right action cards within `RacePanel`
- The shell-level music dock is removed; `AppShell` should still own the player instance, but `RacePanel` should host the visible controls
- The top-right pill becomes the primary settings trigger for every tab, not just PROFILE
- The debug trigger remains available locally in dev, but visually grouped with the settings utility rather than occupying independent layout space
- Tab panels continue to be persistent and full-viewport; shell chrome should float above them instead of reserving layout height

## High-Level Design

```
AppShell
├── top-right utility zone
│   ├── settings pill
│   └── optional dbg pill/button (dev only)
├── full-screen tab panel container
│   ├── PLAY panel
│   │   ├── left rail: manifest + system logs + music player
│   │   └── right rail: pilot data + stacked mode cards
│   ├── CHARACTER panel
│   ├── GARAGE panel
│   ├── TRACKS panel
│   └── PROFILE panel
└── bottom-left nav cluster
    ├── PLAY
    ├── CHARACTER
    ├── GARAGE
    ├── TRACKS
    └── PROFILE
```

## Implementation Units

- [ ] **Unit 1: Shell Layout Rewrite**

**Goal:** Remove the top bar, anchor global tabs bottom-left, promote the top-right pill to settings, and restore true full-screen tab staging.

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/ui-theme.css`

**Approach:**
- Remove the existing top tab bar structure and any layout offsets tied to it
- Rebuild the shell chrome as floating overlay zones:
  - bottom-left nav cluster
  - top-right settings/debug utility cluster
- Ensure `.kk-page-container` and each panel fill the viewport without subtracting shell height
- Keep panel switching and render-mode logic unchanged where possible
- Move settings open behavior out of per-panel dependency and into the shell utility pill

**Verification:**
- No global navigation remains at the top
- Bottom-left nav is visible and compact
- Top-right settings pill opens settings
- Panels fill the full viewport without rendering under a removed header gap

---

- [ ] **Unit 2: Relocate Music Into PLAY**

**Goal:** Move the visible music player from the shell corner into the PLAY panel under `System Logs`.

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- Keep `MenuMusicPlayer` owned by `AppShell` for lifecycle/state management
- Replace the shell-level music dock with a mount or callback API that lets `RacePanel` host the controls
- Render the player directly beneath `System Logs` with styling consistent with the editorial cards
- Preserve existing play/pause/next interactions and track metadata updates

**Verification:**
- No music player remains in the shell corner
- Music controls render beneath `System Logs`
- Player controls still function and update live

---

- [ ] **Unit 3: PLAY Panel Recomposition**

**Goal:** Convert `Race`, `Free Play`, and `Party` into editorial action cards on the bottom-right while keeping `Pilot Data` in the same visual family.

**Files:**
- Modify: `js/ui/panels/RacePanel.js`
- Modify: `js/ui/components/MarginalPanelCard.js`
- Modify: `js/ui/components/MarginalModeButton.js`

**Approach:**
- Remove the current footer-style action strip for PLAY-mode switching
- Introduce stacked or grouped right-side cards for:
  - `Race`
  - `Free Play`
  - `Party`
- Keep their existing behaviors:
  - `Race` -> matchmaking
  - `Free Play` -> track select + solo launch
  - `Party` -> private lobby flow
- Retain `Pilot Data` on the right rail, positioned above or adjacent to the mode cards
- Leave `Tracks` as a global tab only; it no longer belongs in the PLAY action cluster

**Verification:**
- `Race`, `Free Play`, and `Party` appear as editorial cards on the bottom-right
- Their interactions still trigger the correct flows
- The PLAY view no longer needs a footer action bar

---

- [ ] **Unit 4: Unify Remaining Tabs**

**Goal:** Make CHARACTER, GARAGE, TRACKS, and PROFILE feel native to the revised shell instead of inheriting spacing from the retired top-bar layout.

**Files:**
- Modify: `js/ui/panels/CharacterPanel.js`
- Modify: `js/ui/panels/GaragePanel.js`
- Modify: `js/ui/panels/TracksPanel.js`
- Modify: `js/ui/panels/ProfilePanel.js`
- Modify: `js/ui/ui-theme.css`

**Approach:**
- Audit each panel for top-padding or composition assumptions tied to the old top navigation
- Align each tab with the new floating shell chrome:
  - enough breathing room for the top-right settings pill
  - enough clearance for the bottom-left nav cluster
- Preserve existing editorial cards and typography wherever possible
- Keep any per-tab CTA behavior intact while tightening layout consistency

**Verification:**
- All tabs feel visually related to PLAY
- No panel content collides with the new shell utilities
- Switching tabs preserves a cohesive design system

---

- [ ] **Unit 5: Debug Utility Placement**

**Goal:** Keep debug access available in development without competing with the main layout.

**Files:**
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/LobbyScene.js`

**Approach:**
- Route the existing debug trigger into the top-right utility cluster
- Match the debug affordance to the smaller editorial shell controls
- Keep it dev-only and avoid introducing persistent layout gaps

**Verification:**
- Debug remains reachable in local/dev builds
- Debug control is visually subordinate to the settings pill

## Risks

- Moving shell-owned music UI into `RacePanel` can create lifecycle leaks if subscriptions are not detached cleanly when the panel is rebuilt or disposed
- Reworking floating shell chrome may create accidental overlaps on smaller screens if the bottom-left tabs and right-side cards are not responsively constrained
- Sharing the settings trigger at shell level could duplicate or conflict with settings buttons inside individual panels if older hooks remain in place

## Test Plan

- Load the menu and confirm no top navigation renders
- Switch between all tabs from the bottom-left cluster
- Open settings from the top-right pill
- Verify the music player appears under `System Logs` and responds to controls
- Trigger `Race`, `Free Play`, and `Party` from the new PLAY cards
- Verify TRACKS is reachable as a global tab and still functions
- Confirm local debug access still exists in the top-right utility area
- Visually inspect desktop layout for viewport fill and overlap issues

## Exit Criteria

- The top bar is fully removed
- Global tabs live in the bottom-left
- Settings lives in the top-right pill
- Music is under `System Logs`
- `Race`, `Free Play`, and `Party` are PLAY cards on the bottom-right
- The tab panels occupy the full viewport
- The other tabs inherit the same editorial shell language cleanly
