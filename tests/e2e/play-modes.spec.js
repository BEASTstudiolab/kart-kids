import { test, expect } from '@playwright/test';

/**
 * Seed localStorage so the first-run name modal is skipped and the app lands
 * on the returning-player shell flow.
 */
async function seedSettings( page ) {

	await page.addInitScript( () => {

		localStorage.setItem( 'kart-kids-settings', JSON.stringify( {
			_version: 4,
			quality: 'low',
			profile: { displayName: 'TestPlayer' },
			loadout: {
				selectedKartId: 'kart-1',
				selectedTrackId: 'starter-circuit',
			},
			stats: {
				totalRaces: 0,
				wins: 0,
				bestTimes: {},
			},
		} ) );

	} );

}

async function gotoPlayTab( page ) {

	await seedSettings( page );
	await page.goto( '/#/play' );

	const playTab = page.getByRole( 'tab', { name: 'PLAY' } );
	const playPanel = page.getByRole( 'tabpanel', { name: 'PLAY' } );

	await expect( playTab ).toHaveAttribute( 'aria-selected', 'true' );
	await expect( playPanel ).toBeVisible( { timeout: 10000 } );

	return { playTab, playPanel };

}

test.describe( 'Play shell', () => {

	test( 'shows the current play-mode controls in the PLAY tab', async ( { page } ) => {

		const { playPanel } = await gotoPlayTab( page );

		await expect( playPanel.getByRole( 'button', { name: 'RACE' } ) ).toBeVisible();
		await expect( playPanel.getByRole( 'button', { name: 'FREE PLAY' } ) ).toBeVisible();
		await expect( playPanel.getByRole( 'button', { name: 'PARTY' } ) ).toBeVisible();

	} );

	test( 'FREE PLAY opens and closes the track-select overlay', async ( { page } ) => {

		const { playPanel } = await gotoPlayTab( page );

		await playPanel.getByRole( 'button', { name: 'FREE PLAY' } ).click();

		const trackOverlay = page.locator( '.kk-track-select' );
		await expect( trackOverlay ).toBeVisible( { timeout: 10000 } );
		await expect( trackOverlay.getByText( 'SELECT TRACK' ) ).toBeVisible();
		await expect( trackOverlay.getByRole( 'button', { name: 'BACK' } ) ).toBeVisible();
		await expect( trackOverlay.getByRole( 'button', { name: 'GO!' } ) ).toBeVisible();

		await trackOverlay.getByRole( 'button', { name: 'BACK' } ).click();
		await expect( trackOverlay ).toBeHidden( { timeout: 10000 } );

	} );

	test( 'PARTY opens the private lobby overlay with a room code', async ( { page } ) => {

		const { playPanel } = await gotoPlayTab( page );

		await playPanel.getByRole( 'button', { name: 'PARTY' } ).click();

		const trackOverlay = page.locator( '.kk-track-select' );
		await expect( trackOverlay ).toBeVisible( { timeout: 10000 } );
		await trackOverlay.getByRole( 'button', { name: 'GO!' } ).click();

		const lobby = page.getByRole( 'region', { name: 'Private lobby' } );
		await expect( lobby ).toBeVisible( { timeout: 10000 } );
		await expect( lobby ).toContainText( 'PRIVATE LOBBY' );
		await expect( lobby ).toContainText( 'Room Code' );
		await expect( lobby ).toContainText( 'TestPlayer' );
		await expect( lobby.getByRole( 'button', { name: 'START' } ) ).toBeVisible();
		await expect( lobby.getByRole( 'button', { name: 'CANCEL' } ) ).toBeVisible();
		await expect( lobby.locator( '.kk-lobby-overlay__code-value' ) ).not.toHaveText( '----', { timeout: 10000 } );

		await lobby.getByRole( 'button', { name: 'CANCEL' } ).click();
		await expect( lobby ).toBeHidden( { timeout: 10000 } );

	} );

} );
