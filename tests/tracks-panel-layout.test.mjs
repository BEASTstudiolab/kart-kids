import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' );

}

test( 'tracks_panel_layout_renders_source_subtabs_selection_and_editor_cta', () => {

	// Arrange
	const source = readText( 'js/ui/panels/TracksPanel.js' );

	// Assert — source sub-tab strip
	assert.ok( source.includes( "{ id: 'official'" ), 'declares official sub-tab' );
	assert.ok( source.includes( "{ id: 'spotlight'" ), 'declares spotlight sub-tab' );
	assert.ok( source.includes( "{ id: 'saved'" ), 'declares saved sub-tab' );
	assert.ok( source.includes( "{ id: 'published'" ), 'declares published sub-tab' );
	assert.ok( source.includes( ".kk-tracks__tabs" ), 'styles the sub-tab strip container' );
	assert.ok( source.includes( ".kk-tracks__tab--active" ), 'has an active tab style' );

	// Assert — single active section flows to the browser
	assert.ok( source.includes( "this._browser.setSections( [ section ]" ), 'feeds only the active section to the browser' );

	// Assert — selection card + editor CTA card on the right deck
	assert.ok( source.includes( "_buildSelectionCard()" ), 'builds a selection card' );
	assert.ok( source.includes( "_buildEditorCta()" ), 'builds the editor CTA card' );
	assert.ok( source.includes( "Open Track Editor" ), 'CTA labels the Track Editor entry point' );
	assert.ok( source.includes( "kk-tracks__btn--cta" ), 'CTA button uses the prominent variant' );
	assert.ok( source.includes( "Build Your Own" ), 'CTA invites the user to build a track' );

} );
