// ─── TileLibrary ─────────────────────────────────────────────────────────────
// Registry of tile definitions, categories, and loaded Three.js models.
// Wraps TrackModelConfig for model paths. All services access tile info here.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTrackModelConfig, getTrackTileSet } from '../../TrackModelConfig.js';
import { applyTrackThemeToObject3D } from '../../TrackThemeApplier.js';
import { DEFAULT_TRACK_THEME_ID, normalizeTrackThemeId } from '../../TrackThemeRegistry.js';
import {
	applyTrackAppearanceToObject3D,
	getAppearanceTargetForModel,
	tagObject3DAppearanceTarget,
} from '../../TrackAppearanceApplier.js';
import { SPECIAL_EDITOR_MODEL_DEFS } from '../constants/EditorAssetIds.js';

const MODEL_FALLBACKS = {
	'trk-jump-medium': 'trk-jump-long',
};

// ── Tile definitions ──

const TRACK_TILES = [
	// ── Road Pieces ──
	{ id: 'trk-straight',           index: 0,  name: 'Straight',           category: 'road',   footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: true },
	{ id: 'trk-corner-1x1',         index: 1,  name: 'Corner 1x1',        category: 'turn',   footprint: { w: 1, h: 1 }, exits: [ 'S', 'W' ], canElevate: false, supportsCurve: true },
	{ id: 'trk-chicane-3x3-l',      index: 15, name: 'Chicane 3x3',       category: 'road',   footprint: { w: 3, h: 3 }, exits: [ 'N', 'S' ], canElevate: false },

	// ── Turns / Curves ──
	{ id: 'trk-curve-2x2-l',        index: 16, name: 'Wide Turn 2x2',     category: 'turn',   footprint: { w: 2, h: 2 }, exits: [ 'S', 'W' ], canElevate: false },
	{ id: 'trk-curve-3x3-l',        index: 17, name: 'Turn 3x3',          category: 'turn',   footprint: { w: 3, h: 3 }, exits: [ 'S', 'W' ], canElevate: false },
	{ id: 'trk-curve-3x3-wide-l',   index: 18, name: 'Wide Turn 3x3',     category: 'turn',   footprint: { w: 3, h: 3 }, exits: [ 'S', 'W' ], canElevate: false },

	// ── Ramps ──
	{ id: 'trk-ramp-up-2p5',        index: 19, name: 'Ramp Up 2.5m',      category: 'ramp',   footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-ramp-up-5',          index: 20, name: 'Ramp Up 5m',         category: 'ramp',   footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-ramp-up-2p5-smooth', index: 21, name: 'Smooth Ramp 2.5m',  category: 'ramp',   footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-ramp-up-5-smooth',   index: 22, name: 'Smooth Ramp 5m',    category: 'ramp',   footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },

	// ── Junctions ──
	{ id: 'trk-junction-y',         index: 4,  name: 'Y-Split',           category: 'junction', footprint: { w: 3, h: 3 }, exits: null, canElevate: false },
	{ id: 'trk-junction-t',         index: 5,  name: 'T-Junction',        category: 'junction', footprint: { w: 3, h: 3 }, exits: null, canElevate: false },
	{ id: 'trk-junction-4way',      index: 6,  name: '4-Way',             category: 'junction', footprint: { w: 3, h: 3 }, exits: null, canElevate: false },

	// ── Bridges ──
	{ id: 'trk-bridge-entry',       index: 7,  name: 'Bridge Entry',      category: 'bridge',  footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-bridge-mid',         index: 8,  name: 'Bridge Middle',     category: 'bridge',  footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },

	// ── Tunnels ──
	{ id: 'trk-tunnel-entry',       index: 9,  name: 'Tunnel Entry',      category: 'tunnel',  footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-tunnel-mid',         index: 10, name: 'Tunnel Middle',     category: 'tunnel',  footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-tunnel-exit',        index: 11, name: 'Tunnel Exit',       category: 'tunnel',  footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-tunnel-open',        index: 12, name: 'Tunnel Open',       category: 'tunnel',  footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },

	// ── Jumps ──
	{ id: 'trk-jump-short',         index: 13, name: 'Jump (Short)',      category: 'jump',    footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-jump-medium',        index: 14, name: 'Jump (Medium)',     category: 'jump',    footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },
	{ id: 'trk-jump-long',          index: 14, name: 'Jump (Long)',       category: 'jump',    footprint: { w: 1, h: 1 }, exits: [ 'N', 'S' ], canElevate: false },

	// ── Start / Finish ──
	{ id: 'trk-finish',             index: 3,  name: 'Start/Finish',      category: 'start',   footprint: { w: 1, h: 3 }, exits: [ 'N', 'S' ], canElevate: false, unique: true },
];

const DECOR_TILES = [
	{ id: 'decoration-buildings-1', index: 0, name: 'Buildings A', category: 'decor', footprint: { w: 1, h: 1 } },
	{ id: 'decoration-buildings-2', index: 1, name: 'Buildings B', category: 'decor', footprint: { w: 1, h: 1 } },
	{ id: 'decoration-empty-night', index: 2, name: 'Empty Ground', category: 'decor', footprint: { w: 1, h: 1 } },
];

// Category display order
const CATEGORIES = [
	{ id: 'road',     name: 'Road Pieces' },
	{ id: 'turn',     name: 'Turns / Curves' },
	{ id: 'ramp',     name: 'Ramps' },
	{ id: 'junction', name: 'Junctions' },
	{ id: 'bridge',   name: 'Bridges' },
	{ id: 'tunnel',   name: 'Tunnels' },
	{ id: 'jump',     name: 'Jumps' },
	{ id: 'start',    name: 'Start / Finish' },
	{ id: 'decor',    name: 'Decorations' },
];


export class TileLibrary {

	constructor() {

		/** @type {Map<string, import('three').Object3D>} model name -> loaded scene */
		this._modelCache = new Map();

		this._tileSet = getTrackTileSet( window.location.search );
		this._loader = new GLTFLoader();
		this._activeThemeId = DEFAULT_TRACK_THEME_ID;
		this._themeApplyQueue = Promise.resolve();

		/** @type {Map<string, object>} tile id -> definition */
		this._defMap = new Map();
		for ( const def of TRACK_TILES ) this._defMap.set( def.id, def );
		for ( const def of DECOR_TILES ) this._defMap.set( def.id, def );
		for ( const def of SPECIAL_EDITOR_MODEL_DEFS ) this._defMap.set( def.id, def );

	}

	// ── Definitions ──

	/** @returns {Array<object>} All track tile definitions. */
	getTrackTiles() { return TRACK_TILES; }

	/** @returns {Array<object>} All decor tile definitions. */
	getDecorTiles() { return DECOR_TILES; }

	/** @returns {Array<object>} Category list. */
	getCategories() { return CATEGORIES; }

	/**
	 * Get tiles for a specific category.
	 * @param {string} categoryId
	 * @returns {Array<object>}
	 */
	getTilesByCategory( categoryId ) {

		return TRACK_TILES.filter( t => t.category === categoryId );

	}

	/**
	 * Get tile definition by id.
	 * @param {string} tileId
	 * @returns {object|null}
	 */
	getDefinition( tileId ) {

		return this._defMap.get( tileId ) ?? null;

	}

	// ── Model loading ──

	/**
	 * Preload all track tile models.
	 * @param {function} [onProgress] Called with (loaded, total) counts.
	 * @returns {Promise<void>}
	 */
	async preloadAll( onProgress ) {

		// Collect unique model names to load
		const modelNames = new Set();

		for ( const def of TRACK_TILES ) {

			modelNames.add( def.id );

		}

		// Also preload elevation/ramp model variants
		const extraModels = [
			'trk-elev-2p5', 'trk-elev-5',
			'trk-ramp-up-2p5', 'trk-ramp-up-5',
			'trk-ramp-down-2p5', 'trk-ramp-down-5',
			'trk-ramp-up-2p5-smooth', 'trk-ramp-up-5-smooth',
			'trk-ramp-down-2p5-smooth', 'trk-ramp-down-5-smooth',
			'trk-curve-2x2-l', 'trk-curve-3x3-l', 'trk-curve-3x3-wide-l',
		];

		for ( const name of extraModels ) modelNames.add( name );

		// Decor models
		for ( const def of DECOR_TILES ) modelNames.add( def.id );
		for ( const def of SPECIAL_EDITOR_MODEL_DEFS ) modelNames.add( def.id );

		const names = [ ...modelNames ];
		let loaded = 0;

		const loadModelIntoCache = ( requestedName, sourceName ) => {

			const config = getTrackModelConfig( sourceName, this._tileSet );
			return this._loader.loadAsync( 'models/' + config.path ).then( gltf => {

				const scene = gltf.scene;
				return applyTrackThemeToObject3D( scene, this._activeThemeId ).then( () => {

					scene.userData.rotationY = config.rotationY;
					tagObject3DAppearanceTarget( scene, getAppearanceTargetForModel( requestedName ) );
					this._modelCache.set( requestedName, scene );

				} );

			} );

		};

		const promises = names.map( name => {

			const fallbackName = MODEL_FALLBACKS[ name ] ?? null;

			return loadModelIntoCache( name, name ).catch( err => {

				if ( ! fallbackName ) throw err;

				console.warn( `[TileLibrary] Falling back model "${ name }" -> "${ fallbackName }":`, err.message );
				return loadModelIntoCache( name, fallbackName );

			} ).catch( err => {

				console.warn( `[TileLibrary] Failed to load model "${ name }":`, err.message );

			} ).finally( () => {

				loaded ++;
				if ( onProgress ) onProgress( loaded, names.length );

			} );

		} );

		await Promise.all( promises );

	}

	/**
	 * Apply a track theme to all cached models.
	 * Calls are serialized so fast theme switches settle in order.
	 * @param {string} themeId
	 * @returns {Promise<string>}
	 */
	async applyTheme( themeId ) {

		const resolvedThemeId = normalizeTrackThemeId( themeId );
		this._activeThemeId = resolvedThemeId;

		this._themeApplyQueue = this._themeApplyQueue
			.catch( () => {} )
			.then( async () => {

				const tasks = [];
				for ( const scene of this._modelCache.values() ) {

					tasks.push( applyTrackThemeToObject3D( scene, resolvedThemeId ) );

				}

				await Promise.all( tasks );
				return resolvedThemeId;

			} );

		return this._themeApplyQueue;

	}

	async applyAppearance( appearance ) {

		for ( const scene of this._modelCache.values() ) {

			applyTrackAppearanceToObject3D( scene, appearance );

		}

		return appearance;

	}

	animateAppearance( appearance, timeSeconds ) {

		for ( const scene of this._modelCache.values() ) {

			applyTrackAppearanceToObject3D( scene, appearance, timeSeconds );

		}

		return appearance;

	}

	/**
	 * Get a loaded model (original scene, should be cloned before use).
	 * @param {string} modelName
	 * @returns {import('three').Object3D|null}
	 */
	getModel( modelName ) {

		return this._modelCache.get( modelName ) ?? null;

	}

	/**
	 * Clone a model for placement.
	 * @param {string} modelName
	 * @returns {import('three').Object3D|null}
	 */
	cloneModel( modelName ) {

		const original = this._modelCache.get( modelName );
		if ( ! original ) return null;

		const clone = original.clone( true );
		clone.userData.rotationY = original.userData.rotationY;
		return clone;

	}

}
