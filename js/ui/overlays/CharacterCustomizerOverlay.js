import { Page10CharacterSelectController } from '../pages/page10-character-select/Page10CharacterSelectController.js';

export class CharacterCustomizerOverlay {

	static _cssInjected = false;

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._el = null;
		this._contentEl = null;
		this._controller = null;
		this._visible = false;
		this._previousBodyOverflow = '';
		this._handleKeyDown = ( event ) => {

			if ( event.key !== 'Escape' || ! this._controller ) return;
			event.preventDefault();
			this._controller.requestClose();

		};

		this._injectCSS();

	}

	get visible() {

		return this._visible;

	}

	async show() {

		if ( this._visible ) return;
		this._visible = true;

		this._build();
		this._previousBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		this._container.appendChild( this._el );
		document.addEventListener( 'keydown', this._handleKeyDown, true );

		const params = {
			onClose: ( detail ) => {

				if ( detail?.saved ) {

					this._services.notification?.show( {
						message: 'Character saved',
						variant: 'success',
						duration: 1800,
					} );

				}

				this.hide();

			},
		};

		this._controller = new Page10CharacterSelectController( params, this._services );
		this._controller.initialize( params );
		this._controller.bindEvents();
		await this._controller.loadData();
		this._controller.render( this._contentEl );

		requestAnimationFrame( () => {

			if ( this._el ) this._el.classList.add( 'kk-character-customizer-overlay--visible' );

		} );

	}

	hide() {

		if ( ! this._visible ) return;
		this._visible = false;

		document.removeEventListener( 'keydown', this._handleKeyDown, true );
		document.body.style.overflow = this._previousBodyOverflow;

		if ( this._controller ) {

			this._controller.dispose();
			this._controller = null;

		}

		if ( this._el ) {

			this._el.classList.remove( 'kk-character-customizer-overlay--visible' );
			const overlay = this._el;
			this._el = null;
			this._contentEl = null;

			setTimeout( () => {

				if ( overlay.parentNode ) overlay.parentNode.removeChild( overlay );

			}, 220 );

		}

	}

	dispose() {

		this.hide();

	}

	_build() {

		const overlay = document.createElement( 'div' );
		overlay.className = 'kk-character-customizer-overlay';

		const content = document.createElement( 'div' );
		content.className = 'kk-character-customizer-overlay__content';
		overlay.appendChild( content );

		this._el = overlay;
		this._contentEl = content;

	}

	_injectCSS() {

		if ( CharacterCustomizerOverlay._cssInjected ) return;
		CharacterCustomizerOverlay._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-character-customizer-overlay {
				position: fixed;
				inset: 0;
				z-index: 480;
				opacity: 0;
				background:
					radial-gradient(circle at 78% 70%, rgba(216, 44, 44, 0.16), transparent 24%),
					linear-gradient(180deg, rgba(15, 17, 21, 0.5), rgba(15, 17, 21, 0.94));
				backdrop-filter: blur(14px);
				transition: opacity 180ms ease;
			}

			.kk-character-customizer-overlay::before,
			.kk-character-customizer-overlay::after {
				content: '';
				position: absolute;
				inset: 0;
				pointer-events: none;
			}

			.kk-character-customizer-overlay::before {
				opacity: 0.22;
				background:
					linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%),
					linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.008), rgba(0, 0, 255, 0.03));
				background-size: 100% 3px, 3px 100%;
			}

			.kk-character-customizer-overlay::after {
				box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.64);
			}

			.kk-character-customizer-overlay--visible {
				opacity: 1;
			}

			.kk-character-customizer-overlay__content {
				width: 100%;
				height: 100%;
				position: relative;
				z-index: 1;
				padding: 24px 24px calc(24px + var(--kk-shell-nav-clearance, 6.75rem));
				box-sizing: border-box;
			}

			.kk-character-customizer-overlay .page-character-select {
				height: 100%;
				padding: 0;
				color: #f7f3e9;
				background: transparent;
				text-transform: uppercase;
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
			}

			.kk-character-customizer-overlay .page-character-select__header {
				align-items: flex-start;
				padding-bottom: 0.9rem;
				border-bottom: 1px solid rgba(247, 243, 233, 0.62);
			}

			.kk-character-customizer-overlay .page-character-select__back-btn {
				border: 1px solid rgba(247, 243, 233, 0.78);
				border-radius: 0;
				background: rgba(15, 17, 21, 0.8);
				color: #f7f3e9;
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: var(--text-editorial-label, 0.625rem);
				letter-spacing: var(--tracking-widest, 0.14em);
				padding: 0.72rem 0.95rem;
				clip-path: polygon(0 0, 100% 0, 100% 88%, 95% 100%, 0 100%);
			}

			.kk-character-customizer-overlay .page-character-select__brand {
				text-align: left;
				margin: 0 auto 0 0;
			}

			.kk-character-customizer-overlay .page-character-select__eyebrow {
				color: rgba(247, 243, 233, 0.72);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				font-size: var(--text-editorial-label, 0.625rem);
				letter-spacing: var(--tracking-widest, 0.14em);
			}

			.kk-character-customizer-overlay .page-character-select__title {
				color: #d82c2c;
				font-family: var(--font-editorial-display, var(--font-display, sans-serif));
				font-size: var(--text-editorial-hero-title, clamp(2.8rem, 7vw, 5rem));
				line-height: 0.86;
				letter-spacing: -0.08em;
			}

			.kk-character-customizer-overlay .page-character-select__content {
				grid-template-columns: minmax(19rem, 30rem) 1fr;
				gap: 1.25rem;
				height: 100%;
				align-items: stretch;
			}

			.kk-character-customizer-overlay .page-character-select__panel.page-character-select__sidebar {
				background: #f7f3e9;
				color: #0f1115;
				border: 0;
				border-radius: 0;
				box-shadow: 0 28px 46px rgba(0, 0, 0, 0.24);
				backdrop-filter: none;
				clip-path: polygon(0 0, 100% 0, 100% 94%, 94% 100%, 0 100%);
			}

			.kk-character-customizer-overlay .page-character-select__panel-label,
			.kk-character-customizer-overlay .page-character-select__color-meta,
			.kk-character-customizer-overlay .page-character-select__item-meta,
			.kk-character-customizer-overlay .page-character-select__detail-label {
				color: rgba(15, 17, 21, 0.62);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
				letter-spacing: 0.12em;
			}

			.kk-character-customizer-overlay .page-character-select__panel-copy,
			.kk-character-customizer-overlay .page-character-select__category-panel-copy,
			.kk-character-customizer-overlay .page-character-select__detail-copy {
				color: rgba(15, 17, 21, 0.82);
				font-family: var(--font-editorial-mono, var(--font-mono, monospace));
			}

			.kk-character-customizer-overlay .page-character-select__category-tab,
			.kk-character-customizer-overlay .page-character-select__item-card,
			.kk-character-customizer-overlay .page-character-select__detail-card,
			.kk-character-customizer-overlay .page-character-select__color-row {
				border-radius: 0;
				border: 1px solid rgba(15, 17, 21, 0.14);
				background: rgba(15, 17, 21, 0.04);
				color: #0f1115;
			}

			.kk-character-customizer-overlay .page-character-select__category-tab--active,
			.kk-character-customizer-overlay .page-character-select__item-card--active {
				background: #0f1115;
				color: #f7f3e9;
				border-color: #0f1115;
				box-shadow: none;
			}

			.kk-character-customizer-overlay .page-character-select__item-card--active .page-character-select__item-meta {
				color: rgba(247, 243, 233, 0.68);
			}

			.kk-character-customizer-overlay .page-character-select__item-thumb {
				background:
					radial-gradient(circle at center, rgba(216, 44, 44, 0.18), rgba(216, 44, 44, 0) 60%),
					linear-gradient(180deg, rgba(15, 17, 21, 0.08), rgba(15, 17, 21, 0.02));
				border: 1px solid rgba(15, 17, 21, 0.12);
				border-radius: 0;
			}
		`;
		document.head.appendChild( style );

	}

}
