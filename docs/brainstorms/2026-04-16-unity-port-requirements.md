---
date: 2026-04-16
topic: unity-port
---

# Unity Port of Starter Kit Racing

## Problem Frame

The game currently ships as a three.js/JS web build (116k LOC, ~85 modules, ~20 UI pages, ~150 tests) with custom crashcat physics, GridMap track editor, AI combat, multiplayer lobby, ghost replay, and a marginal-design UI system. Shipping to Steam and consoles is the commercial goal, and Unity is the chosen vehicle because it offers the most mature path to console certification, platform SDKs, and eventual Switch/PS5/Xbox parity. With v1 including full parity, multiplayer, server-backed live-ops, and console-ready architecture, this is an **8-12 month commitment for a 2-4 person team**, but unlocks the only platforms where the game can sustain a commercial release.

## Requirements

**Scope and Parity**

- R1. Unity v1 ships full feature parity with the current JS build: all vehicles, all tracks, AI racing + combat, track editor, HUD, character select, multiplayer (RaceLobby + in-race network), ghost replay, and the marginal-design UI page suite.
- R2. Architecture is console-ready from day one: gamepad-first input, platform abstraction for saves/achievements/leaderboards, perf budget sized for Switch (even though Switch does not ship in v1), and UI that works at controller-first focus navigation.
- R3. v1 ships on Steam (Windows, Mac, Linux via Steamworks). Switch/PS5/Xbox are explicit post-v1 port targets and must remain viable but do not block v1.

**Gameplay and Feel**

- R4. Vehicle handling is treated as a redesign opportunity, not a 1:1 port of the current crashcat feel. The Unity build is allowed — and expected — to diverge from current arcade handling if that produces a better game. A feel-tuning phase is part of v1, not a polish pass bolted on.
- R5. AI (waypoint following, combat behaviors, traffic cornering, draft lines) preserves the current behavior contracts, even as the physics substrate changes. Tuning values may shift, but AI "personality" must survive the port.
- R6. Track data format is portable: existing GridMap cell data, orientation encoding (0/10/16/22 → 0°/180°/90°/270°), elevation v2, tile metadata, and user-saved tracks must load in Unity. Track editor must produce files the Unity runtime accepts without conversion.

**Content and Assets**

- R7. GLB/glTF models from `models/` are the source of truth; Unity imports them directly (or via a one-time conversion pipeline if blend-shape damage requires FBX). Rafsby's model pipeline stays unchanged.
- R8. Vehicle damage blendshapes/morph targets drive the same quadrant damage behavior in Unity that VehicleHealth.js drives today.

**UI and Design Language**

- R9. The marginal-design editorial language (balaclava thumbnails, editorial cards, HUD styling) ports forward conceptually. Exact fidelity to the current CSS is not required — the Unity UI should feel like the same game but may be rebuilt idiomatically.
- R10. All 20+ pages in the current menu shell (home, quick-play, party, lobby, character select, track editor, profile, season, challenges, shop, inbox, pause, settings, tutorial, marginal-velocity) have Unity equivalents in v1.

**Multiplayer**

- R13. Multiplayer ships with v1: room-based lobby, in-race state sync, rollback/reconciliation appropriate for arcade kart pacing, and parity with current RaceLobby flows. Networking transport may differ from JS (expected), but player-facing MP behavior matches.

**Live-Service Backend**

- R14. Season, challenges, shop, and inbox are server-backed in v1. Season progress, challenge telemetry, shop inventory, and inbox messages are persisted and configurable remotely without a client patch.
- R15. A backend exists and is operated as part of this project: hosted service (Firebase / Supabase / custom), remote config pipeline, basic live-ops tooling (author a challenge, push an inbox message, update shop inventory), and ops monitoring. This is net-new infrastructure, not a port.
- R16. Monetization surfaces (shop purchases, season pass) are wired to a real payment provider for Steam v1 (Steamworks microtransactions or equivalent). No predatory mechanics — respect existing project values (no loot-box economy).

**Process**

- R11. The current JS/three.js build is frozen at the start of the Unity rewrite. No new features, no content updates, bug-fix-only if at all. All team capacity routes to Unity.
- R12. The Godot reference project in `_godot/` remains a reference only — not a porting source. Tile authoring, physics, and AI are re-authored in Unity.

## Success Criteria

- Unity build reaches feature parity with the frozen JS build on all systems listed in R1.
- Vehicle feel is validated by playtesters as "at least as good as" the current JS build, and ideally better, before v1 ship.
- Multiplayer races are stable end-to-end for 8 players at < 150ms RTT with no desync complaints in playtest.
- Live-service backend is operational: a designer can push a new challenge or inbox message without a client patch, and it appears for players within minutes.
- A Steam build passes Valve's cert/review and ships to Early Access or full release.
- Architecture review confirms that a Switch port could be started in under 1 month of additional work (no fundamental blockers from rendering, input, saves, or UI).
- Rafsby can deliver new vehicles and tracks into Unity using a pipeline as fast as (or faster than) the current JS workflow.

## Scope Boundaries

- Not shipping Switch, PS5, or Xbox in v1. Those are follow-on port targets.
- Not keeping the JS build alive during the port. No dual-track maintenance.
- Not porting the Godot `_godot/` project — Unity is re-authored from scratch with JS as the behavioral reference.
- Not matching current vehicle handling 1:1. Feel is allowed to evolve.
- Not shipping new gameplay features that don't exist in the frozen JS build. v1 = parity + console-ready, not parity + new systems.
- Not building the track editor as a runtime in-game tool on consoles for v1 (PC only); console editor is a stretch goal.
- Not using DOTS/ECS. Stick to standard MonoBehaviour + Prefab architecture unless a specific system demands DOTS.

## Key Decisions

- **Unity over Godot or Electron wrap**: User explicitly chose Unity because console certification and platform SDK maturity matter for the commercial plan. Godot's console story (via W4 Games) and an Electron Steam wrap were considered and rejected.
- **Full parity + console-ready, Steam-only v1**: User wants the architecture to support consoles later but does not want Switch/PS5/Xbox cert work gating the v1 ship.
- **Freeze the JS build**: User chose all-in over parallel maintenance. Accepts the risk of zero player-facing progress during the port.
- **Vehicle feel is open for redesign**: User sees Unity as a chance to improve handling, not just transcribe it.
- **Small team (2-4 devs)**: Estimate assumes parallel work on physics, UI, AI, networking, and backend. Solo would roughly double the timeline.
- **Multiplayer ships in v1**: MP is considered core to the game's pitch, not a post-launch addition. Drives networking stack choice and dedicates ~6-8 weeks of team capacity.
- **Server-backed live-service in v1**: Season/challenges/shop/inbox are real systems, not stubs. Adds backend infrastructure as a net-new discipline plus ongoing ops cost. Adds ~8-10 weeks to v1.
- **No hard deadline**: Ship when quality bar is met. Target ~8-12 months, but will slip rather than cut scope on parity, MP, or live-ops.

## Dependencies / Assumptions

- Assumed team size: 2-4 Unity-capable developers including the user. Rafsby continues on model/asset authoring. At least one team member has backend/live-ops experience, or a contractor is brought in for it.
- Assumed timeline: ~8-12 months to Steam ship with the stated scope and team. Solo would be infeasible at this scope.
- Assumed Unity LTS version is used (latest 2026 LTS at project start); not bleeding-edge Unity 7.
- Assumed Steamworks partner status is (or will be) in place before v1 code freeze, including Steam microtransaction onboarding for R16.
- Assumed a hosting budget exists for the live-service backend (serverless-tier or equivalent, ~low hundreds/month at launch scale).
- Assumed current JS build's multiplayer (Network.js, RaceLobby) is the functional reference; its exact transport can change in Unity.

## Alternatives Considered

- **Electron/Tauri wrap of existing JS build**: Fastest path to Steam (~2 weeks), preserves all work, but no console path and web perf ceiling persists. Rejected — Steam-only ship doesn't satisfy the console goal.
- **Resume Godot port in `_godot/`**: Roughly half the rewrite cost of Unity since GridMap and Kenney physics transfer directly; ships Steam natively; consoles via W4 Games. Rejected — console support is less battle-tested than Unity's, and user prioritized platform maturity.
- **Vertical slice only**: A 6-10 week Unity prototype proving viability before committing to full parity. Rejected in favor of full parity + console-ready, but the team should still carve a ~3-week spike milestone early to de-risk vehicle feel before full commitment.

## Outstanding Questions

### Resolve Before Planning

_All resolved — see Key Decisions._

### Deferred to Planning

- [Affects R2][Technical] Render pipeline choice: URP (recommended for stylized kart racer + Switch) vs HDRP vs Built-in.
- [Affects R13][Technical] Networking stack: Mirror, Unity Netcode for GameObjects, Photon Fusion, or custom. Depends on current Network.js model (authoritative server vs peer).
- [Affects R9, R10][Technical] UI framework: UI Toolkit (modern, web-like, good for editorial layouts) vs UGUI (battle-tested, better controller navigation out of box) vs CommonUI-style custom.
- [Affects R14, R15][Technical] Backend stack: Firebase, Supabase, PlayFab, or custom Node/Go service. Choice affects live-ops tooling, cost, and compliance.
- [Affects R4][Needs research] Vehicle physics approach: Unity WheelCollider, Arcade Car Physics asset, Chrono vehicle, or a custom kinematic controller. Must be prototyped in the first spike milestone.
- [Affects R7, R8][Needs research] Blend-shape damage pipeline from current GLB authoring → Unity SkinnedMeshRenderer blend shapes. Validate with one test asset early.
- [Affects R1, R6][Needs research] Does Kenney publish a Unity version of the Starter Kit Racing? If yes, it's a major head start on tile prefabs and vehicle rigs.
- [Affects R2][Technical] Input System binding schema: unified keyboard + gamepad + touch with rebind UI.
- [Affects R3, R16][Technical] Steamworks integration surface for v1: achievements, cloud saves, microtransactions, workshop (for published tracks?), rich presence.
- [Affects R11][Process] What's the git strategy? New `unity/` top-level directory in the existing repo, or separate repo? Affects how Rafsby's workflow changes.
- [Affects R15][Process] Live-ops staffing model: does one of the 2-4 devs own the backend full-time, or is it contracted out? Affects hiring plan.

## Next Steps

→ `/ce:plan` for structured implementation planning.
