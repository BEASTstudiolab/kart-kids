# Track Publishing Ops

## Runtime storage

- Database path defaults to `data/tracks.sqlite`
- Override with `TRACKS_DB_PATH=/absolute/path/to/tracks.sqlite`
- SQLite WAL mode is enabled, so expect sibling `-wal` and `-shm` files at runtime

## Manage links

- Public links under `/t/<publicId>` are safe to share widely
- Manage links under `/m/<token>` are bearer credentials
- Losing the manage link means losing portable ownership recovery for MVP

## Staff commands

List published tracks:

```bash
node server/tracks/TrackAdmin.js list
```

Pin a live track to Spotlight:

```bash
node server/tracks/TrackAdmin.js spotlight <publicId>
```

List active Spotlight entries:

```bash
node server/tracks/TrackAdmin.js spotlight-list
```

Remove a Spotlight entry:

```bash
node server/tracks/TrackAdmin.js spotlight-remove <entryId>
```

Take down a public track:

```bash
node server/tracks/TrackAdmin.js takedown <publicId>
```

Restore a taken-down track:

```bash
node server/tracks/TrackAdmin.js restore <publicId>
```

## Expected behavior

- `takedown` removes public availability and Spotlight presence
- Saved local snapshots in `My Saved` remain playable
- Manage links still resolve so the creator can inspect the track status
