/**
 * Page16CreateHubController — Track Builder / Create Hub.
 *
 * Route: RouteIds.CREATE ("/create")
 *
 * Responsibilities:
 *   - Create and configure Page16CreateHubView.
 *   - Wire page-level tab bar (TRACK BUILDER, KART CUSTOMIZER, STREET ART STUDIO,
 *     COMMUNITY HUB) — tab switching is view-local, handled here for analytics.
 *   - Wire left-sidebar CTA buttons to their routes and library tabs.
 *   - Wire EDIT TRACK buttons on track cards → RouteIds.EDITOR.
 *   - Wire FEATURED TRACKS section heading → RouteIds.DISCOVER.
 *   - Wire PLAY buttons on featured track cards → RouteIds.LOBBY.
 *   - Wire STARTER TEMPLATES button → template picker modal (placeholder).
 *   - Wire PageHeader back → RouteIds.HOME.
 *   - Populate track card data from MockData.tracks.
 *   - Emit analytics page view on mount.
 *
 * Data: MockData.tracks (synchronous, no async required).
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page16CreateHubView }   from './Page16CreateHubView.js';
import { RouteIds }              from '../../enums/RouteIds.js';
import { ButtonIds }             from '../../enums/ButtonIds.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';
import { MockData }              from '../../repositories/mocks/MockData.js';

export class Page16CreateHubController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page16CreateHubView} */
		this._view = null;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page16CreateHubView();

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → /home
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.CREATE_HUB } );
			this.navigate( RouteIds.HOME );

		} );

		// Page-level tab change (TRACK BUILDER / KART CUSTOMIZER / etc.)
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { tabId, page: PageIds.CREATE_HUB } );
			// Tab content switching is handled inside the view; future tabs may
			// navigate to sibling routes.

		} );

		// Left-sidebar CTAButton delegation
		this._addListener( view.root, 'kk:cta-button:click', ( e ) => {

			this._handleSidebarAction( e.detail.actionId );

		} );

		// EDIT TRACK cards — delegated from MY RECENT TRACKS grid
		this._addListener( view.myRecentTracksEl, 'click', ( e ) => {

			const btn = e.target.closest( '[data-action="create_edit_track"]' );
			if ( ! btn ) return;

			const trackId = btn.dataset.trackId ?? null;
			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, {
				button:  ButtonIds.CREATE_EDIT_TRACK,
				trackId,
			} );
			this.navigate( RouteIds.EDITOR );

		} );

		// PLAY buttons — delegated from FEATURED TRACKS grid
		this._addListener( view.featuredTracksEl, 'click', ( e ) => {

			const btn = e.target.closest( '[data-action="create_featured_play"]' );
			if ( ! btn ) return;

			const trackId = btn.dataset.trackId ?? null;
			this._analytics?.track( EventIds.COMMUNITY_TRACK_PLAYED, { trackId } );
			this.navigate( RouteIds.LOBBY );

		} );

		// FEATURED TRACKS section heading → /discover
		this._addListener( view.featuredHeadingBtn, 'click', () => {

			this._analytics?.track( EventIds.NAV_ITEM_CLICKED, {
				button: ButtonIds.CREATE_FEATURED_TRACKS,
			} );
			this.navigate( RouteIds.DISCOVER );

		} );

		// Keyboard activate on heading button
		this._addListener( view.featuredHeadingBtn, 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				view.featuredHeadingBtn.click();
			}

		} );

	}

	loadData() {

		// MockData is synchronous.
		return Promise.resolve();

	}

	render( container ) {

		const view   = this._view;
		const tracks = MockData.tracks;

		// MY RECENT TRACKS: first 3 tracks
		view.setRecentTracks( tracks.slice( 0, 3 ) );

		// FEATURED TRACKS: all tracks (grid wraps at 3-wide)
		view.setFeaturedTracks( tracks );

		view.mount( container );

		this._analytics?.trackPageView( PageIds.CREATE_HUB );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	/**
	 * Route left-sidebar button actions.
	 *
	 * @param {string} actionId
	 */
	_handleSidebarAction( actionId ) {

		switch ( actionId ) {

			case ButtonIds.CREATE_NEW_TRACK:
				this._analytics?.track( EventIds.NEW_TRACK_STARTED );
				this.navigate( RouteIds.EDITOR );
				break;

			case ButtonIds.CREATE_TAB_MY_TRACKS:
			case ButtonIds.CREATE_TAB_DRAFTS:
			case ButtonIds.CREATE_TAB_PUBLISHED:
				// Internal library filter — view handles visibility; analytics only here
				this._analytics?.track( EventIds.NAV_ITEM_CLICKED, { button: actionId } );
				break;

			case ButtonIds.CREATE_STARTER_TEMPLATES:
				this._analytics?.track( EventIds.NAV_ITEM_CLICKED, {
					button: ButtonIds.CREATE_STARTER_TEMPLATES,
				} );
				this.openModal( {
					title:   'STARTER TEMPLATES',
					message: 'Template picker coming soon.',
				} );
				break;

			default:
				break;

		}

	}

}
