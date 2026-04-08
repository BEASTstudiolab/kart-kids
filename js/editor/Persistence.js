// ─── Persistence ─────────────────────────────────────────────────────
// Save/load to localStorage and named saves.

import { encodeCells, decodeCells } from '../Track.js';
import { cellKey } from './EditorState.js';

const SAVES_KEY = 'racing-editor-saved-tracks';

/**
 * Build the cells array for encoding (skips auto-ramp, normalizes elevated types).
 */
export function getCellsArray( grid ) {

	const arr = [];
	for ( const [ key, cell ] of grid ) {

		if ( cell.autoRamp ) continue;
		if ( cell._consumed ) continue;

		const [ gx, gz ] = key.split( ',' ).map( Number );

		let typeName = cell.type;
		if ( cell.elevation && cell.elevation > 0 &&
			( typeName === 'trk-elev-2p5' || typeName === 'trk-elev-5' ) ) {

			typeName = 'trk-straight';

		}

		// Flanking finish cells save as straights (the arch is visual-only on the center cell)
		if ( cell.finishFlank ) typeName = 'trk-straight';

		const flags = {
			elevation: cell.elevation || 0,
			curveVariant: cell.curveVariant || null,
			rotationOverride: !! cell.rotationOverride,
			rampStyle: cell.rampStyle || null,
		};

		arr.push( [ gx, gz, typeName, cell.orient, flags ] );

	}

	return arr;

}

/**
 * Save current grid to localStorage.
 */
export function save( grid ) {

	const encoded = encodeCells( getCellsArray( grid ) );

	try {

		localStorage.setItem( 'racing-editor-cells', encoded );

	} catch ( e ) {

		console.warn( 'Editor save failed:', e.message );

	}

}

/**
 * Load saved map from URL param or localStorage.
 * @param {object} ctx - { grid, placeMesh, deriveRampsFromElevation, deriveAllCurves }
 */
export function loadSaved( ctx ) {

	const { grid, placeMesh, deriveRampsFromElevation, deriveAllCurves } = ctx;
	const mapParam = new URLSearchParams( window.location.search ).get( 'map' )
		|| new URLSearchParams( window.location.hash.slice( 1 ) ).get( 'map' );
	const encoded = mapParam || localStorage.getItem( 'racing-editor-cells' );

	if ( ! encoded ) return;

	try {

		const arr = decodeCells( encoded );

		for ( const [ gx, gz, type, orient, flags ] of arr ) {

			const isFinish = ( type === 'trk-finish' );
			const cell = { type, orient, isFinish, mesh: null };

			if ( flags ) {

				if ( flags.elevation ) cell.elevation = flags.elevation;
				if ( flags.curveVariant ) cell.curveVariant = flags.curveVariant;
				if ( flags.rotationOverride ) cell.rotationOverride = true;
				if ( flags.rampStyle ) cell.rampStyle = flags.rampStyle;

			}

			grid.set( cellKey( gx, gz ), cell );
			placeMesh( gx, gz, cell );

			// Re-derive flanking finish cells (3x1 finish tile)
			if ( isFinish ) {

				const isNS = orient === 0 || orient === 10;
				const fdx = isNS ? 0 : 1;
				const fdz = isNS ? 1 : 0;
				for ( const dir of [ - 1, 1 ] ) {

					const fk = cellKey( gx + fdx * dir, gz + fdz * dir );
					if ( ! grid.has( fk ) ) {

						grid.set( fk, { type: 'trk-finish', orient, isFinish: true, mesh: null, finishFlank: true } );

					}

				}

			}

		}

		deriveRampsFromElevation();
		deriveAllCurves();

	} catch ( e ) {

		console.warn( 'Failed to load saved map', e );

	}

}

// ─── Named Saves ─────────────────────────────────────────────────────

export function getSavedTracks() {

	try {

		const parsed = JSON.parse( localStorage.getItem( SAVES_KEY ) );
		return Array.isArray( parsed ) ? parsed : [];

	} catch {

		return [];

	}

}

export function saveNamedTrack( grid, name ) {

	const tracks = getSavedTracks();
	const encoded = encodeCells( getCellsArray( grid ) );
	const existing = tracks.findIndex( t => t.name === name );

	const entry = {
		name,
		cells: encoded,
		pieces: grid.size,
		date: new Date().toLocaleDateString()
	};

	if ( existing >= 0 ) {

		tracks[ existing ] = entry;

	} else {

		tracks.unshift( entry );

	}

	try {

		localStorage.setItem( SAVES_KEY, JSON.stringify( tracks ) );

	} catch ( e ) {

		console.warn( 'Failed to save track:', e.message );

	}

}

/**
 * Export current grid to a downloadable .json file.
 */
export function exportToFile( grid, trackName ) {

	const encoded = encodeCells( getCellsArray( grid ) );
	const data = {
		version: 1,
		name: trackName || 'Untitled Track',
		cells: encoded,
		pieces: grid.size,
		exportedAt: new Date().toISOString(),
	};

	const blob = new Blob( [ JSON.stringify( data, null, 2 ) ], { type: 'application/json' } );
	const url = URL.createObjectURL( blob );
	const a = document.createElement( 'a' );
	a.href = url;
	a.download = ( trackName || 'track' ).replace( /[^a-zA-Z0-9_-]/g, '_' ) + '.json';
	a.click();
	URL.revokeObjectURL( url );

}

/**
 * Import a track from a .json file.
 * @param {File} file
 * @returns {Promise<{name: string, cells: string}|null>}
 */
export function importFromFile( file ) {

	return new Promise( ( resolve ) => {

		const reader = new FileReader();
		reader.onload = () => {

			try {

				const data = JSON.parse( reader.result );

				if ( ! data.cells || typeof data.cells !== 'string' ) {

					console.warn( 'Invalid track file: missing cells data' );
					resolve( null );
					return;

				}

				resolve( { name: data.name || file.name.replace( /\.json$/, '' ), cells: data.cells } );

			} catch ( e ) {

				console.warn( 'Failed to parse track file:', e.message );
				resolve( null );

			}

		};

		reader.onerror = () => resolve( null );
		reader.readAsText( file );

	} );

}

export function deleteNamedTrack( name ) {

	const tracks = getSavedTracks().filter( t => t.name !== name );

	try {

		localStorage.setItem( SAVES_KEY, JSON.stringify( tracks ) );

	} catch ( e ) {

		console.warn( 'Failed to update saved tracks:', e.message );

	}

}

/**
 * Load a named track by its encoded cells string.
 * @param {object} ctx - { grid, trackGroup, placeMesh, pushUndo, save, updateStats, updateFinishCar, deriveRampsFromElevation, deriveAllCurves }
 */
export function loadNamedTrack( ctx, encoded ) {

	const { grid, trackGroup, placeMesh, pushUndo, save, updateStats, updateFinishCar, deriveRampsFromElevation, deriveAllCurves } = ctx;

	pushUndo();

	for ( const [ , cell ] of grid ) {

		if ( cell.mesh ) trackGroup.remove( cell.mesh );
		if ( cell.curveMesh ) trackGroup.remove( cell.curveMesh );

	}

	grid.clear();

	try {

		const arr = decodeCells( encoded );

		for ( const [ gx, gz, type, orient, flags ] of arr ) {

			const isFinish = ( type === 'trk-finish' );
			const cell = { type, orient, isFinish, mesh: null };

			if ( flags ) {

				if ( flags.elevation ) cell.elevation = flags.elevation;
				if ( flags.curveVariant ) cell.curveVariant = flags.curveVariant;
				if ( flags.rotationOverride ) cell.rotationOverride = true;
				if ( flags.rampStyle ) cell.rampStyle = flags.rampStyle;

			}

			grid.set( cellKey( gx, gz ), cell );
			placeMesh( gx, gz, cell );

		}

		deriveRampsFromElevation();
		deriveAllCurves();

	} catch ( e ) {

		console.warn( 'Failed to load track', e );

	}

	save();
	updateStats();
	updateFinishCar();

}
