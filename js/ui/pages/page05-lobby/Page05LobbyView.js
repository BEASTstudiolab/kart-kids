/**
 * Page05LobbyView — Lobby / Pre-Race Room.
 *
 * Route: RouteIds.LOBBY ("/lobby")
 *
 * Layout: 4-column grid with TopNav visible.
 *
 * Columns:
 *   col-1  — Party Members list + Invite Friends CTA
 *   col-2  — Race Lobby title + Track Vote cards + Race Rules panel
 *   col-3  — Ready Status toggle + countdown timer
 *   col-4  — Player Loadout summary + Start Match CTA (host only)
 *
 * Public API consumed by Page05LobbyController:
 *   setCountdown(text)
 *   setCountdownLabel(text)
 *   setRoomCode(code)
 *   setMembers(members[])
 *   setTrackVotes(tracks[])
 *   setRaceRules(rules[])
 *   setReadyState(isReady)
 *   setHostControls(isHost)
 *   setLoadout(loadout)
 *   get inviteFriendsBtn()
 *   get readyBtn()
 *   get startMatchBtn()
 *   get trackVoteBtns()
 *   get roomCodeJoinBtn()
 *   get roomCodeInputEl()
 */

import { PageViewBase }         from '../../core/PageViewBase.js';
import { CTAButton }            from '../../components/CTAButton.js';
import { ButtonIds }            from '../../enums/ButtonIds.js';
import { sanitizePlayerName }   from '../../utils/sanitize.js';

export class Page05LobbyView extends PageViewBase {

	constructor() {

		super( 'page-lobby' );

		/** @type {CTAButton} */
		this._inviteFriendsBtn = null;

		/** @type {CTAButton} */
		this._readyBtn = null;

		/** @type {CTAButton} */
		this._startMatchBtn = null;

		/** @type {CTAButton[]} */
		this._trackVoteBtns = [];

		/** @type {CTAButton|null} */
		this._roomCodeJoinBtn = null;

		/** @type {HTMLInputElement|null} */
		this._roomCodeInput = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Page05LobbyView._cssInjected ) return;
		Page05LobbyView._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.page-lobby {
				display: grid;
				grid-template-rows: auto 1fr;
				grid-template-columns: 220px 1fr 220px 260px;
				grid-template-areas:
					"header header header header"
					"party  main   ready  loadout";
				gap: var(--space-4);
				padding: var(--space-4);
				min-height: calc(100vh - var(--topnav-height, 64px));
				box-sizing: border-box;
				background: var(--color-bg-base);
			}

			/* -------------------------------------------------------
			   Header row
			   ------------------------------------------------------- */

			.page-lobby__header {
				grid-area: header;
				display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				padding: var(--space-3) 0;
			}

			.page-lobby__title {
				margin: 0;
				font-family: var(--font-display);
				font-size: var(--text-hero, 3rem);
				font-weight: var(--weight-black, 900);
				text-transform: uppercase;
				letter-spacing: var(--tracking-widest);
				color: var(--color-white);
			}

			.page-lobby__countdown-block {
				position: absolute;
				right: 0;
				top: 50%;
				transform: translateY(-50%);
				text-align: center;
				background: var(--color-panel-bg, rgba(255,255,255,0.06));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-2) var(--space-4);
				min-width: 120px;
			}

			.page-lobby__countdown-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				margin-bottom: var(--space-1);
			}

			.page-lobby__countdown-time {
				font-family: var(--font-display);
				font-size: var(--text-3xl, 2rem);
				font-weight: var(--weight-black, 900);
				color: var(--color-white);
				line-height: 1;
				letter-spacing: var(--tracking-wider);
			}

			/* -------------------------------------------------------
			   Party Members column
			   ------------------------------------------------------- */

			.page-lobby__party {
				grid-area: party;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-lobby__panel-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				padding-bottom: var(--space-2);
				margin-bottom: var(--space-1);
			}

			.page-lobby__member-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-lobby__member {
				display: flex;
				align-items: center;
				gap: var(--space-3);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				padding: var(--space-2) var(--space-3);
			}

			.page-lobby__member-avatar {
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: var(--color-ink-700, #333);
				flex-shrink: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-lg);
				color: var(--color-ink-400);
				overflow: hidden;
			}

			.page-lobby__member-avatar svg {
				width: 24px;
				height: 24px;
				opacity: 0.5;
			}

			.page-lobby__member-info {
				flex: 1;
				min-width: 0;
			}

			.page-lobby__member-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.page-lobby__member-role {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-lobby__member-ready {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				padding: 2px 6px;
				border-radius: var(--radius-sm);
			}

			.page-lobby__member-ready--yes {
				color: var(--color-success, #22c55e);
				background: rgba(34, 197, 94, 0.15);
			}

			.page-lobby__member-ready--no {
				color: var(--color-error, #ef4444);
				background: rgba(239, 68, 68, 0.1);
			}

			.page-lobby__invite-wrap {
				margin-top: auto;
			}

			.page-lobby__invite-wrap .kk-cta-button {
				width: 100%;
			}

			/* -------------------------------------------------------
			   Main column — track vote + race rules
			   ------------------------------------------------------- */

			.page-lobby__main {
				grid-area: main;
				display: flex;
				flex-direction: column;
				gap: var(--space-4);
			}

			.page-lobby__track-vote {
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-lobby__track-cards {
				display: flex;
				gap: var(--space-3);
			}

			.page-lobby__track-card {
				flex: 1;
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3);
			}

			.page-lobby__track-thumb {
				width: 100%;
				aspect-ratio: 16 / 9;
				background: var(--color-ink-800, #1a1a1a);
				border-radius: var(--radius-sm);
				overflow: hidden;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.page-lobby__track-thumb-placeholder {
				font-size: var(--text-2xl);
				opacity: 0.3;
				color: var(--color-ink-400);
			}

			.page-lobby__track-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-lobby__track-votes {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-lobby__track-card .kk-cta-button {
				width: 100%;
			}

			/* Race Rules */

			.page-lobby__race-rules {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3) var(--space-4);
			}

			.page-lobby__rules-list {
				list-style: none;
				margin: var(--space-2) 0 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-1);
			}

			.page-lobby__rules-list li {
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				color: var(--color-ink-200);
				display: flex;
				align-items: center;
				gap: var(--space-2);
			}

			.page-lobby__rules-list li::before {
				content: '';
				display: inline-block;
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background: var(--color-cta-primary);
				flex-shrink: 0;
			}

			/* -------------------------------------------------------
			   Ready Status column
			   ------------------------------------------------------- */

			.page-lobby__ready {
				grid-area: ready;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: var(--space-4);
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-4);
			}

			.page-lobby__ready-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
			}

			.page-lobby__ready-indicator {
				width: 64px;
				height: 64px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				border: 3px solid var(--color-panel-border);
				transition: border-color var(--duration-base) var(--ease-standard),
				            background var(--duration-base) var(--ease-standard);
			}

			.page-lobby__ready-indicator--ready {
				border-color: var(--color-success, #22c55e);
				background: rgba(34, 197, 94, 0.15);
			}

			.page-lobby__ready-indicator svg {
				width: 32px;
				height: 32px;
				color: var(--color-ink-400);
				transition: color var(--duration-base) var(--ease-standard);
			}

			.page-lobby__ready-indicator--ready svg {
				color: var(--color-success, #22c55e);
			}

			.page-lobby__ready .kk-cta-button {
				width: 100%;
			}

			/* -------------------------------------------------------
			   Loadout column
			   ------------------------------------------------------- */

			.page-lobby__loadout {
				grid-area: loadout;
				display: flex;
				flex-direction: column;
				gap: var(--space-3);
			}

			.page-lobby__loadout-kart {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-lobby__loadout-kart-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-lobby__loadout-kart-thumb {
				width: 100%;
				aspect-ratio: 4 / 3;
				background: var(--color-ink-800, #1a1a1a);
				border-radius: var(--radius-sm);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-3xl);
				opacity: 0.4;
			}

			.page-lobby__loadout-stats {
				display: grid;
				grid-template-columns: 1fr 1fr 1fr;
				gap: var(--space-1);
			}

			.page-lobby__loadout-stat {
				text-align: center;
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-lobby__loadout-stat strong {
				display: block;
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
			}

			.page-lobby__loadout-character {
				background: var(--color-panel-bg, rgba(255,255,255,0.04));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-3);
				display: flex;
				flex-direction: column;
				gap: var(--space-2);
			}

			.page-lobby__loadout-char-name {
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				color: var(--color-white);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
			}

			.page-lobby__start-wrap {
				margin-top: auto;
			}

			.page-lobby__start-wrap .kk-cta-button {
				width: 100%;
			}

			/* -------------------------------------------------------
			   Room Code display + join
			   ------------------------------------------------------- */

			.page-lobby__room-code-block {
				position: absolute;
				left: 0;
				top: 50%;
				transform: translateY(-50%);
				text-align: center;
				background: var(--color-panel-bg, rgba(255,255,255,0.06));
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				padding: var(--space-2) var(--space-4);
				min-width: 140px;
				display: none;
			}

			.page-lobby__room-code-block--visible {
				display: block;
			}

			.page-lobby__room-code-label {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-ink-400);
				margin-bottom: var(--space-1);
			}

			.page-lobby__room-code-value {
				font-family: var(--font-display);
				font-size: var(--text-2xl, 1.5rem);
				font-weight: var(--weight-black, 900);
				color: var(--color-white);
				line-height: 1;
				letter-spacing: var(--tracking-widest);
				user-select: all;
				cursor: pointer;
			}

			.page-lobby__room-code-copy {
				font-family: var(--font-ui);
				font-size: var(--text-xs);
				color: var(--color-ink-400);
				margin-top: var(--space-1);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
			}

			.page-lobby__join-room {
				display: flex;
				gap: var(--space-2);
				margin-top: var(--space-2);
			}

			.page-lobby__join-room-input {
				flex: 1;
				font-family: var(--font-display);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				color: var(--color-white);
				background: var(--color-ink-800, #1a1a1a);
				border: var(--border-base) solid var(--color-panel-border);
				border-radius: var(--radius-sm);
				padding: var(--space-2) var(--space-3);
				outline: none;
			}

			.page-lobby__join-room-input:focus {
				border-color: var(--color-cta-primary);
			}

			.page-lobby__join-room-input::placeholder {
				color: var(--color-ink-400);
				opacity: 0.6;
			}

			/* -------------------------------------------------------
			   Responsive — stack on narrow viewports
			   ------------------------------------------------------- */

			@media (max-width: 1024px) {
				.page-lobby {
					grid-template-columns: 1fr 1fr;
					grid-template-areas:
						"header  header"
						"party   ready"
						"main    loadout";
				}
			}

			@media (max-width: 640px) {
				.page-lobby {
					grid-template-columns: 1fr;
					grid-template-areas:
						"header"
						"ready"
						"party"
						"main"
						"loadout";
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
		root.setAttribute( 'aria-label', 'Race Lobby' );

		// --- Header ---
		const header = document.createElement( 'div' );
		header.className = 'page-lobby__header';

		const title = document.createElement( 'h1' );
		title.className = 'page-lobby__title';
		title.textContent = 'RACE LOBBY';
		header.appendChild( title );

		const countdownBlock = document.createElement( 'div' );
		countdownBlock.className = 'page-lobby__countdown-block';
		countdownBlock.setAttribute( 'aria-live', 'polite' );
		countdownBlock.setAttribute( 'aria-atomic', 'true' );

		const countdownLabel = document.createElement( 'div' );
		countdownLabel.className = 'page-lobby__countdown-label';
		countdownLabel.textContent = 'COUNTDOWN';
		countdownBlock.appendChild( countdownLabel );

		const countdownTime = document.createElement( 'div' );
		countdownTime.className = 'page-lobby__countdown-time';
		countdownTime.textContent = '—:——';
		countdownBlock.appendChild( countdownTime );
		header.appendChild( countdownBlock );

		// Room code block (hidden until setRoomCode is called)
		const roomCodeBlock = document.createElement( 'div' );
		roomCodeBlock.className = 'page-lobby__room-code-block';

		const roomCodeLabel = document.createElement( 'div' );
		roomCodeLabel.className = 'page-lobby__room-code-label';
		roomCodeLabel.textContent = 'ROOM CODE';
		roomCodeBlock.appendChild( roomCodeLabel );

		const roomCodeValue = document.createElement( 'div' );
		roomCodeValue.className = 'page-lobby__room-code-value';
		roomCodeValue.textContent = '----';
		roomCodeValue.setAttribute( 'title', 'Click to copy' );
		roomCodeBlock.appendChild( roomCodeValue );

		const roomCodeCopy = document.createElement( 'div' );
		roomCodeCopy.className = 'page-lobby__room-code-copy';
		roomCodeCopy.textContent = 'CLICK TO COPY';
		roomCodeBlock.appendChild( roomCodeCopy );

		header.appendChild( roomCodeBlock );
		this._registerSection( 'roomCodeBlock', roomCodeBlock );
		this._registerSection( 'roomCodeValue', roomCodeValue );

		root.appendChild( header );
		this._registerSection( 'header', header );
		this._registerSection( 'countdownLabel', countdownLabel );
		this._registerSection( 'countdownTime', countdownTime );

		// --- Party Members ---
		const party = document.createElement( 'div' );
		party.className = 'page-lobby__party';

		const partyLabel = document.createElement( 'div' );
		partyLabel.className = 'page-lobby__panel-label';
		partyLabel.textContent = 'PARTY MEMBERS';
		party.appendChild( partyLabel );

		const memberList = document.createElement( 'ul' );
		memberList.className = 'page-lobby__member-list';
		memberList.setAttribute( 'role', 'list' );
		memberList.setAttribute( 'aria-label', 'Party members' );
		party.appendChild( memberList );
		this._registerSection( 'memberList', memberList );

		const inviteWrap = document.createElement( 'div' );
		inviteWrap.className = 'page-lobby__invite-wrap';
		this._inviteFriendsBtn = new CTAButton( {
			label:    'INVITE FRIENDS',
			variant:  'secondary',
			actionId: ButtonIds.LOBBY_INVITE_FRIENDS,
		} );
		inviteWrap.appendChild( this._inviteFriendsBtn.el );
		party.appendChild( inviteWrap );

		// Join room by code
		const joinRoom = document.createElement( 'div' );
		joinRoom.className = 'page-lobby__join-room';

		this._roomCodeInput = document.createElement( 'input' );
		this._roomCodeInput.className = 'page-lobby__join-room-input';
		this._roomCodeInput.type = 'text';
		this._roomCodeInput.placeholder = 'ROOM CODE';
		this._roomCodeInput.maxLength = 6;
		this._roomCodeInput.setAttribute( 'aria-label', 'Enter room code to join' );
		joinRoom.appendChild( this._roomCodeInput );

		this._roomCodeJoinBtn = new CTAButton( {
			label:    'JOIN',
			variant:  'secondary',
			actionId: 'lobby_join_room',
		} );
		joinRoom.appendChild( this._roomCodeJoinBtn.el );
		party.appendChild( joinRoom );
		root.appendChild( party );

		// --- Main (Track Vote + Race Rules) ---
		const main = document.createElement( 'div' );
		main.className = 'page-lobby__main';

		// Track Vote
		const trackVote = document.createElement( 'div' );
		trackVote.className = 'page-lobby__track-vote';

		const trackLabel = document.createElement( 'div' );
		trackLabel.className = 'page-lobby__panel-label';
		trackLabel.textContent = 'TRACK VOTE';
		trackVote.appendChild( trackLabel );

		const trackCards = document.createElement( 'div' );
		trackCards.className = 'page-lobby__track-cards';
		trackCards.setAttribute( 'role', 'group' );
		trackCards.setAttribute( 'aria-label', 'Track vote options' );
		trackVote.appendChild( trackCards );
		main.appendChild( trackVote );
		this._registerSection( 'trackCards', trackCards );

		// Race Rules
		const raceRules = document.createElement( 'div' );
		raceRules.className = 'page-lobby__race-rules';

		const rulesLabel = document.createElement( 'div' );
		rulesLabel.className = 'page-lobby__panel-label';
		rulesLabel.textContent = 'RACE RULES';
		raceRules.appendChild( rulesLabel );

		const rulesList = document.createElement( 'ul' );
		rulesList.className = 'page-lobby__rules-list';
		rulesList.setAttribute( 'role', 'list' );
		rulesList.setAttribute( 'aria-label', 'Current race rules' );
		raceRules.appendChild( rulesList );
		main.appendChild( raceRules );
		root.appendChild( main );
		this._registerSection( 'rulesList', rulesList );

		// --- Ready Status ---
		const readyCol = document.createElement( 'div' );
		readyCol.className = 'page-lobby__ready';

		const readyLabel = document.createElement( 'div' );
		readyLabel.className = 'page-lobby__ready-label';
		readyLabel.textContent = 'READY STATUS';
		readyCol.appendChild( readyLabel );

		const readyIndicator = document.createElement( 'div' );
		readyIndicator.className = 'page-lobby__ready-indicator';
		readyIndicator.setAttribute( 'aria-hidden', 'true' );
		readyIndicator.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
		readyCol.appendChild( readyIndicator );
		this._registerSection( 'readyIndicator', readyIndicator );

		this._readyBtn = new CTAButton( {
			label:       'READY UP',
			variant:     'primary',
			actionId:    ButtonIds.LOBBY_READY_STATUS,
			ariaPressed: false,
		} );
		readyCol.appendChild( this._readyBtn.el );
		root.appendChild( readyCol );

		// --- Player Loadout ---
		const loadout = document.createElement( 'div' );
		loadout.className = 'page-lobby__loadout';

		const loadoutLabel = document.createElement( 'div' );
		loadoutLabel.className = 'page-lobby__panel-label';
		loadoutLabel.textContent = 'PLAYER LOADOUT';
		loadout.appendChild( loadoutLabel );

		const loadoutKart = document.createElement( 'div' );
		loadoutKart.className = 'page-lobby__loadout-kart';

		const kartName = document.createElement( 'div' );
		kartName.className = 'page-lobby__loadout-kart-name';
		kartName.textContent = '—';
		loadoutKart.appendChild( kartName );

		const kartThumb = document.createElement( 'div' );
		kartThumb.className = 'page-lobby__loadout-kart-thumb';
		kartThumb.setAttribute( 'aria-hidden', 'true' );
		kartThumb.textContent = '';
		loadoutKart.appendChild( kartThumb );

		const kartStats = document.createElement( 'div' );
		kartStats.className = 'page-lobby__loadout-stats';
		kartStats.setAttribute( 'aria-label', 'Kart statistics' );
		loadoutKart.appendChild( kartStats );
		loadout.appendChild( loadoutKart );
		this._registerSection( 'kartName', kartName );
		this._registerSection( 'kartThumb', kartThumb );
		this._registerSection( 'kartStats', kartStats );

		const loadoutChar = document.createElement( 'div' );
		loadoutChar.className = 'page-lobby__loadout-character';

		const charName = document.createElement( 'div' );
		charName.className = 'page-lobby__loadout-char-name';
		charName.textContent = '—';
		loadoutChar.appendChild( charName );
		loadout.appendChild( loadoutChar );
		this._registerSection( 'charName', charName );

		const startWrap = document.createElement( 'div' );
		startWrap.className = 'page-lobby__start-wrap';
		this._startMatchBtn = new CTAButton( {
			label:    'START MATCH',
			variant:  'primary',
			actionId: ButtonIds.LOBBY_START_MATCH,
		} );
		startWrap.appendChild( this._startMatchBtn.el );
		loadout.appendChild( startWrap );
		root.appendChild( loadout );

	}

	// ---------------------------------------------------------------------------
	// Lifecycle override
	// ---------------------------------------------------------------------------

	_onMounted() {

		// Focus ready button on mount — primary action for non-host players.
		this._readyBtn?.el.focus( { preventScroll: true } );

	}

	// ---------------------------------------------------------------------------
	// Public API — called by controller
	// ---------------------------------------------------------------------------

	/**
	 * Display the room code in the header.
	 *
	 * @param {string} code  e.g. "ABCD12"
	 */
	setRoomCode( code ) {

		const block = this.getSection( 'roomCodeBlock' );
		const value = this.getSection( 'roomCodeValue' );

		if ( block ) block.classList.add( 'page-lobby__room-code-block--visible' );
		if ( value ) value.textContent = code;

	}

	/**
	 * @param {string} text  e.g. "3:00"
	 */
	setCountdown( text ) {

		const el = this.getSection( 'countdownTime' );
		if ( el ) el.textContent = text;

	}

	/**
	 * @param {string} text  e.g. "WAITING FOR PLAYERS"
	 */
	setCountdownLabel( text ) {

		const el = this.getSection( 'countdownLabel' );
		if ( el ) el.textContent = text;

	}

	/**
	 * Render the party member list.
	 *
	 * @param {Array<{id:string, name:string, role:string, ready:boolean, online:boolean}>} members
	 */
	setMembers( members ) {

		const list = this.getSection( 'memberList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const m of members ) {

			const safeName = sanitizePlayerName( m.name );

			const li = document.createElement( 'li' );
			li.className = 'page-lobby__member';
			li.setAttribute( 'role', 'listitem' );
			li.setAttribute( 'aria-label', `${safeName} — ${m.role} — ${m.ready ? 'ready' : 'not ready'}` );

			const avatar = document.createElement( 'div' );
			avatar.className = 'page-lobby__member-avatar';
			avatar.setAttribute( 'aria-hidden', 'true' );
			avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
			li.appendChild( avatar );

			const info = document.createElement( 'div' );
			info.className = 'page-lobby__member-info';

			const name = document.createElement( 'div' );
			name.className = 'page-lobby__member-name';
			name.textContent = safeName;
			info.appendChild( name );

			const role = document.createElement( 'div' );
			role.className = 'page-lobby__member-role';
			role.textContent = m.role;
			info.appendChild( role );
			li.appendChild( info );

			const readyBadge = document.createElement( 'div' );
			readyBadge.className = `page-lobby__member-ready page-lobby__member-ready--${m.ready ? 'yes' : 'no'}`;
			readyBadge.textContent = m.ready ? 'READY' : 'NOT READY';
			li.appendChild( readyBadge );

			list.appendChild( li );

		}

	}

	/**
	 * Render track vote cards.
	 *
	 * @param {Array<{id:string, name:string, votes:number}>} tracks
	 */
	setTrackVotes( tracks ) {

		const container = this.getSection( 'trackCards' );
		if ( ! container ) return;

		container.innerHTML = '';
		this._trackVoteBtns = [];

		for ( const track of tracks ) {

			const card = document.createElement( 'div' );
			card.className = 'page-lobby__track-card';
			card.setAttribute( 'role', 'group' );
			card.setAttribute( 'aria-label', `Vote for ${track.name}` );

			const thumb = document.createElement( 'div' );
			thumb.className = 'page-lobby__track-thumb';
			thumb.setAttribute( 'aria-hidden', 'true' );
			const placeholder = document.createElement( 'div' );
			placeholder.className = 'page-lobby__track-thumb-placeholder';
			placeholder.textContent = 'TRACK';
			thumb.appendChild( placeholder );
			card.appendChild( thumb );

			const trackName = document.createElement( 'div' );
			trackName.className = 'page-lobby__track-name';
			trackName.textContent = track.name;
			card.appendChild( trackName );

			const votes = document.createElement( 'div' );
			votes.className = 'page-lobby__track-votes';
			votes.textContent = `VOTES ${track.votes}`;
			votes.setAttribute( 'aria-label', `${track.votes} votes` );
			card.appendChild( votes );

			const voteBtn = new CTAButton( {
				label:    'VOTE',
				variant:  'secondary',
				actionId: ButtonIds.LOBBY_TRACK_VOTE,
				ariaLabel: `Vote for ${track.name}`,
			} );
			voteBtn.el.dataset.trackId = track.id;
			this._trackVoteBtns.push( voteBtn );
			card.appendChild( voteBtn.el );

			container.appendChild( card );

		}

	}

	/**
	 * Render race rules list.
	 *
	 * @param {string[]} rules  Each entry is one rule string.
	 */
	setRaceRules( rules ) {

		const list = this.getSection( 'rulesList' );
		if ( ! list ) return;

		list.innerHTML = '';

		for ( const rule of rules ) {

			const li = document.createElement( 'li' );
			li.textContent = rule;
			list.appendChild( li );

		}

	}

	/**
	 * Update the ready button and indicator to reflect current state.
	 *
	 * @param {boolean} isReady
	 */
	setReadyState( isReady ) {

		this._readyBtn?.setLabel( isReady ? 'NOT READY' : 'READY UP' );
		this._readyBtn?.setPressed( isReady );

		const indicator = this.getSection( 'readyIndicator' );
		if ( indicator ) {

			indicator.classList.toggle( 'page-lobby__ready-indicator--ready', isReady );

		}

	}

	/**
	 * Show or hide host-only controls (Start Match button).
	 *
	 * @param {boolean} isHost
	 */
	setHostControls( isHost ) {

		if ( ! this._startMatchBtn ) return;
		this._startMatchBtn.el.hidden = ! isHost;
		this._startMatchBtn.el.setAttribute( 'aria-hidden', String( ! isHost ) );

	}

	/**
	 * Populate the player loadout panel.
	 *
	 * @param {{kartName:string, characterName:string, kart?:{speed:number, accel:number, handling:number}}} loadout
	 */
	setLoadout( loadout ) {

		const kartNameEl = this.getSection( 'kartName' );
		if ( kartNameEl ) kartNameEl.textContent = loadout.kartName ?? '—';

		const charNameEl = this.getSection( 'charName' );
		if ( charNameEl ) charNameEl.textContent = loadout.characterName ?? '—';

		const statsEl = this.getSection( 'kartStats' );
		if ( statsEl && loadout.kart ) {

			statsEl.innerHTML = '';
			const statsToShow = [
				{ label: 'TOP SPEED', value: `${loadout.kart.speed}/10` },
				{ label: 'ACCEL',     value: `${loadout.kart.accel}/10` },
				{ label: 'HANDLING',  value: `${loadout.kart.handling}/10` },
			];
			for ( const s of statsToShow ) {

				const stat = document.createElement( 'div' );
				stat.className = 'page-lobby__loadout-stat';
				stat.innerHTML = `<strong>${s.value}</strong>${s.label}`;
				statsEl.appendChild( stat );

			}

		}

	}

	// ---------------------------------------------------------------------------
	// Getters
	// ---------------------------------------------------------------------------

	/** @returns {CTAButton} */
	get inviteFriendsBtn() { return this._inviteFriendsBtn; }

	/** @returns {CTAButton} */
	get readyBtn() { return this._readyBtn; }

	/** @returns {CTAButton} */
	get startMatchBtn() { return this._startMatchBtn; }

	/** @returns {CTAButton[]} */
	get trackVoteBtns() { return this._trackVoteBtns; }

	/** @returns {CTAButton|null} */
	get roomCodeJoinBtn() { return this._roomCodeJoinBtn; }

	/** @returns {HTMLInputElement|null} */
	get roomCodeInputEl() { return this._roomCodeInput; }

	// ---------------------------------------------------------------------------
	// Dispose
	// ---------------------------------------------------------------------------

	dispose() {

		this._inviteFriendsBtn  = null;
		this._readyBtn          = null;
		this._startMatchBtn     = null;
		this._trackVoteBtns     = [];
		this._roomCodeJoinBtn   = null;
		this._roomCodeInput     = null;

		super.dispose();

	}

}

Page05LobbyView._cssInjected = false;
