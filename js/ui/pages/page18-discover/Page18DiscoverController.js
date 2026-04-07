/**
 * Page18DiscoverController — Community Tracks / Discover.
 *
 * Route: RouteIds.DISCOVER ("/discover")
 *
 * Responsibilities:
 *   - Create and configure Page18DiscoverView.
 *   - Wire PageHeader back button → RouteIds.CREATE.
 *   - Populate track list from MockData.tracks with extended mock data.
 *   - Wire tab filter changes → re-filter track list.
 *   - Wire search input → filter track list by name.
 *   - Wire track card clicks → show track preview.
 *   - Wire PLAY NOW button → RouteIds.LOBBY.
 *   - Emit analytics events.
 *
 * Data: MockData.tracks (synchronous, extended inline).
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page18DiscoverView }    from './Page18DiscoverView.js';
import { RouteIds }              from '../../enums/RouteIds.js';
import { ButtonIds }             from '../../enums/ButtonIds.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';
import { MockData }              from '../../repositories/mocks/MockData.js';

/** Extended track data covering all filter categories. */
const EXTENDED_TRACKS = [
	// Featured
	...MockData.tracks.map( ( t ) => ( { ...t, category: 'featured', favorited: false } ) ),

	// Popular (some overlap with featured is intentional)
	{ id: 'track_drift_canyon',    name: 'Drift Canyon',         creator: 'SpeedKid',   difficulty: 'Hard',   rating: 4.9, plays: 22000, category: 'popular',  favorited: false },
	{ id: 'track_city_rush',       name: 'City Rush',            creator: 'UrbanRacer', difficulty: 'Medium', rating: 4.6, plays: 18500, category: 'popular',  favorited: false },
	{ id: 'track_forest_loop',     name: 'Forest Loop',          creator: 'GreenKart',  difficulty: 'Easy',   rating: 4.4, plays: 14200, category: 'popular',  favorited: false },
	{ id: 'track_neon_tokyo2',     name: 'Neon Tokyo',           creator: 'KartKids',   difficulty: 'Medium', rating: 4.5, plays: 12500, category: 'popular',  favorited: false },

	// Newest
	{ id: 'track_sky_bridge',      name: 'Sky Bridge',           creator: 'CloudKart',  difficulty: 'Hard',   rating: 3.9, plays: 420,   category: 'newest',   favorited: false },
	{ id: 'track_volcano_run',     name: 'Volcano Run',          creator: 'HotWheels1', difficulty: 'Expert', rating: 4.1, plays: 185,   category: 'newest',   favorited: false },
	{ id: 'track_ice_flats',       name: 'Ice Flats',            creator: 'FrostRacer', difficulty: 'Medium', rating: 3.7, plays: 97,    category: 'newest',   favorited: false },
	{ id: 'track_mini_mall',       name: 'Mini Mall Rush',       creator: 'User_99',    difficulty: 'Easy',   rating: 4.0, plays: 62,    category: 'newest',   favorited: false },

	// Friends
	{ id: 'track_friends_collab',  name: 'Friends Collab',       creator: 'Street Racer', difficulty: 'Medium', rating: 4.3, plays: 850,  category: 'friends', favorited: true  },
	{ id: 'track_rally_circuit',   name: 'Rally Circuit',        creator: 'Kid Karter',   difficulty: 'Hard',   rating: 4.7, plays: 1200, category: 'friends', favorited: false },
	{ id: 'track_neon_friends',    name: 'Neon Speedway',        creator: 'Sparkyzz',     difficulty: 'Medium', rating: 4.2, plays: 640,  category: 'friends', favorited: true  },

	// Favorites
	{ id: 'track_fav_tokyo',       name: 'Neon Tokyo',           creator: 'KartKids',   difficulty: 'Medium', rating: 4.5, plays: 12500, category: 'favorites', favorited: true },
	{ id: 'track_fav_arena',       name: 'Beastside Arena',      creator: 'KartKids',   difficulty: 'Hard',   rating: 4.8, plays: 8900,  category: 'favorites', favorited: true },
	{ id: 'track_fav_friends',     name: 'Friends Collab',       creator: 'Street Racer', difficulty: 'Medium', rating: 4.3, plays: 850,  category: 'favorites', favorited: true },
];

export class Page18DiscoverController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page18DiscoverView} */
		this._view = null;

		/** @type {string} Active filter tab. */
		this._activeCategory = 'featured';

		/** @type {string} Current search query. */
		this._searchQuery = '';

		/** @type {object|null} Currently selected track. */
		this._selectedTrack = null;

		/** @type {Array<object>} Full track list. */
		this._tracks = [];

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page18DiscoverView();
		this._tracks = EXTENDED_TRACKS.map( ( t ) => ( { ...t } ) );

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → Create Hub
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this.navigate( RouteIds.CREATE );

		} );

		// Tab filter change
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			const catMap = {
				[ ButtonIds.DISCOVER_TAB_FEATURED  ]: 'featured',
				[ ButtonIds.DISCOVER_TAB_POPULAR   ]: 'popular',
				[ ButtonIds.DISCOVER_TAB_NEWEST    ]: 'newest',
				[ ButtonIds.DISCOVER_TAB_FRIENDS   ]: 'friends',
				[ ButtonIds.DISCOVER_TAB_FAVORITES ]: 'favorites',
			};
			this._activeCategory = catMap[ tabId ] ?? 'featured';
			this._renderTrackList();

		} );

		// Search input
		this._addListener( view.root, 'input', ( e ) => {

			if ( e.target.dataset.action !== ButtonIds.DISCOVER_SEARCH ) return;
			this._searchQuery = e.target.value.trim().toLowerCase();
			this._analytics?.track( EventIds.COMMUNITY_TRACK_SEARCHED, { query: this._searchQuery } );
			this._renderTrackList();

		} );

		// Track card click → preview
		this._addListener( view.root, 'click', ( e ) => {

			const card = e.target.closest( '[data-discover-track-id]' );
			if ( ! card ) return;

			const trackId = card.dataset.discoverTrackId;
			const track   = this._tracks.find( ( t ) => t.id === trackId );
			if ( ! track ) return;

			this._selectedTrack = track;
			view.setTrackPreview( track );

		} );

		// PLAY NOW
		this._addListener( view.playNowBtn.el, 'click', () => {

			if ( ! this._selectedTrack ) return;
			this._analytics?.track( EventIds.COMMUNITY_TRACK_PLAYED, { trackId: this._selectedTrack.id } );
			this.navigate( RouteIds.LOBBY );

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		this._renderTrackList();
		this._view.mount( container );

		this._analytics?.track( EventIds.PAGE_VIEWED, { page: PageIds.DISCOVER } );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	_renderTrackList() {

		let filtered = this._tracks.filter( ( t ) => t.category === this._activeCategory );

		if ( this._searchQuery ) {
			filtered = filtered.filter( ( t ) =>
				t.name.toLowerCase().includes( this._searchQuery ) ||
				t.creator.toLowerCase().includes( this._searchQuery )
			);
		}

		this._view.setTrackList( filtered );

		// Auto-preview first track on category change
		if ( filtered.length > 0 && ! this._selectedTrack ) {
			this._selectedTrack = filtered[ 0 ];
			this._view.setTrackPreview( filtered[ 0 ] );
		} else if ( filtered.length > 0 ) {
			// Check if selected track is still in the filtered list
			const stillVisible = filtered.find( ( t ) => t.id === this._selectedTrack?.id );
			if ( ! stillVisible ) {
				this._selectedTrack = filtered[ 0 ];
				this._view.setTrackPreview( filtered[ 0 ] );
			}
		}

	}

}
