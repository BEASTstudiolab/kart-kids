---
date: 2026-04-09
topic: fortnite-layout-restructure
---

# Fortnite-Style Layout Restructure

> **Supersedes:** docs/brainstorms/2026-04-09-ux-flow-overhaul-requirements.md (tab bar position and panel layouts). The underlying multiplayer, persistence, GameEngine, and room system remain unchanged.

## Problem Frame

The current bottom tab bar + panel layout works but doesn't match the premium gaming feel of AAA titles like Fortnite. The user wants to follow Fortnite's lobby structure: top tab bar, 3D hero centered, right-side transparent overlay panel for PLAY controls, and a discover-style TRACKS page with auto-generated track minimaps.

## Requirements

**Top Tab Bar**

- R1. Move tab bar from bottom to top of screen. Tabs: PLAY | GARAGE | TRACKS | PROFILE. Horizontal text links (like Fortnite's PLAY / BATTLE PASS / COMPETE / LOCKER), not icon buttons.
- R2. Settings gear icon in the top-left corner of the tab bar. Opens settings modal.
- R3. Active tab has an underline indicator (orange accent). Clean, minimal — Fortnite uses a simple underline, not a glow.

**PLAY Screen (Main Lobby)**

- R4. 3D kart hero centered — takes most of the screen (already works, keep it).
- R5. Right-side transparent overlay panel (~250px wide, positioned right edge):
  - Track name with small "CHANGE" button (navigates to TRACKS tab)
  - Mode toggle button cycling through SOLO / ONLINE / PRIVATE (single button, tap to cycle — like Fortnite's "FILL / DON'T FILL" toggle)
  - Large **PLAY!** button at the bottom of the panel (HudButton style, orange glow)
- R6. Mode toggle button shows current mode text. Tapping cycles: SOLO → ONLINE → PRIVATE → SOLO. Icon or badge changes per mode.
- R7. The PLAY button behavior depends on selected mode (same logic as current RacePanel): SOLO starts race, ONLINE matchmakes, PRIVATE opens lobby overlay.

**GARAGE Screen**

- R8. Keep current dealership layout: left/right arrows, 3D kart centered, stats in bottom-right corner, equip button centered. Just move tab bar from bottom to top.

**TRACKS Screen (Discover-Style)**

- R9. Full-content page (opaque background, no 3D kart behind).
- R10. Left side: selected track detail panel — track name (large, display font), difficulty badge, piece count, description text, auto-generated top-down minimap preview.
- R11. Right side and bottom: horizontal card carousel rows (same angular glass cards as current).
  - "OFFICIAL TRACKS" row
  - "MY TRACKS" row (if any exist) + "CREATE TRACK" card at end
- R12. Tapping a track card in the rows updates the left detail panel and selects the track.

**Auto-Generated Track Minimap**

- R13. Generate a top-down canvas render of the track layout for the detail panel. Render track cells as colored segments on a dark background — shows the track shape/route.
- R14. Minimap also appears as a thumbnail on each track card (smaller version).

**PROFILE Screen**

- R15. Keep current ProfilePanel layout (player name, stats, settings gear). Just move tab bar from bottom to top.

## Success Criteria

- Layout matches Fortnite's lobby feel: top tabs, centered 3D hero, right-side PLAY panel.
- Tab bar at top with text links, settings gear top-left.
- PLAY screen has right-side overlay with track info + mode toggle + PLAY button.
- TRACKS screen shows auto-generated minimap previews of track layouts.
- All existing functionality preserved (racing, kart selection, track selection, multiplayer).

## Scope Boundaries

- This is a layout restructure — no new game features.
- Minimap generation is simple (colored rectangles/segments on canvas, not a full 3D render).
- No track thumbnails from 3D renders — just top-down cell-based schematic.
- Editor stays separate.
- No changes to multiplayer, persistence, or GameEngine.

## Key Decisions

- **Top tab bar over bottom tab bar**: Fortnite uses top navigation. More screen real estate for the 3D hero. Thumb-reach concern is lower on desktop; mobile is secondary.
- **Right-side transparent overlay**: Fortnite's lobby panel floats over the 3D scene. Minimal chrome, maximum immersion.
- **Mode toggle as cycling button**: Fortnite uses a single button that cycles between fill modes. Cleaner than 3 separate chips.
- **Auto-generated minimap**: Shows actual track shape without needing pre-rendered images. Generated from cell data at runtime using a small canvas element.

## Outstanding Questions

### Deferred to Planning

- [Affects R13][Technical] How to render track cells as a top-down minimap — canvas 2D context, cell positions mapped to pixel coordinates, colored by tile type.
- [Affects R1][Technical] Moving tab bar from bottom to top — update AppShell._createTabBar() positioning + CSS.
- [Affects R5][Technical] Right-side overlay panel — absolute-positioned div over the 3D canvas, transparent background with backdrop-filter.

## Next Steps

-> `/ce:plan` for structured implementation planning.
