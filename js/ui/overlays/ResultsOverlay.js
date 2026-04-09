/**
 * ResultsOverlay -- full-screen modal overlay for post-race results.
 *
 * Uses a ModalService-style full-screen pattern (tab bar is hidden during
 * results per R17b). Shows race results with RACE AGAIN and QUIT buttons.
 *
 * RACE AGAIN behaviour per mode:
 *   SOLO / ONLINE -- immediately queues a new race via services.startRace()
 *   PRIVATE       -- returns to LobbyOverlay (caller handles this)
 *
 * QUIT -- closes overlay, restores tab bar, calls switchTab('race')
 *
 * Lifecycle:
 *   constructor(container, services, results)
 *   show()     -- display the overlay
 *   hide()     -- dismiss the overlay
 *   dispose()  -- full cleanup
 */

import { Settings }       from '../../Settings.js';
import { getRandomTrack } from '../../TrackRegistry.js';

export class ResultsOverlay {

	static _cssInjected = false;

	/**
	 * @param {HTMLElement} container  Shell element to append overlay into
	 * @param {object}      services   AppShell service bag
	 * @param {object}      results    Race results data
	 */
	constructor( container, services, results ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {object} */
		this._results = results || {};

		/** @type {HTMLElement | null} */
		this._el = null;

		/** @type {boolean} */
		this._visible = false;

		/** @type {Function | null} Callback for restoring tab bar on quit. */
		this._onQuit = null;

		/** @type {Function | null} Callback for RACE AGAIN in PRIVATE mode. */
		this._onRaceAgainPrivate = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS injection
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( ResultsOverlay._cssInjected ) return;
		ResultsOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			.kk-results-overlay {
				position: fixed;
				inset: 0;
				z-index: 500;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				background: rgba(0, 0, 0, 0.85);
				backdrop-filter: blur(8px);
				opacity: 0;
				transition: opacity var(--duration-normal, 300ms) var(--ease-standard, ease);
			}

			.kk-results-overlay--visible {
				opacity: 1;
			}

			.kk-results-overlay__card {
				background: var(--color-bg-surface, #1a1a2e);
				border-radius: var(--radius-lg, 16px);
				padding: var(--space-8, 32px);
				max-width: 28rem;
				width: 90%;
				text-align: center;
				box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
			}

			.kk-results-overlay__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-2xl, 1.75rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-white, #fff);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
				margin: 0 0 var(--space-2, 8px) 0;
			}

			.kk-results-overlay__position {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-4xl, 2.5rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-cta-primary, #4a6cf7);
				margin: 0 0 var(--space-4, 16px) 0;
			}

			.kk-results-overlay__stats {
				list-style: none;
				margin: 0 0 var(--space-6, 24px) 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 8px);
			}

			.kk-results-overlay__stat {
				display: flex;
				justify-content: space-between;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-md, 1rem);
				color: var(--color-ink-200, #ccc);
				padding: var(--space-2, 8px) var(--space-3, 12px);
				background: rgba(255, 255, 255, 0.04);
				border-radius: var(--radius-sm, 4px);
			}

			.kk-results-overlay__stat-label {
				color: var(--color-ink-300, #aaa);
			}

			.kk-results-overlay__stat-value {
				color: var(--color-white, #fff);
				font-weight: var(--weight-semibold, 600);
			}

			.kk-results-overlay__actions {
				display: flex;
				gap: var(--space-3, 12px);
				margin-top: var(--space-4, 16px);
			}

			.kk-results-overlay__btn {
				flex: 1;
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-md, 1rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				border: none;
				border-radius: var(--radius-md, 8px);
				padding: var(--space-3, 12px) var(--space-4, 16px);
				cursor: pointer;
				min-height: var(--hit-target-min, 44px);
				transition: opacity var(--duration-fast, 150ms) var(--ease-standard, ease);
			}

			.kk-results-overlay__btn:active {
				opacity: 0.7;
			}

			.kk-results-overlay__btn--race-again {
				color: var(--color-cta-primary-text, #fff);
				background: var(--color-cta-primary, #4a6cf7);
			}

			.kk-results-overlay__btn--quit {
				color: var(--color-ink-200, #ccc);
				background: rgba(255, 255, 255, 0.08);
			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// DOM construction
	// ---------------------------------------------------------------------------

	_build() {

		const results = this._results;

		const el = document.createElement( 'div' );
		el.className = 'kk-results-overlay';
		el.setAttribute( 'role', 'dialog' );
		el.setAttribute( 'aria-modal', 'true' );
		el.setAttribute( 'aria-label', 'Race results' );

		const card = document.createElement( 'div' );
		card.className = 'kk-results-overlay__card';

		// Title
		const title = document.createElement( 'h2' );
		title.className = 'kk-results-overlay__title';
		title.textContent = 'RACE COMPLETE';
		card.appendChild( title );

		// Position
		const position = document.createElement( 'p' );
		position.className = 'kk-results-overlay__position';
		const pos = results.position ?? 1;
		position.textContent = this._formatPosition( pos );
		card.appendChild( position );

		// Stats
		const stats = document.createElement( 'ul' );
		stats.className = 'kk-results-overlay__stats';

		const statEntries = [
			{ label: 'Total Time', value: results.totalTime ?? '--:--' },
			{ label: 'Best Lap',   value: results.bestLap ?? '--:--' },
			{ label: 'Laps',       value: String( results.laps ?? '-' ) },
		];

		for ( const entry of statEntries ) {

			const li = document.createElement( 'li' );
			li.className = 'kk-results-overlay__stat';

			const labelSpan = document.createElement( 'span' );
			labelSpan.className = 'kk-results-overlay__stat-label';
			labelSpan.textContent = entry.label;
			li.appendChild( labelSpan );

			const valueSpan = document.createElement( 'span' );
			valueSpan.className = 'kk-results-overlay__stat-value';
			valueSpan.textContent = entry.value;
			li.appendChild( valueSpan );

			stats.appendChild( li );

		}

		card.appendChild( stats );

		// Action buttons
		const actions = document.createElement( 'div' );
		actions.className = 'kk-results-overlay__actions';

		const quitBtn = document.createElement( 'button' );
		quitBtn.type = 'button';
		quitBtn.className = 'kk-results-overlay__btn kk-results-overlay__btn--quit';
		quitBtn.textContent = 'QUIT';
		quitBtn.addEventListener( 'click', () => this._handleQuit() );
		actions.appendChild( quitBtn );

		const raceAgainBtn = document.createElement( 'button' );
		raceAgainBtn.type = 'button';
		raceAgainBtn.className = 'kk-results-overlay__btn kk-results-overlay__btn--race-again';
		raceAgainBtn.textContent = 'RACE AGAIN';
		raceAgainBtn.addEventListener( 'click', () => this._handleRaceAgain() );
		actions.appendChild( raceAgainBtn );

		card.appendChild( actions );
		el.appendChild( card );

		this._el = el;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Display the results overlay.
	 */
	show() {

		this._visible = true;

		if ( this._el && ! this._el.parentNode ) {

			this._container.appendChild( this._el );

		}

		requestAnimationFrame( () => {

			if ( this._el ) {

				this._el.classList.add( 'kk-results-overlay--visible' );

			}

		} );

	}

	/**
	 * Hide the results overlay.
	 */
	hide() {

		if ( ! this._visible ) return;
		this._visible = false;

		if ( this._el ) {

			this._el.classList.remove( 'kk-results-overlay--visible' );

		}

		setTimeout( () => {

			if ( this._el && this._el.parentNode ) {

				this._el.parentNode.removeChild( this._el );

			}

		}, 350 );

	}

	/**
	 * Full cleanup.
	 */
	dispose() {

		this._visible = false;

		if ( this._el && this._el.parentNode ) {

			this._el.parentNode.removeChild( this._el );

		}

		this._el = null;
		this._onQuit = null;
		this._onRaceAgainPrivate = null;

	}

	// ---------------------------------------------------------------------------
	// Callbacks
	// ---------------------------------------------------------------------------

	/**
	 * Set callback for QUIT button (tab bar restore + switchTab).
	 * @param {Function} fn
	 */
	set onQuit( fn ) { this._onQuit = fn; }

	/**
	 * Set callback for RACE AGAIN in PRIVATE mode (return to lobby).
	 * @param {Function} fn
	 */
	set onRaceAgainPrivate( fn ) { this._onRaceAgainPrivate = fn; }

	// ---------------------------------------------------------------------------
	// Internal handlers
	// ---------------------------------------------------------------------------

	_handleQuit() {

		this.hide();

		if ( this._onQuit ) {

			this._onQuit();

		}

	}

	_handleRaceAgain() {

		const mode = this._results.mode || this._services.selectedMode || 'solo';

		this.hide();

		if ( mode === 'private' && this._onRaceAgainPrivate ) {

			// PRIVATE mode: return to lobby overlay
			this._onRaceAgainPrivate();
			return;

		}

		// SOLO / ONLINE: immediately queue a new race
		const settings = new Settings();
		const vehicleId = settings.getSelectedKartId();
		const track = getRandomTrack();

		this._services.startRace( {
			mode,
			trackData: track.cells,
			decoCells: track.decoCells,
			vehicleId,
		} );

	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/**
	 * @param {number} pos
	 * @returns {string}
	 */
	_formatPosition( pos ) {

		const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
		const suffix = suffixes[ pos ] || 'th';
		return `${pos}${suffix} Place`;

	}

}
