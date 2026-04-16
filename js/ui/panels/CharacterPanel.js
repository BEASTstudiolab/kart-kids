import { Settings } from '../../Settings.js';
import { getBalaclavaOptionById } from '../../CharacterCustomization.js';
import { MarginalPanelCard } from '../components/MarginalPanelCard.js';
import { MarginalPanelHeader } from '../components/MarginalPanelHeader.js';
import { Page10CharacterSelectController } from '../pages/page10-character-select/Page10CharacterSelectController.js';

const APPEARANCE_EVENT_KEYS = new Set( [
	'characterColor',
	'charSkinColor',
	'maskTintMainColor',
	'selectedBalaclavaId',
	'charAccessories',
] );

const ACCESSORY_LABELS = Object.freeze( {
	Baseball_Hat: 'Hat',
	Gold_Chain: 'Chain',
	Tshirt: 'Shirt',
	Jeans: 'Pants',
} );

export class CharacterPanel {

	static _cssInjected = false;

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._root = null;
		this._mountEl = null;
		this._controller = null;
		this._initPromise = null;
		this._isVisible = false;
		this._pendingInspectorFrame = 0;
		this._activeCategoryValueEl = null;
		this._activeCategoryCopyEl = null;
		this._selectedMaskValueEl = null;
		this._paletteStateEl = null;
		this._accentStateEl = null;
		this._gearStateEl = null;

		this._stageStateHandler = () => this._scheduleInspectorRefresh();
		this._settingsChangedHandler = ( event ) => {

			if ( APPEARANCE_EVENT_KEYS.has( event?.detail?.key ) ) {

				this._scheduleInspectorRefresh();

			}

		};

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	_injectCSS() {

		if ( CharacterPanel._cssInjected ) return;
		CharacterPanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-character-panel {
				--mv-cream: #F7F3E9;
				--mv-red: #D82C2C;
				--mv-dark: #0F1115;
				--mv-font-display: var(--font-editorial-display, var(--font-display, sans-serif));
				--mv-font-mono: var(--font-editorial-mono, var(--font-mono, monospace));
				position: relative;
				width: 100%;
				height: 100%;
				overflow: hidden;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				text-transform: uppercase;
				background: unset;
				background-color: unset;
				background-image: none;
			}

			.kk-character-panel,
			.kk-character-panel * {
				cursor: crosshair;
			}

			.kk-character-panel__scanlines,
			.kk-character-panel__vignette {
				display: none;
				position: absolute;
				inset: 0;
				pointer-events: none;
			}

			.kk-character-panel__scanlines {
				z-index: 1;
				opacity: 0.24;
				background:
					linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
					linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
				background-size: 100% 3px, 3px 100%;
			}

			.kk-character-panel__vignette {
				z-index: 2;
				box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.62);
			}

			.kk-character-panel__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(280px, var(--kk-customizer-deck-width, 20rem));
				grid-template-rows: auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 20px;
			}

			.kk-character-panel__interface > * {
				pointer-events: auto;
			}

			.kk-character-panel__header {
				grid-column: 1 / span 2;
			}

			.kk-character-panel__header.kk-mv-header {
				padding-top: 57px;
			}

			.kk-character-panel__stage {
				grid-column: 1 / span 2;
				grid-row: 2;
				position: relative;
				min-height: 0;
				pointer-events: none;
			}

			.kk-character-panel__stage > * {
				pointer-events: auto;
			}

			.kk-character-panel__deck {
				grid-column: 2;
				grid-row: 2;
				align-self: start;
				display: flex;
				flex-direction: column;
				gap: 20px;
				z-index: 4;
			}

			.kk-character-panel__deck .kk-mv-card__body {
				gap: 12px;
			}

			.kk-character-panel__deck-copy {
				opacity: 0.9;
			}

			.kk-character-panel__garage-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 42px;
				padding: 0.8rem 1rem;
				border: 1px solid rgba(247, 243, 233, 0.82);
				background: transparent;
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 0.64rem;
				font-weight: 700;
				letter-spacing: 0.16em;
				text-transform: uppercase;
				cursor: pointer;
				clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
				transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
			}

			.kk-character-panel__garage-btn:hover {
				background: rgba(247, 243, 233, 0.12);
				border-color: rgba(247, 243, 233, 1);
				transform: translateY(-1px);
			}

			.kk-character-panel__stage .page-character-select {
				height: 100%;
				padding: 0;
				color: inherit;
				background: transparent;
				overflow: visible;
			}

			.kk-character-panel__stage .page-character-select__content {
				position: relative;
				display: block;
				height: 100%;
				min-height: 0;
			}

			.kk-character-panel__stage .page-character-select__panel.page-character-select__sidebar {
				position: absolute;
				top: 0;
				left: 0;
				width: min(var(--kk-customizer-builder-width, 18rem), calc(100vw - 3rem));
				max-height: min(35rem, calc(100% - 1rem));
				background: var(--mv-cream);
				color: var(--mv-dark);
				border: none;
				border-radius: 0;
				clip-path: polygon(0 0, 100% 0, 100% 94%, 94% 100%, 0 100%);
				box-shadow: 0 28px 46px rgba(0, 0, 0, 0.24);
				backdrop-filter: none;
				overflow-y: auto;
			}

			.kk-character-panel__stage .page-character-select__panel-label,
			.kk-character-panel__stage .page-character-select__color-meta,
			.kk-character-panel__stage .page-character-select__item-meta {
				color: rgba(15, 17, 21, 0.62);
				font-family: var(--mv-font-mono);
				letter-spacing: 0.12em;
			}

			.kk-character-panel__stage .page-character-select__panel-copy,
			.kk-character-panel__stage .page-character-select__category-panel-copy,
			.kk-character-panel__stage .page-character-select__detail-copy {
				color: rgba(15, 17, 21, 0.82);
				font-family: var(--mv-font-mono);
			}

			.kk-character-panel__stage .page-character-select__category-tabs {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}

			.kk-character-panel__stage .page-character-select__category-tab {
				border-radius: 0;
				border: 1px solid rgba(15, 17, 21, 0.16);
				background: rgba(15, 17, 21, 0.04);
				color: var(--mv-dark);
				font-family: var(--mv-font-mono);
				letter-spacing: 0.12em;
			}

			.kk-character-panel__stage .page-character-select__category-tab:hover {
				background: rgba(15, 17, 21, 0.08);
				border-color: rgba(15, 17, 21, 0.24);
				transform: translateY(-1px);
			}

			.kk-character-panel__stage .page-character-select__category-tab--active {
				background: var(--mv-dark);
				color: var(--mv-cream);
				border-color: var(--mv-dark);
				box-shadow: none;
			}

			.kk-character-panel__stage .page-character-select__category-panel-title,
			.kk-character-panel__stage .page-character-select__color-label,
			.kk-character-panel__stage .page-character-select__item-name,
			.kk-character-panel__stage .page-character-select__detail-label {
				color: var(--mv-dark);
			}

			.kk-character-panel__stage .page-character-select__category-stack {
				padding-right: 0;
			}

			.kk-character-panel__stage .page-character-select__color-row,
			.kk-character-panel__stage .page-character-select__detail-card {
				border-radius: 0;
				border: 1px solid rgba(15, 17, 21, 0.12);
				background: rgba(15, 17, 21, 0.03);
			}

			.kk-character-panel__stage .page-character-select__color-reset {
				border-radius: 0;
				border-color: rgba(15, 17, 21, 0.18);
				background: transparent;
				color: var(--mv-dark);
				font-family: var(--mv-font-mono);
			}

			.kk-character-panel__stage .page-character-select__option-grid {
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 0.55rem;
			}

			.kk-character-panel__stage .page-character-select__item {
				min-height: 5.35rem;
				border-radius: 0;
				border: 1px solid rgba(15, 17, 21, 0.12);
				background: rgba(255, 255, 255, 0.58);
				color: var(--mv-dark);
				box-shadow: none;
			}

			.kk-character-panel__stage .page-character-select__item:hover {
				border-color: rgba(15, 17, 21, 0.26);
				box-shadow: 0 14px 24px rgba(15, 17, 21, 0.08);
			}

			.kk-character-panel__stage .page-character-select__item--active {
				background: rgba(216, 44, 44, 0.08);
				border-color: rgba(216, 44, 44, 0.58);
			}

			.kk-character-panel__stage .page-character-select__item-thumb,
			.kk-character-panel__stage .page-character-select__item-thumb-fallback {
				border-radius: 0;
			}

			.kk-character-panel__stage .page-character-select__item-thumb {
				border: 1px solid rgba(15, 17, 21, 0.08);
				background: rgba(15, 17, 21, 0.04);
			}

			@media (max-width: 980px) {
				.kk-character-panel {
					overflow-y: auto;
				}

				.kk-character-panel__interface {
					grid-template-columns: 1fr;
					grid-template-rows: auto auto auto;
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 16px;
				}

				.kk-character-panel__header,
				.kk-character-panel__stage,
				.kk-character-panel__deck {
					grid-column: auto;
					grid-row: auto;
				}

				.kk-character-panel__stage {
					min-height: 0;
				}

				.kk-character-panel__stage .page-character-select__content {
					height: auto;
				}

				.kk-character-panel__stage .page-character-select__panel.page-character-select__sidebar {
					position: relative;
					top: auto;
					left: auto;
					width: 100%;
					max-height: none;
					clip-path: polygon(0 0, 100% 0, 100% 96%, 96% 100%, 0 100%);
				}
			}

			@media (max-width: 720px) {
				.kk-character-panel__stage .page-character-select__option-grid {
					grid-template-columns: repeat(2, minmax(0, 1fr));
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-character-panel';

		const scanlines = document.createElement( 'div' );
		scanlines.className = 'kk-character-panel__scanlines';
		this._root.appendChild( scanlines );

		const vignette = document.createElement( 'div' );
		vignette.className = 'kk-character-panel__vignette';
		this._root.appendChild( vignette );

		const frame = document.createElement( 'div' );
		frame.className = 'kk-character-panel__interface';
		this._root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Character',
			subtitle: 'Pilot Identity // Masks, Palette, Accessories',
			badge: '',
			className: 'kk-character-panel__header',
		} ).el );

		const stage = document.createElement( 'div' );
		stage.className = 'kk-character-panel__stage';
		stage.addEventListener( 'kk:character:category', this._stageStateHandler );
		stage.addEventListener( 'kk:character:item', this._stageStateHandler );
		stage.addEventListener( 'kk:character:color', this._stageStateHandler );
		frame.appendChild( stage );
		this._mountEl = stage;

		const deck = document.createElement( 'aside' );
		deck.className = 'kk-character-panel__deck';
		frame.appendChild( deck );

		const builderCard = new MarginalPanelCard( {
			variant: 'outline',
			headerLeft: 'Pilot Builder',
			headerRight: 'Live',
		} );

		const activeLabel = document.createElement( 'div' );
		activeLabel.className = 'kk-mv-label';
		activeLabel.textContent = 'Active Category';
		builderCard.bodyEl.appendChild( activeLabel );

		const activeValue = document.createElement( 'div' );
		activeValue.className = 'kk-mv-value';
		activeValue.textContent = 'Palette';
		builderCard.bodyEl.appendChild( activeValue );
		this._activeCategoryValueEl = activeValue;

		const activeCopy = document.createElement( 'p' );
		activeCopy.className = 'kk-mv-copy kk-character-panel__deck-copy';
		activeCopy.textContent = 'Suit color and skin tone are live in this lane.';
		builderCard.bodyEl.appendChild( activeCopy );
		this._activeCategoryCopyEl = activeCopy;

		const builderGrid = document.createElement( 'div' );
		builderGrid.className = 'kk-mv-data-grid';
		builderCard.bodyEl.appendChild( builderGrid );

		const paletteState = document.createElement( 'div' );
		paletteState.className = 'kk-mv-data-item';
		builderGrid.appendChild( paletteState );
		this._paletteStateEl = paletteState;

		const accentState = document.createElement( 'div' );
		accentState.className = 'kk-mv-data-item';
		builderGrid.appendChild( accentState );
		this._accentStateEl = accentState;

		const gearState = document.createElement( 'div' );
		gearState.className = 'kk-mv-data-item';
		builderGrid.appendChild( gearState );
		this._gearStateEl = gearState;

		const modeCard = new MarginalPanelCard( {
			variant: 'red',
			headerLeft: 'Loadout Snapshot',
			headerRight: '[Garage]',
			sticker: 'Customizer Suite',
		} );

		const loadoutLabel = document.createElement( 'div' );
		loadoutLabel.className = 'kk-mv-label';
		loadoutLabel.textContent = 'Current Mask';
		modeCard.bodyEl.appendChild( loadoutLabel );

		const loadoutValue = document.createElement( 'div' );
		loadoutValue.className = 'kk-mv-value';
		loadoutValue.textContent = 'Balaclava Basic';
		modeCard.bodyEl.appendChild( loadoutValue );
		this._selectedMaskValueEl = loadoutValue;

		const loadoutCopy = document.createElement( 'p' );
		loadoutCopy.className = 'kk-mv-copy kk-character-panel__deck-copy';
		loadoutCopy.textContent = 'Switch to Garage to tune kart paint and performance inside the same customizer shell.';
		modeCard.bodyEl.appendChild( loadoutCopy );

		const garageBtn = document.createElement( 'button' );
		garageBtn.type = 'button';
		garageBtn.className = 'kk-character-panel__garage-btn';
		garageBtn.textContent = 'Open Garage Bay';
		garageBtn.addEventListener( 'click', () => this._services.switchTab?.( 'garage' ) );
		modeCard.bodyEl.appendChild( garageBtn );

		deck.appendChild( builderCard.el );
		deck.appendChild( modeCard.el );

	}

	_scheduleInspectorRefresh() {

		if ( this._pendingInspectorFrame ) cancelAnimationFrame( this._pendingInspectorFrame );
		this._pendingInspectorFrame = requestAnimationFrame( () => {

			this._pendingInspectorFrame = 0;
			this._refreshInspector();

		} );

	}

	_refreshInspector() {

		const characterRoot = this._mountEl?.querySelector( '.page-character-select' );
		const settings = new Settings();
		const appearance = settings.getPlayerAppearance();
		const selectedBalaclava = getBalaclavaOptionById( appearance?.selectedBalaclavaId );
		const liveAccessories = Object.entries( appearance?.charAccessories || {} )
			.filter( ( [ , state ] ) => state?.visible !== false )
			.map( ( [ key ] ) => ACCESSORY_LABELS[ key ] || key.replace( /_/g, ' ' ) );

		const activeCategoryLabel = characterRoot?.dataset.activeCategoryLabel || 'Palette';
		const activeCategorySummary = characterRoot?.dataset.activeCategorySummary || 'Suit color and skin tone are live in this lane.';
		const selectedMaskLabel = characterRoot?.dataset.selectedLabel || selectedBalaclava.label;
		const paletteState = appearance?.characterColor || appearance?.charSkinColor
			? `Palette: ${ [
				appearance?.characterColor ? 'Suit' : '',
				appearance?.charSkinColor ? 'Skin' : '',
			].filter( Boolean ).join( ' + ' ) }`
			: 'Palette: Default';
		const accentState = `Accent: ${ appearance?.maskTintMainColor ? 'Custom' : 'Default' }`;
		const gearState = liveAccessories.length > 0
			? `Gear: ${ liveAccessories.slice( 0, 2 ).join( ' + ' ) }${ liveAccessories.length > 2 ? ` +${ liveAccessories.length - 2 }` : '' }`
			: 'Gear: None';

		if ( this._activeCategoryValueEl ) this._activeCategoryValueEl.textContent = activeCategoryLabel;
		if ( this._activeCategoryCopyEl ) this._activeCategoryCopyEl.textContent = activeCategorySummary;
		if ( this._selectedMaskValueEl ) this._selectedMaskValueEl.textContent = selectedMaskLabel;
		if ( this._paletteStateEl ) this._paletteStateEl.textContent = paletteState;
		if ( this._accentStateEl ) this._accentStateEl.textContent = accentState;
		if ( this._gearStateEl ) this._gearStateEl.textContent = gearState;

	}

	async _ensureInitialized() {

		if ( this._controller ) return this._controller;
		if ( this._initPromise ) return this._initPromise;

		this._initPromise = ( async () => {

			const controller = new Page10CharacterSelectController( {
				hostMode: 'tab',
				openCategoryId: 'palette',
				trackPageView: false,
			}, this._services );
			controller.initialize( {
				hostMode: 'tab',
				openCategoryId: 'palette',
				trackPageView: false,
			} );
			controller.bindEvents();
			await controller.loadData();
			controller.render( this._mountEl );
			controller.setActive( this._isVisible );
			this._controller = controller;
			this._scheduleInspectorRefresh();
			return controller;

		} )().catch( ( error ) => {

			this._initPromise = null;
			throw error;

		} );

		return this._initPromise;

	}

	show() {

		this._isVisible = true;
		window.removeEventListener( 'settings-changed', this._settingsChangedHandler );
		window.addEventListener( 'settings-changed', this._settingsChangedHandler );

		this._ensureInitialized()
			.then( ( controller ) => {

				controller.setActive( this._isVisible );
				this._scheduleInspectorRefresh();

			} )
			.catch( ( error ) => {

				console.warn( '[CharacterPanel] Failed to initialize character tab:', error );
				this._services.notification?.show( {
					message: 'Failed to open Character tab',
					variant: 'error',
					duration: 2200,
				} );

			} );

	}

	hide() {

		this._isVisible = false;
		this._controller?.setActive( false );
		window.removeEventListener( 'settings-changed', this._settingsChangedHandler );

	}

	dispose() {

		window.removeEventListener( 'settings-changed', this._settingsChangedHandler );
		if ( this._pendingInspectorFrame ) cancelAnimationFrame( this._pendingInspectorFrame );
		this._pendingInspectorFrame = 0;

		if ( this._mountEl ) {

			this._mountEl.removeEventListener( 'kk:character:category', this._stageStateHandler );
			this._mountEl.removeEventListener( 'kk:character:item', this._stageStateHandler );
			this._mountEl.removeEventListener( 'kk:character:color', this._stageStateHandler );

		}

		this._controller?.dispose();
		this._controller = null;
		this._initPromise = null;
		this._isVisible = false;

		if ( this._root?.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}
