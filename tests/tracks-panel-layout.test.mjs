import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' );

}

test( 'tracks panel uses the shared customizer shell with builder surface and inspector deck', () => {

	const source = readText( 'js/ui/panels/TracksPanel.js' );

	assert.ok( source.includes( "builder.className = 'kk-tracks__builder';" ) );
	assert.ok( source.includes( "builderEyebrow.textContent = 'Customizer';" ) );
	assert.ok( source.includes( "builderTitle.textContent = 'Route Library';" ) );
	assert.ok( source.includes( "deck.appendChild( this._buildSelectionCard() );" ) );
	assert.ok( source.includes( "deck.appendChild( this._buildEditorCard() );" ) );
	assert.ok( source.includes( '.kk-tracks__builder {' ) );
	assert.ok( source.includes( 'var(--text-customizer-eyebrow' ) );
	assert.ok( source.includes( 'var(--text-customizer-title' ) );
	assert.ok( source.includes( "metaGrid.className = 'kk-mv-data-grid';" ) );
	assert.ok( source.includes( "this._utilityLaunchBtn = launchBtn;" ) );

} );
