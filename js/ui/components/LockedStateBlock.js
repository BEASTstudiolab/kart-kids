/**
 * LockedStateBlock.js
 * Locked-content placeholder with padlock icon, heading, condition text, and optional CTA.
 */

import { CTAButton } from './CTAButton.js';

export class LockedStateBlock {

	static _cssInjected = false;

	constructor( { heading = 'LOCKED', condition = '', action = null, ariaLabel = null } = {} ) {

		this._heading = heading;
		this._condition = condition;
		this._action = action;
		this._ariaLabel = ariaLabel || `Content locked: ${ condition }`;
		this._actionButton = null;

		LockedStateBlock._injectCSS();
		this._root = this._createDOM();

	}

	static _injectCSS() {

		if ( LockedStateBlock._cssInjected ) return;
		LockedStateBlock._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-locked-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: var(--space-12, 3rem) var(--space-8, 2rem);
				text-align: center;
				min-height: 200px;
				opacity: 0.7;
			}

			.kk-locked-state__icon {
				width: 48px;
				height: 48px;
				margin-bottom: var(--space-4, 1rem);
				color: var(--color-ink-400, #777);
			}

			.kk-locked-state__icon svg {
				width: 100%;
				height: 100%;
				fill: currentColor;
			}

			.kk-locked-state__heading {
				font-family: var(--font-display, 'Impact', sans-serif);
				font-size: var(--text-xl, 1.375rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-ink-300, #aaa);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wider, 0.08em);
				margin: 0 0 var(--space-2, 0.5rem);
			}

			.kk-locked-state__condition {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-base, 0.875rem);
				color: var(--color-ink-400, #777);
				margin: 0 0 var(--space-6, 1.5rem);
				max-width: 280px;
				line-height: var(--leading-normal, 1.4);
			}

			.kk-locked-state__action {
				margin-top: var(--space-2, 0.5rem);
			}
		`;
		document.head.appendChild( style );

	}

	_createDOM() {

		const root = document.createElement( 'div' );
		root.className = 'kk-locked-state';
		root.setAttribute( 'role', 'status' );
		root.setAttribute( 'aria-label', this._ariaLabel );

		// Padlock icon
		const iconWrap = document.createElement( 'div' );
		iconWrap.className = 'kk-locked-state__icon';
		iconWrap.setAttribute( 'aria-hidden', 'true' );
		iconWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C9.24 2 7 4.24 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7c0-2.76-2.24-5-5-5Zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v3H9V7Zm4 10.5a1.5 1.5 0 1 1-3 0v-3a1.5 1.5 0 1 1 3 0v3Z"/></svg>';
		root.appendChild( iconWrap );

		// Heading
		const headingEl = document.createElement( 'p' );
		headingEl.className = 'kk-locked-state__heading';
		headingEl.textContent = this._heading;
		root.appendChild( headingEl );

		// Condition text
		if ( this._condition ) {

			const condEl = document.createElement( 'p' );
			condEl.className = 'kk-locked-state__condition';
			condEl.textContent = this._condition;
			root.appendChild( condEl );

		}

		// Optional CTA
		if ( this._action ) {

			const actionWrap = document.createElement( 'div' );
			actionWrap.className = 'kk-locked-state__action';
			this._actionButton = new CTAButton( this._action );
			actionWrap.appendChild( this._actionButton.getElement() );
			root.appendChild( actionWrap );

		}

		return root;

	}

	getElement() {

		return this._root;

	}

	dispose() {

		if ( this._actionButton ) this._actionButton.dispose();
		if ( this._root && this._root.parentNode ) this._root.parentNode.removeChild( this._root );
		this._root = null;

	}

}
