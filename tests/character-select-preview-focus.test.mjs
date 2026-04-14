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

	assert.deepEqual( calls, [
		'character-body',
		'character-accessories',
		'character-shirt',
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
		rootAriaLabel: 'Character tab',
		sidebarCopy: 'Tune suit, skin, masks, and gear here. Selections apply instantly to your driver.',
	} );

} );

test( 'character render clears stale shared preview tuning back to baked defaults', () => {

	const tuningCalls = [];
	const viewCalls = [];
	const controller = new Page10CharacterSelectController( {}, {
		setMenuPreviewTuning: ( tuning ) => tuningCalls.push( tuning ),
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
