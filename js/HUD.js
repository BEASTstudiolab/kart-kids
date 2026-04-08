import { SpringAnimator } from './SpringAnimator.js';

export class HUD {

	constructor( onRestart, onReady ) {

		this._onRestart = onRestart;
		this._onReady = onReady;
		this._currentState = 'idle';

		// ── Inject CSS keyframes for animations ──────────────────────────────
		const styleEl = document.createElement( 'style' );
		styleEl.textContent = [
			'@keyframes boostPulse { from { opacity: 0.7; } to { opacity: 1.0; } }',
			'@keyframes countPunch { from { transform: scale(1.4); } to { transform: scale(1.0); } }',
		].join( ' ' );
		document.head.appendChild( styleEl );

		// Track last countdown value to detect changes and trigger the punch
		this._lastCountdownText = '';

		// Spring animators for HUD elements
		this._countdownSpring = new SpringAnimator( 150, 12 );
		this._countdownSpring.reset( 1 );
		this._lapSpring = new SpringAnimator( 150, 12 );
		this._lapSpring.reset( 1 );
		this._powerupSpring = new SpringAnimator( 150, 12 );
		this._powerupSpring.reset( 0 );
		this._lastLap = - 1;

		// ── Countdown overlay (centered, large text) ─────────────────────────
		this._countdownEl = document.createElement( 'div' );
		this._countdownEl.style.cssText = [
			'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
			'font:bold 120px/1 monospace', 'color:#fff', 'background:none',
			'text-shadow:0 0 40px rgba(255,255,255,0.6), 0 4px 12px rgba(0,0,0,0.8)',
			'z-index:1000', 'pointer-events:none', 'user-select:none', 'display:none',
		].join( ';' );
		document.body.appendChild( this._countdownEl );

		// ── Race HUD (top-center: lap + time) ────────────────────────────────
		this._raceHud = document.createElement( 'div' );
		this._raceHud.style.cssText = [
			'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
			'background:rgba(0,0,0,0.65)', 'color:#fff', 'font:bold 18px/1.4 monospace',
			'padding:8px 20px', 'border-radius:8px', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
			'text-align:center', 'min-width:180px',
		].join( ';' );

		this._lapLine = document.createElement( 'div' );
		this._timeLine = document.createElement( 'div' );
		this._raceHud.appendChild( this._lapLine );
		this._raceHud.appendChild( this._timeLine );
		document.body.appendChild( this._raceHud );

		// ── Results overlay (centered panel) ─────────────────────────────────
		this._resultsEl = document.createElement( 'div' );
		this._resultsEl.style.cssText = [
			'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
			'background:rgba(0,0,0,0.82)', 'color:#fff', 'font:bold 22px/1.6 monospace',
			'padding:32px 48px', 'border-radius:12px', 'z-index:1000',
			'text-align:center', 'user-select:none', 'display:none',
		].join( ';' );

		this._resultsTitle = document.createElement( 'div' );
		this._resultsTitle.textContent = 'FINISH!';
		this._resultsTitle.style.cssText = 'font-size:36px; margin-bottom:16px';

		this._resultsTotalLine = document.createElement( 'div' );
		this._resultsBestLine = document.createElement( 'div' );

		this._resultsLapContainer = document.createElement( 'div' );
		this._resultsLapContainer.style.cssText = [
			'font-size:14px', 'margin-top:12px', 'text-align:left',
			'max-height:120px', 'overflow-y:auto',
		].join( ';' );

		this._restartBtn = document.createElement( 'button' );
		this._restartBtn.textContent = 'RESTART';
		this._restartBtn.style.cssText = [
			'font:bold 20px monospace', 'margin-top:20px', 'padding:10px 32px',
			'background:#fff', 'color:#000', 'border:none', 'border-radius:6px',
			'cursor:pointer',
		].join( ';' );
		this._restartBtn.addEventListener( 'click', () => {

			if ( this._onRestart ) this._onRestart();

		} );

		this._resultsEl.appendChild( this._resultsTitle );
		this._resultsEl.appendChild( this._resultsTotalLine );
		this._resultsEl.appendChild( this._resultsBestLine );
		this._resultsEl.appendChild( this._resultsLapContainer );
		this._resultsEl.appendChild( this._restartBtn );
		document.body.appendChild( this._resultsEl );

		// ── Boost meter bar ──────────────────────────────────────────────────
		this._boostContainer = document.createElement( 'div' );
		this._boostContainer.style.cssText = [
			'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
			'width:200px', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
		].join( ';' );

		this._boostLabel = document.createElement( 'div' );
		this._boostLabel.textContent = 'BOOST';
		this._boostLabel.style.cssText = [
			'font:bold 10px sans-serif', 'color:rgba(255,255,255,0.6)',
			'text-align:center', 'margin-bottom:2px',
		].join( ';' );

		this._boostTrack = document.createElement( 'div' );
		this._boostTrack.style.cssText = [
			'width:200px', 'height:12px', 'background:rgba(0,0,0,0.5)',
			'border-radius:6px', 'overflow:hidden',
			'border:1px solid rgba(255,255,255,0.2)',
		].join( ';' );

		this._boostFill = document.createElement( 'div' );
		this._boostFill.style.cssText = [
			'width:0%', 'height:100%', 'background:#4fc3f7',
			'border-radius:4px', 'transition:background 0.2s',
		].join( ';' );

		this._boostTrack.appendChild( this._boostFill );
		this._boostContainer.appendChild( this._boostLabel );
		this._boostContainer.appendChild( this._boostTrack );
		document.body.appendChild( this._boostContainer );

		// ── Drift tier indicator ─────────────────────────────────────────────
		this._driftEl = document.createElement( 'div' );
		this._driftEl.style.cssText = [
			'position:fixed', 'bottom:60px', 'left:50%', 'transform:translateX(-50%)',
			'font:bold 18px sans-serif', 'padding:4px 16px',
			'border-radius:6px', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
			'text-align:center', 'text-shadow:0 0 8px currentColor',
		].join( ';' );
		document.body.appendChild( this._driftEl );

		// ── Powerup indicator ────────────────────────────────────────────────
		this._powerupEl = document.createElement( 'div' );
		this._powerupEl.style.cssText = [
			'position:fixed', 'bottom:44px', 'left:50%', 'transform:translateX(-50%)',
			'font:bold 12px sans-serif', 'padding:3px 12px',
			'border-radius:4px', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
			'text-align:center',
		].join( ';' );
		document.body.appendChild( this._powerupEl );

		// ── Lobby panel (top-center: status + ready button) ──────────────────
		this._lobbyPanel = document.createElement( 'div' );
		this._lobbyPanel.style.cssText = [
			'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
			'background:rgba(0,0,0,0.65)', 'color:#fff', 'font:bold 18px/1.4 monospace',
			'padding:12px 24px', 'border-radius:8px', 'z-index:1000',
			'user-select:none', 'display:none', 'text-align:center', 'min-width:220px',
		].join( ';' );

		this._lobbyStatusLine = document.createElement( 'div' );
		this._lobbyStatusLine.style.cssText = 'margin-bottom:8px';

		this._readyBtn = document.createElement( 'button' );
		this._readyBtn.textContent = 'READY';
		this._readyBtn.style.cssText = [
			'font:bold 18px monospace', 'padding:8px 28px',
			'background:#4caf50', 'color:#fff', 'border:none', 'border-radius:6px',
			'cursor:pointer', 'display:none',
		].join( ';' );
		this._readyBtn.addEventListener( 'click', () => {

			if ( this._onReady ) this._onReady();

		} );

		this._lobbyPanel.appendChild( this._lobbyStatusLine );
		this._lobbyPanel.appendChild( this._readyBtn );
		document.body.appendChild( this._lobbyPanel );

	}

	update( dt, displayState, lobbyState ) {

		this._currentState = displayState.state;

		switch ( displayState.state ) {

			case 'idle':
				this._countdownEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._resultsEl.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._powerupEl.style.display = 'none';
				this._updateLobby( lobbyState );
				break;

			case 'countdown': {
				this._lobbyPanel.style.display = 'none';
				this._resultsEl.style.display = 'none';
				this._resultsLapContainer.innerHTML = '';
				this._raceHud.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._countdownEl.style.display = 'block';

				const countText = displayState.countdown > 0
					? displayState.countdown.toString()
					: 'GO!';

				// Per-number color
				const COUNT_COLORS = { '3': '#ff4444', '2': '#ffaa00', '1': '#44ff44', 'GO!': '#00ddff' };
				this._countdownEl.style.color = COUNT_COLORS[ countText ] || '#ffffff';

				// Spring-driven scale punch on change
				if ( countText !== this._lastCountdownText ) {

					this._countdownEl.textContent = countText;
					this._lastCountdownText = countText;
					this._countdownSpring.position = 1.5;
					this._countdownSpring.velocity = 0;
					this._countdownSpring.setTarget( 1.0 );

				}

				const countScale = this._countdownSpring.update( dt );
				this._countdownEl.style.transform = `translate(-50%, -50%) scale(${ countScale })`;

				break;
			}

			case 'racing':
				this._lobbyPanel.style.display = 'none';
				this._countdownEl.style.display = 'none';
				this._resultsEl.style.display = 'none';
				this._raceHud.style.display = 'block';
				this._boostContainer.style.display = 'block';
				this._lapLine.textContent = `Lap ${ displayState.lap + 1 }/${ displayState.totalLaps }`;
				this._timeLine.textContent = this._formatTime( displayState.elapsedTime );

				// Spring bounce on lap change
				if ( displayState.lap !== this._lastLap ) {

					this._lapSpring.position = 1.3;
					this._lapSpring.velocity = 0;
					this._lapSpring.setTarget( 1.0 );
					this._lastLap = displayState.lap;

				}

				const lapScale = this._lapSpring.update( dt );
				this._lapLine.style.transform = `scale(${ lapScale })`;

				this._updateBoostBar( displayState );
				this._updateDriftIndicator( displayState );
				this._updatePowerupIndicator( dt, displayState );
				break;

			case 'finished':
				this._lobbyPanel.style.display = 'none';
				this._countdownEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._powerupEl.style.display = 'none';
				this._resultsEl.style.display = 'block';
				this._resultsTotalLine.textContent = `Total: ${ this._formatTime( displayState.totalTime ) }`;
				this._resultsBestLine.textContent = `Best Lap: ${ this._formatTime( displayState.bestLap ) }`;

				// Per-lap breakdown (populate once)
				if ( displayState.lapTimes && displayState.lapTimes.length > 0 &&
					this._resultsLapContainer.childElementCount === 0 ) {

					const best = displayState.bestLap;
					let worst = 0;

					for ( let i = 0; i < displayState.lapTimes.length; i ++ ) {

						if ( displayState.lapTimes[ i ] > worst ) worst = displayState.lapTimes[ i ];

					}

					for ( let i = 0; i < displayState.lapTimes.length; i ++ ) {

						const t = displayState.lapTimes[ i ];
						const row = document.createElement( 'div' );
						row.style.cssText = 'display:flex; justify-content:space-between; padding:2px 0';

						let color = '#ccc';
						if ( displayState.lapTimes.length > 1 ) {

							if ( t <= best ) color = '#44ff44';
							else if ( t >= worst ) color = '#ff4444';

						}

						row.innerHTML = `<span>Lap ${ i + 1 }</span><span style="color:${ color }">${ this._formatTime( t ) }</span>`;
						this._resultsLapContainer.appendChild( row );

					}

				}

				break;

		}

	}

	_updateLobby( lobbyState ) {

		if ( ! lobbyState || ! lobbyState.inZone ) {

			this._lobbyPanel.style.display = 'none';
			return;

		}

		this._lobbyPanel.style.display = 'block';

		if ( lobbyState.dwelling ) {

			this._lobbyStatusLine.textContent = 'Entering lobby...';
			this._readyBtn.style.display = 'none';

		} else if ( lobbyState.dwellComplete ) {

			this._lobbyStatusLine.textContent = `Players ready ${ lobbyState.readyCount }/${ lobbyState.zoneCount }`;

			if ( lobbyState.isReady ) {

				this._readyBtn.textContent = 'READY!';
				this._readyBtn.style.background = '#888';
				this._readyBtn.style.cursor = 'default';
				this._readyBtn.style.display = 'block';

			} else {

				this._readyBtn.textContent = 'READY';
				this._readyBtn.style.background = '#4caf50';
				this._readyBtn.style.cursor = 'pointer';
				this._readyBtn.style.display = 'block';

			}

		}

	}

	_updateBoostBar( displayState ) {

		const meter = displayState.boostMeter || 0;
		const active = displayState.boostActive || false;

		this._boostFill.style.width = ( meter * 100 ) + '%';

		if ( active ) {

			this._boostFill.style.background = '#ff6d00';
			this._boostFill.style.animation = 'none';

		} else if ( meter >= 1.0 ) {

			this._boostFill.style.background = '#ffd740';
			this._boostFill.style.animation = 'boostPulse 0.6s ease-in-out infinite alternate';

		} else {

			this._boostFill.style.background = '#4fc3f7';
			this._boostFill.style.animation = 'none';

		}

	}

	_updateDriftIndicator( displayState ) {

		const tier = displayState.driftSparkTier || 0;
		const active = displayState.driftActive || false;

		if ( ! active || tier === 0 ) {

			this._driftEl.style.display = 'none';
			return;

		}

		this._driftEl.style.display = 'block';

		const TIER_CONFIG = [
			null,
			{ text: 'DRIFT!', color: '#4488ff' },
			{ text: 'DRIFT!!', color: '#ff8800' },
			{ text: 'DRIFT!!!', color: '#aa44ff' },
		];

		const cfg = TIER_CONFIG[ tier ];
		this._driftEl.textContent = cfg.text;
		this._driftEl.style.color = cfg.color;

	}

	_updatePowerupIndicator( dt, displayState ) {

		const active = displayState.starActive || displayState.shieldActive;
		const wasActive = this._powerupSpring.target > 0.5;

		if ( active && ! wasActive ) {

			this._powerupSpring.position = 0;
			this._powerupSpring.velocity = 0;
			this._powerupSpring.setTarget( 1.0 );

		} else if ( ! active && wasActive ) {

			this._powerupSpring.setTarget( 0 );

		}

		const pScale = this._powerupSpring.update( dt );

		if ( pScale > 0.01 ) {

			this._powerupEl.style.display = 'block';
			this._powerupEl.style.transform = `scale(${ pScale })`;

			if ( displayState.starActive ) {

				this._powerupEl.textContent = 'STAR';
				this._powerupEl.style.background = 'rgba(255,200,0,0.8)';
				this._powerupEl.style.color = '#000';

			} else {

				this._powerupEl.textContent = 'SHIELD';
				this._powerupEl.style.background = 'rgba(0,200,80,0.8)';
				this._powerupEl.style.color = '#fff';

			}

		} else {

			this._powerupEl.style.display = 'none';

		}

	}

	_formatTime( seconds ) {

		if ( seconds <= 0 ) return '00:00.000';

		const mins = Math.floor( seconds / 60 );
		const secs = seconds % 60;
		const whole = Math.floor( secs );
		const ms = Math.floor( ( secs - whole ) * 1000 );

		return String( mins ).padStart( 2, '0' ) + ':' +
			String( whole ).padStart( 2, '0' ) + '.' +
			String( ms ).padStart( 3, '0' );

	}

}
