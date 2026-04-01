import * as THREE from 'three';

const POOL_SIZE = 20;
const BASE_OPACITY = 0.3;
const LINE_LIFETIME = 0.3;

const _leadForward = new THREE.Vector3();
const _trailerForward = new THREE.Vector3();
const _segmentStart = new THREE.Vector3();
const _segmentEnd = new THREE.Vector3();
const _spawnPos = new THREE.Vector3();
const _lateral = new THREE.Vector3();

export class DraftLines {

	constructor( scene ) {

		// ── State ───────────────────────────────────────────────────────────
		this.particles = [];
		this.emitIndex = 0;
		this._emitTimers = new Map();
		this._activeVehicles = new Set();
		this._staleVehicles = [];

		// ── Material Pool ───────────────────────────────────────────────────
		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );
		this.material = new THREE.SpriteMaterial( {
			map,
			color: 0xffffff,
			transparent: true,
			depthWrite: false,
			opacity: BASE_OPACITY,
			blending: THREE.AdditiveBlending,
		} );

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.set( 0.08, 0.4, 1 );
			scene.add( sprite );

			this.particles.push( {
				sprite,
				life: 0,
				maxLife: 0,
				velocity: new THREE.Vector3(),
				width: 0.08,
				length: 0.4,
			} );

		}

	}

	update( dt, activeDrafts ) {

		// ── Emission ────────────────────────────────────────────────────────
		this._activeVehicles.clear();

		if ( activeDrafts instanceof Map ) {

			for ( const [ trailerVehicle, draftState ] of activeDrafts ) {

				if ( ! trailerVehicle || ! draftState?.leadVehicle || draftState.intensity <= 0 ) continue;

				this._activeVehicles.add( trailerVehicle );

				const interval = THREE.MathUtils.lerp( 0.14, 0.04, Math.min( draftState.intensity, 1 ) );
				const timer = ( this._emitTimers.get( trailerVehicle ) || 0 ) + dt;

				if ( timer >= interval ) {

					let remaining = timer;

					while ( remaining >= interval ) {

						this._emitLine( trailerVehicle, draftState.leadVehicle, draftState.intensity );
						remaining -= interval;

					}

					this._emitTimers.set( trailerVehicle, remaining );

				} else {

					this._emitTimers.set( trailerVehicle, timer );

				}

			}

		}

		this._staleVehicles.length = 0;

		for ( const vehicle of this._emitTimers.keys() ) {

			if ( ! this._activeVehicles.has( vehicle ) ) {

				this._staleVehicles.push( vehicle );

			}

		}

		for ( let i = 0; i < this._staleVehicles.length; i ++ ) {

			this._emitTimers.delete( this._staleVehicles[ i ] );

		}

		// ── Particle Update ────────────────────────────────────────────────
		for ( const p of this.particles ) {

			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				p.sprite.visible = false;
				continue;

			}

			const lifeT = p.life / p.maxLife;

			p.sprite.position.addScaledVector( p.velocity, dt );
			p.sprite.material.opacity = BASE_OPACITY * lifeT;
			p.sprite.scale.set( p.width * lifeT, p.length * ( 0.6 + 0.4 * lifeT ), 1 );

		}

	}

	_emitLine( trailerVehicle, leadVehicle, intensity ) {

		// ── Segment Setup ───────────────────────────────────────────────────
		_leadForward.set( 0, 0, 1 ).applyQuaternion( leadVehicle.container.quaternion );
		_leadForward.y = 0;

		if ( _leadForward.lengthSq() === 0 ) return;

		_leadForward.normalize();

		_trailerForward.set( 0, 0, 1 ).applyQuaternion( trailerVehicle.container.quaternion );
		_trailerForward.y = 0;

		if ( _trailerForward.lengthSq() === 0 ) return;

		_trailerForward.normalize();

		_segmentStart.copy( leadVehicle.spherePos ).addScaledVector( _leadForward, - 0.55 );
		_segmentEnd.copy( trailerVehicle.spherePos ).addScaledVector( _trailerForward, 0.45 );

		// Lateral offset keeps the streaks from stacking into a single line.
		_lateral.set( - _leadForward.z, 0, _leadForward.x );
		const segmentT = Math.random();
		const lateralOffset = ( Math.random() - 0.5 ) * THREE.MathUtils.lerp( 0.08, 0.28, intensity );

		_spawnPos.lerpVectors( _segmentStart, _segmentEnd, segmentT );
		_spawnPos.addScaledVector( _lateral, lateralOffset );
		_spawnPos.y += 0.15 + Math.random() * 0.12;

		// ── Particle Acquire ────────────────────────────────────────────────
		const p = this.particles[ this.emitIndex ];
		this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

		p.sprite.position.copy( _spawnPos );
		p.sprite.visible = true;
		p.sprite.material.opacity = BASE_OPACITY;
		p.sprite.material.rotation = Math.atan2( _leadForward.x, _leadForward.z );

		p.width = 0.05 + Math.random() * 0.03;
		p.length = 0.28 + intensity * 0.2 + Math.random() * 0.1;
		p.sprite.scale.set( p.width, p.length, 1 );

		const speed = 2.4 + intensity * 1.8 + Math.random() * 0.8;
		p.velocity.set(
			_leadForward.x * speed,
			0.03 + Math.random() * 0.06,
			_leadForward.z * speed
		);

		p.maxLife = LINE_LIFETIME;
		p.life = p.maxLife;

	}

	dispose() {

		// ── Cleanup ─────────────────────────────────────────────────────────
		for ( const p of this.particles ) {

			p.sprite.removeFromParent();
			p.sprite.material.dispose();

		}

		this.material.dispose();
		this._emitTimers.clear();
		this._activeVehicles.clear();
		this._staleVehicles.length = 0;

	}

}
