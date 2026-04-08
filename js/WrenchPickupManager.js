/**
 * WrenchPickupManager — Spawns repair wrench pickups along the track.
 *
 * Fewer than item boxes, placed at different positions.
 * On pickup: +20 HP, +25 worst quadrant, +10 adjacent.
 */

import * as THREE from 'three';

const PICKUP_RADIUS = 1.5;
const COOLDOWN_TIME = 10;
const WRENCH_Y = 0.8;

const _wrenchGeo = new THREE.BoxGeometry( 0.15, 0.6, 0.15 );
const _handleGeo = new THREE.BoxGeometry( 0.4, 0.15, 0.15 );

export class WrenchPickupManager {

	/**
	 * @param {THREE.Scene} scene
	 * @param {object} trackIntel
	 * @param {object} [damageSFX] - DamageSFX for repair stinger
	 */
	constructor( scene, trackIntel, damageSFX ) {

		this._scene = scene;
		this._damageSFX = damageSFX || null;
		this._pickups = [];

		this.onPickup = null;

		// Place fewer wrenches than item boxes (roughly 1 per 5 waypoints)
		const count = Math.max( 1, Math.floor( trackIntel.count / 5 ) );
		// Offset by half to avoid overlapping with item boxes
		const positions = trackIntel.getDistributedPositions( count );

		const material = new THREE.MeshStandardMaterial( {
			color: 0x44aaff,
			emissive: 0x2266ff,
			emissiveIntensity: 0.6,
			metalness: 0.8,
			roughness: 0.2,
			transparent: true,
			opacity: 1,
		} );

		for ( let i = 0; i < positions.length; i ++ ) {

			const pos = positions[ i ];

			// Build wrench shape from two boxes
			const group = new THREE.Group();
			const shaft = new THREE.Mesh( _wrenchGeo, material.clone() );
			const head = new THREE.Mesh( _handleGeo, material.clone() );
			head.position.y = 0.25;
			group.add( shaft );
			group.add( head );
			group.position.set( pos.x, WRENCH_Y, pos.z );
			scene.add( group );

			this._pickups.push( {
				group,
				x: pos.x,
				z: pos.z,
				available: true,
				cooldownTimer: 0,
			} );

		}

	}

	update( dt, localVehicle ) {

		for ( const pickup of this._pickups ) {

			// Spin
			pickup.group.rotation.y += dt * 3;

			// Respawn cooldown
			if ( ! pickup.available ) {

				pickup.cooldownTimer -= dt;

				if ( pickup.cooldownTimer <= 0 ) {

					pickup.available = true;
					pickup.cooldownTimer = 0;
					pickup.group.visible = true;
					this._setOpacity( pickup.group, 1 );

				} else if ( pickup.cooldownTimer < 1 ) {

					pickup.group.visible = true;
					this._setOpacity( pickup.group, 1 - pickup.cooldownTimer );

				}

				continue;

			}

			// Check pickup against local vehicle
			if ( ! localVehicle || ! localVehicle.health ) continue;

			const dx = localVehicle.vehPos.x - pickup.x;
			const dz = localVehicle.vehPos.z - pickup.z;

			if ( dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS ) {

				// Apply repair
				localVehicle.health.applyRepair( 20, 25, 10 );

				// Start cooldown
				pickup.available = false;
				pickup.cooldownTimer = COOLDOWN_TIME;
				pickup.group.visible = false;

				// Audio feedback
				if ( this._damageSFX ) this._damageSFX.playRepairStinger();

				if ( this.onPickup ) this.onPickup( pickup.x, pickup.z );

			}

		}

	}

	/**
	 * Get positions of all available wrenches (for AI navigation).
	 * @returns {Array<{x: number, z: number}>}
	 */
	getAvailablePositions() {

		const result = [];
		for ( const p of this._pickups ) {

			if ( p.available ) result.push( { x: p.x, z: p.z } );

		}

		return result;

	}

	_setOpacity( group, opacity ) {

		group.traverse( ( child ) => {

			if ( child.material ) child.material.opacity = opacity;

		} );

	}

	dispose() {

		for ( const pickup of this._pickups ) {

			pickup.group.removeFromParent();
			pickup.group.traverse( ( child ) => {

				if ( child.material ) child.material.dispose();

			} );

		}

		this._pickups.length = 0;

	}

}
