import * as THREE from 'three';

const POOL_SIZE = 16;
const EMBER_COLORS = [ 0xffaa22, 0xff8811, 0xffcc33, 0xff6600 ];

export class WallSparks {

	constructor( scene ) {

		this.particles = [];

		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );
		this.material = new THREE.SpriteMaterial( {
			map,
			transparent: true,
			depthWrite: false,
			opacity: 0,
			color: 0xffaa22,
			blending: THREE.AdditiveBlending,
		} );

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.setScalar( 0.08 );
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

	emit( worldPos, normalX, normalZ, magnitude ) {

		const count = 8 + Math.floor( Math.random() * 5 ); // 8-12 embers

		for ( let i = 0; i < count; i ++ ) {

			const p = this.particles[ this.emitIndex ];
			this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

			// Start concentrated at impact point, tight cluster
			p.sprite.position.set(
				worldPos.x + normalX * 0.3 + ( Math.random() - 0.5 ) * 0.15,
				worldPos.y + ( Math.random() * 0.1 ),
				worldPos.z + normalZ * 0.3 + ( Math.random() - 0.5 ) * 0.15
			);
			p.sprite.visible = true;
			p.sprite.material.opacity = 1;

			// Bright orange-yellow ember color with slight variation
			p.sprite.material.color.setHex( EMBER_COLORS[ Math.floor( Math.random() * EMBER_COLORS.length ) ] );

			// Start bigger, will shrink over lifetime
			const scaleMag = THREE.MathUtils.clamp( magnitude / 8, 0.5, 1.5 );
			p.initialScale = ( 0.08 + Math.random() * 0.06 ) * scaleMag;
			p.sprite.scale.setScalar( p.initialScale );

			// Scatter outward from wall + upward lift (embers rise)
			const outSpeed = 1.5 + Math.random() * 2;
			p.velocity.set(
				normalX * outSpeed + ( Math.random() - 0.5 ) * 1.5,
				1.5 + Math.random() * 3, // strong upward lift
				normalZ * outSpeed + ( Math.random() - 0.5 ) * 1.5
			);

			p.maxLife = 0.3 + Math.random() * 0.3; // 0.3-0.6s — longer to see the rise
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

			const t = 1 - ( p.life / p.maxLife ); // 0 → 1 over lifetime

			// Light gravity — embers drift upward then slow
			p.velocity.y -= 2 * dt;

			// Damping — embers slow as they cool
			p.velocity.multiplyScalar( 1 - 1.5 * dt );

			p.sprite.position.addScaledVector( p.velocity, dt );

			// Shrink as they rise and cool (ember effect)
			p.sprite.scale.setScalar( p.initialScale * ( 1 - t * 0.7 ) );

			// Fade: bright at start, dim out over life
			p.sprite.material.opacity = 1 - t * t; // quadratic fade — stays bright longer

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
