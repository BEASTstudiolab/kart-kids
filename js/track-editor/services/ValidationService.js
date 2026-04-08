// ─── ValidationService ───────────────────────────────────────────────────────
// Validates track projects with race-type-aware rules.

import { DIR_INFO } from './AutoTileService.js';
import { CELL_RAW } from '../../TrackConstants.js';

// Race types that require a closed loop
const LOOP_REQUIRED = new Set( [ 'circuit', 'time-trial', 'elimination', 'drift-trial' ] );
// Race types that need checkpoints
const CHECKPOINTS_REQUIRED = new Set( [ 'time-trial' ] );

export class ValidationService {

	constructor( project, eventBus ) {

		this._project = project;
		this._eventBus = eventBus;

		/** @type {Array} Last validation issues (for focus-next-issue). */
		this.lastIssues = [];

	}

	/**
	 * Run all validation checks.
	 * @param {import('../modes/GameplayMode.js').GameplayMode} [gameplayMode]
	 * @returns {{ valid: boolean, issues: Array, stats: object }}
	 */
	validate( gameplayMode ) {

		const issues = [];
		const grid = this._project.getGrid();
		const raceType = this._project.meta.raceType || 'circuit';
		const racerCount = this._project.meta.racerCount || 4;

		// Count tiles
		let tileCount = 0, straightCount = 0, cornerCount = 0;
		let finishTile = null, finishCount = 0;

		for ( const [ key, tile ] of grid ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;
			tileCount ++;

			if ( tile.type === 'trk-straight' || tile.type.startsWith( 'trk-elev-' ) ) straightCount ++;
			if ( tile.type === 'trk-corner-1x1' ) cornerCount ++;

			if ( tile.isFinish ) {

				finishCount ++;
				finishTile = { key, tile };

			}

		}

		// ── Structure checks ──

		if ( finishCount === 0 ) {

			issues.push( { severity: 'error', code: 'E_NO_FINISH', message: 'No start/finish tile', category: 'structure', locus: null } );

		} else if ( finishCount > 1 ) {

			issues.push( { severity: 'error', code: 'E_MULTI_FINISH', message: 'Multiple finish tiles', category: 'structure', locus: null } );

		}

		if ( tileCount < 4 ) {

			issues.push( { severity: 'error', code: 'E_TOO_FEW_TILES', message: 'Need at least 4 tiles', category: 'structure', locus: null } );

		}

		// ── Connectivity + loop ──

		let loopValid = false;

		if ( finishTile ) {

			const visited = this._walkFromFinish( finishTile.key );

			for ( const [ key, tile ] of grid ) {

				if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;
				if ( ! visited.has( key ) ) {

					const [ gx, gz ] = key.split( ',' ).map( Number );
					issues.push( {
						severity: 'error', code: 'E_DISCONNECTED',
						message: `Tile at ${ gx },${ gz } disconnected`,
						category: 'connectivity',
						locus: { gx, gz, layer: 'track' },
					} );

				}

			}

			loopValid = visited.loopClosed;

			// Loop check depends on race type
			if ( LOOP_REQUIRED.has( raceType ) && ! loopValid && tileCount >= 4 ) {

				issues.push( { severity: 'error', code: 'E_OPEN_LOOP', message: `${ raceType } requires a closed loop`, category: 'connectivity', locus: null } );

			}

		}

		// ── Race-type-specific checks ──

		if ( gameplayMode ) {

			const markers = gameplayMode.getMarkers();
			const spawns = markers.filter( m => m.type === 'spawn' );
			const checkpoints = markers.filter( m => m.type === 'checkpoint' );
			const boosts = markers.filter( m => m.type === 'boost' );
			const powerups = markers.filter( m => m.type === 'powerup' );

			// Spawn count vs racer count
			if ( spawns.length === 0 ) {

				issues.push( { severity: 'warning', code: 'W_NO_SPAWNS', message: 'No racer spawn points', category: 'marker', locus: null } );

			} else if ( spawns.length < racerCount ) {

				issues.push( {
					severity: 'warning', code: 'W_FEW_SPAWNS',
					message: `${ spawns.length } spawns for ${ racerCount } racers`,
					category: 'marker', locus: null,
				} );

			}

			// Checkpoints
			if ( CHECKPOINTS_REQUIRED.has( raceType ) && checkpoints.length === 0 ) {

				issues.push( { severity: 'error', code: 'E_NO_CHECKPOINTS', message: `${ raceType } requires checkpoints`, category: 'marker', locus: null } );

			} else if ( checkpoints.length === 0 ) {

				issues.push( { severity: 'warning', code: 'W_NO_CHECKPOINTS', message: 'No checkpoints (anti-cheat may be weak)', category: 'marker', locus: null } );

			}

			// Powerups / boosts (warnings only)
			if ( powerups.length === 0 ) {

				issues.push( { severity: 'warning', code: 'W_NO_POWERUPS', message: 'No powerup spawns', category: 'marker', locus: null } );

			}

			// Checkpoint order validation
			if ( checkpoints.length > 0 ) {

				const sorted = [ ...checkpoints ].sort( ( a, b ) => a.orderIndex - b.orderIndex );
				for ( let i = 0; i < sorted.length; i ++ ) {

					if ( sorted[ i ].orderIndex !== i ) {

						issues.push( {
							severity: 'warning', code: 'W_CHECKPOINT_ORDER',
							message: `Checkpoint ordering has gaps (expected ${ i }, got ${ sorted[ i ].orderIndex })`,
							category: 'marker', locus: { gx: sorted[ i ].gx, gz: sorted[ i ].gz },
						} );
						break;

					}

				}

			}

		}

		// ── Open end detection ──
		// An "open end" is when a tile exit points to EMPTY space (no tile at all).
		// Two adjacent tiles with non-matching exits is normal (e.g. corner next to straight).
		for ( const [ key, tile ] of grid ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const exits = tile.getExitMask();

			for ( const dir of DIR_INFO ) {

				if ( ! ( exits & dir.bit ) ) continue;

				const nx = gx + dir.dx;
				const nz = gz + dir.dz;
				const nTile = this._project.getTile( nx, nz );

				// Only warn if our exit points to completely empty space
				if ( ! nTile ) {

					issues.push( {
						severity: 'warning', code: 'W_OPEN_END',
						message: `Open end at ${ gx },${ gz } (no tile to the ${ dir.bit === 8 ? 'N' : dir.bit === 4 ? 'S' : dir.bit === 2 ? 'E' : 'W' })`,
						category: 'connectivity',
						locus: { gx, gz, layer: 'track' },
					} );

				}

			}

		}

		// ── Additional warnings ──

		// Short track
		if ( tileCount >= 4 && tileCount < 12 ) {

			issues.push( { severity: 'warning', code: 'W_SHORT_TRACK', message: `Very short track (${ tileCount } tiles)`, category: 'structure', locus: null } );

		}

		// Too many consecutive corners
		let consecutiveCorners = 0;
		let maxConsecutive = 0;
		for ( const [ , tile ] of grid ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;
			if ( tile.type === 'trk-corner-1x1' ) {

				consecutiveCorners ++;
				if ( consecutiveCorners > maxConsecutive ) maxConsecutive = consecutiveCorners;

			} else {

				consecutiveCorners = 0;

			}

		}

		if ( maxConsecutive >= 4 ) {

			issues.push( { severity: 'warning', code: 'W_SHARP_TURNS', message: `${ maxConsecutive } corners in a row — may be hard to drive`, category: 'structure', locus: null } );

		}

		// Elevated tiles with no ramp access
		for ( const [ key, tile ] of grid ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;
			if ( tile.elevation <= 12 ) continue; // ground level

			const [ egx, egz ] = key.split( ',' ).map( Number );
			let hasRampNeighbor = false;

			for ( const dir of DIR_INFO ) {

				const nTile = this._project.getTile( egx + dir.dx, egz + dir.dz );
				if ( nTile && ( nTile.autoRamp || nTile.type.startsWith( 'trk-ramp-' ) ) ) {

					hasRampNeighbor = true;
					break;

				}

			}

			if ( ! hasRampNeighbor ) {

				issues.push( {
					severity: 'warning', code: 'W_NO_RAMP_ACCESS',
					message: `Elevated tile at ${ egx },${ egz } has no ramp`,
					category: 'elevation',
					locus: { gx: egx, gz: egz, layer: 'track' },
				} );

			}

		}

		const valid = ! issues.some( i => i.severity === 'error' );

		const result = {
			valid,
			issues,
			stats: {
				tileCount,
				straightCount,
				cornerCount,
				estimatedLengthM: tileCount * CELL_RAW,
				loopValid,
				raceType,
			},
		};

		this.lastIssues = issues;
		this._eventBus.emit( 'validation:result', result );
		return result;

	}

	/** @private */
	_walkFromFinish( finishKey ) {

		const visited = new Set();
		visited.loopClosed = false;

		const queue = [ finishKey ];

		while ( queue.length > 0 ) {

			const key = queue.shift();
			if ( visited.has( key ) ) {

				if ( key === finishKey && visited.size > 1 ) visited.loopClosed = true;
				continue;

			}

			visited.add( key );

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const tile = this._project.getTile( gx, gz );
			if ( ! tile ) continue;

			const exits = tile.getExitMask();

			for ( const dir of DIR_INFO ) {

				if ( ! ( exits & dir.bit ) ) continue;

				const nx = gx + dir.dx;
				const nz = gz + dir.dz;
				const nKey = this._project.cellKey( nx, nz );
				const nTile = this._project.getTile( nx, nz );

				if ( ! nTile ) continue;

				const nExits = nTile.getExitMask();
				if ( nExits & dir.opposite ) {

					if ( ! visited.has( nKey ) || ( nKey === finishKey && visited.size > 2 ) ) {

						queue.push( nKey );

					}

				}

			}

		}

		return visited;

	}

}
