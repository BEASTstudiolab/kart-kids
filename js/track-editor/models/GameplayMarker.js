// ─── GameplayMarker ──────────────────────────────────────────────────────────
// Represents a gameplay marker placed on the track: start/finish, checkpoints,
// spawn points, boost tiles, powerup spawns, respawn markers.

export class GameplayMarker {

	/**
	 * @param {'start'|'finish'|'checkpoint'|'spawn'|'boost'|'powerup'|'respawn'} type
	 * @param {number} gx  Grid X
	 * @param {number} gz  Grid Z
	 */
	constructor( type, gx, gz ) {

		this.id = crypto.randomUUID();
		this.type = type;
		this.gx = gx;
		this.gz = gz;
		this.orient = 0;

		/** Sequence order (for checkpoints, spawn slots). @type {number} */
		this.orderIndex = 0;

		/** Type-specific settings (boost strength, powerup type, etc). @type {object} */
		this.settings = {};

		/** @type {import('three').Object3D|null} */
		this.mesh = null;

	}

	/**
	 * @returns {GameplayMarker}
	 */
	clone() {

		const m = new GameplayMarker( this.type, this.gx, this.gz );
		m.orient = this.orient;
		m.orderIndex = this.orderIndex;
		m.settings = { ...this.settings };
		return m;

	}

	/**
	 * Serialize for v4 JSON.
	 * @returns {object}
	 */
	toJSON() {

		return {
			id: this.id,
			type: this.type,
			pos: [ this.gx, 0, this.gz ],
			rot: [ 0, this.orient, 0 ],
			tileRef: this.gx + ',' + this.gz,
			order: this.orderIndex,
			settings: this.settings,
		};

	}

}
