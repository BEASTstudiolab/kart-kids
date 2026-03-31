import * as THREE from 'three';

const POOL_SIZE = 12;

const POWERUP_COLORS = {
	speed: [ 0x4488ff, 0x66aaff, 0x2266dd ],
	shield: [ 0x44ff66, 0x22dd44, 0x88ffaa ],
	star: [ 0xffdd44, 0xffaa00, 0xffee88 ],
};

export class ItemPickupVFX {

	constructor( scene ) {

		this.particles = [];

		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );
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

	emit( x, z, powerupType ) {

		const colors = POWERUP_COLORS[ powerupType ] || POWERUP_COLORS.speed;
		const count = 10;

		for ( let i = 0; i < count; i ++ ) {

			const p = this.particles[ this.emitIndex ];
			this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

			p.sprite.position.set( x, 1.0, z );
			p.sprite.visible = true;
			p.sprite.material.opacity = 1;
			p.sprite.material.color.setHex( colors[ Math.floor( Math.random() * colors.length ) ] );

			p.initialScale = 0.2 + Math.random() * 0.15;
			p.sprite.scale.setScalar( p.initialScale );

			// Radial burst outward + upward
			const angle = Math.random() * Math.PI * 2;
			const speed = 2 + Math.random() * 3;
			p.velocity.set(
				Math.cos( angle ) * speed,
				2 + Math.random() * 2,
				Math.sin( angle ) * speed
			);

			p.maxLife = 0.4;
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

			p.velocity.y -= 4 * dt;
			p.sprite.position.addScaledVector( p.velocity, dt );

			const t = 1 - ( p.life / p.maxLife );
			p.sprite.scale.setScalar( p.initialScale * ( 1 - t * 0.5 ) );
			p.sprite.material.opacity = 1 - t * t;

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
