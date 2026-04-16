/**
 * Page04PlayModesView — Play Modes.
 *
 * Route: RouteIds.PLAY ("/play")
 *
 * Layout: full-height page with three stacked mode buttons.
 *
 * Two states:
 *   1. Mode selection — three stacked cards: Race, Free Play, Party
 *   2. Free Play track picker — list of available tracks with Start Race button
 *
 * Public API consumed by Page04PlayModesController:
 *   showModeSelection()
 *   showSoloTrackPicker(tracks[])
 *   getBtnByAction(actionId)
 */

import { PageViewBase }     from '../../core/PageViewBase.js';
import { PageHeader }       from '../../components/PageHeader.js';
import { CTAButton }        from '../../components/CTAButton.js';

export class Page04PlayModesView extends PageViewBase {

	constructor() {

		super( 'page-play-modes' );

		/** @type {PageHeader} */
		this._pageHeader = null;

		/** @type {HTMLElement} */
		this._bodyEl = null;

		/** @type {HTMLElement} mode selection panel */
		this._modeSelectionEl = null;

		/** @type {HTMLElement} solo track picker panel */
		this._soloPickerEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page04PlayModesView._cssInjected ) return;
		Page04PlayModesView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-play-modes {
				display: flex;
				flex-direction: column;
				min-height: 100vh;
			}

			/* ------------------------------------------------------------------ */
			/* PageHeader padding                                                  */
			/* ------------------------------------------------------------------ */

			.page-play-modes .kk-page-header {
				padding-left: var(--page-padding-x, 1.5rem);
				padding-right: var(--page-padding-x, 1.5rem);
			}

			/* ------------------------------------------------------------------ */
			/* Body — centered content area                                        */
			/* ------------------------------------------------------------------ */

			.page-play-modes__body {
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--space-6, 1.5rem) var(--page-padding-x, 1.5rem);
			}

			.page-play-modes__solo-picker {
				display: flex;
				flex-direction: column;
				align-items: center;
				width: 100%;
				max-width: 40rem;
			}

			/* ------------------------------------------------------------------ */
			/* Mode buttons container                                              */
			/* ------------------------------------------------------------------ */

			.page-play-modes__buttons {
				display: flex;
				flex-direction: column;
				gap: var(--space-4, 1rem);
				max-width: 400px;
				width: 100%;
			}

			/* ------------------------------------------------------------------ */
			/* Oversized CTA — mirrors home page QUICK PLAY style                  */
			/* ------------------------------------------------------------------ */

			.page-play-modes__mode-btn.kk-cta-button {
				width: 100%;
				justify-content: center;
			}

			/* ------------------------------------------------------------------ */
			/* Sub-view header with back button                                    */
			/* ------------------------------------------------------------------ */

			.page-play-modes__sub-header {
				display: flex;
				align-items: center;
				gap: var(--space-3, 0.75rem);
				margin-bottom: var(--space-4, 1rem);
				width: 100%;
			}

			.page-play-modes__sub-title {
				flex: 1;
			}

			/* ------------------------------------------------------------------ */
			/* Track list (solo mode)                                              */
			/* ------------------------------------------------------------------ */

			.page-play-modes__track-list {
				width: 100%;
				max-width: 480px;
				margin-bottom: var(--space-4, 1rem);
			}

			/* ------------------------------------------------------------------ */
			/* Start race button (solo)                                            */
			/* ------------------------------------------------------------------ */

			.page-play-modes__start-race {
				width: 100%;
				max-width: 480px;
			}

			.page-play-modes__start-race .kk-cta-button {
				width: 100%;
				justify-content: center;
			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'main' );
		root.setAttribute( 'aria-label', 'Play Modes selection' );

		// ----- PageHeader -----
		this._pageHeader = new PageHeader( {
			title:    'PLAY MODES',
			showBack: true,
		} );
		root.appendChild( this._pageHeader.el );

		// ----- Body -----
		this._bodyEl = document.createElement( 'div' );
		this._bodyEl.className = 'page-play-modes__body';
		this._registerSection( 'body', this._bodyEl );
		root.appendChild( this._bodyEl );

		// Build panels (only one visible at a time)
		this._modeSelectionEl = this._buildModeSelection();
		this._soloPickerEl = document.createElement( 'div' );
		this._soloPickerEl.className = 'page-play-modes__solo-picker';
		this._soloPickerEl.hidden = true;

		this._bodyEl.appendChild( this._modeSelectionEl );
		this._bodyEl.appendChild( this._soloPickerEl );

	}

	/**
	 * Build the primary mode selection panel with three stacked CTAButtons.
	 *
	 * @returns {HTMLElement}
	 */
	_buildModeSelection() {

		const container = document.createElement( 'div' );
		container.className = 'page-play-modes__buttons';

		const modes = [
			{ label: 'RACE',      actionId: 'mode-race',     variant: 'primary' },
			{ label: 'FREE PLAY', actionId: 'mode-freeplay', variant: 'primary' },
			{ label: 'PARTY',     actionId: 'mode-party',    variant: 'primary' },
		];

		this._modeBtns = [];

		for ( const mode of modes ) {

			const btn = new CTAButton( {
				label:    mode.label,
				variant:  mode.variant,
				actionId: mode.actionId,
			} );
			btn.el.classList.add( 'page-play-modes__mode-btn', 'kk-cta-button--hero' );
			container.appendChild( btn.el );
			this._modeBtns.push( btn );

		}

		return container;

	}


	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the first mode button
		if ( this._modeBtns?.length > 0 ) {

			this._modeBtns[ 0 ].el.focus( { preventScroll: true } );

		}

	}

	// ---------------------------------------------------------------------------
	// Public API — view state switching
	// ---------------------------------------------------------------------------

	/**
	 * Show the primary mode selection (Race / Free Play / Party).
	 */
	showModeSelection() {

		this._modeSelectionEl.hidden = false;
		this._soloPickerEl.hidden = true;

		// Focus the first mode button
		if ( this._modeBtns?.length > 0 ) this._modeBtns[ 0 ].el.focus( { preventScroll: true } );

	}

	/**
	 * Show the solo race track picker.
	 *
	 * @param {ReadonlyArray<{ id: string, name: string, difficulty: string }>} tracks
	 */
	showSoloTrackPicker( tracks ) {

		this._modeSelectionEl.hidden = true;

		// Rebuild the solo picker content
		this._soloPickerEl.innerHTML = '';
		this._soloPickerEl.hidden = false;

		// Sub-header with back
		const header = document.createElement( 'div' );
		header.className = 'page-play-modes__sub-header';

		const backBtn = document.createElement( 'button' );
		backBtn.type = 'button';
		backBtn.className = 'page-play-modes__sub-back kk-ui-back-button';
		backBtn.setAttribute( 'data-action', 'back-to-modes' );
		backBtn.setAttribute( 'aria-label', 'Back to mode selection' );
		backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
		header.appendChild( backBtn );

		const title = document.createElement( 'span' );
		title.className = 'page-play-modes__sub-title kk-ui-section-title';
		title.textContent = 'Solo Race';
		header.appendChild( title );

		this._soloPickerEl.appendChild( header );

		// Track list
		const trackList = document.createElement( 'div' );
		trackList.className = 'page-play-modes__track-list kk-ui-selection-list';
		trackList.setAttribute( 'role', 'listbox' );
		trackList.setAttribute( 'aria-label', 'Available tracks' );

		let selectedId = tracks.length > 0 ? tracks[ 0 ].id : null;

		for ( const track of tracks ) {

			const item = document.createElement( 'button' );
			item.type = 'button';
			item.className = 'kk-ui-selection-row';
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'aria-selected', track.id === selectedId ? 'true' : 'false' );
			item.dataset.trackId = track.id;

			if ( track.id === selectedId ) {

				item.classList.add( 'kk-ui-selection-row--selected' );

			}

			const nameEl = document.createElement( 'span' );
			nameEl.className = 'kk-ui-selection-row__title';
			nameEl.textContent = track.name;
			item.appendChild( nameEl );

			const diffEl = document.createElement( 'span' );
			diffEl.className = 'kk-ui-selection-row__meta';
			diffEl.textContent = track.difficulty;
			item.appendChild( diffEl );

			item.addEventListener( 'click', () => {

				selectedId = track.id;

				// Update selection visuals
				trackList.querySelectorAll( '.kk-ui-selection-row' ).forEach( ( el ) => {

					const isSelected = el.dataset.trackId === selectedId;
					el.classList.toggle( 'kk-ui-selection-row--selected', isSelected );
					el.setAttribute( 'aria-selected', String( isSelected ) );

				} );

				// Dispatch event for the controller
				this._root.dispatchEvent( new CustomEvent( 'kk:track-selected', {
					bubbles: true,
					detail: { trackId: selectedId },
				} ) );

			} );

			trackList.appendChild( item );

		}

		this._soloPickerEl.appendChild( trackList );

		// Dispatch initial selection
		if ( selectedId ) {

			this._root.dispatchEvent( new CustomEvent( 'kk:track-selected', {
				bubbles: true,
				detail: { trackId: selectedId },
			} ) );

		}

		// Start Race button
		const startWrapper = document.createElement( 'div' );
		startWrapper.className = 'page-play-modes__start-race';

		const startBtn = document.createElement( 'button' );
		startBtn.type = 'button';
		startBtn.className = 'kk-cta-button kk-cta-button--primary';
		startBtn.setAttribute( 'data-action', 'start-solo-race' );

		const startLabel = document.createElement( 'span' );
		startLabel.className = 'kk-cta-button__label';
		startLabel.textContent = 'START RACE';
		startBtn.appendChild( startLabel );

		startWrapper.appendChild( startBtn );
		this._soloPickerEl.appendChild( startWrapper );

		// Focus the first track item
		const firstItem = trackList.querySelector( '.kk-ui-selection-row' );
		if ( firstItem ) firstItem.focus( { preventScroll: true } );

	}


	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._pageHeader?.dispose();
		this._pageHeader = null;

		this._modeBtns?.forEach( ( b ) => b.dispose() );
		this._modeBtns = null;

		this._bodyEl = null;
		this._modeSelectionEl = null;
		this._soloPickerEl = null;

		super.dispose();

	}

}

Page04PlayModesView._cssInjected = false;
