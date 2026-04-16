import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../../${ relPath }`, import.meta.url ), 'utf8' );

}

test( 'ui theme defines shared customizer typography tokens', () => {

	const source = readText( 'js/ui/ui-theme.css' );

	assert.match( source, /--text-customizer-eyebrow:\s+var\(--text-editorial-label\)/ );
	assert.match( source, /--text-customizer-title:\s+var\(--text-editorial-panel-title\)/ );
	assert.match( source, /--text-customizer-copy:\s+0\.78rem/ );
	assert.match( source, /--text-customizer-section:\s+1\.05rem/ );
	assert.match( source, /--text-customizer-control:\s+var\(--text-sm\)/ );
	assert.match( source, /--text-customizer-meta:\s+var\(--text-editorial-label\)/ );
	assert.match( source, /--text-customizer-action:\s+0\.64rem/ );
	assert.match( source, /--text-customizer-summary:\s+1rem/ );

} );

test( 'character tab mode and garage builder consume the shared customizer typography scale', () => {

	const controller = readText( 'js/ui/pages/page10-character-select/Page10CharacterSelectController.js' );
	const view = readText( 'js/ui/pages/page10-character-select/Page10CharacterSelectView.js' );
	const garage = readText( 'js/ui/panels/GaragePanel.js' );

	assert.ok( controller.includes( "surfaceVariant: 'customizer'," ) );
	assert.ok( controller.includes( "sidebarTitleText: 'Pilot Style'," ) );

	assert.ok( view.includes( "root.classList.toggle( 'page-character-select--customizer', this._config.surfaceVariant === 'customizer' );" ) );
	assert.ok( view.includes( '.page-character-select--customizer .page-character-select__panel-title {' ) );
	assert.ok( view.includes( '.page-character-select--customizer .page-character-select__category-tab {' ) );
	assert.ok( view.includes( '.page-character-select--customizer .page-character-select__color-row,' ) );
	assert.ok( view.includes( '.page-character-select--customizer .page-character-select__item {' ) );

	assert.ok( garage.includes( 'var(--text-customizer-eyebrow' ) );
	assert.ok( garage.includes( 'var(--text-customizer-title' ) );
	assert.ok( garage.includes( 'var(--text-customizer-copy' ) );
	assert.ok( garage.includes( 'var(--text-customizer-control' ) );
	assert.ok( garage.includes( 'var(--text-customizer-action' ) );
	assert.ok( garage.includes( 'var(--text-customizer-summary' ) );

} );
