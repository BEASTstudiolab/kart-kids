import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
	getAvailableTrackThemes,
	OPTIONAL_TRACK_THEME_TEXTURE_KINDS,
	REQUIRED_TRACK_THEME_TEXTURE_KINDS,
	resolveTrackThemeTexturePath,
} from '../js/TrackThemeRegistry.js';

function assetExists( relativePath ) {

	return existsSync( new URL( `../${ relativePath }`, import.meta.url ) );

}

test( 'every configured track theme ships the required atlas textures for both asphalt slots', () => {

	const missingAssets = [];

	for ( const theme of getAvailableTrackThemes() ) {

		for ( const atlasSlot of [ 1, 2 ] ) {

			for ( const textureKind of REQUIRED_TRACK_THEME_TEXTURE_KINDS ) {

				const relativePath = resolveTrackThemeTexturePath( theme.id, atlasSlot, textureKind );
				if ( ! assetExists( relativePath ) ) {

					missingAssets.push( `${ theme.id } slot ${ atlasSlot } ${ textureKind }: ${ relativePath }` );

				}

			}

			for ( const textureKind of OPTIONAL_TRACK_THEME_TEXTURE_KINDS ) {

				const relativePath = resolveTrackThemeTexturePath( theme.id, atlasSlot, textureKind );
				if ( assetExists( relativePath ) ) continue;

				// Optional texture: presence is validated opportunistically, not required.
				assert.equal( textureKind, 'Emissive' );

			}

		}

	}

	assert.deepEqual(
		missingAssets,
		[],
		'Missing required track theme assets:\n' + missingAssets.join( '\n' )
	);

} );
