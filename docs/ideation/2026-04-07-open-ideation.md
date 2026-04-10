---
date: 2026-04-07
topic: open-ideation
focus: open-ended improvement ideas
---

# Ideation: Kart Kids Open Improvements

## Codebase Context

Browser-based multiplayer kart racing game built with three.js + crashcat physics. 50+ JS modules, no bundler. Two collaborators (@calebsmiler code, @rafsby 3D models). Features include: AI opponents, drafting, items, boost/drift, track editor with autotile, multiplayer via WebSocket relay at 20Hz. Known debt: editor-main.js still 2387 lines, main.js init() is a 1027-line monolith, TrackIntel doesn't support junction tiles.

## Ranked Ideas

### 1. Track Sharing via URL-Encoded Binary Codec
**Description:** Wire TrackCodec.js encodeCells output into a base64 URL fragment. Add a "Copy Link" button in the editor. A 50-cell track = ~270 chars base64, well within URL limits. Use hash fragment (#map=...) to avoid server logs and URL length issues.
**Rationale:** Highest-leverage feature for organic growth. The codec, URL param parsing, and editor UI all exist -- this is ~30 lines of plumbing. Every shared link is a player acquisition channel with zero infrastructure cost.
**Downsides:** Large tracks (200+ cells) may approach URL limits even with fragments. No preview/thumbnail when sharing.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 2. Ghost Replay System via Input Recording
**Description:** Record per-frame {x, z, boost, drift, gas, brake} inputs (already the Controls.update() return shape) plus dt values. Replay by feeding recorded inputs into a second Vehicle instance rendered as translucent. Store replays as compact typed arrays.
**Rationale:** Ghost laps make time trials meaningful. Also serves as physics regression testing -- replay a known-good ghost after Vehicle.js changes to verify nothing broke. The clean input->physics pipeline makes this straightforward.
**Downsides:** Requires deterministic physics (crashcat must produce identical results given identical inputs and dt). Replay files grow linearly with race duration.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 3. Editor Live-Play: Test Drive Without Leaving
**Description:** Add a "Play" button in the editor that spawns a Vehicle + Physics world directly in the editor's three.js scene. The editor already has placed tile models -- just needs a collider build, a vehicle, and input wiring. Tear down on exit.
**Rationale:** The edit-save-switch-tab-load-test cycle is the #1 friction point for track creation. Each iteration requires full game load including a 3-second multiplayer timeout.
**Downsides:** Editor scene would need lighting/camera adjustments for gameplay. Physics teardown must be clean to avoid leaks. Adds complexity to already-large editor-main.js.
**Confidence:** 65%
**Complexity:** High
**Status:** Unexplored

### 4. Vehicle-Local Shadow Frustum
**Description:** The shadow camera covers the entire track extent (main.js:209-213). Switch to a tight frustum (~20-30 unit radius) that follows the vehicle. The dirLight already follows the vehicle every frame (main.js:868-877) -- the shadow camera bounds just never update.
**Rationale:** ~10 lines of code for a massive visual quality improvement on large custom tracks. The 2048x2048 shadow map spread over a 200-unit track gives 4x worse texel density than needed. A vehicle-local frustum makes even the 512px "low" tier look good.
**Downsides:** Shadows will pop at the frustum edge. Spectator mode (wide camera) would need a larger radius.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 5. Delete Orphaned Vehicle GLB Files
**Description:** models/ contains vehicle-truck-green.glb, vehicle-truck-purple.glb, vehicle-truck-red.glb. ModelLoader.js derives all color variants programmatically from the yellow base via VEHICLE_TINTS. These 3 GLBs are never loaded.
**Rationale:** Dead weight in the repo. Aligns with storage sensitivity and the existing atlas compression work (dc42d69).
**Downsides:** None if verified that no other code path loads them.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 6. Adaptive Quality Tier with FPS Feedback Loop
**Description:** QualityTiers.js detects device once at startup via GPU string matching. Wire the existing FPS counter (main.js:719-724) into a governor that drops shadow/pixel-ratio/post-processing when FPS < 45 for 3+ seconds.
**Rationale:** The static detection is fragile (WEBGL_debug_renderer_info blocked in many browsers). The runtime preset-switching pipeline already works (main.js:567-585). A feedback loop eliminates the classification problem.
**Downsides:** Players may notice quality flickering during transient load spikes. Needs hysteresis to prevent oscillation.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

### 7. TrackIntel Junction/Branching Support
**Description:** TrackIntel walks connectivity linearly and fails on junction tiles (y, t, 4way). Build graph-based pathfinding that handles branching, enabling figure-8 tracks, alternate routes, and shortcuts.
**Rationale:** The editor lets you place junctions but AI and race positions break on them. This is a hard ceiling on track design creativity. The 47-tile standard map set includes 3 junction variants that are currently unusable in races.
**Downsides:** Significant complexity increase in TrackIntel. Race position ranking on branching tracks is a non-trivial problem. AI pathfinding needs shortest-path selection.
**Confidence:** 60%
**Complexity:** High
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Server-authoritative physics | Too expensive; crashcat WASM not proven server-side |
| 2 | WebRTC peer-to-peer | Massive complexity for 2-person team |
| 3 | Server ELO/MMR ranking | Requires persistence infrastructure; premature |
| 4 | Pre-baked collision meshes | Micro-optimization; default track not a bottleneck |
| 5 | Spatial audio overhaul | PassByAudio works; low leverage vs effort |
| 6 | PWA/offline-first | Game needs internet for multiplayer |
| 7 | Progressive LOD loading | Atlas compression already solved the big problem |
| 8 | TrackCodec v4 encoding | Not at practical capacity; curves use flags |
| 9 | VFX bundle unification | Moderate refactor, moderate value |
| 10 | Hot-reload dev server | Project deliberately avoids build tooling |
| 11 | editor-main.js modularization phase 2 | Large effort, not highest-leverage next step |
| 12 | main.js GameSession extraction | Large refactor, deserves dedicated project |
| 13 | Vehicle tuning data-driven specs | Depends on unbuilt garage UI; premature |
| 14 | TrackIntel waypoint perf optimization | Not a real bottleneck at current track sizes |

### 8. Fixed Timestep Physics Loop
**Description:** Decouple physics simulation from render FPS. Implement a time accumulator: if render is 30fps, physics runs twice per frame at 60Hz; if 144fps, physics runs once per ~2 renders. Currently `updateWorld(dt)` runs once per `requestAnimationFrame` with variable dt.
**Rationale:** Vehicle drifting and lap times are non-deterministic across frame rates. Same track, different device = different physics behavior. Fixed timestep makes physics deterministic — critical for fair multiplayer and ghost replay.
**Downsides:** Adds complexity to main loop. Requires careful interpolation for smooth rendering between physics ticks.
**Confidence:** 75%
**Complexity:** High
**Status:** Unexplored

### 9. Editor Pre-Save Track Validation
**Description:** Before saving, walk the track using TrackIntel connectivity logic. If the walk fails (gaps, missing finish), show a warning with the broken cells highlighted. Auto-save last valid grid separately for recovery.
**Rationale:** Creators spend time building tracks, accidentally break connectivity, save, and the game crashes. A pre-save validation + recovery system prevents lost work and guides users to fix issues.
**Downsides:** Validation adds save latency. Warning UI needed in editor.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 10. Lap/Finish Line Crossing State Machine
**Description:** Replace the 2-second cooldown in FinishLine.js with a proper per-vehicle state machine (started → valid-crossing → cooldown → ready). Detect and reject backward/sideways finish crosses. Prevent lap double-counting from network lag.
**Rationale:** Current cooldown-based approach has edge cases: zigzag crossing, backward crossing, network duplicate events. A state machine ensures each lap counts exactly once per forward crossing.
**Downsides:** More complex than current cooldown. Needs testing with all track layouts.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 11. Remote Vehicle Snap Threshold
**Description:** Add a max-distance threshold in VehicleRemoteSync. If correction distance exceeds threshold (e.g. 5m), snap position instantly instead of lerping. Prevents "ghost skating" where remote karts slide across the track after latency spikes.
**Rationale:** Multiplayer races with packet loss cause visible rubber-banding. Players perceive it as opponent cheating. A snap threshold makes teleports instant and clean instead of slow and jarring.
**Downsides:** Sudden snaps may look jarring at lower thresholds. Needs tuning.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 12. Steering Assist Waypoint Stale-Hint Recovery
**Description:** Reset `_assistWaypointHint` in Vehicle.js when the vehicle goes airborne, respawns, or exceeds a distance threshold from the expected waypoint. Currently a stale hint after jumps causes steering assist to lock to the wrong direction.
**Rationale:** Off-track jumps break steering assist completely, punishing exploration. The drafting cone also disappears when cars desync from waypoint hints.
**Downsides:** Hint reset causes brief re-search (O(n) over waypoints) but n is small.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary (Session 3 additions)

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 14 | Touch input debouncing | Low evidence of actual bug in practice |
| 15 | Collision mesh separation | Premature — no decorative sub-meshes exist yet |
| 16 | AI stuck oscillation detection | Narrow edge case, low impact |
| 17 | Server-authoritative lap validation | No server architecture exists |
| 18 | Remote drift state sync for spectating | Spectating not a priority feature |
| 19 | Item box multiplayer sync | No server architecture |
| 20 | Accelerometer calibration UI | Already has settings; narrow scope |
| 21 | Spectating → replay pipeline | Overlaps ghost-replay PR #42 |
| 22 | Quality tiers feature gating | Overlaps adaptive-quality PR #39 |
| 23 | Settings telemetry foundation | No server infrastructure |
| 24 | Contact handler → collision event system | Architecture refactor, low immediate value |
| 25 | Input queue buffering | Over-engineered; adaptive quality addresses frame drops |
| 26 | Track bounds caching in TrackIntel | Micro-optimization |
| 27 | IndexedDB settings backup | Over-engineered for localStorage |
| 28 | Network state buffer with sequences | Valuable but Complex; deferred |
| 29 | Network reconnection handler | Valuable but Complex; deferred |

### 13. AudioContext Resume on Tab Re-Focus
**Description:** Add a `visibilitychange` listener in Audio.js that calls `ctx.resume()` when the tab regains focus and the AudioContext is suspended. The existing unlock handler fires once and self-removes, so subsequent suspensions (common on iOS/Safari tab switch) permanently kill audio.
**Rationale:** iOS/Safari suspend AudioContext when tab loses focus. Without a resume listener, mobile users permanently lose all game audio until page reload.
**Downsides:** None significant. Resume is a no-op if context is already running.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 14. PassByAudio Route Through SFX Gain Node
**Description:** Pass the `_sfxGain` AudioNode from GameAudio into PassByAudio constructor. Change `panner.connect(ctx.destination)` to `panner.connect(sfxGain)`. Currently pass-by whooshes bypass the SFX volume control entirely.
**Rationale:** User volume settings don't affect an entire category of sound effects. Players who turn down SFX still hear full-volume whooshes.
**Downsides:** Requires minor API change (PassByAudio constructor gets an extra parameter).
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 15. Controls touchActive Stuck on Drift Release
**Description:** In Controls.js, `touchActive` is set `true` when any touch control activates but the `false` path in `endSteer` doesn't check drift state. If drift is held while steering is released, then drift is released, `touchActive` remains `true` permanently until another steer touch.
**Rationale:** Stuck `touchActive` affects vehicle behavior — the vehicle continues receiving "touch is active" signal which may override keyboard input detection.
**Downsides:** Need to verify that adding drift check doesn't break the intended behavior of other input combinations.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 16. Controls Pinch-to-Zoom Stale Pointers on Visibility Change
**Description:** Add a `visibilitychange` listener that clears `_activePointers` map when the page loses visibility. Currently, if the user switches tabs mid-touch, `pointerup`/`pointercancel` events may not fire, leaving phantom pointer entries that cause false pinch gestures on return.
**Rationale:** Mobile users frequently multitask. Stale pointers cause unexpected zoom behavior when returning to the game.
**Downsides:** Clears pinch state aggressively; user would need to re-pinch after tab switch.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 17. Audio Loader Error Callbacks
**Description:** Add error callback parameters to the three `loader.load()` calls in Audio.js for engine.ogg, skid.ogg, and impact.ogg. On failure, log a warning and set `this.ready = true` so the game isn't blocked, but mark the failed sounds as unavailable.
**Rationale:** If audio files fail to load (404, network error, decode error), the game silently runs with no audio and no error feedback. `checkReady()` never resolves.
**Downsides:** Game runs with partial audio, which may be confusing. But it's better than hanging.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 18. NotificationService Toast ID Deduplication
**Description:** In NotificationService.show(), check `_toasts.has(id)` before creating a new toast. If a toast with the same id exists, dismiss it first or return the existing entry. Currently, duplicate IDs overwrite the Map entry, orphaning the first toast's DOM element and timer.
**Rationale:** Repeated rapid notifications (e.g., settings changes, network status) can orphan DOM nodes and active timers.
**Downsides:** Auto-dismissing may hide intentionally refreshed notifications. Early-return may prevent content updates.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 19. Accelerometer Permission Failure UX
**Description:** When `_requestAccelPermission()` returns false in Controls.js, revert the accelerometer setting and show a toast explaining the permission was denied. Currently the setting shows enabled but no steering input is received.
**Rationale:** iOS users who deny the DeviceOrientation permission get stuck with no steering and no feedback about why.
**Downsides:** Requires toast system dependency in Controls.js, or emitting a custom event for the UI layer to handle.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary (Session 4 additions)

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 30 | PostProcessing WebGL context loss handler | Standard complexity, needs careful design and testing |
| 31 | PostProcessing shader compilation fallback | Complex GPU interaction, hard to test |
| 32 | Controls.js full dispose() method | Broad refactor, not highest leverage now |
| 33 | Editor event listener teardown | Standalone page mitigates the issue |
| 34 | Steering dead zone smoothing | Requires UX testing and tuning |
| 35 | NotificationService transitionend/setTimeout double-fire | Low impact, defensive only |
| 36 | Oscillator node disconnect after stop | Modern browsers handle this; low impact |
| 37 | Draft wind noise buffer cache | Low impact, Audio.js creates once at startup |
| 38 | NotificationService singleton enforcement | Low impact, only one instance in practice |
| 39 | SSAO pass size on late resize | Narrow timing window, low impact |

## Session Log
- 2026-04-07: Initial ideation — 31 candidates generated across 4 frames, 7 survived adversarial filtering
- 2026-04-07: Session 3 ideation — 28 candidates generated across 4 frames, 5 new survivors added (ideas 8-12)
- 2026-04-07: Session 4 ideation — 45 candidates across 5 focus areas, 7 new survivors added (ideas 13-19)
