import { test, expect } from '@playwright/test';

async function seedSettings( page, overrides = {} ) {

	await page.addInitScript( ( overrides ) => {

		const settings = {
			profile: {
				displayName: overrides.displayName || 'TestPlayer',
			},
			gameplay: {},
			controls: {},
			audio: {},
			video: {},
			maskTintMainColor: overrides.maskTintMainColor || '#ff5500',
			maskTintSecondaryColor: overrides.maskTintSecondaryColor || '#00aaff',
			selectedBalaclavaId: overrides.selectedBalaclavaId || 'balaclava-basic',
		};
		localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

	}, overrides );

}

test.describe( 'Character tab', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'hides the redundant Main Tab and Character title copy in tab mode', async ( { page } ) => {

		await page.goto( '/#/characters' );

		const characterPage = page.locator( '.page-character-select' );
		await expect( characterPage ).toBeVisible( { timeout: 10000 } );
		await expect( page.locator( '.page-character-select__header' ) ).toHaveCount( 0 );
		await expect( characterPage ).not.toContainText( 'MAIN TAB' );
		await expect( characterPage ).not.toContainText( 'CHARACTER' );

	} );

	test( 'renders top category tabs and a grid of active options', async ( { page } ) => {

		await page.goto( '/#/characters' );

		const tabs = page.locator( '.page-character-select__category-tab' );
		await expect( tabs ).toHaveCount( 5 );
		await expect( page.locator( '.page-character-select__category-tab--active' ) ).toHaveText( 'Palette' );

		const masksTab = page.locator( '.page-character-select__category-tab', { hasText: 'Masks' } );
		await masksTab.click();

		const grid = page.locator( '.page-character-select__option-grid' );
		await expect( grid ).toBeVisible( { timeout: 10000 } );
		expect( await grid.locator( '.page-character-select__item' ).count() ).toBeGreaterThan( 8 );

	} );

	test( 'shows only the main tint control in the masks tab', async ( { page } ) => {

		await page.goto( '/#/characters' );

		const masksTab = page.locator( '.page-character-select__category-tab', { hasText: 'Masks' } );
		await masksTab.click();

		const colorLabels = await page.locator( '.page-character-select__color-label' ).allTextContents();
		expect( colorLabels ).toContain( 'Main Tint' );
		expect( colorLabels ).not.toContain( 'Secondary Tint' );

	} );

	test( 'shows live camera tuning sliders in Character tab mode', async ( { page } ) => {

		await page.goto( '/#/characters' );

		const cameraDebug = page.locator( '.page-character-select__detail-card', { hasText: 'Camera Tuning' } );
		await expect( cameraDebug ).toBeVisible( { timeout: 10000 } );

		const sliders = cameraDebug.locator( '.page-character-select__camera-debug-slider' );
		await expect( sliders ).toHaveCount( 5 );

		const readout = cameraDebug.locator( '.page-character-select__camera-debug-readout' );
		await expect( readout ).toContainText( 'Look X: 0.00' );

		await sliders.nth( 0 ).fill( '0.25' );
		await expect( readout ).toContainText( 'Look X: 0.25' );

	} );

} );
