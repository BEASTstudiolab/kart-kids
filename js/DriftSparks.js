import * as THREE from 'three';
import { getSmokeTexture } from './VFXTextures.js';

const POOL_SIZE = 64;

// Yellow/orange spark palette
const SPARK_COLORS = [ 0xffdd33, 0xffaa00, 0xff8800, 0xffee66 ];

const _worldPos = new THREE.Vector3();
const _fwdDir = new THREE.Vector3();

export class DriftSparks {

	constructor( scene ) {

		this.particles = [];

		const map = getSmokeTexture();
		this.material = new THREE.SpriteMaterial( {
			map,
			transparent: true,
			depthWrite: false,
			opacity: 0,
			blending: THREE.AdditiveBlending,
		} );

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.setScalar( 0.03 );
			scene.add( sprite );

			this.particles.push( {
				sprite,
				life: 0,
				maxLife: 0,
				velocity: new THREE.Vector3(),
				initialScale: 0,
				isStreak: false,
			} );

		}

		this.emitIndex = 0;
		this._emitTimer = 0;

	}

	update( dt, vehicle ) {

		// Emit during drift OR hard turns
		const isTurningHard = Math.abs( vehicle.inputX ) > 0.8 && Math.abs( vehicle.linearSpeed ) > 0.5;
		const shouldEmit = ( vehicle.driftActive && vehicle.driftSparkTier > 0 ) || isTurningHard;

		if ( shouldEmit ) {

			this._emitTimer += dt;
			const emitInterval = 1 / 12; // 12 emits/sec per wheel

			if ( this._emitTimer >= emitInterval ) {

				this._emitTimer -= emitInterval;

				if ( vehicle.wheelBL ) this._emitAtWheel( vehicle.wheelBL, vehicle );
				if ( vehicle.wheelBR ) this._emitAtWheel( vehicle.wheelBR, vehicle );

			}

		} else {

			this._emitTimer = 0;

		}

		// Update existing particles
		for ( const p of this.particles ) {

			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				p.sprite.visible = false;
				continue;

			}

			const t = 1 - ( p.life / p.maxLife ); // 0 → 1

			p.sprite.position.addScaledVector( p.velocity, dt );

			if ( p.isStreak ) {

				// Ground streaks: stay low, fade and shrink quickly
				p.velocity.multiplyScalar( 1 - 4 * dt );
				p.sprite.scale.set(
					p.initialScale * ( 1 - t * 0.8 ) * 3, // elongated
					p.initialScale * ( 1 - t * 0.9 ),
					1
				);
				p.sprite.material.opacity = ( 1 - t ) * ( 1 - t );

			} else {

				// Embers: rise and drift, shrink to nothing
				p.velocity.y += 0.3 * dt;
				p.velocity.multiplyScalar( 1 - 3 * dt );
				const s = p.initialScale * ( 1 - t );
				p.sprite.scale.setScalar( s );
				p.sprite.material.opacity = ( 1 - t * t ) * 0.8;

			}

		}

	}

	_emitAtWheel( wheel, vehicle ) {

		// Get wheel ground position
		wheel.getWorldPosition( _worldPos );
		const groundY = vehicle.container.position.y + 0.02;

		// Vehicle forward direction for streak alignment
		_fwdDir.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );

		// Emit 1 ground streak + 1-2 embers per burst
		// Ground streak
		this._emitParticle( _worldPos, groundY, _fwdDir, vehicle, true );

		// Ember (50% chance of a second)
		this._emitParticle( _worldPos, groundY, _fwdDir, vehicle, false );
		if ( Math.random() > 0.5 ) {

			this._emitParticle( _worldPos, groundY, _fwdDir, vehicle, false );

		}

	}

	_emitParticle( pos, groundY, fwd, vehicle, isStreak ) {

		const p = this.particles[ this.emitIndex ];
		this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

		p.isStreak = isStreak;
		p.sprite.visible = true;
		p.sprite.material.color.setHex( SPARK_COLORS[ Math.floor( Math.random() * SPARK_COLORS.length ) ] );

		if ( isStreak ) {

			// Ground streak: starts at wheel, slides backward along ground
			p.sprite.position.set(
				pos.x + ( Math.random() - 0.5 ) * 0.15,
				groundY,
				pos.z + ( Math.random() - 0.5 ) * 0.15
			);

			p.initialScale = 0.04 + Math.random() * 0.03;

			// Streak moves opposite to vehicle forward + lateral scatter
			const speed = Math.abs( vehicle.linearSpeed ) * 0.3;
			p.velocity.set(
				- fwd.x * speed + ( Math.random() - 0.5 ) * 0.5,
				0,
				- fwd.z * speed + ( Math.random() - 0.5 ) * 0.5
			);

			p.sprite.material.opacity = 1;
			p.maxLife = 0.1 + Math.random() * 0.15; // very short — 0.1-0.25s
			p.life = p.maxLife;

		} else {

			// Ember: launches up from wheel, drifts and dies
			p.sprite.position.set(
				pos.x + ( Math.random() - 0.5 ) * 0.2,
				groundY + Math.random() * 0.05,
				pos.z + ( Math.random() - 0.5 ) * 0.2
			);

			p.initialScale = 0.03 + Math.random() * 0.03;
			p.sprite.scale.setScalar( p.initialScale );

			p.velocity.set(
				( Math.random() - 0.5 ) * 2.0,
				0.8 + Math.random() * 1.5,
				( Math.random() - 0.5 ) * 2.0
			);

			p.sprite.material.opacity = 1;
			p.maxLife = 0.3 + Math.random() * 0.4; // 0.3-0.7s
			p.life = p.maxLife;

		}

	}

	dispose() {

		for ( const p of this.particles ) {

			p.sprite.removeFromParent();
			p.sprite.material.dispose();

		}

		this.material.dispose();

	}

}
