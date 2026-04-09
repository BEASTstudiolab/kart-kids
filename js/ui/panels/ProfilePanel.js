/**
 * ProfilePanel — PROFILE tab content.
 *
 * Displays:
 *   - Player name with avatar color indicator
 *   - Race stats summary: Total Races, Wins, Win Rate, Best Times
 *   - Gear icon button (top-right) that opens Settings as a modal
 *
 * Lifecycle: constructor(container, services), show(), hide(), dispose().
 * Panel is created once in AppShell.bootstrap() and persists across tab switches.
 * show() refreshes stats from Settings (they may have changed since last viewed).
 *
 * Data sources:
 *   - Settings.getDisplayName(), Settings.getStats(), Settings.getAvatarChoice()
 *
 * CSS uses _injectCSS() pattern with BEM naming kk-profile-*.
 */

import { Settings } from '../../Settings.js';

// ---------------------------------------------------------------------------
// Avatar color palette — maps avatarChoice index to a hex color.
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
	'#f44336', '#e91e63', '#9c27b0', '#673ab7',
	'#3f51b5', '#2196f3', '#00bcd4', '#009688',
	'#4caf50', '#ff9800', '#ff5722', '#795548',
];

export class ProfilePanel {

	/**
	 * @param {HTMLElement} container  The #kk-panel-profile div.
	 * @param {object}      services   AppShell service bag.
	 */
	constructor( container, services ) {

		/** @type {HTMLElement} */
		this._container = container;

		/** @type {object} */
		this._services = services;

		/** @type {HTMLElement | null} */
		this._nameEl = null;

		/** @type {HTMLElement | null} */
		this._avatarEl = null;

		/** @type {HTMLElement | null} */
		this._statsGridEl = null;

		/** @type {HTMLElement | null} */
		this._bestTimesEl = null;

		/** @type {Function | null} */
		this._gearClickHandler = null;

		this._injectCSS();
		this._build();

	}

	// ---------------------------------------------------------------------------
	// CSS injection
	// ---------------------------------------------------------------------------

	static _cssInjected = false;

	_injectCSS() {

		if ( ProfilePanel._cssInjected ) return;
		ProfilePanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `

			/* -------------------------------------------------------------- */
			/* ProfilePanel root                                               */
			/* -------------------------------------------------------------- */

			.kk-profile {
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: var(--space-6, 1.5rem) var(--space-4, 1rem);
				max-width: 28rem;
				margin: 0 auto;
				position: relative;
			}

			/* -------------------------------------------------------------- */
			/* Gear button                                                     */
			/* -------------------------------------------------------------- */

			.kk-profile__gear-btn {
				position: absolute;
				top: var(--space-4, 1rem);
				right: var(--space-4, 1rem);
				background: none;
				border: none;
				cursor: pointer;
				padding: var(--space-2, 0.5rem);
				border-radius: var(--radius-sm, 0.25rem);
				color: var(--color-ink-300, #94a3b8);
				transition: color var(--duration-normal, 150ms) var(--ease-standard, ease);
			}

			.kk-profile__gear-btn:hover,
			.kk-profile__gear-btn:focus-visible {
				color: var(--color-ink-100, #f1f5f9);
				outline: 2px solid var(--color-focus, #60a5fa);
				outline-offset: 2px;
			}

			/* -------------------------------------------------------------- */
			/* Player identity card                                            */
			/* -------------------------------------------------------------- */

			.kk-profile__identity {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3, 0.75rem);
				margin-bottom: var(--space-6, 1.5rem);
			}

			.kk-profile__avatar {
				width: 4rem;
				height: 4rem;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: var(--text-2xl, 1.5rem);
				font-weight: var(--weight-bold, 700);
				color: #fff;
				text-transform: uppercase;
				user-select: none;
			}

			.kk-profile__name {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xl, 1.25rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-ink-100, #f1f5f9);
				letter-spacing: var(--tracking-wide, 0.025em);
				text-transform: uppercase;
			}

			/* -------------------------------------------------------------- */
			/* Stats grid                                                      */
			/* -------------------------------------------------------------- */

			.kk-profile__stats-title {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-ink-300, #94a3b8);
				letter-spacing: var(--tracking-wider, 0.05em);
				text-transform: uppercase;
				margin-bottom: var(--space-3, 0.75rem);
				align-self: flex-start;
				width: 100%;
			}

			.kk-profile__stats-grid {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: var(--space-3, 0.75rem);
				width: 100%;
				margin-bottom: var(--space-6, 1.5rem);
			}

			.kk-profile__stat-card {
				background: var(--color-surface-raised, rgba(255,255,255,0.05));
				border-radius: var(--radius-md, 0.5rem);
				padding: var(--space-4, 1rem) var(--space-3, 0.75rem);
				text-align: center;
			}

			.kk-profile__stat-value {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-2xl, 1.5rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-ink-100, #f1f5f9);
				line-height: 1;
				margin-bottom: var(--space-1, 0.25rem);
			}

			.kk-profile__stat-label {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-xs, 0.75rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-ink-300, #94a3b8);
				letter-spacing: var(--tracking-wider, 0.05em);
				text-transform: uppercase;
			}

			/* -------------------------------------------------------------- */
			/* Best times                                                      */
			/* -------------------------------------------------------------- */

			.kk-profile__best-times {
				width: 100%;
			}

			.kk-profile__best-times-list {
				list-style: none;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				gap: var(--space-2, 0.5rem);
			}

			.kk-profile__best-time-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: var(--space-3, 0.75rem);
				background: var(--color-surface-raised, rgba(255,255,255,0.05));
				border-radius: var(--radius-md, 0.5rem);
			}

			.kk-profile__best-time-track {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-200, #cbd5e1);
			}

			.kk-profile__best-time-value {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-cta-primary, #fbbf24);
			}

			.kk-profile__best-times-empty {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-sm, 0.875rem);
				color: var(--color-ink-400, #64748b);
				text-align: center;
				padding: var(--space-4, 1rem);
			}

		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// DOM construction
	// ---------------------------------------------------------------------------

	_build() {

		const root = document.createElement( 'div' );
		root.className = 'kk-profile';

		// Gear button (top-right).
		const gearBtn = document.createElement( 'button' );
		gearBtn.className = 'kk-profile__gear-btn';
		gearBtn.type = 'button';
		gearBtn.setAttribute( 'aria-label', 'Open settings' );
		gearBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
		this._gearClickHandler = () => this._openSettings();
		gearBtn.addEventListener( 'click', this._gearClickHandler );
		this._gearBtn = gearBtn;
		root.appendChild( gearBtn );

		// Player identity.
		const identity = document.createElement( 'div' );
		identity.className = 'kk-profile__identity';

		const avatar = document.createElement( 'div' );
		avatar.className = 'kk-profile__avatar';
		this._avatarEl = avatar;
		identity.appendChild( avatar );

		const nameEl = document.createElement( 'div' );
		nameEl.className = 'kk-profile__name';
		this._nameEl = nameEl;
		identity.appendChild( nameEl );

		root.appendChild( identity );

		// Stats section title.
		const statsTitle = document.createElement( 'div' );
		statsTitle.className = 'kk-profile__stats-title';
		statsTitle.textContent = 'RACE STATS';
		root.appendChild( statsTitle );

		// Stats grid (3 cards: Total Races, Wins, Win Rate).
		const statsGrid = document.createElement( 'div' );
		statsGrid.className = 'kk-profile__stats-grid';
		this._statsGridEl = statsGrid;
		root.appendChild( statsGrid );

		// Best times section title.
		const bestTitle = document.createElement( 'div' );
		bestTitle.className = 'kk-profile__stats-title';
		bestTitle.textContent = 'BEST TIMES';
		root.appendChild( bestTitle );

		// Best times list.
		const bestTimes = document.createElement( 'div' );
		bestTimes.className = 'kk-profile__best-times';
		this._bestTimesEl = bestTimes;
		root.appendChild( bestTimes );

		this._root = root;
		this._container.appendChild( root );

	}

	// ---------------------------------------------------------------------------
	// Data refresh
	// ---------------------------------------------------------------------------

	/**
	 * Refresh all displayed data from Settings.
	 * Called on every show() so stats are current.
	 */
	_refresh() {

		const settings = new Settings();
		const displayName = settings.getDisplayName() ?? 'Player';
		const avatarChoice = settings.getAvatarChoice();
		const stats = settings.getStats();

		// Avatar color indicator.
		const colorIdx = typeof avatarChoice === 'number' ? avatarChoice : 0;
		const color = AVATAR_COLORS[ colorIdx % AVATAR_COLORS.length ];
		this._avatarEl.style.background = color;
		this._avatarEl.textContent = displayName.charAt( 0 );

		// Player name.
		this._nameEl.textContent = displayName;

		// Stats grid.
		const winRate = stats.totalRaces > 0
			? Math.round( ( stats.wins / stats.totalRaces ) * 100 )
			: 0;

		const statItems = [
			{ label: 'RACES', value: String( stats.totalRaces ) },
			{ label: 'WINS', value: String( stats.wins ) },
			{ label: 'WIN RATE', value: `${winRate}%` },
		];

		this._statsGridEl.innerHTML = '';

		for ( const item of statItems ) {

			const card = document.createElement( 'div' );
			card.className = 'kk-profile__stat-card';

			const val = document.createElement( 'div' );
			val.className = 'kk-profile__stat-value';
			val.textContent = item.value;
			card.appendChild( val );

			const lbl = document.createElement( 'div' );
			lbl.className = 'kk-profile__stat-label';
			lbl.textContent = item.label;
			card.appendChild( lbl );

			this._statsGridEl.appendChild( card );

		}

		// Best times.
		this._bestTimesEl.innerHTML = '';
		const bestTimes = stats.bestTimes || {};
		const trackNames = Object.keys( bestTimes );

		if ( trackNames.length === 0 ) {

			const empty = document.createElement( 'div' );
			empty.className = 'kk-profile__best-times-empty';
			empty.textContent = 'No best times recorded yet. Race to set some!';
			this._bestTimesEl.appendChild( empty );

		} else {

			const list = document.createElement( 'ul' );
			list.className = 'kk-profile__best-times-list';

			for ( const track of trackNames ) {

				const li = document.createElement( 'li' );
				li.className = 'kk-profile__best-time-item';

				const trackLabel = document.createElement( 'span' );
				trackLabel.className = 'kk-profile__best-time-track';
				trackLabel.textContent = track;
				li.appendChild( trackLabel );

				const timeVal = document.createElement( 'span' );
				timeVal.className = 'kk-profile__best-time-value';
				timeVal.textContent = _formatTime( bestTimes[ track ] );
				li.appendChild( timeVal );

				list.appendChild( li );

			}

			this._bestTimesEl.appendChild( list );

		}

	}

	// ---------------------------------------------------------------------------
	// Settings modal
	// ---------------------------------------------------------------------------

	_openSettings() {

		const modal = this._services.modal;

		if ( ! modal ) {

			// Fallback: navigate to settings route.
			const nav = this._services.navigation;
			if ( nav ) nav.push( 'settings' );
			return;

		}

		// Build settings content body for the modal.
		const bodyEl = document.createElement( 'div' );
		bodyEl.style.cssText = 'min-height:12rem;';

		// Lazy-import the settings controller/view and render into the modal body.
		import( '../pages/page21-settings/Page21SettingsController.js' ).then( ( { Page21SettingsController } ) => {

			const ctrl = new Page21SettingsController( {}, this._services );
			ctrl.initialize();
			ctrl.bindEvents();
			ctrl.loadData().then( () => {

				ctrl.render( bodyEl );

			} );

			// Store ref so we can dispose on close.
			handle._settingsCtrl = ctrl;

		} );

		const handle = modal.open( {
			title: 'Settings',
			body: bodyEl,
			dismissible: true,
			onClose: () => {

				// Dispose the settings controller on modal close.
				if ( handle._settingsCtrl ) {

					handle._settingsCtrl.dispose();

				}

				// Refresh profile stats — settings may have changed display name.
				this._refresh();

			},
		} );

	}

	// ---------------------------------------------------------------------------
	// Panel lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Show the panel. Refresh stats from Settings (they may have changed).
	 */
	show() {

		this._refresh();

	}

	/**
	 * Hide the panel. No-op — panel stays in DOM.
	 */
	hide() {

		// No-op. Panel persists; hidden via CSS by AppShell.

	}

	/**
	 * Tear down the panel. Remove DOM and event listeners.
	 */
	dispose() {

		if ( this._gearBtn && this._gearClickHandler ) {

			this._gearBtn.removeEventListener( 'click', this._gearClickHandler );

		}

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._container = null;
		this._services = null;

	}

}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a time in seconds to m:ss.fff display string.
 *
 * @param {number} seconds
 * @returns {string}
 */
function _formatTime( seconds ) {

	if ( typeof seconds !== 'number' || isNaN( seconds ) ) return '--:--.---';

	let mins = Math.floor( seconds / 60 );
	const secs = seconds % 60;
	let whole = Math.floor( secs );
	let ms = Math.round( ( secs - whole ) * 1000 );

	if ( ms >= 1000 ) {

		ms -= 1000;
		whole += 1;

	}

	if ( whole >= 60 ) {

		whole -= 60;
		mins += 1;

	}

	return `${mins}:${String( whole ).padStart( 2, '0' )}.${String( ms ).padStart( 3, '0' )}`;

}
