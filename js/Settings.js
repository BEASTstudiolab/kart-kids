import { detectTier, VALID_TIERS } from './QualityTiers.js';
import { DEFAULT_MASK_TINT_COLOR, createDefaultCharacterAccessories, getPlayerAppearanceFromSettings, normalizePlayerAppearance } from './PlayerAppearance.js';
import { DEFAULT_BALACLAVA_ID, normalizeSelectedBalaclavaId } from './CharacterCustomization.js';

const STORAGE_KEY = 'kart-kids-settings';
const SCHEMA_VERSION = 7;

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Cache detectTier() result — avoids creating multiple throwaway WebGL contexts
const _detectedTier = detectTier();

const DEFAULTS = {
	handedness: 'right',
	accelerometer: false,
	steeringAssist: false,
	cameraMode: 'chase',
	quality: _detectedTier,
	vehicleModel: 'kart-1',
	vehicleColor: '',
	characterColor: '',
	charSkinColor: '',
	maskTintMainColor: '',
	maskTintSecondaryColor: '',
	selectedBalaclavaId: DEFAULT_BALACLAVA_ID,
	charAccessories: createDefaultCharacterAccessories(),
	ghostEnabled: true,
	profile: {
		displayName: null,
	},
	loadout: {
		selectedKartId: 'kart-1',
		selectedTrackId: 'starter-circuit',
	},
	stats: {
		totalRaces: 0,
		wins: 0,
		bestTimes: {},
	},
};

export class Settings {

	constructor() {

		this._data = JSON.parse( JSON.stringify( DEFAULTS ) );

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

				// v2 → v3: Add profile, loadout, and stats namespaces
				if ( version < 3 ) {

					parsed.profile = Object.assign( {}, DEFAULTS.profile, parsed.profile );
					parsed.loadout = Object.assign( {}, DEFAULTS.loadout, parsed.loadout );
					parsed.stats = Object.assign( {}, DEFAULTS.stats, parsed.stats );

				}

				// v3 → v4: Add selectedTrackId to loadout
				if ( version < 4 ) {

					if ( ! parsed.loadout ) parsed.loadout = {};
					if ( ! parsed.loadout.selectedTrackId ) parsed.loadout.selectedTrackId = DEFAULTS.loadout.selectedTrackId;

				}

				// v4 → v5: Add selectedBalaclavaId and drop legacy accessory keys
				if ( version < 5 ) {

					const normalizedAppearance = normalizePlayerAppearance( {
						selectedBalaclavaId: parsed.selectedBalaclavaId,
						charAccessories: parsed.charAccessories,
					} );

					parsed.selectedBalaclavaId = normalizedAppearance.selectedBalaclavaId;
					parsed.charAccessories = normalizedAppearance.charAccessories;

				}

				// v5 → v6: Add mask tint colors
				if ( version < 6 ) {

					const normalizedAppearance = normalizePlayerAppearance( {
						maskTintMainColor: parsed.maskTintMainColor,
						maskTintSecondaryColor: parsed.maskTintSecondaryColor,
					} );

					parsed.maskTintMainColor = normalizedAppearance.maskTintMainColor;
					parsed.maskTintSecondaryColor = normalizedAppearance.maskTintSecondaryColor;

				}

				// v6 → v7: Separate white tint from "unset" for mask colors
				if ( version < 7 ) {

					if ( parsed.maskTintMainColor === DEFAULT_MASK_TINT_COLOR ) parsed.maskTintMainColor = '';
					if ( parsed.maskTintSecondaryColor === DEFAULT_MASK_TINT_COLOR ) parsed.maskTintSecondaryColor = '';

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

	// --- Profile ---

	isFirstRun() {

		return this._data.profile.displayName === null;

	}

	getDisplayName() {

		return this._data.profile.displayName;

	}

	setDisplayName( name ) {

		this._data.profile.displayName = name;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'profile.displayName', value: name } } ) );

	}

	// --- Loadout ---

	getSelectedKartId() {

		return this._data.loadout.selectedKartId;

	}

	setSelectedKartId( kartId ) {

		this._data.loadout.selectedKartId = kartId;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'loadout.selectedKartId', value: kartId } } ) );

	}

	getSelectedTrackId() {

		return this._data.loadout.selectedTrackId;

	}

	setSelectedTrackId( trackId ) {

		this._data.loadout.selectedTrackId = trackId;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'loadout.selectedTrackId', value: trackId } } ) );

	}

	getSelectedBalaclavaId() {

		return normalizeSelectedBalaclavaId( this._data.selectedBalaclavaId );

	}

	setSelectedBalaclavaId( balaclavaId ) {

		const normalized = normalizeSelectedBalaclavaId( balaclavaId );
		this._data.selectedBalaclavaId = normalized;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'selectedBalaclavaId', value: normalized } } ) );

	}

	getPlayerAppearance() {

		return getPlayerAppearanceFromSettings( this );

	}

	// --- Stats ---

	getStats() {

		return this._data.stats;

	}

	incrementTotalRaces() {

		this._data.stats.totalRaces ++;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'stats.totalRaces', value: this._data.stats.totalRaces } } ) );

	}

	incrementWins() {

		this._data.stats.wins ++;
		this._save();
		window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'stats.wins', value: this._data.stats.wins } } ) );

	}

	setBestTime( trackId, time ) {

		const current = this._data.stats.bestTimes[ trackId ];

		if ( current === undefined || time < current ) {

			this._data.stats.bestTimes[ trackId ] = time;
			this._save();
			window.dispatchEvent( new CustomEvent( 'settings-changed', { detail: { key: 'stats.bestTimes', value: this._data.stats.bestTimes } } ) );

		}

	}

	getBestTime( trackId ) {

		return this._data.stats.bestTimes[ trackId ] || null;

	}

}
