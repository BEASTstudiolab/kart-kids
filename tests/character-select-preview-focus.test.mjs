import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPlayerAppearance } from '../js/PlayerAppearance.js';

globalThis.window = globalThis.window || {
	location: {
		hash: '',
	},
};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { Page10CharacterSelectController } = await import( '../js/ui/pages/page10-character-select/Page10CharacterSelectController.js' );

test( 'character tab uses face focus while masks are open', () => {

	const calls = [];
	const controller = new Page10CharacterSelectController( {}, {
		setMenuPreviewFocus: ( presetId ) => {

			calls.push( presetId );

		},
	} );

	controller._hostMode = 'tab';
	controller._isActive = true;
	controller._openCategoryId = 'masks';
	controller._syncMenuPreviewFocus();

	assert.deepEqual( calls, [ 'character-face' ] );

} );

test( 'character tab routes each wardrobe category to the right shared-stage preset', () => {

	const calls = [];
	const controller = new Page10CharacterSelectController( {}, {
		setMenuPreviewFocus: ( presetId ) => {

			calls.push( presetId );

		},
	} );

	controller._hostMode = 'tab';
	controller._isActive = true;
	controller._openCategoryId = 'palette';
	controller._syncMenuPreviewFocus();
	controller._openCategoryId = 'accessories';
	controller._syncMenuPreviewFocus();
	controller._openCategoryId = 'shirts';
	controller._syncMenuPreviewFocus();
	controller._openCategoryId = 'pants';
	controller._syncMenuPreviewFocus();
	controller._openCategoryId = 'feet';
	controller._syncMenuPreviewFocus();

	assert.deepEqual( calls, [
		'character-body',
		'character-accessories',
		'character-shirt',
		'character-pants',
		'character-pants',
	] );

} );

test( 'character tab does not steal menu preview focus while inactive', () => {

	const calls = [];
	const controller = new Page10CharacterSelectController( {}, {
		setMenuPreviewFocus: ( presetId ) => {

			calls.push( presetId );

		},
	} );

	controller._hostMode = 'tab';
	controller._isActive = false;
	controller._openCategoryId = 'masks';
	controller._syncMenuPreviewFocus();

	assert.deepEqual( calls, [] );

} );

test( 'character tab disables the embedded preview panel in tab mode', () => {

	const controller = new Page10CharacterSelectController();
	controller._hostMode = 'tab';

	assert.deepEqual( controller._buildViewConfig(), {
		showBackButton: false,
		showBrandHeader: false,
		showCameraDebugControls: false,
		showEmbeddedPreview: false,
		surfaceVariant: 'customizer',
		rootAriaLabel: 'Character customization tab',
		sidebarLabelText: 'Customizer',
		sidebarTitleText: 'Pilot Style',
		sidebarCopy: 'Tune suit, skin, masks, and gear here. Garage handles kart paint and performance.',
	} );

} );

test( 'character render clears stale shared preview tuning back to baked defaults', () => {

	const tuningCalls = [];
	const viewCalls = [];
	const controller = new Page10CharacterSelectController( {}, {
		setMenuPreviewTuning: ( tuning ) => tuningCalls.push( tuning ),
		loadBalaclavaThumbnails: async () => new Map(),
		getMenuPreviewPose: () => ( {
			presetId: 'character-face',
			cameraPos: { x: 0.4, y: 2.92, z: 3.65 },
			lookAt: { x: 0.4, y: 1.68, z: - 0.02 },
			fov: 28,
			kartRotYDeg: 1434,
		} ),
	} );

	controller._cameraDebugState = {
		lookTargetX: 0.21,
		lookTargetY: - 0.14,
		cameraOffsetX: 0.33,
		cameraOffsetY: 0.42,
		cameraOffsetZ: - 0.28,
	};
	controller._view = {
		mount: () => {},
		renderCategories: () => {},
		setSelectionState: () => {},
		setCameraDebugState: ( tuning, previewPose ) => {

			viewCalls.push( { tuning, previewPose } );

		},
	};
	controller._syncView = () => {};
	controller._trackPageView = false;
	controller.render( {} );

	assert.deepEqual( tuningCalls, [ {
		lookTargetX: 0,
		lookTargetY: 0,
		cameraOffsetX: 0,
		cameraOffsetY: 0,
		cameraOffsetZ: 0,
	} ] );
	assert.deepEqual( viewCalls, [ {
		tuning: {
			lookTargetX: 0,
			lookTargetY: 0,
			cameraOffsetX: 0,
			cameraOffsetY: 0,
			cameraOffsetZ: 0,
		},
		previewPose: {
			presetId: 'character-face',
			cameraPos: { x: 0.4, y: 2.92, z: 3.65 },
			lookAt: { x: 0.4, y: 1.68, z: - 0.02 },
			fov: 28,
			kartRotYDeg: 1434,
		},
	} ] );

} );

test( 'wardrobe category items expose thumbnail metadata when character item previews are available', () => {

	const controller = new Page10CharacterSelectController();
	const appearance = createDefaultPlayerAppearance();

	controller._draftAppearance = controller._cloneAppearance( appearance );
	controller._itemThumbnailState = 'ready';
	controller._itemThumbnailEntries = new Map( [
		[ 'balaclava-basic', { src: 'data:image/png;base64,basic', state: 'ready' } ],
		[ 'balaclava-pig', { src: '', state: 'fallback' } ],
		[ 'Baseball_Hat', { src: 'data:image/png;base64,hat', state: 'ready' } ],
		[ 'Tshirt', { src: 'data:image/png;base64,shirt', state: 'ready' } ],
		[ 'Jeans', { src: 'data:image/png;base64,pants', state: 'ready' } ],
	] );

	const categories = controller._buildCategoriesViewModel();
	const masksCategory = categories.find( ( category ) => category.id === 'masks' );
	const accessoriesCategory = categories.find( ( category ) => category.id === 'accessories' );
	const shirtsCategory = categories.find( ( category ) => category.id === 'shirts' );
	const pantsCategory = categories.find( ( category ) => category.id === 'pants' );
	const basic = masksCategory.items.find( ( item ) => item.id === 'balaclava-basic' );
	const pig = masksCategory.items.find( ( item ) => item.id === 'balaclava-pig' );
	const hat = accessoriesCategory.items.find( ( item ) => item.id === 'Baseball_Hat' );
	const shirt = shirtsCategory.items.find( ( item ) => item.id === 'Tshirt' );
	const pants = pantsCategory.items.find( ( item ) => item.id === 'Jeans' );

	assert.equal( basic.thumbnailSrc, 'data:image/png;base64,basic' );
	assert.equal( basic.thumbnailState, 'ready' );
	assert.equal( pig.thumbnailSrc, '' );
	assert.equal( pig.thumbnailState, 'fallback' );
	assert.equal( hat.thumbnailSrc, 'data:image/png;base64,hat' );
	assert.equal( hat.thumbnailState, 'ready' );
	assert.equal( shirt.thumbnailSrc, 'data:image/png;base64,shirt' );
	assert.equal( shirt.thumbnailState, 'ready' );
	assert.equal( pants.thumbnailSrc, 'data:image/png;base64,pants' );
	assert.equal( pants.thumbnailState, 'ready' );

} );

test( 'character selections persist immediately without a separate save action', () => {

	const settingsCalls = [];
	const controller = new Page10CharacterSelectController();
	const appearance = createDefaultPlayerAppearance();

	controller._settings = {
		set: ( key, value ) => settingsCalls.push( [ key, value ] ),
		setSelectedBalaclavaId: ( value ) => settingsCalls.push( [ 'selectedBalaclavaId', value ] ),
	};
	controller._draftAppearance = controller._cloneAppearance( appearance );
	controller._savedAppearance = controller._cloneAppearance( appearance );
	controller._syncView = () => {};

	controller._handleItemActivate( 'masks', 'balaclava-pig' );

	assert.equal( controller._draftAppearance.selectedBalaclavaId, 'balaclava-pig' );
	assert.equal( controller._savedAppearance.selectedBalaclavaId, 'balaclava-pig' );
	assert.equal( settingsCalls.some( ( [ key ] ) => key === 'selectedBalaclavaId' ), true );
	assert.equal( settingsCalls.some( ( [ key ] ) => key === 'charAccessories' ), true );

} );

test( 'character tab palette exposes only the skin tone control', () => {

	const controller = new Page10CharacterSelectController();
	controller._draftAppearance = controller._cloneAppearance( createDefaultPlayerAppearance() );

	assert.deepEqual(
		controller._buildCategoryColorControls( 'palette' ).map( ( control ) => control.id ),
		[ 'charSkinColor' ]
	);

} );

test( 'character tab places feet beside pants in the category row', () => {

	const controller = new Page10CharacterSelectController();
	controller._draftAppearance = controller._cloneAppearance( createDefaultPlayerAppearance() );
	controller._openCategoryId = 'palette';

	assert.deepEqual(
		controller._buildCategoriesViewModel().map( ( category ) => category.label ),
		[ 'Palette', 'Masks', 'Accessories', 'Shirts', 'Pants', 'Feet' ]
	);

} );

test( 'character tab exposes a dedicated boot color control in the feet category', () => {

	const controller = new Page10CharacterSelectController();
	controller._draftAppearance = controller._cloneAppearance( createDefaultPlayerAppearance() );

	assert.deepEqual(
		controller._buildCategoryColorControls( 'feet' ).map( ( control ) => control.id ),
		[ 'bootsColor' ]
	);

} );

test( 'character tab does not allow pants to be toggled off', () => {

	const settingsCalls = [];
	const controller = new Page10CharacterSelectController();
	const appearance = createDefaultPlayerAppearance();

	controller._settings = {
		set: ( key, value ) => settingsCalls.push( [ key, value ] ),
		setSelectedBalaclavaId: ( value ) => settingsCalls.push( [ 'selectedBalaclavaId', value ] ),
	};
	controller._draftAppearance = controller._cloneAppearance( appearance );
	controller._savedAppearance = controller._cloneAppearance( appearance );
	controller._syncView = () => {};

	controller._handleItemActivate( 'pants', 'Jeans' );

	assert.equal( controller._draftAppearance.charAccessories.Jeans.visible, true );
	assert.equal( controller._savedAppearance.charAccessories.Jeans.visible, true );
	assert.equal( settingsCalls.length, 0 );

} );

test( 'character tab does not allow boots to be toggled off', () => {

	const settingsCalls = [];
	const controller = new Page10CharacterSelectController();
	const appearance = createDefaultPlayerAppearance();

	controller._settings = {
		set: ( key, value ) => settingsCalls.push( [ key, value ] ),
		setSelectedBalaclavaId: ( value ) => settingsCalls.push( [ 'selectedBalaclavaId', value ] ),
	};
	controller._draftAppearance = controller._cloneAppearance( appearance );
	controller._savedAppearance = controller._cloneAppearance( appearance );
	controller._syncView = () => {};

	controller._handleItemActivate( 'feet', 'Boots' );

	assert.equal( controller._draftAppearance.charAccessories.Boots.visible, true );
	assert.equal( controller._savedAppearance.charAccessories.Boots.visible, true );
	assert.equal( settingsCalls.length, 0 );

} );
