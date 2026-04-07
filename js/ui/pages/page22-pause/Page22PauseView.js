/**
 * Page22PauseView — Pause Menu.
 *
 * Layout: full-viewport modal overlay, rendered above game canvas.
 *   position: fixed; inset: 0; z-index: var(--z-modal)
 *   backdrop: rgba(0,0,0,0.72) + blur(8px)
 *
 * Zones:
 *   pause panel  — centered ~360px card: eyebrow + brand + button stack
 *   race status  — absolute bottom-right SectionPanel with lap / position / drift
 *   race timer   — absolute top-right frozen clock
 *
 * Focus trap: Tab cycles only within the pause overlay. Implemented via the
 *   _trapFocus() keydown handler registered on the overlay root.
 *
 * ConfirmationDialog: opened inline (not via ModalService) so the dialog DOM
 *   sits inside the overlay and participates in the focus trap automatically.
 *   The dialog is created once and reused; it is shown/hidden on demand.
 *
 * Deviations from spec:
 *   - Spec §2 button stack uses `new ButtonBar({ orientation: 'vertical', items })`.
 *     ButtonBar is a horizontal toolbar (ArrowLeft/Right). Vertical button stacks
 *     with different variants (primary / secondary / ghost / danger) require
 *     individual CTAButton instances — ButtonBar's uniform styling cannot express
 *     the mixed-variant layout in the mockup. Individual CTAButtons are used here,
 *     matching the pattern established in Page01TitleView.
 *   - brand-mark.png may not exist in /sprites/ at M2 stage. The img element
 *     uses an empty alt so missing-image decorative placeholder is accessible.
 *     The page does not throw if the image 404s.
 *   - ConfirmationDialog is mounted inside the overlay rather than via ModalService
 *     so the focus trap boundary is naturally maintained without additional aria
 *     wiring to the overlay parent.
 */

import { PageViewBase }        from '../../core/PageViewBase.js';
import { CTAButton }           from '../../components/CTAButton.js';
import { SectionPanel }        from '../../components/SectionPanel.js';
import { ConfirmationDialog }  from '../../components/ConfirmationDialog.js';
import { ButtonIds }           from '../../enums/ButtonIds.js';
import { RouteIds }            from '../../enums/RouteIds.js'; // eslint-disable-line no-unused-vars

export class Page22PauseView extends PageViewBase {

	constructor() {

		super( 'page-pause' );

		/** @type {CTAButton} */
		this._resumeBtn = null;

		/** @type {CTAButton} */
		this._restartBtn = null;

		/** @type {CTAButton} */
		this._settingsBtn = null;

		/** @type {CTAButton} */
		this._controlsBtn = null;

		/** @type {CTAButton} */
		this._leaveRaceBtn = null;

		/** @type {ConfirmationDialog} */
		this._leaveConfirmDialog = null;

		/** @type {Function} Focus trap handler, stored for removal on dispose. */
		this._focusTrapHandler = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page22PauseView._cssInjected ) return;
		Page22PauseView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Overlay root                                                        */
			/* ------------------------------------------------------------------ */

			.page-pause {
				position: fixed;
				inset: 0;
				z-index: var(--z-modal);
				display: grid;
				place-items: center;
				background: rgba(0, 0, 0, 0.72);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
			}

			/* ------------------------------------------------------------------ */
			/* Pause panel                                                         */
			/* ------------------------------------------------------------------ */

			.kk-pause-panel {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
				width: clamp(280px, 30vw, 380px);
				padding: var(--space-8) var(--space-6);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-lg);
			}

			.kk-pause-panel__header {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				width: 100%;
			}

			.kk-pause-panel__eyebrow {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.kk-pause-panel__brand {
				display: block;
				max-width: 200px;
				height: auto;
			}

			/* Button stack — all buttons full width */
			.kk-pause-panel__buttons {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				width: 100%;
			}

			.kk-pause-panel__buttons .kk-cta-button {
				width: 100%;
				justify-content: center;
				min-height: var(--hit-target-min);
			}

			/* ------------------------------------------------------------------ */
			/* Race Status panel                                                   */
			/* ------------------------------------------------------------------ */

			.kk-race-status {
				position: absolute;
				bottom: var(--space-8);
				right: var(--page-padding-x, var(--space-6));
				width: 180px;
			}

			.kk-race-status__list {
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.kk-race-status__row {
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				align-items: baseline;
			}

			.kk-race-status__row dt {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-race-status__row dd {
				margin: 0;
				font-family: var(--font-display);
				font-size: var(--text-base);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			/* ------------------------------------------------------------------ */
			/* Race timer                                                          */
			/* ------------------------------------------------------------------ */

			.kk-race-timer {
				position: absolute;
				top: var(--space-4);
				right: var(--page-padding-x, var(--space-6));
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				letter-spacing: var(--tracking-wider);
				text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
			}

			/* ------------------------------------------------------------------ */
			/* Leave confirm dialog — mounted inside overlay                       */
			/* ------------------------------------------------------------------ */

			.kk-pause-leave-confirm {
				position: absolute;
				inset: 0;
				display: grid;
				place-items: center;
				background: rgba(0, 0, 0, 0.5);
				z-index: 1;
			}

			.kk-pause-leave-confirm[hidden] {
				display: none;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const root = this._root;
		root.setAttribute( 'role', 'dialog' );
		root.setAttribute( 'aria-modal', 'true' );
		root.setAttribute( 'aria-label', 'Game paused' );

		// ----- Pause panel -----
		const panel = document.createElement( 'div' );
		panel.className = 'kk-pause-panel';

		// Header: eyebrow + brand
		const header = document.createElement( 'div' );
		header.className = 'kk-pause-panel__header';

		const eyebrow = document.createElement( 'span' );
		eyebrow.className = 'kk-pause-panel__eyebrow';
		eyebrow.textContent = 'PAUSED';
		header.appendChild( eyebrow );

		const brand = document.createElement( 'img' );
		brand.className = 'kk-pause-panel__brand';
		brand.src = '/sprites/brand-mark.png';
		brand.alt = 'Beastside Kart Kids';
		brand.onerror = function () { this.style.display = 'none'; };
		header.appendChild( brand );

		// Text fallback when image is missing
		const brandText = document.createElement( 'div' );
		brandText.style.cssText = `
			font-family: var(--font-display);
			font-size: var(--text-2xl);
			font-weight: var(--weight-black);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide);
			color: var(--color-white);
			text-align: center;
		`;
		brandText.textContent = 'KART KIDS';
		header.appendChild( brandText );

		panel.appendChild( header );

		// Button stack
		const btnStack = document.createElement( 'div' );
		btnStack.className = 'kk-pause-panel__buttons';

		this._resumeBtn = new CTAButton( {
			label:    'RESUME',
			variant:  'primary',
			actionId: ButtonIds.PAUSE_RESUME,
		} );
		btnStack.appendChild( this._resumeBtn.el );

		this._restartBtn = new CTAButton( {
			label:    'RESTART',
			variant:  'secondary',
			actionId: ButtonIds.PAUSE_RESTART,
		} );
		btnStack.appendChild( this._restartBtn.el );

		this._settingsBtn = new CTAButton( {
			label:    'SETTINGS',
			variant:  'ghost',
			actionId: ButtonIds.PAUSE_SETTINGS,
		} );
		btnStack.appendChild( this._settingsBtn.el );

		this._controlsBtn = new CTAButton( {
			label:    'CONTROLS',
			variant:  'ghost',
			actionId: ButtonIds.PAUSE_CONTROLS,
		} );
		btnStack.appendChild( this._controlsBtn.el );

		this._leaveRaceBtn = new CTAButton( {
			label:    'LEAVE RACE',
			variant:  'danger',
			actionId: ButtonIds.PAUSE_LEAVE_RACE,
		} );
		btnStack.appendChild( this._leaveRaceBtn.el );

		panel.appendChild( btnStack );
		this._registerSection( 'panel', panel );
		root.appendChild( panel );

		// ----- Race timer (top-right) -----
		const timer = document.createElement( 'span' );
		timer.className = 'kk-race-timer';
		timer.setAttribute( 'aria-label', 'Race time: 22 minutes 15 seconds' );
		timer.setAttribute( 'aria-live', 'off' );
		timer.textContent = '22:15';
		this._registerSection( 'raceTimer', timer );
		root.appendChild( timer );

		// ----- Race Status panel (bottom-right) -----
		const raceStatusPanel = new SectionPanel( { title: 'RACE STATUS', headingLevel: 2 } );
		raceStatusPanel.el.classList.add( 'kk-race-status' );
		raceStatusPanel.el.setAttribute( 'aria-live', 'off' );

		const statusList = document.createElement( 'dl' );
		statusList.className = 'kk-race-status__list';

		const rows = [
			{ dt: 'LAP',        dd: '2/5',    ariaLabel: 'Lap 2 of 5' },
			{ dt: 'POSITION',   dd: '4th',    ariaLabel: 'Position: 4th' },
			{ dt: 'DRIFT SCORE', dd: '12,450', ariaLabel: 'Drift score: 12,450' },
		];

		rows.forEach( ( row ) => {

			const rowEl = document.createElement( 'div' );
			rowEl.className = 'kk-race-status__row';

			const dt = document.createElement( 'dt' );
			dt.textContent = row.dt;

			const dd = document.createElement( 'dd' );
			dd.textContent = row.dd;
			dd.setAttribute( 'aria-label', row.ariaLabel );

			rowEl.appendChild( dt );
			rowEl.appendChild( dd );
			statusList.appendChild( rowEl );

		} );

		raceStatusPanel.append( statusList );
		this._registerSection( 'raceStatus', raceStatusPanel.el );
		root.appendChild( raceStatusPanel.el );

		// ----- Leave-race ConfirmationDialog (mounted inside overlay) -----
		// Wrapped in a container so it can be hidden/shown without destroying the dialog DOM.
		const leaveConfirmWrapper = document.createElement( 'div' );
		leaveConfirmWrapper.className = 'kk-pause-leave-confirm';
		leaveConfirmWrapper.hidden = true;
		this._leaveConfirmWrapper = leaveConfirmWrapper;

		this._leaveConfirmDialog = new ConfirmationDialog( {
			title:        'Leave Race?',
			body:         'Your progress will be lost.',
			confirmLabel: 'LEAVE',
			cancelLabel:  'STAY',
			confirmVariant: 'danger',
		} );

		// Mount the dialog's element into the wrapper
		leaveConfirmWrapper.appendChild( this._leaveConfirmDialog.el );
		root.appendChild( leaveConfirmWrapper );
		this._registerSection( 'leaveConfirm', leaveConfirmWrapper );

		// Bind dialog internal events so the view can show/hide the wrapper
		this._leaveConfirmDialog.el.addEventListener( 'kk:confirm-dialog:confirm', () => {

			this._hideLeaveConfirm();
			// Controller listens for this event on root and handles navigation

		} );

		this._leaveConfirmDialog.el.addEventListener( 'kk:confirm-dialog:cancel', () => {

			this._hideLeaveConfirm();
			// Controller listens for this event on root and restores focus to LEAVE RACE

		} );

		// ----- Focus trap -----
		this._focusTrapHandler = ( e ) => this._handleFocusTrap( e );
		root.addEventListener( 'keydown', this._focusTrapHandler );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Initial focus: RESUME button per spec §6
		// Double rAF ensures the overlay is painted before focus is applied
		requestAnimationFrame( () => {

			requestAnimationFrame( () => {

				this._resumeBtn?.el.focus( { preventScroll: true } );

			} );

		} );

	}

	// ---------------------------------------------------------------------------
	// Focus trap
	// ---------------------------------------------------------------------------

	/**
	 * Tab-cycle focus within the pause overlay.
	 * Focusable elements: the five CTAButtons in the panel.
	 * The Race Status panel is role="region" read-only — not in Tab order.
	 *
	 * @param {KeyboardEvent} e
	 */
	_handleFocusTrap( e ) {

		if ( e.key !== 'Tab' ) return;

		const focusable = Array.from(
			this._root.querySelectorAll(
				'button:not([aria-disabled="true"]):not([tabindex="-1"]), [tabindex="0"]'
			)
		).filter( ( el ) => ! el.closest( '.kk-pause-leave-confirm[hidden]' ) );

		if ( ! focusable.length ) return;

		const first = focusable[ 0 ];
		const last  = focusable[ focusable.length - 1 ];

		if ( e.shiftKey ) {

			if ( document.activeElement === first ) {
				e.preventDefault();
				last.focus();
			}

		} else {

			if ( document.activeElement === last ) {
				e.preventDefault();
				first.focus();
			}

		}

	}

	// ---------------------------------------------------------------------------
	// Leave confirm dialog helpers
	// ---------------------------------------------------------------------------

	/**
	 * Show the LEAVE RACE confirmation dialog and trap focus inside it.
	 * Called by the controller when LEAVE RACE is clicked.
	 */
	openLeaveConfirmDialog() {

		this._leaveConfirmWrapper.hidden = false;

		// Make the panel buttons inert while confirm is open
		this._setPanelButtonsInert( true );

		// Focus the STAY (cancel) button — safer default per spec
		requestAnimationFrame( () => {

			const stayBtn = this._leaveConfirmWrapper.querySelector( '[data-action="confirm-cancel"]' );
			stayBtn?.focus( { preventScroll: true } );

		} );

	}

	_hideLeaveConfirm() {

		this._leaveConfirmWrapper.hidden = true;
		this._setPanelButtonsInert( false );

	}

	/**
	 * Disable/enable the pause panel buttons while the confirm dialog is open.
	 * Sets aria-disabled + tabindex=-1 so they are excluded from Tab order.
	 *
	 * @param {boolean} inert
	 */
	_setPanelButtonsInert( inert ) {

		const buttons = [
			this._resumeBtn,
			this._restartBtn,
			this._settingsBtn,
			this._controlsBtn,
			this._leaveRaceBtn,
		];

		buttons.forEach( ( btn ) => {

			if ( ! btn ) return;

			if ( inert ) {
				btn.el.setAttribute( 'aria-disabled', 'true' );
				btn.el.setAttribute( 'tabindex', '-1' );
			} else {
				btn.el.removeAttribute( 'aria-disabled' );
				btn.el.setAttribute( 'tabindex', '0' );
			}

		} );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get resumeBtn() { return this._resumeBtn; }

	/** @returns {CTAButton} */
	get restartBtn() { return this._restartBtn; }

	/** @returns {CTAButton} */
	get settingsBtn() { return this._settingsBtn; }

	/** @returns {CTAButton} */
	get controlsBtn() { return this._controlsBtn; }

	/** @returns {CTAButton} */
	get leaveRaceBtn() { return this._leaveRaceBtn; }

	/**
	 * Update the race timer display.
	 * Called by game layer if it wants to freeze the visible time at pause moment.
	 *
	 * @param {string} timeString  e.g. "22:15"
	 */
	setRaceTimer( timeString ) {

		const el = this.getSection( 'raceTimer' );
		if ( el ) {

			el.textContent = timeString;

			// Derive minutes/seconds for aria-label
			const [ min, sec ] = timeString.split( ':' );
			el.setAttribute(
				'aria-label',
				`Race time: ${parseInt( min, 10 )} minutes ${parseInt( sec || '0', 10 )} seconds`
			);

		}

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		if ( this._focusTrapHandler ) {
			this._root.removeEventListener( 'keydown', this._focusTrapHandler );
			this._focusTrapHandler = null;
		}

		this._resumeBtn    = null;
		this._restartBtn   = null;
		this._settingsBtn  = null;
		this._controlsBtn  = null;
		this._leaveRaceBtn = null;

		this._leaveConfirmDialog?.dispose();
		this._leaveConfirmDialog = null;

		super.dispose();

	}

}

Page22PauseView._cssInjected = false;
