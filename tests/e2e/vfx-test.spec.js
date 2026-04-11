import { test, expect } from '@playwright/test';

const EFFECT_IDS = [
	'explosion',
	'bomb-detonation',
	'crash-burst',
	'impact-starburst',
	'lightning-arc',
	'electric-surge',
	'slime-splash',
	'slime-ooze',
	'smoke-plume',
	'dust-kickup',
	'drift-sparks',
	'wall-sparks',
];

test.describe( 'VFX test page', () => {

	test.beforeEach( async ( { page } ) => {

		await page.addInitScript( () => {

			window.__copiedText = null;
			Object.defineProperty( navigator, 'clipboard', {
				configurable: true,
				value: {
					writeText( text ) {

						window.__copiedText = text;
						return Promise.resolve();

					},
				},
			} );

		} );

	} );

	test( 'renders a large single-effect stage with all 12 effect selectors', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		await expect( page.locator( '[data-testid="vfx-page-title"]' ) ).toHaveText( 'VFX TEST RANGE' );
		await expect( page.locator( '[data-testid="vfx-stage"]' ) ).toBeVisible();
		await expect( page.locator( '[data-testid="vfx-stage-canvas"]' ) ).toBeVisible();
		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Explosion' );

		const selectors = page.locator( '[data-testid="vfx-effect-tab"]' );
		await expect( selectors ).toHaveCount( EFFECT_IDS.length );

		for ( const effectId of EFFECT_IDS ) {

			await expect( page.locator( `[data-effect-tab="${ effectId }"]` ) ).toBeVisible();

		}

	} );

	test( 'cycles to another effect and swaps the control set', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'explosion' );
		await expect( page.locator( '[data-control-input="sparkCount"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="branching"]' ) ).toHaveCount( 0 );

		await page.locator( '[data-action="next-effect"]' ).click();

		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'bomb-detonation' );

		await page.locator( '[data-effect-tab="lightning-arc"]' ).click();

		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Lightning Arc' );
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'lightning-arc' );
		await expect( page.locator( '[data-control-input="branching"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="sparkCount"]' ) ).toHaveCount( 0 );

	} );

	test( 'updates the active slider value readout immediately', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		const value = page.locator( '[data-control-value="intensity"]' );
		await expect( value ).toHaveText( '1.00' );

		await page.locator( '[data-control-input="intensity"]' ).evaluate( ( element ) => {

			element.value = '1.35';
			element.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		} );

		await expect( value ).toHaveText( '1.35' );

	} );

	test( 'replays the active effect and copies active-effect JSON', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );
		await page.locator( '[data-effect-tab="lightning-arc"]' ).click();

		await page.locator( '[data-control-input="branching"]' ).evaluate( ( element ) => {

			element.value = '0.72';
			element.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		} );

		await expect( page.locator( '[data-action="replay"]' ) ).toBeVisible();
		await page.locator( '[data-action="replay"]' ).click();
		await page.locator( '[data-action="copy-json"]' ).click();

		const copied = await page.evaluate( () => window.__copiedText );
		const parsed = JSON.parse( copied );
		expect( parsed.version ).toBe( 1 );
		expect( parsed.effectId ).toBe( 'lightning-arc' );
		expect( parsed.params.branching ).toBe( 0.72 );

		await expect( page.locator( '[data-action="copy-json"]' ) ).toHaveText( 'COPIED!' );

	} );

	test( 'stacks the stage and control panel cleanly on narrow screens', async ( { page } ) => {

		await page.setViewportSize( { width: 480, height: 1200 } );
		await page.goto( '/vfx-test.html' );

		const stage = page.locator( '[data-testid="vfx-stage-shell"]' );
		const controls = page.locator( '[data-testid="vfx-controls-panel"]' );
		const stageBox = await stage.boundingBox();
		const controlsBox = await controls.boundingBox();

		expect( stageBox ).toBeTruthy();
		expect( controlsBox ).toBeTruthy();
		expect( Math.abs( stageBox.x - controlsBox.x ) ).toBeLessThan( 8 );
		expect( controlsBox.y ).toBeGreaterThan( stageBox.y + stageBox.height - 4 );
		await expect( page.locator( '[data-control-input="intensity"]' ) ).toBeVisible();
		await expect( page.locator( '[data-action="next-effect"]' ) ).toBeVisible();

	} );

} );
