import { test, expect } from '@playwright/test';

/**
 * Profile panel and fullscreen settings E2E tests for the current shell.
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
			stats: {
				totalRaces: overrides.totalRaces ?? 12,
				wins: overrides.wins ?? 3,
				bestTimes: overrides.bestTimes || {
					'starter-circuit': 61.234,
					'coastal-run': 68.5,
				},
			},
		};
		localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

	}, overrides );

}

async function waitForShell( page ) {

	await expect( page.locator( '.kk-tab-bar' ) ).toBeVisible( { timeout: 10000 } );
	await expect.poll( async () => await page.locator( '.kk-loading-overlay' ).count() ).toBe( 0 );

}

async function openProfilePanel( page ) {

	await page.goto( '/' );
	await waitForShell( page );

	const profileBtn = page.locator( '.kk-shell-utility__profile-btn' );
	await profileBtn.click();

	const profilePanel = page.locator( '#kk-panel-profile' );
	await expect( profilePanel ).toHaveClass( /kk-panel--active/ );
	await expect( profileBtn ).toHaveAttribute( 'aria-current', 'page' );

	const profileRoot = profilePanel.locator( '.kk-profile' );
	await expect( profileRoot ).toBeVisible( { timeout: 10000 } );
	return profileRoot;

}

test.describe( 'Profile panel', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page, { displayName: 'SpeedRacer' } );

	} );

	test( 'opens from the shell utility button', async ( { page } ) => {

		const profileRoot = await openProfilePanel( page );

		await expect( profileRoot.locator( '.kk-mv-header__title' ) ).toContainText( 'PROFILE' );
		await expect( profileRoot.locator( '.kk-profile__settings-btn' ) ).toBeVisible();

	} );

	test( 'shows the seeded player name and race summary', async ( { page } ) => {

		const profileRoot = await openProfilePanel( page );

		await expect( profileRoot.locator( '.kk-mv-value' ).first() ).toContainText( 'SpeedRacer' );

		const metaText = ( await profileRoot.locator( '.kk-mv-data-item' ).allTextContents() ).join( ' ' );
		expect( metaText ).toContain( 'Races: 12' );
		expect( metaText ).toContain( 'Wins: 3' );
		expect( metaText ).toContain( 'Rate: 25%' );

	} );

	test( 'shows best times when stats are available', async ( { page } ) => {

		const profileRoot = await openProfilePanel( page );

		const timeRows = profileRoot.locator( '.kk-profile__time-item' );
		await expect( timeRows.first() ).toBeVisible( { timeout: 10000 } );
		expect( await timeRows.count() ).toBeGreaterThanOrEqual( 2 );
		await expect( profileRoot.locator( '.kk-profile__time-value' ).first() ).toContainText( ':' );

	} );

} );

test.describe( 'Settings page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders the redesigned settings surface at #/settings', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const settingsPage = page.locator( '.page-settings' );
		await expect( settingsPage ).toBeVisible( { timeout: 10000 } );
		await expect( page.locator( '#kk-app-shell' ) ).toHaveClass( /kk-app-shell--settings-route/ );
		await expect( page.locator( '.kk-shell-chrome' ) ).toBeHidden();
		await expect( settingsPage.locator( '.kk-mv-header__title' ) ).toContainText( 'SETTINGS' );
		await expect( settingsPage.locator( '.page-settings__top .kk-mv-card' ) ).toHaveCount( 1 );

	} );

	test( 'returns to the previous panel after fullscreen settings closes', async ( { page } ) => {

		await openProfilePanel( page );

		await page.locator( '.kk-profile__settings-btn' ).click();
		await expect( page.locator( '.page-settings' ) ).toBeVisible( { timeout: 10000 } );
		await expect( page.locator( '#kk-app-shell' ) ).toHaveClass( /kk-app-shell--settings-route/ );

		await page.locator( '.page-settings__back' ).click();

		await expect( page.locator( '.page-settings' ) ).toHaveCount( 0 );
		await expect( page.locator( '#kk-app-shell' ) ).not.toHaveClass( /kk-app-shell--settings-route/ );
		await expect( page.locator( '#kk-panel-profile' ) ).toHaveClass( /kk-panel--active/ );

	} );

	test( 'shows the focused 6-tab settings navigation', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const tablist = page.locator( '[role="tablist"]' );
		await expect( tablist ).toBeVisible( { timeout: 10000 } );

		const tabs = tablist.locator( '[role="tab"]' );
		await expect( tabs ).toHaveCount( 6 );

		const tabTexts = await tabs.allTextContents();
		const combined = tabTexts.join( ' ' ).toUpperCase();
		expect( combined ).toContain( 'RACE' );
		expect( combined ).toContain( 'CONTROLS' );
		expect( combined ).toContain( 'AUDIO' );
		expect( combined ).toContain( 'DISPLAY' );
		expect( combined ).toContain( 'ACCESSIBILITY' );
		expect( combined ).toContain( 'ABOUT' );

	} );

	test( 'clicking a tab updates the visible panel and workspace header', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const audioTab = page.locator( '[role="tab"]', { hasText: 'AUDIO' } );
		await audioTab.click();

		await expect( audioTab ).toHaveAttribute( 'aria-selected', 'true' );
		await expect( page.locator( '.page-settings__workspace .kk-mv-card__header-right' ) ).toContainText( 'Audio' );
		await expect( page.locator( '[role="tabpanel"]:not([hidden]) .page-settings__group-title' ).first() ).toContainText( 'Mix Levels' );

	} );

	test( 'keeps reset and apply actions visible inside the status card', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const actions = page.locator( '.page-settings__status-actions' );
		await expect( actions ).toBeVisible( { timeout: 10000 } );

		const btnTexts = await actions.locator( 'button' ).allTextContents();
		const combined = btnTexts.join( ' ' ).toUpperCase();
		expect( combined ).toContain( 'RESET' );
		expect( combined ).toContain( 'APPLY' );

	} );

	test( 'apply persists updated values from the new layout', async ( { page } ) => {

		await page.goto( '/#/settings' );

		const displayTab = page.locator( '[role="tab"]', { hasText: 'DISPLAY' } );
		await displayTab.click();

		const qualitySelect = page.locator( '[role="tabpanel"]:not([hidden]) select' ).first();
		await qualitySelect.selectOption( 'LOW' );
		await page.locator( '.page-settings__action--primary' ).click();

		await expect( page.locator( '.page-settings__status-value' ) ).toContainText( 'Saved' );

		const stored = await page.evaluate( () => JSON.parse( localStorage.getItem( 'kart-kids-settings' ) ) );
		expect( stored.quality ).toBe( 'low' );

	} );

} );
