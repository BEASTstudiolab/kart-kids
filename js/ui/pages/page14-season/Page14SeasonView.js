/**
 * Page14SeasonView — Season Pass / Rewards.
 *
 * Layout: full-height viewport, no outer scroll.
 *
 * Grid rows: PageHeader zone | season banner | progress bar row | timeline (1fr) | bottom action bar
 *
 * Season banner: season name, tier badge, time remaining, premium status.
 * Reward timeline: horizontal scrolling row of tier nodes, each with free track
 *   reward (top) and premium track reward (bottom). CLAIM REWARD button per claimable node.
 * Bottom action bar: ACTIVATE PREMIUM PASS CTA + SEASON MISSIONS button.
 *
 * Public API consumed by Page14SeasonController:
 *   setSeasonBanner({ name, tier, maxTier, progress, timeRemaining, hasPremium })
 *   setRewardTimeline(rewards[], currentTier)
 *   get activatePremiumBtn  — CTAButton
 *   get seasonMissionsBtn   — CTAButton
 *
 * Deviations from spec:
 *   - The reward timeline is horizontal-scroll rather than a fixed viewport to
 *     accommodate variable tier counts without truncation.
 *   - Free and premium reward nodes share a single column layout per tier
 *     rather than separate parallel tracks, which is simpler and works on mobile.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { ProgressBar }   from '../../components/ProgressBar.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

export class Page14SeasonView extends PageViewBase {

	constructor() {

		super( 'page-season' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {CTAButton} */
		this._activatePremiumBtn = null;

		/** @type {CTAButton} */
		this._seasonMissionsBtn = null;

		/** @type {ProgressBar} */
		this._progressBar = null;

		/** @type {HTMLElement} */
		this._bannerEl = null;

		/** @type {HTMLElement} */
		this._progressRowEl = null;

		/** @type {HTMLElement} */
		this._timelineEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( Page14SeasonView._cssInjected ) return;
		Page14SeasonView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-season {
				display: grid;
				grid-template-rows: auto auto auto 1fr auto;
				height: 100vh;
				overflow: hidden;
				background: var(--color-surface);
			}

			/* ------------------------------------------------------------------ */
			/* Header zone                                                         */
			/* ------------------------------------------------------------------ */

			.page-season__header-zone {
				display: flex;
				align-items: center;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* ------------------------------------------------------------------ */
			/* Season banner                                                       */
			/* ------------------------------------------------------------------ */

			.page-season__banner {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--space-4) var(--space-6);
				background: linear-gradient(135deg, rgba(249,115,22,0.15) 0%, var(--color-panel-raised) 100%);
				border-bottom: 1px solid var(--color-panel-border);
				gap: var(--space-4);
				flex-wrap: wrap;
			}

			.page-season__banner-left {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-season__banner-name {
				font-family: var(--font-display);
				font-size: var(--text-2xl);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-season__banner-sub {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.page-season__banner-right {
				display: flex;
				align-items: center;
				gap: var(--space-6);
			}

			.page-season__banner-stat {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-1);
			}

			.page-season__banner-stat-value {
				font-family: var(--font-display);
				font-size: var(--text-xl);
				font-weight: var(--weight-black);
				color: var(--color-accent-orange);
			}

			.page-season__banner-stat-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.page-season__premium-badge {
				display: inline-flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-1) var(--space-3);
				background: rgba(234,179,8,0.15);
				border: 1px solid var(--color-accent-yellow);
				border-radius: var(--radius-sm);
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-accent-yellow);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* ------------------------------------------------------------------ */
			/* Progress bar row                                                    */
			/* ------------------------------------------------------------------ */

			.page-season__progress-row {
				display: flex;
				align-items: center;
				gap: var(--space-4);
				padding: var(--space-3) var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-season__progress-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				white-space: nowrap;
			}

			.page-season__progress-bar-wrap {
				flex: 1 1 auto;
			}

			.page-season__progress-value {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				white-space: nowrap;
			}

			/* ------------------------------------------------------------------ */
			/* Timeline scroll area                                                */
			/* ------------------------------------------------------------------ */

			.page-season__timeline-area {
				overflow: auto;
				padding: var(--space-6);
			}

			.page-season__timeline {
				display: flex;
				flex-direction: row;
				align-items: stretch;
				gap: 0;
				min-width: max-content;
				position: relative;
			}

			/* Connecting track line behind nodes */
			.page-season__timeline::before {
				content: '';
				position: absolute;
				top: 50%;
				left: 24px;
				right: 24px;
				height: 2px;
				background: var(--color-panel-border);
				transform: translateY(-50%);
				z-index: 0;
			}

			/* ---- Tier node ---- */

			.kk-season-node {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
				padding: 0 var(--space-4);
				position: relative;
				z-index: 1;
				min-width: 140px;
			}

			/* Free reward card (top) */
			.kk-season-node__free,
			.kk-season-node__premium {
				width: 120px;
				padding: var(--space-3);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				text-align: center;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-season-node__free--claimed,
			.kk-season-node__premium--claimed {
				opacity: 0.5;
			}

			.kk-season-node__free--claimable {
				border-color: var(--color-accent-cyan);
				background: rgba(6, 182, 212, 0.06);
			}

			.kk-season-node__premium--claimable {
				border-color: var(--color-accent-yellow);
				background: rgba(234, 179, 8, 0.06);
			}

			.kk-season-node__track-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-ink-400);
			}

			.kk-season-node__free .kk-season-node__track-label {
				color: var(--color-accent-cyan);
			}

			.kk-season-node__premium .kk-season-node__track-label {
				color: var(--color-accent-yellow);
			}

			.kk-season-node__reward-icon {
				width: 36px;
				height: 36px;
				background: var(--color-panel-raised);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-400);
			}

			.kk-season-node__reward-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.kk-season-node__claimed-badge {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-success, #22c55e);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				padding: 2px var(--space-2);
				border: 1px solid var(--color-success, #22c55e);
				border-radius: var(--radius-sm);
			}

			.kk-season-node__claim-btn {
				width: 100%;
			}

			.kk-season-node__claim-btn .kk-cta-button {
				width: 100%;
				font-size: var(--text-xs);
				padding: 0 var(--space-2);
				min-height: 32px;
			}

			/* Tier indicator (center marker) */
			.kk-season-node__tier {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-1);
				z-index: 2;
			}

			.kk-season-node__tier-circle {
				width: 36px;
				height: 36px;
				border-radius: 50%;
				border: 2px solid var(--color-panel-border);
				background: var(--color-panel-raised);
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-black);
				color: var(--color-ink-300);
			}

			.kk-season-node__tier-circle--active {
				border-color: var(--color-accent-orange);
				background: var(--color-accent-orange);
				color: var(--color-white);
			}

			.kk-season-node__tier-circle--past {
				border-color: var(--color-accent-cyan);
				background: rgba(6,182,212,0.15);
				color: var(--color-accent-cyan);
			}

			.kk-season-node__tier-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			/* ------------------------------------------------------------------ */
			/* Bottom action bar                                                   */
			/* ------------------------------------------------------------------ */

			.page-season__action-bar {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: var(--space-4);
				padding: var(--space-4) var(--space-6);
				background: var(--color-panel-base);
				border-top: 1px solid var(--color-panel-border);
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
		root.setAttribute( 'aria-label', 'Season Pass' );

		// ----- Header zone -----
		this._header = new PageHeader( {
			title:    'SEASON PASS',
			showBack: true,
		} );

		const headerZone = document.createElement( 'div' );
		headerZone.className = 'page-season__header-zone';
		headerZone.appendChild( this._header.el );
		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Season banner (populated by setSeasonBanner) -----
		this._bannerEl = document.createElement( 'div' );
		this._bannerEl.className = 'page-season__banner';
		this._bannerEl.setAttribute( 'aria-label', 'Season information' );
		this._registerSection( 'banner', this._bannerEl );
		root.appendChild( this._bannerEl );

		// ----- Progress bar row (populated by setSeasonBanner) -----
		this._progressRowEl = document.createElement( 'div' );
		this._progressRowEl.className = 'page-season__progress-row';
		this._registerSection( 'progressRow', this._progressRowEl );
		root.appendChild( this._progressRowEl );

		// ----- Timeline scroll area -----
		const timelineArea = document.createElement( 'div' );
		timelineArea.className = 'page-season__timeline-area';
		timelineArea.setAttribute( 'aria-label', 'Season reward timeline' );

		this._timelineEl = document.createElement( 'div' );
		this._timelineEl.className = 'page-season__timeline';
		this._timelineEl.setAttribute( 'role', 'list' );
		timelineArea.appendChild( this._timelineEl );
		this._registerSection( 'timeline', this._timelineEl );
		root.appendChild( timelineArea );

		// ----- Bottom action bar -----
		const actionBar = document.createElement( 'div' );
		actionBar.className = 'page-season__action-bar';
		actionBar.setAttribute( 'role', 'toolbar' );
		actionBar.setAttribute( 'aria-label', 'Season pass actions' );

		this._seasonMissionsBtn = new CTAButton( {
			label:    'SEASON MISSIONS',
			variant:  'secondary',
			actionId: ButtonIds.SEASON_MISSIONS,
		} );
		actionBar.appendChild( this._seasonMissionsBtn.el );

		this._activatePremiumBtn = new CTAButton( {
			label:    'ACTIVATE PREMIUM PASS',
			variant:  'primary',
			actionId: ButtonIds.SEASON_CLAIM_REWARD,
		} );
		actionBar.appendChild( this._activatePremiumBtn.el );

		root.appendChild( actionBar );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		const backBtn = this._root.querySelector( '.kk-page-header__back' );
		backBtn?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Populate the season banner and progress bar.
	 *
	 * @param {{ name: string, tier: number, maxTier: number, progress: number, timeRemaining: string, hasPremium: boolean }} data
	 */
	setSeasonBanner( { name, tier, maxTier, progress, timeRemaining, hasPremium } ) {

		const banner = this._bannerEl;
		banner.innerHTML = '';

		// Left
		const left = document.createElement( 'div' );
		left.className = 'page-season__banner-left';

		const nameEl = document.createElement( 'div' );
		nameEl.className = 'page-season__banner-name';
		nameEl.textContent = name;
		left.appendChild( nameEl );

		const subEl = document.createElement( 'div' );
		subEl.className = 'page-season__banner-sub';
		subEl.textContent = `TIER ${tier} OF ${maxTier}`;
		left.appendChild( subEl );

		banner.appendChild( left );

		// Right
		const right = document.createElement( 'div' );
		right.className = 'page-season__banner-right';

		const makeStat = ( value, label ) => {
			const stat = document.createElement( 'div' );
			stat.className = 'page-season__banner-stat';
			const valEl = document.createElement( 'div' );
			valEl.className = 'page-season__banner-stat-value';
			valEl.textContent = value;
			const labelEl = document.createElement( 'div' );
			labelEl.className = 'page-season__banner-stat-label';
			labelEl.textContent = label;
			stat.appendChild( valEl );
			stat.appendChild( labelEl );
			return stat;
		};

		right.appendChild( makeStat( timeRemaining, 'TIME REMAINING' ) );

		if ( hasPremium ) {
			const badge = document.createElement( 'div' );
			badge.className = 'page-season__premium-badge';
			badge.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5L22 9.27l-5 4.88 1.18 6.85L12 17.77l-6.18 3.23L7 14.15 2 9.27l7-0.77L12 2z"/></svg> PREMIUM ACTIVE';
			right.appendChild( badge );
		}

		banner.appendChild( right );

		// Progress row
		const progressRow = this._progressRowEl;
		progressRow.innerHTML = '';

		// Dispose old bar
		if ( this._progressBar ) {
			this._progressBar.dispose();
			this._progressBar = null;
		}

		const label = document.createElement( 'span' );
		label.className = 'page-season__progress-label';
		label.textContent = 'SEASON PROGRESS';
		progressRow.appendChild( label );

		const barWrap = document.createElement( 'div' );
		barWrap.className = 'page-season__progress-bar-wrap';

		this._progressBar = new ProgressBar( {
			label:    'Season pass progress',
			value:    progress,
			min:      0,
			max:      100,
			variant:  'xp',
			animated: true,
		} );
		barWrap.appendChild( this._progressBar.el );
		progressRow.appendChild( barWrap );

		const valueEl = document.createElement( 'span' );
		valueEl.className = 'page-season__progress-value';
		valueEl.textContent = `${progress}%`;
		progressRow.appendChild( valueEl );

	}

	/**
	 * Render the reward timeline.
	 *
	 * @param {Array<{ tier: number, free: object, premium: object }>} rewards
	 * @param {number} currentTier
	 */
	setRewardTimeline( rewards, currentTier ) {

		const container = this._timelineEl;
		container.innerHTML = '';

		rewards.forEach( ( node ) => {

			const isPast   = node.tier < currentTier;
			const isActive = node.tier === currentTier;

			const col = document.createElement( 'div' );
			col.className = 'kk-season-node';
			col.setAttribute( 'role', 'listitem' );
			col.setAttribute( 'aria-label', `Tier ${node.tier}` );

			// Free reward card
			col.appendChild( this._buildRewardCard( node, 'free', isPast, isActive ) );

			// Tier indicator
			const tier = document.createElement( 'div' );
			tier.className = 'kk-season-node__tier';

			const circle = document.createElement( 'div' );
			circle.className = 'kk-season-node__tier-circle';
			if ( isActive ) circle.classList.add( 'kk-season-node__tier-circle--active' );
			else if ( isPast ) circle.classList.add( 'kk-season-node__tier-circle--past' );
			circle.textContent = String( node.tier );
			tier.appendChild( circle );

			const tierLabel = document.createElement( 'div' );
			tierLabel.className = 'kk-season-node__tier-label';
			tierLabel.textContent = `T${node.tier}`;
			tier.appendChild( tierLabel );

			col.appendChild( tier );

			// Premium reward card
			col.appendChild( this._buildRewardCard( node, 'premium', isPast, isActive ) );

			container.appendChild( col );

		} );

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a single reward card (free or premium track).
	 *
	 * @param {object}         node
	 * @param {'free'|'premium'} track
	 * @param {boolean}        isPast
	 * @param {boolean}        isActive
	 * @returns {HTMLElement}
	 */
	_buildRewardCard( node, track, isPast, isActive ) {

		const reward      = node[ track ];
		const isClaimable = ( isPast || isActive ) && ! reward.claimed;
		const isClaimed   = reward.claimed;

		const card = document.createElement( 'div' );
		card.className = `kk-season-node__${track}`;
		if ( isClaimed )   card.classList.add( `kk-season-node__${track}--claimed` );
		if ( isClaimable ) card.classList.add( `kk-season-node__${track}--claimable` );

		const trackLabel = document.createElement( 'div' );
		trackLabel.className = 'kk-season-node__track-label';
		trackLabel.textContent = track === 'free' ? 'FREE' : 'PREMIUM';
		card.appendChild( trackLabel );

		const icon = document.createElement( 'div' );
		icon.className = 'kk-season-node__reward-icon';
		icon.setAttribute( 'aria-hidden', 'true' );
		icon.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.75L12 12l-3.75 3 1.5-4.75L6 7.5h4.5L12 3z"/></svg>';
		card.appendChild( icon );

		const rewardLabel = document.createElement( 'div' );
		rewardLabel.className = 'kk-season-node__reward-label';
		rewardLabel.textContent = reward.label;
		card.appendChild( rewardLabel );

		if ( isClaimed ) {

			const badge = document.createElement( 'div' );
			badge.className = 'kk-season-node__claimed-badge';
			badge.textContent = 'CLAIMED';
			card.appendChild( badge );

		} else if ( isClaimable ) {

			const btnWrap = document.createElement( 'div' );
			btnWrap.className = 'kk-season-node__claim-btn';

			const btn = new CTAButton( {
				label:    'CLAIM',
				variant:  'primary',
				actionId: ButtonIds.SEASON_CLAIM_REWARD,
				ariaLabel: `Claim ${track} reward for tier ${node.tier}: ${reward.label}`,
			} );
			btn.el.dataset.seasonClaim = 'true';
			btn.el.dataset.tier        = String( node.tier );
			btn.el.dataset.track       = track;

			btnWrap.appendChild( btn.el );
			card.appendChild( btnWrap );

		}

		return card;

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get activatePremiumBtn() { return this._activatePremiumBtn; }

	/** @returns {CTAButton} */
	get seasonMissionsBtn() { return this._seasonMissionsBtn; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._progressBar?.dispose();
		this._progressBar = null;

		this._header?.dispose();
		this._header = null;

		this._activatePremiumBtn = null;
		this._seasonMissionsBtn  = null;
		this._bannerEl           = null;
		this._progressRowEl      = null;
		this._timelineEl         = null;

		super.dispose();

	}

}
