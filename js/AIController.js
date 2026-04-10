import * as THREE from 'three';
import { DEFAULT_PROFILE } from './AIProfiles.js';
import { AICombatBehavior } from './AICombatBehavior.js';

const _forward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

const STUCK_THRESHOLD = 0.05;

export class AIController {

	constructor( trackIntel, seed, profile ) {

		this._trackIntel = trackIntel;
		this._seed = seed || 0;
		this._noisePhase = seed * 137.5;

		this._waypointHint = 0;

		// Merge profile with defaults — missing keys fall back to DEFAULT_PROFILE
		this._profile = Object.assign( {}, DEFAULT_PROFILE, profile );

		// Stuck detection
		this._stuckTimer = 0;
		this._reverseTimer = 0;
		this._reversing = false;
		this._reverseSteer = 0;

		// Reusable input object — avoids per-frame allocation
		this._input = { x: 0, z: 0, touchActive: false, boost: false, drift: false, useItem: false };

		// Combat behavior
		this._combat = new AICombatBehavior();
		this._wrenchTarget = null;

	}

	update( dt, vehicle ) {

		const trackIntel = this._trackIntel;

		// No track intelligence — drive forward with slight random steering.
		if ( ! trackIntel || ! trackIntel.waypoints || trackIntel.count === 0 ) {

			this._input.x = Math.sin( this._noisePhase + dt * 2 ) * 0.3;
			this._input.z = 1.0;
			this._input.boost = false;
			this._noisePhase += dt;
			return this._input;

		}

		const pos = vehicle.vehPos;
		const p = this._profile;

		// ── Stuck detection ──────────────────────────────────────
		if ( this._reversing ) {

			this._reverseTimer -= dt;

			if ( this._reverseTimer <= 0 ) {

				this._reversing = false;
				this._stuckTimer = 0;

			} else {

				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				return this._input;

			}

		}

		if ( Math.abs( vehicle.linearSpeed ) < STUCK_THRESHOLD ) {

			this._stuckTimer += dt;

			if ( this._stuckTimer >= p.stuckTime ) {

				this._reversing = true;
				this._reverseTimer = p.reverseTime;
				this._reverseSteer = Math.random() > 0.5 ? 0.7 : - 0.7;
				this._input.x = this._reverseSteer;
				this._input.z = - 1.0;
				this._input.boost = false;
				return this._input;

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

		// Blend using profile lookAheadBlend (weight toward wp+2)
		const nearWeight = 1 - p.lookAheadBlend;
		const farWeight = p.lookAheadBlend;
		let targetX = wp1.x * nearWeight + wp2.x * farWeight;
		let targetZ = wp1.z * nearWeight + wp2.z * farWeight;

		// ── Compute steering ─────────────────────────────────────
		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		_forward.normalize();

		_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
		_toTarget.normalize();

		// Dot product for throttle and lateral offset scaling
		const dot = _forward.x * _toTarget.x + _forward.z * _toTarget.z;

		// ── Apply lateral offset perpendicular to track direction ─
		if ( p.lateralOffset !== 0 ) {

			const tdx = wp2.x - wp1.x;
			const tdz = wp2.z - wp1.z;
			const tLen = Math.sqrt( tdx * tdx + tdz * tdz );

			if ( tLen > 0.001 ) {

				// Perpendicular: (-dz, dx) normalized
				const perpX = - tdz / tLen;
				const perpZ = tdx / tLen;
				const scale = p.lateralOffset * Math.max( 0, dot );

				targetX += perpX * scale;
				targetZ += perpZ * scale;

				// Recompute toTarget after offset
				_toTarget.set( targetX - pos.x, 0, targetZ - pos.z );
				_toTarget.normalize();

			}

		}

		// Cross product Y component: positive = target is to the right
		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;

		// Per-AI noise so bots don't follow identical lines
		this._noisePhase += dt * 2.3;
		const noise = Math.sin( this._noisePhase ) * p.noiseAmplitude;

		const steerInput = Math.max( - 1, Math.min( 1, cross * p.steerSensitivity + noise ) );

		// ── Compute throttle ─────────────────────────────────────
		let throttle = 1.0;
		if ( dot < p.turnThrottleDot ) {

			throttle = Math.max( p.turnThrottleMin, dot );

		}

		// ── Boost ────────────────────────────────────────────────
		let boost = false;
		if ( vehicle.boostMeter >= 1.0 ) {

			if ( p.boostEagerness ) {

				boost = true;

			} else {

				// Hold for straights: fire only when facing target (dot > 0.9)
				boost = dot > 0.9;

			}

		}

		this._input.x = steerInput;
		this._input.z = throttle;
		this._input.boost = boost;
		this._input.useItem = false;

		// ── Combat behavior ──────────────────────────────────────
		const profileName = p.name || 'default';

		// Item use decision
		if ( this._combat.shouldUseItem( vehicle, this._allVehiclesRef || [], profileName ) ) {

			this._input.useItem = true;

		}

		// Wrench seeking: override waypoint target toward nearest wrench
		if ( this._wrenchPositionsRef && this._combat.shouldSeekWrench( vehicle, profileName ) ) {

			const wrench = this._combat.getNearestWrench( vehicle, this._wrenchPositionsRef );
			if ( wrench ) {

				// Steer toward wrench instead of waypoint
				_toTarget.set( wrench.x - pos.x, 0, wrench.z - pos.z );
				const wDist = _toTarget.length();
				if ( wDist > 0.5 && wDist < 30 ) {

					_toTarget.normalize();
					const wCross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;
					this._input.x = Math.max( - 1, Math.min( 1, wCross * p.steerSensitivity ) );

				}

			}

		}

		return this._input;

	}

	/**
	 * Set external references for combat decisions (called by AIManager).
	 */
	setCombatRefs( allVehicles, wrenchPositions ) {

		this._allVehiclesRef = allVehicles;
		this._wrenchPositionsRef = wrenchPositions;

	}

}
