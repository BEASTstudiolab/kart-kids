/**
 * EliminationManager — Tracks eliminated vehicles for race logic.
 */

export class EliminationManager {

	constructor() {

		/** @type {Set<object>} eliminated vehicle references */
		this._eliminated = new Set();

		/** Called when a vehicle is eliminated: (vehicle) => void */
		this.onEliminate = null;

	}

	/**
	 * Mark a vehicle as eliminated.
	 */
	eliminate( vehicle ) {

		if ( this._eliminated.has( vehicle ) ) return;
		this._eliminated.add( vehicle );

		if ( this.onEliminate ) this.onEliminate( vehicle );

	}

	/**
	 * Check if a vehicle has been eliminated.
	 */
	isEliminated( vehicle ) {

		return this._eliminated.has( vehicle );

	}

	/**
	 * Get count of remaining (non-eliminated) vehicles.
	 * @param {number} totalActive - total active vehicles in race
	 */
	getRemainingCount( totalActive ) {

		return totalActive - this._eliminated.size;

	}

	/**
	 * Get all eliminated vehicles.
	 */
	getEliminated() {

		return this._eliminated;

	}

	reset() {

		this._eliminated.clear();

	}

}
