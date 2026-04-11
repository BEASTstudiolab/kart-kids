import { MathUtils } from 'three';
import { QUADRANT } from './VehicleHealth.js';


// Morph target name → quadrant index mapping
const MORPH_QUADRANT = {
	'Damage_Front_Left': QUADRANT.FL,
	'Damage_Front_Right': QUADRANT.FR,
	'Damage_Back_Left': QUADRANT.RL,
	'Damage_Back_Right': QUADRANT.RR,
};

const LERP_SPEED = 6; // ~95% convergence in 0.5s


export class VehicleDamageDeform {

	constructor() {

		// morphTargetInfluences index for each quadrant (-1 = not found)
		this._morphIndices = [ - 1, - 1, - 1, - 1 ];

		// Smoothed current values and targets (indexed by QUADRANT)
		this._current = [ 0, 0, 0, 0 ];
		this._target = [ 0, 0, 0, 0 ];

		// Debug override
		this._debugOverride = false;
		this._debugValues = [ 0, 0, 0, 0 ];

		this._bodyMesh = null;
		this._ready = false;

	}

	/**
	 * Find morph targets by searching the vehicle container hierarchy.
	 * @param {THREE.Object3D} container - The vehicle's root container (searched fully)
	 */
	init( container ) {

		this._reset();

		if ( ! container ) return;

		// Find the first mesh with morphTargetDictionary anywhere in the hierarchy
		const mesh = this._findMorphMesh( container );

		if ( ! mesh ) return;

		this._bodyMesh = mesh;

		const dict = mesh.morphTargetDictionary;

		for ( const [ name, quadrant ] of Object.entries( MORPH_QUADRANT ) ) {

			if ( name in dict ) {

				this._morphIndices[ quadrant ] = dict[ name ];

			}

		}

		this._ready = this._morphIndices.some( i => i >= 0 );

		if ( ! this._ready ) {

			console.warn( 'VehicleDamageDeform: morph target names not found in dictionary:', Object.keys( dict ) );

		}

	}

	/**
	 * Re-resolve morph targets after model swap. Preserves current influence values.
	 * @param {THREE.Object3D} container
	 */
	reinit( container ) {

		const prev = [ ...this._current ];
		this.init( container );

		// Restore influence values to avoid visual pop on model swap
		if ( this._ready ) {

			for ( let i = 0; i < 4; i ++ ) {

				this._current[ i ] = prev[ i ];
				this._target[ i ] = prev[ i ];

			}

			this._applyToMesh();

		}

	}

	/**
	 * Update morph target influences.
	 * @param {number} dt - Delta time in seconds
	 * @param {VehicleHealth|null} health - Local vehicle health (null for remote)
	 * @param {number[]|null} remoteDamage - Remote damage array [fl, fr, rl, rr] 0-1
	 */
	update( dt, health, remoteDamage ) {

		if ( ! this._ready ) return;

		// Compute targets
		if ( this._debugOverride ) {

			this._target[ 0 ] = this._debugValues[ 0 ];
			this._target[ 1 ] = this._debugValues[ 1 ];
			this._target[ 2 ] = this._debugValues[ 2 ];
			this._target[ 3 ] = this._debugValues[ 3 ];

		} else if ( remoteDamage ) {

			this._target[ 0 ] = remoteDamage[ 0 ];
			this._target[ 1 ] = remoteDamage[ 1 ];
			this._target[ 2 ] = remoteDamage[ 2 ];
			this._target[ 3 ] = remoteDamage[ 3 ];

		} else if ( health ) {

			for ( let i = 0; i < 4; i ++ ) {

				this._target[ i ] = 1.0 - ( health.quadrants[ i ].hp / 100 );

			}

		}

		// Smooth interpolation (frame-rate independent)
		const t = 1 - Math.exp( - LERP_SPEED * dt );

		for ( let i = 0; i < 4; i ++ ) {

			this._current[ i ] += ( this._target[ i ] - this._current[ i ] ) * t;

		}

		this._applyToMesh();

	}

	/**
	 * Get current damage deformation state for network serialization.
	 * @returns {number[]} [fl, fr, rl, rr] values 0-1
	 */
	getDamageState() {

		return this._current;

	}

	/**
	 * Enable/disable debug override mode.
	 * @param {boolean} enabled
	 */
	setDebugOverride( enabled ) {

		this._debugOverride = enabled;

	}

	/**
	 * Set debug slider value for a quadrant.
	 * @param {number} quadrant - QUADRANT index (0-3)
	 * @param {number} value - 0-1 influence
	 */
	setDebugValue( quadrant, value ) {

		this._debugValues[ quadrant ] = value;

	}

	// ── Internal ────────────────────────────────────────────────────────────

	_reset() {

		this._morphIndices = [ - 1, - 1, - 1, - 1 ];
		this._bodyMesh = null;
		this._ready = false;

	}

	_findMorphMesh( node ) {

		if ( node.isMesh && node.morphTargetDictionary ) return node;

		if ( node.children ) {

			for ( const child of node.children ) {

				const found = this._findMorphMesh( child );
				if ( found ) return found;

			}

		}

		return null;

	}

	_applyToMesh() {

		const influences = this._bodyMesh.morphTargetInfluences;

		for ( let i = 0; i < 4; i ++ ) {

			if ( this._morphIndices[ i ] >= 0 ) {

				influences[ this._morphIndices[ i ] ] = this._current[ i ];

			}

		}

	}

}
