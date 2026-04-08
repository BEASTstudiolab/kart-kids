/**
 * ItemSlotManager — One held item slot per vehicle.
 *
 * Replaces the direct-apply pattern from ItemBoxManager.
 * Items are held until the player presses the use button.
 */

import { ITEMS } from './PowerupItem.js';

export class ItemSlotManager {

	constructor( vehicle ) {

		this.vehicle = vehicle;
		this.heldItemId = null;

	}

	/**
	 * Receive an item by ID. Replaces any currently held item.
	 */
	receive( itemId ) {

		this.heldItemId = itemId;

	}

	/**
	 * Use the held item. Returns a ProjectileDescriptor or null.
	 *
	 * @param {Array} allVehicles - active vehicle list (entries with .vehicle)
	 * @param {object} trackIntel - TrackIntel instance
	 * @param {object} projectileManager - ProjectileManager instance
	 * @param {object} combatManager - CombatManager instance
	 * @returns {object|null} ProjectileDescriptor or null
	 */
	use( allVehicles, trackIntel, projectileManager, combatManager ) {

		if ( ! this.heldItemId ) return null;

		const item = ITEMS[ this.heldItemId ];
		if ( ! item ) {

			this.heldItemId = null;
			return null;

		}

		const result = item.use( this.vehicle, allVehicles, trackIntel, projectileManager, combatManager );
		this.heldItemId = null;
		return result;

	}

	hasItem() {

		return this.heldItemId !== null;

	}

	clear() {

		this.heldItemId = null;

	}

}
