import { MarginalPanelHeader } from '../components/MarginalPanelHeader.js';
import { Page10CharacterSelectController, CATEGORY_DEFS } from '../pages/page10-character-select/Page10CharacterSelectController.js';

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
		this._tabStripEl = null;
		this._tabButtons = new Map();
		this._currentCategoryId = 'palette';

		this._categoryEventHandler = ( event ) => {

			const id = event?.detail?.categoryId;
			if ( id ) this._setActiveTab( id );

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
			}

			.kk-character-panel,
			.kk-character-panel * {
				cursor: crosshair;
			}

			.kk-character-panel__interface {
				position: relative;
				z-index: 3;
				display: grid;
				grid-template-columns: minmax(0, 1fr);
				grid-template-rows: auto auto minmax(0, 1fr);
				width: 100%;
				height: 100%;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				gap: 16px;
			}

			.kk-character-panel__interface > * {
				pointer-events: auto;
			}

			.kk-character-panel__header.kk-mv-header {
				padding-top: 57px;
			}

			/* ---------- Sub-tab strip (palette | masks | accessories | …) ---------- */

			.kk-character-panel__tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				padding: 4px 0;
			}

			.kk-character-panel__tab {
				flex: 0 0 9rem;
				padding: 0.7rem 0.6rem;
				border: 1px solid rgba(247, 243, 233, 0.42);
				background: rgba(15, 17, 21, 0.45);
				color: var(--mv-cream);
				font-family: var(--mv-font-mono);
				font-size: 0.66rem;
				font-weight: 700;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				cursor: pointer;
				transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
				clip-path: polygon(0 0, 100% 0, 100% 86%, 94% 100%, 0 100%);
			}

			.kk-character-panel__tab:hover {
				background: rgba(15, 17, 21, 0.65);
				border-color: rgba(247, 243, 233, 0.78);
				transform: translateY(-1px);
			}

			.kk-character-panel__tab--active {
				background: var(--mv-cream);
				color: var(--mv-dark);
				border-color: var(--mv-cream);
			}

			/* ---------- Stage (3D preview + cream content panel) ---------- */

			.kk-character-panel__stage {
				position: relative;
				min-height: 0;
				pointer-events: none;
			}

			.kk-character-panel__stage > * {
				pointer-events: auto;
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
				width: min(var(--kk-customizer-builder-width, 443px), calc(100vw - 3rem));
				height: fit-content;
				max-height: min(38rem, calc(100% - 1rem));
				background: rgba(15, 17, 21, 0.78);
				color: var(--mv-cream);
				border: 1px solid rgba(247, 243, 233, 0.18);
				border-radius: 0;
				clip-path: polygon(0 0, 100% 0, 100% 97%, 98% 100%, 0 100%);
				box-shadow: 0 28px 46px rgba(0, 0, 0, 0.32);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				overflow-y: auto;
				padding: 1.1rem 1.25rem 1.4rem;
				gap: 0.85rem;
			}

			/* Hide the page's own header bits — the panel owns header + tabs now. */
			.kk-character-panel__stage .page-character-select__panel-label,
			.kk-character-panel__stage .page-character-select__panel-title,
			.kk-character-panel__stage .page-character-select__panel-copy,
			.kk-character-panel__stage .page-character-select__category-tabs,
			.kk-character-panel__stage .page-character-select__category-panel-head,
			.kk-character-panel__stage .page-character-select__color-reset {
				display: none !important;
			}

			.kk-character-panel__stage .page-character-select__category-stack {
				height: fit-content;
				flex: 0 1 auto;
				padding-right: 0;
			}

			/* Color picker row — no RESET, full-width swatch + label. */
			.kk-character-panel__stage .page-character-select__color-row {
				grid-template-columns: minmax(0, 1fr) auto;
				border-radius: 0;
				border: 1px solid rgba(247, 243, 233, 0.18);
				background: rgba(247, 243, 233, 0.04);
				padding: 0.7rem 0;
				color: rgba(247, 243, 233, 1);
			}

			.kk-character-panel__stage .page-character-select__color-input {
				box-sizing: content-box;
				width: 2.6rem;
				height: 2.6rem;
				border: none;
				border-radius: 999px;
				cursor: pointer;
				padding: 0;
				background: transparent;
			}

			.kk-character-panel__stage .page-character-select__color-input::-webkit-color-swatch-wrapper {
				padding: 0;
			}

			.kk-character-panel__stage .page-character-select__color-input::-webkit-color-swatch {
				border: none;
				border-radius: 999px;
			}

			.kk-character-panel__stage .page-character-select__color-label {
				font-family: var(--mv-font-mono);
				font-size: 0.78rem;
				letter-spacing: 0.14em;
				color: var(--color-cta-secondary-text);
			}

			.kk-character-panel__stage .page-character-select__color-meta {
				font-family: var(--mv-font-mono);
				font-size: 0.6rem;
				letter-spacing: 0.12em;
				color: var(--color-cta-secondary-text);
			}

			/* Item grid — 4 columns (overrides customizer-mode 2-col override) */
			.kk-character-panel__stage .page-character-select.page-character-select--customizer .page-character-select__option-grid,
			.kk-character-panel__stage .page-character-select__option-grid {
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 0.5rem;
			}

			.kk-character-panel__stage .page-character-select.page-character-select--customizer .page-character-select__item,
			.kk-character-panel__stage .page-character-select__item {
				min-height: 5.6rem;
				border-radius: 0;
				border: 1px solid rgba(247, 243, 233, 0.18);
				background: transparent;
				color: var(--mv-cream);
				box-shadow: none;
			}

			.kk-character-panel__stage .page-character-select__item:hover {
				border-color: rgba(247, 243, 233, 0.42);
				background: rgba(247, 243, 233, 0.06);
				box-shadow: 0 14px 24px rgba(0, 0, 0, 0.18);
			}

			.kk-character-panel__stage .page-character-select__item--active {
				background: rgba(216, 44, 44, 0.18);
				border-color: rgba(216, 44, 44, 0.78);
			}

			.kk-character-panel__stage .page-character-select__item-name {
				color: var(--mv-cream);
			}

			.kk-character-panel__stage .page-character-select__item-meta {
				color: rgba(247, 243, 233, 0.62);
			}

			.kk-character-panel__stage .page-character-select__item-thumb,
			.kk-character-panel__stage .page-character-select__item-thumb-fallback {
				border-radius: 0;
				border: none;
				background: transparent;
			}

			.kk-character-panel__stage .page-character-select.page-character-select--customizer .page-character-select__item-thumb,
			.kk-character-panel__stage .page-character-select.page-character-select--customizer .page-character-select__item-thumb-fallback {
				border: none;
				background: transparent;
			}

			@media (max-width: 980px) {
				.kk-character-panel {
					overflow-y: auto;
				}

				.kk-character-panel__interface {
					grid-template-rows: auto auto auto;
					height: auto;
					min-height: 100%;
					padding: 20px 16px calc(20px + var(--kk-shell-nav-clearance, 6.75rem));
					gap: 14px;
				}

				.kk-character-panel__stage .page-character-select__panel.page-character-select__sidebar {
					position: relative;
					top: auto;
					left: auto;
					width: 100%;
					max-height: none;
				}

				.kk-character-panel__tab {
					flex: 0 0 7.5rem;
					font-size: 0.6rem;
					padding: 0.6rem 0.4rem;
				}
			}

			@media (max-width: 720px) {
				.kk-character-panel__tabs {
					gap: 6px;
				}

				.kk-character-panel__tab {
					flex: 0 0 calc(33.333% - 4px);
				}
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-character-panel';

		const frame = document.createElement( 'div' );
		frame.className = 'kk-character-panel__interface';
		this._root.appendChild( frame );

		frame.appendChild( new MarginalPanelHeader( {
			title: 'Character',
			subtitle: 'Pilot Identity // Masks, Palette, Accessories',
			badge: '',
			className: 'kk-character-panel__header',
		} ).el );

		this._tabStripEl = document.createElement( 'nav' );
		this._tabStripEl.className = 'kk-character-panel__tabs';
		this._tabStripEl.setAttribute( 'aria-label', 'Character categories' );

		for ( const category of CATEGORY_DEFS ) {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'kk-character-panel__tab';
			btn.dataset.categoryId = category.id;
			btn.textContent = category.label;
			btn.setAttribute( 'aria-pressed', 'false' );
			btn.addEventListener( 'click', () => this._onTabClick( category.id ) );
			this._tabStripEl.appendChild( btn );
			this._tabButtons.set( category.id, btn );

		}

		this._setActiveTab( this._currentCategoryId );
		frame.appendChild( this._tabStripEl );

		const stage = document.createElement( 'div' );
		stage.className = 'kk-character-panel__stage';
		stage.addEventListener( 'kk:character:category', this._categoryEventHandler );
		frame.appendChild( stage );
		this._mountEl = stage;

	}

	_onTabClick( categoryId ) {

		this._setActiveTab( categoryId );
		this._controller?.openCategory( categoryId );

	}

	_setActiveTab( categoryId ) {

		this._currentCategoryId = categoryId;
		for ( const [ id, btn ] of this._tabButtons ) {

			const active = id === categoryId;
			btn.classList.toggle( 'kk-character-panel__tab--active', active );
			btn.setAttribute( 'aria-pressed', String( active ) );

		}

	}

	async _ensureInitialized() {

		if ( this._controller ) return this._controller;
		if ( this._initPromise ) return this._initPromise;

		this._initPromise = ( async () => {

			const controller = new Page10CharacterSelectController( {
				hostMode: 'tab',
				openCategoryId: this._currentCategoryId,
				trackPageView: false,
			}, this._services );
			controller.initialize( {
				hostMode: 'tab',
				openCategoryId: this._currentCategoryId,
				trackPageView: false,
			} );
			controller.bindEvents();
			await controller.loadData();
			controller.render( this._mountEl );
			controller.setActive( this._isVisible );
			this._controller = controller;
			this._setActiveTab( controller.getOpenCategoryId() );
			return controller;

		} )().catch( ( error ) => {

			this._initPromise = null;
			throw error;

		} );

		return this._initPromise;

	}

	show() {

		this._isVisible = true;

		this._ensureInitialized()
			.then( ( controller ) => {

				controller.setActive( this._isVisible );
				this._setActiveTab( controller.getOpenCategoryId() );

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

	}

	dispose() {

		if ( this._mountEl ) {

			this._mountEl.removeEventListener( 'kk:character:category', this._categoryEventHandler );

		}

		this._controller?.dispose();
		this._controller = null;
		this._initPromise = null;
		this._isVisible = false;
		this._tabButtons.clear();

		if ( this._root?.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}
