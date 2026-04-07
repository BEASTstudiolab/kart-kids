/**
 * Page23TutorialController — Onboarding / Tutorial.
 *
 * Route: RouteIds.TUTORIAL ("/tutorial")
 *
 * Responsibilities:
 *   - Create and configure Page23TutorialView.
 *   - Wire SKIP button → emit TUTORIAL_SKIPPED analytics → navigate to RouteIds.HOME.
 *   - Wire PRACTICE button → emit TUTORIAL_PRACTICE_STARTED → navigate to RouteIds.QUICK_PLAY.
 *   - Wire GET STARTED button → same as PRACTICE (quick path into the game).
 *   - Wire step card click/focus → advance the progress bar indicator.
 *   - Mark tutorial complete in localStorage on SKIP or GET STARTED so the router
 *     can bypass this page on subsequent visits.
 *
 * State:
 *   - currentStep tracks which step card last received focus or was last interacted with.
 *     Progress indicator updates accordingly.
 *   - Tutorial completion flag persisted in localStorage under 'kk:tutorial:complete'.
 *
 * Architecture notes:
 *   - No TutorialService is wired at M2 stage; localStorage is used directly as a
 *     lightweight persistence layer, matching the approach in Settings.js for the game.
 *   - The five tutorial step cards are static DOM; the controller drives the progress
 *     bar by listening for focus events on each card (inclusive first-run UX tracking).
 *   - No back button is rendered (first-run experience per spec §23); navigateBack()
 *     is not called from any button.
 */

import { PageControllerBase }    from '../../core/PageControllerBase.js';
import { Page23TutorialView }    from './Page23TutorialView.js';
import { RouteIds }              from '../../enums/RouteIds.js';
import { PageIds }               from '../../enums/PageIds.js';
import { EventIds }              from '../../enums/EventIds.js';
import * as Nav                  from '../../core/NavigationService.js';

/** localStorage key for tutorial completion flag. */
const TUTORIAL_COMPLETE_KEY = 'kk:tutorial:complete';

/** Total tutorial steps. */
const TOTAL_STEPS = 5;

export class Page23TutorialController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page23TutorialView} */
		this._view = null;

		/** @type {number} 1-based current step index. */
		this._currentStep = 1;

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page23TutorialView();

	}

	bindEvents() {

		const view = this._view;

		// SKIP — navigate to home without completing tutorial
		this._addListener( view.skipBtn.el, 'click', () => {

			this._handleSkip();

		} );

		// PRACTICE — go to quick play; mark complete
		this._addListener( view.practiceBtn.el, 'click', () => {

			this._handlePractice();

		} );

		// GET STARTED — same destination as PRACTICE
		this._addListener( view.getStartedBtn.el, 'click', () => {

			this._handleGetStarted();

		} );

		// Track step focus for progress bar advancement.
		// Step cards are article elements with aria-label "Step N: TITLE".
		// We delegate focus on the grid rather than attaching to each card individually.
		this._addListener( view.root, 'focusin', ( e ) => {

			const card = e.target.closest( '.tutorial-card' );
			if ( ! card ) return;

			// Extract step number from the badge span text "STEP N"
			const badge = card.querySelector( '.tutorial-card__step-badge' );
			if ( ! badge ) return;

			const match = badge.textContent.match( /\d+/ );
			if ( ! match ) return;

			const stepNum = parseInt( match[ 0 ], 10 );
			if ( stepNum >= 1 && stepNum <= TOTAL_STEPS && stepNum > this._currentStep ) {

				this._currentStep = stepNum;
				view.setProgress( this._currentStep, TOTAL_STEPS );

				this._analytics?.track( EventIds.TUTORIAL_STEP_COMPLETED, {
					step: this._currentStep,
				} );

			}

		} );

	}

	loadData() {

		// M2: No async data required; step content is hardcoded in the view.
		return Promise.resolve();

	}

	render( container ) {

		this._view.mount( container );
		this._analytics?.trackPageView( PageIds.TUTORIAL );

		// Set initial progress bar to step 1
		this._view.setProgress( 1, TOTAL_STEPS );

	}

	dispose() {

		this._currentStep = 1;
		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Static helper — check if tutorial has already been completed
	// ---------------------------------------------------------------------------

	/**
	 * Returns true if the player has already completed the tutorial.
	 * Used by RouterService or AppShell to decide whether to route to /tutorial.
	 *
	 * @returns {boolean}
	 */
	static isComplete() {

		try {

			return localStorage.getItem( TUTORIAL_COMPLETE_KEY ) === 'true';

		} catch {

			return false;

		}

	}

	// ---------------------------------------------------------------------------
	// Internal actions
	// ---------------------------------------------------------------------------

	/**
	 * Mark tutorial as complete in localStorage.
	 * Safe to call multiple times.
	 */
	_markComplete() {

		try {

			localStorage.setItem( TUTORIAL_COMPLETE_KEY, 'true' );

		} catch {

			// localStorage may be unavailable in private browsing or sandboxed contexts.
			console.warn( '[Page23TutorialController] Could not persist tutorial completion to localStorage.' );

		}

	}

	_handleSkip() {

		if ( this._disposed ) return;

		this._analytics?.track( EventIds.TUTORIAL_SKIPPED, {
			stepsCompleted: this._currentStep,
		} );

		this._view.skipBtn.setLoading( true );

		// Skipping does not mark tutorial complete — player may want to replay it.
		this.navigate( RouteIds.HOME );

	}

	_handlePractice() {

		if ( this._disposed ) return;

		this._analytics?.track( EventIds.TUTORIAL_PRACTICE_STARTED );
		this._markComplete();

		this._view.practiceBtn.setLoading( true );
		this.navigate( RouteIds.QUICK_PLAY );

	}

	_handleGetStarted() {

		if ( this._disposed ) return;

		this._analytics?.track( EventIds.TUTORIAL_PRACTICE_STARTED );
		this._markComplete();

		this._view.getStartedBtn.setLoading( true );
		this.navigate( RouteIds.QUICK_PLAY );

	}

}
