/**
 * AFKDetector — drops inactive players to spectator mode.
 *
 * Tracks vehicle position each frame. If the player hasn't moved
 * more than a small threshold for `timeout` seconds, fires onAFK.
 */

export class AFKDetector {

	constructor( { timeout = 60, movementThreshold = 0.1, onAFK } ) {

		this._timeout = timeout;
		this._threshold = movementThreshold;
		this._onAFK = onAFK || null;

		this._lastX = 0;
		this._lastZ = 0;
		this._idleTime = 0;
		this._afk = false;
		this._initialized = false;

	}

	/**
	 * Called every frame for the local (non-spectating) player.
	 */
	update( dt, vehicle ) {

		if ( ! vehicle ) return;

		const x = vehicle.vehPos.x;
		const z = vehicle.vehPos.z;

		if ( ! this._initialized ) {

			this._lastX = x;
			this._lastZ = z;
			this._initialized = true;
			return;

		}

		const dx = x - this._lastX;
		const dz = z - this._lastZ;
		const dist = Math.sqrt( dx * dx + dz * dz );

		if ( dist > this._threshold ) {

			// Player moved — reset timer
			this._idleTime = 0;
			this._lastX = x;
			this._lastZ = z;
			this._afk = false;

		} else {

			this._idleTime += dt;

		}

		if ( this._idleTime >= this._timeout && ! this._afk ) {

			this._afk = true;
			if ( this._onAFK ) this._onAFK();

		}

	}

	/**
	 * Reset the idle timer (called when player un-spectates, race starts, etc).
	 */
	reset() {

		this._idleTime = 0;
		this._afk = false;
		this._initialized = false;

	}

	get isAFK() {

		return this._afk;

	}

}
