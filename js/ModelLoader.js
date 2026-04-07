import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTrackModelConfig } from './TrackModelConfig.js';
import { applyTrackAsphaltMode } from './TrackAsphaltMode.js';

THREE.Cache.enabled = true;

// Vehicle color tints — load only the yellow base, derive others via clone+tint
const VEHICLE_BASE = 'vehicle-truck-yellow';
const VEHICLE_TINTS = {
	'vehicle-truck-yellow': null, // base model, no tint
	'vehicle-truck-green': new THREE.Color( 0.45, 1.0, 0.45 ),
	'vehicle-truck-purple': new THREE.Color( 0.75, 0.45, 1.0 ),
	'vehicle-truck-red': new THREE.Color( 1.0, 0.4, 0.4 ),
};

// Always-loaded models (vehicles, characters, decorations)
const ALWAYS_LOAD = [
	VEHICLE_BASE,
	'character-default',
	'decoration-empty-night', 'decoration-buildings-1', 'decoration-buildings-2',
];

// All known track tile model names (loaded on demand based on track cells)
export const MODEL_NAMES = [
	...ALWAYS_LOAD,
	'trk-straight', 'trk-corner-1x1', 'trk-finish',
	'trk-curve-2x2-l',
	'trk-curve-3x3-l',
	'trk-curve-3x3-wide-l',
	'trk-elev-2p5', 'trk-elev-5',
	'trk-ramp-up-2p5', 'trk-ramp-up-5',
	'trk-ramp-up-2p5-smooth', 'trk-ramp-up-5-smooth',
	'trk-ramp-down-2p5', 'trk-ramp-down-5',
	'trk-ramp-down-2p5-smooth', 'trk-ramp-down-5-smooth',
	'trk-junction-y', 'trk-junction-t', 'trk-junction-4way',
	'trk-bridge-entry', 'trk-bridge-mid',
	'trk-tunnel-entry', 'trk-tunnel-mid', 'trk-tunnel-exit', 'trk-tunnel-open',
	'trk-jump-short', 'trk-jump-long',
	'trk-chicane-3x3-l',
];


export async function loadModels( trackTileSet, asphaltMode, cells, onProgress ) {

	const models = {};
	const loader = new GLTFLoader();

	// Determine which tile keys the track actually uses
	const neededTiles = new Set();
	if ( cells ) {

		for ( const cell of cells ) {

			neededTiles.add( cell[ 2 ] );

		}

	}

	// Build the load list: always-load + tiles the track needs
	const toLoad = [ ...ALWAYS_LOAD ];
	for ( const name of MODEL_NAMES ) {

		if ( ALWAYS_LOAD.includes( name ) ) continue;
		if ( ! cells || neededTiles.has( name ) ) toLoad.push( name );

	}

	let loadedCount = 0;
	const totalCount = toLoad.length;

	const promises = toLoad.map( ( name ) =>
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

				loadedCount ++;
				if ( onProgress ) onProgress( loadedCount, totalCount, name );
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

	// Derive vehicle color variants from the base model
	const baseVehicle = models[ VEHICLE_BASE ];
	if ( baseVehicle ) {

		for ( const [ name, tint ] of Object.entries( VEHICLE_TINTS ) ) {

			if ( ! tint ) continue; // skip the base model itself
			const clone = baseVehicle.clone();

			// Find the 'body' node (may be a Group with child meshes for multi-material)
			let bodyNode = null;
			clone.traverse( ( child ) => {

				if ( child.name.toLowerCase() === 'body' ) bodyNode = child;

			} );

			if ( bodyNode ) {

				bodyNode.traverse( ( child ) => {

					if ( ! child.isMesh ) return;
					child.material = child.material.clone();
					child.material.color.copy( tint );

				} );

			}

			models[ name ] = clone;

		}

	}

	return models;

}
