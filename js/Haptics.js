export class Haptics {

	constructor() {

		this._gamepad = null;
		this._rumbleTimer = 0;
		this._rumbleInterval = 0.1; // re-trigger every 100ms

		this._onConnected = ( e ) => {

			if ( e.gamepad.vibrationActuator ) {

				this._gamepad = e.gamepad;

			}

		};

		this._onDisconnected = ( e ) => {

			if ( this._gamepad && this._gamepad.index === e.gamepad.index ) {

				this._gamepad = null;

			}

		};

		window.addEventListener( 'gamepadconnected', this._onConnected );
		window.addEventListener( 'gamepaddisconnected', this._onDisconnected );

	}

	update( dt ) {

		if ( this._rumbleTimer > 0 ) this._rumbleTimer -= dt;

	}

	_getGamepad() {

		// Cached gamepad references go stale each frame in some browsers;
		// re-resolve from the index when a vibration call needs it
		if ( this._gamepad === null ) return null;

		const fresh = navigator.getGamepads()[ this._gamepad.index ];
		return ( fresh && fresh.vibrationActuator ) ? fresh : null;

	}

	setRumble( intensity ) {

		const gp = this._getGamepad();
		if ( ! gp || this._rumbleTimer > 0 ) return;

		const strong = Math.min( intensity * 0.3, 1 );
		const weak = Math.min( intensity * 0.5, 1 );

		try {

			gp.vibrationActuator.playEffect( 'dual-rumble', {
				duration: 150,
				strongMagnitude: strong,
				weakMagnitude: weak,
			} );

		} catch { /* graceful no-op */ }

		this._rumbleTimer = this._rumbleInterval;

	}

	impulse( intensity ) {

		const gp = this._getGamepad();
		if ( ! gp ) return;

		const strong = Math.min( intensity * 0.15, 1 );

		try {

			gp.vibrationActuator.playEffect( 'dual-rumble', {
				duration: 100,
				strongMagnitude: strong,
				weakMagnitude: 0,
			} );

		} catch { /* graceful no-op */ }

	}

	pulse() {

		const gp = this._getGamepad();
		if ( ! gp ) return;

		try {

			gp.vibrationActuator.playEffect( 'dual-rumble', {
				duration: 80,
				strongMagnitude: 0,
				weakMagnitude: 0.3,
			} );

		} catch { /* graceful no-op */ }

	}

}
