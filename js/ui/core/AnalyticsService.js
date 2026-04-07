/**
 * AnalyticsService — stub analytics event layer.
 *
 * Responsibilities:
 *   - Provide a typed, named-event interface for all major UI actions.
 *   - Log events to the console in development mode.
 *   - Forward events to a real analytics backend when one is wired in.
 *   - Attach page-view tracking to router navigation.
 *
 * Architecture decisions:
 *   - Stub implementation: no network calls, no external dependency.
 *     Events are queued in memory and logged. A real backend adapter can be
 *     injected via setAdapter() without touching call sites.
 *   - Named event methods (trackStartGameClicked, etc.) are preferred over a
 *     generic track(name, props) call at the call site, so event names and
 *     shapes are centrally defined and easy to audit.
 *   - Two-phase init: constructor takes no args; initialize(options) configures.
 *
 * Event names match the stub list in KART_KIDS_UI_PRD_Codex.md §4.
 */

/** @typedef {{ name: string, props: object, timestamp: number }} AnalyticsEvent */

export class AnalyticsService {

	constructor() {

		/** @type {AnalyticsEvent[]} */
		this._queue = [];

		/** @type {boolean} */
		this._debug = false;

		/** @type {AnalyticsAdapter | null} */
		this._adapter = null;

		/** @type {string | null} */
		this._currentPage = null;

	}

	// ---------------------------------------------------------------------------
	// Init
	// ---------------------------------------------------------------------------

	/**
	 * Configure the service.
	 *
	 * @param {object}  [options]
	 * @param {boolean} [options.debug]    Log events to the console. Default: true in dev.
	 * @param {AnalyticsAdapter} [options.adapter]  Real backend adapter, if available.
	 */
	initialize( { debug, adapter } = {} ) {

		this._debug   = debug ?? ( typeof process === 'undefined' || process.env?.NODE_ENV !== 'production' );
		this._adapter = adapter ?? null;

	}

	/**
	 * Inject a real backend adapter after initialization.
	 * All queued events are flushed to the adapter immediately.
	 *
	 * @param {AnalyticsAdapter} adapter
	 */
	setAdapter( adapter ) {

		this._adapter = adapter;
		this._flush();

	}

	// ---------------------------------------------------------------------------
	// Page tracking
	// ---------------------------------------------------------------------------

	/**
	 * Track a page/route view. Called by RouterService on each navigation.
	 *
	 * @param {string} route  e.g. '/garage'
	 * @param {object} [params]
	 */
	trackPageView( route, params = {} ) {

		this._currentPage = route;
		this._emit( 'page_view', { route, ...params } );

	}

	// ---------------------------------------------------------------------------
	// Named event methods — per PRD §4 analytics stubs
	// ---------------------------------------------------------------------------

	trackStartGameClicked() {

		this._emit( 'start_game_clicked', { page: this._currentPage } );

	}

	trackQuickPlayStarted( { track, mode } = {} ) {

		this._emit( 'quick_play_started', { track, mode, page: this._currentPage } );

	}

	trackLobbyReadyToggled( { ready, lobbyId } = {} ) {

		this._emit( 'lobby_ready_toggled', { ready, lobbyId, page: this._currentPage } );

	}

	trackEventOpened( { eventId, eventName } = {} ) {

		this._emit( 'event_opened', { eventId, eventName, page: this._currentPage } );

	}

	trackRankedQueueStarted( { mode } = {} ) {

		this._emit( 'ranked_queue_started', { mode, page: this._currentPage } );

	}

	trackGarageItemEquipped( { itemId, itemType, slotId } = {} ) {

		this._emit( 'garage_item_equipped', { itemId, itemType, slotId, page: this._currentPage } );

	}

	trackRewardClaimed( { rewardId, source } = {} ) {

		this._emit( 'reward_claimed', { rewardId, source, page: this._currentPage } );

	}

	trackTrackPublished( { trackId, trackName } = {} ) {

		this._emit( 'track_published', { trackId, trackName, page: this._currentPage } );

	}

	trackSettingsChanged( { setting, value } = {} ) {

		this._emit( 'settings_changed', { setting, value, page: this._currentPage } );

	}

	// ---------------------------------------------------------------------------
	// Generic escape hatch for ad-hoc events
	// ---------------------------------------------------------------------------

	/**
	 * Track an arbitrary named event.
	 *
	 * @param {string} name
	 * @param {object} [props]
	 */
	track( name, props = {} ) {

		this._emit( name, props );

	}

	// ---------------------------------------------------------------------------
	// Inspection (useful for tests and debug overlays)
	// ---------------------------------------------------------------------------

	/**
	 * Return all events emitted so far. Useful for assertions in tests.
	 *
	 * @returns {AnalyticsEvent[]}
	 */
	getQueue() {

		return this._queue.slice();

	}

	/** Clear the in-memory queue (does not affect already-flushed events). */
	clearQueue() {

		this._queue.length = 0;

	}

	// ---------------------------------------------------------------------------
	// Internal
	// ---------------------------------------------------------------------------

	/**
	 * @param {string} name
	 * @param {object} props
	 */
	_emit( name, props ) {

		const event = { name, props, timestamp: Date.now() };

		this._queue.push( event );

		if ( this._debug ) {

			console.log( `[Analytics] ${name}`, props );

		}

		if ( this._adapter ) {

			this._sendToAdapter( event );

		}

	}

	_flush() {

		if ( ! this._adapter ) return;

		for ( const event of this._queue ) {

			this._sendToAdapter( event );

		}

	}

	/**
	 * @param {AnalyticsEvent} event
	 */
	_sendToAdapter( event ) {

		try {

			this._adapter.send( event.name, event.props, event.timestamp );

		} catch ( err ) {

			console.warn( '[AnalyticsService] Adapter error:', err );

		}

	}

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} AnalyticsAdapter
 * @property {(name: string, props: object, timestamp: number) => void} send
 */
