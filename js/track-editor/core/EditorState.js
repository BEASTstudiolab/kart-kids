// ─── EditorState ─────────────────────────────────────────────────────────────
// Observable state container for the editor. Holds mode, tool, selection, and
// debug toggle. Emits events via EventBus on changes.

export class EditorState {

	/**
	 * @param {import('./EventBus.js').EventBus} eventBus
	 */
	constructor( eventBus ) {

		this._eventBus = eventBus;

		this._mode = 'build';
		this._tool = 'road';
		this._debugEnabled = false;

		/** @type {Set<string>} cell keys of selected tiles */
		this.selection = new Set();

		/** Hovered grid cell or null. @type {{ gx: number, gz: number }|null} */
		this.hoveredCell = null;

		/** Currently selected tile type for placement. @type {string|null} */
		this.selectedTileType = null;

		/** Selected orientation for placement. 0=0deg, 16=90deg, 10=180deg, 22=270deg. */
		this.selectedOrient = 0;

		/** Active layer. @type {'track'|'decor'|'props'|'markers'} */
		this.activeLayer = 'track';

		/** Active elevation plane for new tile placement. Step index (12=ground). */
		this._activeElevation = 12;

	}

	// ── Active Elevation ──

	/** @returns {number} Step index (0-24, 12=ground) */
	get activeElevation() { return this._activeElevation; }

	set activeElevation( value ) {

		const clamped = Math.max( 0, Math.min( 24, value ) );
		if ( clamped === this._activeElevation ) return;
		this._activeElevation = clamped;
		this._eventBus.emit( 'activeElevation:changed', { step: clamped, meters: ( clamped - 12 ) * 2.5 } );

	}

	// ── Mode ──

	/** @returns {'build'|'sculpt'|'gameplay'|'decor'|'prop'|'theme'} */
	get mode() { return this._mode; }

	set mode( value ) {

		if ( value === this._mode ) return;
		const prev = this._mode;
		this._mode = value;
		this._eventBus.emit( 'mode:changed', { mode: value, prevMode: prev } );

	}

	// ── Tool ──

	/** @returns {string} */
	get tool() { return this._tool; }

	set tool( value ) {

		if ( value === this._tool ) return;
		const prev = this._tool;
		this._tool = value;
		this._eventBus.emit( 'tool:changed', { tool: value, prevTool: prev } );

	}

	// ── Debug ──

	/** @returns {boolean} */
	get debugEnabled() { return this._debugEnabled; }

	set debugEnabled( value ) {

		if ( value === this._debugEnabled ) return;
		this._debugEnabled = value;
		this._eventBus.emit( 'debug:toggled', { enabled: value } );

	}

}
