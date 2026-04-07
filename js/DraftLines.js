import * as THREE from 'three';
import { getSmokeTexture } from './VFXTextures.js';

const POOL_SIZE = 24;
const CONE_POOL_SIZE = 8;
const CONE_LINE_POOL = 16;

// Bluey-grey palette
const DRAFT_GREY = 0x8899aa;
const DRAFT_BLUE = 0x7799bb;
const DRAFT_BRIGHT = 0x88bbdd;

// ── Tier Configurations ─────────────────────────────────────────────────────
const TIER_OPPORTUNITY = {
	color: DRAFT_GREY,
	baseOpacity: 0.14,
	lifetime: 0.25,
	minInterval: 0.10,
	maxInterval: 0.14,
	lengthBase: 0.22,
	lengthIntensity: 0.08,
	spreadMin: 0.06,
	spreadMax: 0.16,
	speedBase: 2.0,
	speedIntensity: 1.0,
	widthBase: 0.03,
	widthRand: 0.02,
};

const TIER_ACTIVE = {
	color: DRAFT_BLUE,
	baseOpacity: 0.22,
	lifetime: 0.28,
	minInterval: 0.05,
	maxInterval: 0.09,
	lengthBase: 0.26,
	lengthIntensity: 0.18,
	spreadMin: 0.08,
	spreadMax: 0.24,
	speedBase: 2.6,
	speedIntensity: 1.8,
	widthBase: 0.04,
	widthRand: 0.03,
};

const TIER_BOOST = {
	color: DRAFT_BRIGHT,
	baseOpacity: 0.35,
	lifetime: 0.32,
	minInterval: 0.025,
	maxInterval: 0.04,
	lengthBase: 0.32,
	lengthIntensity: 0.25,
	spreadMin: 0.10,
	spreadMax: 0.30,
	speedBase: 3.2,
	speedIntensity: 2.4,
	widthBase: 0.05,
	widthRand: 0.04,
};

// ── Cone Shader ─────────────────────────────────────────────────────────────
const coneVertexShader = /* glsl */ `
	varying float vFade;
	varying float vRadial;
	void main() {
		vFade = smoothstep( 0.0, 0.6, uv.y );
		vRadial = abs( uv.x - 0.5 ) * 2.0;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	}
`;

const coneFragmentShader = /* glsl */ `
	uniform vec3 uColor;
	uniform float uOpacity;
	uniform float uTime;
	varying float vFade;
	varying float vRadial;
	void main() {
		float edgeFade = 1.0 - smoothstep( 0.4, 1.0, vRadial );
		float wind = sin( vRadial * 14.0 - uTime * 5.0 ) * 0.35 + 0.65;
		float alpha = vFade * edgeFade * wind * uOpacity;
		gl_FragColor = vec4( uColor, alpha );
	}
`;

const _leadForward = new THREE.Vector3();
const _trailerForward = new THREE.Vector3();
const _segmentStart = new THREE.Vector3();
const _segmentEnd = new THREE.Vector3();
const _spawnPos = new THREE.Vector3();
const _lateral = new THREE.Vector3();
const _conePos = new THREE.Vector3();

export class DraftLines {

	constructor( scene ) {

		this._scene = scene;

		// ── Particle State ──────────────────────────────────────────────────
		this.particles = [];
		this.emitIndex = 0;
		this._emitTimers = new Map();
		this._activeVehicles = new Set();
		this._staleVehicles = [];
		this._time = 0;

		// ── Particle Material Pool ──────────────────────────────────────────
		const map = getSmokeTexture();
		this.material = new THREE.SpriteMaterial( {
			map,
			color: 0xffffff,
			transparent: true,
			depthWrite: false,
			opacity: 0.15,
			blending: THREE.AdditiveBlending,
		} );

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.set( 0.04, 0.25, 1 );
			scene.add( sprite );

			this.particles.push( {
				sprite,
				life: 0,
				maxLife: 0,
				velocity: new THREE.Vector3(),
				width: 0.04,
				length: 0.25,
				baseOpacity: 0.15,
			} );

		}

		// ── Draft Zone Cone Pool ────────────────────────────────────────────
		const coneGeo = new THREE.ConeGeometry( 1.4, 5.0, 12, 1, true );
		coneGeo.rotateX( Math.PI / 2 );
		coneGeo.translate( 0, 0, - 2.5 );

		this._coneGeo = coneGeo;
		this._cones = new Map();
		this._conePool = [];
		this._activeConeLeads = new Set();

		for ( let i = 0; i < CONE_POOL_SIZE; i ++ ) {

			const mat = new THREE.ShaderMaterial( {
				uniforms: {
					uColor: { value: new THREE.Color( DRAFT_GREY ) },
					uOpacity: { value: 0.10 },
					uTime: { value: 0 },
				},
				vertexShader: coneVertexShader,
				fragmentShader: coneFragmentShader,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				blending: THREE.AdditiveBlending,
			} );

			const mesh = new THREE.Mesh( coneGeo, mat );
			mesh.visible = false;
			mesh.renderOrder = 2;
			mesh.frustumCulled = false;
			mesh.scale.set( 1, 0.35, 1 );
			scene.add( mesh );
			this._conePool.push( mesh );

		}

		// ── Cone Wind-Line Sprites ──────────────────────────────────────────
		this._coneLines = [];
		this._coneLineIndex = 0;
		this._coneLineTimers = new Map();

		for ( let i = 0; i < CONE_LINE_POOL; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.material.color.setHex( DRAFT_GREY );
			sprite.visible = false;
			sprite.scale.set( 0.015, 0.4, 1 );
			scene.add( sprite );

			this._coneLines.push( {
				sprite,
				life: 0,
				maxLife: 0,
				velocity: new THREE.Vector3(),
				width: 0.015,
				length: 0.4,
				baseOpacity: 0.10,
			} );

		}

	}

	_getTier( intensity ) {

		if ( intensity >= 0.95 ) return TIER_BOOST;
		if ( intensity >= 0.3 ) return TIER_ACTIVE;
		return TIER_OPPORTUNITY;

	}

	_acquireCone( leadVehicle ) {

		let cone = this._cones.get( leadVehicle );
		if ( cone ) return cone;

		cone = this._conePool.pop();
		if ( ! cone ) return null;

		this._cones.set( leadVehicle, cone );
		return cone;

	}

	_releaseCone( leadVehicle ) {

		const cone = this._cones.get( leadVehicle );
		if ( ! cone ) return;

		cone.visible = false;
		this._conePool.push( cone );
		this._cones.delete( leadVehicle );

	}

	update( dt, activeDrafts, proximityLeads ) {

		this._time += dt;

		// ── Particle Emission (active drafts only) ──────────────────────────
		this._activeVehicles.clear();
		this._activeConeLeads.clear();

		if ( activeDrafts instanceof Map ) {

			for ( const [ trailerVehicle, draftState ] of activeDrafts ) {

				if ( ! trailerVehicle || ! draftState?.leadVehicle || draftState.intensity <= 0 ) continue;

				this._activeVehicles.add( trailerVehicle );

				const tier = this._getTier( draftState.intensity );
				const interval = THREE.MathUtils.lerp( tier.maxInterval, tier.minInterval, Math.min( draftState.intensity, 1 ) );
				const timer = ( this._emitTimers.get( trailerVehicle ) || 0 ) + dt;

				if ( timer >= interval ) {

					let remaining = timer;

					while ( remaining >= interval ) {

						this._emitLine( trailerVehicle, draftState.leadVehicle, draftState.intensity, tier );
						remaining -= interval;

					}

					this._emitTimers.set( trailerVehicle, remaining );

				} else {

					this._emitTimers.set( trailerVehicle, timer );

				}

			}

		}

		// ── Cone Display (proximity range — visible before and during draft) ─
		if ( proximityLeads instanceof Map ) {

			for ( const [ trailerVehicle, leadVehicle ] of proximityLeads ) {

				this._activeConeLeads.add( leadVehicle );

				const cone = this._acquireCone( leadVehicle );
				if ( cone ) {

					_conePos.copy( leadVehicle.vehPos );
					_conePos.y += 0.2;
					cone.position.copy( _conePos );
					cone.quaternion.copy( leadVehicle.container.quaternion );

					// Check if this lead is being actively drafted
					const draftState = activeDrafts instanceof Map ? activeDrafts.get( trailerVehicle ) : null;
					const isDrafting = draftState && draftState.leadVehicle === leadVehicle && draftState.intensity > 0;

					// Cone stays at 0.10 during proximity, dims slightly during active draft
					const coneOpacity = isDrafting
						? THREE.MathUtils.lerp( 0.10, 0.06, draftState.intensity )
						: 0.10;

					cone.material.uniforms.uOpacity.value = coneOpacity;
					cone.material.uniforms.uTime.value = this._time;
					cone.visible = true;

				}

				// Wind lines inside cone — use draft intensity if available, else baseline
				const draftState = activeDrafts instanceof Map ? activeDrafts.get( trailerVehicle ) : null;
				const intensity = draftState && draftState.leadVehicle === leadVehicle ? draftState.intensity : 0;
				this._emitConeLines( leadVehicle, Math.max( intensity, 0.1 ), dt );

			}

		}

		// ── Release stale emit timers ───────────────────────────────────────
		this._staleVehicles.length = 0;

		for ( const vehicle of this._emitTimers.keys() ) {

			if ( ! this._activeVehicles.has( vehicle ) ) {

				this._staleVehicles.push( vehicle );

			}

		}

		for ( let i = 0; i < this._staleVehicles.length; i ++ ) {

			this._emitTimers.delete( this._staleVehicles[ i ] );

		}

		// ── Release stale cones ─────────────────────────────────────────────
		this._staleVehicles.length = 0;

		for ( const lead of this._cones.keys() ) {

			if ( ! this._activeConeLeads.has( lead ) ) {

				this._staleVehicles.push( lead );

			}

		}

		for ( let i = 0; i < this._staleVehicles.length; i ++ ) {

			this._releaseCone( this._staleVehicles[ i ] );

		}

		// Release stale cone-line timers
		for ( const lead of this._coneLineTimers.keys() ) {

			if ( ! this._activeConeLeads.has( lead ) ) {

				this._coneLineTimers.delete( lead );

			}

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
			p.sprite.material.opacity = p.baseOpacity * lifeT;
			p.sprite.scale.set( p.width * lifeT, p.length * ( 0.6 + 0.4 * lifeT ), 1 );

		}

		// ── Cone Wind-Line Update ──────────────────────────────────────────
		for ( const cl of this._coneLines ) {

			if ( cl.life <= 0 ) continue;

			cl.life -= dt;

			if ( cl.life <= 0 ) {

				cl.sprite.visible = false;
				continue;

			}

			const lifeT = cl.life / cl.maxLife;

			cl.sprite.position.addScaledVector( cl.velocity, dt );
			cl.sprite.material.opacity = cl.baseOpacity * lifeT;
			cl.sprite.scale.set( cl.width, cl.length * ( 0.7 + 0.3 * lifeT ), 1 );

		}

	}

	_emitConeLines( leadVehicle, intensity, dt ) {

		const interval = THREE.MathUtils.lerp( 0.12, 0.05, Math.min( intensity, 1 ) );
		const timer = ( this._coneLineTimers.get( leadVehicle ) || 0 ) + dt;

		if ( timer < interval ) {

			this._coneLineTimers.set( leadVehicle, timer );
			return;

		}

		let remaining = timer;

		while ( remaining >= interval ) {

			_leadForward.set( 0, 0, 1 ).applyQuaternion( leadVehicle.container.quaternion );
			_leadForward.y = 0;
			if ( _leadForward.lengthSq() === 0 ) return;
			_leadForward.normalize();

			_lateral.set( - _leadForward.z, 0, _leadForward.x );

			const distBack = 0.5 + Math.random() * 4.0;
			const maxSpread = ( distBack / 5.0 ) * 1.2;
			const lateralOff = ( Math.random() - 0.5 ) * maxSpread;

			_spawnPos.copy( leadVehicle.vehPos );
			_spawnPos.addScaledVector( _leadForward, - distBack );
			_spawnPos.addScaledVector( _lateral, lateralOff );
			_spawnPos.y += 0.1 + Math.random() * 0.2;

			const cl = this._coneLines[ this._coneLineIndex ];
			this._coneLineIndex = ( this._coneLineIndex + 1 ) % CONE_LINE_POOL;

			cl.sprite.position.copy( _spawnPos );
			cl.sprite.visible = true;
			cl.sprite.material.color.setHex( DRAFT_GREY );
			cl.sprite.material.rotation = Math.atan2( _leadForward.x, _leadForward.z );

			cl.width = 0.012 + Math.random() * 0.008;
			cl.length = 0.3 + Math.random() * 0.25;
			cl.baseOpacity = 0.06 + intensity * 0.04;
			cl.sprite.material.opacity = cl.baseOpacity;
			cl.sprite.scale.set( cl.width, cl.length, 1 );

			const speed = 1.8 + Math.random() * 1.2;
			cl.velocity.set(
				- _leadForward.x * speed,
				0.01 + Math.random() * 0.03,
				- _leadForward.z * speed
			);

			cl.maxLife = 0.3 + Math.random() * 0.15;
			cl.life = cl.maxLife;

			remaining -= interval;

		}

		this._coneLineTimers.set( leadVehicle, remaining );

	}

	_emitLine( trailerVehicle, leadVehicle, intensity, tier ) {

		_leadForward.set( 0, 0, 1 ).applyQuaternion( leadVehicle.container.quaternion );
		_leadForward.y = 0;

		if ( _leadForward.lengthSq() === 0 ) return;

		_leadForward.normalize();

		_trailerForward.set( 0, 0, 1 ).applyQuaternion( trailerVehicle.container.quaternion );
		_trailerForward.y = 0;

		if ( _trailerForward.lengthSq() === 0 ) return;

		_trailerForward.normalize();

		_segmentStart.copy( leadVehicle.vehPos ).addScaledVector( _leadForward, - 0.55 );
		_segmentEnd.copy( trailerVehicle.vehPos ).addScaledVector( _trailerForward, 0.45 );

		_lateral.set( - _leadForward.z, 0, _leadForward.x );
		const segmentT = Math.random();
		const lateralOffset = ( Math.random() - 0.5 ) * THREE.MathUtils.lerp( tier.spreadMin, tier.spreadMax, intensity );

		_spawnPos.lerpVectors( _segmentStart, _segmentEnd, segmentT );
		_spawnPos.addScaledVector( _lateral, lateralOffset );
		_spawnPos.y += 0.15 + Math.random() * 0.12;

		const p = this.particles[ this.emitIndex ];
		this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

		p.sprite.position.copy( _spawnPos );
		p.sprite.visible = true;
		p.sprite.material.color.setHex( tier.color );
		p.sprite.material.opacity = tier.baseOpacity;
		p.sprite.material.rotation = Math.atan2( _leadForward.x, _leadForward.z );

		p.baseOpacity = tier.baseOpacity;
		p.width = tier.widthBase + Math.random() * tier.widthRand;
		p.length = tier.lengthBase + intensity * tier.lengthIntensity + Math.random() * 0.1;
		p.sprite.scale.set( p.width, p.length, 1 );

		const speed = tier.speedBase + intensity * tier.speedIntensity + Math.random() * 0.8;
		p.velocity.set(
			_leadForward.x * speed,
			0.03 + Math.random() * 0.06,
			_leadForward.z * speed
		);

		p.maxLife = tier.lifetime;
		p.life = p.maxLife;

	}

	dispose() {

		for ( const p of this.particles ) {

			p.sprite.removeFromParent();
			p.sprite.material.dispose();

		}

		this.material.dispose();
		this._emitTimers.clear();
		this._activeVehicles.clear();
		this._staleVehicles.length = 0;

		for ( const cone of this._cones.values() ) {

			cone.removeFromParent();
			cone.material.dispose();

		}

		for ( const cone of this._conePool ) {

			cone.removeFromParent();
			cone.material.dispose();

		}

		this._coneGeo.dispose();
		this._cones.clear();
		this._conePool.length = 0;
		this._activeConeLeads.clear();

		for ( const cl of this._coneLines ) {

			cl.sprite.removeFromParent();
			cl.sprite.material.dispose();

		}

		this._coneLineTimers.clear();

	}

}
