export class Controls {

	constructor( settings, camera ) {

		this.settings = settings;
		this.camera = camera;

		this.keys = {};
		this.x = 0;
		this.z = 0;

		// Touch button state
		this._gasPressed = false;
		this._brakePressed = false;
		this._boostPressed = false;
		this._driftPressed = false;
		this._itemPressed = false;

		// Touch joystick state
		this._steerPointerId = null;
		this._steerStartX = 0;
		this._steerRawX = 0;
		this.touchActive = false;

		// Accelerometer state
		this._accelGamma = 0;
		this._accelEnabled = false;
		this._accelListening = false;

		// Pinch-to-zoom state
		this._activePointers = new Map();
		this._controlPointers = new Set(); // pointerIds owned by touch controls (excluded from pinch)

		// Gamepad
		this._gamepadConnected = false;
		this.gamepadIndex = - 1; // -1 = auto (first found), or specific index

		// Touch UI elements (for teardown/rebuild)
		this._touchContainer = null;
		this._touchCSS = null;

		// Store handler references for dispose()
		this._onKeyDown = ( e ) => this.keys[ e.code ] = true;
		this._onKeyUp = ( e ) => this.keys[ e.code ] = false;
		this._onGamepadConnected = ( e ) => {

			this._gamepadConnected = true;
			console.log( '[Controls] Gamepad connected:', e.gamepad.index, e.gamepad.id );

		};
		this._onGamepadDisconnected = ( e ) => {

			console.log( '[Controls] Gamepad disconnected:', e.gamepad.index, e.gamepad.id );
			const gps = navigator.getGamepads();
			this._gamepadConnected = false;
			for ( let i = 0; i < gps.length; i ++ ) {

				if ( gps[ i ] ) { this._gamepadConnected = true; break; }

			}

		};
		this._onPinchDown = ( e ) => this._onPinchPointerDown( e );
		this._onPinchMoveHandler = ( e ) => this._onPinchPointerMove( e );
		this._onPinchEndHandler = ( e ) => this._onPinchPointerEnd( e );
		this._onVisChange = () => {

			if ( document.visibilityState === 'hidden' ) {

				this._activePointers.clear();
				this._prevPinchDist = undefined;

			}

		};
		this._onSettingsChanged = ( e ) => {

			if ( e.detail.key === 'handedness' ) this._rebuildTouchUI();
			if ( e.detail.key === 'accelerometer' ) this._toggleAccelerometer( e.detail.value );

		};

		window.addEventListener( 'keydown', this._onKeyDown );
		window.addEventListener( 'keyup', this._onKeyUp );
		window.addEventListener( 'gamepadconnected', this._onGamepadConnected );
		window.addEventListener( 'gamepaddisconnected', this._onGamepadDisconnected );

		// Pinch-to-zoom tracking (window-level)
		window.addEventListener( 'pointerdown', this._onPinchDown );
		window.addEventListener( 'pointermove', this._onPinchMoveHandler );
		window.addEventListener( 'pointerup', this._onPinchEndHandler );
		window.addEventListener( 'pointercancel', this._onPinchEndHandler );

		// Clear stale pointers when tab loses focus (prevents phantom pinch gestures)
		document.addEventListener( 'visibilitychange', this._onVisChange );

		// Listen for settings changes
		window.addEventListener( 'settings-changed', this._onSettingsChanged );

		this.setupTouchUI();

		// Init accelerometer if previously enabled
		if ( settings && settings.get( 'accelerometer' ) ) {

			this._toggleAccelerometer( true );

		}

	}

	// ─── Touch UI ─────────────────────────────────────────────────────────────

	setupTouchUI() {

		if ( ! ( 'ontouchstart' in window ) ) return;

		const hand = this.settings ? this.settings.get( 'handedness' ) : 'right';
		const steerSide = hand === 'right' ? 'left' : 'right';
		const btnSide = hand === 'right' ? 'right' : 'left';

		const css = document.createElement( 'style' );
		css.textContent = `
			.touch-controls {
				position: absolute; bottom: 0; left: 0; right: 0; height: 50%;
				pointer-events: none; z-index: 10;
			}
			.steer-zone {
				position: absolute; ${ steerSide }: 0; top: 0; bottom: 0; width: 50%;
				pointer-events: auto; touch-action: none;
			}
			.steer-base {
				position: absolute; bottom: 32px; ${ steerSide }: 32px;
				width: 160px; height: 80px; border-radius: 40px;
				background: rgba(255,255,255,0.06);
				border: 2px solid rgba(255,255,255,0.25);
				display: flex; align-items: center; justify-content: center;
			}
			.steer-knob {
				width: 52px; height: 52px; border-radius: 50%;
				background: rgba(255,255,255,0.15);
				border: 2px solid rgba(255,255,255,0.4);
				pointer-events: none; position: relative;
			}
			.steer-arrow {
				position: absolute; top: 50%; transform: translateY(-50%);
				font-size: 18px; color: rgba(255,255,255,0.3);
				pointer-events: none; user-select: none;
			}
			.steer-arrow-l { left: 12px; }
			.steer-arrow-r { right: 12px; }
			.btn-zone {
				position: absolute; ${ btnSide }: 0; top: 0; bottom: 0; width: 50%;
				pointer-events: none; touch-action: none;
			}
			.touch-btn {
				position: absolute; width: 80px; height: 80px; border-radius: 50%;
				background: rgba(255,255,255,0.06);
				border: 2px solid rgba(255,255,255,0.3);
				pointer-events: auto; touch-action: none;
				display: flex; align-items: center; justify-content: center;
				font-family: sans-serif; font-size: 13px; font-weight: 700;
				color: rgba(255,255,255,0.5); user-select: none;
				-webkit-user-select: none;
				transition: background 0.1s, border-color 0.1s;
			}
			.touch-btn.active {
				background: rgba(255,255,255,0.18);
				border-color: rgba(255,255,255,0.6);
			}
			.touch-btn-gas { bottom: 32px; ${ btnSide }: 110px; border-color: rgba(100,255,100,0.4); color: rgba(100,255,100,0.6); }
			.touch-btn-gas.active { background: rgba(100,255,100,0.18); border-color: rgba(100,255,100,0.7); }
			.touch-btn-brake { bottom: 32px; ${ btnSide }: 20px; border-color: rgba(255,100,100,0.4); color: rgba(255,100,100,0.6); }
			.touch-btn-brake.active { background: rgba(255,100,100,0.18); border-color: rgba(255,100,100,0.7); }
			.touch-btn-boost {
				bottom: 210px; ${ btnSide }: 65px; width: 68px; height: 68px;
				border-color: rgba(255,200,50,0.4); color: rgba(255,200,50,0.6);
			}
			.touch-btn-boost.active { background: rgba(255,200,50,0.18); border-color: rgba(255,200,50,0.7); }
			.touch-btn-drift {
				bottom: 124px; ${ btnSide }: 155px; width: 68px; height: 68px;
				border-color: rgba(100,180,255,0.4); color: rgba(100,180,255,0.6);
			}
			.touch-btn-drift.active { background: rgba(100,180,255,0.18); border-color: rgba(100,180,255,0.7); }
		`;
		document.head.appendChild( css );
		this._touchCSS = css;

		const container = document.createElement( 'div' );
		container.className = 'touch-controls';

		// ── Steering joystick (horizontal only) ──────────────────────────────

		const steerZone = document.createElement( 'div' );
		steerZone.className = 'steer-zone';

		const base = document.createElement( 'div' );
		base.className = 'steer-base';

		const arrowL = document.createElement( 'span' );
		arrowL.className = 'steer-arrow steer-arrow-l';
		arrowL.textContent = '\u25C0';

		const arrowR = document.createElement( 'span' );
		arrowR.className = 'steer-arrow steer-arrow-r';
		arrowR.textContent = '\u25B6';

		const knob = document.createElement( 'div' );
		knob.className = 'steer-knob';

		base.appendChild( arrowL );
		base.appendChild( knob );
		base.appendChild( arrowR );
		steerZone.appendChild( base );
		container.appendChild( steerZone );

		const steerRange = 50;

		steerZone.addEventListener( 'pointerdown', ( e ) => {

			if ( this._steerPointerId !== null ) return;
			steerZone.setPointerCapture( e.pointerId );
			this._steerPointerId = e.pointerId;
			this._steerStartX = e.clientX;
			this._steerRawX = 0;
			this.touchActive = true;
			this._controlPointers.add( e.pointerId );

		} );

		steerZone.addEventListener( 'pointermove', ( e ) => {

			if ( e.pointerId !== this._steerPointerId ) return;
			let dx = ( e.clientX - this._steerStartX ) / steerRange;
			dx = Math.max( - 1, Math.min( 1, dx ) );
			this._steerRawX = dx;
			knob.style.transform = `translateX(${ dx * 50 }px)`;

		} );

		const endSteer = ( e ) => {

			if ( e.pointerId !== this._steerPointerId ) return;
			this._controlPointers.delete( e.pointerId );
			this._steerPointerId = null;
			this._steerRawX = 0;
			knob.style.transform = '';
			this._clearTouchActiveIfIdle();

		};

		steerZone.addEventListener( 'pointerup', endSteer );
		steerZone.addEventListener( 'pointercancel', endSteer );

		// ── Action buttons ───────────────────────────────────────────────────

		const btnZone = document.createElement( 'div' );
		btnZone.className = 'btn-zone';

		const gasBtn = this._createButton( 'GAS', 'touch-btn touch-btn-gas', ( pressed ) => {

			this._gasPressed = pressed;
			if ( pressed ) this.touchActive = true;
			else this._clearTouchActiveIfIdle();

		} );

		const brakeBtn = this._createButton( 'BRK', 'touch-btn touch-btn-brake', ( pressed ) => {

			this._brakePressed = pressed;
			if ( pressed ) this.touchActive = true;
			else this._clearTouchActiveIfIdle();

		} );

		const boostBtn = this._createButton( 'NOS', 'touch-btn touch-btn-boost', ( pressed ) => {

			this._boostPressed = pressed;
			if ( pressed ) this.touchActive = true;
			else this._clearTouchActiveIfIdle();

		} );

		const driftBtn = this._createButton( 'DFT', 'touch-btn touch-btn-drift', ( pressed ) => {

			this._driftPressed = pressed;
			if ( pressed ) this.touchActive = true;
			else this._clearTouchActiveIfIdle();

		} );

		const itemBtn = this._createButton( 'USE', 'touch-btn touch-btn-item', ( pressed ) => {

			this._itemPressed = pressed;
			if ( pressed ) this.touchActive = true;
			else this._clearTouchActiveIfIdle();

		} );

		btnZone.appendChild( gasBtn );
		btnZone.appendChild( brakeBtn );
		btnZone.appendChild( boostBtn );
		btnZone.appendChild( driftBtn );
		btnZone.appendChild( itemBtn );
		container.appendChild( btnZone );

		document.body.appendChild( container );
		this._touchContainer = container;

		// Hide joystick if accelerometer is active
		if ( this._accelEnabled ) {

			steerZone.style.display = 'none';

		}

		this._steerZone = steerZone;

	}

	_clearTouchActiveIfIdle() {

		if ( ! this._gasPressed && ! this._brakePressed && ! this._boostPressed && ! this._driftPressed && ! this._itemPressed && ! this._steerPointerId ) {

			this.touchActive = false;

		}

	}

	_createButton( label, className, onToggle ) {

		const btn = document.createElement( 'div' );
		btn.className = className;
		btn.textContent = label;

		btn.addEventListener( 'pointerdown', ( e ) => {

			btn.setPointerCapture( e.pointerId );
			btn.classList.add( 'active' );
			this._controlPointers.add( e.pointerId );
			onToggle( true );

		} );

		const release = ( e ) => {

			btn.classList.remove( 'active' );
			this._controlPointers.delete( e.pointerId );
			onToggle( false );

		};

		btn.addEventListener( 'pointerup', release );
		btn.addEventListener( 'pointercancel', release );

		return btn;

	}

	_rebuildTouchUI() {

		// Tear down existing
		if ( this._touchContainer ) {

			this._touchContainer.remove();
			this._touchContainer = null;

		}

		if ( this._touchCSS ) {

			this._touchCSS.remove();
			this._touchCSS = null;

		}

		// Reset state
		this._steerPointerId = null;
		this._steerRawX = 0;
		this._gasPressed = false;
		this._brakePressed = false;
		this._boostPressed = false;
		this._itemPressed = false;
		this.touchActive = false;
		this._controlPointers.clear();

		this.setupTouchUI();

	}

	// ─── Accelerometer ───────────────────────────────────────────────────────

	_toggleAccelerometer( enabled ) {

		this._accelEnabled = enabled;

		if ( enabled && ! this._accelListening ) {

			this._requestAccelPermission().then( ( granted ) => {

				if ( granted ) {

					this._accelHandler = ( e ) => {

						this._accelGamma = e.gamma || 0;

					};
					window.addEventListener( 'deviceorientation', this._accelHandler );
					this._accelListening = true;

				} else {

					// Permission denied — revert setting to restore joystick steering
					console.warn( 'Controls: accelerometer permission denied, reverting to joystick' );
					this._accelEnabled = false;
					if ( this.settings ) this.settings.set( 'accelerometer', false );

				}

			} );

		} else if ( ! enabled && this._accelListening ) {

			window.removeEventListener( 'deviceorientation', this._accelHandler );
			this._accelListening = false;

		}

		// Show/hide joystick
		if ( this._steerZone ) {

			this._steerZone.style.display = enabled ? 'none' : '';

		}

	}

	async _requestAccelPermission() {

		if ( typeof DeviceOrientationEvent !== 'undefined' &&
			typeof DeviceOrientationEvent.requestPermission === 'function' ) {

			try {

				const perm = await DeviceOrientationEvent.requestPermission();
				return perm === 'granted';

			} catch ( e ) {

				return false;

			}

		}

		// Android or desktop — no permission needed
		return true;

	}

	// ─── Pinch-to-Zoom ──────────────────────────────────────────────────────

	_onPinchPointerDown( e ) {

		if ( this._controlPointers.has( e.pointerId ) ) return;
		this._activePointers.set( e.pointerId, { x: e.clientX, y: e.clientY } );

	}

	_onPinchPointerMove( e ) {

		if ( ! this._activePointers.has( e.pointerId ) ) return;
		this._activePointers.set( e.pointerId, { x: e.clientX, y: e.clientY } );

		if ( this._activePointers.size >= 2 && this.camera ) {

			const pts = [ ...this._activePointers.values() ];
			const dx = pts[ 0 ].x - pts[ 1 ].x;
			const dy = pts[ 0 ].y - pts[ 1 ].y;
			const dist = Math.sqrt( dx * dx + dy * dy );

			if ( this._prevPinchDist !== undefined ) {

				const scale = dist / this._prevPinchDist;
				this.camera.zoom = Math.max( 0.5, Math.min( 3.0,
					this.camera.zoom / scale
				) );

			}

			this._prevPinchDist = dist;

		}

	}

	_onPinchPointerEnd( e ) {

		this._activePointers.delete( e.pointerId );
		if ( this._activePointers.size < 2 ) {

			this._prevPinchDist = undefined;

		}

	}

	// ─── Quantize steering to 3 levels ───────────────────────────────────────

	_quantizeSteer( raw ) {

		const sign = Math.sign( raw );
		const abs = Math.abs( raw );
		if ( abs < 0.1 ) return 0;
		if ( abs < 0.33 ) return sign * 0.33;
		if ( abs < 0.66 ) return sign * 0.66;
		return sign * 1.0;

	}

	_getGamepad() {

		const gamepads = navigator.getGamepads();

		if ( this.gamepadIndex >= 0 ) return gamepads[ this.gamepadIndex ] || null;

		for ( let i = 0; i < gamepads.length; i ++ ) {

			if ( gamepads[ i ] ) return gamepads[ i ];

		}

		return null;

	}

	// ─── Main update ─────────────────────────────────────────────────────────

	update() {

		let x = 0, z = 0;

		// Keyboard

		if ( this.keys[ 'KeyA' ] || this.keys[ 'ArrowLeft' ] ) x -= 1;
		if ( this.keys[ 'KeyD' ] || this.keys[ 'ArrowRight' ] ) x += 1;
		if ( this.keys[ 'KeyW' ] || this.keys[ 'ArrowUp' ] ) z += 1;
		if ( this.keys[ 'KeyS' ] || this.keys[ 'ArrowDown' ] ) z -= 1;

		// Gamepad

		const gp = this._getGamepad();

		if ( ! this._gpLogDone ) {

			this._gpLogDone = true;
			const gps = navigator.getGamepads();
			console.log( '[Controls] Gamepad poll:', gp ? `found [${gp.index}] "${gp.id}"` : 'NONE',
				`| slots: ${gps.length}`, `| idx setting: ${this.gamepadIndex}` );

		}

		if ( gp ) {

			const stickX = gp.axes[ 0 ];
			if ( Math.abs( stickX ) > 0.15 ) x = stickX;

			const rt = gp.buttons[ 7 ] ? gp.buttons[ 7 ].value : 0;
			const lt = gp.buttons[ 6 ] ? gp.buttons[ 6 ].value : 0;

			if ( rt > 0.1 || lt > 0.1 ) z = rt - lt;

		}

		// Touch — separate joystick + buttons
		let gas = false, brake = false;

		if ( this.touchActive ) {

			// Steering: accelerometer or joystick
			if ( this._accelEnabled && this._accelListening ) {

				const gamma = Math.max( - 30, Math.min( 30, this._accelGamma ) );
				const normalized = gamma / 30;
				x = Math.abs( normalized ) < 0.12 ? 0 : this._quantizeSteer( normalized );

			} else {

				x = this._quantizeSteer( this._steerRawX );

			}

			gas = this._gasPressed;
			brake = this._brakePressed;
			z = gas ? 1 : ( brake ? - 1 : 0 );

		}

		this.x = x;
		this.z = z;

		let boost = this._boostPressed || !! this.keys[ 'ShiftLeft' ] || !! this.keys[ 'ShiftRight' ];

		let drift = this._driftPressed || !! this.keys[ 'Space' ];

		// Gamepad L1/LB for drift, R1/RB for boost
		if ( gp ) {

			if ( gp.buttons[ 4 ] && gp.buttons[ 4 ].pressed ) drift = true;
			if ( gp.buttons[ 5 ] && gp.buttons[ 5 ].pressed ) boost = true;

		}

		// Item use: E key, touch button, or gamepad X (button 2)
		let useItem = !! this.keys[ 'KeyE' ] || this._itemPressed;

		if ( gp && ! useItem ) {

			if ( gp.buttons[ 2 ] && gp.buttons[ 2 ].pressed ) useItem = true;

		}

		// Camera: right stick orbit, R3 look-behind, Y cycle view, D-pad zoom
		let orbitX = 0;
		let zoomIn = false, zoomOut = false;
		let lookBehind = !! this.keys[ 'Backspace' ];
		let switchView = false;
		let jump = false;

		if ( gp ) {

			const rStickX = gp.axes[ 2 ] || 0;
			if ( Math.abs( rStickX ) > 0.15 ) orbitX = rStickX;

			// D-pad up (12) = zoom in, D-pad down (13) = zoom out
			if ( gp.buttons[ 12 ] && gp.buttons[ 12 ].pressed ) zoomIn = true;
			if ( gp.buttons[ 13 ] && gp.buttons[ 13 ].pressed ) zoomOut = true;

			// R3 (button 11) = look behind
			if ( gp.buttons[ 11 ] && gp.buttons[ 11 ].pressed ) lookBehind = true;

			// Y/Triangle (button 3) = switch camera view
			if ( gp.buttons[ 3 ] && gp.buttons[ 3 ].pressed ) switchView = true;

			// A (button 0) = jump (reserved)
			if ( gp.buttons[ 0 ] && gp.buttons[ 0 ].pressed ) jump = true;

		}

		return { x, z, touchActive: this.touchActive, boost, drift, gas, brake, useItem, orbitX, zoomIn, zoomOut, lookBehind, switchView, jump };

	}

	dispose() {

		window.removeEventListener( 'keydown', this._onKeyDown );
		window.removeEventListener( 'keyup', this._onKeyUp );
		window.removeEventListener( 'gamepadconnected', this._onGamepadConnected );
		window.removeEventListener( 'gamepaddisconnected', this._onGamepadDisconnected );
		window.removeEventListener( 'pointerdown', this._onPinchDown );
		window.removeEventListener( 'pointermove', this._onPinchMoveHandler );
		window.removeEventListener( 'pointerup', this._onPinchEndHandler );
		window.removeEventListener( 'pointercancel', this._onPinchEndHandler );
		document.removeEventListener( 'visibilitychange', this._onVisChange );
		window.removeEventListener( 'settings-changed', this._onSettingsChanged );

		// Remove accelerometer listener if active
		if ( this._accelListening && this._accelHandler ) {

			window.removeEventListener( 'deviceorientation', this._accelHandler );
			this._accelListening = false;

		}

		// Remove touch UI
		if ( this._touchContainer ) {

			this._touchContainer.remove();
			this._touchContainer = null;

		}

		if ( this._touchCSS ) {

			this._touchCSS.remove();
			this._touchCSS = null;

		}

	}

}
