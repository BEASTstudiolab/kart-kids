/**
 * Page20InboxView — Notifications / Inbox.
 *
 * Layout: full-height viewport, no outer scroll.
 *
 * Grid rows: PageHeader zone | Tabs | body (1fr)
 * Body cols: message list (1fr) | right sidebar (260px)
 *
 * Message list: scrollable list of message rows with unread indicator, CLAIM button.
 * Right sidebar: unread count display, CLAIM ALL button, filter/sort controls.
 *
 * Public API consumed by Page20InboxController:
 *   setMessageList(messages[])
 *   setUnreadCount(count)
 *   setClaimAllEnabled(enabled)
 *   setTabBadge(tabId, count)
 *   get claimAllBtn — CTAButton
 *
 * Deviations from spec:
 *   - The spec lists "INBOX" as a separate first tab. ButtonIds only defines
 *     INBOX_TAB_MESSAGES (no INBOX_TAB_INBOX). The first tab is labeled "INBOX"
 *     and uses INBOX_TAB_MESSAGES as its id, consistent with ButtonIds.
 *   - Filter/sort controls in the sidebar are static dropdowns (not wired to logic)
 *     as the spec does not define the sort/filter schema.
 */

import { PageViewBase }  from '../../core/PageViewBase.js';
import { PageHeader }    from '../../components/PageHeader.js';
import { Tabs }          from '../../components/Tabs.js';
import { CTAButton }     from '../../components/CTAButton.js';
import { ButtonIds }     from '../../enums/ButtonIds.js';

const INBOX_TABS = [
	{ id: ButtonIds.INBOX_TAB_MESSAGES,       label: 'INBOX' },
	{ id: ButtonIds.INBOX_TAB_REWARDS,        label: 'REWARDS' },
	{ id: ButtonIds.INBOX_TAB_EVENT_NOTICES,  label: 'EVENT NOTICES' },
	{ id: ButtonIds.INBOX_TAB_SYSTEM,         label: 'SYSTEM' },
];

export class Page20InboxView extends PageViewBase {

	constructor() {

		super( 'page-inbox' );

		/** @type {PageHeader} */
		this._header = null;

		/** @type {Tabs} */
		this._tabs = null;

		/** @type {CTAButton} */
		this._claimAllBtn = null;

		/** @type {HTMLElement} */
		this._messageListEl = null;

		/** @type {HTMLElement} */
		this._unreadCountEl = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( Page20InboxView._cssInjected ) return;
		Page20InboxView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ------------------------------------------------------------------ */
			/* Page root                                                           */
			/* ------------------------------------------------------------------ */

			.page-inbox {
				display: grid;
				grid-template-rows: auto auto 1fr;
				height: 100vh;
				overflow: hidden;
				background: var(--color-surface);
			}

			/* ------------------------------------------------------------------ */
			/* Header zone                                                         */
			/* ------------------------------------------------------------------ */

			.page-inbox__header-zone {
				display: flex;
				align-items: center;
				padding: 0 var(--space-6);
				background: var(--color-panel-base);
				border-bottom: 1px solid var(--color-panel-border);
			}

			/* ------------------------------------------------------------------ */
			/* Tabs strip                                                          */
			/* ------------------------------------------------------------------ */

			.page-inbox__tabs-row {
				background: var(--color-panel-base);
			}

			/* ------------------------------------------------------------------ */
			/* Body — two-column layout                                            */
			/* ------------------------------------------------------------------ */

			.page-inbox__body {
				display: grid;
				grid-template-columns: 1fr 260px;
				overflow: hidden;
			}

			/* ------------------------------------------------------------------ */
			/* Left — message list panel                                           */
			/* ------------------------------------------------------------------ */

			.page-inbox__list-panel {
				overflow-y: auto;
				padding: var(--space-4) var(--space-5);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			/* ---- Message row ---- */

			.kk-message-row {
				display: grid;
				grid-template-columns: 8px 40px 1fr auto;
				align-items: center;
				gap: var(--space-3);
				padding: var(--space-3) var(--space-4);
				background: var(--color-panel-base);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				cursor: default;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.kk-message-row:focus-within {
				border-color: var(--color-accent-orange);
			}

			.kk-message-row--unread {
				background: rgba(249,115,22,0.03);
			}

			.kk-message-row--unread .kk-message-row__unread-dot {
				background: var(--color-accent-orange);
			}

			.kk-message-row--claimed {
				opacity: 0.55;
			}

			/* Unread indicator */
			.kk-message-row__unread-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: transparent;
				flex-shrink: 0;
			}

			/* Avatar / type icon */
			.kk-message-row__icon {
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: var(--color-panel-raised);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-base);
				color: var(--color-ink-400);
				flex-shrink: 0;
			}

			.kk-message-row__icon--reward  { background: rgba(234,179,8,0.15);  color: var(--color-accent-yellow); }
			.kk-message-row__icon--event   { background: rgba(249,115,22,0.15); color: var(--color-accent-orange); }
			.kk-message-row__icon--system  { background: rgba(99,102,241,0.15); color: #818cf8; }
			.kk-message-row__icon--message { background: rgba(6,182,212,0.15);  color: var(--color-accent-cyan); }

			/* Message content */
			.kk-message-row__content {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				min-width: 0;
			}

			.kk-message-row__from {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			.kk-message-row__subject {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.kk-message-row--unread .kk-message-row__subject {
				color: var(--color-white);
			}

			.kk-message-row__time {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-500);
				letter-spacing: var(--tracking-wider);
			}

			/* Action column */
			.kk-message-row__action {
				display: flex;
				align-items: center;
				padding-left: var(--space-2);
			}

			.kk-message-row__claimed-badge {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-success, #22c55e);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				padding: var(--space-1) var(--space-2);
				border: 1px solid var(--color-success, #22c55e);
				border-radius: var(--radius-sm);
				white-space: nowrap;
			}

			/* ------------------------------------------------------------------ */
			/* Right sidebar                                                       */
			/* ------------------------------------------------------------------ */

			.page-inbox__sidebar {
				border-left: 1px solid var(--color-panel-border);
				padding: var(--space-4);
				overflow-y: auto;
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
			}

			/* ---- Unread count card ---- */

			.kk-inbox-unread-card {
				padding: var(--space-4);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-md);
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				text-align: center;
			}

			.kk-inbox-unread-card__value {
				font-family: var(--font-display);
				font-size: var(--text-4xl);
				font-weight: var(--weight-black);
				color: var(--color-accent-orange);
				line-height: 1;
			}

			.kk-inbox-unread-card__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
			}

			/* ---- Filter/sort section ---- */

			.kk-inbox-sidebar-section {
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.kk-inbox-sidebar-section__label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-300);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				border-bottom: 1px solid var(--color-panel-border);
				padding-bottom: var(--space-2);
			}

			.kk-inbox-select {
				width: 100%;
				padding: var(--space-2) var(--space-3);
				background: var(--color-panel-raised);
				border: 1px solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-white);
				cursor: pointer;
				appearance: none;
				-webkit-appearance: none;
			}

			.kk-inbox-select:focus-visible {
				outline: 2px solid var(--color-accent-orange);
				outline-offset: 2px;
			}

			.kk-inbox-select option {
				background: var(--color-panel-base);
				color: var(--color-white);
			}

			/* ---- Claim all button ---- */

			.kk-inbox-sidebar__claim-all .kk-cta-button {
				width: 100%;
				justify-content: center;
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
		root.setAttribute( 'aria-label', 'Notifications and Inbox' );

		// ----- Header zone -----
		this._header = new PageHeader( {
			title:    'NOTIFICATIONS / INBOX',
			showBack: true,
		} );

		const headerZone = document.createElement( 'div' );
		headerZone.className = 'page-inbox__header-zone';
		headerZone.appendChild( this._header.el );
		this._registerSection( 'header', headerZone );
		root.appendChild( headerZone );

		// ----- Tabs -----
		this._tabs = new Tabs( {
			tabs:      INBOX_TABS,
			activeId:  ButtonIds.INBOX_TAB_MESSAGES,
			ariaLabel: 'Inbox categories',
		} );

		const tabsRow = document.createElement( 'div' );
		tabsRow.className = 'page-inbox__tabs-row';
		tabsRow.appendChild( this._tabs.el );
		root.appendChild( tabsRow );

		// ----- Body -----
		const body = document.createElement( 'div' );
		body.className = 'page-inbox__body';
		this._registerSection( 'body', body );

		// Left: message list
		this._messageListEl = document.createElement( 'div' );
		this._messageListEl.className = 'page-inbox__list-panel';
		this._messageListEl.setAttribute( 'role', 'list' );
		this._messageListEl.setAttribute( 'aria-label', 'Messages' );
		this._registerSection( 'messageList', this._messageListEl );
		body.appendChild( this._messageListEl );

		// Right: sidebar
		const sidebar = document.createElement( 'aside' );
		sidebar.className = 'page-inbox__sidebar';
		sidebar.setAttribute( 'aria-label', 'Inbox controls' );

		// Unread count card
		const unreadCard = document.createElement( 'div' );
		unreadCard.className = 'kk-inbox-unread-card';
		unreadCard.setAttribute( 'aria-live', 'polite' );

		this._unreadCountEl = document.createElement( 'div' );
		this._unreadCountEl.className = 'kk-inbox-unread-card__value';
		this._unreadCountEl.textContent = '0';
		unreadCard.appendChild( this._unreadCountEl );

		const unreadLabel = document.createElement( 'div' );
		unreadLabel.className = 'kk-inbox-unread-card__label';
		unreadLabel.textContent = 'UNREAD';
		unreadCard.appendChild( unreadLabel );

		sidebar.appendChild( unreadCard );

		// Claim all button
		const claimAllWrap = document.createElement( 'div' );
		claimAllWrap.className = 'kk-inbox-sidebar__claim-all';

		this._claimAllBtn = new CTAButton( {
			label:    'CLAIM ALL',
			variant:  'primary',
			actionId: ButtonIds.INBOX_CLAIM_ALL,
			disabled: true,
			ariaLabel: 'Claim all rewards in this category',
		} );
		claimAllWrap.appendChild( this._claimAllBtn.el );
		sidebar.appendChild( claimAllWrap );

		// Filter section
		const filterSection = document.createElement( 'div' );
		filterSection.className = 'kk-inbox-sidebar-section';

		const filterLabel = document.createElement( 'div' );
		filterLabel.className = 'kk-inbox-sidebar-section__label';
		filterLabel.textContent = 'FILTER';
		filterSection.appendChild( filterLabel );

		const filterSelect = document.createElement( 'select' );
		filterSelect.className = 'kk-inbox-select';
		filterSelect.setAttribute( 'aria-label', 'Filter messages' );
		[ 'All Messages', 'Unread Only', 'Read Only' ].forEach( ( opt ) => {
			const option = document.createElement( 'option' );
			option.textContent = opt;
			filterSelect.appendChild( option );
		} );
		filterSection.appendChild( filterSelect );
		sidebar.appendChild( filterSection );

		// Sort section
		const sortSection = document.createElement( 'div' );
		sortSection.className = 'kk-inbox-sidebar-section';

		const sortLabel = document.createElement( 'div' );
		sortLabel.className = 'kk-inbox-sidebar-section__label';
		sortLabel.textContent = 'SORT BY';
		sortSection.appendChild( sortLabel );

		const sortSelect = document.createElement( 'select' );
		sortSelect.className = 'kk-inbox-select';
		sortSelect.setAttribute( 'aria-label', 'Sort messages' );
		[ 'Newest First', 'Oldest First', 'Unread First' ].forEach( ( opt ) => {
			const option = document.createElement( 'option' );
			option.textContent = opt;
			sortSelect.appendChild( option );
		} );
		sortSection.appendChild( sortSelect );
		sidebar.appendChild( sortSection );

		this._registerSection( 'sidebar', sidebar );
		body.appendChild( sidebar );

		root.appendChild( body );

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
	 * Render the message list for the active category.
	 *
	 * @param {Array<object>} messages
	 */
	setMessageList( messages ) {

		const container = this._messageListEl;
		container.innerHTML = '';

		if ( ! messages || messages.length === 0 ) {
			container.appendChild( this.buildEmptyState( {
				label:   'No messages in this category',
				heading: 'ALL CLEAR',
				subtext: 'Nothing to show in this category.',
			} ) );
			return;
		}

		messages.forEach( ( msg ) => {
			container.appendChild( this._buildMessageRow( msg ) );
		} );

	}

	/**
	 * Update the unread count display.
	 *
	 * @param {number} count
	 */
	setUnreadCount( count ) {

		this._unreadCountEl.textContent = String( count );

	}

	/**
	 * Enable or disable the CLAIM ALL button.
	 *
	 * @param {boolean} enabled
	 */
	setClaimAllEnabled( enabled ) {

		this._claimAllBtn?.setDisabled( ! enabled );

	}

	/**
	 * Set the badge count on a tab.
	 *
	 * @param {string}      tabId
	 * @param {number|null} count
	 */
	setTabBadge( tabId, count ) {

		this._tabs?.setBadge( tabId, count );

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a single message row element.
	 *
	 * @param {object} msg
	 * @returns {HTMLElement}
	 */
	_buildMessageRow( msg ) {

		const row = document.createElement( 'div' );
		row.className = 'kk-message-row';
		row.setAttribute( 'role', 'listitem' );

		if ( ! msg.read )    row.classList.add( 'kk-message-row--unread' );
		if ( msg.claimed )   row.classList.add( 'kk-message-row--claimed' );

		// Unread indicator dot
		const dot = document.createElement( 'div' );
		dot.className = 'kk-message-row__unread-dot';
		dot.setAttribute( 'aria-hidden', 'true' );
		row.appendChild( dot );

		// Icon
		const typeIconMap = { reward: '★', event: '!', system: '⚙', message: '✉' };
		const icon = document.createElement( 'div' );
		icon.className = `kk-message-row__icon kk-message-row__icon--${msg.type}`;
		icon.setAttribute( 'aria-hidden', 'true' );
		icon.textContent = typeIconMap[ msg.type ] ?? '✉';
		row.appendChild( icon );

		// Content
		const content = document.createElement( 'div' );
		content.className = 'kk-message-row__content';

		const from = document.createElement( 'div' );
		from.className = 'kk-message-row__from';
		from.textContent = msg.from;
		content.appendChild( from );

		const subject = document.createElement( 'div' );
		subject.className = 'kk-message-row__subject';
		subject.textContent = msg.subject;
		content.appendChild( subject );

		const time = document.createElement( 'div' );
		time.className = 'kk-message-row__time';
		time.textContent = msg.time;
		content.appendChild( time );

		row.appendChild( content );

		// Action column
		const action = document.createElement( 'div' );
		action.className = 'kk-message-row__action';

		if ( msg.claimable ) {

			if ( msg.claimed ) {

				const badge = document.createElement( 'span' );
				badge.className = 'kk-message-row__claimed-badge';
				badge.textContent = 'CLAIMED';
				action.appendChild( badge );

			} else {

				const claimBtn = new CTAButton( {
					label:    'CLAIM',
					variant:  'primary',
					actionId: ButtonIds.INBOX_CLAIM,
					ariaLabel: `Claim reward: ${msg.subject}`,
				} );
				claimBtn.el.dataset.inboxClaim = msg.id;
				action.appendChild( claimBtn.el );

			}

		}

		row.appendChild( action );

		return row;

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get claimAllBtn() { return this._claimAllBtn; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._tabs?.dispose();
		this._tabs = null;

		this._header?.dispose();
		this._header = null;

		this._claimAllBtn     = null;
		this._messageListEl   = null;
		this._unreadCountEl   = null;

		super.dispose();

	}

}
