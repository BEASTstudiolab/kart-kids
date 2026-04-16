export class SettingsMenu {

	constructor( settings, controls, audio, options = {} ) {

		this.settings = settings;
		this.controls = controls;
		this.audio = audio;
		this._open = false;
		this._mountParent = options.mountParent || document.body;
		this._styleEl = null;
		this._hamburger = null;
		this._overlay = null;
		this._panel = null;
		this._closeBtn = null;

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
			.settings-hamburger--docked {
				position: relative; top: auto; right: auto; z-index: 1;
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
			.settings-slider-wrap {
				display: flex; align-items: center; gap: 10px;
			}
			.settings-slider {
				-webkit-appearance: none; appearance: none;
				width: 120px; height: 6px; border-radius: 3px;
				background: rgba(255,255,255,0.15); outline: none;
				cursor: pointer;
			}
			.settings-slider::-webkit-slider-thumb {
				-webkit-appearance: none; width: 20px; height: 20px;
				border-radius: 50%; background: rgba(80,200,120,0.8);
			}
			.settings-slider-val {
				color: rgba(255,255,255,0.6); font-size: 13px; min-width: 28px;
				text-align: right;
			}
			.settings-color-wrap {
				display: flex; align-items: center; gap: 8px;
			}
			.settings-color-input {
				width: 40px; height: 30px; border: none; border-radius: 6px;
				cursor: pointer; background: transparent; padding: 0;
			}
			.settings-color-clear {
				padding: 4px 10px; border-radius: 6px;
				background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
				color: rgba(255,255,255,0.5); cursor: pointer; font-size: 12px;
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
		this._styleEl = css;

	}

	// ─── Hamburger Button ─────────────────────────────────────────────────────

	_createHamburger() {

		const btn = document.createElement( 'div' );
		btn.className = 'settings-hamburger';
		if ( this._mountParent !== document.body ) btn.classList.add( 'settings-hamburger--docked' );
		btn.setAttribute( 'role', 'button' );
		btn.setAttribute( 'aria-label', 'Open settings' );
		btn.setAttribute( 'aria-expanded', 'false' );
		btn.setAttribute( 'tabindex', '0' );
		btn.innerHTML = '<span></span><span></span><span></span>';
		btn.addEventListener( 'pointerup', ( e ) => {

			e.stopPropagation();
			this.toggle();

		} );
		btn.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) {

				e.preventDefault();
				this.toggle();

			}

		} );
		this._mountParent.appendChild( btn );
		this._hamburger = btn;

	}

	// ─── Overlay Panel ────────────────────────────────────────────────────────

	_createOverlay() {

		const overlay = document.createElement( 'div' );
		overlay.className = 'settings-overlay';
		overlay.setAttribute( 'role', 'dialog' );
		overlay.setAttribute( 'aria-label', 'Settings' );
		overlay.setAttribute( 'aria-modal', 'true' );
		overlay.addEventListener( 'pointerup', ( e ) => {

			if ( e.target === overlay ) this.close();

		} );
		overlay.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Escape' ) this.close();

		} );

		const panel = document.createElement( 'div' );
		panel.className = 'settings-panel';

		panel.innerHTML = '<h2>Settings</h2>';

		// ── Graphics section ──

		const gfx = this._section( 'Graphics' );

		gfx.appendChild( this._selectRow( 'Quality', 'quality', [
			{ label: 'Low', value: 'low' },
			{ label: 'Medium', value: 'medium' },
			{ label: 'High', value: 'high' },
			{ label: 'Ultra', value: 'ultra' },
		] ) );

		panel.appendChild( gfx );

		// ── Audio section ──

		const aud = this._section( 'Audio' );

		aud.appendChild( this._sliderRow( 'SFX Volume', 0, 100, 5, 100, ( v ) => {

			if ( this.audio ) this.audio.setSfxVolume( v / 100 );
			this.settings.set( 'sfxVolume', v );

		} ) );

		aud.appendChild( this._sliderRow( 'Music Volume', 0, 100, 5, 100, ( v ) => {

			if ( this.audio ) this.audio.setMusicVolume( v / 100 );
			this.settings.set( 'musicVolume', v );

		} ) );

		panel.appendChild( aud );

		// ── Controls section ──

		const ctrl = this._section( 'Controls' );

		ctrl.appendChild( this._selectRow( 'Layout', 'handedness', [
			{ label: 'Right-Hand', value: 'right' },
			{ label: 'Left-Hand', value: 'left' }
		] ) );

		ctrl.appendChild( this._toggleRow( 'Tilt Steering', 'accelerometer' ) );

		ctrl.appendChild( this._toggleRow( 'Steering Assist', 'steeringAssist' ) );

		panel.appendChild( ctrl );

		// ── HUD section ──

		const hudSec = this._section( 'HUD' );

		hudSec.appendChild( this._selectRow( 'Speed Unit', 'speedUnit', [
			{ label: 'km/h', value: 'kmh' },
			{ label: 'mph', value: 'mph' }
		] ) );

		panel.appendChild( hudSec );

		// ── Customization section ──

		const custom = this._section( 'Customization' );
		custom.appendChild( this._colorRow( 'Vehicle Color', 'vehicleColor' ) );
		custom.appendChild( this._colorRow( 'Character Color', 'characterColor' ) );
		panel.appendChild( custom );

		// ── AI Race section ──

		const ai = this._section( 'Race' );

		ai.appendChild( this._sliderRow( 'AI Racers', 0, 8, 1, 0, ( v ) => {

			this.settings.set( 'aiCount', v );

		} ) );

		ai.appendChild( this._sliderRow( 'Difficulty', 0, 100, 5, 50, ( v ) => {

			this.settings.set( 'difficulty', v );

		} ) );

		panel.appendChild( ai );

		// ── Close button ──

		const closeBtn = document.createElement( 'button' );
		closeBtn.className = 'settings-close';
		closeBtn.textContent = 'Close';
		closeBtn.addEventListener( 'pointerup', () => this.close() );
		panel.appendChild( closeBtn );

		overlay.appendChild( panel );
		document.body.appendChild( overlay );
		this._overlay = overlay;
		this._panel = panel;
		this._closeBtn = closeBtn;

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

	_toggleRowCustom( label, initialValue, onChange ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const lbl = document.createElement( 'span' );
		lbl.className = 'settings-label';
		lbl.textContent = label;

		const toggle = document.createElement( 'div' );
		toggle.className = 'settings-toggle' + ( initialValue ? ' on' : '' );
		toggle.setAttribute( 'role', 'switch' );
		toggle.setAttribute( 'aria-checked', String( !! initialValue ) );
		toggle.setAttribute( 'aria-label', label );
		toggle.setAttribute( 'tabindex', '0' );
		const activate = () => {

			const newVal = ! toggle.classList.contains( 'on' );
			toggle.classList.toggle( 'on', newVal );
			toggle.setAttribute( 'aria-checked', String( newVal ) );
			onChange( newVal );

		};
		toggle.addEventListener( 'pointerup', activate );
		toggle.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); activate(); }

		} );

		row.appendChild( lbl );
		row.appendChild( toggle );
		return row;

	}

	_toggleRow( label, key ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const lbl = document.createElement( 'span' );
		lbl.className = 'settings-label';
		lbl.textContent = label;

		const toggle = document.createElement( 'div' );
		toggle.className = 'settings-toggle' + ( this.settings.get( key ) ? ' on' : '' );
		toggle.setAttribute( 'role', 'switch' );
		toggle.setAttribute( 'aria-checked', String( !! this.settings.get( key ) ) );
		toggle.setAttribute( 'aria-label', label );
		toggle.setAttribute( 'tabindex', '0' );
		const activate = () => {

			const newVal = ! this.settings.get( key );
			this.settings.set( key, newVal );
			toggle.classList.toggle( 'on', newVal );
			toggle.setAttribute( 'aria-checked', String( newVal ) );

		};
		toggle.addEventListener( 'pointerup', activate );
		toggle.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); activate(); }

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
		group.setAttribute( 'role', 'radiogroup' );
		group.setAttribute( 'aria-label', label );

		const buttons = [];

		for ( const opt of options ) {

			const btn = document.createElement( 'div' );
			btn.className = 'settings-select-btn' + ( this.settings.get( key ) === opt.value ? ' active' : '' );
			btn.textContent = opt.label;
			btn.setAttribute( 'role', 'radio' );
			btn.setAttribute( 'aria-checked', String( this.settings.get( key ) === opt.value ) );
			btn.setAttribute( 'tabindex', '0' );
			const activate = () => {

				this.settings.set( key, opt.value );
				for ( const b of buttons ) {

					b.classList.remove( 'active' );
					b.setAttribute( 'aria-checked', 'false' );

				}
				btn.classList.add( 'active' );
				btn.setAttribute( 'aria-checked', 'true' );

			};
			btn.addEventListener( 'pointerup', activate );
			btn.addEventListener( 'keydown', ( e ) => {

				if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); activate(); }

			} );
			buttons.push( btn );
			group.appendChild( btn );

		}

		row.appendChild( lbl );
		row.appendChild( group );
		return row;

	}

	_sliderRow( label, min, max, step, initial, onChange ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const lbl = document.createElement( 'span' );
		lbl.className = 'settings-label';
		lbl.textContent = label;

		const wrap = document.createElement( 'div' );
		wrap.className = 'settings-slider-wrap';

		const slider = document.createElement( 'input' );
		slider.type = 'range';
		slider.className = 'settings-slider';
		slider.min = min;
		slider.max = max;
		slider.step = step;
		slider.value = initial;
		slider.setAttribute( 'aria-label', label );

		const val = document.createElement( 'span' );
		val.className = 'settings-slider-val';
		val.textContent = initial;

		slider.addEventListener( 'input', () => {

			val.textContent = slider.value;
			onChange( Number( slider.value ) );

		} );

		wrap.appendChild( slider );
		wrap.appendChild( val );
		row.appendChild( lbl );
		row.appendChild( wrap );
		return row;

	}

	_colorRow( label, key ) {

		const row = document.createElement( 'div' );
		row.className = 'settings-row';

		const lbl = document.createElement( 'span' );
		lbl.className = 'settings-label';
		lbl.textContent = label;

		const wrap = document.createElement( 'div' );
		wrap.className = 'settings-color-wrap';

		const input = document.createElement( 'input' );
		input.type = 'color';
		input.className = 'settings-color-input';
		input.value = this.settings.get( key ) || '#ffffff';
		input.setAttribute( 'aria-label', label );

		const clearBtn = document.createElement( 'button' );
		clearBtn.className = 'settings-color-clear';
		clearBtn.textContent = 'Reset';
		clearBtn.setAttribute( 'aria-label', 'Reset ' + label );

		input.addEventListener( 'input', () => {

			this.settings.set( key, input.value );

		} );

		clearBtn.addEventListener( 'pointerup', () => {

			this.settings.set( key, '' );
			input.value = '#ffffff';

		} );

		wrap.appendChild( input );
		wrap.appendChild( clearBtn );
		row.appendChild( lbl );
		row.appendChild( wrap );
		return row;

	}

	// ─── Public: insert a section before the close button ────────────────────

	addSection( sectionEl ) {

		this._panel.insertBefore( sectionEl, this._closeBtn );

	}

	// ─── Open / Close ─────────────────────────────────────────────────────────

	toggle() {

		this._open ? this.close() : this.open();

	}

	open() {

		if ( ! this._overlay || ! this._hamburger ) return;
		this._open = true;
		this._overlay.classList.add( 'open' );
		this._hamburger.setAttribute( 'aria-expanded', 'true' );

	}

	close() {

		if ( ! this._overlay || ! this._hamburger ) return;
		this._open = false;
		this._overlay.classList.remove( 'open' );
		this._hamburger.setAttribute( 'aria-expanded', 'false' );

	}

	dispose() {

		this.close();
		this._hamburger?.remove();
		this._overlay?.remove();
		this._styleEl?.remove();
		this._hamburger = null;
		this._overlay = null;
		this._panel = null;
		this._closeBtn = null;
		this._styleEl = null;

	}

	get isOpen() {

		return this._open;

	}

}
