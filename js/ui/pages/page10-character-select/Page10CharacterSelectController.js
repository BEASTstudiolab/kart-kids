import { PageControllerBase } from '../../core/PageControllerBase.js';
import { Page10CharacterSelectView } from './Page10CharacterSelectView.js';
import { PageIds } from '../../enums/PageIds.js';
import { EventIds } from '../../enums/EventIds.js';
import { BALACLAVA_OPTIONS, getBalaclavaOptionById, normalizeSelectedBalaclavaId } from '../../../CharacterCustomization.js';
import { Settings } from '../../../Settings.js';
import { DEFAULT_MASK_TINT_COLOR, getVisibleAccessoryLabels, normalizeAppearanceColor, normalizeMaskTintColor, normalizePlayerAppearance } from '../../../PlayerAppearance.js';
import { CharacterPreviewScene } from '../../CharacterPreviewScene.js';
import { CHARACTER_PREVIEW_CAMERA_DEFAULTS } from '../../utils/characterPreviewFrame.js';

const DEFAULT_SKIN_COLOR = '#d9a37f';
const DEFAULT_SUIT_COLOR = '#00d4e8';
const CAMERA_DEBUG_DEFAULTS = CHARACTER_PREVIEW_CAMERA_DEFAULTS;

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

export class Page10CharacterSelectController extends PageControllerBase {

	constructor( params = {}, services = {} ) {

		super( params, services );

		this._settings = null;
		this._savedAppearance = null;
		this._draftAppearance = null;
		this._openCategoryId = 'masks';
		this._onClose = null;
		this._previewScene = null;
		this._hostMode = 'overlay';
		this._trackPageView = true;
		this._cameraDebugState = this._createDefaultCameraDebugState();

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
				showCameraDebugControls: true,
				rootAriaLabel: 'Character tab',
				sidebarCopy: 'Tune suit, skin, masks, and gear here. Changes stay in draft until you save them.',
				secondaryActionLabel: 'Reset',
				secondaryActionAriaLabel: 'Reset character draft to last saved version',
				secondaryActionMode: 'reset',
			};

		}

		return {};

	}

	bindEvents() {

		if ( this._view.backBtn ) {

			this._addListener( this._view.backBtn, 'click', () => this.requestClose() );

		}
		this._addListener( this._view.cancelBtn.el, 'click', () => {

			if ( this._hostMode === 'tab' ) {

				this._handleReset();
				return;

			}

			this.requestClose();

		} );
		this._addListener( this._view.saveBtn.el, 'click', () => this._handleSave() );
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
		this._view.setPreviewLoading( true );
		this._previewScene = new CharacterPreviewScene( this._view.previewPanel.inner, {
			onReady: () => this._view.setPreviewLoading( false ),
		} );
		this._applyCameraDebugState();
		this._syncView();
		if ( this._trackPageView ) {

			this._analytics?.trackPageView( PageIds.CHARACTERS );

		}

	}

	setActive( active ) {

		this._previewScene?.setPaused( ! active );

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

		if ( this._previewScene ) {

			this._previewScene.dispose();
			this._previewScene = null;

		}

		super.dispose();

	}

	_handleCategoryOpen( categoryId ) {

		if ( ! CATEGORY_BY_ID.has( categoryId ) ) return;

		this._openCategoryId = this._openCategoryId === categoryId ? null : categoryId;
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

		this._syncView();

	}

	_handleSave() {

		if ( ! this._isDirty() ) {

			if ( this._onClose ) {

				this._onClose( {
					saved: false,
					selectedBalaclavaId: this._savedAppearance.selectedBalaclavaId,
				} );

			}
			return;

		}

		this._settings.set( 'charSkinColor', this._draftAppearance.charSkinColor );
		this._settings.set( 'characterColor', this._draftAppearance.characterColor );
		this._settings.setSelectedBalaclavaId( this._draftAppearance.selectedBalaclavaId );
		this._settings.set( 'maskTintMainColor', this._draftAppearance.maskTintMainColor );
		this._draftAppearance.maskTintSecondaryColor = '';
		this._settings.set( 'maskTintSecondaryColor', '' );
		this._settings.set( 'charAccessories', this._cloneAccessories( this._draftAppearance.charAccessories ) );
		this._savedAppearance = this._cloneAppearance( this._draftAppearance );
		this._syncView();
		this._analytics?.track( EventIds.CHARACTER_EQUIPPED, {
			balaclavaId: this._savedAppearance.selectedBalaclavaId,
		} );

		if ( this._onClose ) {

			this._onClose( {
				saved: true,
				selectedBalaclavaId: this._savedAppearance.selectedBalaclavaId,
			} );

		}

	}

	_handleReset() {

		if ( ! this._isDirty() ) return;

		this._draftAppearance = this._cloneAppearance( this._savedAppearance );
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

			this._syncView();
			return;

		}

		if ( categoryId === 'masks' ) {

			if ( controlId !== 'maskTintMainColor' ) {

				return;

			}

			this._draftAppearance.maskTintMainColor = normalizeMaskTintColor( value );
			this._draftAppearance.maskTintSecondaryColor = '';
			this._syncView();
			return;

		}

		if ( categoryId === 'accessories' ) {

			if ( ! this._draftAppearance.charAccessories?.[ controlId ] ) return;

			this._draftAppearance.charAccessories[ controlId ] = {
				...this._draftAppearance.charAccessories[ controlId ],
				color: normalizeAppearanceColor( value ),
			};
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

		this._previewScene?.setDebugCameraOffsets( this._cameraDebugState );
		this._view.setCameraDebugState?.( this._cameraDebugState );

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

	_isDirty() {

		return JSON.stringify( this._draftAppearance ) !== JSON.stringify( this._savedAppearance );

	}

	_buildDraftAppearance() {

		return this._cloneAppearance( this._draftAppearance );

	}

	_buildSummaryText() {

		const appearance = this._buildDraftAppearance();
		const balaclavaLabel = getBalaclavaOptionById( appearance.selectedBalaclavaId ).label;
		const visibleAccessories = getVisibleAccessoryLabels( appearance ).filter( ( label ) => label !== balaclavaLabel );
		const skinState = appearance.charSkinColor ? 'custom skin tone' : 'default skin tone';
		const suitState = appearance.characterColor ? 'custom suit color' : 'default suit color';
		const shirtState = appearance.charAccessories.Tshirt?.color ? 'custom shirt color' : 'default shirt color';
		const pantsState = appearance.charAccessories.Jeans?.color ? 'custom pants color' : 'default pants color';
		const maskState = appearance.maskTintMainColor
			? 'custom mask tint'
			: 'default mask tint';
		const extrasState = visibleAccessories.length > 0 ? visibleAccessories.join( ', ' ) : 'none';

		return `${ suitState }, ${ skinState }, ${ shirtState }, ${ pantsState }, ${ maskState }. Visible extras: ${ extrasState }.`;

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

			if ( active && savedActive ) return 'Saved';
			if ( active ) return 'Draft';
			if ( savedActive ) return 'Saved';
			return 'Preview';

		}

		if ( active && savedActive ) return 'Saved On';
		if ( active ) return 'Draft On';
		if ( savedActive ) return 'Draft Off';
		return 'Hidden';

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
					const savedActive = this._savedAppearance.selectedBalaclavaId === item.id;

					return {
						id: item.id,
						label: item.label,
						active,
						savedActive,
						metaText: this._buildItemMeta( category.id, item.id, active, savedActive ),
					};

				}

				const active = this._draftAppearance.charAccessories[ item.id ]?.visible !== false;
				const savedActive = this._savedAppearance.charAccessories[ item.id ]?.visible !== false;

				return {
					id: item.id,
					label: item.label,
					active,
					savedActive,
					metaText: this._buildItemMeta( category.id, item.id, active, savedActive ),
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

		const draftAppearance = this._buildDraftAppearance();
		const selectedOption = getBalaclavaOptionById( draftAppearance.selectedBalaclavaId );
		const savedOption = getBalaclavaOptionById( this._savedAppearance.selectedBalaclavaId );
		const dirty = this._isDirty();

		this._view.renderCategories( this._buildCategoriesViewModel() );
		this._view.setSelectionState( {
			selectedLabel: selectedOption.label,
			savedLabel: savedOption.label,
			dirty,
			summaryText: this._buildSummaryText(),
		} );

		if ( this._previewScene ) {

			this._previewScene.setAppearance( draftAppearance );

		}

		this._applyCameraDebugState();

	}

}
