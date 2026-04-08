// ─── ThemeMode ───────────────────────────────────────────────────────────────
// For switching track themes and time of day.
// No grid interaction — uses dropdown selection in the inspector.

import { EditorMode } from './EditorMode.js';

export class ThemeMode extends EditorMode {

	constructor( editorState, eventBus ) {

		super( editorState, eventBus );

	}

	enter() {

		this._state.tool = 'theme';

	}

	getTools() {

		return [
			{ id: 'theme', name: 'Theme', icon: 'palette' },
			{ id: 'tod', name: 'Time of Day', icon: 'sun' },
		];

	}

}
