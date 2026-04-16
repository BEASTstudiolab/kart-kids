export class MarginalModeButton {

	static _cssInjected = false;

	constructor( config = {} ) {

		this._config = {
			label: '',
			actionId: '',
			active: false,
			...config,
		};

		this._el = null;

		this._injectCSS();
		this._build();
		this._bindEvents();

	}

	_injectCSS() {

		if ( MarginalModeButton._cssInjected ) return;
		MarginalModeButton._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-mv-mode-btn {
				background: transparent;
				border: 0.5px solid var( --mv-cream );
				color: var( --mv-cream );
				padding: 10px 20px;
				font-family: var( --mv-font-mono );
				font-size: 11px;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				transition:
					background 0.2s ease,
					border-color 0.2s ease,
					color 0.2s ease,
					transform 0.2s ease;
			}

			.kk-mv-mode-btn:hover {
				background: var( --mv-red );
				border-color: var( --mv-red );
			}

			.kk-mv-mode-btn:active {
				transform: scale( 0.98 );
			}

			.kk-mv-mode-btn--active {
				background: var( --mv-cream );
				color: var( --mv-dark );
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'kk-mv-mode-btn';
		btn.textContent = this._config.label;
		btn.dataset.modeId = this._config.actionId;
		btn.setAttribute( 'aria-pressed', this._config.active ? 'true' : 'false' );

		if ( this._config.active ) {

			btn.classList.add( 'kk-mv-mode-btn--active' );

		}

		this._el = btn;

	}

	_bindEvents() {

		this._el.addEventListener( 'click', () => {

			this._el.dispatchEvent( new CustomEvent( 'kk:mv:mode-change', {
				bubbles: true,
				composed: true,
				detail: {
					modeId: this._config.actionId,
				},
			} ) );

		} );

	}

	setActive( active ) {

		this._config.active = !! active;
		this._el.classList.toggle( 'kk-mv-mode-btn--active', this._config.active );
		this._el.setAttribute( 'aria-pressed', this._config.active ? 'true' : 'false' );

	}

	get el() {

		return this._el;

	}

}
