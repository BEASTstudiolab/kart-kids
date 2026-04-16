import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
	BALACLAVA_OPTIONS,
	CHARACTER_ACCESSORY_DEFS,
	CHARACTER_MODEL_PATH,
	normalizeCharacterMeshName,
	normalizeSelectedBalaclavaId,
} from '../../CharacterCustomization.js';
import { applyCharacterMaterialTuningToMaterial } from '../../PlayerAppearance.js';

const THUMB_SIZE = 224;
const THUMB_FRUSTUM = 0.88;
const THUMB_ROTATION_Y = THREE.MathUtils.degToRad( 10 );
const THUMB_VERTICAL_OFFSET = 0.03;
const THUMB_FIT_SIZE = 2.62;
const THUMB_FALLBACK_STATE = Object.freeze( {
	src: '',
	state: 'fallback',
} );
const CHARACTER_ITEM_THUMBNAIL_REQUESTS = Object.freeze( [
	...BALACLAVA_OPTIONS.map( ( option ) => Object.freeze( {
		cacheKey: option.id,
		meshNames: Object.freeze( [ option.meshName ] ),
	} ) ),
	...CHARACTER_ACCESSORY_DEFS.map( ( accessory ) => Object.freeze( {
		cacheKey: accessory.key,
		meshNames: accessory.meshes,
	} ) ),
] );
const CHARACTER_ITEM_THUMBNAIL_REQUEST_BY_ID = new Map(
	CHARACTER_ITEM_THUMBNAIL_REQUESTS.map( ( request ) => [ request.cacheKey, request ] )
);

function canRenderCharacterItemThumbnails() {

	return typeof window !== 'undefined' && typeof document !== 'undefined';

}

function normalizeThumbnailEntry( entry ) {

	if ( typeof entry === 'string' ) {

		return {
			src: entry,
			state: entry ? 'ready' : 'fallback',
		};

	}

	if ( entry && typeof entry === 'object' ) {

		const src = typeof entry.src === 'string' ? entry.src : '';
		return {
			src,
			state: typeof entry.state === 'string' ? entry.state : ( src ? 'ready' : 'fallback' ),
		};

	}

	return {
		...THUMB_FALLBACK_STATE,
	};

}

function normalizeThumbnailRequest( request ) {

	if ( typeof request === 'string' ) {

		const trimmed = request.trim();
		if ( ! trimmed ) return null;
		const normalizedId = trimmed.toLowerCase().startsWith( 'balaclava-' )
			? normalizeSelectedBalaclavaId( trimmed )
			: trimmed;
		return CHARACTER_ITEM_THUMBNAIL_REQUEST_BY_ID.get( normalizedId ) || null;

	}

	if ( ! request || typeof request !== 'object' ) return null;

	const rawCacheKey = typeof request.cacheKey === 'string'
		? request.cacheKey.trim()
		: typeof request.id === 'string'
			? request.id.trim()
			: '';
	if ( ! rawCacheKey ) return null;

	const normalizedCacheKey = rawCacheKey.startsWith( 'balaclava-' )
		|| rawCacheKey.toLowerCase().startsWith( 'balaclava-' )
		? normalizeSelectedBalaclavaId( rawCacheKey )
		: rawCacheKey;
	const meshNames = Array.isArray( request.meshNames )
		? request.meshNames.map( normalizeCharacterMeshName ).filter( Boolean )
		: [];
	if ( meshNames.length === 0 ) return null;

	return {
		cacheKey: normalizedCacheKey,
		meshNames,
	};

}

function loadCharacterScene( loaderFactory, modelPath ) {

	return new Promise( ( resolve, reject ) => {

		const loader = loaderFactory();
		loader.load( modelPath, ( gltf ) => {

			resolve( gltf?.scene || null );

		}, undefined, reject );

	} );

}

export class BalaclavaThumbnailRenderer {

	constructor( options = {} ) {

		this._loaderFactory = typeof options.loaderFactory === 'function'
			? options.loaderFactory
			: () => new GLTFLoader();
		this._modelPath = typeof options.modelPath === 'string' && options.modelPath
			? options.modelPath
			: `models/${ CHARACTER_MODEL_PATH }`;
		this._renderThumbnailOverride = typeof options.renderThumbnailForId === 'function'
			? options.renderThumbnailForId
			: null;

		this._thumbnailEntries = new Map();
		this._thumbnailPromises = new Map();
		this._renderQueue = Promise.resolve();
		this._characterTemplatePromise = null;
		this._scene = null;
		this._camera = null;
		this._renderer = null;

	}

	async getThumbnail( balaclavaId ) {

		const request = normalizeThumbnailRequest( balaclavaId );
		if ( ! request ) return THUMB_FALLBACK_STATE;
		if ( this._thumbnailEntries.has( request.cacheKey ) ) {

			return this._thumbnailEntries.get( request.cacheKey );

		}

		if ( this._thumbnailPromises.has( request.cacheKey ) ) {

			return this._thumbnailPromises.get( request.cacheKey );

		}

		const promise = Promise.resolve()
			.then( () => this._renderThumbnailOverride
				? this._renderThumbnailOverride( request.cacheKey )
				: this._enqueueRender( () => this._renderThumbnailInternal( request ) ) )
			.then( ( entry ) => normalizeThumbnailEntry( entry ) )
			.catch( () => ( { src: '', state: 'error' } ) )
			.then( ( entry ) => {

				this._thumbnailEntries.set( request.cacheKey, entry );
				this._thumbnailPromises.delete( request.cacheKey );
				return entry;

			} );

		this._thumbnailPromises.set( request.cacheKey, promise );
		return promise;

	}

	async getThumbnailMap( requests = CHARACTER_ITEM_THUMBNAIL_REQUESTS ) {

		const map = new Map();
		for ( const request of requests ) {

			const normalizedRequest = normalizeThumbnailRequest( request );
			if ( ! normalizedRequest ) continue;
			map.set( normalizedRequest.cacheKey, await this.getThumbnail( normalizedRequest ) );

		}
		return map;

	}

	dispose() {

		this._renderer?.dispose?.();
		this._renderer = null;
		this._camera = null;
		this._scene = null;

	}

	_enqueueRender( task ) {

		const run = this._renderQueue.then( task, task );
		this._renderQueue = run.catch( () => {} );
		return run;

	}

	async _renderThumbnailInternal( request ) {

		if ( ! canRenderCharacterItemThumbnails() ) {

			return THUMB_FALLBACK_STATE;

		}

		const characterTemplate = await this._getCharacterTemplate();
		if ( ! characterTemplate ) {

			return { src: '', state: 'error' };

		}

		this._ensureRenderSurface();
		this._prepareCloneForThumbnail( characterTemplate, request );
		this._scene.add( characterTemplate );
		this._renderer.render( this._scene, this._camera );
		const src = this._renderer.domElement.toDataURL( 'image/png' );
		this._scene.remove( characterTemplate );

		return {
			src,
			state: src ? 'ready' : 'fallback',
		};

	}

	async _getCharacterTemplate() {

		if ( this._characterTemplatePromise ) {

			return this._characterTemplatePromise;

		}

		this._characterTemplatePromise = loadCharacterScene( this._loaderFactory, this._modelPath )
			.catch( ( error ) => {

				console.warn( '[BalaclavaThumbnailRenderer] Failed to load character model for thumbnails.', error );
				return null;

			} );

		return this._characterTemplatePromise;

	}

	_ensureRenderSurface() {

		if ( this._scene && this._camera && this._renderer ) return;

		this._scene = new THREE.Scene();
		this._camera = new THREE.OrthographicCamera(
			- THUMB_FRUSTUM,
			THUMB_FRUSTUM,
			THUMB_FRUSTUM,
			- THUMB_FRUSTUM,
			0.1,
			10
		);
		this._camera.position.set( 0.0, 0.02, 3.2 );
		this._camera.lookAt( 0, 0, 0 );

		this._renderer = new THREE.WebGLRenderer( {
			alpha: true,
			antialias: true,
			preserveDrawingBuffer: true,
		} );
		this._renderer.setPixelRatio( 1 );
		this._renderer.setSize( THUMB_SIZE, THUMB_SIZE );
		this._renderer.setClearColor( 0x000000, 0 );
		if ( 'outputColorSpace' in this._renderer ) {

			this._renderer.outputColorSpace = THREE.SRGBColorSpace;

		}

		this._scene.add( new THREE.AmbientLight( 0xffffff, 1.25 ) );

		const keyLight = new THREE.DirectionalLight( 0xffffff, 1.8 );
		keyLight.position.set( 1.2, 1.4, 2.4 );
		this._scene.add( keyLight );

		const rimLight = new THREE.DirectionalLight( 0x7dd9ff, 0.9 );
		rimLight.position.set( - 1.4, 1.0, 1.2 );
		this._scene.add( rimLight );

	}

	_prepareCloneForThumbnail( characterRoot, request ) {

		const visibleMeshNames = new Set( ( request?.meshNames || [] ).map( normalizeCharacterMeshName ) );
		const baseState = this._ensureBaseThumbnailState( characterRoot );

		characterRoot.position.copy( baseState.position );
		characterRoot.rotation.copy( baseState.rotation );
		characterRoot.scale.copy( baseState.scale );

		characterRoot.traverse( ( child ) => {

			if ( ! child || ( ! child.isMesh && ! child.isSkinnedMesh ) ) return;
			if ( child.userData._kkBalaclavaThumbOriginalMaterial ) {

				child.material = child.userData._kkBalaclavaThumbOriginalMaterial;

			}
			child.visible = child.userData._kkBalaclavaThumbOriginalVisible !== false;

			const normalizedMeshName = normalizeCharacterMeshName( child.name );
			child.visible = visibleMeshNames.has( normalizedMeshName );
			child.castShadow = false;
			child.receiveShadow = false;

			const nextMaterials = ( Array.isArray( child.material ) ? child.material : [ child.material ] ).map( ( material ) => {

				if ( ! material ) return material;
				if ( ! material.clone ) {

					material.side = THREE.FrontSide;
					applyCharacterMaterialTuningToMaterial( material );
					return material;

				}

				const clonedMaterial = material.clone();
				clonedMaterial.side = THREE.FrontSide;
				applyCharacterMaterialTuningToMaterial( clonedMaterial );
				return clonedMaterial;

			} );

			child.material = Array.isArray( child.material ) ? nextMaterials : nextMaterials[ 0 ];

		} );

		const box = new THREE.Box3().setFromObject( characterRoot );
		const center = box.getCenter( new THREE.Vector3() );
		const size = box.getSize( new THREE.Vector3() );
		const maxDim = Math.max( size.x, size.y, size.z, 0.001 );
		const scale = THUMB_FIT_SIZE / maxDim;

		characterRoot.position.sub( center );
		characterRoot.position.y += THUMB_VERTICAL_OFFSET;
		characterRoot.rotation.y = THUMB_ROTATION_Y;
		characterRoot.scale.setScalar( scale );
		characterRoot.updateMatrixWorld( true );

	}

	_ensureBaseThumbnailState( characterRoot ) {

		if ( characterRoot.userData._kkBalaclavaThumbBaseState ) {

			return characterRoot.userData._kkBalaclavaThumbBaseState;

		}

		characterRoot.userData._kkBalaclavaThumbBaseState = {
			position: characterRoot.position.clone(),
			rotation: characterRoot.rotation.clone(),
			scale: characterRoot.scale.clone(),
		};

		characterRoot.traverse( ( child ) => {

			if ( ! child || ( ! child.isMesh && ! child.isSkinnedMesh ) ) return;
			child.userData._kkBalaclavaThumbOriginalMaterial = child.material;
			child.userData._kkBalaclavaThumbOriginalVisible = child.visible;

		} );

		return characterRoot.userData._kkBalaclavaThumbBaseState;

	}

}

const sharedBalaclavaThumbnailRenderer = new BalaclavaThumbnailRenderer();

export async function loadBalaclavaThumbnailCatalog( balaclavaIds ) {

	return sharedBalaclavaThumbnailRenderer.getThumbnailMap( balaclavaIds );

}

export async function loadCharacterItemThumbnailCatalog( requests ) {

	return sharedBalaclavaThumbnailRenderer.getThumbnailMap( requests );

}
