import * as GhostStorage from './GhostStorage.js';


export class GhostRecorder {

	constructor() {

		this._buffer = []; // raw JS array during recording (fast push)
		this._trackId = null;
		this._bestLapTime = Infinity;

	}

	/**
	 * Set the track ID and load the existing best lap time.
	 */
	init( trackId ) {

		this._trackId = trackId;

		const existing = GhostStorage.load( trackId );
		if ( existing ) {

			this._bestLapTime = existing.lapTime;

		}

	}

	/**
	 * Record the vehicle's current position and rotation.
	 * Called once per frame during racing.
	 */
	record( vehicle ) {

		this._buffer.push(
			vehicle.vehPos.x,
			vehicle.vehPos.y,
			vehicle.vehPos.z,
			vehicle.container.rotation.y
		);

	}

	/**
	 * Finalize the current lap's recording.
	 * If this lap is faster than the stored best, save it.
	 *
	 * @param {number} lapTime — lap duration in seconds
	 * @returns {boolean} true if this was a new best
	 */
	finishLap( lapTime ) {

		if ( lapTime < 5 || this._buffer.length === 0 ) {

			this.reset();
			return false;

		}

		const isBest = lapTime < this._bestLapTime;

		if ( isBest && this._trackId ) {

			const frames = new Float32Array( this._buffer );
			GhostStorage.save( this._trackId, frames, lapTime );
			this._bestLapTime = lapTime;

		}

		this.reset();
		return isBest;

	}

	/**
	 * Clear the recording buffer for the next lap.
	 */
	reset() {

		this._buffer.length = 0;

	}

	/**
	 * Get the current best lap time.
	 */
	get bestLapTime() {

		return this._bestLapTime;

	}

}
