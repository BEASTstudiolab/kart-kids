import * as THREE from 'three';

const _rearPos = new THREE.Vector3();
const _rearLook = new THREE.Vector3();
const _rendererSize = new THREE.Vector2();
const _viewport = new THREE.Vector4();
const _scissor = new THREE.Vector4();
const _clearColor = new THREE.Color();

const QUALITY_CONFIG = {
	low: {
		enabled: false,
		cadence: Infinity,
		width: 220,
		border: 0,
	},
	medium: {
		enabled: true,
		cadence: 2,
		width: 260,
		border: 2,
	},
	high: {
		enabled: true,
		cadence: 1,
		width: 300,
		border: 2,
	},
	ultra: {
		enabled: true,
		cadence: 1,
		width: 340,
		border: 3,
	},
};

export class RearviewMirror {

	constructor( renderer ) {

		this.renderer = renderer;

		// Rear-facing camera: wide aspect (3:1), moderate FOV
		this.rearCamera = new THREE.PerspectiveCamera( 60, 3, 1.5, 150 );

		// Vehicle-local offsets for the rear camera
		this.rearOffset = new THREE.Vector3( 0, 1.5, - 2 );
		this.rearLookBehind = - 8;
		this.enabled = false; // off by default — user can enable in settings
		this.visible = true; // effective visibility (enabled + not isometric)
		this._qualityTier = 'high';
		this._frameCounter = 0;

	}

	setEnabled( v ) {

		this.enabled = v;

	}

	setVisible( v ) {

		this.visible = v;

	}

	setQualityTier( tier ) {

		this._qualityTier = QUALITY_CONFIG[ tier ] ? tier : 'high';
		this._frameCounter = 0;

	}

	update( target, vehicleQuaternion ) {

		if ( ! this.enabled || ! this.visible ) return;

		// Position the rear camera above and slightly behind the vehicle
		_rearPos.copy( this.rearOffset ).applyQuaternion( vehicleQuaternion ).add( target );
		this.rearCamera.position.copy( _rearPos );

		// Look further behind the vehicle
		_rearLook.set( 0, 0, this.rearLookBehind ).applyQuaternion( vehicleQuaternion ).add( target );
		_rearLook.y += 0.5;
		this.rearCamera.lookAt( _rearLook );

	}

	// Call with effects temporarily disabled (caller handles setEffects toggling)
	render( scene, postFX = null ) {

		if ( ! this.enabled || ! this.visible ) return;

		const quality = QUALITY_CONFIG[ this._qualityTier ] || QUALITY_CONFIG.high;
		if ( ! quality.enabled ) return;

		this._frameCounter = ( this._frameCounter + 1 ) % quality.cadence;
		if ( quality.cadence > 1 && this._frameCounter !== 0 ) return;

		const renderer = this.renderer;
		renderer.getSize( _rendererSize );

		const mirrorWidth = Math.min( quality.width, Math.max( 180, _rendererSize.x - 24 ) );
		const mirrorHeight = Math.round( mirrorWidth / 3 );
		const border = quality.border;
		const frameWidth = mirrorWidth + border * 2;
		const frameHeight = mirrorHeight + border * 2;
		const insetX = Math.round( ( _rendererSize.x - frameWidth ) * 0.5 );
		const insetY = Math.round( 10 );

		const previousAutoClear = renderer.autoClear;
		const previousScissorTest = renderer.getScissorTest();
		const previousClearAlpha = renderer.getClearAlpha();
		renderer.getViewport( _viewport );
		renderer.getScissor( _scissor );
		renderer.getClearColor( _clearColor );

		postFX?.suspendEffects?.();

		try {

			renderer.autoClear = false;
			renderer.setScissorTest( true );

			if ( border > 0 ) {

				renderer.setViewport( insetX, insetY, frameWidth, frameHeight );
				renderer.setScissor( insetX, insetY, frameWidth, frameHeight );
				renderer.setClearColor( 0x101010, 0.95 );
				renderer.clear( true, true, true );

			}

			renderer.setViewport( insetX + border, insetY + border, mirrorWidth, mirrorHeight );
			renderer.setScissor( insetX + border, insetY + border, mirrorWidth, mirrorHeight );
			renderer.setClearColor( _clearColor, previousClearAlpha );
			renderer.clear( true, true, true );
			renderer.render( scene, this.rearCamera );

		} finally {

			renderer.setClearColor( _clearColor, previousClearAlpha );
			renderer.setViewport( _viewport );
			renderer.setScissor( _scissor );
			renderer.setScissorTest( previousScissorTest );
			renderer.autoClear = previousAutoClear;
			postFX?.restoreEffects?.();

		}

	}

	dispose() {

		this.renderer = null;
		this.rearCamera = null;
		this.enabled = false;
		this.visible = false;

	}

}
