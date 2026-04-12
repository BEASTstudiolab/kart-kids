import { test, expect } from '@playwright/test';

/**
 * First-run onboarding E2E tests.
 *
 * Tests the onboarding splash page that appears on first launch when no
 * display name is saved in localStorage. The page is full-screen and requires
 * a name before proceeding.
 *
 * DOM structure:
 *   div.kk-onboarding
 *     div.kk-onboarding__card
 *       h1.kk-onboarding__title
 *       p.kk-onboarding__subtitle
 *       div.kk-onboarding__field
 *         input.kk-onboarding__input
 *         span.kk-onboarding__error
 *       button.kk-onboarding__btn
 */

// ---------------------------------------------------------------------------
// First-run onboarding
// ---------------------------------------------------------------------------

test.describe( 'First-run onboarding', () => {

	test( 'shows onboarding page when localStorage is empty', async ( { page } ) => {

		await page.addInitScript( () => {

			localStorage.clear();

		} );

		await page.goto( '/' );

		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeVisible( { timeout: 15000 } );

		await expect( onboarding ).toContainText( 'KART KIDS' );
		await expect( onboarding ).toContainText( 'Enter your name' );

	} );

	test( 'shows name input field', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeVisible( { timeout: 15000 } );

		const nameInput = onboarding.locator( '.kk-onboarding__input' );
		await expect( nameInput ).toBeVisible();

	} );

	test( 'cannot proceed without entering a name', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeVisible( { timeout: 15000 } );

		// Click confirm without entering a name
		const confirmBtn = onboarding.locator( '.kk-onboarding__btn' );
		await confirmBtn.click();

		// Error message should appear
		const error = onboarding.locator( '.kk-onboarding__error' );
		await expect( error ).toBeVisible( { timeout: 3000 } );
		await expect( error ).toContainText( 'Please enter a display name' );

		// Onboarding should still be visible
		await expect( onboarding ).toBeVisible();

	} );

	test( 'entering name and confirming closes the onboarding', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeVisible( { timeout: 15000 } );

		const nameInput = onboarding.locator( '.kk-onboarding__input' );
		await nameInput.fill( 'RacerX' );

		const confirmBtn = onboarding.locator( '.kk-onboarding__btn' );
		await confirmBtn.click();

		// Onboarding should fade out and be removed
		await expect( onboarding ).toBeHidden( { timeout: 5000 } );

	} );

	test( 'name persists in localStorage after entry', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeVisible( { timeout: 15000 } );

		const nameInput = onboarding.locator( '.kk-onboarding__input' );
		await nameInput.fill( 'PersistTest' );

		const confirmBtn = onboarding.locator( '.kk-onboarding__btn' );
		await confirmBtn.click();

		await expect( onboarding ).toBeHidden( { timeout: 5000 } );

		// Check localStorage
		const stored = await page.evaluate( () => {

			return localStorage.getItem( 'kart-kids-settings' );

		} );

		expect( stored ).toBeTruthy();

		const parsed = JSON.parse( stored );
		expect( parsed.profile.displayName ).toBe( 'PersistTest' );

	} );

	test( 'subsequent visits skip the onboarding when name exists', async ( { page } ) => {

		await page.addInitScript( () => {

			const settings = {
				profile: { displayName: 'ReturningPlayer' },
				gameplay: {},
				controls: {},
				audio: {},
				video: {},
			};
			localStorage.setItem( 'kart-kids-settings', JSON.stringify( settings ) );

		} );

		await page.goto( '/' );

		// Wait for the page to load
		const titlePage = page.locator( '.page-title' );
		await expect( titlePage ).toBeVisible( { timeout: 10000 } );

		// The onboarding should NOT appear
		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeHidden( { timeout: 3000 } );

	} );

	test( 'Enter key on input submits the form', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const onboarding = page.locator( '.kk-onboarding' );
		await expect( onboarding ).toBeVisible( { timeout: 15000 } );

		const nameInput = onboarding.locator( '.kk-onboarding__input' );
		await nameInput.fill( 'EnterKeyTest' );

		await nameInput.press( 'Enter' );

		// Onboarding should close
		await expect( onboarding ).toBeHidden( { timeout: 5000 } );

		// Name should be saved
		const stored = await page.evaluate( () => {

			return JSON.parse( localStorage.getItem( 'kart-kids-settings' ) );

		} );

		expect( stored.profile.displayName ).toBe( 'EnterKeyTest' );

	} );

} );
