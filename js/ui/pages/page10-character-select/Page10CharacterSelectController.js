import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page10CharacterSelectView } from './Page10CharacterSelectView.js';
import { PageIds } from '../../enums/PageIds.js';
import { EventIds } from '../../enums/EventIds.js';
import { BALACLAVA_OPTIONS, getBalaclavaOptionById, normalizeSelectedBalaclavaId } from '../../../CharacterCustomization.js';
import { Settings } from '../../../Settings.js';
import { DEFAULT_MASK_TINT_COLOR, normalizeAppearanceColor, normalizeMaskTintColor, normalizePlayerAppearance } from '../../../PlayerAppearance.js';
import { loadCharacterItemThumbnailCatalog } from '../../character/BalaclavaThumbnailRenderer.js';

const DEFAULT_SKIN_COLOR = '#d9a37f';
const DEFAULT_SUIT_COLOR = '#00d4e8';
const CAMERA_DEBUG_DEFAULTS = Object.freeze( {
	lookTargetX: 0,
	lookTargetY: 0,
	cameraOffsetX: 0,
	cameraOffsetY: 0,
	cameraOffsetZ: 0,
} );
const THUMBNAIL_CATEGORY_IDS = new Set( [ 'masks', 'accessories', 'shirts', 'pants' ] );

const CATEGORY_DEFS = Object.freeze( [
	Object.freeze( {
		id: 'palette',
		label: 'Palette',
		mode: 'none',
		items: Object.freeze( [] ),
	} ),
	Object.freeze( {
		id: 'masks',
		label: 'Masks',
		mode: 'exclusive',
		items: Object.freeze( BALACLAVA_OPTIONS.map( ( option ) => Object.freeze( {
			id: option.id,
			label: option.label,
		} ) ) ),
	} ),
	Object.freeze( {
		id: 'accessories',
		label: 'Accessories',
		mode: 'toggle',
		items: Object.freeze( [
			Object.freeze( { id: 'Baseball_Hat', label: 'Baseball Hat' } ),
			Object.freeze( { id: 'Gold_Chain', label: 'Gold Chain' } ),
		] ),
	} ),
	Object.freeze( {
		id: 'shirts',
		label: 'Shirts',
		mode: 'toggle',
		items: Object.freeze( [
			Object.freeze( { id: 'Tshirt', label: 'T-Shirt' } ),
		] ),
	} ),
	Object.freeze( {
		id: 'pants',
		label: 'Pants',
		mode: 'toggle',
		items: Object.freeze( [
			Object.freeze( { id: 'Jeans', label: 'Jeans' } ),
		] ),
	} ),
] );

const CATEGORY_BY_ID = new Map( CATEGORY_DEFS.map( ( category ) => [ category.id, category ] ) );
const THUMBNAIL_ITEM_IDS = Object.freeze(
	CATEGORY_DEFS.flatMap( ( category ) => THUMBNAIL_CATEGORY_IDS.has( category.id )
		? category.items.map( ( item ) => item.id )
		: [] )
);

export class Page10CharacterSelectController extends PageControllerBase {

	constructor( params = {}, services = {} ) {

		super( params, services );

		this._settings = null;
		this._savedAppearance = null;
		this._draftAppearance = null;
		this._openCategoryId = 'masks';
		this._onClose = null;
		this._hostMode = 'overlay';
		this._trackPageView = true;
		this._cameraDebugState = this._createDefaultCameraDebugState();
		this._isActive = false;
		this._itemThumbnailState = 'idle';
		this._itemThumbnailEntries = new Map();
		this._itemThumbnailLoadPromise = null;

	}

	initialize( params ) {

		this._params = params || this._params || {};
		this._hostMode = this._params.hostMode === 'tab' ? 'tab' : 'overlay';
		this._trackPageView = this._params.trackPageView !== false && this._hostMode !== 'tab';
		this._view = new Page10CharacterSelectView( this._buildViewConfig() );
		this._settings = this._params.settings instanceof Settings ? this._params.settings : new Settings();
		this._savedAppearance = this._cloneAppearance( this._settings.getPlayerAppearance() );
		this._draftAppearance = this._cloneAppearance( this._savedAppearance );
		this._savedAppearance.maskTintSecondaryColor = '';
		this._draftAppearance.maskTintSecondaryColor = '';
		const defaultCategoryId = this._hostMode === 'tab' ? 'palette' : 'masks';
		this._openCategoryId = CATEGORY_BY_ID.has( this._params.openCategoryId ) ? this._params.openCategoryId : defaultCategoryId;
		this._onClose = typeof this._params.onClose === 'function' ? this._params.onClose : null;

	}

	_buildViewConfig() {

		if ( this._hostMode === 'tab' ) {

			return {
				showBackButton: false,
				showBrandHeader: false,
				showCameraDebugControls: false,
				showEmbeddedPreview: false,
				surfaceVariant: 'customizer',
				rootAriaLabel: 'Character customization tab',
				sidebarLabelText: 'Customizer',
				sidebarTitleText: 'Pilot Style',
				sidebarCopy: 'Tune suit, skin, masks, and gear here. Garage handles kart paint and performance.',
			};

		}

		return {
			showCameraDebugControls: false,
			showEmbeddedPreview: false,
			sidebarCopy: 'Tune suit, skin, masks, and gear here. Selections apply instantly to your driver.',
		};

	}

	bindEvents() {

		if ( this._view.backBtn ) {

			this._addListener( this._view.backBtn, 'click', () => this.requestClose() );

		}
		this._addListener( this._view.root, 'kk:character:category', ( event ) => {

			this._handleCategoryOpen( event.detail?.categoryId );

		} );
		this._addListener( this._view.root, 'kk:character:item', ( event ) => {

			this._handleItemActivate( event.detail?.categoryId, event.detail?.itemId );

		} );
		this._addListener( this._view.root, 'kk:character:color', ( event ) => {

			this._handleColorChange( event.detail?.categoryId, event.detail?.controlId, event.detail?.value );

		} );
		this._addListener( this._view.root, 'kk:character:camera-debug', ( event ) => {

			this._handleCameraDebugChange( event.detail?.controlId, event.detail?.value );

		} );
		this._addListener( this._view.root, 'kk:character:camera-debug-reset', () => {

			this._handleCameraDebugReset();

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		this._view.mount( container );
		this._cameraDebugState = this._createDefaultCameraDebugState();
		this._applyCameraDebugState();
		this._ensureItemThumbnails();
		this._syncView();
		if ( this._trackPageView ) {

			this._analytics?.trackPageView( PageIds.CHARACTERS );

		}

	}

	setActive( active ) {

		this._isActive = !! active;
		if ( active ) {

			this._syncMenuPreviewFocus();
			this._applyCameraDebugState();

		}

	}

	requestClose() {

		if ( this._onClose ) {

			this._onClose( {
				saved: false,
				selectedBalaclavaId: this._savedAppearance.selectedBalaclavaId,
			} );

		}

	}

	dispose() {

		super.dispose();

	}

	_handleCategoryOpen( categoryId ) {

		if ( ! CATEGORY_BY_ID.has( categoryId ) ) return;
		if ( this._openCategoryId === categoryId ) return;

		this._openCategoryId = categoryId;
		this._syncView();

	}

	_handleItemActivate( categoryId, itemId ) {

		const category = CATEGORY_BY_ID.get( categoryId );
		if ( ! category ) return;

		if ( category.mode === 'exclusive' ) {

			const normalizedId = normalizeSelectedBalaclavaId( itemId );
			if ( normalizedId === this._draftAppearance.selectedBalaclavaId ) return;
			this._draftAppearance.selectedBalaclavaId = normalizedId;
			this._analytics?.track( EventIds.CHARACTER_SELECTED, { balaclavaId: normalizedId } );

		} else if ( this._draftAppearance.charAccessories?.[ itemId ] ) {

			const current = this._draftAppearance.charAccessories[ itemId ];
			this._draftAppearance.charAccessories[ itemId ] = {
				...current,
				visible: current.visible === false,
			};

		} else {

			return;

		}

		this._commitDraftAppearance();
		this._syncView();

	}

	_handleColorChange( categoryId, controlId, value ) {

		if ( ! categoryId || ! controlId ) return;

		if ( categoryId === 'palette' ) {

			if ( controlId === 'charSkinColor' ) {

				this._draftAppearance.charSkinColor = normalizeAppearanceColor( value );

			} else if ( controlId === 'characterColor' ) {

				this._draftAppearance.characterColor = normalizeAppearanceColor( value );

			} else {

				return;

			}

			this._commitDraftAppearance();
			this._syncView();
			return;

		}

		if ( categoryId === 'masks' ) {

			if ( controlId !== 'maskTintMainColor' ) {

				return;

			}

			this._draftAppearance.maskTintMainColor = normalizeMaskTintColor( value );
			this._draftAppearance.maskTintSecondaryColor = '';
			this._commitDraftAppearance();
			this._syncView();
			return;

		}

		if ( categoryId === 'accessories' ) {

			if ( ! this._draftAppearance.charAccessories?.[ controlId ] ) return;

			this._draftAppearance.charAccessories[ controlId ] = {
				...this._draftAppearance.charAccessories[ controlId ],
				color: normalizeAppearanceColor( value ),
			};
			this._commitDraftAppearance();
			this._syncView();
			return;

		}

		if ( categoryId !== 'shirts' && categoryId !== 'pants' ) return;

		const itemId = categoryId === 'shirts' ? 'Tshirt' : 'Jeans';
		if ( ! this._draftAppearance.charAccessories?.[ itemId ] ) return;

		this._draftAppearance.charAccessories[ itemId ] = {
			...this._draftAppearance.charAccessories[ itemId ],
			color: normalizeAppearanceColor( value ),
		};
		this._commitDraftAppearance();
		this._syncView();

	}

	_handleCameraDebugChange( controlId, value ) {

		if ( ! Object.prototype.hasOwnProperty.call( this._cameraDebugState, controlId ) ) return;

		const nextValue = Number( value );
		if ( ! Number.isFinite( nextValue ) ) return;

		this._cameraDebugState[ controlId ] = nextValue;
		this._applyCameraDebugState();

	}

	_handleCameraDebugReset() {

		this._cameraDebugState = this._createDefaultCameraDebugState();
		this._applyCameraDebugState();

	}

	_createDefaultCameraDebugState() {

		return {
			...CAMERA_DEBUG_DEFAULTS,
		};

	}

	_applyCameraDebugState() {

		this._services.setMenuPreviewTuning?.( this._cameraDebugState );
		const previewPose = this._services.getMenuPreviewPose?.() ?? null;
		this._view.setCameraDebugState?.( this._cameraDebugState, previewPose );

	}

	_getMenuPreviewFocusPreset() {

		if ( this._hostMode !== 'tab' ) return null;
		if ( this._openCategoryId === 'masks' ) return 'character-face';
		if ( this._openCategoryId === 'accessories' ) return 'character-accessories';
		if ( this._openCategoryId === 'shirts' ) return 'character-shirt';
		if ( this._openCategoryId === 'pants' ) return 'character-pants';
		return 'character-body';

	}

	_syncMenuPreviewFocus() {

		if ( ! this._isActive ) return;
		const presetId = this._getMenuPreviewFocusPreset();
		if ( ! presetId ) return;
		this._services.setMenuPreviewFocus?.( presetId );

	}

	_cloneAccessories( accessories ) {

		return JSON.parse( JSON.stringify( accessories || {} ) );

	}

	_cloneAppearance( appearance ) {

		return normalizePlayerAppearance( {
			...appearance,
			charAccessories: this._cloneAccessories( appearance?.charAccessories ),
		} );

	}

	_commitDraftAppearance() {

		this._settings.set( 'charSkinColor', this._draftAppearance.charSkinColor );
		this._settings.set( 'characterColor', this._draftAppearance.characterColor );
		this._settings.setSelectedBalaclavaId( this._draftAppearance.selectedBalaclavaId );
		this._settings.set( 'maskTintMainColor', this._draftAppearance.maskTintMainColor );
		this._draftAppearance.maskTintSecondaryColor = '';
		this._settings.set( 'maskTintSecondaryColor', '' );
		this._settings.set( 'charAccessories', this._cloneAccessories( this._draftAppearance.charAccessories ) );
		this._savedAppearance = this._cloneAppearance( this._draftAppearance );

	}

	_buildCategorySummary( category ) {

		if ( category.id === 'palette' ) {

			const suitState = this._draftAppearance.characterColor ? 'Custom Suit' : 'Default Suit';
			const skinState = this._draftAppearance.charSkinColor ? 'Custom Skin' : 'Default Skin';
			return `${ suitState } / ${ skinState }`;

		}

		if ( category.id === 'masks' ) {

			return getBalaclavaOptionById( this._draftAppearance.selectedBalaclavaId ).label;

		}

		const activeLabels = category.items
			.filter( ( item ) => this._draftAppearance.charAccessories[ item.id ]?.visible !== false )
			.map( ( item ) => item.label );

		return activeLabels.length > 0 ? activeLabels.join( ', ' ) : 'Off';

	}

	_buildItemMeta( categoryId, itemId, active, savedActive ) {

		if ( categoryId === 'masks' ) {

			return active ? 'Selected' : 'Available';

		}

		return active ? 'On' : 'Hidden';

	}

	_buildCategoriesViewModel() {

		return CATEGORY_DEFS.map( ( category ) => ( {
			id: category.id,
			label: category.label,
			isOpen: category.id === this._openCategoryId,
			summary: this._buildCategorySummary( category ),
			colorControls: this._buildCategoryColorControls( category.id ),
			items: category.items.map( ( item ) => {

				if ( category.id === 'masks' ) {

					const active = this._draftAppearance.selectedBalaclavaId === item.id;
					const thumbnailEntry = this._itemThumbnailEntries.get( item.id ) || null;
					const thumbnailSrc = typeof thumbnailEntry?.src === 'string' ? thumbnailEntry.src : '';
					const thumbnailState = thumbnailSrc
						? 'ready'
						: ( thumbnailEntry?.state || this._itemThumbnailState );

					return {
						id: item.id,
						label: item.label,
						active,
						metaText: this._buildItemMeta( category.id, item.id, active, false ),
						thumbnailSrc,
						thumbnailState,
					};

				}

				const active = this._draftAppearance.charAccessories[ item.id ]?.visible !== false;
				const thumbnailEntry = THUMBNAIL_CATEGORY_IDS.has( category.id )
					? this._itemThumbnailEntries.get( item.id ) || null
					: null;
				const thumbnailSrc = typeof thumbnailEntry?.src === 'string' ? thumbnailEntry.src : '';
				const thumbnailState = THUMBNAIL_CATEGORY_IDS.has( category.id )
					? ( thumbnailSrc ? 'ready' : ( thumbnailEntry?.state || this._itemThumbnailState ) )
					: null;

				return {
					id: item.id,
					label: item.label,
					active,
					metaText: this._buildItemMeta( category.id, item.id, active, false ),
					thumbnailSrc,
					thumbnailState,
				};

			} ),
		} ) );

	}

	_buildCategoryColorControls( categoryId ) {

		if ( categoryId === 'palette' ) {

			return [
				{
					id: 'characterColor',
					label: 'Suit Color',
					value: this._draftAppearance.characterColor || DEFAULT_SUIT_COLOR,
					resetValue: '',
					isCustom: !! this._draftAppearance.characterColor,
				},
				{
					id: 'charSkinColor',
					label: 'Skin Tone',
					value: this._draftAppearance.charSkinColor || DEFAULT_SKIN_COLOR,
					resetValue: '',
					isCustom: !! this._draftAppearance.charSkinColor,
				},
			];

		}

		if ( categoryId === 'masks' ) {

			return [
				{
					id: 'maskTintMainColor',
					label: 'Main Tint',
					value: this._draftAppearance.maskTintMainColor || DEFAULT_MASK_TINT_COLOR,
					resetValue: '',
					isCustom: !! this._draftAppearance.maskTintMainColor,
				},
			];

		}

		if ( categoryId === 'accessories' ) {

			return [
				{
					id: 'Baseball_Hat',
					label: 'Hat Accent',
					value: this._draftAppearance.charAccessories?.Baseball_Hat?.color || DEFAULT_MASK_TINT_COLOR,
					resetValue: '',
					isCustom: !! this._draftAppearance.charAccessories?.Baseball_Hat?.color,
				},
				{
					id: 'Gold_Chain',
					label: 'Chain Accent',
					value: this._draftAppearance.charAccessories?.Gold_Chain?.color || DEFAULT_MASK_TINT_COLOR,
					resetValue: '',
					isCustom: !! this._draftAppearance.charAccessories?.Gold_Chain?.color,
				},
			];

		}

		if ( categoryId === 'shirts' ) {

			const value = this._draftAppearance.charAccessories?.Tshirt?.color || '';
			return [ {
				id: 'shirtColor',
				label: 'Shirt Color',
				value: value || DEFAULT_MASK_TINT_COLOR,
				resetValue: '',
				isCustom: !! value,
			} ];

		}

		if ( categoryId === 'pants' ) {

			const value = this._draftAppearance.charAccessories?.Jeans?.color || '';
			return [ {
				id: 'pantsColor',
				label: 'Pants Color',
				value: value || DEFAULT_MASK_TINT_COLOR,
				resetValue: '',
				isCustom: !! value,
			} ];

		}

		return [];

	}

	_syncView() {

		const draftAppearance = this._cloneAppearance( this._draftAppearance );
		const selectedOption = getBalaclavaOptionById( draftAppearance.selectedBalaclavaId );
		const activeCategory = CATEGORY_BY_ID.get( this._openCategoryId ) || CATEGORY_DEFS[ 0 ];
		const activeCategorySummary = this._buildCategorySummary( activeCategory );

		this._view.renderCategories( this._buildCategoriesViewModel() );
		this._view.setSelectionState( {
			selectedLabel: selectedOption.label,
			activeCategoryId: this._openCategoryId,
			activeCategoryLabel: activeCategory.label,
			activeCategorySummary,
		} );

		this._syncMenuPreviewFocus();
		this._applyCameraDebugState();

	}

	_ensureItemThumbnails() {

		if ( this._itemThumbnailState === 'ready' || this._itemThumbnailLoadPromise ) return;

		const loadThumbnails = typeof this._services.loadCharacterItemThumbnails === 'function'
			? this._services.loadCharacterItemThumbnails
			: typeof this._services.loadBalaclavaThumbnails === 'function'
				? this._services.loadBalaclavaThumbnails
				: loadCharacterItemThumbnailCatalog;

		this._itemThumbnailState = 'loading';
		this._itemThumbnailLoadPromise = Promise.resolve()
			.then( () => loadThumbnails( THUMBNAIL_ITEM_IDS ) )
			.then( ( entries ) => {

				this._itemThumbnailEntries = this._normalizeItemThumbnailEntries( entries );
				this._itemThumbnailState = 'ready';
				this._itemThumbnailLoadPromise = null;
				this._syncView();

			} )
			.catch( ( error ) => {

				console.warn( '[Page10CharacterSelectController] Failed to load character item thumbnails.', error );
				this._itemThumbnailState = 'error';
				this._itemThumbnailLoadPromise = null;
				this._syncView();

			} );

	}

	_normalizeItemThumbnailEntries( entries ) {

		const normalized = new Map();
		for ( const itemId of THUMBNAIL_ITEM_IDS ) {

			const rawEntry = entries instanceof Map
				? entries.get( itemId )
				: entries?.[ itemId ];
			if ( typeof rawEntry === 'string' ) {

				normalized.set( itemId, {
					src: rawEntry,
					state: rawEntry ? 'ready' : 'fallback',
				} );
				continue;

			}

			if ( rawEntry && typeof rawEntry === 'object' ) {

				const src = typeof rawEntry.src === 'string' ? rawEntry.src : '';
				normalized.set( itemId, {
					src,
					state: typeof rawEntry.state === 'string' ? rawEntry.state : ( src ? 'ready' : 'fallback' ),
				} );
				continue;

			}

			normalized.set( itemId, {
				src: '',
				state: 'fallback',
			} );

		}

		return normalized;

	}

}
