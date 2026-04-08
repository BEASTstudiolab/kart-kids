// PostProcessing.js — Centralized post-processing effect manager
// Manages all ShaderPass instances and calls renderer.setEffects() with enabled subset.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ---------------------------------------------------------------------------
// Shared vertex shader
// ---------------------------------------------------------------------------
const VERT = /* glsl */`
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

// ---------------------------------------------------------------------------
// Motion Blur — directional blur based on camera velocity
// ---------------------------------------------------------------------------
const motionBlurShader = {
	uniforms: {
		tDiffuse:       { value: null },
		velocityVector: { value: new THREE.Vector2( 0, 0 ) },
		intensity:      { value: 0.5 },
		samples:        { value: 8 },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform vec2 velocityVector;
		uniform float intensity;
		uniform int samples;
		varying vec2 vUv;

		void main() {
			vec2 velocity = velocityVector * intensity;
			vec4 color = vec4( 0.0 );
			float total = 0.0;
			for ( int i = 0; i < 16; i++ ) {
				if ( i >= samples ) break;
				float t = float( i ) / float( samples ) - 0.5;
				vec2 offset = velocity * t;
				color += texture2D( tDiffuse, vUv + offset );
				total += 1.0;
			}
			gl_FragColor = color / total;
		}
	`,
};

// ---------------------------------------------------------------------------
// Chromatic Aberration — RGB channel offset from center
// ---------------------------------------------------------------------------
const chromAbShader = {
	uniforms: {
		tDiffuse: { value: null },
		offset:   { value: 0.005 },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float offset;
		varying vec2 vUv;

		void main() {
			vec2 dir = vUv - vec2( 0.5 );
			float r = texture2D( tDiffuse, vUv + dir * offset ).r;
			float g = texture2D( tDiffuse, vUv ).g;
			float b = texture2D( tDiffuse, vUv - dir * offset ).b;
			gl_FragColor = vec4( r, g, b, 1.0 );
		}
	`,
};

// ---------------------------------------------------------------------------
// Radial Zoom Blur — blur from screen center (boost effect)
// ---------------------------------------------------------------------------
const radialZoomShader = {
	uniforms: {
		tDiffuse:  { value: null },
		intensity: { value: 0.3 },
		samples:   { value: 8 },
		center:    { value: new THREE.Vector2( 0.5, 0.5 ) },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float intensity;
		uniform int samples;
		uniform vec2 center;
		varying vec2 vUv;

		void main() {
			vec2 dir = vUv - center;
			vec4 color = vec4( 0.0 );
			float total = 0.0;
			for ( int i = 0; i < 16; i++ ) {
				if ( i >= samples ) break;
				float t = float( i ) / float( samples );
				vec2 offset = dir * t * intensity * 0.1;
				color += texture2D( tDiffuse, vUv - offset );
				total += 1.0;
			}
			gl_FragColor = color / total;
		}
	`,
};

// ---------------------------------------------------------------------------
// Vignette — darkened screen edges
// ---------------------------------------------------------------------------
const vignetteShader = {
	uniforms: {
		tDiffuse:  { value: null },
		intensity: { value: 0.5 },
		softness:  { value: 0.5 },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float intensity;
		uniform float softness;
		varying vec2 vUv;

		void main() {
			vec4 color = texture2D( tDiffuse, vUv );
			float dist = distance( vUv, vec2( 0.5 ) );
			float vignette = smoothstep(
				0.8 - softness * 0.3,
				1.4 - softness * 0.5,
				dist * ( intensity + 0.5 )
			);
			color.rgb *= 1.0 - vignette;
			gl_FragColor = color;
		}
	`,
};

// ---------------------------------------------------------------------------
// Color Grading — brightness / contrast / saturation
// ---------------------------------------------------------------------------
const colorGradingShader = {
	uniforms: {
		tDiffuse:   { value: null },
		brightness: { value: 0.0 },
		contrast:   { value: 1.0 },
		saturation: { value: 1.0 },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float brightness;
		uniform float contrast;
		uniform float saturation;
		varying vec2 vUv;

		void main() {
			vec4 color = texture2D( tDiffuse, vUv );
			color.rgb += brightness;
			color.rgb = ( color.rgb - 0.5 ) * contrast + 0.5;
			float gray = dot( color.rgb, vec3( 0.299, 0.587, 0.114 ) );
			color.rgb = mix( vec3( gray ), color.rgb, saturation );
			gl_FragColor = color;
		}
	`,
};

// ---------------------------------------------------------------------------
// Screen Shake — UV offset controlled from JS
// ---------------------------------------------------------------------------
const screenShakeShader = {
	uniforms: {
		tDiffuse: { value: null },
		offset:   { value: new THREE.Vector2( 0, 0 ) },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform vec2 offset;
		varying vec2 vUv;

		void main() {
			gl_FragColor = texture2D( tDiffuse, vUv + offset );
		}
	`,
};

// ---------------------------------------------------------------------------
// God Rays — screen-space light scattering
// ---------------------------------------------------------------------------
const godRaysShader = {
	uniforms: {
		tDiffuse:              { value: null },
		lightPositionOnScreen: { value: new THREE.Vector2( 0.5, 0.5 ) },
		intensity:             { value: 1.0 },
		decay:                 { value: 0.96 },
		density:               { value: 0.5 },
		weight:                { value: 0.1 },
		samples:               { value: 60 },
	},
	vertexShader: VERT,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform vec2 lightPositionOnScreen;
		uniform float intensity;
		uniform float decay;
		uniform float density;
		uniform float weight;
		uniform int samples;
		varying vec2 vUv;

		void main() {
			vec2 deltaTextCoord = ( vUv - lightPositionOnScreen ) * density / float( samples );
			vec2 coord = vUv;
			vec4 color = texture2D( tDiffuse, vUv );
			float illuminationDecay = 1.0;
			for ( int i = 0; i < 64; i++ ) {
				if ( i >= samples ) break;
				coord -= deltaTextCoord;
				vec4 s = texture2D( tDiffuse, coord );
				s *= illuminationDecay * weight;
				color += s;
				illuminationDecay *= decay;
			}
			gl_FragColor = color * intensity;
		}
	`,
};


// ---------------------------------------------------------------------------
// PostProcessing — central effect manager
// ---------------------------------------------------------------------------

export class PostProcessing {

	constructor( renderer, scene, camera, bloomPass ) {

		this.renderer = renderer;
		this.scene    = scene;
		this.camera   = camera;

		// Directional light ref for god-rays (set via setDirLight)
		this.dirLight = null;
		this._lightProjVec = new THREE.Vector3();

		// Screen shake state
		this.shakeIntensity = 0;
		this.shakeDecay     = 10;

		// SSAO — placeholder, lazy-loaded when first enabled
		this._ssaoPass = null;
		this._ssaoLoaded = false;

		// Preset generation counter for rapid-switch race guard
		this._presetGeneration = 0;

		// Custom ShaderPass instances
		const motionBlurPass   = new ShaderPass( motionBlurShader );
		const chromAbPass      = new ShaderPass( chromAbShader );
		const radialZoomPass   = new ShaderPass( radialZoomShader );
		const vignettePass     = new ShaderPass( vignetteShader );
		const colorGradingPass = new ShaderPass( colorGradingShader );
		const screenShakePass  = new ShaderPass( screenShakeShader );
		const godRaysPass      = new ShaderPass( godRaysShader );

		// Ordered effect list — render pass sequence
		this.effects = [
			{ name: 'bloom',               pass: bloomPass,        enabled: true  },
			{ name: 'ssao',                pass: null,              enabled: false },
			{ name: 'godRays',             pass: godRaysPass,      enabled: false },
			{ name: 'motionBlur',          pass: motionBlurPass,   enabled: false },
			{ name: 'radialZoom',          pass: radialZoomPass,   enabled: false },
			{ name: 'chromaticAberration', pass: chromAbPass,      enabled: false },
			{ name: 'vignette',            pass: vignettePass,     enabled: false },
			{ name: 'colorGrading',        pass: colorGradingPass, enabled: false },
			{ name: 'screenShake',         pass: screenShakePass,  enabled: false },
		];

		this._effectMap = new Map( this.effects.map( e => [ e.name, e ] ) );

		this.rebuildEffects();

	}

	// ── Core API ─────────────────────────────────────────────────────────────

	/** Filter to enabled passes and push to renderer. */
	rebuildEffects() {

		const active = this.effects
			.filter( e => e.enabled && e.pass !== null )
			.map( e => e.pass );

		this.renderer.setEffects( active );

	}

	/** Toggle an effect by name. */
	async setEnabled( name, enabled ) {

		const effect = this.getEffect( name );
		if ( ! effect ) return;

		// Lazy-load SSAO on first enable
		if ( name === 'ssao' && enabled && ! this._ssaoLoaded ) {

			try {

				const { SSAOPass } = await import( 'three/addons/postprocessing/SSAOPass.js' );
				const ssaoPass = new SSAOPass( this.scene, this.camera, window.innerWidth, window.innerHeight );
				ssaoPass.kernelRadius = 1;
				ssaoPass.minDistance   = 0.001;
				ssaoPass.maxDistance   = 0.05;
				effect.pass = ssaoPass;
				this._ssaoPass = ssaoPass;
				this._ssaoLoaded = true;
				this._applyPendingSSAOParams();

			} catch ( e ) {

				console.warn( 'SSAO pass failed to load:', e.message );
				return;

			}

		}

		effect.enabled = enabled;
		this.rebuildEffects();

	}

	/** Return the pass object for parameter tweaking. */
	getPass( name ) {

		const effect = this.getEffect( name );
		return effect ? effect.pass : null;

	}

	/** Return the full effect entry { name, pass, enabled }. */
	getEffect( name ) {

		return this._effectMap.get( name ) ?? null;

	}

	// ── Gameplay API ─────────────────────────────────────────────────────────

	/** Trigger a screen-shake burst. Auto-enables the pass. */
	triggerScreenShake( intensity ) {

		this.shakeIntensity = intensity;

		if ( ! this.getEffect( 'screenShake' ).enabled ) {

			this.setEnabled( 'screenShake', true );

		}

	}

	/** Set directional light reference for god-rays projection. */
	setDirLight( light ) {

		this.dirLight = light;

	}

	// ── Preset application ──────────────────────────────────────────────────

	/**
	 * Bulk-apply a preset config object. Directly mutates effect.enabled flags
	 * and sets uniform params, then rebuilds once. Async because SSAO may need
	 * lazy-loading.
	 * @param {object} config - Maps effect names to { enabled, params }
	 */
	async applyPreset( config ) {

		const gen = ++ this._presetGeneration;

		// Directly set enabled flags (bypass setEnabled to avoid 9 rebuilds)
		// Pre-await mutations are unguarded by design — the last caller's flags always win synchronously
		for ( const effect of this.effects ) {

			const entry = config[ effect.name ];
			if ( ! entry ) continue;

			// Preserve active screen shake — gameplay code auto-manages this effect
			if ( effect.name === 'screenShake' && this.shakeIntensity > 0.001 ) continue;

			effect.enabled = entry.enabled;

		}

		// Handle SSAO lazy-load if enabling
		const ssaoEntry = config.ssao;

		if ( ssaoEntry && ssaoEntry.enabled && ! this._ssaoLoaded ) {

			try {

				const { SSAOPass } = await import( 'three/addons/postprocessing/SSAOPass.js' );

				// Check generation — bail if a newer preset was applied during the await
				if ( this._presetGeneration !== gen ) return;

				const ssaoPass = new SSAOPass( this.scene, this.camera, window.innerWidth, window.innerHeight );
				ssaoPass.kernelRadius = 1;
				ssaoPass.minDistance = 0.001;
				ssaoPass.maxDistance = 0.05;

				const ssaoEffect = this.getEffect( 'ssao' );
				ssaoEffect.pass = ssaoPass;
				this._ssaoPass = ssaoPass;
				this._ssaoLoaded = true;
				this._applyPendingSSAOParams();

			} catch ( e ) {

				console.warn( 'SSAO pass failed to load:', e.message );
				const ssaoEffect = this.getEffect( 'ssao' );
				ssaoEffect.enabled = false;

			}

		}

		// Check generation again after potential await
		if ( this._presetGeneration !== gen ) return;

		// Apply SSAO params via buffered API
		if ( ssaoEntry && ssaoEntry.params ) {

			for ( const key in ssaoEntry.params ) {

				this.setSSAOParam( key, ssaoEntry.params[ key ] );

			}

		}

		// Apply uniform params for all other effects
		for ( const effect of this.effects ) {

			if ( effect.name === 'ssao' ) continue;

			const entry = config[ effect.name ];
			if ( ! entry || ! entry.params || ! effect.pass || ! effect.pass.uniforms ) continue;

			for ( const key in entry.params ) {

				if ( effect.pass.uniforms[ key ] ) {

					effect.pass.uniforms[ key ].value = entry.params[ key ];

				}

			}

		}

		this.rebuildEffects();

	}

	// ── SSAO parameter API ──────────────────────────────────────────────────

	/** Set an SSAO parameter. Buffers values until the pass is lazy-loaded. */
	setSSAOParam( key, value ) {

		if ( ! this._ssaoPendingParams ) this._ssaoPendingParams = {};
		this._ssaoPendingParams[ key ] = value;

		if ( this._ssaoPass ) {

			this._ssaoPass[ key ] = value;

		}

	}

	/** Apply any buffered SSAO params after lazy load. Called internally. */
	_applyPendingSSAOParams() {

		if ( ! this._ssaoPendingParams || ! this._ssaoPass ) return;

		for ( const key in this._ssaoPendingParams ) {

			this._ssaoPass[ key ] = this._ssaoPendingParams[ key ];

		}

	}

	// ── Resize ───────────────────────────────────────────────────────────────

	/** Update size-dependent passes when canvas resizes. */
	resize( width, height ) {

		if ( this._ssaoPass ) this._ssaoPass.setSize( width, height );

	}

	// ── Per-frame update ─────────────────────────────────────────────────────

	/**
	 * Drive dynamic effects each frame.
	 * @param {number} dt - Delta time in seconds
	 * @param {THREE.Vector3} cameraVelocity - World-space camera velocity
	 * @param {boolean} boostActive - Whether boost is active
	 */
	update( dt, cameraVelocity, boostActive ) {

		// Motion blur — camera velocity → screen-space UV delta
		if ( this.getEffect( 'motionBlur' ).enabled ) {

			const pass = this.getPass( 'motionBlur' );
			pass.uniforms.velocityVector.value.set(
				cameraVelocity.x * 0.01,
				cameraVelocity.y * 0.01
			);

		}

		// Radial zoom — ramp during boost, decay otherwise
		if ( this.getEffect( 'radialZoom' ).enabled ) {

			const pass = this.getPass( 'radialZoom' );
			const target  = boostActive ? 0.3 : 0.0;
			const current = pass.uniforms.intensity.value;
			pass.uniforms.intensity.value += ( target - current ) * Math.min( dt * 5, 1 );

		}

		// Screen shake — random UV offset with exponential decay
		if ( this.shakeIntensity > 0.001 ) {

			const pass = this.getPass( 'screenShake' );
			pass.uniforms.offset.value.set(
				( Math.random() - 0.5 ) * this.shakeIntensity,
				( Math.random() - 0.5 ) * this.shakeIntensity
			);
			this.shakeIntensity *= Math.exp( - this.shakeDecay * dt );

		} else if ( this.getEffect( 'screenShake' ).enabled ) {

			this.getPass( 'screenShake' ).uniforms.offset.value.set( 0, 0 );
			this.setEnabled( 'screenShake', false );

		}

		// God rays — project directional light to screen space
		if ( this.getEffect( 'godRays' ).enabled && this.dirLight ) {

			const lightPos = this._lightProjVec.copy( this.dirLight.position ).project( this.camera );
			this.getPass( 'godRays' ).uniforms.lightPositionOnScreen.value.set(
				( lightPos.x + 1 ) / 2,
				( lightPos.y + 1 ) / 2
			);

		}

	}

}
