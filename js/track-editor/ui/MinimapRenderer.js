// ─── MinimapRenderer ─────────────────────────────────────────────────────────
// 2D canvas minimap overlay showing bird's-eye view of placed tiles.

import { CELL_RAW } from '../../TrackConstants.js';

export class MinimapRenderer {

	/**
	 * @param {HTMLCanvasElement} canvas  The minimap canvas element
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( canvas, project, eventBus ) {

		this._canvas = canvas;
		this._ctx = canvas.getContext( '2d' );
		this._project = project;
		this._eventBus = eventBus;

		// Subscribe to tile changes
		eventBus.on( 'tile:placed', () => this.update() );
		eventBus.on( 'tile:erased', () => this.update() );
		eventBus.on( 'tile:changed', () => this.update() );
		eventBus.on( 'project:loaded', () => this.update() );
		eventBus.on( 'project:cleared', () => this.update() );

	}

	/** Redraw the minimap. */
	update() {

		const ctx = this._ctx;
		const w = this._canvas.width;
		const h = this._canvas.height;

		ctx.clearRect( 0, 0, w, h );

		const grid = this._project.getGrid();
		if ( grid.size === 0 ) return;

		// Find bounds
		let minGx = Infinity, maxGx = -Infinity;
		let minGz = Infinity, maxGz = -Infinity;

		for ( const key of grid.keys() ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			if ( gx < minGx ) minGx = gx;
			if ( gx > maxGx ) maxGx = gx;
			if ( gz < minGz ) minGz = gz;
			if ( gz > maxGz ) maxGz = gz;

		}

		// Add padding
		minGx -= 2; maxGx += 2;
		minGz -= 2; maxGz += 2;

		const rangeX = maxGx - minGx + 1;
		const rangeZ = maxGz - minGz + 1;
		const cellW = w / rangeX;
		const cellH = h / rangeZ;
		const cellSize = Math.min( cellW, cellH );

		const offsetX = ( w - rangeX * cellSize ) / 2;
		const offsetZ = ( h - rangeZ * cellSize ) / 2;

		// Draw tiles
		for ( const [ key, tile ] of grid ) {

			if ( tile._consumed || tile.finishFlank ) continue;

			const [ gx, gz ] = key.split( ',' ).map( Number );
			const px = offsetX + ( gx - minGx ) * cellSize;
			const py = offsetZ + ( gz - minGz ) * cellSize;

			// Color by type
			if ( tile.isFinish ) {

				ctx.fillStyle = '#ff3a8c';

			} else if ( tile.autoRamp ) {

				ctx.fillStyle = '#f59e0b';

			} else if ( tile.type === 'trk-corner-1x1' ) {

				ctx.fillStyle = '#00d4e8';

			} else if ( tile.type.startsWith( 'trk-elev-' ) ) {

				ctx.fillStyle = '#22c55e';

			} else {

				ctx.fillStyle = '#888888';

			}

			ctx.fillRect( px + 0.5, py + 0.5, cellSize - 1, cellSize - 1 );

		}

	}

}
