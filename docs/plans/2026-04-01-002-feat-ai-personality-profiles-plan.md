---
title: "feat: AI personality profiles for distinct racer behavior"
type: feat
status: completed
date: 2026-04-01
origin: docs/ideation/2026-04-01-v020-post-review-ideation.md#7
---

# AI Personality Profiles for Distinct Racer Behavior

## Overview

Add per-racer personality profiles to the AI system so that each of the 8 AI karts exhibits visibly different racing behavior — different racing lines, throttle curves, cornering aggressiveness, and boost timing. Currently all AI racers share identical logic with only a noise phase offset differentiating them.

## Problem Frame

8 identical AI karts feel like traffic cones on rails. There are no emergent race stories because every AI follows the same blended waypoint target at the same speeds. Personality differences create memorable moments — "that red kart always dives inside on corners" or "the green one is reckless and crashes into walls."

## Requirements Trace

- R1. Define 4 distinct AI personality types with meaningfully different racing behavior
- R2. Assign personalities to AI racers on spawn so that a race with 8 AI has diverse behavior
- R3. Each personality must produce visibly different racing lines within the first lap
- R4. Personalities must not break the existing rubber-banding system
- R5. The personality system must be data-driven (configs, not code branches per personality)

## Scope Boundaries

- No item usage strategy — AI currently doesn't use items strategically, and that's not changing here
- No drafting/slipstream mechanics
- No per-personality VFX or vehicle model assignment (cosmetic variety already exists via model rotation)
- No difficulty rebalancing — rubber-banding continues to handle competitive pacing
- No changes to TrackIntel waypoint data — personalities modulate how waypoints are targeted, not the waypoints themselves

## Context & Research

### Relevant Code and Patterns

- **AIController.js** — The entire AI decision loop. Returns `{ x, z, touchActive, boost }` per frame. Key modulation constants:
  - `STEER_SENSITIVITY` (3.5) — how sharply the AI reacts to being off-line
  - `NOISE_AMPLITUDE` (0.03) — sinusoidal steering jitter
  - `TURN_THROTTLE_DOT` (0.7) — angle threshold where throttle reduction begins (~45 degrees)
  - `TURN_THROTTLE_MIN` (0.3) — floor throttle when turning hard
  - Look-ahead blend: 30% wp+1 / 70% wp+2 — controls how far ahead the AI targets
  - Boost trigger: `vehicle.boostMeter >= 1.0` — fires immediately when full

- **AIManager.js** — Spawns AI with `new AIController(trackIntel, index)`. The index only affects noise phase. No personality slot exists in the racer struct. Clean injection point at `_spawnAI()`.

- **TrackIntel.js** — Waypoints are cell-center only. No lateral offset, no racing-line data. AI personalities must create lateral variety by offsetting the target point, not by relying on waypoint data.

- **Vehicle.js** — Drift is a side-effect of body lean and speed changes (not explicitly triggered). Boost meter fills over 20s base, 5x faster during drift. AI always fires boost immediately when full. `externalTopSpeedMultiplier` already provides per-AI speed modulation via rubber-banding.

### Institutional Learnings

- No `docs/solutions/` exists. No prior art for AI personalities.

## Key Technical Decisions

- **4 personalities, not more**: Aggressive (tight lines, high throttle), Cautious (wide lines, early braking), Drifter (intentionally loose, drift-focused), Strategist (holds boost for straights, precise steering). 4 is enough for visible variety without tuning explosion. With 8 AI, each personality appears twice — enough to notice patterns.

- **Data-driven profiles as plain objects**: Each profile is a flat object with numeric overrides for AIController constants. No subclassing, no code branches per personality. The controller reads `this._profile.steerSensitivity` instead of the module constant `STEER_SENSITIVITY`.

- **Lateral waypoint offset for racing line variety**: Add a `lateralOffset` property to each profile. In the target selection phase, offset the blended waypoint position perpendicular to the wp1→wp2 track direction (perpendicular = `(-dz, dx)` for left, `(dz, -dx)` for right). Positive = right of center, negative = left. This creates visibly different lines without changing TrackIntel. The offset is scaled by the forward-to-target dot product so it naturally reduces in tight corners.
- **lookAheadBlend = weight assigned to wp+2 (far-ahead)**: `wp+1 weight = (1 - lookAheadBlend)`, `wp+2 weight = lookAheadBlend`. Default 0.7 gives 30% wp+1 / 70% wp+2 (current hardcoded behavior). Higher values (0.85 Cautious) = smoother, earlier cornering. Lower values (0.5 Aggressive) = tighter, later turn-in.

- **Boost strategy via `boostEagerness`, not threshold**: Vehicle.js gates boost on `boostMeter >= 1.0` internally — this cannot be bypassed from AI input without modifying Vehicle.js (out of scope). Instead, profiles specify `boostEagerness` (boolean): `true` = fire boost the instant meter is full (current behavior), `false` = hold boost and only fire when the forward-to-target dot product > 0.9 (i.e., on straights). Strategist holds for straights, others fire eagerly. This creates visible boost timing variety without touching Vehicle.js.

- **Profiles assigned round-robin by index**: `AI_PROFILES[index % AI_PROFILES.length]`. This ensures even distribution. The profile is stored on the racer struct for debug/HUD access.

## Open Questions

### Resolved During Planning

- **Should personalities affect drift behavior?** Not directly — drift is a physics side-effect in Vehicle.js, not an AI input. But the Drifter personality achieves more drift indirectly by maintaining higher throttle through corners (high `TURN_THROTTLE_MIN`) and using wider racing lines, which increases body lean and triggers the drift state machine.

- **Should personalities affect rubber-banding?** No — rubber-banding operates on `externalTopSpeedMultiplier` which is independent of personality. Both systems can coexist: personality affects *how* the AI drives, rubber-banding affects *how fast*.

### Deferred to Implementation

- **Exact numeric values for each profile**: The plan specifies directional ranges (e.g., Aggressive steerSensitivity "higher than base"). Final tuning requires playtesting.
- **Whether lateralOffset creates wall collisions on narrow tracks**: May need to clamp offset based on track piece type. Start with small offsets and iterate.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────┐
│  AIProfiles.js      │  ← NEW: plain data module
│  AI_PROFILES = [    │
│    { name, steer,   │
│      throttle, ..}  │
│  ]                  │
└────────┬────────────┘
         │ imported by
         ▼
┌─────────────────────┐
│  AIManager.js       │
│  _spawnAI(index)    │
│    profile = AI_PROFILES[index % 4]
│    controller = new AIController(trackIntel, index, profile)
│    racer.profile = profile
└────────┬────────────┘
         │ passes profile to
         ▼
┌─────────────────────┐
│  AIController.js    │
│  constructor:       │
│    this._profile = profile (merged with defaults)
│  update():          │
│    uses this._profile.steerSensitivity
│    instead of STEER_SENSITIVITY constant
│    applies lateralOffset to target point
│    uses boostEagerness (boolean) for boost timing
└─────────────────────┘
```

## Implementation Units

- [x] **Unit 1: Create AIProfiles.js — personality data definitions**

  **Goal:** Define 4 personality profiles as plain data objects with all modulation parameters.

  **Requirements:** R1, R5

  **Dependencies:** None

  **Files:**
  - Create: `js/AIProfiles.js`

  **Approach:**
  - Export `AI_PROFILES` array of 4 profile objects
  - Each profile has: `name` (string), `steerSensitivity`, `noiseAmplitude`, `turnThrottleDot`, `turnThrottleMin`, `lookAheadBlend` (0-1 weight toward wp+2, higher = smoother cornering), `lateralOffset` (world units, positive = right), `boostEagerness` (boolean — true = fire immediately, false = hold for straights), `stuckTime`, `reverseTime`
  - Export `DEFAULT_PROFILE` with the current constant values as a baseline
  - Profile approximate values (directional — final tuning deferred):
    - **Aggressive**: steerSensitivity 4.5, noiseAmplitude 0.05, turnThrottleDot 0.85, turnThrottleMin 0.5, lookAheadBlend 0.5, lateralOffset -0.8 (cuts inside), boostEagerness true, stuckTime 1.5, reverseTime 1.0
    - **Cautious**: steerSensitivity 2.8, noiseAmplitude 0.02, turnThrottleDot 0.5, turnThrottleMin 0.2, lookAheadBlend 0.85, lateralOffset 0.6 (stays wide), boostEagerness true, stuckTime 2.5, reverseTime 2.0
    - **Drifter**: steerSensitivity 3.2, noiseAmplitude 0.08, turnThrottleDot 0.8, turnThrottleMin 0.55, lookAheadBlend 0.6, lateralOffset 1.0 (wide entry for drift), boostEagerness true, stuckTime 2.0, reverseTime 1.5
    - **Strategist**: steerSensitivity 3.8, noiseAmplitude 0.01, turnThrottleDot 0.65, turnThrottleMin 0.25, lookAheadBlend 0.75, lateralOffset 0.0, boostEagerness false (holds boost for straights), stuckTime 2.0, reverseTime 1.5

  **Patterns to follow:**
  - QualityTiers.js PRESETS pattern — plain data objects, exported constants

  **Test scenarios:**
  - Happy path: AI_PROFILES has exactly 4 entries, each with all required properties
  - Happy path: DEFAULT_PROFILE matches the current AIController constant values
  - Edge case: all numeric values are within their valid ranges (steerSensitivity > 0, boostEagerness is boolean, etc.)

  **Verification:**
  - Importing AIProfiles.js succeeds, AI_PROFILES.length === 4, each profile has a `name` field

- [x] **Unit 2: Refactor AIController to use profile-based parameters**

  **Goal:** AIController accepts an optional profile object and reads per-instance properties instead of module-level constants.

  **Requirements:** R1, R3, R5

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/AIController.js`

  **Approach:**
  - Constructor gains a third `profile` parameter (optional, falls back to DEFAULT_PROFILE)
  - Merge profile into instance: `this._profile = Object.assign({}, DEFAULT_PROFILE, profile)`
  - Replace all 7 constant references in `update()` with `this._profile.*`:
    - `STEER_SENSITIVITY` → `this._profile.steerSensitivity`
    - `NOISE_AMPLITUDE` → `this._profile.noiseAmplitude`
    - `TURN_THROTTLE_DOT` → `this._profile.turnThrottleDot`
    - `TURN_THROTTLE_MIN` → `this._profile.turnThrottleMin`
    - `STUCK_TIME` → `this._profile.stuckTime`
    - `REVERSE_TIME` → `this._profile.reverseTime`
    - Boost check: if `this._profile.boostEagerness` is true, fire boost when `vehicle.boostMeter >= 1.0` (current behavior). If false, fire only when `vehicle.boostMeter >= 1.0` AND the forward-to-target dot product > 0.9 (on straights). Note: Vehicle.js gates boost internally at `boostMeter >= 1.0` — the AI cannot fire below that threshold without Vehicle changes (out of scope).
  - Modify look-ahead blend: replace hardcoded 0.3/0.7 with `(1 - this._profile.lookAheadBlend)` / `this._profile.lookAheadBlend`. lookAheadBlend is the weight toward wp+2 (far-ahead). Default 0.7 matches current behavior.
  - Add lateral offset: after computing the blended target (targetX, targetZ), compute the track direction as `(wp2.x - wp1.x, wp2.z - wp1.z)`, derive the perpendicular as `(-dz, dx)`, normalize it, then offset the target by `perpendicular * this._profile.lateralOffset * max(0, dot(forward, toTarget))`. The dot scaling naturally reduces offset in tight corners.
  - The module-level constants (`STEER_SENSITIVITY`, `NOISE_AMPLITUDE`, `TURN_THROTTLE_DOT`, `TURN_THROTTLE_MIN`, `STUCK_TIME`, `REVERSE_TIME`) are removed from AIController.js — their values live only in DEFAULT_PROFILE (imported from AIProfiles.js). `STUCK_THRESHOLD` (0.05 — the speed below which the AI considers itself stuck) remains as a module constant since it's a physics constant, not a personality trait. `stuckTime` and `reverseTime` are personality traits (how patient/twitchy the AI is about getting unstuck).

  **Patterns to follow:**
  - Vehicle.js `debug` object pattern — instance-level tunables that override defaults

  **Test scenarios:**
  - Happy path: with no profile (backward compat), behavior matches current constants exactly
  - Happy path: Aggressive profile produces steerInput values closer to ±1 than default on the same corner
  - Happy path: lateralOffset shifts the target position perpendicular to track direction
  - Happy path: boostEagerness false holds boost through corners (dot < 0.9) and fires on straights (dot > 0.9)
  - Edge case: lateralOffset is reduced in tight corners (dot product < 0.5)
  - Edge case: Drifter's high turnThrottleMin keeps speed through corners, indirectly triggering more drift

  **Verification:**
  - Running with DEFAULT_PROFILE produces identical AI behavior to the pre-change version
  - Running with Aggressive profile produces noticeably tighter cornering lines
  - The `{ x, z, touchActive, boost }` output shape is unchanged

- [x] **Unit 3: Wire personality assignment in AIManager and expose to debug**

  **Goal:** AIManager assigns personality profiles on spawn, stores them on racer structs, and exposes the profile name for debug visibility.

  **Requirements:** R2, R4

  **Dependencies:** Units 1, 2

  **Files:**
  - Modify: `js/AIManager.js`
  - Modify: `js/main.js` (debug menu — add AI personality display)

  **Approach:**

  **AIManager.js:**
  - Import `AI_PROFILES` from AIProfiles.js
  - In `_spawnAI(index)`: select profile via `AI_PROFILES[index % AI_PROFILES.length]`, pass to AIController constructor
  - Add `profile` field to the racer struct (alongside existing `controller`, `vehicle`, etc.)
  - In `getAIRaceData()`: include `profile.name` in the returned data for HUD/debug use

  **main.js (debug):**
  - In the AI Racers debug section (generalTab), add a read-only display of assigned personality names when AI count > 0

  **Patterns to follow:**
  - AIManager `_spawnAI` existing pattern for passing constructor args
  - Debug menu `addHeader` pattern for read-only display

  **Test scenarios:**
  - Happy path: spawning 4 AI gives each a different profile (Aggressive, Cautious, Drifter, Strategist)
  - Happy path: spawning 8 AI gives 2 of each profile
  - Happy path: rubber-banding still functions — externalTopSpeedMultiplier is set independently of profile
  - Edge case: spawning 1 AI assigns the first profile (index 0 % 4 = Aggressive)
  - Edge case: despawning then re-spawning cycles through profiles correctly
  - Integration: full race with 8 AI shows visibly different racing lines between profiles

  **Verification:**
  - `getAIRaceData()` includes profile names
  - Debug menu shows personality assignments
  - Watching a race, Aggressive AI cuts corners while Cautious AI takes wider lines

## System-Wide Impact

- **Interaction graph:** AIProfiles.js → AIManager._spawnAI → AIController constructor → AIController.update() → Vehicle.update(). No callbacks or event listeners added.
- **Error propagation:** If a profile has a missing property, the Object.assign merge with DEFAULT_PROFILE fills it. No error path needed.
- **State lifecycle risks:** None — profiles are immutable data assigned at spawn time. No runtime mutation.
- **API surface parity:** AIController constructor gains an optional third parameter. Existing callers (AIManager only) are updated. No external API change.
- **Unchanged invariants:** The `{ x, z, touchActive, boost }` input shape is unchanged. Vehicle.js is not modified. Rubber-banding via `externalTopSpeedMultiplier` continues to work independently. The SettingsMenu AI count and difficulty sliders are unaffected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| lateralOffset causes wall collisions on narrow tracks | Start with small offsets (0.6-1.0 world units vs cell half-size 4.995). Scale by forward-to-target dot product. |
| Aggressive profile is too fast / Cautious too slow, creating unfair races | Rubber-banding compensates for speed differences. Personality affects *style*, not *pace*. |
| Drifter AI triggers excessive drift particles (perf) | VFX systems already cull by distance. 8 AI with drift is within budget (tested in v0.20 code review). |
| Profile values need extensive playtesting to feel right | Defer final tuning to implementation. Start with directional values, iterate in-game. |

## Sources & References

- Origin: [docs/ideation/2026-04-01-v020-post-review-ideation.md#7](docs/ideation/2026-04-01-v020-post-review-ideation.md)
- Related code: `js/AIController.js`, `js/AIManager.js`, `js/TrackIntel.js`, `js/Vehicle.js`
- Related PR: #4 (code review fixes, includes AI segment hints and stuck-reversal improvements)
