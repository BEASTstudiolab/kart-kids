// ─── CommandHistory ──────────────────────────────────────────────────────────
// Manages the undo/redo stack. Executes commands and tracks them for reversal.

const MAX_UNDO = 100;

export class CommandHistory {

	/**
	 * @param {import('./EventBus.js').EventBus} eventBus
	 */
	constructor( eventBus ) {

		this._eventBus = eventBus;

		/** @type {import('./Command.js').Command[]} */
		this._undoStack = [];

		/** @type {import('./Command.js').Command[]} */
		this._redoStack = [];

	}

	/**
	 * Execute a command and push it onto the undo stack.
	 * Clears the redo stack.
	 * @param {import('./Command.js').Command} command
	 */
	execute( command ) {

		command.execute();

		this._undoStack.push( command );

		if ( this._undoStack.length > MAX_UNDO ) {

			this._undoStack.shift();

		}

		this._redoStack.length = 0;

		this._notify();

	}

	/** Undo the most recent command. */
	undo() {

		if ( this._undoStack.length === 0 ) return;

		const command = this._undoStack.pop();
		command.undo();
		this._redoStack.push( command );

		this._notify();

	}

	/** Redo the most recently undone command. */
	redo() {

		if ( this._redoStack.length === 0 ) return;

		const command = this._redoStack.pop();
		command.execute();
		this._undoStack.push( command );

		this._notify();

	}

	/** @returns {boolean} */
	canUndo() {

		return this._undoStack.length > 0;

	}

	/** @returns {boolean} */
	canRedo() {

		return this._redoStack.length > 0;

	}

	/** Clear all history. */
	clear() {

		this._undoStack.length = 0;
		this._redoStack.length = 0;
		this._notify();

	}

	/** @private */
	_notify() {

		this._eventBus.emit( 'undo:stateChanged', {
			canUndo: this.canUndo(),
			canRedo: this.canRedo(),
		} );

	}

}
