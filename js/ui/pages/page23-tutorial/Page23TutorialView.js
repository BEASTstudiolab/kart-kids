/**
 * Page23TutorialView — Onboarding / Tutorial.
 *
 * Route: RouteIds.TUTORIAL ("/tutorial")
 *
 * Layout:
 *   .page-tutorial                          — full-page flex column root
 *     .tutorial-top-bar                     — header row: title left, progress center, SKIP right
 *       .kk-page-header (no back button)
 *       .tutorial-progress                  — "STEP PROGRESS: 1/5" label + ProgressBar
 *       CTAButton (ghost, SKIP)
 *     .tutorial-grid                        — 2×2 + 1 card grid
 *       .tutorial-card (×5)                 — step cards
 *
 * Grid layout (matches mockup):
 *   Row 1: STEP 1 (BASIC CONTROLS) | STEP 2 (DRIFT)
 *   Row 2: STEP 3 (BOOST)          | STEP 5 (PRACTICE) center card  | STEP 4 (ITEM USE)
 *
 * Card anatomy:
 *   .tutorial-card
 *     .tutorial-card__icon          — SVG icon (hand / controller / boost / item / checkered)
 *     .tutorial-card__body
 *       .tutorial-card__step-label  — "STEP N"
 *       .tutorial-card__title       — "BASIC CONTROLS" etc.
 *       .tutorial-card__instructions— ordered list of instruction lines
 *     .tutorial-card__illustration  — character illustration placeholder
 *     (step 5 only) CTAButton PRACTICE + CTAButton GET STARTED
 *
 * Step 5 (PRACTICE) spans the center of row 2 and contains two action buttons.
 *
 * ProgressBar: value = currentStep / totalSteps * 100; label = "Step N of 5".
 *
 * Deviations from spec:
 *   - Character illustration slots are styled placeholder divs; actual artwork
 *     is out of scope for M2.
 *   - Steps are presented simultaneously in the grid rather than as a linear
 *     wizard flow, matching the mockup which shows all 5 cards at once.
 *   - SKIP and GET STARTED both navigate to their targets via controller events;
 *     the view only exposes button references.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { ProgressBar }  from '../../components/ProgressBar.js';
import { CTAButton }    from '../../components/CTAButton.js';
import { ButtonIds }    from '../../enums/ButtonIds.js';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TutorialStep
 * @property {number}   step
 * @property {string}   id
 * @property {string}   title
 * @property {string[]} instructions
 * @property {string}   iconSvg
 * @property {boolean}  [isPractice]  True for step 5; renders action buttons
 */

/** @type {TutorialStep[]} */
const TUTORIAL_STEPS = [
	{
		step: 1,
		id:   'basic-controls',
		title: 'BASIC CONTROLS',
		instructions: [
			'Tap and Hold [GAS/BRAKE] to manage speed.',
			'Use [STEER] to turn.',
		],
		iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<!-- Hand icon -->
			<path d="M22 8v16M16 14v10M10 17v7M28 14v10M34 18v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M10 24c0 0 0 10 12 14s12-2 12-2V20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>`,
	},
	{
		step: 2,
		id:   'drift',
		title: 'DRIFT',
		instructions: [
			'Press and Hold [DRIFT] (Right Bumper/Button) while turning to initiate a drift.',
			'Control the slide to build power!',
		],
		iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<!-- Kart / controller icon -->
			<rect x="6" y="18" width="36" height="14" rx="5" stroke="currentColor" stroke-width="2.5"/>
			<circle cx="14" cy="35" r="4" stroke="currentColor" stroke-width="2.5"/>
			<circle cx="34" cy="35" r="4" stroke="currentColor" stroke-width="2.5"/>
			<path d="M22 18V12l8 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
			<!-- Drift curve lines -->
			<path d="M4 28 Q14 38 26 30" stroke="var(--color-accent-orange)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
		</svg>`,
	},
	{
		step: 3,
		id:   'boost',
		title: 'BOOST',
		instructions: [
			'After a perfect drift, release [DRIFT] for a BOOST!',
			'Timing is key.',
		],
		iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<!-- Boost / lightning bolt icon -->
			<polygon points="28,6 14,26 22,26 20,42 34,22 26,22" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
			<path d="M6 24h4M38 24h4M12 12l3 3M33 12l-3 3" stroke="var(--color-accent-yellow)" stroke-width="2" stroke-linecap="round"/>
		</svg>`,
	},
	{
		step: 4,
		id:   'item-use',
		title: 'ITEM USE',
		instructions: [
			'Pick up Items from boxes.',
			'Tap [ITEM] to use. Use defensively or offensively!',
		],
		iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<!-- Item box icon -->
			<rect x="10" y="14" width="28" height="22" rx="4" stroke="currentColor" stroke-width="2.5"/>
			<path d="M24 14v22M10 25h28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			<circle cx="24" cy="10" r="3" stroke="var(--color-accent-cyan)" stroke-width="2"/>
		</svg>`,
	},
	{
		step: 5,
		id:   'practice',
		title: 'PRACTICE',
		instructions: [
			'Take what you\'ve learned to a dedicated practice track.',
			'Ready to become the ultimate racer?',
		],
		iconSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<!-- Checkered flag / target icon -->
			<circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2.5"/>
			<circle cx="24" cy="24" r="8" stroke="var(--color-accent-orange)" stroke-width="2.5"/>
			<circle cx="24" cy="24" r="2" fill="var(--color-accent-orange)"/>
		</svg>`,
		isPractice: true,
	},
];

export class Page23TutorialView extends PageViewBase {

	constructor() {

		super( 'page-tutorial' );

		/** @type {PageHeader} */
		this._pageHeader = null;

		/** @type {ProgressBar} */
		this._progressBar = null;

		/** @type {CTAButton} */
		this._skipBtn = null;

		/** @type {CTAButton} */
		this._practiceBtn = null;

		/** @type {CTAButton} */
		this._getStartedBtn = null;

		/** @type {HTMLElement} */
		this._progressLabel = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page23TutorialView._cssInjected ) return;
		Page23TutorialView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root
			   ================================================================ */

			.page-tutorial {
				display: flex;
				flex-direction: column;
				min-height: 100vh;
				background: var(--color-bg-base);
				color: var(--color-white);
				font-family: var(--font-ui);
				overflow: hidden;
			}

			/* ================================================================
			   Top bar
			   ================================================================ */

			.tutorial-top-bar {
				display: grid;
				grid-template-columns: auto 1fr auto;
				align-items: center;
				gap: var(--space-4);
				padding: var(--space-4) var(--space-6);
				background: var(--color-panel-base);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				flex-shrink: 0;
			}

			.tutorial-top-bar .kk-page-header {
				padding: 0;
			}

			/* ================================================================
			   Progress section (center of top bar)
			   ================================================================ */

			.tutorial-progress {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				min-width: 200px;
				max-width: 340px;
				justify-self: center;
			}

			.tutorial-progress__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.tutorial-progress .kk-progress-bar {
				width: 100%;
			}

			/* ================================================================
			   Card grid
			   ================================================================ */

			.tutorial-grid {
				flex: 1 1 auto;
				display: grid;
				grid-template-columns: 1fr 1fr;
				grid-template-rows: auto auto;
				gap: var(--space-4);
				padding: var(--space-5) var(--space-6) var(--space-6);
				align-content: start;
			}

			/* Row 2: 3-column with step 5 centered */
			.tutorial-grid-row2 {
				grid-column: 1 / -1;
				display: grid;
				grid-template-columns: 1fr 1fr 1fr;
				gap: var(--space-4);
			}

			@media (max-width: 768px) {
				.tutorial-grid {
					grid-template-columns: 1fr;
				}

				.tutorial-grid-row2 {
					grid-template-columns: 1fr;
				}
			}

			/* ================================================================
			   Tutorial step card
			   ================================================================ */

			.tutorial-card {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
				padding: var(--space-5);
				background: var(--color-panel-base);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-lg);
				position: relative;
				overflow: hidden;
				transition: border-color var(--duration-normal) var(--ease-standard);
			}

			.tutorial-card:hover {
				border-color: var(--color-panel-border-strong);
			}

			/* Step 5 practice card — accent border + centered content */
			.tutorial-card--practice {
				border-color: var(--color-accent-orange);
				background: linear-gradient(135deg, var(--color-panel-base) 70%, rgba(255, 107, 0, 0.08));
				align-items: center;
				text-align: center;
			}

			.tutorial-card--practice:hover {
				border-color: var(--color-accent-orange);
				box-shadow: 0 0 24px rgba(255, 107, 0, 0.18);
			}

			/* Step number badge — top-left corner */
			.tutorial-card__step-badge {
				position: absolute;
				top: var(--space-3);
				left: var(--space-3);
				font-family: var(--font-display);
				font-size: var(--text-xs);
				font-weight: var(--weight-black);
				color: var(--color-accent-orange);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				background: rgba(255, 107, 0, 0.12);
				padding: 2px var(--space-2);
				border-radius: var(--radius-sm);
			}

			/* Icon */
			.tutorial-card__icon {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 56px;
				height: 56px;
				border-radius: var(--radius-lg);
				background: rgba(255, 255, 255, 0.05);
				border: var(--border-thin) solid var(--color-panel-border);
				color: var(--color-white);
				flex-shrink: 0;
				align-self: flex-start;
				margin-top: var(--space-4); /* clear the step badge */
			}

			.tutorial-card--practice .tutorial-card__icon {
				align-self: center;
				margin-top: var(--space-4);
				width: 64px;
				height: 64px;
				background: rgba(255, 107, 0, 0.12);
				border-color: rgba(255, 107, 0, 0.35);
				color: var(--color-accent-orange);
			}

			.tutorial-card__icon svg {
				width: 32px;
				height: 32px;
			}

			.tutorial-card--practice .tutorial-card__icon svg {
				width: 36px;
				height: 36px;
			}

			/* Body */
			.tutorial-card__body {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				flex: 1 1 auto;
			}

			.tutorial-card--practice .tutorial-card__body {
				align-items: center;
			}

			.tutorial-card__title {
				font-family: var(--font-display);
				font-size: var(--text-lg);
				font-weight: var(--weight-black);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				margin: 0;
				line-height: var(--leading-tight);
			}

			.tutorial-card--practice .tutorial-card__title {
				font-size: var(--text-xl);
				color: var(--color-accent-orange);
			}

			/* Instruction list */
			.tutorial-card__instructions {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.tutorial-card__instructions li {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
				line-height: var(--leading-relaxed);
				padding-left: var(--space-3);
				position: relative;
			}

			.tutorial-card__instructions li::before {
				content: counter(instruction-counter) '.';
				counter-increment: instruction-counter;
				position: absolute;
				left: 0;
				color: var(--color-accent-orange);
				font-weight: var(--weight-bold);
				font-size: var(--text-xs);
			}

			.tutorial-card__instructions {
				counter-reset: instruction-counter;
			}

			.tutorial-card--practice .tutorial-card__instructions li {
				padding-left: 0;
				text-align: center;
				color: var(--color-ink-300);
			}

			.tutorial-card--practice .tutorial-card__instructions li::before {
				content: none;
			}

			/* Illustration placeholder */
			.tutorial-card__illustration {
				width: 100%;
				height: 72px;
				background: var(--color-ink-900);
				border-radius: var(--radius-md);
				border: var(--border-thin) solid var(--color-panel-border);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-600);
				font-size: var(--text-xs);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				flex-shrink: 0;
			}

			.tutorial-card--practice .tutorial-card__illustration {
				display: none; /* practice card uses button stack instead */
			}

			/* Practice card sub-brand label */
			.tutorial-card__brand-label {
				font-family: var(--font-display);
				font-size: var(--text-base);
				font-weight: var(--weight-black);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* Practice card button stack */
			.tutorial-card__actions {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				width: 100%;
				align-items: center;
				margin-top: var(--space-2);
			}

			.tutorial-card__actions .kk-cta-button {
				width: 100%;
				justify-content: center;
				min-width: 160px;
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
		root.setAttribute( 'aria-label', 'Tutorial: Learn to race' );

		// ----- Top bar -----
		const topBar = document.createElement( 'div' );
		topBar.className = 'tutorial-top-bar';
		topBar.setAttribute( 'role', 'banner' );

		// PageHeader — no back button (first-run experience)
		this._pageHeader = new PageHeader( {
			title:    'TUTORIAL',
			showBack: false,
		} );
		topBar.appendChild( this._pageHeader.el );

		// Progress center
		const progressZone = document.createElement( 'div' );
		progressZone.className = 'tutorial-progress';
		progressZone.setAttribute( 'aria-live', 'polite' );
		progressZone.setAttribute( 'aria-atomic', 'true' );

		this._progressLabel = document.createElement( 'span' );
		this._progressLabel.className = 'tutorial-progress__label';
		this._progressLabel.textContent = 'STEP PROGRESS: 1/5';

		this._progressBar = new ProgressBar( {
			label:        'Tutorial progress',
			value:        1,
			min:          0,
			max:          5,
			valueText:    'Step 1 of 5',
			showEndLabel: false,
			animated:     true,
			variant:      'default',
		} );

		progressZone.appendChild( this._progressLabel );
		progressZone.appendChild( this._progressBar.el );
		topBar.appendChild( progressZone );

		// SKIP button (top-right, ghost)
		this._skipBtn = new CTAButton( {
			label:    'SKIP',
			variant:  'ghost',
			actionId: ButtonIds.TUTORIAL_SKIP,
			ariaLabel: 'Skip tutorial and go to home',
		} );
		topBar.appendChild( this._skipBtn.el );

		this._registerSection( 'topBar', topBar );
		root.appendChild( topBar );

		// ----- Card grid -----
		const grid = document.createElement( 'div' );
		grid.className = 'tutorial-grid';
		grid.setAttribute( 'role', 'list' );
		grid.setAttribute( 'aria-label', 'Tutorial steps' );

		// Row 1: Step 1 + Step 2
		const step1Card = this._buildCard( TUTORIAL_STEPS[ 0 ] );
		const step2Card = this._buildCard( TUTORIAL_STEPS[ 1 ] );
		step1Card.setAttribute( 'role', 'listitem' );
		step2Card.setAttribute( 'role', 'listitem' );
		grid.appendChild( step1Card );
		grid.appendChild( step2Card );

		// Row 2 wrapper: Step 3 | Step 5 (practice, center) | Step 4
		const row2 = document.createElement( 'div' );
		row2.className = 'tutorial-grid-row2';

		const step3Card = this._buildCard( TUTORIAL_STEPS[ 2 ] );
		const step5Card = this._buildCard( TUTORIAL_STEPS[ 4 ] );  // practice
		const step4Card = this._buildCard( TUTORIAL_STEPS[ 3 ] );

		step3Card.setAttribute( 'role', 'listitem' );
		step5Card.setAttribute( 'role', 'listitem' );
		step4Card.setAttribute( 'role', 'listitem' );

		row2.appendChild( step3Card );
		row2.appendChild( step5Card );
		row2.appendChild( step4Card );

		grid.appendChild( row2 );

		this._registerSection( 'grid', grid );
		root.appendChild( grid );

	}

	// ---------------------------------------------------------------------------
	// Card builder
	// ---------------------------------------------------------------------------

	/**
	 * Build a tutorial step card element.
	 *
	 * @param {TutorialStep} step
	 * @returns {HTMLElement}
	 */
	_buildCard( step ) {

		const card = document.createElement( 'article' );
		card.className = step.isPractice
			? 'tutorial-card tutorial-card--practice'
			: 'tutorial-card';
		card.setAttribute( 'aria-label', `Step ${step.step}: ${step.title}` );

		// Step badge
		const badge = document.createElement( 'span' );
		badge.className = 'tutorial-card__step-badge';
		badge.setAttribute( 'aria-hidden', 'true' );
		badge.textContent = `STEP ${step.step}`;
		card.appendChild( badge );

		// Icon
		const iconWrap = document.createElement( 'div' );
		iconWrap.className = 'tutorial-card__icon';
		iconWrap.setAttribute( 'aria-hidden', 'true' );
		iconWrap.innerHTML = step.iconSvg;
		card.appendChild( iconWrap );

		// Body
		const body = document.createElement( 'div' );
		body.className = 'tutorial-card__body';

		const title = document.createElement( 'h2' );
		title.className = 'tutorial-card__title';
		title.textContent = step.title;
		body.appendChild( title );

		const instrList = document.createElement( 'ol' );
		instrList.className = 'tutorial-card__instructions';
		step.instructions.forEach( ( text ) => {

			const li = document.createElement( 'li' );
			li.textContent = text;
			instrList.appendChild( li );

		} );
		body.appendChild( instrList );

		// Practice card: brand label + action buttons
		if ( step.isPractice ) {

			const brandLabel = document.createElement( 'span' );
			brandLabel.className = 'tutorial-card__brand-label';
			brandLabel.textContent = 'BEASTSIDE';
			body.appendChild( brandLabel );

		}

		card.appendChild( body );

		// Illustration placeholder (non-practice cards only)
		if ( ! step.isPractice ) {

			const illus = document.createElement( 'div' );
			illus.className = 'tutorial-card__illustration';
			illus.setAttribute( 'aria-hidden', 'true' );
			illus.textContent = 'CHARACTER ART';
			card.appendChild( illus );

		}

		// Practice card action buttons
		if ( step.isPractice ) {

			const actions = document.createElement( 'div' );
			actions.className = 'tutorial-card__actions';

			this._practiceBtn = new CTAButton( {
				label:    'PRACTICE',
				variant:  'secondary',
				actionId: ButtonIds.TUTORIAL_PRACTICE,
				ariaLabel: 'Go to practice track',
			} );

			this._getStartedBtn = new CTAButton( {
				label:    'GET STARTED',
				variant:  'primary',
				actionId: 'tutorial_get_started',
				ariaLabel: 'Get started and go to quick play',
			} );

			actions.appendChild( this._practiceBtn.el );
			actions.appendChild( this._getStartedBtn.el );
			card.appendChild( actions );

		}

		return card;

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get skipBtn() { return this._skipBtn; }

	/** @returns {CTAButton} */
	get practiceBtn() { return this._practiceBtn; }

	/** @returns {CTAButton} */
	get getStartedBtn() { return this._getStartedBtn; }

	/**
	 * Update the step progress indicator.
	 *
	 * @param {number} step  Current step (1–5).
	 * @param {number} total Total steps (5).
	 */
	setProgress( step, total ) {

		this._progressLabel.textContent = `STEP PROGRESS: ${step}/${total}`;
		this._progressBar.setValue( step, `Step ${step} of ${total}` );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Initial focus: SKIP button (accessible shortcut visible at the top)
		requestAnimationFrame( () => {

			this._skipBtn?.el.focus( { preventScroll: true } );

		} );

	}

	dispose() {

		this._pageHeader?.dispose();
		this._pageHeader = null;

		this._progressBar?.dispose();
		this._progressBar = null;

		this._skipBtn?.dispose();
		this._skipBtn = null;

		this._practiceBtn?.dispose();
		this._practiceBtn = null;

		this._getStartedBtn?.dispose();
		this._getStartedBtn = null;

		this._progressLabel = null;

		super.dispose();

	}

}

Page23TutorialView._cssInjected = false;
