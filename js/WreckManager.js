/**
 * WreckManager — Manages wreck obstacles from eliminated vehicles.
 *
 * When a vehicle is eliminated, its physics body is frozen to static,
 * materials are darkened, and a smoke emitter is attached.
 */

import * as THREE from 'three';
import { rigidBody, MotionType } from 'crashcat';

const MAX_WRECKS = 6;
const WRECK_DESPAWN_TIME = 60; // seconds

const _smokeMat = new THREE.SpriteMaterial( {
	color: 0x555555,
	transparent: true,
	opacity: 0.3,
	depthWrite: false,
} );

export class WreckManager {

	constructor( scene, world ) {

		this._scene = scene;
		this._world = world;
		this._wrecks = [];

		// Smoke pool
		this._smokePool = [];
		for ( let i = 0; i < 32; i ++ ) {

			const sprite = new THREE.Sprite( _smokeMat.clone() );
			sprite.scale.set( 0.15, 0.15, 1 );
			sprite.visible = false;
			sprite.userData = { life: 0, maxLife: 0, vy: 0, wreckIdx: - 1 };
			scene.add( sprite );
			this._smokePool.push( sprite );

		}

		this._smokeIdx = 0;

	}

	/**
	 * Convert an eliminated vehicle into a wreck obstacle.
	 */
	createWreck( vehicle ) {

		// Cap wrecks: remove oldest if at limit
		while ( this._wrecks.length >= MAX_WRECKS ) {

			this._removeWreck( 0 );

		}

		// Freeze physics body to static
		if ( vehicle.rigidBody && this._world ) {

			try {

				rigidBody.setMotionType( this._world, vehicle.rigidBody, 'static' );

			} catch ( e ) {

				// If crashcat doesn't support setMotionType, disable velocity
				rigidBody.setLinearVelocity( this._world, vehicle.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this._world, vehicle.rigidBody, [ 0, 0, 0 ] );

			}

		}

		// Darken materials
		vehicle.container.traverse( ( child ) => {

			if ( child.material ) {

				const mat = child.material;
				if ( mat.color ) mat.color.multiplyScalar( 0.4 );
				if ( mat.emissive ) mat.emissive.set( 0x000000 );
				mat.transparent = true;
				mat.opacity = Math.min( mat.opacity, 0.85 );

			}

		} );

		// Disable headlights/underglow
		if ( vehicle.underglowLight ) vehicle.underglowLight.visible = false;
		for ( const hl of vehicle.headlights ) hl.visible = false;

		const wreck = {
			vehicle,
			timer: WRECK_DESPAWN_TIME,
			position: vehicle.vehPos.clone(),
		};

		this._wrecks.push( wreck );

	}

	update( dt ) {

		// Tick smoke pool
		for ( const sprite of this._smokePool ) {

			if ( ! sprite.visible ) continue;
			const ud = sprite.userData;
			ud.life += dt;
			if ( ud.life >= ud.maxLife ) {

				sprite.visible = false;
				continue;

			}

			sprite.position.y += ud.vy * dt;
			const t = ud.life / ud.maxLife;
			sprite.material.opacity = 0.3 * ( 1 - t );
			const s = 0.15 + t * 0.2;
			sprite.scale.set( s, s, 1 );

		}

		// Update wrecks
		for ( let i = this._wrecks.length - 1; i >= 0; i -- ) {

			const wreck = this._wrecks[ i ];
			wreck.timer -= dt;

			// Emit smoke
			if ( Math.random() < 3 * dt ) {

				this._emitSmoke( wreck, i );

			}

			if ( wreck.timer <= 0 ) {

				this._removeWreck( i );

			}

		}

	}

	getWrecks() {

		return this._wrecks;

	}

	_emitSmoke( wreck, wreckIdx ) {

		const sprite = this._smokePool[ this._smokeIdx ];
		this._smokeIdx = ( this._smokeIdx + 1 ) % this._smokePool.length;

		sprite.position.set(
			wreck.position.x + ( Math.random() - 0.5 ) * 0.5,
			wreck.position.y + 0.5,
			wreck.position.z + ( Math.random() - 0.5 ) * 0.5
		);
		sprite.visible = true;
		sprite.material.opacity = 0.3;
		sprite.userData.life = 0;
		sprite.userData.maxLife = 0.8 + Math.random() * 0.5;
		sprite.userData.vy = 0.5 + Math.random() * 0.3;
		sprite.userData.wreckIdx = wreckIdx;

	}

	_removeWreck( index ) {

		const wreck = this._wrecks[ index ];

		// Hide the vehicle container (fade out could be added)
		wreck.vehicle.container.visible = false;

		// Hide associated smoke
		for ( const sprite of this._smokePool ) {

			if ( sprite.userData.wreckIdx === index ) {

				sprite.visible = false;

			}

		}

		this._wrecks.splice( index, 1 );

	}

	reset() {

		// Remove all active wrecks (hide containers, clear smoke)
		while ( this._wrecks.length > 0 ) {

			this._removeWreck( 0 );

		}

	}

	dispose() {

		for ( const sprite of this._smokePool ) {

			sprite.removeFromParent();
			sprite.material.dispose();

		}

		this._wrecks.length = 0;

	}

}
