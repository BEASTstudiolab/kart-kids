/**
 * Page15ShopView — Shop / Store.
 *
 * Layout: full-height viewport, no outer scroll.
 *
 * Grid rows: PageHeader zone + currency strip | Tabs | body (1fr)
 * Body cols: left item preview panel (300px) | right 6-item grid (1fr)
 *
 * Currency strip: top-right coins + gems from MockData.wallet.
 * Item grid: 2-column card grid, 6 items per viewport, scrollable.
 * Preview panel: large item preview with name, desc, price, PURCHASE CTA.
 *
 * Public API consumed by Page15ShopController:
 *   setCurrencyStrip({ coins, gems })
 *   setItemGrid(items[])
 *   setPreviewItem(item)
 *   get purchaseBtn — CTAButton
 *
 * Deviations from spec:
 *   - Preview panel is on the LEFT for visual reading flow (largest element first).
 *     Spec says "left: item preview panel. Right: 6-item grid" which matches this layout.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { Tabs }          from '../../components/Tabs.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

const SHOP_TABS = [
	{ id: ButtonIds.SHOP_TAB_FEATURED,   label: 'FEATURED' },
	{ id: ButtonIds.SHOP_TAB_CHARACTERS, label: 'CHARACTERS' },
	{ id: ButtonIds.SHOP_TAB_KARTS,      label: 'KARTS' },
	{ id: ButtonIds.SHOP_TAB_COSMETICS,  label: 'COSMETICS' },
	{ id: ButtonIds.SHOP_TAB_BUNDLES,    label: 'BUNDLES' },
	{ id: ButtonIds.SHOP_TAB_CURRENCY,   label: 'CURRENCY' },
];

export class Page15ShopView extends PageViewBase {

	constructor() {

		super( 'page-shop' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {Tabs} */
		this._tabs = null;

		/** @type {CTAButton} */
		this._purchaseBtn = null;

		/** @type {HTMLElement} */
		this._currencyStripEl = null;

		/** @type {HTMLElement} */
		this._previewPanelEl = null;

		/** @type {HTMLElement} */
		this._itemGridEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( Page15ShopView._cssInjected ) return;
		Page15ShopView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-shop {
				display: grid;
				grid-template-rows: auto auto auto 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-surface);
			}

			/* ------------------------------------------------------------------ */
			/* Header zone                                                         */
			/* ------------------------------------------------------------------ */

			.page-shop__header-zone {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* ------------------------------------------------------------------ */
			/* Currency strip                                                      */
			/* ------------------------------------------------------------------ */

			.page-shop__currency-strip {
				display: flex;
				align-items: center;
				gap: var(--space-3);
			}

			.kk-currency-pill {
				display: inline-flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-1) var(--space-3);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-pill);
			}

			.kk-currency-pill__icon {
				width: 16px;
				height: 16px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 10px;
				font-weight: var(--weight-black);
			}

			.kk-currency-pill__icon--coins {
				background: var(--color-accent-yellow);
				color: #000;
			}

			.kk-currency-pill__icon--gems {
				background: var(--color-accent-pink, #ec4899);
				color: #fff;
			}

			.kk-currency-pill__value {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				letter-spacing: var(--tracking-wider);
			}

			/* ------------------------------------------------------------------ */
			/* Tabs strip                                                          */
			/* ------------------------------------------------------------------ */

			.page-shop__tabs-row {
				background: var(--color-panel-base);
			}

			/* ------------------------------------------------------------------ */
			/* Body — two-column layout                                            */
			/* ------------------------------------------------------------------ */

			.page-shop__body {
				display: grid;
				grid-template-columns: 300px 1fr;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Left — item preview panel                                           */
			/* ------------------------------------------------------------------ */

			.page-shop__preview-panel {
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
				padding: var(--space-5) var(--space-4);
				background: var(--color-panel-base);
				border-right: 1px solid var(--color-panel-border);
				overflow-y: auto;
			}

			.kk-shop-preview__image {
				width: 100%;
				aspect-ratio: 1 / 1;
				background: var(--color-panel-raised);
				border-radius: var(--radius-md);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 72px;
				border: 1px solid var(--color-panel-border);
			}

			.kk-shop-preview__tag {
				display: inline-flex;
				align-items: center;
				padding: var(--space-1) var(--space-2);
				background: var(--color-accent-orange);
				color: var(--color-white);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-black);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				border-radius: var(--radius-sm);
				align-self: flex-start;
			}

			.kk-shop-preview__name {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-shop-preview__type {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.kk-shop-preview__desc {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-300);
				line-height: var(--leading-relaxed);
			}

			.kk-shop-preview__price-row {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-3) 0;
				border-top: 1px solid var(--color-panel-border);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.kk-shop-preview__price-icon {
				width: 28px;
				height: 28px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-sm);
				font-weight: var(--weight-black);
			}

			.kk-shop-preview__price-icon--gems {
				background: var(--color-accent-pink, #ec4899);
				color: #fff;
			}

			.kk-shop-preview__price-icon--coins {
				background: var(--color-accent-yellow);
				color: #000;
			}

			.kk-shop-preview__price-icon--usd {
				background: var(--color-success, #22c55e);
				color: #fff;
			}

			.kk-shop-preview__price-value {
				font-family: var(--font-display);
				font-size: var(--text-2xl);
				font-weight: var(--weight-black);
				color: var(--color-white);
			}

			.kk-shop-preview__price-currency {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-shop-preview__purchase-btn {
				width: 100%;
			}

			.kk-shop-preview__purchase-btn .kk-cta-button {
				width: 100%;
				justify-content: center;
			}

			.kk-shop-preview__empty {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				flex: 1 1 auto;
				gap: var(--space-3);
				color: var(--color-ink-500);
				text-align: center;
				padding: var(--space-8);
			}

			.kk-shop-preview__empty-icon {
				font-size: 48px;
				opacity: 0.3;
			}

			.kk-shop-preview__empty-label {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* ------------------------------------------------------------------ */
			/* Right — item grid                                                   */
			/* ------------------------------------------------------------------ */

			.page-shop__grid-panel {
				overflow-y: auto;
				padding: var(--space-4) var(--space-5);
			}

			.page-shop__item-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: var(--space-3);
			}

			/* ---- Item card ---- */

			.kk-shop-item-card {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				padding: var(--space-3);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				cursor: pointer;
				transition:
					border-color var(--duration-fast) var(--ease-standard),
					background var(--duration-fast) var(--ease-standard);
				position: relative;
				user-select: none;
			}

			.kk-shop-item-card:hover {
				border-color: var(--color-accent-orange);
				background: rgba(249,115,22,0.04);
			}

			.kk-shop-item-card:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.kk-shop-item-card--selected {
				border-color: var(--color-accent-orange);
				background: rgba(249,115,22,0.08);
			}

			.kk-shop-item-card__tag {
				position: absolute;
				top: var(--space-2);
				right: var(--space-2);
				padding: 2px var(--space-2);
				background: var(--color-accent-orange);
				color: var(--color-white);
				font-family: var(--font-ui);
				font-size: 10px;
				font-weight: var(--weight-black);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				border-radius: var(--radius-sm);
			}

			.kk-shop-item-card__image {
				width: 100%;
				aspect-ratio: 1 / 1;
				background: var(--color-panel-raised);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 32px;
				border: 1px solid var(--color-panel-border);
			}

			.kk-shop-item-card__name {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.kk-shop-item-card__price {
				display: flex;
				align-items: center;
				gap: var(--space-1);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
			}

			.kk-shop-item-card__price-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.kk-shop-item-card__price-dot--gems {
				background: var(--color-accent-pink, #ec4899);
			}

			.kk-shop-item-card__price-dot--coins {
				background: var(--color-accent-yellow);
			}

			.kk-shop-item-card__price-dot--usd {
				background: var(--color-success, #22c55e);
			}

			/* ------------------------------------------------------------------ */
			/* Responsive                                                          */
			/* ------------------------------------------------------------------ */

			@media (max-width: 900px) {
				.page-shop__body {
					grid-template-columns: 1fr;
					grid-template-rows: auto 1fr;
				}

				.page-shop__preview-panel {
					border-right: none;
					border-bottom: 1px solid var(--color-panel-border);
					max-height: 240px;
					flex-direction: row;
					flex-wrap: wrap;
				}

				.kk-shop-preview__image {
					width: 100px;
					height: 100px;
					flex-shrink: 0;
				}
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
		root.setAttribute( 'aria-label', 'Shop' );

		// ----- Header zone -----
		this._header = new PageHeader( {
			title:    'SHOP',
			showBack: true,
		} );

		const headerZone = document.createElement( 'div' );
		headerZone.className = 'page-shop__header-zone';
		headerZone.appendChild( this._header.el );

		this._currencyStripEl = document.createElement( 'div' );
		this._currencyStripEl.className = 'page-shop__currency-strip';
		this._currencyStripEl.setAttribute( 'aria-label', 'Your currency' );
		headerZone.appendChild( this._currencyStripEl );

		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Tabs -----
		this._tabs = new Tabs( {
			tabs:      SHOP_TABS,
			activeId:  ButtonIds.SHOP_TAB_FEATURED,
			ariaLabel: 'Shop categories',
		} );

		const tabsRow = document.createElement( 'div' );
		tabsRow.className = 'page-shop__tabs-row';
		tabsRow.appendChild( this._tabs.el );
		root.appendChild( tabsRow );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-shop__body';
		this._registerSection( 'body', body );

		// Left: item preview panel
		this._previewPanelEl = document.createElement( 'div' );
		this._previewPanelEl.className = 'page-shop__preview-panel';
		this._previewPanelEl.setAttribute( 'aria-label', 'Item preview' );
		this._registerSection( 'previewPanel', this._previewPanelEl );
		body.appendChild( this._previewPanelEl );

		// Right: item grid
		const gridPanel = document.createElement( 'div' );
		gridPanel.className = 'page-shop__grid-panel';
		gridPanel.setAttribute( 'aria-label', 'Shop items' );

		this._itemGridEl = document.createElement( 'div' );
		this._itemGridEl.className = 'page-shop__item-grid';
		this._itemGridEl.setAttribute( 'role', 'list' );
		gridPanel.appendChild( this._itemGridEl );
		this._registerSection( 'itemGrid', this._itemGridEl );
		body.appendChild( gridPanel );

		root.appendChild( body );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		const backBtn = this._root.querySelector( '.kk-page-header__back' );
		backBtn?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Populate the currency strip.
	 *
	 * @param {{ coins: number, gems: number }} wallet
	 */
	setCurrencyStrip( { coins, gems } ) {

		const strip = this._currencyStripEl;
		strip.innerHTML = '';

		const makePill = ( icon, value, type ) => {
			const pill = document.createElement( 'div' );
			pill.className = 'kk-currency-pill';
			pill.setAttribute( 'aria-label', `${value.toLocaleString()} ${type}` );

			const iconEl = document.createElement( 'div' );
			iconEl.className = `kk-currency-pill__icon kk-currency-pill__icon--${type}`;
			iconEl.setAttribute( 'aria-hidden', 'true' );
			iconEl.textContent = icon;
			pill.appendChild( iconEl );

			const valEl = document.createElement( 'div' );
			valEl.className = 'kk-currency-pill__value';
			valEl.textContent = value.toLocaleString();
			pill.appendChild( valEl );

			return pill;
		};

		strip.appendChild( makePill( 'C', coins, 'coins' ) );
		strip.appendChild( makePill( 'G', gems, 'gems' ) );

	}

	/**
	 * Populate the item grid.
	 *
	 * @param {Array<object>} items
	 */
	setItemGrid( items ) {

		const grid = this._itemGridEl;
		grid.innerHTML = '';

		if ( ! items || items.length === 0 ) {
			grid.appendChild( this.buildEmptyState( {
				label:   'No items available',
				heading: 'NOTHING HERE YET',
				subtext: 'Check back soon for new arrivals.',
			} ) );
			return;
		}

		items.forEach( ( item ) => {
			const card = this._buildItemCard( item );
			grid.appendChild( card );
		} );

	}

	/**
	 * Populate the preview panel with a selected item.
	 *
	 * @param {object} item
	 */
	setPreviewItem( item ) {

		const panel = this._previewPanelEl;
		panel.innerHTML = '';

		// Dispose old purchase button reference if any
		this._purchaseBtn = null;

		const typeEmoji = {
			bundle: '🎁', kart: '🏎', character: '🧑', skin: '👕',
			cosmetic: '✨', trail: '💨', horn: '📯', frame: '🖼',
			emote: '🎭', wheels: '🏁', currency: '💎', title: '🏆',
			trophy: '🏆',
		};
		const emoji = typeEmoji[ item.type ] ?? '⭐';

		// Image placeholder
		const image = document.createElement( 'div' );
		image.className = 'kk-shop-preview__image';
		image.setAttribute( 'aria-hidden', 'true' );
		image.textContent = emoji;
		panel.appendChild( image );

		// Tag
		if ( item.tag ) {
			const tag = document.createElement( 'div' );
			tag.className = 'kk-shop-preview__tag';
			tag.textContent = item.tag;
			panel.appendChild( tag );
		}

		// Type
		const typeEl = document.createElement( 'div' );
		typeEl.className = 'kk-shop-preview__type';
		typeEl.textContent = item.type.toUpperCase();
		panel.appendChild( typeEl );

		// Name
		const nameEl = document.createElement( 'div' );
		nameEl.className = 'kk-shop-preview__name';
		nameEl.textContent = item.name;
		panel.appendChild( nameEl );

		// Description
		const desc = document.createElement( 'div' );
		desc.className = 'kk-shop-preview__desc';
		desc.textContent = item.desc;
		panel.appendChild( desc );

		// Price row
		const priceRow = document.createElement( 'div' );
		priceRow.className = 'kk-shop-preview__price-row';

		const priceIcon = document.createElement( 'div' );
		priceIcon.className = `kk-shop-preview__price-icon kk-shop-preview__price-icon--${item.currency}`;
		priceIcon.setAttribute( 'aria-hidden', 'true' );
		priceIcon.textContent = item.currency === 'gems' ? 'G' : item.currency === 'coins' ? 'C' : '$';
		priceRow.appendChild( priceIcon );

		const priceDetails = document.createElement( 'div' );

		const priceValue = document.createElement( 'div' );
		priceValue.className = 'kk-shop-preview__price-value';
		priceValue.textContent = item.currency === 'usd' ? `$${Number( item.price ).toFixed( 2 )}` : String( item.price );
		priceDetails.appendChild( priceValue );

		const priceCurrency = document.createElement( 'div' );
		priceCurrency.className = 'kk-shop-preview__price-currency';
		priceCurrency.textContent = item.currency === 'usd' ? 'USD' : item.currency.toUpperCase();
		priceDetails.appendChild( priceCurrency );

		priceRow.appendChild( priceDetails );
		panel.appendChild( priceRow );

		// Purchase button
		const btnWrap = document.createElement( 'div' );
		btnWrap.className = 'kk-shop-preview__purchase-btn';

		this._purchaseBtn = new CTAButton( {
			label:    'PURCHASE',
			variant:  'primary',
			actionId: ButtonIds.SHOP_PURCHASE,
			ariaLabel: `Purchase ${item.name}`,
		} );
		btnWrap.appendChild( this._purchaseBtn.el );
		panel.appendChild( btnWrap );

		// Mark selected card
		this._itemGridEl.querySelectorAll( '.kk-shop-item-card' ).forEach( ( c ) => {
			c.classList.toggle( 'kk-shop-item-card--selected', c.dataset.shopItemId === item.id );
			c.setAttribute( 'aria-selected', String( c.dataset.shopItemId === item.id ) );
		} );

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a single item card element.
	 *
	 * @param {object} item
	 * @returns {HTMLElement}
	 */
	_buildItemCard( item ) {

		const typeEmoji = {
			bundle: '🎁', kart: '🏎', character: '🧑', skin: '👕',
			cosmetic: '✨', trail: '💨', horn: '📯', frame: '🖼',
			emote: '🎭', wheels: '🏁', currency: '💎', title: '🏆',
			trophy: '🏆',
		};
		const emoji = typeEmoji[ item.type ] ?? '⭐';

		const card = document.createElement( 'div' );
		card.className = 'kk-shop-item-card';
		card.setAttribute( 'role', 'listitem' );
		card.setAttribute( 'tabindex', '0' );
		card.setAttribute( 'aria-label', `${item.name}, ${item.price} ${item.currency}` );
		card.dataset.shopItemId = item.id;

		// Tag
		if ( item.tag ) {
			const tag = document.createElement( 'div' );
			tag.className = 'kk-shop-item-card__tag';
			tag.setAttribute( 'aria-hidden', 'true' );
			tag.textContent = item.tag;
			card.appendChild( tag );
		}

		// Image
		const img = document.createElement( 'div' );
		img.className = 'kk-shop-item-card__image';
		img.setAttribute( 'aria-hidden', 'true' );
		img.textContent = emoji;
		card.appendChild( img );

		// Name
		const name = document.createElement( 'div' );
		name.className = 'kk-shop-item-card__name';
		name.textContent = item.name;
		card.appendChild( name );

		// Price
		const price = document.createElement( 'div' );
		price.className = 'kk-shop-item-card__price';

		const dot = document.createElement( 'div' );
		dot.className = `kk-shop-item-card__price-dot kk-shop-item-card__price-dot--${item.currency}`;
		dot.setAttribute( 'aria-hidden', 'true' );
		price.appendChild( dot );

		const priceText = document.createElement( 'span' );
		priceText.textContent = item.currency === 'usd'
			? `$${Number( item.price ).toFixed( 2 )}`
			: `${item.price} ${item.currency.toUpperCase()}`;
		price.appendChild( priceText );

		card.appendChild( price );

		// Keyboard activation
		card.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				card.click();
			}
		} );

		return card;

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get purchaseBtn() { return this._purchaseBtn; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._tabs?.dispose();
		this._tabs = null;

		this._header?.dispose();
		this._header = null;

		this._purchaseBtn        = null;
		this._currencyStripEl    = null;
		this._previewPanelEl     = null;
		this._itemGridEl         = null;

		super.dispose();

	}

}
