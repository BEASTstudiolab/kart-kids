import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTrackModelConfig } from './TrackModelConfig.js';
import { applyTrackAsphaltMode } from './TrackAsphaltMode.js';
import { applyTrackThemeToObject3D } from './TrackThemeApplier.js';
import { DEFAULT_TRACK_THEME_ID, normalizeTrackThemeId } from './TrackThemeRegistry.js';
import {
	applyTrackAppearanceToObject3D,
	getAppearanceTargetForModel,
	tagObject3DAppearanceTarget,
} from './TrackAppearanceApplier.js';
import { PLAYER_VEHICLES, PLAYER_CHARACTER_ID } from './VehicleRegistry.js';
import { BOOST_MARKER_MODEL_ID, TERRAIN_TILE_ID } from './track-editor/constants/EditorAssetIds.js';

THREE.Cache.enabled = true;


const ANIMATION_FILES = [
	'Kart_Beast_Driving',
	'Kart_Beast_Turn_Left',
	'Kart_Beast_Turn_Right',
	'Kart_Beast_Turn_Left_To_Idle',
	'Kart_Beast_Turn_Right_To_Idle',
	'Kart_Beast_Impact_React',
];

export const ANIMATION_CLIPS = {};

// Always-loaded models (vehicles, characters, decorations)
const ALWAYS_LOAD = [
	...PLAYER_VEHICLES.map( ( v ) => v.id ),
	PLAYER_CHARACTER_ID,
	'decoration-empty-night', 'decoration-buildings-1', 'decoration-buildings-2',
];

const MODEL_FALLBACKS = {
	'trk-jump-medium': 'trk-jump-long',
};

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
	'trk-jump-short', 'trk-jump-medium', 'trk-jump-long',
	'trk-chicane-3x3-l',
	TERRAIN_TILE_ID,
	BOOST_MARKER_MODEL_ID,
];


export async function loadModels( trackTileSet, asphaltMode, cells, onProgress, options = {} ) {

	const models = {};
	const loader = new GLTFLoader();
	const themeId = normalizeTrackThemeId( options.themeId || DEFAULT_TRACK_THEME_ID );

	// Determine which tile keys the track actually uses
	const neededTiles = new Set();
	if ( cells ) {

		for ( const cell of cells ) {

			neededTiles.add( cell[ 2 ] );

		}

	}

	for ( const extraName of ( options.extraModelNames || [] ) ) {

		if ( typeof extraName === 'string' && extraName ) neededTiles.add( extraName );

	}

	// Build the load list: always-load + tiles the track needs
	const toLoad = [ ...ALWAYS_LOAD ];
	for ( const name of MODEL_NAMES ) {

		if ( ALWAYS_LOAD.includes( name ) ) continue;
		if ( ! cells || neededTiles.has( name ) ) toLoad.push( name );

	}

	let loadedCount = 0;
	const totalCount = toLoad.length;

	const loadSceneForModel = ( requestedName, sourceName, resolve, reject, fallbackName = null ) => {

		const modelConfig = getTrackModelConfig( sourceName, trackTileSet );
		loader.load( `models/${ modelConfig.path }`, ( gltf ) => {

			gltf.scene.traverse( ( child ) => {

				if ( child.isMesh ) {

					child.material.side = THREE.FrontSide;
					child.material.depthWrite = true;
					applyTrackAsphaltMode( child.material, { asphaltMode } );

				}

			} );

			applyTrackThemeToObject3D( gltf.scene, themeId ).then( () => {

				const appearanceTarget = getAppearanceTargetForModel( requestedName );
				tagObject3DAppearanceTarget( gltf.scene, appearanceTarget );
				applyTrackAppearanceToObject3D( gltf.scene, options.appearance );

				// Vehicle models use root_scale=0.5
				if ( requestedName.startsWith( 'vehicle-' ) || requestedName.startsWith( 'kart-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				// Ensure kart models have a seat_anchor node
				if ( requestedName.startsWith( 'kart-' ) && requestedName !== PLAYER_CHARACTER_ID ) {

					let hasSeatAnchor = false;
					gltf.scene.traverse( ( c ) => {

						if ( c.name.toLowerCase() === 'seat_anchor' ) hasSeatAnchor = true;

					} );

					if ( ! hasSeatAnchor ) {

						const anchor = new THREE.Object3D();
						anchor.name = 'seat_anchor';
						anchor.position.set( 0, 0.5, - 0.37 );
						// Add to the first child (the root kart node)
						const root = gltf.scene.children[ 0 ] || gltf.scene;
						root.add( anchor );
						console.warn( '[model] Created virtual seat_anchor for:', requestedName );

					}

				}

				if ( modelConfig.rotationY !== 0 ) {

					const wrapper = new THREE.Group();
					gltf.scene.rotation.y = modelConfig.rotationY;
					tagObject3DAppearanceTarget( wrapper, appearanceTarget );
					wrapper.add( gltf.scene );
					models[ requestedName ] = wrapper;

				} else {

					models[ requestedName ] = gltf.scene;

				}

				loadedCount ++;
				if ( onProgress ) onProgress( loadedCount, totalCount, requestedName );
				resolve();

			} ).catch( reject );

		}, undefined, ( err ) => {

			if ( fallbackName ) {

				console.warn( '[model] Falling back:', requestedName, '->', fallbackName, err );
				loadSceneForModel( requestedName, fallbackName, resolve, reject, null );
				return;

			}

			// Character models are optional — resolve gracefully if not yet exported from Blender
			if ( requestedName.startsWith( 'character-' ) ) {

				console.warn( '[model] Optional character model not found:', requestedName );
				loadedCount ++;
				if ( onProgress ) onProgress( loadedCount, totalCount, requestedName );
				resolve();

			} else {

				console.error( '[model] FAILED:', requestedName, err );
				reject( err );

			}

		} );

	};

	const promises = toLoad.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			loadSceneForModel( name, name, resolve, reject, MODEL_FALLBACKS[ name ] ?? null );

		} )
	);

	await Promise.all( promises );

	// Load character animation clips
	const animPromises = ANIMATION_FILES.map( ( clipName ) =>
		new Promise( ( resolve ) => {

			loader.load( `models/animations/${ clipName }.glb`, ( gltf ) => {

				if ( gltf.animations && gltf.animations.length > 0 ) {

					ANIMATION_CLIPS[ clipName ] = gltf.animations[ 0 ];
					gltf.animations[ 0 ].name = clipName;

				}

				resolve();

			}, undefined, ( err ) => {

				console.warn( '[model] Animation clip not found:', clipName, err );
				resolve();

			} );

		} )
	);
	await Promise.all( animPromises );

	return models;

}
