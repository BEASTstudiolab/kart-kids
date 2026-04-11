# Track Editor Route Trace UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make route-trace inspection in `track-editor.html` easier to tune by auto-showing the route overlay, adding pause/play controls, removing chase-camera orbit drift, and keeping the compass aligned with the live camera heading.

**Architecture:** Keep the viewport markup persistent in `track-editor.html`, but move behavior into focused JS units. Extend `CameraController` with pause/resume chase semantics and chase-time `camera:moved` emissions, add a `RouteTraceController` service to own the temporary debug-overlay snapshot plus playback UI state, and add a lightweight `CompassOverlay` helper that rotates a semantic compass rose from camera events. `EditorApp` stays the composition root and delegates route-trace behavior instead of owning the state machine inline.

**Tech Stack:** ES modules, Three.js editor services, HTML/CSS viewport overlays, `node:test` unit tests, targeted import smoke checks.

---

## File Structure

- Create: `js/track-editor/services/RouteTraceController.js`
  Route-trace session lifecycle, pre-trace debug snapshot/restore, and play/pause control state.
- Create: `js/track-editor/ui/CompassOverlay.js`
  Listens to `camera:moved` and rotates the compass rose to match camera heading.
- Create: `tests/track-editor-camera-controller.test.mjs`
  Verifies chase pause/resume behavior, no chase orbit drift, and `camera:moved` emissions during chase.
- Create: `tests/track-editor-route-trace-controller.test.mjs`
  Verifies debug snapshot ownership, temporary route-path forcing, and play/pause control state.
- Create: `tests/track-editor-overlay-markup.test.mjs`
  Verifies `track-editor.html` exposes the required route-trace controls and compass anchors.
- Create: `tests/track-editor-compass-overlay.test.mjs`
  Verifies compass rotation logic against emitted camera headings.
- Modify: `js/track-editor/services/CameraController.js`
  Add pause/resume APIs, chase timing state, and camera-moved emission during chase updates.
- Modify: `js/track-editor/core/EditorApp.js`
  Instantiate `RouteTraceController` and `CompassOverlay`, replace the inline route-trace state machine, and dispose helper subscriptions cleanly.
- Modify: `track-editor.html`
  Replace inline compass styles with semantic markup and add a persistent, initially hidden route-trace control overlay in the viewport.
- Modify: `css/track-editor.css`
  Style the new route-trace controls and semantic compass structure.

## Spec Reference

- Spec: `docs/brainstorms/2026-04-11-track-editor-route-trace-ux-requirements.md`

## Implementation Notes

- Preserve the current route-trace gate: only start chase playback when validation succeeds or the track has at least 4 tiles and the analyzed route has at least 4 sequence entries.
- Treat `debugEnabled` and `routePath` as a full pre-trace snapshot owned by route trace. Any debug changes made during an active trace are temporary and must be discarded when trace stops.
- Treat the overlay session and playback as separate concerns: enabling route trace always starts the temporary overlay session, while the validation/route gate only decides whether chase playback can run.
- Keep route-trace controls as persistent viewport markup in `track-editor.html` and toggle visibility/state from JS. This matches the minimap/stats overlay pattern and avoids ad-hoc DOM creation in `EditorApp`.
- Rotate the inner compass rose, not the whole overlay shell. The rose rotation should be derived from `-orbitAngle` in degrees so the default isometric view (`Math.PI / 4`) keeps the current `-45deg` appearance.

### Task 1: Add Chase Pause/Resume Semantics to `CameraController`

**Files:**
- Modify: `js/track-editor/services/CameraController.js`
- Test: `tests/track-editor-camera-controller.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../js/track-editor/core/EventBus.js';
import { CameraController } from '../js/track-editor/services/CameraController.js';

test( 'CameraController pauses and resumes chase without changing route progress', () => {
  let nowMs = 0;
  const bus = new EventBus();
  const canvas = { clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
  const camera = new CameraController( canvas, null, bus, () => nowMs );
  const route = [ { gx: 0, gz: 0 }, { gx: 0, gz: 1 }, { gx: 0, gz: 2 }, { gx: 0, gz: 3 } ];

  camera.chaseRoute( route, 1000 );
  nowMs = 500;
  camera.updateChase();
  const beforePause = camera.camera.position.clone();

  camera.pauseChase();
  nowMs = 900;
  camera.updateChase();
  const duringPause = camera.camera.position.clone();

  assert.deepEqual( duringPause.toArray(), beforePause.toArray() );

  camera.resumeChase();
  nowMs = 1200;
  camera.updateChase();
  assert.notDeepEqual( camera.camera.position.toArray(), duringPause.toArray() );
} );

test( 'CameraController does not drift orbit angle and emits camera:moved during chase updates', () => {
  let nowMs = 0;
  const bus = new EventBus();
  const events = [];
  const canvas = { clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
  const camera = new CameraController( canvas, null, bus, () => nowMs );
  const route = [ { gx: 0, gz: 0 }, { gx: 1, gz: 0 }, { gx: 2, gz: 0 }, { gx: 3, gz: 0 } ];
  const orbitBefore = camera._orbitAngle;

  bus.on( 'camera:moved', event => events.push( event ) );
  camera.chaseRoute( route, 1000 );
  nowMs = 250;
  camera.updateChase();

  assert.equal( camera._orbitAngle, orbitBefore );
  assert.ok( events.length >= 1 );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/track-editor-camera-controller.test.mjs`

Expected: FAIL because `pauseChase()` / `resumeChase()` do not exist yet, the constructor does not accept a test clock, `updateChase()` still mutates `_orbitAngle`, and chase updates do not emit `camera:moved`.

- [ ] **Step 3: Write the minimal implementation**

```js
constructor( canvas, scene, eventBus, nowFn = () => Date.now() ) {
  this._now = nowFn;
  this._chasePaused = false;
  this._chaseElapsedBeforePause = 0;
  this._chaseStartedAt = 0;
}

chaseRoute( sequence, speed = 300 ) {
  this._chaseSequence = sequence;
  this._chaseSpeed = speed;
  this._chaseStartedAt = this._now();
  this._chaseElapsedBeforePause = 0;
  this._chasePaused = false;
  this._chaseAnimating = true;
}

pauseChase() {
  if ( !this._chaseAnimating || this._chasePaused ) return;
  this._chaseElapsedBeforePause += this._now() - this._chaseStartedAt;
  this._chasePaused = true;
}

resumeChase() {
  if ( !this._chaseAnimating || !this._chasePaused ) return;
  this._chaseStartedAt = this._now();
  this._chasePaused = false;
}

updateChase() {
  if ( !this._chaseAnimating || this._chasePaused ) return;
  const elapsed = this._chaseElapsedBeforePause + ( this._now() - this._chaseStartedAt );
  // ... existing interpolation logic, but do not modify _orbitAngle
  this._updateCameraPosition();
  this._emitMoved();
}
```

Implementation details:
- Add `get isChasePaused()` so the route-trace controller can drive button state.
- Reset pause bookkeeping in `stopChase()`.
- If the chase loops back to the start, reset elapsed timing but keep `_orbitAngle` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/track-editor-camera-controller.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/track-editor-camera-controller.test.mjs js/track-editor/services/CameraController.js
git commit -m "feat: add pauseable editor chase camera"
```

### Task 2: Introduce a `RouteTraceController` for Trace-State Ownership

**Files:**
- Create: `js/track-editor/services/RouteTraceController.js`
- Modify: `js/track-editor/core/EditorApp.js`
- Test: `tests/track-editor-route-trace-controller.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { RouteTraceController } from '../js/track-editor/services/RouteTraceController.js';

function fakeButton() {
  const listeners = new Map();
  return {
    disabled: false,
    addEventListener( type, handler ) { listeners.set( type, handler ); },
    removeEventListener( type ) { listeners.delete( type ); },
    click() { listeners.get( 'click' )?.(); },
  };
}

test( 'RouteTraceController forces a temporary overlay session and restores the pre-trace snapshot on stop', () => {
  const state = { debugEnabled: false };
  const toggles = new Map( [ [ 'routePath', false ] ] );
  const debugOverlay = { getToggle: id => toggles.get( id ), setToggle: ( id, value ) => toggles.set( id, value ) };
  const validation = { validate: () => ( { valid: false, stats: { tileCount: 2 }, issues: [] } ) };
  const routeAnalysis = { analyzeRoute: () => ( { sequence: [] } ) };
  const camera = { chaseRouteCalled: 0, chaseRoute() { this.chaseRouteCalled++; }, stopChase() {}, pauseChase() {}, resumeChase() {}, get isChasePaused() { return false; } };
  const controls = { root: { hidden: true }, play: fakeButton(), pause: fakeButton() };

  const trace = new RouteTraceController( { state, debugOverlay, validation, routeAnalysis, camera, controls } );
  trace.toggle( {} );

  assert.equal( state.debugEnabled, true );
  assert.equal( toggles.get( 'routePath' ), true );
  assert.equal( camera.chaseRouteCalled, 0 );

  state.debugEnabled = false;
  toggles.set( 'routePath', false );

  trace.toggle( {} );

  assert.equal( state.debugEnabled, false );
  assert.equal( toggles.get( 'routePath' ), false );
} );

test( 'RouteTraceController updates play/pause controls from camera pause state', () => {
  const state = { debugEnabled: false };
  const toggles = new Map( [ [ 'routePath', false ] ] );
  const debugOverlay = { getToggle: id => toggles.get( id ), setToggle: ( id, value ) => toggles.set( id, value ) };
  const validation = { validate: () => ( { valid: true, stats: { tileCount: 8 }, issues: [] } ) };
  const routeAnalysis = { analyzeRoute: () => ( { sequence: [ { gx: 0, gz: 0 }, { gx: 0, gz: 1 }, { gx: 1, gz: 1 }, { gx: 1, gz: 0 } ] } ) };
  const camera = {
    paused: false,
    chaseRoute() {},
    stopChase() {},
    pauseChase() { this.paused = true; },
    resumeChase() { this.paused = false; },
    get isChasePaused() { return this.paused; },
  };
  const controls = { root: { hidden: true }, play: fakeButton(), pause: fakeButton() };

  const trace = new RouteTraceController( { state, debugOverlay, validation, routeAnalysis, camera, controls } );
  trace.toggle( {} );

  assert.equal( controls.root.hidden, false );
  assert.equal( controls.play.disabled, true );
  assert.equal( controls.pause.disabled, false );

  controls.pause.click();
  assert.equal( controls.play.disabled, false );
  assert.equal( controls.pause.disabled, true );

  controls.play.click();
  assert.equal( controls.play.disabled, true );
  assert.equal( controls.pause.disabled, false );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/track-editor-route-trace-controller.test.mjs`

Expected: FAIL because `RouteTraceController` does not exist yet and no route-trace state snapshot behavior is implemented.

- [ ] **Step 3: Write the minimal implementation**

```js
export class RouteTraceController {
  constructor( { state, debugOverlay, validation, routeAnalysis, camera, controls } ) {
    this._state = state;
    this._debugOverlay = debugOverlay;
    this._validation = validation;
    this._routeAnalysis = routeAnalysis;
    this._camera = camera;
    this._controls = controls;
    this._active = false;
    this._playbackAvailable = false;
    this._snapshot = null;
    this._bindControls();
    this._syncControls();
  }

  get isActive() {
    return this._active;
  }

  _bindControls() {
    this._onPlay = () => this.play();
    this._onPause = () => this.pause();
    this._controls.play.addEventListener( 'click', this._onPlay );
    this._controls.pause.addEventListener( 'click', this._onPause );
  }

  toggle( gameplayMode ) {
    return this._active ? this.stop() : this.start( gameplayMode );
  }

  start( gameplayMode ) {
    this._snapshot = {
      debugEnabled: this._state.debugEnabled,
      routePath: this._debugOverlay.getToggle( 'routePath' ),
    };

    this._state.debugEnabled = true;
    this._debugOverlay.setToggle( 'routePath', true );
    this._active = true;
    this._playbackAvailable = false;

    const result = this._validation.validate( gameplayMode );
    const route = this._routeAnalysis.analyzeRoute();
    if ( ( result.valid || result.stats.tileCount >= 4 ) && route.sequence.length >= 4 ) {
      this._camera.chaseRoute( route.sequence, 400 );
      this._playbackAvailable = true;
    }

    this._syncControls();
    return this._playbackAvailable;
  }

  stop() {
    this._camera.stopChase();
    this._state.debugEnabled = this._snapshot.debugEnabled;
    this._debugOverlay.setToggle( 'routePath', this._snapshot.routePath );
    this._active = false;
    this._playbackAvailable = false;
    this._snapshot = null;
    this._syncControls();
  }

  dispose() {
    this._controls.play.removeEventListener( 'click', this._onPlay );
    this._controls.pause.removeEventListener( 'click', this._onPause );
  }
}
```

Implementation details:
- Add `pause()` and `play()` methods that delegate to `camera.pauseChase()` / `camera.resumeChase()`.
- Show the controls whenever route trace is active; disable both buttons when playback is unavailable, otherwise keep the inactive button disabled rather than removing both buttons.
- Preserve current console logging in `EditorApp`, but move the state mutation and chase start/stop logic into the controller.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/track-editor-route-trace-controller.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/track-editor-route-trace-controller.test.mjs js/track-editor/services/RouteTraceController.js js/track-editor/core/EditorApp.js
git commit -m "feat: add editor route trace controller"
```

### Task 3: Add a Rotating `CompassOverlay` Helper

**Files:**
- Create: `js/track-editor/ui/CompassOverlay.js`
- Modify: `js/track-editor/core/EditorApp.js`
- Test: `tests/track-editor-compass-overlay.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../js/track-editor/core/EventBus.js';
import { CompassOverlay } from '../js/track-editor/ui/CompassOverlay.js';

test( 'CompassOverlay rotates the rose to match camera orbit heading', () => {
  const bus = new EventBus();
  const rose = { style: { transform: '' } };
  const compass = new CompassOverlay( { eventBus: bus, roseEl: rose } );

  bus.emit( 'camera:moved', { orbitAngle: Math.PI / 4 } );
  assert.equal( rose.style.transform, 'rotate(-45deg)' );

  bus.emit( 'camera:moved', { orbitAngle: 0 } );
  assert.equal( rose.style.transform, 'rotate(0deg)' );

  compass.dispose();
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/track-editor-compass-overlay.test.mjs`

Expected: FAIL because `CompassOverlay` does not exist yet and no compass sync logic is wired to camera events.

- [ ] **Step 3: Write the minimal implementation**

```js
export class CompassOverlay {
  constructor( { eventBus, roseEl } ) {
    this._roseEl = roseEl;
    this._off = eventBus.on( 'camera:moved', ( { orbitAngle = 0 } = {} ) => {
      const deg = Math.round( -orbitAngle * 180 / Math.PI );
      this._roseEl.style.transform = `rotate(${ deg }deg)`;
    } );
  }

  dispose() {
    this._off?.();
  }
}
```

Implementation details:
- Keep the helper deliberately dumb: it only rotates the inner rose and unsubscribes on dispose.
- Let CSS own the outer shell, colors, and labels.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/track-editor-compass-overlay.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/track-editor-compass-overlay.test.mjs js/track-editor/ui/CompassOverlay.js js/track-editor/core/EditorApp.js
git commit -m "feat: sync editor compass with camera heading"
```

### Task 4: Wire Persistent Viewport Markup and Editor Composition

**Files:**
- Modify: `track-editor.html`
- Modify: `css/track-editor.css`
- Modify: `js/track-editor/core/EditorApp.js`
- Test: `tests/track-editor-overlay-markup.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test( 'track-editor.html exposes route trace controls and a compass rose anchor', () => {
  const html = readFileSync( new URL( '../track-editor.html', import.meta.url ), 'utf8' );
  assert.match( html, /id="editor-route-trace-controls"/ );
  assert.match( html, /id="route-trace-play"/ );
  assert.match( html, /id="route-trace-pause"/ );
  assert.match( html, /data-role="compass-rose"/ );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/track-editor-overlay-markup.test.mjs`

Expected: FAIL because the viewport currently has inline compass markup only and no route-trace playback controls.

- [ ] **Step 3: Write the minimal implementation**

```html
<div class="kk-editor-route-trace" id="editor-route-trace-controls" hidden>
  <button class="kk-editor-route-trace__btn" id="route-trace-play" type="button">Play</button>
  <button class="kk-editor-route-trace__btn" id="route-trace-pause" type="button">Pause</button>
</div>

<div class="kk-editor-compass" id="editor-compass" aria-hidden="true">
  <div class="kk-editor-compass__shell">
    <div class="kk-editor-compass__rose" data-role="compass-rose">
      <!-- N/E/S/W labels, crosshair, and north marker -->
    </div>
  </div>
</div>
```

```js
// EditorApp init
const routeTraceControls = {
  root: document.getElementById( 'editor-route-trace-controls' ),
  play: document.getElementById( 'route-trace-play' ),
  pause: document.getElementById( 'route-trace-pause' ),
};

this._routeTrace = new RouteTraceController( {
  state: this._state,
  debugOverlay: this._debugOverlay,
  validation: this._validation,
  routeAnalysis: this._routeAnalysis,
  camera: this._camera,
  controls: routeTraceControls,
} );

this._compassOverlay = new CompassOverlay( {
  eventBus: this._eventBus,
  roseEl: document.querySelector( '[data-role="compass-rose"]' ),
} );
```

Implementation details:
- Remove the inline styles from the old compass block and move them into `css/track-editor.css`.
- Put the route-trace controls near the bottom center of the viewport so they do not collide with the minimap or stats panel.
- Replace `_toggleRouteTrace()` in `EditorApp` with delegation to `this._routeTrace.toggle( this._input._modes.get( 'gameplay' ) )`.
- Update `_updateToolRailActive()` to use `this._routeTrace?.isActive` instead of a standalone `_routeTraceActive` flag.
- In `dispose()`, call both `this._routeTrace?.dispose()` and `this._compassOverlay?.dispose()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/track-editor-overlay-markup.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add track-editor.html css/track-editor.css js/track-editor/core/EditorApp.js tests/track-editor-overlay-markup.test.mjs
git commit -m "feat: add editor route trace overlay controls"
```

### Task 5: Final Verification and Smoke Check

**Files:**
- Verify only

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
node --test tests/track-editor-camera-controller.test.mjs tests/track-editor-route-trace-controller.test.mjs tests/track-editor-compass-overlay.test.mjs tests/track-editor-overlay-markup.test.mjs
```

Expected: PASS for all four files

- [ ] **Step 2: Run an import smoke check on the changed editor modules**

Run:

```bash
node --input-type=module -e "await Promise.all([import('./js/track-editor/services/CameraController.js'), import('./js/track-editor/services/RouteTraceController.js'), import('./js/track-editor/ui/CompassOverlay.js')]); console.log('imports ok');"
```

Expected: `imports ok`

- [ ] **Step 3: Manual editor verification in `track-editor.html`**

Checklist:
- Open `track-editor.html`
- Build or load a loop with a valid route
- Click `Route Trace`
- Confirm the green route path overlay appears immediately in the viewport
- Confirm `Pause` freezes the chase camera in place
- Confirm `Play` resumes from the same route position
- Confirm the chase camera no longer slowly circles/orbits while progressing
- Stop route trace and confirm debug overlay visibility returns to its pre-trace baseline
- Orbit the camera manually and confirm the compass rotates with heading

- [ ] **Step 4: Commit the finished slice**

```bash
git add track-editor.html css/track-editor.css js/track-editor/core/EditorApp.js js/track-editor/services/CameraController.js js/track-editor/services/RouteTraceController.js js/track-editor/ui/CompassOverlay.js tests/track-editor-camera-controller.test.mjs tests/track-editor-route-trace-controller.test.mjs tests/track-editor-compass-overlay.test.mjs tests/track-editor-overlay-markup.test.mjs
git commit -m "feat: improve editor route trace tuning UX"
```
