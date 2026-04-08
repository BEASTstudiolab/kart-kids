/**
 * VehicleStateMachine — Explicit physics state tracking for the vehicle.
 *
 * Runs alongside the existing DrivingState enum (NORMAL/DRIFTING/AIRBORNE)
 * which manages drift. This state machine is for the vertical/physics pipeline:
 * grounded movement, ramp approach, takeoff, airborne, landing, recovery,
 * off-track detection, and respawn flow.
 *
 * Vehicle.js feeds signals each frame; the state machine decides the current
 * state and fires onEnter/onExit callbacks.
 */

export const PhysicsState = {
	GROUNDED: 0,
	RAMP_APPROACH: 1,
	TAKEOFF: 2,
	AIRBORNE: 3,
	LANDING: 4,
	RECOVERY: 5,
	OFF_TRACK: 6,
	RESPAWNING: 7,
};

const STATE_NAMES = [
	'GROUNDED',
	'RAMP_APPROACH',
	'TAKEOFF',
	'AIRBORNE',
	'LANDING',
	'RECOVERY',
	'OFF_TRACK',
	'RESPAWNING',
];

export class VehicleStateMachine {

	constructor() {

		this.currentState = PhysicsState.GROUNDED;
		this.previousState = PhysicsState.GROUNDED;
		this.stateTimer = 0;

		// Landing severity from last landing (set by VehicleAirborne, read by Vehicle)
		this.landingSeverity = 'clean';

		// Recovery duration (set on LANDING enter, counts down in RECOVERY)
		this._recoveryDuration = 0;

		// Callbacks: { [state]: { enter: fn, exit: fn } }
		this._callbacks = {};

	}

	/**
	 * Register enter/exit callbacks for a state.
	 * @param {number} state - PhysicsState enum value
	 * @param {Function} [onEnter] - called when entering the state
	 * @param {Function} [onExit] - called when leaving the state
	 */
	on( state, onEnter, onExit ) {

		this._callbacks[ state ] = { enter: onEnter || null, exit: onExit || null };

	}

	/**
	 * Evaluate signals and transition state. Called once per frame.
	 *
	 * @param {object} signals
	 * @param {boolean} signals.grounded       - any wheel touching surface
	 * @param {boolean} signals.onRamp          - surface normal indicates ramp
	 * @param {boolean} signals.frontOffEdge    - front wheels off surface edge
	 * @param {number}  signals.verticalVelocity - current vertical speed
	 * @param {number}  signals.vehicleY        - current vehicle Y position
	 * @param {number}  signals.targetY         - ground height + ride height
	 * @param {number}  signals.groundHeight    - raw ground height
	 * @param {number}  signals.speed           - abs linear speed 0–1
	 * @param {boolean} signals.recentWallHit   - wall contact within cooldown
	 * @param {boolean} signals.offTrack        - off-track condition detected
	 * @param {boolean} signals.respawnRequested - respawn trigger (kill plane, flip, etc.)
	 * @param {number}  dt                      - frame delta time
	 * @returns {number} current PhysicsState
	 */
	evaluate( signals, dt ) {

		this.stateTimer += dt;

		const next = this._getNextState( signals );

		if ( next !== this.currentState ) {

			this._transition( next );

		}

		return this.currentState;

	}

	/**
	 * Force a state transition (used by external systems like respawn).
	 */
	forceState( state ) {

		if ( state !== this.currentState ) {

			this._transition( state );

		}

	}

	/**
	 * Get the display name of the current state.
	 */
	getStateName() {

		return STATE_NAMES[ this.currentState ] || 'UNKNOWN';

	}

	// ── Private ─────────────────────────────────────────────────

	_transition( next ) {

		const prev = this.currentState;

		// Fire exit callback
		const exitCb = this._callbacks[ prev ];
		if ( exitCb && exitCb.exit ) exitCb.exit( prev, next );

		this.previousState = prev;
		this.currentState = next;
		this.stateTimer = 0;

		// Fire enter callback
		const enterCb = this._callbacks[ next ];
		if ( enterCb && enterCb.enter ) enterCb.enter( next, prev );

	}

	_getNextState( s ) {

		const cur = this.currentState;

		// ── RESPAWNING: external control only ──────────────────
		if ( cur === PhysicsState.RESPAWNING ) {

			// Stay until externally forced out via forceState()
			return PhysicsState.RESPAWNING;

		}

		// ── Respawn request overrides everything ──────────────
		if ( s.respawnRequested ) {

			return PhysicsState.RESPAWNING;

		}

		// ── OFF_TRACK: external detection ─────────────────────
		if ( cur === PhysicsState.OFF_TRACK ) {

			// Return to grounded if back on track
			if ( s.grounded && ! s.offTrack ) {

				return PhysicsState.GROUNDED;

			}

			return PhysicsState.OFF_TRACK;

		}

		if ( s.offTrack && cur !== PhysicsState.AIRBORNE ) {

			return PhysicsState.OFF_TRACK;

		}

		// ── RECOVERY: timed return to grounded ────────────────
		if ( cur === PhysicsState.RECOVERY ) {

			if ( ! s.grounded ) return PhysicsState.AIRBORNE;

			if ( this.stateTimer >= this._recoveryDuration ) {

				return PhysicsState.GROUNDED;

			}

			return PhysicsState.RECOVERY;

		}

		// ── LANDING: single-frame transition ──────────────────
		if ( cur === PhysicsState.LANDING ) {

			// Landing is processed in one frame, then move to RECOVERY
			return PhysicsState.RECOVERY;

		}

		// ── AIRBORNE ──────────────────────────────────────────
		if ( cur === PhysicsState.AIRBORNE ) {

			// Wall hit forces grounded
			if ( s.recentWallHit ) return PhysicsState.GROUNDED;

			// Landing: hit the ground while falling
			if ( s.vehicleY <= s.targetY && s.verticalVelocity < 0 ) {

				return PhysicsState.LANDING;

			}

			return PhysicsState.AIRBORNE;

		}

		// ── TAKEOFF: single-frame launch ──────────────────────
		if ( cur === PhysicsState.TAKEOFF ) {

			return PhysicsState.AIRBORNE;

		}

		// ── RAMP_APPROACH ─────────────────────────────────────
		if ( cur === PhysicsState.RAMP_APPROACH ) {

			// Launch from ramp edge — check BEFORE grounded loss so we
			// don't skip TAKEOFF when all wheels leave at once
			if ( s.verticalVelocity > 0.5 && s.frontOffEdge && ! s.recentWallHit ) {

				return PhysicsState.TAKEOFF;

			}

			// Lost ground contact with no launch velocity → airborne (fell off side)
			if ( ! s.grounded ) return PhysicsState.AIRBORNE;

			// Normal still looks flat at ramp top, but we have launch velocity →
			// stay in RAMP_APPROACH to preserve momentum until front wheels leave
			if ( ! s.onRamp && s.verticalVelocity > 0.5 ) {

				return PhysicsState.RAMP_APPROACH;

			}

			// Fully left the ramp surface with no velocity
			if ( ! s.onRamp ) return PhysicsState.GROUNDED;

			return PhysicsState.RAMP_APPROACH;

		}

		// ── GROUNDED (default) ────────────────────────────────
		if ( ! s.grounded ) return PhysicsState.AIRBORNE;

		// Entering a ramp surface
		if ( s.onRamp && s.grounded ) return PhysicsState.RAMP_APPROACH;

		return PhysicsState.GROUNDED;

	}

}
