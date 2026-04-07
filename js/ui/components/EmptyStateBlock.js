/**
 * EmptyStateBlock.js
 * No-content placeholder with icon, heading, subtext, and optional CTA.
 */

import { CTAButton } from './CTAButton.js';

export class EmptyStateBlock {

	static _cssInjected = false;

	constructor( { icon = null, heading = 'NO CONTENT', subtext = '', action = null, ariaLabel = null } = {} ) {

		this._icon = icon;
		this._heading = heading;
		this._subtext = subtext;
		this._action = action;
		this._ariaLabel = ariaLabel || heading;
		this._actionButton = null;

		EmptyStateBlock._injectCSS();
		this._root = this._createDOM();

	}

	static _injectCSS() {

		if ( EmptyStateBlock._cssInjected ) return;
		EmptyStateBlock._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-empty-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: var(--space-12, 3rem) var(--space-8, 2rem);
				text-align: center;
				min-height: 200px;
			}

			.kk-empty-state__icon {
				width: 64px;
				height: 64px;
				margin-bottom: var(--space-4, 1rem);
				opacity: 0.3;
				color: var(--color-ink-300, #aaa);
			}

			.kk-empty-state__icon svg {
				width: 100%;
				height: 100%;
				fill: currentColor;
			}

			.kk-empty-state__heading {
				font-family: var(--font-display, 'Impact', sans-serif);
				font-size: var(--text-xl, 1.375rem);
				font-weight: var(--weight-bold, 700);
				color: var(--color-ink-300, #aaa);
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide, 0.04em);
				margin: 0 0 var(--space-2, 0.5rem);
			}

			.kk-empty-state__subtext {
				font-family: var(--font-ui, sans-serif);
				font-size: var(--text-base, 0.875rem);
				color: var(--color-ink-400, #777);
				margin: 0 0 var(--space-6, 1.5rem);
				max-width: 320px;
				line-height: var(--leading-normal, 1.4);
			}

			.kk-empty-state__action {
				margin-top: var(--space-2, 0.5rem);
			}
		`;
		document.head.appendChild( style );

	}

	_createDOM() {

		const root = document.createElement( 'div' );
		root.className = 'kk-empty-state';
		root.setAttribute( 'role', 'status' );
		root.setAttribute( 'aria-label', this._ariaLabel );

		// Icon
		if ( this._icon ) {

			const iconWrap = document.createElement( 'div' );
			iconWrap.className = 'kk-empty-state__icon';
			iconWrap.setAttribute( 'aria-hidden', 'true' );
			if ( typeof this._icon === 'string' ) {

				iconWrap.innerHTML = this._icon;

			} else {

				iconWrap.appendChild( this._icon );

			}
			root.appendChild( iconWrap );

		} else {

			// Default empty icon (inbox/folder)
			const iconWrap = document.createElement( 'div' );
			iconWrap.className = 'kk-empty-state__icon';
			iconWrap.setAttribute( 'aria-hidden', 'true' );
			iconWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1Z"/><path d="m3 7 3.5-3h11L21 7"/></svg>';
			root.appendChild( iconWrap );

		}

		// Heading
		const headingEl = document.createElement( 'p' );
		headingEl.className = 'kk-empty-state__heading';
		headingEl.textContent = this._heading;
		root.appendChild( headingEl );

		// Subtext
		if ( this._subtext ) {

			const subtextEl = document.createElement( 'p' );
			subtextEl.className = 'kk-empty-state__subtext';
			subtextEl.textContent = this._subtext;
			root.appendChild( subtextEl );

		}

		// Optional CTA
		if ( this._action ) {

			const actionWrap = document.createElement( 'div' );
			actionWrap.className = 'kk-empty-state__action';
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
