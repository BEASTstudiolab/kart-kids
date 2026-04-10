// ─── ProjectStorageService ────────────────────────────────────────────────────
// Handles save/load for track projects. Supports v4 JSON format with backward
// compatibility for v3 encoded tracks.

import { encodeCells, decodeCells } from '../../TrackCodec.js';

const AUTOSAVE_KEY = 'racing-editor-cells';      // v3 compat
const V4_PROJECT_KEY = 'kk-editor-project';       // v4 JSON
const SAVED_TRACKS_KEY = 'kk-editor-saved-tracks'; // named saves index
const OLD_SAVES_KEY = 'racing-editor-saved-tracks'; // legacy saves

export class ProjectStorageService {

	/**
	 * @param {import('../models/TrackProject.js').TrackProject} project
	 * @param {import('./MeshFactory.js').MeshFactory} meshFactory
	 * @param {import('../services/AutoTileService.js').AutoTileService} autoTile
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( project, meshFactory, autoTile, eventBus ) {

		this._project = project;
		this._meshFactory = meshFactory;
		this._autoTile = autoTile;
		this._eventBus = eventBus;

	}

	// ── Autosave ──

	/** Save current project to localStorage (dual-write: v4 + v3 compat). */
	save() {

		try {

			// v4 full JSON
			const v4 = this._project.toV4JSON();
			localStorage.setItem( V4_PROJECT_KEY, JSON.stringify( v4 ) );

			// v3 compat (for game loading via ?map= / #map=)
			const cells = this._project.getCellsArray();
			if ( cells.length > 0 ) {

				localStorage.setItem( AUTOSAVE_KEY, encodeCells( cells ) );

			}

		} catch ( err ) {

			console.error( '[ProjectStorage] Save failed:', err );

		}

	}

	// ── Load ──

	/**
	 * Load project from URL parameter or localStorage.
	 * @returns {boolean} true if a track was loaded
	 */
	loadSaved() {

		// 1. Check URL parameter: #track=v4:... or ?map=... or #map=...
		const hash = window.location.hash.slice( 1 );
		const params = new URLSearchParams( window.location.search );
		const trackParam = this._extractParam( hash, params );

		if ( trackParam ) {

			return this._loadFromEncoded( trackParam );

		}

		// 2. Check v4 localStorage
		const v4Json = localStorage.getItem( V4_PROJECT_KEY );
		if ( v4Json ) {

			try {

				const parsed = JSON.parse( v4Json );
				if ( parsed.v === 4 ) {

					this._project.loadFromV4JSON( parsed );
					this._rebuildAllMeshes();
					return true;

				}

			} catch ( err ) {

				console.warn( '[ProjectStorage] v4 parse failed:', err );

			}

		}

		// 3. Check v3 localStorage autosave
		const v3Encoded = localStorage.getItem( AUTOSAVE_KEY );
		if ( v3Encoded ) {

			return this._loadFromEncoded( v3Encoded );

		}

		return false;

	}

	// ── Named saves ──

	/**
	 * Save with a name.
	 * @param {string} name
	 */
	saveNamed( name ) {

		this._project.meta.name = name;
		this.save();

		// Store full v4 project data per track
		const v4 = this._project.toV4JSON();
		localStorage.setItem( `kk-project-${ this._project.meta.id }`, JSON.stringify( v4 ) );

		// Update named saves index
		const index = this._getSavedIndex();
		const entry = {
			id: this._project.meta.id,
			name,
			pieces: this._project.tileCount,
			date: new Date().toISOString(),
		};

		const existing = index.findIndex( e => e.id === entry.id );
		if ( existing >= 0 ) {

			index[ existing ] = entry;

		} else {

			index.push( entry );

		}

		localStorage.setItem( SAVED_TRACKS_KEY, JSON.stringify( index ) );

		this._eventBus.emit( 'project:saved', { name } );

	}

	/**
	 * Get list of saved tracks.
	 * @returns {Array<{ id: string, name: string, pieces: number, date: string }>}
	 */
	getSavedTracks() {

		return this._getSavedIndex();

	}

	/**
	 * Load a named track by id. Returns true if successful.
	 * @param {string} id
	 * @returns {boolean}
	 */
	loadNamedTrack( id ) {

		try {

			const raw = localStorage.getItem( `kk-project-${ id }` );
			if ( ! raw ) return false;

			const parsed = JSON.parse( raw );
			this._project.loadFromV4JSON( parsed );
			this._rebuildAllMeshes();
			return true;

		} catch ( err ) {

			console.warn( '[ProjectStorage] loadNamedTrack failed:', err );
			return false;

		}

	}

	/**
	 * Delete a named save.
	 * @param {string} id
	 */
	deleteNamedTrack( id ) {

		const index = this._getSavedIndex().filter( e => e.id !== id );
		localStorage.setItem( SAVED_TRACKS_KEY, JSON.stringify( index ) );
		localStorage.removeItem( `kk-project-${ id }` );

	}

	// ── Share link ──

	/**
	 * Generate a share URL for the current track.
	 * Uses v3 encoding for game compatibility.
	 * @returns {string}
	 */
	generateShareUrl() {

		const cells = this._project.getCellsArray();
		const encoded = encodeCells( cells );
		const base = window.location.origin + '/index.html';
		return `${ base }#map=${ encoded }`;

	}

	// ── Private ──

	/** @private */
	_extractParam( hash, params ) {

		// #track=v4:...
		if ( hash.startsWith( 'track=' ) ) return hash.slice( 6 );

		// #map=... (legacy)
		if ( hash.startsWith( 'map=' ) ) return hash.slice( 4 );

		// ?map=...
		const mapParam = params.get( 'map' );
		if ( mapParam ) return mapParam;

		return null;

	}

	/** @private */
	_loadFromEncoded( encoded ) {

		try {

			// Detect format
			if ( encoded.startsWith( '{' ) ) {

				// Raw JSON (v4)
				const parsed = JSON.parse( encoded );
				this._project.loadFromV4JSON( parsed );
				this._rebuildAllMeshes();
				return true;

			}

			// v3/v2/v1 binary encoded
			const cells = decodeCells( encoded );
			if ( cells && cells.length > 0 ) {

				// Use the project's own class to migrate v3 cells
				const imported = this._project.constructor.fromV3Cells( cells );
				this._project.loadFromV4JSON( imported.toV4JSON() );
				this._rebuildAllMeshes();
				return true;

			}

		} catch ( err ) {

			console.warn( '[ProjectStorage] Load from encoded failed:', err );

		}

		return false;

	}

	/** @private Rebuild meshes for all tiles after a load. */
	_rebuildAllMeshes() {

		for ( const [ key, tile ] of this._project.getGrid() ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			this._meshFactory.createTileMesh( gx, gz, tile );

		}

		// No auto-resolve — tiles load exactly as saved (manual placement mode)

	}

	/** @private */
	_getSavedIndex() {

		try {

			const raw = localStorage.getItem( SAVED_TRACKS_KEY );
			return raw ? JSON.parse( raw ) : [];

		} catch {

			return [];

		}

	}

}
