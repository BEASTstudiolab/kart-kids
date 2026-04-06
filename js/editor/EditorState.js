// ─── Editor State & Constants ────────────────────────────────────────
// Shared state object passed to all editor modules.
// Constants used across multiple modules live here.

export const ORIENT_FLIP = { 0: 10, 10: 0, 16: 22, 22: 16 };

// Bitmask: N=8 S=4 E=2 W=1
// Corner connectivity: 0°=S+W, 90°=S+E, 180°=N+E, 270°=N+W
export const AUTOTILE = [
	[ 'trk-straight', 0 ],    //  0: isolated
	[ 'trk-straight', 16 ],   //  1: W
	[ 'trk-straight', 16 ],   //  2: E
	[ 'trk-straight', 16 ],   //  3: E+W
	[ 'trk-straight', 0 ],    //  4: S
	[ 'trk-corner-1x1', 0 ],  //  5: S+W
	[ 'trk-corner-1x1', 16 ], //  6: S+E
	[ 'trk-straight', 16 ],   //  7: S+E+W
	[ 'trk-straight', 0 ],    //  8: N
	[ 'trk-corner-1x1', 22 ], //  9: N+W
	[ 'trk-corner-1x1', 10 ], // 10: N+E
	[ 'trk-straight', 16 ],   // 11: N+E+W
	[ 'trk-straight', 0 ],    // 12: N+S
	[ 'trk-straight', 0 ],    // 13: N+S+W
	[ 'trk-straight', 0 ],    // 14: N+S+E
	[ 'trk-straight', 0 ],    // 15: N+S+E+W
];

// Direction deltas: N=8, S=4, E=2, W=1
export const DIR_DELTA = {
	8: [ 0, - 1 ],  // N
	4: [ 0, 1 ],    // S
	2: [ 1, 0 ],    // E
	1: [ - 1, 0 ],  // W
};

export const DIR_INFO = [
	{ bit: 8, dx: 0, dz: - 1 }, // N
	{ bit: 4, dx: 0, dz: 1 },   // S
	{ bit: 2, dx: 1, dz: 0 },   // E
	{ bit: 1, dx: - 1, dz: 0 }, // W
];

export function cellKey( gx, gz ) { return gx + ',' + gz; }
