import * as THREE from 'three';

const _forward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

const STEER_SENSITIVITY = 3.5;
const NOISE_AMPLITUDE = 0.03;
const TURN_THROTTLE_DOT = 0.7;
const TURN_THROTTLE_MIN = 0.3;

const STUCK_THRESHOLD = 0.05;
const STUCK_TIME = 2.0;
const REVERSE_TIME = 1.5;

export class AIController {

	constructor( trackIntel, seed ) {

		this._trackIntel = trackIntel;
		this._seed = seed || 0;
		this._noisePhase = seed * 137.5;

		this._waypointHint = 0;

		// Stuck detection
		this._stuckTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._reverseSteer = 0;

	}

	update( dt, vehicle ) {

		const trackIntel = this._trackIntel;
		const pos = vehicle.spherePos;

		// ── Stuck detection ──────────────────────────────────────
		if ( this._reversing ) {

			this._reverseTimer -= dt;

			if ( this._reverseTimer <= 0 ) {

				this._reversing = false;
				this._stuckTimer = 0;

			} else {

				return { x: this._reverseSteer, z: - 1.0, touchActive: false, boost: false };

			}

		}

		if ( Math.abs( vehicle.linearSpeed ) < STUCK_THRESHOLD ) {

			this._stuckTimer += dt;

			if ( this._stuckTimer >= STUCK_TIME ) {

				this._reversing = true;
				this._reverseTimer = REVERSE_TIME;
				this._reverseSteer = Math.random() > 0.5 ? 0.7 : - 0.7;
				return { x: this._reverseSteer, z: - 1.0, touchActive: false, boost: false };

			}

		} else {

			this._stuckTimer = 0;

		}

		// ── Find nearest waypoint and look-ahead target ──────────
		this._waypointHint = trackIntel.getNearestWaypoint( pos.x, pos.z );

		const n = trackIntel.count;
		const idx1 = ( this._waypointHint + 1 ) % n;
		const idx2 = ( this._waypointHint + 2 ) % n;

		const wp1 = trackIntel.waypoints[ idx1 ];
		const wp2 = trackIntel.waypoints[ idx2 ];

		// Blend: 30% wp+1, 70% wp+2 for smooth cornering
		const targetX = wp1.x * 0.3 + wp2.x * 0.7;
		const targetZ = wp1.z * 0.3 + wp2.z * 0.7;

		// ── Compute steering ─────────────────────────────────────
		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		_forward.normalize();

		_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
		_toTarget.normalize();

		// Cross product Y component: positive = target is to the right
		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;

		// Per-AI noise so bots don't follow identical lines
		this._noisePhase += dt * 2.3;
		const noise = Math.sin( this._noisePhase ) * NOISE_AMPLITUDE;

		const steerInput = Math.max( - 1, Math.min( 1, cross * STEER_SENSITIVITY + noise ) );

		// ── Compute throttle ─────────────────────────────────────
		const dot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;

		let throttle = 1.0;
		if ( dot < TURN_THROTTLE_DOT ) {

			throttle = Math.max( TURN_THROTTLE_MIN, dot );

		}

		// ── Boost ────────────────────────────────────────────────
		const boost = vehicle.boostMeter >= 1.0;

		return { x: steerInput, z: throttle, touchActive: false, boost };

	}

}
