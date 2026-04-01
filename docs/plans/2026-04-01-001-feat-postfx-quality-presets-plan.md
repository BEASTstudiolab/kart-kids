---
title: "feat: Post-processing quality presets with adaptive device detection"
type: feat
status: completed
date: 2026-04-01
origin: docs/ideation/2026-04-01-v020-post-review-ideation.md#4
deepened: 2026-04-01
---

# Post-Processing Quality Presets with Adaptive Device Detection

## Overview

Replace the current 9 individually-togglable post-processing effects with 4 quality presets (Low / Medium / High / Ultra). Auto-detect device capability on startup to select the right default. Expose as a single "Quality" selector in the settings menu. Keep the debug menu's per-effect toggles for developer override.

## Problem Frame

The PostProcessing pipeline has 9 effects, each independently toggleable. This creates 512 possible combinations that are never tested together. Most players will never configure individual effects. Mobile players — the most friction-sensitive audience — face the worst UX: they must individually disable heavy effects or accept stuttering. A single quality tier removes this friction and lets the game reason about 4 tested configurations instead of 512.

## Requirements Trace

### Preset Definition & Device Detection

- R1. Define 4 quality presets (Low / Medium / High / Ultra) that map to specific effect + parameter combinations
- R2. Auto-detect device tier on startup based on available signals (touch, GPU renderer, device memory)

### Settings & UI

- R3. Expose quality as a single setting in the settings menu, replacing the current post-processing boolean toggle
- R4. Persist the quality setting via the existing Settings.js localStorage pattern

### Runtime Behavior & State Management

- R5. Apply preset changes at runtime without page reload
- R6. Preserve the debug menu's per-effect toggles as developer-only overrides (debug checkbox visual state will not auto-sync with preset changes — this is acceptable for a developer-only tool)
- R7. Shadow quality should be absorbed into the quality preset (currently a separate setting). Existing `shadowQuality` localStorage entries are dropped; users adjust quality tier to restore prior shadow fidelity.

## Scope Boundaries

- No frame-time benchmarking or adaptive scaling during gameplay (future work)
- Pixel ratio adjustment is static per quality tier and applied at preset selection time, not dynamically during gameplay. This is distinct from adaptive scaling, which would adjust resolution based on frame time.
- No new shader effects — only configuration of existing 9
- Debug menu remains unchanged in structure; presets override state but don't remove individual controls
- No changes to the PostProcessing shader code itself
- isMobile consolidation is a preparatory cleanup, not a core feature requirement — keep it minimal

## Context & Research

### Relevant Code and Patterns

- **PostProcessing.js** — `this.effects` array with `{ name, pass, enabled }` entries. `setEnabled(name, bool)` is async (for SSAO lazy-load) and unconditionally calls `rebuildEffects()` at the end. SSAO uses `setSSAOParam()` buffering pattern. **Important:** `applyPreset()` must NOT call `setEnabled()` in a loop — that would trigger 9 rebuilds. It must directly mutate `effect.enabled` and call `rebuildEffects()` once.
- **Settings.js** — `get(key)` / `set(key, value)` with `CustomEvent('settings-changed')` propagation. DEFAULTS object defines initial values with mobile detection.
- **SettingsMenu.js** — `_selectRow(label, key, options)` creates button-pill selectors (used by `shadowQuality`). `_toggleRow` used for current post-processing boolean.
- **main.js:928-964** — `settings-changed` listener handles `shadowQuality` (shadow map size), `postProcessing` (bloom toggle), `cameraMode`, `aiCount`, `difficulty`.
- **main.js:44** — `dirLight.shadow.mapSize.setScalar(isMobile ? 1024 : 2048)` runs at module scope before any preset. Must be updated to defer to preset.
- **main.js:206** — `renderer.setPixelRatio(isMobile ? 1.0 : ...)` also runs at init before preset. Must be updated similarly.
- **Mobile detection** — duplicated 4 times: `main.js:30`, `Settings.js:3`, `PostProcessing.js:192`, `Controls.js:77` (touch input gating). Controls.js check may intentionally remain separate since it gates touch-specific input setup, not GPU capability.
- **God rays samples** — `PostProcessing.js:203` bakes `samples` uniform at module scope using `_isMobileGPU`. Presets must include explicit `samples` values to override this.

### Institutional Learnings

- No `docs/solutions/` exists. No prior art for quality presets in this codebase.

## Key Technical Decisions

- **The 9 effects** (in render order): bloom, SSAO, godRays, motionBlur, radialZoom, chromaticAberration, vignette, colorGrading, screenShake. All 9 must have entries in every preset config. Note: screenShake is gameplay-triggered (via `triggerScreenShake`) — presets set it to `enabled: false` by default; the gameplay code auto-enables it on trigger and auto-disables after decay.
- **4 tiers, not 3 or 5**: Low (mobile-safe, bloom only, 512 shadow map), Medium (bloom + vignette + color grading, 1024 shadow map), High (+ motion blur + chromatic aberration + radial zoom, 2048 shadow map), Ultra (+ god rays + SSAO, 2048 shadow map). This balances mobile GPU limits against visual richness.
- **Device detection via throwaway WebGL context + touch + deviceMemory**: `detectTier()` creates a temporary canvas (`document.createElement('canvas').getContext('webgl')`) to probe `WEBGL_debug_renderer_info` for GPU model. This runs at module load time before the game renderer exists. Combined with touch detection and `navigator.deviceMemory`, this provides a reasonable tier. GPU classification is kept simple — just "mobile GPU" vs "desktop GPU" based on known renderer substrings, not an exhaustive family list. Falls back to touch + deviceMemory when GPU info is unavailable.
- **Absorb shadowQuality into quality preset**: Shadows are the other major GPU cost. Having two separate quality settings is confusing. Each tier specifies its own shadow map size.
- **Module named `QualityTiers.js`, not `QualityPresets.js`**: The preset data controls all graphics settings (effects, shadows, pixel ratio), not just post-processing. The name should reflect this broader scope.
- **Presets define effect states, not PostProcessing internals**: The preset definitions live outside PostProcessing.js as plain data. PostProcessing gets an `applyPreset(config)` method that takes a config object, not a tier name — keeping it decoupled from tier logic.
- **`applyPreset()` is async and bypasses `setEnabled()`**: It directly mutates each `effect.enabled` flag, handles the SSAO lazy-load as a special case (await dynamic import), then calls `rebuildEffects()` once. This avoids 9 redundant rebuilds. Uses a monotonic generation counter to guard against rapid-switch races: increment counter at start, check after SSAO await — if stale, return early without calling `rebuildEffects()`.
- **God rays shader default**: After removing `_isMobileGPU`, the shader definition uses a safe default of 60 samples. The preset overrides this immediately on first `applyPreset()` call.
- **Debug menu overrides are ephemeral**: When a developer toggles an individual effect via the debug menu, it overrides the preset for that session. Changing the quality setting via the settings menu resets all effects to the preset. Debug checkbox visual state will not auto-sync with preset changes — acceptable for a developer-only tool.
- **Pixel ratio derived from tier in main.js**: Rather than putting `pixelRatio` in the preset config (which mixes renderer concerns into PostProcessing data), main.js derives pixel ratio from the tier name with a simple lookup.

## Open Questions

### Resolved During Planning

- **Should the debug menu show the active preset?** Yes — add a read-only label at the top of the PostFX tab showing the current quality tier. Individual toggles still work as overrides.
- **What happens to the existing `postProcessing` boolean setting?** It becomes `quality` with string values. Existing localStorage with `postProcessing: true` migrates to the auto-detected tier at load time (respects device context). `postProcessing: false` always migrates to `'low'`.
- **SSAO buffering during rapid preset changes**: `applyPreset()` uses `setSSAOParam()` to queue params. If another preset is applied before SSAO finishes loading, the new params overwrite the queued ones (last-write-wins). The async load applies whichever params are in the buffer at completion time.

### Deferred to Implementation

- **Exact GPU renderer string matching for tier detection**: Start with a minimal list of known mobile GPU substrings (Adreno, Mali, Apple GPU, PowerVR). Log unknown renderers to console for future iteration.
- **Whether SSAO lazy-load latency is noticeable on tier change**: If switching to Ultra causes a visible hitch from the dynamic import, may need to preload SSAO on High+ tiers in future work.

## Implementation Units

- [x] **Unit 1: Define quality tiers as data**

  **Goal:** Create a tier definitions module that maps tier names to effect configurations and provides device detection.

  **Requirements:** R1, R2

  **Dependencies:** None

  **Files:**
  - Create: `js/QualityTiers.js`

  **Approach:**
  - Export a `PRESETS` object with keys `low`, `medium`, `high`, `ultra`
  - Each preset is an object mapping effect names to `{ enabled, params }` where params is a flat object of uniform overrides. God rays presets must include explicit `samples` values (e.g., high: 30, ultra: 60) to override the module-scope default.
  - Include `shadowMapSize` in each preset (512 / 1024 / 2048 / 2048)
  - Export a `TIER_PIXEL_RATIO` lookup mapping tier names to pixel ratio caps (low: 1.0, medium: 1.0, high: min(dpr, 1.5), ultra: min(dpr, 2.0)). This is separate from the effects config since pixel ratio is a renderer concern.
  - Export a `VALID_TIERS` set or array for validation
  - Export a `detectTier()` function that:
    - Creates a throwaway canvas to get a temporary WebGL context
    - Probes `WEBGL_debug_renderer_info` for GPU renderer string
    - Classifies as mobile GPU vs desktop GPU using known substrings
    - Falls back to touch + `navigator.deviceMemory` when GPU info is unavailable
    - After probing, releases the throwaway WebGL context via `WEBGL_lose_context` extension to avoid holding an extra context on memory-constrained devices
    - Returns a tier string

  **Patterns to follow:**
  - Settings.js DEFAULTS pattern — plain data objects, no class

  **Test scenarios:**
  - Happy path: each preset key maps to a valid config with `enabled` booleans for all 9 effects
  - Happy path: `detectTier()` returns a valid tier string on desktop (no touch, high memory)
  - Happy path: god rays preset includes explicit `samples` param (not relying on module default)
  - Edge case: `detectTier()` returns `'low'` when touch detected + low/no deviceMemory + no GPU info
  - Edge case: `detectTier()` returns `'medium'` on desktop when both GPU info and deviceMemory are unavailable
  - Edge case: `detectTier()` handles `navigator.deviceMemory` being undefined (non-Chrome browsers)
  - Edge case: throwaway canvas creation fails gracefully (falls back to touch-only)

  **Verification:**
  - Importing `QualityTiers.js` and calling `detectTier()` returns one of the 4 tier strings
  - Each `PRESETS[tier]` contains entries for all 9 effect names plus `shadowMapSize`
  - `TIER_PIXEL_RATIO[tier]` returns a number for all 4 tiers

- [x] **Unit 2: Add `applyPreset()` method to PostProcessing**

  **Goal:** PostProcessing can bulk-apply a preset config object, enabling/disabling effects and setting uniform values in one call.

  **Requirements:** R1, R5

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `js/PostProcessing.js`

  **Approach:**
  - Add async `applyPreset(config)` method that:
    - Increments a monotonic `_presetGeneration` counter at the start
    - Iterates the config object and directly sets `effect.enabled` on each entry (does NOT call `setEnabled()` to avoid 9 redundant `rebuildEffects()` calls)
    - For SSAO: if enabling and not yet loaded, await the dynamic import (same lazy-load logic as `setEnabled`), then apply params. If SSAO params come via preset while loading, use `setSSAOParam()` for last-write-wins buffering
    - After SSAO await: check if `_presetGeneration` still matches — if stale (another applyPreset was called during the await), return early without calling `rebuildEffects()`
    - For all other effects with `params`: set uniform values via `getPass(name).uniforms[key].value`
    - Call `rebuildEffects()` once at the end
  - Remove `_isMobileGPU` module-scope variable from PostProcessing.js — god rays sample count now comes from the preset config's params. Replace the `_isMobileGPU` ternary in the shader definition with a safe default of 60 (overridden immediately by the first applyPreset call)

  **Patterns to follow:**
  - Existing `rebuildEffects()` pattern for the final rebuild
  - `setSSAOParam()` buffering pattern for SSAO params
  - SSAO lazy-load logic from `setEnabled()` for the import path

  **Test scenarios:**
  - Happy path: `applyPreset(PRESETS.low)` results in only bloom enabled, all others disabled
  - Happy path: `applyPreset(PRESETS.ultra)` enables all effects with correct uniform values
  - Happy path: switching from ultra to low disables all non-bloom effects
  - Happy path: god rays `samples` uniform is set from preset params, not from removed `_isMobileGPU`
  - Edge case: applying a preset with SSAO enabled when SSAO hasn't been lazy-loaded yet — params should be buffered
  - Edge case: rapid preset switch (High -> Ultra) before SSAO finishes loading — Ultra's params win (last-write-wins)
  - Edge case: rapid preset switch (Ultra -> Low) — stale Ultra call returns early after SSAO load, does not re-enable effects (generation counter guard)
  - Integration: `rebuildEffects()` is called exactly once per `applyPreset()` call

  **Verification:**
  - After `applyPreset(config)`, `getEffect(name).enabled` matches `config[name].enabled` for all effects
  - Renderer's active effect list matches the enabled subset
  - `_isMobileGPU` no longer exists in PostProcessing.js

- [x] **Unit 3: Wire quality setting end-to-end (Settings, SettingsMenu, main.js, debug label)**

  **Goal:** Add `quality` to Settings defaults with auto-detected initial value. Replace post-processing/shadow toggles in SettingsMenu with a quality tier selector. Handle migration from old settings. Wire the settings-changed handler in main.js. Add preset label to debug menu.

  **Requirements:** R2, R3, R4, R5, R6, R7

  **Dependencies:** Units 1, 2

  **Files:**
  - Modify: `js/Settings.js`
  - Modify: `js/SettingsMenu.js`
  - Modify: `js/main.js`

  **Approach:**

  **Settings.js:**
  - Import `detectTier`, `VALID_TIERS` from QualityTiers.js
  - Set `DEFAULTS.quality` to `detectTier()` (called at module load — detectTier creates its own throwaway WebGL context)
  - Remove `postProcessing` and `shadowQuality` from DEFAULTS
  - In constructor migration: if stored data has `postProcessing: false`, set `quality: 'low'`. If `postProcessing: true`, set `quality` to `detectTier()`. Delete old `postProcessing` and `shadowQuality` keys from stored data.
  - Add validation: if stored `quality` is not in `VALID_TIERS`, replace with `detectTier()`

  **SettingsMenu.js:**
  - Replace `_toggleRow('Post-Processing', 'postProcessing')` and `_selectRow('Shadows', 'shadowQuality', ...)` with a single `_selectRow('Quality', 'quality', [{label:'Low', value:'low'}, {label:'Medium', value:'medium'}, {label:'High', value:'high'}, {label:'Ultra', value:'ultra'}])`

  **main.js:**
  - Import `PRESETS`, `TIER_PIXEL_RATIO` from QualityTiers.js
  - In `settings-changed` listener: when `key === 'quality'`:
    - Guard: `if (!PRESETS[value]) return;`
    - Call `postFX.applyPreset(PRESETS[value])` (fire-and-forget — async for SSAO but acceptable)
    - Update `dirLight.shadow.mapSize.setScalar(PRESETS[value].shadowMapSize)`, invalidate shadow map
    - Update `renderer.setPixelRatio(TIER_PIXEL_RATIO[value])` then call `renderer.setSize(window.innerWidth, window.innerHeight)` to force buffer resize
  - Remove the old `shadowQuality` and `postProcessing` handlers
  - On init: after PostProcessing is constructed, apply the initial preset from `settings.get('quality')`. Also set initial shadow map size and pixel ratio from the preset (replacing the old isMobile ternaries at main.js:44 and main.js:206)
  - At the top of the PostFX debug tab: add a read-only label showing "Active preset: {tier}". Listen for `settings-changed` with `key === 'quality'` to update. Note: debug checkbox visual state will not auto-sync with preset changes — this is intentional.

  **Patterns to follow:**
  - Existing `_selectRow('Shadows', 'shadowQuality', [...])` pattern in SettingsMenu
  - Existing `settings-changed` handler pattern in main.js
  - `debugMenu.addHeader()` pattern for section labels

  **Test scenarios:**
  - Happy path: fresh install auto-detects tier and persists it
  - Happy path: changing quality in menu fires `settings-changed` event with `key: 'quality'`
  - Happy path: on startup, correct preset is applied based on detected/stored quality
  - Happy path: shadow map size changes when switching tiers
  - Happy path: pixel ratio updates when switching tiers
  - Happy path: PostFX debug tab shows "Active preset: High" and updates when changed
  - Edge case: existing localStorage with `postProcessing: false` migrates to `quality: 'low'`
  - Edge case: existing localStorage with `postProcessing: true` migrates to auto-detected tier
  - Edge case: existing localStorage with `quality: 'potato'` falls back to detectTier()
  - Edge case: existing localStorage with `shadowQuality` does not break (key is dropped)
  - Integration: full chain: SettingsMenu click -> Settings.set -> CustomEvent -> main.js handler -> PostProcessing.applyPreset + shadow + pixelRatio -> renderer.setEffects

  **Verification:**
  - Settings menu shows 4 quality options with the auto-detected one highlighted
  - Switching quality visibly changes which effects are active, shadow quality, and render resolution
  - No console errors during quality transitions or with old localStorage data
  - Debug menu PostFX tab shows current preset name and updates in sync

## System-Wide Impact

- **Interaction graph:** Settings.set('quality') -> CustomEvent -> main.js handler -> PostProcessing.applyPreset() + shadow map update + pixel ratio update. Debug menu bypasses this chain and calls PostProcessing directly.
- **Initialization sequence:** Settings.js loads and evaluates `detectTier()` at import time (using throwaway WebGL context). main.js constructs PostProcessing, then applies the initial preset from `settings.get('quality')`. Shadow map and pixel ratio are set from the preset during init, replacing the old isMobile ternaries.
- **Error propagation:** If `WEBGL_debug_renderer_info` is blocked by the browser or throwaway canvas fails, `detectTier()` falls back conservatively (medium on desktop, low on mobile). If localStorage contains an invalid tier, Settings validates and replaces with detectTier(). No error propagation needed.
- **State lifecycle risks:** Switching presets while SSAO is lazy-loading could race. `applyPreset()` uses `setSSAOParam()` for last-write-wins buffering — the async load applies whichever params are queued at completion time. Debug checkbox visual state will be out of sync after preset changes — acceptable for developer-only UI.
- **API surface parity:** The `postProcessing` boolean setting and `shadowQuality` setting are being removed. Any code referencing `settings.get('postProcessing')` or `settings.get('shadowQuality')` must be updated. `_isMobileGPU` is removed from PostProcessing.js.
- **Unchanged invariants:** The PostProcessing `setEnabled()/getPass()/getEffect()` API is unchanged. The debug menu's direct effect manipulation continues to work. The DebugMenu class itself is untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `WEBGL_debug_renderer_info` blocked in some browsers (Firefox, privacy settings) | Fall back to touch + deviceMemory signals; default to medium on desktop, low on mobile |
| Throwaway canvas for GPU detection fails in edge environments | Wrap in try/catch, fall back to touch-only detection |
| SSAO lazy-load hitch when switching to Ultra | Accept for v1; applyPreset awaits the import so effects are consistent after resolution |
| Existing localStorage with old or invalid settings keys | Explicit migration + validation logic in Settings constructor |
| isMobile duplication across 4 files | Remove from PostProcessing.js (replaced by preset config). main.js isMobile replaced by preset-derived values at init. Settings.js becomes canonical for detection. Controls.js touch check remains separate (different purpose). |
| God rays samples baked at module scope | Preset params override uniform values at runtime; _isMobileGPU removed |

## Sources & References

- Origin: [docs/ideation/2026-04-01-v020-post-review-ideation.md#4](docs/ideation/2026-04-01-v020-post-review-ideation.md)
- Related code: `js/PostProcessing.js`, `js/Settings.js`, `js/SettingsMenu.js`, `js/main.js`
- Related PR: #4 (code review fixes, includes PostProcessing.setSSAOParam API)
