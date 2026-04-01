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
		motionBlur:          { enabled: true,  params: { intensity: 0.4, samples: 6 } },
		radialZoom:          { enabled: true,  params: { intensity: 0.2, samples: 6 } },
		chromaticAberration: { enabled: true,  params: { offset: 0.003 } },
		vignette:            { enabled: true,  params: { intensity: 0.4, softness: 0.5 } },
		colorGrading:        { enabled: true,  params: { brightness: 0.0, contrast: 1.05, saturation: 1.1 } },
		screenShake:         { enabled: false, params: {} },
		shadowMapSize: 2048,
	},

	ultra: {
		bloom:               { enabled: true,  params: {} },
		ssao:                { enabled: true,  params: { kernelRadius: 1, minDistance: 0.001, maxDistance: 0.05 } },
		godRays:             { enabled: true,  params: { intensity: 1.0, decay: 0.96, density: 0.5, weight: 0.1, samples: 60 } },
		motionBlur:          { enabled: true,  params: { intensity: 0.5, samples: 8 } },
		radialZoom:          { enabled: true,  params: { intensity: 0.3, samples: 8 } },
		chromaticAberration: { enabled: true,  params: { offset: 0.005 } },
		vignette:            { enabled: true,  params: { intensity: 0.5, softness: 0.5 } },
		colorGrading:        { enabled: true,  params: { brightness: 0.0, contrast: 1.0, saturation: 1.0 } },
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
