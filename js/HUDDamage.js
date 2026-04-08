/**
 * HUDDamage — DOM-based quadrant damage display, global HP bar, item slot, and elimination warning.
 *
 * Layout (bottom-left):
 *   ┌────┐  ┌────────────┐
 *   │ FL │  │            │
 *   │ FR │  │  ITEM BOX  │
 *   │ RL │  │            │
 *   │ RR │  └────────────┘
 *   └────┘
 *   ┌═══════════════════════┐
 *   │      LIFE BAR         │
 *   └═══════════════════════┘
 */

import { DAMAGE_STATE } from './vehicle/VehicleHealth.js';

const STATE_COLORS = {
	[ DAMAGE_STATE.GREEN ]: '#44cc44',
	[ DAMAGE_STATE.YELLOW ]: '#cccc00',
	[ DAMAGE_STATE.ORANGE ]: '#ff8800',
	[ DAMAGE_STATE.RED ]: '#ff2222',
	[ DAMAGE_STATE.BROKEN ]: '#333333',
};

const ITEM_ICONS = {
	boxing_glove: '🥊',
	bubble_shield: '🛡️',
	slime_slick: '💚',
	magnet_pulse: '🧲',
	spring_mine: '🪤',
	wand_zap: '⚡',
	hammer_smash: '🔨',
	turbo_star: '⭐',
	confetti_bomb: '🎉',
	repair_crate: '🔧',
};

export class HUDDamage {

	constructor() {

		// Main container — vertical stack (all elements scaled ~30% larger)
		this._root = document.createElement( 'div' );
		this._root.style.cssText = 'position:fixed;bottom:20px;left:20px;display:flex;flex-direction:column;gap:8px;z-index:100;pointer-events:none;font-family:monospace;';
		document.body.appendChild( this._root );

		// Top row: 2x2 damage grid (portrait cells) + item box
		const topRow = document.createElement( 'div' );
		topRow.style.cssText = 'display:flex;align-items:stretch;gap:10px;';
		this._root.appendChild( topRow );

		// Quadrant grid — 2x2 with portrait (tall) cells
		this._quadrantBox = document.createElement( 'div' );
		this._quadrantBox.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;flex:1;';
		topRow.appendChild( this._quadrantBox );

		this._quadrants = [];
		const labels = [ 'FL', 'FR', 'RL', 'RR' ];
		for ( let i = 0; i < 4; i ++ ) {

			const cell = document.createElement( 'div' );
			cell.style.cssText = 'border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:bold;text-shadow:0 0 3px #000;transition:background-color 0.2s;min-height:62px;min-width:52px;';
			cell.style.backgroundColor = STATE_COLORS[ DAMAGE_STATE.GREEN ];
			cell.textContent = labels[ i ];
			this._quadrantBox.appendChild( cell );
			this._quadrants.push( cell );

		}

		// Item slot — large, next to quadrants
		this._itemSlot = document.createElement( 'div' );
		this._itemSlot.style.cssText = 'width:130px;height:130px;background:#222;border-radius:10px;border:3px solid #555;display:flex;align-items:center;justify-content:center;font-size:60px;flex-shrink:0;';
		topRow.appendChild( this._itemSlot );

		// Bottom: HP bar spanning full width below both
		const hpContainer = document.createElement( 'div' );
		hpContainer.style.cssText = 'width:100%;height:18px;background:#222;border-radius:5px;overflow:hidden;border:1px solid #555;';
		this._root.appendChild( hpContainer );

		this._hpBar = document.createElement( 'div' );
		this._hpBar.style.cssText = 'width:100%;height:100%;background:#44cc44;transition:width 0.2s,background-color 0.3s;';
		hpContainer.appendChild( this._hpBar );

		this._hpLabel = document.createElement( 'div' );
		this._hpLabel.style.cssText = 'font-size:13px;color:#ccc;text-align:center;';
		this._hpLabel.textContent = '100';
		this._root.appendChild( this._hpLabel );

		// Elimination warning overlay
		this._elimWarning = document.createElement( 'div' );
		this._elimWarning.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:99;border:4px solid transparent;transition:border-color 0.15s;';
		document.body.appendChild( this._elimWarning );

		this._flashTimer = 0;
		this._visible = true;

	}

	/**
	 * @param {import('./vehicle/VehicleHealth.js').VehicleHealth} health
	 * @param {string|null} heldItemId - current held item ID
	 * @param {number} dt
	 */
	update( health, heldItemId, dt ) {

		if ( ! health || ! this._visible ) return;

		// Update quadrant colors
		for ( let i = 0; i < 4; i ++ ) {

			this._quadrants[ i ].style.backgroundColor = STATE_COLORS[ health.quadrants[ i ].state ];

		}

		// Update HP bar
		const pct = Math.max( 0, health.globalHP );
		this._hpBar.style.width = pct + '%';
		this._hpLabel.textContent = Math.round( pct );

		if ( pct > 50 ) this._hpBar.style.backgroundColor = '#44cc44';
		else if ( pct > 25 ) this._hpBar.style.backgroundColor = '#cccc00';
		else this._hpBar.style.backgroundColor = '#ff2222';

		// Update item slot
		if ( heldItemId && ITEM_ICONS[ heldItemId ] ) {

			this._itemSlot.textContent = ITEM_ICONS[ heldItemId ];
			this._itemSlot.style.borderColor = '#ffdd44';

		} else {

			this._itemSlot.textContent = '';
			this._itemSlot.style.borderColor = '#555';

		}

		// Elimination warning flash
		if ( health.isCritical() && ! health.eliminated ) {

			this._flashTimer += dt;
			const flash = Math.sin( this._flashTimer * 8 ) > 0;
			this._elimWarning.style.borderColor = flash ? 'rgba(255,0,0,0.5)' : 'transparent';

		} else {

			this._elimWarning.style.borderColor = 'transparent';
			this._flashTimer = 0;

		}

	}

	show() {

		this._visible = true;
		this._root.style.display = 'flex';

	}

	hide() {

		this._visible = false;
		this._root.style.display = 'none';
		this._elimWarning.style.borderColor = 'transparent';

	}

	dispose() {

		this._root.remove();
		this._elimWarning.remove();

	}

}
