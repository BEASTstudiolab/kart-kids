import * as THREE from 'three';

const POOL_SIZE = 48;

// Stage color palettes — embers get hotter at higher stages
const STAGE_COLORS = [
	[ 0xffaa22 ],                                // stage 0 — unused
	[ 0xffaa22, 0xff8811, 0xffcc33 ],            // stage 1 — warm orange-yellow
	[ 0xffcc33, 0xffdd44, 0xffee66, 0xff8811 ],  // stage 2 — brighter yellow-orange
	[ 0xff6600, 0xff4400, 0xff8800, 0xffaa00 ],  // stage 3 — hot red-orange
];

const _worldPos = new THREE.Vector3();

export class DriftSparks {

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
			sprite.scale.setScalar( 0.06 );
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

		// Only emit while actively drifting
		if ( vehicle.driftStage > 0 ) {

			const stage = Math.min( vehicle.driftStage, 3 );

			if ( vehicle.wheelBL ) this._emitAtWheel( vehicle.wheelBL, vehicle, stage );
			if ( vehicle.wheelBR ) this._emitAtWheel( vehicle.wheelBR, vehicle, stage );

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

			// Embers rise gently
			p.velocity.y += 0.5 * dt;

			// Damping — embers slow down
			p.velocity.multiplyScalar( 1 - 2 * dt );

			p.sprite.position.addScaledVector( p.velocity, dt );

			// Shrink over lifetime — concentrated → tiny ember
			p.sprite.scale.setScalar( p.initialScale * ( 1 - t * 0.6 ) );

			// Fade: stays bright then dims at end
			p.sprite.material.opacity = 1 - t * t;

		}

	}

	_emitAtWheel( wheel, vehicle, stage ) {

		const p = this.particles[ this.emitIndex ];
		this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

		// Start at ground level right at the wheel — concentrated
		wheel.getWorldPosition( _worldPos );
		_worldPos.y = vehicle.container.position.y + 0.02;

		p.sprite.position.set(
			_worldPos.x + ( Math.random() - 0.5 ) * 0.1,
			_worldPos.y,
			_worldPos.z + ( Math.random() - 0.5 ) * 0.1
		);
		p.sprite.visible = true;
		p.sprite.material.opacity = 1;

		// Pick a random color from this stage's palette
		const palette = STAGE_COLORS[ stage ];
		p.sprite.material.color.setHex( palette[ Math.floor( Math.random() * palette.length ) ] );

		// Start larger at ground, will shrink as ember rises
		p.initialScale = 0.06 + Math.random() * 0.04;

		// Higher stages = slightly bigger embers
		if ( stage >= 2 ) p.initialScale *= 1.3;
		if ( stage >= 3 ) p.initialScale *= 1.2;

		p.sprite.scale.setScalar( p.initialScale );

		// Velocity: mostly upward lift with slight lateral scatter
		p.velocity.set(
			( Math.random() - 0.5 ) * 0.8,
			0.8 + Math.random() * 1.5, // upward lift from ground
			( Math.random() - 0.5 ) * 0.8
		);

		p.maxLife = 0.25 + Math.random() * 0.2; // 0.25-0.45s
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
