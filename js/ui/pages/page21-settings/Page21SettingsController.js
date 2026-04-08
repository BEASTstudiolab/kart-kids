/**
 * Page21SettingsController — Settings.
 *
 * Route: RouteIds.SETTINGS ("/settings")
 *
 * Responsibilities:
 *   - Create and configure Page21SettingsView.
 *   - Wire APPLY CHANGES → persist values; show success toast.
 *   - Wire RESET DEFAULTS → open ConfirmationDialog; on confirm restore defaults.
 *   - Wire PageHeader back button → navigateBack().
 *   - Wire Tabs kk:tabs:change → track SETTINGS_CHANGED analytics per tab visited.
 *   - Handle URL hash fragment → jump to specific tab on mount (e.g. /settings#controls).
 *   - Emit SETTINGS_CHANGED analytics on apply.
 *
 * URL hash fragments supported:
 *   #gameplay | #controls | #audio | #video | #accessibility | #account | #privacy | #credits
 *
 * Data:
 *   Default values are hardcoded in the view per M2 scope.
 *   In a real integration, SettingsService.load() would hydrate the view via setAllValues().
 *
 * Architecture notes:
 *   - The controller does not own SettingsService persistence at M2 stage.
 *     It calls view.getAllValues() on APPLY, logs them, and shows a toast.
 *   - RESET DEFAULTS opens an inline ConfirmationDialog via ModalService.confirm().
 *     If ModalService is unavailable, it falls back to window.confirm().
 *   - The Tabs component internally manages tab visibility; the controller only
 *     reacts to tab changes for analytics.
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page21SettingsView }    from './Page21SettingsView.js';
import { RouteIds }              from '../../enums/RouteIds.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';

/** Map URL hash fragments to Tabs activeId values. */
const HASH_TO_TAB = Object.freeze( {
	'#gameplay':      'gameplay',
	'#controls':      'controls',
	'#audio':         'audio',
	'#video':         'video',
	'#accessibility': 'accessibility',
	'#account':       'account',
	'#privacy':       'privacy',
	'#credits':       'credits',
} );

export class Page21SettingsController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page21SettingsView} */
		this._view = null;

		/** @type {boolean} Prevents double-apply while loading state is shown. */
		this._applying = false;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page21SettingsView();

	}

	bindEvents() {

		const view = this._view;

		// Back button
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { page: PageIds.SETTINGS } );
			this.navigateBack();

		} );

		// Tabs change — track analytics for UX instrumentation
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			this._analytics?.track( EventIds.SETTINGS_CHANGED, { tab: tabId } );

		} );

		// APPLY CHANGES
		this._addListener( view.applyBtn.el, 'click', () => {

			this._applySettings();

		} );

		// RESET DEFAULTS
		this._addListener( view.resetBtn.el, 'click', () => {

			this._confirmReset();

		} );

	}

	loadData() {

		// M2: No async data needed. View defaults are hardcoded.
		// Future: await SettingsService.load() then call view.setAllValues(data).
		return Promise.resolve();

	}

	render( container ) {

		this._view.mount( container );
		this._analytics?.trackPageView( PageIds.SETTINGS );

		// Jump to tab if a supported hash fragment is present in the URL
		this._applyHashFragment();

	}

	dispose() {

		this._applying = false;
		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal actions
	// ---------------------------------------------------------------------------

	/**
	 * Read the URL hash and activate the matching tab, if any.
	 * Called after render() so the view is in the live DOM.
	 */
	_applyHashFragment() {

		const hash = window.location.hash.toLowerCase();
		const tabId = HASH_TO_TAB[ hash ];

		if ( tabId ) {

			this._view.tabs.setActiveTab( tabId );

		}

	}

	/**
	 * Collect control values from the view, log them, and show a success toast.
	 * In production this would call SettingsService.save(values).
	 */
	_applySettings() {

		if ( this._applying ) return;
		this._applying = true;

		this._view.applyBtn.setLoading( true );

		const values = this._view.getAllValues();

		// M2: log values; real integration calls SettingsService.save(values)
		console.info( '[Page21SettingsController] Applying settings:', values );

		this._analytics?.track( EventIds.SETTINGS_CHANGED, { values } );

		// Simulate async save (no-op in M2)
		Promise.resolve().then( () => {

			if ( this._disposed ) return;

			this._view.applyBtn.setLoading( false );
			this._applying = false;

			this.showToast( {
				message:  'Settings saved.',
				variant:  'success',
				duration: 3000,
			} );

		} );

	}

	/**
	 * Prompt the user to confirm resetting all settings to defaults.
	 * Uses ModalService.confirm() if available, otherwise native confirm().
	 */
	_confirmReset() {

		if ( this._modal ) {

			this.openConfirm( {
				title:         'Reset to Defaults?',
				body:          'All settings will be returned to their factory values. This cannot be undone.',
				confirmLabel:  'RESET',
				cancelLabel:   'CANCEL',
				confirmVariant: 'danger',
				onConfirm:     () => this._resetDefaults(),
			} );

		} else {

			// Fallback: native confirm (no ModalService in current M2 wiring)
			// eslint-disable-next-line no-alert
			const ok = window.confirm( 'Reset all settings to defaults?' );
			if ( ok ) this._resetDefaults();

		}

	}

	/**
	 * Restore all view controls to their default values.
	 * M2 defaults are hardcoded here; production reads from SettingsService.defaults.
	 */
	_resetDefaults() {

		const defaults = {
			'bot-difficulty':  '5',
			'speed-boosts':    true,
			'fov':             '80',
			'auto-align':      true,
			'key-remapping':   true,
			'vol-master':      '80',
			'vol-music':       '70',
			'vol-sfx':         '85',
			'vol-voice':       '60',
			'resolution':      '1920×1080',
			'quality':         'HIGH',
			'text-scale':      '100',
			'colorblind':      'NONE',
			'reduce-motion':   false,
			'analytics':       true,
			'crash-reports':   true,
			'personalised':    false,
			'social-share':    false,
		};

		this._view.setAllValues( defaults );

		this._analytics?.track( EventIds.SETTINGS_RESET );

		this.showToast( {
			message:  'Settings reset to defaults.',
			variant:  'info',
			duration: 3000,
		} );

	}

}
