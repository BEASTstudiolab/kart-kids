import * as THREE from 'three';
import { createExplosionMaterials } from './ExplosionMaterials.js';
import { getExplosionPreset } from './ExplosionPresets.js';

const CORE_GEOMETRY = new THREE.SphereGeometry( 1, 12, 10 );
const RING_GEOMETRY = new THREE.TorusGeometry( 1, 0.12, 6, 16 );

export class ExplosionFXManager {

	constructor( scene, { quality = 'high' } = {} ) {

		this.scene = scene;
		this.quality = quality;
		this.materials = createExplosionMaterials();
		this._activeEffects = [];
		this._meshPool = [];
		this._particlePool = [];
		this._nextMeshId = 0;
		this._nextParticleId = 0;
		this.activeEffectCount = 0;
		this.activeMeshCount = 0;
		this.activeParticleCount = 0;

	}

	spawnEffect( request ) {

		const preset = getExplosionPreset( request.type );
		if ( ! preset ) return null;

		const effect = {
			preset,
			age: 0,
			lifetime: this._getLifetime( preset ),
			meshes: [],
			particles: [],
		};

		for ( const layer of preset.layers ) {

			if ( layer.kind === 'mesh' ) {

				effect.meshes.push( this._allocateMesh( layer, request ) );

			} else if ( layer.kind === 'particles' ) {

				effect.particles.push( this._allocateParticle( layer, request ) );

			}

		}

		this._activeEffects.push( effect );
		this._refreshCounts();
		return effect;

	}

	update( dt ) {

		for ( let i = this._activeEffects.length - 1; i >= 0; i -- ) {

			const effect = this._activeEffects[ i ];
			effect.age += dt;

			if ( effect.age >= effect.lifetime ) {

				this._releaseEffect( effect );
				this._activeEffects.splice( i, 1 );

			}

		}

		this._refreshCounts();

	}

	setQualityTier( quality ) {

		this.quality = quality;

	}

	dispose() {

		for ( const effect of this._activeEffects ) this._releaseEffect( effect );
		this._activeEffects.length = 0;
		this._refreshCounts();

		this.materials.blastCore.dispose();
		this.materials.blastRing.dispose();
		this.materials.energyPulse.dispose();
		this.materials.particle.dispose();

	}

	_allocateMesh( layer, request ) {

		const mesh = this._meshPool.pop() || new THREE.Mesh(
			layer.meshKind === 'groundRing' || layer.meshKind === 'wideRing' || layer.meshKind === 'heroRing'
				? RING_GEOMETRY
				: CORE_GEOMETRY,
			this.materials[ layer.materialKind ] || this.materials.blastCore
		);

		mesh.material = this.materials[ layer.materialKind ] || this.materials.blastCore;
		mesh.position.copy( request.position || new THREE.Vector3() );
		mesh.visible = true;
		mesh.material.opacity = 1;
		this.scene.add( mesh );
		return mesh;

	}

	_allocateParticle( layer, request ) {

		const sprite = this._particlePool.pop() || new THREE.Sprite( this.materials.particle.clone() );
		sprite.material = sprite.material || this.materials.particle.clone();
		sprite.position.copy( request.position || new THREE.Vector3() );
		sprite.visible = true;
		sprite.material.opacity = 1;
		this.scene.add( sprite );
		return sprite;

	}

	_releaseEffect( effect ) {

		for ( const mesh of effect.meshes ) {

			mesh.visible = false;
			mesh.removeFromParent();
			this._meshPool.push( mesh );

		}

		for ( const sprite of effect.particles ) {

			sprite.visible = false;
			sprite.removeFromParent();
			this._particlePool.push( sprite );

		}

	}

	_getLifetime( preset ) {

		switch ( preset.id ) {
			case 'mine': return 0.5;
			case 'bomb': return 0.8;
			case 'missileStrike': return 1.0;
			case 'pulseShockwave': return 0.9;
			default: return 0.75;
		}

	}

	_refreshCounts() {

		this.activeEffectCount = this._activeEffects.length;
		this.activeMeshCount = this._activeEffects.reduce( ( total, effect ) => total + effect.meshes.length, 0 );
		this.activeParticleCount = this._activeEffects.reduce( ( total, effect ) => total + effect.particles.length, 0 );

	}

}
