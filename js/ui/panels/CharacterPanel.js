import { Page10CharacterSelectController } from '../pages/page10-character-select/Page10CharacterSelectController.js';

export class CharacterPanel {

	static _cssInjected = false;

	constructor( container, services ) {

		this._container = container;
		this._services = services;
		this._root = null;
		this._controller = null;
		this._initPromise = null;
		this._isVisible = false;

		this._injectCSS();
		this._build();
		this._container.appendChild( this._root );

	}

	_injectCSS() {

		if ( CharacterPanel._cssInjected ) return;
		CharacterPanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-character-panel {
				width: 100%;
				height: 100%;
			}
		`;
		document.head.appendChild( style );

	}

	_build() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-character-panel';

	}

	async _ensureInitialized() {

		if ( this._controller ) return this._controller;
		if ( this._initPromise ) return this._initPromise;

		this._initPromise = ( async () => {

			const controller = new Page10CharacterSelectController( {
				hostMode: 'tab',
				openCategoryId: 'palette',
				trackPageView: false,
			}, this._services );
			controller.initialize( {
				hostMode: 'tab',
				openCategoryId: 'palette',
				trackPageView: false,
			} );
			controller.bindEvents();
			await controller.loadData();
			controller.render( this._root );
			controller.setActive( this._isVisible );
			this._controller = controller;
			return controller;

		} )().catch( ( error ) => {

			this._initPromise = null;
			throw error;

		} );

		return this._initPromise;

	}

	show() {

		this._isVisible = true;
		this._ensureInitialized()
			.then( ( controller ) => controller.setActive( this._isVisible ) )
			.catch( ( error ) => {

				console.warn( '[CharacterPanel] Failed to initialize character tab:', error );
				this._services.notification?.show( {
					message: 'Failed to open Character tab',
					variant: 'error',
					duration: 2200,
				} );

			} );

	}

	hide() {

		this._isVisible = false;
		this._controller?.setActive( false );

	}

	dispose() {

		this._controller?.dispose();
		this._controller = null;
		this._initPromise = null;
		this._isVisible = false;

		if ( this._root?.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._root = null;

	}

}
