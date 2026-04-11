// ─── CompassOverlay ─────────────────────────────────────────────────────────
// Keeps the compass rose rotated to match the live camera orbit heading.

export class CompassOverlay {

	constructor( { eventBus, roseEl } ) {

		this._roseEl = roseEl ?? null;
		this._offCameraMoved = null;

		if ( ! eventBus?.on ) return;

		this._offCameraMoved = eventBus.on( 'camera:moved', ( { orbitAngle = 0 } = {} ) => {

			if ( ! this._roseEl?.style ) return;

			const deg = Math.round( - orbitAngle * 180 / Math.PI );
			this._roseEl.style.transform = `rotate(${ deg }deg)`;

		} );

	}

	dispose() {

		this._offCameraMoved?.();
		this._offCameraMoved = null;

	}

}
