import { test, expect } from '@playwright/test';

/**
 * First-run name entry E2E tests.
 *
 * Tests the NameEntryModal that appears on first launch when no display name
 * is saved in localStorage. The modal is non-dismissible and requires a name
 * and avatar color selection before proceeding.
 *
 * DOM structure of the modal:
 *   .kk-modal (via ModalService)
 *     .kk-name-entry
 *       .kk-name-entry__input
 *       .kk-name-entry__error
 *       .kk-name-entry__avatar-options[role="radiogroup"]
 *         .kk-name-entry__avatar-option[role="radio"]
 *     footer
 *       [data-action="name-entry-confirm"]
 */

// ---------------------------------------------------------------------------
// First-run modal
// ---------------------------------------------------------------------------

test.describe( 'First-run name entry', () => {

	test( 'shows name entry modal when localStorage is empty', async ( { page } ) => {

		// Clear localStorage before navigating
		await page.addInitScript( () => {

			localStorage.clear();

		} );

		await page.goto( '/' );

		// The NameEntryModal should appear with "Welcome to Kart Kids!" title.
		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Should show welcome title
		await expect( modal ).toContainText( 'Welcome to Kart Kids' );

	} );

	test( 'shows name input field and avatar options', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Name input
		const nameInput = modal.locator( '.kk-name-entry__input' );
		await expect( nameInput ).toBeVisible();

		// Avatar options (radiogroup with 3 color choices: red, blue, green)
		const avatarGroup = modal.locator( '[role="radiogroup"]' );
		await expect( avatarGroup ).toBeVisible();

		const avatarOptions = modal.locator( '.kk-name-entry__avatar-option' );
		await expect( avatarOptions ).toHaveCount( 3 );

	} );

	test( 'cannot proceed without entering a name', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Click confirm without entering a name
		const confirmBtn = modal.locator( '[data-action="name-entry-confirm"]' );
		await confirmBtn.click();

		// Error message should appear
		const error = modal.locator( '.kk-name-entry__error' );
		await expect( error ).toBeVisible( { timeout: 3000 } );
		await expect( error ).toContainText( 'Please enter a display name' );

		// Modal should still be visible (not dismissed)
		await expect( modal ).toBeVisible();

	} );

	test( 'entering name and picking avatar closes the modal', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Enter a display name
		const nameInput = modal.locator( '.kk-name-entry__input' );
		await nameInput.fill( 'RacerX' );

		// Pick an avatar color (click the first option)
		const avatarOptions = modal.locator( '.kk-name-entry__avatar-option' );
		await avatarOptions.first().click();

		// Click confirm
		const confirmBtn = modal.locator( '[data-action="name-entry-confirm"]' );
		await confirmBtn.click();

		// Modal should close
		await expect( modal ).toBeHidden( { timeout: 5000 } );

	} );

	test( 'name persists in localStorage after entry', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Enter name and confirm
		const nameInput = modal.locator( '.kk-name-entry__input' );
		await nameInput.fill( 'PersistTest' );

		const avatarOptions = modal.locator( '.kk-name-entry__avatar-option' );
		await avatarOptions.first().click();

		const confirmBtn = modal.locator( '[data-action="name-entry-confirm"]' );
		await confirmBtn.click();

		await expect( modal ).toBeHidden( { timeout: 5000 } );

		// Check localStorage
		const stored = await page.evaluate( () => {

			return localStorage.getItem( 'kart-kids-settings' );

		} );

		expect( stored ).toBeTruthy();

		const parsed = JSON.parse( stored );
		expect( parsed.profile.displayName ).toBe( 'PersistTest' );

	} );

	test( 'avatar choice persists in localStorage', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Enter name
		const nameInput = modal.locator( '.kk-name-entry__input' );
		await nameInput.fill( 'AvatarTest' );

		// Pick the second avatar option (blue).
		// Use dispatchEvent to bypass the hero preview panel that can
		// intercept pointer events while the modal overlay animates in.
		const avatarOptions = modal.locator( '.kk-name-entry__avatar-option' );
		await avatarOptions.nth( 1 ).dispatchEvent( 'click' );

		const confirmBtn = modal.locator( '[data-action="name-entry-confirm"]' );
		await confirmBtn.dispatchEvent( 'click' );

		await expect( modal ).toBeHidden( { timeout: 5000 } );

		// Check localStorage for avatar choice
		const stored = await page.evaluate( () => {

			return localStorage.getItem( 'kart-kids-settings' );

		} );

		const parsed = JSON.parse( stored );
		expect( parsed.profile.avatarChoice ).toBe( 'blue' );

	} );

	test( 'subsequent visits skip the modal when name exists', async ( { page } ) => {

		// Seed settings with a name already set
		await page.addInitScript( () => {

			const settings = {
				profile: { displayName: 'ReturningPlayer', avatarChoice: 'green' },
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

		// The modal should NOT appear
		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeHidden( { timeout: 3000 } );

	} );

	test( 'Enter key on input submits the form', async ( { page } ) => {

		await page.addInitScript( () => localStorage.clear() );
		await page.goto( '/' );

		const modal = page.locator( '.kk-modal' );
		await expect( modal ).toBeVisible( { timeout: 15000 } );

		// Enter a name and press Enter
		const nameInput = modal.locator( '.kk-name-entry__input' );
		await nameInput.fill( 'EnterKeyTest' );

		// Pick an avatar
		const avatarOptions = modal.locator( '.kk-name-entry__avatar-option' );
		await avatarOptions.first().click();

		// Press Enter on the input
		await nameInput.press( 'Enter' );

		// Modal should close
		await expect( modal ).toBeHidden( { timeout: 5000 } );

		// Name should be saved
		const stored = await page.evaluate( () => {

			return JSON.parse( localStorage.getItem( 'kart-kids-settings' ) );

		} );

		expect( stored.profile.displayName ).toBe( 'EnterKeyTest' );

	} );

} );
