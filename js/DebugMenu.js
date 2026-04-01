export class DebugMenu {

	constructor() {

		// ── Panel container ───────────────────────────────────────────────────
		this.panel = document.createElement( 'div' );
		this.panel.style.cssText = [
			'position:fixed', 'top:12px', 'left:12px', 'bottom:12px',
			'background:rgba(0,0,0,0.72)', 'color:#0f0',
			'font:13px/1.6 monospace',
			'padding:10px 14px', 'border-radius:6px',
			'min-width:280px', 'z-index:999',
			'user-select:none', 'overflow-y:auto', 'pointer-events:auto',
			'display:none',
		].join( ';' );

		// Prevent game input from firing while interacting with the panel
		this.panel.addEventListener( 'keydown', ( e ) => e.stopPropagation() );
		this.panel.addEventListener( 'keyup', ( e ) => e.stopPropagation() );

		// ── Title ─────────────────────────────────────────────────────────────
		const title = document.createElement( 'div' );
		title.textContent = 'DEBUG CONTROLS';
		title.style.cssText = 'font-weight:bold; margin-bottom:6px';
		this.panel.appendChild( title );

		// ── Tab bar ───────────────────────────────────────────────────────────
		this.tabBar = document.createElement( 'div' );
		this.tabBar.style.cssText = [
			'display:flex', 'gap:4px', 'margin-bottom:8px',
			'border-bottom:1px solid #0f044', 'padding-bottom:6px',
		].join( ';' );
		this.panel.appendChild( this.tabBar );

		this.tabs = {};
		this.activeTab = null;

		document.body.appendChild( this.panel );

	}

	// ── Tab management ────────────────────────────────────────────────────────

	addTab( id, label ) {

		const button = document.createElement( 'button' );
		button.textContent = label;
		button.style.cssText = [
			'background:transparent', 'color:#0f0',
			'border:1px solid #0f044', 'padding:4px 10px',
			'cursor:pointer', 'font:12px monospace', 'border-radius:3px',
		].join( ';' );

		const content = document.createElement( 'div' );
		content.style.display = 'none';

		button.addEventListener( 'click', () => {

			// Hide all tab contents and deactivate all buttons
			for ( const tab of Object.values( this.tabs ) ) {
				tab.content.style.display = 'none';
				tab.button.style.background = 'transparent';
				tab.button.style.borderColor = '#0f044';
			}

			// Activate this tab
			content.style.display = 'block';
			button.style.background = '#0f03';
			button.style.borderColor = '#0f0';
			this.activeTab = id;

		} );

		this.tabBar.appendChild( button );
		this.panel.appendChild( content );
		this.tabs[ id ] = { button, content };

		// Make the first tab active immediately
		if ( Object.keys( this.tabs ).length === 1 ) {
			content.style.display = 'block';
			button.style.background = '#0f03';
			button.style.borderColor = '#0f0';
			this.activeTab = id;
		}

		return content;

	}

	// ── Widget helpers ────────────────────────────────────────────────────────

	addHeader( parent, text ) {

		const div = document.createElement( 'div' );
		div.textContent = text + ':';
		div.style.cssText = 'margin:8px 0 2px';
		parent.appendChild( div );

	}

	addCheckbox( parent, label, defaultVal, onChange ) {

		const row = document.createElement( 'div' );
		row.style.cssText = 'margin:4px 0; display:flex; align-items:center; gap:6px';

		const input = document.createElement( 'input' );
		input.type = 'checkbox';
		input.checked = defaultVal;
		input.style.accentColor = '#0f0';

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
		row.style.cssText = 'display:flex; gap:6px; align-items:center';

		const labelSpan = document.createElement( 'span' );
		labelSpan.textContent = label;
		labelSpan.style.minWidth = '100px';

		const slider = document.createElement( 'input' );
		slider.type = 'range';
		slider.min = min;
		slider.max = max;
		slider.step = step;
		slider.value = defaultVal;
		slider.style.cssText = 'accent-color:#0f0; flex:1';

		const valueInput = document.createElement( 'input' );
		valueInput.type = 'text';
		valueInput.value = defaultVal.toFixed( decimals );
		valueInput.style.cssText = [
			'width:55px', 'text-align:right',
			'background:transparent', 'color:#0f0',
			'border:1px solid #0f044', 'font:12px monospace', 'padding:1px 3px',
		].join( ';' );

		slider.addEventListener( 'input', () => {
			const val = parseFloat( slider.value );
			valueInput.value = val.toFixed( decimals );
			onChange( val );
		} );

		valueInput.addEventListener( 'change', () => {
			let val = parseFloat( valueInput.value );
			if ( isNaN( val ) ) val = defaultVal;
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
		row.style.cssText = 'display:flex; gap:6px; align-items:center';

		const labelSpan = document.createElement( 'span' );
		labelSpan.textContent = label;
		labelSpan.style.minWidth = '100px';

		const input = document.createElement( 'input' );
		input.type = 'color';
		input.value = '#' + defaultHex.toString( 16 ).padStart( 6, '0' );
		input.style.cssText = 'width:40px; height:24px; border:none; background:none; cursor:pointer';

		input.addEventListener( 'input', () => {
			onChange( parseInt( input.value.slice( 1 ), 16 ) );
		} );

		row.appendChild( labelSpan );
		row.appendChild( input );
		parent.appendChild( row );

		return input;

	}

	addButton( parent, label, onClick ) {

		const button = document.createElement( 'button' );
		button.textContent = label;
		button.style.cssText = [
			'background:transparent', 'color:#0f0',
			'border:1px solid #0f0', 'padding:4px 10px',
			'cursor:pointer', 'font:12px monospace',
			'border-radius:3px', 'margin:4px 0',
		].join( ';' );

		button.addEventListener( 'mouseover', () => { button.style.background = '#0f02'; } );
		button.addEventListener( 'mouseout', () => { button.style.background = 'transparent'; } );
		button.addEventListener( 'click', onClick );

		parent.appendChild( button );

	}

	// ── Visibility ────────────────────────────────────────────────────────────

	show() {

		this.panel.style.display = 'block';

	}

	hide() {

		this.panel.style.display = 'none';

	}

	toggle() {

		this.visible ? this.hide() : this.show();

	}

	get visible() {

		return this.panel.style.display !== 'none';

	}

}
