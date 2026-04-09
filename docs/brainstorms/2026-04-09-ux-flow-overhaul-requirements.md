---
date: 2026-04-09
topic: ux-flow-overhaul
---

# UX Flow Overhaul — 2-Click-to-Race (Tab Bar Architecture)

> **Supersedes:** docs/brainstorms/2026-04-09-menu-production-ready-requirements.md navigation model (TopNav, separate pages for Home/PlayModes/QuickPlay/KartSelect). The production-ready doc's multiplayer, persistence, GameEngine, and server room system remain unchanged. Only the navigation architecture and page layout are replaced.

## Problem Frame

The current menu has 13 pages with 4-5 clicks to start racing. Navigation feels disconnected — Garage is separate from racing, Play Modes is an unnecessary intermediary, and Quick Play lands in a Lobby instead of just racing. The goal is a kart-forward, 2-click-to-race flow inspired by Fortnite's lobby + Mario Kart's speed.

## Requirements

**Title Screen**

- R1. Title screen behavior depends on player state:
  - **First run** (no name in localStorage): Show logo, then name modal. After modal completes, advance to main menu.
  - **Returning player**: Skip title entirely — go straight to main menu (RACE tab). Achieves true 1-tap-to-race.

**Main Menu — Kart-Forward Layout**

- R2. Main menu shows the player's selected kart in 3D (turntable preview, already built as GaragePreview). The kart is the hero — large, centered, dominant.
- R3. A prominent RACE button overlaid on or below the kart preview. This is the single most important action on screen.
- R4. Mode chips below the RACE button: `ONLINE` | `SOLO` | `PRIVATE`. One is always selected (default: ONLINE). Switching modes is a single tap — no page navigation.
- R5. RACE button behavior changes based on selected mode:
  - **ONLINE**: auto-matchmake → countdown → race (no lobby screen). On failure: show error toast, offer retry or fall back to SOLO.
  - **SOLO**: race against AI on a random track (instant start). Default mode until multiplayer is stable.
  - **PRIVATE**: create room → show room code overlay (with copy button) → wait for friends → host taps START → racing.
- R5a. Default mode chip is SOLO (safest — works offline). ONLINE becomes default once multiplayer is production-stable.

**Bottom Tab Bar**

- R6. Persistent bottom tab bar on all menu screens: RACE (default active), GARAGE, CREATE, PROFILE.
- R7. Tab bar replaces the current TopNav. TopNav is removed.
- R8. Switching tabs swaps the content area above. The 3D canvas persists behind all tabs.
- R9. RACE tab = the main menu (kart preview + RACE button + mode chips).
- R10. GARAGE tab = kart selection (grid of kart thumbnails with stats, tap to preview in 3D, equip button). Uses the same 3D preview — swapping kart updates the model. Equipping a kart shows a brief confirmation toast and stays on GARAGE tab (no auto-navigate). A secondary RACE button on GARAGE tab provides a shortcut to racing.
- R11. CREATE tab shows a "Track Editor" card with description and a LAUNCH button that opens editor.html in a new tab. The tab content provides context (not just a bare link) so the user understands they're leaving the app. The 3D canvas shows a dimmed/blurred version of the kart on this tab.
- R12. PROFILE tab = player name, race stats, settings button. Simplified from full Profile + Settings pages.

**Page Consolidation**

- R13. Eliminate these as separate routed pages: Home, Play Modes, Quick Play, Kart Select. Their functionality is absorbed into the RACE and GARAGE tabs.
- R14. Lobby page remains for PRIVATE mode only (room code, member list, host start). It is a modal overlay or slide-up, not a full page navigation.
- R15. Results screen is a full-screen overlay (not a routed page). RACE AGAIN immediately queues a new race with the same mode (skips the RACE tab — goes straight to matchmaking/loading). QUIT returns to RACE tab. For PRIVATE mode, RACE AGAIN returns all players to the lobby overlay for host to re-start.
- R16. Pause screen remains as an in-race overlay. Tab bar is hidden during races.
- R17. Settings becomes a modal accessible from the PROFILE tab (gear icon). Not a separate page.

**Tab Bar Visibility**

- R17a. Tab bar is visible on all tab screens (RACE, GARAGE, CREATE, PROFILE).
- R17b. Tab bar is hidden during: active race, matchmaking overlay, results overlay, pause overlay.
- R17c. Tab bar is visible underneath the PRIVATE mode lobby overlay (user can cancel and switch tabs).

**Navigation Flow**

- R18. App open → 1-2s splash → Main Menu (RACE tab active, kart visible)
- R19. Tap RACE (Online mode) → matchmaking spinner overlay → countdown → racing. **2 interactions: open app + tap RACE.**
- R20. Tap RACE (Solo mode) → loading overlay → racing against AI. **2 interactions.**
- R21. Tap RACE (Private mode) → room code overlay → friends join → host taps START → racing.
- R22. GARAGE tab → browse karts → tap to preview in 3D → tap EQUIP → confirmation toast, stay on GARAGE tab. Kart is updated everywhere (RACE tab preview, race loadout). No auto-navigate.
- R23. Race ends → Results overlay → RACE AGAIN (immediately queues next race per R15) or QUIT (returns to RACE tab).

## Success Criteria

- A returning player can go from app open to racing in 2 taps (auto-skip title + tap RACE).
- Mode switching (Online/Solo/Private) is a single tap on the main screen.
- Kart selection and racing are visually connected — the kart you see is the kart you race.
- No intermediary pages between the player and racing.
- Bottom tab bar provides clear, persistent navigation without confusion.

## Scope Boundaries

- This is a navigation architecture replacement. It replaces the TopNav + hash-routed pages model with a tab-bar + composite-panel model. Existing page controller logic will be extracted and recomposed into tab panels. This is significant rework of same-day code — accepted as the cost of getting the UX right.
- No new game modes or multiplayer features.
- The 3D preview, room system, and game engine are unchanged.
- Track selection is auto (random) for Online/Solo. Manual track selection deferred (could be added to PRIVATE mode lobby later).
- No onboarding tutorial or guided first-run beyond the name modal.

## Key Decisions

- **Kart-forward main menu**: The 3D kart preview IS the menu. Not a sidebar, not a thumbnail — the hero element.
- **Bottom tab bar over TopNav**: Mobile-native pattern. Persistent, thumb-reachable, clear.
- **Mode chips over separate Play Modes page**: One screen, one tap to switch. No navigation required.
- **Lobby as overlay, not page**: Private mode shows room code as a slide-up, keeping the player in the main menu context.
- **Auto-skip title**: 1-2 second branded splash, then straight to gameplay. Respects the player's time.

## Outstanding Questions

### Deferred to Planning

- [Affects R4][Technical] How should mode chips be wired to the existing startRace/findRoom/NetworkClient? The logic exists but is spread across PlayModes, QuickPlay, and Lobby controllers.
- [Affects R14][Technical] Lobby as modal overlay — use existing ModalService or a custom full-height slide-up panel?
- [Affects R7][Technical] Replacing TopNav with bottom tab bar — what happens to the existing TopNav visibility logic in AppShell (TOPNAV_HIDDEN_ROUTES)?
- [Affects R13][Technical] Which page controllers can be deleted vs. which have reusable logic to extract into the tab components?

## Next Steps

-> `/ce:plan` for structured implementation planning.
