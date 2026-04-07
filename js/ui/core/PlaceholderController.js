/**
 * PlaceholderController.js
 * Generic placeholder for pages not yet implemented.
 * Shows a styled "Coming Soon" message with the route name.
 */

import { PageControllerBase } from './PageControllerBase.js';
import * as Nav from './NavigationService.js';

export class PlaceholderController extends PageControllerBase {

	constructor( services, route ) {

		super( services );
		this._route = route;

	}

	initialize() {

		this._root = document.createElement( 'div' );
		this._root.className = 'kk-placeholder-page';
		this._root.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 60vh;
			text-align: center;
			padding: var(--space-8, 32px);
		`;

		const title = document.createElement( 'h1' );
		title.style.cssText = `
			font-family: var(--font-display, 'Impact', sans-serif);
			font-size: var(--text-3xl, 2.25rem);
			font-weight: var(--weight-black, 900);
			color: var(--color-white, #fff);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide, 0.04em);
			margin: 0 0 var(--space-4, 16px);
		`;
		title.textContent = this._route.replace( /^\//, '' ).replace( /-/g, ' ' ).toUpperCase() || 'HOME';
		this._root.appendChild( title );

		const subtitle = document.createElement( 'p' );
		subtitle.style.cssText = `
			font-family: var(--font-ui, sans-serif);
			font-size: var(--text-lg, 1.125rem);
			color: var(--color-ink-400, #777);
			margin: 0 0 var(--space-8, 32px);
		`;
		subtitle.textContent = 'Coming in a future milestone';
		this._root.appendChild( subtitle );

		const backBtn = document.createElement( 'button' );
		backBtn.type = 'button';
		backBtn.textContent = 'BACK';
		backBtn.style.cssText = `
			font-family: var(--font-display, 'Impact', sans-serif);
			font-size: var(--text-md, 1rem);
			font-weight: var(--weight-bold, 700);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide, 0.04em);
			padding: var(--space-3, 12px) var(--space-8, 32px);
			background: transparent;
			color: var(--color-white, #fff);
			border: 2px solid var(--color-panel-border-strong, rgba(255,255,255,0.18));
			border-radius: var(--radius-md, 4px);
			cursor: pointer;
			transition: all var(--duration-fast, 100ms) ease;
		`;
		backBtn.addEventListener( 'click', () => Nav.back() );
		backBtn.addEventListener( 'mouseenter', () => {

			backBtn.style.borderColor = 'var(--color-white, #fff)';
			backBtn.style.background = 'rgba(255,255,255,0.05)';

		} );
		backBtn.addEventListener( 'mouseleave', () => {

			backBtn.style.borderColor = 'var(--color-panel-border-strong, rgba(255,255,255,0.18))';
			backBtn.style.background = 'transparent';

		} );
		this._root.appendChild( backBtn );

	}

	bindEvents() {}

	async loadData() {}

	render( container ) {

		container.appendChild( this._root );

	}

	dispose() {

		if ( this._root && this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}
		this._root = null;
		super.dispose();

	}

}
