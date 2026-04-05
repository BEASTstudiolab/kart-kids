# Starter Kit Racing

Port of the Kenney "Starter Kit Racing" Godot 4.6 project (in `_godot/`) to plain JavaScript and three.js with crashcat physics.

## Structure

- `_godot/` — Original Godot project (reference implementation)
- `js/` — JavaScript port
  - `main.js` — Entry point, scene setup, game loop
  - `Physics.js` — crashcat wall colliders and sphere body (ported from Godot collision shapes)
  - `Track.js` — GridMap track layout and piece placement
  - `Vehicle.js` — Vehicle physics and controls
  - `Camera.js` — Camera system
  - `Controls.js` — Input handling
  - `Particles.js` — Smoke trail effects
  - `Audio.js` — Sound
- `models/` — GLB models shared between both versions
- `audio/` — Audio assets
- `benchmark/` — Physics library benchmark (Rapier vs crashcat vs bounce)
- `sprites/` — Sprite assets

## Key conventions

- GridMap cell size: 10.0 units, scale: 1.0 (`CELL_RAW` and `GRID_SCALE` in `Track.js`)
- Tile naming: `trk-straight`, `trk-corner-1x1`, `trk-finish`, `trk-curve-NxN-l`, `trk-elev-*`, `trk-ramp-*`
- Track group at Y=0 (no offset), tiles placed at Y=0
- Vehicle models use `root_scale = 0.5`
- Wall colliders: friction 0.0, restitution 0.3, `WALL_X = 4.5` (inner face at 4.0 = road edge)
- Corner colliders: arc center at `(-CELL_HALF, +CELL_HALF)` in local space, outer wall radius `9.0`, inner radius `1.5`
- Multi-tile curve walls: `outerR = curveSize * CELL_RAW - 1.0`, `innerR = outerR - 7.5`
- Orientation mapping: `{ 0: 0°, 10: 180°, 16: 90°, 22: 270° }` (ORIENT_ENCODE/ORIENT_DECODE in Track.js)
- Vehicle collider: `vehPos`, `vehVel` (position/velocity), box halfExtents `[0.4, 0.3, 0.7]` at `vehPos.y + 0.8`

## Mobile testing

The dev server (`node server.js`) binds `0.0.0.0:3000` — accessible from any device on the same LAN.

1. Find your PC's local IP: run `ipconfig` and look for your WiFi adapter's IPv4 address
2. On your phone (same WiFi), navigate to `http://<your-ip>:3000`
3. For accelerometer/tilt steering (requires HTTPS): run `npx ngrok http 3000` and use the HTTPS URL on your phone

## Mobile controls architecture

- `Settings.js` — localStorage persistence for user preferences (handedness, accelerometer, graphics)
- `SettingsMenu.js` — Hamburger menu overlay (top-right) for graphics and controller settings
- `Controls.js` — Multi-touch input: horizontal 3-level joystick (steering), gas/brake/boost buttons, accelerometer, pinch-to-zoom
- Controls return `{ x, z, touchActive, boost, gas, brake }` — Vehicle.js uses unified steering+throttle model for all input sources
