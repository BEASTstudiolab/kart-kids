const VERTEX_SOURCE = `
attribute vec2 a_position;

void main() {
	gl_Position = vec4( a_position, 0.0, 1.0 );
}
`;

export function createShaderTestRenderer( {
	canvas,
	fallbackElement,
	fallbackMessageElement,
} ) {

	const gl = canvas.getContext( 'webgl', {
		alpha: true,
		antialias: true,
		premultipliedAlpha: true,
	} ) || canvas.getContext( 'experimental-webgl', {
		alpha: true,
		antialias: true,
		premultipliedAlpha: true,
	} );

	let available = !! gl;
	let currentProgram = null;
	const programCache = new Map();

	if ( ! available ) {

		setFallbackMessage( 'This browser could not start the shader stage.' );
		return {
			isAvailable: () => false,
			render() {},
			resize() {},
		};

	}

	const quadBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, quadBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [
		- 1, - 1,
		1, - 1,
		- 1, 1,
		1, 1,
	] ), gl.STATIC_DRAW );

	function setFallbackMessage( message ) {

		if ( fallbackMessageElement ) fallbackMessageElement.textContent = message;
		if ( fallbackElement ) fallbackElement.hidden = false;

	}

	function setUnavailable( message ) {

		available = false;
		currentProgram = null;
		setFallbackMessage( message );

	}

	function compileShader( type, source ) {

		const shader = gl.createShader( type );
		gl.shaderSource( shader, source );
		gl.compileShader( shader );

		if ( ! gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {

			const error = gl.getShaderInfoLog( shader ) || 'Unknown shader compile error';
			gl.deleteShader( shader );
			throw new Error( error );

		}

		return shader;

	}

	function getProgram( sample ) {

		if ( programCache.has( sample.id ) ) return programCache.get( sample.id );

		const fragmentSource = buildFragmentSource( sample );
		const vertexShader = compileShader( gl.VERTEX_SHADER, VERTEX_SOURCE );
		const fragmentShader = compileShader( gl.FRAGMENT_SHADER, fragmentSource );
		const program = gl.createProgram();
		gl.attachShader( program, vertexShader );
		gl.attachShader( program, fragmentShader );
		gl.linkProgram( program );
		gl.deleteShader( vertexShader );
		gl.deleteShader( fragmentShader );

		if ( ! gl.getProgramParameter( program, gl.LINK_STATUS ) ) {

			const error = gl.getProgramInfoLog( program ) || 'Unknown shader link error';
			gl.deleteProgram( program );
			throw new Error( error );

		}

		const entry = {
			id: sample.id,
			program,
			positionLocation: gl.getAttribLocation( program, 'a_position' ),
			uniforms: {
				resolution: gl.getUniformLocation( program, 'u_resolution' ),
				time: gl.getUniformLocation( program, 'u_time' ),
				seed: gl.getUniformLocation( program, 'u_seed' ),
				intensity: gl.getUniformLocation( program, 'u_intensity' ),
				scale: gl.getUniformLocation( program, 'u_scale' ),
				speed: gl.getUniformLocation( program, 'u_speed' ),
				distortion: gl.getUniformLocation( program, 'u_distortion' ),
				glow: gl.getUniformLocation( program, 'u_glow' ),
				familyA: gl.getUniformLocation( program, 'u_familyA' ),
				familyB: gl.getUniformLocation( program, 'u_familyB' ),
				colorA: gl.getUniformLocation( program, 'u_colorA' ),
				colorB: gl.getUniformLocation( program, 'u_colorB' ),
				colorC: gl.getUniformLocation( program, 'u_colorC' ),
			},
		};
		programCache.set( sample.id, entry );
		return entry;

	}

	function useProgram( sample ) {

		if ( currentProgram && currentProgram.id === sample.id ) return currentProgram;

		try {

			currentProgram = getProgram( sample );
			gl.useProgram( currentProgram.program );
			gl.bindBuffer( gl.ARRAY_BUFFER, quadBuffer );
			gl.enableVertexAttribArray( currentProgram.positionLocation );
			gl.vertexAttribPointer( currentProgram.positionLocation, 2, gl.FLOAT, false, 0, 0 );
			return currentProgram;

		} catch ( error ) {

			console.warn( '[vfx-test] shader setup failed', error );
			setUnavailable( 'Shaders unavailable: the WebGL program failed to compile.' );
			return null;

		}

	}

	return {
		isAvailable() {

			return available;

		},

		resize( width, height, dpr ) {

			if ( ! available ) return;
			gl.viewport( 0, 0, Math.max( 1, Math.floor( width * dpr ) ), Math.max( 1, Math.floor( height * dpr ) ) );

		},

		render( now, sample, state ) {

			if ( ! available ) return;

			const entry = useProgram( sample );
			if ( ! entry ) return;

			const config = state.config;
			const elapsed = Math.max( 0, now - state.startTime ) * ( 0.55 + config.speed * 0.95 );
			const [ familyA, familyB ] = getFamilyUniforms( sample, config );
			const palette = sample.palette.map( colorToVec3 );

			gl.useProgram( entry.program );
			gl.uniform2f( entry.uniforms.resolution, canvas.width, canvas.height );
			gl.uniform1f( entry.uniforms.time, elapsed );
			gl.uniform1f( entry.uniforms.seed, state.seed );
			gl.uniform1f( entry.uniforms.intensity, config.intensity );
			gl.uniform1f( entry.uniforms.scale, config.scale );
			gl.uniform1f( entry.uniforms.speed, config.speed );
			gl.uniform1f( entry.uniforms.distortion, config.distortion );
			gl.uniform1f( entry.uniforms.glow, config.glow );
			gl.uniform1f( entry.uniforms.familyA, familyA );
			gl.uniform1f( entry.uniforms.familyB, familyB );
			gl.uniform3fv( entry.uniforms.colorA, palette[ 0 ] );
			gl.uniform3fv( entry.uniforms.colorB, palette[ 1 ] );
			gl.uniform3fv( entry.uniforms.colorC, palette[ 2 ] );

			gl.clearColor( 0, 0, 0, 0 );
			gl.clear( gl.COLOR_BUFFER_BIT );
			gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

		},
	};

}

function colorToVec3( color ) {

	return new Float32Array( [
		( ( color >> 16 ) & 255 ) / 255,
		( ( color >> 8 ) & 255 ) / 255,
		( color & 255 ) / 255,
	] );

}

function getFamilyUniforms( sample, config ) {

	switch ( sample.family ) {
		case 'blast': return [ config.ringWidth, config.emberCount ];
		case 'energy': return [ config.pulse, config.rippleDensity ];
		case 'thermal': return [ config.heat, config.turbulence ];
		case 'surface': return [ config.flow, config.viscosity ];
		case 'frost': return [ config.crystalGrowth, config.crackDensity ];
		case 'shield': return [ config.shellThickness, config.impactRipple ];
		case 'smoke': return [ config.dissolve, config.emberSpread ];
		default: return [ 0.5, 0.5 ];
	}

}

function buildFragmentSource( sample ) {

	return `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform float u_intensity;
uniform float u_scale;
uniform float u_speed;
uniform float u_distortion;
uniform float u_glow;
uniform float u_familyA;
uniform float u_familyB;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;

float hash21( vec2 p ) {
	p = fract( p * vec2( 123.34, 456.21 ) );
	p += dot( p, p + 45.32 );
	return fract( p.x * p.y );
}

float noise( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	float a = hash21( i );
	float b = hash21( i + vec2( 1.0, 0.0 ) );
	float c = hash21( i + vec2( 0.0, 1.0 ) );
	float d = hash21( i + vec2( 1.0, 1.0 ) );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	return mix( a, b, u.x ) + ( c - a ) * u.y * ( 1.0 - u.x ) + ( d - b ) * u.x * u.y;
}

float fbm( vec2 p ) {
	float value = 0.0;
	float amplitude = 0.5;
	for ( int index = 0; index < 5; index ++ ) {
		value += amplitude * noise( p );
		p = p * 2.03 + vec2( 9.1, - 4.6 );
		amplitude *= 0.5;
	}
	return value;
}

vec2 rotate2d( vec2 p, float angle ) {
	float c = cos( angle );
	float s = sin( angle );
	return mat2( c, - s, s, c ) * p;
}

float ringMask( vec2 uv, float radius, float width ) {
	return smoothstep( width, 0.0, abs( length( uv ) - radius ) );
}

float capsuleGlow( vec2 uv, vec2 a, vec2 b, float radius ) {
	vec2 pa = uv - a;
	vec2 ba = b - a;
	float h = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
	return max( 0.0, 1.0 - length( pa - ba * h ) / radius );
}

void main() {
	vec2 uv = ( gl_FragCoord.xy * 2.0 - u_resolution.xy ) / min( u_resolution.x, u_resolution.y );
	uv /= max( 0.2, u_scale );
	float time = u_time;
	vec3 color = vec3( 0.0 );
	float alpha = 0.0;
	${ buildSampleBody( sample ) }
	color = clamp( color, 0.0, 2.0 );
	alpha = clamp( alpha, 0.0, 1.0 );
	gl_FragColor = vec4( color, alpha );
}
`;

}

function buildSampleBody( sample ) {

	switch ( sample.id ) {
		case 'blast-core':
			return buildBlastBody( 1.0, 0.96, 1.0 );
		case 'bomb-flash':
			return buildBlastBody( 0.86, 1.22, 0.74 );
		case 'energy-wave':
			return buildEnergyBody( 0.86, 1.0, 0.72 );
		case 'plasma-orb':
			return buildEnergyBody( 0.46, 0.74, 1.18 );
		case 'lightning-field':
			return buildEnergyBody( 1.24, 1.3, 0.44 );
		case 'burn-scorch':
			return buildThermalBody( 0.38, 0.46, 0.88 );
		case 'fireball-trail':
			return buildThermalBody( 0.92, 1.08, 0.52 );
		case 'heat-haze':
			return buildThermalBody( 1.44, 0.2, 1.12 );
		case 'molten-lava':
			return buildSurfaceBody( 0.78, 0.96, 0.52 );
		case 'lava-rim':
			return buildSurfaceBody( 1.3, 0.74, 0.88 );
		case 'slime-surface':
			return buildSurfaceBody( 0.54, 1.26, 0.34 );
		case 'frost-bloom':
			return buildFrostBody( 0.76, 0.72, 0.96 );
		case 'ice-sheet':
			return buildFrostBody( 1.18, 0.92, 0.42 );
		case 'snow-burst':
			return buildFrostBody( 0.44, 0.48, 1.08 );
		case 'shield-shell':
			return buildShieldBody();
		case 'smoke-ember':
			return buildSmokeBody();
		default:
			return `
				float haze = smoothstep( 0.8, 0.0, length( uv ) );
				color = mix( u_colorC, u_colorA, haze );
				alpha = haze * 0.7;
			`;
	}

}

function buildBlastBody( pulseOffset, ringScale, emberBias ) {

	return `
		float radius = length( uv );
		float pulse = 0.24 + 0.07 * sin( time * ( 1.8 + u_familyA * ${ pulseOffset.toFixed( 2 ) } ) + u_seed * 0.015 );
		float core = smoothstep( pulse + 0.12, 0.0, radius );
		float flash = exp( - radius * radius * ( 16.0 - u_intensity * 6.0 ) );
		float ring = ringMask( uv, pulse * ${ ringScale.toFixed( 2 ) }, 0.03 + u_familyA * 0.09 );
		float emberNoise = fbm( rotate2d( uv * ( 8.0 + u_familyB * 10.0 ), time * 0.5 ) + time * 2.2 );
		float embers = smoothstep( ${ emberBias.toFixed( 2 ) }, 1.0, emberNoise ) * smoothstep( 0.95, 0.18, radius );
		color += u_colorC * flash * 0.4;
		color += mix( u_colorB, u_colorA, core ) * ( 0.5 + flash * 0.7 );
		color += u_colorA * ring * ( 0.35 + u_glow * 0.55 );
		color += u_colorA * embers * ( 0.2 + u_familyB * 0.65 );
		alpha = flash * 0.4 + ring * 0.35 + embers * 0.28;
	`;

}

function buildEnergyBody( waveDensity, fieldSpeed, shellBias ) {

	return `
		vec2 warped = rotate2d( uv, time * 0.1 ) * ( 1.0 + u_distortion * 0.2 );
		float radius = length( warped );
		float field = fbm( warped * ( 4.5 + u_familyB * 9.0 ) + vec2( time * ${ fieldSpeed.toFixed( 2 ) }, - time * 0.7 ) );
		float waves = sin( radius * ( 22.0 + u_familyB * 16.0 ) - time * ( 4.0 + u_familyA * 5.0 ) * ${ waveDensity.toFixed( 2 ) } );
		float shell = ringMask( warped, 0.34 + 0.1 * sin( time * 1.8 + u_seed * 0.01 ), 0.04 + u_familyA * ${ shellBias.toFixed( 2 ) } * 0.05 );
		float arcs = smoothstep( 0.78, 1.0, abs( sin( warped.y * 24.0 + field * 8.0 - time * 5.0 ) ) );
		color += mix( u_colorB, u_colorA, field ) * ( 0.18 + field * 0.52 );
		color += u_colorC * ( waves * 0.5 + 0.5 ) * 0.16;
		color += u_colorA * shell * ( 0.4 + u_glow * 0.5 );
		color += u_colorA * arcs * ( 0.05 + u_distortion * 0.18 );
		alpha = field * 0.35 + shell * 0.45 + arcs * 0.16;
	`;

}

function buildThermalBody( driftScale, coreBias, shimmerStrength ) {

	return `
		vec2 drift = uv;
		drift.x += sin( drift.y * 8.0 + time * ( 1.6 + u_familyB * 2.4 ) ) * u_distortion * ${ driftScale.toFixed( 2 ) } * 0.18;
		drift.y += cos( drift.x * 10.0 - time * 1.4 ) * u_distortion * 0.1;
		float flame = fbm( drift * ( 3.6 + u_familyB * 6.0 ) + vec2( 0.0, - time * ( 1.6 + u_familyA * 2.4 ) ) );
		float heat = fbm( drift * 7.0 + vec2( time * ${ shimmerStrength.toFixed( 2 ) }, - time * 0.6 ) );
		float core = smoothstep( 0.24 + u_familyA * 0.18, 0.88, flame );
		float rim = smoothstep( 0.5, 1.0, heat ) * smoothstep( 0.86, 0.1, length( uv ) );
		color += mix( u_colorC, u_colorB, flame ) * ( 0.2 + u_familyA * ${ coreBias.toFixed( 2 ) } );
		color += u_colorA * core * ( 0.38 + u_glow * 0.52 );
		color += mix( u_colorA, vec3( 1.0 ), rim * 0.18 ) * rim * 0.24;
		alpha = core * 0.48 + rim * 0.26 + flame * 0.18;
	`;

}

function buildSurfaceBody( flowBias, viscosityBias, rimGlow ) {

	return `
		vec2 flowUv = uv;
		flowUv += vec2( sin( uv.y * 5.0 + time * ( 0.6 + u_familyA * 2.2 ) ), cos( uv.x * 4.0 - time * 0.7 ) ) * u_distortion * 0.16;
		float cells = fbm( flowUv * ( 4.2 + u_familyB * 4.0 ) + vec2( time * ${ flowBias.toFixed( 2 ) } * ( 0.8 + u_familyA ), - time * 0.32 ) );
		float cracks = smoothstep( 0.56 - u_familyB * 0.18, 1.0, cells );
		float cooled = smoothstep( 0.18, ${ viscosityBias.toFixed( 2 ) }, cells );
		float rim = ringMask( flowUv, 0.42 + sin( time * 1.2 ) * 0.04, 0.08 + u_distortion * 0.05 );
		color += mix( u_colorC, u_colorB, cooled ) * 0.42;
		color += u_colorB * cooled * 0.28;
		color += u_colorA * cracks * ( 0.28 + u_glow * 0.54 );
		color += u_colorA * rim * ${ rimGlow.toFixed( 2 ) } * 0.3;
		alpha = cooled * 0.4 + cracks * 0.42 + rim * 0.18;
	`;

}

function buildFrostBody( bloomBias, crackBias, burstBias ) {

	return `
		vec2 polarUv = rotate2d( uv, time * 0.08 );
		float radius = length( polarUv );
		float angle = atan( polarUv.y, polarUv.x );
		float spokes = abs( sin( angle * ( 5.0 + u_familyB * 6.0 ) + time * ${ burstBias.toFixed( 2 ) } ) );
		float crystals = fbm( polarUv * ( 5.0 + u_familyA * 5.0 ) + vec2( 0.0, time * 0.2 ) );
		float frost = smoothstep( 0.18 + u_familyA * 0.1, 0.96, crystals + spokes * ${ bloomBias.toFixed( 2 ) } );
		float cracks = smoothstep( 0.78 - u_familyB * 0.18, 1.0, abs( sin( angle * 9.0 + crystals * 7.0 ) ) ) * smoothstep( 0.9, 0.1, radius );
		color += mix( u_colorC, u_colorB, frost ) * 0.26;
		color += u_colorA * frost * ( 0.28 + u_glow * 0.34 );
		color += u_colorA * cracks * ${ crackBias.toFixed( 2 ) } * 0.24;
		alpha = frost * 0.44 + cracks * 0.22;
	`;

}

function buildShieldBody() {

	return `
		float radius = length( uv );
		float shell = ringMask( uv, 0.44 + sin( time * 1.4 ) * 0.02, 0.05 + u_familyA * 0.08 );
		float bands = smoothstep( 0.72, 1.0, sin( uv.y * 18.0 - time * ( 2.0 + u_familyB * 4.0 ) ) * 0.5 + 0.5 );
		float impacts = ringMask( uv + vec2( sin( time * 0.9 ) * 0.12, cos( time * 1.1 ) * 0.08 ), 0.18 + 0.08 * sin( time * 2.2 ), 0.03 + u_familyB * 0.07 );
		float haze = smoothstep( 0.7, 0.12, radius );
		color += mix( u_colorC, u_colorB, haze ) * 0.22;
		color += u_colorA * shell * ( 0.34 + u_glow * 0.56 );
		color += u_colorB * bands * 0.12;
		color += u_colorA * impacts * ( 0.22 + u_familyB * 0.3 );
		alpha = shell * 0.46 + bands * 0.12 + impacts * 0.24 + haze * 0.08;
	`;

}

function buildSmokeBody() {

	return `
		vec2 smokeUv = uv;
		smokeUv += vec2( sin( uv.y * 4.0 + time * 0.8 ), cos( uv.x * 5.0 - time * 0.7 ) ) * u_distortion * 0.14;
		float smoke = fbm( smokeUv * ( 2.8 + u_familyA * 3.6 ) + vec2( time * 0.32, - time * 0.18 ) );
		float dissolve = smoothstep( u_familyA * 0.7, 1.0, smoke );
		float emberNoise = fbm( smokeUv * ( 8.0 + u_familyB * 6.0 ) - vec2( time * 0.8, time * 0.34 ) );
		float embers = smoothstep( 0.78 - u_familyB * 0.18, 1.0, emberNoise ) * dissolve;
		float body = smoothstep( 0.1, 0.95, smoke ) * smoothstep( 1.0, 0.0, length( uv ) );
		color += u_colorC * body * 0.36;
		color += u_colorB * embers * 0.24;
		color += u_colorA * embers * ( 0.24 + u_glow * 0.3 );
		alpha = body * 0.42 + embers * 0.3;
	`;

}
