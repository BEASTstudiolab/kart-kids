/**
 * HeroPreviewPanel — Sized DOM placeholder for an injected Three.js canvas or image.
 * Component #6 per COMPONENT_SPEC.md
 *
 * The component owns only position, dimensions, and loading state.
 * It does not import or initialize Three.js.
 * External system locates this container via data-preview-target="[sceneId]".
 *
 * DOM structure:
 *   div.kk-hero-preview-panel[role="img"][data-preview-target]
 *     div.kk-hero-preview-panel__inner   (canvas injection point)
 *     div.kk-hero-preview-panel__caption[aria-live="polite"]
 *
 * Events listened:
 *   kk:hero-preview:ready  (dispatched by external injector, caught on document)
 *
 * Events emitted: none (external injector owns ready signal).
 *
 * CSS injection: static guard, one <style> tag per class.
 */

let _hppUid = 0;

export class HeroPreviewPanel {

	static _cssInjected = false;

	/**
	 * @param {object} config
	 * @param {string} config.sceneId          Written to data-preview-target.
	 * @param {string} config.ariaLabel        Describes what is being previewed.
	 * @param {string|null} [config.caption]   Visible text below preview; null = no caption.
	 * @param {string} [config.aspectRatio]    CSS aspect-ratio value; default '4/3'.
	 * @param {boolean} [config.loading]       Default true; call setReady() to clear.
	 */
	constructor( config = {} ) {

		this._config = {
			sceneId:     '',
			ariaLabel:   'Preview',
			caption:     null,
			aspectRatio: '4/3',
			loading:     true,
			...config,
		};

		this._uid = ++ _hppUid;
		this._el = null;
		this._innerEl = null;
		this._captionEl = null;

		this._injectCSS();
		this._build();
		this._listenReady();

	}

	// ---------------------------------------------------------------------------
	// CSS
	// ---------------------------------------------------------------------------

	_injectCSS() {

		if ( HeroPreviewPanel._cssInjected ) return;
		HeroPreviewPanel._cssInjected = true;

		const style = document.createElement( 'style' );
		style.textContent = `
			.kk-hero-preview-panel {
				position: relative;
				width: 100%;
				background: var(--color-panel-base);
				border: var(--border-thin) solid var(--color-panel-border);
				border-radius: var(--radius-md);
				overflow: hidden;
			}

			.kk-hero-preview-panel__inner {
				position: relative;
				width: 100%;
				aspect-ratio: var(--kk-hpp-aspect, 4/3);
				overflow: hidden;
			}

			/* Canvas or img injected inside __inner fills the container */
			.kk-hero-preview-panel__inner canvas,
			.kk-hero-preview-panel__inner img {
				position: absolute;
				inset: 0;
				width: 100%;
				height: 100%;
				object-fit: cover;
			}

			/* Loading shimmer over __inner */
			.kk-hero-preview-panel--loading .kk-hero-preview-panel__inner::after {
				content: '';
				position: absolute;
				inset: 0;
				background: linear-gradient(
					90deg,
					var(--color-ink-800) 25%,
					var(--color-ink-700) 50%,
					var(--color-ink-800) 75%
				);
				background-size: 200% 100%;
				animation: kk-shimmer 1.4s ease-in-out infinite;
				z-index: 1;
			}

			@media (prefers-reduced-motion: reduce) {
				.kk-hero-preview-panel--loading .kk-hero-preview-panel__inner::after {
					animation: none;
					background: var(--color-ink-800);
				}
			}

			.kk-hero-preview-panel__caption {
				padding: var(--space-2) var(--space-3);
				font-family: var(--font-ui);
				font-size: var(--text-sm);
				font-weight: var(--weight-semibold);
				color: var(--color-ink-300);
				text-align: center;
				text-transform: uppercase;
				letter-spacing: var(--tracking-wide);
				min-height: var(--space-6);
			}
		`;
		document.head.appendChild( style );

	}

	// ---------------------------------------------------------------------------
	// Build
	// ---------------------------------------------------------------------------

	_build() {

		const { sceneId, ariaLabel, caption, aspectRatio, loading } = this._config;

		const root = document.createElement( 'div' );
		root.className = 'kk-hero-preview-panel';
		root.setAttribute( 'role', 'img' );
		root.setAttribute( 'aria-label', ariaLabel );
		root.dataset.previewTarget = sceneId;

		if ( loading ) {
			root.classList.add( 'kk-hero-preview-panel--loading' );
			root.setAttribute( 'aria-busy', 'true' );
		}

		// Set aspect ratio as a CSS custom property on the inner element
		const inner = document.createElement( 'div' );
		inner.className = 'kk-hero-preview-panel__inner';
		inner.style.setProperty( '--kk-hpp-aspect', aspectRatio );
		root.appendChild( inner );
		this._innerEl = inner;

		// Caption
		const captionEl = document.createElement( 'div' );
		captionEl.className = 'kk-hero-preview-panel__caption';
		captionEl.setAttribute( 'aria-live', 'polite' );
		if ( caption ) {
			captionEl.textContent = caption;
		}
		root.appendChild( captionEl );
		this._captionEl = captionEl;

		this._el = root;

	}

	// ---------------------------------------------------------------------------
	// Ready signal listener
	// ---------------------------------------------------------------------------

	_listenReady() {

		const sceneId = this._config.sceneId;

		this._readyHandler = ( e ) => {

			if ( e.detail && e.detail.sceneId === sceneId ) {
				this.setReady();
			}

		};

		document.addEventListener( 'kk:hero-preview:ready', this._readyHandler );

	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/** @returns {HTMLElement} */
	get el() {

		return this._el;

	}

	/** The injection point for the external Three.js canvas or image. */
	get inner() {

		return this._innerEl;

	}

	/**
	 * Mark preview as ready; removes --loading modifier and aria-busy.
	 * Called automatically when a kk:hero-preview:ready event fires with matching sceneId.
	 */
	setReady() {

		this._el.classList.remove( 'kk-hero-preview-panel--loading' );
		this._el.removeAttribute( 'aria-busy' );

	}

	/**
	 * Update the caption text and aria-live region.
	 *
	 * @param {string} text
	 */
	setCaption( text ) {

		this._captionEl.textContent = text;

	}

	/**
	 * Update the accessible label describing the preview content.
	 *
	 * @param {string} text
	 */
	setAriaLabel( text ) {

		this._el.setAttribute( 'aria-label', text );

	}

	/**
	 * Set loading state programmatically.
	 *
	 * @param {boolean} loading
	 */
	setLoading( loading ) {

		if ( loading ) {
			this._el.classList.add( 'kk-hero-preview-panel--loading' );
			this._el.setAttribute( 'aria-busy', 'true' );
		} else {
			this.setReady();
		}

	}

	dispose() {

		document.removeEventListener( 'kk:hero-preview:ready', this._readyHandler );

		if ( this._el && this._el.parentNode ) {
			this._el.parentNode.removeChild( this._el );
		}

		this._el = null;
		this._innerEl = null;
		this._captionEl = null;

	}

}
