const STORAGE_KEY = 'kart-kids-settings';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const DEFAULTS = {
	handedness: 'right',
	accelerometer: false,
	cameraMode: 'chase',
	shadowQuality: isMobile ? 'low' : 'high',
	postProcessing: ! isMobile
};

export class Settings {

	constructor() {

		this._data = Object.assign( {}, DEFAULTS );

		try {

			const stored = localStorage.getItem( STORAGE_KEY );
			if ( stored ) Object.assign( this._data, JSON.parse( stored ) );

		} catch ( e ) { /* ignore corrupt data */ }

	}

	get( key ) {

		return this._data[ key ];

	}

	set( key, value ) {

		this._data[ key ] = value;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key, value } } ) );

	}

	_save() {

		try {

			localStorage.setItem( STORAGE_KEY, JSON.stringify( this._data ) );

		} catch ( e ) { /* storage full or unavailable */ }

	}

}
