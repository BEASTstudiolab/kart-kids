import { GameMode } from './GameMode.js';
import { FinishLine } from './FinishLine.js';

const STATE_IDLE = 'idle';
const STATE_COUNTDOWN = 'countdown';
const STATE_RACING = 'racing';
const STATE_FINISHED = 'finished';

const COUNTDOWN_DURATION = 3; // seconds
const ZERO_INPUT = { x: 0, z: 0, touchActive: false };

export class RaceMode extends GameMode {

	constructor( { totalLaps = 3, spawnPosition, spawnAngle, onCountdownTick } = {} ) {

		super();

		this.totalLaps = totalLaps;
		this.spawnPosition = spawnPosition;
		this.spawnAngle = spawnAngle;

		// Callback for countdown ticks — called with (count) where 3,2,1 = beep, 0 = GO
		this.onCountdownTick = onCountdownTick || null;

		// Callback for lap completions — called with (lap, lapTime)
		this.onLapComplete = null;

		// Whether countdown is driven by network (multiplayer) or local timer
		this.networkDriven = false;

		// Track intelligence for position ranking (set externally after construction)
		this.trackIntel = null;
		this._lastSegmentHint = null;
		this._position = 1;

		this._state = STATE_IDLE;
		this._countdownTime = 0;
		this._countdownNumber = COUNTDOWN_DURATION;
		this._lastCountdownTick = - 1;

		this._lap = 0;
		this._elapsedTime = 0;
		this._lapStartTime = 0;
		this._bestLap = Infinity;
		this._totalTime = 0;

		this._finishLine = null;
		this._prevPos = null;

	}

	initFinishLine( position, angle ) {

		this._finishLine = new FinishLine( { position, angle } );

	}

	start() {

		if ( this._state !== STATE_IDLE && this._state !== STATE_FINISHED ) return;

		this._state = STATE_COUNTDOWN;
		this._countdownTime = 0;
		this._countdownNumber = COUNTDOWN_DURATION;
		this._lastCountdownTick = - 1;

		this._lap = 0;
		this._elapsedTime = 0;
		this._lapStartTime = 0;
		this._bestLap = Infinity;
		this._totalTime = 0;
		this._prevPos = null;

		if ( this._finishLine ) this._finishLine.resetCooldown();

	}

	update( dt, vehicle, activeVehicles ) {

		if ( this._state === STATE_COUNTDOWN && ! this.networkDriven ) {

			this._countdownTime += dt;
			const newNumber = COUNTDOWN_DURATION - Math.floor( this._countdownTime );

			if ( newNumber !== this._lastCountdownTick && newNumber >= 0 ) {

				this._countdownNumber = newNumber;
				this._lastCountdownTick = newNumber;
				if ( this.onCountdownTick ) this.onCountdownTick( newNumber );

			}

			if ( this._countdownTime >= COUNTDOWN_DURATION ) {

				this._transitionToRacing();

			}

		}

		if ( this._state === STATE_RACING ) {

			this._elapsedTime += dt;
			this._checkFinishLine( vehicle );
			this._updatePosition( vehicle, activeVehicles );

		}

	}

	// Called by network when server drives the countdown
	setCountdown( count ) {

		// Ignore stale messages if already racing or finished
		if ( this._state === STATE_RACING ) return;

		if ( this._state === STATE_IDLE || this._state === STATE_FINISHED ) {

			// Reset stats for the new race
			this._lap = 0;
			this._elapsedTime = 0;
			this._lapStartTime = 0;
			this._bestLap = Infinity;
			this._totalTime = 0;
			this._prevPos = null;
			if ( this._finishLine ) this._finishLine.resetCooldown();

			this._state = STATE_COUNTDOWN;
			this._lastCountdownTick = - 1;

		}

		this._countdownNumber = count;

		if ( count !== this._lastCountdownTick ) {

			this._lastCountdownTick = count;
			if ( this.onCountdownTick ) this.onCountdownTick( count );

		}

		if ( count <= 0 ) {

			this._transitionToRacing();

		}

	}

	filterInput( input ) {

		if ( this._state === STATE_RACING ) return input;
		return ZERO_INPUT;

	}

	getDisplayState() {

		return {
			state: this._state,
			countdown: this._countdownNumber,
			lap: this._lap,
			totalLaps: this.totalLaps,
			elapsedTime: this._elapsedTime,
			bestLap: this._bestLap === Infinity ? 0 : this._bestLap,
			totalTime: this._totalTime,
			position: this._position,
		};

	}

	isFinished() {

		return this._state === STATE_FINISHED;

	}

	getResults() {

		if ( this._state !== STATE_FINISHED ) return null;

		return {
			totalTime: this._totalTime,
			bestLap: this._bestLap === Infinity ? 0 : this._bestLap,
			laps: this.totalLaps,
		};

	}

	reset() {

		this._state = STATE_IDLE;
		this.networkDriven = false;
		this._countdownTime = 0;
		this._countdownNumber = COUNTDOWN_DURATION;
		this._lastCountdownTick = - 1;
		this._lap = 0;
		this._elapsedTime = 0;
		this._lapStartTime = 0;
		this._bestLap = Infinity;
		this._totalTime = 0;
		this._prevPos = null;
		this._lastSegmentHint = null;
		this._position = 1;

		if ( this._finishLine ) this._finishLine.resetCooldown();

	}

	get state() { return this._state; }

	get lap() { return this._lap; }

	_transitionToRacing() {

		this._state = STATE_RACING;
		this._elapsedTime = 0;
		this._lapStartTime = 0;
		this._lap = 0;
		this._prevPos = null;

	}

	_updatePosition( vehicle, activeVehicles ) {

		if ( ! this.trackIntel || ! vehicle || ! activeVehicles ) {

			this._position = 1;
			return;

		}

		const pos = vehicle.spherePos;
		const myProgress = this._lap + this.trackIntel.getProgress(
			pos.x, pos.z, this._lastSegmentHint
		);

		// Update segment hint for windowed search next frame
		this._lastSegmentHint = this.trackIntel.getNearestWaypoint( pos.x, pos.z );

		// Note: remote vehicles' lap counts are not available via network,
		// so we use intra-lap progress (0-1) for relative ordering.
		// Cross-lap ranking requires network protocol changes (future work).
		let ahead = 0;

		for ( const entry of activeVehicles ) {

			const v = entry.vehicle;
			if ( v === vehicle ) continue;

			const vPos = v.spherePos;
			const vProgress = this.trackIntel.getProgress( vPos.x, vPos.z );

			if ( vProgress > myProgress ) ahead ++;

		}

		this._position = ahead + 1;

	}

	_checkFinishLine( vehicle ) {

		if ( ! this._finishLine || ! vehicle ) return;

		const currPos = vehicle.spherePos;

		if ( this._prevPos === null ) {

			this._prevPos = currPos.clone();
			return;

		}

		const result = this._finishLine.check( this._prevPos, currPos );
		this._prevPos.copy( currPos );

		if ( result.crossed && result.direction === 'forward' ) {

			this._lap ++;

			const lapTime = this._elapsedTime - this._lapStartTime;

			if ( lapTime > 0 && lapTime < this._bestLap ) {

				this._bestLap = lapTime;

			}

			this._lapStartTime = this._elapsedTime;

			if ( this.onLapComplete ) this.onLapComplete( this._lap, lapTime );

			if ( this._lap >= this.totalLaps ) {

				this._totalTime = this._elapsedTime;
				this._state = STATE_FINISHED;

			}

		}

	}

}
