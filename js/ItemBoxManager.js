import * as THREE from 'three';
import { rollItem } from './PowerupItem.js';

const PICKUP_RADIUS = 1.5;
const COOLDOWN_TIME = 10;
const BOX_Y = 1.0;

const _boxGeo = new THREE.BoxGeometry( 0.6, 0.6, 0.6 );

export class ItemBoxManager {

	constructor( scene, trackIntel ) {

		this.scene = scene;
		this.boxes = [];
		this._positionRatio = 0.5; // default mid-pack

		// Callback set by main.js for VFX/audio on pickup
		this.onPickup = null;

		const count = Math.max( 1, Math.floor( trackIntel.count / 12 ) );
		const positions = trackIntel.getDistributedPositions( count );

		const material = new THREE.MeshStandardMaterial( {
			color: 0xffdd44,
			emissive: 0xffaa00,
			emissiveIntensity: 0.8,
			metalness: 0.6,
			roughness: 0.3,
			transparent: true,
			opacity: 1,
		} );

		for ( let i = 0; i < positions.length; i ++ ) {

			const pos = positions[ i ];
			const mesh = new THREE.Mesh( _boxGeo, material.clone() );
			mesh.position.set( pos.x, BOX_Y, pos.z );
			mesh.castShadow = false;
			mesh.receiveShadow = false;
			scene.add( mesh );

			this.boxes.push( {
				mesh,
				x: pos.x,
				z: pos.z,
				available: true,
				cooldownTimer: 0,
			} );

		}

	}

	update( dt, localVehicle ) {

		for ( const box of this.boxes ) {

			// Spin
			box.mesh.rotation.y += dt * 2;
			box.mesh.rotation.x += dt * 0.5;

			// Respawn cooldown
			if ( ! box.available ) {

				box.cooldownTimer -= dt;

				if ( box.cooldownTimer <= 0 ) {

					box.available = true;
					box.cooldownTimer = 0;
					box.mesh.material.opacity = 1;
					box.mesh.visible = true;

				} else if ( box.cooldownTimer < 1 ) {

					// Fade in during last 1 second of cooldown
					box.mesh.visible = true;
					box.mesh.material.opacity = 1 - box.cooldownTimer;

				}

				continue;

			}

			// Check pickup against local vehicle only (R10: per-player item state)
			if ( ! localVehicle ) continue;

			const dx = localVehicle.vehPos.x - box.x;
			const dz = localVehicle.vehPos.z - box.z;

			if ( dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS ) {

				// Roll a combat item and deliver to held slot
				const item = rollItem( this._positionRatio );
				if ( localVehicle.itemSlot ) {

					localVehicle.itemSlot.receive( item.id );

				} else {

					// Fallback for vehicles without itemSlot: apply old behavior
					this._applyPowerupLegacy( localVehicle, item.id );

				}

				// Start cooldown
				box.available = false;
				box.cooldownTimer = COOLDOWN_TIME;
				box.mesh.visible = false;
				box.mesh.material.opacity = 0;

				if ( this.onPickup ) this.onPickup( box.x, box.z, item.id );

			}

		}

	}

	/**
	 * Set the player's current position ratio (0=first, 1=last) for item weighting.
	 */
	setPositionRatio( ratio ) {

		this._positionRatio = ratio;

	}

	_applyPowerupLegacy( vehicle, itemId ) {

		// Legacy fallback for vehicles without itemSlot
		if ( itemId === 'turbo_star' ) {

			vehicle.miniBoostTimer = Math.max( vehicle.miniBoostTimer, 3.0 );
			vehicle.miniBoostTopSpeed = Math.max( vehicle.miniBoostTopSpeed, 320 );

		} else if ( itemId === 'bubble_shield' ) {

			vehicle.shieldActive = true;
			vehicle.shieldTimer = 5.0;

		}

	}

	dispose() {

		for ( const box of this.boxes ) {

			box.mesh.removeFromParent();
			box.mesh.material.dispose();

		}

		_boxGeo.dispose();
		this.boxes.length = 0;

	}

}
