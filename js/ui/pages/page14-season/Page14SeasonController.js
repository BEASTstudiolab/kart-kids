/**
 * Page14SeasonController — Season Pass / Rewards.
 *
 * Route: RouteIds.SEASON ("/season")
 *
 * Responsibilities:
 *   - Create and configure Page14SeasonView.
 *   - Wire PageHeader back button → RouteIds.HOME.
 *   - Populate season banner from MockData.season.
 *   - Build reward timeline (free + premium tracks) from MOCK_SEASON_REWARDS.
 *   - Wire CLAIM REWARD buttons → reward claimed state + toast.
 *   - Wire ACTIVATE PREMIUM PASS CTA → ConfirmationDialog.
 *   - Wire SEASON MISSIONS → RouteIds.CHALLENGES.
 *   - Emit analytics page view on mount.
 *
 * Data: MockData.season (synchronous).
 */

import { PageControllerBase }  from '../../core/PageControllerBase.js';
import { Page14SeasonView }    from './Page14SeasonView.js';
import { RouteIds }            from '../../enums/RouteIds.js';
import { ModalIds }            from '../../enums/ModalIds.js';
import { PageIds }             from '../../enums/PageIds.js';
import { EventIds }            from '../../enums/EventIds.js';
import { MockData }            from '../../repositories/mocks/MockData.js';

/**
 * Mock season reward timeline nodes.
 * Each node has a tier number, free reward, and optional premium reward.
 */
const MOCK_SEASON_REWARDS = [
	{ tier: 1,  free: { label: '250 XP',         type: 'xp',    claimed: true  }, premium: { label: 'Neon Skin',        type: 'cosmetic', claimed: false } },
	{ tier: 2,  free: { label: '500 Coins',       type: 'coins', claimed: true  }, premium: { label: 'Flame Trail',      type: 'cosmetic', claimed: false } },
	{ tier: 3,  free: { label: 'Speed Boost x3',  type: 'item',  claimed: true  }, premium: { label: 'Dragon Kart',      type: 'kart',     claimed: false } },
	{ tier: 4,  free: { label: '750 XP',          type: 'xp',    claimed: false }, premium: { label: 'Gold Wheels',      type: 'cosmetic', claimed: false } },
	{ tier: 5,  free: { label: '1000 Coins',      type: 'coins', claimed: false }, premium: { label: 'VIP Emote',        type: 'emote',    claimed: false } },
	{ tier: 6,  free: { label: 'Shield Boost x5', type: 'item',  claimed: false }, premium: { label: 'Hologram Frame',   type: 'cosmetic', claimed: false } },
	{ tier: 7,  free: { label: '1500 XP',         type: 'xp',    claimed: false }, premium: { label: 'Turbo Kart',       type: 'kart',     claimed: false } },
	{ tier: 8,  free: { label: '1500 Coins',      type: 'coins', claimed: false }, premium: { label: 'Season Avatar',    type: 'cosmetic', claimed: false } },
	{ tier: 9,  free: { label: 'Boost Pack x10',  type: 'item',  claimed: false }, premium: { label: 'Premium Title',    type: 'title',    claimed: false } },
	{ tier: 10, free: { label: '5000 XP',         type: 'xp',    claimed: false }, premium: { label: 'Grand Trophy',     type: 'trophy',   claimed: false } },
];

export class Page14SeasonController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page14SeasonView} */
		this._view = null;

		/** @type {Array<object>} Mutable local reward nodes. */
		this._rewards = [];

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page14SeasonView();

		// Clone reward data for local mutable state.
		this._rewards = MOCK_SEASON_REWARDS.map( ( node ) => ( {
			...node,
			free:    { ...node.free },
			premium: { ...node.premium },
		} ) );

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → Home
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this.navigate( RouteIds.HOME );

		} );

		// Delegated CLAIM REWARD button clicks from timeline nodes
		this._addListener( view.root, 'click', ( e ) => {

			const claimBtn = e.target.closest( '[data-season-claim]' );
			if ( ! claimBtn ) return;

			const { tier, track } = claimBtn.dataset;
			this._handleClaim( Number( tier ), track );

		} );

		// ACTIVATE PREMIUM PASS
		this._addListener( view.activatePremiumBtn.el, 'click', () => {

			this._analytics?.track( EventIds.PREMIUM_PASS_VIEWED );
			this.openConfirm( {
				id:      ModalIds.PURCHASE_CONFIRM,
				title:   'ACTIVATE PREMIUM PASS',
				message: `Unlock all premium tier rewards for ${MockData.season.premiumPrice}. Are you sure?`,
				confirmLabel: 'ACTIVATE',
				cancelLabel:  'CANCEL',
				onConfirm: () => {

					this.showToast( {
						message:  'Premium Pass activated! All premium rewards unlocked.',
						variant:  'success',
						duration: 4000,
					} );

				},
			} );

		} );

		// SEASON MISSIONS → challenges
		this._addListener( view.seasonMissionsBtn.el, 'click', () => {

			this.navigate( RouteIds.CHALLENGES );

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		const view   = this._view;
		const season = MockData.season;

		view.setSeasonBanner( {
			name:          season.name,
			tier:          season.currentTier,
			maxTier:       season.maxTier,
			progress:      season.progress,
			timeRemaining: season.timeRemaining,
			hasPremium:    season.hasPremium,
		} );

		view.setRewardTimeline( this._rewards, season.currentTier );

		view.mount( container );

		this._analytics?.track( EventIds.PAGE_VIEWED, { page: PageIds.SEASON } );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Mark a reward node as claimed and refresh the timeline.
	 *
	 * @param {number} tier
	 * @param {'free'|'premium'} track
	 */
	_handleClaim( tier, track ) {

		const node = this._rewards.find( ( r ) => r.tier === tier );
		if ( ! node ) return;

		const reward = node[ track ];
		if ( ! reward || reward.claimed ) return;

		const currentTier = MockData.season.currentTier;
		if ( tier > currentTier ) return;

		reward.claimed = true;

		this._analytics?.track( EventIds.SEASON_REWARD_CLAIMED, { tier, track } );

		this.showToast( {
			message:  `Reward claimed: ${reward.label}`,
			variant:  'success',
			duration: 3000,
		} );

		this._view.setRewardTimeline( this._rewards, currentTier );

	}

}
