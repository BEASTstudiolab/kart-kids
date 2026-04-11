/**
 * VehicleHealth — Global HP + 4 quadrant damage model.
 *
 * Each vehicle has:
 *   - globalHP (0-100): overall survivability
 *   - 4 quadrants (FL, FR, RL, RR) each 0-100: localized integrity
 *
 * Damage is distributed based on type:
 *   - direct:  70% primary, 20% adjacent, 10% global spillover
 *   - splash:  40% primary, 30% adjacent, 30% global
 *   - frontal: split across both front quadrants + global
 *   - rear:    split across both rear quadrants + global
 */

export const QUADRANT = { FL: 0, FR: 1, RL: 2, RR: 3 };

export const DAMAGE_STATE = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3, BROKEN: 4 };

// Adjacency: each quadrant's two neighbors
const ADJACENT = [
	[ QUADRANT.FR, QUADRANT.RL ], // FL neighbors
	[ QUADRANT.FL, QUADRANT.RR ], // FR neighbors
	[ QUADRANT.FL, QUADRANT.RR ], // RL neighbors
	[ QUADRANT.FR, QUADRANT.RL ], // RR neighbors
];

// Damage distribution ratios by type
const DIST = {
	direct:  { primary: 0.70, adjacent: 0.20, global: 0.10 },
	splash:  { primary: 0.40, adjacent: 0.30, global: 0.30 },
	frontal: { front: 0.40, global: 0.20 }, // 40% each front quadrant, 20% global
	rear:    { rear: 0.40, global: 0.20 },   // 40% each rear quadrant, 20% global
};

// Impairment penalties per damage state
const IMPAIRMENT = {
	//                    steer   traction  accel
	[ DAMAGE_STATE.GREEN ]:  [ 0.00, 0.00, 0.00 ],
	[ DAMAGE_STATE.YELLOW ]: [ 0.04, 0.03, 0.04 ],
	[ DAMAGE_STATE.ORANGE ]: [ 0.10, 0.08, 0.10 ],
	[ DAMAGE_STATE.RED ]:    [ 0.20, 0.15, 0.20 ],
	[ DAMAGE_STATE.BROKEN ]: [ 0.25, 0.20, 0.25 ],
};


export class VehicleHealth {

	constructor() {

		this.globalHP = 100;
		this.quadrants = [
			{ hp: 100, state: DAMAGE_STATE.GREEN },
			{ hp: 100, state: DAMAGE_STATE.GREEN },
			{ hp: 100, state: DAMAGE_STATE.GREEN },
			{ hp: 100, state: DAMAGE_STATE.GREEN },
		];

		this.eliminated = false;

		// Anti-frustration: invulnerability after heavy hit
		this.invulnTimer = 0;
		this._invulnDuration = 1.5;

		// Consecutive hit scaling: rapid hits do less
		this._consecutiveScale = 1.0;
		this._lastHitTime = 0;
		this._consecutiveResetDelay = 3.0; // seconds without hit to reset

		// External damage multiplier (tunable via debug menu)
		this.damageMultiplier = 4.0;

	}

	update( dt ) {

		if ( this.invulnTimer > 0 ) this.invulnTimer -= dt;

		// Reset consecutive scaling after cooldown
		const now = performance.now() / 1000;
		if ( now - this._lastHitTime > this._consecutiveResetDelay ) {

			this._consecutiveScale = 1.0;

		}

	}

	isInvulnerable() {

		return this.invulnTimer > 0;

	}

	/**
	 * Apply damage event.
	 * @param {number} quadrantIndex - QUADRANT enum value (primary hit location)
	 * @param {number} rawAmount - base damage amount
	 * @param {'direct'|'splash'|'frontal'|'rear'} type - distribution type
	 * @returns {{ globalDelta: number, quadrantDeltas: number[], eliminated: boolean }}
	 */
	applyDamage( quadrantIndex, rawAmount, type = 'direct' ) {

		if ( this.eliminated || this.isInvulnerable() ) {

			return { globalDelta: 0, quadrantDeltas: [ 0, 0, 0, 0 ], eliminated: false };

		}

		// Apply damage multiplier + consecutive hit scaling
		const amount = rawAmount * this.damageMultiplier * this._consecutiveScale;

		// Reduce scaling for next rapid hit (minimum 0.4x)
		this._consecutiveScale = Math.max( 0.4, this._consecutiveScale * 0.7 );
		this._lastHitTime = performance.now() / 1000;

		const result = { globalDelta: 0, quadrantDeltas: [ 0, 0, 0, 0 ], eliminated: false };
		const dist = DIST[ type ] || DIST.direct;

		if ( type === 'frontal' ) {

			// Split across both front quadrants
			const perFront = amount * dist.front;
			const globalDmg = amount * dist.global;

			result.quadrantDeltas[ QUADRANT.FL ] = this._damageQuadrant( QUADRANT.FL, perFront );
			result.quadrantDeltas[ QUADRANT.FR ] = this._damageQuadrant( QUADRANT.FR, perFront );
			result.globalDelta = this._damageGlobal( globalDmg );

		} else if ( type === 'rear' ) {

			const perRear = amount * dist.rear;
			const globalDmg = amount * dist.global;

			result.quadrantDeltas[ QUADRANT.RL ] = this._damageQuadrant( QUADRANT.RL, perRear );
			result.quadrantDeltas[ QUADRANT.RR ] = this._damageQuadrant( QUADRANT.RR, perRear );
			result.globalDelta = this._damageGlobal( globalDmg );

		} else {

			// Direct or splash
			const primaryDmg = amount * dist.primary;
			const adjacentDmg = amount * dist.adjacent;
			const globalDmg = amount * dist.global;

			result.quadrantDeltas[ quadrantIndex ] = this._damageQuadrant( quadrantIndex, primaryDmg );

			// Split adjacent damage across two neighbors
			const adj = ADJACENT[ quadrantIndex ];
			result.quadrantDeltas[ adj[ 0 ] ] += this._damageQuadrant( adj[ 0 ], adjacentDmg * 0.5 );
			result.quadrantDeltas[ adj[ 1 ] ] += this._damageQuadrant( adj[ 1 ], adjacentDmg * 0.5 );

			result.globalDelta = this._damageGlobal( globalDmg );

		}

		// Heavy hit: trigger invulnerability
		if ( amount >= 15 ) {

			this.invulnTimer = this._invulnDuration;

		}

		// Check elimination
		if ( this.globalHP <= 0 ) {

			this.eliminated = true;
			result.eliminated = true;

		}

		return result;

	}

	/**
	 * Repair: +globalAmount HP, +quadrantAmount to worst quadrant, +adjacentAmount to its neighbor.
	 */
	applyRepair( globalAmount = 20, quadrantAmount = 25, adjacentAmount = 10 ) {

		if ( this.eliminated ) return;

		this.globalHP = Math.min( 100, this.globalHP + globalAmount );

		// Find worst quadrant
		let worstIdx = 0;
		let worstHP = this.quadrants[ 0 ].hp;

		for ( let i = 1; i < 4; i ++ ) {

			if ( this.quadrants[ i ].hp < worstHP ) {

				worstHP = this.quadrants[ i ].hp;
				worstIdx = i;

			}

		}

		this._healQuadrant( worstIdx, quadrantAmount );

		// Heal adjacent if applicable
		if ( adjacentAmount > 0 ) {

			const adj = ADJACENT[ worstIdx ];

			// Heal the worse of the two adjacents
			const adjIdx = this.quadrants[ adj[ 0 ] ].hp <= this.quadrants[ adj[ 1 ] ].hp ? adj[ 0 ] : adj[ 1 ];
			this._healQuadrant( adjIdx, adjacentAmount );

		}

	}

	/**
	 * Returns aggregate impairment from all quadrants.
	 * Front quadrants affect steering, rear affect traction/accel.
	 */
	getImpairment() {

		const fl = IMPAIRMENT[ this.quadrants[ QUADRANT.FL ].state ];
		const fr = IMPAIRMENT[ this.quadrants[ QUADRANT.FR ].state ];
		const rl = IMPAIRMENT[ this.quadrants[ QUADRANT.RL ].state ];
		const rr = IMPAIRMENT[ this.quadrants[ QUADRANT.RR ].state ];

		// Steering pull: difference between left and right front damage
		// Positive = pulls right (FL more damaged), Negative = pulls left (FR more damaged)
		const steeringPull = ( fl[ 0 ] - fr[ 0 ] ) * 0.5;

		// Steering sluggishness: worst front quadrant
		const steeringSluggish = Math.max( fl[ 0 ], fr[ 0 ] );

		// Traction loss: worst rear quadrant
		const tractionLoss = Math.max( rl[ 1 ], rr[ 1 ] );

		// Acceleration penalty: average of rear quadrants
		const accelPenalty = ( rl[ 2 ] + rr[ 2 ] ) * 0.5;

		return {
			steeringPull,
			steeringSluggish,
			tractionLoss,
			accelPenalty,
		};

	}

	getQuadrantState( index ) {

		return this.quadrants[ index ].state;

	}

	isCritical() {

		return this.globalHP <= 25 ||
			this.quadrants.some( q => q.state >= DAMAGE_STATE.RED );

	}

	reset() {

		this.globalHP = 100;
		for ( const q of this.quadrants ) {

			q.hp = 100;
			q.state = DAMAGE_STATE.GREEN;

		}

		this.eliminated = false;
		this.invulnTimer = 0;
		this._consecutiveScale = 1.0;

	}

	serialize() {

		return {
			globalHP: this.globalHP,
			quadrants: this.quadrants.map( q => q.hp ),
			eliminated: this.eliminated,
		};

	}

	deserialize( data ) {

		if ( ! data ) return;
		this.globalHP = data.globalHP;

		for ( let i = 0; i < 4; i ++ ) {

			this.quadrants[ i ].hp = data.quadrants[ i ];
			this.quadrants[ i ].state = this._hpToState( data.quadrants[ i ] );

		}

		this.eliminated = data.eliminated;

	}

	// ── Private ────────────────────────────────────────────────

	_damageQuadrant( index, amount ) {

		const q = this.quadrants[ index ];
		const before = q.hp;
		q.hp = Math.max( 0, q.hp - amount );
		q.state = this._hpToState( q.hp );
		return before - q.hp;

	}

	_healQuadrant( index, amount ) {

		const q = this.quadrants[ index ];
		q.hp = Math.min( 100, q.hp + amount );
		q.state = this._hpToState( q.hp );

	}

	_damageGlobal( amount ) {

		const before = this.globalHP;
		this.globalHP = Math.max( 0, this.globalHP - amount );
		return before - this.globalHP;

	}

	_hpToState( hp ) {

		if ( hp <= 0 ) return DAMAGE_STATE.BROKEN;
		if ( hp <= 25 ) return DAMAGE_STATE.RED;
		if ( hp <= 50 ) return DAMAGE_STATE.ORANGE;
		if ( hp <= 75 ) return DAMAGE_STATE.YELLOW;
		return DAMAGE_STATE.GREEN;

	}

}
