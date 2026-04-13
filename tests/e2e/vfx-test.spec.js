import { test, expect } from '@playwright/test';

const VFX_EFFECT_IDS = [
	'mine',
	'bomb',
	'missileStrike',
	'pulseShockwave',
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
	'toy-rocket-missile',
];

const SHADER_IDS = [
	'blast-core',
	'bomb-flash',
	'energy-wave',
	'plasma-orb',
	'lightning-field',
	'burn-scorch',
	'fireball-trail',
	'molten-lava',
	'lava-rim',
	'heat-haze',
	'frost-bloom',
	'ice-sheet',
	'snow-burst',
	'slime-surface',
	'shield-shell',
	'smoke-ember',
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

	test( 'defaults to the VFX library and renders all 13 VFX selectors', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		await expect( page.locator( '[data-testid="vfx-page-title"]' ) ).toHaveText( 'VFX TEST RANGE' );
		await expect( page.locator( '[data-library-tab="vfx"]' ) ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( page.locator( '[data-library-tab="shader"]' ) ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( page.locator( '[data-testid="vfx-stage"]' ) ).toBeVisible();
		await expect( page.locator( '[data-testid="vfx-stage-canvas"]' ) ).toBeVisible();
		await expect( page.locator( '[data-testid="vfx-shader-stage-canvas"]' ) ).not.toBeVisible();
		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Mine Burst' );
		await expect( page.locator( '[data-testid="vfx-library-count"]' ) ).toHaveText( '15 live effects' );
		await expect( page.locator( '[data-testid="vfx-stage-renderer-label"]' ) ).toHaveText( 'Canvas FX' );

		const selectors = page.locator( '[data-testid="vfx-effect-tab"]' );
		await expect( selectors ).toHaveCount( VFX_EFFECT_IDS.length );

		for ( const effectId of VFX_EFFECT_IDS ) {

			await expect( page.locator( `[data-effect-tab="${ effectId }"]` ) ).toBeVisible();

		}

	} );

	test( 'switches to SHADERS and renders the 16 shader selectors in the shared layout', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );
		await page.locator( '[data-library-tab="shader"]' ).click();

		await expect( page.locator( '[data-library-tab="shader"]' ) ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( page.locator( '[data-library-tab="vfx"]' ) ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( page.locator( '[data-testid="vfx-stage-canvas"]' ) ).not.toBeVisible();
		await expect( page.locator( '[data-testid="vfx-shader-stage-canvas"]' ) ).toBeVisible();
		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Blast Core' );
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'blast-core' );
		await expect( page.locator( '[data-testid="vfx-library-count"]' ) ).toHaveText( '16 live shaders' );
		await expect( page.locator( '[data-testid="vfx-stage-renderer-label"]' ) ).toHaveText( 'WebGL Shader' );
		await expect( page.locator( '[data-testid="vfx-controls-count"]' ) ).toHaveText( '7 sliders' );

		const selectors = page.locator( '[data-testid="vfx-effect-tab"]' );
		await expect( selectors ).toHaveCount( SHADER_IDS.length );

		for ( const effectId of SHADER_IDS ) {

			await expect( page.locator( `[data-effect-tab="${ effectId }"]` ) ).toBeVisible();

		}

	} );

	test( 'cycles to another effect and swaps the control set', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'mine' );
		await expect( page.locator( '[data-control-input="sparkCount"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="branching"]' ) ).toHaveCount( 0 );

		await page.locator( '[data-action="next-effect"]' ).click();

		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'bomb' );

		await page.locator( '[data-effect-tab="lightning-arc"]' ).click();

		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Lightning Arc' );
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'lightning-arc' );
		await expect( page.locator( '[data-control-input="branching"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="sparkCount"]' ) ).toHaveCount( 0 );

		await page.locator( '[data-effect-tab="toy-rocket-missile"]' ).click();

		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Toy Rocket Missile' );
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'toy-rocket-missile' );
		await expect( page.locator( '[data-control-input="spin"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="trailDensity"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="haloFrequency"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="branching"]' ) ).toHaveCount( 0 );

	} );

	test( 'cycles within the active library and restores the remembered sample for each tab', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );
		await page.locator( '[data-effect-tab="toy-rocket-missile"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'toy-rocket-missile' );

		await page.locator( '[data-library-tab="shader"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'blast-core' );

		await page.locator( '[data-effect-tab="molten-lava"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'molten-lava' );

		await page.locator( '[data-action="next-effect"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'lava-rim' );

		await page.locator( '[data-library-tab="vfx"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'toy-rocket-missile' );

		await page.locator( '[data-library-tab="shader"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'lava-rim' );

		await page.locator( '[data-action="previous-effect"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'molten-lava' );

	} );

	test( 'updates the active slider value readout immediately', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		const value = page.locator( '[data-control-value="intensity"]' );
		await expect( value ).toHaveText( '0.86' );

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
		expect( parsed.library ).toBe( 'vfx' );
		expect( parsed.effectId ).toBe( 'lightning-arc' );
		expect( parsed.params.branching ).toBe( 0.72 );

		await expect( page.locator( '[data-action="copy-json"]' ) ).toHaveText( 'COPIED!' );

	} );

	test( 'copies projectile-specific slider values in active-effect JSON', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );
		await page.locator( '[data-effect-tab="toy-rocket-missile"]' ).click();

		await page.locator( '[data-control-input="haloFrequency"]' ).evaluate( ( element ) => {

			element.value = '1.04';
			element.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		} );

		await page.locator( '[data-action="copy-json"]' ).click();

		const copied = await page.evaluate( () => window.__copiedText );
		const parsed = JSON.parse( copied );
		expect( parsed.version ).toBe( 1 );
		expect( parsed.library ).toBe( 'vfx' );
		expect( parsed.effectId ).toBe( 'toy-rocket-missile' );
		expect( parsed.params.haloFrequency ).toBe( 1.04 );

	} );

	test( 'surfaces the four explosion presets in the VFX library', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );

		for ( const effectId of [ 'mine', 'bomb', 'missileStrike', 'pulseShockwave' ] ) {

			await expect( page.locator( `[data-effect-tab="${ effectId }"]` ) ).toBeVisible();

		}

		await page.locator( '[data-effect-tab="pulseShockwave"]' ).click();
		await expect( page.locator( '[data-testid="vfx-active-effect-name"]' ) ).toHaveText( 'Pulse Shockwave' );
		await expect( page.locator( '[data-testid="vfx-active-effect-id"]' ) ).toHaveText( 'pulseShockwave' );

	} );

	test( 'swaps shader-family controls and copies shader JSON with the shader library marker', async ( { page } ) => {

		await page.goto( '/vfx-test.html' );
		await page.locator( '[data-library-tab="shader"]' ).click();

		await page.locator( '[data-effect-tab="energy-wave"]' ).click();
		await expect( page.locator( '[data-control-input="pulse"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="rippleDensity"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="flow"]' ) ).toHaveCount( 0 );

		await page.locator( '[data-effect-tab="molten-lava"]' ).click();
		await expect( page.locator( '[data-control-input="flow"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="viscosity"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="pulse"]' ) ).toHaveCount( 0 );

		await page.locator( '[data-control-input="flow"]' ).evaluate( ( element ) => {

			element.value = '1.18';
			element.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		} );

		await page.locator( '[data-action="replay"]' ).click();
		await page.locator( '[data-action="copy-json"]' ).click();

		const copied = await page.evaluate( () => window.__copiedText );
		const parsed = JSON.parse( copied );
		expect( parsed.version ).toBe( 1 );
		expect( parsed.library ).toBe( 'shader' );
		expect( parsed.effectId ).toBe( 'molten-lava' );
		expect( parsed.params.flow ).toBe( 1.18 );

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
		await expect( page.locator( '[data-library-tab="vfx"]' ) ).toBeVisible();
		await expect( page.locator( '[data-library-tab="shader"]' ) ).toBeVisible();
		await expect( page.locator( '[data-control-input="intensity"]' ) ).toBeVisible();
		await expect( page.locator( '[data-action="next-effect"]' ) ).toBeVisible();

	} );

} );
