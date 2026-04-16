import { test, expect } from '@playwright/test';

/**
 * Navigation E2E tests for the current tab-first shell architecture.
 *
 * Targets the hash-based SPA at http://localhost:3000.
 */

const EXPECTED_WARNINGS = [
	'[RouterService]',
	'THREE.WebGLRenderer',
	'crashcat',
	'deprecated',
	'favicon',
	'[Settings]',
	'[GaragePreview]',
	'net::ERR',
	'Failed to load resource',
	'404',
];

async function seedSettings( page ) {

	await page.addInitScript( () => {

		const settings = {
			profile: { displayName: 'TestPlayer' },
			gameplay: {},
			controls: {},
			audio: {},
			video: {},
			stats: {
				totalRaces: 0,
				wins: 0,
				bestTimes: {},
			},
		};
		localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

	} );

}

async function waitForShell( page ) {

	await expect( page.locator( '.kk-tab-bar' ) ).toBeVisible( { timeout: 10000 } );
	await expect.poll( async () => await page.locator( '.kk-loading-overlay' ).count() ).toBe( 0 );

}

test.describe( 'App startup', () => {

	test( 'loads without unexpected console errors', async ( { page } ) => {

		await seedSettings( page );

		const errors = [];

		page.on( 'console', ( msg ) => {

			if ( msg.type() !== 'error' ) return;

			const text = msg.text();
			const isExpected = EXPECTED_WARNINGS.some( ( warning ) => text.includes( warning ) );
			if ( ! isExpected ) errors.push( text );

		} );

		await page.goto( '/' );
		await waitForShell( page );
		await page.waitForTimeout( 1500 );

		expect( errors ).toEqual( [] );

	} );

	test( 'reveals the shell chrome with PLAY active by default', async ( { page } ) => {

		await seedSettings( page );
		await page.goto( '/' );
		await waitForShell( page );

		const tabs = page.locator( '.kk-tab-bar__btn' );
		await expect( tabs ).toHaveCount( 4 );

		const tabLabels = ( await tabs.allTextContents() ).join( ' ' ).toUpperCase();
		expect( tabLabels ).toContain( 'PLAY' );
		expect( tabLabels ).toContain( 'CHARACTER' );
		expect( tabLabels ).toContain( 'GARAGE' );
		expect( tabLabels ).toContain( 'TRACKS' );

		await expect( page.getByRole( 'tab', { name: 'PLAY' } ) ).toHaveAttribute( 'aria-selected', 'true' );
		await expect( page.locator( '#kk-panel-race' ) ).toHaveClass( /kk-panel--active/ );
		await expect( page.locator( '.kk-shell-utility__profile-btn' ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Open settings' } ) ).toBeVisible();

	} );

	test( 'clears the shared loading overlay after bootstrap', async ( { page } ) => {

		await seedSettings( page );
		await page.goto( '/' );
		await waitForShell( page );

		const legacyOverlay = page.locator( '#loading-overlay' );
		await expect( legacyOverlay ).toHaveCount( 0 );
		await expect.poll( async () => await page.locator( '.kk-loading-overlay' ).count() ).toBe( 0 );

	} );

} );

test.describe( 'Shell navigation', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'clicking CHARACTER activates the character panel', async ( { page } ) => {

		await page.goto( '/' );
		await waitForShell( page );

		await page.getByRole( 'tab', { name: 'CHARACTER' } ).click();

		await expect( page.locator( '#kk-panel-character' ) ).toHaveClass( /kk-panel--active/ );
		await expect( page.getByRole( 'tab', { name: 'CHARACTER' } ) ).toHaveAttribute( 'aria-selected', 'true' );
		await expect( page.locator( '.page-character-select' ) ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'direct #/garage resolves to the garage panel', async ( { page } ) => {

		await page.goto( '/#/garage' );
		await waitForShell( page );

		await expect( page ).toHaveURL( /.*#\/garage/ );
		await expect( page.locator( '#kk-panel-garage' ) ).toHaveClass( /kk-panel--active/ );
		await expect( page.getByRole( 'tab', { name: 'GARAGE' } ) ).toHaveAttribute( 'aria-selected', 'true' );

	} );

	test( 'direct #/characters resolves to the character panel', async ( { page } ) => {

		await page.goto( '/#/characters' );
		await waitForShell( page );

		await expect( page ).toHaveURL( /.*#\/characters/ );
		await expect( page.locator( '#kk-panel-character' ) ).toHaveClass( /kk-panel--active/ );
		await expect( page.locator( '.page-character-select' ) ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'profile utility button opens the profile panel', async ( { page } ) => {

		await page.goto( '/' );
		await waitForShell( page );

		const profileBtn = page.locator( '.kk-shell-utility__profile-btn' );
		await profileBtn.click();

		await expect( page.locator( '#kk-panel-profile' ) ).toHaveClass( /kk-panel--active/ );
		await expect( profileBtn ).toHaveAttribute( 'aria-current', 'page' );
		await expect( page.locator( '#kk-panel-profile .kk-profile' ) ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'settings utility button opens the fullscreen settings route', async ( { page } ) => {

		await page.goto( '/#/garage' );
		await waitForShell( page );

		await page.getByRole( 'button', { name: 'Open settings' } ).click();

		await expect( page ).toHaveURL( /.*#\/settings/ );
		await expect( page.locator( '.page-settings' ) ).toBeVisible( { timeout: 10000 } );
		await expect( page.locator( '#kk-app-shell' ) ).toHaveClass( /kk-app-shell--settings-route/ );
		await expect( page.locator( '.kk-shell-chrome' ) ).toBeHidden();

	} );

} );

test.describe( 'Cut routes fallback', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	for ( const route of [ 'party', 'events', 'ranked' ] ) {

		test( `#/${ route } falls back to the current shell tab`, async ( { page } ) => {

			await page.goto( `/#/${ route }` );
			await waitForShell( page );

			await expect( page.locator( '#kk-panel-race' ) ).toHaveClass( /kk-panel--active/ );
			await expect( page.getByRole( 'tab', { name: 'PLAY' } ) ).toHaveAttribute( 'aria-selected', 'true' );
			await expect( page.locator( '.page-settings' ) ).toHaveCount( 0 );

		} );

	}

} );

test.describe( 'Back navigation', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'browser back returns from settings to the previous tab route', async ( { page } ) => {

		await page.goto( '/#/garage' );
		await waitForShell( page );
		await expect( page.locator( '#kk-panel-garage' ) ).toHaveClass( /kk-panel--active/ );

		await page.getByRole( 'button', { name: 'Open settings' } ).click();
		await expect( page ).toHaveURL( /.*#\/settings/ );
		await expect( page.locator( '.page-settings' ) ).toBeVisible( { timeout: 10000 } );

		await page.goBack();

		await expect( page ).toHaveURL( /.*#\/garage/ );
		await expect( page.locator( '#kk-panel-garage' ) ).toHaveClass( /kk-panel--active/ );
		await expect( page.locator( '.page-settings' ) ).toHaveCount( 0 );

	} );

} );
