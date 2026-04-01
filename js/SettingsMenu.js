export class SettingsMenu {

	constructor( settings, controls ) {

		this.settings = settings;
		this.controls = controls;
		this._open = false;

		this._injectCSS();
		this._createHamburger();
		this._createOverlay();

	}

	// ─── CSS ──────────────────────────────────────────────────────────────────

	_injectCSS() {

		const css = document.createElement( 'style' );
		css.textContent = `
			.settings-hamburger {
				position: fixed; top: 16px; right: 16px; z-index: 100;
				width: 44px; height: 44px; border-radius: 10px;
				background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2);
				cursor: pointer; display: flex; flex-direction: column;
				align-items: center; justify-content: center; gap: 5px;
				-webkit-tap-highlight-color: transparent; touch-action: manipulation;
			}
			.settings-hamburger span {
				display: block; width: 22px; height: 2px;
				background: rgba(255,255,255,0.7); border-radius: 1px;
			}
			.settings-overlay {
				position: fixed; inset: 0; z-index: 200;
				background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
				display: none; align-items: center; justify-content: center;
				touch-action: none;
			}
			.settings-overlay.open { display: flex; }
			.settings-panel {
				background: rgba(20,20,30,0.95); border: 1px solid rgba(255,255,255,0.15);
				border-radius: 16px; padding: 28px 32px; min-width: 300px; max-width: 90vw;
				max-height: 80vh; overflow-y: auto; color: #eee;
				font-family: sans-serif; font-size: 14px;
			}
			.settings-panel h2 {
				margin: 0 0 20px; font-size: 18px; font-weight: 600;
				color: #fff; text-align: center;
			}
			.settings-section { margin-bottom: 20px; }
			.settings-section h3 {
				margin: 0 0 12px; font-size: 13px; font-weight: 600;
				text-transform: uppercase; letter-spacing: 1px;
				color: rgba(255,255,255,0.5);
			}
			.settings-row {
				display: flex; align-items: center; justify-content: space-between;
				padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.07);
			}
			.settings-row:last-child { border-bottom: none; }
			.settings-label { color: rgba(255,255,255,0.8); }
			.settings-toggle {
				position: relative; width: 48px; height: 26px;
				background: rgba(255,255,255,0.15); border-radius: 13px;
				cursor: pointer; transition: background 0.2s;
				-webkit-tap-highlight-color: transparent;
			}
			.settings-toggle.on { background: rgba(80,200,120,0.6); }
			.settings-toggle::after {
				content: ''; position: absolute; top: 3px; left: 3px;
				width: 20px; height: 20px; border-radius: 50%;
				background: #fff; transition: transform 0.2s;
			}
			.settings-toggle.on::after { transform: translateX(22px); }
			.settings-select {
				display: flex; gap: 4px;
			}
			.settings-select-btn {
				padding: 6px 14px; border-radius: 8px;
				background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
				color: rgba(255,255,255,0.6); cursor: pointer; font-size: 13px;
				transition: all 0.15s; -webkit-tap-highlight-color: transparent;
			}
			.settings-select-btn.active {
				background: rgba(80,200,120,0.3); border-color: rgba(80,200,120,0.6);
				color: #fff;
			}
			.settings-close {
				display: block; margin: 20px auto 0; padding: 10px 32px;
				border-radius: 10px; background: rgba(255,255,255,0.1);
				border: 1px solid rgba(255,255,255,0.2); color: #fff;
				font-size: 14px; cursor: pointer;
				-webkit-tap-highlight-color: transparent;
			}
		`;
		document.head.appendChild( css );

	}

	// ─── Hamburger Button ─────────────────────────────────────────────────────

	_createHamburger() {

		const btn = document.createElement( 'div' );
		btn.className = 'settings-hamburger';
		btn.innerHTML = '<span></span><span></span><span></span>';
		btn.addEventListener( 'pointerup', ( e ) => {

			e.stopPropagation();
			this.toggle();

		} );
		document.body.appendChild( btn );

	}

	// ─── Overlay Panel ────────────────────────────────────────────────────────

	_createOverlay() {

		const overlay = document.createElement( 'div' );
		overlay.className = 'settings-overlay';
		overlay.addEventListener( 'pointerup', ( e ) => {

			if ( e.target === overlay ) this.close();

		} );

		const panel = document.createElement( 'div' );
		panel.className = 'settings-panel';

		panel.innerHTML = '<h2>Settings</h2>';

		// ── Graphics section ──

		const gfx = this._section( 'Graphics' );

		gfx.appendChild( this._selectRow( 'Shadows', 'shadowQuality', [
			{ label: 'Low', value: 'low' },
			{ label: 'High', value: 'high' }
		] ) );

		gfx.appendChild( this._toggleRow( 'Post-Processing', 'postProcessing' ) );

		panel.appendChild( gfx );

		// ── Controls section ──

		const ctrl = this._section( 'Controls' );

		ctrl.appendChild( this._selectRow( 'Layout', 'handedness', [
			{ label: 'Right-Hand', value: 'right' },
			{ label: 'Left-Hand', value: 'left' }
		] ) );

		ctrl.appendChild( this._toggleRow( 'Tilt Steering', 'accelerometer' ) );

		panel.appendChild( ctrl );

		// ── Close button ──

		const closeBtn = document.createElement( 'button' );
		closeBtn.className = 'settings-close';
		closeBtn.textContent = 'Close';
		closeBtn.addEventListener( 'pointerup', () => this.close() );
		panel.appendChild( closeBtn );

		overlay.appendChild( panel );
		document.body.appendChild( overlay );
		this._overlay = overlay;

	}

	// ─── Widget helpers ───────────────────────────────────────────────────────

	_section( title ) {

		const sec = document.createElement( 'div' );
		sec.className = 'settings-section';
		const h3 = document.createElement( 'h3' );
		h3.textContent = title;
		sec.appendChild( h3 );
		return sec;

	}

	_toggleRow( label, key ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const lbl = document.createElement( 'span' );
		lbl.className = 'settings-label';
		lbl.textContent = label;

		const toggle = document.createElement( 'div' );
		toggle.className = 'settings-toggle' + ( this.settings.get( key ) ? ' on' : '' );
		toggle.addEventListener( 'pointerup', () => {

			const newVal = ! this.settings.get( key );
			this.settings.set( key, newVal );
			toggle.classList.toggle( 'on', newVal );

		} );

		row.appendChild( lbl );
		row.appendChild( toggle );
		return row;

	}

	_selectRow( label, key, options ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const lbl = document.createElement( 'span' );
		lbl.className = 'settings-label';
		lbl.textContent = label;

		const group = document.createElement( 'div' );
		group.className = 'settings-select';

		const buttons = [];

		for ( const opt of options ) {

			const btn = document.createElement( 'div' );
			btn.className = 'settings-select-btn' + ( this.settings.get( key ) === opt.value ? ' active' : '' );
			btn.textContent = opt.label;
			btn.addEventListener( 'pointerup', () => {

				this.settings.set( key, opt.value );
				for ( const b of buttons ) b.classList.remove( 'active' );
				btn.classList.add( 'active' );

			} );
			buttons.push( btn );
			group.appendChild( btn );

		}

		row.appendChild( lbl );
		row.appendChild( group );
		return row;

	}

	// ─── Open / Close ─────────────────────────────────────────────────────────

	toggle() {

		this._open ? this.close() : this.open();

	}

	open() {

		this._open = true;
		this._overlay.classList.add( 'open' );

	}

	close() {

		this._open = false;
		this._overlay.classList.remove( 'open' );

	}

	get isOpen() {

		return this._open;

	}

}
