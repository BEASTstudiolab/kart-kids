/**
 * Tabs — Horizontal category tab bar; automatic activation model (ARIA §3.23.1).
 * Component #7 per COMPONENT_SPEC.md
 *
 * DOM structure:
 *   div.kk-tabs[role="tablist"]
 *     button.kk-tabs__tab[role="tab"][aria-selected][aria-controls]
 *       span.kk-tabs__tab-label
 *       span.kk-tabs__tab-badge   (omitted when badge count is 0 / null)
 *
 * Tab panels live outside kk-tabs; callers retrieve them via getPanel(tabId).
 * Panels are created by Tabs and must be appended to the page body by the caller.
 *
 * Events emitted:
 *   kk:tabs:change  →  detail: { tabId, previousTabId }
 *
 * CSS injection: static guard, one <style> tag per class.
 */

let _tabsUid = 0;

export class Tabs {

	static _cssInjected = false;

	/**
	 * @param {object} config
	 * @param {string} [config.uid]
	 * @param {Array<TabItem>} config.tabs
	 * @param {string} config.activeId        id of initially selected tab
	 * @param {string} config.ariaLabel
	 * @param {boolean} [config.loading]
	 */
	constructor( config = {} ) {

		this._config = {
			uid:      null,
			tabs:     [],
			activeId: '',
			ariaLabel: 'Tabs',
			loading:  false,
			...config,
		};

		this._uid       = this._config.uid ?? String( ++ _tabsUid );
		this._activeId  = this._config.activeId;
		this._tabEls    = new Map();  // tabId -> button element
		this._panelEls  = new Map();  // tabId -> panel element
		this._roverIndex = 0;
		this._el        = null;

		this._injectCSS();
		this._build();
		this._bindEvents();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( Tabs._cssInjected ) return;
		Tabs._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-tabs {
				display: flex;
				flex-direction: row;
				gap: 0;
				background: var(--color-panel-base);
				border-bottom: var(--border-thin) solid var(--color-panel-border);
				overflow-x: auto;
				scrollbar-width: none;
			}

			.kk-tabs::-webkit-scrollbar {
				display: none;
			}

			.kk-tabs--loading {
				pointer-events: none;
			}

			.kk-tabs__tab {
				position: relative;
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-3) var(--space-4);
				min-height: var(--hit-target-min);
				min-width: var(--hit-target-min);
				background: none;
				border: none;
				border-bottom: var(--border-base) solid transparent;
				color: var(--color-ink-300);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				cursor: pointer;
				white-space: nowrap;
				transition:
					color var(--duration-normal) var(--ease-standard),
					border-color var(--duration-normal) var(--ease-standard);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-tabs__tab:hover {
				color: var(--color-white);
			}

			.kk-tabs__tab--selected,
			.kk-tabs__tab[aria-selected="true"] {
				color: var(--color-accent-orange);
				border-bottom-color: var(--color-accent-orange);
			}

			.kk-tabs__tab--disabled,
			.kk-tabs__tab[aria-disabled="true"] {
				color: var(--color-ink-500);
				cursor: not-allowed;
				pointer-events: none;
			}

			.kk-tabs__tab--pressed {
				opacity: 0.75;
			}

			.kk-tabs__tab-label {
				/* inherits tab styles */
			}

			.kk-tabs__tab-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.25rem;
				height: 1.25rem;
				padding: 0 var(--space-1);
				background: var(--color-accent-orange);
				color: var(--color-white);
				font-size: var(--text-xs);
				font-weight: var(--weight-bold);
				border-radius: var(--radius-pill);
				line-height: 1;
			}

			.kk-tabs__panel {
				outline: none;
			}

			.kk-tabs__panel:focus-visible {
				outline: var(--focus-ring-width) solid var(--focus-ring-color);
				outline-offset: var(--focus-ring-offset);
			}

			/* Hidden panels */
			.kk-tabs__panel[hidden] {
				display: none;
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const { tabs, ariaLabel, loading } = this._config;
		const uid = this._uid;

		const tablist = document.createElement( 'div' );
		tablist.className = 'kk-tabs';
		tablist.setAttribute( 'role', 'tablist' );
		tablist.setAttribute( 'aria-label', ariaLabel );

		if ( loading ) {
			tablist.classList.add( 'kk-tabs--loading' );
			tablist.setAttribute( 'aria-busy', 'true' );
		}

		this._tabEls.clear();
		this._panelEls.clear();

		tabs.forEach( ( tab, index ) => {

			const isSelected = tab.id === this._activeId;

			// Tab button
			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'kk-tabs__tab';
			btn.id = `tab-${uid}-${index}`;
			btn.setAttribute( 'role', 'tab' );
			btn.setAttribute( 'aria-selected', isSelected ? 'true' : 'false' );
			btn.setAttribute( 'aria-controls', `tabpanel-${uid}-${index}` );
			btn.setAttribute( 'tabindex', isSelected ? '0' : '-1' );
			btn.dataset.tabId = tab.id;

			if ( isSelected ) {
				btn.classList.add( 'kk-tabs__tab--selected' );
				this._roverIndex = index;
			}

			if ( tab.disabled ) {
				btn.setAttribute( 'aria-disabled', 'true' );
				btn.classList.add( 'kk-tabs__tab--disabled' );
			}

			// Label
			const labelEl = document.createElement( 'span' );
			labelEl.className = 'kk-tabs__tab-label';
			labelEl.textContent = tab.label;
			btn.appendChild( labelEl );

			// Badge — omit element when count is 0 or null
			if ( tab.badge != null && tab.badge > 0 ) {
				const badge = document.createElement( 'span' );
				badge.className = 'kk-tabs__tab-badge';
				badge.setAttribute( 'aria-label', `${tab.badge} new` );
				badge.textContent = String( tab.badge );
				btn.appendChild( badge );
			}

			tablist.appendChild( btn );
			this._tabEls.set( tab.id, btn );

			// Tab panel (caller must append to DOM)
			const panel = document.createElement( 'div' );
			panel.className = 'kk-tabs__panel';
			panel.id = `tabpanel-${uid}-${index}`;
			panel.setAttribute( 'role', 'tabpanel' );
			panel.setAttribute( 'aria-labelledby', `tab-${uid}-${index}` );
			panel.setAttribute( 'tabindex', '0' );
			if ( ! isSelected ) panel.hidden = true;

			this._panelEls.set( tab.id, panel );

		} );

		this._el = tablist;

	}

	// ---------------------------------------------------------------------------
	// Events
	// ---------------------------------------------------------------------------

	_bindEvents() {

		const tablist = this._el;

		// Pointer pressed state
		tablist.addEventListener( 'pointerdown', ( e ) => {

			const btn = e.target.closest( '.kk-tabs__tab' );
			if ( btn ) btn.classList.add( 'kk-tabs__tab--pressed' );

		} );

		const clearPressed = ( e ) => {

			const btn = e.target.closest?.( '.kk-tabs__tab' );
			if ( btn ) btn.classList.remove( 'kk-tabs__tab--pressed' );
			tablist.querySelectorAll( '.kk-tabs__tab--pressed' ).forEach( ( b ) =>
				b.classList.remove( 'kk-tabs__tab--pressed' )
			);

		};

		tablist.addEventListener( 'pointerup', clearPressed );
		tablist.addEventListener( 'pointercancel', clearPressed );

		// Click activation
		tablist.addEventListener( 'click', ( e ) => {

			const btn = e.target.closest( '.kk-tabs__tab' );
			if ( ! btn ) return;
			if ( btn.getAttribute( 'aria-disabled' ) === 'true' ) return;

			const tabId = btn.dataset.tabId;
			if ( tabId ) this._activateTab( tabId );

		} );

		// Keyboard — automatic activation model
		tablist.addEventListener( 'keydown', ( e ) => {

			const tabs    = this._config.tabs;
			const total   = tabs.length;
			let idx       = this._roverIndex;

			switch ( e.key ) {

				case 'ArrowRight':
					e.preventDefault();
					idx = ( idx + 1 ) % total;
					this._focusTab( idx );
					this._activateTab( tabs[ idx ].id );
					break;

				case 'ArrowLeft':
					e.preventDefault();
					idx = ( idx - 1 + total ) % total;
					this._focusTab( idx );
					this._activateTab( tabs[ idx ].id );
					break;

				case 'Home':
					e.preventDefault();
					this._focusTab( 0 );
					this._activateTab( tabs[ 0 ].id );
					break;

				case 'End':
					e.preventDefault();
					this._focusTab( total - 1 );
					this._activateTab( tabs[ total - 1 ].id );
					break;

				case 'Enter':
				case ' ':
					e.preventDefault();
					// Re-activates; no-op if already selected
					if ( tabs[ idx ] ) this._activateTab( tabs[ idx ].id );
					break;

				default:
					break;

			}

		} );

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	_focusTab( index ) {

		const tabs = this._config.tabs;
		this._roverIndex = index;

		this._tabEls.forEach( ( btn, tabId ) => {

			const tabIdx = tabs.findIndex( ( t ) => t.id === tabId );
			btn.setAttribute( 'tabindex', tabIdx === index ? '0' : '-1' );

		} );

		const targetId = tabs[ index ]?.id;
		if ( targetId ) {

			const btn = this._tabEls.get( targetId );
			btn?.focus();

		}

	}

	_activateTab( tabId ) {

		if ( tabId === this._activeId ) return;

		const previousTabId = this._activeId;
		this._activeId      = tabId;

		const tabs = this._config.tabs;

		// Update tab buttons
		this._tabEls.forEach( ( btn, id ) => {

			const isSelected = id === tabId;
			btn.setAttribute( 'aria-selected', isSelected ? 'true' : 'false' );
			btn.setAttribute( 'tabindex', isSelected ? '0' : '-1' );
			btn.classList.toggle( 'kk-tabs__tab--selected', isSelected );

			// Track rover
			if ( isSelected ) {
				const idx = tabs.findIndex( ( t ) => t.id === id );
				if ( idx !== - 1 ) this._roverIndex = idx;
			}

		} );

		// Update panels
		this._panelEls.forEach( ( panel, id ) => {

			panel.hidden = id !== tabId;

		} );

		// Emit change event
		this._el.dispatchEvent( new CustomEvent( 'kk:tabs:change', {
			bubbles:  true,
			composed: true,
			detail:   { tabId, previousTabId },
		} ) );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} The tablist element. */
	get el() {

		return this._el;

	}

	/**
	 * Get the panel element for a given tabId.
	 * Caller must append it to the page DOM.
	 *
	 * @param {string} tabId
	 * @returns {HTMLElement | undefined}
	 */
	getPanel( tabId ) {

		return this._panelEls.get( tabId );

	}

	/** All panel elements in tab order. Caller appends them to the page body. */
	get panels() {

		return Array.from( this._panelEls.values() );

	}

	/**
	 * Programmatically switch to a tab by id.
	 *
	 * @param {string} tabId
	 */
	setActiveTab( tabId ) {

		this._activateTab( tabId );

	}

	/**
	 * Update the badge count for a tab.
	 *
	 * @param {string} tabId
	 * @param {number|null} count  Null or 0 removes the badge element.
	 */
	setBadge( tabId, count ) {

		const btn = this._tabEls.get( tabId );
		if ( ! btn ) return;

		let badge = btn.querySelector( '.kk-tabs__tab-badge' );

		if ( ! count || count <= 0 ) {
			badge?.remove();
			return;
		}

		if ( ! badge ) {
			badge = document.createElement( 'span' );
			badge.className = 'kk-tabs__tab-badge';
			btn.appendChild( badge );
		}

		badge.setAttribute( 'aria-label', `${count} new` );
		badge.textContent = String( count );

	}

	setLoading( loading ) {

		if ( loading ) {
			this._el.classList.add( 'kk-tabs--loading' );
			this._el.setAttribute( 'aria-busy', 'true' );
		} else {
			this._el.classList.remove( 'kk-tabs--loading' );
			this._el.removeAttribute( 'aria-busy' );
		}

	}

	dispose() {

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._panelEls.forEach( ( panel ) => {
			if ( panel.parentNode ) panel.parentNode.removeChild( panel );
		} );

		this._el       = null;
		this._tabEls   = new Map();
		this._panelEls = new Map();

	}

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TabItem
 * @property {string}       id
 * @property {string}       label
 * @property {number|null}  [badge]
 * @property {boolean}      [disabled]
 */
