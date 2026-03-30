export class HUD {

	constructor( onRestart ) {

		this._onRestart = onRestart;
		this._currentState = 'idle';

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
		this._resultsEl.appendChild( this._restartBtn );
		document.body.appendChild( this._resultsEl );

		// ── Boost meter bar ──────────────────────────────────────────────────
		this._boostContainer = document.createElement( 'div' );
		this._boostContainer.style.cssText = [
			'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
			'width:200px', 'height:12px', 'background:rgba(0,0,0,0.5)',
			'border-radius:6px', 'overflow:hidden', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
			'border:1px solid rgba(255,255,255,0.2)',
		].join( ';' );

		this._boostFill = document.createElement( 'div' );
		this._boostFill.style.cssText = [
			'width:0%', 'height:100%', 'background:#4fc3f7',
			'border-radius:4px', 'transition:background 0.2s',
		].join( ';' );

		this._boostContainer.appendChild( this._boostFill );
		document.body.appendChild( this._boostContainer );

	}

	update( displayState ) {

		this._currentState = displayState.state;

		switch ( displayState.state ) {

			case 'idle':
				this._countdownEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._resultsEl.style.display = 'none';
				this._boostContainer.style.display = 'none';
				break;

			case 'countdown':
				this._resultsEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._countdownEl.style.display = 'block';
				this._countdownEl.textContent = displayState.countdown > 0
					? displayState.countdown.toString()
					: 'GO!';
				break;

			case 'racing':
				this._countdownEl.style.display = 'none';
				this._resultsEl.style.display = 'none';
				this._raceHud.style.display = 'block';
				this._boostContainer.style.display = 'block';
				this._lapLine.textContent = `Lap ${ displayState.lap + 1 }/${ displayState.totalLaps }`;
				this._timeLine.textContent = this._formatTime( displayState.elapsedTime );
				this._updateBoostBar( displayState );
				break;

			case 'finished':
				this._countdownEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._resultsEl.style.display = 'block';
				this._resultsTotalLine.textContent = `Total: ${ this._formatTime( displayState.totalTime ) }`;
				this._resultsBestLine.textContent = `Best Lap: ${ this._formatTime( displayState.bestLap ) }`;
				break;

		}

	}

	_updateBoostBar( displayState ) {

		const meter = displayState.boostMeter || 0;
		const active = displayState.boostActive || false;

		this._boostFill.style.width = ( meter * 100 ) + '%';

		if ( active ) {

			this._boostFill.style.background = '#ff6d00';

		} else if ( meter >= 1.0 ) {

			this._boostFill.style.background = '#ffd740';

		} else {

			this._boostFill.style.background = '#4fc3f7';

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
