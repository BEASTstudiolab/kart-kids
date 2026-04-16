export class MarginalPanelHeader {

	static _cssInjected = false;

	constructor( config = {} ) {

		this._config = {
			title: '',
			subtitle: '',
			badge: '',
			className: '',
			...config,
		};

		this._root = null;

		this._injectCSS();
		this._build();

	}

	_injectCSS() {

		if ( MarginalPanelHeader._cssInjected ) return;
		MarginalPanelHeader._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-mv-header {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 20px;
				padding-top: var( --kk-shell-top-clearance, clamp( 3.5rem, 6vw, 4.25rem ) );
				padding-bottom: 20px;
				border-bottom: 0.5px solid rgba( 247, 243, 233, 0.8 );
			}

			.kk-mv-header__logo {
				display: flex;
				flex-direction: column;
			}

			.kk-mv-header__title {
				font-family: var( --font-editorial-display, var( --font-display, sans-serif ) );
				font-size: var( --text-editorial-panel-title, clamp( 2.35rem, 4.2vw, 3.4rem ) );
				font-weight: 900;
				line-height: 0.82;
				letter-spacing: -0.04em;
				color: var( --mv-red, #d82c2c );
				text-transform: uppercase;
			}

			.kk-mv-header__subtitle {
				margin-top: 8px;
				font-family: var( --font-editorial-mono, var( --font-mono, monospace ) );
				font-size: var( --text-editorial-label, 0.625rem );
				letter-spacing: calc( var( --tracking-widest, 0.14em ) * 2.5 );
				text-transform: uppercase;
				color: inherit;
			}

			.kk-mv-header__badge {
				align-self: flex-start;
				padding: 8px 22px;
				border: 1.5px solid rgba( 247, 243, 233, 0.8 );
				border-radius: 999px;
				font-family: var( --font-editorial-display, var( --font-display, sans-serif ) );
				font-size: var( --text-lg, 1.125rem );
				font-weight: 900;
				line-height: 1;
				text-transform: uppercase;
			}

			@media ( max-width: 980px ) {

				.kk-mv-header {
					flex-direction: column;
					align-items: flex-start;
					padding-top: 3.25rem;
				}

			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		const header = document.createElement( 'header' );
		header.className = [ 'kk-mv-header', this._config.className ].filter( Boolean ).join( ' ' );

		const logo = document.createElement( 'div' );
		logo.className = 'kk-mv-header__logo';

		const title = document.createElement( 'div' );
		title.className = 'kk-mv-header__title';
		title.textContent = this._config.title;
		logo.appendChild( title );

		const subtitle = document.createElement( 'div' );
		subtitle.className = 'kk-mv-header__subtitle';
		subtitle.textContent = this._config.subtitle;
		logo.appendChild( subtitle );

		header.appendChild( logo );

		if ( this._config.badge ) {

			const badge = document.createElement( 'div' );
			badge.className = 'kk-mv-header__badge';
			badge.textContent = this._config.badge;
			header.appendChild( badge );

		}

		this._root = header;

	}

	get el() {

		return this._root;

	}

}
