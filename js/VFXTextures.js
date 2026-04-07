import * as THREE from 'three';

const _loader = new THREE.TextureLoader();

let _smokeTexture = null;

export function getSmokeTexture() {

	if ( ! _smokeTexture ) {

		_smokeTexture = _loader.load( 'sprites/smoke.png' );

	}

	return _smokeTexture;

}
