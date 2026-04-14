import { QUADRANT } from './VehicleHealth.js';


// Morph target name → quadrant index mapping
const MORPH_QUADRANT = Object.freeze( {
	'Damage_Front_Left': QUADRANT.FL,
	'Damage_Front_Right': QUADRANT.FR,
	'Damage_Back_Left': QUADRANT.RL,
	'Damage_Back_Right': QUADRANT.RR,
} );

export const DAMAGE_MORPH_NAMES = Object.freeze( Object.keys( MORPH_QUADRANT ) );

const LERP_SPEED = 6; // ~95% convergence in 0.5s
const SUPPORT_STATUS = Object.freeze( {
	FULL: 'full',
	PARTIAL: 'partial',
	NONE: 'none',
} );

const WARNED_SUPPORT_REPORTS = new Set();

function cloneReport( report ) {

	return {
		modelKey: report.modelKey,
		status: report.status,
		meshName: report.meshName,
		matchedMorphCount: report.matchedMorphCount,
		matchedMorphNames: [ ...report.matchedMorphNames ],
		missingMorphNames: [ ...report.missingMorphNames ],
		availableMorphNames: [ ...report.availableMorphNames ],
	};

}

function createDefaultReport( modelKey = 'unknown' ) {

	return {
		modelKey,
		status: SUPPORT_STATUS.NONE,
		meshName: null,
		matchedMorphCount: 0,
		matchedMorphNames: [],
		missingMorphNames: [ ...DAMAGE_MORPH_NAMES ],
		availableMorphNames: [],
	};

}

function getSupportStatus( matchCount ) {

	if ( matchCount >= DAMAGE_MORPH_NAMES.length ) return SUPPORT_STATUS.FULL;
	if ( matchCount > 0 ) return SUPPORT_STATUS.PARTIAL;
	return SUPPORT_STATUS.NONE;

}

function isBodyLikeMeshName( name = '' ) {

	const lower = name.toLowerCase();
	return lower === 'body' || lower.startsWith( 'body.' ) || lower.includes( 'body' );

}


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
		this._modelKey = 'unknown';
		this._supportReport = createDefaultReport();
		this._ready = false;

	}

	/**
	 * Find morph targets by searching the vehicle container hierarchy.
	 * @param {THREE.Object3D} container - The vehicle's root container (searched fully)
	 * @param {string|null} modelKey - Stable vehicle/model identifier for warning dedupe
	 */
	init( container, modelKey = null ) {

		this._reset( modelKey || this._deriveModelKey( container ) );

		if ( ! container ) return;

		const candidate = this._findBestMorphMesh( container );

		if ( ! candidate ) {

			this._warnSupportOnce();
			return;

		}

		this._bodyMesh = candidate.mesh;
		this._supportReport = {
			modelKey: this._modelKey,
			status: getSupportStatus( candidate.matchedMorphCount ),
			meshName: candidate.mesh.name || null,
			matchedMorphCount: candidate.matchedMorphCount,
			matchedMorphNames: [ ...candidate.matchedMorphNames ],
			missingMorphNames: [ ...candidate.missingMorphNames ],
			availableMorphNames: [ ...candidate.availableMorphNames ],
		};

		const dict = candidate.mesh.morphTargetDictionary;

		for ( const [ name, quadrant ] of Object.entries( MORPH_QUADRANT ) ) {

			if ( name in dict ) {

				this._morphIndices[ quadrant ] = dict[ name ];

			}

		}

		this._ready = candidate.matchedMorphCount > 0;
		this._warnSupportOnce();

	}

	/**
	 * Re-resolve morph targets after model swap. Preserves current influence values.
	 * @param {THREE.Object3D} container
	 * @param {string|null} modelKey
	 */
	reinit( container, modelKey = null ) {

		const prev = [ ...this._current ];
		this.init( container, modelKey );

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

	getSupportReport() {

		return cloneReport( this._supportReport );

	}

	getSupportStatus() {

		return this._supportReport.status;

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

	_reset( modelKey = 'unknown' ) {

		this._morphIndices = [ - 1, - 1, - 1, - 1 ];
		this._current = [ 0, 0, 0, 0 ];
		this._target = [ 0, 0, 0, 0 ];
		this._bodyMesh = null;
		this._modelKey = modelKey || 'unknown';
		this._supportReport = createDefaultReport( this._modelKey );
		this._ready = false;

	}

	_findBestMorphMesh( root ) {

		let best = null;
		let visitOrder = 0;

		const visit = ( node ) => {

			if ( node.isMesh && node.morphTargetDictionary ) {

				const candidate = this._buildCandidate( node, visitOrder ++ );
				if ( ! best || this._isBetterCandidate( candidate, best ) ) best = candidate;

			}

			if ( node.children ) {

				for ( const child of node.children ) visit( child );

			}

		};

		visit( root );

		return best;

	}

	_buildCandidate( mesh, visitOrder ) {

		const dict = mesh.morphTargetDictionary || {};
		const availableMorphNames = Object.keys( dict );
		const matchedMorphNames = DAMAGE_MORPH_NAMES.filter( ( name ) => name in dict );
		const missingMorphNames = DAMAGE_MORPH_NAMES.filter( ( name ) => ! ( name in dict ) );

		return {
			mesh,
			visitOrder,
			availableMorphNames,
			matchedMorphNames,
			missingMorphNames,
			matchedMorphCount: matchedMorphNames.length,
			bodyLike: isBodyLikeMeshName( mesh.name ),
		};

	}

	_isBetterCandidate( candidate, best ) {

		if ( candidate.matchedMorphCount !== best.matchedMorphCount ) {

			return candidate.matchedMorphCount > best.matchedMorphCount;

		}

		if ( candidate.bodyLike !== best.bodyLike ) {

			return candidate.bodyLike;

		}

		if ( candidate.availableMorphNames.length !== best.availableMorphNames.length ) {

			return candidate.availableMorphNames.length < best.availableMorphNames.length;

		}

		return candidate.visitOrder < best.visitOrder;

	}

	_applyToMesh() {

		const influences = this._bodyMesh?.morphTargetInfluences;
		if ( ! influences ) return;

		for ( let i = 0; i < 4; i ++ ) {

			if ( this._morphIndices[ i ] >= 0 ) {

				influences[ this._morphIndices[ i ] ] = this._current[ i ];

			}

		}

	}

	_warnSupportOnce() {

		if ( this._supportReport.status === SUPPORT_STATUS.FULL ) return;

		const meshName = this._supportReport.meshName || 'none';
		const missing = this._supportReport.missingMorphNames.join( ', ' ) || 'none';
		const warnKey = `${ this._modelKey }|${ this._supportReport.status }|${ meshName }|${ missing }`;

		if ( WARNED_SUPPORT_REPORTS.has( warnKey ) ) return;
		WARNED_SUPPORT_REPORTS.add( warnKey );

		if ( ! this._supportReport.meshName ) {

			console.warn(
				`[VehicleDamageDeform] ${ this._modelKey }: no morph-target mesh found for damage support. Missing morphs: ${ missing }.`
			);
			return;

		}

		const available = this._supportReport.availableMorphNames.join( ', ' ) || 'none';

		console.warn(
			`[VehicleDamageDeform] ${ this._modelKey }: ${ this._supportReport.status } support on mesh "${ this._supportReport.meshName }". ` +
			`Missing morphs: ${ missing }. Available morphs: ${ available }.`
		);

	}

	_deriveModelKey( container ) {

		if ( ! container ) return 'unknown';
		if ( typeof container.name === 'string' && container.name ) return container.name;

		const stack = [ container ];
		while ( stack.length > 0 ) {

			const node = stack.shift();
			if ( typeof node?.name === 'string' && node.name ) return node.name;
			if ( node?.children ) stack.push( ...node.children );

		}

		return 'unknown';

	}

}
