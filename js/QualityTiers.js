// QualityTiers.js — Quality preset definitions and device tier detection

export const VALID_TIERS = [ 'low', 'medium', 'high', 'ultra' ];

// ── Preset definitions ──────────────────────────────────────────────────────
// Each effect maps to { enabled, params } where params override shader uniforms.
// All 9 effects must have entries in every preset.

export const PRESETS = {

	low: {
		bloom:               { enabled: true,  params: {} },
		ssao:                { enabled: false, params: {} },
		godRays:             { enabled: false, params: {} },
		motionBlur:          { enabled: false, params: {} },
		radialZoom:          { enabled: false, params: {} },
		chromaticAberration: { enabled: false, params: {} },
		vignette:            { enabled: false, params: {} },
		colorGrading:        { enabled: false, params: {} },
		screenShake:         { enabled: false, params: {} },
		shadowMapSize: 512,
	},

	medium: {
		bloom:               { enabled: true,  params: {} },
		ssao:                { enabled: false, params: {} },
		godRays:             { enabled: false, params: {} },
		motionBlur:          { enabled: false, params: {} },
		radialZoom:          { enabled: false, params: {} },
		chromaticAberration: { enabled: false, params: {} },
		vignette:            { enabled: true,  params: { intensity: 0.4, softness: 0.5 } },
		colorGrading:        { enabled: true,  params: { brightness: 0.0, contrast: 1.05, saturation: 1.1 } },
		screenShake:         { enabled: false, params: {} },
		shadowMapSize: 1024,
	},

	high: {
		bloom:               { enabled: true,  params: {} },
		ssao:                { enabled: false, params: {} },
		godRays:             { enabled: false, params: {} },
		motionBlur:          { enabled: false, params: { intensity: 0.2, samples: 4 } },
		radialZoom:          { enabled: false, params: { intensity: 0.15, samples: 4 } },
		chromaticAberration: { enabled: false, params: { offset: 0.001 } },
		vignette:            { enabled: true,  params: { intensity: 0.3, softness: 0.6 } },
		colorGrading:        { enabled: true,  params: { brightness: 0.0, contrast: 1.02, saturation: 1.05 } },
		screenShake:         { enabled: false, params: {} },
		shadowMapSize: 2048,
	},

	ultra: {
		bloom:               { enabled: true,  params: {} },
		ssao:                { enabled: false, params: { kernelRadius: 1, minDistance: 0.001, maxDistance: 0.05 } },
		godRays:             { enabled: false, params: { intensity: 0.6, decay: 0.96, density: 0.3, weight: 0.05, samples: 30 } },
		motionBlur:          { enabled: false, params: { intensity: 0.2, samples: 6 } },
		radialZoom:          { enabled: false, params: { intensity: 0.15, samples: 6 } },
		chromaticAberration: { enabled: false, params: { offset: 0.002 } },
		vignette:            { enabled: true,  params: { intensity: 0.35, softness: 0.5 } },
		colorGrading:        { enabled: true,  params: { brightness: 0.0, contrast: 1.02, saturation: 1.05 } },
		screenShake:         { enabled: false, params: {} },
		shadowMapSize: 2048,
	},

};

// ── Pixel ratio per tier (renderer concern, separate from effects config) ───

const _dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

export const TIER_PIXEL_RATIO = {
	low:    1.0,
	medium: 1.0,
	high:   Math.min( _dpr, 1.5 ),
	ultra:  Math.min( _dpr, 2.0 ),
};

// ── Adaptive quality governor ───────────────────────────────────────────────
// Monitors FPS and adjusts quality tier when sustained under/over-performance.

const TIER_ORDER = [ 'low', 'medium', 'high', 'ultra' ];

export class AdaptiveQuality {

	constructor( settings ) {

		this._settings = settings;
		this._lowCount = 0;
		this._highCount = 0;
		this._lastChangeTime = 0;
		this._cooldownMs = 5000; // Don't change again for 5s after a switch
		this._lowThreshold = 40;
		this._highThreshold = 55;
		this._lowSamples = 3; // 3 consecutive low readings = drop
		this._highSamples = 5; // 5 consecutive high readings = raise

	}

	/**
	 * Call this each FPS sample (typically every 500ms).
	 * @param {number} fps - current measured FPS
	 */
	sample( fps ) {

		const now = performance.now();
		if ( now - this._lastChangeTime < this._cooldownMs ) return;

		if ( fps < this._lowThreshold ) {

			this._lowCount ++;
			this._highCount = 0;

			if ( this._lowCount >= this._lowSamples ) {

				this._adjustTier( - 1 );
				this._lowCount = 0;

			}

		} else if ( fps > this._highThreshold ) {

			this._highCount ++;
			this._lowCount = 0;

			if ( this._highCount >= this._highSamples ) {

				this._adjustTier( 1 );
				this._highCount = 0;

			}

		} else {

			// In the acceptable range — reset both counters
			this._lowCount = 0;
			this._highCount = 0;

		}

	}

	_adjustTier( direction ) {

		const current = this._settings.get( 'quality' );
		const idx = TIER_ORDER.indexOf( current );
		const newIdx = idx + direction;

		if ( newIdx < 0 || newIdx >= TIER_ORDER.length ) return;

		this._settings.set( 'quality', TIER_ORDER[ newIdx ] );
		this._lastChangeTime = performance.now();

	}

}

// ── Known mobile GPU substrings ─────────────────────────────────────────────

const MOBILE_GPU_HINTS = [
	'adreno', 'mali', 'apple gpu', 'powervr', 'img ',
	'tegra', 'vivante', 'videocore', 'sgx',
];

// ── Device tier detection ───────────────────────────────────────────────────

export function detectTier() {

	const isTouch = typeof window !== 'undefined' &&
		( 'ontouchstart' in window || ( navigator && navigator.maxTouchPoints > 0 ) );

	const deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;

	// Probe GPU via throwaway WebGL context
	let isMobileGPU = null; // null = unknown

	try {

		const canvas = typeof document !== 'undefined' ? document.createElement( 'canvas' ) : null;

		if ( canvas ) {

			const gl = canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' );

			if ( gl ) {

				const ext = gl.getExtension( 'WEBGL_debug_renderer_info' );

				if ( ext ) {

					const renderer = gl.getParameter( ext.UNMASKED_RENDERER_WEBGL ).toLowerCase();
					isMobileGPU = MOBILE_GPU_HINTS.some( hint => renderer.includes( hint ) );

				}

				// Release the throwaway context
				const loseCtx = gl.getExtension( 'WEBGL_lose_context' );
				if ( loseCtx ) loseCtx.loseContext();

			}

		}

	} catch ( e ) {

		// GPU detection failed — fall through to heuristic

	}

	// ── Classification ──────────────────────────────────────────────────────

	// Mobile GPU detected
	if ( isMobileGPU === true ) return 'low';

	// Desktop GPU detected
	if ( isMobileGPU === false ) {

		if ( deviceMemory !== undefined && deviceMemory >= 8 ) return 'ultra';
		return 'high';

	}

	// GPU unknown — fall back to touch + memory heuristic
	if ( isTouch ) {

		if ( deviceMemory !== undefined && deviceMemory >= 6 ) return 'medium';
		return 'low';

	}

	// Desktop, no GPU info, no memory info
	if ( deviceMemory !== undefined && deviceMemory >= 8 ) return 'ultra';
	if ( deviceMemory !== undefined && deviceMemory >= 4 ) return 'high';

	return 'medium';

}
