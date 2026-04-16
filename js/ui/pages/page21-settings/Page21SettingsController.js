import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page21SettingsView } from './Page21SettingsView.js';
import { PageIds } from '../../enums/PageIds.js';
import { EventIds } from '../../enums/EventIds.js';
import { Settings } from '../../../Settings.js';

const HASH_TO_TAB = Object.freeze( {
	'#gameplay': 'race',
	'#race': 'race',
	'#controls': 'controls',
	'#audio': 'audio',
	'#video': 'display',
	'#display': 'display',
	'#accessibility': 'accessibility',
	'#account': 'about',
	'#privacy': 'about',
	'#credits': 'about',
	'#language': 'accessibility',
	'#about': 'about',
} );

const COLORBLIND_CLASS_MAP = Object.freeze( {
	DEUTERANOPIA: 'kk-colorblind-deutan',
	PROTANOPIA: 'kk-colorblind-protan',
	TRITANOPIA: 'kk-colorblind-tritan',
} );

const DEFAULT_VALUES = Object.freeze( {
	'ai-count': 0,
	difficulty: 50,
	'steering-assist': false,
	'ghost-enabled': true,
	handedness: 'RIGHT',
	accelerometer: false,
	'speed-unit': 'KMH',
	'camera-mode': 'CHASE',
	'music-volume': 100,
	'sfx-volume': 100,
	quality: 'HIGH',
	'reduce-vfx': false,
	'text-scale': 100,
	colorblind: 'NONE',
	'reduce-motion': false,
	analytics: true,
	'crash-reports': true,
	personalised: false,
	'social-share': false,
} );

function clampNumber( value, min, max, fallback ) {

	const parsed = Number( value );
	if ( ! Number.isFinite( parsed ) ) return fallback;
	return Math.min( max, Math.max( min, parsed ) );

}

function normalizeToken( value, fallback ) {

	if ( typeof value !== 'string' || ! value.trim() ) return fallback;
	return value.trim().toUpperCase();

}

function mapTextScaleToUiScale( value ) {

	if ( value >= 130 ) return 'xlarge';
	if ( value >= 110 ) return 'large';
	if ( value <= 89 ) return 'small';
	return 'default';

}

function mapUiColorblindToStored( value ) {

	const token = normalizeToken( value, 'NONE' );
	if ( token === 'DEUTERANOPIA' ) return 'deutan';
	if ( token === 'PROTANOPIA' ) return 'protan';
	if ( token === 'TRITANOPIA' ) return 'tritan';
	return 'none';

}

function mapStoredColorblindToUi( value ) {

	const token = normalizeToken( value, 'NONE' );
	if ( token === 'DEUTAN' || token === 'DEUTERANOPIA' ) return 'DEUTERANOPIA';
	if ( token === 'PROTAN' || token === 'PROTANOPIA' ) return 'PROTANOPIA';
	if ( token === 'TRITAN' || token === 'TRITANOPIA' ) return 'TRITANOPIA';
	return 'NONE';

}

export class Page21SettingsController extends PageControllerBase {

	constructor( params = {}, services = {} ) {

		super( params, services );

		this._view = null;
		this._settings = null;
		this._applying = false;
		this._suspendedRenderMode = null;

	}

	initialize() {

		this._view = new Page21SettingsView( {
			modalMode: typeof this._params.onClose === 'function',
		} );
		this._settings = this._params.settings instanceof Settings ? this._params.settings : new Settings();

		if ( typeof this._params.onClose !== 'function' ) {

			this._services.setSettingsRouteActive?.( true );

			const previousRenderMode = this._services.getRenderMode?.();
			if ( previousRenderMode === 'idle' || previousRenderMode === 'lobby' || previousRenderMode === 'garage' ) {

				this._suspendedRenderMode = previousRenderMode;
				this._services.setRenderMode?.( 'idle' );

			}

		}

	}

	bindEvents() {

		const view = this._view;

		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { page: PageIds.SETTINGS } );
			if ( typeof this._params.onClose === 'function' ) {

				this._params.onClose();
			} else if ( typeof this._services.closeSettings === 'function' ) {

				this._services.closeSettings();

			} else {

				this.navigateBack();

			}

		} );

		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			view.setActiveSection( e.detail?.tabId );
			this._analytics?.track( EventIds.SETTINGS_CHANGED, { tab: e.detail?.tabId } );

		} );

		this._addListener( view.applyBtn.el, 'click', () => this._applySettings() );
		this._addListener( view.resetBtn.el, 'click', () => this._confirmReset() );

		if ( view.debugBtn ) {

			view.debugBtn.disabled = ! this._services.isDebugConsoleAvailable?.();
			this._addListener( view.debugBtn, 'click', () => {

				const opened = this._services.openDebugConsole?.();
				if ( opened && typeof this._params.onClose === 'function' ) this._params.onClose();
				this.showToast( {
					message: opened ? 'Debug console opened.' : 'Debug console unavailable here.',
					variant: 'info',
					duration: opened ? 1800 : 2200,
				} );

			} );

		}

	}

	loadData() {

		const values = this._buildViewValues();
		this._view.setAllValues( values );
		this._applyEnvironmentDecorators( values );
		this._view.markClean( 'Live' );
		this._view.setActiveSection( this._view.activeTabId );
		return Promise.resolve();

	}

	render( container ) {

		this._view.mount( container );
		this._analytics?.trackPageView( PageIds.SETTINGS );
		this._applyHashFragment();

	}

	dispose() {

		this._applying = false;

		if ( this._suspendedRenderMode ) {

			this._services.setRenderMode?.( this._suspendedRenderMode );
			this._suspendedRenderMode = null;

		}

		if ( typeof this._params.onClose !== 'function' ) {

			this._services.setSettingsRouteActive?.( false );

		}

		super.dispose();

	}

	_applyHashFragment() {

		const fragment = this._params?._fragment
			|| ( typeof window !== 'undefined' ? ( window.location.hash || '' ).split( '#' ).pop() : '' );
		const normalizedFragment = fragment ? `#${ String( fragment ).replace( /^#/, '' ).toLowerCase() }` : '';
		const tabId = HASH_TO_TAB[ normalizedFragment ];
		if ( tabId ) {

			this._view.tabs.setActiveTab( tabId );
			this._view.setActiveSection( tabId );
			return;

		}

		this._view.setActiveSection( this._view.activeTabId );

	}

	_applySettings() {

		if ( this._applying ) return;
		this._applying = true;
		this._view.applyBtn.setLoading( true );
		this._view.setStatus( 'Saving', 'Writing updated settings now.' );

		Promise.resolve().then( () => {

			if ( this._disposed ) return;

			const normalizedValues = this._persistValues( this._view.getAllValues() );
			this._view.setAllValues( normalizedValues );
			this._view.applyBtn.setLoading( false );
			this._view.markClean( 'Saved' );
			this._applying = false;

			this.showToast( {
				message: 'Settings saved.',
				variant: 'success',
				duration: 3000,
			} );

		} );

	}

	_confirmReset() {

		if ( this._modal ) {

			this.openConfirm( {
				title: 'Reset to Defaults?',
				body: 'All settings will be returned to their factory values. This cannot be undone.',
				confirmLabel: 'RESET',
				cancelLabel: 'CANCEL',
				confirmVariant: 'danger',
				onConfirm: () => this._resetDefaults(),
			} );
			return;

		}

		// eslint-disable-next-line no-alert
		if ( window.confirm( 'Reset all settings to defaults?' ) ) this._resetDefaults();

	}

	_resetDefaults() {

		const normalizedValues = this._persistValues( { ...DEFAULT_VALUES } );

		this._view.setAllValues( normalizedValues );
		this._view.markClean( 'Defaults' );
		this._analytics?.track( EventIds.SETTINGS_RESET );
		this.showToast( {
			message: 'Settings reset to defaults.',
			variant: 'info',
			duration: 3000,
		} );

	}

	_buildViewValues() {

		const htmlScale = typeof document !== 'undefined'
			? document.documentElement?.dataset?.uiScale || 'default'
			: 'default';
		const derivedTextScale = htmlScale === 'xlarge' ? 140 : htmlScale === 'large' ? 120 : htmlScale === 'small' ? 85 : 100;

		return {
			...DEFAULT_VALUES,
			'ai-count': clampNumber( this._settings.get( 'aiCount' ), 0, 8, DEFAULT_VALUES['ai-count'] ),
			difficulty: clampNumber( this._settings.get( 'difficulty' ), 0, 100, DEFAULT_VALUES.difficulty ),
			'steering-assist': !! this._settings.get( 'steeringAssist' ),
			'ghost-enabled': this._settings.get( 'ghostEnabled' ) !== false,
			handedness: normalizeToken( this._settings.get( 'handedness' ), DEFAULT_VALUES.handedness ),
			accelerometer: !! this._settings.get( 'accelerometer' ),
			'speed-unit': normalizeToken( this._settings.get( 'speedUnit' ), DEFAULT_VALUES['speed-unit'] ),
			'camera-mode': normalizeToken( this._settings.get( 'cameraMode' ), DEFAULT_VALUES['camera-mode'] ),
			'music-volume': clampNumber( this._settings.get( 'musicVolume' ), 0, 100, DEFAULT_VALUES['music-volume'] ),
			'sfx-volume': clampNumber( this._settings.get( 'sfxVolume' ), 0, 100, DEFAULT_VALUES['sfx-volume'] ),
			quality: normalizeToken( this._settings.get( 'quality' ), DEFAULT_VALUES.quality ),
			'reduce-vfx': !! this._settings.get( 'reduceVfx' ),
			'text-scale': clampNumber( this._settings.get( 'textScale' ) ?? derivedTextScale, 80, 150, DEFAULT_VALUES['text-scale'] ),
			colorblind: mapStoredColorblindToUi( this._settings.get( 'colorblind' ) ),
			'reduce-motion': !! this._settings.get( 'reduceMotion' ),
			analytics: this._settings.get( 'analytics' ) !== false,
			'crash-reports': this._settings.get( 'crashReports' ) !== false,
			personalised: !! this._settings.get( 'personalisedContent' ),
			'social-share': !! this._settings.get( 'socialShare' ),
		};

	}

	_persistValues( values ) {

		const normalizedValues = {
			...DEFAULT_VALUES,
			...values,
			'ai-count': clampNumber( values['ai-count'], 0, 8, DEFAULT_VALUES['ai-count'] ),
			difficulty: clampNumber( values.difficulty, 0, 100, DEFAULT_VALUES.difficulty ),
			handedness: normalizeToken( values.handedness, DEFAULT_VALUES.handedness ),
			'speed-unit': normalizeToken( values['speed-unit'], DEFAULT_VALUES['speed-unit'] ),
			'camera-mode': normalizeToken( values['camera-mode'], DEFAULT_VALUES['camera-mode'] ),
			'music-volume': clampNumber( values['music-volume'], 0, 100, DEFAULT_VALUES['music-volume'] ),
			'sfx-volume': clampNumber( values['sfx-volume'], 0, 100, DEFAULT_VALUES['sfx-volume'] ),
			quality: normalizeToken( values.quality, DEFAULT_VALUES.quality ),
			'text-scale': clampNumber( values['text-scale'], 80, 150, DEFAULT_VALUES['text-scale'] ),
			colorblind: normalizeToken( values.colorblind, DEFAULT_VALUES.colorblind ),
			'steering-assist': !! values['steering-assist'],
			'ghost-enabled': !! values['ghost-enabled'],
			accelerometer: !! values.accelerometer,
			'reduce-vfx': !! values['reduce-vfx'],
			'reduce-motion': !! values['reduce-motion'],
			analytics: !! values.analytics,
			'crash-reports': !! values['crash-reports'],
			personalised: !! values.personalised,
			'social-share': !! values['social-share'],
		};

		this._settings.set( 'aiCount', normalizedValues['ai-count'] );
		this._settings.set( 'difficulty', normalizedValues.difficulty );
		this._settings.set( 'steeringAssist', normalizedValues['steering-assist'] );
		this._settings.set( 'ghostEnabled', normalizedValues['ghost-enabled'] );
		this._settings.set( 'handedness', normalizedValues.handedness.toLowerCase() );
		this._settings.set( 'accelerometer', normalizedValues.accelerometer );
		this._settings.set( 'speedUnit', normalizedValues['speed-unit'].toLowerCase() );
		this._settings.set( 'cameraMode', normalizedValues['camera-mode'].toLowerCase() );
		this._settings.set( 'musicVolume', normalizedValues['music-volume'] );
		this._settings.set( 'sfxVolume', normalizedValues['sfx-volume'] );
		this._settings.set( 'quality', normalizedValues.quality.toLowerCase() );
		this._settings.set( 'reduceVfx', normalizedValues['reduce-vfx'] );
		this._settings.set( 'textScale', normalizedValues['text-scale'] );
		this._settings.set( 'colorblind', mapUiColorblindToStored( normalizedValues.colorblind ) );
		this._settings.set( 'reduceMotion', normalizedValues['reduce-motion'] );
		this._settings.set( 'analytics', normalizedValues.analytics );
		this._settings.set( 'crashReports', normalizedValues['crash-reports'] );
		this._settings.set( 'personalisedContent', normalizedValues.personalised );
		this._settings.set( 'socialShare', normalizedValues['social-share'] );

		this._applyEnvironmentDecorators( normalizedValues );
		this._analytics?.track( EventIds.SETTINGS_CHANGED, { values: normalizedValues } );
		return normalizedValues;

	}

	_applyEnvironmentDecorators( values ) {

		if ( typeof document === 'undefined' ) return;

		const root = document.documentElement;
		const body = document.body;
		const reduceMotion = values['reduce-motion'] ? 'true' : 'false';
		const uiScale = mapTextScaleToUiScale( clampNumber( values['text-scale'], 80, 150, 100 ) );
		const colorblindClass = COLORBLIND_CLASS_MAP[ normalizeToken( values.colorblind, 'NONE' ) ] || null;

		if ( root ) {

			root.dataset.uiScale = uiScale;
			root.dataset.reduceMotion = reduceMotion;
			root.classList.remove( 'kk-colorblind-deutan', 'kk-colorblind-protan', 'kk-colorblind-tritan' );
			if ( colorblindClass ) root.classList.add( colorblindClass );

		}

		if ( body ) {

			body.dataset.reduceMotion = reduceMotion;
			body.classList.remove( 'kk-colorblind-deutan', 'kk-colorblind-protan', 'kk-colorblind-tritan' );
			if ( colorblindClass ) body.classList.add( colorblindClass );

		}

	}

}
