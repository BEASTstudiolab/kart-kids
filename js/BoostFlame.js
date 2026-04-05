import * as THREE from 'three';

// Implements: docs/plans/2026-03-31-002-feat-gameplay-juice-pass-plan.md — Unit 4 (R18)
// Continuous flame trail from rear wheels during nitro boost or mini-boost.
// vehicle.miniBoostTimer is added in Unit 3; guards safely no-op until then.

const POOL_SIZE = 32;

const _worldPos = new THREE.Vector3();
const _backward = new THREE.Vector3();

export class BoostFlame {

	constructor( scene ) {

		this.particles = [];

		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );
		this.material = new THREE.SpriteMaterial( {
			map,
			transparent: true,
			depthWrite: false,
			opacity: 0,
			color: 0xff4400,
			blending: THREE.AdditiveBlending,
		} );

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.setScalar( 0.2 );
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

	update( dt, vehicle ) {

		// Emit while nitro or mini-boost is active (miniBoostTimer added in Unit 3).
		const isActive = vehicle.boostActive || ( vehicle.miniBoostTimer > 0 );

		// Rate-limited emission: max 30 particles/sec
		this._emitTimer = ( this._emitTimer || 0 ) + dt;

		if ( isActive && this._emitTimer > 1 / 30 ) {

			this._emitTimer = 0;

			// Backward direction = negative vehicle forward.
			_backward.set( 0, 0, - 1 ).applyQuaternion( vehicle.container.quaternion );
			_backward.y = 0;
			_backward.normalize();

			if ( vehicle.wheelBL ) this._emitAtWheel( vehicle.wheelBL, vehicle, _backward );
			if ( vehicle.wheelBR ) this._emitAtWheel( vehicle.wheelBR, vehicle, _backward );

		}

		// Update existing particles.
		for ( const p of this.particles ) {

			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				p.sprite.visible = false;
				continue;

			}

			p.sprite.position.addScaledVector( p.velocity, dt );

			// Fade out linearly over lifetime.
			p.sprite.material.opacity = p.life / p.maxLife;

		}

	}

	_emitAtWheel( wheel, vehicle, backward ) {

		const p = this.particles[ this.emitIndex ];
		this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

		wheel.getWorldPosition( _worldPos );
		_worldPos.y = vehicle.container.position.y + 0.05;

		p.sprite.position.copy( _worldPos );
		p.sprite.visible = true;
		p.sprite.material.opacity = 1;

		p.initialScale = 0.2 + Math.random() * 0.1;
		p.sprite.scale.setScalar( p.initialScale );

		// Velocity biased backward, slight upward drift, narrow lateral scatter.
		const speed = 1.5 + Math.random() * 1.5;
		p.velocity.set(
			backward.x * speed + ( Math.random() - 0.5 ) * 0.4,
			0.1 + Math.random() * 0.3,
			backward.z * speed + ( Math.random() - 0.5 ) * 0.4
		);

		p.maxLife = 0.3;
		p.life = p.maxLife;

	}

	dispose() {

		for ( const p of this.particles ) {

			p.sprite.removeFromParent();
			p.sprite.material.dispose();

		}

		this.material.dispose();

	}

}
