import { ensureEditorialRuntimeTheme } from './ui/components/EditorialRuntimeTheme.js';

export class DebugMenu {

	static _cssInjected = false;

	constructor( mountRoot = document.body ) {

		this._mountRoot = mountRoot || document.body;
		this.tabs = {};
		this.activeTab = null;

		ensureEditorialRuntimeTheme();
		this._injectCSS();

		this.panel = document.createElement( 'div' );
		this.panel.className = 'kk-debug-menu kk-rt-card kk-rt-card--outline';
		this.panel.style.display = 'none';
		this.panel.addEventListener( 'keydown', ( e ) => e.stopPropagation() );
		this.panel.addEventListener( 'keyup', ( e ) => e.stopPropagation() );

		const titleBar = document.createElement( 'div' );
		titleBar.className = 'kk-debug-menu__titlebar kk-rt-header';

		const title = document.createElement( 'span' );
		title.textContent = 'Developer Console';

		const closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.className = 'kk-debug-menu__close';
		closeBtn.textContent = 'Close';
		closeBtn.addEventListener( 'click', () => this.hide() );

		titleBar.appendChild( title );
		titleBar.appendChild( closeBtn );
		this.panel.appendChild( titleBar );

		this.tabBar = document.createElement( 'div' );
		this.tabBar.className = 'kk-debug-menu__tabs';
		this.panel.appendChild( this.tabBar );

		this._mountRoot.appendChild( this.panel );

	}

	_injectCSS() {

		if ( DebugMenu._cssInjected ) return;
		DebugMenu._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-debug-menu {
				position: fixed;
				top: 12px;
				left: 12px;
				bottom: 12px;
				width: min(420px, calc(100vw - 24px));
				z-index: 210;
				overflow: auto;
				pointer-events: auto;
				user-select: none;
			}

			.kk-debug-menu__titlebar {
				margin-bottom: 0.6rem;
			}

			.kk-debug-menu__close,
			.kk-debug-menu__tab,
			.kk-debug-menu__button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 0.45rem 0.7rem;
				border: 1px solid rgba(247,243,233,0.48);
				background: rgba(15,17,21,0.84);
				color: var(--kk-rt-cream);
				font-family: var(--kk-rt-font-mono);
				font-size: 0.56rem;
				font-weight: 700;
				letter-spacing: 0.16em;
				text-transform: uppercase;
				cursor: pointer;
			}

			.kk-debug-menu__close:hover,
			.kk-debug-menu__tab:hover,
			.kk-debug-menu__button:hover {
				background: rgba(216,44,44,0.22);
				border-color: rgba(247,243,233,0.92);
			}

			.kk-debug-menu__tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 0.45rem;
				margin-bottom: 0.8rem;
			}

			.kk-debug-menu__tab--active {
				background: rgba(247,243,233,0.96);
				color: var(--kk-rt-ink);
				border-color: rgba(247,243,233,0.96);
			}

			.kk-debug-menu__content {
				display: none;
				gap: 0.7rem;
			}

			.kk-debug-menu__content--active {
				display: grid;
			}

			.kk-debug-menu__header {
				font-family: var(--kk-rt-font-display);
				font-size: 0.96rem;
				font-weight: 900;
				letter-spacing: -0.02em;
				text-transform: uppercase;
				margin-top: 0.25rem;
			}

			.kk-debug-menu__row {
				display: flex;
				align-items: center;
				gap: 0.7rem;
			}

			.kk-debug-menu__row span {
				font-family: var(--kk-rt-font-mono);
				font-size: 0.58rem;
				letter-spacing: 0.12em;
				text-transform: uppercase;
			}

			.kk-debug-menu__row input[type='checkbox'] {
				accent-color: #d82c2c;
			}

			.kk-debug-menu__row input[type='range'] {
				flex: 1;
				accent-color: #d82c2c;
			}

			.kk-debug-menu__value {
				width: 58px;
				text-align: right;
				border: 1px solid rgba(247,243,233,0.28);
				background: rgba(0,0,0,0.22);
				color: var(--kk-rt-cream);
				font-family: var(--kk-rt-font-mono);
				font-size: 0.62rem;
				padding: 0.25rem 0.35rem;
			}

			.kk-debug-menu__select,
			.kk-debug-menu__color {
				border: 1px solid rgba(247,243,233,0.32);
				background: rgba(15,17,21,0.9);
				color: var(--kk-rt-cream);
				font-family: var(--kk-rt-font-mono);
				font-size: 0.6rem;
				padding: 0.4rem 0.5rem;
			}
		`;
		document.head.appendChild( style );

	}

	addTab( id, label ) {

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'kk-debug-menu__tab';
		button.textContent = label;

		const content = document.createElement( 'div' );
		content.className = 'kk-debug-menu__content';

		button.addEventListener( 'click', () => {

			for ( const tab of Object.values( this.tabs ) ) {

				tab.content.classList.remove( 'kk-debug-menu__content--active' );
				tab.button.classList.remove( 'kk-debug-menu__tab--active' );

			}

			content.classList.add( 'kk-debug-menu__content--active' );
			button.classList.add( 'kk-debug-menu__tab--active' );
			this.activeTab = id;

		} );

		this.tabBar.appendChild( button );
		this.panel.appendChild( content );
		this.tabs[ id ] = { button, content };

		if ( Object.keys( this.tabs ).length === 1 ) {

			content.classList.add( 'kk-debug-menu__content--active' );
			button.classList.add( 'kk-debug-menu__tab--active' );
			this.activeTab = id;

		}

		return content;

	}

	addHeader( parent, text ) {

		const div = document.createElement( 'div' );
		div.className = 'kk-debug-menu__header';
		div.textContent = text;
		parent.appendChild( div );

	}

	addCheckbox( parent, label, defaultVal, onChange ) {

		const row = document.createElement( 'label' );
		row.className = 'kk-debug-menu__row';

		const input = document.createElement( 'input' );
		input.type = 'checkbox';
		input.checked = defaultVal;

		const span = document.createElement( 'span' );
		span.textContent = label;

		input.addEventListener( 'change', () => onChange( input.checked ) );

		row.appendChild( input );
		row.appendChild( span );
		parent.appendChild( row );
		return input;

	}

	addSlider( parent, label, min, max, step, defaultVal, onChange ) {

		const decimals = Math.max( 0, Math.ceil( -Math.log10( step ) ) );
		const row = document.createElement( 'div' );
		row.className = 'kk-debug-menu__row';

		const labelSpan = document.createElement( 'span' );
		labelSpan.textContent = label;
		labelSpan.style.minWidth = '108px';

		const slider = document.createElement( 'input' );
		slider.type = 'range';
		slider.min = min;
		slider.max = max;
		slider.step = step;
		slider.value = defaultVal;

		const valueInput = document.createElement( 'input' );
		valueInput.type = 'text';
		valueInput.className = 'kk-debug-menu__value';
		valueInput.value = defaultVal.toFixed( decimals );

		slider.addEventListener( 'input', () => {

			const val = parseFloat( slider.value );
			valueInput.value = val.toFixed( decimals );
			onChange( val );

		} );

		valueInput.addEventListener( 'change', () => {

			let val = parseFloat( valueInput.value );
			if ( Number.isNaN( val ) ) val = defaultVal;
			val = Math.min( max, Math.max( min, val ) );
			slider.value = val;
			valueInput.value = val.toFixed( decimals );
			onChange( val );

		} );

		row.appendChild( labelSpan );
		row.appendChild( slider );
		row.appendChild( valueInput );
		parent.appendChild( row );
		return { slider, valueInput };

	}

	addColorPicker( parent, label, defaultHex, onChange ) {

		const row = document.createElement( 'div' );
		row.className = 'kk-debug-menu__row';

		const labelSpan = document.createElement( 'span' );
		labelSpan.textContent = label;
		labelSpan.style.minWidth = '108px';

		const input = document.createElement( 'input' );
		input.type = 'color';
		input.className = 'kk-debug-menu__color';
		input.value = '#' + defaultHex.toString( 16 ).padStart( 6, '0' );
		input.addEventListener( 'input', () => onChange( parseInt( input.value.slice( 1 ), 16 ) ) );

		row.appendChild( labelSpan );
		row.appendChild( input );
		parent.appendChild( row );
		return input;

	}

	addButton( parent, label, onClick ) {

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'kk-debug-menu__button';
		button.textContent = label;
		button.addEventListener( 'click', onClick );
		parent.appendChild( button );
		return button;

	}

	show() {

		this.panel.style.display = 'flex';

	}

	hide() {

		this.panel.style.display = 'none';

	}

	toggle() {

		this.visible ? this.hide() : this.show();

	}

	dispose() {

		this.panel.remove();

	}

	get visible() {

		return this.panel.style.display !== 'none';

	}

}
