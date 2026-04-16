# Origin Master Merge Readiness

Date: 2026-04-16

## Snapshot

As of 2026-04-16, local `master` is **behind `origin/master` by 3 commits**.

- Local `HEAD`: `7aeda87` (`feat: bake character stage camera presets`)
- Remote `origin/master`: `e5a0e9b` (`kart-kids-v0.41-basic-terrain-editor-and-props-track-editor`)
- Merge base: `7aeda87`

This means the repo is not in a conflict state yet, but future integration is already carrying real overlap risk because the working tree is dirty and the new upstream commits touch some of the same runtime and menu files.

## Latest Upstream Commits

### `e5a0e9b` on 2026-04-15

`kart-kids-v0.41-basic-terrain-editor-and-props-track-editor`

High-level shape:

- large track editor and terrain/props expansion
- significant `js/GameEngine.js` changes
- small `js/ui/core/AppShell.js` change
- many new assets and track-editor tests

### `4c3756e` on 2026-04-15

`kart-kids-v0.40-blink-added-debug-added`

High-level shape:

- adds character blink and material debug support
- touches menu/preview flow
- updates `js/ui/LobbyScene.js`
- updates `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- updates `js/SettingsMenu.js`
- adds or updates related tests

### `88020cc` on 2026-04-15

`kart-kids-v0.39-track-builder-theme-tiles`

High-level shape:

- track builder theme/tile support
- moderate `js/GameEngine.js` changes
- broad theme asset additions

## Real Conflict Hotspots

The overlap below is calculated against the **actual local working tree changes**, not against the entire branch drift.

### Highest risk

- `js/GameEngine.js`
  - Local change: 159 insertions / 178 deletions
  - Remote change since `HEAD`: 340 insertions / 43 deletions
  - Overlaps with all three upstream commits: `e5a0e9b`, `4c3756e`, `88020cc`
  - Expect this to be the hardest manual merge surface

- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
  - Local change: 106 insertions / 2 deletions
  - Remote change since `HEAD`: 70 insertions / 16 deletions
  - Overlaps with `4c3756e`
  - High chance of semantic conflicts because both sides touch character-preview behavior

- `js/ui/LobbyScene.js`
  - Local change: 436 insertions / 79 deletions
  - Remote change since `HEAD`: 72 insertions
  - Overlaps with `4c3756e`
  - Likely conflict area for preview/blink/camera behavior

- `js/SettingsMenu.js`
  - Local change: 338 insertions / 234 deletions
  - Remote change since `HEAD`: 29 insertions / 2 deletions
  - Overlaps with `4c3756e`
  - Remote touch is smaller, but local restructuring is heavy enough that conflict odds are still meaningful

### Medium risk

- `js/ui/core/AppShell.js`
  - Local change: 403 insertions / 214 deletions
  - Remote change since `HEAD`: 1 insertion / 1 deletion
  - Overlaps with `e5a0e9b`
  - Probably easy to resolve, but the file is large and locally reshaped

- `tests/character-select-preview-focus.test.mjs`
  - Local change: 42 insertions
  - Remote change since `HEAD`: 84 insertions
  - Overlaps with `4c3756e`

- `tests/lobby-assets.test.mjs`
  - Local change: 36 insertions / 2 deletions
  - Remote change since `HEAD`: 30 insertions
  - Overlaps with `4c3756e`

- `tests/e2e/character-tab.spec.js`
  - Local change: 42 insertions / 9 deletions
  - Remote change since `HEAD`: 3 insertions / 1 deletion
  - Overlaps with `4c3756e`

### Lower risk or no current upstream overlap

These are large local edits, but they do **not** overlap with the current 3 upstream commits:

- `js/ui/pages/page10-character-select/Page10CharacterSelectView.js`
- `js/ui/ui-theme.css`
- `js/ui/audio/MenuMusicPlayer.js`
- most of the current `js/ui/` surface work

They may conflict with future upstream work, but they are not part of the immediate `origin/master` merge risk as of 2026-04-16.

## Untracked File Collision Check

No collisions were found between current untracked local paths and files introduced by the 3 upstream commits.

That means the immediate risk is from **modified tracked files**, not from pull-blocking untracked path clashes.

## Practical Merge Strategy

### Recommended timing

Merge `origin/master` into the in-progress work **sooner rather than later**.

The branch is only 3 commits behind right now, and the conflict surface is still concentrated. Waiting while continuing to edit `GameEngine`, `LobbyScene`, `SettingsMenu`, and the character-select controller will make the eventual merge worse.

### Recommended sequence

1. Move the current dirty work onto a dedicated feature branch before integrating anything.
2. Preserve the current work with a real commit or a clean stash if you need a temporary checkpoint.
3. Fetch and merge or rebase the 3 upstream commits onto that branch.
4. Resolve conflicts in this order:
   - `js/GameEngine.js`
   - `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
   - `js/ui/LobbyScene.js`
   - `js/SettingsMenu.js`
   - `js/ui/core/AppShell.js`
   - overlapping tests
5. Run targeted checks around character preview, lobby assets, settings, and boot/game initialization immediately after conflict resolution.

### Why this order

- `js/GameEngine.js` is the only file touched by all 3 upstream commits, so it is the main integration bottleneck.
- `Page10CharacterSelectController` and `LobbyScene` are the most likely semantic-conflict pair from the blink/debug upstream work versus the local UI flow work.
- `SettingsMenu` and `AppShell` have smaller upstream changes, so they are better resolved after the high-entropy files are stable.

## Merge-Time Checklist

- Confirm `git status --short --branch` before starting so you know exactly what is local-only.
- Snapshot the current work on a branch before any merge or rebase.
- Re-read the upstream diffs for:
  - `js/GameEngine.js`
  - `js/ui/LobbyScene.js`
  - `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
  - `js/SettingsMenu.js`
  - `js/ui/core/AppShell.js`
- After conflict resolution, run the most relevant tests first:
  - `tests/character-select-preview-focus.test.mjs`
  - `tests/lobby-assets.test.mjs`
  - `tests/e2e/character-tab.spec.js`
- Do a manual app pass through:
  - boot/loading flow
  - character select preview
  - lobby scene
  - settings menu

## Bottom Line

There is no need to panic-merge, but there **is** enough real overlap now that postponing the merge will likely cost more later.

If the goal is to avoid ugly conflicts, the main thing to protect against is further divergence in:

- `js/GameEngine.js`
- `js/ui/LobbyScene.js`
- `js/ui/pages/page10-character-select/Page10CharacterSelectController.js`
- `js/SettingsMenu.js`

Those are the files to treat as merge-sensitive until `origin/master` is integrated.
