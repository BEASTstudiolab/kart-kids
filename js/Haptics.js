export class Haptics {

	constructor() {

		this._gamepad = null;
		this._rumbleTimer = 0;
		this._rumbleInterval = 0.1; // re-trigger every 100ms

	}

	update( dt ) {

		// Poll for gamepad with vibration support
		const gamepads = navigator.getGamepads();

		this._gamepad = null;

		for ( const gp of gamepads ) {

			if ( gp && gp.vibrationActuator ) {

				this._gamepad = gp;
				break;

			}

		}

		if ( this._rumbleTimer > 0 ) this._rumbleTimer -= dt;

	}

	setRumble( intensity ) {

		if ( ! this._gamepad || this._rumbleTimer > 0 ) return;

		const strong = Math.min( intensity * 0.3, 1 );
		const weak = Math.min( intensity * 0.5, 1 );

		try {

			this._gamepad.vibrationActuator.playEffect( 'dual-rumble', {
				duration: 150,
				strongMagnitude: strong,
				weakMagnitude: weak,
			} );

		} catch { /* graceful no-op */ }

		this._rumbleTimer = this._rumbleInterval;

	}

	impulse( intensity ) {

		if ( ! this._gamepad ) return;

		const strong = Math.min( intensity * 0.15, 1 );

		try {

			this._gamepad.vibrationActuator.playEffect( 'dual-rumble', {
				duration: 100,
				strongMagnitude: strong,
				weakMagnitude: 0,
			} );

		} catch { /* graceful no-op */ }

	}

	pulse() {

		if ( ! this._gamepad ) return;

		try {

			this._gamepad.vibrationActuator.playEffect( 'dual-rumble', {
				duration: 80,
				strongMagnitude: 0,
				weakMagnitude: 0.3,
			} );

		} catch { /* graceful no-op */ }

	}

}
