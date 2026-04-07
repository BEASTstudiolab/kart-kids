/**
 * Page21SettingsView — Settings.
 *
 * Route: RouteIds.SETTINGS ("/settings")
 *
 * Layout:
 *   .page-settings                        — full-page column flex root
 *     .settings-header                    — PageHeader + "(KID MODE ENABLED)" subtitle
 *     .kk-tabs[role="tablist"]            — Tabs component: 8 tabs
 *     .settings-body                      — scrollable content zone; hosts all tab panels
 *       .kk-tabs__panel (×8)              — one panel per tab, hidden when inactive
 *     .settings-action-bar                — bottom bar: RESET DEFAULTS + APPLY CHANGES
 *
 * Tab content zones:
 *   GAMEPLAY   — Bot Difficulty slider, Speed Boosts toggle, FOV slider, Auto-Align toggle
 *   CONTROLS   — Controller diagram placeholder, Key Remapping Group toggle, K6/R2 labels
 *   AUDIO      — Master / Music / SFX / Voice volume sliders
 *   VIDEO      — Resolution selector, Quality preset selector
 *   ACCESSIBILITY — Text scale slider, Colorblind mode selector, Motion reduction toggle
 *   ACCOUNT    — Display name field, Sign Out button
 *   PRIVACY    — Data sharing toggles
 *   CREDITS    — Scrollable credits text
 *
 * URL hash fragment navigation: controller calls setActiveTab(fragmentId) on mount
 * when window.location.hash maps to a known tab (e.g. #controls → 'controls').
 *
 * Deviations from spec:
 *   - Volume sliders and FOV/Text-scale use native <input type="range"> wrapped in a
 *     kk-settings-row pattern. A custom styled slider component does not exist in M2.
 *     The range inputs are fully keyboard-accessible and aria-labelled.
 *   - Controller diagram (CONTROLS tab) is a styled placeholder div; the actual
 *     SVG diagram is out of scope for M2.
 *   - Credits text is hardcoded placeholder content; real credits come from a config.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { Tabs }          from '../../components/Tabs.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { SectionPanel }  from '../../components/SectionPanel.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

export class Page21SettingsView extends PageViewBase {

	constructor() {

		super( 'page-settings' );

		/** @type {PageHeader} */
		this._pageHeader = null;

		/** @type {Tabs} */
		this._tabs = null;

		/** @type {CTAButton} */
		this._resetBtn = null;

		/** @type {CTAButton} */
		this._applyBtn = null;

		/** @type {Map<string, HTMLInputElement|HTMLSelectElement>} control-id → element */
		this._controls = new Map();

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page21SettingsView._cssInjected ) return;
		Page21SettingsView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root
			   ================================================================ */

			.page-settings {
				display: flex;
				flex-direction: column;
				min-height: 100vh;
				background: var(--color-bg-base);
				color: var(--color-white);
				font-family: var(--font-ui);
			}

			/* ================================================================
			   Header zone
			   ================================================================ */

			.settings-header {
				padding: 0 var(--space-6);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				background: var(--color-panel-base);
			}

			.settings-header__top {
				display: flex;
				align-items: center;
				gap: var(--space-4);
			}

			.settings-header__title-group {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.settings-header__subtitle {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.settings-header .kk-page-header {
				padding-bottom: var(--space-2);
			}

			.settings-header .kk-page-header__title {
				font-size: var(--text-xl);
			}

			/* ================================================================
			   Tabs — override bottom border position
			   ================================================================ */

			.settings-header .kk-tabs {
				border-bottom: none;
				background: transparent;
				padding: 0;
			}

			/* ================================================================
			   Body — scrollable content zone
			   ================================================================ */

			.settings-body {
				flex: 1 1 auto;
				overflow-y: auto;
				padding: var(--space-6);
				display: flex;
				flex-direction: column;
				gap: var(--space-6);
			}

			/* Each tab panel gets a two-column grid on wider viewports */
			.kk-tabs__panel.settings-panel-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-5);
				align-items: start;
			}

			@media (max-width: 640px) {
				.kk-tabs__panel.settings-panel-grid {
					grid-template-columns: 1fr;
				}
			}

			/* Single-column panels */
			.kk-tabs__panel.settings-panel-single {
				display: flex;
				flex-direction: column;
				gap: var(--space-5);
			}

			/* ================================================================
			   SectionPanel overrides — premium dark card styling
			   ================================================================ */

			.kk-section-panel {
				background: var(--color-panel-base);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-lg);
				padding: var(--space-5);
			}

			.kk-section-panel__header {
				margin-bottom: var(--space-4);
				padding-bottom: var(--space-3);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
			}

			.kk-section-panel__title {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				margin: 0;
			}

			.kk-section-panel__body {
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
			}

			/* ================================================================
			   Settings rows — label + control layout
			   ================================================================ */

			.settings-row {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.settings-row__label {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				user-select: none;
			}

			.settings-row__hint {
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				margin-top: calc(var(--space-1) * -1);
			}

			/* ================================================================
			   Slider control
			   ================================================================ */

			.settings-slider-wrap {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.settings-slider-labels {
				display: flex;
				justify-content: space-between;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.settings-slider {
				-webkit-appearance: none;
				appearance: none;
				width: 100%;
				height: 4px;
				background: var(--color-ink-700);
				border-radius: var(--radius-pill);
				outline: none;
				cursor: pointer;
				accent-color: var(--color-accent-orange);
			}

			.settings-slider:focus-visible {
				outline: var(--focus-ring-width) solid var(--focus-ring-color);
				outline-offset: var(--focus-ring-offset);
			}

			.settings-slider::-webkit-slider-thumb {
				-webkit-appearance: none;
				appearance: none;
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: var(--color-accent-orange);
				cursor: pointer;
				border: 2px solid var(--color-bg-base);
				box-shadow: 0 0 0 1px var(--color-accent-orange);
				transition: box-shadow var(--duration-fast) var(--ease-standard);
			}

			.settings-slider::-webkit-slider-thumb:hover {
				box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.35);
			}

			.settings-slider::-moz-range-thumb {
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: var(--color-accent-orange);
				cursor: pointer;
				border: 2px solid var(--color-bg-base);
			}

			/* ================================================================
			   Toggle control
			   ================================================================ */

			.settings-toggle-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--space-4);
			}

			.settings-toggle {
				position: relative;
				display: inline-block;
				width: 48px;
				height: 26px;
				flex-shrink: 0;
			}

			.settings-toggle input {
				opacity: 0;
				width: 0;
				height: 0;
				position: absolute;
			}

			.settings-toggle__track {
				position: absolute;
				inset: 0;
				background: var(--color-ink-600);
				border-radius: var(--radius-pill);
				cursor: pointer;
				transition: background var(--duration-fast) var(--ease-standard);
			}

			.settings-toggle__track::after {
				content: '';
				position: absolute;
				left: 3px;
				top: 3px;
				width: 20px;
				height: 20px;
				border-radius: 50%;
				background: var(--color-white);
				transition: transform var(--duration-fast) var(--ease-standard);
				box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
			}

			.settings-toggle input:checked + .settings-toggle__track {
				background: var(--color-accent-orange);
			}

			.settings-toggle input:checked + .settings-toggle__track::after {
				transform: translateX(22px);
			}

			.settings-toggle input:focus-visible + .settings-toggle__track {
				outline: var(--focus-ring-width) solid var(--focus-ring-color);
				outline-offset: var(--focus-ring-offset);
			}

			/* ================================================================
			   Select control
			   ================================================================ */

			.settings-select {
				-webkit-appearance: none;
				appearance: none;
				width: 100%;
				padding: var(--space-2) var(--space-10) var(--space-2) var(--space-3);
				background: var(--color-ink-800) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right var(--space-3) center;
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				color: var(--color-white);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				cursor: pointer;
				min-height: var(--hit-target-min);
			}

			.settings-select:focus-visible {
				outline: var(--focus-ring-width) solid var(--focus-ring-color);
				outline-offset: var(--focus-ring-offset);
				border-color: var(--color-accent-orange);
			}

			.settings-select option {
				background: var(--color-ink-800);
				color: var(--color-white);
			}

			/* ================================================================
			   Text input control
			   ================================================================ */

			.settings-text-input {
				width: 100%;
				padding: var(--space-2) var(--space-3);
				background: var(--color-ink-800);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				color: var(--color-white);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				min-height: var(--hit-target-min);
				box-sizing: border-box;
			}

			.settings-text-input:focus-visible {
				outline: var(--focus-ring-width) solid var(--focus-ring-color);
				outline-offset: var(--focus-ring-offset);
				border-color: var(--color-accent-orange);
			}

			/* ================================================================
			   CONTROLS tab — controller diagram placeholder
			   ================================================================ */

			.settings-controller-diagram {
				display: flex;
				align-items: center;
				justify-content: center;
				height: 200px;
				background: var(--color-ink-900);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-lg);
				color: var(--color-ink-500);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				position: relative;
				overflow: hidden;
			}

			.settings-controller-diagram__svg {
				width: 160px;
				height: 100px;
				opacity: 0.2;
			}

			.settings-controller-diagram__label {
				position: absolute;
				bottom: var(--space-3);
				left: 50%;
				transform: translateX(-50%);
				font-size: var(--text-xs);
				color: var(--color-ink-500);
				white-space: nowrap;
			}

			.settings-remap-keys {
				display: flex;
				gap: var(--space-3);
				flex-wrap: wrap;
			}

			.settings-key-chip {
				display: inline-flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-1) var(--space-3);
				background: var(--color-ink-800);
				border: var(--border-base) solid var(--color-panel-border-strong);
				border-radius: var(--radius-md);
				font-family: var(--font-mono);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				letter-spacing: var(--tracking-wider);
				cursor: pointer;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.settings-key-chip:hover,
			.settings-key-chip:focus-visible {
				border-color: var(--color-accent-orange);
				outline: none;
			}

			/* ================================================================
			   CREDITS tab — scrollable credits block
			   ================================================================ */

			.settings-credits-scroll {
				max-height: 360px;
				overflow-y: auto;
				padding-right: var(--space-2);
				scrollbar-width: thin;
				scrollbar-color: var(--color-ink-600) transparent;
			}

			.settings-credits-block {
				display: flex;
				flex-direction: column;
				gap: var(--space-5);
			}

			.settings-credits-section__heading {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				margin: 0 0 var(--space-2);
			}

			.settings-credits-section__names {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-300);
				line-height: var(--leading-relaxed);
				margin: 0;
			}

			.settings-credits-version {
				margin-top: var(--space-4);
				font-family: var(--font-mono);
				font-size: var(--text-xs);
				color: var(--color-ink-500);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* ================================================================
			   Action bar — bottom fixed bar
			   ================================================================ */

			.settings-action-bar {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: var(--space-3);
				padding: var(--space-4) var(--space-6);
				background: var(--color-panel-base);
				border-top: var(--border-thin) solid var(--color-panel-border);
				flex-shrink: 0;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.setAttribute( 'aria-label', 'Settings' );

		// ----- Header zone -----
		const headerZone = document.createElement( 'div' );
		headerZone.className = 'settings-header';

		const headerTop = document.createElement( 'div' );
		headerTop.className = 'settings-header__top';

		this._pageHeader = new PageHeader( {
			title:    'SETTINGS',
			showBack: true,
		} );
		headerTop.appendChild( this._pageHeader.el );

		const titleGroup = document.createElement( 'div' );
		titleGroup.className = 'settings-header__title-group';

		const subtitle = document.createElement( 'span' );
		subtitle.className = 'settings-header__subtitle';
		subtitle.textContent = '(KID MODE ENABLED)';
		subtitle.setAttribute( 'aria-label', 'Kid mode is enabled' );
		titleGroup.appendChild( subtitle );
		headerTop.appendChild( titleGroup );

		headerZone.appendChild( headerTop );

		// ----- Tabs -----
		this._tabs = new Tabs( {
			ariaLabel: 'Settings categories',
			activeId:  'gameplay',
			tabs: [
				{ id: 'gameplay',      label: 'GAMEPLAY' },
				{ id: 'controls',      label: 'CONTROLS' },
				{ id: 'audio',         label: 'AUDIO' },
				{ id: 'video',         label: 'VIDEO' },
				{ id: 'accessibility', label: 'ACCESSIBILITY' },
				{ id: 'account',       label: 'ACCOUNT' },
				{ id: 'privacy',       label: 'PRIVACY' },
				{ id: 'credits',       label: 'CREDITS' },
			],
		} );

		headerZone.appendChild( this._tabs.el );
		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Body — panel container -----
		const body = document.createElement( 'div' );
		body.className = 'settings-body';

		// Mount all panels into the body
		this._buildGameplayPanel();
		this._buildControlsPanel();
		this._buildAudioPanel();
		this._buildVideoPanel();
		this._buildAccessibilityPanel();
		this._buildAccountPanel();
		this._buildPrivacyPanel();
		this._buildCreditsPanel();

		this._tabs.panels.forEach( ( panel ) => body.appendChild( panel ) );
		this._registerSection( 'body', body );
		root.appendChild( body );

		// ----- Action bar -----
		const actionBar = document.createElement( 'div' );
		actionBar.className = 'settings-action-bar';
		actionBar.setAttribute( 'role', 'toolbar' );
		actionBar.setAttribute( 'aria-label', 'Settings actions' );

		this._resetBtn = new CTAButton( {
			label:    'RESET DEFAULTS',
			variant:  'secondary',
			actionId: ButtonIds.SETTINGS_RESET,
		} );

		this._applyBtn = new CTAButton( {
			label:    'APPLY CHANGES',
			variant:  'primary',
			actionId: ButtonIds.SETTINGS_APPLY,
		} );

		actionBar.appendChild( this._resetBtn.el );
		actionBar.appendChild( this._applyBtn.el );
		this._registerSection( 'actionBar', actionBar );
		root.appendChild( actionBar );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — GAMEPLAY
	// ---------------------------------------------------------------------------

	_buildGameplayPanel() {

		const panel = this._tabs.getPanel( 'gameplay' );
		panel.classList.add( 'settings-panel-grid' );

		// Left column: Race Settings
		const raceSection = new SectionPanel( { title: 'RACE SETTINGS', headingLevel: 3 } );

		// Bot Difficulty slider
		raceSection.append( this._buildSliderRow( {
			id:     'bot-difficulty',
			label:  'BOT DIFFICULTY',
			min:    0,
			max:    10,
			value:  5,
			minLabel: 'EASY',
			maxLabel: 'EXPERT',
		} ) );

		// Speed Boosts toggle
		raceSection.append( this._buildToggleRow( {
			id:      'speed-boosts',
			label:   'SPEED BOOSTS',
			checked: true,
		} ) );

		panel.appendChild( raceSection.el );

		// Right column: Camera
		const cameraSection = new SectionPanel( { title: 'CAMERA', headingLevel: 3 } );

		cameraSection.append( this._buildSliderRow( {
			id:       'fov',
			label:    'FIELD OF VIEW',
			min:      60,
			max:      110,
			value:    80,
			minLabel: '60',
			maxLabel: '110',
		} ) );

		cameraSection.append( this._buildToggleRow( {
			id:      'auto-align',
			label:   'AUTO-ALIGN CAMERA',
			checked: true,
		} ) );

		panel.appendChild( cameraSection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — CONTROLS
	// ---------------------------------------------------------------------------

	_buildControlsPanel() {

		const panel = this._tabs.getPanel( 'controls' );
		panel.classList.add( 'settings-panel-grid' );

		// Left: Controller diagram
		const diagramSection = new SectionPanel( { title: 'CONTROLS & INPUT', headingLevel: 3 } );

		const diagram = document.createElement( 'div' );
		diagram.className = 'settings-controller-diagram';
		diagram.setAttribute( 'aria-label', 'Controller diagram placeholder' );
		diagram.setAttribute( 'role', 'img' );

		// Minimal SVG controller silhouette for the placeholder
		diagram.innerHTML = `
			<svg class="settings-controller-diagram__svg" viewBox="0 0 160 100" aria-hidden="true">
				<rect x="30" y="30" width="100" height="50" rx="20" fill="none" stroke="currentColor" stroke-width="2"/>
				<circle cx="55" cy="50" r="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
				<circle cx="105" cy="50" r="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
				<circle cx="80" cy="45" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
				<rect x="60" y="20" width="15" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
				<rect x="85" y="20" width="15" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
			</svg>
			<span class="settings-controller-diagram__label">CONTROLLER DIAGRAM</span>
		`;

		diagramSection.append( diagram );
		panel.appendChild( diagramSection.el );

		// Right: Key Remapping
		const remapSection = new SectionPanel( { title: 'KEY REMAPPING GROUP', headingLevel: 3 } );

		// Key Remapping toggle
		remapSection.append( this._buildToggleRow( {
			id:      'key-remapping',
			label:   'KEY REMAPPING',
			checked: true,
		} ) );

		// K6 / R2 chip buttons
		const chipRow = document.createElement( 'div' );
		chipRow.className = 'settings-remap-keys';
		chipRow.setAttribute( 'aria-label', 'Remappable buttons' );

		const k6Chip = document.createElement( 'button' );
		k6Chip.type = 'button';
		k6Chip.className = 'settings-key-chip';
		k6Chip.setAttribute( 'aria-label', 'Remap K6 button' );
		k6Chip.textContent = 'K6';

		const r2Chip = document.createElement( 'button' );
		r2Chip.type = 'button';
		r2Chip.className = 'settings-key-chip';
		r2Chip.setAttribute( 'aria-label', 'Remap R2 button' );
		r2Chip.textContent = 'R2';

		chipRow.appendChild( k6Chip );
		chipRow.appendChild( r2Chip );
		remapSection.append( chipRow );

		panel.appendChild( remapSection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — AUDIO
	// ---------------------------------------------------------------------------

	_buildAudioPanel() {

		const panel = this._tabs.getPanel( 'audio' );
		panel.classList.add( 'settings-panel-single' );

		const audioSection = new SectionPanel( { title: 'VOLUME', headingLevel: 3 } );

		const sliders = [
			{ id: 'vol-master', label: 'MASTER', value: 80 },
			{ id: 'vol-music',  label: 'MUSIC',  value: 70 },
			{ id: 'vol-sfx',    label: 'SFX',    value: 85 },
			{ id: 'vol-voice',  label: 'VOICE',  value: 60 },
		];

		sliders.forEach( ( s ) => {

			audioSection.append( this._buildSliderRow( {
				id:       s.id,
				label:    s.label,
				min:      0,
				max:      100,
				value:    s.value,
				minLabel: '0',
				maxLabel: '100',
			} ) );

		} );

		panel.appendChild( audioSection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — VIDEO
	// ---------------------------------------------------------------------------

	_buildVideoPanel() {

		const panel = this._tabs.getPanel( 'video' );
		panel.classList.add( 'settings-panel-single' );

		const videoSection = new SectionPanel( { title: 'DISPLAY', headingLevel: 3 } );

		videoSection.append( this._buildSelectRow( {
			id:      'resolution',
			label:   'RESOLUTION',
			options: [ '1920×1080', '2560×1440', '3840×2160', '1280×720' ],
			value:   '1920×1080',
		} ) );

		videoSection.append( this._buildSelectRow( {
			id:      'quality',
			label:   'QUALITY PRESET',
			options: [ 'ULTRA', 'HIGH', 'MEDIUM', 'LOW' ],
			value:   'HIGH',
		} ) );

		panel.appendChild( videoSection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — ACCESSIBILITY
	// ---------------------------------------------------------------------------

	_buildAccessibilityPanel() {

		const panel = this._tabs.getPanel( 'accessibility' );
		panel.classList.add( 'settings-panel-single' );

		const a11ySection = new SectionPanel( { title: 'ACCESSIBILITY', headingLevel: 3 } );

		a11ySection.append( this._buildSliderRow( {
			id:       'text-scale',
			label:    'TEXT SCALE',
			min:      80,
			max:      150,
			value:    100,
			minLabel: '80%',
			maxLabel: '150%',
		} ) );

		a11ySection.append( this._buildSelectRow( {
			id:      'colorblind',
			label:   'COLORBLIND MODE',
			options: [ 'NONE', 'DEUTERANOPIA', 'PROTANOPIA', 'TRITANOPIA', 'MONOCHROMACY' ],
			value:   'NONE',
		} ) );

		a11ySection.append( this._buildToggleRow( {
			id:      'reduce-motion',
			label:   'REDUCE MOTION',
			checked: false,
		} ) );

		panel.appendChild( a11ySection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — ACCOUNT
	// ---------------------------------------------------------------------------

	_buildAccountPanel() {

		const panel = this._tabs.getPanel( 'account' );
		panel.classList.add( 'settings-panel-single' );

		const accountSection = new SectionPanel( { title: 'ACCOUNT', headingLevel: 3 } );

		// Display name
		const nameRow = document.createElement( 'div' );
		nameRow.className = 'settings-row';

		const nameLabel = document.createElement( 'label' );
		nameLabel.className = 'settings-row__label';
		nameLabel.textContent = 'DISPLAY NAME';
		nameLabel.setAttribute( 'for', 'settings-display-name' );

		const nameInput = document.createElement( 'input' );
		nameInput.type = 'text';
		nameInput.id = 'settings-display-name';
		nameInput.className = 'settings-text-input';
		nameInput.value = 'BeastKid';
		nameInput.setAttribute( 'autocomplete', 'nickname' );
		nameInput.setAttribute( 'maxlength', '24' );
		nameInput.setAttribute( 'aria-describedby', 'settings-display-name-hint' );

		const nameHint = document.createElement( 'span' );
		nameHint.id = 'settings-display-name-hint';
		nameHint.className = 'settings-row__hint';
		nameHint.textContent = 'Max 24 characters. Visible to other players.';

		nameRow.appendChild( nameLabel );
		nameRow.appendChild( nameInput );
		nameRow.appendChild( nameHint );
		this._controls.set( 'display-name', nameInput );

		accountSection.append( nameRow );

		// Sign out
		const signOutBtn = new CTAButton( {
			label:    'SIGN OUT',
			variant:  'danger',
			actionId: 'settings_sign_out',
		} );
		accountSection.append( signOutBtn.el );

		panel.appendChild( accountSection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — PRIVACY
	// ---------------------------------------------------------------------------

	_buildPrivacyPanel() {

		const panel = this._tabs.getPanel( 'privacy' );
		panel.classList.add( 'settings-panel-single' );

		const privacySection = new SectionPanel( { title: 'DATA SHARING', headingLevel: 3 } );

		const toggles = [
			{ id: 'analytics',     label: 'GAMEPLAY ANALYTICS',       checked: true  },
			{ id: 'crash-reports', label: 'CRASH REPORTS',            checked: true  },
			{ id: 'personalised',  label: 'PERSONALISED CONTENT',     checked: false },
			{ id: 'social-share',  label: 'SOCIAL ACTIVITY SHARING',  checked: false },
		];

		toggles.forEach( ( t ) => privacySection.append( this._buildToggleRow( t ) ) );

		panel.appendChild( privacySection.el );

	}

	// ---------------------------------------------------------------------------
	// Panel builders — CREDITS
	// ---------------------------------------------------------------------------

	_buildCreditsPanel() {

		const panel = this._tabs.getPanel( 'credits' );
		panel.classList.add( 'settings-panel-single' );

		const creditsSection = new SectionPanel( { title: 'KART KIDS — CREDITS', headingLevel: 3 } );

		const scroll = document.createElement( 'div' );
		scroll.className = 'settings-credits-scroll';

		const block = document.createElement( 'div' );
		block.className = 'settings-credits-block';

		const creditGroups = [
			{
				heading: 'GAME DIRECTION',
				names: 'Creative Director\nArt Director\nUX Lead',
			},
			{
				heading: 'ENGINEERING',
				names: 'Lead Programmer\nUI Programmer\nPhysics Programmer\nAudio Engineer',
			},
			{
				heading: 'ART & DESIGN',
				names: 'Environment Art\nCharacter Art\nVFX Artist\nUI / UX Designer',
			},
			{
				heading: 'AUDIO',
				names: 'Music Composer\nSound Designer',
			},
			{
				heading: 'SPECIAL THANKS',
				names: 'Kenney.nl — Original Godot Starter Kit Racing assets\nThree.js Community\nAll our early playtesters',
			},
		];

		creditGroups.forEach( ( group ) => {

			const section = document.createElement( 'div' );

			const heading = document.createElement( 'p' );
			heading.className = 'settings-credits-section__heading';
			heading.textContent = group.heading;

			const names = document.createElement( 'p' );
			names.className = 'settings-credits-section__names';
			names.style.whiteSpace = 'pre-line';
			names.textContent = group.names;

			section.appendChild( heading );
			section.appendChild( names );
			block.appendChild( section );

		} );

		const version = document.createElement( 'p' );
		version.className = 'settings-credits-version';
		version.textContent = 'KART KIDS ALPHA v1.0.0';
		block.appendChild( version );

		scroll.appendChild( block );
		creditsSection.append( scroll );
		panel.appendChild( creditsSection.el );

	}

	// ---------------------------------------------------------------------------
	// Control builder helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a labelled range slider row.
	 *
	 * @param {{ id: string, label: string, min: number, max: number, value: number, minLabel?: string, maxLabel?: string }} cfg
	 * @returns {HTMLElement}
	 */
	_buildSliderRow( cfg ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const labelEl = document.createElement( 'label' );
		labelEl.className = 'settings-row__label';
		labelEl.textContent = cfg.label;
		labelEl.setAttribute( 'for', `settings-${cfg.id}` );

		const wrap = document.createElement( 'div' );
		wrap.className = 'settings-slider-wrap';

		const input = document.createElement( 'input' );
		input.type = 'range';
		input.id = `settings-${cfg.id}`;
		input.className = 'settings-slider';
		input.min = String( cfg.min );
		input.max = String( cfg.max );
		input.value = String( cfg.value );
		input.setAttribute( 'aria-label', cfg.label );
		input.setAttribute( 'aria-valuemin', String( cfg.min ) );
		input.setAttribute( 'aria-valuemax', String( cfg.max ) );
		input.setAttribute( 'aria-valuenow', String( cfg.value ) );

		wrap.appendChild( input );

		if ( cfg.minLabel || cfg.maxLabel ) {

			const sliderLabels = document.createElement( 'div' );
			sliderLabels.className = 'settings-slider-labels';
			sliderLabels.setAttribute( 'aria-hidden', 'true' );

			const minSpan = document.createElement( 'span' );
			minSpan.textContent = cfg.minLabel ?? '';

			const maxSpan = document.createElement( 'span' );
			maxSpan.textContent = cfg.maxLabel ?? '';

			sliderLabels.appendChild( minSpan );
			sliderLabels.appendChild( maxSpan );
			wrap.appendChild( sliderLabels );

		}

		row.appendChild( labelEl );
		row.appendChild( wrap );

		this._controls.set( cfg.id, input );
		return row;

	}

	/**
	 * Build a labelled toggle row.
	 *
	 * @param {{ id: string, label: string, checked: boolean }} cfg
	 * @returns {HTMLElement}
	 */
	_buildToggleRow( cfg ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-toggle-row';

		const labelEl = document.createElement( 'span' );
		labelEl.className = 'settings-row__label';
		labelEl.textContent = cfg.label;
		labelEl.setAttribute( 'id', `settings-${cfg.id}-label` );

		const toggle = document.createElement( 'label' );
		toggle.className = 'settings-toggle';
		toggle.setAttribute( 'aria-label', cfg.label );

		const input = document.createElement( 'input' );
		input.type = 'checkbox';
		input.id = `settings-${cfg.id}`;
		input.checked = cfg.checked;
		input.setAttribute( 'aria-labelledby', `settings-${cfg.id}-label` );
		input.setAttribute( 'role', 'switch' );
		input.setAttribute( 'aria-checked', String( cfg.checked ) );

		// Keep aria-checked in sync
		input.addEventListener( 'change', () => {

			input.setAttribute( 'aria-checked', String( input.checked ) );

		} );

		const track = document.createElement( 'span' );
		track.className = 'settings-toggle__track';
		track.setAttribute( 'aria-hidden', 'true' );

		toggle.appendChild( input );
		toggle.appendChild( track );

		row.appendChild( labelEl );
		row.appendChild( toggle );

		this._controls.set( cfg.id, input );
		return row;

	}

	/**
	 * Build a labelled select row.
	 *
	 * @param {{ id: string, label: string, options: string[], value: string }} cfg
	 * @returns {HTMLElement}
	 */
	_buildSelectRow( cfg ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const labelEl = document.createElement( 'label' );
		labelEl.className = 'settings-row__label';
		labelEl.textContent = cfg.label;
		labelEl.setAttribute( 'for', `settings-${cfg.id}` );

		const select = document.createElement( 'select' );
		select.id = `settings-${cfg.id}`;
		select.className = 'settings-select';
		select.setAttribute( 'aria-label', cfg.label );

		cfg.options.forEach( ( opt ) => {

			const option = document.createElement( 'option' );
			option.value = opt;
			option.textContent = opt;
			if ( opt === cfg.value ) option.selected = true;
			select.appendChild( option );

		} );

		row.appendChild( labelEl );
		row.appendChild( select );

		this._controls.set( cfg.id, select );
		return row;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get resetBtn() { return this._resetBtn; }

	/** @returns {CTAButton} */
	get applyBtn() { return this._applyBtn; }

	/** @returns {PageHeader} */
	get pageHeader() { return this._pageHeader; }

	/** @returns {Tabs} */
	get tabs() { return this._tabs; }

	/**
	 * Read the current value of a named control.
	 * Returns checkbox boolean for toggles, string value for sliders/selects/inputs.
	 *
	 * @param {string} controlId
	 * @returns {string|boolean|null}
	 */
	getControlValue( controlId ) {

		const el = this._controls.get( controlId );
		if ( ! el ) return null;
		if ( el.type === 'checkbox' ) return el.checked;
		return el.value;

	}

	/**
	 * Collect all control values into a plain object for the controller to persist.
	 *
	 * @returns {object}
	 */
	getAllValues() {

		const result = {};
		this._controls.forEach( ( el, id ) => {

			result[ id ] = el.type === 'checkbox' ? el.checked : el.value;

		} );
		return result;

	}

	/**
	 * Restore control values from a saved settings object.
	 *
	 * @param {object} values  Plain object of controlId → value pairs.
	 */
	setAllValues( values ) {

		Object.entries( values ).forEach( ( [ id, value ] ) => {

			const el = this._controls.get( id );
			if ( ! el ) return;

			if ( el.type === 'checkbox' ) {

				el.checked = Boolean( value );
				el.setAttribute( 'aria-checked', String( el.checked ) );

			} else {

				el.value = String( value );

			}

		} );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		requestAnimationFrame( () => {

			this._tabs?.el.querySelector( '[aria-selected="true"]' )?.focus( { preventScroll: true } );

		} );

	}

	dispose() {

		this._pageHeader?.dispose();
		this._pageHeader = null;

		this._tabs?.dispose();
		this._tabs = null;

		this._resetBtn?.dispose();
		this._resetBtn = null;

		this._applyBtn?.dispose();
		this._applyBtn = null;

		this._controls.clear();

		super.dispose();

	}

}

Page21SettingsView._cssInjected = false;
