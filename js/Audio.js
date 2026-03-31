import * as THREE from 'three';

function remap( value, inMin, inMax, outMin, outMax ) {

	return outMin + ( outMax - outMin ) * ( ( value - inMin ) / ( inMax - inMin ) );

}

export class GameAudio {

	constructor() {

		this.listener = null;
		this.engineSound = null;
		this.skidSound = null;
		this.impactBuffer = null;
		this.impactPool = [];
		this.impactIndex = 0;
		this.ready = false;
		this.unlocked = false;

	}

	init( camera ) {

		this.listener = new THREE.AudioListener();
		camera.add( this.listener );

		const loader = new THREE.AudioLoader();

		this.engineSound = new THREE.Audio( this.listener );
		this.skidSound = new THREE.Audio( this.listener );

		loader.load( 'audio/engine.ogg', ( buffer ) => {

			this.engineSound.setBuffer( buffer );
			this.engineSound.setLoop( true );
			this.engineSound.setVolume( 0 );
			this.checkReady();

		} );

		loader.load( 'audio/skid.ogg', ( buffer ) => {

			this.skidSound.setBuffer( buffer );
			this.skidSound.setLoop( true );
			this.skidSound.setVolume( 0 );
			this.checkReady();

		} );

		loader.load( 'audio/impact.ogg', ( buffer ) => {

			this.impactBuffer = buffer;

			for ( let i = 0; i < 3; i ++ ) {

				const sound = new THREE.Audio( this.listener );
				sound.setBuffer( buffer );
				this.impactPool.push( sound );

			}

		} );

		// Unlock audio context on user interaction
		const unlock = () => {

			if ( this.unlocked ) return;
			this.unlocked = true;

			const ctx = this.listener.context;

			if ( ctx.state === 'suspended' ) {

				ctx.resume();

			}

			this.startSounds();

			window.removeEventListener( 'keydown', unlock );
			window.removeEventListener( 'click', unlock );
			window.removeEventListener( 'touchstart', unlock );

		};

		window.addEventListener( 'keydown', unlock );
		window.addEventListener( 'click', unlock );
		window.addEventListener( 'touchstart', unlock );

	}

	checkReady() {

		if ( this.engineSound.buffer && this.skidSound.buffer ) {

			this.ready = true;

			if ( this.unlocked ) this.startSounds();

		}

	}

	startSounds() {

		if ( ! this.ready ) return;

		if ( ! this.engineSound.isPlaying ) this.engineSound.play();
		if ( ! this.skidSound.isPlaying ) this.skidSound.play();

	}

	update( dt, speed, throttle, driftIntensity ) {

		if ( ! this.ready ) return;

		// Engine
		const speedFactor = THREE.MathUtils.clamp( Math.abs( speed ), 0, 1 );
		const throttleFactor = THREE.MathUtils.clamp( Math.abs( throttle ), 0, 1 );

		const targetVol = remap( speedFactor + throttleFactor * 0.5, 0, 1.5, 0.05, 0.5 );
		const currentVol = this.engineSound.getVolume();
		this.engineSound.setVolume( THREE.MathUtils.lerp( currentVol, targetVol, dt * 5 ) );

		let targetPitch = remap( speedFactor, 0, 1, 0.25, 3 );
		if ( throttleFactor > 0.1 ) targetPitch += 0.2;
		const currentPitch = this.engineSound.getPlaybackRate();
		this.engineSound.setPlaybackRate( THREE.MathUtils.lerp( currentPitch, targetPitch, dt * 2 ) );

		// Skid
		const shouldSkid = driftIntensity > 0.25;
		let skidVol = 0;

		if ( shouldSkid ) {

			skidVol = remap(
				THREE.MathUtils.clamp( driftIntensity, 0.25, 2 ),
				0.25, 2, 0.1, 0.4
			);

		}

		const curSkidVol = this.skidSound.getVolume();
		this.skidSound.setVolume( THREE.MathUtils.lerp( curSkidVol, skidVol, dt * 10 ) );

		const skidPitch = THREE.MathUtils.clamp( Math.abs( speed ), 1, 3 );
		const curSkidPitch = this.skidSound.getPlaybackRate();
		this.skidSound.setPlaybackRate( THREE.MathUtils.lerp( curSkidPitch, skidPitch, 0.1 ) );

	}

	playBeep( frequency = 440, duration = 0.15 ) {

		if ( ! this.listener ) return;

		const ctx = this.listener.context;
		if ( ! ctx || ctx.state === 'suspended' ) return;

		try {

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'square';
			osc.frequency.value = frequency;
			gain.gain.setValueAtTime( 0.3, ctx.currentTime );
			gain.gain.exponentialRampToValueAtTime( 0.001, ctx.currentTime + duration );

			osc.connect( gain );
			gain.connect( ctx.destination );

			osc.start( ctx.currentTime );
			osc.stop( ctx.currentTime + duration );

		} catch {

			// Silently fail if audio context not ready

		}

	}

	playImpact( impactVelocity ) {

		if ( ! this.unlocked || this.impactPool.length === 0 ) return;

		const sound = this.impactPool[ this.impactIndex ];
		this.impactIndex = ( this.impactIndex + 1 ) % this.impactPool.length;

		if ( sound.isPlaying ) sound.stop();

		const volume = THREE.MathUtils.clamp( remap( impactVelocity, 1.5, 10, 0.05, 1.0 ), 0.05, 1.0 );
		sound.setVolume( volume );
		sound.play();

	}

	// Implements: docs/plans/2026-03-31-002-feat-gameplay-juice-pass-plan.md — Unit 5 (R23)
	// Sawtooth whoosh played on boost activation: 200→600 Hz sweep over 0.3s.
	playBoostWhoosh() {

		if ( ! this.listener ) return;

		const ctx = this.listener.context;
		if ( ! ctx || ctx.state === 'suspended' ) return;

		try {

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime( 200, ctx.currentTime );
			osc.frequency.exponentialRampToValueAtTime( 600, ctx.currentTime + 0.4 );

			gain.gain.setValueAtTime( 0.65, ctx.currentTime );
			gain.gain.exponentialRampToValueAtTime( 0.001, ctx.currentTime + 0.4 );

			osc.connect( gain );
			gain.connect( ctx.destination );

			osc.start( ctx.currentTime );
			osc.stop( ctx.currentTime + 0.4 );

		} catch {

			// Silently fail if audio context not ready

		}

	}

	playLapChime() {

		if ( ! this.listener ) return;

		const ctx = this.listener.context;
		if ( ! ctx || ctx.state === 'suspended' ) return;

		try {

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'sine';
			osc.frequency.setValueAtTime( 800, ctx.currentTime );
			osc.frequency.linearRampToValueAtTime( 1200, ctx.currentTime + 0.2 );

			gain.gain.setValueAtTime( 0.3, ctx.currentTime );
			gain.gain.exponentialRampToValueAtTime( 0.001, ctx.currentTime + 0.3 );

			osc.connect( gain );
			gain.connect( ctx.destination );

			osc.start( ctx.currentTime );
			osc.stop( ctx.currentTime + 0.3 );

		} catch {

			// Silently fail if audio context not ready

		}

	}

}
