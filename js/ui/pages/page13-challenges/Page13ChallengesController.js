/**
 * Page13ChallengesController — Challenges / Quests.
 *
 * Route: RouteIds.CHALLENGES ("/challenges")
 *
 * Responsibilities:
 *   - Create and configure Page13ChallengesView.
 *   - Wire PageHeader back button → RouteIds.HOME.
 *   - Wire tab changes → filter challenge list by category.
 *   - Wire per-row CLAIM buttons → reward claim toast + claimed state.
 *   - Emit analytics page view on mount.
 *
 * Data: MockData.challenges (synchronous).
 */

import { PageControllerBase }       from '../../core/PageControllerBase.js';
import { Page13ChallengesView }     from './Page13ChallengesView.js';
import { RouteIds }                 from '../../enums/RouteIds.js';
import { ButtonIds }                from '../../enums/ButtonIds.js';
import { PageIds }                  from '../../enums/PageIds.js';
import { EventIds }                 from '../../enums/EventIds.js';
import { MockData }                 from '../../repositories/mocks/MockData.js';

export class Page13ChallengesController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page13ChallengesView} */
		this._view = null;

		/** @type {string} Currently active tab category. */
		this._activeCategory = 'daily';

		/** @type {Array<object>} Full challenge list with local claimed state. */
		this._challenges = [];

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page13ChallengesView();

		// Clone mock data so we can mutate claimed state locally.
		this._challenges = MockData.challenges.map( ( c ) => ( { ...c } ) );

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → Home
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this._analytics?.track( EventIds.BACK_CLICKED, { from: PageIds.CHALLENGES } );
			this.navigate( RouteIds.HOME );

		} );

		// Tabs change → re-filter list
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			this._analytics?.track( EventIds.CHALLENGE_TAB_CHANGED, { tabId } );
			this._activeCategory = tabId;
			this._renderChallengeList();

		} );

		// Delegated CLAIM button clicks from challenge rows
		this._addListener( view.root, 'click', ( e ) => {

			const claimBtn = e.target.closest( '[data-challenge-claim]' );
			if ( ! claimBtn ) return;

			const challengeId = claimBtn.dataset.challengeClaim;
			this._handleClaim( challengeId );

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view = this._view;
		const season = MockData.season;

		view.setSeasonalCard( {
			name:    season.name,
			current: season.currentTier,
			max:     season.maxTier,
		} );

		this._renderChallengeList();

		view.mount( container );

		this._analytics?.track( EventIds.PAGE_VIEWED, { page: PageIds.CHALLENGES } );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	_renderChallengeList() {

		const filtered = this._challenges.filter(
			( c ) => c.category === this._activeCategory
		);

		this._view.setChallengeList( filtered );

	}

	/**
	 * Mark a challenge as claimed and show toast.
	 *
	 * @param {string} challengeId
	 */
	_handleClaim( challengeId ) {

		const challenge = this._challenges.find( ( c ) => c.id === challengeId );
		if ( ! challenge ) return;
		if ( challenge.claimed ) return;
		if ( challenge.progress < challenge.target ) return;

		challenge.claimed = true;

		this._analytics?.track( EventIds.CHALLENGE_CLAIMED, { challengeId } );

		this.showToast( {
			message: `Reward claimed: ${challenge.reward}`,
			variant: 'success',
			duration: 3000,
		} );

		this._renderChallengeList();

	}

}
