import * as THREE from 'three';
import { getSmokeTexture } from './VFXTextures.js';

// Implements: docs/plans/2026-03-31-002-feat-gameplay-juice-pass-plan.md — Unit 4 (R19)
// One-shot radial burst behind the vehicle on boost activation. Called from main.js.

const POOL_SIZE = 16;

let _sharedMaterial = null;

function _getSharedMaterial() {

	if ( ! _sharedMaterial ) {

		_sharedMaterial = new THREE.SpriteMaterial( {
			map: getSmokeTexture(),
			transparent: true,
			depthWrite: false,
			opacity: 0,
			color: 0xffaa00,
			blending: THREE.AdditiveBlending,
		} );

	}

	return _sharedMaterial;

}

export class BoostBurst {

	constructor( scene ) {

		this.particles = [];

		this.material = _getSharedMaterial();

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.setScalar( 0.15 );
			scene.add( sprite );

			this.particles.push( {
				sprite,
				life: 0,
				maxLife: 0,
				velocity: new THREE.Vector3(),
				initialScale: 0,
			} );

		}

		this.emitIndex = 0;

	}

	// One-shot cone burst: emit 12-16 sprites behind the vehicle at worldPos.
	// forwardX/forwardZ are the vehicle's normalized forward vector components.
	emit( worldPos, forwardX, forwardZ ) {

		const count = 12 + Math.floor( Math.random() * 5 ); // 12-16

		for ( let i = 0; i < count; i ++ ) {

			const p = this.particles[ this.emitIndex ];
			this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

			p.sprite.position.copy( worldPos );
			p.sprite.visible = true;
			p.sprite.material.opacity = 1;

			p.initialScale = 0.15 + Math.random() * 0.15;
			p.sprite.scale.setScalar( p.initialScale );

			// Velocity scattered in a cone behind the vehicle (negative forward direction).
			const speed = 2 + Math.random() * 4;
			const spread = 1.2; // cone half-width in world units
			p.velocity.set(
				- forwardX * speed + ( Math.random() - 0.5 ) * spread,
				Math.random() * 1.5,
				- forwardZ * speed + ( Math.random() - 0.5 ) * spread
			);

			p.maxLife = 0.3;
			p.life = p.maxLife;

		}

	}

	update( dt ) {

		for ( const p of this.particles ) {

			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				p.sprite.visible = false;
				continue;

			}

			// Gravity
			p.velocity.y -= 3 * dt;

			p.sprite.position.addScaledVector( p.velocity, dt );

			// Fade out linearly over lifetime.
			p.sprite.material.opacity = p.life / p.maxLife;

		}

	}

	dispose() {

		for ( const p of this.particles ) {

			p.sprite.removeFromParent();
			p.sprite.material.dispose();

		}

		// Shared base material intentionally retained — other racers may still use it.

	}

}
