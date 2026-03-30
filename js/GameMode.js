/**
 * Game mode base contract.
 * All game modes implement these methods.
 * The main loop delegates to the active mode for input filtering, state updates, and display.
 */
export class GameMode {

	start() {}

	update( /* dt, vehicle */ ) {}

	filterInput( input ) { return input; }

	getDisplayState() { return { state: 'idle' }; }

	isFinished() { return false; }

	getResults() { return null; }

	reset() {}

}
