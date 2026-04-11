// ─── ProjectStorageService ────────────────────────────────────────────────────
// Handles save/load for track projects. Uses v4 JSON format exclusively.

const V4_PROJECT_KEY = 'kk-editor-project';       // v4 JSON
const SAVED_TRACKS_KEY = 'kk-editor-saved-tracks'; // named saves index

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

	/** Save current project to localStorage as v4 JSON. */
	save() {

		try {

			const v4 = this._project.toV4JSON();
			localStorage.setItem( V4_PROJECT_KEY, JSON.stringify( v4 ) );

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

		// 1. Check URL parameter: #track=v4:...
		const hash = window.location.hash.slice( 1 );
		if ( hash.startsWith( 'track=' ) ) {

			return this._loadV4FromParam( hash.slice( 6 ) );

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

	// ── Private ──

	/** @private Load v4 JSON from a URL param (base64url-encoded). */
	_loadV4FromParam( raw ) {

		try {

			// v4:<base64url>
			const b64 = raw.startsWith( 'v4:' ) ? raw.slice( 3 ) : raw;
			const bytes = atob( b64.replace( /-/g, '+' ).replace( /_/g, '/' ) );
		const json = new TextDecoder().decode( Uint8Array.from( bytes, c => c.charCodeAt( 0 ) ) );
			const parsed = JSON.parse( json );
			this._project.loadFromV4JSON( parsed );
			this._rebuildAllMeshes();
			return true;

		} catch ( err ) {

			console.warn( '[ProjectStorage] v4 URL param load failed:', err );
			return false;

		}

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
