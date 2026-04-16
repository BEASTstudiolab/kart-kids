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

	test( 'renders the shared customizer shell with a live inspector deck', async ( { page } ) => {

		await page.goto( '/#/characters' );

		const deck = page.locator( '.kk-character-panel__deck' );
		await expect( deck ).toBeVisible( { timeout: 10000 } );
		await expect( deck ).toContainText( 'Active Category' );
		await expect( deck ).toContainText( 'Palette' );
		await expect( page.getByRole( 'button', { name: 'Open Garage Bay' } ) ).toBeVisible();

		await page.getByRole( 'button', { name: 'Masks tab' } ).click();
		await expect( deck ).toContainText( 'Masks' );

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

	test( 'renders balaclava thumbnails in the masks grid', async ( { page } ) => {

		await page.goto( '/#/characters' );

		const masksTab = page.locator( '.page-character-select__category-tab', { hasText: 'Masks' } );
		await masksTab.click();

		const maskItems = page.locator( '.page-character-select__item--thumbnail' );
		await expect( maskItems.first() ).toBeVisible( { timeout: 10000 } );
		expect( await maskItems.count() ).toBeGreaterThan( 8 );

		const images = page.locator( '.page-character-select__item-thumb-image' );
		await expect( images.first() ).toBeVisible( { timeout: 10000 } );

		const pigCard = page.getByRole( 'button', { name: /Balaclava Pig/i } );
		await pigCard.click();
		await expect( pigCard ).toHaveClass( /page-character-select__item--active/ );

	} );

	test( 'renders thumbnail pickers for accessories, shirts, and pants too', async ( { page } ) => {

		await page.goto( '/#/characters' );

		for ( const tabName of [ 'Accessories', 'Shirts', 'Pants' ] ) {

			await page.getByRole( 'button', { name: `${ tabName } tab` } ).click();
			const grid = page.locator( '.page-character-select__option-grid' );
			await expect( grid ).toBeVisible( { timeout: 10000 } );
			await expect( grid.locator( '.page-character-select__item--thumbnail' ).first() ).toBeVisible( { timeout: 10000 } );
			await expect( grid.locator( '.page-character-select__item-thumb-image' ).first() ).toBeVisible( { timeout: 10000 } );

		}

	} );

} );
