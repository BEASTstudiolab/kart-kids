import * as THREE from 'three';


export const LIGHTING_DAY = {
	background: 0xadb2ba,
	skybox: 'sunshine',
	skyboxIntensity: 1.0,
	skyboxBlurriness: 0.0,
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
	skybox: 'moon',
	skyboxIntensity: 0.8,
	skyboxBlurriness: 0.0,
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

// ── Skybox ──────────────────────────────────────────────────────────────────

const _skyboxCache = {};
const _fallbackColor = new THREE.Color();

function _getSkyboxTexture( name ) {

	if ( ! _skyboxCache[ name ] ) {

		_skyboxCache[ name ] = new THREE.CubeTextureLoader()
			.setPath( 'skybox/' )
			.load( [
				`jettelly_${ name }_RIGHT.png`,
				`jettelly_${ name }_LEFT.png`,
				`jettelly_${ name }_UP.png`,
				`jettelly_${ name }_DOWN.png`,
				`jettelly_${ name }_FRONT.png`,
				`jettelly_${ name }_BACK.png`,
			] );

	}

	return _skyboxCache[ name ];

}

export function applyLighting( preset, { scene, hemiLight, dirLight, bloomPass, renderer } ) {

	if ( preset.skybox ) {

		scene.background = _getSkyboxTexture( preset.skybox );

	} else {

		if ( ! scene.background || ! scene.background.isColor ) {

			scene.background = new THREE.Color();

		}

		scene.background.setHex( preset.background );

	}

	scene.backgroundIntensity = preset.skyboxIntensity ?? 1.0;
	scene.backgroundBlurriness = preset.skyboxBlurriness ?? 0.0;

	const fogColor = _fallbackColor.setHex( preset.background );
	if ( scene.fog ) scene.fog.color.copy( fogColor );
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
