( function() {

	const stage = document.querySelector( '[data-testid="vfx-stage"]' );
	const canvas = document.querySelector( '[data-testid="vfx-stage-canvas"]' );
	const strip = document.querySelector( '[data-testid="vfx-effect-strip"]' );
	const controlsMount = document.querySelector( '[data-testid="vfx-controls"]' );
	const activeName = document.querySelector( '[data-testid="vfx-active-effect-name"]' );
	const activeId = document.querySelector( '[data-testid="vfx-active-effect-id"]' );
	const controlsTitle = document.querySelector( '[data-testid="vfx-controls-title"]' );
	const controlsDescription = document.querySelector( '[data-testid="vfx-controls-description"]' );
	const controlsCount = document.querySelector( '[data-testid="vfx-controls-count"]' );
	const replayButton = document.querySelector( '[data-action="replay"]' );
	const copyButton = document.querySelector( '[data-action="copy-json"]' );
	const nextButton = document.querySelector( '[data-action="next-effect"]' );
	const previousButton = document.querySelector( '[data-action="previous-effect"]' );

	if (
		! stage ||
		! canvas ||
		! strip ||
		! controlsMount ||
		! activeName ||
		! activeId ||
		! controlsTitle ||
		! controlsDescription ||
		! controlsCount ||
		! replayButton ||
		! copyButton ||
		! nextButton ||
		! previousButton
	) {

		return;

	}

	const context = canvas.getContext( '2d' );
	if ( ! context ) return;

	const TAU = Math.PI * 2;
	const sharedControls = [
		{ id: 'intensity', label: 'Intensity', min: 0.4, max: 1.8, step: 0.01 },
		{ id: 'size', label: 'Size', min: 0.5, max: 1.8, step: 0.01 },
		{ id: 'speed', label: 'Speed', min: 0.45, max: 1.8, step: 0.01 },
		{ id: 'spread', label: 'Spread', min: 0.15, max: 1.4, step: 0.01 },
		{ id: 'lifetime', label: 'Lifetime', min: 0.2, max: 1.5, step: 0.01 },
	];
	const extraControls = {
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
		sparks: [
			{ id: 'sparkCount', label: 'Spark Count', min: 0.2, max: 1.3, step: 0.01 },
			{ id: 'heat', label: 'Heat', min: 0.2, max: 1.4, step: 0.01 },
		],
	};

	const effects = [
		{ id: 'explosion', label: 'Explosion', type: 'burst', accent: 0xff8b2e, description: 'Big arcade bloom with a punchy flash, rolling smoke, and hot debris.', defaults: { intensity: 1.0, size: 1.02, speed: 1.0, spread: 0.72, lifetime: 0.62, sparkCount: 0.62, heat: 0.78 }, palette: [ 0xffd166, 0xff8b2e, 0xff5d22 ], smokeColor: 0x6b6054 },
		{ id: 'bomb-detonation', label: 'Bomb Detonation', type: 'burst', accent: 0xff4f5d, description: 'A tighter blast ring with toybox danger colors and a faster snap-back.', defaults: { intensity: 0.92, size: 0.94, speed: 1.15, spread: 0.66, lifetime: 0.5, sparkCount: 0.72, heat: 0.62 }, palette: [ 0xfff28c, 0xff5a5f, 0xff7f32 ], smokeColor: 0x5f5857 },
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
	];

	const effectStates = new Map();
	const tabButtons = new Map();
	let activeEffectIndex = 0;
	let dpr = 1;
	let stageWidth = 1;
	let stageHeight = 1;
	let lastFrame = performance.now();
	let copyResetHandle = 0;

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

	function controlsFor( effect ) {

		return sharedControls.concat( extraControls[ effect.type ] || [] );

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

	function normalizedIndex( index ) {

		return ( index + effects.length ) % effects.length;

	}

	function getActiveEffect() {

		return effects[ activeEffectIndex ];

	}

	function getState( effect ) {

		return effectStates.get( effect.id );

	}

	function nextAutoplayDelay( effect ) {

		switch ( effect.type ) {
			case 'burst': return 1.25 + Math.random() * 0.8;
			case 'lightning': return 0.92 + Math.random() * 0.6;
			case 'slime': return effect.mode === 'ooze' ? 1.45 + Math.random() * 0.75 : 1.55 + Math.random() * 0.95;
			case 'plume': return 1.1 + Math.random() * 0.5;
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
			puffs: [],
			droplets: [],
			sparks: [],
			burstAge: 99,
			refreshTimer: 0,
			emitAccumulator: 0,
		};

	}

	function resetTransientState( state ) {

		state.particles = [];
		state.smoke = [];
		state.arcs = [];
		state.puffs = [];
		state.droplets = [];
		state.sparks = [];
		state.refreshTimer = 0;
		state.emitAccumulator = 0;

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

	function drawActiveEffect( now ) {

		const effect = getActiveEffect();
		const state = getState( effect );
		drawStageBackdrop( effect, now );

		switch ( effect.type ) {
			case 'burst': drawBurst( effect, state ); break;
			case 'lightning': drawLightning( effect, state, now ); break;
			case 'slime': drawSlime( effect, state, now ); break;
			case 'plume': drawPlume( effect, state ); break;
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
		tabButtons.set( effect.id, button );
		return button;

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

				if ( effect.type !== 'plume' ) {

					triggerEffect( effect, state );

				}

			} );

			row.append( meta, input );
			controlsMount.appendChild( row );

		}

	}

	function syncActiveEffectUi() {

		const effect = getActiveEffect();
		activeName.textContent = effect.label;
		activeId.textContent = effect.id;
		controlsTitle.textContent = effect.label;
		controlsDescription.textContent = effect.description;

		for ( const entry of effects ) {

			const button = tabButtons.get( entry.id );
			if ( button ) button.setAttribute( 'aria-pressed', String( entry.id === effect.id ) );

		}

		rebuildControls();
		clearCopyFeedback();
		copyButton.textContent = 'Copy JSON';

	}

	function setActiveEffect( index ) {

		activeEffectIndex = normalizedIndex( index );
		const effect = getActiveEffect();
		const state = getState( effect );
		syncActiveEffectUi();
		triggerEffect( effect, state );

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
		context.setTransform( dpr, 0, 0, dpr, 0, 0 );

	}

	function frame( now ) {

		const dt = Math.min( ( now - lastFrame ) / 1000, 1 / 20 );
		lastFrame = now;
		updateActiveState( dt );
		context.setTransform( dpr, 0, 0, dpr, 0, 0 );
		context.clearRect( 0, 0, stageWidth, stageHeight );
		drawActiveEffect( now * 0.001 );
		window.requestAnimationFrame( frame );

	}

	function boot() {

		for ( const effect of effects ) {

			effectStates.set( effect.id, createEffectState( effect ) );
			strip.appendChild( buildTab( effect, effects.indexOf( effect ) ) );

		}

		nextButton.addEventListener( 'click', () => setActiveEffect( activeEffectIndex + 1 ) );
		previousButton.addEventListener( 'click', () => setActiveEffect( activeEffectIndex - 1 ) );
		replayButton.addEventListener( 'click', () => triggerEffect( getActiveEffect(), getState( getActiveEffect() ) ) );
		copyButton.addEventListener( 'click', () => void copyActiveEffectConfig() );

		window.addEventListener( 'keydown', ( event ) => {

			if ( event.key === 'ArrowRight' ) {

				event.preventDefault();
				setActiveEffect( activeEffectIndex + 1 );

			} else if ( event.key === 'ArrowLeft' ) {

				event.preventDefault();
				setActiveEffect( activeEffectIndex - 1 );

			}

		} );

		window.addEventListener( 'resize', resizeCanvas );
		if ( typeof ResizeObserver === 'function' ) {

			const observer = new ResizeObserver( resizeCanvas );
			observer.observe( stage );

		}

		setActiveEffect( 0 );
		resizeCanvas();
		window.requestAnimationFrame( frame );

	}

	boot();

} )();
