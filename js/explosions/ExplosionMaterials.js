import * as THREE from 'three';

export function createExplosionMaterials() {

	return {
		blastCore: new THREE.MeshBasicMaterial( {
			color: 0xffaa55,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		} ),
		blastRing: new THREE.MeshBasicMaterial( {
			color: 0xffffff,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide,
		} ),
		energyPulse: new THREE.MeshBasicMaterial( {
			color: 0x77bbff,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide,
		} ),
		particle: new THREE.SpriteMaterial( {
			color: 0xffffff,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		} ),
	};

}
