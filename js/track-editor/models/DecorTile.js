// ─── DecorTile ───────────────────────────────────────────────────────────────
// Represents a placed decorative tile on the decor layer.

export class DecorTile {

	/**
	 * @param {string} type   Decor type name
	 * @param {number} [orient=0]   Orientation code: 0|10|16|22
	 * @param {number} [elevation=12]  Elevation step index (12=ground)
	 */
	constructor( type, orient = 0, elevation = 12 ) {

		this.type = type;
		this.orient = orient;
		this.elevation = elevation;

		/** @type {import('three').Object3D|null} */
		this.mesh = null;

		/** Theme variant index. @type {number} */
		this.themeVariant = 0;

	}

	/**
	 * @returns {DecorTile}
	 */
	clone() {

		const d = new DecorTile( this.type, this.orient, this.elevation );
		d.themeVariant = this.themeVariant;
		return d;

	}

}
