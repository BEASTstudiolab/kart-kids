import * as THREE from 'three';

const _diff = new THREE.Vector3();
const _right = new THREE.Vector3();

export class PassByAudio {

	constructor( listener, sfxGain ) {

		this._listener = listener;
		this._sfxGain = sfxGain || null;
		this._cooldowns = new Map(); // vehicleId → cooldown timer
		this._minDistance = 6; // trigger radius
		this._minRelSpeed = 8; // minimum relative speed for whoosh
		this._cooldownTime = 1.5; // seconds between whooshes per vehicle

	}

	update( dt, playerVehicle, otherVehicles ) {

		if ( ! this._listener || ! playerVehicle ) return;

		const ctx = this._listener.context;
		if ( ! ctx || ctx.state === 'suspended' ) return;

		const playerPos = playerVehicle.vehPos;
		const playerSpeed = playerVehicle.linearSpeed;
		const playerQuat = playerVehicle.container.quaternion;

		// Player's right vector for stereo panning
		_right.set( 1, 0, 0 ).applyQuaternion( playerQuat );
		_right.y = 0;
		_right.normalize();

		// Decay cooldowns
		for ( const [ id, t ] of this._cooldowns ) {

			const remaining = t - dt;
			if ( remaining <= 0 ) this._cooldowns.delete( id );
			else this._cooldowns.set( id, remaining );

		}

		for ( const entry of otherVehicles ) {

			const other = entry.vehicle;
			if ( ! other || other === playerVehicle ) continue;

			_diff.copy( other.vehPos ).sub( playerPos );
			const dist = _diff.length();

			if ( dist > this._minDistance || dist < 0.5 ) continue;

			// Relative speed (approaching = positive)
			const relSpeed = Math.abs( other.linearSpeed - playerSpeed );
			if ( relSpeed < this._minRelSpeed ) continue;

			// Check cooldown
			const id = entry.id || other.uuid;
			if ( this._cooldowns.has( id ) ) continue;

			// Compute stereo pan: dot product of diff with player's right vector
			// Positive = right side, negative = left side
			_diff.normalize();
			const pan = THREE.MathUtils.clamp( _diff.dot( _right ), - 1, 1 );

			this._playWhoosh( ctx, pan, relSpeed );
			this._cooldowns.set( id, this._cooldownTime );

		}

	}

	_playWhoosh( ctx, pan, relSpeed ) {

		try {

			const now = ctx.currentTime;
			const duration = 0.35;

			// Noise source for the whoosh texture
			const bufferSize = ctx.sampleRate * 0.5;
			const noiseBuffer = ctx.createBuffer( 1, bufferSize, ctx.sampleRate );
			const data = noiseBuffer.getChannelData( 0 );
			for ( let i = 0; i < bufferSize; i ++ ) data[ i ] = Math.random() * 2 - 1;

			const noise = ctx.createBufferSource();
			noise.buffer = noiseBuffer;

			// Bandpass filter — higher speed = higher pitch
			const filter = ctx.createBiquadFilter();
			filter.type = 'bandpass';
			filter.frequency.value = THREE.MathUtils.mapLinear( relSpeed, 8, 30, 800, 2500 );
			filter.Q.value = 1.2;

			// Volume envelope — quick attack, fast decay
			const volume = THREE.MathUtils.clamp( relSpeed / 25, 0.15, 0.45 );
			const gain = ctx.createGain();
			gain.gain.setValueAtTime( 0, now );
			gain.gain.linearRampToValueAtTime( volume, now + 0.05 );
			gain.gain.exponentialRampToValueAtTime( 0.001, now + duration );

			// Stereo panner for directional audio
			const panner = ctx.createStereoPanner();
			panner.pan.setValueAtTime( pan, now );
			// Sweep pan slightly as vehicle "passes"
			panner.pan.linearRampToValueAtTime( pan * 0.3, now + duration );

			noise.connect( filter );
			filter.connect( gain );
			gain.connect( panner );
			panner.connect( this._sfxGain || ctx.destination );

			noise.start( now );
			noise.stop( now + duration );

		} catch {

			// Silently fail if audio context not ready

		}

	}

}
