import { getExplosionPreset } from './explosions/ExplosionPresets.js';
import { createShaderTestRenderer } from './vfx-test-shader-renderer.js';

( function() {

	const stage = document.querySelector( '[data-testid="vfx-stage"]' );
	const canvas = document.querySelector( '[data-testid="vfx-stage-canvas"]' );
	const shaderCanvas = document.querySelector( '[data-testid="vfx-shader-stage-canvas"]' );
	const shaderFallback = document.querySelector( '[data-testid="vfx-shader-fallback"]' );
	const shaderFallbackMessage = document.querySelector( '[data-testid="vfx-shader-fallback-message"]' );
	const strip = document.querySelector( '[data-testid="vfx-effect-strip"]' );
	const controlsMount = document.querySelector( '[data-testid="vfx-controls"]' );
	const activeName = document.querySelector( '[data-testid="vfx-active-effect-name"]' );
	const activeId = document.querySelector( '[data-testid="vfx-active-effect-id"]' );
	const controlsTitle = document.querySelector( '[data-testid="vfx-controls-title"]' );
	const controlsDescription = document.querySelector( '[data-testid="vfx-controls-description"]' );
	const controlsCount = document.querySelector( '[data-testid="vfx-controls-count"]' );
	const libraryCount = document.querySelector( '[data-testid="vfx-library-count"]' );
	const stageRendererLabel = document.querySelector( '[data-testid="vfx-stage-renderer-label"]' );
	const replayButton = document.querySelector( '[data-action="replay"]' );
	const copyButton = document.querySelector( '[data-action="copy-json"]' );
	const nextButton = document.querySelector( '[data-action="next-effect"]' );
	const previousButton = document.querySelector( '[data-action="previous-effect"]' );
	const libraryTabs = Array.from( document.querySelectorAll( '[data-library-tab]' ) );

	if (
		! stage ||
		! canvas ||
		! shaderCanvas ||
		! shaderFallback ||
		! shaderFallbackMessage ||
		! strip ||
		! controlsMount ||
		! activeName ||
		! activeId ||
		! controlsTitle ||
		! controlsDescription ||
		! controlsCount ||
		! libraryCount ||
		! stageRendererLabel ||
		! replayButton ||
		! copyButton ||
		! nextButton ||
		! previousButton ||
		libraryTabs.length !== 2
	) {

		return;

	}

	const context = canvas.getContext( '2d' );
	if ( ! context ) return;

	const TAU = Math.PI * 2;
	const vfxSharedControls = [
		{ id: 'intensity', label: 'Intensity', min: 0.4, max: 1.8, step: 0.01 },
		{ id: 'size', label: 'Size', min: 0.5, max: 1.8, step: 0.01 },
		{ id: 'speed', label: 'Speed', min: 0.45, max: 1.8, step: 0.01 },
		{ id: 'spread', label: 'Spread', min: 0.15, max: 1.4, step: 0.01 },
		{ id: 'lifetime', label: 'Lifetime', min: 0.2, max: 1.5, step: 0.01 },
	];
	const vfxExtraControls = {
		burst: [
			{ id: 'sparkCount', label: 'Spark Count', min: 0.2, max: 1.3, step: 0.01 },
			{ id: 'heat', label: 'Heat', min: 0.2, max: 1.4, step: 0.01 },
		],
		lightning: [
			{ id: 'branching', label: 'Branching', min: 0.0, max: 1.0, step: 0.01 },
			{ id: 'jitter', label: 'Jitter', min: 0.0, max: 1.0, step: 0.01 },
		],
		slime: [
			{ id: 'blobCount', label: 'Blob Count', min: 0.2, max: 1.2, step: 0.01 },
			{ id: 'stringiness', label: 'Stringiness', min: 0.1, max: 1.2, step: 0.01 },
		],
		plume: [
			{ id: 'turbulence', label: 'Turbulence', min: 0.0, max: 1.2, step: 0.01 },
			{ id: 'rise', label: 'Rise', min: 0.2, max: 1.4, step: 0.01 },
		],
		projectile: [
			{ id: 'spin', label: 'Spin', min: 0.0, max: 1.4, step: 0.01 },
			{ id: 'trailDensity', label: 'Trail Density', min: 0.2, max: 1.4, step: 0.01 },
			{ id: 'haloFrequency', label: 'Halo Frequency', min: 0.2, max: 1.4, step: 0.01 },
		],
		sparks: [
			{ id: 'sparkCount', label: 'Spark Count', min: 0.2, max: 1.3, step: 0.01 },
			{ id: 'heat', label: 'Heat', min: 0.2, max: 1.4, step: 0.01 },
		],
	};

	function createExplosionEffect( id ) {

		const preset = getExplosionPreset( id );
		return {
			id: preset.id,
			label: preset.label,
			type: 'burst',
			accent: preset.styleFamily === 'energy' ? 0x75d7ff : 0xff8b2e,
			description: describeExplosionPreset( preset ),
			defaults: getExplosionDefaults( preset ),
			palette: getExplosionPalette( preset ),
			smokeColor: preset.styleFamily === 'energy' ? 0x3d4d6d : 0x6b6054,
			preset,
		};

	}

	function describeExplosionPreset( preset ) {

		switch ( preset.id ) {
			case 'mine': return 'Compact ground pop with a sharp core, tight ring, and small spark burst.';
			case 'bomb': return 'Rounder blast with a fuller bloom, broader smoke, and stronger debris fan-out.';
			case 'missileStrike': return 'Hero strike with directional ingress, the biggest core, and the strongest aftermath.';
			case 'pulseShockwave': return 'Energy-family pulse with purple-blue rings and minimal smoke.';
			default: return preset.label;
		}

	}

	function getExplosionDefaults( preset ) {

		switch ( preset.id ) {
			case 'mine':
				return { intensity: 0.86, size: 0.82, speed: 1.1, spread: 0.52, lifetime: 0.42, sparkCount: 0.72, heat: 0.66 };
			case 'bomb':
				return { intensity: 0.96, size: 1.0, speed: 1.04, spread: 0.68, lifetime: 0.58, sparkCount: 0.66, heat: 0.82 };
			case 'missileStrike':
				return { intensity: 1.12, size: 1.18, speed: 1.08, spread: 0.78, lifetime: 0.72, sparkCount: 0.76, heat: 0.92 };
			case 'pulseShockwave':
				return { intensity: 0.9, size: 0.96, speed: 0.92, spread: 0.62, lifetime: 0.7, sparkCount: 0.28, heat: 0.34 };
			default:
				return { intensity: 1, size: 1, speed: 1, spread: 0.7, lifetime: 0.6, sparkCount: 0.6, heat: 0.6 };
		}

	}

	function getExplosionPalette( preset ) {

		switch ( preset.id ) {
			case 'mine': return [ 0xffe38a, 0xff9c33, 0xff5b1f ];
			case 'bomb': return [ 0xfff09a, 0xff5f62, 0xff8a2a ];
			case 'missileStrike': return [ 0xfff2b4, 0xffa53d, 0xff6c20 ];
			case 'pulseShockwave': return [ 0xd4f5ff, 0x74b6ff, 0x8a67ff ];
			default: return [ 0xffffff, 0xffaa55, 0xff6622 ];
		}

	}

	const vfxEffects = [
		createExplosionEffect( 'mine' ),
		createExplosionEffect( 'bomb' ),
		createExplosionEffect( 'missileStrike' ),
		createExplosionEffect( 'pulseShockwave' ),
		{ id: 'crash-burst', label: 'Crash Burst', type: 'burst', accent: 0xffb648, description: 'Metallic chaos with impact flare, grit, and a quick directional scatter.', defaults: { intensity: 0.88, size: 0.84, speed: 1.12, spread: 0.88, lifetime: 0.44, sparkCount: 0.82, heat: 0.7 }, palette: [ 0xfff0a4, 0xffa22f, 0x78d6ff ], smokeColor: 0x54575f },
		{ id: 'impact-starburst', label: 'Impact Starburst', type: 'burst', accent: 0xffe26d, description: 'Short, sharp contact burst for punches, bumps, hammers, and ricochets.', defaults: { intensity: 0.82, size: 0.72, speed: 1.28, spread: 0.58, lifetime: 0.3, sparkCount: 0.54, heat: 0.95 }, palette: [ 0xffffff, 0xfff09b, 0xffb247 ], smokeColor: 0x4a4d56 },
		{ id: 'lightning-arc', label: 'Lightning Arc', type: 'lightning', mode: 'arc', accent: 0x7ee3ff, description: 'Forked electric snap between anchor points for shocks, zaps, and chain hits.', defaults: { intensity: 1.0, size: 0.94, speed: 1.1, spread: 0.72, lifetime: 0.52, branching: 0.58, jitter: 0.34 }, palette: [ 0x8fe7ff, 0xbefcff ] },
		{ id: 'electric-surge', label: 'Electric Surge', type: 'lightning', mode: 'surge', accent: 0x61b6ff, description: 'A charged core that spits radial arcs and battlefield energy pulses.', defaults: { intensity: 0.96, size: 1.08, speed: 0.94, spread: 0.68, lifetime: 0.7, branching: 0.74, jitter: 0.46 }, palette: [ 0x7fd2ff, 0xe3fbff ] },
		{ id: 'slime-splash', label: 'Slime Splash', type: 'slime', mode: 'splash', accent: 0x78ff8b, description: 'Goopy weapon impact with chunky droplets, puddle slap, and toxic bounce.', defaults: { intensity: 0.92, size: 0.96, speed: 1.06, spread: 0.78, lifetime: 0.76, blobCount: 0.48, stringiness: 0.44 }, palette: [ 0x86ff6d, 0x33dd86 ] },
		{ id: 'slime-ooze', label: 'Slime Ooze', type: 'slime', mode: 'ooze', accent: 0x4effa3, description: 'A lingering slick with bubbling motion and sticky pulsing surface detail.', defaults: { intensity: 0.8, size: 1.04, speed: 0.72, spread: 0.6, lifetime: 1.0, blobCount: 0.34, stringiness: 0.8 }, palette: [ 0x5dff96, 0x12b86d ] },
		{ id: 'smoke-plume', label: 'Smoke Plume', type: 'plume', mode: 'smoke', accent: 0x8fa3ba, description: 'Heavy grey column for wrecks, engine trouble, and aftermath atmosphere.', defaults: { intensity: 0.84, size: 1.02, speed: 0.7, spread: 0.52, lifetime: 1.12, turbulence: 0.4, rise: 0.82 }, palette: [ 0x8590a1 ] },
		{ id: 'dust-kickup', label: 'Dust Kickup', type: 'plume', mode: 'dust', accent: 0xffbb72, description: 'Loose dirt spray for drifts, landings, and rough-surface battle tracks.', defaults: { intensity: 0.92, size: 1.02, speed: 1.0, spread: 0.82, lifetime: 0.72, turbulence: 0.68, rise: 0.42 }, palette: [ 0xd7a26b ] },
		{ id: 'drift-sparks', label: 'Drift Sparks', type: 'sparks', mode: 'drift', accent: 0xffac32, description: 'Fast ground-skimming embers that sell scrub, scrape, and hard corner attitude.', defaults: { intensity: 0.9, size: 0.84, speed: 1.18, spread: 0.52, lifetime: 0.44, sparkCount: 0.62, heat: 0.64 }, palette: [ 0xffe77a, 0xffb333, 0xff7a18 ] },
		{ id: 'wall-sparks', label: 'Wall Sparks', type: 'sparks', mode: 'wall', accent: 0xffcc54, description: 'Impact fanout for barrier kisses, grinder hits, and metallic ricochet moments.', defaults: { intensity: 0.86, size: 0.94, speed: 1.04, spread: 0.7, lifetime: 0.58, sparkCount: 0.8, heat: 0.7 }, palette: [ 0xfff6a0, 0xffc847, 0xff8225 ] },
		{ id: 'toy-rocket-missile', label: 'Toy Rocket Missile', type: 'projectile', mode: 'toy-rocket', accent: 0xff8c24, description: 'Chunky showroom rocket with a steady smoke trail and soft ploom rings passing through the body.', defaults: { intensity: 0.96, size: 1.0, speed: 0.92, spread: 0.48, lifetime: 0.86, spin: 0.74, trailDensity: 0.88, haloFrequency: 0.72 }, palette: [ 0xffd36a, 0xff9628, 0xff5f1d ], bodyColor: 0x1c1c1f, finColor: 0xff8c24, smokeColor: 0x8d929a },
	].map( ( effect ) => Object.assign( { library: 'vfx' }, effect ) );

	const shaderSharedControls = [
		{ id: 'intensity', label: 'Intensity', min: 0.35, max: 1.8, step: 0.01 },
		{ id: 'scale', label: 'Scale', min: 0.55, max: 1.8, step: 0.01 },
		{ id: 'speed', label: 'Speed', min: 0.35, max: 1.8, step: 0.01 },
		{ id: 'distortion', label: 'Distortion', min: 0.0, max: 1.4, step: 0.01 },
		{ id: 'glow', label: 'Glow', min: 0.0, max: 1.4, step: 0.01 },
	];
	const shaderExtraControls = {
		blast: [
			{ id: 'ringWidth', label: 'Ring Width', min: 0.2, max: 1.3, step: 0.01 },
			{ id: 'emberCount', label: 'Ember Count', min: 0.15, max: 1.35, step: 0.01 },
		],
		energy: [
			{ id: 'pulse', label: 'Pulse', min: 0.2, max: 1.4, step: 0.01 },
			{ id: 'rippleDensity', label: 'Ripple Density', min: 0.15, max: 1.4, step: 0.01 },
		],
		thermal: [
			{ id: 'heat', label: 'Heat', min: 0.15, max: 1.4, step: 0.01 },
			{ id: 'turbulence', label: 'Turbulence', min: 0.0, max: 1.4, step: 0.01 },
		],
		surface: [
			{ id: 'flow', label: 'Flow', min: 0.15, max: 1.4, step: 0.01 },
			{ id: 'viscosity', label: 'Viscosity', min: 0.15, max: 1.4, step: 0.01 },
		],
		frost: [
			{ id: 'crystalGrowth', label: 'Crystal Growth', min: 0.15, max: 1.4, step: 0.01 },
			{ id: 'crackDensity', label: 'Crack Density', min: 0.15, max: 1.4, step: 0.01 },
		],
		shield: [
			{ id: 'shellThickness', label: 'Shell Thickness', min: 0.15, max: 1.35, step: 0.01 },
			{ id: 'impactRipple', label: 'Impact Ripple', min: 0.15, max: 1.35, step: 0.01 },
		],
		smoke: [
			{ id: 'dissolve', label: 'Dissolve', min: 0.15, max: 1.35, step: 0.01 },
			{ id: 'emberSpread', label: 'Ember Spread', min: 0.15, max: 1.35, step: 0.01 },
		],
	};
	const shaderSamples = [
		{ id: 'blast-core', label: 'Blast Core', family: 'blast', accent: 0xff8f32, description: 'Arcade explosion bloom with a bright core, rolling rim light, and ember flicker.', defaults: { intensity: 1.0, scale: 1.0, speed: 1.0, distortion: 0.62, glow: 0.9, ringWidth: 0.56, emberCount: 0.7 }, palette: [ 0xfff0ae, 0xff952c, 0xff5f1f ] },
		{ id: 'bomb-flash', label: 'Bomb Flash', family: 'blast', accent: 0xff5f62, description: 'Tighter bomb detonation with danger-red edges, flash bands, and toybox punch.', defaults: { intensity: 0.94, scale: 0.92, speed: 1.08, distortion: 0.58, glow: 0.82, ringWidth: 0.48, emberCount: 0.6 }, palette: [ 0xffef9a, 0xff5f62, 0xff7e28 ] },
		{ id: 'energy-wave', label: 'Energy Wave', family: 'energy', accent: 0x59d5ff, description: 'Expanding EMP-style radial wave with layered ripples and a bright synthetic edge.', defaults: { intensity: 0.96, scale: 1.0, speed: 1.0, distortion: 0.7, glow: 0.8, pulse: 0.82, rippleDensity: 0.68 }, palette: [ 0x8ae8ff, 0x3ea8ff, 0xc5f8ff ] },
		{ id: 'plasma-orb', label: 'Plasma Orb', family: 'energy', accent: 0x7d8cff, description: 'Charged energy sphere with an unstable core and rippling shell refraction.', defaults: { intensity: 0.9, scale: 0.96, speed: 0.88, distortion: 0.76, glow: 0.96, pulse: 0.7, rippleDensity: 0.76 }, palette: [ 0xe6efff, 0x7d8cff, 0x4af5ff ] },
		{ id: 'lightning-field', label: 'Lightning Field', family: 'energy', accent: 0x84e3ff, description: 'Electric sheet arcs and forked field noise for stun bursts and zap zones.', defaults: { intensity: 1.02, scale: 1.04, speed: 1.18, distortion: 0.92, glow: 0.88, pulse: 0.92, rippleDensity: 0.54 }, palette: [ 0xd9ffff, 0x84e3ff, 0x4d7dff ] },
		{ id: 'burn-scorch', label: 'Burn Scorch', family: 'thermal', accent: 0xff7e3b, description: 'Animated heat-char burn mask with ember veins and cooking hot spots.', defaults: { intensity: 0.88, scale: 1.0, speed: 0.74, distortion: 0.58, glow: 0.52, heat: 0.84, turbulence: 0.54 }, palette: [ 0xffb36b, 0x5a1f11, 0xff6325 ] },
		{ id: 'fireball-trail', label: 'Fireball Trail', family: 'thermal', accent: 0xff8d24, description: 'Projectile flame core with trailing tongues, glow bloom, and exhaust shimmer.', defaults: { intensity: 0.98, scale: 0.94, speed: 1.12, distortion: 0.74, glow: 0.96, heat: 0.92, turbulence: 0.7 }, palette: [ 0xfff0a4, 0xff8d24, 0xff4e1e ] },
		{ id: 'molten-lava', label: 'Molten Lava', family: 'surface', accent: 0xff7f2c, description: 'Flowing magma cells with bright cracks, slow churn, and cooling crust edges.', defaults: { intensity: 1.0, scale: 1.06, speed: 0.62, distortion: 0.46, glow: 0.9, flow: 0.88, viscosity: 0.8 }, palette: [ 0xfff08d, 0xff7f2c, 0x2f1110 ] },
		{ id: 'lava-rim', label: 'Lava Rim', family: 'surface', accent: 0xff5d26, description: 'Molten edge ring for hazard pools and trap borders with a hotter outer lip.', defaults: { intensity: 0.92, scale: 0.92, speed: 0.72, distortion: 0.54, glow: 0.84, flow: 0.76, viscosity: 0.62 }, palette: [ 0xffcf72, 0xff5d26, 0x3a1314 ] },
		{ id: 'heat-haze', label: 'Heat Haze', family: 'thermal', accent: 0xffc271, description: 'Transparent shimmer distortion for exhaust, boost wake, and hot track air.', defaults: { intensity: 0.78, scale: 1.12, speed: 0.84, distortion: 0.96, glow: 0.34, heat: 0.76, turbulence: 0.82 }, palette: [ 0xfff2d6, 0xffc271, 0xff7b38 ] },
		{ id: 'frost-bloom', label: 'Frost Bloom', family: 'frost', accent: 0xa7efff, description: 'Spreading frost blossom with branching crystals and cold bloom highlights.', defaults: { intensity: 0.86, scale: 1.02, speed: 0.72, distortion: 0.36, glow: 0.68, crystalGrowth: 0.9, crackDensity: 0.58 }, palette: [ 0xf4fdff, 0xa7efff, 0x72b8ff ] },
		{ id: 'ice-sheet', label: 'Ice Sheet', family: 'frost', accent: 0x9bd8ff, description: 'Glossy frozen plate with internal cracks, blue depth, and chilled specular bands.', defaults: { intensity: 0.82, scale: 1.08, speed: 0.5, distortion: 0.24, glow: 0.52, crystalGrowth: 0.62, crackDensity: 0.84 }, palette: [ 0xe9fbff, 0x9bd8ff, 0x3e76c8 ] },
		{ id: 'snow-burst', label: 'Snow Burst', family: 'frost', accent: 0xe5f7ff, description: 'Icy powder pop with crystalline breakup, ring bloom, and a soft frozen tail.', defaults: { intensity: 0.9, scale: 0.94, speed: 1.08, distortion: 0.42, glow: 0.6, crystalGrowth: 0.72, crackDensity: 0.44 }, palette: [ 0xffffff, 0xe5f7ff, 0x8bc7ff ] },
		{ id: 'slime-surface', label: 'Slime Surface', family: 'surface', accent: 0x5dff89, description: 'Toxic goo wobble with bubbling highlights, sticky refraction, and gummy depth.', defaults: { intensity: 0.88, scale: 1.02, speed: 0.84, distortion: 0.74, glow: 0.58, flow: 0.7, viscosity: 0.96 }, palette: [ 0xc4ff79, 0x5dff89, 0x0d6f43 ] },
		{ id: 'shield-shell', label: 'Shield Shell', family: 'shield', accent: 0x70f4ff, description: 'Protective bubble shell with chromatic edges, impacts, and soft rotating bands.', defaults: { intensity: 0.92, scale: 0.96, speed: 0.8, distortion: 0.82, glow: 0.92, shellThickness: 0.58, impactRipple: 0.74 }, palette: [ 0xdcffff, 0x70f4ff, 0x4986ff ] },
		{ id: 'smoke-ember', label: 'Smoke Ember', family: 'smoke', accent: 0xff9650, description: 'Dark smoke volume with glowing ember pockets and slow dissolving turbulence.', defaults: { intensity: 0.84, scale: 1.1, speed: 0.56, distortion: 0.38, glow: 0.46, dissolve: 0.8, emberSpread: 0.7 }, palette: [ 0xffbf7f, 0xff9650, 0x1d1d25 ] },
	].map( ( effect ) => Object.assign( { library: 'shader' }, effect ) );

	const vfxStates = new Map();
	const shaderStates = new Map();
	const librarySelections = { vfx: 0, shader: 0 };
	const libraryButtons = new Map();
	let currentStripButtons = new Map();
	let activeLibraryId = 'vfx';
	let dpr = 1;
	let stageWidth = 1;
	let stageHeight = 1;
	let lastFrame = performance.now();
	let copyResetHandle = 0;
	const shaderRenderer = createShaderTestRenderer( {
		canvas: shaderCanvas,
		fallbackElement: shaderFallback,
		fallbackMessageElement: shaderFallbackMessage,
	} );

	const libraries = {
		vfx: {
			id: 'vfx',
			metaLabel: '15 live effects',
			rendererLabel: 'Canvas FX',
			items: vfxEffects,
			states: vfxStates,
			createState: createEffectState,
			controlsFor: ( effect ) => vfxSharedControls.concat( vfxExtraControls[ effect.type ] || [] ),
			replay: ( effect, state ) => triggerEffect( effect, state ),
		},
		shader: {
			id: 'shader',
			metaLabel: '16 live shaders',
			rendererLabel: 'WebGL Shader',
			items: shaderSamples,
			states: shaderStates,
			createState: createShaderState,
			controlsFor: ( effect ) => shaderSharedControls.concat( shaderExtraControls[ effect.family ] || [] ),
			replay: ( effect, state ) => resetShaderState( state ),
		},
	};

	function clamp( value, min, max ) {

		return Math.min( max, Math.max( min, value ) );

	}

	function rand( min, max ) {

		return min + Math.random() * ( max - min );

	}

	function randSigned( magnitude ) {

		return ( Math.random() - 0.5 ) * 2 * magnitude;

	}

	function lerp( start, end, alpha ) {

		return start + ( end - start ) * alpha;

	}

	function formatValue( value ) {

		return Number( value ).toFixed( 2 );

	}

	function pick( values ) {

		return values[ Math.floor( Math.random() * values.length ) ];

	}

	function getActiveLibrary() {

		return libraries[ activeLibraryId ];

	}

	function controlsFor( effect ) {

		return libraries[ effect.library ].controlsFor( effect );

	}

	function colorToRgb( color ) {

		return {
			r: ( color >> 16 ) & 255,
			g: ( color >> 8 ) & 255,
			b: color & 255,
		};

	}

	function rgba( color, alpha ) {

		const rgb = colorToRgb( color );
		return `rgba(${ rgb.r }, ${ rgb.g }, ${ rgb.b }, ${ alpha })`;

	}

	function normalizedIndex( index, length = getActiveLibrary().items.length ) {

		return ( index + length ) % length;

	}

	function getActiveEffect() {

		const library = getActiveLibrary();
		return library.items[ librarySelections[ activeLibraryId ] ];

	}

	function getState( effect ) {

		return libraries[ effect.library ].states.get( effect.id );

	}

	function nextAutoplayDelay( effect ) {

		switch ( effect.type ) {
			case 'burst': return 1.25 + Math.random() * 0.8;
			case 'lightning': return 0.92 + Math.random() * 0.6;
			case 'slime': return effect.mode === 'ooze' ? 1.45 + Math.random() * 0.75 : 1.55 + Math.random() * 0.95;
			case 'plume': return 1.1 + Math.random() * 0.5;
			case 'projectile': return 1.8 + Math.random() * 0.6;
			case 'sparks': return effect.mode === 'wall' ? 0.95 + Math.random() * 0.55 : 1.2 + Math.random() * 0.55;
			default: return 1.3;
		}

	}

	function createEffectState( effect ) {

		return {
			config: Object.assign( {}, effect.defaults ),
			autoTimer: 0,
			nextAuto: nextAutoplayDelay( effect ),
			particles: [],
			smoke: [],
			arcs: [],
			halos: [],
			puffs: [],
			droplets: [],
			sparks: [],
			burstAge: 99,
			flightAge: 0,
			refreshTimer: 0,
			emitAccumulator: 0,
			haloAccumulator: 0,
			projectilePose: null,
		};

	}

	function createShaderState( effect ) {

		return {
			config: Object.assign( {}, effect.defaults ),
			startTime: performance.now() * 0.001,
			seed: Math.random() * 1000,
		};

	}

	function resetShaderState( state ) {

		state.startTime = performance.now() * 0.001;
		state.seed = Math.random() * 1000;

	}

	function resetTransientState( state ) {

		state.particles = [];
		state.smoke = [];
		state.arcs = [];
		state.halos = [];
		state.puffs = [];
		state.droplets = [];
		state.sparks = [];
		state.flightAge = 0;
		state.refreshTimer = 0;
		state.emitAccumulator = 0;
		state.haloAccumulator = 0;
		state.projectilePose = null;

	}

	function triggerBurst( effect, state ) {

		resetTransientState( state );
		state.burstAge = 0;

		const glowCount = Math.round( 18 + state.config.intensity * 10 + state.config.sparkCount * 10 );
		const smokeCount = Math.round( 10 + state.config.intensity * 7 );

		for ( let index = 0; index < glowCount; index ++ ) {

			const life = state.config.lifetime * rand( 0.42, 0.95 );
			state.particles.push( {
				x: randSigned( 10 ),
				y: rand( 18, 42 ),
				vx: randSigned( state.config.spread * state.config.speed * 44 ),
				vy: rand( 42, 96 ) * state.config.speed,
				size: state.config.size * rand( 5, 12 ),
				life,
				maxLife: life,
				color: pick( effect.palette ),
			} );

		}

		for ( let index = 0; index < smokeCount; index ++ ) {

			const life = state.config.lifetime * rand( 0.85, 1.55 );
			state.smoke.push( {
				x: randSigned( 14 ),
				y: rand( 6, 18 ),
				vx: randSigned( state.config.spread * state.config.speed * 14 ),
				vy: rand( 12, 28 ) * state.config.speed,
				size: state.config.size * rand( 12, 22 ),
				life,
				maxLife: life,
				color: effect.smokeColor,
			} );

		}

	}

	function buildLightningArc( effect, state, arcIndex ) {

		const points = [];
		const pointCount = 9;
		const size = state.config.size * 26;
		const jitter = state.config.jitter * state.config.spread * 22;
		let start;
		let end;

		if ( effect.mode === 'surge' ) {

			const count = Math.max( 2, Math.round( state.config.branching * 4 ) + 2 );
			const angle = ( arcIndex / count ) * TAU + rand( - 0.25, 0.25 );
			start = { x: 0, y: 30 };
			end = { x: Math.cos( angle ) * size * 1.35, y: 20 + Math.sin( angle ) * 8 + rand( 6, 30 ) };

		} else {

			const side = arcIndex % 2 === 0 ? 1 : - 1;
			const lane = Math.floor( arcIndex / 2 );
			start = { x: - size * 1.45 * side, y: 20 + lane * 6 };
			end = { x: size * 1.45 * side, y: 52 - lane * 4 };

		}

		for ( let index = 0; index < pointCount; index ++ ) {

			const alpha = index / ( pointCount - 1 );
			const point = {
				x: lerp( start.x, end.x, alpha ),
				y: lerp( start.y, end.y, alpha ),
			};

			if ( index !== 0 && index !== pointCount - 1 ) {

				point.x += randSigned( jitter * ( 0.65 + arcIndex * 0.08 ) );
				point.y += randSigned( jitter * 0.68 );

			}

			points.push( point );

		}

		return points;

	}

	function triggerLightning( effect, state ) {

		resetTransientState( state );
		state.burstAge = state.config.lifetime;
		const count = effect.mode === 'surge' ? 2 + Math.round( state.config.branching * 4 ) : 2 + Math.round( state.config.branching * 3 );
		for ( let index = 0; index < count; index ++ ) {

			state.arcs.push( buildLightningArc( effect, state, index ) );

		}

	}

	function triggerSlime( effect, state ) {

		resetTransientState( state );
		state.burstAge = 1;
		const blobCount = Math.round( 7 + state.config.blobCount * 12 * state.config.intensity );
		const liftMultiplier = effect.mode === 'ooze' ? 0.7 : 1.2;

		for ( let index = 0; index < blobCount; index ++ ) {

			const life = state.config.lifetime * rand( 0.65, 1.15 );
			state.droplets.push( {
				x: randSigned( 14 ),
				y: rand( 8, 18 ),
				vx: randSigned( state.config.spread * 24 ),
				vy: rand( 28, 58 ) * state.config.speed * liftMultiplier,
				size: state.config.size * rand( 6, 12 ),
				life,
				maxLife: life,
				color: pick( effect.palette ),
			} );

		}

	}

	function emitPlume( effect, state, burstCount ) {

		for ( let index = 0; index < burstCount; index ++ ) {

			const oscillation = Math.sin( performance.now() * 0.0011 * ( effect.mode === 'dust' ? 2.4 : 1.45 ) ) * 20;
			const baseX = effect.mode === 'dust' ? oscillation : randSigned( 12 );
			const life = state.config.lifetime * rand( 0.7, 1.55 );
			const puff = {
				x: baseX + randSigned( 10 ),
				y: 8,
				vx: randSigned( state.config.turbulence * state.config.spread * 18 ),
				vy: state.config.rise * rand( 8, 28 ) * state.config.speed,
				size: state.config.size * rand( 10, 20 ),
				life,
				maxLife: life,
				color: effect.palette[ 0 ],
			};

			if ( effect.mode === 'dust' ) {

				puff.vx += 16 * state.config.speed;
				puff.vy *= 0.56;

			}

			state.puffs.push( puff );

		}

	}

	function emitSparks( effect, state, burstCount ) {

		for ( let index = 0; index < burstCount; index ++ ) {

			const life = state.config.lifetime * rand( 0.28, 0.78 );
			const spark = {
				x: effect.mode === 'wall' ? - 70 : Math.sin( performance.now() * 0.002 ) * 30,
				y: effect.mode === 'wall' ? rand( 18, 42 ) : 8,
				vx: effect.mode === 'wall' ? rand( 24, 58 ) * state.config.speed : - rand( 12, 34 ) * state.config.speed,
				vy: rand( 10, 36 ) * state.config.speed,
				size: state.config.size * rand( 2.2, 6 ),
				life,
				maxLife: life,
				color: pick( effect.palette ),
			};
			spark.vx += randSigned( state.config.spread * ( effect.mode === 'wall' ? 18 : 12 ) );
			state.sparks.push( spark );

		}

	}

	function buildProjectilePose( state ) {

		const cruise = state.flightAge * ( 0.85 + state.config.speed * 0.95 );
		const x = Math.sin( cruise * 0.92 ) * ( 4 + state.config.spread * 8 );
		const y = 30 + Math.sin( cruise * 1.7 ) * ( 2.2 + state.config.speed * 1.6 ) + Math.cos( cruise * 0.66 ) * 1.3;
		const angle = 0.74 + Math.sin( cruise * 0.84 ) * 0.055 + Math.sin( cruise * 1.9 ) * 0.02;
		const roll = state.flightAge * ( 1.5 + state.config.spin * 4.2 ) + Math.sin( cruise * 1.25 ) * 0.24;
		const bodyLength = state.config.size * 46;
		const bodyRadius = state.config.size * 11;
		const axisX = Math.cos( angle );
		const axisY = Math.sin( angle );
		const tailOffset = bodyLength * 0.45;
		const noseOffset = bodyLength * 0.4;

		return {
			x,
			y,
			angle,
			roll,
			bodyLength,
			bodyRadius,
			axisX,
			axisY,
			nozzleX: x - axisX * ( tailOffset + 2.8 ),
			nozzleY: y - axisY * ( tailOffset + 2.8 ),
			noseX: x + axisX * ( noseOffset + 5.2 ),
			noseY: y + axisY * ( noseOffset + 5.2 ),
		};

	}

	function emitProjectileSmoke( effect, state, burstCount ) {

		const pose = state.projectilePose || buildProjectilePose( state );
		const exhaustX = - pose.axisX;
		const exhaustY = - pose.axisY;

		for ( let index = 0; index < burstCount; index ++ ) {

			const life = state.config.lifetime * rand( 0.95, 1.7 );
			state.smoke.push( {
				x: pose.nozzleX + randSigned( 1.2 ),
				y: pose.nozzleY + randSigned( 1.2 ),
				vx: exhaustX * rand( 14, 28 ) * state.config.speed + randSigned( state.config.spread * 8 ),
				vy: exhaustY * rand( 14, 24 ) * state.config.speed + rand( 3, 10 ) + randSigned( state.config.spread * 5 ),
				size: state.config.size * rand( 6.5, 12.5 ),
				life,
				maxLife: life,
				color: effect.smokeColor,
			} );

		}

	}

	function emitProjectileHalo( effect, state, burstCount ) {

		const pose = state.projectilePose || buildProjectilePose( state );

		for ( let index = 0; index < burstCount; index ++ ) {

			const life = state.config.lifetime * rand( 0.55, 0.95 );
			state.halos.push( {
				offset: pose.bodyLength * rand( 0.22, 0.42 ),
				radius: state.config.size * rand( 7.5, 10.5 ),
				depth: state.config.size * rand( 2.2, 4.1 ),
				thickness: rand( 1.4, 2.4 ),
				drift: rand( 18, 30 ) * state.config.speed,
				wobble: rand( 0.8, 1.35 ),
				twist: rand( 0, TAU ),
				life,
				maxLife: life,
				color: pick( effect.palette ),
			} );

		}

	}

	function triggerProjectile( effect, state ) {

		resetTransientState( state );
		state.projectilePose = buildProjectilePose( state );
		emitProjectileSmoke( effect, state, Math.max( 3, Math.round( 2 + state.config.trailDensity * 2 ) ) );
		emitProjectileHalo( effect, state, 2 );

	}

	function triggerEffect( effect, state ) {

		state.autoTimer = 0;
		state.nextAuto = nextAutoplayDelay( effect );

		switch ( effect.type ) {
			case 'burst': triggerBurst( effect, state ); break;
			case 'lightning': triggerLightning( effect, state ); break;
			case 'slime': triggerSlime( effect, state ); break;
			case 'plume':
				resetTransientState( state );
				emitPlume( effect, state, effect.mode === 'dust' ? 12 : 9 );
				break;
			case 'projectile':
				triggerProjectile( effect, state );
				break;
			case 'sparks':
				resetTransientState( state );
				emitSparks( effect, state, Math.round( 8 + state.config.sparkCount * 9 ) );
				break;
		}

	}

	function updateBurstParticles( state, dt ) {

		state.particles = state.particles.filter( ( particle ) => {

			particle.life -= dt;
			if ( particle.life <= 0 ) return false;
			particle.vy -= 58 * dt;
			particle.vx *= 1 - 1.65 * dt;
			particle.vy *= 1 - 1.3 * dt;
			particle.x += particle.vx * dt;
			particle.y += particle.vy * dt;
			return true;

		} );

		state.smoke = state.smoke.filter( ( puff ) => {

			puff.life -= dt;
			if ( puff.life <= 0 ) return false;
			puff.vy += 10 * dt;
			puff.vx *= 1 - 0.7 * dt;
			puff.vy *= 1 - 0.4 * dt;
			puff.x += puff.vx * dt;
			puff.y += puff.vy * dt;
			return true;

		} );

	}

	function updateDroplets( state, dt, gravity ) {

		state.droplets = state.droplets.filter( ( droplet ) => {

			droplet.life -= dt;
			if ( droplet.life <= 0 ) return false;
			droplet.vy -= gravity * dt;
			droplet.vx *= 1 - 1.45 * dt;
			droplet.vy *= 1 - 1.25 * dt;
			droplet.x += droplet.vx * dt;
			droplet.y += droplet.vy * dt;
			return true;

		} );

	}

	function updatePuffs( state, dt, dustMode ) {

		state.puffs = state.puffs.filter( ( puff ) => {

			puff.life -= dt;
			if ( puff.life <= 0 ) return false;
			puff.vx += Math.sin( puff.y * 0.07 ) * state.config.turbulence * 0.9;
			puff.vy *= 1 - 0.32 * dt;
			puff.x += puff.vx * dt;
			puff.y += puff.vy * dt;
			if ( dustMode ) puff.vy *= 0.985;
			return true;

		} );

	}

	function updateSparks( state, dt, wallMode ) {

		state.sparks = state.sparks.filter( ( spark ) => {

			spark.life -= dt;
			if ( spark.life <= 0 ) return false;
			spark.vy -= ( wallMode ? 54 : 34 ) * dt;
			spark.vx *= 1 - 2.15 * dt;
			spark.vy *= 1 - 1.45 * dt;
			spark.x += spark.vx * dt;
			spark.y += spark.vy * dt;
			return true;

		} );

	}

	function updateProjectile( effect, state, dt ) {

		state.flightAge += dt;
		state.projectilePose = buildProjectilePose( state );

		state.emitAccumulator += dt * state.config.intensity * ( 2.8 + state.config.trailDensity * 9.2 );
		while ( state.emitAccumulator >= 1 ) {

			state.emitAccumulator -= 1;
			emitProjectileSmoke( effect, state, 1 );

		}

		state.haloAccumulator += dt * state.config.intensity * ( 0.8 + state.config.haloFrequency * 2.8 );
		while ( state.haloAccumulator >= 1 ) {

			state.haloAccumulator -= 1;
			emitProjectileHalo( effect, state, 1 );

		}

		state.smoke = state.smoke.filter( ( puff ) => {

			puff.life -= dt;
			if ( puff.life <= 0 ) return false;
			puff.vy += 8 * dt;
			puff.vx *= 1 - 0.42 * dt;
			puff.vy *= 1 - 0.18 * dt;
			puff.x += puff.vx * dt;
			puff.y += puff.vy * dt;
			puff.size += dt * ( 2 + state.config.trailDensity * 2.8 );
			return true;

		} );

		state.halos = state.halos.filter( ( halo ) => {

			halo.life -= dt;
			if ( halo.life <= 0 ) return false;
			halo.offset -= halo.drift * dt;
			halo.radius += dt * ( 4 + state.config.spread * 6 );
			halo.depth = Math.max( 1.6, halo.depth + Math.sin( state.flightAge * halo.wobble + halo.twist ) * dt * 0.35 );
			return halo.offset >= - state.projectilePose.bodyLength * 0.82;

		} );

	}

	function updateActiveState( dt ) {

		const effect = getActiveEffect();
		const state = getState( effect );
		state.autoTimer += dt;

		if ( state.autoTimer >= state.nextAuto ) {

			triggerEffect( effect, state );

		}

		switch ( effect.type ) {
			case 'burst':
				state.burstAge += dt * state.config.speed / Math.max( 0.1, state.config.lifetime );
				updateBurstParticles( state, dt );
				break;
			case 'lightning':
				state.burstAge -= dt * state.config.speed;
				state.refreshTimer += dt * state.config.speed;
				if ( state.burstAge > 0 && state.refreshTimer >= 0.05 ) {

					state.refreshTimer = 0;
					state.arcs = state.arcs.map( ( arc, index ) => buildLightningArc( effect, state, index ) );

				}
				break;
			case 'slime':
				state.burstAge = Math.max( 0, state.burstAge - dt * ( 0.88 / Math.max( 0.1, state.config.lifetime ) ) );
				updateDroplets( state, dt, 34 );
				break;
			case 'plume':
				state.emitAccumulator += dt * state.config.intensity * ( effect.mode === 'dust' ? 9.5 : 6.8 );
				while ( state.emitAccumulator >= 1 ) {

					state.emitAccumulator -= 1;
					emitPlume( effect, state, 1 );

				}
				updatePuffs( state, dt, effect.mode === 'dust' );
				break;
			case 'projectile':
				updateProjectile( effect, state, dt );
				break;
			case 'sparks':
				state.emitAccumulator += dt * state.config.intensity * ( effect.mode === 'drift' ? 11.5 : 6.8 );
				while ( state.emitAccumulator >= 1 ) {

					state.emitAccumulator -= 1;
					emitSparks( effect, state, 1 );

				}
				updateSparks( state, dt, effect.mode === 'wall' );
				break;
		}

	}

	function drawGlow( x, y, radius, color, alpha ) {

		const safeRadius = Math.max( 0.1, radius );
		const gradient = context.createRadialGradient( x, y, 0, x, y, safeRadius );
		gradient.addColorStop( 0, rgba( color, alpha ) );
		gradient.addColorStop( 1, rgba( color, 0 ) );
		context.fillStyle = gradient;
		context.beginPath();
		context.arc( x, y, safeRadius, 0, TAU );
		context.fill();

	}

	function traceCapsulePath( startX, endX, radius ) {

		context.beginPath();
		context.moveTo( startX, - radius );
		context.lineTo( endX, - radius );
		context.arc( endX, 0, radius, - Math.PI * 0.5, Math.PI * 0.5 );
		context.lineTo( startX, radius );
		context.arc( startX, 0, radius, Math.PI * 0.5, Math.PI * 1.5 );
		context.closePath();

	}

	function drawProjectileHaloSegment( x, y, radiusX, radiusY, rotation, startAngle, endAngle, color, alpha, lineWidth ) {

		context.strokeStyle = rgba( color, alpha );
		context.lineWidth = lineWidth;
		context.beginPath();
		context.ellipse( x, y, radiusX, radiusY, rotation, startAngle, endAngle );
		context.stroke();

	}

	function drawStageBackdrop( effect, time ) {

		const floorY = stageHeight * 0.75;
		const backdrop = context.createLinearGradient( 0, 0, 0, stageHeight );
		backdrop.addColorStop( 0, rgba( effect.accent, 0.18 ) );
		backdrop.addColorStop( 0.42, 'rgba(8, 12, 18, 0.10)' );
		backdrop.addColorStop( 1, 'rgba(2, 4, 7, 0)' );
		context.fillStyle = backdrop;
		context.fillRect( 0, 0, stageWidth, stageHeight );

		drawGlow( stageWidth * 0.5, stageHeight * 0.14, stageWidth * 0.34, effect.accent, 0.12 );
		drawGlow( stageWidth * 0.5, floorY, stageWidth * 0.26, effect.accent, 0.11 + Math.sin( time * 1.6 ) * 0.025 );

		const horizon = context.createLinearGradient( 0, 0, stageWidth, 0 );
		horizon.addColorStop( 0, 'rgba(255, 255, 255, 0)' );
		horizon.addColorStop( 0.5, rgba( effect.accent, 0.22 ) );
		horizon.addColorStop( 1, 'rgba(255, 255, 255, 0)' );
		context.strokeStyle = horizon;
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo( stageWidth * 0.14, floorY + 26 );
		context.lineTo( stageWidth * 0.86, floorY + 26 );
		context.stroke();

		context.strokeStyle = rgba( effect.accent, 0.24 );
		context.lineWidth = 3;
		context.beginPath();
		context.ellipse( stageWidth * 0.5, floorY, stageWidth * 0.18, stageHeight * 0.045, 0, 0, TAU );
		context.stroke();

		context.fillStyle = 'rgba(0, 0, 0, 0.3)';
		context.beginPath();
		context.ellipse( stageWidth * 0.5, floorY + 18, stageWidth * 0.19, stageHeight * 0.055, 0, 0, TAU );
		context.fill();

	}

	function drawBurst( effect, state ) {

		const scale = Math.min( stageWidth, stageHeight ) / 92;
		const floorY = stageHeight * 0.75;
		const centerX = stageWidth * 0.5;
		const progress = clamp( state.burstAge, 0, 1 );
		const ringRadius = scale * lerp( 12, 46 * state.config.spread, progress ) * state.config.size;
		const flashAlpha = Math.max( 0, ( 1 - progress * 1.08 ) * 0.72 * state.config.intensity );
		const coreRadius = scale * lerp( 11, 28, progress ) * state.config.size;

		if ( progress < 1 ) {

			context.lineWidth = 4;
			context.strokeStyle = rgba( effect.accent, ( 1 - progress ) * 0.55 );
			context.beginPath();
			context.arc( centerX, floorY, ringRadius, 0, TAU );
			context.stroke();
			drawGlow( centerX, floorY - scale * 14, coreRadius * 1.75, pick( effect.palette ), flashAlpha );

		}

		for ( const puff of state.smoke ) {

			const alpha = puff.life / puff.maxLife;
			drawGlow(
				centerX + puff.x * scale,
				floorY - puff.y * scale,
				puff.size * scale * ( 0.8 + ( 1 - alpha ) * 1.8 ),
				puff.color,
				alpha * 0.26
			);

		}

		for ( const particle of state.particles ) {

			const alpha = particle.life / particle.maxLife;
			drawGlow( centerX + particle.x * scale, floorY - particle.y * scale, particle.size * scale, particle.color, alpha * alpha );

		}

	}

	function drawLightning( effect, state, time ) {

		const scale = Math.min( stageWidth, stageHeight ) / 96;
		const floorY = stageHeight * 0.75;
		const centerX = stageWidth * 0.5;
		const visibleAlpha = clamp( state.burstAge / Math.max( 0.05, state.config.lifetime ), 0, 1 );

		drawGlow( centerX, floorY - scale * 18, scale * 26 * state.config.size, effect.accent, visibleAlpha * 0.48 );

		for ( const arc of state.arcs ) {

			context.lineJoin = 'round';
			context.lineCap = 'round';
			context.strokeStyle = rgba( effect.palette[ 0 ], visibleAlpha * 0.24 );
			context.lineWidth = 10 * scale;
			context.beginPath();
			for ( let index = 0; index < arc.length; index ++ ) {

				const point = arc[ index ];
				const x = centerX + point.x * scale;
				const y = floorY - point.y * scale;
				if ( index === 0 ) context.moveTo( x, y );
				else context.lineTo( x, y );

			}
			context.stroke();

			context.strokeStyle = rgba( effect.palette[ 1 ], visibleAlpha * ( 0.72 + Math.sin( time * 18 ) * 0.08 ) );
			context.lineWidth = 2.6 * scale;
			context.stroke();

		}

	}

	function drawSlime( effect, state, time ) {

		const scale = Math.min( stageWidth, stageHeight ) / 94;
		const floorY = stageHeight * 0.75;
		const centerX = stageWidth * 0.5;
		const wobble = 1 + Math.sin( time * state.config.speed * 2.1 ) * 0.06 * state.config.stringiness;
		const puddleWidth = scale * 30 * state.config.size * ( 0.85 + state.config.spread * 0.42 + state.burstAge * 0.28 ) * wobble;
		const puddleHeight = scale * 11 * state.config.size * ( 0.85 + state.config.spread * 0.34 + state.burstAge * 0.2 ) / wobble;

		context.fillStyle = rgba( effect.palette[ 1 ], 0.42 + state.config.intensity * 0.18 );
		context.beginPath();
		context.ellipse( centerX, floorY, puddleWidth, puddleHeight, 0, 0, TAU );
		context.fill();
		drawGlow( centerX, floorY - scale * 16, scale * 24 * state.config.size, effect.palette[ 0 ], 0.26 );

		for ( const droplet of state.droplets ) {

			const alpha = droplet.life / droplet.maxLife;
			drawGlow(
				centerX + droplet.x * scale,
				floorY - droplet.y * scale,
				droplet.size * scale * ( 0.9 + ( 1 - alpha ) * state.config.stringiness ),
				droplet.color,
				alpha * 0.85
			);

		}

	}

	function drawPlume( effect, state ) {

		const scale = Math.min( stageWidth, stageHeight ) / 90;
		const floorY = stageHeight * 0.75;
		const centerX = stageWidth * 0.5;

		for ( const puff of state.puffs ) {

			const alpha = puff.life / puff.maxLife;
			drawGlow(
				centerX + puff.x * scale,
				floorY - puff.y * scale,
				puff.size * scale * ( 0.88 + ( 1 - alpha ) * 1.95 ),
				puff.color,
				effect.mode === 'dust' ? alpha * 0.36 : alpha * 0.24
			);

		}

	}

	function drawSparks( effect, state ) {

		const scale = Math.min( stageWidth, stageHeight ) / 94;
		const floorY = stageHeight * 0.75;
		const centerX = stageWidth * 0.5;

		if ( effect.mode === 'wall' ) {

			context.fillStyle = 'rgba(22, 25, 31, 0.76)';
			context.fillRect( centerX - 86 * scale, floorY - 76 * scale, 12 * scale, 108 * scale );

		}

		for ( const spark of state.sparks ) {

			const alpha = spark.life / spark.maxLife;
			const x = centerX + spark.x * scale;
			const y = floorY - spark.y * scale;
			const trailX = x - spark.vx * 0.08 * scale;
			const trailY = y + spark.vy * 0.035 * scale;
			context.strokeStyle = rgba( spark.color, alpha * alpha );
			context.lineWidth = Math.max( 1.6, spark.size * scale * 0.55 );
			context.beginPath();
			context.moveTo( x, y );
			context.lineTo( trailX, trailY );
			context.stroke();
			drawGlow( x, y, spark.size * scale * 2.2, spark.color, alpha * 0.58 );

		}

	}

	function drawProjectile( effect, state ) {

		const scale = Math.min( stageWidth, stageHeight ) / 96;
		const floorY = stageHeight * 0.75;
		const centerX = stageWidth * 0.5;
		const pose = state.projectilePose || buildProjectilePose( state );
		const rocketX = centerX + pose.x * scale;
		const rocketY = floorY - pose.y * scale;
		const screenRotation = - pose.angle;
		const bodyLength = pose.bodyLength * scale;
		const bodyRadius = pose.bodyRadius * scale;
		const nozzleX = centerX + pose.nozzleX * scale;
		const nozzleY = floorY - pose.nozzleY * scale;
		const rollWave = Math.sin( pose.roll );
		const rollDepth = Math.cos( pose.roll );
		const bodyStart = - bodyLength * 0.43;
		const bodyEnd = bodyLength * 0.24;
		const noseBase = bodyEnd - bodyRadius * 0.08;
		const noseTip = bodyLength * 0.48;
		const finJoinX = bodyStart + bodyRadius * 0.58;
		const backFinHeight = bodyRadius * ( 0.72 + Math.max( 0, - rollWave ) * 0.45 );
		const frontFinHeight = bodyRadius * ( 1.02 + Math.max( 0, rollWave ) * 0.36 );
		const bodySquash = bodyRadius * ( 0.94 + rollDepth * 0.06 );

		context.fillStyle = 'rgba(0, 0, 0, 0.24)';
		context.beginPath();
		context.ellipse(
			rocketX - bodyLength * 0.04,
			floorY + 12 + pose.y * scale * 0.06,
			bodyLength * 0.46,
			bodyRadius * 0.82,
			- 0.18,
			0,
			TAU
		);
		context.fill();

		for ( const puff of state.smoke ) {

			const alpha = puff.life / puff.maxLife;
			const puffX = centerX + puff.x * scale;
			const puffY = floorY - puff.y * scale;
			drawGlow(
				puffX,
				puffY,
				puff.size * scale * ( 0.82 + ( 1 - alpha ) * 1.6 ),
				effect.smokeColor,
				alpha * 0.22
			);

			if ( alpha > 0.72 ) {

				drawGlow( puffX, puffY, puff.size * scale * 0.68, effect.palette[ 1 ], alpha * 0.08 );

			}

		}

		for ( const halo of state.halos ) {

			const alpha = halo.life / halo.maxLife;
			const haloX = centerX + ( pose.x + pose.axisX * halo.offset ) * scale;
			const haloY = floorY - ( pose.y + pose.axisY * halo.offset ) * scale;
			const pulse = 1 + Math.sin( pose.roll + halo.twist ) * 0.08;
			const radiusX = Math.max( 2, halo.depth * scale * pulse );
			const radiusY = Math.max( radiusX + 1.5, halo.radius * scale * ( 0.92 + ( 1 - alpha ) * 0.45 ) );
			drawProjectileHaloSegment(
				haloX,
				haloY,
				radiusX,
				radiusY,
				screenRotation,
				Math.PI * 0.5,
				Math.PI * 1.5,
				halo.color,
				alpha * 0.22,
				Math.max( 1.4, halo.thickness * scale )
			);

		}

		context.save();
		context.translate( rocketX, rocketY );
		context.rotate( screenRotation );

		context.fillStyle = rgba( effect.finColor, 0.3 + Math.max( 0, - rollWave ) * 0.18 );
		context.beginPath();
		context.moveTo( finJoinX, - bodyRadius * 0.16 );
		context.lineTo( bodyStart - bodyRadius * 1.08, - backFinHeight );
		context.lineTo( bodyStart - bodyRadius * 0.08, - bodyRadius * 0.02 );
		context.closePath();
		context.fill();

		context.fillStyle = rgba( effect.finColor, 0.24 + Math.max( 0, rollDepth ) * 0.12 );
		context.beginPath();
		context.moveTo( finJoinX, bodyRadius * 0.05 );
		context.lineTo( bodyStart - bodyRadius * 0.88, bodyRadius * 0.56 );
		context.lineTo( bodyStart - bodyRadius * 0.08, bodyRadius * 0.22 );
		context.closePath();
		context.fill();

		const bodyGradient = context.createLinearGradient( bodyStart, - bodySquash, bodyEnd, bodySquash );
		bodyGradient.addColorStop( 0, 'rgba(12, 12, 16, 1)' );
		bodyGradient.addColorStop( 0.24, rgba( effect.bodyColor, 1 ) );
		bodyGradient.addColorStop( 0.52, 'rgba(88, 88, 92, 1)' );
		bodyGradient.addColorStop( 1, 'rgba(18, 18, 22, 1)' );
		traceCapsulePath( bodyStart, bodyEnd, bodySquash );
		context.fillStyle = bodyGradient;
		context.fill();
		context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
		context.lineWidth = 1.5;
		context.stroke();

		const noseGradient = context.createLinearGradient( noseBase, 0, noseTip, 0 );
		noseGradient.addColorStop( 0, rgba( effect.finColor, 0.92 ) );
		noseGradient.addColorStop( 0.6, rgba( effect.palette[ 1 ], 0.98 ) );
		noseGradient.addColorStop( 1, rgba( effect.palette[ 2 ], 1 ) );
		context.fillStyle = noseGradient;
		context.beginPath();
		context.moveTo( noseBase, - bodySquash * 0.96 );
		context.quadraticCurveTo( noseTip + bodyRadius * 0.14, 0, noseBase, bodySquash * 0.96 );
		context.closePath();
		context.fill();

		context.fillStyle = 'rgba(222, 226, 232, 0.78)';
		context.beginPath();
		context.ellipse( bodyStart + bodyLength * 0.12, - bodySquash * 0.28, bodyRadius * 0.15, bodyRadius * 0.44, - 0.3, 0, TAU );
		context.fill();

		context.strokeStyle = 'rgba(255, 255, 255, 0.36)';
		context.lineWidth = Math.max( 1.1, bodyRadius * 0.13 );
		context.beginPath();
		context.moveTo( bodyStart + bodyLength * 0.1, - bodySquash * 0.44 );
		context.quadraticCurveTo( bodyStart + bodyLength * 0.28, - bodySquash * 0.86, bodyEnd - bodyRadius * 0.34, - bodySquash * 0.18 );
		context.stroke();

		context.fillStyle = rgba( effect.finColor, 0.96 );
		context.beginPath();
		context.moveTo( finJoinX, bodyRadius * 0.16 );
		context.lineTo( bodyStart - bodyRadius * 1.22, frontFinHeight );
		context.lineTo( bodyStart - bodyRadius * 0.02, bodyRadius * 0.3 );
		context.closePath();
		context.fill();

		context.fillStyle = rgba( effect.finColor, 0.76 );
		context.beginPath();
		context.moveTo( finJoinX, - bodyRadius * 0.12 );
		context.lineTo( bodyStart - bodyRadius * 1.02, - bodyRadius * ( 0.62 + Math.max( 0, rollWave ) * 0.16 ) );
		context.lineTo( bodyStart - bodyRadius * 0.1, - bodyRadius * 0.02 );
		context.closePath();
		context.fill();

		context.fillStyle = 'rgba(18, 18, 22, 0.94)';
		context.beginPath();
		context.ellipse( bodyStart - bodyRadius * 0.04, 0, bodyRadius * 0.36, bodyRadius * 0.56, 0, 0, TAU );
		context.fill();
		context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
		context.lineWidth = 1.2;
		context.stroke();

		context.restore();

		for ( const halo of state.halos ) {

			const alpha = halo.life / halo.maxLife;
			const haloX = centerX + ( pose.x + pose.axisX * halo.offset ) * scale;
			const haloY = floorY - ( pose.y + pose.axisY * halo.offset ) * scale;
			const pulse = 1 + Math.sin( pose.roll + halo.twist ) * 0.08;
			const radiusX = Math.max( 2, halo.depth * scale * pulse );
			const radiusY = Math.max( radiusX + 1.5, halo.radius * scale * ( 0.92 + ( 1 - alpha ) * 0.45 ) );
			drawProjectileHaloSegment(
				haloX,
				haloY,
				radiusX,
				radiusY,
				screenRotation,
				- Math.PI * 0.5,
				Math.PI * 0.5,
				halo.color,
				alpha * 0.42,
				Math.max( 1.4, halo.thickness * scale )
			);
			drawGlow( haloX, haloY, radiusY * 1.05, halo.color, alpha * 0.04 );

		}

		drawGlow( nozzleX, nozzleY, bodyRadius * 1.05, effect.palette[ 1 ], 0.42 );
		drawGlow( nozzleX, nozzleY, bodyRadius * 0.46, effect.palette[ 0 ], 0.55 );
		drawGlow( centerX + pose.noseX * scale, floorY - pose.noseY * scale, bodyRadius * 0.72, effect.palette[ 0 ], 0.12 );

	}

	function drawActiveEffect( now ) {

		const effect = getActiveEffect();
		const state = getState( effect );
		drawStageBackdrop( effect, now );

		switch ( effect.type ) {
			case 'burst': drawBurst( effect, state ); break;
			case 'lightning': drawLightning( effect, state, now ); break;
			case 'slime': drawSlime( effect, state, now ); break;
			case 'plume': drawPlume( effect, state ); break;
			case 'projectile': drawProjectile( effect, state ); break;
			case 'sparks': drawSparks( effect, state ); break;
		}

	}

	function buildTab( effect, index ) {

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'vfx-effect-tab';
		button.setAttribute( 'data-testid', 'vfx-effect-tab' );
		button.setAttribute( 'data-effect-tab', effect.id );
		button.setAttribute( 'aria-pressed', 'false' );
		button.innerHTML = `
			<span class="vfx-effect-tab__title">${ effect.label }</span>
			<span class="vfx-effect-tab__id">${ effect.id }</span>
		`;
		button.addEventListener( 'click', () => setActiveEffect( index ) );
		currentStripButtons.set( effect.id, button );
		return button;

	}

	function rebuildStrip() {

		const { items } = getActiveLibrary();
		currentStripButtons = new Map();
		strip.replaceChildren();
		for ( let index = 0; index < items.length; index ++ ) {

			strip.appendChild( buildTab( items[ index ], index ) );

		}

	}

	function clearCopyFeedback() {

		if ( copyResetHandle ) {

			window.clearTimeout( copyResetHandle );
			copyResetHandle = 0;

		}

	}

	function rebuildControls() {

		const effect = getActiveEffect();
		const state = getState( effect );
		const definitions = controlsFor( effect );

		controlsMount.replaceChildren();
		controlsCount.textContent = `${ definitions.length } sliders`;

		for ( const definition of definitions ) {

			const row = document.createElement( 'label' );
			row.className = 'vfx-control';

			const meta = document.createElement( 'div' );
			meta.className = 'vfx-control__meta';
			const label = document.createElement( 'span' );
			label.className = 'vfx-control__label';
			label.textContent = definition.label;

			const value = document.createElement( 'span' );
			value.className = 'vfx-control__value';
			value.setAttribute( 'data-control-value', definition.id );
			value.textContent = formatValue( state.config[ definition.id ] );

			meta.append( label, value );

			const input = document.createElement( 'input' );
			input.className = 'vfx-control__slider';
			input.type = 'range';
			input.min = String( definition.min );
			input.max = String( definition.max );
			input.step = String( definition.step );
			input.value = String( state.config[ definition.id ] );
			input.setAttribute( 'data-control-input', definition.id );

			input.addEventListener( 'input', () => {

				state.config[ definition.id ] = Number.parseFloat( input.value );
				value.textContent = formatValue( state.config[ definition.id ] );

				if ( effect.library === 'vfx' && effect.type !== 'plume' ) {

					triggerEffect( effect, state );

				}

			} );

			row.append( meta, input );
			controlsMount.appendChild( row );

		}

	}

	function syncLibraryUi() {

		const library = getActiveLibrary();
		libraryCount.textContent = library.metaLabel;
		stageRendererLabel.textContent = library.rendererLabel;

		for ( const button of libraryTabs ) {

			const libraryId = button.getAttribute( 'data-library-tab' );
			button.setAttribute( 'aria-pressed', String( libraryId === activeLibraryId ) );

		}

		const shaderUnavailable = ! shaderRenderer.isAvailable();
		canvas.hidden = activeLibraryId !== 'vfx';
		shaderCanvas.hidden = activeLibraryId !== 'shader' || shaderUnavailable;
		shaderFallback.hidden = activeLibraryId !== 'shader' || ! shaderUnavailable;
		rebuildStrip();

	}

	function syncActiveEffectUi() {

		const effect = getActiveEffect();
		activeName.textContent = effect.label;
		activeId.textContent = effect.id;
		controlsTitle.textContent = effect.label;
		controlsDescription.textContent = effect.description;

		for ( const [ effectId, button ] of currentStripButtons ) {

			button.setAttribute( 'aria-pressed', String( effectId === effect.id ) );

		}

		rebuildControls();
		clearCopyFeedback();
		copyButton.textContent = 'Copy JSON';

	}

	function replayActiveEffect() {

		const effect = getActiveEffect();
		const state = getState( effect );
		libraries[ activeLibraryId ].replay( effect, state );

	}

	function setActiveLibrary( libraryId ) {

		if ( ! libraries[ libraryId ] ) return;
		activeLibraryId = libraryId;
		syncLibraryUi();
		syncActiveEffectUi();
		replayActiveEffect();

	}

	function setActiveEffect( index ) {

		const library = getActiveLibrary();
		librarySelections[ activeLibraryId ] = normalizedIndex( index, library.items.length );
		syncActiveEffectUi();
		replayActiveEffect();

	}

	function fallbackCopyText( text ) {

		const input = document.createElement( 'textarea' );
		input.value = text;
		input.setAttribute( 'readonly', 'readonly' );
		input.style.position = 'absolute';
		input.style.left = '-9999px';
		document.body.appendChild( input );
		input.select();
		document.execCommand( 'copy' );
		input.remove();

	}

	async function copyActiveEffectConfig() {

		const effect = getActiveEffect();
		const state = getState( effect );
		const payload = {
			version: 1,
			library: effect.library,
			effectId: effect.id,
			params: Object.fromEntries(
				Object.entries( state.config ).map( ( [ key, value ] ) => [ key, Number( value.toFixed( 2 ) ) ] )
			),
		};
		const text = JSON.stringify( payload, null, 2 );

		try {

			if ( navigator.clipboard && navigator.clipboard.writeText ) {

				await navigator.clipboard.writeText( text );

			} else {

				fallbackCopyText( text );

			}

			clearCopyFeedback();
			copyButton.textContent = 'COPIED!';
			copyResetHandle = window.setTimeout( () => {

				copyButton.textContent = 'Copy JSON';
				copyResetHandle = 0;

			}, 1500 );

		} catch ( error ) {

			clearCopyFeedback();
			copyButton.textContent = 'COPY FAILED';
			copyResetHandle = window.setTimeout( () => {

				copyButton.textContent = 'Copy JSON';
				copyResetHandle = 0;

			}, 1800 );
			console.warn( '[vfx-test] copy failed', error );

		}

	}

	function resizeCanvas() {

		dpr = Math.min( window.devicePixelRatio || 1, 2 );
		stageWidth = Math.max( 1, Math.floor( stage.clientWidth ) );
		stageHeight = Math.max( 1, Math.floor( stage.clientHeight ) );
		canvas.width = Math.floor( stageWidth * dpr );
		canvas.height = Math.floor( stageHeight * dpr );
		shaderCanvas.width = Math.floor( stageWidth * dpr );
		shaderCanvas.height = Math.floor( stageHeight * dpr );
		context.setTransform( dpr, 0, 0, dpr, 0, 0 );
		shaderRenderer.resize( stageWidth, stageHeight, dpr );

	}

	function frame( now ) {

		const dt = Math.min( ( now - lastFrame ) / 1000, 1 / 20 );
		lastFrame = now;
		context.setTransform( dpr, 0, 0, dpr, 0, 0 );
		context.clearRect( 0, 0, stageWidth, stageHeight );

		if ( activeLibraryId === 'vfx' ) {

			updateActiveState( dt );
			drawActiveEffect( now * 0.001 );

		} else {

			shaderRenderer.render( now * 0.001, getActiveEffect(), getState( getActiveEffect() ) );

		}

		window.requestAnimationFrame( frame );

	}

	function boot() {

		for ( const effect of vfxEffects ) {

			vfxStates.set( effect.id, createEffectState( effect ) );

		}

		for ( const effect of shaderSamples ) {

			shaderStates.set( effect.id, createShaderState( effect ) );

		}

		for ( const button of libraryTabs ) {

			const libraryId = button.getAttribute( 'data-library-tab' );
			libraryButtons.set( libraryId, button );
			button.addEventListener( 'click', () => setActiveLibrary( libraryId ) );

		}

		nextButton.addEventListener( 'click', () => setActiveEffect( librarySelections[ activeLibraryId ] + 1 ) );
		previousButton.addEventListener( 'click', () => setActiveEffect( librarySelections[ activeLibraryId ] - 1 ) );
		replayButton.addEventListener( 'click', () => replayActiveEffect() );
		copyButton.addEventListener( 'click', () => void copyActiveEffectConfig() );

		window.addEventListener( 'keydown', ( event ) => {

			if ( event.key === 'ArrowRight' ) {

				event.preventDefault();
				setActiveEffect( librarySelections[ activeLibraryId ] + 1 );

			} else if ( event.key === 'ArrowLeft' ) {

				event.preventDefault();
				setActiveEffect( librarySelections[ activeLibraryId ] - 1 );

			}

		} );

		window.addEventListener( 'resize', resizeCanvas );
		if ( typeof ResizeObserver === 'function' ) {

			const observer = new ResizeObserver( resizeCanvas );
			observer.observe( stage );

		}

		syncLibraryUi();
		syncActiveEffectUi();
		replayActiveEffect();
		resizeCanvas();
		window.requestAnimationFrame( frame );

	}

	boot();

} )();
