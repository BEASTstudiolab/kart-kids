---
date: 2026-04-11
topic: track-editor-route-trace-ux
---

# Track Editor Route Trace UX — Overlay, Pause/Play, and Compass

## Problem Frame

The track editor already has the pieces needed to inspect a route: `Route Trace` can validate a loop and launch a chase camera, and the debug overlay can render the AI waypoint path. In practice, the workflow is hard to tune because the route path is hidden behind a separate debug toggle, the chase camera keeps orbiting while it moves, and the bottom-left compass is static even when the camera heading changes. This makes route inspection harder than it should be and makes the compass misleading once the camera rotates.

## Requirements

**Route Overlay Visibility**

- R1. When `Route Trace` is enabled in `track-editor.html`, the editor must automatically show the route path overlay in the viewport so the active route can be seen while tuning.
- R2. Route trace temporarily owns both `debugEnabled` and the `routePath` overlay toggle for the lifetime of an active trace session. It must snapshot the user's prior values when the trace starts and restore both values when the trace ends.
- R3. The route path overlay remains the existing green line plus waypoint dots generated from `TrackIntel`; this pass does not introduce per-track editable waypoint data.
- R4. Any debug-toggle changes made while route trace is active are treated as temporary trace-session state and are discarded when the trace stops in favor of the pre-trace snapshot.

**Route Trace Playback Controls**

- R5. While route trace is active, the viewport must show playback controls for `Pause` and `Play`.
- R6. `Pause` freezes the chase camera at its current route position without exiting route trace.
- R7. `Play` resumes the chase camera from the paused position instead of restarting the route.
- R8. Disabling route trace still stops playback entirely and dismisses the playback controls.
- R9. Route trace camera movement should follow the route progression without the extra automatic orbit spin currently applied during chase updates.

**Compass Accuracy**

- R10. The editor compass must reflect the current camera heading so north/east/south/west remain truthful when the camera orbit changes.
- R11. The compass keeps its existing viewport placement and role as a lightweight orientation aid; this pass corrects behavior rather than redesigning it into a larger widget.

## Success Criteria

- A user can click `Route Trace` and immediately see the route overlay in the 3D viewport without manually hunting for another toggle.
- A user can pause the route-trace camera, inspect a turn, and resume from the same point.
- The route-trace camera no longer circles the track with a continuous orbit while advancing along the route.
- The compass remains useful after manual camera orbit or route-trace movement because it updates with the current camera heading.
- Exiting route trace returns debug overlay visibility to the same baseline state the user had before the trace began.

## Scope Boundaries

- No manual drag-editing of waypoints or per-track waypoint save data
- No scrubber, stepping, speed controls, or dedicated cinematic camera UI in this pass
- No changes to runtime race camera behavior outside the editor
- No AI path-shape tuning in this pass; waypoint smoothing and AI cornering changes are a follow-up task

## Key Decisions

- **Route Trace owns temporary overlay visibility**: Route trace will temporarily ensure the route-path overlay is visible, then restore the prior debug state when finished. This keeps tuning friction low without permanently mutating a user's debug preferences.
- **Route Trace restores a full pre-trace snapshot**: The editor will snapshot both `debugEnabled` and `routePath` at trace start, treat any trace-session debug changes as ephemeral, and restore the snapshot when trace ends. This keeps route trace deterministic and avoids half-restored overlay state.
- **Pause/resume over restart-only control**: The immediate tuning need is to stop on a corner and continue from the same point, so the minimal control set is `Pause` and `Play`.
- **Remove chase orbit spin instead of compensating for it**: The current orbit drift is the main source of camera noise during tuning. Removing it is simpler and makes the route easier to inspect than trying to expose yet another toggle.
- **Compass stays lightweight**: The existing HUD placement works; the problem is stale heading, not size or styling.

## Dependencies / Assumptions

- `EditorApp` continues to own route-trace toggling and can coordinate debug overlay state for the duration of a trace session.
- `CameraController` is the correct place to store chase playback progress and expose pause/resume behavior.
- The existing compass element in `track-editor.html` can be updated from camera events without introducing a new rendering system.

## Relevant Code

- `js/track-editor/core/EditorApp.js` — route trace toggle lifecycle
- `js/track-editor/services/CameraController.js` — chase camera timing, playback state, and orbit behavior
- `js/track-editor/services/DebugOverlayService.js` — route-path overlay generation
- `track-editor.html` — current compass markup and viewport HUD structure

## Outstanding Questions

### Deferred to Planning

- [Affects R5-R8][Technical] Should the playback buttons live inside `track-editor.html` as persistent markup or be created by `EditorApp` only while route trace is active?
- [Affects R10][Technical] Should the compass rotate the ring, the directional labels, or a dedicated needle so the result stays legible with minimal CSS churn?

## Next Steps

-> `/ce:plan` for structured implementation planning
