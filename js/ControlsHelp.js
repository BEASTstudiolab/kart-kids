/**
 * ControlsHelp — Toggle-able keyboard controls overlay.
 * Press '?' (Slash key) to show/hide.
 */

export class ControlsHelp {

	constructor() {

		this._visible = false;

		// Overlay container
		this._el = document.createElement( 'div' );
		this._el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:9999;display:none;align-items:center;justify-content:center;pointer-events:all;font-family:monospace;';

		const card = document.createElement( 'div' );
		card.style.cssText = 'background:#1a1a2e;border:2px solid #444;border-radius:12px;padding:28px 36px;max-width:420px;width:90%;color:#eee;';

		const title = document.createElement( 'h2' );
		title.textContent = 'Controls';
		title.style.cssText = 'margin:0 0 16px;font-size:20px;color:#fff;text-align:center;';
		card.appendChild( title );

		const bindings = [
			[ 'W / \u2191', 'Accelerate' ],
			[ 'S / \u2193', 'Brake / Reverse' ],
			[ 'A / \u2190', 'Steer Left' ],
			[ 'D / \u2192', 'Steer Right' ],
			[ 'Space', 'Boost' ],
			[ 'Shift', 'Drift' ],
			[ 'E', 'Use Item' ],
			[ 'C', 'Camera Mode' ],
			[ 'P', 'Pause' ],
			[ 'Backspace', 'Respawn' ],
			[ '?', 'Toggle This Help' ],
		];

		for ( const [ key, action ] of bindings ) {

			const row = document.createElement( 'div' );
			row.style.cssText = 'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #333;';

			const keyEl = document.createElement( 'span' );
			keyEl.style.cssText = 'background:#333;padding:2px 8px;border-radius:4px;font-size:13px;color:#fff;min-width:80px;text-align:center;';
			keyEl.textContent = key;

			const actionEl = document.createElement( 'span' );
			actionEl.style.cssText = 'font-size:14px;color:#ccc;';
			actionEl.textContent = action;

			row.appendChild( keyEl );
			row.appendChild( actionEl );
			card.appendChild( row );

		}

		const hint = document.createElement( 'div' );
		hint.textContent = 'Press ? to close';
		hint.style.cssText = 'text-align:center;margin-top:14px;font-size:12px;color:#888;';
		card.appendChild( hint );

		this._el.appendChild( card );
		document.body.appendChild( this._el );

		// Close on background click
		this._el.addEventListener( 'click', ( e ) => {

			if ( e.target === this._el ) this.hide();

		} );

		// Listen for '?' key
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'Slash' && e.shiftKey ) {

				this.toggle();

			}

		} );

	}

	toggle() {

		this._visible ? this.hide() : this.show();

	}

	show() {

		this._visible = true;
		this._el.style.display = 'flex';

	}

	hide() {

		this._visible = false;
		this._el.style.display = 'none';

	}

	get visible() {

		return this._visible;

	}

}
