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
		this._seekWrenchTurnSeverityMax = 0.12;
		this._seekWrenchTrafficOccupancyMax = 0.25;
		this._seekWrenchWallEscapeMax = 0.05;

	}

	/**
	 * Should this AI seek a wrench pickup?
	 *
	 * @param {object} vehicle - AI's vehicle
	 * @returns {boolean}
	 */
	shouldSeekWrench( vehicle ) {

		if ( ! vehicle.health ) return false;

		const health = vehicle.health;

		return health.globalHP < this._seekWrenchHP ||
			health.quadrants.some( q => q.state >= DAMAGE_STATE.ORANGE );

	}

	/**
	 * Should this AI actively divert from the route for a wrench right now?
	 *
	 * Damage can create desire for a repair pickup, but route fidelity should
	 * still win during sharp corners, wall recovery, and heavy local traffic.
	 *
	 * @param {object} vehicle
	 * @param {{turnSeverity?: number, trafficOccupancy?: number, wallEscapeFactor?: number}} [context]
	 * @returns {boolean}
	 */
	shouldPursueWrench( vehicle, context = {} ) {

		if ( ! this.shouldSeekWrench( vehicle ) ) return false;

		const turnSeverity = context.turnSeverity ?? 0;
		const trafficOccupancy = context.trafficOccupancy ?? 0;
		const wallEscapeFactor = context.wallEscapeFactor ?? 0;

		if ( turnSeverity > this._seekWrenchTurnSeverityMax ) return false;
		if ( trafficOccupancy > this._seekWrenchTrafficOccupancyMax ) return false;
		if ( wallEscapeFactor > this._seekWrenchWallEscapeMax ) return false;

		return true;

	}

	/**
	 * Should this AI disengage from risky racing?
	 *
	 * @param {object} vehicle
	 * @returns {boolean}
	 */
	shouldDisengage( vehicle ) {

		if ( ! vehicle.health ) return false;

		return vehicle.health.globalHP < this._disengageHP;

	}

	/**
	 * Should the AI use its held item?
	 *
	 * @param {object} vehicle - AI's vehicle
	 * @param {Array} allVehicles - all active vehicles
	 * @returns {boolean}
	 */
	shouldUseItem( vehicle, allVehicles ) {

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

				return true;

			}

		}

		return false;

	}

}
