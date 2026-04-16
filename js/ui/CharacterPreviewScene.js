import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_GARAGE_IDLE_ANIMATION_PATH, CHARACTER_MODEL_PATH } from '../CharacterCustomization.js';
import { applyPlayerAppearanceToNodes, normalizePlayerAppearance } from '../PlayerAppearance.js';
import {
	CHARACTER_PREVIEW_CAMERA_DEFAULTS,
	computeCharacterPreviewFrame,
} from './utils/characterPreviewFrame.js';
import { MenuCharacterBlinkController } from './MenuCharacterBlinkController.js';
import {
	applyMenuCharacterMaterialDebugTuning,
	getMenuCharacterMaterialDebugVersion,
} from './MenuCharacterMaterialDebug.js';

const _boundsCenter = new THREE.Vector3();
const _boundsBox = new THREE.Box3();
const _normalizedBoundsBox = new THREE.Box3();
const _cameraOffset = new THREE.Vector3();
const CAMERA_DEBUG_KEYS = Object.freeze( [
	'lookTargetX',
	'lookTargetY',
	'cameraOffsetX',
	'cameraOffsetY',
	'cameraOffsetZ',
] );

function createDefaultDebugCameraOffsets() {

	return {
		...CHARACTER_PREVIEW_CAMERA_DEFAULTS,
	};

}

export class CharacterPreviewScene {

	constructor( container, { onReady = null } = {} ) {

		this._container = container;
		this._onReady = typeof onReady === 'function' ? onReady : null;
		this._appearance = normalizePlayerAppearance();
		this._scene = new THREE.Scene();
		this._camera = new THREE.PerspectiveCamera( 26, 1, 0.1, 100 );
		this._camera.position.set( 0, 1.8, 4.4 );
		this._loader = new GLTFLoader();
		this._renderer = new THREE.WebGLRenderer( {
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance',
		} );
		this._renderer.setPixelRatio( Math.min( window.devicePixelRatio || 1, 2 ) );
		this._renderer.outputColorSpace = THREE.SRGBColorSpace;
		this._renderer.domElement.style.width = '100%';
		this._renderer.domElement.style.height = '100%';
		this._renderer.domElement.style.display = 'block';
		this._renderer.domElement.style.touchAction = 'none';
		this._renderer.domElement.style.cursor = 'grab';

		this._turntable = new THREE.Group();
		this._scene.add( this._turntable );

		this._characterRoot = null;
		this._blinkController = new MenuCharacterBlinkController();
		this._characterMaterialDebugVersion = - 1;
		this._idleClip = null;
		this._mixer = null;
		this._idleAction = null;
		this._rafId = null;
		this._lastFrameTime = 0;
		this._disposed = false;
		this._resizeObserver = null;
		this._handleResize = () => this._resize();
		this._frameLookTarget = new THREE.Vector3();
		this._lookTarget = new THREE.Vector3();
		this._baseCameraOffset = new THREE.Vector3( 0, 0.14, 3.2 );
		this._normalizedBoundsSize = new THREE.Vector3( 1, 1.6, 0.8 );
		this._debugCameraOffsets = createDefaultDebugCameraOffsets();
		this._hasInitialFrame = false;
		this._zoomScale = 1;
		this._targetZoomScale = 1;
		this._minZoomScale = 0.68;
		this._maxZoomScale = 1.9;
		this._paused = false;
		this._orbitAngle = - 0.22;
		this._orbitVelocity = 0;
		this._activePointers = new Map();
		this._dragPointerId = null;
		this._dragLastX = 0;
		this._dragLastTime = 0;
		this._pinchStartDistance = 0;
		this._pinchStartZoom = 1;
		this._handleContextMenu = ( event ) => event.preventDefault();
		this._handlePointerDown = ( event ) => this._onPointerDown( event );
		this._handlePointerMove = ( event ) => this._onPointerMove( event );
		this._handlePointerUp = ( event ) => this._onPointerUp( event );
		this._handlePointerCancel = ( event ) => this._onPointerCancel( event );
		this._handleWheel = ( event ) => this._onWheel( event );

		const ambient = new THREE.AmbientLight( 0xffffff, 2.4 );
		this._scene.add( ambient );

		const keyLight = new THREE.DirectionalLight( 0xfff4e2, 2.6 );
		keyLight.position.set( 2.5, 4.2, 5.4 );
		this._scene.add( keyLight );

		const fillLight = new THREE.DirectionalLight( 0x7acbff, 1.2 );
		fillLight.position.set( - 4.4, 2.8, 2.4 );
		this._scene.add( fillLight );

		const rimLight = new THREE.DirectionalLight( 0xff7a3d, 1.3 );
		rimLight.position.set( - 1.8, 3.4, - 3.8 );
		this._scene.add( rimLight );

		if ( this._container ) {

			this._container.innerHTML = '';
			this._container.appendChild( this._renderer.domElement );

		}

		this._setupResizeHandling();
		this._setupInteractionHandling();
		this._loadCharacter();
		this._loadIdleAnimation();
		this._resize();
		this._startLoop();

	}

	setAppearance( appearance ) {

		this._appearance = normalizePlayerAppearance( appearance );

		if ( this._characterRoot ) {

			applyPlayerAppearanceToNodes( { characterRoot: this._characterRoot }, this._appearance );
			applyMenuCharacterMaterialDebugTuning( this._characterRoot );
			this._characterMaterialDebugVersion = getMenuCharacterMaterialDebugVersion();
			this._refreshCharacterFrame();

		}

	}

	setPaused( paused ) {

		const nextPaused = !! paused;
		if ( this._paused === nextPaused || this._disposed ) return;

		this._paused = nextPaused;

		if ( this._paused ) {

			if ( this._rafId !== null ) {

				cancelAnimationFrame( this._rafId );
				this._rafId = null;

			}

			return;

		}

		this._lastFrameTime = 0;
		this._resize();
		this._startLoop();

	}

	setDebugCameraOffsets( debugCameraOffsets = {} ) {

		for ( const key of CAMERA_DEBUG_KEYS ) {

			const value = Number( debugCameraOffsets?.[ key ] );
			this._debugCameraOffsets[ key ] = Number.isFinite( value ) ? value : 0;

		}

		this._updateCameraPose();

	}

	getDebugCameraOffsets() {

		return { ...this._debugCameraOffsets };

	}

	dispose() {

		if ( this._disposed ) return;
		this._disposed = true;

		if ( this._rafId !== null ) {

			cancelAnimationFrame( this._rafId );
			this._rafId = null;

		}

		if ( this._resizeObserver ) {

			this._resizeObserver.disconnect();
			this._resizeObserver = null;

		} else {

			window.removeEventListener( 'resize', this._handleResize );

		}

		if ( this._renderer ) {

			this._renderer.domElement.removeEventListener( 'contextmenu', this._handleContextMenu );
			this._renderer.domElement.removeEventListener( 'pointerdown', this._handlePointerDown );
			this._renderer.domElement.removeEventListener( 'pointermove', this._handlePointerMove );
			this._renderer.domElement.removeEventListener( 'pointerup', this._handlePointerUp );
			this._renderer.domElement.removeEventListener( 'pointercancel', this._handlePointerCancel );
			this._renderer.domElement.removeEventListener( 'wheel', this._handleWheel );
			this._renderer.dispose();
			if ( this._renderer.domElement.parentNode ) {

				this._renderer.domElement.parentNode.removeChild( this._renderer.domElement );

			}

		}

		this._turntable.clear();
		this._blinkController.reset();
		if ( this._mixer && this._characterRoot ) {

			this._mixer.stopAllAction();
			this._mixer.uncacheRoot( this._characterRoot );

		}
		this._mixer = null;
		this._idleAction = null;
		this._idleClip = null;
		this._characterRoot = null;
		this._hasInitialFrame = false;
		this._activePointers.clear();

	}

	_setupResizeHandling() {

		if ( typeof ResizeObserver === 'function' && this._container ) {

			this._resizeObserver = new ResizeObserver( () => this._resize() );
			this._resizeObserver.observe( this._container );
			return;

		}

		window.addEventListener( 'resize', this._handleResize );

	}

	_setupInteractionHandling() {

		const canvas = this._renderer?.domElement;
		if ( ! canvas ) return;

		canvas.addEventListener( 'contextmenu', this._handleContextMenu );
		canvas.addEventListener( 'pointerdown', this._handlePointerDown );
		canvas.addEventListener( 'pointermove', this._handlePointerMove );
		canvas.addEventListener( 'pointerup', this._handlePointerUp );
		canvas.addEventListener( 'pointercancel', this._handlePointerCancel );
		canvas.addEventListener( 'wheel', this._handleWheel, { passive: false } );

	}

	_loadCharacter() {

		this._loader.load( `models/${ CHARACTER_MODEL_PATH }`, ( gltf ) => {

			if ( this._disposed ) return;

			this._characterRoot = gltf.scene;
			this._turntable.add( this._characterRoot );
			this._bindIdleAnimation();
			this.setAppearance( this._appearance );
			this._blinkController.bind( this._characterRoot );

			if ( this._onReady ) this._onReady();

		}, undefined, ( error ) => {

			console.warn( '[CharacterPreviewScene] Failed to load preview character:', error );
			if ( this._onReady ) this._onReady();

		} );

	}

	_loadIdleAnimation() {

		this._loader.load( `models/${ CHARACTER_GARAGE_IDLE_ANIMATION_PATH }`, ( gltf ) => {

			if ( this._disposed ) return;

			this._idleClip = gltf?.animations?.[ 0 ] || null;
			this._bindIdleAnimation();

		}, undefined, ( error ) => {

			console.warn( '[CharacterPreviewScene] Failed to load idle animation:', error );

		} );

	}

	_bindIdleAnimation() {

		if ( ! this._characterRoot || ! this._idleClip ) return;

		if ( this._mixer ) {

			this._mixer.stopAllAction();
			this._mixer.uncacheRoot( this._characterRoot );

		}

		this._mixer = new THREE.AnimationMixer( this._characterRoot );
		this._idleAction = this._mixer.clipAction( this._idleClip );
		this._idleAction.reset();
		this._idleAction.play();
		this._mixer.update( 0 );
		this._refreshCharacterFrame();

	}

	_refreshCharacterFrame() {

		this._normalizeCharacterModel();
		this._fitCameraToCharacter();

	}

	_normalizeCharacterModel() {

		if ( ! this._characterRoot ) return;

		const savedTurntableRotation = this._turntable.rotation.y;
		this._turntable.rotation.y = 0;
		this._turntable.updateMatrixWorld( true );

		const bounds = _boundsBox.setFromObject( this._characterRoot );
		if ( bounds.isEmpty() ) {

			this._normalizedBoundsSize.set( 1, 1.6, 0.8 );
			this._turntable.rotation.y = savedTurntableRotation;
			this._turntable.updateMatrixWorld( true );
			return;

		}

		const center = bounds.getCenter( _boundsCenter );

		this._characterRoot.position.x -= center.x;
		this._characterRoot.position.z -= center.z;
		this._characterRoot.position.y -= bounds.min.y;

		this._turntable.updateMatrixWorld( true );
		_normalizedBoundsBox.setFromObject( this._characterRoot ).getSize( this._normalizedBoundsSize );

		this._turntable.rotation.y = savedTurntableRotation;
		this._turntable.updateMatrixWorld( true );

	}

	_fitCameraToCharacter() {

		if ( ! this._characterRoot ) return;

		const { lookTargetX, lookTargetY, cameraY, cameraZ } = computeCharacterPreviewFrame( {
			size: this._normalizedBoundsSize,
			aspect: this._camera.aspect,
			fovDegrees: this._camera.fov,
		} );

		this._frameLookTarget.set( lookTargetX, lookTargetY, 0 );
		this._baseCameraOffset.set( 0, cameraY - lookTargetY, cameraZ );
		this._orbitVelocity = 0;

		if ( ! this._hasInitialFrame ) {

			this._orbitAngle = - 0.22;
			this._zoomScale = 1;
			this._targetZoomScale = 1;
			this._hasInitialFrame = true;

		}

		this._turntable.rotation.y = this._orbitAngle;
		this._updateCameraPose();

	}

	_resize() {

		if ( ! this._container || ! this._renderer ) return;

		const width = Math.max( this._container.clientWidth || 0, 1 );
		const height = Math.max( this._container.clientHeight || 0, 1 );

		this._camera.aspect = width / height;
		this._camera.updateProjectionMatrix();
		this._renderer.setSize( width, height, false );
		this._fitCameraToCharacter();

	}

	_onPointerDown( event ) {

		if ( this._disposed ) return;
		if ( event.button !== undefined && event.button !== 0 ) return;

		this._renderer.domElement.setPointerCapture?.( event.pointerId );
		this._activePointers.set( event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		} );
		this._renderer.domElement.style.cursor = 'grabbing';
		this._orbitVelocity = 0;

		if ( this._activePointers.size >= 2 ) {

			this._dragPointerId = null;
			this._pinchStartDistance = this._measureActivePointerDistance();
			this._pinchStartZoom = this._targetZoomScale;

		} else {

			this._dragPointerId = event.pointerId;
			this._dragLastX = event.clientX;
			this._dragLastTime = performance.now();
			this._pinchStartDistance = 0;

		}

		event.preventDefault();

	}

	_onPointerMove( event ) {

		const pointer = this._activePointers.get( event.pointerId );
		if ( ! pointer ) return;

		pointer.x = event.clientX;
		pointer.y = event.clientY;

		if ( this._activePointers.size >= 2 ) {

			const distance = this._measureActivePointerDistance();
			if ( distance > 0 && this._pinchStartDistance > 0 ) {

				this._setTargetZoom( this._pinchStartZoom * ( this._pinchStartDistance / distance ) );

			}

			event.preventDefault();
			return;

		}

		if ( this._dragPointerId !== event.pointerId ) return;

		const now = performance.now();
		const elapsedMs = Math.max( now - this._dragLastTime, 8 );
		const dx = event.clientX - this._dragLastX;
		const angleDelta = dx * 0.01;

		this._orbitAngle += angleDelta;
		this._orbitVelocity = angleDelta / ( elapsedMs / 1000 );
		this._dragLastX = event.clientX;
		this._dragLastTime = now;
		this._turntable.rotation.y = this._orbitAngle;

		event.preventDefault();

	}

	_onPointerUp( event ) {

		this._renderer.domElement.releasePointerCapture?.( event.pointerId );
		this._finishPointer( event.pointerId );

	}

	_onPointerCancel( event ) {

		this._finishPointer( event.pointerId );

	}

	_finishPointer( pointerId ) {

		this._activePointers.delete( pointerId );

		if ( this._activePointers.size >= 2 ) {

			this._dragPointerId = null;
			this._pinchStartDistance = this._measureActivePointerDistance();
			this._pinchStartZoom = this._targetZoomScale;
			return;

		}

		if ( this._activePointers.size === 1 ) {

			const [ nextPointerId, nextPointer ] = this._activePointers.entries().next().value;
			this._dragPointerId = nextPointerId;
			this._dragLastX = nextPointer.x;
			this._dragLastTime = performance.now();
			this._pinchStartDistance = 0;
			this._renderer.domElement.style.cursor = 'grabbing';
			return;

		}

		this._dragPointerId = null;
		this._pinchStartDistance = 0;
		this._pinchStartZoom = this._targetZoomScale;
		this._renderer.domElement.style.cursor = 'grab';

	}

	_onWheel( event ) {

		event.preventDefault();
		this._setTargetZoom( this._targetZoomScale * Math.exp( event.deltaY * 0.0011 ) );

	}

	_measureActivePointerDistance() {

		if ( this._activePointers.size < 2 ) return 0;

		const [ firstPointer, secondPointer ] = Array.from( this._activePointers.values() );
		return Math.hypot( secondPointer.x - firstPointer.x, secondPointer.y - firstPointer.y );

	}

	_setTargetZoom( zoomScale ) {

		this._targetZoomScale = THREE.MathUtils.clamp( zoomScale, this._minZoomScale, this._maxZoomScale );

	}

	_updateCameraPose() {

		this._lookTarget.copy( this._frameLookTarget );
		this._lookTarget.x += this._debugCameraOffsets.lookTargetX;
		this._lookTarget.y += this._debugCameraOffsets.lookTargetY;

		_cameraOffset.copy( this._baseCameraOffset ).multiplyScalar( this._zoomScale );
		_cameraOffset.x += this._debugCameraOffsets.cameraOffsetX;
		_cameraOffset.y += this._debugCameraOffsets.cameraOffsetY;
		_cameraOffset.z += this._debugCameraOffsets.cameraOffsetZ;
		this._camera.position.copy( this._lookTarget ).add( _cameraOffset );
		this._camera.lookAt( this._lookTarget );

	}

	_startLoop() {

		if ( this._disposed || this._paused || this._rafId !== null ) return;

		const tick = ( now ) => {

			if ( this._disposed || this._paused ) {

				this._rafId = null;
				return;

			}

			this._rafId = requestAnimationFrame( tick );

			const dt = this._lastFrameTime > 0
				? Math.min( ( now - this._lastFrameTime ) / 1000, 0.05 )
				: 1 / 60;
			this._lastFrameTime = now;

			if ( this._dragPointerId === null && this._activePointers.size < 2 ) {

				if ( Math.abs( this._orbitVelocity ) > 0.02 ) {

					this._orbitAngle += this._orbitVelocity * dt;
					this._orbitVelocity *= Math.exp( - 7 * dt );

				} else {

					this._orbitVelocity = 0;

				}

			}

			this._zoomScale += ( this._targetZoomScale - this._zoomScale ) * ( 1 - Math.exp( - 10 * dt ) );
			if ( this._mixer ) this._mixer.update( dt );
			this._blinkController.update( dt );
			if ( this._characterRoot && this._characterMaterialDebugVersion !== getMenuCharacterMaterialDebugVersion() ) {

				applyMenuCharacterMaterialDebugTuning( this._characterRoot );
				this._characterMaterialDebugVersion = getMenuCharacterMaterialDebugVersion();

			}
			this._turntable.rotation.y = this._orbitAngle;
			this._updateCameraPose();
			this._renderer.render( this._scene, this._camera );

		};

		this._rafId = requestAnimationFrame( tick );

	}

}
