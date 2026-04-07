/**
 * Page06PartyView — Party / Friends.
 *
 * Route: RouteIds.PARTY ("/party")
 *
 * Layout: 2-column grid.
 *   Left  — Party header + Party Members roster + Voice Status + INVITE CTA
 *   Right — Party Privacy toggle + Joinable Sessions + Recent Players + Friends List
 *
 * Public API consumed by Page06PartyController:
 *   setPartyMembers(members[])
 *   setVoiceStatus(active, label)
 *   setPrivacy(mode)
 *   setJoinableSessions(sessions[])
 *   setRecentPlayers(players[])
 *   setFriends(friends[])
 *   get inviteBtn()
 *   get privacyBtn()
 *   get joinSessionBtns()
 */

import { PageViewBase } from '../../core/PageViewBase.js';
import { CTAButton }    from '../../components/CTAButton.js';
import { ButtonIds }    from '../../enums/ButtonIds.js';

export class Page06PartyView extends PageViewBase {

	constructor() {

		super( 'page-party' );

		/** @type {CTAButton} */
		this._inviteBtn = null;

		/** @type {CTAButton} */
		this._privacyBtn = null;

		/** @type {CTAButton[]} */
		this._joinSessionBtns = [];

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page06PartyView._cssInjected ) return;
		Page06PartyView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			/* ================================================================
			   Page root — 2-column layout
			   ================================================================ */

			.page-party {
				display: grid;
				grid-template-rows: auto 1fr;
				grid-template-columns: 1fr 320px;
				grid-template-areas:
					"header  header"
					"left    right";
				gap: var(--space-4);
				padding: var(--space-4);
				min-height: calc(100vh - var(--topnav-height, 64px));
				box-sizing: border-box;
				background: var(--color-bg-base);
			}

			/* ================================================================
			   Header
			   ================================================================ */

			.page-party__header {
				grid-area: header;
				display: flex;
				align-items: center;
				gap: var(--space-4);
				padding-bottom: var(--space-3);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
			}

			.page-party__title {
				margin: 0;
				font-family: var(--font-display);
				font-size: var(--text-hero, 3rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-white);
				flex: 1;
			}

			.page-party__brand-badge {
				font-family: var(--font-display);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				letter-spacing: var(--tracking-wider);
				color: var(--color-cta-primary);
				background: rgba(255, 120, 0, 0.12);
				border: var(--border-thin) solid var(--color-cta-primary);
				border-radius: var(--radius-sm);
				padding: 4px 10px;
				text-transform: uppercase;
			}

			/* ================================================================
			   Left column
			   ================================================================ */

			.page-party__left {
				grid-area: left;
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
			}

			/* ================================================================
			   Party block (branded panel)
			   ================================================================ */

			.page-party__party-block {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-party__panel-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: var(--space-2);
			}

			/* ================================================================
			   Party member cards (horizontal scroll row)
			   ================================================================ */

			.page-party__member-row {
				display: flex;
				gap: var(--space-3);
				flex-wrap: nowrap;
				overflow-x: auto;
				padding-bottom: var(--space-1);
			}

			.page-party__member-card {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-2);
				background: var(--color-panel-bg-raised, rgba(255,255,255,0.06));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3);
				min-width: 100px;
				flex-shrink: 0;
				cursor: default;
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.page-party__member-card:hover {
				border-color: var(--color-panel-border-strong);
			}

			.page-party__member-card--leader {
				border-color: var(--color-cta-primary);
			}

			.page-party__member-avatar {
				width: 56px;
				height: 56px;
				border-radius: var(--radius-sm);
				background: var(--color-ink-700, #2a2a2a);
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--color-ink-400);
				overflow: hidden;
				flex-shrink: 0;
			}

			.page-party__member-avatar svg {
				width: 32px;
				height: 32px;
			}

			.page-party__member-name {
				font-family: var(--font-display);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				text-align: center;
				max-width: 88px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.page-party__member-role-badge {
				font-family: var(--font-ui);
				font-size: 10px;
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-cta-primary);
				padding: 2px 6px;
				border: var(--border-thin) solid var(--color-cta-primary);
				border-radius: var(--radius-sm);
				background: rgba(255, 120, 0, 0.1);
			}

			/* ================================================================
			   Voice Status
			   ================================================================ */

			.page-party__voice {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
			}

			.page-party__voice-icon {
				width: 36px;
				height: 36px;
				border-radius: 50%;
				background: var(--color-ink-700, #2a2a2a);
				border: var(--border-base) solid var(--color-panel-border-strong);
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				color: var(--color-ink-400);
			}

			.page-party__voice-icon--active {
				background: rgba(34, 197, 94, 0.15);
				border-color: var(--color-success, #22c55e);
				color: var(--color-success, #22c55e);
			}

			.page-party__voice-icon svg {
				width: 18px;
				height: 18px;
			}

			.page-party__voice-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-ink-200);
			}

			.page-party__voice-sublabel {
				display: block;
				font-weight: var(--weight-regular);
				color: var(--color-ink-400);
				margin-top: 2px;
			}

			/* ================================================================
			   INVITE CTA
			   ================================================================ */

			.page-party__invite-wrap {
				margin-top: auto;
			}

			.page-party__invite-wrap .kk-cta-button {
				width: 100%;
				min-height: 56px;
				font-size: var(--text-lg);
				letter-spacing: var(--tracking-widest);
			}

			/* ================================================================
			   Right column
			   ================================================================ */

			.page-party__right {
				grid-area: right;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			/* ================================================================
			   Privacy toggle panel
			   ================================================================ */

			.page-party__privacy-panel {
				display: flex;
				align-items: center;
				justify-content: space-between;
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-2) var(--space-3);
			}

			.page-party__privacy-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
			}

			.page-party__privacy-value {
				font-family: var(--font-display);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				color: var(--color-cta-primary);
				letter-spacing: var(--tracking-wide);
			}

			/* ================================================================
			   Joinable sessions
			   ================================================================ */

			.page-party__sessions-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-party__session-card {
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-2) var(--space-3);
				transition: border-color var(--duration-fast) var(--ease-standard);
			}

			.page-party__session-card:hover {
				border-color: var(--color-panel-border-strong);
			}

			.page-party__session-thumb {
				width: 100%;
				aspect-ratio: 16 / 7;
				background: var(--color-ink-800, #1a1a1a);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-xs);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				color: var(--color-ink-500, #555);
				margin-bottom: var(--space-1);
			}

			.page-party__session-info {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			.page-party__session-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-party__session-meta {
				font-family: var(--font-ui);
				font-size: 10px;
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-party__session-card .kk-cta-button {
				width: 100%;
				margin-top: var(--space-1);
				min-height: 36px;
				font-size: var(--text-xs);
			}

			/* ================================================================
			   Recent Players list
			   ================================================================ */

			.page-party__recent-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-party__recent-row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-2) var(--space-2);
				border-radius: var(--radius-sm);
				background: var(--color-panel-bg, rgba(255,255,255,0.03));
			}

			.page-party__recent-avatar {
				width: 28px;
				height: 28px;
				border-radius: 50%;
				background: var(--color-ink-700, #2a2a2a);
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				color: var(--color-ink-500);
			}

			.page-party__recent-avatar svg {
				width: 16px;
				height: 16px;
			}

			.page-party__recent-name {
				flex: 1;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-party__recent-common {
				font-family: var(--font-ui);
				font-size: 10px;
				color: var(--color-ink-500);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			/* ================================================================
			   Friends list — 2-column grid of friend rows
			   ================================================================ */

			.page-party__friends-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--space-2);
			}

			.page-party__friend-row {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-2);
				background: var(--color-panel-bg, rgba(255,255,255,0.03));
				border-radius: var(--radius-sm);
			}

			.page-party__friend-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
				background: var(--color-ink-600, #444);
			}

			.page-party__friend-dot--online {
				background: var(--color-success, #22c55e);
				box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
			}

			.page-party__friend-info {
				flex: 1;
				min-width: 0;
			}

			.page-party__friend-name {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				color: var(--color-ink-200);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.page-party__friend-status {
				font-family: var(--font-ui);
				font-size: 10px;
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-party__friend-status--online {
				color: var(--color-success, #22c55e);
			}

			/* ================================================================
			   Section panel wrapper
			   ================================================================ */

			.page-party__section {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			/* ================================================================
			   Responsive
			   ================================================================ */

			@media (max-width: 900px) {
				.page-party {
					grid-template-columns: 1fr;
					grid-template-areas:
						"header"
						"left"
						"right";
				}
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
		root.setAttribute( 'aria-label', 'Party and Friends' );

		// --- Header ---
		const header = document.createElement( 'div' );
		header.className = 'page-party__header';

		const title = document.createElement( 'h1' );
		title.className = 'page-party__title';
		title.textContent = 'KART KIDS PARTY / FRIENDS';
		header.appendChild( title );

		const badge = document.createElement( 'div' );
		badge.className = 'page-party__brand-badge';
		badge.setAttribute( 'aria-hidden', 'true' );
		badge.textContent = 'BEASTSIDE';
		header.appendChild( badge );

		root.appendChild( header );

		// --- Left column ---
		const left = document.createElement( 'div' );
		left.className = 'page-party__left';

		// Party block
		const partyBlock = document.createElement( 'div' );
		partyBlock.className = 'page-party__party-block';

		const partyLabel = document.createElement( 'div' );
		partyLabel.className = 'page-party__panel-label';
		partyLabel.textContent = 'PARTY MEMBERS';
		partyBlock.appendChild( partyLabel );

		const memberRow = document.createElement( 'div' );
		memberRow.className = 'page-party__member-row';
		memberRow.setAttribute( 'role', 'list' );
		memberRow.setAttribute( 'aria-label', 'Party members' );
		partyBlock.appendChild( memberRow );
		this._registerSection( 'memberRow', memberRow );
		left.appendChild( partyBlock );

		// Voice Status
		const voice = document.createElement( 'div' );
		voice.className = 'page-party__voice';
		voice.setAttribute( 'aria-label', 'Voice status' );

		const voiceIcon = document.createElement( 'div' );
		voiceIcon.className = 'page-party__voice-icon';
		voiceIcon.setAttribute( 'aria-hidden', 'true' );
		voiceIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
		voice.appendChild( voiceIcon );
		this._registerSection( 'voiceIcon', voiceIcon );

		const voiceText = document.createElement( 'div' );
		voiceText.className = 'page-party__voice-label';
		voiceText.textContent = 'VOICE STATUS';
		const voiceSub = document.createElement( 'span' );
		voiceSub.className = 'page-party__voice-sublabel';
		voiceSub.textContent = '—';
		voiceText.appendChild( voiceSub );
		voice.appendChild( voiceText );
		this._registerSection( 'voiceSubLabel', voiceSub );
		left.appendChild( voice );

		// INVITE CTA
		const inviteWrap = document.createElement( 'div' );
		inviteWrap.className = 'page-party__invite-wrap';
		this._inviteBtn = new CTAButton( {
			label:    'INVITE',
			variant:  'primary',
			actionId: ButtonIds.PARTY_INVITE,
		} );
		inviteWrap.appendChild( this._inviteBtn.el );
		left.appendChild( inviteWrap );
		root.appendChild( left );

		// --- Right column ---
		const right = document.createElement( 'div' );
		right.className = 'page-party__right';

		// Party Privacy
		const privacyPanel = document.createElement( 'div' );
		privacyPanel.className = 'page-party__privacy-panel';

		const privacyLabel = document.createElement( 'span' );
		privacyLabel.className = 'page-party__privacy-label';
		privacyLabel.textContent = 'PARTY PRIVACY';
		privacyPanel.appendChild( privacyLabel );

		const privacyValue = document.createElement( 'span' );
		privacyValue.className = 'page-party__privacy-value';
		privacyValue.textContent = 'FRIENDS';
		privacyPanel.appendChild( privacyValue );
		this._registerSection( 'privacyValue', privacyValue );

		this._privacyBtn = new CTAButton( {
			label:    'CHANGE',
			variant:  'ghost',
			actionId: ButtonIds.PARTY_PRIVACY,
		} );
		privacyPanel.appendChild( this._privacyBtn.el );
		right.appendChild( privacyPanel );

		// Joinable Sessions
		const sessionsSection = document.createElement( 'div' );
		sessionsSection.className = 'page-party__section';

		const sessionsLabel = document.createElement( 'div' );
		sessionsLabel.className = 'page-party__panel-label';
		sessionsLabel.textContent = 'JOINABLE SESSIONS';
		sessionsSection.appendChild( sessionsLabel );

		const sessionsList = document.createElement( 'ul' );
		sessionsList.className = 'page-party__sessions-list';
		sessionsList.setAttribute( 'role', 'list' );
		sessionsList.setAttribute( 'aria-label', 'Joinable sessions' );
		sessionsSection.appendChild( sessionsList );
		this._registerSection( 'sessionsList', sessionsList );
		right.appendChild( sessionsSection );

		// Recent Players
		const recentSection = document.createElement( 'div' );
		recentSection.className = 'page-party__section';

		const recentLabel = document.createElement( 'div' );
		recentLabel.className = 'page-party__panel-label';
		recentLabel.textContent = 'RECENT PLAYERS';
		recentSection.appendChild( recentLabel );

		const recentList = document.createElement( 'ul' );
		recentList.className = 'page-party__recent-list';
		recentList.setAttribute( 'role', 'list' );
		recentList.setAttribute( 'aria-label', 'Recent players' );
		recentSection.appendChild( recentList );
		this._registerSection( 'recentList', recentList );
		right.appendChild( recentSection );

		// Friends List
		const friendsSection = document.createElement( 'div' );
		friendsSection.className = 'page-party__section';

		const friendsLabel = document.createElement( 'div' );
		friendsLabel.className = 'page-party__panel-label';
		friendsLabel.textContent = 'FRIENDS LIST';
		friendsSection.appendChild( friendsLabel );

		const friendsGrid = document.createElement( 'div' );
		friendsGrid.className = 'page-party__friends-grid';
		friendsGrid.setAttribute( 'role', 'list' );
		friendsGrid.setAttribute( 'aria-label', 'Friends list' );
		friendsSection.appendChild( friendsGrid );
		this._registerSection( 'friendsGrid', friendsGrid );
		right.appendChild( friendsSection );
		root.appendChild( right );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		this._inviteBtn?.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API — called by controller
	// ---------------------------------------------------------------------------

	/**
	 * @param {Array<{id:string, name:string, role:string, ready:boolean, online:boolean}>} members
	 */
	setPartyMembers( members ) {

		const row = this.getSection( 'memberRow' );
		if ( ! row ) return;

		row.innerHTML = '';

		for ( const m of members ) {

			const card = document.createElement( 'div' );
			card.className = `page-party__member-card${m.role === 'HOST' ? ' page-party__member-card--leader' : ''}`;
			card.setAttribute( 'role', 'listitem' );
			card.setAttribute( 'aria-label', `${m.name}, ${m.role}` );

			const avatar = document.createElement( 'div' );
			avatar.className = 'page-party__member-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
			card.appendChild( avatar );

			const name = document.createElement( 'div' );
			name.className = 'page-party__member-name';
			name.textContent = m.name.replace( '@', '' );
			card.appendChild( name );

			if ( m.role === 'HOST' ) {

				const badge = document.createElement( 'div' );
				badge.className = 'page-party__member-role-badge';
				badge.textContent = 'Leader';
				card.appendChild( badge );

			}

			row.appendChild( card );

		}

	}

	/**
	 * @param {boolean} active
	 * @param {string}  label
	 */
	setVoiceStatus( active, label ) {

		const icon = this.getSection( 'voiceIcon' );
		if ( icon ) {

			icon.classList.toggle( 'page-party__voice-icon--active', active );

		}

		const sub = this.getSection( 'voiceSubLabel' );
		if ( sub ) sub.textContent = label;

	}

	/**
	 * @param {'open'|'friends'|'invite'} mode
	 */
	setPrivacy( mode ) {

		const labels = { open: 'OPEN', friends: 'FRIENDS ONLY', invite: 'INVITE ONLY' };
		const el = this.getSection( 'privacyValue' );
		if ( el ) el.textContent = labels[ mode ] ?? mode.toUpperCase();

	}

	/**
	 * @param {Array<{id:string, name:string, host:string, players:number, maxPlayers:number, track:string}>} sessions
	 */
	setJoinableSessions( sessions ) {

		const list = this.getSection( 'sessionsList' );
		if ( ! list ) return;

		list.innerHTML = '';
		this._joinSessionBtns = [];

		for ( const session of sessions ) {

			const li = document.createElement( 'li' );
			li.className = 'page-party__session-card';
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `Session: ${session.name}, hosted by ${session.host}` );

			const thumb = document.createElement( 'div' );
			thumb.className = 'page-party__session-thumb';
			thumb.setAttribute( 'aria-hidden', 'true' );
			thumb.textContent = session.track;
			li.appendChild( thumb );

			const info = document.createElement( 'div' );
			info.className = 'page-party__session-info';

			const sName = document.createElement( 'div' );
			sName.className = 'page-party__session-name';
			sName.textContent = session.name;
			info.appendChild( sName );

			const meta = document.createElement( 'div' );
			meta.className = 'page-party__session-meta';
			meta.textContent = `${session.players}/${session.maxPlayers} PLAYERS`;
			info.appendChild( meta );
			li.appendChild( info );

			const joinBtn = new CTAButton( {
				label:     'JOIN',
				variant:   'secondary',
				actionId:  ButtonIds.PARTY_JOIN_SESSION,
				ariaLabel: `Join session ${session.name}`,
			} );
			joinBtn.el.dataset.sessionId = session.id;
			this._joinSessionBtns.push( joinBtn );
			li.appendChild( joinBtn.el );

			list.appendChild( li );

		}

	}

	/**
	 * @param {Array<{id:string, name:string, commonFriend:string}>} players
	 */
	setRecentPlayers( players ) {

		const list = this.getSection( 'recentList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const p of players ) {

			const li = document.createElement( 'li' );
			li.className = 'page-party__recent-row';
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `Recent player: ${p.name}` );

			const avatar = document.createElement( 'div' );
			avatar.className = 'page-party__recent-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
			li.appendChild( avatar );

			const name = document.createElement( 'div' );
			name.className = 'page-party__recent-name';
			name.textContent = p.name;
			li.appendChild( name );

			const common = document.createElement( 'div' );
			common.className = 'page-party__recent-common';
			common.textContent = p.commonFriend;
			li.appendChild( common );

			list.appendChild( li );

		}

	}

	/**
	 * @param {Array<{id:string, name:string, status:'online'|'offline'}>} friends
	 */
	setFriends( friends ) {

		const grid = this.getSection( 'friendsGrid' );
		if ( ! grid ) return;

		grid.innerHTML = '';

		for ( const f of friends ) {

			const row = document.createElement( 'div' );
			row.className = 'page-party__friend-row';
			row.setAttribute( 'role', 'listitem' );
			row.setAttribute( 'aria-label', `${f.name} — ${f.status}` );

			const dot = document.createElement( 'div' );
			dot.className = `page-party__friend-dot${f.status === 'online' ? ' page-party__friend-dot--online' : ''}`;
			dot.setAttribute( 'aria-hidden', 'true' );
			row.appendChild( dot );

			const info = document.createElement( 'div' );
			info.className = 'page-party__friend-info';

			const fName = document.createElement( 'div' );
			fName.className = 'page-party__friend-name';
			fName.textContent = f.name;
			info.appendChild( fName );

			const status = document.createElement( 'div' );
			status.className = `page-party__friend-status${f.status === 'online' ? ' page-party__friend-status--online' : ''}`;
			status.textContent = f.status === 'online' ? 'Online' : 'Offline';
			info.appendChild( status );

			row.appendChild( info );
			grid.appendChild( row );

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get inviteBtn() { return this._inviteBtn; }

	/** @returns {CTAButton} */
	get privacyBtn() { return this._privacyBtn; }

	/** @returns {CTAButton[]} */
	get joinSessionBtns() { return this._joinSessionBtns; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._inviteBtn     = null;
		this._privacyBtn    = null;
		this._joinSessionBtns = [];

		super.dispose();

	}

}

Page06PartyView._cssInjected = false;
