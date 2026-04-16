import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../../${ relPath }`, import.meta.url ), 'utf8' );

}

test( 'ui theme defines shared shell/editorial utility classes and canonical tokens', () => {

	const source = readText( 'js/ui/ui-theme.css' );

	assert.match( source, /--color-bg-base:\s+var\(--color-near-black\)/ );
	assert.match( source, /--text-5xl:\s+4rem/ );
	assert.match( source, /\.kk-ui-utility-text\s*\{/ );
	assert.match( source, /\.kk-ui-meta-label\s*\{/ );
	assert.match( source, /\.kk-ui-meta-action\s*\{/ );
	assert.match( source, /\.kk-ui-back-button\s*\{/ );
	assert.match( source, /\.kk-ui-selection-row\s*\{/ );
	assert.match( source, /\.kk-ui-placeholder\s*\{/ );
	assert.match( source, /\.kk-page--placeholder\s*\{/ );

} );

test( 'shared button and page views consume the design-system helpers instead of local inline styling', () => {

	const ctaButton = readText( 'js/ui/components/CTAButton.js' );
	const home = readText( 'js/ui/pages/page02-home/Page02HomeView.js' );
	const playModes = readText( 'js/ui/pages/page04-play-modes/Page04PlayModesView.js' );
	const createHub = readText( 'js/ui/pages/page16-create-hub/Page16CreateHubView.js' );
	const appShell = readText( 'js/ui/core/AppShell.js' );

	assert.match( ctaButton, /\.kk-cta-button--hero\s*\{/ );

	assert.ok( home.includes( "'page-home__quick-play', 'kk-cta-button--hero'" ) );
	assert.ok( home.includes( "'page-home__wallet kk-ui-inline-row kk-ui-utility-text'" ) );
	assert.doesNotMatch( home, /walletUtilityEl\.style\.cssText/ );

	assert.ok( playModes.includes( "this._soloPickerEl.className = 'page-play-modes__solo-picker';" ) );
	assert.ok( playModes.includes( "'page-play-modes__mode-btn', 'kk-cta-button--hero'" ) );
	assert.ok( playModes.includes( "'page-play-modes__sub-back kk-ui-back-button'" ) );
	assert.ok( playModes.includes( "'page-play-modes__track-list kk-ui-selection-list'" ) );
	assert.ok( playModes.includes( "item.className = 'kk-ui-selection-row';" ) );
	assert.doesNotMatch( playModes, /_soloPickerEl\.style\.cssText/ );

	assert.ok( createHub.includes( "centerArea.className = 'kk-ui-inline-row';" ) );
	assert.ok( createHub.includes( "trackBuilderPanel.classList.add( 'kk-ui-display-contents' );" ) );
	assert.ok( createHub.includes( "panel.classList.add( 'kk-ui-tab-panel' );" ) );
	assert.ok( createHub.includes( "'page-create-hub__section-heading-btn kk-ui-meta-action'" ) );
	assert.ok( createHub.includes( "'page-create-hub__placeholder-panel kk-ui-placeholder kk-ui-fill'" ) );
	assert.doesNotMatch( createHub, /style\.cssText/ );
	assert.doesNotMatch( createHub, /style\.flex\s*=/ );

	assert.ok( appShell.includes( "'kk-page kk-page--placeholder kk-ui-placeholder kk-ui-placeholder--muted'" ) );
	assert.ok( appShell.includes( "title.className = 'kk-ui-placeholder__title';" ) );
	assert.ok( appShell.includes( "sub.className = 'kk-ui-placeholder__copy';" ) );
	assert.doesNotMatch( appShell, /el\.style\.cssText/ );
	assert.doesNotMatch( appShell, /inner\.style\.cssText/ );

} );
