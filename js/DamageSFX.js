/**
 * DamageSFX — Procedural WebAudio damage sound effects.
 *
 * Follows the same oscillator pattern as Audio.js:
 *   - playQuadrantHit(quadrant, severity)
 *   - playCriticalWarning()
 *   - playRepairStinger()
 *   - playEliminationBurst()
 */

import { QUADRANT } from './vehicle/VehicleHealth.js';

// Front hits = higher pitch, rear = lower
const QUADRANT_BASE_FREQ = {
	[ QUADRANT.FL ]: 600,
	[ QUADRANT.FR ]: 650,
	[ QUADRANT.RL ]: 350,
	[ QUADRANT.RR ]: 380,
};

export class DamageSFX {

	/**
	 * @param {AudioContext} audioCtx - WebAudio context (from GameAudio or standalone)
	 */
	constructor( audioCtx ) {

		this._ctx = audioCtx;
		this._criticalOsc = null;
		this._criticalGain = null;

	}

	/**
	 * Play a hit cue for a specific quadrant.
	 * Pitch varies by quadrant, volume by severity.
	 */
	playQuadrantHit( quadrant, severity ) {

		if ( ! this._ctx || this._ctx.state !== 'running' ) return;

		const now = this._ctx.currentTime;
		const baseFreq = QUADRANT_BASE_FREQ[ quadrant ] || 500;
		const vol = Math.min( 0.3, 0.05 + severity * 0.015 );

		// Impact: short sawtooth sweep down
		const osc = this._ctx.createOscillator();
		const gain = this._ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime( baseFreq + severity * 10, now );
		osc.frequency.exponentialRampToValueAtTime( baseFreq * 0.4, now + 0.15 );
		gain.gain.setValueAtTime( vol, now );
		gain.gain.exponentialRampToValueAtTime( 0.001, now + 0.2 );

		osc.connect( gain ).connect( this._ctx.destination );
		osc.start( now );
		osc.stop( now + 0.2 );

		// Metallic ping layer
		const osc2 = this._ctx.createOscillator();
		const gain2 = this._ctx.createGain();
		osc2.type = 'triangle';
		osc2.frequency.setValueAtTime( baseFreq * 2.5, now );
		osc2.frequency.exponentialRampToValueAtTime( baseFreq * 1.2, now + 0.08 );
		gain2.gain.setValueAtTime( vol * 0.4, now );
		gain2.gain.exponentialRampToValueAtTime( 0.001, now + 0.1 );

		osc2.connect( gain2 ).connect( this._ctx.destination );
		osc2.start( now );
		osc2.stop( now + 0.1 );

	}

	/**
	 * Start or refresh the critical damage warning tone.
	 * Low pulsing hum. Call each frame when critical; stops naturally via decay.
	 */
	playCriticalWarning() {

		if ( ! this._ctx || this._ctx.state !== 'running' ) return;

		// Only create if not already active
		if ( this._criticalOsc ) return;

		const now = this._ctx.currentTime;

		this._criticalOsc = this._ctx.createOscillator();
		this._criticalGain = this._ctx.createGain();

		this._criticalOsc.type = 'sine';
		this._criticalOsc.frequency.setValueAtTime( 120, now );

		// Pulse via LFO-modulated gain
		const lfo = this._ctx.createOscillator();
		const lfoGain = this._ctx.createGain();
		lfo.type = 'sine';
		lfo.frequency.setValueAtTime( 4, now ); // 4 Hz pulse
		lfoGain.gain.setValueAtTime( 0.08, now );
		lfo.connect( lfoGain ).connect( this._criticalGain.gain );
		lfo.start( now );

		this._criticalGain.gain.setValueAtTime( 0.06, now );
		this._criticalOsc.connect( this._criticalGain ).connect( this._ctx.destination );
		this._criticalOsc.start( now );

		// Auto-stop after 1.5s (caller should re-trigger if still critical)
		this._criticalOsc.stop( now + 1.5 );
		lfo.stop( now + 1.5 );

		this._criticalOsc.onended = () => {

			this._criticalOsc = null;
			this._criticalGain = null;

		};

	}

	/**
	 * Ascending chime on repair pickup.
	 */
	playRepairStinger() {

		if ( ! this._ctx || this._ctx.state !== 'running' ) return;

		const now = this._ctx.currentTime;

		const notes = [ 523, 659, 784, 1047 ]; // C5, E5, G5, C6

		for ( let i = 0; i < notes.length; i ++ ) {

			const t = now + i * 0.08;
			const osc = this._ctx.createOscillator();
			const gain = this._ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime( notes[ i ], t );
			gain.gain.setValueAtTime( 0.12, t );
			gain.gain.exponentialRampToValueAtTime( 0.001, t + 0.2 );
			osc.connect( gain ).connect( this._ctx.destination );
			osc.start( t );
			osc.stop( t + 0.2 );

		}

	}

	/**
	 * Elimination explosion: low rumble + metallic crash.
	 */
	playEliminationBurst() {

		if ( ! this._ctx || this._ctx.state !== 'running' ) return;

		const now = this._ctx.currentTime;

		// Low boom
		const boom = this._ctx.createOscillator();
		const boomGain = this._ctx.createGain();
		boom.type = 'sawtooth';
		boom.frequency.setValueAtTime( 80, now );
		boom.frequency.exponentialRampToValueAtTime( 30, now + 0.5 );
		boomGain.gain.setValueAtTime( 0.3, now );
		boomGain.gain.exponentialRampToValueAtTime( 0.001, now + 0.6 );
		boom.connect( boomGain ).connect( this._ctx.destination );
		boom.start( now );
		boom.stop( now + 0.6 );

		// Metallic crash (noise-like via detuned oscillators)
		for ( let i = 0; i < 3; i ++ ) {

			const osc = this._ctx.createOscillator();
			const gain = this._ctx.createGain();
			osc.type = 'square';
			osc.frequency.setValueAtTime( 200 + Math.random() * 800, now );
			osc.frequency.exponentialRampToValueAtTime( 50 + Math.random() * 100, now + 0.3 );
			gain.gain.setValueAtTime( 0.08, now );
			gain.gain.exponentialRampToValueAtTime( 0.001, now + 0.35 );
			osc.connect( gain ).connect( this._ctx.destination );
			osc.start( now );
			osc.stop( now + 0.35 );

		}

	}

}
