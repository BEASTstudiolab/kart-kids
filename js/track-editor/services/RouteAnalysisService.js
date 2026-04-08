// ─── RouteAnalysisService ────────────────────────────────────────────────────
// Determines sequence order, loop closure, and route continuity.
// Separated from ValidationService for reuse by debug overlays and route trace.

import { DIR_INFO } from './AutoTileService.js';
import { CELL_RAW } from '../../TrackConstants.js';

export class RouteAnalysisService {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 */
	constructor( project ) {

		this._project = project;

	}

	/**
	 * Walk the track from the finish tile and return the ordered sequence.
	 * @returns {{ sequence: Array<{ key: string, gx: number, gz: number, index: number }>, loopClosed: boolean, finishKey: string|null }}
	 */
	analyzeRoute() {

		const grid = this._project.getGrid();
		let finishKey = null;

		// Find finish tile
		for ( const [ key, tile ] of grid ) {

			if ( tile.isFinish ) {

				finishKey = key;
				break;

			}

		}

		if ( ! finishKey ) return { sequence: [], loopClosed: false, finishKey: null };

		// Walk from finish following connectivity
		const visited = new Set();
		const sequence = [];
		let current = finishKey;
		let loopClosed = false;

		while ( current ) {

			if ( visited.has( current ) ) {

				if ( current === finishKey && sequence.length > 2 ) loopClosed = true;
				break;

			}

			visited.add( current );
			const [ gx, gz ] = current.split( ',' ).map( Number );
			sequence.push( { key: current, gx, gz, index: sequence.length } );

			const tile = this._project.getTile( gx, gz );
			if ( ! tile ) break;

			const exits = tile.getExitMask();
			let next = null;

			for ( const dir of DIR_INFO ) {

				if ( ! ( exits & dir.bit ) ) continue;

				const nx = gx + dir.dx;
				const nz = gz + dir.dz;
				const nKey = this._project.cellKey( nx, nz );
				const nTile = this._project.getTile( nx, nz );

				if ( ! nTile ) continue;

				const nExits = nTile.getExitMask();
				if ( ! ( nExits & dir.opposite ) ) continue;

				if ( ! visited.has( nKey ) || ( nKey === finishKey && sequence.length > 2 ) ) {

					next = nKey;
					break;

				}

			}

			current = next;

		}

		return { sequence, loopClosed, finishKey };

	}

	/**
	 * Get sequence numbers as a Map: cellKey -> sequenceIndex.
	 * @returns {Map<string, number>}
	 */
	getSequenceMap() {

		const { sequence } = this.analyzeRoute();
		const map = new Map();
		for ( const entry of sequence ) map.set( entry.key, entry.index );
		return map;

	}

	/**
	 * Estimate track length in meters based on sequence.
	 * @returns {number}
	 */
	getTrackLength() {

		const { sequence } = this.analyzeRoute();
		return sequence.length * CELL_RAW;

	}

	/**
	 * Find tiles not reached by the route walk (disconnected).
	 * @returns {Array<{ key: string, gx: number, gz: number }>}
	 */
	getDisconnectedTiles() {

		const { sequence } = this.analyzeRoute();
		const reached = new Set( sequence.map( s => s.key ) );
		const disconnected = [];

		for ( const [ key, tile ] of this._project.getGrid() ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;
			if ( ! reached.has( key ) ) {

				const [ gx, gz ] = key.split( ',' ).map( Number );
				disconnected.push( { key, gx, gz } );

			}

		}

		return disconnected;

	}

	/**
	 * Find open ends: tiles with exits that have no matching neighbor connection.
	 * For each open end, suggest a compatible tile type to close the gap.
	 * @returns {Array<{ gx: number, gz: number, direction: object, suggestedType: string, suggestedOrient: number }>}
	 */
	findOpenEnds() {

		const openEnds = [];
		const grid = this._project.getGrid();

		for ( const [ key, tile ] of grid ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const exits = tile.getExitMask();

			for ( const dir of DIR_INFO ) {

				if ( ! ( exits & dir.bit ) ) continue;

				const nx = gx + dir.dx;
				const nz = gz + dir.dz;
				const neighbor = this._project.getTile( nx, nz );

				// Open end: our exit points to empty space
				if ( ! neighbor ) {

					// Suggest a straight tile aligned with the exit direction
					const isHorizontal = dir.bit === 2 || dir.bit === 1; // E or W
					const suggestedOrient = isHorizontal ? 16 : 0;

					openEnds.push( {
						gx: nx,
						gz: nz,
						direction: dir,
						fromGx: gx,
						fromGz: gz,
						suggestedType: 'trk-straight',
						suggestedOrient: suggestedOrient,
					} );

				}

			}

		}

		return openEnds;

	}

}
