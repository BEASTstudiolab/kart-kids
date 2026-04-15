import test from 'node:test';
import assert from 'node:assert/strict';

import { ThemeService } from '../js/track-editor/services/ThemeService.js';

test( 'ThemeService normalizes the current project theme and invokes the refresh callback', async () => {

	const project = { meta: { themeId: 'city-night' } };
	const appliedThemeIds = [];
	const service = new ThemeService( project, {
		onThemeChanged: async ( themeId ) => {

			appliedThemeIds.push( themeId );

		},
	} );

	const resolved = await service.applyCurrentTheme();

	assert.equal( resolved, 'classic-asphalt' );
	assert.equal( project.meta.themeId, 'classic-asphalt' );
	assert.deepEqual( appliedThemeIds, [ 'classic-asphalt' ] );

} );

test( 'ThemeService exposes the theme dropdown options and updates project meta on setTheme', async () => {

	const project = { meta: { themeId: 'classic-asphalt' } };
	const appliedThemeIds = [];
	const service = new ThemeService( project, {
		onThemeChanged: async ( themeId ) => {

			appliedThemeIds.push( themeId );

		},
	} );

	assert.equal( service.getAvailableThemes()[ 0 ]?.id, 'classic-asphalt' );

	const resolved = await service.setTheme( 'snow' );

	assert.equal( resolved, 'snow' );
	assert.equal( project.meta.themeId, 'snow' );
	assert.deepEqual( appliedThemeIds, [ 'snow' ] );

} );
