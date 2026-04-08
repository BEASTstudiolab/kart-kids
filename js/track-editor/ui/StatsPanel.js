// ─── StatsPanel ──────────────────────────────────────────────────────────────
// Displays piece counts, track length, and loop status in the viewport overlay.

import { CELL_RAW } from '../../TrackConstants.js';

export class StatsPanel {

	/**
	 * @param {HTMLElement} container  The stats overlay element
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( container, project, eventBus ) {

		this._container = container;
		this._project = project;
		this._eventBus = eventBus;

		this._loopValid = false;

		// Subscribe to updates
		eventBus.on( 'tile:placed', () => this.update() );
		eventBus.on( 'tile:erased', () => this.update() );
		eventBus.on( 'tile:changed', () => this.update() );
		eventBus.on( 'project:loaded', () => this.update() );
		eventBus.on( 'project:cleared', () => this.update() );
		eventBus.on( 'validation:result', ( r ) => {

			this._loopValid = r.stats?.loopValid ?? false;
			this.update();

		} );

		this.update();

	}

	/** Recalculate and redraw stats. */
	update() {

		const grid = this._project.getGrid();
		let pieces = 0, straights = 0, corners = 0;

		for ( const [ , tile ] of grid ) {

			if ( tile.autoRamp || tile._consumed || tile.finishFlank ) continue;
			pieces++;
			if ( tile.type === 'trk-straight' || tile.type.startsWith( 'trk-elev-' ) ) straights++;
			if ( tile.type === 'trk-corner-1x1' ) corners++;

		}

		const lengthM = Math.round( pieces * CELL_RAW );
		const loopClass = this._loopValid ? 'kk-editor-stats__value--ok' : 'kk-editor-stats__value--error';
		const loopText = this._loopValid ? 'Yes' : 'No';

		this._container.innerHTML = `
			<div class="kk-editor-stats__row">
				<span class="kk-editor-stats__label">Pieces</span>
				<span class="kk-editor-stats__value">${pieces}</span>
			</div>
			<div class="kk-editor-stats__row">
				<span class="kk-editor-stats__label">Straight</span>
				<span class="kk-editor-stats__value">${straights}</span>
			</div>
			<div class="kk-editor-stats__row">
				<span class="kk-editor-stats__label">Corners</span>
				<span class="kk-editor-stats__value">${corners}</span>
			</div>
			<div class="kk-editor-stats__row">
				<span class="kk-editor-stats__label">Length</span>
				<span class="kk-editor-stats__value">${lengthM}m</span>
			</div>
			<div class="kk-editor-stats__row">
				<span class="kk-editor-stats__label">Loop</span>
				<span class="kk-editor-stats__value ${loopClass}">${loopText}</span>
			</div>
		`;

	}

}
