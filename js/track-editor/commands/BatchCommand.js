// ─── BatchCommand ────────────────────────────────────────────────────────────
// Groups multiple commands into a single undoable action.
// Used for drag-draw (multiple tiles placed in one stroke).

import { Command } from '../core/Command.js';

export class BatchCommand extends Command {

	/**
	 * @param {Command[]} commands
	 */
	constructor( commands ) {

		super();
		this._commands = commands;

	}

	execute() {

		for ( const cmd of this._commands ) {

			cmd.execute();

		}

	}

	undo() {

		// Undo in reverse order
		for ( let i = this._commands.length - 1; i >= 0; i -- ) {

			this._commands[ i ].undo();

		}

	}

	get description() {

		return `Batch (${ this._commands.length } actions)`;

	}

}
