# Kart Kids Racing Onboarding Guide

Kart Kids is a browser-based multiplayer kart racing game built with three.js and the [crashcat](https://github.com/nickyvanurk/crashcat) physics engine. It started as a port of the Kenney "Starter Kit Racing" Godot project (`_godot/`) and has evolved into its own game with a track editor, AI opponents, items, drafting, and mobile support. Two people collaborate on it: @calebsmiler (code) and @rafsby (3D models).

---

## User Experience

You open the game in a browser at `http://localhost:3000`. A loading screen shows while GLB models and textures load. Once ready, you're placed on a track with your kart and can drive immediately using keyboard (WASD/arrows) or mobile touch controls (virtual joystick + buttons). If a second player connects via WebSocket, a race countdown starts automatically.

The track editor (`/editor.html`) lets you paint tracks on a grid -- draw road, place corners, elevate sections, add ramps, tunnels, and bridges. Tracks save to `localStorage` and can be exported/imported as compact strings.

---

## How Is It Organized?

```
User / Browser
      |
      |  HTTP + WebSocket
      v
+---------------------+
|   Node.js Server    |
|   (server.js)       |
|   - Static files    |
|   - WS multiplayer  |
|   - Race state      |
+---------+-----------+
          |
          | WebSocket (20 Hz tick)
          v
+---------------------+
|  Browser Client     |
|  (three.js + ES     |
|   modules)          |
+---------------------+
```

### Directory Layout

```
kart-kids/
  server.js           # HTTP + WebSocket server
  index.html           # Game entry page
  editor.html          # Track editor entry page
  js/
    main.js            # Scene setup, game loop
    Vehicle.js         # Vehicle physics, controls
    Track.js           # GridMap layout, tile placement
    Physics.js         # Crashcat triangle mesh colliders
    Camera.js          # Chase camera system
    Controls.js        # Keyboard + mobile touch input
    Network.js         # WebSocket client
    PlayerManager.js   # Remote player rendering
    TrackIntel.js      # Track analysis (waypoints, AI)
    AIManager.js       # AI opponent logic
    HUD.js             # Heads-up display
    Minimap.js         # Minimap overlay
    editor/            # Editor ES modules
    ui/                # UI component system
    vehicle/           # Vehicle subsystems
  models/              # GLB vehicle + track models
  audio/               # Sound effects
  sprites/             # 2D sprite assets
  css/                 # Stylesheets
  _godot/              # Original Godot reference
  docs/                # Design docs and plans
```

### Key Modules

| Module | Responsibility |
|--------|---------------|
| `js/main.js` | Entry point -- scene, renderer, game loop, wires everything together |
| `js/Vehicle.js` | Kart physics: speed, drift, boost, bumps, ground raycast |
| `js/Track.js` | Decodes track data, places tile meshes on a 10-unit grid |
| `js/Physics.js` | Builds triangle mesh colliders from track geometry via crashcat |
| `js/Controls.js` | Unified input: keyboard, touch joystick, accelerometer |
| `js/Network.js` | WebSocket client for multiplayer state sync |
| `js/PlayerManager.js` | Spawns/removes remote player karts, interpolates positions |
| `js/TrackIntel.js` | Analyzes track for waypoints, lap detection, AI pathfinding |
| `js/AIManager.js` | Drives AI opponents along waypoints |
| `js/editor/` | Track editor: auto-tiling, elevation, curves, save/load |
| `js/ui/` | Reusable UI components, pages, theme system |
| `server.js` | Static file serving, WebSocket multiplayer relay, race countdown |

### External Dependencies

| Dependency | What it's used for | Configured via |
|-----------|-------------------|---------------|
| `three` (v0.183) | 3D rendering, scene graph, materials | `package.json` |
| `crashcat` (v0.0.3) | Physics: rigid bodies, triangle mesh colliders | `package.json` |
| `ws` (v8.x) | Server-side WebSocket for multiplayer | `package.json` |

No databases, no external APIs, no cloud services. The project is fully self-contained.

---

## Key Concepts and Abstractions

| Concept | What it means in this codebase |
|---------|-------------------------------|
| Cell | A single grid square in the track editor (10x10 units) |
| `CELL_RAW` / `GRID_SCALE` | Grid cell size (10.0) and scale factor (1.0) in `Track.js` |
| AutoTile | System that automatically picks the right tile mesh based on neighboring road cells |
| Orientation encoding | Rotation stored as `{ 0: 0deg, 10: 180deg, 16: 90deg, 22: 270deg }` |
| `vehPos` / `vehVel` | Vehicle position and velocity vectors -- the core physics state |
| Crashcat world | The physics simulation -- rigid bodies, colliders, broadphase layers |
| TrackIntel | Analyzes placed track into waypoints for AI pathfinding and lap counting |
| Tile naming | Prefixed `trk-` convention: `trk-straight`, `trk-corner-1x1`, `trk-elev-*` |
| Standard-map | The canonical tile set created by @rafsby with 47+ tile variants |
| Drafting | Speed bonus for driving close behind another kart |
| Quality tiers | `PRESETS` in `QualityTiers.js` -- graphics settings for mobile vs desktop |

---

## Primary Flows

### Racing Flow

```
Browser loads index.html
  |
  v
js/main.js
  creates three.js scene, renderer, lights
  |
  v
loadModels() (ModelLoader.js)
  loads GLB vehicle + track models
  |
  v
buildTrack() (Track.js)
  decodes TRACK_CELLS, places tile meshes
  |
  v
buildTrackColliders() (Physics.js)
  creates crashcat triangle mesh from geometry
  |
  v
Vehicle constructor
  creates rigid body, sets up controls
  |
  v
Game loop (requestAnimationFrame)
  1. Controls.update() -- read input
  2. Vehicle.update() -- physics step
  3. Camera.update() -- follow kart
  4. Network.sendState() -- broadcast position
  5. PlayerManager.update() -- interpolate others
  6. renderer.render()
```

### Track Editor Flow

1. Open `/editor.html` -- loads `js/editor/editor-main.js`
2. Click grid cells to place road tiles -- `Grid.js` calls `AutoTile.js` to resolve the right piece
3. `Elevation.js` handles height changes, `Curves.js` handles curved pieces
4. `Persistence.js` saves to `localStorage`, supports named saves and import/export
5. Tracks are encoded as compact cell arrays via `TrackCodec.js`

### Multiplayer Flow

1. Client connects via WebSocket to `server.js`
2. Server sends `welcome` with player ID, vehicle index, existing players
3. Client broadcasts `state` messages (position, rotation, velocity) each frame
4. Server relays world state at 20 Hz to all clients
5. When 2+ players connect, server starts a 3-second race countdown
6. `PlayerManager.js` renders remote karts with interpolation

---

## Developer Guide

### Setup

```
npm install
node server.js
```

The server starts at `http://localhost:3000`. No build step -- ES modules load directly via import maps in the HTML files.

### Mobile Testing

The server binds `0.0.0.0:3000`, so any device on the same LAN can connect. For accelerometer/tilt steering (requires HTTPS), run `npx ngrok http 3000` and use the HTTPS URL.

### Running Tests

```
node tests/run-tests.js
```

### Common Change Patterns

- **Add a new track tile**: Add the GLB model to `models/standard-map/`, register the tile name in `TrackModelConfig.js`, add autotile exit bitmasks in `js/editor/AutoTile.js`
- **Modify vehicle physics**: Edit `js/Vehicle.js` -- speed, drift, and boost constants are at the top of the class
- **Add a new UI screen**: Create a page in `js/ui/pages/`, register it in the UI routing system under `js/ui/core/`
- **Change track editor behavior**: The editor is modularized into `js/editor/` -- `AutoTile.js` for tile resolution, `Grid.js` for placement, `Elevation.js` for height

### Key Files to Start With

| Area | File | Why |
|------|------|-----|
| Game loop | `js/main.js` | Everything wires together here |
| Vehicle feel | `js/Vehicle.js` | Physics tuning, drift, boost |
| Track system | `js/Track.js` | How tiles become a 3D track |
| Physics | `js/Physics.js` | Crashcat collider setup |
| Multiplayer | `server.js` + `js/Network.js` | Server relay + client sync |
| Editor | `js/editor/editor-main.js` | Editor entry point |

### Practical Tips

- `Vehicle.js` is the largest file (~1500 lines). Most tuning constants are in the constructor or as class-level statics -- scan those before diving into the update loop.
- The orientation encoding (`0/10/16/22`) is non-obvious. See `ORIENT_ENCODE`/`ORIENT_DECODE` in `Track.js` -- these map Godot orientation values to degrees.
- Track colliders are pure triangle meshes built from the visual geometry. If a tile model changes, the collider changes automatically -- there are no separate collision meshes.
- The editor's autotile system (`AutoTile.js`) uses exit bitmasks to determine connectivity. If tiles aren't resolving correctly, check the bitmask definitions first.
