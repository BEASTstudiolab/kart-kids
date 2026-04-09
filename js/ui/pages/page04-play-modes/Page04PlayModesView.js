/**
 * Page04PlayModesView — Play Modes.
 *
 * Route: RouteIds.PLAY ("/play")
 *
 * Layout: full-height page with mode selection cards.
 *
 * Three states:
 *   1. Mode selection — two primary cards: Solo Race and Multiplayer
 *   2. Solo track picker — list of available tracks with Start Race button
 *   3. Multiplayer options — Quick Play and Private Lobby sub-cards
 *
 * Public API consumed by Page04PlayModesController:
 *   showModeSelection()
 *   showSoloTrackPicker(tracks[])
 *   showMultiplayerOptions()
 *   getBtnByAction(actionId)
 */

import { PageViewBase }     from '../../core/PageViewBase.js';
import { PageHeader }       from '../../components/PageHeader.js';

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

		/** @type {HTMLElement} multiplayer options panel */
		this._multiplayerEl = null;

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

			/* ------------------------------------------------------------------ */
			/* Mode cards container                                                */
			/* ------------------------------------------------------------------ */

			.page-play-modes__cards {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: var(--space-6, 1.5rem);
				max-width: 640px;
				width: 100%;
			}

			.page-play-modes__cards--single {
				grid-template-columns: 1fr;
				max-width: 400px;
			}

			/* ------------------------------------------------------------------ */
			/* Mode card                                                           */
			/* ------------------------------------------------------------------ */

			.kk-play-mode-card {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3, 0.75rem);
				padding: var(--space-8, 2rem) var(--space-6, 1.5rem);
				background: var(--color-ink-800, #1a1a1a);
				border: 2px solid var(--color-ink-600, #404040);
				border-radius: var(--radius-lg, 0.75rem);
				cursor: pointer;
				transition: border-color 0.15s ease, transform 0.1s ease, background 0.15s ease;
				text-align: center;
			}

			.kk-play-mode-card:hover {
				border-color: var(--color-ink-400, #666);
				background: var(--color-ink-700, #252525);
			}

			.kk-play-mode-card:focus-visible {
				outline: 2px solid var(--color-accent-blue, #3498db);
				outline-offset: 2px;
			}

			.kk-play-mode-card:active {
				transform: scale(0.98);
			}

			.kk-play-mode-card__icon {
				font-size: 2.5rem;
				line-height: 1;
			}

			.kk-play-mode-card__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-black, 900);
				color: var(--color-white, #fff);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
			}

			.kk-play-mode-card__desc {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-400, #999);
				line-height: 1.4;
			}

			/* ------------------------------------------------------------------ */
			/* Sub-option cards (smaller, for multiplayer options)                  */
			/* ------------------------------------------------------------------ */

			.kk-play-mode-subcard {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2, 0.5rem);
				padding: var(--space-6, 1.5rem) var(--space-4, 1rem);
				background: var(--color-ink-800, #1a1a1a);
				border: 2px solid var(--color-ink-600, #404040);
				border-radius: var(--radius-md, 0.5rem);
				cursor: pointer;
				transition: border-color 0.15s ease, transform 0.1s ease;
				text-align: center;
			}

			.kk-play-mode-subcard:hover {
				border-color: var(--color-accent-blue, #3498db);
			}

			.kk-play-mode-subcard:focus-visible {
				outline: 2px solid var(--color-accent-blue, #3498db);
				outline-offset: 2px;
			}

			.kk-play-mode-subcard:active {
				transform: scale(0.98);
			}

			.kk-play-mode-subcard__icon {
				font-size: 1.5rem;
				line-height: 1;
			}

			.kk-play-mode-subcard__title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-base, 1rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-white, #fff);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
			}

			.kk-play-mode-subcard__desc {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				color: var(--color-ink-400, #999);
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

			.page-play-modes__sub-back {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 36px;
				height: 36px;
				border: none;
				background: var(--color-ink-700, #252525);
				border-radius: var(--radius-md, 0.5rem);
				color: var(--color-white, #fff);
				cursor: pointer;
				flex-shrink: 0;
				transition: background 0.15s ease;
			}

			.page-play-modes__sub-back:hover {
				background: var(--color-ink-600, #404040);
			}

			.page-play-modes__sub-back:focus-visible {
				outline: 2px solid var(--color-accent-blue, #3498db);
				outline-offset: 2px;
			}

			.page-play-modes__sub-title {
				font-family: var(--font-display, sans-serif);
				font-size: var(--text-lg, 1.125rem);
				font-weight: var(--weight-black, 900);
				color: var(--color-white, #fff);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
			}

			/* ------------------------------------------------------------------ */
			/* Track list (solo mode)                                              */
			/* ------------------------------------------------------------------ */

			.page-play-modes__track-list {
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 0.5rem);
				width: 100%;
				max-width: 480px;
				margin-bottom: var(--space-4, 1rem);
			}

			.kk-track-item {
				display: flex;
				align-items: center;
				gap: var(--space-3, 0.75rem);
				padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
				background: var(--color-ink-800, #1a1a1a);
				border: 2px solid var(--color-ink-600, #404040);
				border-radius: var(--radius-md, 0.5rem);
				cursor: pointer;
				transition: border-color 0.15s ease;
			}

			.kk-track-item:hover {
				border-color: var(--color-ink-400, #666);
			}

			.kk-track-item:focus-visible {
				outline: 2px solid var(--color-accent-blue, #3498db);
				outline-offset: 2px;
			}

			.kk-track-item--selected {
				border-color: var(--color-accent-blue, #3498db);
				background: rgba(52, 152, 219, 0.1);
			}

			.kk-track-item__name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-base, 1rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-white, #fff);
				flex: 1;
			}

			.kk-track-item__difficulty {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				color: var(--color-accent-orange, #e67e22);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.05em);
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

			/* ------------------------------------------------------------------ */
			/* Responsive                                                          */
			/* ------------------------------------------------------------------ */

			@media (max-width: 600px) {

				.page-play-modes__cards {
					grid-template-columns: 1fr;
				}

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

		// Build all three panels (only one visible at a time)
		this._modeSelectionEl = this._buildModeSelection();
		this._soloPickerEl = document.createElement( 'div' );
		this._soloPickerEl.hidden = true;
		this._multiplayerEl = this._buildMultiplayerOptions();
		this._multiplayerEl.hidden = true;

		this._bodyEl.appendChild( this._modeSelectionEl );
		this._bodyEl.appendChild( this._soloPickerEl );
		this._bodyEl.appendChild( this._multiplayerEl );

	}

	/**
	 * Build the primary mode selection panel with two cards.
	 *
	 * @returns {HTMLElement}
	 */
	_buildModeSelection() {

		const container = document.createElement( 'div' );
		container.className = 'page-play-modes__cards';

		// Solo Race card
		const soloCard = this._buildModeCard( {
			actionId: 'mode-solo',
			icon:     '\uD83C\uDFC1',  // flag
			title:    'Solo Race',
			desc:     'Race against AI opponents on your favorite track.',
		} );
		container.appendChild( soloCard );

		// Multiplayer card
		const multiCard = this._buildModeCard( {
			actionId: 'mode-multiplayer',
			icon:     '\uD83D\uDC65',  // busts in silhouette
			title:    'Multiplayer',
			desc:     'Race online with friends or find a match.',
		} );
		container.appendChild( multiCard );

		return container;

	}

	/**
	 * Build a primary mode card.
	 *
	 * @param {{ actionId: string, icon: string, title: string, desc: string }} config
	 * @returns {HTMLElement}
	 */
	_buildModeCard( { actionId, icon, title, desc } ) {

		const card = document.createElement( 'button' );
		card.type = 'button';
		card.className = 'kk-play-mode-card';
		card.setAttribute( 'data-action', actionId );

		const iconEl = document.createElement( 'span' );
		iconEl.className = 'kk-play-mode-card__icon';
		iconEl.setAttribute( 'aria-hidden', 'true' );
		iconEl.textContent = icon;
		card.appendChild( iconEl );

		const titleEl = document.createElement( 'span' );
		titleEl.className = 'kk-play-mode-card__title';
		titleEl.textContent = title;
		card.appendChild( titleEl );

		const descEl = document.createElement( 'span' );
		descEl.className = 'kk-play-mode-card__desc';
		descEl.textContent = desc;
		card.appendChild( descEl );

		return card;

	}

	/**
	 * Build the multiplayer options panel.
	 *
	 * @returns {HTMLElement}
	 */
	_buildMultiplayerOptions() {

		const wrapper = document.createElement( 'div' );
		wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;max-width:640px;';

		// Sub-header with back
		const header = document.createElement( 'div' );
		header.className = 'page-play-modes__sub-header';

		const backBtn = document.createElement( 'button' );
		backBtn.type = 'button';
		backBtn.className = 'page-play-modes__sub-back';
		backBtn.setAttribute( 'data-action', 'back-to-modes' );
		backBtn.setAttribute( 'aria-label', 'Back to mode selection' );
		backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
		header.appendChild( backBtn );

		const title = document.createElement( 'span' );
		title.className = 'page-play-modes__sub-title';
		title.textContent = 'Multiplayer';
		header.appendChild( title );

		wrapper.appendChild( header );

		// Options grid
		const cards = document.createElement( 'div' );
		cards.className = 'page-play-modes__cards';

		// Quick Play
		const quickCard = document.createElement( 'button' );
		quickCard.type = 'button';
		quickCard.className = 'kk-play-mode-subcard';
		quickCard.setAttribute( 'data-action', 'mp-quick-play' );

		const qIcon = document.createElement( 'span' );
		qIcon.className = 'kk-play-mode-subcard__icon';
		qIcon.setAttribute( 'aria-hidden', 'true' );
		qIcon.textContent = '\u23F1';  // stopwatch
		quickCard.appendChild( qIcon );

		const qTitle = document.createElement( 'span' );
		qTitle.className = 'kk-play-mode-subcard__title';
		qTitle.textContent = 'Quick Play';
		quickCard.appendChild( qTitle );

		const qDesc = document.createElement( 'span' );
		qDesc.className = 'kk-play-mode-subcard__desc';
		qDesc.textContent = 'Find an online match fast';
		quickCard.appendChild( qDesc );

		cards.appendChild( quickCard );

		// Private Lobby
		const lobbyCard = document.createElement( 'button' );
		lobbyCard.type = 'button';
		lobbyCard.className = 'kk-play-mode-subcard';
		lobbyCard.setAttribute( 'data-action', 'mp-private-lobby' );

		const lIcon = document.createElement( 'span' );
		lIcon.className = 'kk-play-mode-subcard__icon';
		lIcon.setAttribute( 'aria-hidden', 'true' );
		lIcon.textContent = '\uD83D\uDD12';  // lock
		lobbyCard.appendChild( lIcon );

		const lTitle = document.createElement( 'span' );
		lTitle.className = 'kk-play-mode-subcard__title';
		lTitle.textContent = 'Private Lobby';
		lobbyCard.appendChild( lTitle );

		const lDesc = document.createElement( 'span' );
		lDesc.className = 'kk-play-mode-subcard__desc';
		lDesc.textContent = 'Create or join a private room';
		lobbyCard.appendChild( lDesc );

		cards.appendChild( lobbyCard );
		wrapper.appendChild( cards );

		return wrapper;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the first mode card
		const firstCard = this._root.querySelector( '.kk-play-mode-card' );
		if ( firstCard ) {

			firstCard.focus( { preventScroll: true } );

		}

	}

	// ---------------------------------------------------------------------------
	// Public API — view state switching
	// ---------------------------------------------------------------------------

	/**
	 * Show the primary mode selection (Solo Race / Multiplayer).
	 */
	showModeSelection() {

		this._modeSelectionEl.hidden = false;
		this._soloPickerEl.hidden = true;
		this._multiplayerEl.hidden = true;

		// Focus the first mode card
		const firstCard = this._modeSelectionEl.querySelector( '.kk-play-mode-card' );
		if ( firstCard ) firstCard.focus( { preventScroll: true } );

	}

	/**
	 * Show the solo race track picker.
	 *
	 * @param {ReadonlyArray<{ id: string, name: string, difficulty: string }>} tracks
	 */
	showSoloTrackPicker( tracks ) {

		this._modeSelectionEl.hidden = true;
		this._multiplayerEl.hidden = true;

		// Rebuild the solo picker content
		this._soloPickerEl.innerHTML = '';
		this._soloPickerEl.hidden = false;
		this._soloPickerEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;max-width:640px;';

		// Sub-header with back
		const header = document.createElement( 'div' );
		header.className = 'page-play-modes__sub-header';

		const backBtn = document.createElement( 'button' );
		backBtn.type = 'button';
		backBtn.className = 'page-play-modes__sub-back';
		backBtn.setAttribute( 'data-action', 'back-to-modes' );
		backBtn.setAttribute( 'aria-label', 'Back to mode selection' );
		backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
		header.appendChild( backBtn );

		const title = document.createElement( 'span' );
		title.className = 'page-play-modes__sub-title';
		title.textContent = 'Solo Race';
		header.appendChild( title );

		this._soloPickerEl.appendChild( header );

		// Track list
		const trackList = document.createElement( 'div' );
		trackList.className = 'page-play-modes__track-list';
		trackList.setAttribute( 'role', 'listbox' );
		trackList.setAttribute( 'aria-label', 'Available tracks' );

		let selectedId = tracks.length > 0 ? tracks[ 0 ].id : null;

		for ( const track of tracks ) {

			const item = document.createElement( 'button' );
			item.type = 'button';
			item.className = 'kk-track-item';
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'aria-selected', track.id === selectedId ? 'true' : 'false' );
			item.dataset.trackId = track.id;

			if ( track.id === selectedId ) {

				item.classList.add( 'kk-track-item--selected' );

			}

			const nameEl = document.createElement( 'span' );
			nameEl.className = 'kk-track-item__name';
			nameEl.textContent = track.name;
			item.appendChild( nameEl );

			const diffEl = document.createElement( 'span' );
			diffEl.className = 'kk-track-item__difficulty';
			diffEl.textContent = track.difficulty;
			item.appendChild( diffEl );

			item.addEventListener( 'click', () => {

				selectedId = track.id;

				// Update selection visuals
				trackList.querySelectorAll( '.kk-track-item' ).forEach( ( el ) => {

					const isSelected = el.dataset.trackId === selectedId;
					el.classList.toggle( 'kk-track-item--selected', isSelected );
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
		const firstItem = trackList.querySelector( '.kk-track-item' );
		if ( firstItem ) firstItem.focus( { preventScroll: true } );

	}

	/**
	 * Show the multiplayer sub-options (Quick Play / Private Lobby).
	 */
	showMultiplayerOptions() {

		this._modeSelectionEl.hidden = true;
		this._soloPickerEl.hidden = true;
		this._multiplayerEl.hidden = false;

		// Focus the first sub-card
		const firstCard = this._multiplayerEl.querySelector( '.kk-play-mode-subcard' );
		if ( firstCard ) firstCard.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._pageHeader?.dispose();
		this._pageHeader = null;

		this._bodyEl = null;
		this._modeSelectionEl = null;
		this._soloPickerEl = null;
		this._multiplayerEl = null;

		super.dispose();

	}

}

Page04PlayModesView._cssInjected = false;
