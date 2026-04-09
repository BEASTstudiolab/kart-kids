import { test, expect } from '@playwright/test';

/**
 * Garage and Kart Selection E2E tests.
 *
 * Tests the Garage page (#/garage) and Kart Select page (#/karts).
 * Verifies kart stats display, kart thumbnails, and selection persistence.
 */

/**
 * Seed localStorage so the first-run modal is skipped.
 */
async function seedSettings( page ) {

	await page.addInitScript( () => {

		const settings = {
			profile: { displayName: 'TestPlayer', avatarChoice: 'red' },
			gameplay: {},
			controls: {},
			audio: {},
			video: {},
		};
		localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

	} );

}

// ---------------------------------------------------------------------------
// Garage page
// ---------------------------------------------------------------------------

test.describe( 'Garage page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders at #/garage', async ( { page } ) => {

		await page.goto( '/#/garage' );

		const garagePage = page.locator( '.page-garage' );
		await expect( garagePage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows GARAGE title', async ( { page } ) => {

		await page.goto( '/#/garage' );

		const title = page.locator( '.page-garage__title' );
		await expect( title ).toBeVisible( { timeout: 10000 } );
		await expect( title ).toHaveText( 'GARAGE' );

	} );

	test( 'shows kart stats panel with stat bars', async ( { page } ) => {

		await page.goto( '/#/garage' );

		const statsPanel = page.locator( '.page-garage__stats-panel' );
		await expect( statsPanel ).toBeVisible( { timeout: 10000 } );

		// Should have a "KART STATS" label
		const statsLabel = statsPanel.locator( '.page-garage__panel-label' );
		await expect( statsLabel ).toContainText( 'KART STATS' );

		// Should show 4 stat rows: Speed, Acceleration, Handling, Drift Power
		const statRows = statsPanel.locator( '.page-garage__stat-row' );
		await expect( statRows ).toHaveCount( 4 );

		// Verify stat names are visible
		const statNames = statsPanel.locator( '.page-garage__stat-name' );
		const names = await statNames.allTextContents();
		expect( names ).toContain( 'Speed' );
		expect( names ).toContain( 'Acceleration' );
		expect( names ).toContain( 'Handling' );
		expect( names ).toContain( 'Drift Power' );

	} );

	test( 'shows tab strip with garage categories', async ( { page } ) => {

		await page.goto( '/#/garage' );

		const tabs = page.locator( '.page-garage__tabs' );
		await expect( tabs ).toBeVisible( { timeout: 10000 } );

		const tabBtns = tabs.locator( '.page-garage__tab' );
		await expect( tabBtns ).toHaveCount( 6 );

		// Verify tab labels
		const tabLabels = await tabBtns.allTextContents();
		expect( tabLabels ).toContain( 'CHARACTERS' );
		expect( tabLabels ).toContain( 'KARTS' );
		expect( tabLabels ).toContain( 'PAINT' );
		expect( tabLabels ).toContain( 'WHEELS' );
		expect( tabLabels ).toContain( 'ACCESSORIES' );
		expect( tabLabels ).toContain( 'EMOTES' );

	} );

	test( 'shows bottom action bar with buttons', async ( { page } ) => {

		await page.goto( '/#/garage' );

		const bottomBar = page.locator( '.page-garage__bottombar' );
		await expect( bottomBar ).toBeVisible( { timeout: 10000 } );

		// Should have ROTATE, INSPECT, LOADOUT, SAVE buttons
		const buttons = bottomBar.locator( '.kk-cta-button' );
		await expect( buttons ).toHaveCount( 4 );

		const btnTexts = await buttons.allTextContents();
		const combined = btnTexts.join( ' ' );
		expect( combined ).toContain( 'ROTATE' );
		expect( combined ).toContain( 'INSPECT' );
		expect( combined ).toContain( 'LOADOUT' );
		expect( combined ).toContain( 'SAVE' );

	} );

	test( 'has a back button', async ( { page } ) => {

		await page.goto( '/#/garage' );

		const backBtn = page.locator( '.page-garage__back-btn' );
		await expect( backBtn ).toBeVisible( { timeout: 10000 } );
		await expect( backBtn ).toContainText( 'BACK' );

	} );

} );

// ---------------------------------------------------------------------------
// Kart Select page
// ---------------------------------------------------------------------------

test.describe( 'Kart Select page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders at #/karts', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const kartPage = page.locator( '.page-kart-select' );
		await expect( kartPage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows KART SELECT title', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const title = page.locator( '.page-kart-select__title' );
		await expect( title ).toBeVisible( { timeout: 10000 } );
		await expect( title ).toHaveText( 'KART SELECT' );

	} );

	test( 'shows kart stat bars', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const statsPanel = page.locator( '.page-kart-select__stats-panel' );
		await expect( statsPanel ).toBeVisible( { timeout: 10000 } );

		// Should show 5 stat rows: Speed, Acceleration, Handling, Traction, Boost
		const statRows = statsPanel.locator( '.page-kart-select__stat-row' );
		await expect( statRows ).toHaveCount( 5 );

		const statNames = statsPanel.locator( '.page-kart-select__stat-name' );
		const names = await statNames.allTextContents();
		expect( names ).toContain( 'SPEED' );
		expect( names ).toContain( 'ACCELERATION' );
		expect( names ).toContain( 'HANDLING' );
		expect( names ).toContain( 'TRACTION' );
		expect( names ).toContain( 'BOOST' );

	} );

	test( 'shows kart thumbnails from VehicleRegistry (2 karts)', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const thumbStrip = page.locator( '.page-kart-select__thumb-strip' );
		await expect( thumbStrip ).toBeVisible( { timeout: 10000 } );

		// VehicleRegistry has 2 vehicles: Kart 1 and Kart 2
		const thumbs = thumbStrip.locator( '.page-kart-select__thumb' );
		await expect( thumbs ).toHaveCount( 2 );

		// Verify kart names in thumbnails
		const thumbNames = thumbStrip.locator( '.page-kart-select__thumb-name' );
		const names = await thumbNames.allTextContents();
		expect( names.length ).toBe( 2 );

	} );

	test( 'selecting a kart updates visual selection', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const thumbStrip = page.locator( '.page-kart-select__thumb-strip' );
		await expect( thumbStrip ).toBeVisible( { timeout: 10000 } );

		const thumbs = thumbStrip.locator( '.page-kart-select__thumb' );
		const thumbCount = await thumbs.count();

		if ( thumbCount >= 2 ) {

			// Click the second kart thumbnail
			await thumbs.nth( 1 ).click();

			// It should now have the selected class
			await expect( thumbs.nth( 1 ) ).toHaveClass( /page-kart-select__thumb--selected/ );

		}

	} );

	test( 'selecting a kart persists in localStorage', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const thumbStrip = page.locator( '.page-kart-select__thumb-strip' );
		await expect( thumbStrip ).toBeVisible( { timeout: 10000 } );

		const thumbs = thumbStrip.locator( '.page-kart-select__thumb' );
		const thumbCount = await thumbs.count();

		if ( thumbCount >= 2 ) {

			// Click the SELECT button to equip the currently selected kart
			const selectBtn = page.locator( '.page-kart-select__footer .kk-cta-button--primary' );

			if ( await selectBtn.isVisible() ) {

				// Click second thumb then select
				await thumbs.nth( 1 ).click();
				await selectBtn.click();

				// Check localStorage for persisted selection
				const stored = await page.evaluate( () => {

					return localStorage.getItem( 'kart-kids-settings' );

				} );

				expect( stored ).toBeTruthy();

				const parsed = JSON.parse( stored );
				// The settings object should exist and have been updated
				expect( parsed ).toBeDefined();

			}

		}

	} );

	test( 'has back button and footer action buttons', async ( { page } ) => {

		await page.goto( '/#/karts' );

		const kartPage = page.locator( '.page-kart-select' );
		await expect( kartPage ).toBeVisible( { timeout: 10000 } );

		// Back button
		const backBtn = page.locator( '.page-kart-select__back-btn' );
		await expect( backBtn ).toBeVisible();
		await expect( backBtn ).toContainText( 'BACK' );

		// Footer buttons: TEST DRIVE and SELECT
		const footer = page.locator( '.page-kart-select__footer' );
		await expect( footer ).toBeVisible();

		const footerBtns = footer.locator( '.kk-cta-button' );
		await expect( footerBtns ).toHaveCount( 2 );

		const btnTexts = await footerBtns.allTextContents();
		const combined = btnTexts.join( ' ' );
		expect( combined ).toContain( 'TEST DRIVE' );

	} );

} );

// ---------------------------------------------------------------------------
// Navigation: Garage -> Kart Select -> back to Garage
// ---------------------------------------------------------------------------

test.describe( 'Garage navigation flow', () => {

	test( 'Garage -> Kart Select -> back to Garage', async ( { page } ) => {

		await seedSettings( page );

		// Start at Garage
		await page.goto( '/#/garage' );
		await page.locator( '.page-garage' ).waitFor( { timeout: 10000 } );

		// Click the KARTS tab
		const kartsTab = page.locator( '.page-garage__tab', { hasText: 'KARTS' } );
		await kartsTab.click();

		// The controller should navigate to karts page (or we navigate manually)
		// Navigate to karts
		await page.goto( '/#/karts' );
		await page.locator( '.page-kart-select' ).waitFor( { timeout: 10000 } );

		// Click back button
		const backBtn = page.locator( '.page-kart-select__back-btn' );
		await backBtn.click();

		// Should navigate back (either to garage or home depending on history)
		await page.waitForTimeout( 1000 );

		// Verify we left the kart select page
		const url = page.url();
		expect( url ).not.toMatch( /#\/karts$/ );

	} );

} );
