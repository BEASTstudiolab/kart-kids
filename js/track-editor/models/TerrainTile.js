export class TerrainTile {

	/**
	 * @param {string} type
	 * @param {number} [orient=0]
	 * @param {number} [elevation=12]
	 */
	constructor( type, orient = 0, elevation = 12 ) {

		this.type = type;
		this.orient = orient;
		this.elevation = elevation;

		/** @type {import('three').Object3D|null} */
		this.mesh = null;

	}

	clone() {

		return new TerrainTile( this.type, this.orient, this.elevation );

	}

}
