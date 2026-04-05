/**
 * Speedometer HUD — bottom-right speed display with:
 *   - Semi-circular arc (acceleration indicator)
 *   - Numerical speed readout (km/h or mph)
 *   - Horizontal speed bar
 *   - Momentum: speed climbs toward 150 km/h when sustained
 *   - Boost: entire HUD scales up dynamically, then eases back
 *
 * Usage:
 *   const speedo = new Speedometer( settings );
 *   // in game loop:
 *   speedo.update( dt, linearSpeed, momentum, boostActive, effectiveTopSpeed, baseTopSpeed );
 */

const DISPLAY_TOP_SPEED = 150; // max displayed km/h at base top speed
const BOOST_SCALE = 1.25;      // how much the HUD scales during boost

export class Speedometer {

	constructor( settings ) {

		this.settings = settings;
		this._unit = settings.get( 'speedUnit' ) || 'kmh';

		// Smooth animation state
		this._displayedSpeed = 0;   // smoothed speed number
		this._scale = 1;            // current HUD scale (eases toward target)
		this._arcGlow = 0;          // extra glow intensity during boost
		this._boostWasActive = false;

		this._injectCSS();
		this._createDOM();

		// React to settings changes
		window.addEventListener( 'settings-changed', ( e ) => {

			if ( e.detail.key === 'speedUnit' ) {

				this._unit = e.detail.value;
				this._unitLabel.textContent = this._unit === 'kmh' ? 'KM/H' : 'MPH';

			}

		} );

	}

	// ─── CSS ──────────────────────────────────────────────────────────────────

	_injectCSS() {

		const css = document.createElement( 'style' );
		css.textContent = `
			.speedo-container {
				position: fixed;
				bottom: 24px;
				right: 24px;
				z-index: 50;
				pointer-events: none;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 6px;
				transform-origin: bottom right;
				will-change: transform;
			}

			.speedo-arc-wrap {
				position: relative;
				width: 160px;
				height: 90px;
				overflow: visible;
			}

			.speedo-arc-canvas {
				width: 160px;
				height: 90px;
				display: block;
			}

			.speedo-readout {
				position: absolute;
				bottom: 2px;
				left: 50%;
				transform: translateX(-50%);
				text-align: center;
				line-height: 1;
				white-space: nowrap;
			}

			.speedo-speed {
				font-family: 'Segoe UI', system-ui, sans-serif;
				font-weight: 700;
				font-size: 32px;
				color: #fff;
				text-shadow: 0 2px 8px rgba(0,0,0,0.6);
				letter-spacing: -1px;
				transition: color 0.3s;
			}

			.speedo-unit {
				font-family: 'Segoe UI', system-ui, sans-serif;
				font-weight: 600;
				font-size: 11px;
				color: rgba(255,255,255,0.5);
				text-transform: uppercase;
				letter-spacing: 1px;
			}

			.speedo-bar-wrap {
				width: 140px;
				height: 6px;
				border-radius: 3px;
				background: rgba(255,255,255,0.12);
				overflow: hidden;
			}

			.speedo-bar-fill {
				height: 100%;
				width: 0%;
				border-radius: 3px;
				background: linear-gradient(90deg, #4ade80, #facc15, #f87171);
			}
		`;
		document.head.appendChild( css );

	}

	// ─── DOM ──────────────────────────────────────────────────────────────────

	_createDOM() {

		const container = document.createElement( 'div' );
		container.className = 'speedo-container';

		// Arc wrap
		const arcWrap = document.createElement( 'div' );
		arcWrap.className = 'speedo-arc-wrap';

		// Canvas for semi-circle arc
		const canvas = document.createElement( 'canvas' );
		canvas.className = 'speedo-arc-canvas';
		canvas.width = 320;
		canvas.height = 180;
		this._canvas = canvas;
		this._ctx = canvas.getContext( '2d' );

		// Readout overlay
		const readout = document.createElement( 'div' );
		readout.className = 'speedo-readout';

		const speed = document.createElement( 'div' );
		speed.className = 'speedo-speed';
		speed.textContent = '0';
		this._speedEl = speed;

		const unit = document.createElement( 'div' );
		unit.className = 'speedo-unit';
		unit.textContent = this._unit === 'kmh' ? 'KM/H' : 'MPH';
		this._unitLabel = unit;

		readout.appendChild( speed );
		readout.appendChild( unit );

		arcWrap.appendChild( canvas );
		arcWrap.appendChild( readout );
		container.appendChild( arcWrap );

		// Horizontal speed bar
		const barWrap = document.createElement( 'div' );
		barWrap.className = 'speedo-bar-wrap';

		const barFill = document.createElement( 'div' );
		barFill.className = 'speedo-bar-fill';
		this._barFill = barFill;

		barWrap.appendChild( barFill );
		container.appendChild( barWrap );

		document.body.appendChild( container );
		this._container = container;

	}

	// ─── Arc rendering ───────────────────────────────────────────────────────

	_drawArc( fraction, boosting ) {

		const ctx = this._ctx;
		const w = this._canvas.width;
		const h = this._canvas.height;
		const cx = w / 2;
		const cy = h - 4;
		const radius = 140;
		const lineWidth = boosting ? 13 : 10;

		ctx.clearRect( 0, 0, w, h );

		// Background arc (dim)
		ctx.beginPath();
		ctx.arc( cx, cy, radius, Math.PI, 0, false );
		ctx.strokeStyle = 'rgba(255,255,255,0.1)';
		ctx.lineWidth = lineWidth;
		ctx.lineCap = 'round';
		ctx.stroke();

		// Foreground arc
		if ( fraction > 0.001 ) {

			const clampedFraction = Math.min( fraction, 1 );
			const endAngle = Math.PI + clampedFraction * Math.PI;

			// Gradient — shifts to hot colors during boost
			const grad = ctx.createLinearGradient( cx - radius, cy, cx + radius, cy );

			if ( boosting ) {

				grad.addColorStop( 0, '#facc15' );
				grad.addColorStop( 0.4, '#fb923c' );
				grad.addColorStop( 0.7, '#f87171' );
				grad.addColorStop( 1.0, '#ef4444' );

			} else {

				grad.addColorStop( 0, '#4ade80' );
				grad.addColorStop( 0.5, '#facc15' );
				grad.addColorStop( 0.85, '#f87171' );
				grad.addColorStop( 1.0, '#ef4444' );

			}

			ctx.beginPath();
			ctx.arc( cx, cy, radius, Math.PI, endAngle, false );
			ctx.strokeStyle = grad;
			ctx.lineWidth = lineWidth;
			ctx.lineCap = 'round';
			ctx.stroke();

			// Glow effect — stronger during boost
			const glowThreshold = boosting ? 0.3 : 0.7;

			if ( fraction > glowThreshold ) {

				const glowAlpha = Math.min( ( clampedFraction - glowThreshold ) * ( boosting ? 2.0 : 1.5 ), 1 );
				const glowColor = boosting
					? `rgba(251,146,60,${ glowAlpha })`
					: `rgba(248,113,113,${ glowAlpha })`;

				ctx.beginPath();
				ctx.arc( cx, cy, radius, Math.PI, endAngle, false );
				ctx.strokeStyle = glowColor;
				ctx.lineWidth = lineWidth + 8;
				ctx.lineCap = 'round';
				ctx.filter = 'blur(6px)';
				ctx.stroke();
				ctx.filter = 'none';

			}

		}

		// Tick marks
		const ticks = 10;
		ctx.strokeStyle = boosting ? 'rgba(255,200,100,0.35)' : 'rgba(255,255,255,0.25)';
		ctx.lineWidth = 1.5;

		for ( let i = 0; i <= ticks; i ++ ) {

			const angle = Math.PI + ( i / ticks ) * Math.PI;
			const cos = Math.cos( angle );
			const sin = Math.sin( angle );
			const innerR = radius - 18;
			const outerR = radius - 8;

			ctx.beginPath();
			ctx.moveTo( cx + cos * innerR, cy + sin * innerR );
			ctx.lineTo( cx + cos * outerR, cy + sin * outerR );
			ctx.stroke();

		}

	}

	// ─── Update (call each frame) ────────────────────────────────────────────

	update( dt, linearSpeed, momentum, boostActive, effectiveTopSpeed, baseTopSpeed ) {

		const absSpeed = Math.abs( linearSpeed );

		// Momentum adds up to 30% extra display speed on top of base
		// At linearSpeed 0.7 with full momentum, display reaches ~150
		// Without momentum, display caps around ~105 km/h
		const momentumBonus = momentum * 0.3 * absSpeed;
		const effectiveDisplaySpeed = absSpeed + momentumBonus;

		// During boost, scale beyond 150 proportionally
		const boostRatio = effectiveTopSpeed / baseTopSpeed;
		const isBoosting = boostRatio > 1.05;
		const rawKmh = effectiveDisplaySpeed * DISPLAY_TOP_SPEED * ( isBoosting ? boostRatio : 1 );

		// Cap at 150 when not boosting
		const cappedKmh = isBoosting ? rawKmh : Math.min( rawKmh, DISPLAY_TOP_SPEED );

		// Convert units
		const KMH_TO_MPH = 0.621371;
		const targetSpeed = this._unit === 'mph'
			? cappedKmh * KMH_TO_MPH
			: cappedKmh;

		// Smooth the displayed number (no jarring jumps)
		const smoothRate = isBoosting ? 8 : 5;
		this._displayedSpeed += ( targetSpeed - this._displayedSpeed ) * Math.min( smoothRate * dt, 1 );

		// ── Dynamic scale ────────────────────────────────────────────────────
		const targetScale = isBoosting ? BOOST_SCALE : 1;
		// Fast ramp up, slow ease back
		const scaleRate = isBoosting ? 6 : 2;
		this._scale += ( targetScale - this._scale ) * Math.min( scaleRate * dt, 1 );
		this._container.style.transform = `scale(${ this._scale.toFixed( 3 ) })`;

		// Speed text color — warm during boost
		if ( isBoosting && ! this._boostWasActive ) {

			this._speedEl.style.color = '#fbbf24';
			this._unitLabel.style.color = 'rgba(251,191,36,0.7)';

		} else if ( ! isBoosting && this._boostWasActive ) {

			this._speedEl.style.color = '#fff';
			this._unitLabel.style.color = 'rgba(255,255,255,0.5)';

		}

		this._boostWasActive = isBoosting;

		// ── Fraction for gauges (based on display speed vs 150) ──────────────
		const fraction = isBoosting
			? Math.min( cappedKmh / ( DISPLAY_TOP_SPEED * boostRatio ), 1 )
			: Math.min( cappedKmh / DISPLAY_TOP_SPEED, 1 );

		// Update number
		this._speedEl.textContent = Math.round( this._displayedSpeed );

		// Update arc
		this._drawArc( fraction, isBoosting );

		// Update bar
		this._barFill.style.width = ( fraction * 100 ) + '%';

		// Bar color shift during boost
		this._barFill.style.background = isBoosting
			? 'linear-gradient(90deg, #facc15, #fb923c, #ef4444)'
			: 'linear-gradient(90deg, #4ade80, #facc15, #f87171)';

	}

	// ─── Visibility ──────────────────────────────────────────────────────────

	show() {

		this._container.style.display = '';

	}

	hide() {

		this._container.style.display = 'none';

	}

}
