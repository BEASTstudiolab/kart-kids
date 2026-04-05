# Tile Edge Reference — Extracted from GLB Vertex Data

## 1x1 Tiles (all use rotationY: PI/2 in three.js)

### Straight (010_rd_straight_1x1)
- Road runs E/W in raw model (along X axis)
- After PI/2: road runs N/S
- All 4 edges: road opening centered at 0

### Ramp Up (190_rmp_up_z0_to_z2p5)
- Raw: LOW at -X (west), HIGH at +X (east), open side = -X
- After PI/2: LOW at +Z (south), HIGH at -Z (north)
- Road opening: -X edge only (west in raw = south after PI/2)

### Ramp Down (210_rmp_down_z2p5_to_z0)
- Raw: HIGH at -X (west), LOW at +X (east), open side = +X
- After PI/2: HIGH at +Z (south), LOW at -Z (north)
- Road opening: +X edge only (east in raw = north after PI/2)

### Elevation Flat (170_elv_flat_z2p5)
- All edges CLOSED (walls on all sides)
- Height baked in geometry (Y ≈ 2.42-3.35)

## 3x3 Curve Tiles (rotationY: 0 — no wrapper)

### CURVE L 3x3 (520_trn_90_l)
- Size: 30x30, centered at origin
- Road center positions per edge:
  - West (-X): Z = -2.1 (cell 1, slightly north)
  - East (+X): Z = 4.8 (cell 1, slightly south)
  - North (-Z): X = -6.1 (cell 0, west strip)
  - South (+Z): X = 3.2 (cell 1, middle)
- Internal corner cell: NW area (-10, -10)
- Road connects: west edge to north edge (NW turn)

### CURVE R 3x3 (510_trn_90_r)
- Size: 30x30, centered at origin
- Road center positions per edge:
  - West (-X): Z = 4.8 (cell 1, slightly south)
  - East (+X): Z = -2.1 (cell 1, slightly north)
  - North (-Z): X = 6.1 (cell 2, east strip)
  - South (+Z): X = -3.2 (cell 1, slightly west)
- Internal corner cell: NE area (+10, -10)
- Road connects: east edge to north edge (NE turn)

## Key Constraint

The road center on the connecting edge of a curve must align with the adjacent straight's road center (always at position 0 in the cell center).

At the footprint-center offset (-10,+10 for orient 0), the internal cells align with the grid, but the road center is ~5 units off from the straight. This is because the curve road doesn't run through cell centers — it arcs diagonally.

## TODO
- The ~5 unit misalignment may be inherent to the model design
- Need to verify with Rafsby how these models were intended to connect
- Consider: the models might need slight offset OR the road center mismatch is acceptable
