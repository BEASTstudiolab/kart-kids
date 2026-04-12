import { test, expect } from '@playwright/test';

/**
 * Navigation E2E tests — menu navigation, routing, and startup behavior.
 *
 * Targets the hash-based SPA at http://localhost:3000.
 * Routes use the form /#/path (e.g. /#/home, /#/garage).
 */

// Console warnings we expect and can safely ignore.
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

/**
 * Seed localStorage so the first-run name entry modal does not block tests.
 */
async function seedSettings( page ) {

	await page.addInitScript( () => {

		const settings = {
			profile: { displayName: 'TestPlayer' },
			gameplay: {},
			controls: {},
			audio: {},
			video: {},
		};
		localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

	} );

}

// ---------------------------------------------------------------------------
// App loads without console errors
// ---------------------------------------------------------------------------

test.describe( 'App startup', () => {

	test( 'loads without unexpected console errors', async ( { page } ) => {

		await seedSettings( page );

		const errors = [];

		page.on( 'console', ( msg ) => {

			if ( msg.type() !== 'error' ) return;

			const text = msg.text();
			const isExpected = EXPECTED_WARNINGS.some( ( w ) => text.includes( w ) );
			if ( ! isExpected ) errors.push( text );

		} );

		await page.goto( '/' );
		await page.waitForTimeout( 2000 );

		expect( errors ).toEqual( [] );

	} );

	test( 'loading overlay fades out on startup', async ( { page } ) => {

		await seedSettings( page );
		await page.goto( '/' );

		// The overlay should either have fade-out class or be removed.
		await expect( async () => {

			const overlay = page.locator( '#loading-overlay' );
			const count = await overlay.count();

			if ( count > 0 ) {

				await expect( overlay ).toHaveClass( /fade-out/ );

			}

		} ).toPass( { timeout: 10000 } );

	} );

} );

// ---------------------------------------------------------------------------
// Title page
// ---------------------------------------------------------------------------

test.describe( 'Title page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders with KART KIDS branding', async ( { page } ) => {

		await page.goto( '/' );

		// The title page has a .page-title root with an h1 containing "KART KIDS".
		const logo = page.locator( '.page-title__logo' );
		await expect( logo ).toBeVisible( { timeout: 10000 } );
		await expect( logo ).toHaveText( 'KART KIDS' );

	} );

	test( 'shows PRESS START button', async ( { page } ) => {

		await page.goto( '/' );

		const pressStart = page.locator( '.page-title__press-start' );
		await expect( pressStart ).toBeVisible( { timeout: 10000 } );
		await expect( pressStart ).toContainText( 'PRESS START' );

	} );

	test( 'shows utility rail buttons', async ( { page } ) => {

		await page.goto( '/' );

		const rail = page.locator( '.page-title__utility-rail' );
		await expect( rail ).toBeVisible( { timeout: 10000 } );

		const buttons = rail.locator( '.kk-cta-button' );
		await expect( buttons ).toHaveCount( 5 );

	} );

} );

// ---------------------------------------------------------------------------
// Home page navigation
// ---------------------------------------------------------------------------

test.describe( 'Home page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'navigating to #/home shows the home page', async ( { page } ) => {

		await page.goto( '/#/home' );

		const homePage = page.locator( '.page-home' );
		await expect( homePage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'TopNav shows nav links', async ( { page } ) => {

		await page.goto( '/#/home' );

		// Target the AppShell placeholder TopNav specifically (the home page
		// also renders its own .kk-top-nav inside the page container).
		const topNav = page.locator( '.kk-top-nav--placeholder' );
		await expect( topNav ).toBeVisible( { timeout: 10000 } );

		// AppShell placeholder TopNav has 4 items: PLAY MODES, GARAGE, CREATE, PROFILE
		const links = topNav.locator( '.kk-top-nav__link' );
		const count = await links.count();
		expect( count ).toBeGreaterThanOrEqual( 4 );

		// Verify key nav labels exist
		const navText = await topNav.innerText();
		expect( navText ).toContain( 'PLAY' );
		expect( navText ).toContain( 'GARAGE' );
		expect( navText ).toContain( 'CREATE' );
		expect( navText ).toContain( 'PROFILE' );

	} );

	test( 'clicking GARAGE nav link navigates to #/garage', async ( { page } ) => {

		await page.goto( '/#/home' );

		const topNav = page.locator( '.kk-top-nav--placeholder' );
		await expect( topNav ).toBeVisible( { timeout: 10000 } );

		const garageLink = topNav.locator( '.kk-top-nav__link', { has: page.locator( 'text=GARAGE' ) } );
		await garageLink.click();

		await expect( page ).toHaveURL( /.*#\/garage/ );
		const garagePage = page.locator( '.page-garage' );
		await expect( garagePage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'clicking PROFILE nav link navigates to #/profile', async ( { page } ) => {

		await page.goto( '/#/home' );

		const topNav = page.locator( '.kk-top-nav--placeholder' );
		await expect( topNav ).toBeVisible( { timeout: 10000 } );

		const profileLink = topNav.locator( '.kk-top-nav__link', { has: page.locator( 'text=PROFILE' ) } );
		await profileLink.click();

		await expect( page ).toHaveURL( /.*#\/profile/ );
		const profilePage = page.locator( '.page-profile' );
		await expect( profilePage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'clicking CREATE nav link navigates to #/create', async ( { page } ) => {

		await page.goto( '/#/home' );

		const topNav = page.locator( '.kk-top-nav--placeholder' );
		await expect( topNav ).toBeVisible( { timeout: 10000 } );

		const createLink = topNav.locator( '.kk-top-nav__link', { has: page.locator( 'text=CREATE' ) } );
		await createLink.click();

		await expect( page ).toHaveURL( /.*#\/create/ );

	} );

	test( 'shows QUICK PLAY CTA button', async ( { page } ) => {

		await page.goto( '/#/home' );

		const quickPlay = page.locator( '.page-home__quick-play' );
		await expect( quickPlay ).toBeVisible( { timeout: 10000 } );
		await expect( quickPlay ).toContainText( 'QUICK PLAY' );

	} );

	test( 'nav rail shows navigation options', async ( { page } ) => {

		await page.goto( '/#/home' );

		const rail = page.locator( '.page-home__nav-rail' );
		await expect( rail ).toBeVisible( { timeout: 10000 } );

		// Rail should have items: PLAY MODES, PARTY, GARAGE, CREATE, PROFILE, SHOP, SETTINGS
		const railBtns = rail.locator( '.kk-cta-button' );
		const count = await railBtns.count();
		expect( count ).toBeGreaterThanOrEqual( 5 );

	} );

} );

// ---------------------------------------------------------------------------
// Cut routes fallback
// ---------------------------------------------------------------------------

test.describe( 'Cut routes fallback', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( '#/party redirects to fallback (title)', async ( { page } ) => {

		await page.goto( '/#/party' );

		// Cut routes are not registered, so RouterService redirects to fallback '/'.
		// The page should show either the title page or home page.
		await page.waitForTimeout( 2000 );

		const url = page.url();
		// Should have been redirected away from /party
		expect( url ).not.toContain( '#/party' );

	} );

	test( '#/events redirects to fallback', async ( { page } ) => {

		await page.goto( '/#/events' );
		await page.waitForTimeout( 2000 );

		const url = page.url();
		expect( url ).not.toContain( '#/events' );

	} );

	test( '#/ranked redirects to fallback', async ( { page } ) => {

		await page.goto( '/#/ranked' );
		await page.waitForTimeout( 2000 );

		const url = page.url();
		expect( url ).not.toContain( '#/ranked' );

	} );

} );

// ---------------------------------------------------------------------------
// Back navigation
// ---------------------------------------------------------------------------

test.describe( 'Back navigation', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'browser back button returns to previous page', async ( { page } ) => {

		// Navigate: title -> home -> garage, then press back.
		await page.goto( '/' );
		await page.locator( '.page-title' ).waitFor( { timeout: 10000 } );

		await page.goto( '/#/home' );
		await page.locator( '.page-home' ).waitFor( { timeout: 10000 } );

		await page.goto( '/#/garage' );
		await page.locator( '.page-garage' ).waitFor( { timeout: 10000 } );

		await page.goBack();

		// Should return to home
		await expect( page ).toHaveURL( /.*#\/home/ );
		await expect( page.locator( '.page-home' ) ).toBeVisible( { timeout: 10000 } );

	} );

} );
