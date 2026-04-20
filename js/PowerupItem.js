/**
 * PowerupItem — 10 combat item definitions.
 *
 * Each item has: id, name, weight (drop probability), and use(owner, allVehicles, trackIntel).
 * use() either modifies state directly or returns a ProjectileDescriptor for ProjectileManager.
 */

import * as THREE from 'three';
import { QUADRANT } from './vehicle/VehicleHealth.js';

// ── ProjectileDescriptor format ──────────────────────────────────────
// {
//   type: 'projectile' | 'hazard',
//   mesh: THREE.Mesh,
//   position: THREE.Vector3,
//   velocity: THREE.Vector3,
//   lifetime: number (seconds),
//   radius: number (collision detection),
//   damage: number,
//   damageType: 'direct' | 'splash',
//   sourceVehicle: Vehicle,
//   onHit: function(target, combatManager) | null,
//   homing: boolean,
//   homingStrength: number,
// }

const _fwd = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();
const _zeroVel = new THREE.Vector3( 0, 0, 0 );

// ── Shared geometries & materials (hoisted to avoid per-use allocation) ──
const _gloveGeo = new THREE.BoxGeometry( 0.4, 0.4, 0.4 );
const _gloveMat = new THREE.MeshStandardMaterial( { color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 0.5 } );

const _slimeGeo = new THREE.CylinderGeometry( 0.6, 0.6, 0.05, 8 );
const _slimeMat = new THREE.MeshStandardMaterial( { color: 0x44ff44, transparent: true, opacity: 0.7 } );

const _mineGeo = new THREE.SphereGeometry( 0.25, 8, 6 );
const _mineMat = new THREE.MeshStandardMaterial( { color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.6 } );

const _confettiGeo = new THREE.SphereGeometry( 0.2, 8, 6 );
const _confettiMat = new THREE.MeshStandardMaterial( { color: 0xff44ff, emissive: 0xff22ff, emissiveIntensity: 0.5 } );

// ── Item definitions ─────────────────────────────────────────────────

export const ITEMS = {

	boxing_glove: {
		id: 'boxing_glove',
		name: 'Boxing Glove',
		weight: 12,
		use( owner, allVehicles, trackIntel, projectileManager ) {

			_fwd.set( 0, 0, 1 ).applyQuaternion( owner.container.quaternion );
			_tmpPos.copy( owner.vehPos ).addScaledVector( _fwd, 1.5 );

			const mesh = new THREE.Mesh( _gloveGeo, _gloveMat.clone() );

			return {
				type: 'projectile',
				mesh,
				position: _tmpPos.clone(),
				velocity: _fwd.clone().multiplyScalar( 20 ),
				lifetime: 2.0,
				radius: 0.6,
				damage: 30,
				damageType: 'direct',
				sourceVehicle: owner,
				homing: true,
				homingStrength: 3.0,
			};

		}
	},

	bubble_shield: {
		id: 'bubble_shield',
		name: 'Bubble Shield',
		weight: 10,
		use( owner ) {

			owner.shieldActive = true;
			owner.shieldTimer = 5.0;
			// Bonus: shield also heals 10 global HP
			if ( owner.health ) {

				owner.health.globalHP = Math.min( 100, owner.health.globalHP + 10 );

			}

			return null;

		}
	},

	slime_slick: {
		id: 'slime_slick',
		name: 'Slime Slick',
		weight: 12,
		use( owner ) {

			_fwd.set( 0, 0, - 1 ).applyQuaternion( owner.container.quaternion );
			_tmpPos.copy( owner.vehPos ).addScaledVector( _fwd, 1.5 );

			const mesh = new THREE.Mesh( _slimeGeo, _slimeMat.clone() );

			return {
				type: 'hazard',
				mesh,
				position: _tmpPos.clone(),
				velocity: _zeroVel.clone(),
				lifetime: 5.0,
				radius: 1.0,
				damage: 8,
				damageType: 'direct',
				sourceVehicle: owner,
				homing: false,
				homingStrength: 0,
				explosionPreset: 'mine',
				onHit( target ) {

					// Spin the target: inject angular velocity
					target.angularSpeed += ( Math.random() > 0.5 ? 1 : - 1 ) * 6;
					// Brief traction loss via speed reduction
					target.linearSpeed *= 0.6;

				}
			};

		}
	},

	magnet_pulse: {
		id: 'magnet_pulse',
		name: 'Magnet Pulse',
		weight: 8,
		use( owner, allVehicles, trackIntel, projectileManager, combatManager, explosionFXManager ) {

			// AOE: damage + pull all vehicles within 8m
			const range = 8;
			const rangeSq = range * range;

			for ( const entry of allVehicles ) {

				const v = entry.vehicle || entry;
				if ( v === owner || ! v.vehPos ) continue;

				const dx = owner.vehPos.x - v.vehPos.x;
				const dz = owner.vehPos.z - v.vehPos.z;
				const distSq = dx * dx + dz * dz;

				if ( distSq < rangeSq && distSq > 0 ) {

					// Pull toward owner
					const dist = Math.sqrt( distSq );
					const pullStrength = 3 * ( 1 - dist / range );
					v._bumpVel.x += ( dx / dist ) * pullStrength;
					v._bumpVel.z += ( dz / dist ) * pullStrength;

					// Apply damage
					if ( combatManager ) {

						combatManager.processWeaponHit( owner, v, 15, - 1, 'splash' );

					}

				}

			}

			if ( explosionFXManager ) {

				explosionFXManager.spawnEffect( {
					type: 'pulseShockwave',
					position: owner.vehPos.clone(),
					normal: new THREE.Vector3( 0, 1, 0 ),
					direction: new THREE.Vector3( 0, 0, 1 ).applyQuaternion( owner.container.quaternion ),
					intensity: 1,
					localPlayerInvolved: owner.isLocalPlayer === true,
				} );

			}

			return null;

		}
	},

	spring_mine: {
		id: 'spring_mine',
		name: 'Spring Mine',
		weight: 10,
		use( owner ) {

			_fwd.set( 0, 0, - 1 ).applyQuaternion( owner.container.quaternion );
			_tmpPos.copy( owner.vehPos ).addScaledVector( _fwd, 2.0 );

			const mesh = new THREE.Mesh( _mineGeo, _mineMat.clone() );

			return {
				type: 'hazard',
				mesh,
				position: _tmpPos.clone(),
				velocity: _zeroVel.clone(),
				lifetime: 8.0,
				radius: 0.8,
				damage: 20,
				damageType: 'direct',
				sourceVehicle: owner,
				homing: false,
				homingStrength: 0,
				onHit( target ) {

					// Launch target slightly
					target._verticalVelocity = 4;
					target._grounded = false;

				}
			};

		}
	},

	wand_zap: {
		id: 'wand_zap',
		name: 'Wand Zap',
		weight: 8,
		use( owner, allVehicles, trackIntel, projectileManager, combatManager ) {

			// Find nearest vehicle ahead
			_fwd.set( 0, 0, 1 ).applyQuaternion( owner.container.quaternion );
			let bestTarget = null;
			let bestDot = 0.5; // must be somewhat ahead

			for ( const entry of allVehicles ) {

				const v = entry.vehicle || entry;
				if ( v === owner || ! v.vehPos ) continue;

				const dx = v.vehPos.x - owner.vehPos.x;
				const dz = v.vehPos.z - owner.vehPos.z;
				const dist = Math.sqrt( dx * dx + dz * dz );
				if ( dist > 15 || dist < 0.5 ) continue;

				const dot = ( dx * _fwd.x + dz * _fwd.z ) / dist;
				if ( dot > bestDot ) {

					bestDot = dot;
					bestTarget = v;

				}

			}

			if ( bestTarget && combatManager ) {

				combatManager.processWeaponHit( owner, bestTarget, 25, - 1, 'direct' );
				// Electrical stutter: brief steering disruption
				bestTarget.angularSpeed += ( Math.random() - 0.5 ) * 4;

			}

			return null;

		}
	},

	hammer_smash: {
		id: 'hammer_smash',
		name: 'Hammer Smash',
		weight: 8,
		use( owner, allVehicles, trackIntel, projectileManager, combatManager ) {

			// Short range forward cone: 3m, 90 degree arc
			_fwd.set( 0, 0, 1 ).applyQuaternion( owner.container.quaternion );
			const range = 3;
			const rangeSq = range * range;

			for ( const entry of allVehicles ) {

				const v = entry.vehicle || entry;
				if ( v === owner || ! v.vehPos ) continue;

				const dx = v.vehPos.x - owner.vehPos.x;
				const dz = v.vehPos.z - owner.vehPos.z;
				const distSq = dx * dx + dz * dz;
				if ( distSq > rangeSq || distSq < 0.01 ) continue;

				const dist = Math.sqrt( distSq );
				const dot = ( dx * _fwd.x + dz * _fwd.z ) / dist;
				if ( dot < 0.5 ) continue; // ~60 degree cone

				if ( combatManager ) {

					combatManager.processWeaponHit( owner, v, 40, QUADRANT.FL, 'direct' );

				}

				// Flatten: push down and slow
				v._verticalVelocity = - 2;
				v.linearSpeed *= 0.4;

			}

			return null;

		}
	},

	turbo_star: {
		id: 'turbo_star',
		name: 'Turbo Star',
		weight: 10,
		use( owner ) {

			// 3 second speed boost (uses existing mini-boost system)
			owner.miniBoostTimer = Math.max( owner.miniBoostTimer, 3.0 );
			owner.miniBoostTopSpeed = Math.max( owner.miniBoostTopSpeed, 320 );
			return null;

		}
	},

	confetti_bomb: {
		id: 'confetti_bomb',
		name: 'Confetti Bomb',
		weight: 10,
		use( owner ) {

			_fwd.set( 0, 0.3, 1 ).normalize().applyQuaternion( owner.container.quaternion );
			_tmpPos.copy( owner.vehPos ).addScaledVector( _fwd, 1.5 );
			_tmpPos.y += 0.5;

			const mesh = new THREE.Mesh( _confettiGeo, _confettiMat.clone() );

			return {
				type: 'projectile',
				mesh,
				position: _tmpPos.clone(),
				velocity: _fwd.clone().multiplyScalar( 12 ),
				lifetime: 1.5,
				radius: 2.5, // large AOE
				damage: 20,
				damageType: 'splash',
				sourceVehicle: owner,
				homing: false,
				homingStrength: 0,
				explosionPreset: 'pulseShockwave',
				explodeOnTimeout: true, // explodes at end of lifetime
			};

		}
	},

	repair_crate: {
		id: 'repair_crate',
		name: 'Repair Crate',
		weight: 12,
		use( owner ) {

			if ( owner.health ) {

				owner.health.applyRepair( 20, 25, 10 );

			}

			return null;

		}
	},

};

// Item list for weighted selection
export const ITEM_LIST = Object.values( ITEMS );

const _offensiveIds = new Set( [ 'boxing_glove', 'slime_slick', 'magnet_pulse', 'spring_mine', 'wand_zap', 'hammer_smash', 'confetti_bomb' ] );

/**
 * Roll a random item with position-based weighting.
 * Leaders get more defensive items, trailers get more offensive.
 *
 * @param {number} positionRatio - 0 = first place, 1 = last place
 * @returns {object} item definition
 */
export function rollItem( positionRatio = 0.5 ) {

	// Bias: trailing players get 1.5x offensive weight, leading players get 1.5x defensive
	let totalWeight = 0;
	const weights = [];

	for ( const item of ITEM_LIST ) {

		let w = item.weight;
		if ( _offensiveIds.has( item.id ) ) {

			w *= THREE.MathUtils.lerp( 0.7, 1.5, positionRatio );

		} else {

			w *= THREE.MathUtils.lerp( 1.5, 0.7, positionRatio );

		}

		totalWeight += w;
		weights.push( w );

	}

	let r = Math.random() * totalWeight;

	for ( let i = 0; i < ITEM_LIST.length; i ++ ) {

		r -= weights[ i ];
		if ( r <= 0 ) return ITEM_LIST[ i ];

	}

	return ITEM_LIST[ ITEM_LIST.length - 1 ];

}
