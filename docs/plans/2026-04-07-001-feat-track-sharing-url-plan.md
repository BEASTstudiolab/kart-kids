---
date: 2026-04-07
id: "001"
type: feat
title: Track sharing via URL-encoded codec
status: in-progress
---

# feat: Track sharing via URL-encoded codec

## Requirements

- R1: Editor has a "Share" button that copies a play-link to clipboard
- R2: The game (index.html) loads tracks from both `?map=` and `#map=` hash fragment
- R3: The editor loads tracks from both `?map=` and `#map=` hash fragment
- R4: Visual feedback when link is copied (toast or button text change)

## Implementation Units

- [x] Add hash fragment reading to `main.js` (fallback: try `#map=` if no `?map=`)
- [x] Add hash fragment reading to `editor/Persistence.js` loadSaved
- [x] Update existing Share button to use hash fragment instead of query param
- [x] "Copied!" toast feedback already exists

## Design Decisions

- Use hash fragment (`#map=...`) for share links so they don't hit the server or appear in access logs
- Keep backward compat with existing `?map=` query param
- Share link points to the game (`index.html`), not the editor
- No server-side changes needed
