import { PageViewBase } from '../../core/PageViewBase.js';
import { MarginalPanelCard } from '../../components/MarginalPanelCard.js';
import { MarginalPanelHeader } from '../../components/MarginalPanelHeader.js';
import { Tabs } from '../../components/Tabs.js';

const SETTINGS_SECTIONS = Object.freeze( [
	{
		id: 'race',
		label: 'Race',
		summaryLabel: 'Grid Rules',
		title: 'Race Systems',
		copy: 'AI count, difficulty, assists, and ghost defaults.',
	},
	{
		id: 'controls',
		label: 'Controls',
		summaryLabel: 'Input Setup',
		title: 'Driver Input',
		copy: 'Handedness, tilt steering, and camera defaults.',
	},
	{
		id: 'audio',
		label: 'Audio',
		summaryLabel: 'Mix Levels',
		title: 'Audio Bus',
		copy: 'Music and effects in one focused mix lane.',
	},
	{
		id: 'display',
		label: 'Display',
		summaryLabel: 'Render Stack',
		title: 'Display Systems',
		copy: 'Rendering quality and HUD units together.',
	},
	{
		id: 'accessibility',
		label: 'Accessibility',
		summaryLabel: 'Readability',
		title: 'Accessibility',
		copy: 'Text scale, color filters, and motion comfort.',
	},
	{
		id: 'about',
		label: 'About',
		summaryLabel: 'Data Policy',
		title: 'Privacy + Credits',
		copy: 'Telemetry controls and credits in one quieter system page.',
	},
] );

const SECTION_META = Object.freeze(
	SETTINGS_SECTIONS.reduce( ( map, section ) => {

		map[ section.id ] = section;
		return map;

	}, {} )
);

function createActionButton( label, variant = 'ghost' ) {

	const el = document.createElement( 'button' );
	el.type = 'button';
	el.className = `page-settings__action page-settings__action--${ variant }`;

	const labelEl = document.createElement( 'span' );
	labelEl.className = 'page-settings__action-label';
	labelEl.textContent = label;
	el.appendChild( labelEl );

	const spinnerEl = document.createElement( 'span' );
	spinnerEl.className = 'page-settings__action-spinner';
	spinnerEl.setAttribute( 'aria-hidden', 'true' );
	el.appendChild( spinnerEl );

	return {
		el,
		setLoading( loading ) {

			el.classList.toggle( 'page-settings__action--loading', !! loading );
			el.disabled = !! loading;

		},
		dispose() {

			el.remove();

		},
	};

}

function createGroupCard( title, copy = '', accent = false ) {

	const group = document.createElement( 'section' );
	group.className = `page-settings__group${ accent ? ' page-settings__group--accent' : '' }`;

	const header = document.createElement( 'div' );
	header.className = 'page-settings__group-header';
	group.appendChild( header );

	const titleEl = document.createElement( 'h3' );
	titleEl.className = 'page-settings__group-title';
	titleEl.textContent = title;
	header.appendChild( titleEl );

	if ( copy ) {

		const copyEl = document.createElement( 'p' );
		copyEl.className = 'page-settings__group-copy';
		copyEl.textContent = copy;
		group.appendChild( copyEl );

	}

	const body = document.createElement( 'div' );
	body.className = 'page-settings__group-body';
	group.appendChild( body );

	return { el: group, bodyEl: body };

}

export class Page21SettingsView extends PageViewBase {

	static _cssInjected = false;

	constructor( config = {} ) {

		super( 'page-settings' );

		this._config = {
			modalMode: false,
			...config,
		};

		this._controls = new Map();
		this._controlPresenters = new Map();
		this._pageHeader = null;
		this._tabs = null;
		this._resetBtn = null;
		this._applyBtn = null;
		this._debugBtn = null;
		this._summaryCardRightEl = null;
		this._summaryEyebrowEl = null;
		this._summaryTitleEl = null;
		this._summaryCopyEl = null;
		this._workspaceCardRightEl = null;
		this._statusCardRightEl = null;
		this._statusValueEl = null;
		this._statusCopyEl = null;
		this._activeTabId = SETTINGS_SECTIONS[ 0 ].id;
		this._suspendDirtyTracking = false;

		this._injectCSS();
		this._build();

	}

	_injectCSS() {

		if ( Page21SettingsView._cssInjected ) return;
		Page21SettingsView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.page-settings {
				--mv-cream: #f7f3e9;
				--mv-red: #d82c2c;
				--mv-dark: #0f1115;
				width: 100%;
				min-height: 100%;
				color: var(--mv-dark);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				text-transform: uppercase;
				background: var(--mv-cream);
				overflow-x: hidden;
				overflow-y: auto;
				overscroll-behavior: contain;
			}

			.page-settings--page {
				min-height: 100dvh;
			}

			.page-settings__shell {
				display: grid;
				grid-template-rows: auto auto minmax(0, 1fr);
				gap: 20px;
				min-height: 100%;
				width: min(1380px, 100%);
				margin: 0 auto;
			}

			.page-settings--modal .page-settings__shell {
				min-height: min(44rem, calc(100dvh - 8rem));
			}

			.page-settings--page .page-settings__shell {
				min-height: 100dvh;
				padding:
					clamp(18px, 3vw, 32px)
					clamp(18px, 3vw, 32px)
					clamp(24px, 4vw, 44px);
			}

			.page-settings__back {
				justify-self: start;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 2.5rem;
				padding: 0.65rem 0.95rem;
				border: 1px solid rgba(15, 17, 21, 0.2);
				background: rgba(15, 17, 21, 0.03);
				color: var(--mv-dark);
				font-family: inherit;
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.16em;
				text-transform: uppercase;
				cursor: pointer;
				transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
			}

			.page-settings__back:hover,
			.page-settings__back:focus-visible {
				transform: translateY(-1px);
				border-color: rgba(216, 44, 44, 0.35);
				background: rgba(216, 44, 44, 0.08);
			}

			.page-settings .kk-mv-header {
				padding-top: 0;
				padding-bottom: 14px;
				border-bottom-color: rgba(15, 17, 21, 0.14);
				color: var(--mv-dark);
			}

			.page-settings .kk-mv-header__badge {
				border-color: rgba(15, 17, 21, 0.2);
				color: var(--mv-dark);
				font-size: 0.95rem;
			}

			.page-settings__top {
				display: grid;
				grid-template-columns: minmax(0, 1.35fr) minmax(320px, 380px);
				align-items: start;
				gap: 16px;
			}

			.page-settings__card-shell {
				border: 1px solid rgba(15, 17, 21, 0.12);
				box-shadow: 0 16px 32px rgba(15, 17, 21, 0.08);
			}

			.page-settings__card-shell.kk-mv-card--red {
				box-shadow: 0 18px 34px rgba(216, 44, 44, 0.2);
			}

			.page-settings__summary-eyebrow,
			.page-settings__status-label {
				font-size: 0.58rem;
				font-weight: 700;
				letter-spacing: 0.18em;
				opacity: 0.64;
			}

			.page-settings__summary-title,
			.page-settings__status-value {
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				font-size: clamp(1.75rem, 3.2vw, 2.45rem);
				font-weight: 900;
				line-height: 0.9;
				letter-spacing: -0.06em;
			}

			.page-settings__summary-copy,
			.page-settings__status-copy,
			.page-settings__summary-note {
				margin: 0;
				font-size: 0.56rem;
				line-height: 1.6;
				letter-spacing: 0.14em;
			}

			.page-settings__summary-copy,
			.page-settings__summary-note {
				color: rgba(15, 17, 21, 0.72);
			}

			.page-settings__summary-note {
				padding-top: 10px;
				border-top: 1px solid rgba(15, 17, 21, 0.12);
			}

			.page-settings__status-copy {
				color: rgba(247, 243, 233, 0.9);
			}

			.page-settings__status-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
				margin-top: 4px;
			}

			.page-settings__workspace {
				min-height: 0;
			}

			.page-settings__workspace .kk-mv-card {
				min-height: min(52rem, calc(100dvh - 18rem));
			}

			.page-settings__workspace .kk-mv-card__body {
				min-height: 0;
			}

			.page-settings__tabs-wrap {
				display: flex;
				flex-direction: column;
				gap: 16px;
			}

			.page-settings .kk-tabs {
				gap: 14px;
				padding-bottom: 6px;
				background: transparent;
				border-bottom: 1px solid rgba(15, 17, 21, 0.14);
			}

			.page-settings .kk-tabs__tab {
				padding: 0.35rem 0 0.8rem;
				border-bottom-width: 2px;
				color: rgba(15, 17, 21, 0.52);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.18em;
			}

			.page-settings .kk-tabs__tab:hover {
				color: var(--mv-dark);
			}

			.page-settings .kk-tabs__tab--selected,
			.page-settings .kk-tabs__tab[aria-selected="true"] {
				color: var(--mv-red);
				border-bottom-color: var(--mv-red);
			}

			.page-settings__panels {
				overflow: visible;
			}

			.page-settings__panel {
				display: grid;
				gap: 16px;
			}

			.page-settings__panel-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 16px;
			}

			.page-settings__panel-grid--single {
				grid-template-columns: minmax(0, 1fr);
			}

			.page-settings__group {
				display: grid;
				gap: 12px;
				padding: 16px;
				background: rgba(15, 17, 21, 0.035);
				border: 1px solid rgba(15, 17, 21, 0.12);
				clip-path: polygon(0 0, 100% 0, 100% 94%, 97% 100%, 0 100%);
			}

			.page-settings__group--accent {
				background: rgba(216, 44, 44, 0.94);
				border-color: rgba(216, 44, 44, 0.94);
				color: var(--mv-cream);
			}

			.page-settings__group-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				padding-bottom: 8px;
				border-bottom: 1px solid currentColor;
			}

			.page-settings__group-title {
				margin: 0;
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				font-size: 1.35rem;
				font-weight: 900;
				line-height: 0.92;
				letter-spacing: -0.04em;
			}

			.page-settings__group-copy,
			.page-settings__credits {
				margin: 0;
				font-size: 0.58rem;
				line-height: 1.7;
				letter-spacing: 0.14em;
			}

			.page-settings__group:not(.page-settings__group--accent) .page-settings__group-copy {
				color: rgba(15, 17, 21, 0.7);
			}

			.page-settings__credits {
				color: rgba(247, 243, 233, 0.88);
			}

			.page-settings__group-body {
				display: grid;
				gap: 0;
			}

			.page-settings__control {
				display: grid;
				gap: 8px;
				padding-top: 12px;
				border-top: 1px solid rgba(15, 17, 21, 0.12);
			}

			.page-settings__group--accent .page-settings__control {
				border-top-color: rgba(247, 243, 233, 0.22);
			}

			.page-settings__control:first-child {
				padding-top: 0;
				border-top: none;
			}

			.page-settings__control-head {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 12px;
			}

			.page-settings__control-label,
			.page-settings__control-value,
			.page-settings__control-toggle {
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.14em;
			}

			.page-settings__control-value {
				color: var(--mv-red);
			}

			.page-settings__control-hint {
				font-size: 0.56rem;
				line-height: 1.65;
				letter-spacing: 0.14em;
				color: rgba(15, 17, 21, 0.58);
			}

			.page-settings__group--accent .page-settings__control-hint {
				color: rgba(247, 243, 233, 0.82);
			}

			.page-settings__range {
				width: 100%;
				accent-color: var(--mv-red);
			}

			.page-settings__select {
				width: 100%;
				min-height: 2.8rem;
				border: 1px solid rgba(15, 17, 21, 0.18);
				background: rgba(247, 243, 233, 0.82);
				color: var(--mv-dark);
				padding: 0.72rem 0.85rem;
				font: inherit;
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.12em;
				text-transform: uppercase;
			}

			.page-settings__toggle {
				display: inline-flex;
				align-items: center;
				gap: 10px;
				cursor: pointer;
			}

			.page-settings__toggle input {
				accent-color: var(--mv-red);
			}

			.page-settings__action {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 0.55rem;
				min-height: 2.45rem;
				padding: 0.68rem 0.9rem;
				border: 1px solid rgba(247, 243, 233, 0.72);
				background: transparent;
				color: var(--mv-cream);
				font-family: inherit;
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.14em;
				text-transform: uppercase;
				cursor: pointer;
				transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
			}

			.page-settings__action:hover,
			.page-settings__action:focus-visible {
				transform: translateY(-1px);
			}

			.page-settings__action:disabled {
				opacity: 0.55;
				cursor: not-allowed;
				transform: none;
			}

			.page-settings__action--primary {
				background: var(--mv-cream);
				border-color: var(--mv-cream);
				color: var(--mv-dark);
			}

			.page-settings__action--ghost:hover,
			.page-settings__action--ghost:focus-visible {
				background: rgba(247, 243, 233, 0.12);
			}

			.page-settings__action--subtle {
				background: rgba(15, 17, 21, 0.14);
				border-color: rgba(247, 243, 233, 0.28);
			}

			.page-settings__action-spinner {
				display: none;
				width: 0.7rem;
				height: 0.7rem;
				border: 2px solid currentColor;
				border-right-color: transparent;
				border-radius: 50%;
				animation: page-settings-spin 0.8s linear infinite;
			}

			.page-settings__action--loading .page-settings__action-spinner {
				display: inline-block;
			}

			.page-settings__action--loading .page-settings__action-label {
				opacity: 0.72;
			}

			@keyframes page-settings-spin {
				to { transform: rotate(360deg); }
			}

			@media (max-width: 980px) {
				.page-settings__shell {
					grid-template-rows: auto auto auto;
				}

				.page-settings__top,
				.page-settings__panel-grid {
					grid-template-columns: 1fr;
				}

				.page-settings__status-actions {
					flex-direction: column;
				}

				.page-settings__action {
					width: 100%;
				}
			}

			@media (max-width: 720px) {
				.page-settings--page .page-settings__shell {
					padding: 18px 16px 24px;
				}

				.page-settings .kk-tabs {
					gap: 12px;
				}

				.page-settings .kk-tabs__tab {
					padding-bottom: 0.7rem;
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.classList.add( this._config.modalMode ? 'page-settings--modal' : 'page-settings--page' );

		const shell = document.createElement( 'div' );
		shell.className = 'page-settings__shell';
		root.appendChild( shell );

		if ( ! this._config.modalMode ) {

			const back = document.createElement( 'button' );
			back.type = 'button';
			back.className = 'page-settings__back';
			back.textContent = 'Back';
			back.addEventListener( 'click', () => {

				root.dispatchEvent( new CustomEvent( 'kk:pageheader:back', { bubbles: true } ) );

			} );
			shell.appendChild( back );

		}

		const header = new MarginalPanelHeader( {
			title: 'Settings',
			subtitle: 'System Console // Race, Input, Audio, Display, Accessibility',
			badge: 'System',
		} );
		shell.appendChild( header.el );
		this._pageHeader = header.el;

		const top = document.createElement( 'div' );
		top.className = 'page-settings__top';
		top.appendChild( this._buildSummaryCard() );
		top.appendChild( this._buildStatusCard() );
		shell.appendChild( top );

		shell.appendChild( this._buildWorkspaceCard() );

		this.setActiveSection( this._activeTabId );
		this.markClean( 'Live' );

	}

	_buildSummaryCard() {

		const card = new MarginalPanelCard( {
			headerLeft: 'Section Focus',
			headerRight: SECTION_META[ this._activeTabId ]?.label || 'Race',
		} );
		card.el.classList.add( 'page-settings__card-shell' );
		this._summaryCardRightEl = card.headerRightEl;

		const eyebrow = document.createElement( 'div' );
		eyebrow.className = 'page-settings__summary-eyebrow';
		card.bodyEl.appendChild( eyebrow );
		this._summaryEyebrowEl = eyebrow;

		const title = document.createElement( 'div' );
		title.className = 'page-settings__summary-title';
		card.bodyEl.appendChild( title );
		this._summaryTitleEl = title;

		const copy = document.createElement( 'p' );
		copy.className = 'page-settings__summary-copy';
		card.bodyEl.appendChild( copy );
		this._summaryCopyEl = copy;

		return card.el;

	}

	_buildStatusCard() {

		const card = new MarginalPanelCard( {
			variant: 'red',
			headerLeft: 'Session State',
			headerRight: 'Live',
			sticker: this._config.modalMode ? 'Menu: Ready' : 'Fullscreen Route',
		} );
		card.el.classList.add( 'page-settings__card-shell' );
		this._statusCardRightEl = card.headerRightEl;

		const label = document.createElement( 'div' );
		label.className = 'page-settings__status-label';
		label.textContent = 'Apply Flow';
		card.bodyEl.appendChild( label );

		const value = document.createElement( 'div' );
		value.className = 'page-settings__status-value';
		card.bodyEl.appendChild( value );
		this._statusValueEl = value;

		const copy = document.createElement( 'p' );
		copy.className = 'page-settings__status-copy';
		card.bodyEl.appendChild( copy );
		this._statusCopyEl = copy;

		const actions = document.createElement( 'div' );
		actions.className = 'page-settings__status-actions';

		this._resetBtn = createActionButton( 'Reset Defaults', 'ghost' );
		this._applyBtn = createActionButton( 'Apply Changes', 'primary' );
		actions.appendChild( this._resetBtn.el );
		actions.appendChild( this._applyBtn.el );

		if ( ! this._config.modalMode ) {

			const debugBtn = document.createElement( 'button' );
			debugBtn.type = 'button';
			debugBtn.className = 'page-settings__action page-settings__action--subtle';
			debugBtn.textContent = 'Debug Console';
			actions.appendChild( debugBtn );
			this._debugBtn = debugBtn;

		}

		card.bodyEl.appendChild( actions );

		return card.el;

	}

	_buildWorkspaceCard() {

		const card = new MarginalPanelCard( {
			headerLeft: 'System Controls',
			headerRight: SECTION_META[ this._activeTabId ]?.label || 'Race',
		} );
		card.el.classList.add( 'page-settings__card-shell', 'page-settings__workspace' );
		this._workspaceCardRightEl = card.headerRightEl;

		const tabsWrap = document.createElement( 'div' );
		tabsWrap.className = 'page-settings__tabs-wrap';

		this._tabs = new Tabs( {
			tabs: SETTINGS_SECTIONS.map( ( section ) => ( {
				id: section.id,
				label: section.label,
			} ) ),
			activeId: this._activeTabId,
			ariaLabel: 'Settings sections',
		} );
		tabsWrap.appendChild( this._tabs.el );

		const panelsWrap = document.createElement( 'div' );
		panelsWrap.className = 'page-settings__panels';
		SETTINGS_SECTIONS.forEach( ( section ) => {

			const panel = this._tabs.getPanel( section.id );
			panel?.classList.add( 'page-settings__panel' );
			if ( panel ) panelsWrap.appendChild( panel );

		} );
		tabsWrap.appendChild( panelsWrap );

		card.bodyEl.appendChild( tabsWrap );

		this._buildRacePanel();
		this._buildControlsPanel();
		this._buildAudioPanel();
		this._buildDisplayPanel();
		this._buildAccessibilityPanel();
		this._buildAboutPanel();

		return card.el;

	}

	_createPanelGrid( tabId, singleColumn = false ) {

		const panel = this._tabs.getPanel( tabId );
		const grid = document.createElement( 'div' );
		grid.className = `page-settings__panel-grid${ singleColumn ? ' page-settings__panel-grid--single' : '' }`;
		panel?.appendChild( grid );
		return grid;

	}

	_registerControl( id, el, presenter = null ) {

		this._controls.set( id, el );
		if ( typeof presenter === 'function' ) this._controlPresenters.set( id, presenter );

		const onMutate = () => {

			presenter?.();
			if ( ! this._suspendDirtyTracking ) this.markDirty();

		};

		el.addEventListener( 'input', onMutate );
		el.addEventListener( 'change', onMutate );
		presenter?.();

	}

	_addRangeRow( container, { id, label, min, max, value, hint = '', formatValue = ( current ) => String( current ) } ) {

		const row = document.createElement( 'div' );
		row.className = 'page-settings__control';

		const head = document.createElement( 'div' );
		head.className = 'page-settings__control-head';
		row.appendChild( head );

		const labelEl = document.createElement( 'span' );
		labelEl.className = 'page-settings__control-label';
		labelEl.textContent = label;
		head.appendChild( labelEl );

		const valueEl = document.createElement( 'span' );
		valueEl.className = 'page-settings__control-value';
		head.appendChild( valueEl );

		const input = document.createElement( 'input' );
		input.type = 'range';
		input.className = 'page-settings__range';
		input.min = String( min );
		input.max = String( max );
		input.value = String( value );
		row.appendChild( input );

		if ( hint ) {

			const hintEl = document.createElement( 'div' );
			hintEl.className = 'page-settings__control-hint';
			hintEl.textContent = hint;
			row.appendChild( hintEl );

		}

		container.appendChild( row );
		this._registerControl( id, input, () => {

			valueEl.textContent = formatValue( input.value );

		} );

	}

	_addSelectRow( container, { id, label, options, value, hint = '' } ) {

		const row = document.createElement( 'div' );
		row.className = 'page-settings__control';

		const labelEl = document.createElement( 'div' );
		labelEl.className = 'page-settings__control-label';
		labelEl.textContent = label;
		row.appendChild( labelEl );

		const select = document.createElement( 'select' );
		select.className = 'page-settings__select';

		options.forEach( ( optionDef ) => {

			const optionConfig = typeof optionDef === 'string'
				? { value: optionDef, label: optionDef.replace( /_/g, ' ' ) }
				: optionDef;
			const option = document.createElement( 'option' );
			option.value = optionConfig.value;
			option.textContent = optionConfig.label;
			option.selected = optionConfig.value === value;
			select.appendChild( option );

		} );

		row.appendChild( select );

		if ( hint ) {

			const hintEl = document.createElement( 'div' );
			hintEl.className = 'page-settings__control-hint';
			hintEl.textContent = hint;
			row.appendChild( hintEl );

		}

		container.appendChild( row );
		this._registerControl( id, select );

	}

	_addToggleRow( container, { id, label, checked, hint = '' } ) {

		const row = document.createElement( 'div' );
		row.className = 'page-settings__control';

		const toggle = document.createElement( 'label' );
		toggle.className = 'page-settings__toggle';
		row.appendChild( toggle );

		const input = document.createElement( 'input' );
		input.type = 'checkbox';
		input.checked = !! checked;
		toggle.appendChild( input );

		const text = document.createElement( 'span' );
		text.className = 'page-settings__control-toggle';
		text.textContent = label;
		toggle.appendChild( text );

		if ( hint ) {

			const hintEl = document.createElement( 'div' );
			hintEl.className = 'page-settings__control-hint';
			hintEl.textContent = hint;
			row.appendChild( hintEl );

		}

		container.appendChild( row );
		this._registerControl( id, input );

	}

	_buildRacePanel() {

		const grid = this._createPanelGrid( 'race' );

		const gridGroup = createGroupCard( 'Grid Setup', 'Core solo-race defaults that affect pace and grid pressure.' );
		this._addRangeRow( gridGroup.bodyEl, {
			id: 'ai-count',
			label: 'AI Racers',
			min: 0,
			max: 8,
			value: 0,
			hint: 'How many CPU drivers join your solo sessions.',
		} );
		this._addRangeRow( gridGroup.bodyEl, {
			id: 'difficulty',
			label: 'Difficulty',
			min: 0,
			max: 100,
			value: 50,
			hint: 'Raise or lower rival aggression and pacing.',
		} );
		grid.appendChild( gridGroup.el );

		const assistGroup = createGroupCard( 'Assist Rules', 'Utility systems that smooth runs without changing your profile or loadout.' );
		this._addToggleRow( assistGroup.bodyEl, {
			id: 'steering-assist',
			label: 'Steering Assist',
			checked: false,
			hint: 'Adds correction when you over-rotate into corners.',
		} );
		this._addToggleRow( assistGroup.bodyEl, {
			id: 'ghost-enabled',
			label: 'Ghost Replay',
			checked: true,
			hint: 'Shows your best lap ghost when data exists.',
		} );
		grid.appendChild( assistGroup.el );

	}

	_buildControlsPanel() {

		const grid = this._createPanelGrid( 'controls' );

		const inputGroup = createGroupCard( 'Input Layout', 'Grip, steering style, and camera preference belong in one compact setup lane.' );
		this._addSelectRow( inputGroup.bodyEl, {
			id: 'handedness',
			label: 'Layout',
			options: [
				{ value: 'RIGHT', label: 'Right' },
				{ value: 'LEFT', label: 'Left' },
			],
			value: 'RIGHT',
			hint: 'Moves throttle and steering touch zones to match your grip.',
		} );
		this._addToggleRow( inputGroup.bodyEl, {
			id: 'accelerometer',
			label: 'Tilt Steering',
			checked: false,
			hint: 'Use device tilt for steering on supported hardware.',
		} );
		grid.appendChild( inputGroup.el );

		const cameraGroup = createGroupCard( 'Camera Defaults', 'Choose how races present themselves before the HUD comes online.' );
		this._addSelectRow( cameraGroup.bodyEl, {
			id: 'camera-mode',
			label: 'Preferred Camera',
			options: [
				{ value: 'CHASE', label: 'Chase' },
				{ value: 'ORBIT', label: 'Orbit' },
				{ value: 'TOPDOWN', label: 'Top Down' },
			],
			value: 'CHASE',
			hint: 'Sets the default in-race camera mode.',
		} );
		grid.appendChild( cameraGroup.el );

	}

	_buildAudioPanel() {

		const grid = this._createPanelGrid( 'audio', true );
		const mixGroup = createGroupCard( 'Mix Levels', 'Fast access to soundtrack and effects without a second layer of cards.' );
		this._addRangeRow( mixGroup.bodyEl, {
			id: 'music-volume',
			label: 'Music Volume',
			min: 0,
			max: 100,
			value: 100,
			hint: 'Controls menu and race soundtrack level.',
			formatValue: ( current ) => `${ current }%`,
		} );
		this._addRangeRow( mixGroup.bodyEl, {
			id: 'sfx-volume',
			label: 'SFX Volume',
			min: 0,
			max: 100,
			value: 100,
			hint: 'Controls engines, drift, collision, and item effects.',
			formatValue: ( current ) => `${ current }%`,
		} );
		grid.appendChild( mixGroup.el );

	}

	_buildDisplayPanel() {

		const grid = this._createPanelGrid( 'display' );

		const renderGroup = createGroupCard( 'Render Stack', 'Quality and motion-heavy effects stay grouped for easier performance tuning.' );
		this._addSelectRow( renderGroup.bodyEl, {
			id: 'quality',
			label: 'Quality Preset',
			options: [
				{ value: 'LOW', label: 'Low' },
				{ value: 'MEDIUM', label: 'Medium' },
				{ value: 'HIGH', label: 'High' },
				{ value: 'ULTRA', label: 'Ultra' },
			],
			value: 'HIGH',
			hint: 'Adjusts post-processing and overall render load.',
		} );
		this._addToggleRow( renderGroup.bodyEl, {
			id: 'reduce-vfx',
			label: 'Reduce Motion FX',
			checked: false,
			hint: 'Softens strong visual effects for a calmer presentation.',
		} );
		grid.appendChild( renderGroup.el );

		const hudGroup = createGroupCard( 'Race HUD', 'Menu presentation and race readouts stay consistent once you choose them here.' );
		this._addSelectRow( hudGroup.bodyEl, {
			id: 'speed-unit',
			label: 'Speed Unit',
			options: [
				{ value: 'KMH', label: 'KMH' },
				{ value: 'MPH', label: 'MPH' },
			],
			value: 'KMH',
			hint: 'Changes speed readouts across menus and the runtime HUD.',
		} );
		grid.appendChild( hudGroup.el );

	}

	_buildAccessibilityPanel() {

		const grid = this._createPanelGrid( 'accessibility' );

		const readableGroup = createGroupCard( 'Readability', 'Typography and color support deserve their own dedicated lane.' );
		this._addRangeRow( readableGroup.bodyEl, {
			id: 'text-scale',
			label: 'Text Scale',
			min: 80,
			max: 150,
			value: 100,
			hint: 'Scales interface copy for easier reading.',
			formatValue: ( current ) => `${ current }%`,
		} );
		this._addSelectRow( readableGroup.bodyEl, {
			id: 'colorblind',
			label: 'Color Filter',
			options: [
				{ value: 'NONE', label: 'None' },
				{ value: 'DEUTERANOPIA', label: 'Deuteranopia' },
				{ value: 'PROTANOPIA', label: 'Protanopia' },
				{ value: 'TRITANOPIA', label: 'Tritanopia' },
			],
			value: 'NONE',
			hint: 'Applies alternate color treatment where supported.',
		} );
		grid.appendChild( readableGroup.el );

		const comfortGroup = createGroupCard( 'Motion Comfort', 'Reduce movement-heavy UI beats without losing important feedback.' );
		this._addToggleRow( comfortGroup.bodyEl, {
			id: 'reduce-motion',
			label: 'Reduce Motion',
			checked: false,
			hint: 'Turns down non-essential animation across the interface.',
		} );
		grid.appendChild( comfortGroup.el );

	}

	_buildAboutPanel() {

		const grid = this._createPanelGrid( 'about' );

		const privacyGroup = createGroupCard( 'Data Policy', 'Privacy controls stay grouped instead of spreading across extra tabs.' );
		this._addToggleRow( privacyGroup.bodyEl, {
			id: 'analytics',
			label: 'Gameplay Analytics',
			checked: true,
			hint: 'Share anonymous gameplay tuning data to help improve balancing.',
		} );
		this._addToggleRow( privacyGroup.bodyEl, {
			id: 'crash-reports',
			label: 'Crash Reports',
			checked: true,
			hint: 'Send crash diagnostics so stability regressions are easier to fix.',
		} );
		this._addToggleRow( privacyGroup.bodyEl, {
			id: 'personalised',
			label: 'Personalised Content',
			checked: false,
			hint: 'Allow content suggestions tailored to your play history.',
		} );
		this._addToggleRow( privacyGroup.bodyEl, {
			id: 'social-share',
			label: 'Social Activity Sharing',
			checked: false,
			hint: 'Show race activity in connected community surfaces.',
		} );
		grid.appendChild( privacyGroup.el );

		const creditsGroup = createGroupCard( 'Credits', 'System controls are player-facing only. Debugging, profile identity, and customization live elsewhere.', true );
		const credits = document.createElement( 'p' );
		credits.className = 'page-settings__credits';
		credits.textContent = [
			'Kart Kids // Alpha',
			'Original Starter Kit Racing by Kenney',
			'Built with three.js and crashcat physics',
		].join( '\n' );
		creditsGroup.bodyEl.appendChild( credits );
		grid.appendChild( creditsGroup.el );

	}

	setActiveSection( tabId ) {

		const meta = SECTION_META[ tabId ] || SECTION_META[ this._activeTabId ] || SETTINGS_SECTIONS[ 0 ];
		this._activeTabId = meta.id;

		if ( this._summaryCardRightEl ) this._summaryCardRightEl.textContent = meta.label;
		if ( this._workspaceCardRightEl ) this._workspaceCardRightEl.textContent = meta.label;
		if ( this._summaryEyebrowEl ) this._summaryEyebrowEl.textContent = meta.summaryLabel;
		if ( this._summaryTitleEl ) this._summaryTitleEl.textContent = meta.title;
		if ( this._summaryCopyEl ) this._summaryCopyEl.textContent = meta.copy;

	}

	setStatus( status, copy = '' ) {

		if ( this._statusCardRightEl ) this._statusCardRightEl.textContent = status;
		if ( this._statusValueEl ) this._statusValueEl.textContent = status;
		if ( this._statusCopyEl ) this._statusCopyEl.textContent = copy;

	}

	markDirty() {

		this.setStatus( 'Unsaved', 'Apply changes to make this setup live.' );

	}

	markClean( status = 'Live' ) {

		if ( status === 'Saved' ) {

			this.setStatus( 'Saved', 'Changes stored and active.' );
			return;

		}

		if ( status === 'Defaults' ) {

			this.setStatus( 'Defaults', 'Factory defaults restored.' );
			return;

		}

		this.setStatus( 'Live', 'System controls are synced.' );

	}

	get resetBtn() { return this._resetBtn; }
	get applyBtn() { return this._applyBtn; }
	get debugBtn() { return this._debugBtn; }
	get pageHeader() { return this._pageHeader; }
	get tabs() { return this._tabs; }
	get activeTabId() { return this._activeTabId; }

	getControlValue( controlId ) {

		const el = this._controls.get( controlId );
		if ( ! el ) return null;
		if ( el.type === 'checkbox' ) return el.checked;
		return el.value;

	}

	getAllValues() {

		const result = {};
		this._controls.forEach( ( el, id ) => {

			result[ id ] = el.type === 'checkbox' ? el.checked : el.value;

		} );
		return result;

	}

	setAllValues( values ) {

		this._suspendDirtyTracking = true;

		try {

			Object.entries( values ).forEach( ( [ id, value ] ) => {

				const el = this._controls.get( id );
				if ( ! el ) return;

				if ( el.type === 'checkbox' ) {

					el.checked = Boolean( value );

				} else {

					el.value = String( value );

				}

				this._controlPresenters.get( id )?.();

			} );

		} finally {

			this._suspendDirtyTracking = false;

		}

	}

	dispose() {

		this._tabs?.dispose();
		this._tabs = null;
		this._resetBtn?.dispose();
		this._resetBtn = null;
		this._applyBtn?.dispose();
		this._applyBtn = null;
		this._debugBtn?.remove();
		this._debugBtn = null;
		this._controls.clear();
		this._controlPresenters.clear();
		super.dispose();

	}

}
