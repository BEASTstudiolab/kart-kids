import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { PLAYER_VEHICLES } from '../../VehicleRegistry.js';

const THUMB_SIZE = 224;
const THUMB_FRUSTUM = 1.55;
const THUMB_FIT_SIZE = 2.35;
const THUMB_ROTATION_Y = THREE.MathUtils.degToRad( 35 );
const THUMB_TILT_X = THREE.MathUtils.degToRad( 12 );

const THUMB_FALLBACK_STATE = Object.freeze( {
	src: '',
	state: 'fallback',
} );

function canRender() {

	return typeof window !== 'undefined' && typeof document !== 'undefined';

}

function computeVisibleBoundingBox( root ) {

	const box = new THREE.Box3();
	const temp = new THREE.Box3();

	function walk( node ) {

		if ( ! node || node.visible === false ) return;

		if ( ( node.isMesh || node.isSkinnedMesh ) && node.geometry ) {

			if ( ! node.geometry.boundingBox ) node.geometry.computeBoundingBox();
			if ( node.geometry.boundingBox ) {

				temp.copy( node.geometry.boundingBox ).applyMatrix4( node.matrixWorld );
				if ( ! temp.isEmpty() ) box.union( temp );

			}

		}

		for ( const child of node.children ) walk( child );

	}

	walk( root );
	return box;

}

export class KartThumbnailRenderer {

	constructor( options = {} ) {

		this._loaderFactory = typeof options.loaderFactory === 'function'
			? options.loaderFactory
			: () => new GLTFLoader();

		this._thumbnailEntries = new Map();
		this._thumbnailPromises = new Map();
		this._renderQueue = Promise.resolve();
		this._scene = null;
		this._camera = null;
		this._renderer = null;

	}

	async getThumbnail( vehicleId ) {

		if ( ! vehicleId ) return THUMB_FALLBACK_STATE;
		if ( this._thumbnailEntries.has( vehicleId ) ) {

			return this._thumbnailEntries.get( vehicleId );

		}
		if ( this._thumbnailPromises.has( vehicleId ) ) {

			return this._thumbnailPromises.get( vehicleId );

		}

		const vehicle = PLAYER_VEHICLES.find( ( v ) => v.id === vehicleId );
		if ( ! vehicle ) return THUMB_FALLBACK_STATE;

		const promise = this._enqueueRender( () => this._renderInternal( vehicle ) )
			.catch( () => ( { src: '', state: 'error' } ) )
			.then( ( entry ) => {

				this._thumbnailEntries.set( vehicleId, entry );
				this._thumbnailPromises.delete( vehicleId );
				return entry;

			} );

		this._thumbnailPromises.set( vehicleId, promise );
		return promise;

	}

	async getThumbnailMap( vehicleIds = PLAYER_VEHICLES.map( ( v ) => v.id ) ) {

		const map = new Map();
		for ( const id of vehicleIds ) map.set( id, await this.getThumbnail( id ) );
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

	async _renderInternal( vehicle ) {

		if ( ! canRender() ) return THUMB_FALLBACK_STATE;

		const scene = await this._loadVehicle( vehicle );
		if ( ! scene ) return { src: '', state: 'error' };

		this._ensureRenderSurface();
		this._frameVehicle( scene );
		this._scene.add( scene );
		this._renderer.render( this._scene, this._camera );
		const src = this._renderer.domElement.toDataURL( 'image/png' );
		this._scene.remove( scene );
		this._disposeVehicle( scene );

		return { src, state: src ? 'ready' : 'fallback' };

	}

	_loadVehicle( vehicle ) {

		const loader = this._loaderFactory();
		const modelPath = `models/${ vehicle.path }`;

		return new Promise( ( resolve ) => {

			loader.load( modelPath, ( gltf ) => resolve( gltf?.scene || null ), undefined, () => resolve( null ) );

		} );

	}

	_disposeVehicle( scene ) {

		scene.traverse( ( child ) => {

			if ( ! child.isMesh ) return;
			child.geometry?.dispose();
			const mats = Array.isArray( child.material ) ? child.material : [ child.material ];
			for ( const m of mats ) m?.dispose?.();

		} );

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
			20
		);
		this._camera.position.set( 2.2, 1.8, 3.0 );
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

		this._scene.add( new THREE.AmbientLight( 0xffffff, 1.15 ) );

		const keyLight = new THREE.DirectionalLight( 0xffffff, 1.7 );
		keyLight.position.set( 1.6, 2.2, 1.8 );
		this._scene.add( keyLight );

		const rimLight = new THREE.DirectionalLight( 0x7dd9ff, 0.75 );
		rimLight.position.set( - 1.8, 1.4, - 1.2 );
		this._scene.add( rimLight );

	}

	_frameVehicle( scene ) {

		scene.position.set( 0, 0, 0 );
		scene.rotation.set( THUMB_TILT_X * 0.15, THUMB_ROTATION_Y, 0 );
		scene.scale.setScalar( 1 );
		scene.updateMatrixWorld( true );

		const box = computeVisibleBoundingBox( scene );
		if ( box.isEmpty() ) box.setFromObject( scene );

		const center = box.getCenter( new THREE.Vector3() );
		const size = box.getSize( new THREE.Vector3() );
		const maxDim = Math.max( size.x, size.y, size.z, 0.001 );
		const scaleFactor = THUMB_FIT_SIZE / maxDim;

		scene.position.sub( center.multiplyScalar( scaleFactor ) );
		scene.scale.setScalar( scaleFactor );
		scene.updateMatrixWorld( true );

	}

}

const sharedKartThumbnailRenderer = new KartThumbnailRenderer();

export async function loadKartThumbnailCatalog( vehicleIds ) {

	return sharedKartThumbnailRenderer.getThumbnailMap( vehicleIds );

}

export async function getKartThumbnail( vehicleId ) {

	return sharedKartThumbnailRenderer.getThumbnail( vehicleId );

}
