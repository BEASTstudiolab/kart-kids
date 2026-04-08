/**
 * CombatManager — Central damage orchestration.
 *
 * Connects collision/weapon events → VehicleHealth → VFX/SFX/HUD feedback.
 * All damage flows through this class.
 */

import { resolveQuadrant, classifyImpactType } from './DamageRouter.js';

// Wall damage config
const WALL_DMG_MIN_SPEED = 3.0;
const WALL_DMG_SCALE = 0.8; // damage per unit speed above threshold

// Bump damage config
const BUMP_DMG_SCALE = 1.2; // damage per unit push magnitude

export class CombatManager {

	/**
	 * @param {object} ctx
	 * @param {object} ctx.audio - GameAudio (optional)
	 * @param {object} ctx.cam - Camera (optional)
	 * @param {object} ctx.haptics - Haptics (optional)
	 * @param {object} [ctx.damageSFX] - DamageSFX instance (optional, set later)
	 * @param {object} [ctx.damageVFX] - DamageVFX instance (optional, set later)
	 */
	constructor( ctx = {} ) {

		this._audio = ctx.audio || null;
		this._cam = ctx.cam || null;
		this._haptics = ctx.haptics || null;
		this.damageSFX = ctx.damageSFX || null;
		this.damageVFX = ctx.damageVFX || null;

		/**
		 * Called when a vehicle is eliminated.
		 * @type {function(object)|null}
		 */
		this.onElimination = null;

		// Active elimination animations
		this._elimAnimations = [];

	}

	/**
	 * Process a vehicle-vs-vehicle bump collision.
	 * Called from ContactHandler._applyBump() after bump velocity is applied.
	 *
	 * @param {object} attacker - Vehicle that bumped
	 * @param {object} defender - Vehicle that got bumped
	 * @param {number} pushMag - magnitude of the push force applied
	 */
	processVehicleBump( attacker, defender, pushMag ) {

		if ( ! defender.health || defender.health.eliminated ) return;
		if ( defender.health.isInvulnerable() ) return;

		const quadrant = resolveQuadrant( attacker.vehPos, defender );
		const impactType = classifyImpactType( attacker.vehPos, defender );
		const rawDamage = pushMag * BUMP_DMG_SCALE;

		const result = defender.health.applyDamage( quadrant, rawDamage, impactType );

		if ( this.damageSFX && result.globalDelta > 0 ) {

			this.damageSFX.playQuadrantHit( quadrant, rawDamage );

		}

		if ( result.eliminated ) {

			this._triggerElimination( defender );

		}

	}

	/**
	 * Process a weapon/item hit on a target vehicle.
	 *
	 * @param {object|null} source - source vehicle (or null for environment)
	 * @param {object} target - target vehicle
	 * @param {number} damage - raw damage amount
	 * @param {number} quadrant - QUADRANT index (or -1 for splash center)
	 * @param {'direct'|'splash'} type - distribution type
	 */
	processWeaponHit( source, target, damage, quadrant, type = 'direct' ) {

		if ( ! target.health || target.health.eliminated ) return;
		if ( target.health.isInvulnerable() ) return;

		// Shield absorbs weapon hits
		if ( target.shieldActive ) {

			target.shieldActive = false;
			target.shieldTimer = 0;
			if ( this._audio ) this._audio.playShieldBreak();
			return;

		}

		// Star: immune to weapon damage
		if ( target.starActive ) return;

		// If no specific quadrant, resolve from source position
		if ( quadrant < 0 && source ) {

			quadrant = resolveQuadrant( source.vehPos, target );

		} else if ( quadrant < 0 ) {

			quadrant = 0; // fallback FL

		}

		const result = target.health.applyDamage( quadrant, damage, type );

		if ( this.damageSFX && result.globalDelta > 0 ) {

			this.damageSFX.playQuadrantHit( quadrant, damage );

		}

		if ( result.eliminated ) {

			this._triggerElimination( target );

		}

	}

	/**
	 * Process self-damage from wall collision.
	 *
	 * @param {object} vehicle
	 * @param {number} speed - vehicle speed at impact
	 * @param {{ x: number, z: number }} normal - wall normal (XZ)
	 */
	processWallHit( vehicle, speed, normal ) {

		if ( ! vehicle.health || vehicle.health.eliminated ) return;
		if ( speed < WALL_DMG_MIN_SPEED ) return;
		if ( vehicle.health.isInvulnerable() ) return;

		const rawDamage = ( speed - WALL_DMG_MIN_SPEED ) * WALL_DMG_SCALE;
		if ( rawDamage < 1 ) return;

		// Determine quadrant from wall normal (wall pushes INTO the vehicle)
		// The hit side is where the wall normal points FROM
		const wallHitPos = {
			x: vehicle.vehPos.x - normal.x * 2,
			z: vehicle.vehPos.z - normal.z * 2,
		};

		const quadrant = resolveQuadrant( wallHitPos, vehicle );
		const result = vehicle.health.applyDamage( quadrant, rawDamage, 'direct' );

		if ( this.damageSFX && result.globalDelta > 0 ) {

			this.damageSFX.playQuadrantHit( quadrant, rawDamage );

		}

		if ( result.eliminated ) {

			this._triggerElimination( vehicle );

		}

	}

	update( dt ) {

		// Tick elimination animations
		for ( let i = this._elimAnimations.length - 1; i >= 0; i -- ) {

			const anim = this._elimAnimations[ i ];
			anim.timer -= dt;

			if ( anim.timer <= 0 ) {

				this._elimAnimations.splice( i, 1 );

			}

		}

	}

	_triggerElimination( vehicle ) {

		// Play elimination burst SFX
		if ( this.damageSFX ) {

			this.damageSFX.playEliminationBurst();

		}

		// Camera shake for local vehicle involvement
		if ( this._cam ) {

			this._cam.applyShake( 0, 1, 15 );

		}

		// Track animation
		this._elimAnimations.push( { vehicle, timer: 2.0 } );

		// Notify external systems (WreckManager, EliminationManager)
		if ( this.onElimination ) {

			this.onElimination( vehicle );

		}

	}

}
