/**
 * RaceCallouts — brief contextual text callouts during races.
 *
 * Triggers on position gains, final lap, and drift milestones.
 * Each callout fades in, holds, and fades out with a scale punch.
 */

const CALLOUT_DURATION = 1.8; // seconds visible
const CALLOUT_COOLDOWN = 3.0; // minimum seconds between callouts

export class RaceCallouts {

	constructor() {

		this._el = document.createElement( 'div' );
		this._el.style.cssText = [
			'position:fixed', 'top:25%', 'left:50%', 'transform:translate(-50%,-50%) scale(1)',
			'font:bold 36px/1 monospace', 'color:#fff',
			'text-shadow:0 0 20px rgba(255,255,255,0.5), 0 2px 8px rgba(0,0,0,0.7)',
			'z-index:1002', 'pointer-events:none', 'user-select:none',
			'opacity:0', 'transition:opacity 0.2s, transform 0.2s',
		].join( ';' );
		document.body.appendChild( this._el );

		this._timer = 0;
		this._cooldown = 0;
		this._active = false;
		this._prevPosition = 0;
		this._prevLap = 0;
		this._prevDriftTier = 0;
		this._positionGainStreak = 0;

	}

	update( dt, displayState, vehicle ) {

		// Decay timers
		if ( this._active ) {

			this._timer -= dt;
			if ( this._timer <= 0 ) {

				this._active = false;
				this._el.style.opacity = '0';
				this._el.style.transform = 'translate(-50%,-50%) scale(0.8)';

			} else if ( this._timer < 0.3 ) {

				// Fade out in last 0.3s
				this._el.style.opacity = String( this._timer / 0.3 );

			}

		}

		this._cooldown = Math.max( 0, this._cooldown - dt );

		if ( ! displayState || displayState.state !== 'racing' ) {

			this._prevPosition = 0;
			this._prevLap = 0;
			this._prevDriftTier = 0;
			this._positionGainStreak = 0;
			return;

		}

		const pos = displayState.position;

		// ── Position gain streak ─────────────────────────────────────────
		if ( pos < this._prevPosition && this._prevPosition > 0 ) {

			this._positionGainStreak += this._prevPosition - pos;

			if ( this._positionGainStreak >= 3 ) {

				this._show( 'COMEBACK!', '#00ddff' );
				this._positionGainStreak = 0;

			} else if ( pos === 1 ) {

				this._show( 'FIRST PLACE!', '#ffd700' );

			}

		} else if ( pos > this._prevPosition && this._prevPosition > 0 ) {

			this._positionGainStreak = 0;

		}

		this._prevPosition = pos;

		// ── Final lap ────────────────────────────────────────────────────
		const lap = displayState.lap;
		if ( lap !== this._prevLap && lap === displayState.totalLaps - 1 && this._prevLap > 0 ) {

			this._show( 'FINAL LAP!', '#ff4444' );

		}

		this._prevLap = lap;

		// ── Drift milestones ─────────────────────────────────────────────
		if ( vehicle ) {

			const tier = vehicle.driftSparkTier || 0;

			if ( tier >= 3 && this._prevDriftTier < 3 ) {

				this._show( 'MEGA DRIFT!', '#cc44ff' );

			} else if ( tier >= 2 && this._prevDriftTier < 2 ) {

				this._show( 'NICE DRIFT!', '#ff8800' );

			}

			this._prevDriftTier = tier;

		}

	}

	_show( text, color ) {

		if ( this._cooldown > 0 ) return;

		this._el.textContent = text;
		this._el.style.color = color;
		this._el.style.opacity = '1';
		this._el.style.transform = 'translate(-50%,-50%) scale(1.3)';

		// Punch back to normal scale
		requestAnimationFrame( () => {

			this._el.style.transform = 'translate(-50%,-50%) scale(1)';

		} );

		this._timer = CALLOUT_DURATION;
		this._cooldown = CALLOUT_COOLDOWN;
		this._active = true;

	}

}
