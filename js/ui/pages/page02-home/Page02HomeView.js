/**
 * Page02HomeView — Home / Main Menu.
 *
 * Layout: fixed-height viewport, no scroll.
 *
 * Grid rows:  TopNav | body (1fr) | bottom strip
 * Body cols:  3fr hero | 2fr CTA+rail | 220px nav-rail
 * Bottom cols: player summary | loadout | featured event | daily challenges
 *
 * Zones:
 *   topNav          — TopNav with brand, nav items, utility wallet
 *   body            — three-column body grid
 *     heroLeft      — HeroPreviewPanel (character + kart), left body column
 *     centerCta     — "HOME / MAIN MENU" eyebrow + QUICK PLAY CTAButton, center column
 *     navRail       — vertical CTAButton list, right body column
 *   bottom          — four-column info strip
 *     playerSummary — rank / wins / races (PlayerSummaryStrip)
 *     loadout       — current character + kart link
 *     featuredEvent — EventCard
 *     challenges    — up to 3 daily challenge rows
 *
 * New inline components (not in M1):
 *   PlayerSummaryStrip — read-only region; no separate file needed (simple DOM)
 *   EventCard          — interactive card; inline below
 *
 * Deviations from spec:
 *   - Spec §2 rail uses `new ButtonBar({ orientation: 'vertical', items })`.
 *     ButtonBar is a horizontal toolbar component (role="toolbar", ArrowLeft/Right).
 *     The nav rail needs vertical roving focus (ArrowUp/Down) so individual
 *     CTAButton instances inside a <ul role="list"> are used — matching the
 *     same pattern as Page01TitleView's utility rail.
 *   - QUICK PLAY CTA fires kk:cta-button:click which the controller catches.
 *     The controller stores a direct reference via view.quickPlayBtn for a more
 *     targeted listener; rail clicks are handled via event delegation on root.
 */

import { PageViewBase }     from '../../core/PageViewBase.js';
import { TopNav }           from '../../components/TopNav.js';
import { HeroPreviewPanel } from '../../components/HeroPreviewPanel.js';
import { CTAButton }        from '../../components/CTAButton.js';
import { ButtonIds }        from '../../enums/ButtonIds.js';
import { RouteIds }         from '../../enums/RouteIds.js';

export class Page02HomeView extends PageViewBase {

	constructor() {

		super( 'page-home' );

		/** @type {TopNav} */
		this._topNav = null;

		/** @type {HeroPreviewPanel} */
		this._hero = null;

		/** @type {CTAButton} */
		this._quickPlayBtn = null;

		/** @type {CTAButton[]} */
		this._railBtns = [];

		/** @type {HTMLElement} */
		this._loadoutLinkEl = null;

		/** @type {HTMLElement} */
		this._featuredEventEl = null;

		/** @type {HTMLElement} */
		this._dailyChallengesHeadingBtn = null;

		/** @type {HTMLElement} */
		this._challengeListEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page02HomeView._cssInjected ) return;
		Page02HomeView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-home {
				display: grid;
				grid-template-rows: var(--topnav-height) 1fr auto;
				grid-template-columns: 1fr;
				height: 100vh;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Body — three-column layout                                          */
			/* ------------------------------------------------------------------ */

			.page-home__body {
				display: grid;
				grid-template-columns: 3fr 2fr 220px;
				overflow: hidden;
			}

			/* Hero column */
			.page-home__hero-col {
				overflow: hidden;
			}

			.page-home__hero-col .kk-hero-preview-panel {
				height: 100%;
				border-radius: 0;
				border: none;
			}

			.page-home__hero-col .kk-hero-preview-panel__inner {
				aspect-ratio: auto;
				height: 100%;
			}

			/* Center CTA column */
			.page-home__center-col {
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				gap: var(--space-4);
				padding: var(--space-6) var(--space-4);
			}

			.page-home__eyebrow {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-semibold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* QUICK PLAY oversized CTA */
			.page-home__quick-play.kk-cta-button {
				width: 100%;
				justify-content: center;
			}

			/* Nav rail column */
			.page-home__nav-rail {
				display: flex;
				flex-direction: column;
				border-left: 1px solid var(--color-panel-border);
				overflow: hidden;
				list-style: none;
				margin: 0;
				padding: 0;
			}

			.page-home__nav-rail li {
				display: flex;
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-home__nav-rail li:last-child {
				border-bottom: none;
			}

			.page-home__nav-rail .kk-cta-button {
				width: 100%;
				flex: 1 1 auto;
				justify-content: flex-start;
				padding: 0 var(--space-4);
				border-radius: 0;
				min-height: var(--hit-target-min);
				font-size: var(--text-sm);
			}

			/* ------------------------------------------------------------------ */
			/* Bottom strip                                                        */
			/* ------------------------------------------------------------------ */

			.page-home__bottom {
				display: grid;
				grid-template-columns: auto auto 1fr auto;
				gap: var(--space-4);
				padding: var(--space-3) var(--space-6);
				background: var(--color-panel-base);
				border-top: 1px solid var(--color-panel-border);
				align-items: start;
			}

			/* ---- PlayerSummaryStrip ---- */

			.kk-player-summary-strip {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-player-summary-strip__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				margin-bottom: var(--space-1);
			}

			.kk-player-summary-strip__rank,
			.kk-player-summary-strip__wins,
			.kk-player-summary-strip__races {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
			}

			/* ---- Current Loadout ---- */

			.kk-loadout-summary {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-loadout-summary__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				margin-bottom: var(--space-1);
			}

			.kk-loadout-summary__link {
				background: none;
				border: none;
				padding: 0;
				text-align: left;
				cursor: pointer;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				color: var(--color-ink-200);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				border-radius: var(--radius-sm);
				transition: color var(--duration-fast) var(--ease-standard);
			}

			.kk-loadout-summary__link:hover,
			.kk-loadout-summary__link:focus-visible {
				color: var(--color-white);
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			/* ---- EventCard ---- */

			.kk-event-card {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				padding: var(--space-2) var(--space-3);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				cursor: pointer;
				transition:
					background var(--duration-fast) var(--ease-standard),
					border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-event-card:hover,
			.kk-event-card:focus-visible {
				background: var(--color-accent-orange-glow);
				border-color: var(--color-accent-orange);
				outline: none;
			}

			.kk-event-card__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-event-card__name {
				font-family: var(--font-display);
				font-size: var(--text-base);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-event-card__meta {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
			}

			/* ---- Daily Challenges column ---- */

			.page-home__challenges {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-home__challenges-heading {
				background: none;
				border: none;
				padding: 0;
				text-align: left;
				cursor: pointer;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				margin-bottom: var(--space-1);
				border-radius: var(--radius-sm);
				transition: color var(--duration-fast) var(--ease-standard);
			}

			.page-home__challenges-heading:hover,
			.page-home__challenges-heading:focus-visible {
				color: var(--color-white);
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.kk-challenge-row {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
				padding: var(--space-1) 0;
				border-bottom: 1px solid var(--color-panel-border);
			}

			.kk-challenge-row:last-child {
				border-bottom: none;
			}

			.kk-challenge-row__title {
				display: block;
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

		// ----- TopNav -----
		this._topNav = new TopNav( {
			items: [
				{ label: 'QUICK PLAY', route: RouteIds.QUICK_PLAY },
				{ label: 'PLAY',       route: RouteIds.PLAY },
				{ label: 'PARTY',      route: RouteIds.PARTY },
				{ label: 'GARAGE',     route: RouteIds.GARAGE },
				{ label: 'CREATE',     route: RouteIds.CREATE },
				{ label: 'PROFILE',    route: RouteIds.PROFILE },
				{ label: 'SHOP',       route: RouteIds.SHOP },
			],
			activeRoute: RouteIds.HOME,
			showBrand:   true,
			showUtility: true,
		} );

		// Wallet utility slot — populated in setWallet() after build
		this._walletUtilityEl = document.createElement( 'div' );
		this._walletUtilityEl.className = 'page-home__wallet kk-ui-inline-row kk-ui-utility-text';
		this._walletUtilityEl.setAttribute( 'aria-label', 'Wallet' );
		this._topNav.setUtilityContent( this._walletUtilityEl );
		root.appendChild( this._topNav.el );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-home__body';
		this._registerSection( 'body', body );

		// Left: hero
		const heroCol = document.createElement( 'div' );
		heroCol.className = 'page-home__hero-col';
		this._hero = new HeroPreviewPanel( {
			sceneId:     'home-hero',
			ariaLabel:   'Character preview',
			caption:     null,
			aspectRatio: '16/9',
			loading:     true,
		} );
		heroCol.appendChild( this._hero.el );
		body.appendChild( heroCol );

		// Center: eyebrow + QUICK PLAY CTA
		const centerCol = document.createElement( 'div' );
		centerCol.className = 'page-home__center-col';

		const eyebrow = document.createElement( 'span' );
		eyebrow.className = 'page-home__eyebrow';
		eyebrow.textContent = 'HOME / MAIN MENU';
		eyebrow.setAttribute( 'aria-hidden', 'true' );
		centerCol.appendChild( eyebrow );

		this._quickPlayBtn = new CTAButton( {
			label:    'QUICK PLAY',
			variant:  'primary',
			actionId: ButtonIds.HOME_QUICK_PLAY,
		} );
		this._quickPlayBtn.el.classList.add( 'page-home__quick-play', 'kk-cta-button--hero' );
		centerCol.appendChild( this._quickPlayBtn.el );
		this._registerSection( 'quickPlay', centerCol );

		body.appendChild( centerCol );

		// Right: navigation rail
		const railDefs = [
			{ label: 'PLAY MODES', actionId: ButtonIds.HOME_PLAY_MODES },
			{ label: 'PARTY',      actionId: ButtonIds.HOME_PARTY },
			{ label: 'GARAGE',     actionId: ButtonIds.HOME_GARAGE },
			{ label: 'CREATE',     actionId: ButtonIds.HOME_CREATE },
			{ label: 'PROFILE',    actionId: ButtonIds.HOME_PROFILE },
			{ label: 'SHOP',       actionId: ButtonIds.HOME_SHOP },
			{ label: 'SETTINGS',   actionId: ButtonIds.HOME_SETTINGS },
		];

		const rail = document.createElement( 'ul' );
		rail.className = 'page-home__nav-rail';
		rail.setAttribute( 'role', 'list' );
		rail.setAttribute( 'aria-label', 'Navigation' );

		railDefs.forEach( ( def ) => {

			const btn = new CTAButton( {
				label:    def.label,
				variant:  'secondary',
				actionId: def.actionId,
			} );
			this._railBtns.push( btn );

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

		body.appendChild( rail );
		this._registerSection( 'navRail', rail );
		root.appendChild( body );

		// ----- Bottom strip -----
		const bottom = document.createElement( 'div' );
		bottom.className = 'page-home__bottom';
		this._registerSection( 'bottom', bottom );

		// Column 1 — PlayerSummaryStrip
		const summaryStrip = document.createElement( 'div' );
		summaryStrip.className = 'kk-player-summary-strip';
		summaryStrip.setAttribute( 'role', 'region' );
		summaryStrip.setAttribute( 'aria-label', 'Player summary' );

		const summaryLabel = document.createElement( 'span' );
		summaryLabel.className = 'kk-player-summary-strip__label';
		summaryLabel.textContent = 'PLAYER SUMMARY';
		summaryStrip.appendChild( summaryLabel );

		this._rankEl = document.createElement( 'span' );
		this._rankEl.className = 'kk-player-summary-strip__rank';
		summaryStrip.appendChild( this._rankEl );

		this._winsEl = document.createElement( 'span' );
		this._winsEl.className = 'kk-player-summary-strip__wins';
		summaryStrip.appendChild( this._winsEl );

		this._racesEl = document.createElement( 'span' );
		this._racesEl.className = 'kk-player-summary-strip__races';
		summaryStrip.appendChild( this._racesEl );

		bottom.appendChild( summaryStrip );
		this._registerSection( 'playerSummary', summaryStrip );

		// Column 2 — Current Loadout
		const loadoutSummary = document.createElement( 'div' );
		loadoutSummary.className = 'kk-loadout-summary';
		loadoutSummary.setAttribute( 'role', 'region' );
		loadoutSummary.setAttribute( 'aria-label', 'Current loadout' );

		const loadoutLabel = document.createElement( 'span' );
		loadoutLabel.className = 'kk-loadout-summary__label';
		loadoutLabel.textContent = 'CURRENT LOADOUT';
		loadoutSummary.appendChild( loadoutLabel );

		const loadoutLink = document.createElement( 'button' );
		loadoutLink.className = 'kk-loadout-summary__link';
		loadoutLink.type = 'button';
		loadoutLink.dataset.action = ButtonIds.HOME_CURRENT_LOADOUT;
		loadoutLink.dataset.route = RouteIds.GARAGE;
		this._loadoutCharEl = document.createElement( 'span' );
		this._loadoutKartEl = document.createElement( 'span' );
		loadoutLink.appendChild( this._loadoutCharEl );
		loadoutLink.appendChild( this._loadoutKartEl );
		loadoutSummary.appendChild( loadoutLink );
		this._loadoutLinkEl = loadoutLink;

		bottom.appendChild( loadoutSummary );
		this._registerSection( 'loadout', loadoutSummary );

		// Column 3 — Featured Event card
		const eventCard = document.createElement( 'div' );
		eventCard.className = 'kk-event-card';
		eventCard.setAttribute( 'role', 'button' );
		eventCard.setAttribute( 'tabindex', '0' );
		eventCard.dataset.action = ButtonIds.HOME_FEATURED_EVENT;

		this._eventLabelEl = document.createElement( 'span' );
		this._eventLabelEl.className = 'kk-event-card__label';
		this._eventLabelEl.textContent = 'FEATURED EVENT';

		this._eventNameEl = document.createElement( 'span' );
		this._eventNameEl.className = 'kk-event-card__name';

		this._eventMetaEl = document.createElement( 'span' );
		this._eventMetaEl.className = 'kk-event-card__meta';

		eventCard.appendChild( this._eventLabelEl );
		eventCard.appendChild( this._eventNameEl );
		eventCard.appendChild( this._eventMetaEl );

		this._featuredEventEl = eventCard;
		bottom.appendChild( eventCard );
		this._registerSection( 'featuredEvent', eventCard );

		// Column 4 — Daily Challenges
		const challengesCol = document.createElement( 'div' );
		challengesCol.className = 'page-home__challenges';

		const challengesHeading = document.createElement( 'button' );
		challengesHeading.className = 'page-home__challenges-heading';
		challengesHeading.type = 'button';
		challengesHeading.textContent = 'DAILY CHALLENGES';
		challengesHeading.dataset.action = ButtonIds.HOME_DAILY_CHALLENGES;
		this._dailyChallengesHeadingBtn = challengesHeading;
		challengesCol.appendChild( challengesHeading );

		this._challengeListEl = document.createElement( 'div' );
		this._challengeListEl.className = 'page-home__challenge-list';
		this._challengeListEl.setAttribute( 'role', 'list' );
		challengesCol.appendChild( this._challengeListEl );

		bottom.appendChild( challengesCol );
		this._registerSection( 'dailyChallenges', challengesCol );

		root.appendChild( bottom );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Per spec §6: initial focus on QUICK PLAY CTA (first interactive in main content)
		this._quickPlayBtn.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get quickPlayBtn() { return this._quickPlayBtn; }

	/** @returns {HTMLElement} The current loadout button element. */
	get loadoutLinkEl() { return this._loadoutLinkEl; }

	/** @returns {HTMLElement} The featured event card element. */
	get featuredEventEl() { return this._featuredEventEl; }

	/** @returns {HTMLElement} The daily challenges heading button. */
	get dailyChallengesHeadingBtn() { return this._dailyChallengesHeadingBtn; }

	/**
	 * Update the wallet display in the TopNav utility slot.
	 *
	 * @param {{ coins: number, gems: number }} wallet
	 */
	setWallet( { coins, gems } ) {

		this._walletUtilityEl.innerHTML = `
			<span aria-label="Coins: ${coins.toLocaleString()}">
				<span aria-hidden="true">&#9733;</span> ${coins.toLocaleString()}
			</span>
			<span aria-label="Gems: ${gems}">
				<span aria-hidden="true">&#9830;</span> ${gems}
			</span>
		`;

	}

	/**
	 * Update the HeroPreviewPanel aria-label.
	 *
	 * @param {string} label
	 */
	setHeroAriaLabel( label ) {

		this._hero?.setAriaLabel( label );

	}

	/**
	 * Update the HeroPreviewPanel caption (player name).
	 *
	 * @param {string} name
	 */
	setHeroCaption( name ) {

		this._hero?.setCaption( name );

	}

	/**
	 * Populate the PlayerSummaryStrip.
	 *
	 * @param {{ rank: number, totalWins: number, totalRaces: number }} data
	 */
	setPlayerSummary( { rank, totalWins, totalRaces } ) {

		if ( this._rankEl )  this._rankEl.textContent  = `Rank: ${rank}`;
		if ( this._winsEl )  this._winsEl.textContent  = `Total wins: ${totalWins}`;
		if ( this._racesEl ) this._racesEl.textContent = `Total races: ${totalRaces}`;

	}

	/**
	 * Populate the Current Loadout link.
	 *
	 * @param {{ characterName: string, kartName: string }} data
	 */
	setLoadout( { characterName, kartName } ) {

		if ( this._loadoutCharEl ) this._loadoutCharEl.textContent = `Character: ${characterName}`;
		if ( this._loadoutKartEl ) this._loadoutKartEl.textContent = `Kart: ${kartName}`;

		// Update aria-label on the button for screen readers
		if ( this._loadoutLinkEl ) {
			this._loadoutLinkEl.setAttribute(
				'aria-label',
				`Current loadout: ${characterName} on ${kartName}. Go to Garage.`
			);
		}

	}

	/**
	 * Populate the Featured Event card.
	 *
	 * @param {{ name: string, description: string }} data
	 */
	setFeaturedEvent( { name, description } ) {

		if ( this._eventNameEl ) this._eventNameEl.textContent = name;
		if ( this._eventMetaEl ) this._eventMetaEl.textContent = description;

		if ( this._featuredEventEl ) {
			this._featuredEventEl.setAttribute(
				'aria-label',
				`Featured event: ${name}. ${description}`
			);
		}

	}

	/**
	 * Render up to 3 daily challenge rows. Shows EmptyStateBlock when list is empty.
	 *
	 * @param {Array<{ id: string, title: string }>} challenges
	 */
	setDailyChallenges( challenges ) {

		const container = this._challengeListEl;
		if ( ! container ) return;

		container.innerHTML = '';

		if ( ! challenges || challenges.length === 0 ) {

			container.appendChild(
				this.buildEmptyState( {
					label:   'No active challenges',
					heading: 'No active challenges',
				} )
			);
			return;

		}

		challenges.forEach( ( c ) => {

			const row = document.createElement( 'div' );
			row.className = 'kk-challenge-row';
			row.setAttribute( 'role', 'listitem' );

			const title = document.createElement( 'span' );
			title.className = 'kk-challenge-row__title';
			title.textContent = c.title;
			row.appendChild( title );

			container.appendChild( row );

		} );

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._topNav?.dispose();
		this._topNav = null;

		this._hero?.dispose();
		this._hero = null;

		this._quickPlayBtn = null;
		this._railBtns = [];
		this._loadoutLinkEl = null;
		this._featuredEventEl = null;
		this._dailyChallengesHeadingBtn = null;
		this._challengeListEl = null;

		super.dispose();

	}

}

Page02HomeView._cssInjected = false;
