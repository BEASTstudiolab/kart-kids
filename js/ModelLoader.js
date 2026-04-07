import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTrackModelConfig } from './TrackModelConfig.js';
import { applyTrackAsphaltMode } from './TrackAsphaltMode.js';


export const MODEL_NAMES = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'character-default',
	'trk-straight', 'trk-corner-1x1', 'trk-finish',
	'trk-curve-2x2-l',
	'trk-curve-3x3-l',
	'trk-curve-3x3-wide-l',
	'trk-elev-2p5', 'trk-elev-5',
	'trk-ramp-up-2p5', 'trk-ramp-up-5',
	'trk-ramp-up-2p5-smooth', 'trk-ramp-up-5-smooth',
	'trk-ramp-down-2p5', 'trk-ramp-down-5',
	'trk-ramp-down-2p5-smooth', 'trk-ramp-down-5-smooth',
	'decoration-empty-night', 'decoration-buildings-1', 'decoration-buildings-2',
];


export async function loadModels( trackTileSet, asphaltMode ) {

	const models = {};
	const loader = new GLTFLoader();

	const promises = MODEL_NAMES.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			const modelConfig = getTrackModelConfig( name, trackTileSet );
			loader.load( `models/${ modelConfig.path }`, ( gltf ) => {

				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;
						child.material.depthWrite = true;
						applyTrackAsphaltMode( child.material, { asphaltMode } );

					}

				} );

				// Vehicle models use root_scale=0.5
				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				if ( modelConfig.rotationY !== 0 ) {

					const wrapper = new THREE.Group();
					gltf.scene.rotation.y = modelConfig.rotationY;
					wrapper.add( gltf.scene );
					models[ name ] = wrapper;

				} else {

					models[ name ] = gltf.scene;

				}
				resolve();

			}, undefined, ( err ) => {

				// Character models are optional — resolve gracefully if not yet exported from Blender
				if ( name.startsWith( 'character-' ) ) {

					console.warn( '[model] Optional character model not found:', name );
					resolve();

				} else {

					console.error( '[model] FAILED:', name, err );
					reject( err );

				}

			} );

		} )
	);

	await Promise.all( promises );
	return models;

}
