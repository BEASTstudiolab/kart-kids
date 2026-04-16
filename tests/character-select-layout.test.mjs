import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' );

}

test( 'character select view supports a shared-stage layout without the embedded preview card', () => {

	const source = readText( 'js/ui/pages/page10-character-select/Page10CharacterSelectView.js' );
	const controllerSource = readText( 'js/ui/pages/page10-character-select/Page10CharacterSelectController.js' );

	assert.ok( source.includes( 'showEmbeddedPreview: false,' ) );
	assert.ok( source.includes( "surfaceVariant: 'default'," ) );
	assert.ok( source.includes( "sidebarTitleText: ''," ) );
	assert.ok( source.includes( "root.classList.toggle( 'page-character-select--customizer', this._config.surfaceVariant === 'customizer' );" ) );
	assert.ok( source.includes( "const sidebarTitle = document.createElement( 'h2' );" ) );
	assert.ok( source.includes( "sidebarTitle.className = 'page-character-select__panel-title';" ) );
	assert.ok( source.includes( '.page-character-select--customizer .page-character-select__panel-title {' ) );
	assert.ok( controllerSource.includes( "surfaceVariant: 'customizer'," ) );
	assert.ok( controllerSource.includes( "sidebarTitleText: 'Pilot Style'," ) );
	assert.ok( source.includes( "this._categoryTabStrip = document.createElement( 'div' );" ) );
	assert.ok( source.includes( "this._categoryTabStrip.className = 'page-character-select__category-tabs';" ) );
	assert.ok( source.includes( "grid-template-columns: repeat( 3, minmax( 0, 1fr ) );" ) );
	assert.ok( source.includes( "grid.className = 'page-character-select__option-grid';" ) );
	assert.ok( source.includes( "grid-template-columns: repeat( 4, minmax( 0, 1fr ) );" ) );
	assert.ok( source.includes( ".page-character-select__item--thumbnail {" ) );
	assert.ok( source.includes( ".page-character-select__item--thumbnail-hero {" ) );
	assert.ok( source.includes( "aspect-ratio: 1 / 1;" ) );
	assert.ok( source.includes( ".page-character-select__item-thumb-image {" ) );
	assert.ok( source.includes( "const hasThumbnail = typeof item.thumbnailState === 'string';" ) );
	assert.ok( source.includes( "button.classList.toggle( 'page-character-select__item--thumbnail', hasThumbnail );" ) );
	assert.ok( source.includes( "button.classList.toggle( 'page-character-select__item--thumbnail-hero', hasThumbnail && activeCategory.items.length <= 2 );" ) );
	assert.ok( source.includes( "image.className = 'page-character-select__item-thumb-image';" ) );
	assert.ok( source.includes( "if ( hasThumbnail ) {" ) );
	assert.ok( source.includes( "} else {" ) );
	assert.ok( source.includes( "root.classList.toggle( 'page-character-select--shared-stage', ! this._config.showEmbeddedPreview );" ) );
	assert.ok( source.includes( "this._root.dataset.activeCategorySummary = activeCategorySummary || '';" ) );
	assert.doesNotMatch( source, /page-character-select__stage-hint/ );
	assert.doesNotMatch( source, /Live Preview/ );
	assert.doesNotMatch( source, /page-character-select__carousel/ );
	assert.doesNotMatch( source, /page-character-select__category-toggle/ );
	assert.doesNotMatch( source, /page-character-select__panel page-character-select__details/ );

} );
