// ─── Command (base interface) ────────────────────────────────────────────────
// All undoable editor actions extend this class and implement execute() / undo().

export class Command {

	/** Perform the action. */
	execute() {

		throw new Error( 'Command.execute() must be implemented' );

	}

	/** Reverse the action. */
	undo() {

		throw new Error( 'Command.undo() must be implemented' );

	}

	/** Human-readable description for debug/history UI. */
	get description() {

		return 'Command';

	}

}
