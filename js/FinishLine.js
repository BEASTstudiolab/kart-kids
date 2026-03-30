import * as THREE from 'three';

const COOLDOWN_TIME = 2.0; // seconds

export class FinishLine {

	constructor( { position, angle } ) {

		// World-space center of the finish line
		this.position = new THREE.Vector3( position[ 0 ], 0, position[ 2 ] );

		// The plane normal points in the "forward" racing direction through the finish
		// Angle 0 in Godot = forward along -Z, but the finish cell's forward is the
		// direction the player drives through it.
		this.normal = new THREE.Vector3(
			- Math.sin( angle ),
			0,
			- Math.cos( angle )
		);

		this._lastCrossTime = - Infinity;

	}

	/**
	 * Check if a vehicle crossed the finish line between prevPos and currPos.
	 * Uses a signed-distance plane test: if the sign flips, the segment crossed the plane.
	 * Direction is determined by dot product of movement with the plane normal.
	 */
	check( prevPos, currPos ) {

		const now = performance.now() / 1000;

		if ( now - this._lastCrossTime < COOLDOWN_TIME ) {

			return { crossed: false, direction: null };

		}

		// Signed distances from the finish plane
		const dPrev = this._signedDistance( prevPos );
		const dCurr = this._signedDistance( currPos );

		// Crossing occurs when signs differ (one positive, one negative or zero)
		if ( dPrev * dCurr > 0 ) {

			return { crossed: false, direction: null };

		}

		// Determine direction: movement vector dotted with plane normal
		const dx = currPos.x - prevPos.x;
		const dz = currPos.z - prevPos.z;
		const dot = dx * this.normal.x + dz * this.normal.z;

		const direction = dot > 0 ? 'forward' : 'backward';

		if ( direction === 'forward' ) {

			this._lastCrossTime = now;

		}

		return { crossed: true, direction };

	}

	resetCooldown() {

		this._lastCrossTime = - Infinity;

	}

	_signedDistance( pos ) {

		// Distance from pos to the finish plane (dot of (pos - planePoint) with normal)
		return ( pos.x - this.position.x ) * this.normal.x +
			( pos.z - this.position.z ) * this.normal.z;

	}

}
