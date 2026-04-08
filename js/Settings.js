import { detectTier, VALID_TIERS } from './QualityTiers.js';

const STORAGE_KEY = 'kart-kids-settings';
const SCHEMA_VERSION = 2;

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Cache detectTier() result — avoids creating multiple throwaway WebGL contexts
const _detectedTier = detectTier();

const DEFAULTS = {
	handedness: 'right',
	accelerometer: false,
	steeringAssist: false,
	cameraMode: 'chase',
	quality: _detectedTier,
	vehicleColor: '',
	characterColor: '',
	ghostEnabled: true,
	ghostRival: false,
};

export class Settings {

	constructor() {

		this._data = Object.assign( {}, DEFAULTS );

		try {

			const stored = localStorage.getItem( STORAGE_KEY );

			if ( stored ) {

				const parsed = JSON.parse( stored );
				const version = parsed._version || 0;

				// v0 → v1: Migrate old postProcessing boolean → quality tier
				if ( version < 1 ) {

					if ( 'postProcessing' in parsed ) {

						parsed.quality = parsed.postProcessing === false ? 'low' : _detectedTier;
						delete parsed.postProcessing;

					}

				}

				// v1 → v2: Drop old shadowQuality (now owned by quality preset)
				if ( version < 2 ) {

					delete parsed.shadowQuality;

				}

				parsed._version = SCHEMA_VERSION;
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

		} catch ( e ) { console.warn( '[Settings] Failed to save:', e.message ); }

	}

}
