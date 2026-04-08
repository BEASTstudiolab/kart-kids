// ─── DebugMode ───────────────────────────────────────────────────────────────
// Debug overlay toggle. Coexists with any other active mode.
// Shows tile names, sequence numbers, connectivity, and elevations.

import { EditorMode } from './EditorMode.js';

export class DebugMode extends EditorMode {

	/**
	 * @param {import('../core/EditorState.js').EditorState} editorState
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 * @param {import('../services/DebugOverlayService.js').DebugOverlayService} debugOverlay
	 */
	constructor( editorState, eventBus, debugOverlay ) {

		super( editorState, eventBus );
		this._debug = debugOverlay;

	}

	enter() {

		this._debug.setEnabled( true );

	}

	exit() {

		this._debug.setEnabled( false );

	}

	handlePointerMove( gx, gz, event ) {

		this._debug.updateTooltip( gx, gz, event.clientX, event.clientY );

	}

}
