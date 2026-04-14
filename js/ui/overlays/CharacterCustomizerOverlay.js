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
					radial-gradient(circle at top, rgba(255, 122, 61, 0.2), transparent 38%),
					radial-gradient(circle at bottom right, rgba(0, 212, 232, 0.18), transparent 36%),
					rgba(4, 7, 14, 0.94);
				backdrop-filter: blur(14px);
				transition: opacity 180ms ease;
			}

			.kk-character-customizer-overlay--visible {
				opacity: 1;
			}

			.kk-character-customizer-overlay__content {
				width: 100%;
				height: 100%;
			}
		`;
		document.head.appendChild( style );

	}

}
