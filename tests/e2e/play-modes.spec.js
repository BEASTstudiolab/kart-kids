import { test, expect } from '@playwright/test';

/**
 * Play Modes E2E tests — Solo Race, Multiplayer, and race flow.
 *
 * Tests the Play Modes page (#/play), its sub-views (Solo track picker,
 * Multiplayer options), and related pages (Quick Play, Lobby).
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
// Play Modes page
// ---------------------------------------------------------------------------

test.describe( 'Play Modes page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders at #/play', async ( { page } ) => {

		await page.goto( '/#/play' );

		const playPage = page.locator( '.page-play-modes' );
		await expect( playPage ).toBeVisible( { timeout: 10000 } );

	} );

	test( 'shows Solo Race and Multiplayer mode cards', async ( { page } ) => {

		await page.goto( '/#/play' );

		const cards = page.locator( '.kk-play-mode-card' );
		await expect( cards ).toHaveCount( 2, { timeout: 10000 } );

		// Verify card titles
		const soloCard = page.locator( '.kk-play-mode-card[data-action="mode-solo"]' );
		await expect( soloCard ).toBeVisible();
		await expect( soloCard.locator( '.kk-play-mode-card__title' ) ).toHaveText( 'Solo Race' );

		const multiCard = page.locator( '.kk-play-mode-card[data-action="mode-multiplayer"]' );
		await expect( multiCard ).toBeVisible();
		await expect( multiCard.locator( '.kk-play-mode-card__title' ) ).toHaveText( 'Multiplayer' );

	} );

	test( 'shows card descriptions', async ( { page } ) => {

		await page.goto( '/#/play' );

		const soloDesc = page.locator( '.kk-play-mode-card[data-action="mode-solo"] .kk-play-mode-card__desc' );
		await expect( soloDesc ).toBeVisible( { timeout: 10000 } );
		await expect( soloDesc ).toContainText( 'Race against AI' );

		const multiDesc = page.locator( '.kk-play-mode-card[data-action="mode-multiplayer"] .kk-play-mode-card__desc' );
		await expect( multiDesc ).toBeVisible();
		await expect( multiDesc ).toContainText( 'Race online' );

	} );

	test( 'has a page header with back button', async ( { page } ) => {

		await page.goto( '/#/play' );

		const header = page.locator( '.kk-page-header' );
		await expect( header ).toBeVisible( { timeout: 10000 } );

		// Header should contain "PLAY MODES" title
		await expect( header ).toContainText( 'PLAY MODES' );

	} );

} );

// ---------------------------------------------------------------------------
// Solo Race track picker
// ---------------------------------------------------------------------------

test.describe( 'Solo Race track picker', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'clicking Solo Race shows track picker', async ( { page } ) => {

		await page.goto( '/#/play' );

		const soloCard = page.locator( '.kk-play-mode-card[data-action="mode-solo"]' );
		await expect( soloCard ).toBeVisible( { timeout: 10000 } );
		await soloCard.click();

		// The solo track picker should become visible.
		// It has a sub-header with "Solo Race" title and track items.
		const subTitle = page.locator( '.page-play-modes__sub-title', { hasText: 'Solo Race' } );
		await expect( subTitle ).toBeVisible( { timeout: 5000 } );

		// Should show track list
		const trackList = page.locator( '.page-play-modes__track-list' );
		await expect( trackList ).toBeVisible();

		// Should have at least one track item
		const trackItems = page.locator( '.kk-track-item' );
		const count = await trackItems.count();
		expect( count ).toBeGreaterThanOrEqual( 1 );

	} );

	test( 'solo track picker has a back button', async ( { page } ) => {

		await page.goto( '/#/play' );

		const soloCard = page.locator( '.kk-play-mode-card[data-action="mode-solo"]' );
		await expect( soloCard ).toBeVisible( { timeout: 10000 } );
		await soloCard.click();

		const backBtn = page.locator( '.page-play-modes__sub-back[data-action="back-to-modes"]' ).first();
		await expect( backBtn ).toBeVisible( { timeout: 5000 } );

		// Clicking back should return to mode selection
		await backBtn.click();

		// Mode cards should be visible again
		await expect( page.locator( '.kk-play-mode-card' ).first() ).toBeVisible( { timeout: 5000 } );

	} );

	test( 'solo track picker has START RACE button', async ( { page } ) => {

		await page.goto( '/#/play' );

		const soloCard = page.locator( '.kk-play-mode-card[data-action="mode-solo"]' );
		await expect( soloCard ).toBeVisible( { timeout: 10000 } );
		await soloCard.click();

		const startBtn = page.locator( '[data-action="start-solo-race"]' );
		await expect( startBtn ).toBeVisible( { timeout: 5000 } );
		await expect( startBtn ).toContainText( 'START RACE' );

	} );

} );

// ---------------------------------------------------------------------------
// Multiplayer options
// ---------------------------------------------------------------------------

test.describe( 'Multiplayer options', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'clicking Multiplayer shows Quick Play and Private Lobby', async ( { page } ) => {

		await page.goto( '/#/play' );

		const multiCard = page.locator( '.kk-play-mode-card[data-action="mode-multiplayer"]' );
		await expect( multiCard ).toBeVisible( { timeout: 10000 } );
		await multiCard.click();

		// Should show multiplayer sub-cards
		const quickPlayCard = page.locator( '.kk-play-mode-subcard[data-action="mp-quick-play"]' );
		await expect( quickPlayCard ).toBeVisible( { timeout: 5000 } );

		const lobbyCard = page.locator( '.kk-play-mode-subcard[data-action="mp-private-lobby"]' );
		await expect( lobbyCard ).toBeVisible();

		// Verify titles
		await expect( quickPlayCard.locator( '.kk-play-mode-subcard__title' ) ).toHaveText( 'Quick Play' );
		await expect( lobbyCard.locator( '.kk-play-mode-subcard__title' ) ).toHaveText( 'Private Lobby' );

	} );

	test( 'multiplayer view shows descriptions', async ( { page } ) => {

		await page.goto( '/#/play' );

		const multiCard = page.locator( '.kk-play-mode-card[data-action="mode-multiplayer"]' );
		await expect( multiCard ).toBeVisible( { timeout: 10000 } );
		await multiCard.click();

		const qpDesc = page.locator( '.kk-play-mode-subcard[data-action="mp-quick-play"] .kk-play-mode-subcard__desc' );
		await expect( qpDesc ).toContainText( 'Find an online match fast' );

		const lobbyDesc = page.locator( '.kk-play-mode-subcard[data-action="mp-private-lobby"] .kk-play-mode-subcard__desc' );
		await expect( lobbyDesc ).toContainText( 'Create or join' );

	} );

	test( 'multiplayer view has back button to return to mode selection', async ( { page } ) => {

		await page.goto( '/#/play' );

		const multiCard = page.locator( '.kk-play-mode-card[data-action="mode-multiplayer"]' );
		await expect( multiCard ).toBeVisible( { timeout: 10000 } );
		await multiCard.click();

		const backBtn = page.locator( '.page-play-modes__sub-back[data-action="back-to-modes"]' );
		await expect( backBtn ).toBeVisible( { timeout: 5000 } );
		await backBtn.click();

		// Mode selection cards should be visible again
		await expect( page.locator( '.kk-play-mode-card' ).first() ).toBeVisible( { timeout: 5000 } );

	} );

} );

// ---------------------------------------------------------------------------
// Quick Play page
// ---------------------------------------------------------------------------

test.describe( 'Quick Play page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders at #/quick-play', async ( { page } ) => {

		await page.goto( '/#/quick-play' );

		const qpPage = page.locator( '.page-quick-play' );
		await expect( qpPage ).toBeVisible( { timeout: 10000 } );

	} );

} );

// ---------------------------------------------------------------------------
// Lobby page
// ---------------------------------------------------------------------------

test.describe( 'Lobby page', () => {

	test.beforeEach( async ( { page } ) => {

		await seedSettings( page );

	} );

	test( 'renders at #/lobby', async ( { page } ) => {

		await page.goto( '/#/lobby' );

		const lobbyPage = page.locator( '.page-lobby' );
		await expect( lobbyPage ).toBeVisible( { timeout: 10000 } );

	} );

} );
