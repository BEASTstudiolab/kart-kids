import * as THREE from 'three';

const LABEL_HEIGHT = 2.8;
const FADE_NEAR = 8;
const FADE_FAR = 40;

function createLabelTexture( text, color ) {

	const canvas = document.createElement( 'canvas' );
	canvas.width = 256;
	canvas.height = 64;
	const ctx = canvas.getContext( '2d' );

	ctx.font = 'bold 28px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Background pill
	const metrics = ctx.measureText( text );
	const pw = metrics.width + 24;
	const ph = 36;
	const px = ( canvas.width - pw ) / 2;
	const py = ( canvas.height - ph ) / 2;
	ctx.fillStyle = 'rgba(0,0,0,0.45)';
	ctx.beginPath();
	ctx.roundRect( px, py, pw, ph, 12 );
	ctx.fill();

	// Text with vehicle color tint
	const r = Math.round( color.r * 255 );
	const g = Math.round( color.g * 255 );
	const b = Math.round( color.b * 255 );
	ctx.fillStyle = `rgb(${r},${g},${b})`;
	ctx.fillText( text, canvas.width / 2, canvas.height / 2 );

	const texture = new THREE.CanvasTexture( canvas );
	texture.minFilter = THREE.LinearFilter;
	return texture;

}

export class AINameplate {

	constructor( text, color ) {

		const texture = createLabelTexture( text, color );
		const material = new THREE.SpriteMaterial( {
			map: texture,
			transparent: true,
			depthTest: false,
			sizeAttenuation: true,
		} );

		this.sprite = new THREE.Sprite( material );
		this.sprite.scale.set( 2.0, 0.5, 1 );
		this.sprite.renderOrder = 999;
		this._texture = texture;

	}

	update( vehicleContainer, camera ) {

		const pos = vehicleContainer.position;
		this.sprite.position.set( pos.x, pos.y + LABEL_HEIGHT, pos.z );

		// Fade based on distance to camera
		const dist = camera.position.distanceTo( this.sprite.position );
		if ( dist < FADE_NEAR ) {

			this.sprite.material.opacity = 0;

		} else if ( dist > FADE_FAR ) {

			this.sprite.material.opacity = 0;

		} else {

			const t = ( dist - FADE_NEAR ) / ( FADE_FAR - FADE_NEAR );
			this.sprite.material.opacity = t < 0.2 ? t / 0.2 : ( t > 0.8 ? ( 1 - t ) / 0.2 : 1 );

		}

	}

	dispose() {

		this._texture.dispose();
		this.sprite.material.dispose();

	}

}
