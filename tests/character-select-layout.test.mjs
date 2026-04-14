import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText( relPath ) {

	return readFileSync( new URL( `../${ relPath }`, import.meta.url ), 'utf8' );

}

test( 'character select view supports a shared-stage layout without the embedded preview card', () => {

	const source = readText( 'js/ui/pages/page10-character-select/Page10CharacterSelectView.js' );

	assert.ok( source.includes( 'showEmbeddedPreview: false,' ) );
	assert.ok( source.includes( "this._categoryTabStrip = document.createElement( 'div' );" ) );
	assert.ok( source.includes( "this._categoryTabStrip.className = 'page-character-select__category-tabs';" ) );
	assert.ok( source.includes( "grid-template-columns: repeat( 3, minmax( 0, 1fr ) );" ) );
	assert.ok( source.includes( "grid.className = 'page-character-select__option-grid';" ) );
	assert.ok( source.includes( "grid-template-columns: repeat( 4, minmax( 0, 1fr ) );" ) );
	assert.ok( source.includes( "label.textContent = 'Camera Tuning';" ) );
	assert.ok( source.includes( "this._cameraDebugPoseEl.className = 'page-character-select__camera-debug-pose';" ) );
	assert.ok( source.includes( '`Preset: ${ presetId }`' ) );
	assert.ok( source.includes( '`FOV: ${ fov } | Kart Y: ${ kartRotYDeg }`' ) );
	assert.ok( source.includes( "root.classList.toggle( 'page-character-select--shared-stage', ! this._config.showEmbeddedPreview );" ) );
	assert.doesNotMatch( source, /page-character-select__stage-hint/ );
	assert.doesNotMatch( source, /Live Preview/ );
	assert.doesNotMatch( source, /page-character-select__carousel/ );
	assert.doesNotMatch( source, /page-character-select__category-toggle/ );
	assert.doesNotMatch( source, /page-character-select__panel page-character-select__details/ );

} );
