// Convert referenced PNG textures to WebP, update GLTF / TrackThemeRegistry
// references, and move source PNGs out of the served `models/` tree.
//
// Pass 1: Convert PNG -> WebP in-place for each target folder.
// Pass 2: Rewrite GLTF `uri` fields from .png -> .webp.
// Pass 3: Rewrite TrackThemeRegistry.js slot `extension: 'png'` -> 'webp'.
// Pass 4: Move the source PNGs to `assets-source/<mirror>/` for KTX2 later.
//
// Quality policy (lossy WebP matches existing standard-map quality level):
//   _Normal, _OcclusionRoughnessMetallic  -> near-lossless (q=95, effort=6)
//   _BaseColor, _Emissive, everything else -> q=85, effort=5
//
// Usage:  node scripts/convert-png-to-webp.js [--dry]

import { readFile, writeFile, readdir, stat, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = dirname( dirname( fileURLToPath( import.meta.url ) ) );
const DRY = process.argv.includes( '--dry' );

const TARGETS = [
	{
		name: 'vehicles',
		pngDir: 'models/vehicles/textures',
		gltfGlob: 'models/vehicles/*.gltf',
		sourceMirror: 'assets-source/vehicles/textures',
	},
	{
		name: 'characters',
		pngDir: 'models/characters/textures',
		gltfGlob: 'models/characters/*.gltf',
		sourceMirror: 'assets-source/characters/textures',
	},
	{
		name: 'environments',
		pngDir: 'models/environments/textures',
		gltfGlob: 'models/environments/*.gltf',
		sourceMirror: 'assets-source/environments/textures',
	},
	{
		name: 'standard-map-themes',
		pngDirRecursive: 'models/standard-map/textures',
		gltfGlob: 'models/standard-map/*.gltf',
		sourceMirror: 'assets-source/standard-map/textures',
		themeRegistry: 'js/TrackThemeRegistry.js',
	},
];


function log( ...args ) {

	console.log( `[${ DRY ? 'DRY' : 'RUN' }]`, ...args );

}


function pickWebpOptions( filename ) {

	const name = filename.toLowerCase();
	if ( name.includes( '_normal' ) || name.includes( 'occlusionroughnessmetallic' ) ) {

		return { quality: 95, effort: 6, alphaQuality: 95 };

	}

	return { quality: 85, effort: 5 };

}


async function walkPngs( dir, recursive ) {

	const absDir = join( ROOT, dir );
	if ( ! existsSync( absDir ) ) return [];

	const out = [];

	async function walk( current ) {

		const entries = await readdir( current, { withFileTypes: true } );
		for ( const entry of entries ) {

			const full = join( current, entry.name );
			if ( entry.isDirectory() ) {

				if ( recursive ) await walk( full );
				continue;

			}

			if ( extname( entry.name ).toLowerCase() === '.png' ) out.push( full );

		}

	}

	await walk( absDir );
	return out;

}


async function listGltfs( globPattern ) {

	const [ dirPattern, filePattern ] = globPattern.split( '/' ).reduce( ( acc, part, i, arr ) => {

		if ( i === arr.length - 1 ) acc[ 1 ] = part;
		else acc[ 0 ].push( part );
		return acc;

	}, [ [], '' ] );
	const dir = join( ROOT, dirPattern.join( '/' ) );
	if ( ! existsSync( dir ) ) return [];
	const matches = [];
	const entries = await readdir( dir, { withFileTypes: true } );
	for ( const entry of entries ) {

		if ( entry.isFile() && entry.name.endsWith( '.gltf' ) ) {

			matches.push( join( dir, entry.name ) );

		}

	}

	return matches;

}


async function convertPngToWebp( pngPath ) {

	const webpPath = pngPath.replace( /\.png$/i, '.webp' );
	const options = pickWebpOptions( basename( pngPath ) );

	if ( existsSync( webpPath ) ) {

		log( 'skip (exists):', relative( ROOT, webpPath ) );
		return { skipped: true, pngPath, webpPath };

	}

	if ( DRY ) {

		log( 'would convert:', relative( ROOT, pngPath ), '->', relative( ROOT, webpPath ), JSON.stringify( options ) );
		return { converted: true, pngPath, webpPath, dry: true };

	}

	await sharp( pngPath ).webp( options ).toFile( webpPath );
	const before = ( await stat( pngPath ) ).size;
	const after = ( await stat( webpPath ) ).size;
	log( `converted: ${ relative( ROOT, pngPath ) }  ${ ( before / 1024 / 1024 ).toFixed( 1 ) }M -> ${ ( after / 1024 / 1024 ).toFixed( 2 ) }M` );
	return { converted: true, pngPath, webpPath, before, after };

}


async function rewriteGltfUris( gltfPath ) {

	const text = await readFile( gltfPath, 'utf8' );
	const replaced = text.replace( /"uri"\s*:\s*"([^"]+?\.png)"/gi, ( full, uri ) => {

		const webpUri = uri.replace( /\.png$/i, '.webp' );
		return full.replace( uri, webpUri );

	} );

	if ( replaced === text ) return { changed: false, gltfPath };

	if ( DRY ) {

		log( 'would rewrite gltf:', relative( ROOT, gltfPath ) );
		return { changed: true, gltfPath, dry: true };

	}

	await writeFile( gltfPath, replaced, 'utf8' );
	log( 'rewrote gltf:', relative( ROOT, gltfPath ) );
	return { changed: true, gltfPath };

}


async function rewriteThemeRegistry( registryPath ) {

	const abs = join( ROOT, registryPath );
	if ( ! existsSync( abs ) ) return { changed: false };

	const text = await readFile( abs, 'utf8' );
	const replaced = text.replace( /extension:\s*'png'/g, "extension: 'webp'" );
	if ( replaced === text ) return { changed: false, registryPath };

	if ( DRY ) {

		log( 'would rewrite theme registry:', registryPath );
		return { changed: true, registryPath, dry: true };

	}

	await writeFile( abs, replaced, 'utf8' );
	log( 'rewrote theme registry:', registryPath );
	return { changed: true, registryPath };

}


async function movePngToSource( pngPath, pngRoot, mirrorRoot ) {

	const absPngRoot = join( ROOT, pngRoot );
	const absMirrorRoot = join( ROOT, mirrorRoot );
	const rel = relative( absPngRoot, pngPath );
	const dest = join( absMirrorRoot, rel );
	const destDir = dirname( dest );

	if ( existsSync( dest ) ) {

		log( 'skip move (source copy exists):', relative( ROOT, pngPath ) );
		return { moved: false };

	}

	if ( DRY ) {

		log( 'would move:', relative( ROOT, pngPath ), '->', relative( ROOT, dest ) );
		return { moved: true, dry: true };

	}

	await mkdir( destDir, { recursive: true } );
	await rename( pngPath, dest );
	return { moved: true, from: pngPath, to: dest };

}


async function main() {

	console.log( `Running PNG -> WebP migration ${ DRY ? '(DRY RUN — no writes)' : '' }` );
	console.log( `Root: ${ ROOT }\n` );

	const totals = { converted: 0, skipped: 0, bytesBefore: 0, bytesAfter: 0, gltfsChanged: 0, moved: 0 };

	for ( const target of TARGETS ) {

		console.log( `\n=== ${ target.name } ===` );

		const pngDir = target.pngDirRecursive || target.pngDir;
		const pngs = await walkPngs( pngDir, !! target.pngDirRecursive );
		if ( pngs.length === 0 ) {

			log( 'no PNGs found in', pngDir );
			continue;

		}

		log( `found ${ pngs.length } PNGs in ${ pngDir }` );

		for ( const png of pngs ) {

			const result = await convertPngToWebp( png );
			if ( result.skipped ) totals.skipped ++;
			if ( result.converted ) {

				totals.converted ++;
				if ( result.before ) totals.bytesBefore += result.before;
				if ( result.after ) totals.bytesAfter += result.after;

			}

		}

		const gltfs = await listGltfs( target.gltfGlob );
		for ( const gltf of gltfs ) {

			const r = await rewriteGltfUris( gltf );
			if ( r.changed ) totals.gltfsChanged ++;

		}

		if ( target.themeRegistry ) {

			const r = await rewriteThemeRegistry( target.themeRegistry );
			if ( r.changed ) totals.gltfsChanged ++;

		}

		for ( const png of pngs ) {

			if ( ! existsSync( png ) ) continue;
			const r = await movePngToSource( png, pngDir, target.sourceMirror );
			if ( r.moved ) totals.moved ++;

		}

	}

	console.log( '\n=== SUMMARY ===' );
	console.log( `Converted: ${ totals.converted }  Skipped: ${ totals.skipped }  Moved: ${ totals.moved }  GLTFs/Registry rewritten: ${ totals.gltfsChanged }` );
	if ( totals.bytesBefore ) {

		console.log( `PNG total: ${ ( totals.bytesBefore / 1024 / 1024 ).toFixed( 1 ) }M` );
		console.log( `WebP total: ${ ( totals.bytesAfter / 1024 / 1024 ).toFixed( 2 ) }M` );
		console.log( `Reduction: ${ ( 100 - totals.bytesAfter / totals.bytesBefore * 100 ).toFixed( 1 ) }%` );

	}

	if ( DRY ) console.log( '\n(Dry run — re-run without --dry to apply changes.)' );

}


main().catch( ( err ) => {

	console.error( 'Conversion failed:', err );
	process.exit( 1 );

} );
