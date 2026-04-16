export class MarginalPanelCard {

	static _cssInjected = false;

	constructor( config = {} ) {

		this._config = {
			variant: 'cream',
			headerLeft: '',
			headerRight: '',
			headerLeftHtml: '',
			headerRightHtml: '',
			sticker: '',
			...config,
		};

		this._root = null;
		this._headerLeftEl = null;
		this._headerRightEl = null;
		this._stickerEl = null;
		this._bodyEl = null;

		this._injectCSS();
		this._build();

	}

	_injectCSS() {

		if ( MarginalPanelCard._cssInjected ) return;
		MarginalPanelCard._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-mv-card {
				position: relative;
				padding: var(--space-4, 15px);
				clip-path: polygon( 0 0, 100% 0, 100% 90%, 95% 100%, 0 100% );
				border: 1px solid transparent;
				overflow: visible;
			}

			.kk-mv-card--cream {
				background: var( --mv-cream, var( --color-editorial-cream, #f7f3e9 ) );
				color: var( --mv-dark, var( --color-editorial-ink, #0f1115 ) );
			}

			.kk-mv-card--red {
				background: var( --mv-red, var( --color-editorial-red, #d82c2c ) );
				color: var( --mv-cream, var( --color-editorial-cream, #f7f3e9 ) );
			}

			.kk-mv-card--outline {
				background: transparent;
				color: var( --mv-cream, var( --color-editorial-cream, #f7f3e9 ) );
				border-color: currentColor;
			}

			.kk-mv-card__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				padding-bottom: 4px;
				margin-bottom: 10px;
				border-bottom: 1px solid currentColor;
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: var(--text-editorial-label, 0.625rem);
				font-weight: 700;
				letter-spacing: var(--tracking-widest, 0.14em);
				text-transform: uppercase;
			}

			.kk-mv-card--cream .kk-mv-card__header-left {
				color: rgba(15, 17, 21, 1);
			}
			.kk-mv-card__header-left--icon,
			.kk-mv-card__header-right--icon {
				display: inline-flex;
				align-items: center;
				line-height: 0;
			}


			.kk-mv-card__header-right:empty {
				display: none;
			}

			.kk-mv-card__body {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.kk-mv-card__sticker {
				position: absolute;
				right: -25px;
				top: 50%;
				transform: translateY( -50% ) rotate( -90deg );
				padding: 4px 8px;
				background: var( --mv-red, var( --color-editorial-red, #d82c2c ) );
				color: var( --mv-cream, var( --color-editorial-cream, #f7f3e9 ) );
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: calc(var(--text-editorial-label, 0.625rem) - 0.08rem);
				font-weight: 700;
				letter-spacing: 0.2em;
				text-transform: uppercase;
				white-space: nowrap;
			}

			@media ( max-width: 900px ) {

				.kk-mv-card__sticker {
					right: auto;
					left: 16px;
					top: -12px;
					transform: none;
				}

			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const root = document.createElement( 'section' );
		root.className = `kk-mv-card kk-mv-card--${ this._config.variant }`;

		if ( this._config.sticker ) {

			const sticker = document.createElement( 'div' );
			sticker.className = 'kk-mv-card__sticker';
			sticker.textContent = this._config.sticker;
			root.appendChild( sticker );
			this._stickerEl = sticker;

		}

		const header = document.createElement( 'div' );
		header.className = 'kk-mv-card__header';

		const left = document.createElement( 'span' );
		left.className = 'kk-mv-card__header-left';
		if ( this._config.headerLeftHtml ) {

			left.classList.add( 'kk-mv-card__header-left--icon' );
			left.innerHTML = this._config.headerLeftHtml;

		} else {

			left.textContent = this._config.headerLeft;

		}
		header.appendChild( left );
		this._headerLeftEl = left;

		const right = document.createElement( 'span' );
		right.className = 'kk-mv-card__header-right';
		if ( this._config.headerRightHtml ) {

			right.classList.add( 'kk-mv-card__header-right--icon' );
			right.innerHTML = this._config.headerRightHtml;

		} else {

			right.textContent = this._config.headerRight;

		}
		header.appendChild( right );
		this._headerRightEl = right;

		root.appendChild( header );

		const body = document.createElement( 'div' );
		body.className = 'kk-mv-card__body';
		root.appendChild( body );
		this._bodyEl = body;

		this._root = root;

	}

	get el() {

		return this._root;

	}

	get bodyEl() {

		return this._bodyEl;

	}

	get headerLeftEl() {

		return this._headerLeftEl;

	}

	get headerRightEl() {

		return this._headerRightEl;

	}

}
