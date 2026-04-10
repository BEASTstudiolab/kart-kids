---
date: 2026-04-08
topic: open-ideation
focus: low-to-medium complexity auto-coder improvements
---

# Ideation: Kart Kids Open Improvements (Session 9)

## Codebase Context

Browser-based multiplayer kart racing game. three.js + crashcat physics, 73+ JS modules, no bundler. 2-person team. 8 prior ideation sessions produced PRs #38-#103 covering micro-optimizations, robustness, and user-visible features (wrong-way detection, adaptive AI, ghost splits, race commentary, track thumbnails, etc.). Pending complex items: fixed timestep, junction support, network buffer/reconnect. Focus this session: auto-coder-viable improvements at low-to-medium complexity.

## Ranked Ideas

### 1. Respawn Forward Impulse
**Description:** When VehicleRespawn.execute() teleports a player back to the track, apply a small forward velocity (e.g., 30% of average race speed) instead of zeroing all velocities. Extend invulnerability to 2.0 seconds to cover the re-acceleration window.
**Rationale:** Currently respawn drops the player at zero speed with only 1.0s invulnerability. AI maintains full speed through the respawn zone, causing cascade hits. A forward impulse removes the "punished twice for one mistake" frustration.
**Downsides:** Impulse direction must match the respawn checkpoint's facing; wrong direction = launched off track again. Need to verify checkpoint orientation data is reliable.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 2. Off-Track Warning Before Respawn
**Description:** When VehicleRespawn detects the player has left the track (off-track grace timer starts), flash a "RETURN TO TRACK" warning on the HUD with a countdown ring showing remaining grace time. Use HUD.js SpringAnimator for a pulsing effect. Dismiss automatically when the player returns to the track surface.
**Rationale:** Respawn currently teleports with zero lead-up feedback. Players don't know they're off-track until they're teleported, which feels arbitrary. A 2-second warning gives agency.
**Downsides:** Needs a callback from VehicleRespawn to HUD — a new event channel.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 3. Results Screen Lap Breakdown
**Description:** After a race, show per-lap times on the results screen. Highlight the best lap in green and worst in red. Show delta against ghost best lap if available. RaceMode already stores lap data — this is purely a HUD display addition.
**Rationale:** The results screen currently shows only total time and best lap — two numbers with no context. Per-lap breakdown tells the player WHERE they lost time and makes improvement feel concrete.
**Downsides:** Screen space is limited on mobile; may need scrollable or collapsible section for 5+ lap races.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 4. Camera Mode HUD Indicator + Mobile Button
**Description:** Show the current camera mode name briefly when cycling (toast-style, fade after 1.5s). Add a camera-cycle touch button to Controls.js for mobile players who currently have no way to change camera mode.
**Rationale:** Camera cycles through 5 modes with no visual feedback. Mobile players are locked into default chase cam with no way to switch. This is a basic accessibility gap.
**Downsides:** Another touch button adds to already-crowded mobile HUD. Consider placing it in the settings area rather than the action zone.
**Confidence:** 75%
**Complexity:** Low
**Status:** Unexplored

### 5. Item Weight by Race Position
**Description:** When a player collects an item box, weight the random item selection by their current race position. Trailing players get more offensive/powerful items; leaders get defensive items. RaceMode._position and PowerupItem.ITEMS weights already exist — just multiply weights by a position factor at pickup time.
**Rationale:** Classic kart racing mechanic. Currently all positions get equal item probability, making items feel random rather than comeback-enabling. Position-weighted items make races feel fairer and more dramatic.
**Downsides:** Needs tuning to avoid making leading positions feel punished. Weight multipliers need playtesting.
**Confidence:** 70%
**Complexity:** Low-Medium
**Status:** Unexplored

### 6. Draft Cone Commentary Trigger
**Description:** Wire DraftingSystem._proximityLeads entry event to the race commentary callout system. When a player enters another vehicle's draft cone, flash "DRAFTING!" commentary. First draft entry per race could show "SLIPSTREAM!" as a teaching moment.
**Rationale:** Drafting is a subtle mechanic many players never deliberately use. Audio+visual commentary at the exact moment of entry teaches the mechanic through play. Very low implementation cost — wires two existing systems together.
**Downsides:** Could feel noisy if the player weaves in and out of draft range repeatedly. Needs a cooldown per target.
**Confidence:** 75%
**Complexity:** Low
**Status:** Unexplored

### 7. Track Export to File
**Description:** Add a "Download" button in the editor that exports the current track as a .json file via Blob + URL.createObjectURL + anchor click. Import via file input that calls Persistence.loadFromJSON(). Protects against localStorage loss.
**Rationale:** Tracks are stored exclusively in localStorage with no backup. Browser storage wipe, private mode, or device switch destroys all player-created content. File export/import is the most basic data safety net.
**Downsides:** File format needs to be stable — any schema changes break old exports. Should include a version field.
**Confidence:** 80%
**Complexity:** Low-Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Grand Prix Cup Mode | Complex, needs multi-screen UI/UX design |
| 2 | Character abilities as gameplay | Needs balance design |
| 3 | Environmental hazards/surface | Needs new art + design decisions |
| 4 | Persistent kart stats | Needs balance tuning |
| 5 | Spectator/podium replay | Medium-high complexity |
| 6 | Track weather/lighting | Needs design decisions + art |
| 7 | Remove AI waypoint graph | High regression risk |
| 8 | Invert item box spawn model | Design decisions needed |
| 9 | Co-op track building mid-race | Very high complexity |
| 10 | Wall-riding gravity sectors | Very high complexity |
| 11 | Territorial advance mode | Needs game design |
| 12 | Shrinking track elimination | Dynamic collision mesh |
| 13 | Broadcast director camera | Medium-high complexity |
| 14 | Track as weapon | Needs new tile types |
| 15 | Shared ghost via multiplayer | Needs server changes |
| 16 | Waypoint preview in URLs | Too coupled |
| 17 | Automate post-processing context | Refactor with design decisions |
| 18 | Tire mark heatmap on minimap | Medium complexity, UX design |
| 19 | Wreckage from eliminated vehicles | Medium complexity, design |
| 20 | Touch button sizing | Needs mobile UX testing |
| 21 | Settings menu race-state guard | UI flow design needed |
| 22 | Saboteur AI faction | Needs game design |
| 23 | Time Trial medals | Needs content authoring |

## Session Log
- 2026-04-08: Session 9 ideation — 39 raw ideas from 5 frames, 30 after dedupe, 7 survived adversarial filtering
