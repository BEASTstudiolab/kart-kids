import { detectTier, VALID_TIERS } from './QualityTiers.js';

const STORAGE_KEY = 'kart-kids-settings';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Cache detectTier() result — avoids creating multiple throwaway WebGL contexts
const _detectedTier = detectTier();

const DEFAULTS = {
	handedness: 'right',
	accelerometer: false,
	cameraMode: 'chase',
	quality: _detectedTier,
};

export class Settings {

	constructor() {

		this._data = Object.assign( {}, DEFAULTS );

		try {

			const stored = localStorage.getItem( STORAGE_KEY );

			if ( stored ) {

				const parsed = JSON.parse( stored );

				// Migrate old postProcessing boolean → quality tier
				if ( 'postProcessing' in parsed ) {

					if ( parsed.postProcessing === false ) {

						parsed.quality = 'low';

					} else {

						parsed.quality = _detectedTier;

					}

					delete parsed.postProcessing;

				}

				// Drop old shadowQuality (now owned by quality preset)
				delete parsed.shadowQuality;

				Object.assign( this._data, parsed );

			}

		} catch ( e ) { /* ignore corrupt data */ }

		// Validate quality tier
		if ( ! VALID_TIERS.includes( this._data.quality ) ) {

			this._data.quality = _detectedTier;

		}

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
