/**
 * AdaptiveDifficulty — auto-adjusts AI rubber-banding based on player performance.
 *
 * Tracks recent finish positions in localStorage. After each race, nudges the
 * difficulty value toward a target that keeps the player finishing mid-pack.
 *
 * Difficulty is a 0-100 value where 0 = no rubber-banding, 100 = maximum.
 */

const STORAGE_KEY = 'racing-adaptive-difficulty';
const HISTORY_SIZE = 5;
const STEP_SIZE = 8; // difficulty points per adjustment

export class AdaptiveDifficulty {

	constructor( settings ) {

		this._settings = settings;
		this._history = [];
		this._load();

	}

	/**
	 * Called after a race finishes.
	 * @param {number} position - Player's finish position (1-based)
	 * @param {number} totalRacers - Total racers in the race
	 */
	recordFinish( position, totalRacers ) {

		if ( totalRacers < 2 ) return;

		// Normalize position to 0-1 (0 = first, 1 = last)
		const normalized = ( position - 1 ) / ( totalRacers - 1 );
		this._history.push( normalized );

		if ( this._history.length > HISTORY_SIZE ) {

			this._history.shift();

		}

		this._save();
		this._adjust();

	}

	_adjust() {

		if ( this._history.length < 2 ) return;

		// Average recent finish position (0 = always first, 1 = always last)
		const avg = this._history.reduce( ( a, b ) => a + b, 0 ) / this._history.length;

		// Target: finish around 0.3-0.5 (2nd-3rd out of 5-6 racers)
		const current = this._settings.get( 'difficulty' ) ?? 50;
		let next = current;

		if ( avg < 0.2 ) {

			// Player dominates — reduce rubber-banding (make it harder)
			next = Math.max( 0, current - STEP_SIZE );

		} else if ( avg > 0.6 ) {

			// Player struggles — increase rubber-banding (make it easier)
			next = Math.min( 100, current + STEP_SIZE );

		}

		// No change if player is in the sweet spot (0.2-0.6)

		if ( next !== current ) {

			this._settings.set( 'difficulty', next );

		}

	}

	_load() {

		try {

			const raw = localStorage.getItem( STORAGE_KEY );
			if ( raw ) this._history = JSON.parse( raw );

		} catch {

			this._history = [];

		}

	}

	_save() {

		try {

			localStorage.setItem( STORAGE_KEY, JSON.stringify( this._history ) );

		} catch {

			// localStorage full or unavailable

		}

	}

}
