/**
 * Page20InboxController — Notifications / Inbox.
 *
 * Route: RouteIds.INBOX ("/inbox")
 *
 * Responsibilities:
 *   - Create and configure Page20InboxView.
 *   - Wire PageHeader back button → RouteIds.HOME.
 *   - Populate message list from EXTENDED_INBOX data.
 *   - Wire tab changes → filter messages by type.
 *   - Wire per-message CLAIM/READ buttons.
 *   - Wire CLAIM ALL button → mark all claimable in active category as claimed.
 *   - Update unread count badges on tabs.
 *   - Emit analytics events.
 *
 * Data: MockData.inbox (synchronous, extended inline).
 */

import { PageControllerBase }  from '../../core/PageControllerBase.js';
import { Page20InboxView }     from './Page20InboxView.js';
import { RouteIds }            from '../../enums/RouteIds.js';
import { ButtonIds }           from '../../enums/ButtonIds.js';
import { PageIds }             from '../../enums/PageIds.js';
import { EventIds }            from '../../enums/EventIds.js';
import { MockData }            from '../../repositories/mocks/MockData.js';

/** Extended inbox data covering all tab categories. */
const EXTENDED_INBOX = [
	// INBOX / MESSAGES
	...MockData.inbox.map( ( m ) => ( { ...m, category: 'inbox' } ) ),
	{ id: 'msg4', category: 'inbox',    type: 'message', from: 'RALLY KID',   subject: 'Want to race this weekend?',         time: '3 days ago',    read: false },
	{ id: 'msg5', category: 'inbox',    type: 'message', from: 'SPARKYZZ',    subject: 'Check out my new track!',            time: '1 week ago',    read: true  },

	// REWARDS
	{ id: 'rwd1', category: 'rewards',  type: 'reward',  from: 'SYSTEM',      subject: 'Season 1 Completion Reward',         time: '2 weeks ago',   read: false, claimable: true,  claimed: false },
	{ id: 'rwd2', category: 'rewards',  type: 'reward',  from: 'SYSTEM',      subject: 'Daily Login Streak — Day 7',         time: '1 week ago',    read: false, claimable: true,  claimed: false },
	{ id: 'rwd3', category: 'rewards',  type: 'reward',  from: 'SYSTEM',      subject: 'Tournament Placement Reward',        time: '3 days ago',    read: true,  claimable: true,  claimed: true  },
	{ id: 'rwd4', category: 'rewards',  type: 'reward',  from: 'SYSTEM',      subject: 'Friend Referral Bonus',             time: 'Today',         read: false, claimable: true,  claimed: false },

	// EVENT NOTICES
	{ id: 'evt1', category: 'events',   type: 'event',   from: 'KART KIDS',   subject: 'Super Drift Tokyo — Starts in 2 days!', time: '1 day ago',  read: false },
	{ id: 'evt2', category: 'events',   type: 'event',   from: 'KART KIDS',   subject: 'Weekend Tournament registration open',  time: '2 days ago', read: true  },
	{ id: 'evt3', category: 'events',   type: 'event',   from: 'KART KIDS',   subject: 'Season 2 — Prepare for launch',        time: '5 days ago', read: true  },

	// SYSTEM
	{ id: 'sys1', category: 'system',   type: 'system',  from: 'SYSTEM',      subject: 'Server maintenance: Sunday 3 AM UTC', time: '2 days ago',  read: false },
	{ id: 'sys2', category: 'system',   type: 'system',  from: 'SYSTEM',      subject: 'App updated to v1.1.0',               time: '1 week ago',  read: true  },
	{ id: 'sys3', category: 'system',   type: 'system',  from: 'SYSTEM',      subject: 'New content available — Season 1',    time: '2 weeks ago', read: true  },
];

export class Page20InboxController extends PageControllerBase {

	/**
	 * @param {object}   params
	 * @param {Services} services
	 */
	constructor( params = {}, services = {} ) {

		super( params, services );

		/** @type {Page20InboxView} */
		this._view = null;

		/** @type {string} Active tab category. */
		this._activeCategory = 'inbox';

		/** @type {Array<object>} Mutable local message list. */
		this._messages = [];

	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	initialize( params ) { // eslint-disable-line no-unused-vars

		this._view = new Page20InboxView();
		this._messages = EXTENDED_INBOX.map( ( m ) => ( { ...m } ) );

	}

	bindEvents() {

		const view = this._view;

		// PageHeader back → Home
		this._addListener( view.root, 'kk:pageheader:back', () => {

			this.navigate( RouteIds.HOME );

		} );

		// Tab changes
		this._addListener( view.root, 'kk:tabs:change', ( e ) => {

			const { tabId } = e.detail;
			const catMap = {
				[ ButtonIds.INBOX_TAB_MESSAGES      ]: 'inbox',
				[ ButtonIds.INBOX_TAB_REWARDS       ]: 'rewards',
				[ ButtonIds.INBOX_TAB_EVENT_NOTICES ]: 'events',
				[ ButtonIds.INBOX_TAB_SYSTEM        ]: 'system',
			};
			this._activeCategory = catMap[ tabId ] ?? 'inbox';
			this._renderMessages();

		} );

		// Delegated CLAIM per-message click
		this._addListener( view.root, 'click', ( e ) => {

			const btn = e.target.closest( '[data-inbox-claim]' );
			if ( ! btn ) return;
			this._handleClaim( btn.dataset.inboxClaim );

		} );

		// CLAIM ALL
		this._addListener( view.claimAllBtn.el, 'click', () => {

			this._handleClaimAll();

		} );

	}

	loadData() {

		return Promise.resolve();

	}

	render( container ) {

		this._renderMessages();
		this._updateTabBadges();

		this._view.mount( container );

		this._analytics?.track( EventIds.PAGE_VIEWED, { page: PageIds.INBOX } );

	}

	dispose() {

		super.dispose();

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	_renderMessages() {

		const filtered = this._messages.filter( ( m ) => m.category === this._activeCategory );
		const unread   = filtered.filter( ( m ) => ! m.read ).length;

		this._view.setMessageList( filtered );
		this._view.setUnreadCount( unread );

		// Check if any claimable items exist in this category
		const hasClaimable = filtered.some( ( m ) => m.claimable && ! m.claimed );
		this._view.setClaimAllEnabled( hasClaimable );

	}

	_updateTabBadges() {

		const catKeys = [ 'inbox', 'rewards', 'events', 'system' ];
		const tabIds  = [
			ButtonIds.INBOX_TAB_MESSAGES,
			ButtonIds.INBOX_TAB_REWARDS,
			ButtonIds.INBOX_TAB_EVENT_NOTICES,
			ButtonIds.INBOX_TAB_SYSTEM,
		];

		catKeys.forEach( ( cat, i ) => {
			const count = this._messages.filter( ( m ) => m.category === cat && ! m.read ).length;
			this._view.setTabBadge( tabIds[ i ], count > 0 ? count : null );
		} );

	}

	/**
	 * Mark a message as read / claimed.
	 *
	 * @param {string} messageId
	 */
	_handleClaim( messageId ) {

		const msg = this._messages.find( ( m ) => m.id === messageId );
		if ( ! msg ) return;

		if ( msg.claimable ) {

			if ( msg.claimed ) return;
			msg.claimed = true;
			msg.read    = true;

			this._analytics?.track( EventIds.INBOX_CLAIMED, { messageId } );

			this.showToast( {
				message:  `Reward claimed: ${msg.subject}`,
				variant:  'success',
				duration: 3000,
			} );

		} else {

			msg.read = true;

		}

		this._renderMessages();
		this._updateTabBadges();

	}

	/**
	 * Claim all claimable messages in the active category.
	 */
	_handleClaimAll() {

		const claimable = this._messages.filter(
			( m ) => m.category === this._activeCategory && m.claimable && ! m.claimed
		);

		if ( claimable.length === 0 ) return;

		claimable.forEach( ( m ) => {
			m.claimed = true;
			m.read    = true;
		} );

		this._analytics?.track( EventIds.INBOX_CLAIMED_ALL, { category: this._activeCategory, count: claimable.length } );

		this.showToast( {
			message:  `Claimed ${claimable.length} reward${claimable.length > 1 ? 's' : ''}.`,
			variant:  'success',
			duration: 3000,
		} );

		this._renderMessages();
		this._updateTabBadges();

	}

}
