import test from 'node:test';
import assert from 'node:assert/strict';

import {
	DEFAULT_TRACK_THEME_ID,
	getAvailableTrackThemes,
	normalizeTrackThemeId,
	resolveTrackThemeTexturePath,
} from '../js/TrackThemeRegistry.js';
import { TrackProject } from '../js/track-editor/models/TrackProject.js';

test( 'track theme registry exposes classic asphalt first and includes the new paired themes', () => {

	const themes = getAvailableTrackThemes();
	assert.equal( themes[ 0 ]?.id, DEFAULT_TRACK_THEME_ID );
	assert.deepEqual(
		themes.map( ( theme ) => theme.id ),
		[
			'classic-asphalt',
			'80s-synth-wave',
			'canyon',
			'concrete',
			'dirt',
			'forest',
			'ice',
			'lava',
			'moon',
			'sand',
			'snow',
		]
	);

} );

test( 'track theme registry resolves special 80s synth wave filenames and classic asphalt fallbacks', () => {

	assert.equal(
		resolveTrackThemeTexturePath( '80s-synth-wave', 2, 'Emissive' ),
		'models/standard-map/textures/80s Synth Wave Atlas 2/80ssynthwaveAtlas2_Emissive.png'
	);
	assert.equal(
		resolveTrackThemeTexturePath( 'snow', 1, 'BaseColor' ),
		'models/standard-map/textures/Snow Atlas 1/SnowAtlas1_BaseColor.png'
	);
	assert.equal(
		resolveTrackThemeTexturePath( 'classic-asphalt', 1, 'Normal' ),
		'models/standard-map/textures/AtlasAsphalt1_Normal.webp'
	);

} );

test( 'track theme normalization falls back to classic asphalt for legacy and unknown ids', () => {

	assert.equal( normalizeTrackThemeId( 'city-night' ), DEFAULT_TRACK_THEME_ID );
	assert.equal( normalizeTrackThemeId( 'retro-neon' ), DEFAULT_TRACK_THEME_ID );
	assert.equal( normalizeTrackThemeId( 'not-a-real-theme' ), DEFAULT_TRACK_THEME_ID );
	assert.equal( normalizeTrackThemeId( '' ), DEFAULT_TRACK_THEME_ID );

} );

test( 'TrackProject normalizes theme ids on load and save', () => {

	const project = new TrackProject();
	project.loadFromV4JSON( {
		v: 4,
		meta: { themeId: 'city-night' },
		trackTiles: [],
	} );

	assert.equal( project.meta.themeId, DEFAULT_TRACK_THEME_ID );

	project.meta.themeId = 'retro-neon';
	assert.equal( project.toV4JSON().meta.themeId, DEFAULT_TRACK_THEME_ID );

} );
