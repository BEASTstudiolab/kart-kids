import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readSource( relativePath ) {

	return readFileSync( new URL( `../${ relativePath }`, import.meta.url ), 'utf8' );

}

test( 'build/editor tooling removes Smart Fill and Replace while exposing Terrain', () => {

	const buildModeSource = readSource( 'js/track-editor/modes/BuildMode.js' );
	const editorAppSource = readSource( 'js/track-editor/core/EditorApp.js' );
	const gameplayModeSource = readSource( 'js/track-editor/modes/GameplayMode.js' );
	const radialMenuSource = readSource( 'js/track-editor/ui/RadialMenu.js' );
	const tileLibrarySource = readSource( 'js/track-editor/services/TileLibrary.js' );

	assert.equal( buildModeSource.includes( "name: 'Smart Fill'" ), false );
	assert.equal( buildModeSource.includes( "name: 'Replace'" ), false );
	assert.equal( buildModeSource.includes( "name: 'Terrain'" ), true );

	assert.equal( editorAppSource.includes( "label: 'Smart Fill'" ), false );
	assert.equal( editorAppSource.includes( "label: 'Replace'" ), false );
	assert.equal( editorAppSource.includes( "label: 'Terrain'" ), true );

	assert.equal( radialMenuSource.includes( "label: 'Replace'" ), false );
	assert.equal( gameplayModeSource.includes( "name: 'Turbo Tile'" ), true );
	assert.equal( readSource( 'js/track-editor/services/PlacementController.js' ).includes( 'arrow1.rotation.z = Math.PI - orientRad;' ), true );
	assert.equal( gameplayModeSource.includes( 'clearMarkers( { emitEvents = true } = {} )' ), true );
	assert.equal( buildModeSource.includes( 'removeMarkersAt?.( gx, gz )' ), true );
	assert.equal( editorAppSource.includes( 'gm?.clearMarkers' ), true );
	assert.equal( tileLibrarySource.includes( "name: 'Jump (Medium)'" ), true );
	assert.equal( tileLibrarySource.includes( "name: 'Elevated 2.5m'" ), false );
	assert.equal( tileLibrarySource.includes( "name: 'Elevated 5m'" ), false );
	assert.equal( tileLibrarySource.includes( "name: 'Elevated Flats'" ), false );

} );
