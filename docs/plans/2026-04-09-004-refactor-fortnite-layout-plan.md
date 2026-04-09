---
title: "refactor: Fortnite-Style Layout Restructure"
type: refactor
status: completed
date: 2026-04-09
origin: docs/brainstorms/2026-04-09-fortnite-layout-requirements.md
deepened: 2026-04-09
---

# refactor: Fortnite-Style Layout Restructure

## Overview

Restructure the menu layout to follow Fortnite's lobby pattern: top tab bar with text links, settings gear top-left, 3D kart hero centered, right-side transparent overlay panel for PLAY controls, mode cycling toggle, and a discover-style TRACKS page with auto-generated track minimaps.

## Problem Frame

The current bottom tab bar + center-bottom panel layout works but doesn't match the premium gaming feel of AAA titles like Fortnite. The user wants Fortnite's lobby structure: top navigation, centered 3D hero taking most of the screen, and a floating right-side panel for controls.

(see origin: docs/brainstorms/2026-04-09-fortnite-layout-requirements.md)

## Requirements Trace

- R1. Move tab bar from bottom to top. Tabs: PLAY | GARAGE | TRACKS | PROFILE. Text links, not icon buttons.
- R2. Settings gear icon top-left of the tab bar. Opens settings modal.
- R3. Active tab has orange underline indicator.
- R4. 3D kart hero centered on PLAY screen.
- R5. Right-side transparent overlay panel (~250px): track name + CHANGE, mode toggle, PLAY button.
- R6. Mode toggle cycles SOLO → ONLINE → PRIVATE via single button tap.
- R7. PLAY button behavior depends on mode (same logic as current RacePanel).
- R8. GARAGE keeps current dealership layout, tab moves to top.
- R9. TRACKS is a full-content page (opaque background, no 3D behind).
- R10. TRACKS left: detail panel — track name, difficulty, piece count, minimap.
- R11. TRACKS right/bottom: card carousel rows (official + my tracks).
- R12. Tapping a track card updates the left detail panel.
- R13. Auto-generated top-down canvas minimap from cell data.
- R14. Minimap thumbnail on each track card.
- R15. PROFILE keeps current layout, tab moves to top.

## Scope Boundaries

- Layout restructure only — no new game features.
- Minimap is simple colored rectangles on canvas, not a 3D render.
- Editor stays separate (editor.html).
- No changes to multiplayer, persistence, or GameEngine.
- No changes to race flow, lobby overlay, or results overlay logic.

## Context & Research

### Relevant Code and Patterns

- **AppShell.js** — Tab bar created in `_createTabBar()`, panels in `_createTabPanels()`. TAB_DEFS array defines tab order/labels. `switchTab()` manages panel visibility and render modes. Tab bar CSS lives in `ui-theme.css` (`.kk-tab-bar`, lines 573-643).
- **RacePanel.js** — Current RACE tab with center-bottom layout, mode chip strip, track carousel, HudButton RACE CTA. Will become the PLAY screen with right-side overlay.
- **TracksPanel.js** — Current horizontal carousel with angular glass cards, official + my tracks sections. Will gain detail panel and minimap.
- **GaragePanel.js** — Dealership layout with arrows, stats, equip button. Minimal changes (just tab position).
- **ProfilePanel.js** — Player stats display. Minimal changes.
- **HudButton.js** — Angular SVG frame button with glow effects. Reuse for PLAY button.
- **TrackData.js** — Cell format `[gx, gz, tileKey, orient]`. gx/gz are integer grid coords. Minimap maps these to pixel positions.
- **TrackCodec.js** — `decodeCells()` for user tracks, `encodeCells()` for sharing.
- **ui-theme.css** — CSS custom properties design system, tab bar styles, panel styles, gaming animations.
- **_injectCSS() pattern** — All panels inject component-scoped CSS via static flag + `<style>` element in `<head>`.

### Key Tab Bar Implementation Details

Current tab bar CSS (ui-theme.css:573-643):
- `.kk-tab-bar`: `position: fixed; bottom: 0; border-top`
- `.kk-tab-bar__btn`: column flex layout (designed for icon+label, currently label-only)
- Active indicator `::after` pseudo-element at `top: 0` with orange glow

Current tab panel CSS (ui-theme.css:651-660):
- `.kk-panel--active`: `display: block; height: 100%`
- `.kk-page-container`: needs padding adjustment when tab moves from bottom to top

## Key Technical Decisions

- **Keep internal tab id `race`, change label to `PLAY`**: Avoids renaming panel references, data-attributes, and service bag properties across the codebase. Only the user-visible label changes. (see origin: R1)
- **Mode cycling button replaces chip strip**: Fortnite uses a single button that cycles modes. One button element, tap increments through SOLO → ONLINE → PRIVATE → SOLO. Trades discoverability for visual minimalism — new users can't see all 3 modes at a glance. Note: Fortnite's toggle is binary (FILL/DON'T FILL), ours is 3-state. If testing shows confusion, revert to chip strip. (see origin: R6)
- **Track info replaces track carousel on PLAY screen**: Right-side panel shows selected track name + small CHANGE button (navigates to TRACKS tab). No inline track selection — that belongs on TRACKS. (see origin: R5)
- **TrackMinimap as pure function, not class**: `renderMinimap(cells, width, height)` returns a `<canvas>` element. Two call sites (detail panel + card thumbnails) both need the same thing. No instance state needed — promote to class later if it ever needs animation or interactivity. (see origin: R13, R14)
- **Settings gear opens modal, not route**: `router.navigate(RouteIds.SETTINGS)` would replace `pageContainer.innerHTML` and destroy all 4 tab panel divs. Instead, settings gear uses `services.modal` to show settings as a modal overlay, preserving panel DOM. (see review: feasibility finding)
- **Profile settings gear removed**: Tab bar gear (R2) replaces the profile-specific gear. One global settings entry point, not two. (see review: coherence finding)
- **TRACKS render mode changed to `idle`**: `TAB_RENDER_MODES.tracks` changes from `'lobby'` to `'idle'` — no point rendering a 3D scene behind a fully opaque panel. Saves GPU on lower-end devices. Background changes to `rgba(10, 10, 10, 1.0)`. (see review: feasibility + adversarial finding)
- **User tracks show "CUSTOM" badge**: User tracks from `getSavedTracks()` have no `difficulty` field. Detail panel shows a "CUSTOM" badge instead, matching the existing custom badge style in RacePanel track cards.
- **TRACKS page uses CSS grid (detail left + carousel right)**: Detail panel fixed left (~40%), carousel rows take remaining space right and flow downward. On mobile, stacks vertically. (see origin: R10, R11)
- **Minimap coloring by tile category**: Straights/corners = track-color (orange), finish = green, ramps/elevation = yellow, bridges/tunnels = cyan, junctions = pink. Provides visual distinction without complexity.

## Open Questions

### Resolved During Planning

- **How to render minimap**: Canvas 2D context. Read cell array, find bounding box (min/max gx/gz), compute scale to fit canvas. For each cell, draw a filled rectangle at `(gx - minGx) * scale, (gz - minGz) * scale` with size `scale × scale`. Color by tile category.
- **Tab bar repositioning**: CSS-only change. `.kk-tab-bar`: `bottom:0` → `top:0`, `border-top` → `border-bottom`, `padding-bottom: env(safe-area)` → `padding-top: env(safe-area)`. Panel container gets `padding-top` instead of `padding-bottom` to avoid overlap.
- **Right-side overlay**: Absolute-positioned inside `.kk-panel--active[data-panel="race"]`, `right:0; top:0; height:100%; width:250px`. Transparent background with `backdrop-filter: blur(8px)`.
- **Settings gear position**: Prepend a gear button to the tab bar nav element, positioned absolutely at `left: var(--space-4)`. Opens settings as a modal via `services.modal` (not router.navigate, which would destroy tab panel DOM).
- **CSS Grid vs fixed positioning**: The existing `.kk-app-shell` CSS Grid has a `topnav` area slot (`grid-template-rows: var(--topnav-height) 1fr var(--actionbar-height)`). The tab bar uses `position: fixed` and sits outside this grid flow. When moving to `top: 0`, simplify the grid template to remove the unused `topnav`/`actionbar` rows, and keep the tab bar as fixed-positioned. Page container uses `padding-top` to clear the fixed bar.

### Deferred to Implementation

- Exact minimap canvas pixel dimensions — depends on visual testing of detail panel layout
- Whether mode cycling button needs an icon per mode or just text — try text-only first, add icons if it feels unclear
- Mobile breakpoint for TRACKS page grid-to-stack transition

## Implementation Units

- [x] **Unit 1: Tab Bar — Bottom to Top + PLAY Label + Settings Gear**

**Goal:** Move the tab bar from bottom to top of screen, change RACE label to PLAY, add settings gear button, update active indicator, and fix all panel padding for the new tab position.

**Requirements:** R1, R2, R3, R8, R15

**Dependencies:** None

**Files:**
- Modify: `js/ui/ui-theme.css`
- Modify: `js/ui/core/AppShell.js`
- Modify: `js/ui/panels/TracksPanel.js` (remove `padding-bottom: calc(var(--space-6) + 5rem)` that cleared old bottom tab bar)
- Modify: `js/ui/panels/ProfilePanel.js` (remove profile-specific settings gear if present)

**Approach:**
- Update `.kk-tab-bar` CSS: `bottom:0` → `top:0`, `border-top` → `border-bottom`, safe-area padding flip
- Simplify `.kk-app-shell` CSS Grid: remove unused `topnav`/`actionbar` rows from grid template
- Update `.kk-tab-bar__btn` layout: horizontal text links style (larger font, wider spacing, no column flex)
- Move active `::after` indicator from `top:0` to `bottom:0` (underline sits below the text)
- Change TAB_DEFS: `{ id: 'race', label: 'PLAY' }` — keep id, change label
- Add settings gear `<button>` as first child of nav, positioned `left: var(--space-4)` absolute. Click opens settings as modal via `services.modal` (NOT router.navigate, which destroys panel DOM)
- Update `.kk-page-container`: remove bottom padding, add top padding matching tab bar height (~56px)
- Update `.kk-panel--active`: adjust any internal padding that assumed bottom tab bar
- Update `TAB_RENDER_MODES.tracks` from `'lobby'` to `'idle'` (no 3D scene behind opaque panel)
- TracksPanel: remove old `padding-bottom: calc(var(--space-6) + 5rem)` from _injectCSS
- ProfilePanel: remove profile-specific settings gear (replaced by tab bar gear)
- GaragePanel: verify stats panel, arrows, equip button still positioned correctly
- Update `startRace()` / `endRace()` tab bar hide/show — same logic, just different position
- LobbyOverlay: verify z-index 40 still works under tab bar at 50
- ResultsOverlay: verify still works as full modal

**Patterns to follow:**
- Existing `.kk-tab-bar` CSS in ui-theme.css (lines 573-643)
- ModalService pattern for settings (same as NameEntryModal)

**Test scenarios:**
- Happy path: Tab bar renders at top of screen with PLAY | GARAGE | TRACKS | PROFILE labels
- Happy path: Settings gear icon visible top-left, clicking opens settings modal (not destroying panels)
- Happy path: Active tab shows orange underline below text
- Happy path: Tab switching still works (panels show/hide correctly)
- Happy path: All four tabs display content without overlap with top tab bar
- Happy path: GARAGE dealership layout still works (arrows, stats, equip button visible)
- Happy path: PROFILE panel content visible and scrollable (no duplicate settings gear)
- Edge case: Content not obscured by top tab bar (proper padding on all panels)
- Edge case: Race mode hides tab bar, endRace restores it
- Edge case: LobbyOverlay still accessible under tab bar
- Edge case: ResultsOverlay still covers full screen above tab bar

**Verification:**
- Tab bar at top, labels correct, gear icon opens modal, all panels display correctly with proper padding. No content hidden behind tab bar.

---

- [x] **Unit 2: PLAY Screen — Right-Side Overlay Panel**

**Goal:** Redesign the PLAY (formerly RACE) panel from center-bottom layout to a right-side transparent overlay with track info, mode cycling toggle, and PLAY button.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `js/ui/panels/RacePanel.js`

**Approach:**
- Replace `.kk-race-panel` centered column layout with right-side overlay: `position: absolute; right: 0; top: 0; height: 100%; width: 250px`
- Remove player name display (not in Fortnite's layout)
- Replace mode chip strip with single cycling button:
  - Modes array: `['solo', 'online', 'private']`
  - Button text shows current mode. Tap increments index, wraps around
  - Style: glassmorphism button matching existing chip aesthetic
- Replace track carousel with track info card:
  - Shows selected track name (large text)
  - Small "CHANGE" text button → calls `services.switchTab('tracks')`
  - Compact, sits above the mode toggle
- Keep HudButton PLAY at bottom of the panel (same glow/shimmer)
- Keep all race launch logic (`_startSoloRace`, `_startOnlineMatchmaking`, `_startPrivateLobby`) unchanged
- Remove `_renderTrackCarousel`, `_buildTrackCard` — replaced by track info card
- Panel background: transparent with backdrop-filter blur, matching existing glass aesthetic
- 3D kart hero (R4) is already handled by LobbyScene — no changes needed

**Patterns to follow:**
- Existing RacePanel glass chip styles for the mode toggle button
- HudButton for PLAY CTA
- `_resolveSelectedTrack()` for track name display

**Test scenarios:**
- Happy path: PLAY panel renders as right-side overlay (~250px wide)
- Happy path: 3D kart hero visible through transparent panel background
- Happy path: Track name displays correctly with CHANGE button
- Happy path: CHANGE button navigates to TRACKS tab
- Happy path: Mode toggle cycles SOLO → ONLINE → PRIVATE → SOLO on tap
- Happy path: Mode toggle text updates to show current mode
- Happy path: PLAY button starts race with correct mode
- Edge case: Selected track deleted — shows fallback track name
- Edge case: Panel doesn't block 3D interaction outside its bounds (pointer-events: none on container, auto on children)

**Verification:**
- Right-side panel with track info, cycling mode toggle, and PLAY button. All three race modes still launch correctly.

---

- [x] **Unit 3: TrackMinimap Component**

**Goal:** Create a pure function that renders a top-down track minimap onto a canvas element.

**Requirements:** R13, R14

**Dependencies:** None (standalone utility)

**Files:**
- Create: `js/ui/components/TrackMinimap.js`

**Approach:**
- Export a single function: `renderMinimap(cells, width, height)` → returns `<canvas>` element
- `cells` is the raw array of `[gx, gz, tileKey, orient, ...]` tuples (defensively access indices — don't assume fixed tuple length)
- Compute bounding box: iterate cells to find min/max gx and gz
- Compute cell render size: `min(width / rangeX, height / rangeZ)` with padding
- Create `<canvas>` element at specified dimensions
- Fill background with dark color (`#0a0a0a` or similar)
- For each cell, draw a filled rounded-rect at mapped position
- Color mapping by tile prefix:
  - `trk-straight`, `trk-corner` → orange (track color)
  - `trk-finish` → green
  - `trk-ramp`, `trk-elev` → yellow
  - `trk-bridge`, `trk-tunnel` → cyan
  - `trk-junction` → pink
  - `trk-jump`, `trk-chicane` → orange
- Note: each cell renders as a single square. Multi-cell tiles (3x3 curves, chicanes) will appear as their component cells, not their visual footprint. This is acceptable for a schematic minimap

**Patterns to follow:**
- Cell data format from TrackData.js: `[gx, gz, tileKey, orient]`
- TrackCodec.js TYPE_NAMES for tile name reference

**Test scenarios:**
- Happy path: Renders a canvas element with correct dimensions
- Happy path: Track cells appear as colored segments forming the track shape
- Happy path: Works with both built-in track cells and decoded user track cells
- Edge case: Single-cell track renders centered
- Edge case: Large track (many cells) scales down to fit canvas
- Edge case: Empty cells array renders dark background only

**Verification:**
- Canvas element shows recognizable top-down track shape with colored segments matching tile types.

---

- [x] **Unit 4: TRACKS Page — Discover Layout with Detail Panel**

**Goal:** Redesign TRACKS page from carousel-only to Fortnite's discover layout: left detail panel with minimap + right/bottom card carousel rows.

**Requirements:** R9, R10, R11, R12, R14

**Dependencies:** Unit 3

**Files:**
- Modify: `js/ui/panels/TracksPanel.js`

**Approach:**
- Replace `.kk-tracks` layout with CSS grid: `grid-template-columns: minmax(280px, 1fr) 2fr`
- Left column: detail panel
  - Selected track name (large display font)
  - Difficulty badge (official tracks) or "CUSTOM" badge (user tracks — no difficulty field in saved data)
  - Piece count
  - Description text (if available — built-in tracks may have a description field; user tracks show piece count + date as fallback)
  - `renderMinimap(cells, width, height)` canvas (render at ~240×180)
- Right column: existing carousel rows (official + my tracks)
  - Keep existing card styles, carousel scroll-snap, arrows
  - Keep CREATE TRACK card at end of my tracks row
- Track card click: update detail panel with new track's info + minimap. Also select the track (existing `_selectTrack` behavior)
- Add small minimap thumbnail to each track card (`renderMinimap` at ~80×60 or similar)
  - For built-in tracks: pass `track.cells` directly
  - For user tracks: decode cells via `decodeCells(track.cells)` (cells field is encoded string). Guard against decode failure — show empty minimap on error
- Opaque background (R9) — change from `rgba(10, 10, 10, 0.85)` to `rgba(10, 10, 10, 1.0)` (fully opaque, no 3D bleed-through)
- Detail panel maintains a `_selectedTrackData` reference, updated on card click
- Default detail: show currently selected track from Settings on panel show()
- Mobile: stack detail panel above carousel rows (`grid-template-columns: 1fr` at small breakpoint)

**Patterns to follow:**
- Existing TracksPanel card builders (`_buildOfficialCard`, `_buildUserCard`)
- Existing carousel scroll-snap and arrow patterns
- TrackMinimap component from Unit 3

**Test scenarios:**
- Happy path: TRACKS page shows detail panel on left, carousel rows on right
- Happy path: Detail panel shows selected track name, difficulty, piece count, minimap
- Happy path: Clicking a track card updates the detail panel and selects the track
- Happy path: Minimap thumbnails appear on track cards
- Happy path: Official tracks row and my tracks row both render
- Happy path: CREATE TRACK card still opens editor.html
- Edge case: No user tracks — my tracks row shows empty state + CREATE TRACK card
- Edge case: User track minimap decodes cells correctly from encoded string
- Edge case: Switching to TRACKS tab refreshes detail with current selection
- Integration: Selecting track on TRACKS → switching to PLAY → track name updates in PLAY panel

**Verification:**
- TRACKS page shows discover layout with detail panel + minimap on left, carousel rows on right. Clicking cards updates detail panel. Minimap thumbnails visible on cards.

## System-Wide Impact

- **Interaction graph:** Tab bar position change affects all panels' vertical layout. PLAY panel restructure changes how mode selection and track info are presented but preserves all race-launch logic. TRACKS detail panel adds a new interaction (card click → detail update) alongside existing selection.
- **State lifecycle risks:** Mode cycling button must stay in sync with `services.selectedMode`. Track info card must refresh on `show()` (same as current carousel refresh).
- **Unchanged invariants:** GameEngine, physics, multiplayer, network, Settings schema, TrackRegistry, TrackCodec, race flow, lobby overlay, results overlay — all untouched. Race launch logic (solo/online/private) preserved exactly.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tab bar at top may feel different on mobile (thumb reach) | Origin doc acknowledged this — desktop primary, mobile secondary. CSS can be easily flipped back if needed |
| Minimap canvas rendering perf with many cells | Cells are typically <50 per track. Canvas 2D rect drawing is fast. No concern at this scale |
| Right-side overlay may overlap 3D kart on narrow screens | Accepted for this iteration — desktop primary, mobile secondary (per origin doc). Mobile responsive fallback deferred to follow-up. Current center-bottom layout remains as the known-good mobile fallback if needed |
| TRACKS page grid layout may not work well with only 1 built-in track | Detail panel always shows something (selected track). Carousel still functional with 1 card |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-09-fortnite-layout-requirements.md](docs/brainstorms/2026-04-09-fortnite-layout-requirements.md)
- Tab bar CSS: js/ui/ui-theme.css (lines 573-643)
- Panel system: js/ui/core/AppShell.js
- Current PLAY panel: js/ui/panels/RacePanel.js
- Current TRACKS panel: js/ui/panels/TracksPanel.js
- Cell data format: js/TrackData.js, js/TrackCodec.js
- Button component: js/ui/components/HudButton.js
- Prior plans: docs/plans/2026-04-09-002-refactor-ux-tab-bar-overhaul-plan.md (completed), docs/plans/2026-04-09-003-feat-tracks-tab-plan.md (completed)
