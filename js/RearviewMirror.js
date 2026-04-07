import * as THREE from 'three';

const _rearPos = new THREE.Vector3();
const _rearLook = new THREE.Vector3();

export class RearviewMirror {

	constructor( renderer ) {

		this.renderer = renderer;

		// Rear-facing camera: wide aspect (3:1), moderate FOV
		this.rearCamera = new THREE.PerspectiveCamera( 60, 3, 1.5, 150 );

		// Render target — kept small for fast pixel readback
		this.rtWidth = 300;
		this.rtHeight = 100;
		this.renderTarget = new THREE.WebGLRenderTarget( this.rtWidth, this.rtHeight, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
		} );

		// Vehicle-local offsets for the rear camera
		this.rearOffset = new THREE.Vector3( 0, 1.5, - 2 );
		this.rearLookBehind = - 8;

		// CSS overlay with rounded corners
		this.frame = document.createElement( 'div' );
		this.frame.style.cssText =
			'position:fixed;top:10px;left:50%;transform:translateX(-50%);' +
			'width:300px;height:100px;' +
			'border-radius:12px;border:4px solid rgba(200,200,200,0.6);' +
			'pointer-events:none;z-index:5;overflow:hidden;box-sizing:border-box;' +
			'background:#000;display:none;';
		document.body.appendChild( this.frame );

		// 2D canvas inside frame — avoids post-processing pipeline entirely
		this._canvas = document.createElement( 'canvas' );
		this._canvas.width = this.rtWidth;
		this._canvas.height = this.rtHeight;
		this._canvas.style.cssText = 'width:100%;height:100%;display:block;';
		this.frame.appendChild( this._canvas );
		this._ctx = this._canvas.getContext( '2d' );

		// Buffers for pixel readback
		this._pixelBuf = new Uint8Array( this.rtWidth * this.rtHeight * 4 );
		this._imageData = new ImageData( this.rtWidth, this.rtHeight );

		this.enabled = false; // off by default — user can enable in settings
		this.visible = true; // effective visibility (enabled + not isometric)

	}

	setEnabled( v ) {

		this.enabled = v;
		this._updateVisibility();

	}

	setVisible( v ) {

		this.visible = v;
		this.frame.style.display = ( this.enabled && v ) ? '' : 'none';

	}

	_updateVisibility() {

		this.frame.style.display = ( this.enabled && this.visible ) ? '' : 'none';

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
	render( scene ) {

		if ( ! this.enabled || ! this.visible ) return;

		const renderer = this.renderer;

		// Save and restore viewport to prevent corrupting main camera render
		const vp = renderer.getViewport( new THREE.Vector4() );

		renderer.setRenderTarget( this.renderTarget );
		renderer.clear();
		renderer.render( scene, this.rearCamera );

		// Read pixels from GPU → CPU buffer
		renderer.readRenderTargetPixels(
			this.renderTarget, 0, 0, this.rtWidth, this.rtHeight, this._pixelBuf
		);

		renderer.setRenderTarget( null );
		renderer.setViewport( vp );

		// WebGL renders bottom-up; flip rows for Canvas 2D (top-down)
		const src = this._pixelBuf;
		const dst = this._imageData.data;
		const rowBytes = this.rtWidth * 4;
		for ( let y = 0; y < this.rtHeight; y ++ ) {

			const srcOff = ( this.rtHeight - 1 - y ) * rowBytes;
			const dstOff = y * rowBytes;
			dst.set( src.subarray( srcOff, srcOff + rowBytes ), dstOff );

		}

		this._ctx.putImageData( this._imageData, 0, 0 );

	}

	dispose() {

		this.renderTarget.dispose();
		if ( this.frame.parentNode ) this.frame.parentNode.removeChild( this.frame );

	}

}
