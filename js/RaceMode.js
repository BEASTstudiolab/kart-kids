import { GameMode } from './GameMode.js';
import { FinishLine } from './FinishLine.js';

const STATE_IDLE = 'idle';
const STATE_COUNTDOWN = 'countdown';
const STATE_RACING = 'racing';
const STATE_FINISHED = 'finished';

const COUNTDOWN_DURATION = 3; // seconds
const NETWORK_COUNTDOWN_TIMEOUT = 15; // seconds — fallback if server stops sending countdown
const ZERO_INPUT = { x: 0, z: 0, touchActive: false, boost: false, drift: false, gas: false, brake: false };

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

		// Elimination manager (set externally)
		this.eliminationManager = null;
		this._lastSegmentHint = null;
		this._position = 1;
		this._aiVehicleSet = new Set();

		this._state = STATE_IDLE;
		this._countdownTime = 0;
		this._networkCountdownElapsed = 0;
		this._countdownNumber = COUNTDOWN_DURATION;
		this._lastCountdownTick = - 1;

		this._lap = 0;
		this._elapsedTime = 0;
		this._lapStartTime = 0;
		this._bestLap = Infinity;
		this._totalTime = 0;

		this._finishLine = null;
		this._prevPos = null;

		this._displayState = {};

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

	update( dt, vehicle, activeVehicles, aiRaceData ) {

		this._vehicle = vehicle;

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

		if ( this._state === STATE_COUNTDOWN && this.networkDriven ) {

			this._networkCountdownElapsed += dt;

			if ( this._networkCountdownElapsed >= NETWORK_COUNTDOWN_TIMEOUT ) {

				console.warn( '[RaceMode] Network countdown timed out — starting race locally' );
				this._transitionToRacing();

			}

		}

		if ( this._state === STATE_RACING ) {

			this._elapsedTime += dt;
			this._checkFinishLine( vehicle );
			this._updatePosition( vehicle, activeVehicles, aiRaceData );

		}

	}

	// Called by network when server drives the countdown
	setCountdown( count ) {

		// Ignore stale messages if already racing or finished
		if ( this._state === STATE_RACING ) return;

		this._networkCountdownElapsed = 0;

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

		if ( this._state === STATE_RACING || this._state === STATE_IDLE ) return input;
		return ZERO_INPUT;

	}

	get lapElapsed() {

		return this._elapsedTime - this._lapStartTime;

	}

	getDisplayState() {

		const v = this._vehicle;
		const s = this._displayState;

		s.state = this._state;
		s.countdown = this._countdownNumber;
		s.lap = this._lap;
		s.totalLaps = this.totalLaps;
		s.elapsedTime = this._elapsedTime;
		s.bestLap = this._bestLap === Infinity ? 0 : this._bestLap;
		s.totalTime = this._totalTime;
		s.position = this._position;
		s.boostMeter = v ? v.boostMeter : 0;
		s.boostActive = v ? v.boostActive : false;
		s.shieldActive = v ? v.shieldActive : false;
		s.starActive = v ? v.starActive : false;
		s.driftActive = v ? v.driftActive : false;
		s.driftSparkTier = v ? v.driftSparkTier : 0;
		s.offTrackTimer = v ? v._offTrackTimer : 0;
		s.offTrackGrace = v ? v._offTrackGrace : 2.0;

		return s;

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
		this._networkCountdownElapsed = 0;
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

	_updatePosition( vehicle, activeVehicles, aiRaceData ) {

		if ( ! this.trackIntel || ! vehicle || ! activeVehicles ) {

			this._position = 1;
			return;

		}

		const pos = vehicle.vehPos;
		const myProgress = this._lap + this.trackIntel.getProgress(
			pos.x, pos.z, this._lastSegmentHint
		);

		// Update segment hint for windowed search next frame
		this._lastSegmentHint = this.trackIntel.getNearestWaypoint( pos.x, pos.z );

		let ahead = 0;

		// AI racers with known lap counts — use full race progress
		this._aiVehicleSet.clear();
		if ( aiRaceData ) {

			for ( const ai of aiRaceData ) {

				this._aiVehicleSet.add( ai.vehicle );

				// Skip eliminated vehicles in position ranking
				if ( this.eliminationManager && this.eliminationManager.isEliminated( ai.vehicle ) ) continue;

				const vPos = ai.vehicle.vehPos;
				const vProgress = ai.lap + this.trackIntel.getProgress( vPos.x, vPos.z );
				if ( vProgress > myProgress ) ahead ++;

			}

		}

		// Remote human players — intra-lap progress only (no network lap data)
		for ( const entry of activeVehicles ) {

			const v = entry.vehicle;
			if ( v === vehicle ) continue;
			if ( this._aiVehicleSet.has( v ) ) continue;

			const vPos = v.vehPos;
			const vProgress = this.trackIntel.getProgress( vPos.x, vPos.z );

			if ( vProgress > myProgress ) ahead ++;

		}

		this._position = ahead + 1;

	}

	_checkFinishLine( vehicle ) {

		if ( ! this._finishLine || ! vehicle ) return;

		const currPos = vehicle.vehPos;

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
