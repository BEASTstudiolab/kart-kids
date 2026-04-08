// ─── RadialMenu ──────────────────────────────────────────────────────────────
// Circular context menu that appears on right-click over a tile.
// Actions: Rotate, Elevate+, Elevate-, Replace, Duplicate, Delete.

export class RadialMenu {

	/**
	 * @param {import('../core/EventBus.js').EventBus} eventBus
	 */
	constructor( eventBus ) {

		this._eventBus = eventBus;
		this._el = null;
		this._visible = false;
		this._tileGx = 0;
		this._tileGz = 0;

		this._actions = [
			{ id: 'rotate',    label: 'Rotate',    icon: '↻', angle: 0 },
			{ id: 'elevate-up', label: 'Raise',    icon: '↑', angle: 60 },
			{ id: 'elevate-down', label: 'Lower',  icon: '↓', angle: 120 },
			{ id: 'duplicate', label: 'Duplicate',  icon: '⊕', angle: 180 },
			{ id: 'replace',   label: 'Replace',    icon: '⇄', angle: 240 },
			{ id: 'delete',    label: 'Delete',     icon: '✕', angle: 300 },
		];

		this._build();

	}

	/**
	 * Show the radial menu at screen position.
	 * @param {number} clientX
	 * @param {number} clientY
	 * @param {number} gx
	 * @param {number} gz
	 */
	show( clientX, clientY, gx, gz ) {

		this._tileGx = gx;
		this._tileGz = gz;

		this._el.style.left = clientX + 'px';
		this._el.style.top = clientY + 'px';
		this._el.classList.add( 'active' );
		this._visible = true;

		// Animate buttons in
		const btns = this._el.querySelectorAll( '.kk-radial-menu__btn' );
		btns.forEach( ( btn, i ) => {

			btn.style.transitionDelay = ( i * 30 ) + 'ms';

		} );

	}

	/** Hide the radial menu. */
	hide() {

		this._el.classList.remove( 'active' );
		this._visible = false;

	}

	/** @returns {boolean} */
	get visible() { return this._visible; }

	/** @private */
	_build() {

		this._el = document.createElement( 'div' );
		this._el.className = 'kk-radial-menu';

		const radius = 50;

		for ( const action of this._actions ) {

			const btn = document.createElement( 'button' );
			btn.className = 'kk-radial-menu__btn';
			btn.title = action.label;

			const rad = ( action.angle - 90 ) * Math.PI / 180;
			const x = Math.cos( rad ) * radius;
			const y = Math.sin( rad ) * radius;

			btn.style.left = x + 'px';
			btn.style.top = y + 'px';
			btn.textContent = action.icon;

			btn.addEventListener( 'click', ( e ) => {

				e.stopPropagation();
				this._eventBus.emit( 'radial-menu:action', {
					action: action.id,
					gx: this._tileGx,
					gz: this._tileGz,
				} );
				this.hide();

			} );

			this._el.appendChild( btn );

		}

		document.body.appendChild( this._el );

		// Close on click outside
		document.addEventListener( 'pointerdown', ( e ) => {

			if ( this._visible && ! this._el.contains( e.target ) ) {

				this.hide();

			}

		} );

		// Close on Escape
		document.addEventListener( 'keydown', ( e ) => {

			if ( this._visible && e.code === 'Escape' ) this.hide();

		} );

	}

}
