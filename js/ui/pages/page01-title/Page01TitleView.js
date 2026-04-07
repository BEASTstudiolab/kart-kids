/**
 * Page01TitleView — Title Screen / Start Screen.
 *
 * Layout: full-viewport single layer, no scroll, no TopNav, no PageHeader.
 *
 * Zones:
 *   hero-bg      — HeroPreviewPanel, position:fixed, full-bleed, z-0
 *   logo-zone    — <h1> wordmark, centered horizontally, ~20% from top
 *   cta-zone     — [PRESS START] CTAButton with pulse animation
 *   utility-rail — vertical nav list of 5 ghost CTAButtons, right edge
 *   version-badge — bottom-left version string
 *
 * Deviations from spec:
 *   - Spec references `ButtonBar` with orientation:'vertical', but ButtonBar is a
 *     horizontal toolbar (role="toolbar", ArrowLeft/Right roving). The utility rail
 *     uses individual CTAButton instances in a nav <ul> with ArrowUp/Down roving
 *     focus — correct semantic pattern for a vertical nav list.
 *   - Spec references ButtonIds.TITLE_START; actual enum value is
 *     ButtonIds.TITLE_PRESS_START.
 */

import { PageViewBase }    from '../../core/PageViewBase.js';
import { CTAButton }       from '../../components/CTAButton.js';
import { HeroPreviewPanel } from '../../components/HeroPreviewPanel.js';
import { ButtonIds }       from '../../enums/ButtonIds.js';

export class Page01TitleView extends PageViewBase {

	constructor() {

		super( 'page-title' );

		/** @type {HeroPreviewPanel} */
		this._heroBg = null;

		/** @type {CTAButton} */
		this._pressStartBtn = null;

		/** @type {CTAButton[]} */
		this._utilityBtns = [];

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page01TitleView._cssInjected ) return;
		Page01TitleView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.page-title {
				position: fixed;
				inset: 0;
				display: grid;
				grid-template-rows: 1fr auto 1fr;
				grid-template-columns: 1fr auto;
				isolation: isolate;
				overflow: hidden;
			}

			/* Hero background fills entire viewport beneath everything */
			.page-title__hero-bg {
				position: fixed;
				inset: 0;
				z-index: 0;
			}

			/* Override HeroPreviewPanel defaults for full-bleed bg use */
			.page-title__hero-bg .kk-hero-preview-panel {
				position: fixed;
				inset: 0;
				border: none;
				border-radius: 0;
				z-index: 0;
			}

			.page-title__hero-bg .kk-hero-preview-panel__inner {
				aspect-ratio: auto;
				height: 100%;
			}

			/* Dark gradient overlay so text is legible over the bg */
			.page-title__hero-bg::after {
				content: '';
				position: fixed;
				inset: 0;
				background: linear-gradient(
					to bottom,
					rgba(0, 0, 0, 0.35) 0%,
					rgba(0, 0, 0, 0.15) 40%,
					rgba(0, 0, 0, 0.55) 100%
				);
				z-index: 1;
				pointer-events: none;
			}

			/* Logo zone — grid row 1 col 1, self-end + centered */
			.page-title__logo-zone {
				grid-row: 1;
				grid-column: 1;
				align-self: end;
				justify-self: center;
				padding-bottom: var(--space-8);
				z-index: 2;
				text-align: center;
			}

			.page-title__logo {
				margin: 0;
				font-family: var(--font-display);
				font-size: clamp(4rem, 10vw, 10rem);
				font-weight: var(--weight-black, 900);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				line-height: 1;
				text-shadow:
					0 0 60px rgba(255, 255, 255, 0.3),
					0 4px 32px rgba(0, 0, 0, 0.8),
					0 0 120px rgba(0, 212, 232, 0.15);
				-webkit-text-stroke: 2px rgba(0, 0, 0, 0.6);
				paint-order: stroke fill;
			}

			/* CTA zone — grid row 2 col 1, centered */
			.page-title__cta-zone {
				grid-row: 2;
				grid-column: 1;
				display: flex;
				justify-content: center;
				align-items: center;
				z-index: 2;
			}

			/* Pulse animation for [PRESS START] */
			@keyframes kk-pulse {
				0%,  100% { opacity: 1;    transform: scale(1); }
				50%        { opacity: 0.65; transform: scale(0.97); }
			}

			.page-title__press-start {
				animation: kk-pulse 1.8s ease-in-out infinite;
			}

			@media (prefers-reduced-motion: reduce) {
				.page-title__press-start {
					animation: none;
				}
			}

			/* Utility rail — right edge, vertically centered across all rows */
			.page-title__utility-rail {
				grid-row: 1 / 4;
				grid-column: 2;
				display: flex;
				flex-direction: column;
				justify-content: center;
				gap: var(--space-2);
				padding: var(--space-6) var(--space-6) var(--space-6) var(--space-4);
				z-index: 2;
				list-style: none;
				margin: 0;
			}

			.page-title__utility-rail li {
				display: flex;
			}

			/* Rail buttons fill the column width */
			.page-title__utility-rail .kk-cta-button {
				width: 100%;
				justify-content: flex-start;
				min-width: 200px;
			}

			/* Version badge — absolute bottom-left */
			.page-title__version {
				position: absolute;
				bottom: var(--space-4);
				left: var(--space-4);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				letter-spacing: var(--tracking-wide);
				text-transform: uppercase;
				z-index: 2;
				pointer-events: none;
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

		// Hero background
		this._heroBg = new HeroPreviewPanel( {
			sceneId:     'title-bg',
			ariaLabel:   'Kart Kids cinematic background',
			caption:     null,
			aspectRatio: 'auto',
			loading:     true,
		} );

		const heroBgWrapper = document.createElement( 'div' );
		heroBgWrapper.className = 'page-title__hero-bg';
		heroBgWrapper.setAttribute( 'aria-hidden', 'true' );
		heroBgWrapper.appendChild( this._heroBg.el );
		root.appendChild( heroBgWrapper );

		// Logo zone
		const logoZone = document.createElement( 'div' );
		logoZone.className = 'page-title__logo-zone';

		const logo = document.createElement( 'h1' );
		logo.className = 'page-title__logo';
		logo.textContent = 'KART KIDS';
		logo.setAttribute( 'aria-label', 'Kart Kids — Title Screen' );
		logoZone.appendChild( logo );
		root.appendChild( logoZone );

		// CTA zone — [PRESS START]
		const ctaZone = document.createElement( 'div' );
		ctaZone.className = 'page-title__cta-zone';

		this._pressStartBtn = new CTAButton( {
			label:    '[PRESS START]',
			variant:  'primary',
			actionId: ButtonIds.TITLE_PRESS_START,
		} );
		this._pressStartBtn.el.classList.add( 'page-title__press-start' );
		ctaZone.appendChild( this._pressStartBtn.el );
		root.appendChild( ctaZone );
		this._registerSection( 'cta', ctaZone );

		// Utility rail (vertical nav list)
		const utilityRailDef = [
			{ label: 'PLAYER SIGN-IN',  actionId: ButtonIds.TITLE_SIGN_IN },
			{ label: 'SETTINGS',        actionId: ButtonIds.TITLE_SETTINGS },
			{ label: 'ACCESSIBILITY',   actionId: ButtonIds.TITLE_ACCESSIBILITY },
			{ label: 'LANGUAGE',        actionId: ButtonIds.TITLE_LANGUAGE },
			{ label: 'FEATURED EVENT',  actionId: ButtonIds.TITLE_FEATURED_EVENT },
		];

		const rail = document.createElement( 'ul' );
		rail.className = 'page-title__utility-rail';
		rail.setAttribute( 'role', 'list' );
		rail.setAttribute( 'aria-label', 'Utility options' );

		utilityRailDef.forEach( ( def ) => {

			const btn = new CTAButton( {
				label:   def.label,
				variant: 'ghost',
				actionId: def.actionId,
			} );
			this._utilityBtns.push( btn );

			const li = document.createElement( 'li' );
			li.appendChild( btn.el );
			rail.appendChild( li );

		} );

		// ArrowUp/Down roving focus within rail
		rail.addEventListener( 'keydown', ( e ) => {

			const btns = Array.from( rail.querySelectorAll( '.kk-cta-button' ) );
			const idx  = btns.indexOf( document.activeElement );
			if ( idx === -1 ) return;

			if ( e.key === 'ArrowDown' ) {

				e.preventDefault();
				btns[ ( idx + 1 ) % btns.length ].focus();

			} else if ( e.key === 'ArrowUp' ) {

				e.preventDefault();
				btns[ ( idx - 1 + btns.length ) % btns.length ].focus();

			}

		} );

		root.appendChild( rail );
		this._registerSection( 'utilityRail', rail );

		// Version badge
		const versionBadge = document.createElement( 'span' );
		versionBadge.className = 'page-title__version';
		versionBadge.setAttribute( 'aria-label', 'App version' );
		root.appendChild( versionBadge );
		this._registerSection( 'version', versionBadge );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Initial focus on [PRESS START] per spec §6 keyboard flow.
		this._pressStartBtn.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get pressStartBtn() { return this._pressStartBtn; }

	/** @returns {CTAButton[]} */
	get utilityBtns() { return this._utilityBtns; }

	/**
	 * Set the version badge text.
	 * @param {string} text
	 */
	setVersion( text ) {

		const el = this.getSection( 'version' );
		if ( el ) el.textContent = `VERSION: ${text}`;

	}

	/**
	 * Update the Featured Event button sublabel.
	 * @param {string} name
	 */
	setFeaturedEventLabel( name ) {

		const featuredBtn = this._utilityBtns[ 4 ];
		if ( featuredBtn ) featuredBtn.setLabel( `FEATURED EVENT: ${name}` );

	}

	/**
	 * Set loading state on the PLAYER SIGN-IN button.
	 * @param {boolean} loading
	 */
	setSignInLoading( loading ) {

		this._utilityBtns[ 0 ]?.setLoading( loading );

	}

	/**
	 * Update the PLAYER SIGN-IN button label (after successful sign-in).
	 * @param {string} displayName
	 */
	setSignedInName( displayName ) {

		this._utilityBtns[ 0 ]?.setLabel( displayName );

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._heroBg?.dispose();
		this._heroBg = null;

		this._pressStartBtn = null;
		this._utilityBtns = [];

		super.dispose();

	}

}

Page01TitleView._cssInjected = false;
