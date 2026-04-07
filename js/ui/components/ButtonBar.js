/**
 * ButtonBar — Horizontal toolbar of related secondary buttons with roving tabindex.
 * Component #9 per COMPONENT_SPEC.md
 *
 * DOM structure:
 *   div.kk-button-bar[role="toolbar"]
 *     button.kk-button-bar__btn[tabindex][data-action][aria-pressed?]
 *       span.kk-button-bar__btn-icon  (omitted when no icon)
 *       span.kk-button-bar__btn-label
 *
 * Keyboard: ArrowRight/Left cycle within toolbar; Home/End jump to edges.
 * One button holds tabindex="0" at all times (roving tabindex).
 *
 * Events emitted:
 *   kk:button-bar:click   →  detail: { id, actionId }
 *   kk:button-bar:toggle  →  detail: { id, actionId, pressed }  (toggle buttons only)
 *
 * CSS injection: static guard, one <style> tag per class.
 */

export class ButtonBar {

	static _cssInjected = false;

	/**
	 * @param {object} config
	 * @param {string} config.ariaLabel
	 * @param {Array<ButtonBarItem>} config.buttons
	 */
	constructor( config = {} ) {

		this._config = {
			ariaLabel: 'Actions',
			buttons:   [],
			...config,
		};

		this._el        = null;
		this._btnEls    = new Map();   // id -> button element
		this._roverIndex = 0;

		this._injectCSS();
		this._build();
		this._bindEvents();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( ButtonBar._cssInjected ) return;
		ButtonBar._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-button-bar {
				display: inline-flex;
				flex-direction: row;
				align-items: stretch;
				gap: 0;
				background: var(--color-panel-base);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				overflow: hidden;
			}

			.kk-button-bar__btn {
				display: flex;
				flex-direction: row;
				align-items: center;
				justify-content: center;
				gap: var(--space-2);
				padding: 0 var(--space-4);
				min-height: var(--hit-target-min);
				min-width: var(--hit-target-min);
				background: none;
				border: none;
				border-right: var(--border-thin) solid var(--color-panel-border);
				color: var(--color-ink-200);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-bold);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider);
				cursor: pointer;
				white-space: nowrap;
				transition:
					color var(--duration-normal) var(--ease-standard),
					background var(--duration-normal) var(--ease-standard);
				-webkit-tap-highlight-color: transparent;
				touch-action: manipulation;
			}

			.kk-button-bar__btn:last-child {
				border-right: none;
			}

			.kk-button-bar__btn:hover {
				color: var(--color-white);
				background: var(--color-panel-raised);
			}

			/* Selected state for toggle buttons (aria-pressed="true") */
			.kk-button-bar__btn--selected,
			.kk-button-bar__btn[aria-pressed="true"] {
				color: var(--color-accent-orange);
				background: var(--color-accent-orange-glow);
			}

			.kk-button-bar__btn--pressed {
				opacity: 0.7;
			}

			.kk-button-bar__btn--disabled,
			.kk-button-bar__btn[aria-disabled="true"] {
				color: var(--color-ink-500);
				cursor: not-allowed;
				pointer-events: none;
			}

			.kk-button-bar__btn-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 1.125rem;
				height: 1.125rem;
				flex-shrink: 0;
			}

			.kk-button-bar__btn-icon svg {
				width: 100%;
				height: 100%;
			}

			.kk-button-bar__btn-label {
				/* inherits btn styles */
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const { ariaLabel, buttons } = this._config;

		const toolbar = document.createElement( 'div' );
		toolbar.className = 'kk-button-bar';
		toolbar.setAttribute( 'role', 'toolbar' );
		toolbar.setAttribute( 'aria-label', ariaLabel );

		this._btnEls.clear();

		buttons.forEach( ( item, index ) => {

			const btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'kk-button-bar__btn';
			btn.dataset.action = item.actionId ?? '';
			btn.dataset.btnId  = item.id;

			// Roving tabindex — first button gets 0
			btn.setAttribute( 'tabindex', index === 0 ? '0' : '-1' );

			// Toggle aria-pressed
			if ( item.toggle ) {
				const pressed = item.pressed ?? false;
				btn.setAttribute( 'aria-pressed', pressed ? 'true' : 'false' );
				if ( pressed ) btn.classList.add( 'kk-button-bar__btn--selected' );
			}

			// Disabled
			if ( item.disabled ) {
				btn.setAttribute( 'aria-disabled', 'true' );
				btn.classList.add( 'kk-button-bar__btn--disabled' );
			}

			// Icon slot — omit element when no icon
			if ( item.icon ) {
				const iconWrap = document.createElement( 'span' );
				iconWrap.className = 'kk-button-bar__btn-icon';
				iconWrap.setAttribute( 'aria-hidden', 'true' );
				iconWrap.appendChild( item.icon );
				btn.appendChild( iconWrap );
			}

			// Label
			const labelEl = document.createElement( 'span' );
			labelEl.className = 'kk-button-bar__btn-label';
			labelEl.textContent = item.label;
			btn.appendChild( labelEl );

			toolbar.appendChild( btn );
			this._btnEls.set( item.id, btn );

		} );

		this._el = toolbar;

	}

	// ---------------------------------------------------------------------------
	// Events
	// ---------------------------------------------------------------------------

	_bindEvents() {

		const toolbar = this._el;
		const buttons = this._config.buttons;

		// Pressed state
		toolbar.addEventListener( 'pointerdown', ( e ) => {

			const btn = e.target.closest( '.kk-button-bar__btn' );
			if ( btn ) btn.classList.add( 'kk-button-bar__btn--pressed' );

		} );

		const clearPressed = () => {

			toolbar.querySelectorAll( '.kk-button-bar__btn--pressed' ).forEach( ( b ) =>
				b.classList.remove( 'kk-button-bar__btn--pressed' )
			);

		};

		toolbar.addEventListener( 'pointerup', clearPressed );
		toolbar.addEventListener( 'pointercancel', clearPressed );

		// Click
		toolbar.addEventListener( 'click', ( e ) => {

			const btn = e.target.closest( '.kk-button-bar__btn' );
			if ( ! btn ) return;
			if ( btn.getAttribute( 'aria-disabled' ) === 'true' ) return;

			const id      = btn.dataset.btnId;
			const actionId = btn.dataset.action;
			const itemCfg  = buttons.find( ( b ) => b.id === id );

			// Update rover on click
			const idx = buttons.findIndex( ( b ) => b.id === id );
			if ( idx !== - 1 ) this._setRover( idx );

			// Toggle handling
			if ( itemCfg?.toggle ) {

				const wasPressed = btn.getAttribute( 'aria-pressed' ) === 'true';
				const nowPressed = ! wasPressed;
				btn.setAttribute( 'aria-pressed', nowPressed ? 'true' : 'false' );
				btn.classList.toggle( 'kk-button-bar__btn--selected', nowPressed );

				toolbar.dispatchEvent( new CustomEvent( 'kk:button-bar:toggle', {
					bubbles:  true,
					composed: true,
					detail:   { id, actionId, pressed: nowPressed },
				} ) );

			}

			toolbar.dispatchEvent( new CustomEvent( 'kk:button-bar:click', {
				bubbles:  true,
				composed: true,
				detail:   { id, actionId },
			} ) );

		} );

		// Keyboard — roving tabindex within toolbar
		toolbar.addEventListener( 'keydown', ( e ) => {

			const total = buttons.length;
			let idx     = this._roverIndex;

			switch ( e.key ) {

				case 'ArrowRight':
					e.preventDefault();
					idx = ( idx + 1 ) % total;
					this._setRover( idx );
					this._btnEls.get( buttons[ idx ]?.id )?.focus();
					break;

				case 'ArrowLeft':
					e.preventDefault();
					idx = ( idx - 1 + total ) % total;
					this._setRover( idx );
					this._btnEls.get( buttons[ idx ]?.id )?.focus();
					break;

				case 'Home':
					e.preventDefault();
					this._setRover( 0 );
					this._btnEls.get( buttons[ 0 ]?.id )?.focus();
					break;

				case 'End':
					e.preventDefault();
					this._setRover( total - 1 );
					this._btnEls.get( buttons[ total - 1 ]?.id )?.focus();
					break;

				default:
					break;

			}

		} );

	}

	// ---------------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------------

	_setRover( index ) {

		this._roverIndex = index;
		const buttons    = this._config.buttons;

		this._btnEls.forEach( ( btn, id ) => {

			const i = buttons.findIndex( ( b ) => b.id === id );
			btn.setAttribute( 'tabindex', i === index ? '0' : '-1' );

		} );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} */
	get el() {

		return this._el;

	}

	/**
	 * Update the toggle pressed state of a button.
	 *
	 * @param {string} id
	 * @param {boolean} pressed
	 */
	setPressed( id, pressed ) {

		const btn = this._btnEls.get( id );
		if ( ! btn ) return;

		btn.setAttribute( 'aria-pressed', pressed ? 'true' : 'false' );
		btn.classList.toggle( 'kk-button-bar__btn--selected', pressed );

	}

	/**
	 * Enable or disable an individual button.
	 *
	 * @param {string} id
	 * @param {boolean} disabled
	 */
	setDisabled( id, disabled ) {

		const btn = this._btnEls.get( id );
		if ( ! btn ) return;

		if ( disabled ) {
			btn.setAttribute( 'aria-disabled', 'true' );
			btn.classList.add( 'kk-button-bar__btn--disabled' );
		} else {
			btn.removeAttribute( 'aria-disabled' );
			btn.classList.remove( 'kk-button-bar__btn--disabled' );
		}

	}

	dispose() {

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._el     = null;
		this._btnEls = new Map();

	}

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ButtonBarItem
 * @property {string}           id
 * @property {string}           label
 * @property {SVGElement|null}  [icon]
 * @property {string}           [actionId]
 * @property {boolean}          [disabled]
 * @property {boolean}          [toggle]    If true, button behaves as aria-pressed toggle.
 * @property {boolean}          [pressed]   Initial pressed state; only meaningful when toggle:true.
 */
