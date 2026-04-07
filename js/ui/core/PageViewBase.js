/**
 * PageViewBase — abstract base class for all page views.
 *
 * Responsibilities:
 *   - Create and own the root DOM element for a page.
 *   - Provide helpers for mounting content sections, applying state modifiers,
 *     binding button references by data-action, and rendering placeholders.
 *   - Declare a dispose() contract for listener/ref cleanup.
 *
 * Design principles:
 *   - Views own DOM, controllers own logic. Views do NOT call services directly.
 *   - The controller calls view.mount(container) to attach to the DOM, then
 *     calls view methods to update content regions.
 *   - Button references are retrieved via getBtnById() so the controller can
 *     attach handlers without reaching into the DOM arbitrarily.
 *
 * Architecture decisions:
 *   - The root element is created in the constructor, before mount(), so
 *     the controller can reference sub-elements during bindEvents() even
 *     before the view is in the live DOM.
 *   - _sections map stores named content region elements for structured updates.
 *   - Loading shimmer and empty-state are built-in helpers, not separate components,
 *     to keep the base class self-contained. Full component versions (SectionPanel,
 *     EmptyStateBlock) are used by subclasses.
 */

/** @type {number} */
let _uidCounter = 0;

export class PageViewBase {

	/**
	 * @param {string} [pageClass]  BEM block class applied to root element.
	 */
	constructor( pageClass = 'kk-page' ) {

		if ( new.target === PageViewBase ) {

			throw new Error( 'PageViewBase is abstract and cannot be instantiated directly.' );

		}

		/** @type {string} */
		this._uid = `page-${++ _uidCounter}`;

		/** @type {HTMLElement} */
		this._root = document.createElement( 'div' );
		this._root.className = pageClass;
		this._root.dataset.pageUid = this._uid;

		/** @type {Map<string, HTMLElement>} */
		this._sections = new Map();

		/** @type {boolean} */
		this._mounted = false;

		/** @type {boolean} */
		this._disposed = false;

	}

	// ---------------------------------------------------------------------------
	// DOM access
	// ---------------------------------------------------------------------------

	/**
	 * The root element for this page. The controller appends this to the container.
	 *
	 * @returns {HTMLElement}
	 */
	get root() { return this._root; }

	/**
	 * Unique ID for this view instance (use for scoped aria IDs).
	 *
	 * @returns {string}
	 */
	get uid() { return this._uid; }

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Mount this view's root element into `container`.
	 * Clears the container first so only this page is visible.
	 *
	 * @param {HTMLElement} container
	 */
	mount( container ) {

		if ( this._disposed ) {

			console.warn( `[${this.constructor.name}] Cannot mount a disposed view.` );
			return;

		}

		container.innerHTML = '';
		container.appendChild( this._root );
		this._mounted = true;

		this._onMounted();

	}

	/**
	 * Called immediately after the root element is appended to the container.
	 * Override in subclasses to run post-mount DOM queries (e.g., scroll to top,
	 * trigger entrance animations, focus the first interactive element).
	 */
	_onMounted() {

		// Default: focus the page root so screen readers announce the new page.
		// Subclasses can override to focus a more specific element.
		this._root.setAttribute( 'tabindex', '-1' );
		this._root.focus( { preventScroll: true } );

	}

	/**
	 * Remove the root from the DOM and release references.
	 * Called by PageControllerBase.dispose().
	 */
	dispose() {

		if ( this._disposed ) return;
		this._disposed = true;

		if ( this._root.parentNode ) {

			this._root.parentNode.removeChild( this._root );

		}

		this._sections.clear();

	}

	// ---------------------------------------------------------------------------
	// Section management
	// ---------------------------------------------------------------------------

	/**
	 * Register a named content region element.
	 * Subclasses call this during construction so the controller can later call
	 * setSection() to swap content in/out.
	 *
	 * @param {string}      name  Logical name, e.g. 'content', 'sidebar', 'actionBar'.
	 * @param {HTMLElement} el
	 */
	_registerSection( name, el ) {

		this._sections.set( name, el );

	}

	/**
	 * Replace the content of a named section.
	 *
	 * @param {string}             name
	 * @param {HTMLElement|string} content  Element or HTML string.
	 */
	setSection( name, content ) {

		const el = this._sections.get( name );

		if ( ! el ) {

			console.warn( `[${this.constructor.name}] Unknown section "${name}". Register it with _registerSection() in the constructor.` );
			return;

		}

		el.innerHTML = '';

		if ( content instanceof HTMLElement ) {

			el.appendChild( content );

		} else {

			el.innerHTML = content;

		}

	}

	/**
	 * Get a named section element for direct manipulation.
	 *
	 * @param {string} name
	 * @returns {HTMLElement | undefined}
	 */
	getSection( name ) {

		return this._sections.get( name );

	}

	// ---------------------------------------------------------------------------
	// Button binding
	// ---------------------------------------------------------------------------

	/**
	 * Find an interactive element by its `data-action` attribute within this view.
	 *
	 * @param {string} actionId  Value of the `data-action` attribute.
	 * @returns {HTMLElement | null}
	 */
	getBtnByAction( actionId ) {

		return this._root.querySelector( `[data-action="${actionId}"]` );

	}

	/**
	 * Find an element by its id within this view.
	 *
	 * @param {string} id
	 * @returns {HTMLElement | null}
	 */
	getBtnById( id ) {

		return this._root.querySelector( `#${id}` );

	}

	// ---------------------------------------------------------------------------
	// State modifiers
	// ---------------------------------------------------------------------------

	/**
	 * Apply or remove a BEM modifier class on the root element.
	 *
	 * @param {string}  modifier  Without leading '--', e.g. 'loading'.
	 * @param {boolean} active
	 */
	setModifier( modifier, active ) {

		const cls = `${this._root.className.split( ' ' )[ 0 ]}--${modifier}`;

		if ( active ) {

			this._root.classList.add( cls );

		} else {

			this._root.classList.remove( cls );

		}

	}

	/**
	 * Enter loading state: apply --loading modifier and aria-busy.
	 *
	 * @param {boolean} loading
	 */
	setLoading( loading ) {

		this.setModifier( 'loading', loading );
		this._root.setAttribute( 'aria-busy', String( loading ) );

	}

	/**
	 * Apply disabled state to the page root. Child elements remain interactive
	 * unless the subclass overrides this behavior.
	 *
	 * @param {boolean} disabled
	 */
	setDisabled( disabled ) {

		this.setModifier( 'disabled', disabled );
		this._root.setAttribute( 'aria-disabled', String( disabled ) );

	}

	// ---------------------------------------------------------------------------
	// Placeholder helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build a skeleton shimmer placeholder element with configurable height.
	 * Used inside section setLoading() before real content is available.
	 *
	 * @param {string} [height]  CSS height value. Default '200px'.
	 * @returns {HTMLElement}
	 */
	buildSkeleton( height = '200px' ) {

		const el = document.createElement( 'div' );
		el.className = 'kk-skeleton';
		el.setAttribute( 'aria-hidden', 'true' );
		el.style.height = height;
		return el;

	}

	/**
	 * Build an empty-state block per COMPONENT_SPEC.md §14.
	 *
	 * @param {EmptyStateOptions} options
	 * @returns {HTMLElement}
	 */
	buildEmptyState( { label, heading, subtext, actionEl } = {} ) {

		const el = document.createElement( 'div' );
		el.className = 'kk-empty-state';
		el.setAttribute( 'role', 'status' );
		if ( label ) el.setAttribute( 'aria-label', label );

		const iconEl = document.createElement( 'div' );
		iconEl.className = 'kk-empty-state__icon';
		iconEl.setAttribute( 'aria-hidden', 'true' );
		el.appendChild( iconEl );

		if ( heading ) {

			const h = document.createElement( 'p' );
			h.className = 'kk-empty-state__heading';
			h.textContent = heading;
			el.appendChild( h );

		}

		if ( subtext ) {

			const s = document.createElement( 'p' );
			s.className = 'kk-empty-state__subtext';
			s.textContent = subtext;
			el.appendChild( s );

		}

		if ( actionEl ) {

			const actionWrapper = document.createElement( 'div' );
			actionWrapper.className = 'kk-empty-state__action';
			actionWrapper.appendChild( actionEl );
			el.appendChild( actionWrapper );

		}

		return el;

	}

	/**
	 * Build a locked-state block.
	 *
	 * @param {LockedStateOptions} options
	 * @returns {HTMLElement}
	 */
	buildLockedState( { heading, subtext, unlockEl } = {} ) {

		const el = document.createElement( 'div' );
		el.className = 'kk-locked-state';
		el.setAttribute( 'role', 'status' );
		el.setAttribute( 'aria-label', 'Content locked' );

		const iconEl = document.createElement( 'div' );
		iconEl.className = 'kk-locked-state__icon';
		iconEl.setAttribute( 'aria-hidden', 'true' );
		iconEl.innerHTML = '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
		el.appendChild( iconEl );

		if ( heading ) {

			const h = document.createElement( 'p' );
			h.className = 'kk-locked-state__heading';
			h.textContent = heading;
			el.appendChild( h );

		}

		if ( subtext ) {

			const s = document.createElement( 'p' );
			s.className = 'kk-locked-state__subtext';
			s.textContent = subtext;
			el.appendChild( s );

		}

		if ( unlockEl ) {

			const wrapper = document.createElement( 'div' );
			wrapper.className = 'kk-locked-state__action';
			wrapper.appendChild( unlockEl );
			el.appendChild( wrapper );

		}

		return el;

	}

	/**
	 * Build an error state block.
	 *
	 * @param {string} message
	 * @param {Function} [onRetry]  If provided, a RETRY button is appended.
	 * @returns {HTMLElement}
	 */
	buildErrorState( message, onRetry ) {

		const el = document.createElement( 'div' );
		el.className = 'kk-error-state';
		el.setAttribute( 'role', 'alert' );

		const msg = document.createElement( 'p' );
		msg.className = 'kk-error-state__message';
		msg.textContent = message;
		el.appendChild( msg );

		if ( onRetry ) {

			const btn = document.createElement( 'button' );
			btn.className = 'kk-cta-button kk-cta-button--ghost';
			btn.type = 'button';
			btn.setAttribute( 'data-action', 'retry' );
			btn.innerHTML = '<span class="kk-cta-button__label">RETRY</span>';
			btn.addEventListener( 'click', onRetry );
			el.appendChild( btn );

		}

		return el;

	}

	// ---------------------------------------------------------------------------
	// Refresh
	// ---------------------------------------------------------------------------

	/**
	 * Update the view to reflect new data or state without a full unmount/remount.
	 * Subclasses should override this for partial-update support.
	 *
	 * @param {object} [state]
	 */
	refresh( state ) { // eslint-disable-line no-unused-vars

		// Default: no-op. Subclasses implement targeted DOM updates here.

	}

}

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} EmptyStateOptions
 * @property {string}          [label]     aria-label for the container.
 * @property {string}          [heading]   Large text, e.g. 'NO TRACKS YET'.
 * @property {string}          [subtext]   Supporting sentence.
 * @property {HTMLElement}     [actionEl]  Optional CTA button element.
 */

/**
 * @typedef {object} LockedStateOptions
 * @property {string}          [heading]
 * @property {string}          [subtext]
 * @property {HTMLElement}     [unlockEl]  Optional unlock/upgrade CTA element.
 */
