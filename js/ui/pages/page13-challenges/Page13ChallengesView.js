/**
 * Page13ChallengesView — Challenges / Quests.
 *
 * Layout: full-height viewport with no scroll on the outer shell.
 *
 * Grid rows: PageHeader | reset-timer bar | Tabs | body (1fr)
 * Body cols: main challenge list (1fr) | right sidebar (280px)
 *
 * Main list:
 *   - ChallengeRow per item: icon placeholder, title, description,
 *     ProgressBar, reward info, CLAIM button.
 *
 * Right sidebar:
 *   - Seasonal Driving Challenge card with progress fraction.
 *
 * Deviations from spec:
 *   - The "seasonal driving challenge" sidebar is a static card with data
 *     driven from MockData.season, not a separate component file, as no
 *     reusable SeasonalChallengeCard component exists in the component library.
 *   - Tab panels contain the challenge list; only the active panel is visible
 *     (Tabs component handles this).
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { Tabs }          from '../../components/Tabs.js';
import { ProgressBar }   from '../../components/ProgressBar.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

export class Page13ChallengesView extends PageViewBase {

	constructor() {

		super( 'page-challenges' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {Tabs} */
		this._tabs = null;

		/** @type {HTMLElement} */
		this._challengeListEl = null;

		/** @type {HTMLElement} */
		this._seasonalCardEl = null;

		/** @type {ProgressBar[]} Active progress bar instances for cleanup. */
		this._progressBars = [];

		/** @type {CTAButton[]} Active CLAIM button instances for cleanup. */
		this._claimButtons = [];

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( Page13ChallengesView._cssInjected ) return;
		Page13ChallengesView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-challenges {
				display: grid;
				grid-template-rows: auto auto auto 1fr;
				grid-template-columns: 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-surface);
			}

			/* ------------------------------------------------------------------ */
			/* Header zone                                                         */
			/* ------------------------------------------------------------------ */

			.page-challenges__header-zone {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* ------------------------------------------------------------------ */
			/* Reset timer bar                                                     */
			/* ------------------------------------------------------------------ */

			.page-challenges__reset-bar {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: var(--space-3);
				padding: var(--space-2) var(--space-6);
				background: var(--color-panel-raised);
				border-bottom: 1px solid var(--color-panel-border);
			}

			.page-challenges__reset-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.page-challenges__reset-timer {
				font-family: var(--font-mono, monospace);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				letter-spacing: var(--tracking-wider);
			}

			/* ------------------------------------------------------------------ */
			/* Tabs strip                                                          */
			/* ------------------------------------------------------------------ */

			.page-challenges__tabs-row {
				background: var(--color-panel-base);
			}

			/* ------------------------------------------------------------------ */
			/* Body — two-column layout                                            */
			/* ------------------------------------------------------------------ */

			.page-challenges__body {
				display: grid;
				grid-template-columns: 1fr 280px;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Challenge list panel                                                */
			/* ------------------------------------------------------------------ */

			.page-challenges__list-panel {
				overflow-y: auto;
				padding: var(--space-4) var(--space-6);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* ------------------------------------------------------------------ */
			/* Challenge row                                                       */
			/* ------------------------------------------------------------------ */

			.kk-challenge-row-full {
				display: grid;
				grid-template-columns: 56px 1fr auto;
				grid-template-rows: auto auto auto;
				column-gap: var(--space-4);
				row-gap: var(--space-2);
				padding: var(--space-4);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				align-items: start;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-challenge-row-full:focus-within {
				border-color: var(--color-accent-orange);
			}

			.kk-challenge-row-full--claimed {
				opacity: 0.55;
			}

			/* Thumbnail / icon area */
			.kk-challenge-row-full__thumb {
				grid-row: 1 / 4;
				grid-column: 1;
				width: 56px;
				height: 56px;
				background: var(--color-panel-raised);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-2xl);
				color: var(--color-ink-400);
			}

			/* Title */
			.kk-challenge-row-full__title {
				grid-row: 1;
				grid-column: 2;
				font-family: var(--font-ui);
				font-size: var(--text-base);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			/* Description */
			.kk-challenge-row-full__desc {
				grid-row: 2;
				grid-column: 2;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				line-height: var(--leading-relaxed);
			}

			/* Progress row */
			.kk-challenge-row-full__progress-row {
				grid-row: 3;
				grid-column: 2;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.kk-challenge-row-full__progress-text {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-300);
				letter-spacing: var(--tracking-wider);
			}

			.kk-challenge-row-full__progress-text strong {
				color: var(--color-ink-100);
			}

			/* Reward + claim column */
			.kk-challenge-row-full__reward-col {
				grid-row: 1 / 4;
				grid-column: 3;
				display: flex;
				flex-direction: column;
				align-items: flex-end;
				gap: var(--space-2);
				padding-left: var(--space-4);
			}

			.kk-challenge-row-full__reward-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.kk-challenge-row-full__reward-value {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
			}

			.kk-challenge-row-full__claimed-badge {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-success, #22c55e);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				padding: var(--space-1) var(--space-3);
				border: 1px solid var(--color-success, #22c55e);
				border-radius: var(--radius-sm);
			}

			/* ------------------------------------------------------------------ */
			/* Right sidebar                                                       */
			/* ------------------------------------------------------------------ */

			.page-challenges__sidebar {
				border-left: 1px solid var(--color-panel-border);
				padding: var(--space-4);
				overflow-y: auto;
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
			}

			/* ---- Seasonal driving challenge card ---- */

			.kk-seasonal-card {
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				overflow: hidden;
			}

			.kk-seasonal-card__header {
				background: var(--color-accent-orange);
				padding: var(--space-2) var(--space-3);
			}

			.kk-seasonal-card__header-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.kk-seasonal-card__body {
				padding: var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.kk-seasonal-card__thumb {
				width: 100%;
				aspect-ratio: 16 / 9;
				background: var(--color-panel-base);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-500);
				font-size: var(--text-sm);
				text-align: center;
			}

			.kk-seasonal-card__name {
				font-family: var(--font-display);
				font-size: var(--text-base);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.kk-seasonal-card__progress-label {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-accent-orange);
				letter-spacing: var(--tracking-wider);
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

		// ----- PageHeader -----
		this._header = new PageHeader( {
			title:    'CHALLENGES / QUESTS',
			showBack: true,
		} );

		const headerZone = document.createElement( 'div' );
		headerZone.className = 'page-challenges__header-zone';
		headerZone.appendChild( this._header.el );
		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Reset timer bar -----
		const resetBar = document.createElement( 'div' );
		resetBar.className = 'page-challenges__reset-bar';
		resetBar.setAttribute( 'aria-label', 'Challenge reset timer' );

		const resetLabel = document.createElement( 'span' );
		resetLabel.className = 'page-challenges__reset-label';
		resetLabel.textContent = 'RESET TIMER';

		this._timerEl = document.createElement( 'span' );
		this._timerEl.className = 'page-challenges__reset-timer';
		this._timerEl.textContent = '23:15:48';
		this._timerEl.setAttribute( 'aria-live', 'off' );

		resetBar.appendChild( resetLabel );
		resetBar.appendChild( this._timerEl );
		root.appendChild( resetBar );

		// ----- Tabs -----
		const TAB_DAILY     = ButtonIds.CHALLENGES_TAB_DAILY;
		const TAB_WEEKLY    = ButtonIds.CHALLENGES_TAB_WEEKLY;
		const TAB_SEASONAL  = ButtonIds.CHALLENGES_TAB_SEASONAL;
		const TAB_MILESTONES = ButtonIds.CHALLENGES_TAB_MILESTONES;

		this._tabs = new Tabs( {
			tabs: [
				{ id: TAB_DAILY,      label: 'DAILY' },
				{ id: TAB_WEEKLY,     label: 'WEEKLY' },
				{ id: TAB_SEASONAL,   label: 'SEASONAL' },
				{ id: TAB_MILESTONES, label: 'MILESTONES' },
			],
			activeId:  TAB_DAILY,
			ariaLabel: 'Challenge categories',
		} );

		const tabsRow = document.createElement( 'div' );
		tabsRow.className = 'page-challenges__tabs-row';
		tabsRow.appendChild( this._tabs.el );
		root.appendChild( tabsRow );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-challenges__body';
		this._registerSection( 'body', body );

		// Left: challenge list (single shared panel, content filtered by controller)
		this._challengeListEl = document.createElement( 'div' );
		this._challengeListEl.className = 'page-challenges__list-panel';
		this._challengeListEl.setAttribute( 'role', 'list' );
		this._challengeListEl.setAttribute( 'aria-label', 'Challenges' );
		body.appendChild( this._challengeListEl );
		this._registerSection( 'challengeList', this._challengeListEl );

		// Right: sidebar
		const sidebar = document.createElement( 'aside' );
		sidebar.className = 'page-challenges__sidebar';
		sidebar.setAttribute( 'aria-label', 'Seasonal challenge' );

		this._seasonalCardEl = document.createElement( 'div' );
		this._seasonalCardEl.className = 'kk-seasonal-card';
		sidebar.appendChild( this._seasonalCardEl );
		this._registerSection( 'sidebar', sidebar );
		body.appendChild( sidebar );

		root.appendChild( body );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Render the challenge list for the active category.
	 *
	 * @param {Array<{ id: string, title: string, desc: string, progress: number, target: number, reward: string, claimed: boolean }>} challenges
	 */
	setChallengeList( challenges ) {

		// Dispose existing progress bars and claim buttons
		this._progressBars.forEach( ( pb ) => pb.dispose() );
		this._progressBars = [];
		this._claimButtons = [];

		const container = this._challengeListEl;
		container.innerHTML = '';

		if ( ! challenges || challenges.length === 0 ) {

			container.appendChild(
				this.buildEmptyState( {
					label:   'No challenges in this category',
					heading: 'NO CHALLENGES',
					subtext: 'Check back after the next reset.',
				} )
			);
			return;

		}

		challenges.forEach( ( c ) => {

			const isComplete = c.progress >= c.target;
			const isClaimed  = c.claimed;

			const row = document.createElement( 'div' );
			row.className = 'kk-challenge-row-full';
			row.setAttribute( 'role', 'listitem' );
			if ( isClaimed ) row.classList.add( 'kk-challenge-row-full--claimed' );

			// Thumbnail
			const thumb = document.createElement( 'div' );
			thumb.className = 'kk-challenge-row-full__thumb';
			thumb.setAttribute( 'aria-hidden', 'true' );
			thumb.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>';
			row.appendChild( thumb );

			// Title
			const title = document.createElement( 'span' );
			title.className = 'kk-challenge-row-full__title';
			title.textContent = c.title;
			row.appendChild( title );

			// Description
			const desc = document.createElement( 'span' );
			desc.className = 'kk-challenge-row-full__desc';
			desc.textContent = c.desc;
			row.appendChild( desc );

			// Progress row
			const progressRow = document.createElement( 'div' );
			progressRow.className = 'kk-challenge-row-full__progress-row';

			const progressText = document.createElement( 'span' );
			progressText.className = 'kk-challenge-row-full__progress-text';
			progressText.innerHTML = `<strong>${c.progress}</strong> / ${c.target} &nbsp; REWARDS ${c.reward}`;
			progressRow.appendChild( progressText );

			const bar = new ProgressBar( {
				label:    `${c.title} progress`,
				value:    c.progress,
				min:      0,
				max:      c.target,
				variant:  'challenge',
				animated: true,
			} );
			this._progressBars.push( bar );
			progressRow.appendChild( bar.el );
			row.appendChild( progressRow );

			// Reward + claim column
			const rewardCol = document.createElement( 'div' );
			rewardCol.className = 'kk-challenge-row-full__reward-col';

			const rewardLabel = document.createElement( 'span' );
			rewardLabel.className = 'kk-challenge-row-full__reward-label';
			rewardLabel.textContent = 'REWARDS';
			rewardCol.appendChild( rewardLabel );

			const rewardValue = document.createElement( 'span' );
			rewardValue.className = 'kk-challenge-row-full__reward-value';
			rewardValue.textContent = c.reward;
			rewardCol.appendChild( rewardValue );

			if ( isClaimed ) {

				const badge = document.createElement( 'span' );
				badge.className = 'kk-challenge-row-full__claimed-badge';
				badge.textContent = 'CLAIMED';
				rewardCol.appendChild( badge );

			} else if ( isComplete ) {

				const claimBtn = new CTAButton( {
					label:    'CLAIM',
					variant:  'primary',
					actionId: ButtonIds.CHALLENGES_CLAIM,
					ariaLabel: `Claim reward for ${c.title}`,
				} );
				claimBtn.el.dataset.challengeClaim = c.id;
				this._claimButtons.push( claimBtn );
				rewardCol.appendChild( claimBtn.el );

			} else {

				const claimBtn = new CTAButton( {
					label:    'CLAIM',
					variant:  'secondary',
					actionId: ButtonIds.CHALLENGES_CLAIM,
					disabled: true,
					ariaLabel: `Claim reward for ${c.title} — not yet complete`,
				} );
				claimBtn.el.dataset.challengeClaim = c.id;
				this._claimButtons.push( claimBtn );
				rewardCol.appendChild( claimBtn.el );

			}

			row.appendChild( rewardCol );
			container.appendChild( row );

		} );

	}

	/**
	 * Populate the seasonal challenge sidebar card.
	 *
	 * @param {{ name: string, current: number, max: number }} data
	 */
	setSeasonalCard( { name, current, max } ) {

		const card = this._seasonalCardEl;
		card.innerHTML = '';

		const header = document.createElement( 'div' );
		header.className = 'kk-seasonal-card__header';

		const headerLabel = document.createElement( 'span' );
		headerLabel.className = 'kk-seasonal-card__header-label';
		headerLabel.textContent = 'SEASONAL DRIVING CHALLENGE';
		header.appendChild( headerLabel );
		card.appendChild( header );

		const body = document.createElement( 'div' );
		body.className = 'kk-seasonal-card__body';

		const thumb = document.createElement( 'div' );
		thumb.className = 'kk-seasonal-card__thumb';
		thumb.setAttribute( 'aria-hidden', 'true' );
		thumb.textContent = 'PREVIEW';
		body.appendChild( thumb );

		const nameEl = document.createElement( 'span' );
		nameEl.className = 'kk-seasonal-card__name';
		nameEl.textContent = name;
		body.appendChild( nameEl );

		const progressLabel = document.createElement( 'span' );
		progressLabel.className = 'kk-seasonal-card__progress-label';
		progressLabel.textContent = `${current} / ${max}`;
		body.appendChild( progressLabel );

		const bar = new ProgressBar( {
			label:    'Season pass progress',
			value:    current,
			min:      0,
			max,
			variant:  'xp',
			animated: true,
		} );
		this._progressBars.push( bar );
		body.appendChild( bar.el );

		card.appendChild( body );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus the page header's back button as the first meaningful element
		const backBtn = this._root.querySelector( '.kk-page-header__back' );
		backBtn?.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._progressBars.forEach( ( pb ) => pb.dispose() );
		this._progressBars = [];
		this._claimButtons = [];

		this._tabs?.dispose();
		this._tabs = null;

		this._header?.dispose();
		this._header = null;

		this._challengeListEl = null;
		this._seasonalCardEl  = null;

		super.dispose();

	}

}
