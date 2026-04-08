// ─── AutoTileService ─────────────────────────────────────────────────────────
// Bitmask-based connectivity resolution for auto-tiling.
// Rebuilt from scratch for the OOP editor, same proven algorithm.
// N=8, S=4, E=2, W=1

const DIR_INFO = [
	{ bit: 8, dx: 0, dz: - 1, opposite: 4 },  // N
	{ bit: 4, dx: 0, dz: 1, opposite: 8 },     // S
	{ bit: 2, dx: 1, dz: 0, opposite: 1 },     // E
	{ bit: 1, dx: - 1, dz: 0, opposite: 2 },   // W
];

// AUTOTILE lookup: bitmask index -> [type, orient]
const AUTOTILE = [
	[ 'trk-straight', 0 ],    //  0: isolated
	[ 'trk-straight', 16 ],   //  1: W
	[ 'trk-straight', 16 ],   //  2: E
	[ 'trk-straight', 16 ],   //  3: E+W
	[ 'trk-straight', 0 ],    //  4: S
	[ 'trk-corner-1x1', 0 ],  //  5: S+W
	[ 'trk-corner-1x1', 16 ], //  6: S+E
	[ 'trk-straight', 16 ],   //  7: S+E+W → prefer straight
	[ 'trk-straight', 0 ],    //  8: N
	[ 'trk-corner-1x1', 22 ], //  9: N+W
	[ 'trk-corner-1x1', 10 ], // 10: N+E
	[ 'trk-straight', 16 ],   // 11: N+E+W → prefer straight
	[ 'trk-straight', 0 ],    // 12: N+S
	[ 'trk-straight', 0 ],    // 13: N+S+W → prefer straight
	[ 'trk-straight', 0 ],    // 14: N+S+E → prefer straight
	[ 'trk-straight', 0 ],    // 15: N+S+E+W → prefer straight
];

// Orientation flip table (used for ramp direction derivation)
const ORIENT_FLIP = { 0: 10, 10: 0, 16: 22, 22: 16 };

// Orient rotation cycle (clockwise: 0→16→10→22→0)
const ORIENT_CYCLE = { 0: 16, 16: 10, 10: 22, 22: 0 };


export class AutoTileService {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('./MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, meshFactory, eventBus ) {

		this._project = project;
		this._meshFactory = meshFactory;
		this._eventBus = eventBus;

	}

	/**
	 * Get connectivity mask: which neighbors have exits facing this cell.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {number} 4-bit mask
	 */
	getConnectivityMask( gx, gz ) {

		let mask = 0;

		for ( const dir of DIR_INFO ) {

			const neighbor = this._project.getTile( gx + dir.dx, gz + dir.dz );
			if ( ! neighbor ) continue;

			// Check if neighbor has an exit facing us (opposite direction)
			const nExits = neighbor.getExitMask();
			if ( nExits & dir.opposite ) {

				mask |= dir.bit;

			}

		}

		return mask;

	}

	/**
	 * Get presence mask: which neighbors have any road tile.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {number}
	 */
	getPresenceMask( gx, gz ) {

		let mask = 0;

		for ( const dir of DIR_INFO ) {

			const neighbor = this._project.getTile( gx + dir.dx, gz + dir.dz );
			if ( neighbor && ! neighbor._consumed ) {

				mask |= dir.bit;

			}

		}

		return mask;

	}

	/**
	 * Resolve a newly placed tile: pick best type+orient from connectivity.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {{ type: string, orient: number }}
	 */
	resolveNewTile( gx, gz ) {

		// For new tiles, use connectivity mask
		const connMask = this.getConnectivityMask( gx, gz );

		if ( connMask > 0 ) {

			// If 3+ directions, pick best pair
			const bits = this._countBits( connMask );
			if ( bits >= 3 ) {

				return this._pickBestPair( connMask, gx, gz );

			}

			return { type: AUTOTILE[ connMask ][ 0 ], orient: AUTOTILE[ connMask ][ 1 ] };

		}

		// No connected neighbors: check presence for alignment
		const presMask = this.getPresenceMask( gx, gz );
		if ( presMask > 0 ) {

			const bits = this._countBits( presMask );
			if ( bits >= 3 ) return this._pickBestPair( presMask, gx, gz );
			return { type: AUTOTILE[ presMask ][ 0 ], orient: AUTOTILE[ presMask ][ 1 ] };

		}

		// Isolated: default straight
		return { type: 'trk-straight', orient: 0 };

	}

	/**
	 * Get placement hint with confidence level for ghost preview.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {{ type: string, orient: number, confidence: string, opacity: number }}
	 */
	getPreviewHint( gx, gz ) {

		const resolved = this.resolveNewTile( gx, gz );
		const mask = this.getConnectivityMask( gx, gz );
		const bits = this._countBits( mask );

		let confidence = 'uncertain';
		let opacity = 0.25;
		if ( bits >= 2 ) { confidence = 'confident'; opacity = 0.4; }
		if ( bits >= 3 ) { confidence = 'very-confident'; opacity = 0.55; }

		return { ...resolved, confidence, opacity };

	}

	/**
	 * Resolve an existing tile: re-compute type+orient from current connectivity.
	 * @param {number} gx
	 * @param {number} gz
	 * @returns {{ type: string, orient: number }}
	 */
	resolveTile( gx, gz ) {

		const connMask = this.getConnectivityMask( gx, gz );

		if ( connMask > 0 ) {

			const bits = this._countBits( connMask );
			if ( bits >= 3 ) return this._pickBestPair( connMask, gx, gz );
			return { type: AUTOTILE[ connMask ][ 0 ], orient: AUTOTILE[ connMask ][ 1 ] };

		}

		// Fallback to presence
		const presMask = this.getPresenceMask( gx, gz );
		if ( presMask > 0 ) {

			const bits = this._countBits( presMask );
			if ( bits >= 3 ) return this._pickBestPair( presMask, gx, gz );
			return { type: AUTOTILE[ presMask ][ 0 ], orient: AUTOTILE[ presMask ][ 1 ] };

		}

		return { type: 'trk-straight', orient: 0 };

	}

	/**
	 * Full resolve: update a cell's type/orient/mesh, with guards.
	 * Skips rotation-overridden, auto-ramp, elevated, and consumed cells.
	 * @param {number} gx
	 * @param {number} gz
	 */
	resolveCell( gx, gz ) {

		const tile = this._project.getTile( gx, gz );
		if ( ! tile ) return;

		// Don't re-resolve these
		if ( tile.rotationOverride ) return;
		if ( tile.autoRamp ) return;
		if ( tile._consumed ) return;
		if ( tile.isFinish ) return;

		// Skip special tiles (junctions, bridges, tunnels, jumps, chicane)
		if ( tile.type !== 'trk-straight' && tile.type !== 'trk-corner-1x1' ) return;

		// Skip elevated tiles that have been transformed
		if ( tile.type.startsWith( 'trk-elev-' ) || tile.type.startsWith( 'trk-ramp-' ) ) return;

		const resolved = this.resolveTile( gx, gz );

		if ( resolved.type !== tile.type || resolved.orient !== tile.orient ) {

			const prevType = tile.type;
			const prevOrient = tile.orient;

			tile.type = resolved.type;
			tile.orient = resolved.orient;

			// Rebuild mesh
			this._meshFactory.createTileMesh( gx, gz, tile );

			this._eventBus.emit( 'tile:changed', {
				gx, gz, tile,
				prevType, prevOrient,
			} );

		}

	}

	/**
	 * Resolve center cell and all 4 direct neighbors.
	 * @param {number} gx
	 * @param {number} gz
	 */
	resolveCellAndNeighbors( gx, gz ) {

		this.resolveCell( gx, gz );

		for ( const dir of DIR_INFO ) {

			this.resolveCell( gx + dir.dx, gz + dir.dz );

		}

	}

	/**
	 * When 3+ neighbor directions exist, pick the best pair for a 2-exit tile.
	 * Prefers corners (more interesting than straights), then highest connection count.
	 * @private
	 */
	_pickBestPair( mask, gx, gz ) {

		const dirs = DIR_INFO.filter( d => mask & d.bit );

		let bestScore = - 1;
		let bestPair = mask & 0x03; // fallback

		// Try all 2-direction combinations
		for ( let i = 0; i < dirs.length; i ++ ) {

			for ( let j = i + 1; j < dirs.length; j ++ ) {

				const pairMask = dirs[ i ].bit | dirs[ j ].bit;
				const [ type ] = AUTOTILE[ pairMask ];

				// Score: corners (2pts) > straights (1pt)
				const isCorner = type === 'trk-corner-1x1';
				let score = isCorner ? 2 : 1;

				// Bonus: prefer pairs where both neighbors actually connect to us
				const n1 = this._project.getTile( gx + dirs[ i ].dx, gz + dirs[ i ].dz );
				const n2 = this._project.getTile( gx + dirs[ j ].dx, gz + dirs[ j ].dz );
				if ( n1 && ( n1.getExitMask() & dirs[ i ].opposite ) ) score += 0.5;
				if ( n2 && ( n2.getExitMask() & dirs[ j ].opposite ) ) score += 0.5;

				if ( score > bestScore ) {

					bestScore = score;
					bestPair = pairMask;

				}

			}

		}

		return { type: AUTOTILE[ bestPair ][ 0 ], orient: AUTOTILE[ bestPair ][ 1 ] };

	}

	/** @private */
	_countBits( n ) {

		let count = 0;
		while ( n ) { count += n & 1; n >>= 1; }
		return count;

	}

}

export { DIR_INFO, AUTOTILE, ORIENT_FLIP, ORIENT_CYCLE };
