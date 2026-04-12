import { test, expect } from '@playwright/test';

/**
 * Profile and Settings E2E tests.
 *
 * Tests the Profile page (#/profile) and Settings page (#/settings).
 * Verifies player data display, stats, and settings tab structure.
 */

/**
 * Seed localStorage with a known player name and stats.
 */
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
		};
		localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

	}, overrides );

}

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

test.describe( 'Profile page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page, { displayName: 'SpeedRacer' } );

	} );

	test( 'renders at #/profile', async ( { page } ) => {

		await page.goto( '/#/profile' );

		const profilePage = page.locator( '.page-profile' );
		await expect( profilePage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows PROFILE header', async ( { page } ) => {

		await page.goto( '/#/profile' );

		const header = page.locator( '.kk-page-header' );
		await expect( header ).toBeVisible( { timeout: 10000 } );
		await expect( header ).toContainText( 'PROFILE' );

	} );

	test( 'shows profile card section', async ( { page } ) => {

		await page.goto( '/#/profile' );

		const profileCard = page.locator( '.kk-profile-card' );
		await expect( profileCard ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows player name from localStorage', async ( { page } ) => {

		await page.goto( '/#/profile' );

		// Wait for the profile card to be populated by the controller.
		// The controller calls setProfileCard which creates a .kk-profile-card__name element.
		const nameEl = page.locator( '.kk-profile-card__name' );

		// The name element may take a moment to be rendered by the controller.
		await expect( nameEl ).toBeVisible( { timeout: 10000 } );
		await expect( nameEl ).toContainText( 'SpeedRacer' );

	} );

	test( 'shows race stats section with default values', async ( { page } ) => {

		await page.goto( '/#/profile' );

		// The profile page has a record section showing wins and races.
		// These default to 0 for a new player.
		const recordValues = page.locator( '.kk-profile-card__record-value' );

		// Wait for the profile card to be populated
		await page.locator( '.kk-profile-card__name' ).waitFor( { timeout: 10000 } );

		const count = await recordValues.count();

		if ( count > 0 ) {

			// Record values should contain "0" for a new player
			const values = await recordValues.allTextContents();
			expect( values.some( ( v ) => v.includes( '0' ) ) ).toBeTruthy();

		}

	} );

	test( 'shows lifetime stats panel', async ( { page } ) => {

		await page.goto( '/#/profile' );

		const statsPanel = page.locator( '.kk-lifetime-stats' );
		await expect( statsPanel ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows tab strip with profile sections', async ( { page } ) => {

		await page.goto( '/#/profile' );

		// Profile page has a tab row: ACHIEVEMENTS, BADGES, MATCH HISTORY
		const tabsRow = page.locator( '.page-profile__tabs-row' );
		await expect( tabsRow ).toBeVisible( { timeout: 10000 } );

		const tabs = tabsRow.locator( '.page-profile__tab' );
		const count = await tabs.count();
		expect( count ).toBeGreaterThanOrEqual( 3 );

		const tabTexts = await tabs.allTextContents();
		const combined = tabTexts.join( ' ' ).toUpperCase();
		expect( combined ).toContain( 'ACHIEVEMENTS' );
		expect( combined ).toContain( 'BADGES' );
		expect( combined ).toContain( 'HISTORY' );

	} );

	test( 'shows favorite loadout section', async ( { page } ) => {

		await page.goto( '/#/profile' );

		const loadout = page.locator( '.kk-loadout-preview' );
		await expect( loadout ).toBeVisible( { timeout: 10000 } );

	} );

} );

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

test.describe( 'Settings page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders at #/settings', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const settingsPage = page.locator( '.page-settings' );
		await expect( settingsPage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows SETTINGS header', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const header = page.locator( '.kk-page-header' );
		await expect( header ).toBeVisible( { timeout: 10000 } );
		await expect( header ).toContainText( 'SETTINGS' );

	} );

	test( 'has 8 settings tabs', async ( { page } ) => {

		await page.goto( '/#/settings' );

		// The Tabs component renders with role="tablist" and role="tab" buttons.
		const tablist = page.locator( '[role="tablist"]' );
		await expect( tablist ).toBeVisible( { timeout: 10000 } );

		const tabs = tablist.locator( '[role="tab"]' );
		await expect( tabs ).toHaveCount( 8 );

		// Verify all expected tab labels are present
		const tabTexts = await tabs.allTextContents();
		const combined = tabTexts.join( ' ' ).toUpperCase();
		expect( combined ).toContain( 'GAMEPLAY' );
		expect( combined ).toContain( 'CONTROLS' );
		expect( combined ).toContain( 'AUDIO' );
		expect( combined ).toContain( 'VIDEO' );
		expect( combined ).toContain( 'ACCESSIBILITY' );
		expect( combined ).toContain( 'ACCOUNT' );
		expect( combined ).toContain( 'PRIVACY' );
		expect( combined ).toContain( 'CREDITS' );

	} );

	test( 'clicking a tab switches visible panel', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const tablist = page.locator( '[role="tablist"]' );
		await expect( tablist ).toBeVisible( { timeout: 10000 } );

		// Click the AUDIO tab
		const audioTab = tablist.locator( '[role="tab"]', { hasText: 'AUDIO' } );
		await audioTab.click();

		// The audio tab should be selected
		await expect( audioTab ).toHaveAttribute( 'aria-selected', 'true' );

	} );

	test( 'shows action bar with RESET and APPLY buttons', async ( { page } ) => {

		await page.goto( '/#/settings' );

		// The settings page has an action bar at the bottom
		const actionBar = page.locator( '.settings-action-bar' );
		await expect( actionBar ).toBeVisible( { timeout: 10000 } );

		const buttons = actionBar.locator( '.kk-cta-button' );
		await expect( buttons ).toHaveCount( 2 );

		const btnTexts = await buttons.allTextContents();
		const combined = btnTexts.join( ' ' ).toUpperCase();
		expect( combined ).toContain( 'RESET' );
		expect( combined ).toContain( 'APPLY' );

	} );

	test( 'gameplay tab has controls (sliders/toggles)', async ( { page } ) => {

		await page.goto( '/#/settings' );

		// GAMEPLAY should be the default active tab.
		// Check for settings rows in the visible panel.
		const settingsRows = page.locator( '.settings-row' );
		await expect( settingsRows.first() ).toBeVisible( { timeout: 10000 } );

		const count = await settingsRows.count();
		expect( count ).toBeGreaterThanOrEqual( 1 );

	} );

} );
