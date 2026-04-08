/**
 * DamageVFX — Per-vehicle persistent damage visual effects.
 *
 * Reads vehicle.health each frame and spawns:
 *   GREEN:  nothing
 *   YELLOW: occasional sparks from damaged quadrant
 *   ORANGE: steady sparks + light smoke
 *   RED:    heavy smoke + wheel wobble
 *   BROKEN: maximum smoke, distorted wheel
 */

import * as THREE from 'three';
import { DAMAGE_STATE, QUADRANT } from './vehicle/VehicleHealth.js';

const _tmpPos = new THREE.Vector3();

// Sprite pool size per DamageVFX instance
const POOL_SIZE = 48;

// Quadrant → local offset from vehicle center (approximate wheel positions)
const QUAD_OFFSETS = [
	new THREE.Vector3( - 0.4, 0.1, 0.5 ),  // FL
	new THREE.Vector3( 0.4, 0.1, 0.5 ),     // FR
	new THREE.Vector3( - 0.4, 0.1, - 0.5 ), // RL
	new THREE.Vector3( 0.4, 0.1, - 0.5 ),   // RR
];

// Emission rates per damage state (particles per second)
const EMIT_RATES = {
	[ DAMAGE_STATE.GREEN ]: 0,
	[ DAMAGE_STATE.YELLOW ]: 3,
	[ DAMAGE_STATE.ORANGE ]: 8,
	[ DAMAGE_STATE.RED ]: 16,
	[ DAMAGE_STATE.BROKEN ]: 20,
};

// Colors: sparks = yellow/orange, smoke = gray
const SPARK_COLORS = [ 0xffcc00, 0xff8800, 0xffaa22 ];
const SMOKE_COLOR = 0x888888;

const _spriteMat = new THREE.SpriteMaterial( {
	color: 0xffffff,
	transparent: true,
	opacity: 0.8,
	depthWrite: false,
	blending: THREE.AdditiveBlending,
} );

const _smokeMat = new THREE.SpriteMaterial( {
	color: SMOKE_COLOR,
	transparent: true,
	opacity: 0.4,
	depthWrite: false,
	blending: THREE.NormalBlending,
} );


export class DamageVFX {

	constructor( scene ) {

		this._scene = scene;

		// Sprite pool: half sparks, half smoke
		this._sparks = [];
		this._smokes = [];

		for ( let i = 0; i < POOL_SIZE / 2; i ++ ) {

			const spark = new THREE.Sprite( _spriteMat.clone() );
			spark.scale.set( 0.06, 0.06, 1 );
			spark.visible = false;
			spark.userData = { life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0 };
			scene.add( spark );
			this._sparks.push( spark );

			const smoke = new THREE.Sprite( _smokeMat.clone() );
			smoke.scale.set( 0.12, 0.12, 1 );
			smoke.visible = false;
			smoke.userData = { life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0 };
			scene.add( smoke );
			this._smokes.push( smoke );

		}

		this._sparkIdx = 0;
		this._smokeIdx = 0;

		// Per-quadrant emission accumulators (for fractional emission)
		this._emitAccum = [ 0, 0, 0, 0 ];

		// Wheel wobble state
		this._wobblePhase = [ 0, 0, 0, 0 ];

	}

	/**
	 * Update damage effects for a vehicle.
	 * Call once per frame for the local player vehicle.
	 *
	 * @param {number} dt
	 * @param {object} vehicle - Vehicle instance with health and wheel refs
	 */
	update( dt, vehicle ) {

		// Tick existing particles
		this._tickPool( this._sparks, dt );
		this._tickPool( this._smokes, dt );

		if ( ! vehicle || ! vehicle.health ) return;

		const health = vehicle.health;

		// Emit per quadrant
		for ( let q = 0; q < 4; q ++ ) {

			const state = health.quadrants[ q ].state;
			const rate = EMIT_RATES[ state ];
			if ( rate <= 0 ) {

				this._emitAccum[ q ] = 0;
				continue;

			}

			this._emitAccum[ q ] += rate * dt;

			while ( this._emitAccum[ q ] >= 1 ) {

				this._emitAccum[ q ] -= 1;
				this._emitParticle( vehicle, q, state );

			}

			// Wheel wobble for RED and BROKEN
			if ( state >= DAMAGE_STATE.RED ) {

				this._wobblePhase[ q ] += dt * 15;
				const wobbleAmt = state === DAMAGE_STATE.BROKEN ? 0.08 : 0.04;
				const wheel = this._getWheel( vehicle, q );
				if ( wheel ) {

					wheel.rotation.z = Math.sin( this._wobblePhase[ q ] ) * wobbleAmt;

				}

			} else {

				// Reset wobble
				const wheel = this._getWheel( vehicle, q );
				if ( wheel && this._wobblePhase[ q ] !== 0 ) {

					wheel.rotation.z = 0;
					this._wobblePhase[ q ] = 0;

				}

			}

		}

	}

	_emitParticle( vehicle, quadrant, state ) {

		// Get world position for this quadrant
		_tmpPos.copy( QUAD_OFFSETS[ quadrant ] );
		vehicle.container.localToWorld( _tmpPos );

		const useSpark = state <= DAMAGE_STATE.ORANGE || Math.random() > 0.5;

		if ( useSpark ) {

			const spark = this._sparks[ this._sparkIdx ];
			this._sparkIdx = ( this._sparkIdx + 1 ) % this._sparks.length;

			spark.position.copy( _tmpPos );
			spark.visible = true;
			const color = SPARK_COLORS[ Math.floor( Math.random() * SPARK_COLORS.length ) ];
			spark.material.color.setHex( color );
			spark.material.opacity = 0.9;

			const ud = spark.userData;
			ud.life = 0;
			ud.maxLife = 0.15 + Math.random() * 0.2;
			ud.vx = ( Math.random() - 0.5 ) * 2;
			ud.vy = 1 + Math.random() * 2;
			ud.vz = ( Math.random() - 0.5 ) * 2;

		} else {

			const smoke = this._smokes[ this._smokeIdx ];
			this._smokeIdx = ( this._smokeIdx + 1 ) % this._smokes.length;

			smoke.position.copy( _tmpPos );
			smoke.visible = true;
			smoke.material.opacity = 0.35;

			const ud = smoke.userData;
			ud.life = 0;
			ud.maxLife = 0.4 + Math.random() * 0.3;
			ud.vx = ( Math.random() - 0.5 ) * 0.5;
			ud.vy = 0.8 + Math.random() * 0.5;
			ud.vz = ( Math.random() - 0.5 ) * 0.5;

		}

	}

	_tickPool( pool, dt ) {

		for ( const sprite of pool ) {

			if ( ! sprite.visible ) continue;

			const ud = sprite.userData;
			ud.life += dt;

			if ( ud.life >= ud.maxLife ) {

				sprite.visible = false;
				continue;

			}

			sprite.position.x += ud.vx * dt;
			sprite.position.y += ud.vy * dt;
			sprite.position.z += ud.vz * dt;

			// Fade out
			const t = ud.life / ud.maxLife;
			sprite.material.opacity *= ( 1 - t * 0.5 );

			// Grow smoke
			if ( sprite.material.blending === THREE.NormalBlending ) {

				const s = 0.12 + t * 0.15;
				sprite.scale.set( s, s, 1 );

			}

		}

	}

	_getWheel( vehicle, quadrant ) {

		switch ( quadrant ) {

			case QUADRANT.FL: return vehicle.wheelFL;
			case QUADRANT.FR: return vehicle.wheelFR;
			case QUADRANT.RL: return vehicle.wheelBL;
			case QUADRANT.RR: return vehicle.wheelBR;

		}

		return null;

	}

	dispose() {

		for ( const s of this._sparks ) {

			s.removeFromParent();
			s.material.dispose();

		}

		for ( const s of this._smokes ) {

			s.removeFromParent();
			s.material.dispose();

		}

	}

}
