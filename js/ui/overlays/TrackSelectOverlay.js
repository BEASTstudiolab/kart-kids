/**
 * TrackSelectOverlay — full-screen overlay for track selection.
 *
 * Opens after pressing PLAY in FREE PLAY or PARTY mode.
 * Uses the TrackBrowser component for browse/select/minimap.
 * Has a GO button that fires the onConfirm callback with the selected track.
 *
 * Lifecycle:
 *   constructor(container, services)
 *   show(onConfirm)   — display overlay, call onConfirm(trackData) when GO is tapped
 *   hide()            — dismiss overlay
 *   dispose()         — full cleanup
 */

import { TrackBrowser }   from '../components/TrackBrowser.js';
import { HudButton }      from '../components/HudButton.js';
import { Settings }        from '../../Settings.js';
import { getTrackById, getTracks } from '../../TrackRegistry.js';
import { decodeCells }     from '../../TrackCodec.js';
import { getSavedTracks }  from '../../editor/Persistence.js';

export class TrackSelectOverlay {

	static _cssInjected = false;

	/**
	 * @param {HTMLElement} container  Shell element to append overlay into.
	 * @param {object}      services   AppShell service bag.
	 */
	constructor( container, services ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {TrackBrowser | null} */
		this._browser = null;

		/** @type {HudButton | null} */
		this._goBtn = null;

		/** @type {HTMLElement | null} */
		this._overlay = null;

		/** @type {Function | null} */
		this._onConfirm = null;

		this._injectCSS();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( TrackSelectOverlay._cssInjected ) return;
		TrackSelectOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			.kk-track-select {
				position: fixed;
				inset: 0;
				z-index: 45;
				display: flex;
				flex-direction: column;
				background: rgba( 10, 10, 10, 0.92 );
				backdrop-filter: blur( 12px );
				-webkit-backdrop-filter: blur( 12px );
				opacity: 0;
				transition: opacity 0.25s ease;
				pointer-events: auto;
			}

			.kk-track-select--visible {
				opacity: 1;
			}

			/* ── Header bar ──────────────────────────────────────────── */

			.kk-track-select__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
				padding-top: calc( var(--space-4, 1rem) + 3.5rem );
				border-bottom: 1px solid rgba( 255, 255, 255, 0.08 );
			}

			.kk-track-select__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-xl, 1.375rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				color: var(--color-white, #fff);
			}

			.kk-track-select__back {
				background: none;
				border: none;
				color: var(--color-ink-300, #aaa);
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.1em);
				cursor: pointer;
				padding: var(--space-2) var(--space-4);
				transition: color 0.15s ease;
			}

			.kk-track-select__back:hover {
				color: var(--color-white, #fff);
			}

			/* ── Browser area ────────────────────────────────────────── */

			.kk-track-select__body {
				flex: 1;
				overflow-y: auto;
				overflow-x: hidden;
				padding: var(--space-4, 1rem);
			}

			/* ── Footer with GO button ───────────────────────────────── */

			.kk-track-select__footer {
				display: flex;
				justify-content: center;
				padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
				border-top: 1px solid rgba( 255, 255, 255, 0.08 );
			}

			.kk-track-select__footer .kk-hud-button {
				min-width: 14rem;
			}

			@media ( prefers-reduced-motion: reduce ) {

				.kk-track-select {
					transition: none;
				}

			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Show / Hide
	// ---------------------------------------------------------------------------

	/**
	 * Show the track selection overlay.
	 *
	 * @param {Function} onConfirm  Called with the resolved track data when GO is tapped.
	 */
	show( onConfirm ) {

		this._onConfirm = onConfirm;

		if ( this._overlay ) {

			this._overlay.remove();

		}

		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-track-select';

		// Header
		const header = document.createElement( 'div' );
		header.className = 'kk-track-select__header';

		const title = document.createElement( 'div' );
		title.className = 'kk-track-select__title';
		title.textContent = 'SELECT TRACK';
		header.appendChild( title );

		const backBtn = document.createElement( 'button' );
		backBtn.type = 'button';
		backBtn.className = 'kk-track-select__back';
		backBtn.textContent = 'BACK';
		backBtn.addEventListener( 'click', () => this.hide() );
		header.appendChild( backBtn );

		overlay.appendChild( header );

		// Body — TrackBrowser
		const body = document.createElement( 'div' );
		body.className = 'kk-track-select__body';

		this._browser = new TrackBrowser( body, {
			onTrackSelected: ( trackId ) => {

				const settings = new Settings();
				settings.setSelectedTrackId( trackId );

			},
			showManageActions: false,
		} );

		overlay.appendChild( body );

		// Footer — GO button
		const footer = document.createElement( 'div' );
		footer.className = 'kk-track-select__footer';

		this._goBtn = new HudButton( {
			text:  'GO!',
			color: '--color-accent-orange',
			onClick: () => this._handleGo(),
		} );

		footer.appendChild( this._goBtn.el );
		overlay.appendChild( footer );

		this._overlay = overlay;
		this._container.appendChild( overlay );

		// Fade in
		requestAnimationFrame( () => {

			overlay.classList.add( 'kk-track-select--visible' );

		} );

	}

	/**
	 * Hide and clean up the overlay.
	 */
	hide() {

		if ( ! this._overlay ) return;

		this._overlay.classList.remove( 'kk-track-select--visible' );

		// Remove after transition
		setTimeout( () => {

			if ( this._browser ) {

				this._browser.dispose();
				this._browser = null;

			}

			if ( this._goBtn ) {

				this._goBtn.dispose();
				this._goBtn = null;

			}

			if ( this._overlay && this._overlay.parentNode ) {

				this._overlay.parentNode.removeChild( this._overlay );

			}

			this._overlay = null;
			this._onConfirm = null;

		}, 300 );

	}

	/**
	 * Full cleanup.
	 */
	dispose() {

		this.hide();

	}

	// ---------------------------------------------------------------------------
	// Internal
	// ---------------------------------------------------------------------------

	/**
	 * Handle GO button tap — resolve selected track and call onConfirm.
	 */
	_handleGo() {

		const track = this._resolveSelectedTrack();
		const callback = this._onConfirm;

		// Remove overlay immediately — it's position:fixed and would cover
		// the game canvas if we waited for the fade transition.
		if ( this._overlay ) {

			this._overlay.remove();
			this._overlay = null;

		}

		if ( this._browser ) {

			this._browser.dispose();
			this._browser = null;

		}

		if ( this._goBtn ) {

			this._goBtn.dispose();
			this._goBtn = null;

		}

		this._onConfirm = null;

		if ( callback ) {

			callback( track );

		}

	}

	/**
	 * Resolve the selected track from Settings.
	 * Falls back to the first built-in track if the selected track is missing.
	 *
	 * @returns {{ name: string, cells: Array, decoCells: Array|undefined, source: string }}
	 */
	_resolveSelectedTrack() {

		const settings = new Settings();
		const trackId = settings.getSelectedTrackId();

		// User-created track
		if ( trackId && trackId.startsWith( 'user:' ) ) {

			const trackName = trackId.slice( 5 );
			const saved = getSavedTracks().find( ( t ) => t.name === trackName );

			if ( saved ) {

				return {
					name:     saved.name,
					cells:    decodeCells( saved.cells ),
					decoCells: undefined,
					source:   'custom',
				};

			}

		}

		// Built-in track
		const builtIn = getTrackById( trackId );

		if ( builtIn ) {

			return {
				name:     builtIn.name,
				cells:    builtIn.cells,
				decoCells: builtIn.decoCells,
				source:   'official',
			};

		}

		// Fallback
		const fallback = getTracks()[ 0 ];

		if ( ! fallback ) {

			return { name: 'Unknown', cells: [], decoCells: undefined, source: 'fallback' };

		}

		return {
			name:     fallback.name,
			cells:    fallback.cells,
			decoCells: fallback.decoCells,
			source:   'official',
		};

	}

}
