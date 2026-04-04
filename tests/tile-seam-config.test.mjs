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

test( 'main game and testers apply the asphalt seam material tuning', () => {

	const main = read( 'js/main.js' );
	const trackTester = read( 'js/TrackTester.js' );
	const tileTester = read( 'js/TileTester.js' );
	const tuning = read( 'js/TrackMaterialTuning.js' );

	assert.match( main, /tuneTrackMaterial\( child\.material, \{ surfaceMode: trackSurfaceMode \} \);/ );
	assert.match( trackTester, /child\.material\.side = THREE\.FrontSide;\s+tuneTrackMaterial\( child\.material, \{ surfaceMode: trackSurfaceMode \} \);\s+child\.receiveShadow = true;\s+child\.castShadow = false;/ );
	assert.match( tileTester, /child\.material\.side = THREE\.FrontSide;\s+tuneTrackMaterial\( child\.material, \{ surfaceMode: trackSurfaceMode \} \);\s+child\.receiveShadow = true;\s+child\.castShadow = false;/ );
	assert.match( tuning, /material\.name === 'asphalt'/ );
	assert.match( tuning, /material\.normalMap = null;/ );

} );
