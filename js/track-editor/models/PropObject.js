// ─── PropObject ──────────────────────────────────────────────────────────────
// Represents a free-placed decorative prop in the editor.

export class PropObject {

	/**
	 * @param {string} propName  Prop type/model ID
	 * @param {{ x: number, y: number, z: number }} position  World coordinates
	 */
	constructor( propName, position ) {

		this.id = crypto.randomUUID();
		this.propName = propName;

		/** World position (not grid-snapped). */
		this.position = { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 };

		/** Euler rotation in radians. */
		this.rotation = { x: 0, y: 0, z: 0 };

		/** Surface normal at placement point. */
		this.surfaceNormal = { x: 0, y: 1, z: 0 };

		/** Theme variant index. */
		this.themeVariant = 0;

		/** Snap mode: 'free' | 'grid' | 'surface'. */
		this.snapMode = 'free';

		/** @type {import('three').Object3D|null} */
		this.mesh = null;

	}

	clone() {

		const p = new PropObject( this.propName, { ...this.position } );
		p.id = this.id;
		p.rotation = { ...this.rotation };
		p.surfaceNormal = { ...this.surfaceNormal };
		p.themeVariant = this.themeVariant;
		p.snapMode = this.snapMode;
		return p;

	}

	toJSON() {

		return {
			id: this.id,
			pn: this.propName,
			pos: [ this.position.x, this.position.y, this.position.z ],
			rot: [ this.rotation.x, this.rotation.y, this.rotation.z ],
			sn: [ this.surfaceNormal.x, this.surfaceNormal.y, this.surfaceNormal.z ],
			snap: this.snapMode,
			tv: this.themeVariant,
		};

	}

	static fromJSON( data ) {

		const p = new PropObject( data.pn, {
			x: data.pos[ 0 ],
			y: data.pos[ 1 ],
			z: data.pos[ 2 ],
		} );
		p.id = data.id || crypto.randomUUID();
		if ( data.rot ) p.rotation = { x: data.rot[ 0 ], y: data.rot[ 1 ], z: data.rot[ 2 ] };
		if ( data.sn ) p.surfaceNormal = { x: data.sn[ 0 ], y: data.sn[ 1 ], z: data.sn[ 2 ] };
		if ( data.snap ) p.snapMode = data.snap;
		if ( data.tv != null ) p.themeVariant = data.tv;
		return p;

	}

}
