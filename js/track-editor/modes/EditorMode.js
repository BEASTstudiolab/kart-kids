// ─── EditorMode (base class) ─────────────────────────────────────────────────
// Abstract base for all editor modes (State pattern).
// Each mode implements its own pointer/key handling and tool configuration.

export class EditorMode {

	/**
	 * @param {import('../core/EditorState.js').EditorState} editorState
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( editorState, eventBus ) {

		this._state = editorState;
		this._eventBus = eventBus;

	}

	/** Called when this mode becomes active. */
	enter() {}

	/** Called when this mode is deactivated. */
	exit() {}

	/**
	 * Handle pointer down on a grid cell.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {PointerEvent} event
	 */
	handlePointerDown( gx, gz, event ) {}

	/**
	 * Handle pointer move (drag or hover) on a grid cell.
	 * @param {number} gx
	 * @param {number} gz
	 * @param {PointerEvent} event
	 */
	handlePointerMove( gx, gz, event ) {}

	/**
	 * Handle pointer up.
	 * @param {PointerEvent} event
	 */
	handlePointerUp( event ) {}

	/**
	 * Handle key down. Return true if the key was consumed.
	 * @param {string} code  KeyboardEvent.code
	 * @param {KeyboardEvent} event
	 * @returns {boolean}
	 */
	handleKeyDown( code, event ) { return false; }

	/**
	 * Get toolbar tool definitions for this mode.
	 * @returns {Array<{ id: string, name: string, icon: string }>}
	 */
	getTools() { return []; }

	/** @returns {string} Current tool name. */
	getActiveTool() { return this._state.tool; }

	/** @param {string} toolName */
	setTool( toolName ) { this._state.tool = toolName; }

}
