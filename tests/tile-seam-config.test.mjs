import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read( path ) {

	return readFileSync( new URL( `../${ path }`, import.meta.url ), 'utf8' );

}

test( 'Track.js keeps exact tile spacing and disables tile shadow casting', () => {

	const source = read( 'js/Track.js' );

	assert.match( source, /export const CELL_RAW = 10\.0;/ );
	assert.ok( ( source.match( /inst\.castShadow = false;/g ) ?? [] ).length >= 3 );
	assert.match( source, /child\.castShadow = false;/ );

} );

test( 'main game, editor, and testers do not keep the rejected flat-material experiment', () => {

	const main = read( 'js/main.js' );
	const trackTester = read( 'js/TrackTester.js' );
	const tileTester = read( 'js/TileTester.js' );
	const editor = read( 'editor.html' );

	assert.doesNotMatch( main, /TrackMaterialTuning/ );
	assert.doesNotMatch( main, /trackSurfaceMode/ );
	assert.doesNotMatch( main, /tuneTrackMaterial/ );
	assert.doesNotMatch( trackTester, /TrackMaterialTuning/ );
	assert.doesNotMatch( trackTester, /trackSurfaceMode/ );
	assert.doesNotMatch( trackTester, /tuneTrackMaterial/ );
	assert.doesNotMatch( tileTester, /TrackMaterialTuning/ );
	assert.doesNotMatch( tileTester, /trackSurfaceMode/ );
	assert.doesNotMatch( tileTester, /tuneTrackMaterial/ );
	assert.doesNotMatch( editor, /TrackMaterialTuning/ );
	assert.doesNotMatch( editor, /trackSurfaceMode/ );
	assert.doesNotMatch( editor, /tuneTrackMaterial/ );

} );

test( 'main game, editor, and testers wire the opt-in opaque asphalt experiment', () => {

	const main = read( 'js/main.js' );
	const trackTester = read( 'js/TrackTester.js' );
	const tileTester = read( 'js/TileTester.js' );
	const editor = read( 'editor.html' );

	assert.match( main, /TrackAsphaltMode/ );
	assert.match( main, /const asphaltMode = getTrackAsphaltMode/ );
	assert.match( main, /applyTrackAsphaltMode\( child\.material, \{ asphaltMode \} \);/ );
	assert.match( trackTester, /TrackAsphaltMode/ );
	assert.match( trackTester, /const asphaltMode = getTrackAsphaltMode/ );
	assert.match( trackTester, /applyTrackAsphaltMode\( child\.material, \{ asphaltMode \} \);/ );
	assert.match( tileTester, /TrackAsphaltMode/ );
	assert.match( tileTester, /const asphaltMode = getTrackAsphaltMode/ );
	assert.match( tileTester, /applyTrackAsphaltMode\( child\.material, \{ asphaltMode \} \);/ );
	assert.match( editor, /TrackAsphaltMode/ );
	assert.match( editor, /const asphaltMode = getTrackAsphaltMode/ );
	assert.match( editor, /applyTrackAsphaltMode\( child\.material, \{ asphaltMode \} \);/ );

} );
