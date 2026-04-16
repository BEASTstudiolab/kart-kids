export class MarginalActionCard {

	static _cssInjected = false;

	constructor( config = {} ) {

		this._config = {
			actionId: '',
			label: '',
			tag: '',
			value: '',
			copy: '',
			active: false,
			...config,
		};

		this._el = null;
		this._injectCSS();
		this._build();
		this._bindEvents();

	}

	_injectCSS() {

		if ( MarginalActionCard._cssInjected ) return;
		MarginalActionCard._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-mv-action-card {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
				width: 100%;
				padding: 1rem;
				border: 1px solid rgba( 247, 243, 233, 0.8 );
				background: rgba( 247, 243, 233, 0.92 );
				color: var( --mv-dark, #0f1115 );
				clip-path: polygon( 0 0, 100% 0, 100% 88%, 95% 100%, 0 100% );
				text-align: left;
				transition:
					transform 0.2s ease,
					background 0.2s ease,
					color 0.2s ease,
					border-color 0.2s ease,
					box-shadow 0.2s ease;
			}

			.kk-mv-action-card:hover,
			.kk-mv-action-card:focus-visible {
				transform: translateY( -2px );
				border-color: rgba( 247, 243, 233, 1 );
				box-shadow: 0 18px 30px rgba( 0, 0, 0, 0.16 );
			}

			.kk-mv-action-card--active {
				background: var( --mv-red, #d82c2c );
				color: var( --mv-cream, #f7f3e9 );
				border-color: rgba( 216, 44, 44, 0.88 );
			}

			.kk-mv-action-card__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding-bottom: 0.35rem;
				border-bottom: 1px solid currentColor;
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-editorial-label, 0.625rem );
				font-weight: 700;
				letter-spacing: var( --tracking-widest, 0.14em );
				text-transform: uppercase;
			}

			.kk-mv-action-card__value {
				font-family: var( --font-editorial-display, var( --font-display, sans-serif ) );
				font-size: var( --text-editorial-card-value, clamp( 1.9rem, 4vw, 3rem ) );
				font-weight: 900;
				line-height: 0.9;
				letter-spacing: -0.06em;
				text-transform: uppercase;
			}

			.kk-mv-action-card__copy {
				margin: 0;
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-editorial-copy, 0.625rem );
				line-height: var( --leading-relaxed, 1.6 );
				letter-spacing: 0.12em;
				text-transform: uppercase;
				opacity: 0.9;
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'kk-mv-action-card';
		button.dataset.modeId = this._config.actionId;
		button.setAttribute( 'aria-pressed', this._config.active ? 'true' : 'false' );

		const header = document.createElement( 'div' );
		header.className = 'kk-mv-action-card__header';
		header.innerHTML = `<span>${ this._config.label }</span><span>${ this._config.tag }</span>`;
		button.appendChild( header );

		const value = document.createElement( 'div' );
		value.className = 'kk-mv-action-card__value';
		value.textContent = this._config.value;
		button.appendChild( value );

		const copy = document.createElement( 'p' );
		copy.className = 'kk-mv-action-card__copy';
		copy.textContent = this._config.copy;
		button.appendChild( copy );

		if ( this._config.active ) {

			button.classList.add( 'kk-mv-action-card--active' );

		}

		this._el = button;

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
		this._el.classList.toggle( 'kk-mv-action-card--active', this._config.active );
		this._el.setAttribute( 'aria-pressed', this._config.active ? 'true' : 'false' );

	}

	get el() {

		return this._el;

	}

}
