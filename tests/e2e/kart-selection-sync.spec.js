import { test, expect } from '@playwright/test';

async function seedSettings( page ) {

	await page.addInitScript( () => {

		localStorage.setItem( 'kart-kids-settings', JSON.stringify( {
			_version: 7,
			quality: 'low',
			vehicleColor: '#ff6600',
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

test( 'garage kart selection keeps vehicleModel synced without clearing paint', async ( { page } ) => {

	await seedSettings( page );
	await page.goto( '/' );

	const garageTab = page.getByRole( 'tab', { name: 'GARAGE' } );
	await expect( garageTab ).toBeVisible( { timeout: 15000 } );
	await garageTab.click();

	const garage = page.locator( '.kk-garage' );
	await expect( garage ).toBeVisible( { timeout: 15000 } );

	const kartCards = page.locator( '.kk-garage__kart-card' );
	await expect( kartCards.nth( 1 ) ).toBeVisible();

	const selectedKartId = await kartCards.nth( 1 ).getAttribute( 'data-kart-id' );
	expect( selectedKartId ).toBeTruthy();

	await kartCards.nth( 1 ).evaluate( ( card ) => card.click() );

	await expect.poll( async () => page.evaluate( () => {

		const raw = localStorage.getItem( 'kart-kids-settings' );
		return raw ? JSON.parse( raw ) : null;

	} ) ).toMatchObject( {
		loadout: {
			selectedKartId,
			selectedTrackId: 'starter-circuit',
		},
		vehicleModel: selectedKartId,
		vehicleColor: '#ff6600',
	} );

} );
