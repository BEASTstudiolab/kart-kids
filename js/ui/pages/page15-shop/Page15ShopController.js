/**
 * Page15ShopController — Shop / Store.
 *
 * Route: RouteIds.SHOP ("/shop")
 *
 * Responsibilities:
 *   - Create and configure Page15ShopView.
 *   - Wire PageHeader back button → RouteIds.HOME.
 *   - Populate currency strip from MockData.wallet.
 *   - Build shop item grid per active tab from MOCK_SHOP_ITEMS.
 *   - Wire tab changes → filter and re-render item grid.
 *   - Wire item card clicks → show item in preview panel.
 *   - Wire PURCHASE button → ConfirmationDialog.
 *   - Emit analytics events.
 *
 * Data: MockData.wallet (synchronous), MOCK_SHOP_ITEMS (inline).
 */

import { PageControllerBase }  from '../../core/PageControllerBase.js';
import { Page15ShopView }      from './Page15ShopView.js';
import { RouteIds }            from '../../enums/RouteIds.js';
import { ModalIds }            from '../../enums/ModalIds.js';
import { ButtonIds }           from '../../enums/ButtonIds.js';
import { PageIds }             from '../../enums/PageIds.js';
import { EventIds }            from '../../enums/EventIds.js';
import { MockData }            from '../../repositories/mocks/MockData.js';

/** Inline mock shop items keyed by tab category. */
const MOCK_SHOP_ITEMS = [
	// FEATURED
	{ id: 'shop_bundle_starter',     tab: 'featured',   name: 'Starter Bundle',       desc: 'Kart + character skin combo.',         price: 900,  currency: 'gems',  type: 'bundle',  tag: 'HOT DEAL' },
	{ id: 'shop_kart_neon_racer',    tab: 'featured',   name: 'Neon Racer',            desc: 'Blazing speed on every track.',         price: 1200, currency: 'gems',  type: 'kart',    tag: 'NEW' },
	{ id: 'shop_char_nitromax',      tab: 'featured',   name: 'NitroMax',              desc: 'Exclusive season character.',           price: 800,  currency: 'gems',  type: 'character', tag: 'LIMITED' },
	{ id: 'shop_coins_stack',        tab: 'featured',   name: '10,000 Coins',          desc: 'Stock up on in-game coins.',            price: 200,  currency: 'gems',  type: 'currency', tag: null },
	{ id: 'shop_trail_flame',        tab: 'featured',   name: 'Flame Trail',           desc: 'Leave a trail of fire behind you.',     price: 350,  currency: 'gems',  type: 'cosmetic', tag: null },
	{ id: 'shop_emote_victory',      tab: 'featured',   name: 'Victory Dance',         desc: 'Exclusive winner emote.',               price: 150,  currency: 'gems',  type: 'cosmetic', tag: null },

	// CHARACTERS
	{ id: 'shop_char_driftkid',      tab: 'characters', name: 'Drift Kid',             desc: 'Chain drifts for bonus speed.',        price: 5000, currency: 'coins', type: 'character', tag: null },
	{ id: 'shop_char_streetracer',   tab: 'characters', name: 'Street Racer',          desc: 'Drafting bonus increased by 50%.',     price: 4500, currency: 'coins', type: 'character', tag: null },
	{ id: 'shop_char_nitromax2',     tab: 'characters', name: 'NitroMax',              desc: 'Turbo start is 2x stronger.',          price: 800,  currency: 'gems',  type: 'character', tag: 'PREMIUM' },
	{ id: 'shop_skin_neon_biker',    tab: 'characters', name: 'Neon Biker Skin',       desc: 'Glowing skin for Balaclava Biker.',    price: 200,  currency: 'gems',  type: 'skin',      tag: null },
	{ id: 'shop_skin_chrome',        tab: 'characters', name: 'Chrome Racer Skin',     desc: 'Mirror-finish chrome suit.',           price: 300,  currency: 'gems',  type: 'skin',      tag: 'NEW' },
	{ id: 'shop_skin_shadow',        tab: 'characters', name: 'Shadow Style Skin',     desc: 'Dark stealth aesthetic.',              price: 250,  currency: 'gems',  type: 'skin',      tag: null },

	// KARTS
	{ id: 'shop_kart_neon2',         tab: 'karts',      name: 'Neon Racer',            desc: 'Top-tier speed machine.',             price: 1200, currency: 'gems',  type: 'kart',     tag: 'NEW' },
	{ id: 'shop_kart_thunder',       tab: 'karts',      name: 'Thunder Kart',          desc: 'Rumbling off-road performance.',      price: 900,  currency: 'gems',  type: 'kart',     tag: null },
	{ id: 'shop_kart_phantom',       tab: 'karts',      name: 'Phantom GT',            desc: 'Stealth kart with top handling.',     price: 1400, currency: 'gems',  type: 'kart',     tag: 'LIMITED' },
	{ id: 'shop_kart_buggy_deluxe',  tab: 'karts',      name: 'Deluxe Buggy',          desc: 'Rugged all-terrain champion.',        price: 6000, currency: 'coins', type: 'kart',     tag: null },
	{ id: 'shop_kart_micro',         tab: 'karts',      name: 'Micro Kart',            desc: 'Small, nimble, precise.',             price: 3500, currency: 'coins', type: 'kart',     tag: null },
	{ id: 'shop_kart_retro',         tab: 'karts',      name: 'Retro Racer',           desc: 'Classic look, modern speed.',         price: 4000, currency: 'coins', type: 'kart',     tag: null },

	// COSMETICS
	{ id: 'shop_trail_fire',         tab: 'cosmetics',  name: 'Fire Trail',            desc: 'Ignite the track behind you.',        price: 300,  currency: 'gems',  type: 'trail',    tag: null },
	{ id: 'shop_trail_electric',     tab: 'cosmetics',  name: 'Electric Trail',        desc: 'Crackling sparks in your wake.',      price: 350,  currency: 'gems',  type: 'trail',    tag: 'NEW' },
	{ id: 'shop_horn_air',           tab: 'cosmetics',  name: 'Air Horn',              desc: 'Loud and proud victory honk.',        price: 100,  currency: 'gems',  type: 'horn',     tag: null },
	{ id: 'shop_frame_gold',         tab: 'cosmetics',  name: 'Gold Frame',            desc: 'Gold border for your profile.',       price: 400,  currency: 'gems',  type: 'frame',    tag: null },
	{ id: 'shop_emote_taunt',        tab: 'cosmetics',  name: 'Taunt Emote',           desc: 'Show off after every win.',           price: 200,  currency: 'gems',  type: 'emote',    tag: null },
	{ id: 'shop_wheel_carbon',       tab: 'cosmetics',  name: 'Carbon Wheels',         desc: 'Lightweight performance wheels.',     price: 250,  currency: 'gems',  type: 'wheels',   tag: null },

	// BUNDLES
	{ id: 'shop_bundle_neon',        tab: 'bundles',    name: 'Neon Pack',             desc: 'Neon Racer + Neon Biker Skin.',       price: 1800, currency: 'gems',  type: 'bundle',   tag: 'SAVE 20%' },
	{ id: 'shop_bundle_champion',    tab: 'bundles',    name: 'Champion Bundle',       desc: 'Top kart + character + 3 cosmetics.', price: 2500, currency: 'gems',  type: 'bundle',   tag: 'BEST VALUE' },
	{ id: 'shop_bundle_coins_big',   tab: 'bundles',    name: 'Coin Mega Pack',        desc: '25,000 Coins at a discount.',         price: 400,  currency: 'gems',  type: 'bundle',   tag: 'SAVE 30%' },
	{ id: 'shop_bundle_starter2',    tab: 'bundles',    name: 'Starter Bundle',        desc: 'Everything a new player needs.',      price: 900,  currency: 'gems',  type: 'bundle',   tag: 'HOT DEAL' },
	{ id: 'shop_bundle_drifter',     tab: 'bundles',    name: 'Drifter Pack',          desc: 'Drift-focused kart + trail + skin.',  price: 1500, currency: 'gems',  type: 'bundle',   tag: null },
	{ id: 'shop_bundle_party',       tab: 'bundles',    name: 'Party Pack',            desc: '5 emotes + horn + name tag.',         price: 600,  currency: 'gems',  type: 'bundle',   tag: null },

	// CURRENCY
	{ id: 'shop_gems_100',           tab: 'currency',   name: '100 Gems',              desc: 'Small gem pack.',                     price: 0.99, currency: 'usd',   type: 'currency', tag: null },
	{ id: 'shop_gems_500',           tab: 'currency',   name: '500 Gems',              desc: 'Medium gem pack.',                    price: 3.99, currency: 'usd',   type: 'currency', tag: 'POPULAR' },
	{ id: 'shop_gems_1200',          tab: 'currency',   name: '1,200 Gems',            desc: 'Large gem pack — best per gem.',      price: 7.99, currency: 'usd',   type: 'currency', tag: 'BEST VALUE' },
	{ id: 'shop_gems_2800',          tab: 'currency',   name: '2,800 Gems',            desc: 'Extra-large gem pack.',               price: 14.99, currency: 'usd',  type: 'currency', tag: null },
	{ id: 'shop_coins_5k',           tab: 'currency',   name: '5,000 Coins',           desc: 'Starter coin pack.',                  price: 100,  currency: 'gems',  type: 'currency', tag: null },
	{ id: 'shop_coins_25k',          tab: 'currency',   name: '25,000 Coins',          desc: 'Large coin pack.',                    price: 400,  currency: 'gems',  type: 'currency', tag: null },
];

export class Page15ShopController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page15ShopView} */
		this._view = null;

		/** @type {string} Currently active tab id. */
		this._activeTab = ButtonIds.SHOP_TAB_FEATURED;

		/** @type {object|null} Currently selected item. */
		this._selectedItem = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page15ShopView();

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → Home
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this.navigate( RouteIds.HOME );

		} );

		// Tabs change → re-filter grid
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			this._analytics?.track( EventIds.SHOP_TAB_CHANGED, { tabId } );
			this._activeTab = tabId;
			this._renderGrid();

		} );

		// Delegated item card click → show in preview
		this._addListener( view.root, 'click', ( e ) => {

			const card = e.target.closest( '[data-shop-item-id]' );
			if ( ! card ) return;

			const itemId = card.dataset.shopItemId;
			const item   = MOCK_SHOP_ITEMS.find( ( i ) => i.id === itemId );
			if ( ! item ) return;

			this._selectedItem = item;
			this._analytics?.track( EventIds.SHOP_ITEM_VIEWED, { itemId } );
			view.setPreviewItem( item );

		} );

		// PURCHASE button
		this._addListener( view.purchaseBtn.el, 'click', () => {

			if ( ! this._selectedItem ) return;

			this._analytics?.track( EventIds.SHOP_PURCHASE_STARTED, { itemId: this._selectedItem.id } );

			this.openConfirm( {
				id:      ModalIds.PURCHASE_CONFIRM,
				title:   'CONFIRM PURCHASE',
				message: `Purchase "${this._selectedItem.name}" for ${this._formatPrice( this._selectedItem )}?`,
				confirmLabel: 'BUY',
				cancelLabel:  'CANCEL',
				onConfirm: () => {

					this._analytics?.track( EventIds.SHOP_PURCHASE_COMPLETED, { itemId: this._selectedItem.id } );

					this.showToast( {
						message:  `Purchased: ${this._selectedItem.name}`,
						variant:  'success',
						duration: 3000,
					} );

				},
			} );

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;

		// Currency strip
		view.setCurrencyStrip( MockData.wallet );

		// Initial grid
		this._renderGrid();

		view.mount( container );

		this._analytics?.track( EventIds.PAGE_VIEWED, { page: PageIds.SHOP } );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	_renderGrid() {

		const tabMap = {
			[ ButtonIds.SHOP_TAB_FEATURED  ]: 'featured',
			[ ButtonIds.SHOP_TAB_CHARACTERS ]: 'characters',
			[ ButtonIds.SHOP_TAB_KARTS     ]: 'karts',
			[ ButtonIds.SHOP_TAB_COSMETICS ]: 'cosmetics',
			[ ButtonIds.SHOP_TAB_BUNDLES   ]: 'bundles',
			[ ButtonIds.SHOP_TAB_CURRENCY  ]: 'currency',
		};

		const category = tabMap[ this._activeTab ] ?? 'featured';
		const items    = MOCK_SHOP_ITEMS.filter( ( i ) => i.tab === category );

		this._view.setItemGrid( items );

		// Auto-select first item for preview if nothing is selected in this category
		const firstInCategory = items[ 0 ] ?? null;
		if ( firstInCategory ) {
			this._selectedItem = firstInCategory;
			this._view.setPreviewItem( firstInCategory );
		}

	}

	/**
	 * @param {object} item
	 * @returns {string}
	 */
	_formatPrice( item ) {

		if ( item.currency === 'usd' ) return `$${item.price.toFixed( 2 )}`;
		if ( item.currency === 'gems' ) return `${item.price} Gems`;
		return `${item.price} Coins`;

	}

}
