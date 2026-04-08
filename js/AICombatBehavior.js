/**
 * AICombatBehavior — Health-aware AI decision making.
 *
 * Modulates AI waypoint targeting and item usage based on damage state.
 */

import { DAMAGE_STATE } from './vehicle/VehicleHealth.js';

export class AICombatBehavior {

	constructor() {

		// Tuning thresholds
		this._seekWrenchHP = 50;       // seek wrench when any quadrant below this
		this._disengageHP = 30;        // disengage from combat below this global HP
		this._itemUseDistMax = 12;     // max distance to use targeted items

	}

	/**
	 * Should this AI seek a wrench pickup?
	 *
	 * @param {object} vehicle - AI's vehicle
	 * @param {string} profileName - 'aggressive', 'cautious', etc.
	 * @returns {boolean}
	 */
	shouldSeekWrench( vehicle, profileName ) {

		if ( ! vehicle.health ) return false;

		const health = vehicle.health;

		// Aggressive: only seek wrench when RED or worse
		if ( profileName === 'aggressive' ) {

			return health.quadrants.some( q => q.state >= DAMAGE_STATE.RED );

		}

		// Cautious: seek when any quadrant is ORANGE or worse
		if ( profileName === 'cautious' ) {

			return health.quadrants.some( q => q.state >= DAMAGE_STATE.ORANGE ) ||
				health.globalHP < 60;

		}

		// Default: seek when globalHP < 50 or any quadrant ORANGE
		return health.globalHP < this._seekWrenchHP ||
			health.quadrants.some( q => q.state >= DAMAGE_STATE.ORANGE );

	}

	/**
	 * Should this AI disengage from aggressive racing?
	 *
	 * @param {object} vehicle
	 * @param {string} profileName
	 * @returns {boolean}
	 */
	shouldDisengage( vehicle, profileName ) {

		if ( ! vehicle.health ) return false;

		// Aggressive AIs never disengage
		if ( profileName === 'aggressive' ) return false;

		return vehicle.health.globalHP < this._disengageHP;

	}

	/**
	 * Should the AI use its held item?
	 *
	 * @param {object} vehicle - AI's vehicle
	 * @param {Array} allVehicles - all active vehicles
	 * @param {string} profileName
	 * @returns {boolean}
	 */
	shouldUseItem( vehicle, allVehicles, profileName ) {

		if ( ! vehicle.itemSlot || ! vehicle.itemSlot.hasItem() ) return false;

		const itemId = vehicle.itemSlot.heldItemId;

		// Self-use items: always use immediately
		if ( itemId === 'bubble_shield' || itemId === 'repair_crate' || itemId === 'turbo_star' ) {

			// Repair crate: only if damaged
			if ( itemId === 'repair_crate' && vehicle.health && vehicle.health.globalHP > 80 ) {

				return false;

			}

			return true;

		}

		// Dropped hazards: use anytime (behind us)
		if ( itemId === 'slime_slick' || itemId === 'spring_mine' ) {

			return true;

		}

		// Targeted/AOE items: check for nearby targets
		const pos = vehicle.vehPos;
		const rangeSq = this._itemUseDistMax * this._itemUseDistMax;

		for ( const entry of allVehicles ) {

			const v = entry.vehicle || entry;
			if ( ! v || v === vehicle || ! v.vehPos ) continue;

			const dx = v.vehPos.x - pos.x;
			const dz = v.vehPos.z - pos.z;

			if ( dx * dx + dz * dz < rangeSq ) {

				// Aggressive: fire immediately
				if ( profileName === 'aggressive' ) return true;

				// Conservative: only on straights (high dot with forward)
				if ( profileName === 'strategist' ) {

					// Simple check: use if we're going roughly straight
					return Math.abs( vehicle.angularSpeed ) < 1.0;

				}

				return true;

			}

		}

		return false;

	}

	/**
	 * Find the nearest available wrench position.
	 *
	 * @param {object} vehicle
	 * @param {Array<{x:number, z:number}>} wrenchPositions
	 * @returns {{x:number, z:number}|null}
	 */
	getNearestWrench( vehicle, wrenchPositions ) {

		if ( ! wrenchPositions || wrenchPositions.length === 0 ) return null;

		let bestDist = Infinity;
		let best = null;

		for ( const wp of wrenchPositions ) {

			const dx = wp.x - vehicle.vehPos.x;
			const dz = wp.z - vehicle.vehPos.z;
			const distSq = dx * dx + dz * dz;

			if ( distSq < bestDist ) {

				bestDist = distSq;
				best = wp;

			}

		}

		return best;

	}

}
