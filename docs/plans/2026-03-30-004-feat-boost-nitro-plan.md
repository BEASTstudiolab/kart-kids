---
title: "feat: Add boost/nitro system"
type: feat
status: completed
date: 2026-03-30
origin: docs/brainstorms/2026-03-30-boost-nitro-requirements.md
---

# feat: Add boost/nitro system

## Overview

Add a boost meter that fills passively (20s) or via drifting (5x rate), activated with space bar when full. Boost doubles top speed (150→300) for 3-5 seconds, then expires. HUD shows meter fill and active state.

## Problem Frame

No skill-expression mechanic beyond steering. Boost rewards drifting risk and creates overtaking moments. (see origin: docs/brainstorms/2026-03-30-boost-nitro-requirements.md)

## Requirements Trace

- R1. Passive fill ~20s empty→full
- R2. Drift fills at 5x passive rate (~4s to full)
- R3. Meter 0-1, only activatable when full (1.0)
- R4. Space bar activates
- R5. Instant drain on activation
- R6. Boost lasts 3-5 seconds (tunable)
- R7. Top speed 150→300, acceleration scales proportionally during boost
- R8. Returns to normal when boost expires
- R9. HUD meter bar showing fill level
- R10. Visual indication when ready (full)
- R11. Visual indication when active

## Scope Boundaries

- No staged charging or partial boost
- No boost-specific vehicle VFX (reuse existing smoke/underglow if trivial)
- No gamepad button mapping (keyboard space bar only)
- No multiplayer sync of boost state

## Context & Research

### Relevant Code and Patterns

- `js/Vehicle.js` — `driftIntensity` computed each frame (range ~0-8+), `debug.topSpeed = 150`, `linearSpeed` lerps toward input using `debug.accelerationRate`, physics drive = `linearSpeed * debug.topSpeed * dt`
- `js/Controls.js` — `this.keys[e.code]` map, `'Space'` currently unmapped, returns `{x, z, touchActive}`
- `js/HUD.js` — DOM overlay elements created in constructor, `update(displayState)` toggles visibility by state, updates text per frame
- `js/RaceMode.js` — `getDisplayState()` returns object consumed by HUD, `filterInput()` blocks input during countdown

## Key Technical Decisions

- **Boost state lives on Vehicle**: The boost meter, active flag, and timer are Vehicle instance properties. Vehicle.update() manages fill, activation, and expiry. This keeps boost tightly coupled with the physics it modifies, matching how driftIntensity and linearSpeed already work.

- **Controls returns boost input**: Controls.update() adds a `boost` boolean to the returned input object (true when Space is pressed). Vehicle receives it through the existing input flow. RaceMode.filterInput() already zeros input during non-racing states, so boost is automatically blocked during countdown.

- **Acceleration scales linearly with top speed**: During boost, `debug.topSpeed` is temporarily overridden. Since drive force = `linearSpeed * topSpeed * dt`, doubling topSpeed naturally doubles the drive force. No separate acceleration tunable needed — the physics already scale. (Resolves origin deferred question about acceleration scaling)

- **HUD boost bar as new DOM element**: A horizontal bar below the race HUD, created in HUD constructor, updated from `displayState.boostMeter` and `displayState.boostActive`. Follows the same pattern as `_lapLine` and `_timeLine`.

## Open Questions

### Resolved During Planning

- **Acceleration scaling**: Drive force already scales with topSpeed (`linearSpeed * topSpeed * dt`), so doubling topSpeed doubles acceleration naturally. No separate tunable needed.

### Deferred to Implementation

- **Exact driftIntensity threshold for "drifting"**: Vehicle.driftIntensity ranges 0-8+. A threshold of ~1.0 should work (clearly drifting, not just slight steering). Tune during testing.
- **Touch boost button**: Out of scope per origin doc, but Controls.js touch handling has a clear spot to add one later.

## Implementation Units

- [x] **Unit 1: Boost meter and activation on Vehicle**

  **Goal:** Add boost meter fill (passive + drift), space bar activation, and temporary top speed override to Vehicle.

  **Requirements:** R1, R2, R3, R4, R5, R6, R7, R8

  **Dependencies:** None

  **Files:**
  - Modify: `js/Vehicle.js`
  - Modify: `js/Controls.js`

  **Approach:**
  - Add to Vehicle: `boostMeter` (0-1), `boostActive` (bool), `boostTimer` (seconds remaining), and tunable constants: `BOOST_FILL_TIME = 20`, `BOOST_DRIFT_MULTIPLIER = 5`, `BOOST_DURATION = 4`, `BOOST_TOP_SPEED = 300`, `DRIFT_THRESHOLD = 1.0`
  - In Vehicle.update(): if not boosting, fill meter at `dt / BOOST_FILL_TIME`, multiplied by `BOOST_DRIFT_MULTIPLIER` when `driftIntensity > DRIFT_THRESHOLD`. Clamp to 1.0.
  - If boost input received and meter >= 1.0: set `boostActive = true`, `boostTimer = BOOST_DURATION`, `boostMeter = 0`
  - If boosting: decrement timer, override topSpeed to `BOOST_TOP_SPEED`. When timer expires: `boostActive = false`, restore normal topSpeed.
  - In Controls.update(): add `boost: !!this.keys['Space']` to the returned input object

  **Patterns to follow:**
  - How `driftIntensity` is computed and stored as a Vehicle property
  - How Controls.update() polls `this.keys` and returns an input object
  - How RaceMode.filterInput() returns ZERO_INPUT during non-racing states (boost automatically blocked)

  **Test scenarios:**
  - Happy path: Driving straight for 20s fills meter from 0 to 1.0
  - Happy path: Drifting (driftIntensity > threshold) fills meter in ~4s
  - Happy path: Space bar when meter is full activates boost — topSpeed becomes 300, meter drops to 0
  - Happy path: After BOOST_DURATION seconds, topSpeed returns to 150
  - Edge case: Space bar when meter < 1.0 does nothing
  - Edge case: Space bar during countdown (non-racing state) does nothing (filterInput blocks it)
  - Edge case: Meter doesn't fill past 1.0
  - Edge case: Boost activates and expires within a single lap without glitching

  **Verification:**
  - Drive around. Meter fills visibly faster when drifting. Space bar at full meter causes dramatic speed increase for ~4 seconds, then returns to normal.

- [x] **Unit 2: HUD boost meter display**

  **Goal:** Show boost meter bar in the HUD with fill level, ready, and active states.

  **Requirements:** R9, R10, R11

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/HUD.js`
  - Modify: `js/RaceMode.js`

  **Approach:**
  - In RaceMode.getDisplayState(): add `boostMeter` and `boostActive` fields, read from the vehicle passed to update(). Requires RaceMode to have a vehicle reference during getDisplayState().
  - In HUD constructor: create a boost bar container (div) with an inner fill bar (div). Position below the race HUD. Style: narrow horizontal bar, fill color changes based on state (filling = blue/cyan, full/ready = yellow/gold pulse, active = red/orange).
  - In HUD.update(): set fill bar width to `boostMeter * 100%`. Toggle color/class based on ready (meter === 1) and active states. Show only during 'racing' state.

  **Patterns to follow:**
  - How `_raceHud` is created with inline `cssText` in the HUD constructor
  - How `_lapLine.textContent` is updated per frame in HUD.update()
  - How displayState fields flow from RaceMode → HUD

  **Test scenarios:**
  - Happy path: Bar starts empty, fills gradually while driving
  - Happy path: Bar fills visibly faster during drifts
  - Happy path: Bar changes appearance when full (ready to boost)
  - Happy path: Bar changes appearance during active boost, then returns to empty/filling
  - Edge case: Bar hidden during countdown and idle states
  - Edge case: Bar width never exceeds 100% or goes below 0%

  **Verification:**
  - Visual: boost bar visible during racing, fills over time, changes color when full, empties and changes color when boost activated.

## System-Wide Impact

- **Interaction graph:** Controls → (boost input) → Vehicle.update() → (boost state) → RaceMode.getDisplayState() → HUD.update(). No callbacks or middleware affected.
- **Error propagation:** No failure modes — all values are clamped floats and booleans.
- **State lifecycle:** Boost state resets with Vehicle. RaceMode.reset() already resets vehicle state.
- **Unchanged invariants:** FinishLine detection, TrackIntel, multiplayer networking, Minimap — all unaffected. Remote players see the speed change naturally via position updates.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 300 top speed causes physics tunneling through walls | crashcat wall colliders are thick enough for current speeds. Test at 300 — if tunneling occurs, reduce to 250. |
| Boost feels too strong or too weak | All constants are tunables on Vehicle. Adjust during playtesting. |
| driftIntensity threshold too sensitive or too strict | Start at 1.0, tune based on feel. Log values during testing. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-30-boost-nitro-requirements.md](docs/brainstorms/2026-03-30-boost-nitro-requirements.md)
- Related code: `js/Vehicle.js` (driftIntensity, topSpeed, linearSpeed), `js/Controls.js` (key mapping), `js/HUD.js` (DOM overlay pattern)
