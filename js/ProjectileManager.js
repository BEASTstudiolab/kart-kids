/**
 * ProjectileManager — Manages active projectiles and ground hazards.
 *
 * Uses simple sphere-vs-sphere collision (no physics engine).
 * Projectiles are short-lived (~1-5s) and few in number.
 */

import * as THREE from 'three';

const _dir = new THREE.Vector3();

export class ProjectileManager {

	/**
	 * @param {THREE.Scene} scene
	 * @param {import('./CombatManager.js').CombatManager} combatManager
	 */
	constructor( scene, combatManager ) {

		this._scene = scene;
		this._combatManager = combatManager;

		/** @type {Array<object>} Active projectile/hazard descriptors */
		this._active = [];

	}

	/**
	 * Spawn a projectile or hazard from a ProjectileDescriptor.
	 *
	 * @param {object} desc - ProjectileDescriptor from PowerupItem.use()
	 */
	spawn( desc ) {

		if ( ! desc || ! desc.mesh ) return;

		desc.mesh.position.copy( desc.position );
		this._scene.add( desc.mesh );
		desc._age = 0;
		desc._hitSet = new Set(); // prevent double-hits
		this._active.push( desc );

	}

	/**
	 * @param {number} dt
	 * @param {Array} allVehicles - entries with .vehicle property
	 */
	update( dt, allVehicles ) {

		for ( let i = this._active.length - 1; i >= 0; i -- ) {

			const p = this._active[ i ];
			p._age += dt;

			// Move projectiles (hazards have zero velocity)
			if ( p.velocity.lengthSq() > 0 ) {

				// Homing: steer toward nearest target
				if ( p.homing && p.homingStrength > 0 ) {

					this._applyHoming( p, allVehicles, dt );

				}

				p.mesh.position.x += p.velocity.x * dt;
				p.mesh.position.y += p.velocity.y * dt;
				p.mesh.position.z += p.velocity.z * dt;

				// Gravity for lobbed projectiles
				if ( p.velocity.y > - 20 ) {

					p.velocity.y -= 5 * dt;

				}

			}

			// Spin for visual flair
			p.mesh.rotation.y += dt * 5;

			// Check lifetime
			if ( p._age >= p.lifetime ) {

				// Explode-on-timeout (confetti bomb)
				if ( p.explodeOnTimeout ) {

					this._checkCollisions( p, allVehicles, true );

				}

				this._remove( i );
				continue;

			}

			// Check collisions
			if ( this._checkCollisions( p, allVehicles, false ) && p.type === 'projectile' ) {

				// Projectiles are consumed on first hit
				this._remove( i );

			}

		}

	}

	/**
	 * @returns {boolean} true if any vehicle was hit
	 */
	_checkCollisions( p, allVehicles, forceAll ) {

		let hitAny = false;
		const radiusSq = p.radius * p.radius;

		for ( const entry of allVehicles ) {

			const v = entry.vehicle || entry;
			if ( ! v || ! v.vehPos ) continue;
			if ( v === p.sourceVehicle ) continue;
			if ( p._hitSet.has( v ) ) continue;

			const dx = p.mesh.position.x - v.vehPos.x;
			const dy = p.mesh.position.y - ( v.vehPos.y + 0.5 );
			const dz = p.mesh.position.z - v.vehPos.z;
			const distSq = dx * dx + dy * dy + dz * dz;

			if ( distSq < radiusSq ) {

				p._hitSet.add( v );
				hitAny = true;

				// Apply damage
				this._combatManager.processWeaponHit(
					p.sourceVehicle, v, p.damage, - 1, p.damageType
				);

				// Custom onHit callback
				if ( p.onHit ) p.onHit( v, this._combatManager );

				// For hazards, don't break — can hit multiple vehicles
				if ( ! forceAll && p.type === 'projectile' ) break;

			}

		}

		return hitAny;

	}

	_applyHoming( p, allVehicles, dt ) {

		let bestTarget = null;
		let bestDistSq = 225; // 15m max homing range

		for ( const entry of allVehicles ) {

			const v = entry.vehicle || entry;
			if ( ! v || v === p.sourceVehicle || ! v.vehPos ) continue;
			if ( p._hitSet.has( v ) ) continue;

			const dx = v.vehPos.x - p.mesh.position.x;
			const dz = v.vehPos.z - p.mesh.position.z;
			const distSq = dx * dx + dz * dz;

			if ( distSq < bestDistSq ) {

				bestDistSq = distSq;
				bestTarget = v;

			}

		}

		if ( ! bestTarget ) return;

		_dir.set(
			bestTarget.vehPos.x - p.mesh.position.x,
			0,
			bestTarget.vehPos.z - p.mesh.position.z
		).normalize();

		const speed = p.velocity.length();
		p.velocity.x += _dir.x * p.homingStrength * dt * speed;
		p.velocity.z += _dir.z * p.homingStrength * dt * speed;

		// Re-normalize to maintain speed
		const newSpeed = p.velocity.length();
		if ( newSpeed > 0 ) {

			p.velocity.multiplyScalar( speed / newSpeed );

		}

	}

	_remove( index ) {

		const p = this._active[ index ];
		p.mesh.removeFromParent();
		if ( p.mesh.geometry ) p.mesh.geometry.dispose();
		if ( p.mesh.material ) p.mesh.material.dispose();
		this._active.splice( index, 1 );

	}

	dispose() {

		while ( this._active.length > 0 ) {

			this._remove( 0 );

		}

	}

}
