/**
 * TopNav — Persistent horizontal navigation bar.
 * Component #1 per COMPONENT_SPEC.md
 */

export class TopNav {
  static _cssInjected = false;
  /**
   * @param {object} config
   * @param {Array<{label: string, route: string, disabled?: boolean}>} config.items
   * @param {string} config.activeRoute
   * @param {boolean} [config.showBrand]
   * @param {boolean} [config.showUtility]
   */
  constructor(config = {}) {
    this._config = {
      items: [],
      activeRoute: '',
      showBrand: true,
      showUtility: true,
      ...config,
    };

    this._el = null;
    this._listEl = null;
    this._linkEls = [];
    this._roverIndex = 0;

    this._injectCSS();
    this._build();
    this._bindEvents();
  }

  _injectCSS() {
    if (TopNav._cssInjected) return;
    TopNav._cssInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .kk-top-nav {
        position: sticky;
        top: 0;
        z-index: var(--z-topnav);
        display: flex;
        flex-direction: row;
        align-items: center;
        height: var(--topnav-height);
        padding: 0 var(--page-padding-x);
        background: var(--color-panel-base);
        border-bottom: var(--border-thin) solid var(--color-panel-border);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        gap: var(--space-6);
      }

      /* --- Brand --- */

      .kk-top-nav__brand {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
        text-decoration: none;
      }

      .kk-top-nav__logo {
        height: 2rem;
        width: auto;
        display: block;
      }

      .kk-top-nav__wordmark {
        font-family: var(--font-display);
        font-size: var(--text-lg);
        font-weight: var(--weight-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-white);
      }

      /* --- Nav list --- */

      .kk-top-nav__list {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        gap: 0;
        list-style: none;
        margin: 0;
        padding: 0;
        flex: 1 1 auto;
        height: 100%;
      }

      .kk-top-nav__item {
        display: flex;
        align-items: stretch;
      }

      /* --- Nav link --- */

      .kk-top-nav__link {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 var(--space-4);
        min-width: var(--hit-target-min);
        min-height: var(--hit-target-min);
        background: none;
        border: none;
        color: var(--color-ink-300);
        font-family: var(--font-display);
        font-size: var(--text-base);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        cursor: pointer;
        transition:
          color var(--duration-fast) var(--ease-standard),
          background var(--duration-fast) var(--ease-standard);
        white-space: nowrap;
      }
      .kk-top-nav__link::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: var(--space-4);
        right: var(--space-4);
        height: var(--border-base);
        background: var(--color-accent-orange);
        transform: scaleX(0);
        transform-origin: left center;
        transition: transform var(--duration-fast) var(--ease-standard);
      }

      .kk-top-nav__link:hover:not([aria-disabled="true"]) {
        color: var(--color-white);
        background: rgba(255, 255, 255, 0.04);
      }

      .kk-top-nav__link--selected,
      .kk-top-nav__link[aria-current="page"] {
        color: var(--color-white);
      }
      .kk-top-nav__link--selected::after,
      .kk-top-nav__link[aria-current="page"]::after {
        transform: scaleX(1);
      }

      .kk-top-nav__link--pressed {
        background: rgba(255, 255, 255, 0.08);
      }

      .kk-top-nav__link--disabled,
      .kk-top-nav__link[aria-disabled="true"] {
        opacity: 0.38;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* --- Link label --- */

      .kk-top-nav__link-label {
        pointer-events: none;
      }

      /* --- Utility slot --- */

      .kk-top-nav__utility {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--space-3);
        flex-shrink: 0;
        margin-left: auto;
      }
    `;
    document.head.appendChild(style);
  }

  _build() {
    const { items, activeRoute, showBrand, showUtility } = this._config;

    const nav = document.createElement('nav');
    nav.className = 'kk-top-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    // Brand
    if (showBrand) {
      const brand = document.createElement('div');
      brand.className = 'kk-top-nav__brand';

      const logo = document.createElement('img');
      logo.className = 'kk-top-nav__logo';
      logo.src = '/sprites/logo.png';
      logo.alt = 'Kart Kids';
      brand.appendChild(logo);

      const wordmark = document.createElement('span');
      wordmark.className = 'kk-top-nav__wordmark';
      wordmark.setAttribute('aria-hidden', 'true');
      wordmark.textContent = 'KART KIDS';
      brand.appendChild(wordmark);

      nav.appendChild(brand);
    }

    // Nav list
    const list = document.createElement('ul');
    list.className = 'kk-top-nav__list';
    list.setAttribute('role', 'list');

    this._linkEls = [];

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'kk-top-nav__item';
      li.setAttribute('role', 'listitem');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kk-top-nav__link';
      btn.dataset.route = item.route;

      const isActive = item.route === activeRoute;
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      if (isActive) btn.classList.add('kk-top-nav__link--selected');

      if (item.disabled) {
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('kk-top-nav__link--disabled');
      }

      const label = document.createElement('span');
      label.className = 'kk-top-nav__link-label';
      label.textContent = item.label;
      btn.appendChild(label);

      li.appendChild(btn);
      list.appendChild(li);
      this._linkEls.push(btn);
    });

    nav.appendChild(list);
    this._listEl = list;

    // Utility slot
    if (showUtility) {
      const utility = document.createElement('div');
      utility.className = 'kk-top-nav__utility';
      nav.appendChild(utility);
      this._utilityEl = utility;
    }

    this._el = nav;
  }

  _bindEvents() {
    // Pressed state
    this._linkEls.forEach((btn) => {
      btn.addEventListener('pointerdown', () => btn.classList.add('kk-top-nav__link--pressed'));
      const clearPressed = () => btn.classList.remove('kk-top-nav__link--pressed');
      btn.addEventListener('pointerup', clearPressed);
      btn.addEventListener('pointercancel', clearPressed);

      btn.addEventListener('click', () => {
        if (btn.getAttribute('aria-disabled') === 'true') return;
        const route = btn.dataset.route;
        const label = btn.querySelector('.kk-top-nav__link-label')?.textContent ?? '';
        this._el.dispatchEvent(
          new CustomEvent('kk:topnav:navigate', {
            bubbles: true,
            composed: true,
            detail: { route, label },
          })
        );
      });
    });

    // Arrow key roving focus within list
    this._listEl.addEventListener('keydown', (e) => {
      const links = this._linkEls;
      if (!links.length) return;

      let idx = links.indexOf(document.activeElement);
      if (idx === -1) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        idx = (idx + 1) % links.length;
        links[idx].focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        idx = (idx - 1 + links.length) % links.length;
        links[idx].focus();
      }
    });
  }

  /** @returns {HTMLElement} */
  get el() {
    return this._el;
  }

  /** Update the active route highlight. */
  setActiveRoute(route) {
    this._config.activeRoute = route;
    this._linkEls.forEach((btn) => {
      const isActive = btn.dataset.route === route;
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      btn.classList.toggle('kk-top-nav__link--selected', isActive);
    });
  }

  /** Inject content into the utility slot. */
  setUtilityContent(el) {
    if (this._utilityEl) {
      this._utilityEl.innerHTML = '';
      if (el) this._utilityEl.appendChild(el);
    }
  }

  dispose() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._linkEls = [];
  }
}
