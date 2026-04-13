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

		// ── Player position badge (top-right) ────────────────────────────────
		this._playerPlaceBadge = document.createElement( 'div' );
		this._playerPlaceBadge.style.cssText = [
			'position:fixed', 'top:16px', 'right:16px',
			'background:rgba(6,10,18,0.78)', 'color:#fff',
			'border:1px solid rgba(79,195,247,0.45)', 'border-radius:12px',
			'box-shadow:0 10px 28px rgba(0,0,0,0.24)',
			'backdrop-filter:blur(8px)', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
			'text-align:center', 'text-transform:uppercase',
		].join( ';' );

		this._playerPlaceLabel = document.createElement( 'div' );
		this._playerPlaceLabel.textContent = 'YOU';
		this._playerPlaceLabel.style.cssText = [
			'font:bold 10px/1.1 monospace', 'letter-spacing:1.2px',
			'color:rgba(255,255,255,0.65)', 'margin-bottom:4px',
		].join( ';' );

		this._playerPlaceValue = document.createElement( 'div' );
		this._playerPlaceValue.style.cssText = [
			'font:bold 28px/1 monospace', 'letter-spacing:1px',
			'color:#ffffff',
		].join( ';' );

		this._playerPlaceBadge.appendChild( this._playerPlaceLabel );
		this._playerPlaceBadge.appendChild( this._playerPlaceValue );
		document.body.appendChild( this._playerPlaceBadge );

		// ── Top-three leaderboard (top-right) ────────────────────────────────
		this._leaderboardEl = document.createElement( 'div' );
		this._leaderboardEl.style.cssText = [
			'position:fixed', 'top:86px', 'right:16px',
			'background:rgba(6,10,18,0.74)', 'color:#fff',
			'border:1px solid rgba(255,255,255,0.12)', 'border-radius:14px',
			'box-shadow:0 14px 34px rgba(0,0,0,0.26)',
			'backdrop-filter:blur(8px)', 'z-index:1000',
			'pointer-events:none', 'user-select:none', 'display:none',
			'text-transform:uppercase',
		].join( ';' );

		this._leaderboardTitle = document.createElement( 'div' );
		this._leaderboardTitle.textContent = 'Top 3';
		this._leaderboardTitle.style.cssText = [
			'font:bold 11px/1 monospace', 'letter-spacing:1.4px',
			'color:rgba(255,255,255,0.62)', 'margin-bottom:8px',
		].join( ';' );
		this._leaderboardEl.appendChild( this._leaderboardTitle );

		this._leaderboardList = document.createElement( 'div' );
		this._leaderboardList.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
		this._leaderboardEl.appendChild( this._leaderboardList );

		this._leaderboardRows = [];
		for ( let i = 0; i < 3; i ++ ) {

			const row = document.createElement( 'div' );
			row.style.cssText = [
				'display:none', 'align-items:center', 'gap:10px',
				'border:1px solid rgba(255,255,255,0.08)', 'border-radius:10px',
				'background:rgba(255,255,255,0.04)', 'padding:7px 9px',
			].join( ';' );

			const placeEl = document.createElement( 'div' );
			placeEl.style.cssText = [
				'font:bold 14px/1 monospace', 'min-width:34px',
				'color:#ffffff',
			].join( ';' );

			const nameEl = document.createElement( 'div' );
			nameEl.style.cssText = [
				'font:bold 13px/1.1 monospace', 'color:#ffffff', 'flex:1',
			].join( ';' );
			nameEl.style.overflow = 'hidden';
			nameEl.style.textOverflow = 'ellipsis';
			nameEl.style.whiteSpace = 'nowrap';

			row.appendChild( placeEl );
			row.appendChild( nameEl );
			this._leaderboardList.appendChild( row );
			this._leaderboardRows.push( { root: row, placeEl, nameEl } );

		}

		document.body.appendChild( this._leaderboardEl );

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

		// ── Aerial hint ─────────────────────────────────────────────────────
		this._aerialHintEl = document.createElement( 'div' );
		this._aerialHintEl.style.cssText = [
			'position:fixed', 'top:38%', 'left:50%', 'transform:translate(-50%,-50%)',
			'font:bold 26px/1 monospace', 'letter-spacing:1px',
			'color:#fff6bf', 'background:rgba(0,0,0,0.68)',
			'padding:10px 18px', 'border-radius:10px',
			'border:1px solid rgba(255,255,255,0.18)',
			'box-shadow:0 10px 28px rgba(0,0,0,0.28)',
			'text-shadow:0 0 18px rgba(255,240,140,0.35)',
			'z-index:1000', 'pointer-events:none', 'user-select:none', 'display:none',
			'white-space:nowrap',
		].join( ';' );
		document.body.appendChild( this._aerialHintEl );

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

		this._applyRacePositionLayout();

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
				this._aerialHintEl.style.display = 'none';
				this._playerPlaceBadge.style.display = 'none';
				this._leaderboardEl.style.display = 'none';
				this._updateLobby( lobbyState );
				break;

			case 'countdown': {
				this._lobbyPanel.style.display = 'none';
				this._resultsEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._aerialHintEl.style.display = 'none';
				this._playerPlaceBadge.style.display = 'none';
				this._leaderboardEl.style.display = 'none';
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
				this._updateAerialHint( displayState );
				this._updateRacePositionHud( displayState );
				break;

			case 'finished':
				this._lobbyPanel.style.display = 'none';
				this._countdownEl.style.display = 'none';
				this._raceHud.style.display = 'none';
				this._boostContainer.style.display = 'none';
				this._powerupEl.style.display = 'none';
				this._aerialHintEl.style.display = 'none';
				this._playerPlaceBadge.style.display = 'none';
				this._leaderboardEl.style.display = 'none';
				this._resultsEl.style.display = 'block';
				this._resultsTotalLine.textContent = `Total: ${ this._formatTime( displayState.totalTime ) }`;
				this._resultsBestLine.textContent = `Best Lap: ${ this._formatTime( displayState.bestLap ) }`;
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

	_updateAerialHint( displayState ) {

		if ( ! displayState.aerialHintActive ) {

			this._aerialHintEl.style.display = 'none';
			return;

		}

		this._aerialHintEl.style.display = 'block';
		this._aerialHintEl.textContent = displayState.aerialHintText || 'HOLD DRIFT + TAP A DIRECTION';

	}

	_updateRacePositionHud( displayState ) {

		this._applyRacePositionLayout();
		this._playerPlaceBadge.style.display = 'block';
		this._leaderboardEl.style.display = 'block';
		this._playerPlaceValue.textContent = displayState.positionLabel || '1ST';

		const leaders = Array.isArray( displayState.leaders ) ? displayState.leaders : [];
		if ( leaders.length === 0 ) this._leaderboardEl.style.display = 'none';

		for ( let i = 0; i < this._leaderboardRows.length; i ++ ) {

			const row = this._leaderboardRows[ i ];
			const leader = leaders[ i ];

			if ( ! leader ) {

				row.root.style.display = 'none';
				continue;

			}

			row.root.style.display = 'flex';
			row.placeEl.textContent = `#${ leader.position }`;
			row.nameEl.textContent = leader.name || 'PLAYER';
			this._applyLeaderboardRowStyle( row, leader.position, leader.isLocal );

		}

	}

	_applyRacePositionLayout() {

		const narrow = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 900;
		const inset = narrow ? 12 : 16;
		const badgeWidth = narrow ? 86 : 102;
		const badgeTop = narrow ? 12 : 16;
		const panelTop = narrow ? 72 : 86;
		const panelWidth = narrow ? 180 : 220;
		const badgePadding = narrow ? '8px 10px' : '10px 12px';
		const panelPadding = narrow ? '8px 10px 10px' : '10px 12px 12px';
		const valueSize = narrow ? '24px' : '28px';
		const rowNameWidth = narrow ? '112px' : '148px';

		this._playerPlaceBadge.style.top = `${ badgeTop }px`;
		this._playerPlaceBadge.style.right = `${ inset }px`;
		this._playerPlaceBadge.style.width = `${ badgeWidth }px`;
		this._playerPlaceBadge.style.padding = badgePadding;
		this._playerPlaceValue.style.fontSize = valueSize;

		this._leaderboardEl.style.top = `${ panelTop }px`;
		this._leaderboardEl.style.right = `${ inset }px`;
		this._leaderboardEl.style.width = `${ panelWidth }px`;
		this._leaderboardEl.style.padding = panelPadding;

		for ( const row of this._leaderboardRows ) {

			row.nameEl.style.maxWidth = rowNameWidth;

		}

	}

	_applyLeaderboardRowStyle( row, position, isLocal ) {

		const podiumColors = {
			1: '#f6c445',
			2: '#cdd6e3',
			3: '#d98a4e',
		};
		const accent = podiumColors[ position ] || '#ffffff';
		const border = isLocal ? '#4fc3f7' : accent;
		const background = isLocal
			? 'rgba(79,195,247,0.14)'
			: position === 1
				? 'rgba(246,196,69,0.12)'
				: position === 2
					? 'rgba(205,214,227,0.10)'
					: 'rgba(217,138,78,0.10)';

		row.root.style.borderColor = border;
		row.root.style.background = background;
		row.placeEl.style.color = accent;
		row.nameEl.style.color = isLocal ? '#9fe6ff' : '#ffffff';

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
