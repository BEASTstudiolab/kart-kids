import * as THREE from 'three';


export const LIGHTING_DAY = {
	background: 0xadb2ba,
	hemiSky: 0xc8d8e8,
	hemiGround: 0x7a8a5a,
	hemiIntensity: 1.5,
	dirColor: 0xffffff,
	dirIntensity: 5,
	bloomStrength: 0.02,
	bloomRadius: 0.02,
	bloomThreshold: 0.5,
	exposure: 1.0,
};

export const LIGHTING_NIGHT = {
	background: 0x1a0a2e,
	hemiSky: 0x1a0a2e,
	hemiGround: 0x2a1a3a,
	hemiIntensity: 0.5,
	dirColor: 0xe8d0f8,
	dirIntensity: 3,
	bloomStrength: 0.03,
	bloomRadius: 0.05,
	bloomThreshold: 0.9,
	exposure: 1.0,
};

const _originalMaterials = new WeakMap();

// Populated once after scene is fully built; avoids per-call scene.traverse (H-6)
const _lightingMeshes = [];
const _barrierMaterials = new Set();

export function buildLightingCache( scene ) {

	_lightingMeshes.length = 0;
	_barrierMaterials.clear();
	scene.traverse( ( child ) => {

		if ( child.isMesh && child.material.isMeshStandardMaterial ) {

			// Snapshot original material values on first encounter
			if ( ! _originalMaterials.has( child.material ) ) {

				_originalMaterials.set( child.material, {
					metalness: child.material.metalness,
					roughness: child.material.roughness,
				} );

			}

			_lightingMeshes.push( child );

			// Tag barrier/curb materials for emissive control
			if ( child.material.name === 'rubber' ) {

				_barrierMaterials.add( child.material );

			}

		}

	} );

}

// ── Barrier emissive API ─────────────────────────────────────────────────────

let _barrierEmissiveColor = new THREE.Color( 0xff4400 );
let _barrierEmissiveIntensity = 0;

export function setBarrierEmissive( intensity, color ) {

	if ( intensity !== undefined ) _barrierEmissiveIntensity = intensity;
	if ( color !== undefined ) _barrierEmissiveColor.setHex( color );

	for ( const mat of _barrierMaterials ) {

		mat.emissive.copy( _barrierEmissiveColor );
		mat.emissiveIntensity = _barrierEmissiveIntensity;

	}

}

export function getBarrierEmissiveColor() { return _barrierEmissiveColor.getHex(); }
export function getBarrierEmissiveIntensity() { return _barrierEmissiveIntensity; }

export function applyLighting( preset, { scene, hemiLight, dirLight, bloomPass, renderer } ) {

	scene.background.setHex( preset.background );
	if ( scene.fog ) scene.fog.color.setHex( preset.background );
	hemiLight.color.setHex( preset.hemiSky );
	hemiLight.groundColor.setHex( preset.hemiGround );
	hemiLight.intensity = preset.hemiIntensity;
	dirLight.color.setHex( preset.dirColor );
	dirLight.intensity = preset.dirIntensity;

	bloomPass.strength = preset.bloomStrength;
	bloomPass.radius = preset.bloomRadius;
	bloomPass.threshold = preset.bloomThreshold;
	renderer.toneMappingExposure = preset.exposure;

	const isNight = preset === LIGHTING_NIGHT;

	for ( const child of _lightingMeshes ) {

		if ( isNight ) {

			child.material.metalness = 0.3;
			child.material.roughness = 0.4;

		} else {

			const orig = _originalMaterials.get( child.material );
			child.material.metalness = orig.metalness;
			child.material.roughness = orig.roughness;

		}

	}

}
